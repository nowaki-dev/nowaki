"use strict";

// 実行中のプラットフォームに対応する @nowaki-dev/cli-<key> パッケージへ、
// バイナリの絶対パスを解決する。プリビルドバイナリは optionalDependencies で
// 配られ、npm/pnpm が os/cpu/libc に一致する1つだけをインストールする。

// key -> npm パッケージ名。scripts/build-npm.mjs の TARGETS と一致させること。
const PACKAGES = {
  "darwin-arm64": "@nowaki-dev/cli-darwin-arm64",
  "darwin-x64": "@nowaki-dev/cli-darwin-x64",
  "linux-x64-gnu": "@nowaki-dev/cli-linux-x64-gnu",
  "linux-arm64-gnu": "@nowaki-dev/cli-linux-arm64-gnu",
  "win32-x64": "@nowaki-dev/cli-win32-x64",
};

// glibc か musl か（linux のみ）。Node の process.report から判定する。
function detectLibc() {
  try {
    const report = typeof process.report.getReport === "function" ? process.report.getReport() : null;
    const runtime = report && report.header && report.header.glibcVersionRuntime;
    return runtime ? "gnu" : "musl";
  } catch {
    return "gnu";
  }
}

// process.platform / process.arch (+ linux は libc) から解決キーを作る。
function platformKey() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === "linux") {
    return `linux-${arch}-${detectLibc()}`;
  }
  return `${platform}-${arch}`;
}

// 対応バイナリの絶対パスを返す。見つからない場合は分かりやすいエラーを投げる。
function resolveBinary() {
  const key = platformKey();
  const pkg = PACKAGES[key];
  const binName = process.platform === "win32" ? "nowaki.exe" : "nowaki";

  if (!pkg) {
    const supported = Object.keys(PACKAGES).join(", ");
    throw new Error(
      `Nowaki: このプラットフォーム (${key}) 向けのプリビルドバイナリはありません。\n` +
        `対応: ${supported}\n` +
        `回避策: \`cargo install nowaki\` でソースからビルドするか、` +
        `https://github.com/nowaki-dev/nowaki/issues で対応をリクエストしてください。`,
    );
  }

  try {
    // 各プラットフォームパッケージは exports を持たない素のファイル袋なので、
    // bin/<name> をサブパス解決できる（esbuild と同方式）。
    return require.resolve(`${pkg}/bin/${binName}`);
  } catch {
    throw new Error(
      `Nowaki: バイナリパッケージ ${pkg} が見つかりません。\n` +
        `optionalDependencies のインストールに失敗した可能性があります。\n` +
        `\`npm install nowaki --force\`（または pnpm/yarn の再インストール）をお試しください。`,
    );
  }
}

module.exports = { resolveBinary, platformKey, PACKAGES };
