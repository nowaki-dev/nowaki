//! `nowaki upgrade` — 既存アプリの nowaki(CLI) と @nowaki-dev/runtime を最新へ更新する。
//!
//! caret(`^0.x`)は 0.x 系ではマイナーをロックするため、`npm update` だけでは
//! 0.10 → 0.11 のようなマイナー跨ぎに上がらない。このコマンドは明示的に `@latest`
//! （または `--to <version>`）を入れ、package.json のレンジごと更新する。
//! パッケージマネージャはロックファイルから自動検出する（npm/pnpm/yarn/bun）。

use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{bail, Context, Result};

use crate::ui;

const RUNTIME: &str = "@nowaki-dev/runtime";
const CLI: &str = "nowaki";

pub fn run(root: PathBuf, to: Option<String>) -> Result<()> {
    let pkg_path = root.join("package.json");
    if !pkg_path.exists() {
        bail!(
            "package.json が見つかりません（{}）。Nowaki アプリのディレクトリで実行してください。",
            root.display()
        );
    }
    let text = std::fs::read_to_string(&pkg_path)
        .with_context(|| format!("読み込み失敗: {}", pkg_path.display()))?;
    let pkg: serde_json::Value =
        serde_json::from_str(&text).context("package.json の解析に失敗")?;

    let dep = |group: &str, name: &str| -> Option<String> {
        pkg.get(group)?.get(name)?.as_str().map(str::to_string)
    };
    let cur_runtime = dep("dependencies", RUNTIME);
    let cur_cli = dep("devDependencies", CLI).or_else(|| dep("dependencies", CLI));
    let cli_is_dev = dep("devDependencies", CLI).is_some();

    if cur_runtime.is_none() && cur_cli.is_none() {
        bail!("このプロジェクトは Nowaki アプリではないようです（{RUNTIME} も {CLI} も依存に見つかりません）。");
    }

    let pm = detect_pm(&root);
    let spec = to.as_deref().unwrap_or("latest");

    println!("{}", ui::bold("Nowaki upgrade"));
    println!("  {} {}", ui::dim("package manager"), pm.name());
    if let Some(v) = &cur_runtime {
        println!(
            "  {} {}  {}",
            ui::dim(RUNTIME),
            v,
            ui::dim(&format!("→ {spec}"))
        );
    }
    if let Some(v) = &cur_cli {
        println!(
            "  {} {}  {}",
            ui::dim(CLI),
            v,
            ui::dim(&format!("→ {spec}"))
        );
    }
    println!();

    // runtime は dependencies、CLI は（元の場所に合わせて）devDependencies に入れる。
    if cur_runtime.is_some() {
        run_pm(&root, &pm, false, &format!("{RUNTIME}@{spec}"))?;
    }
    if cur_cli.is_some() {
        run_pm(&root, &pm, cli_is_dev, &format!("{CLI}@{spec}"))?;
    }

    // 更新後のレンジを表示する。
    if let Some(after) = std::fs::read_to_string(&pkg_path)
        .ok()
        .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
    {
        let show = |group: &str, name: &str| {
            if let Some(v) = after
                .get(group)
                .and_then(|g| g.get(name))
                .and_then(|v| v.as_str())
            {
                println!("  {} {}", ui::dim(name), v);
            }
        };
        println!("\n{}", ui::green("✓ updated"));
        show("dependencies", RUNTIME);
        show("devDependencies", CLI);
        show("dependencies", CLI);
    }
    println!(
        "\n  {}",
        ui::dim("next: rebuild to verify — `nowaki build` (or `npm run build`)")
    );
    Ok(())
}

enum Pm {
    Npm,
    Pnpm,
    Yarn,
    Bun,
}

impl Pm {
    fn name(&self) -> &'static str {
        match self {
            Pm::Npm => "npm",
            Pm::Pnpm => "pnpm",
            Pm::Yarn => "yarn",
            Pm::Bun => "bun",
        }
    }
}

fn detect_pm(root: &Path) -> Pm {
    if root.join("pnpm-lock.yaml").exists() {
        Pm::Pnpm
    } else if root.join("yarn.lock").exists() {
        Pm::Yarn
    } else if root.join("bun.lockb").exists() || root.join("bun.lock").exists() {
        Pm::Bun
    } else {
        Pm::Npm
    }
}

/// `<pm> add/install [dev-flag] <spec>` を実行する（stdio は継承してそのまま見せる）。
fn run_pm(root: &Path, pm: &Pm, dev: bool, spec: &str) -> Result<()> {
    let (prog, verb, dev_flag) = match pm {
        Pm::Npm => ("npm", "install", "-D"),
        Pm::Pnpm => ("pnpm", "add", "-D"),
        Pm::Yarn => ("yarn", "add", "-D"),
        Pm::Bun => ("bun", "add", "-d"),
    };
    let mut args = vec![verb.to_string()];
    if dev {
        args.push(dev_flag.to_string());
    }
    args.push(spec.to_string());

    println!("{} {} {}", ui::cyan("$"), prog, args.join(" "));
    let status = Command::new(prog)
        .args(&args)
        .current_dir(root)
        .status()
        .with_context(|| format!("{prog} の起動に失敗しました（インストールされていますか？）"))?;
    if !status.success() {
        bail!("{prog} {spec} が失敗しました");
    }
    Ok(())
}
