#!/usr/bin/env node
"use strict";

// プリビルドされた Rust 製 nowaki バイナリへ、引数と標準入出力をそのまま委譲する。
// postinstall は使わず、実行時にプラットフォーム対応パッケージを解決して exec する。

const { spawnSync } = require("node:child_process");
const { resolveBinary } = require("../lib/resolve.js");

let binary;
try {
  binary = resolveBinary();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const result = spawnSync(binary, process.argv.slice(2), { stdio: "inherit" });

if (result.error) {
  console.error(`[nowaki] バイナリの起動に失敗しました: ${result.error.message}`);
  process.exit(1);
}

// シグナルで終了した場合は 128 + シグナル番号、それ以外は終了コードをそのまま返す。
if (result.signal) {
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
