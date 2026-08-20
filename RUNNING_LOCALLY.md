# RUNNING_LOCALLY.md — the commands Josh types

Everything runs in Docker. Open **Ubuntu (WSL)** from the Start menu, then:

```bash
cd ~/rpw
```

Docker Desktop must be running first (its whale icon in the system tray). If it isn't, start it and
give it ~30 seconds.

---

## Start it

```bash
docker compose up -d
```

Then open **http://localhost:8080**

First start after a reboot takes ~30 seconds before the login page answers. Check it's ready with:

```bash
docker compose ps
```

You want six containers `Up`, with `bigcapital-server` showing `(healthy)`.
`bigcapital-database-migration` runs migrations and exits — seeing it gone or `Exited (0)` is
correct, not an error.

## Stop it

```bash
docker compose down
```

Your data lives in Docker volumes, not in the containers, so this is safe — `down` then `up -d`
loses nothing.

## Log in

- **URL:** http://localhost:8080
- **Email:** `josh@rhodespw.com`
- **Password:** in `~/rpw-first-login.txt` — change it after signing in, then delete that file.

These are the real books: RPW's chart of accounts, starter items, and the branded invoice
template. Sign-up is closed, so nobody else can register an account.

---

## When something looks wrong

```bash
docker compose logs -f server        # API errors — the usual first stop
docker compose logs -f webapp        # the React app / nginx
docker compose logs database_migration  # did migrations run?
docker compose restart server        # kick the API
```

Full end-to-end check. It spins up a **throwaway copy** of the whole stack on port 8081, creates a
customer, item, estimate, invoice, payment, bill and expense, renders the branded PDF, pulls every
financial report, exercises the county sales tax module, then destroys it:

```bash
bash rpw/scripts/verify_stack.sh
```

If that prints **All smoke-test steps passed**, everything works — and your real books were never
touched. (The smoke test writes dummy invoices, so it refuses to run against the real
organization.)

---

## After changing code

The containers run **built images**, so code changes need a rebuild:

```bash
docker compose build server webapp     # ~10 min the first time, much less after
docker compose up -d
```

Rebuild only what you changed (`docker compose build server`) to save time.

---

## Rebuild the books from scratch

Destroys **all** data — the databases and everything in them — then rebuilds the chart of accounts,
items and branded templates:

```bash
docker compose down -v
docker compose up -d
sed -i 's/^SIGNUP_DISABLED=true/SIGNUP_DISABLED=false/' .env && docker compose up -d server
python3 rpw/scripts/provision_books.py
sed -i 's/^SIGNUP_DISABLED=false/SIGNUP_DISABLED=true/' .env && docker compose up -d server
```

The provisioning script is idempotent, so re-running it on an existing organization only adds what
is missing.

## Designing the documents

**Sidebar → Document Designer**, or http://localhost:8080/rpw/document-designer

Drag fields around, resize them, change fonts and colours, then **Preview** to see it
with realistic data. **Save** writes a new version — nothing is overwritten, and **Versions**
rolls back to any earlier save.

A design does nothing until you press **Use for documents**. Until then, estimates and
invoices keep using the built-in layout. And if an active design ever fails to render,
documents fall back to the built-in layout automatically — an edit here cannot stop you
invoicing.

Field names are the wiring: `logo`, `bill_to`, `items`, `total` and so on are filled from
the document at generation time. Renaming a field disconnects it from its data.

## Clients (notes and follow-ups)

**Sidebar → Clients**, or http://localhost:8080/rpw/clients

What needs doing is at the top — anything due today, with overdue items staying put rather
than ageing out of sight. Below that, pick a client to see their history: notes you write,
interleaved with estimates, invoices and payments logging themselves as they happen.

Set a follow-up with a date and a note ("chase the Easter estimate, in 5 days"). Whatever is
due also arrives by email at 7am, so it does not depend on you opening the app.

## Taxes & Reserve

**Sidebar → Taxes & Reserve**, or http://localhost:8080/rpw/taxes

Three things on one page:

- **The reserve.** Target is 25% of YTD net profit (cash basis), computed from the same P&L the
  reports use. "Funded" is what the Tax Reserve Savings account actually holds, and the page says
  how much to move this month to be square. A Section 179 purchase lowers profit, so the target
  pulls back on its own.
- **Estimated payments.** The next four federal/Ohio dates, with links to IRS Direct Pay and
  Ohio's payment portal. Weekend-adjusted; the odd holiday shift is not modelled, so treat the
  date as "no later than".
- **Equipment register.** Every equipment purchase with its treatment (Sec. 179 / COGS), serial
  numbers, and the bill of sale attached. The report counts anything missing either — that is the
  CPA/audit checklist.

## Ohio sales tax

The county rate table lives at **http://localhost:8080/rpw/sales-tax** (sidebar → Ohio Sales Tax).

Collection is **off** and stays off until your vendor's licence is approved. All 88 Ohio counties
are loaded; 12 around Greene are in the job-site picker. Every rate is marked unverified until you
check it against tax.ohio.gov — the app refuses to switch collection on before you have.

## Attachments

Logos, bills of sale and receipts go into the MinIO container that runs alongside everything else —
no third party holds RPW's documents. There is a console at http://127.0.0.1:9101 (credentials are
`S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` in `.env`) if you ever want to look at the raw files.
Nightly backups include them automatically.

## Email

Sending needs **Zoho Mail Lite or above** — the Forever Free plan blocks SMTP entirely, which shows
up as `535 Authentication Failed` no matter how correct the password is. The mailbox is
`josh@rhodespw.com`; `rhodesproductionworks.com` has no mail records at all.

Once the plan is upgraded, generate an app-specific password at accounts.zoho.com → Security →
App Passwords, then:

```bash
bash rpw/scripts/set-mail-password.sh
```

It prompts for the password without echoing it, saves it, restarts the API and offers to send a
test message. To re-test later: `python3 rpw/scripts/test_email.py --send`.

---

## Backups

They run themselves nightly at 02:30 (and shortly after WSL starts, if the last one is stale).
To take one right now, or to prove a backup can actually be restored:

```bash
bash rpw/scripts/backup.sh          # back up now
bash rpw/scripts/restore.sh --drill # restore into scratch databases and verify — safe
```

Offsite sync to Google Drive needs one authorisation from you — `bash rpw/scripts/setup-gdrive.sh`.
Full detail in `RESTORE.md`.

## Useful details

- The app is bound to **127.0.0.1 only** — nothing on the coffee-shop wifi can reach it. Remote
  access arrives in Phase 2 (Cloudflare Access), deliberately not before.
- Port 8080 is set by `PUBLIC_PROXY_PORT` in `.env`. Change it there if something else grabs 8080.
- MariaDB is reachable from Windows GUI tools at `127.0.0.1:3307` (user `bigcapital`, password in
  `.env`).
- Background job dashboard: http://localhost:8080/api/queues
- `.env` holds every secret and is git-ignored. `.env.rpw.example` is the committed template — if a
  new variable ever appears, it needs to be in both.
- Compose reads three files, wired together by `COMPOSE_FILE` in `.env`:
  `docker-compose.prod.yml` (upstream, untouched) + `docker-compose.rpw.yml` (ours, builds this
  fork's code) + `docker-compose.override.yml` (laptop-only, git-ignored). That is why plain
  `docker compose up -d` just works, and why the same stack will move to a server unchanged.
