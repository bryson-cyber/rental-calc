# AirDNA API - Complete Documentation Summary

## API Packages Overview

| Package | Purpose |
|---------|---------|
| **Market Data** | Compare entire markets, historical trends, future pricing |
| **Property Valuations & Comps** | Property-level research, comp analysis, benchmarking |
| **Rentalizer Lead Gen** | Earning potential for any address worldwide |
| **Smart Rates Data** | Dynamic pricing recommendations |

---

## LISTING FILTERS (Critical for Apples-to-Apples Comparison)

| Filter Field | Type | Description | Example |
|--------------|------|-------------|---------|
| `accommodates` | numeric | Number of guests | `{"type": "select", "field": "accommodates", "value": 4}` |
| `bedrooms` | numeric | **CRITICAL: Filter to exact bedroom count** | `{"type": "select", "field": "bedrooms", "value": 2}` |
| `bathrooms` | numeric | Number of bathrooms | `{"type": "gte", "field": "bathrooms", "value": 2}` |
| `amenities` | jsonb_boolean | Filter by specific amenities | `{"field": "amenities", "type": "jsonb_boolean", "value": {"has_pool": true}}` |
| `listing_type` | select | entire_home, private_room, shared_room | `{"type": "select", "field": "listing_type", "value": "entire_home"}` |
| `property_type` | multi_select | house, apartment, condo, etc. | Filter by property type |
| `ratings` | numeric | Star rating (0-5) | Filter by minimum rating |
| `review_count` | numeric | Number of reviews | Filter active listings |
| `occupancy_rate_ltm` | numeric | Last 12 months occupancy | Filter by performance |
| `price_tier` | select | budget, midscale, upscale, luxury | Filter by price segment |
| `superhost` | boolean | Superhost status | Filter superhosts only |
| `professionally_managed` | boolean | Pro vs individual host | Filter by management type |
| `percent_active` | numeric | How active the listing is | Filter out inactive listings |
| `days_available_ltm` | numeric | Days available last 12 months | Filter by availability |

### Available Amenities to Filter
- has_aircon, has_breakfast, has_cable_tv, has_dryer
- has_elevator, has_gym, has_heating, has_hottub
- has_kitchen, has_parking, has_pets_allowed, has_pool
- has_smoking, has_tv, has_washer, has_wireless_internet

---

## MARKET DATA ENDPOINTS

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/market/search` | POST | Search markets by name or coordinates |
| `/market/{marketId}` | GET | Get market details |
| `/market/explore/country/{countryCode}` | POST | Explore markets in a country |
| `/market/{marketId}/metrics/occupancy` | POST | Historical occupancy (12-60 months) |
| `/market/{marketId}/metrics/avg_revenue` | POST | Historical revenue |
| `/market/{marketId}/metrics/adr` | POST | Historical ADR |
| `/market/{marketId}/metrics/revpar` | POST | Historical RevPAR |
| `/market/{marketId}/metrics/booking_lead_time` | POST | How far ahead guests book |
| `/market/{marketId}/metrics/los` | POST | Average length of stay |
| `/market/{marketId}/metrics/active_listings_count` | POST | Supply over time |
| `/market/{marketId}/future/pricing` | POST | Future daily pricing |

---

## SUBMARKET DATA ENDPOINTS

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/submarket/{submarketId}` | GET | Get submarket details |
| `/submarket/explore/market/{marketId}` | POST | **Get all neighborhoods in a market** |
| `/submarket/{submarketId}/metrics/*` | POST | Same metrics as market level |

---

## STR LISTING DATA ENDPOINTS

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/listing/explore/market/{marketId}` | POST | **Explore listings with filters** |
| `/listing/explore/submarket/{submarketId}` | POST | Explore listings in neighborhood |
| `/listing/explore/radius` | POST | **Explore listings within radius of lat/lng** |
| `/listing/{listingId}` | GET | Get specific listing details |
| `/listing/bulk` | POST | Get multiple listings at once |
| `/listing/{listingId}/metrics` | POST | **Historical metrics for a listing** |
| `/listing/{listingId}/comps` | POST | **Get comps for a listing** |
| `/listing/{listingId}/future/pricing` | POST | Future pricing for listing |

---

## RENTALIZER DATA ENDPOINTS

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/rentalizer` | POST | **Get revenue estimate for any address** |
| `/rentalizer/comps` | POST | Get comps for a rentalizer estimate |

---

## KEY IMPLEMENTATION STRATEGY

### For Property Search (Specific Address):
1. Use `/rentalizer` to get property estimate
2. Extract lat/lng and zip code from response
3. Use `/listing/explore/radius` with filters:
   - `bedrooms` = exact match to subject property
   - `listing_type` = "entire_home" (or match subject)
   - Filter by revenue >= $30,000/year (quality filter)
4. Sort results by revenue (highest to lowest)
5. Get market context using `/market/{marketId}/metrics/*`

### For Market Search (City/Market):
1. Use `/market/search` to find market ID
2. Use `/submarket/explore/market/{marketId}` to get all neighborhoods
3. Use `/market/{marketId}/metrics/*` for all historical data
4. Use `/listing/explore/market/{marketId}` with filters for top performers
5. Rank submarkets by RevPAR for "Best Neighborhoods" section

### Apples-to-Apples Comparison Rules:
- Same bedroom count (exact match)
- Same zip code / submarket
- Airbnb only (if platform filter available)
- Active listings only (recent reviews)
- Sort by revenue, highest to lowest


---

## RENTALIZER DATA - Detailed Documentation

### What Rentalizer Provides:
- **Future Data**: ADR, Revenue, Revenue Potential, Occupancy
- **Historical Data**: Revenue Valuation
- **Monthly & Yearly** breakdowns

### Individual Rentalizer Estimate (`POST /rentalizer/estimate`)

**Request Parameters:**
- `address` (required) - Full address string
- `bedrooms` - Number of bedrooms
- `bathrooms` - Number of bathrooms  
- `accommodates` - Number of guests
- `currency` - Currency code (usd, etc.)

**Response Includes:**
- High-level summaries for future and historical performance
- 12 months of monthly **future** estimates (rates, revenue, occupancy)
- 12 months of monthly **historical** estimates (annual revenue valuation)
- **Up to 10 comps** with 12 months of historical data each (rates, revenue, revenue potential, occupancy)

### Response Structure (Key Fields):
```json
{
  "payload": {
    "details": {
      "address": "1321 15th St. Denver, CO 80202",
      "address_lookup": "1321 15 ST...",
      "zipcode": "80202",
      "accommodates": 6,
      "bedrooms": 3,
      "bathrooms": 3.5,
      "location": {
        "lat": ...,
        "lng": ...,
        "market_id": "airdna-163",
        "submarket_id": "..."
      }
    },
    "estimates": {
      "annual_revenue": 69618,
      "annual_revenue_low": 63967,
      "annual_revenue_high": 75268,
      "average_daily_rate": 310,
      "occupancy_rate": 62
    },
    "monthly_forecast": [...],
    "comps": [...]
  }
}
```

### Key Insight:
The Rentalizer response gives us:
1. **Property details** including lat/lng and market_id
2. **Revenue estimates** with ranges
3. **Monthly projections** for seasonality
4. **Comps** for competitor analysis

We can then use the market_id to fetch additional market-level data!
