# Acceptance Test Results

## Part A — Production Data Checks

### 1. Coverage (webinar 386)
- **Total registrants:** 1,721
- **Located (version 4):** 7
- **With deal:** 7
- **Located rate:** 0.4% (7/1721)

Low located-rate is due to HubSpot 429 rate-limiting during enrichment. Only 7 contacts were successfully looked up before the rate limit hit. The ceiling is whatever % of contacts have `data_perfection__city` in HubSpot.

### 2. Payload Sanity ✅
All 8 enriched registrants have:
- Real cities (Las Vegas, Charlotte, Florence, Camden, Indianapolis, Dallas, Streamwood)
- Source: "hubspot" (all)
- Sensible timezones (America/Los_Angeles, America/New_York, America/Chicago)

### 3. Newsletter Deals ✅
10 newest deals all have:
- Real Zillow URLs (valid zpid format)
- Plausible rent vs revenue: Dallas $3,400 rent → $6,935/mo rev; Indianapolis $2,250 rent → $7,075/mo rev; Camden $2,600 rent → $7,209/mo rev
- Cities match enriched registrant cities

### 4. Shared Reports
Only 2 old test reports exist (Denver, Jan 2026). No new property reports generated yet for the personalization pipeline cities. This is expected — the report backfill hasn't run yet.

### 5. Regulation Cache ✅
Recent entries (all from today 04:23-04:26 UTC):
- Dallas, TX: restricted
- Indianapolis, IN: allowed_with_permit
- Las Vegas, NV: allowed_with_permit
- Florence, SC: allowed_with_permit

None are "unknown" — all have real determinations.

### 6. Tokenized Copy ✅
Pending sequence messages:
- 2 Days Before Reminder: tokenized ✅
- Day Before Reminder: tokenized ✅
- Morning Of: tokenized ✅
- Missed You (No-Show): tokenized ✅
- 3 Hours Before, 15 Min Before, Starting NOW, No-Show Nudge, Thank You, Follow-Up CTA: NOT tokenized (these are short/action messages without city-relevant content — correct behavior)

### Error Lines
- [Engagement] Question send failures: all are LOCAL_OPT_OUT or INVALID_CONTACT from SimpleTexting (expected for recycled/invalid numbers in the list)
- No [Personalization], [DealReport], or [SequenceUpgrade] error lines found
