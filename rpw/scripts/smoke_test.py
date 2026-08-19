#!/usr/bin/env python3
"""
End-to-end smoke test for the RPW Platform (Bigcapital fork).

Drives the real HTTP API the way the web app does: sign up / sign in, build the
organization (tenant database + seeds), then create a customer, an item, an
estimate, an invoice and a payment, and pull the financial reports back out.
It also renders the invoice PDF, which exercises the Gotenberg container.

Usage:
    python3 rpw/scripts/smoke_test.py
    RPW_BASE_URL=http://localhost:8080 python3 rpw/scripts/smoke_test.py

Safe to re-run: it signs in if the account already exists and skips the
organization build if it is already built. It always creates new demo records,
so run it against a test organization, never against real books.
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import quote
from datetime import date, timedelta

BASE_URL = os.environ.get("RPW_BASE_URL", "http://localhost:8080").rstrip("/")
API = f"{BASE_URL}/api"
EMAIL = os.environ.get("SMOKE_EMAIL", "smoke-test@rhodesproductionworks.com")
PASSWORD = os.environ.get("SMOKE_PASSWORD", "SmokeTest!2026")
ORG_NAME = os.environ.get("SMOKE_ORG_NAME", "RPW Smoke Test Org")

TOKEN = None
ORG_ID = None

# Re-runs must not collide with records left by the previous run.
RUN_ID = time.strftime("%Y%m%d-%H%M%S")


def request(
    method, path, body=None, headers=None, raw=False, timeout=120, body_bytes=None
):
    url = path if path.startswith("http") else f"{API}{path}"
    # body_bytes carries an already-encoded payload (multipart uploads); body is
    # the usual JSON case.
    data = body_bytes if body_bytes is not None else (
        json.dumps(body).encode() if body is not None else None
    )
    hdrs = {"Content-Type": "application/json"}
    if TOKEN:
        hdrs["Authorization"] = f"Bearer {TOKEN}"
    if ORG_ID:
        hdrs["organization-id"] = ORG_ID
    hdrs.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = resp.read()
            if raw:
                return resp.status, payload
            return resp.status, json.loads(payload) if payload else None
    except urllib.error.HTTPError as exc:
        payload = exc.read()
        try:
            return exc.code, json.loads(payload)
        except Exception:
            return exc.code, payload.decode(errors="replace")


def pick(body, *names):
    """Read a field from an API response, tolerating camelCase/snake_case and a
    `data` envelope (the API serialises with snake_case keys)."""
    candidates = []
    if isinstance(body, dict):
        candidates.append(body)
        if isinstance(body.get("data"), dict):
            candidates.append(body["data"])
    for source in candidates:
        for name in names:
            snake = re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()
            for key in (name, snake):
                if key in source:
                    return source[key]
    return None


def ok(msg):
    print(f"  \033[32mPASS\033[0m {msg}")


def fail(msg, detail=None):
    print(f"  \033[31mFAIL\033[0m {msg}")
    if detail is not None:
        print(f"       {str(detail)[:800]}")
    sys.exit(1)


def step(name):
    print(f"\n\033[1m{name}\033[0m")


def wait_for_api(minutes=5):
    step("Waiting for the API to answer")
    deadline = time.time() + minutes * 60
    last = None
    while time.time() < deadline:
        try:
            status, body = request("GET", "/auth/meta", timeout=10)
            if status < 500:
                ok(f"API responding at {API} (status {status})")
                return
            last = (status, body)
        except Exception as exc:  # connection refused while containers boot
            last = exc
        time.sleep(3)
    fail("API never became reachable", last)


def signup_and_signin():
    global TOKEN, ORG_ID
    step("Authentication")
    status, body = request(
        "POST",
        "/auth/signup",
        {
            "firstName": "Josh",
            "lastName": "Rhodes",
            "email": EMAIL,
            "password": PASSWORD,
        },
    )
    if status in (200, 201):
        ok(f"signed up {EMAIL}")
    elif status >= 500:
        # A 5xx here usually means the system database is not migrated yet —
        # worth failing loudly rather than limping into a confusing sign-in error.
        fail(f"sign-up failed with HTTP {status}", body)
    else:
        print(f"       sign-up returned {status} (expected if the account exists)")

    status, body = request(
        "POST", "/auth/signin", {"email": EMAIL, "password": PASSWORD}
    )
    if status not in (200, 201) or not isinstance(body, dict):
        fail("sign-in failed", body)
    TOKEN = pick(body, "accessToken", "access_token")
    org = pick(body, "organizationId", "organization_id")
    if not TOKEN or not org:
        fail("sign-in response missing token/organization", body)
    ORG_ID = str(org)
    ok(f"signed in, organization-id={ORG_ID}")


def guard_against_real_books():
    """Refuse to write dummy invoices into books that hold real money.

    The smoke test creates customers, invoices and payments. That is fine on a
    scratch stack and a disaster on the real one, so it checks what it is
    pointed at before it writes anything. `rpw/scripts/verify_stack.sh` runs it
    against a throwaway stack and sets RPW_ALLOW_REAL_BOOKS itself.
    """
    if os.environ.get("RPW_ALLOW_REAL_BOOKS") == "1":
        return
    status, body = request("GET", "/organization/current")
    name = ""
    if status == 200 and isinstance(body, dict):
        data = body.get("data") if isinstance(body.get("data"), dict) else body
        name = str(data.get("name") or "")
    if name and "test" not in name.lower():
        fail(
            f"refusing to run: '{name}' does not look like a test organization",
            "This test writes dummy invoices and payments. Run it against a "
            "scratch stack instead:  bash rpw/scripts/verify_stack.sh",
        )


def build_organization():
    step("Organization (tenant database + seed data)")
    status, body = request(
        "POST",
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
        job = pick(body, "jobId", "id")
        ok(f"organization build started (job {job})")
        if job:
            deadline = time.time() + 600
            while time.time() < deadline:
                s, b = request("GET", f"/organization/build/{job}")
                data = (b or {}).get("data") or b or {}
                if pick(data, "isCompleted"):
                    ok("organization build completed")
                    break
                if pick(data, "isFailed"):
                    fail("organization build failed", b)
                time.sleep(3)
            else:
                fail("organization build timed out")
        else:
            time.sleep(20)
    else:
        msg = json.dumps(body).upper()
        if "ALREADY" in msg or "INITIALIZED" in msg:
            ok("organization already built")
        else:
            fail("organization build request failed", body)

    status, body = request("GET", "/organization/current")
    if status != 200:
        fail("could not read the current organization", body)
    ok("organization is reachable")


def get_accounts():
    step("Chart of accounts")
    status, body = request("GET", "/accounts")
    if status != 200:
        fail("could not list accounts", body)
    accounts = body if isinstance(body, list) else (
        pick(body, "accounts") or (body or {}).get("data")
    )
    if not accounts:
        fail("chart of accounts is empty (tenant seeds did not run)", body)
    ok(f"{len(accounts)} accounts seeded")
    return accounts


def find_account(accounts, *slugs):
    for account in accounts:
        slug = (account.get("slug") or "").lower()
        name = (account.get("name") or "").lower()
        for wanted in slugs:
            if slug == wanted or name == wanted:
                return account
    return None


def main():
    print(f"\033[1mRPW Platform smoke test\033[0m  →  {BASE_URL}")
    wait_for_api()
    signup_and_signin()
    guard_against_real_books()
    build_organization()
    accounts = get_accounts()

    income = find_account(accounts, "sales-of-product-income", "sales of product income")
    cogs = find_account(accounts, "cost-of-goods-sold", "cost of goods sold")
    deposit = find_account(accounts, "bank-account", "checking-account", "bank account")
    if not income:
        income = next(
            a
            for a in accounts
            if (a.get("account_normal") or a.get("accountNormal")) == "credit"
        )
    if not deposit:
        deposit = next(
            a
            for a in accounts
            if (a.get("account_type") or a.get("accountType") or "") in ("bank", "cash")
        )

    step("Items catalog")
    status, item = request(
        "POST",
        "/items",
        {
            "name": f"Smoke Test {RUN_ID} — Audio Engineering (day rate)",
            "type": "service",
            "sellable": True,
            "sellPrice": 750,
            "sellAccountId": income["id"],
            "purchasable": False,
            "sellDescription": "Front-of-house audio engineering, per event day.",
        },
    )
    if status not in (200, 201):
        fail("could not create a service item", item)
    item_id = pick(item, "id")
    ok(f"service item created (id {item_id})")

    step("Customers (CRM base)")
    status, customer = request(
        "POST",
        "/customers",
        {
            "customerType": "business",
            "currencyCode": "USD",
            "displayName": f"Smoke Test Client {RUN_ID} — Xenia Community Church",
            "companyName": "Xenia Community Church",
            "email": "billing@example.com",
            "workPhone": "937-555-0100",
        },
    )
    if status not in (200, 201):
        fail("could not create a customer", customer)
    customer_id = pick(customer, "id")
    ok(f"customer created (id {customer_id})")

    today = date.today()
    entries = [
        {
            "index": 1,
            "itemId": item_id,
            "quantity": 2,
            "rate": 750,
            "description": "Two-day event: audio engineering",
        }
    ]

    step("RPW branded PDF template")
    status, template = request(
        "POST",
        "/pdf-templates",
        {
            "templateName": "RPW Standard — Invoice",
            "resource": "SaleInvoice",
            "attributes": {
                "primaryColor": "#141414",
                "secondaryColor": "#8a7a5c",
                "companyName": "Rhodes Production Works LTD",
            },
        },
    )
    if status not in (200, 201):
        fail("could not create the RPW branded template", template)
    template_id = pick(template, "id")
    status, resp = request("PUT", f"/pdf-templates/{template_id}/assign-default", {})
    if status not in (200, 201):
        fail("could not set the RPW template as default", resp)
    # This has to happen BEFORE the invoice is created: an invoice stamps the
    # then-current default template onto itself, so a template assigned later
    # would not apply to it.
    ok("RPW branded template created and set as the default")

    step("Estimate")
    status, estimate = request(
        "POST",
        "/sale-estimates",
        {
            "customerId": customer_id,
            "estimateDate": today.isoformat(),
            "expirationDate": (today + timedelta(days=30)).isoformat(),
            "entries": entries,
            "note": "Smoke test estimate.",
            "termsConditions": "50% deposit due on acceptance.",
        },
    )
    if status not in (200, 201):
        fail("could not create an estimate", estimate)
    ok("estimate created")

    step("Invoice (posts to the ledger)")
    status, invoice = request(
        "POST",
        "/sale-invoices",
        {
            "customerId": customer_id,
            "invoiceDate": today.isoformat(),
            "dueDate": (today + timedelta(days=14)).isoformat(),
            "delivered": True,
            "entries": entries,
            "invoiceMessage": "Smoke test invoice.",
            "termsConditions": "Net 14.",
        },
    )
    if status not in (200, 201):
        fail("could not create an invoice", invoice)
    invoice_id = pick(invoice, "id")
    ok(f"invoice created (id {invoice_id}) for $1,500.00")

    step("Invoice PDF (Gotenberg render)")
    status, pdf = request(
        "GET",
        f"/sale-invoices/{invoice_id}",
        headers={"Accept": "application/pdf"},
        raw=True,
    )
    if status != 200 or not isinstance(pdf, bytes) or not pdf.startswith(b"%PDF"):
        fail("invoice PDF did not render", pdf if not isinstance(pdf, bytes) else pdf[:200])
    ok(f"invoice PDF rendered ({len(pdf)} bytes)")

    step("RPW branded layout")
    status, html = request("GET", f"/sale-invoices/{invoice_id}/html", raw=True)
    if status != 200:
        fail("could not render the invoice HTML", html)
    markup = html.decode(errors="replace") if isinstance(html, bytes) else str(html)
    for needle in ("Lighting", "RPW"):
        if needle not in markup:
            fail(
                f"the branded template did not render (missing '{needle}')",
                markup[:400],
            )
    ok("branded layout renders (maker's-plate mark and footer present)")

    step("Payment received")
    status, payment = request(
        "POST",
        "/payments-received",
        {
            "customerId": customer_id,
            "paymentDate": today.isoformat(),
            "amount": 1500,
            "depositAccountId": deposit["id"],
            "referenceNo": f"SMOKE-{RUN_ID}",
            "entries": [{"index": 1, "invoiceId": invoice_id, "paymentAmount": 1500}],
        },
    )
    if status not in (200, 201):
        fail("could not record a payment", payment)
    ok("payment recorded against the invoice")

    step("Vendors, bills and expenses (purchase side)")
    status, vendor = request(
        "POST",
        "/vendors",
        {
            "currencyCode": "USD",
            "displayName": f"Smoke Test Vendor {RUN_ID} — Stage Gear Supply",
            "companyName": "Stage Gear Supply",
        },
    )
    if status not in (200, 201):
        fail("could not create a vendor", vendor)
    vendor_id = pick(vendor, "id")
    ok(f"vendor created (id {vendor_id})")

    cogs_account = cogs or find_account(accounts, "cost-of-goods-sold")
    if not cogs_account:
        cogs_account = next(
            a
            for a in accounts
            if (a.get("account_type") or a.get("accountType") or "") == "cost-of-goods-sold"
        )
    status, purchase_item = request(
        "POST",
        "/items",
        {
            "name": f"Smoke Test {RUN_ID} — Subcontracted Labour",
            "type": "service",
            "purchasable": True,
            "costPrice": 200,
            "costAccountId": cogs_account["id"],
            "sellable": False,
            "purchaseDescription": "Subcontracted stagehand, per event day.",
        },
    )
    if status not in (200, 201):
        fail("could not create a purchasable item", purchase_item)
    purchase_item_id = pick(purchase_item, "id")
    ok(f"purchasable item created (id {purchase_item_id})")

    status, bill = request(
        "POST",
        "/bills",
        {
            "vendorId": vendor_id,
            "billNumber": f"SMOKE-BILL-{RUN_ID}",
            "billDate": today.isoformat(),
            "dueDate": (today + timedelta(days=30)).isoformat(),
            "open": True,
            "entries": [
                {
                    "index": 1,
                    "itemId": purchase_item_id,
                    "quantity": 1,
                    "rate": 200,
                    "description": "Subcontracted stagehand",
                }
            ],
            "note": "Smoke test bill.",
        },
    )
    if status not in (200, 201):
        fail("could not create a bill", bill)
    ok("bill created")

    expense_account = find_account(accounts, "other-expenses", "other expenses")
    if not expense_account:
        expense_account = next(
            a
            for a in accounts
            if (a.get("account_type") or a.get("accountType") or "").startswith("expense")
        )
    status, expense = request(
        "POST",
        "/expenses",
        {
            "paymentDate": today.isoformat(),
            "paymentAccountId": deposit["id"],
            "referenceNo": f"SMOKE-EXP-{RUN_ID}",
            "description": "Smoke test expense — fuel for the box truck.",
            "publish": True,
            "categories": [
                {
                    "index": 1,
                    "expenseAccountId": expense_account["id"],
                    "amount": 85,
                    "description": "Fuel",
                }
            ],
        },
    )
    if status not in (200, 201):
        fail("could not record an expense", expense)
    ok("expense recorded")

    step("Financial reports")
    reports = {
        "Profit & Loss": "/reports/profit-loss-sheet",
        "Balance sheet": "/reports/balance-sheet",
        "Trial balance": "/reports/trial-balance-sheet",
        "General ledger": "/reports/general-ledger",
        "Cash flow": "/reports/cashflow-statement",
        "A/R aging": "/reports/receivable-aging-summary",
        "A/P aging": "/reports/payable-aging-summary",
        "Journal": "/reports/journal",
        "Sales tax liability": "/reports/sales-tax-liability-summary&basis=cash",
        "Customer balances": "/reports/customer-balance-summary",
    }
    year_start = date(today.year, 1, 1).isoformat()
    year_end = date(today.year, 12, 31).isoformat()
    failed = []
    for label, path in reports.items():
        # A couple of reports take extra query params; they are appended to the
        # path above with "&" and spliced in here.
        path, _, extra = path.partition("&")
        query = f"fromDate={year_start}&toDate={year_end}"
        if extra:
            query = f"{query}&{extra}"
        s, b = request("GET", f"{path}?{query}")
        if s != 200:
            failed.append((label, s, b))
        else:
            ok(f"{label} report rendered")
    if failed:
        for label, s, b in failed:
            print(f"  \033[31mFAIL\033[0m {label} → HTTP {s}: {str(b)[:300]}")
        sys.exit(1)

    step("Ledger sanity check")
    s, pl = request(
        "GET", f"/reports/profit-loss-sheet?fromDate={year_start}&toDate={year_end}"
    )
    totals = {}

    def collect(node):
        if isinstance(node, dict):
            name = node.get("name")
            total = node.get("total")
            if name and isinstance(total, dict):
                totals[name] = total.get("amount", 0)
            for key in ("children", "nodes"):
                if isinstance(node.get(key), list):
                    for child in node[key]:
                        collect(child)
        elif isinstance(node, list):
            for child in node:
                collect(child)

    collect((pl or {}).get("data") or pl)
    income = totals.get("Income", 0)
    net = totals.get("NET INCOME", totals.get("Net income", 0))
    if not income:
        fail("the invoice did not post to income in the profit & loss report", totals)
    ok(f"P&L shows income {income} and net income {net} — the ledger is posting")

    step("Attachments (object storage)")
    import io
    import uuid

    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
        "0000000d4944415478da63f8cfc00000030101001836dd8f0000000049454e44ae426082"
    )
    boundary = "----rpw" + uuid.uuid4().hex
    buffer = io.BytesIO()
    buffer.write(f"--{boundary}\r\n".encode())
    buffer.write(
        b'Content-Disposition: form-data; name="file"; filename="smoke-test.png"\r\n'
    )
    buffer.write(b"Content-Type: image/png\r\n\r\n")
    buffer.write(png)
    buffer.write(f"\r\n--{boundary}--\r\n".encode())

    status, uploaded = request(
        "POST",
        "/attachments",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        body_bytes=buffer.getvalue(),
    )
    if status not in (200, 201):
        fail("could not upload an attachment — is object storage running?", uploaded)
    file_key = pick(uploaded, "key")
    if not file_key:
        fail("the upload returned no storage key", uploaded)
    ok(f"attachment stored in object storage ({file_key})")

    status, resp = request("DELETE", f"/attachments/{quote(file_key, safe='')}")
    if status not in (200, 204):
        fail("could not delete the uploaded attachment", resp)
    ok("attachment deleted again")

    step("RPW sales tax scaffolding (Ohio multi-county)")
    status, counties = request("GET", "/rpw/sales-tax/counties")
    if status != 200 or not isinstance(counties, list) or not counties:
        fail("could not read the county rate table", counties)
    by_name = {c.get("county_name") or c.get("countyName"): c for c in counties}
    greene = by_name.get("Greene")
    if not greene:
        fail("Greene County is missing from the rate table", sorted(by_name)[:10])
    ok(f"{len(counties)} counties loaded; Greene at {greene.get('combined_rate') or greene.get('combinedRate')}%")

    unverified = [c for c in counties if not (c.get("verified_at") or c.get("verifiedAt"))]
    if len(unverified) != len(counties):
        fail("counties should ship unverified until a human checks them against ODT")
    ok("every county ships unverified — collection cannot be switched on by accident")

    status, resp = request("PUT", "/rpw/sales-tax/settings", {"collectionEnabled": True})
    if status != 400:
        fail("enabling collection with unverified rates should have been refused", resp)
    ok("enabling collection is refused while rates are unverified")

    status, resp = request(
        "POST",
        "/rpw/sales-tax/transaction-county",
        {
            "transactionType": "SaleInvoice",
            "transactionId": invoice_id,
            "countyId": greene["id"],
        },
    )
    if status not in (200, 201):
        fail("could not record a job-site county on the invoice", resp)
    ok("job-site county recorded against the invoice")

    status, resp = request("GET", f"/rpw/sales-tax/transaction-county/SaleInvoice/{invoice_id}")
    if status != 200 or not resp:
        fail("could not read the job-site county back", resp)
    ok("job-site county reads back")

    status, documents = request(
        "GET", f"/rpw/sales-tax/documents?fromDate={year_start}&toDate={year_end}"
    )
    if status != 200 or not isinstance(documents, list) or not documents:
        fail("the documents list did not come back", documents)
    invoice_row = next(
        (
            d
            for d in documents
            if (d.get("transaction_type") or d.get("transactionType")) == "SaleInvoice"
            and (d.get("transaction_id") or d.get("transactionId")) == invoice_id
        ),
        None,
    )
    if not invoice_row:
        fail("the invoice is missing from the documents list", documents[:3])
    if (invoice_row.get("county_name") or invoice_row.get("countyName")) != "Greene":
        fail("the invoice's job-site county did not come back", invoice_row)
    estimate_rows = [
        d
        for d in documents
        if (d.get("transaction_type") or d.get("transactionType")) == "SaleEstimate"
    ]
    if not estimate_rows:
        fail("estimates are missing from the documents list", documents[:3])
    ok(
        f"documents list shows {len(documents)} document(s); the invoice carries Greene "
        f"and {sum(1 for d in documents if not (d.get('county_id') or d.get('countyId')))} "
        "still need a county"
    )

    status, summary = request(
        "GET", f"/rpw/sales-tax/reports/county-summary?fromDate={year_start}&toDate={year_end}"
    )
    if status != 200:
        fail("county summary report failed", summary)
    rows = summary.get("rows") or []
    if not any((r.get("county_name") or r.get("countyName")) == "Greene" for r in rows):
        fail("the invoice did not show up under Greene in the county summary", summary)
    ok("county summary reports the invoice under Greene")

    step("Web app")
    status, html = request("GET", BASE_URL, raw=True)
    if status != 200 or b"<div id=\"root\"" not in html and b"<html" not in html.lower():
        fail("web app did not serve its HTML shell", html[:200] if isinstance(html, bytes) else html)
    ok("web app shell served through the proxy")

    print("\n\033[1;32mAll smoke-test steps passed.\033[0m")
    print(f"Open {BASE_URL} and sign in as {EMAIL}.\n")


if __name__ == "__main__":
    main()
