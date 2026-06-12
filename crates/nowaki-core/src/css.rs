use std::path::Path;

/// サーバー側で .css import を無効化するための空モジュール（CSS はクライアント専用）。
pub const CSS_NOOP_SPECIFIER: &str = "data:text/javascript,";

pub fn is_css(path: &Path) -> bool {
    path.extension().and_then(|e| e.to_str()) == Some("css")
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
