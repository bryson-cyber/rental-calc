# Step 2 "Explore Listings" Refocus Plan

## Current Problems
1. **Address autocomplete** - Uses Google Places (addresses) instead of AirDNA market search (cities/neighborhoods)
2. **No property images** - Image URLs are constructed but not displaying
3. **Map view broken** - Shows no properties, redundant with Step 5
4. **No bedroom filter in main form** - Can't do apples-to-apples comparison
5. **"Analyze" button confusion** - Requires address but this is area exploration

## Available AirDNA API Endpoints

### For City/Neighborhood Search (PERFECT for Step 2)
**`/market/search`** - Search for markets and submarkets
- Input: `search_term` (city name, neighborhood, zip code)
- Returns: `id`, `name`, `type` (market/submarket), `listing_count`, `location_name`, `state`, `parent_market`
- Already implemented as `searchMarketsAPI()` in airdna.ts

### For Getting Listings in a Market
**`/market/{marketId}/listings`** - Get all listings in a market
- Filters: `bedrooms`, `bathrooms`, `propertyType`
- Order by: `revenue`, `occupancy`, `rating`
- Returns: Full listing data with images, revenue, occupancy, ADR, rating, reviews, superhost status
- Already implemented as `getMarketListings()` in airdna.ts

**`/submarket/{submarketId}/listings`** - Get all listings in a submarket
- Same filters and data as market listings
- Already implemented as `getSubmarketListings()` in airdna.ts

### For Area-Based Search (Current Implementation)
**`/listing/comps/area`** - Get listings near an address
- Input: `address`, `radius` (meters), `bedrooms`
- Returns: Listings with distance from center
- Already implemented as `getListingsByArea()` in airdna.ts
- **Problem**: Requires address, not city/neighborhood

## Refocused Step 2 Design

### New Purpose
"See What's Making Money in [City/Neighborhood]"
- User types city or neighborhood name
- System uses `/market/search` to find the market/submarket ID
- System uses `/market/{id}/listings` to get all properties
- Display property cards with images, revenue, booking rate, rating

### Input Change
**Before**: Google Places address autocomplete
**After**: AirDNA market search autocomplete (cities, neighborhoods, zip codes)

### Form Fields
1. **Location** (required) - City/neighborhood autocomplete using `searchMarketsAPI()`
2. **Bedrooms** (optional) - Filter for apples-to-apples comparison
3. **Sort By** - Revenue (default), Booking Rate, Rating

### Remove
- Map view (redundant with Step 5)
- "Analyze" button (no single property to analyze)
- Radius selector (markets have defined boundaries)

### Data Display
Each property card shows:
- **Image** (from AirDNA listing data)
- **Title** (property name)
- **Bedrooms/Bathrooms**
- **Annual Revenue** with tooltip
- **Booking Rate** with tooltip
- **Nightly Rate** with tooltip
- **Rating** with tooltip
- **Superhost badge** if applicable
- **View on Airbnb** link

### Verdict Section
- **Top Earner**: Highest revenue property
- **Most Booked**: Highest booking rate property
- **Market Average**: Average revenue and booking rate
- **Letter Grade**: Based on market opportunity

## Implementation Steps

1. Replace Google Places autocomplete with AirDNA market search
2. Update form to use market ID instead of address
3. Call `getMarketListings()` or `getSubmarketListings()` based on selection type
4. Ensure property images display correctly
5. Remove map view section
6. Remove "Analyze" button
7. Add bedroom filter to main form
8. Keep existing verdict section and tooltips
