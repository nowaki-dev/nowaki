//! transform_file の統合テスト（import 解決の要らない範囲）。
//! TS 型剥がし・JSX→preact・react→preact/compat エイリアスを検証する。

use std::path::Path;

use nowaki_core::resolve::make_resolver;
use nowaki_core::transform::transform_file;
use nowaki_core::Mode;

#[test]
fn strips_types_and_transforms_jsx() {
    let resolver = make_resolver();
    let code = "const x: number = 1;\nexport default function App() { return <div class=\"a\">{x}</div>; }";
    let out = transform_file(
        Path::new("/app"),
        Path::new("/app/App.tsx"),
        code,
        Mode::Ssr,
        &resolver,
        &[],
    )
    .expect("transform ok");
    // 型注釈は除去される
    assert!(
        !out.contains(": number"),
        "type annotation should be stripped:\n{out}"
    );
    // JSX は automatic runtime（importSource=preact）へ
    assert!(
        out.contains("jsx-runtime"),
        "jsx-runtime import expected:\n{out}"
    );
    assert!(
        out.contains("_jsx") || out.contains("jsx("),
        "jsx call expected:\n{out}"
    );
}

#[test]
fn aliases_react_to_preact_compat() {
    let resolver = make_resolver();
    let code = "import { useState } from \"react\";\nexport const useS = useState;";
    let out = transform_file(
        Path::new("/app"),
        Path::new("/app/x.ts"),
        code,
        Mode::Ssr,
        &resolver,
        &[],
    )
    .expect("transform ok");
    assert!(
        out.contains("preact/compat"),
        "react should alias to preact/compat:\n{out}"
    );
    assert!(
        !out.contains("\"react\""),
        "bare react should be gone:\n{out}"
    );
}

#[test]
fn applies_client_defines() {
    let resolver = make_resolver();
    let code = "export const mode = import.meta.env.MODE;";
    let defines = [(
        "import.meta.env.MODE".to_string(),
        "\"production\"".to_string(),
    )];
    let out = transform_file(
        Path::new("/app"),
        Path::new("/app/x.ts"),
        code,
        Mode::Browser,
        &resolver,
        &defines,
    )
    .expect("transform ok");
    assert!(
        out.contains("\"production\""),
        "define should be inlined:\n{out}"
    );
}
