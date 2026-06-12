import { useState } from "preact/hooks";

// クリックでコマンドをクリップボードにコピーする。SSR時はそのままコマンドが読める。
export default function CopyCommand({
  cmd,
  primary = false,
}: {
  cmd: string;
  primary?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard 不可の環境では何もしない */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      class={`copybar${primary ? " copybar--primary" : ""}`}
      aria-label={`コマンドをコピー: ${cmd}`}
    >
      <span class="copybar__prompt" aria-hidden="true">
        $
      </span>
      <code class="copybar__cmd">{cmd}</code>
      <span class="copybar__state" aria-hidden="true">
        {copied ? "copied ✓" : "copy"}
      </span>
    </button>
  );
}
