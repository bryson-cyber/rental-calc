# AirDNA API - Market Data Endpoints

## Overview
Market Data provides 12-60 months of historical data for markets.

## Available Metrics (Historical Data)

### Booking Data
- **Occupancy** - How full are properties?
- **Booking Demand** - How many bookings are happening?
- **Booking Lead Time** - How far in advance do guests book?
- **Average Length of Stay** - How long do guests stay?

### Pricing Data
- **Average Revenue** - Total revenue per property
- **Average Daily Rate (ADR)** - Price per night
- **RevPAR** - Revenue Per Available Rental (key profitability metric)

## Market Data Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/market/search` | POST | Search for markets by name or coordinates |
| `/market/{marketId}` | GET | Get details about a specific market |
| `/market/explore/country/{countryCode}` | POST | Explore markets within a country |
| `/market/{marketId}/metrics/occupancy` | POST | Get occupancy metrics (12-60 months) |
| `/market/{marketId}/metrics/avg_revenue` | POST | Get average revenue metrics |
| `/market/{marketId}/metrics/adr` | POST | Get ADR metrics |
| `/market/{marketId}/metrics/revpar` | POST | Get RevPAR metrics |
| `/market/{marketId}/metrics/booking_lead_time` | POST | Get booking lead time metrics |
| `/market/{marketId}/metrics/los` | POST | Get length of stay metrics |
| `/market/{marketId}/metrics/active_listings_count` | POST | Get active listings count |
| `/market/{marketId}/future/pricing` | POST | Get future daily pricing |

## Key Insights for Report
- Can show 12-60 months of historical trends
- Can compare occupancy, ADR, revenue over time
- Can show seasonality patterns
- Can show booking behavior (lead time, length of stay)
- Can show market supply (active listings count)


## Submarket Data Endpoints

Submarkets are neighborhoods/areas within a market. Same metrics available as Market Data.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/submarket/{submarketId}` | GET | Get details about a specific submarket |
| `/submarket/explore/country/{countryCode}` | POST | Explore submarkets within a country |
| `/submarket/explore/market/{marketId}` | POST | **KEY: Get all submarkets within a market** |
| `/submarket/{submarketId}/metrics/occupancy` | POST | Get occupancy metrics |
| `/submarket/{submarketId}/metrics/avg_revenue` | POST | Get average revenue metrics |
| `/submarket/{submarketId}/metrics/adr` | POST | Get ADR metrics |
| `/submarket/{submarketId}/metrics/revpar` | POST | Get RevPAR metrics |
| `/submarket/{submarketId}/metrics/booking_lead_time` | POST | Get booking lead time |
| `/submarket/{submarketId}/metrics/los` | POST | Get length of stay |
| `/submarket/{submarketId}/metrics/active_listings_count` | POST | Get active listings count |
| `/submarket/{submarketId}/future/pricing` | POST | Get future daily pricing |

## Key Use Case for Report
- Use `/submarket/explore/market/{marketId}` to get ALL neighborhoods in a market
- Then rank them by RevPAR to create "Best Neighborhoods" tier list
- Show which areas have highest revenue potential


## STR Listing Data Endpoints

Individual listing data from Airbnb & Vrbo. 12-60 months of historical data.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/listing/explore/country/{countryCode}` | POST | Explore listings within a country |
| `/listing/explore/market/{marketId}` | POST | **Explore listings within a market (with filters!)** |
| `/listing/explore/submarket/{submarketId}` | POST | Explore listings within a submarket |
| `/listing/explore/radius` | POST | **Explore listings within a given radius** |
| `/listing/{listingId}` | GET | Get details about a specific listing |
| `/listing/bulk` | POST | Fetch details about multiple listings |
| `/listing/{listingId}/metrics` | POST | **Get historical metrics for a listing** |
| `/listing/{listingId}/comps` | POST | **Fetch comps for a listing** |
| `/listing/{listingId}/future/pricing` | POST | Get future pricing for a listing |

## Key Listing Data Points
- Date, occupancy, revenue, ADR
- Number of bedrooms, ratings, reviews
- Market information

## CRITICAL for Apples-to-Apples Comparison
Use filters when exploring listings:
- `bedrooms` - Filter to exact bedroom count
- `platform` - Filter to "airbnb" only (exclude VRBO)
- `last_review_date` - Filter out stale listings (> 2 months old)
- Can search by radius from a specific lat/lng
