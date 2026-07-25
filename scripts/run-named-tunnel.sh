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
exec "$CF_BIN" tunnel --no-autoupdate run --token "$(cat "$TOKEN_FILE")"
