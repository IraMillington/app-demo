#!/bin/bash
# Demo health server: a clean environment, so no real keys or databases are reachable.
W="$(cd "$(dirname "$0")/.." && pwd)"
cd "$W/health/server"
exec env -i PATH=/usr/bin:/bin HOME=/tmp \
  POSTGREST_URL=http://127.0.0.1:3011 STORAGE_DIR="$W/stack/storage" PORT=8080 \
  TIMEZONE=America/Chicago PUBLIC_BASE_URL=http://127.0.0.1:8080 FDC_API_KEY="$FDC_API_KEY" \
  HTTPS_PROXY="$HTTPS_PROXY" https_proxy="$HTTPS_PROXY" NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost REQUESTS_CA_BUNDLE="$REQUESTS_CA_BUNDLE" SSL_CERT_FILE="$SSL_CERT_FILE" \
  "$W/stack/venv/bin/python" "$W/stack/demo_server.py"
