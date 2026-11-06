#!/usr/bin/env bash
# Rebuilds the PickleCourts snapshot by hand: its web build in
# picklecourts/dist-web, the recorded tour in pc-recordings.json and the tool
# transcript in pc-mcp.json, all committed. CI cannot do this, because the
# workflow's token cannot read the PickleCourts repo (another owner).
# Usage: ci/pc-snapshot.sh <okc-courts-app checkout>   (needs Postgres on
# 127.0.0.1 with user postgres, PGPASSWORD defaulting to demo-local-only)
set -euo pipefail
SRC=$(cd "$1" && pwd)
D="$(cd "$(dirname "$0")/.." && pwd)"
cd "$D"
export DEMO_DATE=${DEMO_DATE:-$(TZ=America/Chicago date +%F)}

# Source, minus the git history. Only dist-web is committed (see .gitignore).
rm -rf picklecourts && mkdir picklecourts
git -C "$SRC" archive HEAD | tar -x -C picklecourts
# The page serves the app from /app-demo/picklecourts/ (GitHub Pages), so its
# files are exported for that path; app-path.js shows the app /app/ instead.
sed -i 's#"baseUrl": "/app"#"baseUrl": "/app-demo/picklecourts"#' picklecourts/app.json
sed -i 's#"/app/fonts/#"/app-demo/picklecourts/fonts/#g' picklecourts/public/index.html
(cd picklecourts && npm ci --no-audit --no-fund > /dev/null)
(cd picklecourts/backend && npm ci --no-audit --no-fund > /dev/null)
# A host that cannot resolve: a call the replay misses never reaches the live service.
(cd picklecourts && EXPO_PUBLIC_API_URL=https://picklecourts-demo.invalid CI=1 \
  npx expo export --platform web --clear --output-dir dist-web > /dev/null)

pkill -f "node src/index.js" || true
ci/pc-up.sh
mkdir -p pc-serve/app-demo && ln -sfn ../../picklecourts/dist-web pc-serve/app-demo/picklecourts
(nohup python3 -m http.server 8415 --bind 127.0.0.1 --directory pc-serve > /dev/null 2>&1 &)
sleep 1
node pc-tour.js | tee pc-tour.log
if grep -q "STEP FAILED" pc-tour.log; then echo "tour steps failed" >&2; exit 1; fi
python3 ci/check_recordings.py pc-recordings.json 20
python3 ci/check_recordings.py pc-mcp.json
echo "snapshot ready: commit picklecourts/dist-web, pc-recordings.json and pc-mcp.json"
