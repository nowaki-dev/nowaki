//! デプロイアダプタ。ビルド出力 `dist/` を各ターゲット向けの配備物に仕上げる。
//!
//! - `node` / `bun` / `deno`: 自己完結のサーバーエントリ `dist/server/index.mjs` を出力。
//!   `node dist/server/index.mjs`（または bun/deno）だけで本番配信でき、nowaki バイナリは不要。
//!   中核は `@nowaki-dev/runtime` の app.mjs（node:http 互換、Bun/Deno の node 互換でも動く）。
//! - `static`: 事前レンダリング（SSG）。main 側で prerender に委譲する。
//! - `cloudflare`: Edge（Cloudflare Workers）向け。全サーバーモジュールを静的バンドルした
//!   fetch ハンドラ worker と wrangler 設定を `dist/worker/` に生成する（emit_cloudflare）。

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
    /// Cloudflare Workers（Edge, fetch ハンドラ + 静的アセット binding）
    Cloudflare,
}

impl Adapter {
    fn label(self) -> &'static str {
        match self {
            Adapter::Node => "node",
            Adapter::Static => "static",
            Adapter::Bun => "bun",
            Adapter::Deno => "deno",
            Adapter::Cloudflare => "cloudflare",
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
        installed_version(root, "@nowaki-dev/runtime").unwrap_or_else(|| "0.5.0".into());
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

/// Cloudflare Workers（Edge）の配備物を `dist/worker/` に生成する。
/// 実体は runtime の Node 生成器 `server/edge-build.mjs`（dist/server を走査し worker を静的バンドル化）。
pub fn emit_cloudflare(root: &Path, dist: &Path) -> Result<()> {
    let script = root.join("node_modules/@nowaki-dev/runtime/server/edge-build.mjs");
    if !script.exists() {
        anyhow::bail!("@nowaki-dev/runtime が見つかりません: {}", script.display());
    }
    let app_name = read_json_field(&root.join("package.json"), "name")
        .map(|n| sanitize_worker_name(&n))
        .unwrap_or_else(|| "nowaki-app".into());
    let status = std::process::Command::new("node")
        .arg(&script)
        .arg(dist.join("server"))
        .arg(dist.join("client"))
        .arg(dist.join("worker"))
        .arg(&app_name)
        .current_dir(root)
        .status()
        .context("node edge-build.mjs の起動に失敗")?;
    if !status.success() {
        anyhow::bail!("cloudflare adapter の生成に失敗しました");
    }
    println!(
        "[nowaki] cloudflare adapter: dist/worker を出力。検証: `cd dist/worker && npx wrangler dev` / 配備: `cd dist/worker && npx wrangler deploy`"
    );
    Ok(())
}

/// Worker 名は小文字英数とハイフンのみ許される。
fn sanitize_worker_name(name: &str) -> String {
    let s: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let trimmed = s.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "nowaki-app".into()
    } else {
        trimmed
    }
}

/// アプリの node_modules から実インストール版を読む（`^x.y.z` のピン用）。
fn installed_version(root: &Path, pkg: &str) -> Option<String> {
    read_json_field(
        &root.join("node_modules").join(pkg).join("package.json"),
        "version",
    )
}

/// package.json から `"<field>": "..."` を素朴に拾う（serde を増やさない）。
fn read_json_field(pj: &Path, field: &str) -> Option<String> {
    let text = std::fs::read_to_string(pj).ok()?;
    let key = format!("\"{field}\"");
    let i = text.find(&key)?;
    let after = &text[i + key.len()..];
    let start = after.find('"')? + 1;
    let rest = &after[start..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}
