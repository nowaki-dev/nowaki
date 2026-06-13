//! CLI 統合テスト。ビルド済みバイナリで `nowaki build examples/hello` を実行し、
//! 出力の不変条件（manifest・スコープホイスティング・ライブ島のゼロJS）を検証する。
//! examples/hello に node_modules が無い環境ではスキップする。

use std::path::PathBuf;
use std::process::Command;

fn example_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../examples/hello")
        .canonicalize()
        .expect("examples/hello path")
}

fn deps_installed(root: &std::path::Path) -> bool {
    root.join("node_modules/preact").exists()
        && root.join("node_modules/@nowaki-dev/runtime").exists()
}

#[test]
fn build_produces_expected_manifest_and_zero_js_live_island() {
    let root = example_root();
    if !deps_installed(&root) {
        eprintln!("skip: examples/hello deps not installed");
        return;
    }
    let bin = env!("CARGO_BIN_EXE_nowaki");
    let _ = std::fs::remove_dir_all(root.join("dist"));
    let status = Command::new(bin)
        .arg("build")
        .arg(&root)
        .status()
        .expect("run nowaki build");
    assert!(status.success(), "nowaki build failed");

    let client = root.join("dist/client");
    let manifest = std::fs::read_to_string(client.join("manifest.json")).expect("manifest");
    assert!(manifest.contains("\"preload\""), "preload chains expected");

    // Jetstream island: 登録されるが、クライアントチャンクは出さない（JS追加ゼロ）。
    assert!(
        manifest.contains("\"liveIslands\": [\"LiveCounter\"]"),
        "LiveCounter should be a live island"
    );
    assert!(
        manifest.contains("\"liveRuntime\""),
        "liveRuntime (live.js) expected"
    );
    let names: Vec<String> = std::fs::read_dir(&client)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    assert!(
        !names.iter().any(|n| n.starts_with("LiveCounter.")),
        "live island must not ship a client chunk"
    );
    // スコープホイスティング: 循環 lib (cycle-a) は別チャンクにならない（Cycle へ連結）。
    assert!(
        !names.iter().any(|n| n.starts_with("cycle-a.")),
        "cyclic lib should be hoisted, not a separate chunk"
    );
    // ライブ島もサーバーモジュールとしては出力される（再描画に必要）。
    assert!(
        root.join("dist/server/islands/LiveCounter.js").exists(),
        "live island server module expected"
    );

    let _ = std::fs::remove_dir_all(root.join("dist"));
}
