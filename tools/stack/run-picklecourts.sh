#!/bin/bash
# The real PickleCourts API on a throwaway database, payments mocked, every
# outside integration (email, SMS, queues, partner systems, AI) left unset.
W="$(cd "$(dirname "$0")/.." && pwd)"
cd "$W/picklecourts/backend"
exec env -i PATH=/usr/bin:/bin:/usr/local/bin HOME=/tmp NODE_ENV=development \
  DATABASE_URL=postgres://postgres:demo-local-only@127.0.0.1:5432/pc_demo \
  PORT=3001 JWT_SECRET=demo-local-only-not-a-secret-0123456789abcdef \
  STRIPE_MOCK_MODE=true API_BASE_URL=http://127.0.0.1:3001 \
  MCP_ENABLED=true AGENT_PUBLIC_BASE_URL=http://127.0.0.1:3001 \
  CORS_ALLOWED_ORIGINS=http://localhost:8415,http://127.0.0.1:8415 \
  node src/index.js
