use std::path::Path;

use oxc_resolver::{ResolveOptions, Resolver};

/// ブラウザ向けESM解決のためのリゾルバ。
pub fn make_resolver() -> Resolver {
    Resolver::new(ResolveOptions {
        extensions: vec![
            ".tsx".into(),
            ".ts".into(),
            ".jsx".into(),
            ".js".into(),
            ".mjs".into(),
            ".json".into(),
        ],
        condition_names: vec![
            "browser".into(),
            "import".into(),
            "module".into(),
            "default".into(),
        ],
        main_fields: vec!["module".into(), "browser".into(), "main".into()],
        ..ResolveOptions::default()
    })
}

/// 解決済み絶対パスをdevサーバーのURLへマップする。
/// - アプリルート配下 → ルート相対URL (/islands/Counter.tsx)
/// - ルート外 (pnpmストア等のrealpath) → /@fs/<絶対パス>
pub fn fs_path_to_url(root: &Path, abs: &Path) -> String {
    match abs.strip_prefix(root) {
        Ok(rel) => format!("/{}", rel.to_string_lossy()),
        Err(_) => format!("/@fs{}", abs.to_string_lossy()),
    }
}
