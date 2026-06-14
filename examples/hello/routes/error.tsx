// error 境界。クライアント遷移が失敗したときに出るフォールバックUI。
// メッセージは data-nowaki-error のスロットへ、再試行は data-nowaki-reset のボタンへ
// クライアントルーターが配線する（このコンポーネント自体は島ではない）。
export default function ErrorBoundary() {
  return (
    <main style="font-family:system-ui,sans-serif;max-width:640px;margin:4rem auto;padding:0 1.25rem">
      <h1 data-testid="error" style="font-size:1.25rem;margin:0 0 .5rem">
        ページを表示できませんでした
      </h1>
      <p data-nowaki-error style="color:#56616f;margin:0 0 1.25rem" />
      <button
        data-nowaki-reset
        type="button"
        style="font:inherit;cursor:pointer;border:1px solid #d7dbe0;background:#fff;border-radius:8px;padding:.5rem .9rem"
      >
        再試行
      </button>
    </main>
  );
}
