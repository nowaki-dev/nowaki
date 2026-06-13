// プラグイン変換フックのデモ。nowaki.config.mjs の mark-replace が、ビルド/dev 変換時に
// ソース中の "__PLUGIN_MARK__" を "transformed-by-plugin" へ置換する。
export default function PluginDemo() {
  const mark = "__PLUGIN_MARK__";
  return (
    <main style="max-width:40rem;margin:3rem auto;padding:0 1.25rem;font-family:system-ui">
      <h1>Plugin transform</h1>
      <p>
        A config plugin rewrote a token in this file's source before oxc ran: <strong>{mark}</strong>
      </p>
    </main>
  );
}
