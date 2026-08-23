#!/usr/bin/env bash
# /mnt/E is often NTFS (fuseblk) with noexec — npm binaries cannot run there.
# This script mirrors the project to an ext4 path, installs, and builds.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${ISTEATHAN_LINUX_DIR:-$HOME/work/isteathan}"

mkdir -p "$(dirname "$DEST")"
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  "$SRC/" "$DEST/"

cd "$DEST"
env -u npm_config_devdir npm install
env -u npm_config_devdir npm run check:pwa
env -u npm_config_devdir npm run build

rsync -a "$DEST/dist/" "$SRC/dist/"
cp "$DEST/package-lock.json" "$SRC/package-lock.json"

echo "Build ready. Linux working copy: $DEST"
echo "Artifacts synced to: $SRC/dist"
