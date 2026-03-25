#!/usr/bin/env bash
# Ek hi command: pehle 8002 khali, phir uvicorn start.
set -e
cd "$(dirname "$0")"
PORT="${PORT:-8002}"

if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "Port $PORT busy — purane process band kar raha hoon..."
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

echo "Starting backend on http://127.0.0.1:$PORT (docs: /docs)"
exec python3 -m uvicorn main:app --reload --host 127.0.0.1 --port "$PORT"
