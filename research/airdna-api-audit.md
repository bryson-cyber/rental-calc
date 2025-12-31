# AirDNA API Audit - Complete Endpoint Analysis

## API Packages Available

The AirDNA Enterprise API v2 is divided into **four main packages**:

### 1. Market Data
- Compare entire different locations side by side
- Future data on how properties in that market are priced for upcoming days

### 2. Property Valuations & Comps
- Property-level research with advanced filtering
- Comp analysis for acquisitions, benchmarking, pricing

### 3. Rentalizer Lead Gen
- Determine earning potential, occupancy, and nightly rate for any address
- Works anywhere in the world

### 4. Smart Rates Data
- AirDNA's proprietary dynamic pricing solution
- Recommended nightly rates for each property

---

## Market Data Endpoints (COMPLETE LIST)

### Historical Market Data (12-60 months)
- **Booking Data:**
  - Occupancy
  - Booking Demand
  - Booking Lead Time
  - Average Length of Stay
- **Pricing Data:**
  - Average Revenue
  - Average Daily Rate
  - RevPAR (Revenue Per Available Rental)

### Market Data Endpoints:
1. `POST /market/search` - Search for Market or Submarket by term or coordinates ✅ USING
2. `GET /market/{marketId}` - Fetch details about a specific Market ✅ USING
3. `POST /market/explore` - Explore Markets within a Country ❌ NOT USING
4. `POST /market/{marketId}/charts/occupancy` - Fetch Occupancy Metrics ✅ USING
5. `POST /market/{marketId}/charts/revenue` - Fetch Average Revenue Metrics ✅ USING
6. `POST /market/{marketId}/charts/adr` - Fetch Average Daily Rate Metrics ✅ USING
7. `POST /market/{marketId}/charts/revpar` - Fetch RevPAR Metrics ✅ USING
8. `POST /market/{marketId}/charts/booking_lead_time` - Fetch Booking Lead Time ❌ NOT USING
9. `POST /market/{marketId}/charts/los` - Fetch Average Length of Stay ❌ NOT USING
10. `POST /market/{marketId}/charts/active_listings` - Fetch Active Listings Count ✅ USING
11. `POST /market/{marketId}/charts/future_pricing` - Fetch Future Daily Pricing ❌ NOT USING

### Submarket Data Endpoints:
1. `POST /market/search` - Search for Market or Submarket ✅ USING
2. `GET /submarket/{submarketId}` - Fetch details about a specific Submarket ✅ USING
3. `POST /submarket/explore/country` - Explore Submarkets within a Country ❌ NOT USING
4. `POST /submarket/explore/market` - **Explore Submarkets within a Market** ❌ NOT USING (KEY MISSING!)
5. `POST /submarket/{submarketId}/charts/occupancy` - Fetch Occupancy Metrics ✅ USING
6. `POST /submarket/{submarketId}/charts/revenue` - Fetch Revenue Metrics ✅ USING
7. `POST /submarket/{submarketId}/charts/adr` - Fetch ADR Metrics ✅ USING
8. `POST /submarket/{submarketId}/charts/revpar` - Fetch RevPAR Metrics ✅ USING
9. `POST /submarket/{submarketId}/charts/booking_lead_time` - Fetch Booking Lead Time ❌ NOT USING
10. `POST /submarket/{submarketId}/charts/los` - Fetch Length of Stay ❌ NOT USING
11. `POST /submarket/{submarketId}/charts/active_listings` - Fetch Active Listings ✅ USING
12. `POST /submarket/{submarketId}/charts/future_pricing` - **Fetch Future Daily Pricing** ❌ NOT USING

---

## STR Listing Data Endpoints (PROPERTY LEVEL)

### Explore Listings:
1. `POST /listing/explore/country` - Explore Listings within a Country ❌ NOT USING
2. `POST /listing/explore/market` - **Explore Listings within a Market** ✅ USING
3. `POST /listing/explore/submarket` - **Explore Listings within a Submarket** ✅ USING
4. `POST /listing/explore/radius` - **Explore Listings Within a Given Radius** ✅ USING

### Individual Listing Data:
5. `GET /listing/{listingId}` - **Fetch details about a specific Listing** ❌ NOT USING (HAS IMAGES!)
6. `POST /listing/batch` - **Fetch details about multiple Listings** ❌ NOT USING
7. `POST /listing/{listingId}/charts` - **Fetch Historical Metrics for a Listing** ❌ NOT USING
8. `POST /listing/{listingId}/comps` - **Fetch Comps for a Listing** ❌ NOT USING
9. `POST /listing/{listingId}/future_pricing` - **Fetch Future Pricing for a Listing** ❌ NOT USING

---

## Filter Capabilities

### Filter Types:
- `select` - Exact value match
- `multi_select` - Match one of multiple values
- `lt` - Less than
- `lte` - Less than or equal
- `gt` - Greater than
- `gte` - Greater than or equal
- `range` - Between two values
- `jsonb_boolean` - For amenities filtering

### ALL Listing Filter Fields:
1. **accommodates** - Number of guests (numeric) ✅ USING
2. **amenities** - Filter by specific amenities (jsonb_boolean) ❌ NOT USING
   - has_aircon, has_breakfast, has_cable_tv, has_dryer, has_elevator
   - has_gym, has_heating, has_hottub, has_kitchen, has_parking
   - has_pets_allowed, has_pool, has_smoking, has_tv, has_washer
   - has_wireless_internet
3. **bathrooms** - Number of bathrooms (numeric) ❌ NOT USING
4. **bedrooms** - Number of bedrooms (numeric) ✅ USING
5. **days_available_ltm** - Days available last 12 months (numeric) ❌ NOT USING
6. **instant_book** - Instant book enabled (boolean) ❌ NOT USING
7. **listing_type** - entire_home, private_room, shared_room, hotel_room ❌ NOT USING
8. **occupancy_rate_ltm** - Occupancy rate last 12 months (numeric 0-100) ❌ NOT USING
9. **price_tier** - budget, midrange, upscale, luxury ❌ NOT USING
10. **professionally_managed** - Is professionally managed (boolean) ❌ NOT USING
11. **property_type** - house, apartment, condo, townhouse, etc. ✅ USING (frontend only)
12. **ratings** - Guest rating (numeric 0-5) ✅ USING (frontend only)
13. **real_estate_type** - single_family, multi_family, condo, etc. ❌ NOT USING
14. **review_count** - Number of reviews (numeric) ❌ NOT USING
15. **superhost** - Is superhost (boolean) ❌ NOT USING
16. **percent_active** - Percentage of time listing is active (numeric) ❌ NOT USING

---

## Rentalizer Data Endpoints (PROPERTY VALUATION)

1. `POST /rentalizer/estimate` - **Individual: Detailed Performance Estimate** ✅ USING
   - High-level summaries for future and historical performance
   - 12 months of monthly future performance estimates (rates, revenue, occupancy)
   - 12 months of monthly historical performance estimates (annual revenue valuation)
   - Up to 10 comps with 12 months of historical data each

2. `POST /rentalizer/estimate/bulk` - **Bulk: Summarized Performance Estimates** ❌ NOT USING
   - For multiple addresses at once
   - Only yearly data (not monthly)

---

## Rentalizer Summary Data (LEAD GEN)

1. `POST /rentalizer/summary` - **Summarized Performance Data** ❌ NOT USING
   - Lighter-weight version for lead generation
   - Less detailed than full Rentalizer estimate

---

## Smart Rates Data (DYNAMIC PRICING)

1. `GET /listing/{listingId}/smart_rates/pricing_strategies` - **Fetch Pricing Strategy Base Rates** ❌ NOT USING
   - Returns base rates for each pricing strategy:
     - **balanced**: Optimized balance between ADR and Occupancy
     - **high_adr**: Maximize average daily rate
     - **high_occupancy**: Maximize occupancy rate
   - Supports currency conversion (164+ currencies)

2. `POST /listing/{listingId}/smart_rates` - **Fetch Smart Rates for a Listing** ❌ NOT USING
   - Daily recommended rates for a specific listing
   - Dynamic pricing recommendations

---

## CRITICAL MISSING FEATURES

### 1. Submarket Exploration (HIGHEST PRIORITY)
**Endpoint:** `POST /submarket/explore/market`
- **What it does:** Returns ALL submarkets within a market with their performance metrics
- **Use case:** When user searches "Detroit", show them ALL zip codes/neighborhoods ranked by:
  - Revenue potential
  - Occupancy rates
  - Growth trends
- **Current gap:** We only show market-level data, not submarket recommendations

### 2. Future Pricing Data
**Endpoints:**
- `POST /market/{marketId}/charts/future_pricing`
- `POST /submarket/{submarketId}/charts/future_pricing`
- `POST /listing/{listingId}/future_pricing`
- **What it does:** Shows how properties are priced for upcoming days
- **Use case:** "What should I charge next month?" or "When are peak seasons?"

### 3. Booking Lead Time & Length of Stay
**Endpoints:**
- `POST /market/{marketId}/charts/booking_lead_time`
- `POST /market/{marketId}/charts/los`
- **What it does:** Shows how far in advance guests book and how long they stay
- **Use case:** Optimize pricing strategy and minimum stay requirements

### 4. Individual Listing Details
**Endpoint:** `GET /listing/{listingId}`
- **What it does:** Returns full details about a specific listing INCLUDING IMAGES
- **Use case:** Get actual listing photos for competitor cards

### 5. Listing Comps
**Endpoint:** `POST /listing/{listingId}/comps`
- **What it does:** Returns comparable listings for a specific property
- **Use case:** More accurate competitor analysis based on AirDNA's comp algorithm

### 6. Advanced Filtering (Server-Side)
**Currently missing filters:**
- amenities (pool, hot tub, etc.)
- instant_book
- superhost
- professionally_managed
- price_tier (budget/midrange/upscale/luxury)
- listing_type (entire_home/private_room)

---

## RECOMMENDED FEATURE ROADMAP

### Phase 1: Submarket Intelligence (HIGH IMPACT)
1. Add "Explore Submarkets" feature when user selects a market
2. Show ranked list of zip codes/neighborhoods by:
   - Revenue potential
   - Occupancy rate
   - RevPAR
   - Growth trend
3. Allow drill-down into specific submarket

### Phase 2: Future Pricing & Seasonality
1. Add "Seasonal Pricing" chart showing future pricing trends
2. Show peak vs. off-peak periods
3. Recommend optimal pricing by season

### Phase 3: Smart Rates Integration
1. For existing listings, show recommended daily rates
2. Compare current pricing to AirDNA recommendations
3. Show potential revenue uplift

### Phase 4: Enhanced Competitor Analysis
1. Use `/listing/{listingId}` to get actual listing images
2. Use `/listing/{listingId}/comps` for better comp selection
3. Add amenity-based filtering
4. Add superhost/professionally managed filters

