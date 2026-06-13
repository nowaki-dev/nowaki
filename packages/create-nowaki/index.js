#!/usr/bin/env node
// `npm create nowaki` のスキャフォールダ。依存ゼロ（Node 組み込みのみ）。
// 対話ウィザード（TTY 時）: プロジェクト名・パッケージマネージャ・git・依存インストール。
// 非対話（CI / `-y` / パイプ）では既定値で黙って生成する。
//
// フラグ: -y/--yes（質問を飛ばす）, --install（非対話でも入れる）, --no-install,
//         --no-git, --pm <npm|pnpm|yarn|bun>

import { cp, mkdir, readdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { execFileSync } from "node:child_process";
import process from "node:process";

const { stdin, stdout, env, argv, platform } = process;

// --- 色（NO_COLOR と非 TTY を尊重）---
const useColor = !!stdout.isTTY && !env.NO_COLOR;
const wrap = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : `${s}`);
const cyan = wrap("36");
const dim = wrap("2");
const bold = wrap("1");
const green = wrap("32");
const red = wrap("31");
const yellow = wrap("33");

// --- 引数 ---
const args = argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("-")));
const positionals = args.filter((a) => !a.startsWith("-"));
const pmFlag = (() => {
  const i = args.indexOf("--pm");
  return i >= 0 ? args[i + 1] : null;
})();
const yes = flags.has("-y") || flags.has("--yes");
const noInstall = flags.has("--no-install");
const forceInstall = flags.has("--install");
const noGit = flags.has("--no-git");
const interactive = !!stdin.isTTY && !!stdout.isTTY && !yes;

const templateDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "template");

// --- パッケージマネージャ検出（`npm create` の user-agent から）---
function detectPM() {
  const ua = env.npm_config_user_agent || "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("bun")) return "bun";
  return "npm";
}

// --- バナー ---
console.log();
console.log(`  ${cyan(bold("Nowaki"))} ${dim("野分")}  ${dim("· create a new app")}`);
console.log();

const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;
async function ask(question, def) {
  if (!rl) return def;
  const a = (await rl.question(`  ${question} ${dim(`(${def})`)} `)).trim();
  return a || def;
}
async function confirm(question, def = true) {
  if (!rl) return def;
  const a = (await rl.question(`  ${question} ${dim(def ? "(Y/n)" : "(y/N)")} `)).trim().toLowerCase();
  if (!a) return def;
  return a === "y" || a === "yes";
}

// --- 質問 ---
let name = positionals[0] || (await ask("Project name?", interactive ? "my-app" : "nowaki-app"));
name = name.trim() || "nowaki-app";
// package.json の name は valid な npm 名に正規化（ディレクトリ名は入力のまま）
const pkgName = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[._-]+/, "") || "nowaki-app";
const dest = path.resolve(process.cwd(), name);

// 既存の空でないディレクトリは中止
try {
  const existing = await readdir(dest);
  if (existing.length > 0) {
    console.error(`\n  ${red("✗")} "${name}" already exists and is not empty. Aborting.\n`);
    rl?.close();
    process.exit(1);
  }
} catch {
  // 無ければOK
}

let pm = pmFlag || detectPM();
if (interactive && !pmFlag) pm = (await ask("Package manager?", pm)).trim() || pm;
if (!["npm", "pnpm", "yarn", "bun"].includes(pm)) pm = "npm";
const doGit = noGit ? false : await confirm("Initialize a git repository?", false);
// 依存インストール: 対話なら確認（既定 Yes）。非対話（-y / CI / パイプ）は自動実行しない
//（驚き防止）。非対話で入れたいときは --install。--no-install は常にスキップ。
const doInstall = noInstall
  ? false
  : forceInstall
    ? true
    : interactive
      ? await confirm(`Install dependencies with ${pm}?`, true)
      : false;
rl?.close();

// --- 生成 ---
await mkdir(dest, { recursive: true });
await cp(templateDir, dest, { recursive: true });

// npm は公開時に .gitignore を除外するので、テンプレートでは _gitignore で持ち、ここで戻す。
try {
  await rename(path.join(dest, "_gitignore"), path.join(dest, ".gitignore"));
} catch {
  // _gitignore が無ければ素通し
}

// package.json の name を設定
try {
  const pkgPath = path.join(dest, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  pkg.name = pkgName;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
} catch {
  // package.json が無ければ素通し
}

console.log(`\n  ${green("✓")} created ${bold(name)} ${dim(`(${path.relative(process.cwd(), dest) || "."})`)}`);

// git init（任意）
if (doGit) {
  try {
    execFileSync("git", ["init", "-q"], { cwd: dest, stdio: "ignore" });
    console.log(`  ${green("✓")} initialized a git repository`);
  } catch {
    console.log(`  ${yellow("!")} skipped git init (git not found)`);
  }
}

// 依存インストール（任意）
let installed = false;
if (doInstall) {
  console.log(`\n  ${dim(`installing dependencies with ${pm}…`)}\n`);
  try {
    execFileSync(pm, ["install"], { cwd: dest, stdio: "inherit", shell: platform === "win32" });
    installed = true;
    console.log(`\n  ${green("✓")} dependencies installed`);
  } catch {
    console.log(`\n  ${red("✗")} \`${pm} install\` failed — run it yourself after \`cd ${name}\`.`);
  }
}

// --- 次のステップ ---
const runDev = pm === "npm" || pm === "bun" ? `${pm} run dev` : `${pm} dev`;
console.log(`\n  ${bold("Next steps:")}`);
console.log(`    cd ${name}`);
if (!installed) console.log(`    ${pm} install`);
console.log(`    ${cyan(runDev)}   ${dim("# → http://localhost:3000")}`);
console.log(`\n  ${dim("Docs:")} ${cyan("https://nowaki.dev/docs")}\n`);
