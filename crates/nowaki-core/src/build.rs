//! 本番ビルド: クライアント側モジュールグラフを辿り、各モジュールを
//! 変換+minifyして dist/client/ へコンテンツハッシュ付きESMで出力する。
//! Phase 1 (MVP+) の unbundled ESM emit。スコープホイスティングによる
//! 真のチャンクバンドリングは Phase 3。

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, bail, Context, Result};
use oxc::allocator::Allocator;
use oxc::ast::ast::Statement;
use oxc::codegen::{Codegen, CodegenOptions};
use oxc::parser::Parser;
use oxc::semantic::SemanticBuilder;
use oxc::span::SourceType;
use oxc::transformer::{JsxRuntime, TransformOptions, Transformer};
use xxhash_rust::xxh3::xxh3_64;

use crate::NowakiCore;

pub struct BuildReport {
    pub modules: usize,
    pub islands: usize,
    pub server_modules: usize,
    pub out_dir: PathBuf,
}

/// エントリ（islandsランタイム + islands/配下）からグラフを辿り、
/// dist/client/ へ出力し manifest.json を書く。
pub fn build_client(core: &NowakiCore, dist: &Path) -> Result<BuildReport> {
    let client_dir = dist.join("client");
    fs::create_dir_all(&client_dir)
        .with_context(|| format!("dist作成失敗: {}", client_dir.display()))?;

    let mut emitted: HashMap<PathBuf, String> = HashMap::new();
    let mut visiting: HashSet<PathBuf> = HashSet::new();

    // エントリ1: islandsハイドレーションランタイム
    let runtime = core
        .root
        .join("node_modules/@nowaki-dev/runtime/client/islands.js");
    let runtime_out = if runtime.exists() {
        Some(emit(
            core,
            &runtime,
            &client_dir,
            &mut emitted,
            &mut visiting,
        )?)
    } else {
        None
    };

    // エントリ2..: islands/ 配下の各コンポーネント
    let mut islands: Vec<(String, String)> = Vec::new();
    let islands_dir = core.root.join("islands");
    if islands_dir.is_dir() {
        let mut entries: Vec<PathBuf> = fs::read_dir(&islands_dir)?
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| crate::is_transformable(p))
            .collect();
        entries.sort();
        for path in entries {
            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("island")
                .to_string();
            let out = emit(core, &path, &client_dir, &mut emitted, &mut visiting)?;
            islands.push((name, out));
        }
    }

    fs::write(
        client_dir.join("manifest.json"),
        render_manifest(runtime_out.as_deref(), &islands),
    )?;

    Ok(BuildReport {
        modules: emitted.len(),
        islands: islands.len(),
        server_modules: 0,
        out_dir: client_dir,
    })
}

/// サーバー側ビルド: routes/ と islands/ を SSRモードで変換し、
/// dist/server/ へ Node が直接実行できる ESM として出力する。
/// 相対importの .tsx/.ts/.jsx を .js へ書き換える（bare importはNode解決に任せる）。
/// 出力モジュール数を返す。
pub fn build_server(core: &NowakiCore, dist: &Path) -> Result<usize> {
    let server_dir = dist.join("server");
    let mut count = 0;
    // routes/islands に加え、共有のサーバーモジュール (components/, lib/) も出力する。
    for sub in ["routes", "islands", "components", "lib"] {
        let src_root = core.root.join(sub);
        if !src_root.is_dir() {
            continue;
        }
        for path in walk_files(&src_root)? {
            if !crate::is_transformable(&path) {
                continue;
            }
            let rel = path
                .strip_prefix(&core.root)
                .with_context(|| format!("rel化失敗: {}", path.display()))?;
            let out_path = server_dir.join(with_js_ext(rel));
            let source = fs::read_to_string(&path)
                .with_context(|| format!("読み込み失敗: {}", path.display()))?;
            let code = transform_for_server(&path, &source, core)?;
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(&out_path, code)?;
            count += 1;
        }
    }
    Ok(count)
}

/// SSR向け変換: TS除去 + JSX(automatic, preact)。相対ローカルimportの拡張子を
/// .js へ書き換える。bare import (npm) はそのまま（Nodeが解決する）。minifyしない
/// （SSRのスタックトレース可読性のため）。
fn transform_for_server(path: &Path, source: &str, core: &NowakiCore) -> Result<String> {
    let allocator = Allocator::default();
    let source_type = SourceType::from_path(path).unwrap_or_else(|_| SourceType::tsx());

    let parsed = Parser::new(&allocator, source, source_type).parse();
    if !parsed.errors.is_empty() {
        let msgs: Vec<String> = parsed.errors.iter().map(|e| e.to_string()).collect();
        return Err(anyhow!(
            "parse error in {}: {}",
            path.display(),
            msgs.join("; ")
        ));
    }
    let mut program = parsed.program;

    let scoping = SemanticBuilder::new()
        .build(&program)
        .semantic
        .into_scoping();
    let scoping = crate::transform::apply_client_defines(
        &allocator,
        scoping,
        &mut program,
        &core.client_defines,
    );

    let mut options = TransformOptions::default();
    options.jsx.runtime = JsxRuntime::Automatic;
    options.jsx.import_source = Some("preact".to_string());
    let ret =
        Transformer::new(&allocator, path, &options).build_with_scoping(scoping, &mut program);
    if !ret.errors.is_empty() {
        let msgs: Vec<String> = ret.errors.iter().map(|e| e.to_string()).collect();
        return Err(anyhow!(
            "transform error in {}: {}",
            path.display(),
            msgs.join("; ")
        ));
    }

    for stmt in program.body.iter_mut() {
        let source_lit = match stmt {
            Statement::ImportDeclaration(d) => Some(&mut d.source),
            Statement::ExportNamedDeclaration(d) => d.source.as_mut(),
            Statement::ExportAllDeclaration(d) => Some(&mut d.source),
            _ => None,
        };
        let Some(lit) = source_lit else { continue };
        if let Some(rewritten) = rewrite_server_spec(lit.value.as_str()) {
            lit.value = allocator.alloc_str(&rewritten).into();
            lit.raw = None;
        }
    }

    Ok(Codegen::new().build(&program).code)
}

/// 相対ローカルimportの TS拡張子を .js へ。bare/absolute/.js は触らない。
fn rewrite_server_spec(spec: &str) -> Option<String> {
    if !spec.starts_with('.') {
        return None; // bare import (npm) はそのまま
    }
    if spec.ends_with(".css") {
        // SSR では .css を no-op に（CSS はクライアント専用）
        return Some(crate::css::CSS_NOOP_SPECIFIER.to_string());
    }
    for ext in [".tsx", ".jsx", ".ts"] {
        if let Some(stem) = spec.strip_suffix(ext) {
            return Some(format!("{stem}.js"));
        }
    }
    None
}

/// 相対パスの拡張子を .js に変えて返す。
fn with_js_ext(rel: &Path) -> PathBuf {
    rel.with_extension("js")
}

/// ディレクトリ以下のファイルを再帰的に集める。
fn walk_files(dir: &Path) -> Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_dir() {
            out.extend(walk_files(&path)?);
        } else {
            out.push(path);
        }
    }
    Ok(out)
}

/// 1モジュールを（依存を先に処理してから）出力し、出力ファイル名を返す。
/// 後順DFS: 依存のハッシュ名が確定してから自分のimportを書き換え、最終内容で
/// 自分のハッシュを計算する。これによりコンテンツハッシュが内容と一致する。
fn emit(
    core: &NowakiCore,
    abs: &Path,
    out_dir: &Path,
    emitted: &mut HashMap<PathBuf, String>,
    visiting: &mut HashSet<PathBuf>,
) -> Result<String> {
    if let Some(name) = emitted.get(abs) {
        return Ok(name.clone());
    }
    // .css は <style> 注入の JS シムとして出力（依存なし）
    if crate::css::is_css(abs) {
        let css =
            fs::read_to_string(abs).with_context(|| format!("読み込み失敗: {}", abs.display()))?;
        let id = abs
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("style.css");
        let code = crate::css::css_shim(id, &css);
        let hash = xxh3_64(code.as_bytes()) as u32;
        let stem = abs.file_stem().and_then(|s| s.to_str()).unwrap_or("style");
        let filename = format!("{stem}.css.{hash:08x}.js");
        fs::write(out_dir.join(&filename), &code)?;
        emitted.insert(abs.to_path_buf(), filename.clone());
        return Ok(filename);
    }
    if visiting.contains(abs) {
        bail!(
            "循環依存を検出: {} (Phase 1 buildは循環未対応)",
            abs.display()
        );
    }
    visiting.insert(abs.to_path_buf());

    let source =
        fs::read_to_string(abs).with_context(|| format!("読み込み失敗: {}", abs.display()))?;
    let module = transform_for_bundle(abs, &source, core)?;

    let mut code = module.code;
    for dep in &module.deps {
        let dep_name = emit(core, &dep.abs_path, out_dir, emitted, visiting)?;
        code = code.replace(&dep.placeholder, &format!("./{dep_name}"));
    }

    visiting.remove(abs);

    let hash = xxh3_64(code.as_bytes()) as u32;
    let stem = abs.file_stem().and_then(|s| s.to_str()).unwrap_or("module");
    let filename = format!("{stem}.{hash:08x}.js");
    fs::write(out_dir.join(&filename), &code)?;
    emitted.insert(abs.to_path_buf(), filename.clone());
    Ok(filename)
}

struct BundleModule {
    code: String,
    deps: Vec<DepRef>,
}

struct DepRef {
    placeholder: String,
    abs_path: PathBuf,
}

/// TS型剥がし + JSX(automatic, preact) + minify codegen。
/// importの指定子は一意なプレースホルダに置換し、解決済み絶対パスを deps に記録する。
/// （プレースホルダは呼び出し側が依存のハッシュ名へ最終置換する）
fn transform_for_bundle(path: &Path, source: &str, core: &NowakiCore) -> Result<BundleModule> {
    let allocator = Allocator::default();
    let source_type = SourceType::from_path(path).unwrap_or_else(|_| SourceType::tsx());

    let parsed = Parser::new(&allocator, source, source_type).parse();
    if !parsed.errors.is_empty() {
        let msgs: Vec<String> = parsed.errors.iter().map(|e| e.to_string()).collect();
        return Err(anyhow!(
            "parse error in {}: {}",
            path.display(),
            msgs.join("; ")
        ));
    }
    let mut program = parsed.program;

    let scoping = SemanticBuilder::new()
        .build(&program)
        .semantic
        .into_scoping();
    let scoping = crate::transform::apply_client_defines(
        &allocator,
        scoping,
        &mut program,
        &core.client_defines,
    );

    let mut options = TransformOptions::default();
    options.jsx.runtime = JsxRuntime::Automatic;
    options.jsx.import_source = Some("preact".to_string());
    let ret =
        Transformer::new(&allocator, path, &options).build_with_scoping(scoping, &mut program);
    if !ret.errors.is_empty() {
        let msgs: Vec<String> = ret.errors.iter().map(|e| e.to_string()).collect();
        return Err(anyhow!(
            "transform error in {}: {}",
            path.display(),
            msgs.join("; ")
        ));
    }

    let dir = path.parent().unwrap_or(&core.root);
    let mut deps = Vec::new();
    for stmt in program.body.iter_mut() {
        let source_lit = match stmt {
            Statement::ImportDeclaration(d) => Some(&mut d.source),
            Statement::ExportNamedDeclaration(d) => d.source.as_mut(),
            Statement::ExportAllDeclaration(d) => Some(&mut d.source),
            _ => None,
        };
        let Some(lit) = source_lit else { continue };
        let spec = lit.value.as_str();
        if spec.starts_with('/') || spec.contains("://") || spec.starts_with("data:") {
            continue;
        }
        let resolved = core
            .resolver
            .resolve(dir, spec)
            .map_err(|e| anyhow!("解決失敗 {spec} (from {}): {e}", dir.display()))?;
        let placeholder = format!("__NOWAKI_DEP_{}__", deps.len());
        lit.value = allocator.alloc_str(&placeholder).into();
        lit.raw = None;
        deps.push(DepRef {
            placeholder,
            abs_path: resolved.full_path(),
        });
    }

    let code = Codegen::new()
        .with_options(CodegenOptions {
            minify: true,
            ..CodegenOptions::default()
        })
        .build(&program)
        .code;

    Ok(BundleModule { code, deps })
}

/// manifest.json を手書きで生成（依存を増やさないため serde 不使用）。
/// ファイル名は ascii のみなのでエスケープ不要。
fn render_manifest(runtime: Option<&str>, islands: &[(String, String)]) -> String {
    let runtime_field = match runtime {
        Some(r) => format!("\"{r}\""),
        None => "null".to_string(),
    };
    let island_fields: Vec<String> = islands
        .iter()
        .map(|(name, file)| format!("    \"{name}\": \"{file}\""))
        .collect();
    format!(
        "{{\n  \"runtime\": {runtime_field},\n  \"islands\": {{\n{}\n  }}\n}}\n",
        island_fields.join(",\n")
    )
}
