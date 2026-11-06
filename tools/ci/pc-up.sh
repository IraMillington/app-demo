#!/usr/bin/env bash
# Starts the PickleCourts API on a fresh throwaway database: its own migrations
# and dev seed, then stack/picklecourts_demo.sql (invented venues only).
# Expects a picklecourts/ checkout with backend dependencies installed.
set -euo pipefail
D="$(cd "$(dirname "$0")/.." && pwd)"
cd "$D"
export PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=${PGPASSWORD:-demo-local-only}
psql -qc "DROP DATABASE IF EXISTS pc_demo WITH (FORCE)"
psql -qc "CREATE DATABASE pc_demo"
export DATABASE_URL=postgres://postgres:$PGPASSWORD@127.0.0.1:5432/pc_demo
(cd picklecourts/backend && npm run -s migrate > /dev/null 2>&1 && npm run -s seed > /dev/null 2>&1)
psql -d pc_demo -v ON_ERROR_STOP=1 -q -f stack/picklecourts_demo.sql
(nohup stack/run-picklecourts.sh > stack/picklecourts.log 2>&1 &)
for _ in $(seq 60); do curl -sf http://127.0.0.1:3001/health > /dev/null && break; sleep 1; done
echo "picklecourts up"
