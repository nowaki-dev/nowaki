use std::path::Path;

use anyhow::{anyhow, Result};
use oxc::allocator::Allocator;
use oxc::ast::ast::{Program, Statement};
use oxc::codegen::{Codegen, CodegenOptions};
use oxc::diagnostics::{GraphicalReportHandler, GraphicalTheme, NamedSource, OxcDiagnostic};
use oxc::parser::Parser;
use oxc::semantic::{Scoping, SemanticBuilder};
use oxc::span::SourceType;
use oxc::transformer::{JsxRuntime, TransformOptions, Transformer};
use oxc::transformer_plugins::{ReplaceGlobalDefines, ReplaceGlobalDefinesConfig};
use oxc_resolver::Resolver;

use crate::cache::Mode;
use crate::resolve::fs_path_to_url;

/// 1ファイルを変換する: TS型剥がし + JSX(automatic, preact) + import書き換え(Browserのみ)。
pub fn transform_file(
    root: &Path,
    path: &Path,
    source: &str,
    mode: Mode,
    resolver: &Resolver,
    client_defines: &[(String, String)],
) -> Result<String> {
    let allocator = Allocator::default();
    let source_type = SourceType::from_path(path).unwrap_or_else(|_| SourceType::tsx());

    let parsed = Parser::new(&allocator, source, source_type).parse();
    if !parsed.errors.is_empty() {
        return Err(anyhow!(
            "parse error\n{}",
            render_diagnostics(path, source, &parsed.errors)
        ));
    }
    let mut program = parsed.program;

    let scoping = SemanticBuilder::new()
        .build(&program)
        .semantic
        .into_scoping();
    let scoping = apply_client_defines(&allocator, scoping, &mut program, client_defines);

    let mut options = TransformOptions::default();
    options.jsx.runtime = JsxRuntime::Automatic;
    options.jsx.import_source = Some("preact".to_string());

    let transformed =
        Transformer::new(&allocator, path, &options).build_with_scoping(scoping, &mut program);
    if !transformed.errors.is_empty() {
        return Err(anyhow!(
            "transform error\n{}",
            render_diagnostics(path, source, &transformed.errors)
        ));
    }

    if mode == Mode::Browser {
        rewrite_imports(&allocator, root, path, &mut program, resolver);
    } else {
        // SSR: .css は no-op、アセットは URL 文字列の data モジュールに（Node が svg 等を
        // 直接 import して落ちないように。描画される <img src> はクライアントと一致する）。
        rewrite_ssr_imports(&allocator, root, path, &mut program, resolver);
    }

    // dev はインラインソースマップを付ける（minify しないので位置は正確）。
    let ret = Codegen::new()
        .with_options(CodegenOptions {
            source_map_path: Some(path.to_path_buf()),
            ..CodegenOptions::default()
        })
        .build(&program);
    let mut code = ret.code;
    if let Some(map) = ret.map {
        code.push_str("\n//# sourceMappingURL=");
        code.push_str(&map.to_data_url());
        code.push('\n');
    }
    Ok(code)
}

/// トップレベルの import / re-export の指定子をdevサーバーURLへ書き換える。
/// (JSX automatic変換が挿入する "preact/jsx-runtime" もここで拾われる)
fn rewrite_imports<'a>(
    allocator: &'a Allocator,
    root: &Path,
    path: &Path,
    program: &mut Program<'a>,
    resolver: &Resolver,
) {
    let dir = path.parent().unwrap_or(root);
    for stmt in program.body.iter_mut() {
        let source = match stmt {
            Statement::ImportDeclaration(decl) => Some(&mut decl.source),
            Statement::ExportNamedDeclaration(decl) => decl.source.as_mut(),
            Statement::ExportAllDeclaration(decl) => Some(&mut decl.source),
            _ => None,
        };
        let Some(lit) = source else { continue };
        if let Some(aliased) = crate::resolve::alias_specifier(lit.value.as_str()) {
            lit.value = allocator.alloc_str(aliased).into();
            lit.raw = None;
        }
        let Some(url) = map_specifier(lit.value.as_str(), dir, root, resolver) else {
            continue;
        };
        lit.value = allocator.alloc_str(&url).into();
        lit.raw = None;
    }
}

/// import.meta.env.PUBLIC_* / MODE などの定数置換を適用する（client_defines が空なら素通し）。
/// 3つの変換経路（dev transform / build client / build server）で共有する。
pub(crate) fn apply_client_defines<'a>(
    allocator: &'a Allocator,
    scoping: Scoping,
    program: &mut Program<'a>,
    defines: &[(String, String)],
) -> Scoping {
    if defines.is_empty() {
        return scoping;
    }
    match ReplaceGlobalDefinesConfig::new(defines) {
        Ok(config) => {
            ReplaceGlobalDefines::new(allocator, config)
                .build(scoping, program)
                .scoping
        }
        Err(_) => scoping, // 設定不正時は素通し
    }
}

/// oxc 診断を、file:line:col + 該当行 + キャレットのコードフレームへ整形する（色なし）。
fn render_diagnostics(path: &Path, source: &str, diags: &[OxcDiagnostic]) -> String {
    let handler = GraphicalReportHandler::new_themed(GraphicalTheme::unicode_nocolor());
    let name = path.to_string_lossy().to_string();
    let mut out = String::new();
    for diag in diags {
        let report = diag
            .clone()
            .with_source_code(NamedSource::new(name.clone(), source.to_string()));
        let _ = handler.render_report(&mut out, report.as_ref());
    }
    if out.trim().is_empty() {
        // フレーム化できない診断はメッセージ連結にフォールバック
        out = diags
            .iter()
            .map(|d| d.to_string())
            .collect::<Vec<_>>()
            .join("; ");
    }
    out
}

/// 指定子をURLへ解決する。書き換え不要/不能なら None。
/// アセット（画像・フォント等）は URL 文字列を default export する data モジュールに包む。
fn map_specifier(spec: &str, dir: &Path, root: &Path, resolver: &Resolver) -> Option<String> {
    // すでにURL・データURI・devサーバー内部パスのものは触らない
    if spec.starts_with('/') || spec.contains("://") || spec.starts_with("data:") {
        return None;
    }
    match resolver.resolve(dir, spec) {
        Ok(resolution) => {
            let full = resolution.full_path();
            let url = fs_path_to_url(root, &full);
            if crate::is_asset(&full) {
                Some(asset_module_data_url(&url))
            } else {
                Some(url)
            }
        }
        Err(err) => {
            eprintln!("[nowaki] 解決失敗 {spec} (from {}): {err}", dir.display());
            None
        }
    }
}

/// 任意の JS 本文を持つ data: モジュールを返す（Node/ブラウザどちらも import 可能）。
pub(crate) fn data_module(body: &str) -> String {
    format!("data:text/javascript,{}", percent_encode_js(body))
}

/// アセットの配信URLを default export する小さな JS モジュールを data: URI で返す。
/// `import logo from "./logo.png"` → logo === "<asset url>"（実体は別途バイナリ配信）。
pub(crate) fn asset_module_data_url(url: &str) -> String {
    data_module(&format!("export default {url:?}"))
}

/// data: URI の本文に安全な最小パーセントエンコード。
fn percent_encode_js(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// SSR向け: `.css` の副作用 import を空モジュールへ、アセット import は URL 文字列の
/// data モジュールへ書き換える（サーバーに DOM は無い／Node は svg 等を import できない）。
fn rewrite_ssr_imports<'a>(
    allocator: &'a Allocator,
    root: &Path,
    path: &Path,
    program: &mut Program<'a>,
    resolver: &Resolver,
) {
    let dir = path.parent().unwrap_or(root);
    for stmt in program.body.iter_mut() {
        let source = match stmt {
            Statement::ImportDeclaration(decl) => Some(&mut decl.source),
            Statement::ExportNamedDeclaration(decl) => decl.source.as_mut(),
            Statement::ExportAllDeclaration(decl) => Some(&mut decl.source),
            _ => None,
        };
        let Some(lit) = source else { continue };
        // React 系 bare import は Preact 互換へ（bare のまま残し、Node が preact/compat を解決）。
        if let Some(aliased) = crate::resolve::alias_specifier(lit.value.as_str()) {
            lit.value = allocator.alloc_str(aliased).into();
            lit.raw = None;
        }
        let spec = lit.value.as_str();
        // CSS Modules: クラス名マップだけを export する data モジュールに（注入は client 側で）。
        if spec.ends_with(".module.css") {
            if let Ok(resolution) = resolver.resolve(dir, spec) {
                let full = resolution.full_path();
                if let Ok(css) = std::fs::read_to_string(&full) {
                    let id = full.to_string_lossy();
                    let (_scoped, map) = crate::css::scope_css(&id, &css);
                    let body = format!("export default {}", crate::css::mapping_object(&map));
                    lit.value = allocator.alloc_str(&data_module(&body)).into();
                    lit.raw = None;
                }
            }
            continue;
        }
        if spec.ends_with(".css") {
            lit.value = allocator.alloc_str(crate::css::CSS_NOOP_SPECIFIER).into();
            lit.raw = None;
            continue;
        }
        if spec.starts_with('/') || spec.contains("://") || spec.starts_with("data:") {
            continue;
        }
        if let Ok(resolution) = resolver.resolve(dir, spec) {
            let full = resolution.full_path();
            if crate::is_asset(&full) {
                let url = fs_path_to_url(root, &full);
                lit.value = allocator.alloc_str(&asset_module_data_url(&url)).into();
                lit.raw = None;
            }
        }
    }
}
