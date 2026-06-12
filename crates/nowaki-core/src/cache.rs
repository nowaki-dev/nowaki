use std::path::PathBuf;

use dashmap::DashMap;

/// 変換モード。Browser はbare importをURLへ書き換え、Ssr はNode解決に任せる。
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum Mode {
    Browser,
    Ssr,
}

pub struct CachedModule {
    /// 変換元ソースの xxh3 ハッシュ。ファイル再読込時の鮮度判定に使う。
    pub source_hash: u64,
    pub code: String,
}

/// (絶対パス, モード) → 変換結果。コンテンツハッシュで自動失効するため
/// watcherによる明示的なinvalidationを必要としない。
pub type ModuleCache = DashMap<(PathBuf, Mode), CachedModule>;
