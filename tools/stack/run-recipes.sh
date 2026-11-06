#!/bin/bash
# Demo recipes server: a clean environment, its own throwaway database, and the
# demo health server for the one-login check.
W="$(cd "$(dirname "$0")/.." && pwd)"
cd "$W/recipes/server"
exec env -i PATH=/usr/bin:/bin HOME=/tmp \
  DATABASE_URL=postgresql://postgres:demo-local-only@127.0.0.1:5432/recipes_demo \
  RECIPES_API_KEY=demo RECIPES_SERVER_KEY=demo-recipes-server HEALTH_URL=http://127.0.0.1:8080 \
  STORAGE_DIR="$W/stack/storage-recipes" PUBLIC_BASE_URL=http://127.0.0.1:8092 PORT=8092 \
  "$W/stack/venv-recipes/bin/python" server.py
