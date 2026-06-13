// サーバーリアクティブ島（Jetstream）。`export const live` を持つ島は、コンポーネント JS を
// クライアントに送らない。状態はサーバー（接続ごと）にあり、イベントで再描画 → HTML パッチを push。
// ボタンに onClick は無い。`data-live="ハンドラ名"` がサーバーのハンドラを指す。

export const live = {
  state: () => ({ count: 0 }),
  on: {
    inc: (s) => ({ ...s, count: s.count + 1 }),
    dec: (s) => ({ ...s, count: s.count - 1 }),
    reset: () => ({ count: 0 }),
  },
};

export default function LiveCounter({ state }) {
  return (
    <div style="display:inline-flex;gap:1rem;align-items:center;border:1px solid #ccc;padding:1rem;border-radius:8px">
      <button data-live="dec">-</button>
      <strong>live: {state.count}</strong>
      <button data-live="inc">+</button>
      <button data-live="reset" style="font-size:.85rem;color:#666">reset</button>
    </div>
  );
}
