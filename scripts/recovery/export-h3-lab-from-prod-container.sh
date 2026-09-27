#!/usr/bin/env bash
# Export H3 / AI Rental Studio SERVER code from the live Railway container (r393 Docker).
# Run on your machine after: railway login  (project tokens cannot use SSH).
#
#   cd Mido
#   bash scripts/recovery/export-h3-lab-from-prod-container.sh
#
# Optional env:
#   RAILWAY_PROJECT=8d4709b1-0945-4ba4-9d95-4bfae912e404
#   RAILWAY_SERVICE=2cbb1f32-9679-44b0-9c30-270079f1137f
#   RAILWAY_ENV=production
#   OUT=h3-lab-server-export.tgz

set -euo pipefail

PROJECT="${RAILWAY_PROJECT:-8d4709b1-0945-4ba4-9d95-4bfae912e404}"
SERVICE="${RAILWAY_SERVICE:-2cbb1f32-9679-44b0-9c30-270079f1137f}"
ENVIRONMENT="${RAILWAY_ENV:-production}"
OUT="${OUT:-h3-lab-server-export.tgz}"

SSH=(railway ssh -p "$PROJECT" -s "$SERVICE" -e "$ENVIRONMENT" --)

echo "==> Probing app root inside container…"
APP_ROOT="$("${SSH[@]}" 'if [ -d /app/src/app/api/h3-lab ]; then echo /app; elif [ -d /workspace/src/app/api/h3-lab ]; then echo /workspace; else find / -maxdepth 4 -type d -path "*/src/app/api/h3-lab" 2>/dev/null | head -1 | sed "s#/src/app/api/h3-lab##"; fi')"
if [ -z "$APP_ROOT" ]; then
  echo "Could not locate src/app/api/h3-lab in the running container." >&2
  exit 1
fi
echo "    APP_ROOT=$APP_ROOT"

echo "==> Listing h3-lab routes…"
"${SSH[@]}" "find '$APP_ROOT/src/app/api/h3-lab' -name route.ts 2>/dev/null | sort || true"

echo "==> Listing h3 server libs…"
"${SSH[@]}" "find '$APP_ROOT/src/lib' -maxdepth 1 -name 'h3-*' 2>/dev/null | sort || true"

echo "==> Creating tarball on container…"
REMOTE="/tmp/h3-lab-export-$$.tgz"
"${SSH[@]}" "cd '$APP_ROOT' && tar czf '$REMOTE' \
  src/app/api/h3-lab \
  \$(find src/lib -maxdepth 1 -name 'h3-*' 2>/dev/null) \
  2>/dev/null || tar czf '$REMOTE' src/app/api/h3-lab"

echo "==> Downloading $OUT (base64 stream)…"
"${SSH[@]}" "base64 -w0 '$REMOTE' 2>/dev/null || base64 '$REMOTE'" | base64 -d >"$OUT"
"${SSH[@]}" "rm -f '$REMOTE'"

echo "==> Saved $(wc -c <"$OUT") bytes -> $OUT"
echo "Import into repo: bash scripts/recovery/import-h3-lab-tarball.sh $OUT"
