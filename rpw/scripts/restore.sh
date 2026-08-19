#!/usr/bin/env bash
#
# RPW Platform — restore from a backup archive.
#
#   rpw/scripts/restore.sh --drill                 # newest archive → scratch databases, verified, cleaned up
#   rpw/scripts/restore.sh --drill path/to.tar.gz  # a specific archive
#   rpw/scripts/restore.sh --drill --keep          # leave the scratch databases in place to poke at
#   rpw/scripts/restore.sh --into-live             # overwrite the REAL databases (asks for confirmation)
#
# A drill proves the backup is restorable without touching live data: every
# database is restored under a scratch name and its row counts are compared
# against the manifest that was written when the backup was taken.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${RPW_BACKUP_DIR:-$HOME/rpw-backups}"

MODE="drill"
KEEP=0
ARCHIVE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --drill) MODE="drill" ;;
    --into-live) MODE="live" ;;
    --keep) KEEP=1 ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) ARCHIVE="$1" ;;
  esac
  shift
done

log()  { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die()  { log "ERROR: $*"; exit 1; }
pass() { printf '  \033[32mOK\033[0m   %s\n' "$*"; }
bad()  { printf '  \033[31mBAD\033[0m  %s\n' "$*"; }

cd "$REPO_DIR"

[ -n "$ARCHIVE" ] || ARCHIVE="$(ls -1t "$BACKUP_DIR"/daily/rpw-backup-*.tar.gz 2>/dev/null | head -1 || true)"
[ -n "$ARCHIVE" ] || die "no backup archive found in $BACKUP_DIR/daily"
[ -f "$ARCHIVE" ] || die "no such archive: $ARCHIVE"

docker compose ps --status running --format '{{.Service}}' 2>/dev/null | grep -qx mysql \
  || die "the mysql container is not running — start the stack first (docker compose up -d)"

log "restoring from $ARCHIVE"

# Verify the archive before trusting anything inside it.
if [ -f "$ARCHIVE.sha256" ]; then
  actual="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
  [ "$actual" = "$(cat "$ARCHIVE.sha256")" ] || die "checksum mismatch — this archive is damaged"
  pass "checksum matches"
fi
gzip -t "$ARCHIVE" || die "archive fails its gzip integrity check"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
tar xzf "$ARCHIVE" -C "$WORK"
[ -f "$WORK/manifest.yml" ] || die "archive has no manifest"

log "archive taken at $(grep '^backup_timestamp:' "$WORK/manifest.yml" | cut -d' ' -f2-)"
log "from commit      $(grep '^git_commit:' "$WORK/manifest.yml" | cut -d' ' -f2- | cut -c1-9)"

mysql_root() {  # run SQL as root without exposing the password on the host
  # </dev/null matters: `docker compose exec -T` inherits stdin, and would eat the
  # rest of the manifest when called from inside a read loop.
  docker compose exec -T mysql sh -c "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" --skip-column-names --batch $*" </dev/null 2>/dev/null
}

manifest_field() {  # manifest_field <db> <field>
  awk -v db="  - name: $1" -v field="    $2: " '
    $0 == db {found=1; next}
    found && index($0, field) == 1 {print substr($0, length(field) + 1); exit}
    found && /^  - name: / {exit}
  ' "$WORK/manifest.yml"
}

# ── Live restores are destructive: confirm, take a safety copy, stop the app ──
if [ "$MODE" = "live" ]; then
  echo
  log "This OVERWRITES the live databases with the contents of the archive above."
  log "Everything entered since that backup will be lost."
  if [ "${RPW_ASSUME_YES:-0}" != "1" ]; then
    printf 'Type RESTORE to continue: '
    read -r answer
    [ "$answer" = "RESTORE" ] || die "cancelled"
  fi
  log "taking a safety backup of the current state first"
  RPW_SKIP_RCLONE=1 "$SCRIPT_DIR/backup.sh" >/dev/null \
    || die "the safety backup failed — refusing to overwrite live data"
  pass "safety backup written to $BACKUP_DIR/daily"
  log "stopping the app so nothing writes during the restore"
  docker compose stop server >/dev/null 2>&1 || true
fi

STAMP="$(date '+%Y%m%d%H%M')"
declare -a RESTORED=()
FAILURES=0
CHECKED=0

for dump in "$WORK"/databases/*.sql.gz; do
  [ -e "$dump" ] || die "the archive contains no database dumps"
  db="$(basename "$dump" .sql.gz)"
  charset="$(manifest_field "$db" charset)"; charset="${charset:-utf8}"
  collation="$(manifest_field "$db" collation)"; collation="${collation:-utf8_general_ci}"

  if [ "$MODE" = "live" ]; then
    target="$db"
  else
    # MySQL identifiers cap at 64 characters; keep the tail of the name, which is
    # the part that differs between tenants.
    target="$(printf 'rst_%s_%s' "$STAMP" "$db" | tail -c 64)"
  fi

  log "restoring $db → $target"
  mysql_root "-e \"DROP DATABASE IF EXISTS \\\`$target\\\`\""
  mysql_root "-e \"CREATE DATABASE \\\`$target\\\` CHARACTER SET $charset COLLATE $collation\""
  zcat "$dump" | docker compose exec -T mysql sh -c \
    "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" '$target'" \
    || die "restore of $db failed"
  RESTORED+=("$db:$target")
done

# ── Verify against the row counts recorded at backup time ───────────────────
echo
log "verifying restored data against the manifest"
while IFS= read -r line; do
  case "$line" in
    "  "*.*": "*) ;;
    *) continue ;;
  esac
  key="${line%%:*}"; key="${key#  }"
  expected="${line##*: }"
  src_db="${key%%.*}"
  table="${key##*.}"
  target=""
  for pair in "${RESTORED[@]}"; do
    [ "${pair%%:*}" = "$src_db" ] && target="${pair##*:}"
  done
  [ -n "$target" ] || continue
  actual="$(mysql_root "-e \"SELECT COUNT(*) FROM \\\`$target\\\`.\\\`$table\\\`\"" | tr -d '\r' || true)"
  CHECKED=$((CHECKED + 1))
  if [ "${actual:-missing}" = "$expected" ]; then
    pass "$src_db.$table = $actual rows"
  else
    bad "$src_db.$table expected $expected, restored ${actual:-nothing}"
    FAILURES=$((FAILURES + 1))
  fi
done < <(sed -n '/^row_counts:/,/^volumes:/p' "$WORK/manifest.yml")

# ── Volumes (attachments and anything else living outside the database) ─────
if compgen -G "$WORK/volumes/*.tar.gz" >/dev/null; then
  for vol_archive in "$WORK"/volumes/*.tar.gz; do
    vol="$(basename "$vol_archive" .tar.gz)"
    if [ "$MODE" = "live" ]; then
      log "restoring volume $vol"
      docker run --rm -v "$vol":/data -v "$WORK/volumes":/backup:ro alpine:3.20 \
        sh -c "rm -rf /data/* /data/..?* /data/.[!.]* 2>/dev/null; tar xzf /backup/$vol.tar.gz -C /data" \
        || die "could not restore volume $vol"
      pass "volume $vol restored"
    else
      pass "volume $vol present in the archive ($(du -h "$vol_archive" | cut -f1)) — not restored during a drill"
    fi
  done
fi

echo
if [ "$MODE" = "drill" ]; then
  if [ "$KEEP" = "1" ]; then
    log "scratch databases kept:"
    for pair in "${RESTORED[@]}"; do echo "    ${pair##*:}"; done
    log "drop them with: docker compose exec mysql mysql -uroot -p -e 'DROP DATABASE <name>'"
  else
    for pair in "${RESTORED[@]}"; do
      mysql_root "-e \"DROP DATABASE IF EXISTS \\\`${pair##*:}\\\`\""
    done
    log "scratch databases dropped — live data was never touched"
  fi
fi

# Silence is not success: if nothing was compared, the restore is unproven.
if [ "$CHECKED" -eq 0 ]; then
  log "RESTORE UNVERIFIED — the manifest carried no row counts to check against"
  exit 1
fi

if [ "$FAILURES" -gt 0 ]; then
  log "RESTORE VERIFICATION FAILED ($FAILURES mismatch(es) out of $CHECKED checks)"
  exit 1
fi

log "restore verified — all $CHECKED tables matched the counts recorded at backup time"
if [ "$MODE" = "live" ]; then
  log "starting the app back up"
  docker compose start server >/dev/null
  log "done. Open the app and check the P&L before trusting it."
fi
