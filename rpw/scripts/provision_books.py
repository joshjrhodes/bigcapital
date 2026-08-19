#!/usr/bin/env python3
"""
Provision the real Rhodes Production Works books (Phase 1).

Creates Josh's account and organization if they do not exist, then adds the RPW
chart of accounts and starter items catalog on top of Bigcapital's defaults.

    python3 rpw/scripts/provision_books.py

Idempotent: anything that already exists by name is left exactly as it is, so it
is safe to re-run after a wipe, after editing the lists below, or on a new host.

Nothing here touches ledger or posting logic — it is all configuration data
created through the ordinary API.
"""

import os
import secrets
import stat
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _api import Api, fail, ok, skip, step  # noqa: E402

EMAIL = os.environ.get("RPW_ADMIN_EMAIL", "josh@rhodesproductionworks.com")
ORG_NAME = os.environ.get("RPW_ORG_NAME", "Rhodes Production Works LTD")
CREDENTIALS_FILE = Path(os.environ.get("RPW_CREDENTIALS_FILE", Path.home() / "rpw-first-login.txt"))

# ── Chart of accounts ───────────────────────────────────────────────────────
# Built for a solo live-event production company filing Schedule C on a cash
# basis. Codes follow the usual 1000/2000/3000/4000/5000/6000 blocks.
#
# Two deliberate choices worth knowing:
#   * Sub-rentals (cross-rentals from other production companies) are COGS, not
#     an operating expense — they are a direct cost of a specific job.
#   * "Sales Tax Payable — Ohio" is created now but stays dormant until the
#     vendor's licence is approved. See rpw/data/ohio-county-tax-rates.json.
ACCOUNTS = [
    # Assets
    ("1010", "Checking — Business", "bank", "Primary business checking account."),
    ("1020", "Tax Reserve Savings", "bank",
     "Holds the 25%-of-net-profit tax reserve. Funded monthly."),
    ("1500", "Equipment — Section 179 Eligible", "fixed-asset",
     "Production equipment expensed under Section 179 or COGS. Never bonus "
     "depreciation (Ohio addback)."),
    # Liabilities
    ("2100", "Sales Tax Payable — Ohio", "tax-payable",
     "DORMANT until the Ohio vendor's licence is approved. Collected tax posts "
     "here, tracked by job-site county."),
    ("2200", "Credit Card", "credit-card", "Business credit card."),
    # Equity
    ("3010", "Owner's Contributions", "equity", "Money Josh puts into the business."),
    ("3020", "Owner's Draws", "equity", "Money Josh takes out of the business."),
    # Income
    ("4010", "Production Services", "income",
     "Lighting, audio and video production labour and services."),
    ("4020", "Equipment Sales", "income", "Resale of equipment to clients."),
    ("4030", "Installation", "income", "Permanent installation work."),
    # Cost of goods sold
    ("5010", "Equipment for Resale", "cost-of-goods-sold",
     "Cost of equipment bought to resell to a client."),
    ("5020", "Subcontractors & Labor", "cost-of-goods-sold",
     "Hired hands and subcontracted techs on a specific job."),
    ("5030", "Drop-ship Costs", "cost-of-goods-sold",
     "Goods shipped by a supplier straight to the client."),
    ("5040", "Equipment Sub-Rental", "cost-of-goods-sold",
     "Cross-rentals from other production companies for a specific job."),
    # Expenses — Schedule C shape
    ("6010", "Insurance", "expense", "General liability, inland marine, equipment cover."),
    ("6020", "Vehicle & Mileage", "expense",
     "Placeholder for the mileage deduction — log miles, post the deduction here."),
    ("6030", "Software Subscriptions", "expense", "Design, accounting and production software."),
    ("6040", "Marketing & Advertising", "expense", "Website, print, sponsorships."),
    ("6050", "Small Tools & Supplies", "expense",
     "Consumables and tools too small to capitalise — gaff tape, cable, adapters."),
    ("6060", "Phone & Internet", "expense", "Business share of phone and internet."),
    ("6070", "Bank & Merchant Fees", "expense",
     "Bank charges and card-processing fees (Stripe/Square/PayPal)."),
    ("6080", "Professional Fees", "expense", "CPA, legal, bookkeeping."),
    ("6090", "Travel & Lodging", "expense", "Out-of-town jobs."),
    ("6100", "Meals", "expense", "Business meals — subject to the usual 50% limit."),
    ("6110", "Storage & Warehouse Rent", "expense", "Space for the equipment inventory."),
    ("6120", "Continuing Education", "expense", "Training, certifications, trade shows."),
]

# ── Starter items catalog ───────────────────────────────────────────────────
# Rates are PLACEHOLDERS — Josh sets the real numbers. The point is the shape:
# services bill to Production Services, resale goods to Equipment Sales, and
# installation labour to Installation.
ITEMS = [
    {
        "name": "Lighting Design",
        "type": "service",
        "sell_price": 750,
        "income": "4010",
        "sell_description": "Lighting design and plot development for an event.",
    },
    {
        "name": "Audio Engineering — Day Rate",
        "type": "service",
        "sell_price": 750,
        "income": "4010",
        "sell_description": "Front-of-house audio engineering, per event day.",
    },
    {
        "name": "Event Production — Day Rate",
        "type": "service",
        "sell_price": 950,
        "income": "4010",
        "sell_description": "Production management and crew for one event day.",
    },
    {
        "name": "Video Production — Day Rate",
        "type": "service",
        "sell_price": 850,
        "income": "4010",
        "sell_description": "Camera, switching and playback for one event day.",
    },
    {
        "name": "Installation Labor — Hourly",
        "type": "service",
        "sell_price": 95,
        "income": "4030",
        "sell_description": "Permanent install labour, billed hourly.",
    },
    {
        "name": "Equipment Sale",
        "type": "non-inventory",
        "sell_price": 0,
        "income": "4020",
        "cost_price": 0,
        "cost": "5010",
        "purchasable": True,
        "sell_description": "Equipment sold to a client. Set the price per quote.",
        "purchase_description": "Equipment bought for resale to a client.",
    },
    {
        "name": "Equipment Sub-Rental",
        "type": "service",
        "sell_price": 0,
        "income": "4010",
        "cost_price": 0,
        "cost": "5040",
        "purchasable": True,
        "sell_description": "Gear cross-rented for this job.",
        "purchase_description": "Cross-rental from another production company.",
    },
]


# ── Branded PDF templates ───────────────────────────────────────────────────
# One row per document type in the tenant's `pdf_templates` table, named with
# the "RPW" prefix that the server's PDF services look for. Switching back to
# upstream's stock design is a dropdown change, not a deployment.
PDF_TEMPLATES = [
    {
        "templateName": "RPW Standard — Invoice",
        "resource": "SaleInvoice",
        "attributes": {
            "primaryColor": "#141414",
            "secondaryColor": "#8a7a5c",
            "showCompanyLogo": True,
            "companyName": "Rhodes Production Works LTD",
            "billedToLabel": "Billed to",
            "totalLabel": "Total",
            "dueAmountLabel": "Amount due",
            "termsConditionsLabel": "Terms",
            "termsConditions": (
                "Net 14 unless agreed otherwise. Equipment remains the property "
                "of Rhodes Production Works LTD until paid in full."
            ),
            "statementLabel": "Notes",
        },
    },
    {
        "templateName": "RPW Standard — Estimate",
        "resource": "SaleEstimate",
        "attributes": {
            "primaryColor": "#141414",
            "secondaryColor": "#8a7a5c",
            "showCompanyLogo": True,
            "companyName": "Rhodes Production Works LTD",
            "billedToLabel": "Prepared for",
            "totalLabel": "Estimate total",
            "termsConditionsLabel": "Terms",
            "termsConditions": (
                "Estimate valid for 30 days. A signed acceptance and deposit "
                "hold the date."
            ),
            "statementLabel": "Scope notes",
        },
    },
]


def provision_pdf_templates(api):
    step("Branded PDF templates")
    status, body = api.get("/pdf-templates")
    existing_body = body if isinstance(body, list) else (
        api.pick(body, "pdfTemplates") or (body or {}).get("data") or []
    )
    if isinstance(existing_body, dict):
        existing_body = existing_body.get("results") or []
    existing = {
        (t.get("template_name") or t.get("templateName") or "").strip(): t
        for t in existing_body
    }
    for template in PDF_TEMPLATES:
        found = existing.get(template["templateName"])
        if found:
            skip(f"{template['templateName']} — already present")
            template_id = found.get("id")
        else:
            status, resp = api.post("/pdf-templates", template)
            if status not in (200, 201):
                fail(f"could not create {template['templateName']}", resp)
            template_id = api.pick(resp, "id")
            ok(template["templateName"])
        if template_id:
            status, resp = api.request(
                "PUT", f"/pdf-templates/{template_id}/assign-default", {}
            )
            if status in (200, 201):
                ok(f"{template['templateName']} set as the default")
            else:
                skip(f"could not set default for {template['templateName']} ({status})")


def main():
    api = Api()
    print(f"\033[1mProvisioning RPW books\033[0m  →  {api.base}")
    api.wait_until_up()

    # ── Account and organization ────────────────────────────────────────────
    step("Account")
    password = os.environ.get("RPW_ADMIN_PASSWORD")
    generated = False
    if not password:
        password = f"Rpw-{secrets.token_urlsafe(12)}"
        generated = True

    status, body = api.post(
        "/auth/signup",
        {"firstName": "Josh", "lastName": "Rhodes", "email": EMAIL, "password": password},
    )
    if status in (200, 201):
        ok(f"created the account {EMAIL}")
        if generated:
            CREDENTIALS_FILE.write_text(
                "RPW Platform — first login\n"
                f"URL:      {api.base}\n"
                f"Email:    {EMAIL}\n"
                f"Password: {password}\n\n"
                "Change this password after signing in "
                "(Preferences → Users), then delete this file.\n"
            )
            CREDENTIALS_FILE.chmod(stat.S_IRUSR | stat.S_IWUSR)
            ok(f"password written to {CREDENTIALS_FILE} (owner-readable only)")
    else:
        skip("the account already exists — reusing it")
        if generated:
            password = os.environ.get("RPW_ADMIN_PASSWORD") or read_saved_password()
            if not password:
                fail(
                    "the account exists but no password is available",
                    "Re-run with RPW_ADMIN_PASSWORD=... so the script can sign in.",
                )

    api.sign_in(EMAIL, password)
    ok(f"signed in, organization-id={api.org_id}")

    step("Organization")
    status, body = api.post(
        "/organization/build",
        {
            "name": ORG_NAME,
            "industry": "Live event production",
            "location": "US",
            "baseCurrency": "USD",
            "timezone": "America/New_York",
            "fiscalYear": "january",
            "language": "en",
            "dateFormat": "MM/DD/yyyy",
        },
    )
    if status in (200, 201):
        job = api.pick(body, "jobId", "id")
        ok(f"organization build started (job {job})")
        import time

        deadline = time.time() + 600
        while time.time() < deadline:
            _, b = api.get(f"/organization/build/{job}")
            data = (b or {}).get("data") or b or {}
            if api.pick(data, "isCompleted"):
                ok("organization built")
                break
            if api.pick(data, "isFailed"):
                fail("organization build failed", b)
            time.sleep(3)
        else:
            fail("organization build timed out")
    else:
        skip("the organization is already built")

    # ── Chart of accounts ───────────────────────────────────────────────────
    step("Chart of accounts")
    status, body = api.get("/accounts")
    if status != 200:
        fail("could not read the chart of accounts", body)
    existing = body if isinstance(body, list) else (api.pick(body, "accounts") or (body or {}).get("data") or [])
    by_name = {(a.get("name") or "").strip().lower(): a for a in existing}
    by_code = {(a.get("code") or "").strip(): a for a in existing if a.get("code")}

    created = 0
    for code, name, account_type, description in ACCOUNTS:
        if name.lower() in by_name:
            skip(f"{code} {name} — already present")
            continue
        payload = {"name": name, "accountType": account_type, "description": description}
        if code not in by_code:
            payload["code"] = code
        status, resp = api.post("/accounts", payload)
        if status not in (200, 201):
            fail(f"could not create account {name}", resp)
        ok(f"{code} {name}")
        created += 1
    print(f"\n  {created} account(s) added, {len(ACCOUNTS) - created} already in place")

    # Re-read so the item catalog can map account codes to ids.
    _, body = api.get("/accounts")
    accounts = body if isinstance(body, list) else (api.pick(body, "accounts") or (body or {}).get("data") or [])
    account_id_by_code = {(a.get("code") or "").strip(): a.get("id") for a in accounts if a.get("code")}

    # ── Items ───────────────────────────────────────────────────────────────
    step("Items catalog")
    status, body = api.get("/items")
    items_body = body if isinstance(body, list) else (api.pick(body, "items") or (body or {}).get("data") or [])
    if isinstance(items_body, dict):
        items_body = items_body.get("results") or []
    existing_items = {(i.get("name") or "").strip().lower() for i in items_body}

    created = 0
    for item in ITEMS:
        if item["name"].lower() in existing_items:
            skip(f"{item['name']} — already present")
            continue
        income_id = account_id_by_code.get(item["income"])
        if not income_id:
            fail(f"income account {item['income']} is missing — cannot create {item['name']}")
        payload = {
            "name": item["name"],
            "type": item["type"],
            "sellable": True,
            "sellPrice": item["sell_price"],
            "sellAccountId": income_id,
            "sellDescription": item.get("sell_description", ""),
            "purchasable": bool(item.get("purchasable")),
        }
        if item.get("purchasable"):
            cost_id = account_id_by_code.get(item["cost"])
            if not cost_id:
                fail(f"cost account {item['cost']} is missing — cannot create {item['name']}")
            payload["costPrice"] = item.get("cost_price", 0)
            payload["costAccountId"] = cost_id
            payload["purchaseDescription"] = item.get("purchase_description", "")
        status, resp = api.post("/items", payload)
        if status not in (200, 201):
            fail(f"could not create item {item['name']}", resp)
        ok(item["name"])
        created += 1
    print(f"\n  {created} item(s) added, {len(ITEMS) - created} already in place")

    provision_pdf_templates(api)

    print(f"\n\033[1;32mBooks provisioned.\033[0m  Open {api.base} and sign in as {EMAIL}.")
    if CREDENTIALS_FILE.exists():
        print(f"First-login password: {CREDENTIALS_FILE}")
    print("Item rates are placeholders — set the real numbers in the app.\n")


def read_saved_password():
    if not CREDENTIALS_FILE.exists():
        return None
    for line in CREDENTIALS_FILE.read_text().splitlines():
        if line.lower().startswith("password:"):
            return line.split(":", 1)[1].strip()
    return None


if __name__ == "__main__":
    main()
