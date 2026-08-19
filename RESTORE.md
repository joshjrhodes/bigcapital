# RESTORE.md — backups and how to get the books back

The laptop is the system of record until Phase 2, and a laptop is one spilled coffee away from
being nothing. This is the safety net: what runs, where it lands, and the exact steps to bring the
books back.

---

## What runs, and when

| | |
| --- | --- |
| Script | `rpw/scripts/backup.sh` |
| Schedule | every night at **02:30**, plus a catch-up run 5 minutes after WSL starts if the last backup is older than 20 hours |
| Local copies | `~/rpw-backups/daily/` (30 kept) and `~/rpw-backups/monthly/` (12 kept) |
| Offsite | Google Drive → `RPW-Platform-Backups/` via rclone |
| Log | `~/rpw-backups/backup.log` (and `cron.log` for scheduled runs) |

Each run produces **one** file, `rpw-backup-YYYYMMDD-HHMMSS.tar.gz`, plus a `.sha256` beside it.
Inside:

- `databases/` — a gzipped SQL dump of the system database **and of every organization database**.
  Organization databases are discovered at runtime (`bigcapital_tenant_%`), never hardcoded, so a
  new organization is picked up automatically.
- `volumes/` — a tar of every persistent Docker volume other than the database and the Redis cache.
  Empty today; it starts carrying uploaded attachments as soon as object storage is added in Phase 1.
- `manifest.yml` — when it was taken, from which git commit, each database's charset, and **row
  counts for key tables**. The restore drill checks against these, so a restore is proven rather
  than assumed.

The script refuses to write a backup it cannot verify: every dump is gzip-tested, checked for the
`Dump completed` marker, and rejected if suspiciously small.

## Run a backup right now

```bash
cd ~/rpw
bash rpw/scripts/backup.sh
```

---

## One-time: connect Google Drive

Google needs a human to click Allow, so this is the one step that cannot be automated:

```bash
cd ~/rpw
bash rpw/scripts/setup-gdrive.sh
```

It prints a link — open it in Windows, sign in as `josh@rhodesproductionworks.com`, click Allow.
The script then creates `RPW-Platform-Backups/` in your Drive and runs a backup straight into it.
Nightly runs sync on their own after that.

Until this is done, **backups are local only** — the nightly log says so in plain words.

---

## Check the backups are actually happening

```bash
ls -lh ~/rpw-backups/daily | tail -5          # newest archives
tail -20 ~/rpw-backups/backup.log             # what the last run did
rclone ls gdrive:RPW-Platform-Backups | tail  # what is offsite
```

---

## Restore drill (safe — never touches live data)

Run this quarterly, and after any move to new hardware:

```bash
cd ~/rpw
bash rpw/scripts/restore.sh --drill
```

It restores the newest archive into **scratch databases**, compares every row count against the
manifest, prints a line per table, and drops the scratch databases afterwards. Green means the
backup is genuinely restorable. To drill a specific archive:

```bash
bash rpw/scripts/restore.sh --drill ~/rpw-backups/monthly/rpw-backup-20260801-023000.tar.gz
```

To leave the scratch databases in place and look around, add `--keep`.

**Last drill: 2026-08-18 — passed, 7 of 7 tables matched.**

---

## Real restore (the day something goes wrong)

This overwrites the live databases. It asks you to type `RESTORE`, takes a safety backup of the
current state first, stops the app while it works, and restarts it at the end.

```bash
cd ~/rpw
docker compose up -d                      # the database container must be running
bash rpw/scripts/restore.sh --into-live    # newest archive
# or a specific one:
bash rpw/scripts/restore.sh --into-live ~/rpw-backups/daily/rpw-backup-20260817-023000.tar.gz
```

Then open http://localhost:8080 and check the P&L against what you expect before trusting it.

### Restoring onto a brand-new machine

1. Install Docker and clone the repo:
   ```bash
   git clone https://github.com/joshjrhodes/bigcapital.git ~/rpw
   cd ~/rpw && git checkout rpw
   ```
2. Put `.env` back (it is **not** in git — keep a copy in a password manager). Without it, the
   database passwords no longer match the dump's users and nothing will start cleanly.
3. Pull a backup down:
   ```bash
   rclone copy gdrive:RPW-Platform-Backups/daily ~/rpw-backups/daily --max-age 48h
   ```
4. Build and start, then restore:
   ```bash
   docker compose build server webapp
   docker compose up -d
   bash rpw/scripts/restore.sh --into-live
   ```

`.env` is the one piece the backup deliberately does not contain — secrets do not belong in a file
that syncs to a cloud drive. Keep a copy somewhere safe.

---

## Retention

- 30 daily archives.
- 12 monthly archives (the first backup of each calendar month, hard-linked so it costs nothing
  until the daily copy ages out).
- Google Drive mirrors that same shape. The sync refuses to delete more than 5 files in one run, so
  a local accident cannot wipe the offsite copy.

## Known limits (worth knowing before you need them)

- Cron only fires while WSL is running. The catch-up entry covers a laptop that was asleep at
  02:30, but a machine left off for days simply has no backups from those days. This goes away in
  Phase 2 when the stack lives on an always-on host.
- The dumps use MariaDB 10.2's `mysqldump` (upstream's pinned image version). Restore into the same
  major version — i.e. this compose stack — not into a newer MariaDB or MySQL.
- Redis is not backed up on purpose: it holds cache and job queues, nothing that cannot be rebuilt.
