#!/usr/bin/env bash
# Builds the phone demo site from the current app sources, end to end:
# web exports of the three apps, Claro's demo learner, a fresh recording of the
# tour against the real Health and Recipes servers on throwaway databases of
# invented people, and the assembled site in tools/site.
#
# Expects (the GitHub workflow sets these up):
#   tools/health, tools/claro, tools/recipes   checkouts of health-app, claro-spanish, recipes-app
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
(cd recipes && npm ci --no-audit --no-fund && npm i --no-save --no-audit --no-fund $WEB_DEPS)
(cd recipes && EXPO_PUBLIC_API_KEY=demo EXPO_PUBLIC_API_URL=https://health.tailc51c3c.ts.net/recipes CI=1 \
  npx expo export --platform web --clear --output-dir dist-web)
echo "::endgroup::"

echo "::group::Claro demo learner"
cp claro-web/*.ts claro/
EPOCH=$(node -e "console.log(new Date('${DEMO_DATE}T09:00:00-05:00').getTime())")
(cd claro && npx tsx demo-seed.ts "$EPOCH" > ../claro-seed.json && npx tsx check-seed.ts)
echo "::endgroup::"

echo "::group::Throwaway databases and servers"
ci/stack-up.sh
echo "::endgroup::"

echo "::group::Record the tour"
(cd stack && venv/bin/python seed.py "$DEMO_DATE" && venv/bin/python seed_training.py "$DEMO_DATE" && venv/bin/python seed_recipes.py)
TOKEN=$(curl -fs -X POST http://127.0.0.1:8080/api/accounts/login -H 'Content-Type: application/json' \
  -d '{"username":"sam","password":"demo-pass-123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
START=$(python3 -c "import datetime;print(datetime.date.fromisoformat('$DEMO_DATE')-datetime.timedelta(days=21))")
curl -fs -X PUT http://127.0.0.1:8080/api/tracking-start -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "{\"date\":\"$START\"}" > /dev/null
for app in health:8412 recipes:8413 claro:8414; do
  (cd "${app%%:*}/dist-web" && nohup python3 -m http.server "${app##*:}" --bind 127.0.0.1 > /dev/null 2>&1 &)
done
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
grep -q "^leaks \[\] errs \[\]" site-test.log && grep -q "^cross habit true meal true ticked 4" site-test.log || { echo "site check failed" >&2; exit 1; }
echo "::endgroup::"
