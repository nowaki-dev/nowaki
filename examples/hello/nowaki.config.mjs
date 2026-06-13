// Nowaki の設定。`plugins` は変換フックを持てる。
// transform(code, id) は、変換可能なソース（ts/tsx/js/jsx）が oxc にかかる前に呼ばれる。
// 変更しなければ null/undefined を返す（高速パス）。
export default {
  plugins: [
    {
      name: "mark-replace",
      transform(code, id) {
        if (!code.includes("__PLUGIN_MARK__")) return null;
        return code.replaceAll("__PLUGIN_MARK__", "transformed-by-plugin");
      },
    },
  ],
};
