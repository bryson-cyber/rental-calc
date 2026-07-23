# Acceptance Test State — Saved at 11:50 UTC Jul 23 2026

## Completed

### Phase 1: Deploy
- Version 8619ad2b deployed with batch-read fix (main @ cfabccd)
- All 3 heartbeat jobs active: webinar-import (3min), sms-dispatch (60s), email-dispatch (60s)

### Phase 2: Owner Phone Registration
- Registrant ID: 2791810
- Phone: 7025218792, Email: bryson@stayly.com
- Confirmation SMS: 124 chars, clean (no deal line), SimpleTexting 201
- Confirmation email: sent
- Calendar invite: sent
- Personalization payload: version 4, city Las Vegas, deal present (3-bed $6636/mo rev, $3619/mo profit)
- Deal short link: /l/q1j3ycw2
- Zillow URL: https://www.zillow.com/homedetails/10452-Mihela-Ave-Las-Vegas-NV-89129/61743081_zpid/

### Phase 3: Coverage Convergence — PLATEAU REACHED
- Total: 1,728 registrants
- Located (v4): 127 (7.3%)
- With deal: 13 (0.8% of total, 10.2% of located)
- No city cached (24h miss): 1,601 (92.7%)
- Truly unscanned: 0
- TRUE data_perfection__city fill rate: 7.3%
- No "HubSpot rate limited" lines after batch fix

## Pending

### Part B: Conversation Test (after 15:00 UTC / 8 AM Pacific)
- Owner phone already registered (ID 2791810)
- Engagement question fires automatically on first import cycle after 15:00 UTC
- Test sequence: YES reply → deal message + link → city override ("what about pheonix az") → loop cap (3 replies) → STOP test
- Need second owner phone for city override and STOP test

### Part C: HubSpot + Digest
- After YES reply: check webinar_lead_priority, webinar_reply_intent, webinar_reply_city, webinar_funding_qualified, webinar_funding_readiness
- Daily digest arrives after 14:00 UTC

### Part D: Compressed Dress Rehearsal
- Create TEST webinar with 2 owner phones
- Compressed sequence timing
- Verify SMS/email rendering, delivery table, personalized_links clicks

## Key Scripts
- convergence-check.mjs: Coverage query
- part-a-check.mjs: Full Part A SQL checks
- stage2-send.mjs: Register owner phone via tRPC

## Kill Switches (in webinar_sms_settings)
- personalization_live_scan: currently 'off'
- sms_engagement: (check before Part B)
- daily_digest: (check before Part C)
