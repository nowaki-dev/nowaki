// @nowaki-dev/runtime のバレル。公開型は index.d.ts。
// 値としては getContext を再エクスポートする（サーバー関数から使う、サーバー専用）。
export { getContext } from "./server/functions.mjs";
