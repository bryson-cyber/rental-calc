# AirDNA API - Zip Code Search Capability

## Key Finding
The AirDNA API **DOES support direct zip code search** via the Market Search endpoint.

## How to Search by Zip Code

### Endpoint
```
POST /market/search
```

### Request Body
```json
{
  "search_term": "80202",
  "pagination": {
    "page_size": 25,
    "offset": 0
  }
}
```

### Response Structure
The API returns markets and submarkets that match the zip code:
```json
{
  "id": "airdna-1490",
  "name": "Downtown Denver",
  "type": "submarket",
  "listing_count": 364,
  "location_name": "Downtown Denver, Colorado, United States, US",
  "legacy_location": {
    "city_names": [],
    "zipcodes": ["80294", "80264", "80293", "80290"],
    "neighborhoods": ["North Capitol Hill", "Golden Triangle", "CBD"]
  },
  "parent_market": {
    "id": "airdna-163",
    "name": "Denver"
  }
}
```

## Workflow for Zip Code Search
1. User enters zip code (e.g., "63108")
2. Call Market Search with search_term = "63108"
3. Get back the submarket (neighborhood) and market (city) that contain it
4. Use those IDs to pull detailed data:
   - Submarket metrics (occupancy, revenue, ADR, RevPAR)
   - Active listings count
   - Seasonality data
   - Future pricing

## What We're Missing
Currently our implementation:
- Uses Google Geocoding to convert zip to city
- Then uses Rentalizer with a generic address
- This is WRONG - we should use Market Search directly with the zip code

## Correct Implementation
1. Call `/market/search` with `search_term: "63108"`
2. Get the submarket_id from the response
3. Call submarket metrics endpoints:
   - `/submarket/{submarketId}/metrics/occupancy`
   - `/submarket/{submarketId}/metrics/revenue`
   - `/submarket/{submarketId}/metrics/adr`
   - `/submarket/{submarketId}/metrics/revpar`
   - `/submarket/{submarketId}/metrics/active_listings_count`

## Available Submarket Endpoints
- POST /submarket/{submarketId}/metrics/occupancy
- POST /submarket/{submarketId}/metrics/revenue
- POST /submarket/{submarketId}/metrics/adr
- POST /submarket/{submarketId}/metrics/revpar
- POST /submarket/{submarketId}/metrics/booking_lead_time
- POST /submarket/{submarketId}/metrics/los (length of stay)
- POST /submarket/{submarketId}/metrics/active_listings_count
- POST /submarket/{submarketId}/metrics/future_daily_pricing
