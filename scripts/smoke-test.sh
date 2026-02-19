#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost}}"

echo "Smoke test target: ${BASE_URL}"

health_code="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}/api/health")"
feed_code="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}/api/feed/latest")"

echo "health status: ${health_code}"
echo "feed status: ${feed_code}"

if [[ "${health_code}" != "200" ]]; then
  echo "FAIL: /api/health is not 200"
  exit 1
fi

if [[ "${feed_code}" != "200" && "${feed_code}" != "404" ]]; then
  echo "FAIL: /api/feed/latest expected 200 or 404"
  exit 1
fi

echo "PASS: smoke test completed"
