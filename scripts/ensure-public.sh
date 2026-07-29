#!/usr/bin/env bash
# Keep Next.js (:3000) + named Cloudflare tunnel healthy for vyronix.app
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ensure_next() {
  if curl -sf --max-time 3 http://127.0.0.1:3000/ >/dev/null 2>&1; then
    return 0
  fi
  echo "[ensure] starting Next.js…"
  pkill -f 'next-server' 2>/dev/null || true
  pkill -f 'next start' 2>/dev/null || true
  sleep 1
  nohup npm run start -- --hostname 0.0.0.0 --port 3000 >/tmp/next-prod.log 2>&1 &
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf --max-time 3 http://127.0.0.1:3000/ >/dev/null 2>&1; then
      echo "[ensure] Next.js ready"
      return 0
    fi
    sleep 1
  done
  echo "[ensure] Next.js failed to become ready" >&2
  return 1
}

ensure_tunnel() {
  if pgrep -f 'cloudflared.*tunnel.*run' >/dev/null 2>&1; then
    # If public is already 200, leave it
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 https://vyronix.app/ || echo 000)
    if [[ "$code" == "200" ]]; then
      return 0
    fi
  fi
  echo "[ensure] (re)starting named tunnel…"
  pkill -f 'cloudflared.*tunnel' 2>/dev/null || true
  sleep 1
  nohup bash "$ROOT/scripts/run-named-tunnel.sh" >/tmp/cf-named.log 2>&1 &
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 https://vyronix.app/ || echo 000)
    if [[ "$code" == "200" ]]; then
      echo "[ensure] public vyronix.app ready"
      return 0
    fi
    sleep 2
  done
  echo "[ensure] public URL not ready yet (code=$code)" >&2
  return 1
}

ensure_next
ensure_tunnel
echo "[ensure] ok"
