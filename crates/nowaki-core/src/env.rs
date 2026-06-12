use std::collections::BTreeMap;
use std::path::Path;

/// `.env` / `.env.local` を読み、クライアントへ安全に露出できる定数置換ペアを作る。
/// - `PUBLIC_` 接頭辞の変数のみ `import.meta.env.PUBLIC_X` として露出（秘密は出さない）
/// - `import.meta.env.MODE` / `DEV` / `PROD` も付与
///
/// 戻り値は ReplaceGlobalDefines 用の `(キー, JSリテラル)` ペア。
pub fn load_client_defines(root: &Path) -> Vec<(String, String)> {
    let mut vars: BTreeMap<String, String> = BTreeMap::new();
    for file in [".env", ".env.local"] {
        let Ok(content) = std::fs::read_to_string(root.join(file)) else {
            continue;
        };
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let Some(eq) = line.find('=') else { continue };
            let key = line[..eq].trim().to_string();
            let mut val = line[eq + 1..].trim().to_string();
            // クォート除去
            let quoted = (val.starts_with('"') && val.ends_with('"'))
                || (val.starts_with('\'') && val.ends_with('\''));
            if quoted && val.len() >= 2 {
                val = val[1..val.len() - 1].to_string();
            }
            vars.insert(key, val);
        }
    }

    let mode = std::env::var("NODE_ENV").unwrap_or_else(|_| "development".to_string());
    let is_prod = mode == "production";

    let mut defines = Vec::new();
    for (k, v) in &vars {
        if k.starts_with("PUBLIC_") {
            // {:?} で JS/JSON 互換の文字列リテラルにエスケープ
            defines.push((format!("import.meta.env.{k}"), format!("{v:?}")));
        }
    }
    defines.push(("import.meta.env.MODE".to_string(), format!("{mode:?}")));
    defines.push(("import.meta.env.DEV".to_string(), (!is_prod).to_string()));
    defines.push(("import.meta.env.PROD".to_string(), is_prod.to_string()));
    defines
}
