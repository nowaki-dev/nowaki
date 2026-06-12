mod dev;
mod sidecar;

use std::path::PathBuf;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(
    name = "nowaki",
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
    }
}
