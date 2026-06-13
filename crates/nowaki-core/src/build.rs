//! 本番ビルド: クライアント側モジュールグラフを辿り、変換+minifyして
//! dist/client/ へコンテンツハッシュ付きESMで出力する。
//! island ごとに、その island だけが使うアプリモジュールを1スコープへ連結する
//! （スコープホイスティング、chunk.rs）。node_modules/共有/css/asset は別チャンクとして
//! 共有・dedup する。連結に未対応のモジュールは従来の unbundled emit にフォールバックする。

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use oxc::allocator::Allocator;
use oxc::ast::ast::Statement;
use oxc::codegen::{Codegen, CodegenOptions};
use oxc::minifier::{Minifier, MinifierOptions};
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
/// 併せて「アセット絶対パス → 配信URL」のマップを返す（サーバービルドが共有する）。
pub fn build_client(
    core: &NowakiCore,
    dist: &Path,
) -> Result<(BuildReport, HashMap<PathBuf, String>)> {
    let client_dir = dist.join("client");
    fs::create_dir_all(&client_dir)
        .with_context(|| format!("dist作成失敗: {}", client_dir.display()))?;

    let mut ctx = EmitCtx::default();

    // エントリ1: クライアントランタイム（router.js → islands.js を取り込む。
    // ハイドレーション + 島間SPA遷移。島のあるページだけがこれを読み込む）。
    let runtime = core
        .root
        .join("node_modules/@nowaki-dev/runtime/client/router.js");
    let runtime_out = if runtime.exists() {
        Some(emit(core, &runtime, &client_dir, &mut ctx)?)
    } else {
        None
    };

    // エントリ2..: islands/ 配下の各コンポーネント。
    // 各 island の「その island だけが使うアプリモジュール」を1スコープへ連結する
    // （スコープホイスティング）。node_modules / 共有 / css / asset は別チャンクで共有する。
    let mut islands: Vec<(String, String)> = Vec::new();
    let mut live_islands: Vec<String> = Vec::new();
    let islands_dir = core.root.join("islands");
    if islands_dir.is_dir() {
        // ライブ島（サーバーリアクティブ）はクライアントへ JS を出さない。先に振り分ける。
        let all: Vec<PathBuf> = {
            let mut v: Vec<PathBuf> = fs::read_dir(&islands_dir)?
                .filter_map(|e| e.ok().map(|e| e.path()))
                .filter(|p| crate::is_transformable(p))
                .collect();
            v.sort();
            v
        };
        let mut entries: Vec<PathBuf> = Vec::new();
        for p in all {
            let name = p
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("island")
                .to_string();
            if is_live_island(core, &p) {
                live_islands.push(name); // クライアントチャンクは出さない
            } else {
                entries.push(p);
            }
        }

        // 各 island のアプリ到達集合を求め、共有（複数 island から到達）を数える。
        let reach: Vec<(PathBuf, HashSet<PathBuf>)> = entries
            .iter()
            .map(|e| (e.clone(), crate::chunk::collect_app_modules(core, e)))
            .collect();
        let mut app_count: HashMap<PathBuf, usize> = HashMap::new();
        for (_, set) in &reach {
            for m in set {
                *app_count.entry(m.clone()).or_default() += 1;
            }
        }

        for (island, set) in &reach {
            let name = island
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("island")
                .to_string();
            let out = emit_island(core, island, set, &app_count, &client_dir, &mut ctx)?;
            islands.push((name, out));
        }
    }

    // ライブ島があれば live.js（WS + DOM morph）を1チャンク出力する。
    let live_runtime_out = if !live_islands.is_empty() {
        let live_rt = core
            .root
            .join("node_modules/@nowaki-dev/runtime/client/live.js");
        if live_rt.exists() {
            Some(emit(core, &live_rt, &client_dir, &mut ctx)?)
        } else {
            None
        }
    } else {
        None
    };

    fs::write(
        client_dir.join("manifest.json"),
        render_manifest(
            runtime_out.as_deref(),
            &islands,
            &live_islands,
            live_runtime_out.as_deref(),
            &ctx.deps,
        ),
    )?;

    Ok((
        BuildReport {
            modules: ctx.emitted.len(),
            islands: islands.len(),
            server_modules: 0,
            out_dir: client_dir,
        },
        ctx.assets,
    ))
}

/// サーバー側ビルド: routes/ と islands/ を SSRモードで変換し、
/// dist/server/ へ Node が直接実行できる ESM として出力する。
/// 相対importの .tsx/.ts/.jsx を .js へ書き換える（bare importはNode解決に任せる）。
/// 出力モジュール数を返す。
pub fn build_server(
    core: &NowakiCore,
    dist: &Path,
    assets: &HashMap<PathBuf, String>,
) -> Result<usize> {
    use rayon::prelude::*;

    let server_dir = dist.join("server");
    // routes/islands に加え、共有のサーバーモジュール (components/, lib/, actions/) も出力する。
    let mut files = Vec::new();
    for sub in ["routes", "islands", "components", "lib", "actions"] {
        let src_root = core.root.join(sub);
        if !src_root.is_dir() {
            continue;
        }
        for path in walk_files(&src_root)? {
            if crate::is_transformable(&path) {
                files.push(path);
            }
        }
    }

    // サーバーモジュールは互いに独立（命名依存が無い）ので rayon で並列に変換する。
    let results: Vec<Result<(PathBuf, String)>> = files
        .par_iter()
        .map(|path| {
            let rel = path
                .strip_prefix(&core.root)
                .with_context(|| format!("rel化失敗: {}", path.display()))?;
            let out_path = server_dir.join(with_js_ext(rel));
            let source = core.read_source(path)?;
            let code = transform_for_server(path, &source, core, assets)?;
            Ok((out_path, code))
        })
        .collect();

    let mut count = 0;
    for r in results {
        let (out_path, code) = r?;
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&out_path, code)?;
        count += 1;
    }

    // サーバー関数（`"use server"`）の allowlist を dist/server/functions.json に書く。
    // ランタイムはこの id→{module,export} で dispatch する（クライアントは任意 export を呼べない）。
    // client manifest には載せない（サーバーのファイル構成を露出しないため）。
    write_server_functions(core, &server_dir)?;

    Ok(count)
}

/// dist/server/functions.json を生成する。module は serverDir 相対の .js パス。
fn write_server_functions(core: &NowakiCore, server_dir: &Path) -> Result<()> {
    let found =
        crate::server_fn::discover(core, &["routes", "islands", "components", "lib", "actions"]);
    let mut entries: Vec<String> = Vec::new();
    for f in &found {
        let module_js = with_js_suffix(&f.source_rel);
        entries.push(format!(
            "  \"{}\": {{ \"module\": \"{}\", \"export\": \"{}\" }}",
            f.id, module_js, f.export
        ));
    }
    let json = format!("{{\n{}\n}}\n", entries.join(",\n"));
    fs::write(server_dir.join("functions.json"), json)?;
    Ok(())
}

/// posix の相対パスの拡張子を .js に差し替える（`actions/x.ts` → `actions/x.js`）。
fn with_js_suffix(rel: &str) -> String {
    match rel.rfind('.') {
        Some(i) if !rel[i..].contains('/') => format!("{}.js", &rel[..i]),
        _ => format!("{rel}.js"),
    }
}

/// SSR向け変換: TS除去 + JSX(automatic, preact)。相対ローカルimportの拡張子を
/// .js へ書き換える。bare import (npm) はそのまま（Nodeが解決する）。minifyしない
/// （SSRのスタックトレース可読性のため）。
fn transform_for_server(
    path: &Path,
    source: &str,
    core: &NowakiCore,
    assets: &HashMap<PathBuf, String>,
) -> Result<String> {
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
    for stmt in program.body.iter_mut() {
        let source_lit = match stmt {
            Statement::ImportDeclaration(d) => Some(&mut d.source),
            Statement::ExportNamedDeclaration(d) => d.source.as_mut(),
            Statement::ExportAllDeclaration(d) => Some(&mut d.source),
            _ => None,
        };
        let Some(lit) = source_lit else { continue };
        // React 系 bare import → Preact 互換（bare のまま残し、Node が preact/compat を解決）。
        if let Some(aliased) = crate::resolve::alias_specifier(lit.value.as_str()) {
            lit.value = allocator.alloc_str(aliased).into();
            lit.raw = None;
        }
        let spec = lit.value.as_str();
        // 仮想モジュール（resolveId/load）: SSR は data: モジュールへインライン化（自己完結 ESM 想定）。
        if !spec.starts_with('.') && !spec.starts_with('/') && !spec.contains("://") {
            if let Some(data) = core.virtual_ssr_module(dir, spec) {
                lit.value = allocator.alloc_str(&data).into();
                lit.raw = None;
                continue;
            }
        }
        // CSS Modules: クラス名マップだけを export（DOM が無いので注入はしない）。
        if spec.ends_with(".module.css") {
            if let Ok(resolution) = core.resolver.resolve(dir, spec) {
                let full = resolution.full_path();
                if let Ok(css) = fs::read_to_string(&full) {
                    let id = full.to_string_lossy();
                    let (_scoped, map) = crate::css::scope_css(&id, &css);
                    let body = format!("export default {}", crate::css::mapping_object(&map));
                    let data = crate::transform::data_module(&body);
                    lit.value = allocator.alloc_str(&data).into();
                    lit.raw = None;
                }
            }
            continue;
        }
        // アセット: クライアントビルドのハッシュ付きURLへ（無ければ basename フォールバック）。
        if !spec.starts_with('/') && !spec.contains("://") && !spec.starts_with("data:") {
            if let Ok(resolution) = core.resolver.resolve(dir, spec) {
                let full = resolution.full_path();
                if crate::is_asset(&full) {
                    let url = assets.get(&full).cloned().unwrap_or_else(|| {
                        format!(
                            "/_nowaki/{}",
                            full.file_name().and_then(|n| n.to_str()).unwrap_or("asset")
                        )
                    });
                    let data = crate::transform::asset_module_data_url(&url);
                    lit.value = allocator.alloc_str(&data).into();
                    lit.raw = None;
                    continue;
                }
            }
        }
        if let Some(rewritten) = rewrite_server_spec(spec) {
            lit.value = allocator.alloc_str(&rewritten).into();
            lit.raw = None;
        }
    }

    // SSR は minify しないのでインラインソースマップが正確（node --enable-source-maps 用）。
    let rel = path.strip_prefix(&core.root).unwrap_or(path).to_path_buf();
    let ret = Codegen::new()
        .with_options(CodegenOptions {
            source_map_path: Some(rel),
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

/// 相対ローカルimportの TS拡張子を .js へ。bare/absolute/.js は触らない。
fn rewrite_server_spec(spec: &str) -> Option<String> {
    if !spec.starts_with('.') {
        return None; // bare import (npm) はそのまま
    }
    if spec.ends_with(".css") {
        // SSR では .css を no-op に（CSS はクライアント専用）
        return Some(crate::css::CSS_NOOP_SPECIFIER.to_string());
    }
    for ext in [".tsx", ".jsx", ".ts", ".tsrx"] {
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

/// 出力グラフを辿る際の可変状態。1回のビルドで使い回す。
#[derive(Default)]
struct EmitCtx {
    /// 入力絶対パス → 出力ファイル名（emit 済み）
    emitted: HashMap<PathBuf, String>,
    /// 現在 DFS スタック上のモジュール（循環検出用）
    visiting: HashSet<PathBuf>,
    /// アセット絶対パス → 配信URL
    assets: HashMap<PathBuf, String>,
    /// 循環時に使う pre-rewrite の暫定ファイル名
    provisional: HashMap<PathBuf, String>,
    /// 循環の一部と判明したモジュール（暫定名を最終名にする）
    cyclic: HashSet<PathBuf>,
    /// 出力ファイル名 → 直接依存の出力ファイル名（preload チェーン計算用）
    deps: HashMap<String, Vec<String>>,
}

/// 1モジュールを（依存を先に処理してから）出力し、出力ファイル名を返す。
/// 非循環は最終内容のハッシュで命名（immutable キャッシュが正しい）。循環は
/// pre-rewrite ハッシュの暫定名にフォールバックして解決する（後順DFSのまま）。
fn emit(core: &NowakiCore, abs: &Path, out_dir: &Path, ctx: &mut EmitCtx) -> Result<String> {
    if let Some(name) = ctx.emitted.get(abs) {
        return Ok(name.clone());
    }
    // アセット（画像・フォント等）: content-hash 付きで raw コピーし、
    // 配信URLを default export する小さな JS モジュールを出力する（依存なし）。
    if crate::is_asset(abs) {
        let bytes = fs::read(abs).with_context(|| format!("読み込み失敗: {}", abs.display()))?;
        let ext = abs.extension().and_then(|e| e.to_str()).unwrap_or("bin");
        let stem = abs.file_stem().and_then(|s| s.to_str()).unwrap_or("asset");
        let asset_hash = xxh3_64(&bytes) as u32;
        let asset_name = format!("{stem}.{asset_hash:08x}.{ext}");
        fs::write(out_dir.join(&asset_name), &bytes)?;
        let url = format!("/_nowaki/{asset_name}");
        ctx.assets.insert(abs.to_path_buf(), url.clone());
        let code = format!("export default \"{url}\";\n");
        let mod_hash = xxh3_64(code.as_bytes()) as u32;
        let mod_name = format!("{stem}.{ext}.{mod_hash:08x}.js");
        fs::write(out_dir.join(&mod_name), &code)?;
        ctx.deps.insert(mod_name.clone(), Vec::new());
        ctx.emitted.insert(abs.to_path_buf(), mod_name.clone());
        return Ok(mod_name);
    }
    // .css は <style> 注入の JS シムとして出力（依存なし）。
    // *.module.css はスコープ化 + クラス名マップ export。id は絶対パス（SSR と一致）。
    if crate::css::is_css(abs) {
        let css =
            fs::read_to_string(abs).with_context(|| format!("読み込み失敗: {}", abs.display()))?;
        let id = abs.to_string_lossy();
        let code = if crate::css::is_css_module(abs) {
            let (scoped, map) = crate::css::scope_css(&id, &css);
            crate::css::css_module_client_js(&id, &scoped, &map)
        } else {
            crate::css::css_shim(&id, &css)
        };
        let hash = xxh3_64(code.as_bytes()) as u32;
        let stem = abs.file_stem().and_then(|s| s.to_str()).unwrap_or("style");
        let filename = format!("{stem}.css.{hash:08x}.js");
        fs::write(out_dir.join(&filename), &code)?;
        ctx.deps.insert(filename.clone(), Vec::new());
        ctx.emitted.insert(abs.to_path_buf(), filename.clone());
        return Ok(filename);
    }
    // 循環: 既に DFS スタック上にあるモジュールへの back-edge。暫定名を返し、
    // 相手を cyclic 印にして、相手の最終名を暫定名に固定させる。
    if ctx.visiting.contains(abs) {
        ctx.cyclic.insert(abs.to_path_buf());
        return Ok(ctx
            .provisional
            .get(abs)
            .cloned()
            .expect("visiting 中なら provisional は設定済み"));
    }
    ctx.visiting.insert(abs.to_path_buf());

    let source = core.read_source(abs)?;
    // サーバーモジュール（`"use server"`）: 実装はクライアントへ出さず、プロキシ（依存なしの
    // リーフ）を出力する。サーバー専用の依存はここで打ち切られ、クライアントグラフへ入らない。
    if crate::server_fn::has_use_server(&source) {
        ctx.visiting.remove(abs);
        let key = crate::server_fn::module_key(&core.root, abs);
        let exports = crate::server_fn::collect_exports(abs, &source)?;
        let code = crate::server_fn::client_proxy(&key, &exports);
        let stem = abs.file_stem().and_then(|s| s.to_str()).unwrap_or("module");
        let hash = xxh3_64(code.as_bytes()) as u32;
        let filename = format!("{stem}.{hash:08x}.js");
        fs::write(out_dir.join(&filename), &code)?;
        ctx.deps.insert(filename.clone(), Vec::new());
        ctx.emitted.insert(abs.to_path_buf(), filename.clone());
        return Ok(filename);
    }
    let module = transform_for_bundle(abs, &source, core)?;
    let stem = abs
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("module")
        .to_string();

    // pre-rewrite ハッシュの暫定名を先に確定（back-edge が参照できるように）。
    let prov_hash = xxh3_64(module.code.as_bytes()) as u32;
    let prov = format!("{stem}.{prov_hash:08x}.js");
    ctx.provisional.insert(abs.to_path_buf(), prov.clone());

    let mut code = module.code;
    let mut dep_names = Vec::new();
    for dep in &module.deps {
        let dep_name = emit(core, &dep.abs_path, out_dir, ctx)?;
        code = code.replace(&dep.placeholder, &format!("./{dep_name}"));
        dep_names.push(dep_name);
    }
    ctx.visiting.remove(abs);

    let filename = if ctx.cyclic.contains(abs) {
        // 循環: back-edge が暫定名を参照済みなので、それを最終名にする。
        prov
    } else {
        let hash = xxh3_64(code.as_bytes()) as u32;
        format!("{stem}.{hash:08x}.js")
    };

    // 外部ソースマップ（sourcesContent 埋め込み）。minify + プレースホルダ置換のため
    // 列は近似だが、行マッピングと原文表示は機能する。
    if let Some(map) = &module.map {
        let map_name = format!("{filename}.map");
        fs::write(out_dir.join(&map_name), map)?;
        code.push_str(&format!("\n//# sourceMappingURL={map_name}\n"));
    }

    fs::write(out_dir.join(&filename), &code)?;
    ctx.deps.insert(filename.clone(), dep_names);
    ctx.emitted.insert(abs.to_path_buf(), filename.clone());
    Ok(filename)
}

/// island を1チャンクへスコープホイスティングして出力する。連結対象は island 本体 +
/// その island だけが使い連結可能なアプリモジュール。外部依存（node_modules/共有/css/asset）は
/// emit() で別チャンク化して ESM import で繋ぐ。連結に失敗したら従来の emit にフォールバック。
fn emit_island(
    core: &NowakiCore,
    island: &Path,
    app_set: &HashSet<PathBuf>,
    app_count: &HashMap<PathBuf, usize>,
    out_dir: &Path,
    ctx: &mut EmitCtx,
) -> Result<String> {
    // 連結対象 = island 本体 + その island だけが使い、連結可能なアプリモジュール
    let mut internal: Vec<PathBuf> = vec![island.to_path_buf()];
    for m in app_set {
        if m == island {
            continue;
        }
        if app_count.get(m).copied().unwrap_or(0) == 1 && !crate::chunk::needs_fallback(core, m) {
            internal.push(m.clone());
        }
    }
    let internal_set: HashSet<&Path> = internal.iter().map(|p| p.as_path()).collect();

    // 外部依存（連結対象外）を emit して名前を得る
    let mut external_name: HashMap<PathBuf, String> = HashMap::new();
    for m in &internal {
        for dep in crate::chunk::module_deps(core, m)? {
            if !internal_set.contains(dep.as_path()) {
                let fname = emit(core, &dep, out_dir, ctx)?;
                external_name.insert(dep, fname);
            }
        }
    }

    let stem = island
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("island");
    match crate::chunk::hoist_chunk(core, island, &internal, &external_name) {
        Ok(source) => {
            let chunk_name = format!("{stem}.js");
            let (mut code, map) = crate::chunk::minify_chunk(&chunk_name, &source)?;
            let hash = xxh3_64(code.as_bytes()) as u32;
            let filename = format!("{stem}.{hash:08x}.js");
            if let Some(m) = map {
                let map_name = format!("{filename}.map");
                fs::write(out_dir.join(&map_name), m)?;
                code.push_str(&format!("\n//# sourceMappingURL={map_name}\n"));
            }
            fs::write(out_dir.join(&filename), &code)?;
            // preload: このチャンクが import する外部チャンク群（推移依存は render_manifest が辿る）
            ctx.deps
                .insert(filename.clone(), external_name.values().cloned().collect());
            ctx.emitted.insert(island.to_path_buf(), filename.clone());
            Ok(filename)
        }
        // フォールバック: 連結に失敗したら従来の unbundled emit
        Err(_) => emit(core, island, out_dir, ctx),
    }
}

/// あるチャンクの推移的依存（自分を除く、重複排除済み）を返す。preload チェーン用。
fn transitive_deps(entry: &str, deps: &HashMap<String, Vec<String>>) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    let mut stack: Vec<String> = deps.get(entry).cloned().unwrap_or_default();
    while let Some(d) = stack.pop() {
        if !seen.insert(d.clone()) {
            continue;
        }
        if let Some(children) = deps.get(&d) {
            stack.extend(children.iter().cloned());
        }
        out.push(d);
    }
    out.sort();
    out
}

struct BundleModule {
    code: String,
    deps: Vec<DepRef>,
    /// 外部ソースマップ JSON（sourcesContent 埋め込み）。
    map: Option<String>,
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

    // ツリーシェイキング / DCE / mangle。未使用 import やデッドコードを除去してから
    // 依存を記録する（除去された import は deps にも入らない）。
    Minifier::new(MinifierOptions::default()).minify(&allocator, &mut program);

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
        // React 系 bare import → Preact 互換（解決して別チャンクへ）。
        if let Some(aliased) = crate::resolve::alias_specifier(lit.value.as_str()) {
            lit.value = allocator.alloc_str(aliased).into();
            lit.raw = None;
        }
        let spec = lit.value.as_str();
        if spec.starts_with('/') || spec.contains("://") || spec.starts_with("data:") {
            continue;
        }
        let abs_path = core
            .resolve_spec(dir, spec)
            .ok_or_else(|| anyhow!("解決失敗 {spec} (from {})", dir.display()))?;
        let placeholder = format!("__NOWAKI_DEP_{}__", deps.len());
        lit.value = allocator.alloc_str(&placeholder).into();
        lit.raw = None;
        deps.push(DepRef {
            placeholder,
            abs_path,
        });
    }

    // sources はルート相対にして prod で絶対パスを晒さない（sourcesContent は埋まる）。
    let rel = path.strip_prefix(&core.root).unwrap_or(path).to_path_buf();
    let ret = Codegen::new()
        .with_options(CodegenOptions {
            minify: true,
            source_map_path: Some(rel),
            ..CodegenOptions::default()
        })
        .build(&program);
    let map = ret.map.map(|m| m.to_json_string());

    Ok(BundleModule {
        code: ret.code,
        deps,
        map,
    })
}

/// manifest.json を手書きで生成（依存を増やさないため serde 不使用）。
/// ファイル名は ascii のみなのでエスケープ不要。
/// `preload`: 各エントリチャンク → 推移的依存チャンク。瀑布リクエストを避けるため、
/// ページは島チャンクとその全依存を一括で `<link rel=modulepreload>` する。
/// ライブ島か（`export const live` を持つ）。read_source 後（.tsrx もコンパイル済み）で判定。
fn is_live_island(core: &NowakiCore, abs: &Path) -> bool {
    core.read_source(abs)
        .map(|s| s.contains("export const live"))
        .unwrap_or(false)
}

fn render_manifest(
    runtime: Option<&str>,
    islands: &[(String, String)],
    live_islands: &[String],
    live_runtime: Option<&str>,
    deps: &HashMap<String, Vec<String>>,
) -> String {
    let runtime_field = match runtime {
        Some(r) => format!("\"{r}\""),
        None => "null".to_string(),
    };
    let live_runtime_field = match live_runtime {
        Some(r) => format!("\"{r}\""),
        None => "null".to_string(),
    };
    let live_islands_field = live_islands
        .iter()
        .map(|n| format!("\"{n}\""))
        .collect::<Vec<_>>()
        .join(", ");
    let island_fields: Vec<String> = islands
        .iter()
        .map(|(name, file)| format!("    \"{name}\": \"{file}\""))
        .collect();

    // エントリチャンク（runtime + 各island）の推移的依存を preload に書く。
    let mut entries: Vec<&str> = Vec::new();
    let mut seen = HashSet::new();
    if let Some(r) = runtime {
        if seen.insert(r) {
            entries.push(r);
        }
    }
    for (_, file) in islands {
        if seen.insert(file.as_str()) {
            entries.push(file);
        }
    }
    let preload_fields: Vec<String> = entries
        .iter()
        .map(|entry| {
            let chain = transitive_deps(entry, deps);
            let arr: Vec<String> = chain.iter().map(|c| format!("\"{c}\"")).collect();
            format!("    \"{entry}\": [{}]", arr.join(", "))
        })
        .collect();

    format!(
        "{{\n  \"runtime\": {runtime_field},\n  \"liveRuntime\": {live_runtime_field},\n  \"liveIslands\": [{live_islands_field}],\n  \"islands\": {{\n{}\n  }},\n  \"preload\": {{\n{}\n  }}\n}}\n",
        island_fields.join(",\n"),
        preload_fields.join(",\n")
    )
}
