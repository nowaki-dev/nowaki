use std::path::Path;

use xxhash_rust::xxh3::xxh3_64;

/// サーバー側で .css import を無効化するための空モジュール（CSS はクライアント専用）。
pub const CSS_NOOP_SPECIFIER: &str = "data:text/javascript,";

pub fn is_css(path: &Path) -> bool {
    path.extension().and_then(|e| e.to_str()) == Some("css")
}

/// CSS Modules（`*.module.css`）。ローカルクラス名をスコープ化し、JS へ名前マップを export する。
pub fn is_css_module(path: &Path) -> bool {
    path.to_str().is_some_and(|s| s.ends_with(".module.css"))
}

/// クラスセレクタ `.name` を `.name_<suffix>` にスコープ化する。suffix は id（絶対パス）由来で
/// 安定なので、dev/build・client/SSR で同じ名前になる。(スコープ済CSS, 元名→新名のマップ) を返す。
/// 簡易スキャナ（フル CSS パーサは入れない）: `.` の直後がクラス名のときだけ書き換える。
pub fn scope_css(id: &str, css: &str) -> (String, Vec<(String, String)>) {
    let suffix = format!("{:08x}", xxh3_64(id.as_bytes()) as u32);
    let bytes = css.as_bytes();
    let mut out = String::with_capacity(css.len() + 64);
    let mut map: Vec<(String, String)> = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i];
        // クラスセレクタ開始: '.' の直後が ident-start（a-zA-Z_ または -<letter>）
        if c == b'.' && i + 1 < bytes.len() && is_ident_start(bytes[i + 1]) {
            let start = i + 1;
            let mut j = start;
            while j < bytes.len() && is_ident_char(bytes[j]) {
                j += 1;
            }
            let name = &css[start..j];
            let scoped = format!("{name}_{suffix}");
            out.push('.');
            out.push_str(&scoped);
            if !map.iter().any(|(k, _)| k == name) {
                map.push((name.to_string(), scoped));
            }
            i = j;
            continue;
        }
        out.push(c as char);
        i += 1;
    }
    (out, map)
}

fn is_ident_start(b: u8) -> bool {
    b.is_ascii_alphabetic() || b == b'_' || b == b'-'
}
fn is_ident_char(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_' || b == b'-'
}

/// 元名→スコープ名のマップを JS オブジェクトリテラルにする。
pub fn mapping_object(map: &[(String, String)]) -> String {
    let fields: Vec<String> = map.iter().map(|(k, v)| format!("{k:?}:{v:?}")).collect();
    format!("{{{}}}", fields.join(","))
}

/// クライアント向け CSS Modules モジュール: スコープ済 CSS を `<style>` 注入し、
/// クラス名マップを default export する。
pub fn css_module_client_js(style_id: &str, scoped_css: &str, map: &[(String, String)]) -> String {
    format!(
        "{}export default {};\n",
        css_shim(style_id, scoped_css),
        mapping_object(map)
    )
}

/// SSR / サーバービルド向け: DOM が無いので注入はせず、クラス名マップだけ export する。
pub fn css_module_mapping_js(map: &[(String, String)]) -> String {
    format!("export default {};\n", mapping_object(map))
}

/// .css を「<style> を注入する JS モジュール」のソースへ変換する（dev/build 共通）。
/// 同じ id の style は使い回す（重複注入・HMR再注入を避ける）。
pub fn css_shim(id: &str, css: &str) -> String {
    let css_lit = format!("{css:?}");
    let id_lit = format!("{id:?}");
    format!(
        "const __css = {css_lit};\n\
const __id = {id_lit};\n\
let __el = document.querySelector('style[data-nowaki-css=' + JSON.stringify(__id) + ']');\n\
if (!__el) {{ __el = document.createElement('style'); __el.setAttribute('data-nowaki-css', __id); document.head.appendChild(__el); }}\n\
__el.textContent = __css;\n"
    )
}
