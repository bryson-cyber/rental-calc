# AirDNA API Audit - Complete Endpoint List

## Available API Packages

### 1. Market Data Package
| Endpoint | Method | Description | Currently Using? |
|----------|--------|-------------|------------------|
| `/market/search` | POST | Search for markets/submarkets by term or coordinates | ✅ YES |
| `/market/{marketId}` | GET | Fetch details about a specific market | ✅ YES |
| `/country/{countryCode}/markets` | POST | Explore markets within a country | ❌ NO |
| `/market/{marketId}/metrics/revenue` | POST | 12-60 months historical revenue data | ✅ YES |
| `/market/{marketId}/metrics/occupancy` | POST | 12-60 months historical occupancy data | ✅ YES |
| `/market/{marketId}/metrics/adr` | POST | 12-60 months historical ADR data | ✅ YES |
| `/market/{marketId}/metrics/revpar` | POST | 12-60 months historical RevPAR data | ⚠️ PARTIAL (code exists but may not be called) |
| `/market/{marketId}/metrics/booking_lead_time` | POST | 12-60 months booking lead time data | ⚠️ PARTIAL (code exists) |
| `/market/{marketId}/metrics/los` | POST | 12-60 months average length of stay | ⚠️ PARTIAL (code exists) |
| `/market/{marketId}/metrics/active_listings_count` | POST | 12-60 months active listing count | ⚠️ PARTIAL (code exists) |
| `/market/{marketId}/future_pricing` | POST | 1-12 months future daily pricing | ⚠️ PARTIAL (code exists) |
| `/market/{marketId}/listings` | POST | Explore listings within a market | ✅ YES |

### 2. Submarket Data Package
| Endpoint | Method | Description | Currently Using? |
|----------|--------|-------------|------------------|
| `/submarket/{submarketId}` | GET | Fetch details about a specific submarket | ✅ YES |
| `/country/{countryCode}/submarkets` | POST | Explore submarkets within a country | ❌ NO |
| `/market/{marketId}/submarkets` | POST | Explore submarkets within a market | ❌ NO |
| `/submarket/{submarketId}/metrics/revenue` | POST | 12-60 months historical revenue | ✅ YES |
| `/submarket/{submarketId}/metrics/occupancy` | POST | 12-60 months historical occupancy | ✅ YES |
| `/submarket/{submarketId}/metrics/adr` | POST | 12-60 months historical ADR | ✅ YES |
| `/submarket/{submarketId}/metrics/revpar` | POST | 12-60 months historical RevPAR | ❌ NO |
| `/submarket/{submarketId}/metrics/booking_lead_time` | POST | 12-60 months booking lead time | ❌ NO |
| `/submarket/{submarketId}/metrics/los` | POST | 12-60 months average length of stay | ❌ NO |
| `/submarket/{submarketId}/metrics/active_listings_count` | POST | 12-60 months active listing count | ❌ NO |
| `/submarket/{submarketId}/future_pricing` | POST | 1-12 months future daily pricing | ❌ NO |
| `/submarket/{submarketId}/listings` | POST | Explore listings within a submarket | ✅ YES |

### 3. Property Valuations & Comps Package
| Endpoint | Method | Description | Currently Using? |
|----------|--------|-------------|------------------|
| `/listing/{listingId}` | GET | Fetch details about a specific listing | ✅ YES |
| `/listing/bulk/fetch` | POST | Fetch details for multiple listings | ❌ NO |
| `/listing/{listingId}/metrics` | POST | 12-60 months historical listing metrics | ⚠️ PARTIAL (code exists) |
| `/listing/{listingId}/comps` | POST | Fetch comps for a specific listing | ⚠️ PARTIAL (code exists) |
| `/listing/{listingId}/future_pricing` | POST | 1-12 months future pricing for listing | ⚠️ PARTIAL (code exists) |
| `/listing/comps/area` | POST | Explore listings within a radius | ✅ YES (for property analysis) |

### 4. Rentalizer Lead Gen Package
| Endpoint | Method | Description | Currently Using? |
|----------|--------|-------------|------------------|
| `/rentalizer` | POST | Full rentalizer estimate with monthly projections | ✅ YES |
| `/rentalizer/summary/individual` | POST | Summarized rentalizer estimate | ❌ NO |
| `/rentalizer/bulk_summary` | POST | Bulk summarized estimates (up to 25) | ⚠️ PARTIAL (code exists) |

### 5. Smart Rates Package
| Endpoint | Method | Description | Currently Using? |
|----------|--------|-------------|------------------|
| `/listing/{listingId}/smart_rates/pricing_strategies` | GET | Base rates for pricing strategies | ❌ NO |
| `/listing/{listingId}/smart_rates` | POST | Recommended daily rates for listing | ❌ NO |

---

## Missing Data Points for Market Advisor (Step 7)

### Currently NOT Pulling:
1. **RevPAR (Revenue Per Available Rental)** - Key metric for investors
2. **Booking Lead Time** - How far in advance guests book
3. **Average Length of Stay** - Guest stay duration trends
4. **Active Listings Count History** - Market supply trends over time
5. **Future Daily Pricing** - Forward-looking pricing data
6. **Submarkets within Market** - List of all neighborhoods/submarkets

### Currently NOT Pulling for Property Advisor (Step 6):
1. **Individual Listing Details** - Full property details including amenities
2. **Individual Listing Historical Metrics** - 12-60 months of performance data
3. **Listing Comps** - AirDNA's comp algorithm for specific listings
4. **Listing Future Pricing** - Forward-looking pricing for specific properties
5. **Smart Rates** - AirDNA's dynamic pricing recommendations

---

## Recommended Improvements

### High Priority (Step 7 Market Advisor):
1. Add `/market/{marketId}/metrics/revpar` - RevPAR is critical for investors
2. Add `/market/{marketId}/metrics/active_listings_count` - Shows market supply trends
3. Add `/market/{marketId}/metrics/los` - Average length of stay insights
4. Add `/market/{marketId}/metrics/booking_lead_time` - Booking behavior insights
5. Add `/market/{marketId}/future_pricing` - Forward-looking pricing data
6. Add `/market/{marketId}/submarkets` - List all submarkets for exploration

### High Priority (Step 6 Property Advisor):
1. Add `/listing/{listingId}` - Get full listing details for comps
2. Add `/listing/{listingId}/metrics` - Historical performance of comp properties
3. Add `/listing/{listingId}/future_pricing` - Future pricing for comp analysis

### Medium Priority:
1. Add `/country/{countryCode}/markets` - Discover top markets in USA
2. Add `/rentalizer/bulk_summary` - Batch property estimates
3. Add Smart Rates integration for existing listings

---

## Data Quality Improvements

### Listing Filters Available (Not All Used):
- `accommodates` ✅
- `bedrooms` ✅
- `bathrooms` ✅
- `rating` ❌ (could filter by rating)
- `review_count` ❌ (could filter by reviews)
- `professionally_managed` ❌ (could filter by management type)
- `superhost` ❌ (could filter by superhost status)
- `instant_book` ❌ (could filter by instant book)
- `property_type` ❌ (house, apartment, cabin, etc.)
- `listing_type` ❌ (entire_place, private_room, shared_room)
- `amenities` ❌ (pool, hot_tub, wifi, etc.)
- `pets_allowed` ❌ (pet-friendly filter)

### Market Filters Available (Not All Used):
- `investability` ❌ (market investability score)
- `listing_count` ❌ (number of listings)
- `market_type` ❌ (urban_metro, coastal, mountains_lakes, etc.)
- `regulation` ❌ (regulation score)
- `rental_demand` ❌ (demand score)
- `revenue_growth` ❌ (growth score)
- `seasonality` ❌ (seasonality score)
