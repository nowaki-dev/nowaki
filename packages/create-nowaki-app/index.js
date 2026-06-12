#!/usr/bin/env node
// `npx create-nowaki-app` 向けの極薄エイリアス。
// Next/React ユーザーのマッスルメモリを拾うためだけに存在し、実体は create-nowaki。
// import するだけで create-nowaki の index.js が process.argv を読んで実行される
// （テンプレートも create-nowaki 側のものを使う＝二重メンテにならない）。
// 公開済み create-nowaki@0.1.0 は main 未定義なので、明示パスで取り込み
// "index" 探索の DeprecationWarning を避ける。
import "create-nowaki/index.js";
