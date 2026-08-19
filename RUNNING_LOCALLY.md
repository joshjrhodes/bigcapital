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

The Phase 0 test organization already exists:

- **URL:** http://localhost:8080
- **Email:** `smoke-test@rhodesproductionworks.com`
- **Password:** `SmokeTest!2026`

It's a throwaway org with dummy invoices in it. Phase 1 starts a clean organization for the real
books — see "Start over with empty books" below.

To register a different account instead, go to http://localhost:8080/auth/register. Each new
account builds its own organization and its own database.

---

## When something looks wrong

```bash
docker compose logs -f server        # API errors — the usual first stop
docker compose logs -f webapp        # the React app / nginx
docker compose logs database_migration  # did migrations run?
docker compose restart server        # kick the API
```

Full end-to-end check — creates a customer, item, estimate, invoice, payment, bill and expense,
renders the invoice PDF, and pulls every financial report:

```bash
python3 rpw/scripts/smoke_test.py
```

If that prints **All smoke-test steps passed**, the whole stack is healthy. It writes dummy records
into the test organization, so don't run it against the real books.

---

## After changing code

The containers run **built images**, so code changes need a rebuild:

```bash
docker compose build server webapp     # ~10 min the first time, much less after
docker compose up -d
```

Rebuild only what you changed (`docker compose build server`) to save time.

---

## Start over with empty books

Destroys **all** data — the databases and everything in them:

```bash
docker compose down -v
docker compose up -d
```

Then register your account again at http://localhost:8080/auth/register. This is what Phase 1 will
do before building the real RPW chart of accounts.

---

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
