#!/usr/bin/env bash
# Merge an export from export-h3-lab-from-prod-container.sh into this repo (rental scope only).
#
#   bash scripts/recovery/import-h3-lab-tarball.sh h3-lab-server-export.tgz

set -euo pipefail

TAR="${1:?usage: import-h3-lab-tarball.sh <export.tgz>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

tar xzf "$TAR" -C "$TMP"

if [ ! -d "$TMP/src/app/api/h3-lab" ]; then
  echo "Archive missing src/app/api/h3-lab" >&2
  exit 1
fi

while IFS= read -r entry; do
  [ -z "$entry" ] && continue
  case "$entry" in
    src/app/api/h3-lab/* | src/lib/h3-*) continue ;;
    src/app/api/h3-lab | src/lib ) continue ;;
    *)
      echo "Unexpected path in tarball: $entry" >&2
      exit 1
      ;;
  esac
done < <(tar tzf "$TAR")

mkdir -p "$ROOT/src/app/api" "$ROOT/src/lib"
cp -a "$TMP/src/app/api/h3-lab" "$ROOT/src/app/api/"
if compgen -G "$TMP/src/lib/h3-*" >/dev/null; then
  cp -a "$TMP"/src/lib/h3-* "$ROOT/src/lib/"
fi

echo "Imported into $ROOT:"
find "$ROOT/src/app/api/h3-lab" -name route.ts | sort
find "$ROOT/src/lib" -maxdepth 1 -name 'h3-*' | sort
echo "Next: npm run build  (branch cursor/rental-studio-only-7781 only — do not deploy main)"
