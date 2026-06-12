#!/usr/bin/env bash
# nowaki.dev ランディングを静的ファイルに事前レンダリングする。
# 出力: site/public/  (Cloudflare Pages 等の静的ホストへそのままデプロイ可能)
#
#   /        -> public/index.html
#   /ja      -> public/ja/index.html
#   /_nowaki -> public/_nowaki/*   (content-hash 付きクライアントアセット)
#
# 前提: `nowaki` が PATH にあること (cargo install nowaki もしくはリポジトリの
#        target/debug/nowaki) と、site で `pnpm install` 済みであること。
set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8799}"
NOWAKI="${NOWAKI:-nowaki}"

cd "$SITE_DIR"

echo "[prerender] build"
"$NOWAKI" build .

echo "[prerender] start (port $PORT)"
"$NOWAKI" start . --port "$PORT" >/tmp/nowaki-prerender.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

# サーバー起動待ち
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then break; fi
  sleep 0.25
done

echo "[prerender] render pages -> public/"
rm -rf public
mkdir -p public/ja public/_nowaki
curl -sf "http://127.0.0.1:$PORT/" -o public/index.html
curl -sf "http://127.0.0.1:$PORT/ja" -o public/ja/index.html
cp -R dist/client/. public/_nowaki/

# Cloudflare Pages: ハッシュ付きアセットは長期 immutable キャッシュ
cat > public/_headers <<'HEADERS'
/_nowaki/*
  Cache-Control: public, max-age=31536000, immutable
HEADERS

echo "[prerender] done -> $SITE_DIR/public"
