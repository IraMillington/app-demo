#!/usr/bin/env bash
# Starts the demo servers on throwaway databases: health (Postgres + PostgREST +
# the real health-app server) and recipes (Postgres + the real recipes server).
# Expects health/ and recipes/ checkouts and an empty Postgres on 127.0.0.1:5432.
set -euo pipefail
D="$(cd "$(dirname "$0")/.." && pwd)"
cd "$D"
export PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=${PGPASSWORD:-demo-local-only}

psql -qc "CREATE DATABASE health_demo"
(cd health/server && PSQL="psql -d health_demo" scripts/local_db/init.sh)
psql -d health_demo -qc "ALTER ROLE authenticator PASSWORD 'demo-local-only'"
# Migration 001 seeds the household's real profiles; the demo must start empty.
psql -d health_demo -qc "DELETE FROM profiles"
# The USDA foods the seeds use (public data), so no USDA key is needed. Piped: too long for an argument.
{ printf '%s' "INSERT INTO food_cache (cache_key, data, fetched_at) SELECT r->>'cache_key', r->'data', now() FROM json_array_elements(\$j\$"
  cat stack/food_cache_rows.json; printf '%s\n' "\$j\$::json) r;"; } | psql -q -d health_demo
mkdir -p stack/bin stack/storage stack/storage-recipes
[ -x stack/bin/postgrest ] || curl -fsSL https://github.com/PostgREST/postgrest/releases/download/v12.2.12/postgrest-v12.2.12-linux-static-x86-64.tar.xz | tar -xJ -C stack/bin
(cd stack && nohup ./bin/postgrest pgrst.conf > pgrst.log 2>&1 &)
[ -x stack/venv/bin/python ] || { python3 -m venv stack/venv; stack/venv/bin/pip install -q -r health/server/requirements.txt; }
[ -x stack/venv-recipes/bin/python ] || { python3 -m venv stack/venv-recipes; stack/venv-recipes/bin/pip install -q -r recipes/server/requirements.txt; }
psql -qc "CREATE DATABASE recipes_demo"

(nohup stack/run-server.sh > stack/server.log 2>&1 &)
(nohup stack/run-recipes.sh > stack/recipes.log 2>&1 &)
for port in 8080 8092; do
  for _ in $(seq 60); do [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$port/healthz)" != 000 ] && break; sleep 1; done
done
sleep 2
echo "servers up"
