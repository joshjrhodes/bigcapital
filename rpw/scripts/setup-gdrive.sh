#!/usr/bin/env bash
#
# RPW Platform — connect backups to Google Drive (run once).
#
#   bash rpw/scripts/setup-gdrive.sh
#
# Google has to be authorised by a human, so this is the one backup step that
# cannot be automated. It takes about a minute:
#
#   1. rclone prints a link and waits.
#   2. Open the link in Windows, sign in as josh@rhodesproductionworks.com,
#      and allow access.
#   3. rclone catches the redirect and stores the token in ~/.config/rclone.
#
# Afterwards the nightly cron job syncs on its own with no further prompts.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RCLONE="${RCLONE_BIN:-$HOME/.local/bin/rclone}"
REMOTE="${RCLONE_REMOTE:-gdrive}"
FOLDER="${RCLONE_PATH:-RPW-Platform-Backups}"

[ -x "$RCLONE" ] || RCLONE="$(command -v rclone || true)"
[ -n "$RCLONE" ] && [ -x "$RCLONE" ] || {
  echo "rclone is not installed. Install it with:"
  echo "  curl -fsSL https://rclone.org/install.sh | sudo bash"
  exit 1
}

if "$RCLONE" listremotes 2>/dev/null | grep -qx "${REMOTE}:"; then
  echo "The '${REMOTE}' remote already exists — skipping authorisation."
else
  echo "Authorising Google Drive. A link will appear below; open it in Windows,"
  echo "sign in as josh@rhodesproductionworks.com, and click Allow."
  echo
  # scope=drive.file keeps rclone confined to the files it creates itself — it
  # cannot read the rest of the Drive.
  "$RCLONE" config create "$REMOTE" drive scope=drive.file
fi

echo
echo "Checking the connection..."
"$RCLONE" lsd "${REMOTE}:" >/dev/null || { echo "Could not reach Google Drive."; exit 1; }
"$RCLONE" mkdir "${REMOTE}:${FOLDER}"
echo "Google Drive is connected. Backups will sync into ${FOLDER}/."
echo
echo "Running a backup now so there is something offsite immediately..."
"$SCRIPT_DIR/backup.sh"
echo
echo "What is in Google Drive now:"
"$RCLONE" ls "${REMOTE}:${FOLDER}" | head -20
