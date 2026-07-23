# Webinar Personalization Acceptance Test Runbook

## PART A — Production data checks (SQL only)

1. Coverage: `SELECT COUNT(*) AS total, SUM(JSON_EXTRACT(metadata,'$.personalization.version')=4) AS located, SUM(JSON_EXTRACT(metadata,'$.personalization.deal') IS NOT NULL) AS with_deal FROM webinar_registrants WHERE webinarId='386' AND email IS NOT NULL AND email!='';`
2. Payload sanity: `SELECT email, JSON_EXTRACT(metadata,'$.personalization.city') AS city, JSON_EXTRACT(metadata,'$.personalization.source') AS src, JSON_EXTRACT(metadata,'$.personalization.timezone') AS tz FROM webinar_registrants WHERE webinarId='386' LIMIT 20;`
3. Generated research: newsletter_deals (rent vs revenue plausible, sourceUrl = real Zillow), shared_reports with reportType='property', regulation_cache not unknown
4. Tokenized copy: `SELECT sequenceName, messageBody LIKE '%[IF\_%' AS tokenized FROM scheduled_sms_messages WHERE webinarId='386' AND status='pending';`

## PART B — Owner-phone conversation test

- Owner phone: 702-521-8792
- IMPORTANT: engagement question respects quiet hours. For Las Vegas lead, run after 8:00 AM Pacific (15:00 UTC)
- Register owner as manual registrant
- Expected confirmation: "Hey Bryson, you're confirmed for the Airbnb class. I'll send your join link here before we start. Save this number! - Inayah" — NO deal line. FAIL if property mention appears.
- Confirmation email: no property card; ends with P.S. teaser about texts
- Within ~5 min: engagement question arrives
- Reply YES → within ~3 min expect deal message with Vegas numbers + coachinayahturnkeytool.com/l/... link
- Link must resolve with zero login (report page or Zillow listing)
- SECOND owner phone: reply "what about pheonix az" → expect Phoenix numbers, verify cityOverride in metadata
- After 3rd automated response → system goes silent (loop cap). FAIL if 4th arrives.
- Text STOP from second phone → no reply, optedOut=1

## PART C — HubSpot + digest

- After YES reply, check HubSpot: webinar_lead_priority, webinar_reply_intent, webinar_reply_city, webinar_funding_qualified, webinar_funding_readiness
- Daily digest arrives via owner notification after 14:00 UTC

## PART D — Compressed dress rehearsal

- Create TEST webinar with 2 owner phones
- Generate sequence with compressed timing (day-before/morning-of fire within hour)
- Verify: SMS renders city/deal with no [IF_ or %TOKEN%; day-before email shows "Near {city}" card; deliveries table shows sent/skipped rows; personalized_links.clickCount increments

## Kill switches
- sms_engagement=off
- personalization_live_scan=off  
- daily_digest=off
