#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN_FILE="${1:-$ROOT/.data/cloudflared-tunnel.token}"
CF_BIN="${CF_BIN:-}"
if [[ -z "$CF_BIN" ]]; then
  CF_BIN="$(find "$HOME/.npm/_npx" -path '*/cloudflared/bin/cloudflared' 2>/dev/null | head -1 || true)"
fi
if [[ -z "$CF_BIN" || ! -x "$CF_BIN" ]]; then
  echo "cloudflared binary not found" >&2
  exit 1
fi
if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "Missing tunnel token file: $TOKEN_FILE" >&2
  exit 1
fi

# Auto-restart on QUIC/network drops so Stripe return URLs don't hit Error 1033.
backoff=1
while true; do
  echo "[tunnel] starting named tunnel…"
  set +e
  "$CF_BIN" tunnel --no-autoupdate run --token "$(cat "$TOKEN_FILE")"
  code=$?
  set -e
  echo "[tunnel] exited code=$code — restarting in ${backoff}s"
  sleep "$backoff"
  if (( backoff < 30 )); then
    backoff=$((backoff * 2))
  fi
done
