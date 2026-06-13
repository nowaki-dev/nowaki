//! ターミナル出力の体裁（色・バナー）。NO_COLOR と非 TTY を尊重し、色なしでも崩れない。

use std::io::IsTerminal;
use std::net::{IpAddr, UdpSocket};

fn color() -> bool {
    std::io::stdout().is_terminal() && std::env::var_os("NO_COLOR").is_none()
}

fn paint(code: &str, s: &str) -> String {
    if color() {
        format!("\x1b[{code}m{s}\x1b[0m")
    } else {
        s.to_string()
    }
}

pub fn cyan(s: &str) -> String {
    paint("36", s)
}
pub fn dim(s: &str) -> String {
    paint("2", s)
}
pub fn bold(s: &str) -> String {
    paint("1", s)
}
pub fn green(s: &str) -> String {
    paint("32", s)
}
pub fn yellow(s: &str) -> String {
    paint("33", s)
}
pub fn red(s: &str) -> String {
    paint("31", s)
}

/// ファイル変更 → HMR のログ。`kind` は "update"（島ホットスワップ）/ "reload"（フルリロード）。
pub fn hmr_log(kind: &str, files: &[String]) {
    let list = files.join(", ");
    if kind == "update" {
        println!("  {} {}  {}", cyan("hmr"), dim("update"), list);
    } else {
        println!("  {} {}  {}", yellow("hmr"), dim("reload"), list);
    }
}

/// ページ/API/SSR リクエストのログ（method path status ms）。ステータスで色分け。
pub fn request_log(method: &str, path: &str, status: u16, ms: u128) {
    let code = status.to_string();
    let st = if status < 300 {
        green(&code)
    } else if status < 400 {
        yellow(&code)
    } else {
        red(&code)
    };
    println!(
        "  {} {}  {}  {}",
        dim(method),
        path,
        st,
        dim(&format!("{ms} ms")),
    );
}

/// LAN の IPv4 を推定する（UDP connect で経路を引くだけ。実際のパケットは送らない）。
pub fn lan_ip() -> Option<String> {
    let sock = UdpSocket::bind("0.0.0.0:0").ok()?;
    sock.connect("8.8.8.8:80").ok()?;
    match sock.local_addr().ok()?.ip() {
        IpAddr::V4(v4) if !v4.is_loopback() => Some(v4.to_string()),
        _ => None,
    }
}

/// ディレクトリ直下の *.js の合計サイズ（KB, 生 minified バイト）。
pub fn dir_js_kb(dir: &std::path::Path) -> f64 {
    let mut bytes = 0u64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let p = e.path();
            if p.extension().and_then(|x| x.to_str()) == Some("js") {
                if let Ok(m) = std::fs::metadata(&p) {
                    bytes += m.len();
                }
            }
        }
    }
    bytes as f64 / 1024.0
}

/// `nowaki build` 完了サマリ。
pub fn build_summary(
    client_modules: usize,
    islands: usize,
    server_modules: usize,
    client_js_kb: f64,
    ms: u128,
    out: &std::path::Path,
) {
    println!();
    println!(
        "  {} {}",
        bold(&cyan("Nowaki")),
        dim(&format!("built in {ms} ms"))
    );
    println!();
    println!(
        "  {}  {}  {}",
        green("➜"),
        bold("client:"),
        dim(&format!(
            "{client_modules} modules · {islands} island(s) · {client_js_kb:.1} KB JS"
        )),
    );
    println!(
        "  {}  {}  {}",
        green("➜"),
        bold("server:"),
        dim(&format!("{server_modules} modules")),
    );
    println!(
        "  {}  {}  {}",
        green("➜"),
        bold("output:"),
        cyan(&out.display().to_string()),
    );
    println!();
}

/// 開発/本番サーバーの ready バナー。`show_network` のときだけ LAN URL を出す。
/// `features` は有効な機能（plugins, Jetstream 等）。色なしでも読める形。
pub fn server_banner(
    label: &str,
    version: &str,
    port: u16,
    ready_ms: u128,
    features: &[&str],
    show_network: bool,
) {
    println!();
    println!("  {} {}", bold(&cyan(label)), dim(&format!("v{version}")));
    println!();
    println!(
        "  {}  {}    {}",
        green("➜"),
        bold("Local:"),
        cyan(&format!("http://localhost:{port}/")),
    );
    if show_network {
        if let Some(ip) = lan_ip() {
            println!(
                "  {}  {}  {}",
                green("➜"),
                bold("Network:"),
                cyan(&format!("http://{ip}:{port}/")),
            );
        }
    } else {
        println!(
            "  {}  {}  {}",
            dim("➜"),
            dim("Network:"),
            dim("use --host to expose"),
        );
    }
    // "ready in" はベンチ（bench.mjs / head-to-head.mjs）が待つマーカーでもある。
    println!(
        "  {}  ready in {}",
        green("➜"),
        bold(&format!("{ready_ms} ms"))
    );
    if !features.is_empty() {
        println!();
        println!("  {}", dim(&features.join(" · ")));
    }
    println!();
}

/// 既定ブラウザで URL を開く（OS 別。失敗は黙って無視）。
pub fn open_browser(url: &str) {
    let mut cmd = if cfg!(target_os = "macos") {
        let mut c = std::process::Command::new("open");
        c.arg(url);
        c
    } else if cfg!(target_os = "windows") {
        let mut c = std::process::Command::new("cmd");
        c.args(["/C", "start", "", url]);
        c
    } else {
        let mut c = std::process::Command::new("xdg-open");
        c.arg(url);
        c
    };
    let _ = cmd
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();
}
