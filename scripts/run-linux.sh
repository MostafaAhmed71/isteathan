#!/usr/bin/env bash
# /mnt/E is NTFS (fuseblk, noexec) — npm binaries cannot run there.
# Sync project to an ext4 path and run the given npm script there.
# On CI/Vercel (or when rsync is missing), run in-place instead.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${ISTEATHAN_LINUX_DIR:-$HOME/work/isteathan}"
SCRIPT="${1:-vite:dev}"
shift || true

run_in_place() {
  cd "$SRC"
  env -u npm_config_devdir npm run "$SCRIPT" -- "$@"
  exit $?
}

# Hosting / CI already has a normal executable filesystem.
if [[ "${VERCEL:-}" == "1" || "${CI:-}" == "true" || -n "${VERCEL_ENV:-}" ]]; then
  run_in_place "$@"
fi

mkdir -p "$(dirname "$DEST")"

# If we are already inside the Linux working copy, just run the script.
if [[ "$SRC" == "$DEST" ]]; then
  run_in_place "$@"
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync not found — running npm run $SCRIPT in-place"
  run_in_place "$@"
fi

# --delete drops stale files left in $DEST from older trees (e.g. renamed pages)
# so tsc does not typecheck orphans that no longer exist in $SRC.
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude apk \
  --exclude android/app/build \
  --exclude android/.gradle \
  --exclude android/capacitor-cordova-android-plugins/build \
  --exclude android/keystore \
  --exclude android/keystore.properties \
  --exclude android/local.properties \
  "$SRC/" "$DEST/"

if [[ -f "$SRC/.env" && "$SRC/.env" != "$DEST/.env" ]]; then
  cp "$SRC/.env" "$DEST/.env"
fi

cd "$DEST"

need_install=0
if [[ ! -x node_modules/.bin/vite ]]; then
  need_install=1
elif [[ package.json -nt node_modules || package-lock.json -nt node_modules ]]; then
  need_install=1
fi

if [[ "$need_install" -eq 1 ]]; then
  echo "Installing dependencies in $DEST ..."
  env -u npm_config_devdir npm install
  if [[ -f node_modules/esbuild/install.js ]]; then
    node node_modules/esbuild/install.js || true
  fi
fi

echo "Running npm run $SCRIPT in $DEST"
env -u npm_config_devdir npm run "$SCRIPT" -- "$@"
STATUS=$?

# Builds happen in $DEST, but the deployable output must land back in the
# workspace so it is the folder actually uploaded to hosting.
if [[ $STATUS -eq 0 && "$SCRIPT" == vite:build && -d "$DEST/dist" ]]; then
  rm -rf "$SRC/dist"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "$DEST/dist/" "$SRC/dist/"
  else
    cp -a "$DEST/dist" "$SRC/dist"
  fi
  echo "Build copied to $SRC/dist"
fi

exit $STATUS
