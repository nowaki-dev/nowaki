// Nowaki の設定。`plugins` は変換フック（transform）と仮想モジュール（resolveId/load）を持てる。
//   transform(code, id)        — 変換可能なソースが oxc にかかる前に呼ばれる
//   resolveId(source, importer) — 指定子を引き受けて id を返す（通常解決が失敗したときだけ呼ばれる）
//   load(id)                    — その id のソースを返す（ディスクに無い仮想モジュール）
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
    {
      // 仮想モジュール: ディスクに無い `virtual:build-info` を生成して提供する。
      name: "virtual-build-info",
      resolveId(source) {
        return source === "virtual:build-info" ? source : null;
      },
      load(id) {
        if (id !== "virtual:build-info") return null;
        return `export const builtBy = "nowaki-plugin";\nexport const marker = "VIRTUAL_OK";\n`;
      },
    },
  ],
};
