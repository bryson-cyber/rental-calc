# Test State — d845750 Deploy

## Current Status
- **Deployed commit:** d845750 (PR #16: engagement dedup fix + deal expiry)
- **Mihela listing:** retired (status='removed')
- **Owner reply counter:** reset to 0
- **Owner phone:** 702-521-8792 (7025218792)
- **Owner email:** bryson@stayly.com
- **Webinar:** 386 ("Webby 7.26.26")

## What's Done
- ✅ Phase 3 coverage convergence: 127/1728 located (7.3%), 13 with deal
- ✅ Carryover fix verified: owner at v5, source="carryover", link q1j3ycw2 → /share/vVYD64C4Kg
- ✅ YES reply processed (16:47:35 UTC), deal message sent
- ✅ Email-dispatch heartbeat job created and running
- ✅ All 3 heartbeat jobs confirmed alive

## What's Next — Phoenix Test
1. Text "what about phoenix az" from owner phone
2. Expected: reply acknowledges Phoenix, live Phoenix scan kicks off
3. Within 1-2 cycles: reply carries Phoenix deal with /l/ link → /share report
4. City override becomes durable
5. Arizona timezone: America/Phoenix (no DST)

## Known Issues
- TypeScript errors in server/routers/webinar-sms.ts (3 errors) — non-blocking for runtime
- RegulationTracker: 'Data too long' errors for occupancyTax/registrationFee columns
- The 4x engagement question bug is now fixed in d845750

## Part B Remaining Steps (after Phoenix test)
- Loop cap test: after 3 replies, system should stop responding
- STOP test: reply STOP, verify optedOut=1

## Parts C & D Still TODO
- Part C: HubSpot priority properties verification after YES reply
- Part C: Daily digest (should arrive after 14:00 UTC)
- Part D: Compressed dress rehearsal with test webinar
