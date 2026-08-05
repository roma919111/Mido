#!/usr/bin/env bash
# Run ON YOUR MAC (not cloud) to get a public HTTPS link for mobile testing.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! curl -sf http://127.0.0.1:5173/ >/dev/null 2>&1; then
  echo "Start dev server first: npm run dev"
  exit 1
fi

echo "=== Stream Hub — mobile tunnel ==="
echo ""
echo "Option A — Same Wi‑Fi (fastest):"
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
echo "  Phone browser: http://${LAN_IP:-YOUR_LAN_IP}:5173"
echo ""
echo "Option B — Public link (any network):"
echo "  Starting cloudflared..."
npx --yes cloudflared tunnel --url http://127.0.0.1:5173
