#!/usr/bin/env bash
#
# Produce sample estimate and invoice PDFs to look at, without touching the real
# books.
#
#   bash rpw/scripts/make_sample_pdfs.sh
#
# Spins up the disposable stack, provisions the real chart of accounts, items and
# branded templates into it, creates one realistic estimate and one invoice,
# saves both PDFs to your home directory, then destroys the stack.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT="${RPW_TEST_PROJECT:-rpwtest}"
PORT="${RPW_TEST_PORT:-8081}"
OUT_DIR="${RPW_SAMPLE_DIR:-$HOME}"

export COMPOSE_FILE=docker-compose.prod.yml:docker-compose.rpw.yml:docker-compose.test.yml
export RPW_TEST_PORT="$PORT"

cd "$REPO_DIR"

log() { printf '\n\033[1m%s\033[0m\n' "$*"; }
cleanup() {
  log "Tearing the scratch stack down"
  docker compose -p "$PROJECT" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "Starting a scratch stack on port $PORT"
docker compose -p "$PROJECT" up -d

log "Waiting for migrations"
for _ in $(seq 1 120); do
  state="$(docker inspect -f '{{.State.Status}}:{{.State.ExitCode}}' \
    "${PROJECT}-database-migration" 2>/dev/null || echo 'missing:0')"
  case "$state" in
    exited:0) break ;;
    exited:*) echo "migrations failed: $state"; exit 1 ;;
  esac
  sleep 3
done
for _ in $(seq 1 60); do
  curl -sf "http://127.0.0.1:$PORT/api/auth/meta" >/dev/null 2>&1 && break
  sleep 3
done

log "Provisioning the books into the scratch stack"
RPW_BASE_URL="http://127.0.0.1:$PORT" \
  RPW_ADMIN_EMAIL="samples@rhodesproductionworks.com" \
  RPW_ADMIN_PASSWORD="Samples!2026" \
  RPW_CREDENTIALS_FILE="$(mktemp)" \
  python3 "$SCRIPT_DIR/provision_books.py" >/dev/null

log "Creating the sample documents"
RPW_BASE_URL="http://127.0.0.1:$PORT" \
  RPW_ADMIN_EMAIL="samples@rhodesproductionworks.com" \
  RPW_ADMIN_PASSWORD="Samples!2026" \
  RPW_SAMPLE_DIR="$OUT_DIR" \
  python3 "$SCRIPT_DIR/_make_samples.py"

log "Done — the PDFs are in $OUT_DIR"
