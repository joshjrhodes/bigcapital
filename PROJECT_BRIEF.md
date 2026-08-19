# Rhodes Production Works — Business Platform Brief

**Project codename:** RPW Platform
**Prepared for:** Claude Code
**Owner:** Josh, Rhodes Production Works LTD (single-member Ohio LLC)
**Last updated:** August 2026

---

## How to use this brief

Place this file at the root of the forked repo as `PROJECT_BRIEF.md`. Reference it from `CLAUDE.md` (e.g., "Read PROJECT_BRIEF.md before any work; it defines phases, constraints, and non-negotiables"). Work one phase at a time. Do not start a phase until the previous phase's acceptance criteria pass.

---

## 1. What we're building

A self-hosted "QuickBooks lite" for a solo live-event production company: double-entry bookkeeping, estimates → invoices with branded PDF templates, a lightweight CRM layer, and payment recording/processing. Built by **forking Bigcapital** (https://github.com/bigcapitalhq/bigcapital) and extending it additively.

**Why fork, not build:** ledger math, double-entry posting, and financial reports are already battle-tested upstream. Our job is configuration + additive modules, never rewriting the accounting core.

**Deployment path:** **Docker Compose from day one, host decided later.** Everything runs as containers on Josh's Windows laptop (Docker Desktop + WSL2) during development. The *same compose file* later runs on a cheap VPS, and eventually on Josh's own RAID/NAS hardware. Containerizing up front means changing hosts is a copy-dump-restore chore, not a rebuild — so **do not optimize for any specific host, and do not spend early effort on deployment, TLS, or access control.** Get the app running and useful first.

**Host-portability rules (honor these throughout every phase):**
- All configuration through environment variables. No hardcoded hosts, ports, paths, or URLs in application code.
- No `localhost` assumptions outside `.env`.
- All persistent state in named Docker volumes — database, uploaded files, generated PDFs, template JSON. Nothing important lives inside a container's writable layer.
- File uploads go to one configurable directory, not scattered.
- Anything that must be true on a server (background jobs, scheduled tasks) should not depend on Josh's laptop being awake — design it to run in-container.

---

## 2. Business context (read this — it drives feature decisions)

- **Company:** Rhodes Production Works LTD — lighting, audio, and video production, sales, and installation. Clients: churches, small businesses, wedding planners, schools. Greene County, Ohio.
- **Structure:** single-member LLC (disregarded entity), **cash-basis** accounting, Schedule C self-filer. Single user — Josh only.
- **Tax posture that shapes features:**
  - Tax reserve = **25% of net profit** (not gross revenue), funded monthly.
  - Equipment purchases are expensed via **Section 179 or COGS** — never bonus depreciation (Ohio addback issue). Used-equipment purchases need a **bill of sale with serial numbers** on record.
  - **Ohio sales tax — multi-county:** fixed base in Greene County, but jobs occur mostly in **Montgomery County** and other surrounding counties. Under Ohio HB 508, the single Greene County vendor's license likely covers temporary work locations in other counties (Josh will confirm with ODT), **but each sale must be taxed at the applicable county's combined rate and reported to ODT separated by county.** The system therefore needs a per-county rate table, an invoice-level county selection, and county-dimensioned liability tracking. Collection stays off until the vendor's license is approved.
  - **CPA-consult flags (system stays flexible; don't encode assumptions):** which RPW services are actually taxable in Ohio vs. exempt, exact sourcing rules for installed/delivered goods and services, and municipal net-profit income tax exposure (RITA/CCA — e.g., Dayton) from working across cities.
  - Quarterly estimated federal/state payments — a reminder surface is useful, not a payment integration.
- **Brand:** display face **DDC Hardware 45**, supporting face **Avenir**. Mark is a stamped maker's-plate / boxed RPW monogram. Aesthetic: industrial, honest, "boots on the ground." Josh is a graphic designer — he will supply logo assets (SVG/PNG) and has strong opinions; when in doubt on visual choices, ask him rather than improvising.
- **Email:** transactional sending via **Zoho Mail SMTP**, from `josh@rhodesproductionworks.com`. Credentials supplied by Josh as env vars (use a Zoho app-specific password).
- **No data migration needed.** Books are currently empty (Zoho Books Free exists but unused). Fresh start; Zoho stays dormant as a fallback.

---

## 3. Non-negotiable engineering principles

1. **Never modify core ledger/posting logic.** All custom work is additive: new modules, new tables, new routes, new UI surfaces. If a change seems to require touching posting code, stop and flag it to Josh instead.
2. **Stay rebase-able against upstream.** Isolate custom code following the repo's existing module/package conventions (inspect the codebase and follow its patterns). Keep custom commits clean and well-messaged so upstream updates can be pulled in.
3. **Verify, don't assume, repo internals.** On first setup, read the repo's README, docker-compose files, and package structure to confirm the actual DB engine, cache layer, service topology, and module conventions. Document findings in `CLAUDE.md`. Do not trust secondhand descriptions of the stack (including this brief's assumptions).
4. **Database is sacred.** Every schema migration must be reversible and preceded by an automated backup. Never run destructive migrations against a live production database without a fresh verified dump.
5. **Feature flags for custom modules** where practical, so anything half-finished can be disabled without a rollback.
6. **Secrets in env vars only** (`.env` git-ignored, `.env.example` committed). Never commit SMTP, Google Drive, or payment-processor credentials.
7. **Resource-conscious:** assume the eventual production host has roughly **4GB RAM total** — that fits both a cheap VPS and Josh's own NAS hardware. Avoid adding heavyweight services that would be painful there; flag it if something genuinely needs more. This constraint informs choices, it does not block local development.
8. **Single-user system.** Don't build multi-tenant/multi-user complexity, but don't hardcode assumptions so deep that a second user someday is impossible.
9. **Work autonomously, checkpoint often.** Josh is frequently driving this from a phone via Remote Control. Run the commands yourself — clone repos, install packages, run migrations, start dev servers, read logs, fix what breaks. Don't stop to ask permission for routine setup steps. **Do stop and ask** when: a decision is visual/brand-related, a decision affects tax or accounting treatment, something would modify ledger core, or you'd be guessing at a business requirement. Commit to git at every working state so anything can be rolled back.
10. **Answers over screenshots.** When reporting status, lead with what works and what's blocked in one or two sentences. Assume it's being read on a phone.

---

## 4. Phases

**Build order:** 0 (running in Docker locally) → 0.5 (backups) → 1 (real books + branded invoices) → 3 (template designer) → 4 (CRM) → 5 (tax extensions) → 6 (payments) → 2 (go live on a host, when Josh says) → 7 (webhooks).

Note that Phase 2 is intentionally out of numerical order — it's deferred infrastructure work, not an early step.

**Start here:** begin Phase 0 now. Read the repo before installing anything.

### Phase 0 — Get it running in Docker on the laptop

Goal: a working Bigcapital instance running in containers on Josh's laptop today.

**Environment**
- Work inside **WSL2** (Ubuntu) with Docker Desktop's WSL2 integration enabled. Clone into the WSL2 filesystem (e.g., `~/projects/`), **never** `/mnt/c/...` — bind-mount performance on the Windows filesystem is bad enough to waste hours.
- Fork `bigcapitalhq/bigcapital` to Josh's GitHub, then clone the fork. Add upstream as a remote so updates can be pulled later.
- Read the repo's README, `package.json`, and any compose/deploy docs **first**. Confirm the real services, datastores, and required env vars before running anything.

**Run it**
- Use the repo's own Docker Compose setup as shipped. Get it up with minimal modification — resist the urge to restructure it now.
- If the shipped compose is broken or awkward, fix it in place and note what changed. If containers are genuinely uncooperative after a real attempt, running app processes natively against containerized datastores is an acceptable temporary unblock — but the goal state is fully containerized, so come back to it.
- Create a `docker-compose.override.yml` (git-ignored) for laptop-specific settings, keeping the base compose file host-agnostic.

**Then**
- Create a test organization, log in, and click through every core screen: chart of accounts, customers, items, estimates, invoices, expenses, bills, payments, and each financial report.
- Write `ARCHITECTURE_NOTES.md`: actual services and datastores, where invoice/estimate models live, how PDF generation currently works, where email/SMTP is configured, how the frontend talks to the API, and the cleanest extension points for new modules.
- Write `RUNNING_LOCALLY.md`: the literal commands Josh types to start and stop everything, plus the URL to open. He will use this constantly.
- Commit everything.

**Acceptance:** Josh runs the commands in `RUNNING_LOCALLY.md`, opens a browser, logs in, and creates a dummy invoice. Architecture notes exist.

### Phase 0.5 — Backups (do this immediately after Phase 0)

Before any real financial data is entered, even locally:
- A one-command DB dump script (run against the database container) writing timestamped dumps to a host folder.
- Also capture the uploads volume — attachments and template JSON, not just the DB.
- Schedule it daily (cron in WSL2 now; the same script moves to whatever host comes later).
- Sync that folder to **Google Drive** via `rclone` into a dedicated folder, e.g. `RPW-Platform-Backups/`. Josh authorizes the remote when prompted.
- Confirm a restore works into a scratch database once. Write `RESTORE.md` with the exact steps.

Rationale: the laptop is the system of record for a while, and a laptop is a single point of failure. Retention: 30 daily + 12 monthly.

**Acceptance:** a backup file exists in Google Drive; one restore has succeeded.

### Phase 1 — Books live: configuration + brand + email (laptop, local)

Goal: Josh can run real bookkeeping and send a real branded estimate/invoice — from the laptop, no NAS required. **This is the phase that makes the project worth having; get here fast.**

- **Chart of accounts** tailored to RPW (build on Bigcapital's defaults):
  - Income: Production Services, Equipment Sales, Installation.
  - COGS: Equipment for Resale, Subcontractors/Labor, Drop-ship Costs.
  - Expenses: standard Schedule C categories (insurance, vehicle/mileage placeholder, software subscriptions, marketing, small tools, phone).
  - Assets: Equipment (Sec. 179-eligible), checking, tax-reserve savings.
  - Liabilities: **Sales Tax Payable — Ohio** (dormant until license approval), credit card.
  - Equity: Owner's Contributions, Owner's Draws.
- **Items catalog:** starter service items (e.g., lighting design, audio engineering, event production day rate, installation labor) and an equipment-sale item pattern. Josh will refine names/rates.
- **Branded PDF template (stock, v1):** one clean estimate + invoice layout using the RPW brand (DDC Hardware 45 headings, Avenir body, maker's-plate mark, generous margins, itemized table, terms footer). Implement within Bigcapital's existing PDF pipeline for now — the drag-and-drop designer comes in Phase 3. Josh reviews and approves the design before this phase closes.
- **Email sending:** wire estimates/invoices to send via Zoho SMTP from `josh@rhodesproductionworks.com`, with a plain, professional email body template. Test deliverability (SPF/DKIM already configured on the domain).
- **Sales tax scaffolding (multi-county):** build a county rate table covering Greene, Montgomery, and a configurable list of neighboring counties (e.g., Warren, Miami, Clark, Butler — Josh confirms the list). **Look up every county's current combined Ohio sales tax rate at implementation time — do not hardcode rates from memory or from this brief.** Each estimate/invoice gets a job-site county selector (configurable default) that drives the applied rate and is stored on the transaction for county-level reporting. Collection stays off by default, with a clearly-labeled activation toggle for when the vendor's license arrives.
- **Acceptance:** Josh creates a client, sends himself a branded estimate by email, converts it to an invoice, records a manual payment, and P&L reflects it correctly.

### Phase 2 — DEFERRED: Go live on a real host

**Do not start until Josh explicitly says so.** The target host is undecided by design — likely a small VPS (~$5–8/mo) first, then Josh's own RAID/NAS hardware later. Because everything is already containerized, either move is the same short procedure.

Goal: the books live on always-on hardware, reachable from anywhere, locked down.

- **Move:** provision the host, install Docker, copy the compose file and `.env`, restore the latest dump, start containers, verify P&L totals match the pre-move instance **exactly** before trusting it. Document the whole thing in `DEPLOY.md` — including how to roll back and how to repeat this move to yet another host later.
- **Access control — non-negotiable, since this exposes financial records to the internet:** put **Cloudflare Access** in front with an email allow-list containing only Josh. Cloudflare Tunnel from the host means no inbound ports open at all. Do not expose the app publicly without this in place, even briefly.
- **DNS/TLS:** subdomain on `rhodespw.com` (e.g., `books.rhodespw.com`) via Cloudflare, proxied, TLS terminated at Cloudflare.
- **Promote backups:** move the Phase 0.5 scripts onto the host so they run there rather than on the laptop. Verify the Google Drive sync works from the new host. Run one restore drill. Note a **quarterly restore test** habit.
- **Sizing note:** target ~4GB RAM so nothing surprises Josh when this later lands on his own hardware. Set per-container memory limits.
- **Acceptance:** app reachable at the subdomain, Cloudflare Access blocks everyone but Josh, P&L matches pre-move exactly, last night's backup is in Google Drive, restore drill passed.

### Phase 7 — Webhooks (only after Phase 2)

Once the app has a public hostname, replace the Phase 6 polling reconciliation with real webhook endpoints from Stripe/Square/PayPal. Note that **Cloudflare Access will block webhook callbacks** — create a bypass policy scoped to the webhook paths only, and verify each provider's signature on every request.

### Phase 3 — Template designer (pdfme)

Goal: Josh visually designs estimate/invoice layouts himself.

- Integrate **pdfme** (MIT): `@pdfme/ui` Designer embedded in a new settings page, `@pdfme/generator` for output, `@pdfme/schemas` plugins (text, image, table, line/rect) enabled.
- Map document data into pdfme inputs: business identity block, client block, document number/date/terms, line-item **table** (description, qty, rate, amount), subtotal/tax/total, notes, footer. Expose these as named draggable fields in the Designer.
- Store templates as JSON in the DB with versioning; separate default templates for Estimate vs. Invoice; a preview-with-real-data button; safe fallback to the Phase 1 stock template if a custom template errors.
- Recreate the Phase 1 stock design as the first pdfme template so there's a professional starting point to duplicate and modify.
- Fonts: embed licensed font files Josh provides for PDF rendering (confirm embedding permissions with him; fall back to a close metric-compatible font if a license blocks embedding).
- **Acceptance:** Josh drags a field, moves the logo, saves, and the next invoice PDF reflects it; broken template falls back gracefully.

### Phase 4 — CRM layer (lightweight, additive)

Goal: relationship memory + follow-through, not a sales machine.

- **Contact notes & history:** timeline tab on each customer — free-text notes (timestamped), plus auto-logged events (estimate sent, invoice sent, payment received). Support a simple referral-source field on the customer ("Referred by ___") since referrals drive this business.
- **Follow-up reminders:** create a follow-up (date + note) from a customer or an estimate; a dashboard widget lists due/overdue follow-ups; optional daily 7am email digest to Josh via Zoho SMTP listing today's follow-ups. Mark done / snooze.
- New tables + routes + UI only; zero changes to accounting entities beyond foreign keys.
- **Acceptance:** send an estimate → set "follow up in 5 days" → it appears on the dashboard on day 5 and in the morning digest.

### Phase 5 — RPW finance extensions

Goal: encode Josh's specific tax discipline into the tool.

- **Tax reserve widget (dashboard):** computes 25% × YTD net profit (cash basis) minus recorded transfers to the tax-reserve account; shows "reserve target vs. funded" and this month's suggested transfer. When a Sec. 179/COGS-tagged equipment purchase reduces profit, the target adjusts automatically — surfacing the "pull back the reserve" behavior Josh already practices.
- **Equipment purchase tagging:** on expense/bill line items, an optional tag — `Section 179` / `COGS` — plus fields for serial number and an attachment slot for the bill of sale. A simple "Equipment Purchases" report lists tagged items with serials and attachments (CPA- and audit-ready).
- **Quarterly estimated-tax reminders:** static, low-tech — surface upcoming federal/Ohio estimated payment dates on the dashboard with links to IRS Direct Pay and Ohio's online payment portal. No payment integration; just make the dates impossible to miss.
- **Sales tax activation checklist:** when Josh flips the sales-tax toggle (vendor's license approved), collected tax posts to the Sales Tax Payable liability account **with the job-site county recorded on every taxed transaction.** A remittance report shows taxable sales and tax collected **broken out by county** (Ohio requires county-separated reporting to ODT), plus the total liability balance due.
- **Acceptance:** entering a $2,000 Sec. 179-tagged purchase visibly lowers both YTD net profit and the reserve target; the equipment report shows it with serial + attachment.

### Phase 6 — Payments

Goal: get paid with less friction; keep the books authoritative.

Order of work:
1. **Manual first (already mostly vanilla):** confirm smooth recording of check/ACH/cash payments against invoices, with deposit-to-account selection.
2. **Stripe:** "Pay online" link/button on emailed invoices → Stripe Checkout/Payment Link for the invoice amount. **Constraint: while running on the laptop there is no public URL, so no inbound webhooks.** Reconcile via scheduled outbound polling of Stripe's API for paid sessions, then auto-record the payment (and Stripe fee as an expense). **Design the payment-recording service behind a clean interface so webhook delivery can replace polling in Phase 7 with minimal change.**
3. **Square and PayPal/Venmo:** same pattern (hosted checkout link + polling reconciliation). Implement behind a shared "payment provider" interface so each is a thin adapter.
- Never let a processor event post directly to the ledger without an idempotency check (no duplicate payments on retries/re-polls).
- **Josh's prerequisites (his action items, not code):** create Stripe, Square, and PayPal business accounts under Rhodes Production Works LTD and supply API keys via env vars.
- **Acceptance:** a test-mode Stripe payment on an emailed invoice is auto-recorded within one polling cycle, fee expensed, invoice marked paid, no duplicates on re-poll.

---

## 5. Out of scope (anti-goals)

- Payroll, 1099 contractor management, inventory valuation methods beyond what vanilla provides.
- Multi-user roles/permissions work.
- Two-way Zoho Books sync (Zoho is dormant, not integrated).
- Public client portal (revisit after Phase 7).
- Rewriting Bigcapital UI wholesale — restyle lightly if trivial, but function over cosmetics outside the invoice templates.

## 6. Definition of "done" for the whole project

Josh runs his entire admin loop in this system: estimate → invoice → payment → books → tax reserve → follow-ups — with nightly offsite backups he has personally restored at least once, and a template designer he can use without touching code. Where it's hosted is a detail he can change in an afternoon.

## 7. Open questions for Josh (ask when relevant, don't block)

1. Which host to go live on when Phase 2 comes up (VPS vs. his own hardware) — do not assume.
2. Logo asset files (SVG preferred) and font files/licenses for PDF embedding.
3. Payment-processor account credentials when Phase 6 begins.
4. Google Drive authorization for rclone during Phase 2.
5. Final list of counties to preload in the sales-tax rate table (Greene + Montgomery + which neighbors).
