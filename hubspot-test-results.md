# HubSpot Integration Test Results

## Test URL
`/?tab=prove&city=Loma%20Linda&state=CA&zip=92354`

## Results
1. ✅ Tab correctly opened to "See Real Revenue" (prove tab)
2. ✅ Zip code auto-populated in Quick Search field: "92354"
3. ✅ State auto-selected: "California"
4. ✅ Location hierarchy shows: California → Riverside → Redlands, California → 92354
5. ✅ The tool is ready to search with the personalized location

## What This Enables for HubSpot
- Personalized email links like: `https://coachinayahturnkeytool.com/?tab=prove&city={{contact.city}}&state={{contact.state}}&zip={{contact.postal_code}}`
- When lead clicks, they see their local market data pre-loaded
- All 7 tools support the same URL parameters

## Supported URL Parameters
- `tab` - Which tool to open (prove, market, regulations, validate, explore, advisor, opportunity)
- `city` - City name from HubSpot
- `state` - State abbreviation from HubSpot
- `zip` - Postal code from HubSpot
- `address` - Full address (optional)
- `bedrooms` - Number of bedrooms (optional)
- `bathrooms` - Number of bathrooms (optional)
- `autoAnalyze=true` - Auto-trigger the search

## Example Personalized Links for Patrick Allen (Loma Linda, CA 92354)
- Revenue Calculator: `/?tab=prove&city=Loma+Linda&state=CA&zip=92354&autoAnalyze=true`
- Market Advisor: `/?tab=market&city=Loma+Linda&state=CA&zip=92354&autoAnalyze=true`
- Regulation Tracker: `/?tab=regulations&city=Loma+Linda&state=CA`
- Comps Explorer: `/?tab=explore&city=Loma+Linda&state=CA&zip=92354&autoAnalyze=true`
