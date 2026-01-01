# AirDNA API Audit - Current Implementation vs Available Capabilities

## Key Finding
The current zip code search implementation is **WRONG**. It uses Google Geocoding + Rentalizer with a fake address instead of the proper AirDNA Market Search endpoint.

## Current Implementation (BROKEN)
```typescript
case "search_by_zipcode":
  // 1. Uses Google Geocoding to get lat/lng
  // 2. Constructs a fake address like "100 Main St, St. Louis, MO 63108"
  // 3. Calls Rentalizer with that fake address
  // 4. This fails because Rentalizer needs a REAL address
```

## Correct Implementation (FROM API DOCS)
The AirDNA API supports **direct zip code search** via the Market Search endpoint:

```typescript
POST /market/search
{
  "search_term": "63108",  // Just the zip code!
  "pagination": { "page_size": 25, "offset": 0 }
}
```

This returns markets AND submarkets that match the zip code, including:
- Submarket ID (e.g., "submarket-1490")
- Name (e.g., "Central West End")
- Parent market (e.g., "St. Louis")
- Listing count
- Zip codes covered

## What We Should Do

### Step 1: Search by Zip Code
```typescript
const response = await makeApiRequest('/market/search', 'POST', {
  search_term: zipcode,
  pagination: { page_size: 10, offset: 0 }
});
// Returns submarkets that contain this zip code
```

### Step 2: Get Submarket Metrics
Once we have the submarket ID, we can get detailed metrics:
- `/submarket/{id}/metrics/occupancy`
- `/submarket/{id}/metrics/revenue`
- `/submarket/{id}/metrics/adr`
- `/submarket/{id}/metrics/revpar`
- `/submarket/{id}/metrics/active_listings_count`

### Step 3: Get Listings in Submarket
```typescript
POST /submarket/{submarketId}/listings
```

## Available AirDNA Endpoints We're NOT Using

### Market Data Package
- [x] `/market/search` - We use this but NOT for zip codes
- [x] `/market/{id}` - Get market details
- [x] `/market/{id}/metrics/*` - Historical metrics
- [x] `/market/{id}/submarkets` - Get submarkets
- [ ] **`/market/search` with zip code** - NOT USING

### Submarket Data
- [x] `/submarket/{id}` - Get submarket details
- [x] `/submarket/{id}/listings` - Get listings
- [ ] `/submarket/{id}/metrics/occupancy` - Historical occupancy
- [ ] `/submarket/{id}/metrics/revenue` - Historical revenue
- [ ] `/submarket/{id}/metrics/adr` - Historical ADR
- [ ] `/submarket/{id}/metrics/revpar` - Historical RevPAR
- [ ] `/submarket/{id}/metrics/booking_lead_time` - Booking patterns
- [ ] `/submarket/{id}/metrics/los` - Length of stay
- [ ] `/submarket/{id}/metrics/active_listings_count` - Supply trends
- [ ] `/submarket/{id}/metrics/future_daily_pricing` - Future pricing

### Property Valuations & Comps
- [x] `/rentalizer` - Property estimates (using)
- [x] `/listing/search` - Search listings (using)

## Missing Features That Would Add Value

1. **Submarket-level metrics** - More granular than market-level
2. **Future daily pricing** - Show what rates should be for upcoming dates
3. **Booking lead time** - How far in advance guests book
4. **Length of stay patterns** - Average stay duration
5. **Supply trends** - Active listings count over time

## Action Items

1. **FIX zip code search** - Use `/market/search` directly with zip code
2. **Add submarket metrics** - When we find a submarket, get its specific metrics
3. **Add future pricing** - Show recommended rates for upcoming dates
4. **Improve follow-up questions** - Make them context-aware based on the query type
