#!/usr/bin/env python3
"""
Prove the outgoing mail settings actually work.

    python3 rpw/scripts/test_email.py                 # connect + authenticate only
    python3 rpw/scripts/test_email.py --send          # also send a test message to yourself
    python3 rpw/scripts/test_email.py --send --to a@b.com

Reads MAIL_* from .env — the same values the app uses — so a pass here means the
app can send too. Run it after putting the Zoho app password in .env, before
wondering why an invoice email never arrived.

Zoho Mail SMTP: host smtp.zoho.com, port 465 with MAIL_SECURE=true (SSL), or
port 587 with MAIL_SECURE=false (STARTTLS). The password must be a Zoho
app-specific password, not the account password.
"""

import argparse
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = REPO_DIR / ".env"


def load_env():
    values = {}
    if not ENV_FILE.exists():
        sys.exit(f"No .env at {ENV_FILE}")
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip()
    return values


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--send", action="store_true", help="send a real test message")
    parser.add_argument("--to", help="where to send it (defaults to MAIL_FROM_ADDRESS)")
    args = parser.parse_args()

    env = load_env()
    host = env.get("MAIL_HOST") or ""
    port = env.get("MAIL_PORT") or ""
    user = env.get("MAIL_USERNAME") or ""
    password = env.get("MAIL_PASSWORD") or ""
    secure = (env.get("MAIL_SECURE") or "").lower() == "true"
    from_address = env.get("MAIL_FROM_ADDRESS") or user
    from_name = env.get("MAIL_FROM_NAME") or "Rhodes Production Works"

    missing = [
        name
        for name, value in (
            ("MAIL_HOST", host),
            ("MAIL_PORT", port),
            ("MAIL_USERNAME", user),
            ("MAIL_PASSWORD", password),
            ("MAIL_FROM_ADDRESS", from_address),
        )
        if not value
    ]
    if missing:
        print("\033[31mNot configured yet.\033[0m Missing in .env: " + ", ".join(missing))
        print(
            "\nFor Zoho Mail:\n"
            "  MAIL_HOST=smtp.zoho.com\n"
            "  MAIL_PORT=465\n"
            "  MAIL_SECURE=true\n"
            "  MAIL_USERNAME=josh@rhodesproductionworks.com\n"
            "  MAIL_PASSWORD=<Zoho app-specific password>\n"
            "  MAIL_FROM_NAME=Rhodes Production Works\n"
            "  MAIL_FROM_ADDRESS=josh@rhodesproductionworks.com\n"
        )
        sys.exit(1)

    port = int(port)
    print(f"Connecting to {host}:{port} ({'SSL' if secure else 'STARTTLS'}) as {user}")

    context = ssl.create_default_context()
    try:
        if secure:
            server = smtplib.SMTP_SSL(host, port, context=context, timeout=30)
        else:
            server = smtplib.SMTP(host, port, timeout=30)
            server.starttls(context=context)
        with server:
            server.login(user, password)
            print("\033[32mOK\033[0m   authenticated — the app can send mail with these settings")

            if args.send:
                to_address = args.to or from_address
                message = EmailMessage()
                message["Subject"] = "RPW Platform — test message"
                message["From"] = f"{from_name} <{from_address}>"
                message["To"] = to_address
                message.set_content(
                    "This is a test from the RPW Platform.\n\n"
                    "If you are reading this, invoices and estimates can be "
                    "emailed from the app using these SMTP settings.\n"
                )
                server.send_message(message)
                print(f"\033[32mOK\033[0m   test message sent to {to_address}")
                print("     Check the inbox, and check spam — first sends often land there.")
    except smtplib.SMTPAuthenticationError as exc:
        sys.exit(
            f"\033[31mFAIL\033[0m authentication rejected: {exc}\n"
            "     Zoho needs an app-specific password, not the account password."
        )
    except Exception as exc:  # noqa: BLE001 - the message matters more than the type
        sys.exit(f"\033[31mFAIL\033[0m could not send: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    main()
