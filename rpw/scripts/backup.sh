#!/usr/bin/env bash
#
# RPW Platform — one-command backup.
#
#   rpw/scripts/backup.sh
#
# Produces ONE timestamped archive per run containing:
#   * a SQL dump of the system database and of every organization (tenant) database
#   * a tar of every persistent Docker volume that is not the database or the cache
#     (this is what will pick up uploaded attachments once object storage exists)
#   * a manifest recording what was captured, from which code, and row counts that
#     the restore drill checks against
#
# Everything is configurable through the environment so this same script runs
# unchanged on a VPS or on the NAS later:
#
#   RPW_BACKUP_DIR    where archives are written   (default: $HOME/rpw-backups)
#   RPW_RETAIN_DAILY  daily archives to keep       (default: 30)
#   RPW_RETAIN_MONTHLY monthly archives to keep    (default: 12)
#   RCLONE_REMOTE     rclone remote name           (default: gdrive)
#   RCLONE_PATH       folder inside that remote    (default: RPW-Platform-Backups)
#   RPW_SKIP_RCLONE   set to 1 to skip the offsite sync
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

BACKUP_DIR="${RPW_BACKUP_DIR:-$HOME/rpw-backups}"
RETAIN_DAILY="${RPW_RETAIN_DAILY:-30}"
RETAIN_MONTHLY="${RPW_RETAIN_MONTHLY:-12}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive}"
RCLONE_PATH="${RCLONE_PATH:-RPW-Platform-Backups}"
RCLONE_BIN="${RCLONE_BIN:-$HOME/.local/bin/rclone}"

DAILY_DIR="$BACKUP_DIR/daily"
MONTHLY_DIR="$BACKUP_DIR/monthly"
LOG_FILE="$BACKUP_DIR/backup.log"

mkdir -p "$DAILY_DIR" "$MONTHLY_DIR"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG_FILE"; }
die() { log "ERROR: $*"; exit 1; }

TS="$(date '+%Y%m%d-%H%M%S')"
MONTH="$(date '+%Y%m')"
ARCHIVE="$DAILY_DIR/rpw-backup-$TS.tar.gz"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$REPO_DIR"

log "──────── backup $TS starting ────────"

# ── Preconditions ───────────────────────────────────────────────────────────
command -v docker >/dev/null || die "docker is not on PATH"
docker compose ps --status running --format '{{.Service}}' 2>/dev/null | grep -qx mysql \
  || die "the mysql container is not running — start the stack first (docker compose up -d)"

# `docker compose` reads .env for COMPOSE_FILE; we read it for the database names.
SYSTEM_DB="$(grep -E '^SYSTEM_DB_NAME=' .env | cut -d= -f2- || true)"
TENANT_PREFIX="$(grep -E '^TENANT_DB_NAME_PERFIX=' .env | cut -d= -f2- || true)"
SYSTEM_DB="${SYSTEM_DB:-bigcapital_system}"
TENANT_PREFIX="${TENANT_PREFIX:-bigcapital_tenant_}"

# Run a query as root without ever putting the password in the host's process list.
db_query() {
  docker compose exec -T mysql sh -c \
    "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" --skip-column-names --batch -e \"$1\"" \
    2>/dev/null
}

# ── Which databases? ────────────────────────────────────────────────────────
# Never hardcode a tenant name: each organization gets its own database, named
# after its public id, and more can appear at any time.
mapfile -t DATABASES < <(
  db_query "SHOW DATABASES" \
    | tr -d '\r' \
    | grep -E "^(${SYSTEM_DB}|${TENANT_PREFIX}.*)$" || true
)
[ "${#DATABASES[@]}" -gt 0 ] || die "no RPW databases found — is this pointing at the right stack?"
log "databases to dump: ${DATABASES[*]}"

mkdir -p "$WORK/databases" "$WORK/volumes"

# ── SQL dumps ───────────────────────────────────────────────────────────────
for db in "${DATABASES[@]}"; do
  log "dumping $db"
  docker compose exec -T mysql sh -c \
    "exec mysqldump -uroot -p\"\$MYSQL_ROOT_PASSWORD\" \
       --single-transaction --quick --routines --triggers --events \
       --hex-blob --default-character-set=utf8 \
       '$db'" \
    2>/dev/null | gzip -9 > "$WORK/databases/$db.sql.gz"

  gzip -t "$WORK/databases/$db.sql.gz" || die "$db dump is corrupt"
  size="$(stat -c%s "$WORK/databases/$db.sql.gz")"
  [ "$size" -gt 1000 ] || die "$db dump is suspiciously small ($size bytes)"
  # A dump that never reached the end of the file is a silent disaster later.
  zcat "$WORK/databases/$db.sql.gz" | tail -5 | grep -q 'Dump completed' \
    || die "$db dump is truncated (no completion marker)"
  log "  → $db.sql.gz ($size bytes, complete)"
done

# ── Persistent volumes (attachments, object storage — not the DB, not the cache) ──
PROJECT="$(docker compose config --format json 2>/dev/null | sed -n 's/.*"name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
PROJECT="${PROJECT:-rpw}"
mapfile -t VOLUMES < <(
  docker volume ls --filter "label=com.docker.compose.project=$PROJECT" --format '{{.Name}}' \
    | grep -vE '(mysql|redis)$' || true
)
if [ "${#VOLUMES[@]}" -eq 0 ]; then
  log "no data volumes beyond the database and cache yet (attachments storage arrives in Phase 1)"
else
  for vol in "${VOLUMES[@]}"; do
    log "archiving volume $vol"
    docker run --rm -v "$vol":/data:ro -v "$WORK/volumes":/backup alpine:3.20 \
      tar czf "/backup/$vol.tar.gz" -C /data . \
      || die "could not archive volume $vol"
    log "  → $vol.tar.gz ($(stat -c%s "$WORK/volumes/$vol.tar.gz") bytes)"
  done
fi

# ── Manifest: what a restore should expect to find ──────────────────────────
{
  echo "backup_timestamp: $TS"
  echo "host: $(hostname)"
  echo "repo: $REPO_DIR"
  echo "git_branch: $(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  echo "git_commit: $(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "compose_project: $PROJECT"
  echo "system_database: $SYSTEM_DB"
  echo "tenant_prefix: $TENANT_PREFIX"
  echo "databases:"
  for db in "${DATABASES[@]}"; do
    tables="$(db_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$db'" | tr -d '\r')"
    charset="$(db_query "SELECT default_character_set_name FROM information_schema.schemata WHERE schema_name='$db'" | tr -d '\r')"
    collation="$(db_query "SELECT default_collation_name FROM information_schema.schemata WHERE schema_name='$db'" | tr -d '\r')"
    echo "  - name: $db"
    echo "    tables: ${tables:-unknown}"
    echo "    charset: ${charset:-utf8}"
    echo "    collation: ${collation:-utf8_general_ci}"
  done
  # Row counts the restore drill compares against, so a restore is proven, not assumed.
  echo "row_counts:"
  for db in "${DATABASES[@]}"; do
    case "$db" in
      "$TENANT_PREFIX"*)
        for table in ACCOUNTS ACCOUNTS_TRANSACTIONS SALES_INVOICES CONTACTS ITEMS; do
          count="$(db_query "SELECT COUNT(*) FROM $db.$table" | tr -d '\r' || true)"
          [ -n "${count:-}" ] && echo "  $db.$table: $count"
        done
        ;;
      *)
        for table in USERS TENANTS; do
          count="$(db_query "SELECT COUNT(*) FROM $db.$table" | tr -d '\r' || true)"
          [ -n "${count:-}" ] && echo "  $db.$table: $count"
        done
        ;;
    esac
  done
  echo "volumes:"
  for vol in "${VOLUMES[@]:-}"; do [ -n "$vol" ] && echo "  - $vol"; done
} > "$WORK/manifest.yml"

# ── Pack, verify, place ─────────────────────────────────────────────────────
tar czf "$ARCHIVE" -C "$WORK" .
gzip -t "$ARCHIVE" || die "final archive is corrupt"
tar tzf "$ARCHIVE" >/dev/null || die "final archive is unreadable"
sha256sum "$ARCHIVE" | awk '{print $1}' > "$ARCHIVE.sha256"
log "archive written: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# ── Retention: 30 daily, 12 monthly ─────────────────────────────────────────
# The first backup of each calendar month is hard-linked into monthly/ — it costs
# no extra disk until the daily copy is pruned.
if ! ls "$MONTHLY_DIR"/rpw-backup-"$MONTH"*.tar.gz >/dev/null 2>&1; then
  ln "$ARCHIVE" "$MONTHLY_DIR/$(basename "$ARCHIVE")" 2>/dev/null \
    || cp "$ARCHIVE" "$MONTHLY_DIR/"
  ln "$ARCHIVE.sha256" "$MONTHLY_DIR/$(basename "$ARCHIVE").sha256" 2>/dev/null \
    || cp "$ARCHIVE.sha256" "$MONTHLY_DIR/"
  log "kept as the monthly archive for $MONTH"
fi

prune() {
  local dir="$1" keep="$2" label="$3" removed=0
  while IFS= read -r old; do
    rm -f "$old" "$old.sha256"
    removed=$((removed + 1))
  done < <(ls -1t "$dir"/rpw-backup-*.tar.gz 2>/dev/null | tail -n +"$((keep + 1))")
  [ "$removed" -gt 0 ] && log "pruned $removed old $label archive(s)"
  return 0
}
prune "$DAILY_DIR" "$RETAIN_DAILY" daily
prune "$MONTHLY_DIR" "$RETAIN_MONTHLY" monthly

# ── Offsite copy to Google Drive ────────────────────────────────────────────
if [ "${RPW_SKIP_RCLONE:-0}" = "1" ]; then
  log "offsite sync skipped (RPW_SKIP_RCLONE=1)"
elif [ ! -x "$RCLONE_BIN" ] && ! command -v rclone >/dev/null; then
  log "WARNING: rclone is not installed — backups are LOCAL ONLY"
else
  RCLONE="${RCLONE_BIN}"
  [ -x "$RCLONE" ] || RCLONE="$(command -v rclone)"
  if ! "$RCLONE" listremotes 2>/dev/null | grep -qx "${RCLONE_REMOTE}:"; then
    log "WARNING: rclone remote '${RCLONE_REMOTE}' is not configured — backups are LOCAL ONLY."
    log "         Run: rclone config   (see RESTORE.md)"
  else
    log "syncing to ${RCLONE_REMOTE}:${RCLONE_PATH}"
    # --max-delete guards against a local wipe propagating to the offsite copy.
    if "$RCLONE" sync "$BACKUP_DIR" "${RCLONE_REMOTE}:${RCLONE_PATH}" \
        --exclude 'backup.log' --max-delete 5 --transfers 4 --retries 3 \
        --log-file "$LOG_FILE" --log-level INFO; then
      log "offsite sync complete"
    else
      log "WARNING: offsite sync FAILED — the local archive is still good"
    fi
  fi
fi

log "──────── backup $TS finished ────────"
