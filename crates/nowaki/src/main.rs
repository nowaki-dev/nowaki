mod adapter;
mod dev;
mod live;
mod plugins;
mod prerender;
mod sidecar;
mod start;
mod ui;

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
        /// LAN に公開する（0.0.0.0 で待ち受け、Network URL を表示）
        #[arg(long)]
        host: bool,
        /// 起動後に既定ブラウザを開く
        #[arg(long)]
        open: bool,
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
        /// 全インターフェースで待ち受ける（既定は NOWAKI_HOST or 127.0.0.1）
        #[arg(long)]
        host: bool,
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
        Command::Dev {
            dir,
            port,
            host,
            open,
        } => {
            let root = dir.canonicalize()?;
            tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()?
                .block_on(dev::run(root, port, host, open))
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
            // nowaki.config があればプラグインホストを起動し、変換フックを注入する。
            // build 終了まで生かす（drop でホストを落とす）。
            let plugin_host = plugins::start(&root)?;
            let mut core = nowaki_core::NowakiCore::new(root.clone());
            if let Some(host) = &plugin_host {
                core.set_plugins(host.bridge.clone());
            }
            let started = std::time::Instant::now();
            let report = core.build(&dist)?;
            let client_js_kb = ui::dir_js_kb(&report.out_dir);
            ui::build_summary(
                report.modules,
                report.islands,
                report.server_modules,
                client_js_kb,
                started.elapsed().as_millis(),
                &dist,
            );
            match adapter {
                // cloudflare: Edge worker（fetch ハンドラ + 静的アセット binding）を生成。
                Adapter::Cloudflare => adapter::emit_cloudflare(&root, &dist)?,
                // node/bun/deno: 自己完結のサーバーエントリを出力。
                _ => adapter::emit_server(&root, &dist, adapter)?,
            }
            Ok(())
        }
        Command::Start { dir, port, host } => {
            let root = dir.canonicalize()?;
            // Rust(axum) が静的配信 + HTML 組み立て、Node prod-sidecar がコンポーネント描画。
            tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()?
                .block_on(start::run(root, port, host))
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
