# rental-calc — project notes

Coach Inayah rental-revenue calculator + white-label LLC filing (coachinayahturnkeytool.com). React + tRPC + Drizzle/MySQL, hosted on Manus (deploys = pull main + redeploy; migrations unreliable, so schema changes need boot-time idempotent ensure guards).

## The four-app LLC system — read before "integrating" anything

One business (Bryson's), four apps, one filing engine. Every repo below runs the SAME doola-powered LLC engine (`server/llc/`) against the SAME doola partner account. If it's connected to doola, it's all the same system — already connected, nothing to wire.

| Repo | Brand / domain | Role |
|---|---|---|
| `repo` (llc-formation) | Northform — bizcreditana-2aqtn4uc.manus.space | Original build. Holds doola's ONE webhook slot and relays each verified event verbatim to the siblings (`LLC_WEBHOOK_RELAY_URLS`). |
| `rental-calc` | Coach Inayah turnkey tool — coachinayahturnkeytool.com | Rental calculator + LLC filing, ops at `/admin/llc`. |
| `business-credit-analyzer` | **BuildMyLLC** — buildmyllc.com (brand lineage: Coach Inayah → 0% Funded → BuildMyLLC) | $0-service-fee consumer front door, LLC-first homepage, native iOS app (`ios-app` branch). |
| `her-first-order-tools` | Her First Order — herfirstorder.com | LLC filing as a members-only course benefit; completion feeds the member journey (`m1-llc` milestone). |

Facts that save a wasted session:

- **BuildMyLLC is a brand, not a service.** It is `business-credit-analyzer` deployed at buildmyllc.com. There is NO BuildMyLLC API, connector, or credential — nothing to integrate. A task saying "connect X to BuildMyLLC" means branding or marketing links, never plumbing.
- **Every app files with doola directly** (`DOOLA_API_BASE_URL` is hard-pinned to api.doola.com / api.test.doola.com). No app submits filings through another app, and none exposes an endpoint that accepts filings from a sibling. New filings never route through Whop — Whop code paths serve legacy rows only.
- **Status flow:** doola allows one webhook endpoint per environment; it hits Northform, which relays to the siblings; every app also polls as a backstop. Each app knows only its own orders — an order's data, documents, and ops view live in the app where it was created.
- **Shared secrets, by NAME only** (values go straight into each app's Manus environment settings — never into chat, code, or docs): `DOOLA_API_KEY` (same partner account), `DOOLA_WEBHOOK_SECRET` (shared, so relayed signatures verify everywhere), `PII_ENCRYPTION_KEY` (64 hex chars; operator decision: the same value may be reused across apps).
- The only app-to-app API is business-credit-analyzer's partner intake (credit-analysis only, `x-api-key`), consumed by HFO and rental-calc. It does not carry filings.
- **White-label is absolute:** "doola" and "whop" never appear in client payloads, client-facing pages, or client emails. The provider's own operating-agreement copy is permanently locked; each app generates its own branded operating agreement.
