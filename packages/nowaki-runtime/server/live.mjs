// サーバーリアクティブ島（Jetstream）のサーバー側ヘルパ。
// 状態は Rust(WS) が接続ごとに保持し、Node はここで「純粋な」再評価だけを行う:
//   handler(state) -> nextState、render(nextState) -> html。
// 返す html は <nowaki-live> ラッパ無しの「中身」だけ（クライアントが morph で当てる）。

import { h } from "preact";
import { renderToStringAsync } from "preact-render-to-string";

import { sign, verify } from "./live-sign.mjs";

// ライブ島のイベント実行 + 再描画。Rust の /__nowaki/live WS から呼ばれる。
//   mod     : 島モジュール（default = コンポーネント, live = { state, on }）
//   state   : 現在の状態（Rust が保持していたもの）
//   handler : 実行するイベントハンドラ名（無ければ状態そのままで再描画）
//   payload : クライアントから渡された任意の値（フォーム値など）
//   name    : 島名（署名検証用）
//   sig     : 現在の state の HMAC 署名（join 時/前回の再評価で発行したもの）
//
// state は SSR で署名され、Rust 経由でここまで持ち回られる。ハンドラ実行の前に
// 必ず検証し、改ざん（state 偽造）された場合は実行しない。新 state には新しい署名を
// 付けて返す（次イベントで検証が続くようにする）。
export async function liveRender(mod, state, handler, payload, name, sig) {
  if (!verify(name, state, sig)) {
    throw new Error("live state signature invalid");
  }
  let next = state;
  const on = mod.live?.on;
  if (handler && on && typeof on[handler] === "function") {
    next = await on[handler](state, payload);
    if (next === undefined) next = state; // ハンドラが返さなければ状態維持
  }
  const html = await renderToStringAsync(h(mod.default, { state: next, __nowakiLiveInner: true }));
  return { state: next, html, sig: sign(name, next) };
}

// ライブ島の初期状態を作る（state() があれば呼ぶ。無ければ空）。
export function liveInitialState(mod, props) {
  const init = mod.live?.state;
  if (typeof init === "function") return init(props ?? {});
  if (init && typeof init === "object") return init;
  return {};
}
