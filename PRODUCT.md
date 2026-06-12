# Product

> impeccable 用のブランド戦略ドキュメント（マーケティング/ランディング向け）。
> リポジトリ root の `DESIGN.md` はフレームワークのアーキテクチャ設計書で別物。

## Register

brand

## Users

Web 開発者 ── とくに **Next.js の遅さ（dev 起動・HMR・ビルド・肥大化した JS）に苛立っている人**。Rust 製ツールチェーンや Islands に興味のあるアーリーアダプター、フレームワーク選定中のエンジニア。来訪時の文脈は「速いと聞いた／GitHub やSNS から飛んできた、本当に速くて自分の役に立つのか数十秒で見極めたい」。ジョブは *「試す価値があるか即断し、`npm create nowaki` まで進む」*。

## Product Purpose

Nowaki は Rust ツールチェーン（oxc）と Islands Architecture を核とするフルスタック Web フレームワーク。ランディングの役目は、**「速さ」と「技術的信頼性」を最初の数秒で体感させ**、`npm create nowaki` / `cargo install nowaki` への一歩を踏ませること。成功＝訪問者が「これは本物だ、試そう」と思いコマンドをコピーすること。alpha なので誇張せず、できることとまだの事を正直に示す。

## Brand Personality

**Fast / Sharp / Elemental（速い・鋭い・元素的）**。声色は技術的に正確で、少しだけ詩的。「野分（のわき）＝秋の台風の風」という名前を中心資産として、**速さ＝風の動き**で表現する。誇大広告のSaaSトーンでも、ニヒルなハッカートーンでもなく、**自信のあるエンジニアが事実で語る**温度。

## Anti-references

明確に避けるもの:
- **汎用 SaaS ランディング**（cream/sand の温白背景、hero-metric テンプレ、同型カードグリッド、各セクション上の小さな大文字トラッキング eyebrow）
- **飽和した「ダークなターミナル風 dev ツール」**（黒背景にネオン緑/シアン、等幅一辺倒のクリシェ）── dev ツールの第一反射なので、そこには乗らない
- グラデーションテキスト、装飾的グラスモーフィズム、side-stripe ボーダー
- 「速い！」と**言うだけ**で見せないページ

## Design Principles

1. **Practice what you preach（自分で証明する）** ── サイト自身が Nowaki 製で、爆速・最小 JS でなければ説得力ゼロ。ドッグフーディングが第一原則。
2. **Show the speed, don't claim it（速さは語らず見せる）** ── 数字やモーションで体感させる（送信 JS 量、起動 ms、風の動き）。
3. **Wind as message（風＝メッセージ）** ── 野分の名に恥じない、意図的で機能的なモーション。装飾の風ではなく、速さと方向を表す風。
4. **Technical honesty（技術的誠実さ）** ── alpha を隠さない。できる事・まだの事・ベンチを正直に。
5. **Editorial confidence（出版物の自信）** ── タイポgrafiと余白で語る。カードに逃げない、テンプレに逃げない。

## Accessibility & Inclusion

WCAG 2.1 **AA** 準拠を目標。本文コントラスト ≥4.5:1。モーションが主役のため **`prefers-reduced-motion` 対応は必須**（風アニメは crossfade/即時表示に退避）。キーボード操作・フォーカス可視・色覚多様性に配慮（色だけに意味を載せない）。
