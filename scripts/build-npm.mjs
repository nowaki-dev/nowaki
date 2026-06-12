#!/usr/bin/env node
// プラットフォーム別 npm パッケージ (@nowaki-dev/cli-<key>) を組み立てる。
//
//   node scripts/build-npm.mjs <key> [--binary <path>] [--no-build]
//
// <key> は darwin-arm64 / darwin-x64 / linux-x64-gnu / linux-arm64-gnu / win32-x64。
// 既定では `cargo build --release -p nowaki --target <triple>` を実行し、出力を
// packages/nowaki-cli/npm/<key>/ に package.json + bin/<binary> として配置する。
// CI の各マトリクスジョブが自身のターゲット分を組み立てて publish する想定。

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// key -> Rust ターゲットトリプル + npm の os/cpu/libc メタ。
// lib/resolve.js の PACKAGES と必ず一致させること。
const TARGETS = {
  "darwin-arm64": { triple: "aarch64-apple-darwin", os: "darwin", cpu: "arm64" },
  "darwin-x64": { triple: "x86_64-apple-darwin", os: "darwin", cpu: "x64" },
  "linux-x64-gnu": {
    triple: "x86_64-unknown-linux-gnu",
    os: "linux",
    cpu: "x64",
    libc: "glibc",
  },
  "linux-arm64-gnu": {
    triple: "aarch64-unknown-linux-gnu",
    os: "linux",
    cpu: "arm64",
    libc: "glibc",
  },
  "win32-x64": {
    triple: "x86_64-pc-windows-msvc",
    os: "win32",
    cpu: "x64",
    exe: true,
  },
};

function workspaceVersion() {
  const cargo = readFileSync(path.join(ROOT, "Cargo.toml"), "utf8");
  const m = cargo.match(/\[workspace\.package\][\s\S]*?version\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("Cargo.toml から workspace バージョンを取得できません");
  return m[1];
}

function parseArgs(argv) {
  const opts = { key: null, binary: null, build: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--binary") opts.binary = argv[++i];
    else if (a === "--no-build") opts.build = false;
    else if (!opts.key) opts.key = a;
  }
  return opts;
}

function main() {
  const { key, binary, build } = parseArgs(process.argv.slice(2));
  if (!key || !TARGETS[key]) {
    console.error(`使い方: build-npm.mjs <key> [--binary <path>] [--no-build]`);
    console.error(`<key>: ${Object.keys(TARGETS).join(" | ")}`);
    process.exit(1);
  }

  const meta = TARGETS[key];
  const version = workspaceVersion();
  const binName = meta.exe ? "nowaki.exe" : "nowaki";

  // 1) バイナリを用意する（--binary 指定が無ければ cargo build）。
  let binPath = binary;
  if (!binPath) {
    if (build) {
      console.log(`[build-npm] cargo build --release --target ${meta.triple}`);
      execFileSync(
        "cargo",
        ["build", "--release", "-p", "nowaki", "--target", meta.triple],
        { cwd: ROOT, stdio: "inherit" },
      );
    }
    binPath = path.join(ROOT, "target", meta.triple, "release", binName);
  }

  // 2) パッケージディレクトリを作る。
  const pkgDir = path.join(ROOT, "packages", "nowaki-cli", "npm", key);
  rmSync(pkgDir, { recursive: true, force: true });
  mkdirSync(path.join(pkgDir, "bin"), { recursive: true });

  // 3) package.json を生成する。
  const pkgJson = {
    name: `@nowaki-dev/cli-${key}`,
    version,
    description: `Prebuilt nowaki CLI binary for ${key}`,
    license: "MIT",
    author: "Voredge <dev@voredge.com>",
    homepage: "https://nowaki.dev",
    repository: {
      type: "git",
      url: "git+https://github.com/nowaki-dev/nowaki.git",
      directory: `packages/nowaki-cli/npm/${key}`,
    },
    os: [meta.os],
    cpu: [meta.cpu],
    ...(meta.libc ? { libc: [meta.libc] } : {}),
    files: ["bin/"],
    engines: { node: ">=22" },
    publishConfig: { access: "public" },
  };
  writeFileSync(
    path.join(pkgDir, "package.json"),
    JSON.stringify(pkgJson, null, 2) + "\n",
  );

  // 4) バイナリを配置する。
  const dest = path.join(pkgDir, "bin", binName);
  copyFileSync(binPath, dest);
  if (!meta.exe) chmodSync(dest, 0o755);

  console.log(`[build-npm] ${pkgJson.name}@${version} → ${path.relative(ROOT, pkgDir)}`);
}

main();
