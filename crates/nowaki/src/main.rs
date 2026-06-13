mod adapter;
mod dev;
mod prerender;
mod sidecar;

use std::path::PathBuf;

use adapter::Adapter;
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(
    name = "nowaki",
    version,
    about = "Nowaki — Rust製ツールチェーンのフルスタックフレームワーク"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// 開発サーバーを起動する
    Dev {
        /// アプリのルートディレクトリ
        #[arg(default_value = ".")]
        dir: PathBuf,
        #[arg(short, long, default_value_t = 3000)]
        port: u16,
    },
    /// 本番用にビルドし、デプロイアダプタの配備物を出力する
    Build {
        /// アプリのルートディレクトリ
        #[arg(default_value = ".")]
        dir: PathBuf,
        /// デプロイ先アダプタ (node|static|bun|deno)
        #[arg(long, value_enum, default_value_t = Adapter::Node)]
        adapter: Adapter,
    },
    /// ビルド済みアプリを本番モードで配信する
    Start {
        /// アプリのルートディレクトリ
        #[arg(default_value = ".")]
        dir: PathBuf,
        #[arg(short, long, default_value_t = 3000)]
        port: u16,
    },
    /// 静的サイトとして事前レンダリングする (SSG)
    Prerender {
        /// アプリのルートディレクトリ
        #[arg(default_value = ".")]
        dir: PathBuf,
        /// 出力ディレクトリ (dir からの相対 or 絶対)
        #[arg(short, long, default_value = "dist/static")]
        out: PathBuf,
    },
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Command::Dev { dir, port } => {
            let root = dir.canonicalize()?;
            tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()?
                .block_on(dev::run(root, port))
        }
        Command::Build { dir, adapter } => {
            let root = dir.canonicalize()?;
            // static アダプタは prerender に委譲（build → 一時起動 → 各ルートを静的化）。
            if adapter == Adapter::Static {
                let out = root.join("dist/static");
                return tokio::runtime::Builder::new_multi_thread()
                    .enable_all()
                    .build()?
                    .block_on(prerender::run(root.clone(), out));
            }
            let dist = root.join("dist");
            let core = nowaki_core::NowakiCore::new(root.clone());
            let report = core.build(&dist)?;
            println!(
                "[nowaki] build完了: client {} modules / {} islands, server {} modules → {}",
                report.modules,
                report.islands,
                report.server_modules,
                report.out_dir.display()
            );
            // node/bun/deno: 自己完結のサーバーエントリを出力。
            adapter::emit_server(&root, &dist, adapter)?;
            Ok(())
        }
        Command::Start { dir, port } => {
            let root = dir.canonicalize()?;
            let entry = root.join("node_modules/@nowaki-dev/runtime/server/start.mjs");
            if !entry.exists() {
                anyhow::bail!("@nowaki-dev/runtime が見つかりません: {}", entry.display());
            }
            if !root.join("dist/client/manifest.json").exists() {
                anyhow::bail!(
                    "dist が未ビルドです。先に `nowaki build {}` を実行してください",
                    dir.display()
                );
            }
            let status = std::process::Command::new("node")
                .arg("--enable-source-maps")
                .arg(&entry)
                .current_dir(&root)
                .env("PORT", port.to_string())
                .status()?;
            if !status.success() {
                anyhow::bail!("nowaki start が異常終了しました");
            }
            Ok(())
        }
        Command::Prerender { dir, out } => {
            let root = dir.canonicalize()?;
            let out = if out.is_absolute() {
                out
            } else {
                root.join(out)
            };
            tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()?
                .block_on(prerender::run(root, out))
        }
    }
}
