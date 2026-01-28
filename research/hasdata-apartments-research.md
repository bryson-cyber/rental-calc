# HasData API Research - Apartments.com Support

## Date: Jan 28, 2026

## Findings

HasData Real Estate APIs only support 3 platforms:
1. **Airbnb Data API** - Rental listings ($0.42/1k requests)
2. **Redfin Data API** - Real estate listings ($0.42/1k requests) ✅ Already implemented
3. **Zillow Data API** - Real estate listings ($0.42/1k requests) ✅ Already implemented

## Apartments.com Support

**HasData does NOT support Apartments.com** - It's not listed in their Real Estate APIs category.

## Alternative Options

Since HasData doesn't support Apartments.com, we have a few options:

1. **Use HasData's Web Scraping API** - General web scraping API ($0.08/1k requests) that can scrape any website
2. **Find another API provider** - Research other scraping services that support Apartments.com
3. **Skip Apartments.com for now** - Only support Zillow and Redfin

## Recommendation

HasData only offers a **no-code scraper** for Apartments.com, not a dedicated API endpoint like Zillow/Redfin. The no-code scraper is designed for bulk data collection, not real-time single-property lookups.

**Options:**
1. **Use Apify's Apartments.com Scraper API** - They have a dedicated API for Apartments.com
2. **Use ScrapingBee's Apartments.com API** - Another option with API access
3. **Skip Apartments.com for now** - Only support Zillow and Redfin since we have working APIs

**Decision:** Since implementing a new API provider would require additional API keys and costs, we'll proceed with just Zillow and Redfin for now. The user can add Apartments.com support later if needed.
