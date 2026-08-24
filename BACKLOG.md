# BACKLOG.md — known issues and deferred work

Things noticed but consciously not done yet, so they are not lost. Phases live in
`PROJECT_BRIEF.md`; this is the smaller stuff that comes up along the way.

## Mobile layout (noticed 2026-08-20, from Josh's phone)

The RPW pages — Ohio Sales Tax, Clients, Document Designer — were written
desktop-first and do not survive a phone screen: the sidebar stays expanded over
the content, and the rate/document tables run off the right edge.

Upstream's app is desktop-first too, so this is partly inherited, but our pages
made it worse by using fixed widths and wide tables. Worth doing after the
current phase work: responsive widths, horizontal scroll containers on tables,
and checking whether upstream's sidebar has a collapse behaviour we are not
triggering.

Not urgent — the real bookkeeping work happens on the laptop — but "check the
follow-ups" and "look at a client's history" are exactly the things worth doing
from a phone, so the Clients page deserves it first.

## Stray "Enter API key name" field (noticed 2026-08-20)

A `Name / Enter API key name` input appears pinned at the bottom of the Ohio
Sales Tax page on mobile. It belongs to the API keys preferences UI and has no
business rendering there.

The suspicion worth checking first: it may be mounted on every page and merely
invisible on desktop, in which case this is an upstream layout bug that the
narrow screen exposed rather than a mobile-only glitch.

## Email body is unbranded (noticed 2026-08-19)

Estimate and invoice emails use upstream's stock template. That was the Phase 1
scope ("plain, professional"), but the email and the PDF now look like they come
from different companies. Branding the email body to match is a contained job.

## Logo does not appear in emails

The email header logo needs a publicly reachable image URL; ours is on the
internal Docker network. Same root cause as the disabled "View Estimate" button
— both resolve when Phase 2 gives the app a public hostname.

## Stale browser state renders a blank /setup instead of the login page (2026-08-24)

When the SPA boots with a stored organization id that no longer exists, every
API call answers 401 "Organization not found" — and the app routes to the
setup wizard, which renders nothing, instead of clearing its state and showing
the login page. Hit by Josh after the Aug 19 org rebuild; any restore or
rebuild reproduces it. Upstream bug; the right fix is boot-level: a 401 with
ORGANIZATION-flavoured errors should wipe local auth state and land on /auth/login.
Workaround: DevTools → Application → Clear site data.

Related: the auth throttle group (30 req/min shared across everything behind
Envoy) was raised to 600 in .env on 2026-08-24 — at Phase 2, rate limiting
belongs at the Cloudflare edge instead, keyed on real client IPs.
