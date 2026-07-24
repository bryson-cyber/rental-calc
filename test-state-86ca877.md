# Test State - Commit 86ca877

## Deploy Status
- Commit: 86ca877 deployed and live (version 86ca8770)
- Kill switch: SET TO 'on' (scans enabled)
- Owner reply counter: reset to 0
- Domains: rentalcalc-dguybt3j.manus.space, inayahcalc.manus.space, coachinayahturnkeytool.com

## Observations After ~10 Minutes

### DealReport Lines ✅
```
[2026-07-24T16:04:11.706Z] [ShareableReport] Created validator report with code: 86KLdGKxbG
[2026-07-24T16:04:11.706Z] [DealReport] Created /share/86KLdGKxbG (validator) for 1010 E Macree Ter, Florence, SC 29505
[2026-07-24T16:05:07.154Z] [ShareableReport] Created validator report with code: wxrcJ5AQmP
[2026-07-24T16:05:07.154Z] [DealReport] Created /share/wxrcJ5AQmP (validator) for 18716 Greenside Dr, Dallas, TX 75252
[2026-07-24T16:05:18.227Z] [Personalization] webinar 386: 2 live city scan(s), 3 lead(s) upgraded
[2026-07-24T16:07:16.668Z] [ShareableReport] Created validator report with code: KmwuSRbjj6
[2026-07-24T16:07:16.668Z] [DealReport] Created /share/KmwuSRbjj6 (validator) for 76 Cambridge Ave, Streamwood, IL 60107
[2026-07-24T16:07:19.464Z] [ShareableReport] Created validator report with code: cCg6vWckEL
[2026-07-24T16:07:19.464Z] [DealReport] Created /share/cCg6vWckEL (validator) for 10 King Dr, Streamwood, IL 60107
```

### Other Links Repointed ✅
5 other registrants' links have been repointed from Zillow to /share/:
- Charlotte → /share/AwnJcnhgwS
- Florence → /share/86KLdGKxbG
- Camden → /share/cwkR64GLvB
- Indianapolis → /share/9VejaFgTdg
- Dallas → /share/wxrcJ5AQmP

### Owner Link NOT Repointed ❌
- Owner (bryson@stayly.com) still at version 4, shareCode null
- Link q1j3ycw2 still points to Zillow: https://www.zillow.com/homedetails/10452-Mihela-Ave-Las-Vegas-NV-89129/61743081_zpid/
- computedAt: 2026-07-23T10:56:13.353Z (yesterday)
- dealCount: 2

### Mihela Ave Report EXISTS ✅
- universal_shareable_reports has a validator row for "10452 Mihela Ave, Las Vegas, NV 89129"
- shareCode: vVYD64C4Kg
- Created: 2026-07-23T23:10:17.000Z (yesterday, by production)

### Problem Analysis
The owner's personalization is at v4 with dealCount=2. The filter logic:
- Line 773: if version !== 5, check miss cache, otherwise return true → owner SHOULD be selected
- But the enrichment only processed 1 registrant on the first cycle (16:03) and the owner is STILL at v4
- Possible cause: The enrichment is running but the owner's email batch lookup isn't returning updated data, OR there's a bug where the version isn't being bumped for registrants that already have deals

### Key DB Info
- universal_shareable_reports columns: id, shareCode, reportType, address, city, state, zipCode, latitude, longitude, bedrooms, bathrooms, monthlyRent, marketId, marketName, reportData, title, summary, annualRevenue, occupancyRate, averageDailyRate, profitMargin, verdict, creatorEmail, creatorPhone, creatorName, creatorUserId, sessionId, viewCount, lastViewedAt, smsSentTo, smsSentAt, emailSentTo, emailSentAt, autoNotificationSent, createdAt, expiresAt, revenueOverride, boostFactorAtCreation, selectedCompIds, occupancyOverride, adrOverride
- personalized_links columns: id, email, hubspotContactId, linkUrl, shortCode, targetCity, targetState, targetZip, targetTab, campaignName, campaignType, clickCount, lastClickedAt, createdAt

## What Remains
- Owner link still pointing to Zillow (not /share/) - this is the bug being tested
- YES reply test ready (reply counter at 0)
- Need to wait for owner to be re-enriched to v5, or the backfill to catch the owner's link
