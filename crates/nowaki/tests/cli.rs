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

    // --- サーバー関数（"use server"）の不変条件 ---
    // allowlist（dist/server/functions.json）に actions/todos の export が並ぶ。
    let functions =
        std::fs::read_to_string(root.join("dist/server/functions.json")).expect("functions.json");
    for export in ["addTodo", "listTodos", "whoami"] {
        assert!(
            functions.contains(&format!("\"export\": \"{export}\"")),
            "server function {export} should be in functions.json"
        );
    }
    assert!(
        functions.contains("\"module\": \"actions/todos.js\""),
        "functions.json module should point at the built server module"
    );

    // 実装はクライアントへ出ない（サーバー専用の secret/store がバンドルに無い）。
    for chunk in &names {
        if chunk.ends_with(".js") {
            let body = std::fs::read_to_string(client.join(chunk)).unwrap_or_default();
            assert!(
                !body.contains("nowaki-server-only-secret"),
                "server secret leaked into client chunk {chunk}"
            );
        }
    }

    // 島チャンクはサーバー関数の本体ではなく、別チャンクのプロキシ（todos.*.js）を import する。
    let todos_proxy = names
        .iter()
        .find(|n| n.starts_with("todos.") && n.ends_with(".js"))
        .expect("server-fn proxy chunk (todos.*.js) expected");
    let proxy = std::fs::read_to_string(client.join(todos_proxy)).unwrap();
    assert!(
        proxy.contains("__nowakiCall(") && proxy.contains("/__nowaki/fn"),
        "proxy chunk should be the fetch shim, not the impl"
    );
    // プロキシの id は functions.json の id と一致する（クライアント／サーバーで独立に算出）。
    for id in ["675f80133a1699f8", "6c90d7dc921a9a3f", "781de5a7f5ba2469"] {
        assert!(functions.contains(id), "functions.json missing id {id}");
        assert!(proxy.contains(id), "proxy missing id {id}");
    }

    let _ = std::fs::remove_dir_all(root.join("dist"));
}
