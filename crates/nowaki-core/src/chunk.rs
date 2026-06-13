//! スコープホイスティング型のチャンク生成。
//!
//! 各 island から到達する「アプリ側モジュール（プロジェクト配下・node_modules でない）で、
//! その island だけが使うもの」を1つのスコープへ連結する（= スコープホイスティング）。
//! トップレベルのバインディングはグローバル一意名にリネームし、チャンク内 import は直接参照に、
//! チャンク外（node_modules / 共有モジュール）への import は ESM import のまま残す。
//! node_modules は別チャンクとして分離・共有するので preact のインスタンスは1つに保たれる。
//! 連結後にチャンク全体を minify する。

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};
use oxc::allocator::Allocator;
use oxc::ast::ast::{
    Declaration, ExportDefaultDeclarationKind, ImportDeclarationSpecifier, ModuleExportName,
    Statement,
};
use oxc::codegen::{Codegen, CodegenOptions};
use oxc::minifier::{Minifier, MinifierOptions};
use oxc::parser::Parser;
use oxc::semantic::SemanticBuilder;
use oxc::span::SourceType;
use oxc::transformer::{JsxRuntime, TransformOptions, Transformer};
use xxhash_rust::xxh3::xxh3_64;

use crate::NowakiCore;

/// アプリ側の変換対象モジュールか（プロジェクト配下・node_modules でない）。
pub fn is_app_module(core: &NowakiCore, abs: &Path) -> bool {
    crate::is_transformable(abs)
        && abs.starts_with(&core.root)
        && !abs.components().any(|c| c.as_os_str() == "node_modules")
}

/// 1モジュールの直接依存（解決済み絶対パス）を返す。
pub fn module_deps(core: &NowakiCore, abs: &Path) -> Result<Vec<PathBuf>> {
    Ok(extract_meta(core, abs, 0)?
        .deps
        .into_iter()
        .map(|(p, _)| p)
        .collect())
}

/// entry から到達するアプリ側モジュール（entry を含む）を集める。node_modules には入らない。
pub fn collect_app_modules(core: &NowakiCore, entry: &Path) -> HashSet<PathBuf> {
    let mut set = HashSet::new();
    let mut stack = vec![entry.to_path_buf()];
    while let Some(abs) = stack.pop() {
        if !is_app_module(core, &abs) || !set.insert(abs.clone()) {
            continue;
        }
        if let Ok(deps) = module_deps(core, &abs) {
            for d in deps {
                if is_app_module(core, &d) {
                    stack.push(d);
                }
            }
        }
    }
    set
}

/// このモジュールが連結に未対応の構文（`export *` 等）を含むか。
pub fn needs_fallback(core: &NowakiCore, abs: &Path) -> bool {
    extract_meta(core, abs, 0)
        .map(|m| m.fallback)
        .unwrap_or(true)
}

/// 1モジュールの import / export メタデータ（AST は持たない）。
struct ModuleMeta {
    /// このモジュールの直接依存（解決済み絶対パス, 元の指定子）
    deps: Vec<(PathBuf, String)>,
    /// export 名 → ローカルのバインディング名（`export {a as b}` は b→a）
    exports: Vec<(String, String)>,
    /// import: (解決済み絶対パス, 元指定子, items)
    imports: Vec<ImportInfo>,
    /// グローバルインデックス（リネーム接尾辞に使う）
    idx: usize,
    /// 連結を諦めて単体 emit にフォールバックするか（未対応構文を含む）
    fallback: bool,
}

struct ImportInfo {
    source_abs: PathBuf,
    items: Vec<ImportItem>,
}

#[derive(Clone)]
enum ImportItem {
    /// `import { imported as local }`
    Named { imported: String, local: String },
    /// `import local`（default import）
    Default { local: String },
    /// `import "x"`（副作用のみ）
    SideEffect,
}

/// island チャンクのコードを生成する。`internal` はこのチャンクに連結するアプリモジュール集合
/// （entry を含む）。`external_name` は「チャンク外モジュール abs → 別途 emit 済みのファイル名」。
/// 返り値はチャンクのソース（未 minify）。entry の default export をチャンクの default にする。
#[allow(clippy::too_many_arguments)]
pub fn hoist_chunk(
    core: &NowakiCore,
    entry: &Path,
    internal: &[PathBuf],
    external_name: &HashMap<PathBuf, String>,
) -> Result<String> {
    // --- パス1: 各内部モジュールのメタデータを集める ---
    let internal_set: HashSet<&Path> = internal.iter().map(|p| p.as_path()).collect();
    let mut metas: HashMap<PathBuf, ModuleMeta> = HashMap::new();
    for (i, abs) in internal.iter().enumerate() {
        let meta = extract_meta(core, abs, i)?;
        metas.insert(abs.clone(), meta);
    }

    // 連結順: 依存を先に（後順DFS）。循環は訪問済みで打ち切る。
    let mut order: Vec<PathBuf> = Vec::new();
    let mut visited: HashSet<PathBuf> = HashSet::new();
    let mut stack: HashSet<PathBuf> = HashSet::new();
    order_modules(entry, &metas, &mut order, &mut visited, &mut stack);

    // 内部モジュールの export 名 → リネーム後グローバル名 を引けるようにする。
    let renamed_export = |abs: &Path, export_name: &str| -> Option<String> {
        let m = metas.get(abs)?;
        let (_, local) = m.exports.iter().find(|(n, _)| n == export_name)?;
        Some(format!("{local}${}", m.idx))
    };

    // --- パス2: 各モジュールを再変換し、リネーム + import/export 除去して body を得る ---
    let mut ext_imports: Vec<String> = Vec::new(); // チャンク先頭の ESM import
    let mut ext_seen: HashSet<String> = HashSet::new();
    let mut bodies: Vec<String> = Vec::new();

    for abs in &order {
        let meta = &metas[abs];
        // 外部 import の配線を決める（このモジュールの import のうち external なもの）
        let mut wiring = ImportWiring::default();
        for imp in &meta.imports {
            let internal_dep = internal_set.contains(imp.source_abs.as_path());
            for item in &imp.items {
                match item {
                    ImportItem::Named { imported, local } => {
                        if internal_dep {
                            if let Some(target) = renamed_export(&imp.source_abs, imported) {
                                wiring.rename_local.insert(local.clone(), target);
                            }
                        } else {
                            let renamed = format!("{local}${}", meta.idx);
                            wiring.rename_local.insert(local.clone(), renamed.clone());
                            if let Some(file) = external_name.get(&imp.source_abs) {
                                ext_imports_push(
                                    &mut ext_imports,
                                    &mut ext_seen,
                                    format!("import{{{imported} as {renamed}}}from\"./{file}\";"),
                                );
                            }
                        }
                    }
                    ImportItem::Default { local } => {
                        if internal_dep {
                            if let Some(target) = renamed_export(&imp.source_abs, "default") {
                                wiring.rename_local.insert(local.clone(), target);
                            }
                        } else {
                            let renamed = format!("{local}${}", meta.idx);
                            wiring.rename_local.insert(local.clone(), renamed.clone());
                            if let Some(file) = external_name.get(&imp.source_abs) {
                                ext_imports_push(
                                    &mut ext_imports,
                                    &mut ext_seen,
                                    format!("import {renamed} from\"./{file}\";"),
                                );
                            }
                        }
                    }
                    ImportItem::SideEffect => {
                        if !internal_dep {
                            if let Some(file) = external_name.get(&imp.source_abs) {
                                ext_imports_push(
                                    &mut ext_imports,
                                    &mut ext_seen,
                                    format!("import\"./{file}\";"),
                                );
                            }
                        }
                    }
                }
            }
        }
        let body = render_body(core, abs, meta.idx, &wiring)?;
        bodies.push(body);
    }

    // entry の default export をチャンクの default として再 export
    let entry_default = renamed_export(entry, "default").ok_or_else(|| {
        anyhow!(
            "island が default export を持っていません: {}",
            entry.display()
        )
    })?;

    let mut out = String::new();
    for imp in &ext_imports {
        out.push_str(imp);
        out.push('\n');
    }
    for body in &bodies {
        out.push_str(body);
        out.push('\n');
    }
    out.push_str(&format!("export{{{entry_default} as default}};\n"));
    Ok(out)
}

#[derive(Default)]
struct ImportWiring {
    /// 元のローカル名 → リネーム後の名前（内部なら依存先のグローバル名、外部なら自分の接尾辞付き名）
    rename_local: HashMap<String, String>,
}

fn ext_imports_push(list: &mut Vec<String>, seen: &mut HashSet<String>, line: String) {
    if seen.insert(line.clone()) {
        list.push(line);
    }
}

/// import/export のメタデータだけ抽出する（連結順・配線計算に使う）。
fn extract_meta(core: &NowakiCore, abs: &Path, idx: usize) -> Result<ModuleMeta> {
    let allocator = Allocator::default();
    let source = core.read_source(abs)?;
    // サーバーモジュール（`"use server"`）はクライアントの連結境界。依存を辿らず（サーバー専用
    // 依存をクライアントへ引き込まない）、連結対象にもしない（emit がプロキシを別チャンク化する）。
    if crate::server_fn::has_use_server(&source) {
        return Ok(ModuleMeta {
            deps: Vec::new(),
            exports: Vec::new(),
            imports: Vec::new(),
            idx,
            fallback: true,
        });
    }
    let source_type = SourceType::from_path(abs).unwrap_or_else(|_| SourceType::tsx());
    let mut program = Parser::new(&allocator, &source, source_type)
        .parse()
        .program;

    let scoping = SemanticBuilder::new()
        .build(&program)
        .semantic
        .into_scoping();
    let mut options = TransformOptions::default();
    options.jsx.runtime = JsxRuntime::Automatic;
    options.jsx.import_source = Some("preact".to_string());
    Transformer::new(&allocator, abs, &options).build_with_scoping(scoping, &mut program);

    let dir = abs.parent().unwrap_or(&core.root);
    let mut meta = ModuleMeta {
        deps: Vec::new(),
        exports: Vec::new(),
        imports: Vec::new(),
        idx,
        fallback: false,
    };

    for stmt in &program.body {
        match stmt {
            Statement::ImportDeclaration(d) => {
                let Some(abs_src) = resolve(core, dir, d.source.value.as_str()) else {
                    continue;
                };
                meta.deps
                    .push((abs_src.clone(), d.source.value.to_string()));
                let mut items = Vec::new();
                if let Some(specs) = &d.specifiers {
                    for s in specs {
                        match s {
                            ImportDeclarationSpecifier::ImportSpecifier(sp) => {
                                items.push(ImportItem::Named {
                                    imported: export_name_str(&sp.imported),
                                    local: sp.local.name.to_string(),
                                });
                            }
                            ImportDeclarationSpecifier::ImportDefaultSpecifier(sp) => {
                                items.push(ImportItem::Default {
                                    local: sp.local.name.to_string(),
                                });
                            }
                            ImportDeclarationSpecifier::ImportNamespaceSpecifier(_) => {
                                meta.fallback = true; // `import * as` は未対応
                            }
                        }
                    }
                } else {
                    items.push(ImportItem::SideEffect);
                }
                meta.imports.push(ImportInfo {
                    source_abs: abs_src,
                    items,
                });
            }
            Statement::ExportNamedDeclaration(d) => {
                if let Some(decl) = &d.declaration {
                    for name in decl_bound_names(decl) {
                        meta.exports.push((name.clone(), name));
                    }
                } else if d.source.is_some() {
                    meta.fallback = true; // `export {..} from` 再export は未対応
                } else {
                    for sp in &d.specifiers {
                        let local = export_name_str(&sp.local);
                        let exported = export_name_str(&sp.exported);
                        meta.exports.push((exported, local));
                    }
                }
            }
            Statement::ExportDefaultDeclaration(d) => match &d.declaration {
                ExportDefaultDeclarationKind::FunctionDeclaration(f) => {
                    if let Some(i) = &f.id {
                        meta.exports
                            .push(("default".to_string(), i.name.to_string()));
                    } else {
                        meta.fallback = true; // 無名 default は未対応
                    }
                }
                ExportDefaultDeclarationKind::ClassDeclaration(c) => {
                    if let Some(i) = &c.id {
                        meta.exports
                            .push(("default".to_string(), i.name.to_string()));
                    } else {
                        meta.fallback = true;
                    }
                }
                _ => meta.fallback = true, // 式の default export は未対応
            },
            Statement::ExportAllDeclaration(_) => {
                meta.fallback = true; // `export *` は未対応
            }
            _ => {}
        }
    }
    Ok(meta)
}

/// モジュール本体を、リネーム + import/export 除去して codegen した文字列にする。
fn render_body(core: &NowakiCore, abs: &Path, idx: usize, wiring: &ImportWiring) -> Result<String> {
    let allocator = Allocator::default();
    let source = core.read_source(abs)?;
    let source_type = SourceType::from_path(abs).unwrap_or_else(|_| SourceType::tsx());
    let mut program = Parser::new(&allocator, &source, source_type)
        .parse()
        .program;

    let scoping = SemanticBuilder::new()
        .build(&program)
        .semantic
        .into_scoping();
    let mut options = TransformOptions::default();
    options.jsx.runtime = JsxRuntime::Automatic;
    options.jsx.import_source = Some("preact".to_string());
    let mut scoping = Transformer::new(&allocator, abs, &options)
        .build_with_scoping(scoping, &mut program)
        .scoping;
    let scoping = crate::transform::apply_client_defines(
        &allocator,
        scoping_take(&mut scoping),
        &mut program,
        &core.client_defines,
    );

    // import の local 名集合（own バインディングと区別する）
    let mut import_locals: HashSet<String> = HashSet::new();
    for stmt in &program.body {
        if let Statement::ImportDeclaration(d) = stmt {
            if let Some(specs) = &d.specifiers {
                for s in specs {
                    import_locals.insert(import_spec_local(s));
                }
            }
        }
    }

    // ルートスコープのバインディングをリネーム:
    //   import binding -> wiring.rename_local（依存先のグローバル名 or 外部 import の別名）
    //   own binding    -> `<name>$<idx>`
    let mut scoping = scoping;
    let root = scoping.root_scope_id();
    let bindings: Vec<(String, _)> = scoping
        .get_bindings(root)
        .iter()
        .map(|(name, sym)| (name.to_string(), *sym))
        .collect();
    for (name, sym) in bindings {
        let new_name = if import_locals.contains(&name) {
            wiring.rename_local.get(&name).cloned()
        } else {
            Some(format!("{name}${idx}"))
        };
        if let Some(nn) = new_name {
            let nn = allocator.alloc_str(&nn);
            scoping.rename_symbol(sym, root, nn.into());
        }
    }

    // import を除去し、export を裸の宣言に変換する。
    let mut new_body = oxc::allocator::Vec::new_in(&allocator);
    for stmt in program.body.drain(..) {
        match stmt {
            Statement::ImportDeclaration(_) => { /* 除去 */ }
            Statement::ExportNamedDeclaration(d) => {
                let d = d.unbox();
                if let Some(decl) = d.declaration {
                    new_body.push(Statement::from(decl));
                }
                // specifiers のみ（`export {a}`）はバインディングが既にあるので捨てる
            }
            Statement::ExportDefaultDeclaration(d) => {
                let d = d.unbox();
                match d.declaration {
                    ExportDefaultDeclarationKind::FunctionDeclaration(f) => {
                        new_body.push(Statement::FunctionDeclaration(f));
                    }
                    ExportDefaultDeclarationKind::ClassDeclaration(c) => {
                        new_body.push(Statement::ClassDeclaration(c));
                    }
                    // 式の default export を持つモジュールは extract_meta で fallback 済み
                    // （連結対象に入らない）ので、ここには到達しない。
                    _ => {}
                }
            }
            other => new_body.push(other),
        }
    }
    program.body = new_body;

    let code = Codegen::new()
        .with_scoping(Some(scoping))
        .build(&program)
        .code;
    Ok(code)
}

// --- 小物ヘルパ ---

fn resolve(core: &NowakiCore, dir: &Path, spec: &str) -> Option<PathBuf> {
    if spec.starts_with('/') || spec.contains("://") || spec.starts_with("data:") {
        return None;
    }
    let spec = crate::resolve::alias_specifier(spec).unwrap_or(spec);
    core.resolver.resolve(dir, spec).ok().map(|r| r.full_path())
}

fn export_name_str(n: &ModuleExportName) -> String {
    match n {
        ModuleExportName::IdentifierName(i) => i.name.to_string(),
        ModuleExportName::IdentifierReference(i) => i.name.to_string(),
        ModuleExportName::StringLiteral(s) => s.value.to_string(),
    }
}

fn import_spec_local(s: &ImportDeclarationSpecifier) -> String {
    match s {
        ImportDeclarationSpecifier::ImportSpecifier(sp) => sp.local.name.to_string(),
        ImportDeclarationSpecifier::ImportDefaultSpecifier(sp) => sp.local.name.to_string(),
        ImportDeclarationSpecifier::ImportNamespaceSpecifier(sp) => sp.local.name.to_string(),
    }
}

fn decl_bound_names(decl: &Declaration) -> Vec<String> {
    match decl {
        Declaration::VariableDeclaration(v) => v
            .declarations
            .iter()
            .filter_map(|d| d.id.get_binding_identifier().map(|b| b.name.to_string()))
            .collect(),
        Declaration::FunctionDeclaration(f) => {
            f.id.as_ref()
                .map(|i| vec![i.name.to_string()])
                .unwrap_or_default()
        }
        Declaration::ClassDeclaration(c) => {
            c.id.as_ref()
                .map(|i| vec![i.name.to_string()])
                .unwrap_or_default()
        }
        _ => Vec::new(),
    }
}

fn order_modules(
    abs: &Path,
    metas: &HashMap<PathBuf, ModuleMeta>,
    order: &mut Vec<PathBuf>,
    visited: &mut HashSet<PathBuf>,
    stack: &mut HashSet<PathBuf>,
) {
    if visited.contains(abs) || stack.contains(abs) {
        return;
    }
    let Some(meta) = metas.get(abs) else { return };
    stack.insert(abs.to_path_buf());
    for (dep, _) in &meta.deps {
        if metas.contains_key(dep) {
            order_modules(dep, metas, order, visited, stack);
        }
    }
    stack.remove(abs);
    visited.insert(abs.to_path_buf());
    order.push(abs.to_path_buf());
}

/// `Scoping` を所有権ごと取り出すためのダミー（apply_client_defines が値を要求するため）。
fn scoping_take(s: &mut oxc::semantic::Scoping) -> oxc::semantic::Scoping {
    std::mem::take(s)
}

/// 連結済みチャンクソースを再パースして minify + codegen（外部ソースマップ付き）する。
/// 返り値: (最終コード, ソースマップ JSON)。
pub fn minify_chunk(name: &str, source: &str) -> Result<(String, Option<String>)> {
    let allocator = Allocator::default();
    let source_type = SourceType::mjs();
    let parsed = Parser::new(&allocator, source, source_type).parse();
    if !parsed.errors.is_empty() {
        let msgs: Vec<String> = parsed.errors.iter().map(|e| e.to_string()).collect();
        return Err(anyhow!(
            "連結チャンク {name} の再パース失敗: {}",
            msgs.join("; ")
        ));
    }
    let mut program = parsed.program;
    Minifier::new(MinifierOptions::default()).minify(&allocator, &mut program);
    let ret = Codegen::new()
        .with_options(CodegenOptions {
            minify: true,
            source_map_path: Some(PathBuf::from(name)),
            ..CodegenOptions::default()
        })
        .build(&program);
    let map = ret.map.map(|m| m.to_json_string());
    let _ = xxh3_64(source.as_bytes());
    Ok((ret.code, map))
}
