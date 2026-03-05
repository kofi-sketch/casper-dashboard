#!/bin/bash
# cron-report.sh — Report cron job status to dashboard API
# Usage:
#   cron-report.sh start "<cron-name>"
#   cron-report.sh complete "<cron-name>"
#   cron-report.sh fail "<cron-name>" "<error>"

set -euo pipefail

API="https://casperops.vercel.app/api/update"

action="${1:-}"
name="${2:-unknown-cron}"
error="${3:-}"

case "$action" in
  start)
    curl -s -X POST "$API" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"task\",\"task\":\"cron: $name\",\"status\":\"start\",\"agent\":\"cron\"}" >/dev/null 2>&1
    ;;
  complete)
    curl -s -X POST "$API" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"task\",\"task\":\"cron: $name\",\"status\":\"complete\",\"agent\":\"cron\"}" >/dev/null 2>&1
    ;;
  fail)
    curl -s -X POST "$API" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"task\",\"task\":\"cron: $name\",\"status\":\"fail\",\"agent\":\"cron\",\"error\":\"$error\"}" >/dev/null 2>&1
    ;;
  *)
    echo "Usage: cron-report.sh start|complete|fail <name> [error]"
    exit 1
    ;;
esac
