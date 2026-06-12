use std::path::Path;

use anyhow::{anyhow, Result};
use oxc::allocator::Allocator;
use oxc::ast::ast::{Program, Statement};
use oxc::codegen::Codegen;
use oxc::diagnostics::{GraphicalReportHandler, GraphicalTheme, NamedSource, OxcDiagnostic};
use oxc::parser::Parser;
use oxc::semantic::SemanticBuilder;
use oxc::span::SourceType;
use oxc::transformer::{JsxRuntime, TransformOptions, Transformer};
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
    }

    Ok(Codegen::new().build(&program).code)
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
        let Some(url) = map_specifier(lit.value.as_str(), dir, root, resolver) else {
            continue;
        };
        lit.value = allocator.alloc_str(&url).into();
        lit.raw = None;
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
fn map_specifier(spec: &str, dir: &Path, root: &Path, resolver: &Resolver) -> Option<String> {
    // すでにURL・データURI・devサーバー内部パスのものは触らない
    if spec.starts_with('/') || spec.contains("://") || spec.starts_with("data:") {
        return None;
    }
    match resolver.resolve(dir, spec) {
        Ok(resolution) => Some(fs_path_to_url(root, &resolution.full_path())),
        Err(err) => {
            eprintln!("[nowaki] 解決失敗 {spec} (from {}): {err}", dir.display());
            None
        }
    }
}
