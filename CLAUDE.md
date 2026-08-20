# CLAUDE.md — RPW Platform

**Read `PROJECT_BRIEF.md` before any work.** It defines the phases, the constraints, and the
non-negotiables. This file is the quick operating manual on top of it.

This repo is a fork of [bigcapitalhq/bigcapital](https://github.com/bigcapitalhq/bigcapital)
(AGPL-3.0), extended additively into a self-hosted bookkeeping platform for
**Rhodes Production Works LTD** — a solo live-event production company in Greene County, Ohio.

## Ground rules (short form of the brief)

1. **Never modify core ledger/posting logic.** Custom work is additive: new modules, new tables,
   new routes, new UI. If a change looks like it needs to touch posting code, stop and ask Josh.
2. **Stay rebase-able.** Custom code follows the repo's existing conventions (see
   `ARCHITECTURE_NOTES.md`). Keep commits clean and well-messaged; upstream lands via
   `git fetch upstream && git rebase upstream/develop`.
3. **Config through env vars only.** No hardcoded hosts, ports, paths or URLs in app code.
   `.env` is git-ignored; `.env.rpw.example` is committed and must stay in sync.
4. **Database is sacred.** Every migration reversible, every destructive step preceded by a
   verified dump.
5. **Stop and ask Josh** when a decision is visual/brand-related, affects tax or accounting
   treatment, would modify ledger core, or would mean guessing at a business requirement.
   Otherwise work autonomously and commit at every working state.
6. **Answers over screenshots.** Status reports lead with what works and what is blocked, in one
   or two sentences — Josh often reads them on a phone.

## Branches

- `develop` — clean mirror of `upstream/develop`. Never commit here.
- `rpw` — our working branch, and the one the laptop runs. All custom work lands here.

Pulling upstream in:

```bash
git fetch upstream
git checkout develop && git merge --ff-only upstream/develop
git checkout rpw && git rebase develop     # then rebuild images and re-run the smoke test
```

## Where we are

Phase 0 is done: the stack runs in Docker on the laptop from this fork's own code, with a test
organization and a green end-to-end smoke test (`python3 rpw/scripts/smoke_test.py`).

Phase 0.5 is done apart from one step only Josh can do: nightly backups run from cron, retention is
30 daily + 12 monthly, and a restore drill into scratch databases passes (`RESTORE.md`). The Google
Drive leg needs Josh to run `bash rpw/scripts/setup-gdrive.sh` once and click Allow — until then
backups are local only.

Phase 1 is nearly done. The real organization exists with RPW's chart of accounts and starter
items, the branded estimate/invoice layout renders through the existing Gotenberg pipeline, and the
Ohio multi-county sales tax scaffolding is in with collection switched off. Outstanding:

- **Zoho SMTP** — everything is wired; `MAIL_PASSWORD` in `.env` needs Josh's app-specific
  password, then `python3 rpw/scripts/test_email.py --send`.
- **Brand assets** — the PDF uses a CSS maker's-plate mark and Oswald/Nunito Sans standing in for
  DDC Hardware 45/Avenir. Josh reviews `~/rpw-sample-invoice.pdf` and supplies the real files.

Phase 3 (visual template designer) is built: pdfme-based drag-and-drop editing at
`/rpw/document-designer`, versioned designs with rollback, preview with real or sample data,
and automatic fallback to the coded template when a design is missing or fails. Designs ship
**inactive** — the Phase 1 coded layout stays in force until Josh activates one.

Phase 4 (CRM layer) is built: per-customer timeline of notes plus auto-logged estimate/invoice/
payment activity, referral source, follow-ups with due/snooze/done, and a 7am email digest of
what is due. All of it hangs off `contacts.id` and event subscribers — no accounting module was
modified.

## Verifying changes

Never run the smoke test against the real books — it writes dummy invoices, and it refuses to.
Use the disposable stack instead:

```bash
bash rpw/scripts/verify_stack.sh      # scratch copy on :8081, full end-to-end, then destroyed
bash rpw/scripts/make_sample_pdfs.sh  # sample estimate + invoice PDFs into ~/
```

## Verified stack (do not trust second-hand descriptions — this was checked against the repo)

| Piece | What it actually is |
| --- | --- |
| API server | NestJS 10 (TypeScript), `packages/server`, port 3000, Objection.js + Knex |
| Web app | React + Vite SPA, `packages/webapp`, built to static files served by nginx |
| Database | **MariaDB** (not Postgres), multi-database: one system DB + one DB per organization |
| Cache/queues | Redis + BullMQ (background jobs, org build, mail) |
| PDF | React templates → HTML → **Gotenberg 7** (headless Chromium) → PDF |
| Mail | nodemailer SMTP (`MAIL_*` env vars) |
| Attachments | S3-compatible object storage only (`S3_*`) — no local-disk driver upstream |
| Reverse proxy | Envoy: `/api` → server, `/` → webapp |
| Shared code | `shared/pdf-templates`, `shared/email-components`, `shared/bigcapital-utils`, `shared/sdk-ts` |
| Package manager | pnpm 9 workspaces + lerna; Node 18 |

Full detail, including extension points for our modules, is in `ARCHITECTURE_NOTES.md`.

## Running it

See `RUNNING_LOCALLY.md`. Short version, from the repo root:

```bash
docker compose up -d          # compose files are wired via COMPOSE_FILE in .env
docker compose ps
```

Compose file layering:

- `docker-compose.prod.yml` — upstream's file, kept unmodified so upstream changes merge cleanly.
- `docker-compose.rpw.yml` — **committed** RPW overlay: builds the server/webapp images from this
  fork instead of pulling `bigcapitalhq/*`, and runs migrations from our own image. Host-agnostic.
- `docker-compose.override.yml` — **git-ignored**, laptop-only (loopback port bindings etc.).

## Where our code goes

- Server modules: `packages/server/src/modules/<Feature>/` — follow the existing module layout
  (`*.module.ts`, `*.controller.ts`, `*.application.ts`, `commands/`, `queries/`, `models/`, `dtos/`).
  Register in `packages/server/src/modules/App/App.module.ts`.
- Migrations: `packages/server/src/database/tenant/migrations/` (per-organization tables) or
  `packages/server/src/database/system/migrations/` (rare). Always write `down()`.
- Seeds: `packages/server/src/database/tenant/seeds/`.
- Web UI: `packages/webapp/src/containers/…`, routes in `packages/webapp/src/routes/`.
- PDF templates: `shared/pdf-templates/src/`.
- Ops scripts and RPW-only tooling: `rpw/` (kept out of upstream's directories on purpose).

## House style

- Commits follow the repo's commitlint conventions: `feat(server): …`, `fix(webapp): …`,
  `chore: …`. Scope by package.
- Custom modules should be feature-flag-able where practical so half-finished work can be
  switched off without a rollback.
- Single-user system: don't build multi-tenant/multi-user complexity, but don't hardcode
  assumptions that make a second user impossible.
- Target host has ~4GB RAM. Flag anything that would need meaningfully more.
