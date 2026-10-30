#!/usr/bin/env bash
# Builds the phone demo site from the current app sources, end to end:
# web exports of both apps, a fresh recording of the Health tour against the
# real server on a throwaway database of invented people, Claro's demo learner,
# and the assembled site in tools/site.
#
# Expects (the GitHub workflow sets these up):
#   tools/health, tools/claro           checkouts of health-app and claro-spanish
#   Postgres on 127.0.0.1:5432, superuser postgres / $PGPASSWORD, empty
#   node 22, python 3.12. FDC_API_KEY (USDA) is optional: the foods the seed
#   uses are loaded from stack/food_cache_rows.json, public USDA data.
set -euo pipefail
D="$(cd "$(dirname "$0")/.." && pwd)"
cd "$D"
export PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=${PGPASSWORD:-demo-local-only}
# The demo is set on the day it is built, in the server's time zone.
DEMO_DATE=$(TZ=America/Chicago date +%F)
export DEMO_DATE
echo "demo date $DEMO_DATE"

WEB_DEPS="react-dom@19.1.0 react-native-web@0.21.4 @expo/metro-runtime@6.1.2"

echo "::group::Web exports"
(cd health && npm ci --no-audit --no-fund && npm i --no-save --no-audit --no-fund $WEB_DEPS)
cp health-web/metro.config.js health/
mkdir -p health/demo-stubs health/public/demo-photos
cp health-web/demo-stubs/*.js health/demo-stubs/
cp demo-photos/*.jpg health/public/demo-photos/
(cd health && EXPO_PUBLIC_API_KEY=demo CI=1 npx expo export --platform web --clear --output-dir dist-web)
(cd claro && npm ci --no-audit --no-fund && npm i --no-save --no-audit --no-fund $WEB_DEPS)
(cd claro && CI=1 npx expo export --platform web --clear --output-dir dist-web)
echo "::endgroup::"

echo "::group::Claro demo learner"
cp claro-web/*.ts claro/
EPOCH=$(node -e "console.log(new Date('${DEMO_DATE}T09:00:00-05:00').getTime())")
(cd claro && npx tsx demo-seed.ts "$EPOCH" > ../claro-seed.json && npx tsx check-seed.ts)
echo "::endgroup::"

echo "::group::Throwaway database"
psql -qc "CREATE DATABASE health_demo"
(cd health/server && PSQL="psql -d health_demo" scripts/local_db/init.sh)
psql -d health_demo -qc "ALTER ROLE authenticator PASSWORD 'demo-local-only'"
# Migration 001 seeds the household's real profiles; the demo must start empty.
psql -d health_demo -qc "DELETE FROM profiles"
psql -d health_demo -qc "INSERT INTO food_cache (cache_key, data, fetched_at)
  SELECT r->>'cache_key', r->'data', now() FROM json_array_elements(\$\$$(cat stack/food_cache_rows.json)\$\$::json) r"
mkdir -p stack/bin stack/storage
curl -fsSL https://github.com/PostgREST/postgrest/releases/download/v12.2.12/postgrest-v12.2.12-linux-static-x86-64.tar.xz | tar -xJ -C stack/bin
(cd stack && nohup ./bin/postgrest pgrst.conf > pgrst.log 2>&1 &)
python3 -m venv stack/venv
stack/venv/bin/pip install -q -r health/server/requirements.txt
echo "::endgroup::"

echo "::group::Record the Health tour"
(nohup stack/run-server.sh > stack/server.log 2>&1 &)
for _ in $(seq 60); do [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/api/profiles)" != 000 ] && break; sleep 1; done
sleep 3
(cd stack && venv/bin/python seed.py "$DEMO_DATE" && venv/bin/python seed_training.py "$DEMO_DATE")
TOKEN=$(curl -fs -X POST http://127.0.0.1:8080/api/accounts/login -H 'Content-Type: application/json' \
  -d '{"username":"sam","password":"demo-pass-123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
START=$(python3 -c "import datetime;print(datetime.date.fromisoformat('$DEMO_DATE')-datetime.timedelta(days=21))")
curl -fs -X PUT http://127.0.0.1:8080/api/tracking-start -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "{\"date\":\"$START\"}" > /dev/null
(cd health/dist-web && nohup python3 -m http.server 8412 --bind 127.0.0.1 > /dev/null 2>&1 &)
rm -f recordings.json
node tour.js | tee tour.log
if grep -q "STEP FAILED" tour.log; then echo "tour steps failed" >&2; exit 1; fi
python3 ci/check_recordings.py recordings.json
echo "::endgroup::"

echo "::group::Assemble and check the site"
node build-site.js index.html site
(nohup python3 -m http.server 8420 --bind 127.0.0.1 > /dev/null 2>&1 &)
sleep 1
node site-test.js | tee site-test.log
grep -q "^leaks \[\] errs \[\]" site-test.log || { echo "site check failed" >&2; exit 1; }
echo "::endgroup::"
