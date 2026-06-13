// `nowaki start` のエントリ。cwd=アプリルートで起動され、dist/ を本番配信する。
// 実体は app.mjs の startServer。アダプタが出力する dist/server/index.mjs と同じ中核を共有する。
// ローカルの `nowaki start` は 127.0.0.1 に固定（配備用エントリだけ 0.0.0.0）。

import path from "node:path";
import { startServer } from "./app.mjs";

const appRoot = process.cwd();
await startServer({
  clientDir: path.join(appRoot, "dist/client"),
  serverDir: path.join(appRoot, "dist/server"),
  port: Number(process.env.PORT ?? 3000),
  host: process.env.NOWAKI_HOST ?? "127.0.0.1",
});
