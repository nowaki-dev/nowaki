use std::path::{Path, PathBuf};

use dashmap::DashMap;
use xxhash_rust::xxh3::xxh3_64;

/// 変換モード。Browser はbare importをURLへ書き換え、Ssr はNode解決に任せる。
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum Mode {
    Browser,
    Ssr,
}

impl Mode {
    fn tag(self) -> u8 {
        match self {
            Mode::Browser => 0,
            Mode::Ssr => 1,
        }
    }
}

pub struct CachedModule {
    /// 変換元ソースの xxh3 ハッシュ。ファイル再読込時の鮮度判定に使う。
    pub source_hash: u64,
    pub code: String,
}

/// (絶対パス, モード) → 変換結果。コンテンツハッシュで自動失効するため
/// watcherによる明示的なinvalidationを必要としない。
pub type ModuleCache = DashMap<(PathBuf, Mode), CachedModule>;

/// 再起動をまたぐ永続変換キャッシュ。content-addressed なので mtime に依存せず、
/// ソース・モード・(nowakiバージョン+defines の)salt が同じなら再利用する。
/// 保存先は `node_modules/.cache/nowaki/`（無ければ無効化してフォールバック）。
pub struct DiskCache {
    dir: Option<PathBuf>,
    salt: u64,
}

impl DiskCache {
    /// salt には nowaki バージョン + client_defines のハッシュを混ぜる
    /// （アップグレードや env 変更でキャッシュが自動失効するように）。
    pub fn new(root: &Path, salt: u64) -> Self {
        let dir = root.join("node_modules/.cache/nowaki");
        let dir = std::fs::create_dir_all(&dir).ok().map(|_| dir);
        Self { dir, salt }
    }

    /// (絶対パス, モード, ソースハッシュ) からキャッシュキーを作る。
    pub fn key(&self, abs: &Path, mode: Mode, source_hash: u64) -> u64 {
        let mut buf = Vec::with_capacity(64);
        buf.extend_from_slice(&self.salt.to_le_bytes());
        buf.push(mode.tag());
        buf.extend_from_slice(&source_hash.to_le_bytes());
        buf.extend_from_slice(abs.to_string_lossy().as_bytes());
        xxh3_64(&buf)
    }

    pub fn get(&self, key: u64) -> Option<String> {
        let dir = self.dir.as_ref()?;
        std::fs::read_to_string(dir.join(format!("{key:016x}.js"))).ok()
    }

    pub fn put(&self, key: u64, code: &str) {
        if let Some(dir) = &self.dir {
            // 書き込み失敗は致命的でない（キャッシュ無し相当に劣化するだけ）
            let _ = std::fs::write(dir.join(format!("{key:016x}.js")), code);
        }
    }
}
