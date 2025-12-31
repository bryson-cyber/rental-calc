# AirDNA API - Comprehensive Endpoints

## API Base URL
`https://api.airdna.co/api/enterprise/v2`

## Available Packages

### 1. Market Data
Historical market data (12-60 months) for:
- **Booking Data**: Occupancy, Booking Demand, Booking Lead Time, Average Length of Stay
- **Pricing Data**: Average Revenue, Average Daily Rate, RevPAR

**Endpoints:**
- `POST /market/search` - Search for a Market or Submarket by term or coordinates
- `GET /market/{market_id}` - Fetch details about a specific Market
- `POST /market/explore` - Explore Markets within a Country
- `POST /market/{market_id}/occupancy` - Fetch Occupancy Metrics
- `POST /market/{market_id}/revenue` - Fetch Average Revenue Metrics
- `POST /market/{market_id}/adr` - Fetch Average Daily Rate Metrics
- `POST /market/{market_id}/revpar` - Fetch RevPAR Metrics
- `POST /market/{market_id}/booking_lead_time` - Fetch Booking Lead Time
- `POST /market/{market_id}/los` - Fetch Average Length of Stay
- `POST /market/{market_id}/active_listings` - Fetch Active Listings Count
- `POST /market/{market_id}/future_pricing` - Fetch Future Daily Pricing

### 2. Submarket Data
Same metrics available at submarket level

### 3. Property Valuations & Comps
- **STR Listing Data** - Detailed listing information with filtering
- **Rentalizer Data** - Property valuation and earning potential

### 4. Rentalizer Lead Gen
- **Rentalizer Summary Data** - Earning potential for any address

### 5. Smart Rates Data
- Dynamic pricing recommendations

## Key Filters Available

### Market Filters
- bedrooms, bathrooms, accommodates
- property_type, room_type
- rating, reviews
- revenue, adr, occupancy, revpar

### Filter Types
- `select` - Exact match
- `multi_select` - Multiple values
- `lt`, `lte`, `gt`, `gte` - Comparison
- `range` - Min/max range

## Data We Need for the Report

### For Property Analysis (Rentalizer):
- Annual revenue (low, median, high)
- Average daily rate
- Occupancy rate
- Monthly forecast (12 months)
- Comparable properties

### For Market Analysis:
- Market overview stats
- Occupancy trends
- Revenue trends
- ADR trends
- RevPAR
- Active listings count
- Seasonality data
- Property type breakdown
- Bedroom count performance

### For Competitor Analysis:
- Top performing listings
- Amenity analysis
- Rating distribution
- Professional host percentage
