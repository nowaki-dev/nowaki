pub mod build;
pub mod cache;
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

/// バンドラーコア。devサーバー/buildの両方から使う。
pub struct NowakiCore {
    pub root: PathBuf,
    resolver: Resolver,
    cache: cache::ModuleCache,
}

impl NowakiCore {
    pub fn new(root: PathBuf) -> Self {
        Self {
            root,
            resolver: resolve::make_resolver(),
            cache: cache::ModuleCache::default(),
        }
    }

    /// ファイルを読み、コンテンツハッシュでキャッシュ照合し、必要なら変換する。
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

        let code = transform::transform_file(&self.root, abs, &source, mode, &self.resolver)?;
        self.cache.insert(
            key,
            cache::CachedModule {
                source_hash: hash,
                code: code.clone(),
            },
        );
        Ok(code)
    }

    /// 本番ビルド: クライアントグラフを dist/client/ へ出力する。
    pub fn build_client(&self, dist: &Path) -> Result<build::BuildReport> {
        build::build_client(self, dist)
    }
}
