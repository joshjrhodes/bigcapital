# ARCHITECTURE_NOTES.md — what Bigcapital actually is

Written after reading the repo and running the stack (Phase 0, August 2026). Everything here was
verified against the code at `origin/develop` or against the running containers — not assumed.
Re-verify after any large upstream merge.

---

## 1. Services and datastores

Seven containers. Idle memory measured on the laptop is in the last column — the whole stack sits
around **0.75 GB**, comfortably inside the ~4 GB target host.

| Service | Image / source | Role | Idle RAM |
| --- | --- | --- | --- |
| `proxy` | `envoyproxy/envoy:v1.30` + `docker/envoy/envoy.yaml` | Front door. `/api` → server, everything else → webapp | 80 MB |
| `server` | built from `packages/server/Dockerfile` (`rpw/server:local`) | NestJS 10 API, global prefix `/api`, port 3000 | 277 MB |
| `webapp` | built from `packages/webapp/Dockerfile` (`rpw/webapp:local`) | React SPA compiled by Vite, served as static files by nginx | 10 MB |
| `mysql` | built from `docker/mariadb` | **MariaDB** — the only relational store | 131 MB |
| `redis` | built from `docker/redis` | Cache + BullMQ queues | 4 MB |
| `gotenberg` | `gotenberg/gotenberg:7` | Headless Chromium; turns HTML into PDF | 232 MB |
| `database_migration` | our overlay reuses `rpw/server:local` | Runs migrations at startup, then exits | — |

There is **no MongoDB** and **no Postgres**, despite what older docs and the CONTRIBUTING guide
imply (CONTRIBUTING still shows a `bigcapital-mongo` container in its example output — stale).

### Databases: one system DB + one DB per organization

```
bigcapital_system                      -- users, tenants registry, subscriptions
bigcapital_tenant_<organization_id>    -- ALL business data for one organization
```

The tenant database is created and migrated at organization-build time by
`packages/server/src/modules/TenantDBManager/`. The suffix is the organization's public id
(e.g. `bigcapital_tenant_2bw1d1mszhjh90`), not a numeric id.

**Backup consequence (Phase 0.5):** dumping `bigcapital_system` alone is worthless. The backup must
dump the system DB *and* every `bigcapital_tenant_%` database — discover them with
`SHOW DATABASES LIKE 'bigcapital_tenant_%'` rather than hardcoding a name.

Migrations live in two trees, both run by the CLI (`node dist/cli.js`):

- `packages/server/src/database/system/migrations/` — 29 migrations, system DB.
- `packages/server/src/database/tenant/migrations/` — 104 migrations, applied to every tenant DB.
- Seeds: `packages/server/src/database/tenant/seeds/` — `core/` holds the seeders,
  `data/accounts.ts` is the default chart of accounts (34 accounts), `data/TaxRates.ts` the
  starter tax rates.

Custom RPW tables are **tenant** migrations in nearly all cases. Knex migrations, so `up()`/`down()`
are both required — the brief demands reversibility.

---

## 2. Request path

```
browser → :8080 (envoy)
             ├── /api/*  → server:3000        (NestJS, global prefix /api)
             └── /*      → webapp:80          (nginx, SPA fallback to index.html)
```

The web app calls the API with **relative URLs** (`packages/webapp/src/services/axios.tsx` creates a
bare `axios.create()`), so there is no compiled-in hostname. That is why moving hosts is only a DNS
and reverse-proxy change — nothing in the built bundle knows where it lives.

Auth is a JWT bearer token plus an organization header:

```
Authorization: Bearer <token>
organization-id: <organization public id>
```

API responses are serialised in **snake_case** (`access_token`, `organization_id`) even though DTOs
are camelCase — worth remembering when writing scripts against the API.

Background jobs run on BullMQ inside the server container (mail sending, organization build,
inventory recompute). A Bull Board UI is mounted at `/queues`. Jobs run in-container, so they do not
depend on the laptop being awake in any way the brief cares about — once the stack is on a server,
they run there.

---

## 3. Where the money lives (do not touch)

- Ledger core: `packages/server/src/modules/Ledger/` — the double-entry engine.
- Per-document GL entry builders live beside their module, e.g.
  `modules/SaleInvoices/ledger/`, `modules/Bills/`, `modules/Expenses/`.
- Financial reports: `modules/FinancialStatements/modules/<ReportName>/`, exposed as
  `/api/reports/<report-name>` (profit-loss-sheet, balance-sheet, trial-balance-sheet,
  general-ledger, cashflow-statement, journal, receivable/payable-aging-summary,
  sales-tax-liability-summary, …).

Per the brief: **never modify these.** Custom behaviour hangs off events and new tables instead.

---

## 4. Sales documents (estimates and invoices)

Each sales document is one module with a consistent shape:

```
modules/SaleInvoices/
  SaleInvoices.controller.ts      HTTP routes            (/api/sale-invoices)
  SaleInvoices.application.ts     thin facade the controller calls
  commands/                       create / edit / delete / mail
  queries/                        reads, PDF, mail-state
  models/                         Objection models (SaleInvoice, ItemEntry …)
  dtos/                           class-validator request/response DTOs
  ledger/                         GL entries for this document type
  subscribers/                    event listeners
```

`modules/SaleEstimates/` mirrors it (`/api/sale-estimates`), as do `Bills`, `Expenses`,
`PaymentReceived` (`/api/payments-received`), `Customers`, `Vendors`, `Items`.

Line items are shared: `modules/TransactionItemEntry/` with `ItemEntryDto`
(`index`, `itemId`, `quantity`, `rate`, `description`, `discount`, tax fields).

Taxes today: a per-tenant `tax_rates` table (`modules/TaxRates/`), and each line item can carry
`sellTaxRateId` / `purchaseTaxRateId`. There is already a
`/api/reports/sales-tax-liability-summary` report (requires a `basis=cash|accrual` query param).

**Phase 1 hook for Ohio multi-county tax:** one `tax_rates` row per county gives correct per-invoice
rate application for free; what upstream lacks is the *county dimension* on the transaction and
county-separated reporting. That is an additive column on the sales documents plus a new report —
no ledger changes.

---

## 5. PDF generation (matters for Phases 1 and 3)

The pipeline is HTML-first, which is good news: styling an invoice is CSS, not a PDF DSL.

```
GET /api/sale-invoices/:id   with  Accept: application/pdf
  → SaleInvoicePdf.service.ts
      → branding attributes  (SaleInvoicePdfTemplate.service.ts + pdf_templates row)
      → renderInvoicePaperTemplateHtml()      shared/pdf-templates (React SSR → HTML string)
      → ChromiumlyTenancy.convertHtmlContent()  POSTs the HTML to Gotenberg
  → PDF buffer
```

- Templates are **React components**: `shared/pdf-templates/src/components/InvoicePaperTemplate.tsx`,
  `EstimatePaperTemplate.tsx`, `PaperTemplate.tsx` (shared frame), with SSR entry points in
  `shared/pdf-templates/src/renders/`.
- Per-organization template records live in the tenant table `pdf_templates`
  (`modules/PdfTemplate/`, model `PdfTemplateModel`: `resource`, `templateName`, `predefined`,
  `default`, `attributes` JSON). Standard templates are seeded by
  `20240915195024_seed_standard_pdf_templates.ts`.
- `attributes` is free-form JSON — colours, logo, which blocks show. The web app already has a
  branding editor for it.
- `GET /api/sale-invoices/:id/html` returns the same HTML without rendering, which makes iterating
  on a design fast.

**Phase 1** (stock branded template) = restyle/extend the React templates + seed an RPW default
`pdf_templates` row. **Phase 3** (pdfme designer) = a new template kind stored in the same table,
with generation branching on template type and falling back to the Phase 1 renderer on error.

Fonts: Gotenberg renders in Chromium inside its own container, so a webfont must be embedded in the
HTML (base64 `@font-face`) or served from a URL the container can reach — a font installed on the
laptop is invisible to it.

---

## 6. Email

`modules/Mail/Mail.module.ts` builds a single **nodemailer** transport from `MAIL_HOST`,
`MAIL_PORT`, `MAIL_SECURE`, `MAIL_USERNAME`, `MAIL_PASSWORD` (auth is only attached when a username
is set). `MAIL_FROM_NAME` / `MAIL_FROM_ADDRESS` set the envelope.

Sending is queued, not inline: e.g. `modules/SaleInvoices/commands/SendSaleInvoiceMail.ts` →
`SendSaleInvoiceMailJob.ts` → `processors/SendSaleInvoiceMail.processor.ts` (BullMQ). Mail bodies
are React components in `shared/email-components/`. Endpoints: `POST /api/sale-invoices/:id/mail`,
`POST /api/sale-estimates/:id/mail`.

Zoho SMTP in Phase 1 is therefore configuration, not code: `smtp.zoho.com`, port 465 with
`MAIL_SECURE=true`, an app-specific password, and `MAIL_FROM_ADDRESS=josh@rhodesproductionworks.com`.

---

## 7. Attachments — object storage

`modules/Attachments/` uploads exclusively to **S3-compatible object storage**
(`S3UploadPipeline.ts`, `modules/S3/S3.module.ts`, `S3_*` env vars). There is no local-disk driver
upstream, so the stack runs its own **MinIO** container (`docker-compose.rpw.yml`), with the bucket
created on first boot by a one-shot `mc` container. Everything stays inside the compose network and
inside one named volume (`rpw_minio`), which the backup script picks up automatically.

`S3_FORCE_PATH_STYLE=true` is required: MinIO has no DNS-style buckets, and without it every upload
goes to a hostname that does not exist.

**Known limit:** `S3_ENDPOINT` is `http://minio:9000`, which the server and Gotenberg resolve but a
browser cannot. Uploads work, and PDFs embed an uploaded logo (Gotenberg fetches it from inside the
network), but a presigned URL handed to the browser will not load. Fixing it properly needs a
public hostname for the object store, which is a Phase 2 concern — SigV4 signs the host, so the
server and the browser have to agree on one name.

---

## 8. Extension points for RPW modules

1. **New server module:** create `packages/server/src/modules/<Feature>/` following the layout in
   §4, then register it in `modules/App/App.module.ts` (one import + one entry in `imports`). This
   is the only upstream file a new module has to touch — keep those edits to a single contiguous
   block so rebases stay trivial.
2. **New tenant tables:** a Knex migration in `database/tenant/migrations/` with a real `down()`.
   Models extend `TenantBaseModel` (`modules/System/models/TenantBaseModel.ts`), which is what makes
   a model resolve to the current organization's database.
3. **Reacting to accounting events instead of editing it:** `src/common/events/events.ts` is a
   registry of ~every domain event (`saleInvoice.onCreate`, `onDelivered`, `onPdfViewed`,
   `paymentReceived.onCreated`, …) emitted through `EventEmitter2`. Phase 4's CRM timeline should be
   a subscriber on these — zero changes to the accounting modules.
4. **Feature flags:** `modules/Features/` with `Features` enum in `src/common/types/Features.ts`,
   stored per tenant through the settings driver (`FeaturesSettingsDriver`). Custom modules should
   register a flag here so half-finished work can be switched off (brief §3.5).
5. **Settings:** `modules/Settings/` is a generic per-tenant key/value store — the right home for
   things like "sales tax collection enabled" and "default job-site county" without a schema change.
6. **Web UI:** `packages/webapp/src/containers/<Area>/`, routed from `src/routes/dashboard.tsx`
   (and `preferences.tsx` / `preferencesTabs.tsx` for settings pages). Data fetching goes through
   `src/hooks/query/` (React Query) — follow the existing hook-per-resource pattern.
7. **Ops scripts and anything not upstream's business:** `rpw/` at the repo root.

---

## 9. What RPW has added so far

Everything below is ours. It follows the conventions above, and the only upstream files it touches
are listed here — each edit is a single contiguous block, so rebases stay boring.

| Ours | What it is |
| --- | --- |
| `modules/RpwSalesTax/` | Ohio multi-county sales tax: county rate table, job-site county per document, county summary report, collection on/off |
| `modules/RpwBranding/RpwPdfTemplate.utils.ts` | One predicate — "is this an RPW-branded PDF template?" — so the branch in the PDF services is a single line each |
| `database/tenant/migrations/20260819000000_create_rpw_county_sales_tax_tables.ts` | `rpw_county_tax_rates` + `rpw_transaction_counties`, seeded with all 88 counties (plus 4 COTA variants) from ODT's own table |
| `shared/pdf-templates/src/components/RpwPaperTemplate.tsx` | The branded estimate/invoice layout, sharing upstream's props so the same attributes drive it |
| `rpw/scripts/` | Ops tooling: backups, restore drills, provisioning, smoke test, disposable verification stack |
| `rpw/data/ohio-county-tax-rates.json` | Source of record for the seeded rates, with provenance |

Upstream files carrying an RPW edit:

- `modules/App/App.module.ts` — imports `RpwSalesTaxModule`.
- `modules/SaleInvoices/queries/SaleInvoicePdf.service.ts` and
  `modules/SaleEstimates/queries/GetSaleEstimatePdf.ts` — one `if` that picks our renderer when the
  document's template is ours, plus passing `templateName` through so it can tell.
- `shared/pdf-templates/src/index.ts`, `constants.ts`, `renders/render-ssr.tsx` — exports and the
  placeholder font link.
- `packages/webapp/src/routes/dashboard.tsx` and `src/constants/sidebarMenu.tsx` — one route, one
  sidebar link.

Two design decisions worth remembering:

1. **The job-site county is a join table, not a column on `SALES_INVOICES`.** Upstream owns that
   table; if we added a column, every upstream migration touching it becomes a merge risk.
2. **Rates are data with provenance, not constants.** Each row carries its ODT source URL, the
   effective period, and a `verified_at` that only a human sets. The API refuses to enable
   collection while any active county is unverified, and editing a rate clears its verification.
   ODT republishes quarterly, so a rate is a claim with an expiry date, not a fact.

---

## 10. Things that will bite

- **`.env` is read twice**: docker compose substitutes it into the compose files, *and* Nest's
  `ConfigModule` reads env vars inside the container. A variable only reaches the app if the compose
  file explicitly passes it into the `server` service's `environment:` block. Upstream's
  `docker-compose.prod.yml` misses a few (`APP_JWT_SECRET`, throttling, PostHog) — our
  `docker-compose.rpw.yml` adds them back.
- **`docker-compose.prod.yml` has a typo** upstream: `- OPEN_EXCHANGE_RATE_APP_ID-${…}` (hyphen
  instead of `=`). Harmless for us since exchange rates are unused, but do not copy the pattern.
- **The published `bigcapitalhq/*:latest` images are not this code.** Upstream's release tags stop
  at `v0.9.12` (2023) while `develop` has ~2100 commits since, so the fork tracks `develop`. Our
  compose overlay builds from source for exactly this reason — running upstream images against our
  migrations would drift.
- **Organization build payload is fussy:** `fiscalYear` must be lowercase (`january`), `language`
  is `en` or `ar` (not `en-US`), and `dateFormat` uses `MM/DD/yyyy` (lowercase year).
- **Node 18 only** (`.nvmrc` 18.16.1; pnpm 9). The Dockerfiles pin it; don't build with newer Node.
- **Husky/`prepare`** runs during the production dependency install in `packages/server/Dockerfile`
  — that is why husky is added and then removed there. Leave it alone.
- **Docker layer order in `packages/server/Dockerfile` is load-bearing.** Both stages copy only the
  `shared/*/package.json` manifests before `pnpm install`, and the sources afterwards. Upstream
  copied the whole `shared` tree first, so editing one line of a PDF template invalidated the
  install layer and cost a full ten-minute reinstall; with the manifests split out the same edit
  rebuilds in about ninety seconds. If a rebase drops this, rebuilds get slow again — that is the
  symptom to recognise.
