# Live Test Runbook — Webinar Personalization

For the agent operating the production environment. Verifies the personalization
pipeline (PR #5) against the real database, HubSpot, HasData, BNB Calc, and
SimpleTexting — in stages, so no real lead gets a test message and no API spend
happens before the passive checks pass.

Ground rules:
- Never send test messages to real registrants. Stages that send SMS/email use
  the owner's own phone/email only.
- Column names below assume the drizzle schema (`settingKey`/`settingValue`,
  camelCase columns). Run `DESCRIBE <table>` first if unsure.
- Kill switch at any point:
  `UPDATE webinar_sms_settings SET settingValue='off' WHERE settingKey='personalization_live_scan';`
  (insert the row if missing). Takes effect next import cycle.

---

## Stage 0 — deploy with live scans OFF

1. Before or immediately after deploy:
   ```sql
   INSERT INTO webinar_sms_settings (settingKey, settingValue)
   VALUES ('personalization_live_scan', 'off')
   ON DUPLICATE KEY UPDATE settingValue = 'off';
   ```
2. Confirm the import cron still completes: logs show
   `[Scheduled] webinar-import completed in <ms>` with no new errors.

## Stage 1 — passive verification (no spend, no sends)

After 1–2 import cycles (≈6 min):

1. **Enrichment ran** — logs contain
   `[Personalization] webinar <id>: X enriched (Y with claimable deal), Z without location`.
2. **Payloads written**:
   ```sql
   SELECT id, email,
     JSON_EXTRACT(metadata,'$.personalization.version')  AS ver,
     JSON_EXTRACT(metadata,'$.personalization.city')     AS city,
     JSON_EXTRACT(metadata,'$.personalization.source')   AS source,
     JSON_EXTRACT(metadata,'$.personalization.timezone') AS tz
   FROM webinar_registrants
   WHERE webinarId = '<current-webinar-id>'
   LIMIT 20;
   ```
   Expect `ver = 3`, `source` mostly `"hubspot"`, sensible cities/timezones.
3. **Coverage rate** (the number that matters):
   ```sql
   SELECT COUNT(*) AS total,
     SUM(JSON_EXTRACT(metadata,'$.personalization.version') = 3)        AS located,
     SUM(JSON_EXTRACT(metadata,'$.personalization.deal') IS NOT NULL)   AS with_deal
   FROM webinar_registrants
   WHERE webinarId = '<current-webinar-id>' AND email IS NOT NULL AND email != '';
   ```
   If `located` is low, spot-check 2–3 emails directly in HubSpot — do those
   contacts have `data_perfection__city` set? That determines the ceiling.
4. **Sequence copy upgraded in place** — stock pending rows only:
   ```sql
   SELECT id, sequenceName, status,
          messageBody LIKE '%[IF\_%' AS tokenized
   FROM scheduled_sms_messages
   WHERE webinarId = '<current-webinar-id>';
   ```
   Expect: pending rows that carried stock copy → `tokenized = 1`; `sent` rows
   and any admin-customized bodies unchanged. Log line: `[SequenceUpgrade] ...`.
5. **Confirmation template**:
   ```sql
   SELECT settingValue FROM webinar_sms_settings WHERE settingKey='confirmation_sms_template';
   ```
   Contains `[IF_DEAL]` only if it was still the stock text.

## Stage 2 — one safe end-to-end send (owner only)

1. From the admin panel, manually add a registrant using the owner's own phone
   and an email that exists in HubSpot with a city (e.g. the owner's). The
   manual-add path computes personalization inline and fires the instant
   confirmation SMS + email.
2. Verify on the received text and email:
   - No `[IF_` markers, no raw `%TOKEN%` placeholders, no `{{...}}`.
   - If that city has a fresh claimable deal: the deal line reads with real
     dollars. If not (expected while scans are off): clean generic copy. Both
     are correct outcomes — broken rendering is the only failure.
3. Check the row's metadata got the payload:
   ```sql
   SELECT JSON_PRETTY(metadata) FROM webinar_registrants WHERE email = '<owner-email>' ORDER BY id DESC LIMIT 1;
   ```

## Stage 3 — enable live scans, watch spend

1. `UPDATE webinar_sms_settings SET settingValue='on' WHERE settingKey='personalization_live_scan';`
2. Watch 3–4 import cycles. Expect `[Personalization] Live scan for <city>, <state>`
   lines, **at most 2 cities per cycle**. Backlog note: with many distinct lead
   cities the steady state is up to ~40 city scans/hour until the backlog
   drains. Per city: 1 HasData listing call (5 credits) + ≤5 rentalizer (BNB
   Calc) calls + ≤1 regulation research per 7 days. If spend looks wrong, flip
   the kill switch.
3. Sanity-check generated deals:
   ```sql
   SELECT city, state, bedrooms, monthlyRent,
          ROUND(projectedRevenue/12) AS rev_mo,
          ROUND(projectedProfit/12)  AS profit_mo,
          dealScore, sourceUrl
   FROM newsletter_deals
   ORDER BY discoveredAt DESC LIMIT 10;
   ```
   Numbers should be plausible (rev_mo > rent for good deals; profit_mo is
   rev − rent − 20% opex). Click 1–2 `sourceUrl`s — they must be real Zillow
   listings in that city.
4. Regulation rows for scanned cities:
   ```sql
   SELECT city, state, status, confidence FROM regulation_cache ORDER BY updatedAt DESC LIMIT 10;
   ```
   Statuses should mostly not be `unknown`; `unknown` rows are correctly
   excluded from messages.
5. Re-run the Stage 1 coverage query — `with_deal` should climb as scans drain.

## Stage 4 — dress rehearsal before the next real class

1. Create a TEST webinar with 2–3 internal registrants on owner-controlled
   phones, including one with a Pacific-state HubSpot city.
2. Generate the sequence with compressed custom timing so it fires within the
   hour, and let the dispatcher send it for real.
3. Verify:
   - Received texts show correct city/deal rendering per registrant.
   - `webinar_sms_deliveries`: `sent` rows for in-window leads; if a send falls
     outside 8am–9pm in the Pacific registrant's local time, their row shows
     `deliveryStatus='skipped'` with the quiet-hours error.
   - `personalized_links` rows exist per lead (`campaignType='webinar_deals'`);
     clicking a `/l/<code>` link opens the tool's public Property Analysis
     report for the deal (the `/share/<code>` page, same as any universal
     shareable report, NO login required) with a "View Listing on Zillow"
     button in the header, and increments `clickCount`. A lead with a deal
     but no report yet falls back to the Zillow listing directly — and a YES
     reply builds the report on demand so this fallback should be rare.
4. Emails: trigger the day-before email for the test webinar; confirm the
   "Near {city}" card renders for the lead with a deal and is absent (not
   broken) for the lead without one.

## Stage 5 — two-way engagement flow (owner phone only)

1. Kill switch exists: `webinar_sms_settings` key `sms_engagement` = `off`
   disables both the question and reply handling. Leave it ON for this stage.
2. Register the owner's phone as a manual test registrant. Expect two texts:
   the clean confirmation, then ~2–5 minutes later (next import cycles) the
   engagement question ("...Reply YES and I'll send you what my scanner found
   near you. Or text me the city you're curious about.").
3. Reply `YES` → within ~3 minutes (next poll cycle) expect the deal message
   for the city on file, with the `/l/<code>` report link.
4. From a second owner phone (fresh registrant), reply with a different city
   (e.g. `what about phoenix az`) → expect that city scanned and its numbers
   sent back; the registrant's payload city should switch to the texted city
   (`JSON_EXTRACT(metadata,'$.engagement.cityOverride')`).
5. Reply a third time and then a fourth — after 3 automated replies the system
   must go silent (loop cap).
6. Safety checks: leads confirmed more than 48h before deploy are never asked;
   the inbound watermark (`engagement_last_inbound_ts`) starts at deploy time
   so historical inbox traffic is never touched; `STOP`-like replies set
   `optedOut` and get no response.

## Stage 6 — lead priority + daily digest

1. After a YES/city reply in Stage 5, check the owner-phone contact in
   HubSpot: `webinar_lead_priority` (hot/warm/standard), `webinar_reply_intent`,
   `webinar_reply_city`, `webinar_funding_qualified`, `webinar_funding_readiness`
   should be set (properties are auto-created on first sync). "hot" requires
   the contact to be funding-qualified via the soft pull AND engaged.
2. The daily digest fires once per day after 14:00 UTC via the owner
   notification channel: registrant counts, coverage, replies by intent, hot
   leads to call, city scans, STOP warnings. Kill switch:
   `webinar_sms_settings` key `daily_digest` = `off`.

## Success criteria

- Stage 1: ≥1 enrichment log per cycle; pending stock copy tokenized; located
  rate consistent with HubSpot city fill.
- Stage 2: rendered messages contain no markers/placeholders under any data
  condition.
- Stage 3: scans bounded as specified; generated deals point to real listings
  with plausible numbers.
- Stage 4: per-lead rendering, quiet-hours skip, and link tracking all observed
  on real devices.

## Rollback

- Live scans only: kill switch (above).
- Everything: revert the PR merge commit — messaging falls back to stock copy;
  payloads in `metadata` are inert without the rendering code.
