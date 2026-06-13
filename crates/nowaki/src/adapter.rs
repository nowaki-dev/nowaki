//! デプロイアダプタ。ビルド出力 `dist/` を各ターゲット向けの配備物に仕上げる。
//!
//! - `node` / `bun` / `deno`: 自己完結のサーバーエントリ `dist/server/index.mjs` を出力。
//!   `node dist/server/index.mjs`（または bun/deno）だけで本番配信でき、nowaki バイナリは不要。
//!   中核は `@nowaki-dev/runtime` の app.mjs（node:http 互換、Bun/Deno の node 互換でも動く）。
//! - `static`: 事前レンダリング（SSG）。main 側で prerender に委譲する。

use std::path::Path;

use anyhow::{Context, Result};
use clap::ValueEnum;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, ValueEnum)]
pub enum Adapter {
    /// 自己完結 Node サーバー（既定）
    #[default]
    Node,
    /// 静的サイト（SSG, prerender）
    Static,
    /// Bun ランタイム（node:http 互換の同一エントリ）
    Bun,
    /// Deno ランタイム（node:http 互換の同一エントリ）
    Deno,
}

impl Adapter {
    fn label(self) -> &'static str {
        match self {
            Adapter::Node => "node",
            Adapter::Static => "static",
            Adapter::Bun => "bun",
            Adapter::Deno => "deno",
        }
    }

    /// 起動コマンドのヒント（出力メッセージ用）。
    fn run_cmd(self) -> &'static str {
        match self {
            Adapter::Bun => "bun dist/server/index.mjs",
            Adapter::Deno => "deno run -A dist/server/index.mjs",
            _ => "node dist/server/index.mjs",
        }
    }
}

/// サーバーエントリ系アダプタ（node/bun/deno）の配備物を `dist/server/` に書き出す。
pub fn emit_server(root: &Path, dist: &Path, adapter: Adapter) -> Result<()> {
    let server_dir = dist.join("server");
    std::fs::create_dir_all(&server_dir)
        .with_context(|| format!("dist/server の作成に失敗: {}", server_dir.display()))?;

    let runtime_ver =
        installed_version(root, "@nowaki-dev/runtime").unwrap_or_else(|| "0.3.0".into());
    let preact_ver = installed_version(root, "preact").unwrap_or_else(|| "10.25.0".into());
    let prts_ver =
        installed_version(root, "preact-render-to-string").unwrap_or_else(|| "6.5.0".into());

    let index = format!(
        r#"// nowaki デプロイエントリ（{label} adapter, 自動生成）。
// `{run}` だけで本番配信できる。nowaki バイナリは不要。
// 依存: @nowaki-dev/runtime / preact / preact-render-to-string（この dir の package.json）。
import path from "node:path";
import {{ fileURLToPath }} from "node:url";
import {{ startServer }} from "@nowaki-dev/runtime/server/app.mjs";

const here = path.dirname(fileURLToPath(import.meta.url)); // dist/server
await startServer({{
  clientDir: path.join(here, "../client"),
  serverDir: here,
  port: Number(process.env.PORT ?? 3000),
}});
"#,
        label = adapter.label(),
        run = adapter.run_cmd(),
    );
    std::fs::write(server_dir.join("index.mjs"), index)?;

    // 配備時に `npm install` するための最小 package.json（実行時依存だけ）。
    let pkg = format!(
        r#"{{
  "name": "nowaki-app-server",
  "private": true,
  "type": "module",
  "scripts": {{
    "start": "node index.mjs"
  }},
  "dependencies": {{
    "@nowaki-dev/runtime": "^{runtime_ver}",
    "preact": "^{preact_ver}",
    "preact-render-to-string": "^{prts_ver}"
  }}
}}
"#,
    );
    std::fs::write(server_dir.join("package.json"), pkg)?;

    println!(
        "[nowaki] {} adapter: dist/server/index.mjs を出力。配備: `cd dist/server && npm install --omit=dev && {}`",
        adapter.label(),
        adapter.run_cmd()
    );
    Ok(())
}

/// アプリの node_modules から実インストール版を読む（`^x.y.z` のピン用）。
fn installed_version(root: &Path, pkg: &str) -> Option<String> {
    let pj = root.join("node_modules").join(pkg).join("package.json");
    let text = std::fs::read_to_string(pj).ok()?;
    // serde を増やさないため素朴に "version": "x.y.z" を拾う。
    let key = "\"version\"";
    let i = text.find(key)?;
    let after = &text[i + key.len()..];
    let start = after.find('"')? + 1;
    let rest = &after[start..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}
