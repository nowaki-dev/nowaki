pub mod build;
pub mod cache;
pub mod css;
pub mod env;
pub mod resolve;
pub mod transform;

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use oxc_resolver::Resolver;
use xxhash_rust::xxh3::xxh3_64;

pub use cache::Mode;

/// 変換対象の拡張子。これ以外 (css, 画像など) は素通しで配信する。
pub fn is_transformable(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("ts" | "tsx" | "js" | "jsx" | "mjs")
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
        }
    }

    /// ファイルを読み、コンテンツハッシュでキャッシュ照合し、必要なら変換する。
    /// メモリ → ディスク（再起動をまたぐ）→ 変換 の順で照合する。
    pub fn load_module(&self, abs: &Path, mode: Mode) -> Result<String> {
        let source = std::fs::read_to_string(abs)
            .with_context(|| format!("読み込み失敗: {}", abs.display()))?;
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

        let code = transform::transform_file(
            &self.root,
            abs,
            &source,
            mode,
            &self.resolver,
            &self.client_defines,
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
}
