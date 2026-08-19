#!/usr/bin/env bash
#
# Bring up a throwaway copy of the whole stack, prove it works end to end, and
# destroy it.
#
#   bash rpw/scripts/verify_stack.sh
#
# Why this exists: the smoke test writes dummy customers, invoices and payments.
# Once the real books exist, that is the last thing you want pointed at them.
# This runs the same images against their own database on their own port, so the
# proof costs nothing but a few minutes.
#
# It also proves the migrations still work from an empty database, which is the
# thing most likely to break after an upstream rebase.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT="${RPW_TEST_PROJECT:-rpwtest}"
PORT="${RPW_TEST_PORT:-8081}"

export COMPOSE_FILE=docker-compose.prod.yml:docker-compose.rpw.yml:docker-compose.test.yml
export RPW_TEST_PORT="$PORT"

cd "$REPO_DIR"

log() { printf '\n\033[1m%s\033[0m\n' "$*"; }

cleanup() {
  log "Tearing the scratch stack down"
  docker compose -p "$PROJECT" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "Starting a scratch stack on port $PORT (project: $PROJECT)"
docker compose -p "$PROJECT" up -d

# The API answers before the database is migrated, so waiting on HTTP alone
# races the migration and the first sign-up fails with a 500.
log "Waiting for migrations to finish"
for _ in $(seq 1 120); do
  state="$(docker inspect -f '{{.State.Status}}:{{.State.ExitCode}}' \
    "${PROJECT}-database-migration" 2>/dev/null || echo 'missing:0')"
  case "$state" in
    exited:0) break ;;
    exited:*) echo "migrations failed: $state"; docker logs "${PROJECT}-database-migration" | tail -20; exit 1 ;;
  esac
  sleep 3
done

log "Waiting for the scratch API"
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$PORT/api/auth/meta" >/dev/null 2>&1; then break; fi
  sleep 3
done

log "Running the smoke test against the scratch stack"
RPW_BASE_URL="http://127.0.0.1:$PORT" \
  RPW_ALLOW_REAL_BOOKS=1 \
  python3 "$SCRIPT_DIR/smoke_test.py"

log "Scratch stack verified — tearing it down"
