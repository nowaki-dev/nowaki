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
            ".tsrx".into(),
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

/// React 系の bare import を Preact 互換へ読み替える。Next.js から移ってきた
/// コードや React 前提のライブラリを、`react`→`preact/compat` のまま動かすための層。
/// 戻り値が Some ならその指定子に差し替える（解決前の specifier レベルで適用する）。
pub fn alias_specifier(spec: &str) -> Option<&'static str> {
    match spec {
        "react" | "react-dom" | "react-dom/client" => Some("preact/compat"),
        "react/jsx-runtime" => Some("preact/jsx-runtime"),
        "react/jsx-dev-runtime" => Some("preact/jsx-dev-runtime"),
        "react-dom/test-utils" => Some("preact/test-utils"),
        _ => None,
    }
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
