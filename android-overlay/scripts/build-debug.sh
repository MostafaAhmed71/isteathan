#!/usr/bin/env bash
# Build debug APK for classroom overlay experiment.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

if [[ ! -f local.properties ]]; then
  echo "Run: bash scripts/sync-supabase-config.sh"
  exit 1
fi

if [[ ! -f ./gradlew ]]; then
  echo "Gradle wrapper missing. Open this folder in Android Studio once to generate gradlew,"
  echo "or install Gradle and run: gradle wrapper --gradle-version 8.9"
  exit 1
fi

./gradlew assembleDebug
APK="$DIR/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "APK ready:"
echo "  $APK"
echo "Install:"
echo "  adb install -r \"$APK\""
