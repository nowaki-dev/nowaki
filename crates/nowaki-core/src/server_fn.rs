//! サーバー関数（`"use server"`）。RSC 的なサーバー↔クライアント境界。
//!
//! トップに `"use server"` ディレクティブを持つモジュールは「サーバーモジュール」になり、
//! その export 関数はサーバーにだけ残る RPC エンドポイントになる。クライアントへは実装の
//! 代わりに極小プロキシ（`POST /__nowaki/fn` へ転送する async 関数）だけを出力する。
//! サーバー専用の依存（DB ドライバ等）をクライアントグラフへ引き込まないよう、
//! ビルド/dev の双方でサーバーモジュールは「依存ゼロの境界」として扱う。
//!
//! id は `<moduleKey>#<export>` の安定ハッシュ。moduleKey は拡張子を除いたルート相対 posix パス
//! なので、クライアントのプロキシとサーバーの allowlist が同じ id を独立に算出できる。

use std::path::Path;

use anyhow::{anyhow, Result};
use oxc::allocator::Allocator;
use oxc::ast::ast::{Declaration, ModuleExportName, Statement};
use oxc::parser::Parser;
use oxc::span::SourceType;
use xxhash_rust::xxh3::xxh3_64;

/// クライアントから 1 リクエストで呼ぶ RPC エンドポイント。
pub const SERVER_FN_PATH: &str = "/__nowaki/fn";

/// このソースがサーバーモジュール（先頭に `"use server"` ディレクティブ）か。
/// 構文解析せず、ディレクティブプロローグ（先頭の文字列リテラル文の並び）だけを走査する。
pub fn has_use_server(source: &str) -> bool {
    has_directive(source, "use server")
}

/// 先頭のディレクティブプロローグに `want` ディレクティブがあるか。
/// 空白・行/ブロックコメント・先行する他ディレクティブ（"use strict" 等）を飛ばす。
fn has_directive(source: &str, want: &str) -> bool {
    let bytes = source.as_bytes();
    let mut i = 0;
    if source.starts_with('\u{feff}') {
        i += 3; // UTF-8 BOM
    }
    loop {
        // 空白
        while i < bytes.len() && bytes[i].is_ascii_whitespace() {
            i += 1;
        }
        // 行コメント
        if i + 1 < bytes.len() && bytes[i] == b'/' && bytes[i + 1] == b'/' {
            i += 2;
            while i < bytes.len() && bytes[i] != b'\n' {
                i += 1;
            }
            continue;
        }
        // ブロックコメント
        if i + 1 < bytes.len() && bytes[i] == b'/' && bytes[i + 1] == b'*' {
            i += 2;
            while i + 1 < bytes.len() && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                i += 1;
            }
            i = (i + 2).min(bytes.len());
            continue;
        }
        // 文字列リテラルのディレクティブか
        let quote = match bytes.get(i) {
            Some(&b'"') => b'"',
            Some(&b'\'') => b'\'',
            _ => return false, // ディレクティブ以外の文 → プロローグ終わり
        };
        let start = i + 1;
        let mut j = start;
        while j < bytes.len() && bytes[j] != quote {
            if bytes[j] == b'\\' {
                j += 1; // エスケープを飛ばす
            }
            j += 1;
        }
        if j >= bytes.len() {
            return false; // 閉じない文字列
        }
        if &source[start..j] == want {
            return true;
        }
        // 別ディレクティブだった: 閉じquote と任意の `;`・空白を飛ばして次へ
        i = j + 1;
        while i < bytes.len() && (bytes[i] == b';' || bytes[i].is_ascii_whitespace()) {
            i += 1;
        }
    }
}

/// 拡張子を除いたルート相対 posix パス（id 計算の安定キー）。
pub fn module_key(root: &Path, abs: &Path) -> String {
    let rel = abs.strip_prefix(root).unwrap_or(abs);
    rel.with_extension("").to_string_lossy().replace('\\', "/")
}

/// ルート相対 posix パス（拡張子つき）。
pub fn source_rel(root: &Path, abs: &Path) -> String {
    abs.strip_prefix(root)
        .unwrap_or(abs)
        .to_string_lossy()
        .replace('\\', "/")
}

/// サーバー関数の安定 id（`<moduleKey>#<export>` の 64bit ハッシュを 16 桁 hex で）。
pub fn server_fn_id(module_key: &str, export: &str) -> String {
    format!(
        "{:016x}",
        xxh3_64(format!("{module_key}#{export}").as_bytes())
    )
}

/// モジュールが export する名前を集める（named 宣言・`export {a}`・default）。
/// `export * from` や `export {a} from` の再 export は対象外（プロキシ不能なため）。
pub fn collect_exports(abs: &Path, source: &str) -> Result<Vec<String>> {
    let allocator = Allocator::default();
    let source_type = SourceType::from_path(abs).unwrap_or_else(|_| SourceType::tsx());
    let parsed = Parser::new(&allocator, source, source_type).parse();
    if !parsed.errors.is_empty() {
        let msgs: Vec<String> = parsed.errors.iter().map(|e| e.to_string()).collect();
        return Err(anyhow!(
            "parse error in {}: {}",
            abs.display(),
            msgs.join("; ")
        ));
    }
    let mut out: Vec<String> = Vec::new();
    for stmt in &parsed.program.body {
        match stmt {
            Statement::ExportNamedDeclaration(d) => {
                if let Some(decl) = &d.declaration {
                    out.extend(decl_bound_names(decl));
                } else if d.source.is_none() {
                    for sp in &d.specifiers {
                        out.push(export_name_str(&sp.exported));
                    }
                }
            }
            Statement::ExportDefaultDeclaration(_) => out.push("default".to_string()),
            _ => {}
        }
    }
    out.sort();
    out.dedup();
    Ok(out)
}

/// サーバーモジュールのクライアントプロキシソースを生成する（依存なしのリーフ）。
/// 各 export は `fetch(SERVER_FN_PATH)` する async 関数。実装はクライアントに出ない。
pub fn client_proxy(module_key: &str, exports: &[String]) -> String {
    let mut out = String::new();
    out.push_str(
        "// nowaki: \"use server\" モジュールのクライアントプロキシ（実装はサーバーに留まる）。\n",
    );
    // FormData 引数はオブジェクト化する（`<form action={serverFn}>` で渡される FormData を
    // JSON 化できるように）。これで島内の form action から server fn を呼べる。
    out.push_str(
        "const __nowakiArg = (a) => (typeof FormData !== \"undefined\" && a instanceof FormData) ? Object.fromEntries(a) : a;\n",
    );
    // プロキシ本体。`<form action={fn}>` で使えるよう、toString は `__nowaki_action:<id>` を返す
    // （preact は関数 action を文字列化して属性に入れるので、クライアントの form 傍受がこれを拾う）。
    out.push_str(&format!(
        "const __nowakiCall = (id) => {{\n  \
const fn = async (...args) => {{\n    \
const res = await fetch({path:?}, {{ method: \"POST\", headers: {{ \"content-type\": \"application/json\" }}, body: JSON.stringify({{ id, args: args.map(__nowakiArg) }}) }});\n    \
let data = null;\n    \
try {{ data = await res.json(); }} catch {{}}\n    \
if (!res.ok) throw new Error((data && data.error) || (\"server function failed: \" + res.status));\n    \
return data ? data.result : null;\n  \
}};\n  \
fn.toString = () => \"__nowaki_action:\" + id;\n  \
fn.__nowakiId = id;\n  \
return fn;\n\
}};\n",
        path = SERVER_FN_PATH,
    ));
    for ex in exports {
        let id = server_fn_id(module_key, ex);
        if ex == "default" {
            out.push_str(&format!("export default __nowakiCall({id:?});\n"));
        } else {
            out.push_str(&format!("export const {ex} = __nowakiCall({id:?});\n"));
        }
    }
    out
}

/// 検出したサーバー関数 1 つ分。
pub struct DiscoveredFn {
    pub id: String,
    /// ルート相対 posix パス（拡張子つき, dev のソース import 用）
    pub source_rel: String,
    /// 拡張子を除いた moduleKey
    pub module_key: String,
    pub export: String,
}

/// 指定ディレクトリ（ルート相対名）配下を走査し、サーバー関数を全部集める。
/// dev（ソースを直接 import）と build（functions.json）の両方が同じ結果を使う。
pub fn discover(core: &crate::NowakiCore, dirs: &[&str]) -> Vec<DiscoveredFn> {
    let mut out = Vec::new();
    for sub in dirs {
        let root = core.root.join(sub);
        if !root.is_dir() {
            continue;
        }
        let mut files = Vec::new();
        walk(&root, &mut files);
        files.sort();
        for abs in files {
            if !crate::is_transformable(&abs) {
                continue;
            }
            let Ok(src) = core.read_source(&abs) else {
                continue;
            };
            if !has_use_server(&src) {
                continue;
            }
            let key = module_key(&core.root, &abs);
            let rel = source_rel(&core.root, &abs);
            let Ok(exports) = collect_exports(&abs, &src) else {
                continue;
            };
            for ex in exports {
                out.push(DiscoveredFn {
                    id: server_fn_id(&key, &ex),
                    source_rel: rel.clone(),
                    module_key: key.clone(),
                    export: ex,
                });
            }
        }
    }
    out
}

fn walk(dir: &Path, out: &mut Vec<std::path::PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk(&path, out);
        } else {
            out.push(path);
        }
    }
}

fn export_name_str(n: &ModuleExportName) -> String {
    match n {
        ModuleExportName::IdentifierName(i) => i.name.to_string(),
        ModuleExportName::IdentifierReference(i) => i.name.to_string(),
        ModuleExportName::StringLiteral(s) => s.value.to_string(),
    }
}

fn decl_bound_names(decl: &Declaration) -> Vec<String> {
    match decl {
        Declaration::VariableDeclaration(v) => v
            .declarations
            .iter()
            .filter_map(|d| d.id.get_binding_identifier().map(|b| b.name.to_string()))
            .collect(),
        Declaration::FunctionDeclaration(f) => {
            f.id.as_ref()
                .map(|i| vec![i.name.to_string()])
                .unwrap_or_default()
        }
        Declaration::ClassDeclaration(c) => {
            c.id.as_ref()
                .map(|i| vec![i.name.to_string()])
                .unwrap_or_default()
        }
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn detects_use_server_directive() {
        assert!(has_use_server("\"use server\";\nexport function a(){}"));
        assert!(has_use_server("'use server'\nexport const b = 1"));
        // 先行コメント・空行を飛ばす
        assert!(has_use_server("// top\n\n  \"use server\";\n"));
        assert!(has_use_server("/* c */ \"use server\";"));
        // 別ディレクティブの後でも拾う
        assert!(has_use_server("\"use strict\";\n\"use server\";"));
        // 本体の途中の文字列は誤検出しない
        assert!(!has_use_server("export const x = \"use server\";"));
        assert!(!has_use_server("const a = 1;\n\"use server\";"));
        assert!(!has_use_server(
            "export function a(){ return \"use server\"; }"
        ));
    }

    #[test]
    fn module_key_strips_ext_and_normalizes() {
        let root = PathBuf::from("/app");
        assert_eq!(
            module_key(&root, &PathBuf::from("/app/actions/todos.ts")),
            "actions/todos"
        );
        assert_eq!(
            module_key(&root, &PathBuf::from("/app/lib/db.tsrx")),
            "lib/db"
        );
    }

    #[test]
    fn id_is_stable_and_distinct() {
        let a = server_fn_id("actions/todos", "addTodo");
        let a2 = server_fn_id("actions/todos", "addTodo");
        assert_eq!(a, a2, "同じ入力は同じ id");
        assert_ne!(a, server_fn_id("actions/todos", "listTodos"));
        assert_ne!(a, server_fn_id("actions/other", "addTodo"));
        assert_eq!(a.len(), 16);
    }

    #[test]
    fn collect_exports_finds_all_forms() {
        let src = "\"use server\";\n\
export async function addTodo(t){}\n\
export const listTodos = async () => [];\n\
function helper(){}\n\
export { helper };\n\
export default async function(){}\n";
        let names = collect_exports(Path::new("/app/actions/todos.ts"), src).unwrap();
        assert!(names.contains(&"addTodo".to_string()));
        assert!(names.contains(&"listTodos".to_string()));
        assert!(names.contains(&"helper".to_string()));
        assert!(names.contains(&"default".to_string()));
    }

    #[test]
    fn client_proxy_has_no_impl_and_one_entry_per_export() {
        let proxy = client_proxy(
            "actions/todos",
            &["addTodo".to_string(), "default".to_string()],
        );
        assert!(proxy.contains("export const addTodo = __nowakiCall("));
        assert!(proxy.contains("export default __nowakiCall("));
        assert!(proxy.contains(SERVER_FN_PATH));
        // 実装の痕跡が無い
        assert!(!proxy.contains("function addTodo"));
    }
}
