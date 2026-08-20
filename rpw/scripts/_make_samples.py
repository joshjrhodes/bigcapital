#!/usr/bin/env python3
"""Creates one estimate and one invoice and saves their PDFs. Driven by
`make_sample_pdfs.sh`, which points it at a disposable stack."""

import os
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _api import Api, fail, ok, step  # noqa: E402

OUT_DIR = Path(os.environ.get("RPW_SAMPLE_DIR", Path.home()))
# When set, the sample estimate is also emailed there — the point being to
# exercise the app's own queued mail path, which is a different thing from SMTP
# credentials being correct.
EMAIL_TO = os.environ.get("RPW_SAMPLE_EMAIL", "").strip()
EMAIL = os.environ["RPW_ADMIN_EMAIL"]
PASSWORD = os.environ["RPW_ADMIN_PASSWORD"]


def main():
    api = Api()
    api.wait_until_up()
    api.sign_in(EMAIL, PASSWORD)

    step("Sample documents")
    _, body = api.get("/items")
    items = body if isinstance(body, list) else None
    if items is None and isinstance(body, dict):
        # The list endpoint answers with either {items: [...]} or a paginated
        # {items: {results: [...]}} depending on the query.
        items = body.get("items") or body.get("data") or []
        if isinstance(items, dict):
            items = items.get("results") or []
    items = items or []
    if not items:
        fail("no items found in the scratch organization", body)
    by_name = {(i.get("name") or ""): i for i in items}

    def item_id(name):
        for key, value in by_name.items():
            if key.startswith(name):
                return value["id"]
        fail(f"item not found: {name}", sorted(by_name))

    _, customer = api.post(
        "/customers",
        {
            "customerType": "business",
            "currencyCode": "USD",
            "displayName": "Xenia Community Church",
            "companyName": "Xenia Community Church",
            "email": "office@example.org",
            "workPhone": "937-555-0142",
            "billingAddress1": "1400 W Second St",
            "billingAddressCity": "Xenia",
            "billingAddressState": "OH",
            "billingAddressPostcode": "45385",
            "billingAddressCountry": "US",
        },
    )
    customer_id = api.pick(customer, "id")
    ok("sample client created")

    today = date.today()
    entries = [
        {
            "index": 1,
            "itemId": item_id("Event Production"),
            "quantity": 2,
            "rate": 950,
            "description": "Two-day Easter production — load-in, show, strike.",
        },
        {
            "index": 2,
            "itemId": item_id("Audio Engineering"),
            "quantity": 2,
            "rate": 750,
            "description": "Front-of-house engineering, both services.",
        },
        {
            "index": 3,
            "itemId": item_id("Lighting Design"),
            "quantity": 1,
            "rate": 750,
            "description": "Lighting design and plot for the sanctuary.",
        },
        {
            "index": 4,
            "itemId": item_id("Equipment Sub-Rental"),
            "quantity": 1,
            "rate": 480,
            "description": "Six moving heads, cross-rented for the weekend.",
        },
    ]

    _, estimate = api.post(
        "/sale-estimates",
        {
            "customerId": customer_id,
            "estimateDate": today.isoformat(),
            "expirationDate": (today + timedelta(days=30)).isoformat(),
            "entries": entries,
            "note": "Crew of four. Power and rigging provided by the venue.",
            "termsConditions": "Estimate valid for 30 days. A signed acceptance and deposit hold the date.",
        },
    )
    estimate_id = api.pick(estimate, "id")

    _, invoice = api.post(
        "/sale-invoices",
        {
            "customerId": customer_id,
            "invoiceDate": today.isoformat(),
            "dueDate": (today + timedelta(days=14)).isoformat(),
            "delivered": True,
            "entries": entries,
            "invoiceMessage": "Thanks — it was a good weekend of work.",
            "termsConditions": "Net 14. Equipment remains the property of Rhodes Production Works LTD until paid in full.",
        },
    )
    invoice_id = api.pick(invoice, "id")
    ok("sample estimate and invoice created")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # The HTML is what Gotenberg turns into the PDF. Saving it too makes design
    # review quick (open it in a browser) and makes it obvious whether the logo
    # actually resolved.
    status, html = api.request(
        "GET", f"/sale-invoices/{invoice_id}/html", raw=True
    )
    if status == 200 and isinstance(html, bytes):
        (OUT_DIR / "rpw-sample-invoice.html").write_bytes(html)
        markup = html.decode(errors="replace")
        if "<img" in markup:
            ok("invoice HTML carries the logo image")
        else:
            ok("invoice HTML rendered (no logo image — placeholder mark in use)")

    for label, path, out_name in (
        ("estimate", f"/sale-estimates/{estimate_id}", "rpw-sample-estimate.pdf"),
        ("invoice", f"/sale-invoices/{invoice_id}", "rpw-sample-invoice.pdf"),
    ):
        status, pdf = api.request(
            "GET", path, headers={"Accept": "application/pdf"}, raw=True
        )
        if status != 200 or not isinstance(pdf, bytes) or not pdf.startswith(b"%PDF"):
            fail(f"could not render the {label} PDF", pdf[:200] if isinstance(pdf, bytes) else pdf)
        target = OUT_DIR / out_name
        target.write_bytes(pdf)
        ok(f"{label} → {target} ({len(pdf):,} bytes)")

    if EMAIL_TO:
        step("Emailing the sample estimate")
        status, state = api.get(f"/sale-estimates/{estimate_id}/mail")
        if status != 200:
            fail("could not read the mail defaults", state)
        defaults = (state or {}).get("data") or state or {}
        payload = {
            "to": [EMAIL_TO],
            "subject": defaults.get("subject")
            or "Estimate from Rhodes Production Works",
            "message": defaults.get("message") or "Please find the estimate attached.",
            "attachEstimate": True,
        }
        status, resp = api.post(f"/sale-estimates/{estimate_id}/mail", payload)
        if status not in (200, 201):
            fail("the app could not queue the estimate email", resp)
        ok(f"estimate queued for delivery to {EMAIL_TO}")
        # Sending runs on a background queue, so give the worker a moment and
        # then say plainly that the inbox is the real proof.
        import time

        time.sleep(12)
        ok("give it a minute, then check the inbox (and spam on a first send)")


if __name__ == "__main__":
    main()
