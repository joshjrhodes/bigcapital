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
# Set RPW_SAMPLE_EMAIL to also send the estimate to yourself, which exercises the
# app's queued mail path rather than just the SMTP credentials:
#
#   RPW_SAMPLE_EMAIL=josh@rhodespw.com bash rpw/scripts/make_sample_pdfs.sh
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

if [ -n "${RPW_SAMPLE_EMAIL:-}" ]; then
  # The email test needs real SMTP inside the scratch stack — pass the laptop's
  # mail settings through for this run only. Without RPW_SAMPLE_EMAIL the
  # scratch stack has no mail credentials at all and cannot send anything.
  export RPW_TEST_MAIL_HOST="$(grep '^MAIL_HOST=' .env | cut -d= -f2-)"
  export RPW_TEST_MAIL_PORT="$(grep '^MAIL_PORT=' .env | cut -d= -f2-)"
  export RPW_TEST_MAIL_SECURE="$(grep '^MAIL_SECURE=' .env | cut -d= -f2-)"
  export RPW_TEST_MAIL_USERNAME="$(grep '^MAIL_USERNAME=' .env | cut -d= -f2-)"
  export RPW_TEST_MAIL_PASSWORD="$(grep '^MAIL_PASSWORD=' .env | cut -d= -f2-)"
  export RPW_TEST_MAIL_FROM_NAME="$(grep '^MAIL_FROM_NAME=' .env | cut -d= -f2-)"
  export RPW_TEST_MAIL_FROM_ADDRESS="$(grep '^MAIL_FROM_ADDRESS=' .env | cut -d= -f2-)"
fi

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
  RPW_SAMPLE_EMAIL="${RPW_SAMPLE_EMAIL:-}" \
  python3 "$SCRIPT_DIR/_make_samples.py"

if [ -n "${RPW_SAMPLE_EMAIL:-}" ]; then
  # Mail goes out on a background queue. Tearing the stack down too early kills
  # the worker mid-job, so wait for the send to be logged before cleaning up.
  # Sending runs on a background queue and the worker logs nothing on success,
  # so there is no completion line to wait for. Give it time to actually run
  # before the stack is destroyed, then surface anything that went wrong. The
  # inbox is the real proof.
  log "Giving the mail worker time to send"
  sleep 30
  if docker compose -p "$PROJECT" logs server 2>/dev/null \
      | grep -iE "(error|failed|exception).*(mail|smtp)" | tail -10 | grep .; then
    echo "   ^ the mail job reported errors"
    exit 1
  fi
  echo "   no mail errors logged — check the inbox to confirm delivery"
fi

log "Done — the PDFs are in $OUT_DIR"
