#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! curl -sf "http://localhost:11434/api/tags" >/dev/null; then
  echo "ERROR: Ollama is not running."
  echo "Start it with: ollama serve"
  exit 1
fi

echo "Starting Lokumu demo services..."

cleanup() {
  echo ""
  echo "Stopping Lokumu demo services..."
  if [[ -n "${API_PID:-}" ]]; then
    kill "${API_PID}" 2>/dev/null || true
  fi
  if [[ -n "${WEB_PID:-}" ]]; then
    kill "${WEB_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

(cd "${ROOT_DIR}/lokumu-api" && npm run start:dev) &
API_PID=$!

(cd "${ROOT_DIR}/lokumu-web" && npm run dev) &
WEB_PID=$!

echo "API running on http://localhost:7001 (pid: ${API_PID})"
echo "Web running on http://localhost:7000/chat (pid: ${WEB_PID})"

wait
