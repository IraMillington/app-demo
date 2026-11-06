#!/usr/bin/env bash
# Replaces the published site at the top of a checkout of this repo with a new
# build and commits it, keeping the tooling, workflows and README.
# Usage: publish.sh <built site> <repo checkout> <health-app sha> <claro-spanish sha> <recipes-app sha>
set -euo pipefail
SITE=$(cd "$1" && pwd)
cd "$2"
find . -mindepth 1 -maxdepth 1 ! -name .git ! -name .github ! -name tools ! -name README.md -exec rm -rf {} +
cp -R "$SITE"/. .
touch .nojekyll
jq -n --arg h "$3" --arg c "$4" --arg r "$5" --arg d "$(TZ=America/Chicago date +%F)" \
  '{health: $h, claro: $c, recipes: $r, demo_date: $d}' > build.json
git add -A -- . ':!tools'
git diff --cached --quiet && { echo "nothing changed"; exit 0; }
git -c user.name="demo rebuild" -c user.email="actions@users.noreply.github.com" \
  commit -qm "Rebuild from health-app ${3:0:7}, claro-spanish ${4:0:7} and recipes-app ${5:0:7}"
