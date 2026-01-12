# AirDNA API Data Audit

## Available Data from AirDNA API

### Property Estimates (Rentalizer)
- **Annual Revenue** (low, mid, high) ✅ Currently used
- **Average Daily Rate (ADR)** ✅ Currently used
- **Occupancy Rate** ✅ Currently used
- **Currency** ❌ Not displayed
- **Property Details** (bedrooms, bathrooms, accommodates) ✅ Used

### Monthly Forecast
- **Month-by-month revenue projections** ❌ Not displayed
- **Month-by-month ADR** ❌ Not displayed
- **Month-by-month occupancy** ❌ Not displayed

### Comparable Properties
- **Title** ✅ Used
- **Bedrooms/Bathrooms** ✅ Used
- **Rating** ❌ Not displayed
- **Reviews** ❌ Not displayed
- **Annual Revenue** ✅ Used
- **ADR** ❌ Not displayed
- **Occupancy** ✅ Used
- **Distance** ❌ Not displayed
- **Property Type** ❌ Not displayed
- **Last Review Date** ❌ Not displayed
- **Amenities** ❌ Not displayed
- **Accommodates** ❌ Not displayed
- **Monthly Metrics** (date, occupancy, ADR, revenue, revenue_potential) ❌ Not displayed

### Market Data
- **Market ID & Name** ✅ Used
- **Listing Count** ✅ Used
- **Market Metrics** (occupancy, ADR, RevPAR, etc.) ✅ Partially used
- **Historical Data** (occupancy, ADR, revenue, RevPAR trends) ❌ Not displayed

### Bedroom Performance Breakdown
- **Bedroom Count** ✅ Used
- **Occupancy by Bedroom** ✅ Used
- **ADR by Bedroom** ❌ Not displayed
- **Revenue by Bedroom** ✅ Used
- **Listing Count by Bedroom** ✅ Used

---

## Recommendations for Enhancement

### Step 1: See Real Revenue
- Add monthly forecast chart showing revenue trends
- Display ADR by bedroom type
- Show market trends (YoY growth)

### Step 2: Explore Listings
- Add property type filter
- Show rating/reviews for each listing
- Display amenities
- Show last review date (freshness indicator)
- Add ADR to comparison
- Show distance from search location

### Step 3: Validate the Deal
- Add monthly forecast chart
- Show comparable properties with ratings
- Display property type
- Add amenities list
- Show market trends for context
- Display RevPAR metric

### Step 4: Find the Best Deal
- Add monthly forecast comparison
- Show property types
- Display ratings/reviews
- Add RevPAR to comparison metrics
- Show amenities for each property
