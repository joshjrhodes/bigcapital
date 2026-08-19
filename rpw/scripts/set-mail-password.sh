#!/usr/bin/env bash
#
# Put the Zoho app-specific password into .env without it landing in shell
# history or on screen, then restart the app and offer to send a test message.
#
#   bash rpw/scripts/set-mail-password.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_DIR/.env"

cd "$REPO_DIR"
[ -f "$ENV_FILE" ] || { echo "No .env at $ENV_FILE"; exit 1; }

echo "Paste the Zoho app-specific password (it will not be shown), then press Enter."
echo "Generate one at: https://accounts.zoho.com  →  Security  →  App Passwords"
echo
printf 'Password: '
read -rs password
echo
[ -n "$password" ] || { echo "Nothing entered — leaving .env alone."; exit 1; }

# Write with python rather than sed: an app password can contain characters sed
# would treat as delimiters or backreferences.
python3 - "$ENV_FILE" "$password" <<'PY'
import sys
path, password = sys.argv[1], sys.argv[2]
lines = open(path).read().splitlines()
found = False
for i, line in enumerate(lines):
    if line.startswith("MAIL_PASSWORD="):
        lines[i] = f"MAIL_PASSWORD={password}"
        found = True
if not found:
    lines.append(f"MAIL_PASSWORD={password}")
open(path, "w").write("\n".join(lines) + "\n")
PY
chmod 600 "$ENV_FILE"
echo "Saved to .env (owner-readable only)."

echo
echo "Restarting the API so it picks up the new setting..."
docker compose up -d server >/dev/null 2>&1 || true

echo
printf 'Send a test message to yourself now? [Y/n] '
read -r answer
case "${answer:-y}" in
  [Nn]*) echo "Skipped. Test later with: python3 rpw/scripts/test_email.py --send" ;;
  *) python3 "$SCRIPT_DIR/test_email.py" --send ;;
esac
