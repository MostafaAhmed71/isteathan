#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=/opt/ELITE
GW_DIR="$APP_ROOT/whatsapp-gateway"
ENV_FILE="$APP_ROOT/.env"

apt-get update -y
apt-get install -y nodejs npm ca-certificates fonts-liberation libatk-bridge2.0-0 libgtk-3-0 libasound2t64 libnss3 libxss1 libgbm1

if ! command -v node >/dev/null; then
  echo "Node.js is required" >&2
  exit 1
fi

CHROME=""
for c in /usr/bin/chromium-browser /usr/bin/chromium /usr/bin/google-chrome-stable /usr/bin/google-chrome; do
  if [[ -x "$c" ]]; then CHROME=$c; break; fi
done
if [[ -z "$CHROME" ]]; then
  apt-get install -y chromium-browser || apt-get install -y chromium || true
  for c in /usr/bin/chromium-browser /usr/bin/chromium /snap/bin/chromium; do
    if [[ -x "$c" ]]; then CHROME=$c; break; fi
  done
fi

mkdir -p "$GW_DIR"
cd "$GW_DIR"
npm install --omit=dev

if [[ ! -f "$ENV_FILE" ]]; then
  SECRET=$(openssl rand -hex 32)
  cat > "$ENV_FILE" <<EOF
WHATSAPP_GATEWAY_HOST=127.0.0.1
WHATSAPP_GATEWAY_PORT=3310
WHATSAPP_GATEWAY_SECRET=$SECRET
WHATSAPP_SESSION_NAME=ELITE
WHATSAPP_GATEWAY_BASE_PATH=/elite-wa
PUPPETEER_EXECUTABLE_PATH=${CHROME:-/usr/bin/chromium-browser}
EOF
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE (save WHATSAPP_GATEWAY_SECRET for Supabase)"
else
  echo "Keeping existing $ENV_FILE"
fi

if [[ -n "$CHROME" ]]; then
  grep -q PUPPETEER_EXECUTABLE_PATH "$ENV_FILE" || echo "PUPPETEER_EXECUTABLE_PATH=$CHROME" >> "$ENV_FILE"
  sed -i "s|^PUPPETEER_EXECUTABLE_PATH=.*|PUPPETEER_EXECUTABLE_PATH=$CHROME|" "$ENV_FILE"
fi
grep -q WHATSAPP_GATEWAY_BASE_PATH "$ENV_FILE" || echo "WHATSAPP_GATEWAY_BASE_PATH=/elite-wa" >> "$ENV_FILE"

install -m 644 "$GW_DIR/deploy/elite-whatsapp.service" /etc/systemd/system/elite-whatsapp.service
systemctl daemon-reload
systemctl enable --now elite-whatsapp
systemctl restart elite-whatsapp
systemctl --no-pager --full status elite-whatsapp || true

echo
echo "Gateway: 127.0.0.1:3310"
echo "Point OpenLiteSpeed reverse proxy to http://127.0.0.1:3310"
echo "Put the same secret in Supabase WHATSAPP_GATEWAY_SECRET"
grep WHATSAPP_GATEWAY_SECRET "$ENV_FILE"
