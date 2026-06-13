pub mod build;
pub mod cache;
pub mod chunk;
pub mod css;
pub mod env;
pub mod resolve;
pub mod server_fn;
pub mod transform;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use oxc_resolver::Resolver;
use xxhash_rust::xxh3::xxh3_64;

pub use cache::Mode;

/// プラグインの仮想モジュールを置く合成ディレクトリ名（ディスクには存在しない）。
/// `resolveId` が返した仮想 id は `<root>/__nowaki_virtual__/<hash>.js` にマップされ、
/// `read_source` が registry から元 id を引いて `load` フックでソースを得る。
pub const VIRTUAL_DIR: &str = "__nowaki_virtual__";

/// プラグインの変換フックを Rust から呼ぶための橋渡し。実装は CLI 側が
/// Node プラグインホスト（`nowaki.config` を読み込む）へ HTTP で委譲する。
/// nowaki-core 自体は JS を実行しないので、この trait 経由で疎結合に保つ。
pub trait PluginBridge: Send + Sync {
    /// 変換可能なソース（ts/tsx/js/jsx/mjs）に対する `transform(code, id)` フック。
    /// どのプラグインも変更しなければ None。
    fn transform(&self, id: &str, code: &str) -> Option<String>;

    /// `.tsrx` ソースを `@tsrx/preact` で標準 JSX へコンパイルする。出力はそのあと
    /// oxc の JSX→preact パイプラインにかかる。コンパイラ未導入なら None。
    fn compile_tsrx(&self, id: &str, code: &str) -> Option<String>;

    /// 仮想モジュールの `resolveId(source, importer)`。プラグインが指定子を引き受けるなら
    /// 解決済み id（実パス or 仮想 id 文字列）を返す。誰も引き受けなければ None。
    /// 通常の解決が失敗したときだけ呼ばれる（＝ディスク上のモジュールには触らない）。
    fn resolve_id(&self, _source: &str, _importer: &str) -> Option<String> {
        None
    }

    /// 仮想モジュールの `load(id)`。`resolveId` が返した仮想 id のソースを返す。None なら未対応。
    fn load(&self, _id: &str) -> Option<String> {
        None
    }
}

/// 変換対象の拡張子。これ以外 (css, 画像など) は素通しで配信する。
/// `.tsrx` はプラグインホストで `@tsrx/preact` により JSX へコンパイルしてから oxc にかける。
pub fn is_transformable(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("ts" | "tsx" | "js" | "jsx" | "mjs" | "tsrx")
    )
}

/// import 時に URL 文字列として扱うアセット（画像・フォント・メディア）。
/// `import logo from "./logo.png"` の logo は配信URLになる。
pub fn is_asset(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .as_deref(),
        Some(
            "png"
                | "jpg"
                | "jpeg"
                | "gif"
                | "svg"
                | "webp"
                | "avif"
                | "ico"
                | "bmp"
                | "woff"
                | "woff2"
                | "ttf"
                | "otf"
                | "eot"
                | "mp4"
                | "webm"
                | "ogg"
                | "mp3"
                | "wav"
                | "flac"
                | "pdf"
        )
    )
}

/// バンドラーコア。devサーバー/buildの両方から使う。
pub struct NowakiCore {
    pub root: PathBuf,
    resolver: Resolver,
    cache: cache::ModuleCache,
    /// 再起動をまたぐ永続キャッシュ
    disk_cache: cache::DiskCache,
    /// import.meta.env.PUBLIC_* / MODE のクライアント向け定数置換ペア（.envから）
    pub(crate) client_defines: Vec<(String, String)>,
    /// プラグインの変換フック（任意）。未設定なら素のファイル読込のまま。
    plugins: Option<Arc<dyn PluginBridge>>,
    /// 仮想モジュールの合成パス → 元 id（`resolveId` が返した id）。`load` で引くために保持。
    virtual_ids: Mutex<HashMap<PathBuf, String>>,
}

impl NowakiCore {
    pub fn new(root: PathBuf) -> Self {
        let client_defines = env::load_client_defines(&root);
        // salt = nowakiバージョン + defines。アップグレード/env変更でディスクキャッシュを失効。
        let mut salt_buf = env!("CARGO_PKG_VERSION").as_bytes().to_vec();
        for (k, v) in &client_defines {
            salt_buf.extend_from_slice(k.as_bytes());
            salt_buf.extend_from_slice(v.as_bytes());
        }
        let disk_cache = cache::DiskCache::new(&root, xxh3_64(&salt_buf));
        Self {
            root,
            resolver: resolve::make_resolver(),
            cache: cache::ModuleCache::default(),
            disk_cache,
            client_defines,
            plugins: None,
            virtual_ids: Mutex::new(HashMap::new()),
        }
    }

    /// 指定子を解決して絶対パスを返す。通常の oxc 解決を先に試し、失敗したときだけ
    /// プラグインの `resolveId` を試す（＝仮想モジュール）。仮想 id は合成パスにマップし、
    /// `read_source` が `load` で引けるよう registry に登録する。プラグイン無しなら
    /// 挙動は素の解決と同一（オーバーヘッドゼロ）。
    pub fn resolve_spec(&self, dir: &Path, spec: &str) -> Option<PathBuf> {
        if let Ok(r) = self.resolver.resolve(dir, spec) {
            return Some(r.full_path());
        }
        let bridge = self.plugins.as_ref()?;
        let importer = dir.to_string_lossy();
        let id = bridge.resolve_id(spec, &importer)?;
        // プラグインが実在の絶対パスを返したらそれを使う。
        let p = PathBuf::from(&id);
        if p.is_absolute() && p.exists() {
            return Some(p);
        }
        // 仮想 id → 合成パス（ディスクには無い）。registry に id を控える。
        let hash = format!("{:016x}", xxh3_64(id.as_bytes()));
        let synthetic = self.root.join(VIRTUAL_DIR).join(format!("{hash}.js"));
        self.virtual_ids
            .lock()
            .unwrap()
            .insert(synthetic.clone(), id);
        Some(synthetic)
    }

    /// 合成パスなら元の仮想 id を返す。
    pub(crate) fn virtual_id_of(&self, abs: &Path) -> Option<String> {
        if !abs.components().any(|c| c.as_os_str() == VIRTUAL_DIR) {
            return None;
        }
        self.virtual_ids.lock().unwrap().get(abs).cloned()
    }

    /// プラグインの変換ブリッジを設定する（CLI が nowaki.config 検出時に呼ぶ）。
    pub fn set_plugins(&mut self, bridge: Arc<dyn PluginBridge>) {
        self.plugins = Some(bridge);
    }

    /// モジュールのソースを取得する（ファイル読込 + プラグイン transform フック）。
    /// プラグイン未設定なら素のファイル読込と同一（＝挙動不変）。dev/build/chunk の
    /// 全ソース読込はここを通すことで、変換フックを一貫適用する。
    pub fn read_source(&self, abs: &Path) -> Result<String> {
        // 仮想モジュール（合成パス）はディスクに無いので `load` フックでソースを得る。
        if let Some(vid) = self.virtual_id_of(abs) {
            let bridge = self
                .plugins
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("仮想モジュールだがプラグイン未設定: {vid}"))?;
            let mut source = bridge
                .load(&vid)
                .ok_or_else(|| anyhow::anyhow!("仮想モジュールの load 失敗: {vid}"))?;
            // 生成ソースにも transform フックを通す（プラグイン間の合成を許す）。
            if let Some(code) = bridge.transform(&vid, &source) {
                source = code;
            }
            return Ok(source);
        }
        let source = std::fs::read_to_string(abs)
            .with_context(|| format!("読み込み失敗: {}", abs.display()))?;
        let Some(bridge) = &self.plugins else {
            return Ok(source);
        };
        let id = abs.to_string_lossy();
        // .tsrx は @tsrx/preact で JSX へコンパイル（→ 呼び出し側が oxc で JSX→preact）。
        if abs.extension().and_then(|e| e.to_str()) == Some("tsrx") {
            if let Some(code) = bridge.compile_tsrx(&id, &source) {
                return Ok(code);
            }
        } else if is_transformable(abs) {
            if let Some(code) = bridge.transform(&id, &source) {
                return Ok(code);
            }
        }
        Ok(source)
    }

    /// ファイルを読み、コンテンツハッシュでキャッシュ照合し、必要なら変換する。
    /// メモリ → ディスク（再起動をまたぐ）→ 変換 の順で照合する。
    pub fn load_module(&self, abs: &Path, mode: Mode) -> Result<String> {
        // read_source はプラグイン transform 適用後のソースを返す。ハッシュもその後の
        // 内容で取るので、ファイル変更・プラグイン出力変更のどちらでもキャッシュが正しく失効する。
        let source = self.read_source(abs)?;
        let hash = xxh3_64(source.as_bytes());
        let key = (abs.to_path_buf(), mode);

        if let Some(hit) = self.cache.get(&key) {
            if hit.source_hash == hash {
                return Ok(hit.code.clone());
            }
        }

        // 永続ディスクキャッシュ（再起動後の最初のアクセスでヒットする）
        let disk_key = self.disk_cache.key(abs, mode, hash);
        if let Some(code) = self.disk_cache.get(disk_key) {
            self.cache.insert(
                key,
                cache::CachedModule {
                    source_hash: hash,
                    code: code.clone(),
                },
            );
            return Ok(code);
        }

        // 仮想モジュール解決（resolveId/load）を渡す（通常解決が失敗したときに試す）。
        let code = transform::transform_file(
            &self.root,
            abs,
            &source,
            mode,
            &self.resolver,
            &self.client_defines,
            Some(self),
        )?;
        self.cache.insert(
            key,
            cache::CachedModule {
                source_hash: hash,
                code: code.clone(),
            },
        );
        self.disk_cache.put(disk_key, &code);
        Ok(code)
    }

    /// 本番ビルド: クライアントグラフを dist/client/ へ、サーバーモジュールを
    /// dist/server/ へ出力する。
    pub fn build(&self, dist: &Path) -> Result<build::BuildReport> {
        let (mut report, assets) = build::build_client(self, dist)?;
        report.server_modules = build::build_server(self, dist, &assets)?;
        Ok(report)
    }

    /// 仮想モジュールなら、Node が直接 import できる data: モジュールにして返す（SSR 用）。
    /// 実モジュール（通常解決できる）なら None。build_server からも使う。
    pub(crate) fn virtual_ssr_module(&self, dir: &Path, spec: &str) -> Option<String> {
        let p = self.resolve_spec(dir, spec)?;
        self.virtual_id_of(&p)?; // 仮想モジュールのみ対象
        let src = self.read_source(&p).ok()?;
        Some(transform::data_module(&src))
    }
}

impl transform::VirtualResolve for NowakiCore {
    fn virtual_browser(&self, dir: &Path, spec: &str) -> Option<PathBuf> {
        // map_specifier の通常解決失敗時のみ呼ばれる。合成パス（or プラグインが返した実パス）を返す。
        self.resolve_spec(dir, spec)
    }
    fn virtual_ssr_module(&self, dir: &Path, spec: &str) -> Option<String> {
        NowakiCore::virtual_ssr_module(self, dir, spec)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transformable_extensions() {
        for ext in ["ts", "tsx", "js", "jsx", "mjs", "tsrx"] {
            assert!(is_transformable(Path::new(&format!("a.{ext}"))), "{ext}");
        }
        for ext in ["css", "json", "png", "txt", "md"] {
            assert!(!is_transformable(Path::new(&format!("a.{ext}"))), "{ext}");
        }
    }

    #[test]
    fn asset_extensions_case_insensitive() {
        assert!(is_asset(Path::new("logo.svg")));
        assert!(is_asset(Path::new("photo.PNG"))); // 大文字でも
        assert!(is_asset(Path::new("font.woff2")));
        assert!(!is_asset(Path::new("mod.ts")));
        assert!(!is_asset(Path::new("style.css"))); // css はアセット扱いしない
    }

    // 仮想モジュール（resolveId/load）を Node ホスト無しで検証するためのモックブリッジ。
    struct MockBridge;
    impl PluginBridge for MockBridge {
        fn transform(&self, _id: &str, _code: &str) -> Option<String> {
            None
        }
        fn compile_tsrx(&self, _id: &str, _code: &str) -> Option<String> {
            None
        }
        fn resolve_id(&self, source: &str, _importer: &str) -> Option<String> {
            (source == "virtual:greeting").then(|| source.to_string())
        }
        fn load(&self, id: &str) -> Option<String> {
            (id == "virtual:greeting").then(|| "export const hi = \"hello\";\n".to_string())
        }
    }

    #[test]
    fn virtual_module_resolves_and_loads() {
        let mut core = NowakiCore::new(std::env::temp_dir().join("nowaki-virtual-test"));
        core.set_plugins(Arc::new(MockBridge));
        let dir = core.root.clone();

        // 通常解決できない仮想 id は resolveId で合成パスへ。
        let p = core
            .resolve_spec(&dir, "virtual:greeting")
            .expect("virtual id should resolve via the plugin");
        assert!(
            p.components().any(|c| c.as_os_str() == VIRTUAL_DIR),
            "virtual id should map under the synthetic dir: {}",
            p.display()
        );
        // read_source は load フックの中身を返す（ディスクは読まない）。
        let src = core.read_source(&p).expect("virtual load");
        assert!(src.contains("hello"), "load() source expected: {src}");
        // 引き受けないものは None（＝通常解決の失敗）。
        assert!(core.resolve_spec(&dir, "virtual:unknown").is_none());
    }
}
