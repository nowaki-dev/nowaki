// Nowaki アンビエント型。CSS / アセット / 仮想モジュールの import をエディタが理解できるように。
// 編集不要（フレームワークの import 規約を型に伝えるだけ）。

declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
declare module "*.css" {
  const css: string;
  export default css;
}

// アセット import は配信 URL（文字列）になる。
declare module "*.svg" { const url: string; export default url; }
declare module "*.png" { const url: string; export default url; }
declare module "*.jpg" { const url: string; export default url; }
declare module "*.jpeg" { const url: string; export default url; }
declare module "*.gif" { const url: string; export default url; }
declare module "*.webp" { const url: string; export default url; }
declare module "*.avif" { const url: string; export default url; }
declare module "*.ico" { const url: string; export default url; }
declare module "*.woff" { const url: string; export default url; }
declare module "*.woff2" { const url: string; export default url; }
declare module "*.ttf" { const url: string; export default url; }
declare module "*.otf" { const url: string; export default url; }
declare module "*.mp4" { const url: string; export default url; }
declare module "*.webm" { const url: string; export default url; }
declare module "*.mp3" { const url: string; export default url; }
declare module "*.wav" { const url: string; export default url; }
declare module "*.pdf" { const url: string; export default url; }

// プラグインの仮想モジュール（nowaki.config の resolveId/load）。任意の export を許す。
declare module "virtual:*";

// import.meta.env（PUBLIC_* と MODE がビルド時に inline される）。
interface ImportMetaEnv {
  readonly MODE: string;
  readonly [key: `PUBLIC_${string}`]: string | undefined;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
