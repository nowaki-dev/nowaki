#!/usr/bin/env node
import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const name = process.argv[2] ?? "nowaki-app";
const dest = path.resolve(process.cwd(), name);
const templateDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "template",
);

// 既存の空でないディレクトリへの上書きは防ぐ
try {
  const existing = await readdir(dest);
  if (existing.length > 0) {
    console.error(`✗ ディレクトリ "${name}" は空ではありません。中止します。`);
    process.exit(1);
  }
} catch {
  // 存在しなければOK
}

await mkdir(dest, { recursive: true });
await cp(templateDir, dest, { recursive: true });

console.log(`\n🌀 Nowaki アプリを作成しました: ${name}\n`);
console.log("次のステップ:");
console.log(`  cd ${name}`);
console.log("  pnpm install");
console.log("  nowaki dev\n");
