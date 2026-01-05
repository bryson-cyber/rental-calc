# Market Research Data Extraction Notes

## Site Structure: coachinayah.com/market-charts

### Tabs Available:
1. **Dashboard** - Shows occupancy heat map by bedroom count
2. **Comp Data** - Top performing properties
3. **Map** - Geographic visualization
4. **Market Explorer** - Detailed market metrics
5. **Charts** - Seasonality and trend charts

### Dashboard Tab Data (Atlanta):

**TTM Occupancy Heat Map by Bedroom:**
| Bedrooms | Occupancy |
|----------|-----------|
| 1 Bedroom | 50% |
| 2 Bedrooms | 47% |
| 3 Bedrooms | 46% |
| 4 Bedrooms | 44% |
| 5 Bedrooms | 42% |
| 6+ Bedrooms | 45% |

### Key Observations:
- The site requires login to access
- Data loads dynamically after selecting a city
- Multiple filter options: Zipcodes, Submarkets, Cities, States
- Metrics available: Occupancy, and other selectable metrics
- Dashboard shows property types, amenities %, and heat maps

## Architecture for Manus-Powered Scraping

Since this site requires:
1. Login authentication (persistent session)
2. Dynamic data loading (JavaScript)
3. Multiple tab navigation
4. Complex dropdown interactions

**Proposed Solution:**
Use Manus scheduled tasks to:
1. Navigate and authenticate (one-time setup)
2. Select the market
3. Extract data from each tab
4. Store results in database
5. Return to user

The key challenge is that this requires a browser automation approach, not simple HTTP requests.


## Dashboard Tab - Full Data (Atlanta)

### Charts Visible:
1. **Amenities %** - Horizontal bar chart showing amenity percentages
   - Air Conditioning
   - Parking
   - Pool
   - Washer/Dryer
   - Kitchen
   - Suitable for Events
   - Hot Tub/Jacuzzi
   - Smoking

2. **TTM Occupancy** - Bar chart showing monthly occupancy (around 50-70% range)

3. **Property Types** - Horizontal bar chart showing count by type:
   - House
   - Guest Suite
   - Apartment
   - Townhouse
   - Bed & Breakfast
   - Cabin
   - Penthouse
   - Tower
   - Shipping Container

4. **TTM Occupancy Heat Map** - Grid showing occupancy by bedroom count
   - 1 Bedroom: 50%
   - 2 Bedrooms: 47%
   - 3 Bedrooms: 46%
   - 4 Bedrooms: 44%
   - 5 Bedrooms: 42%
   - 6+ Bedrooms: 45%



## Market Explorer Tab - Full Data (Atlanta)

### Metrics Available (15 columns):
1. Market Name (submarket/neighborhood)
2. Average Monthly Listings
3. Listing % Change
4. % Available Full Time
5. % Available Since Last Year
6. Annual Occupancy
7. Occupancy % Change
8. Annual ADR
9. Annual RevPAR
10. RevPAR % Change
11. Average Length of Stay
12. Average Booked Listings
13. Booked Listings % Change
14. Seasonality Score
15. % Professionally Managed

### Sample Submarkets Data (Atlanta):

| Submarket | Listings | Occupancy | ADR | RevPAR | Seasonality | Prof Managed |
|-----------|----------|-----------|-----|--------|-------------|--------------|
| Brookhaven/N Buckhead | 90 | 50.9% | $280.27 | $136.75 | 66.1% | 6.5% |
| Bankhead | 422 | 49.2% | $194.99 | $94.12 | 60.4% | 6.4% |
| Cumberland | 128 | 53.5% | $142.70 | $76.23 | 61.8% | 8.4% |
| Old Fourth Ward | 163 | 57.7% | $197.23 | $112.94 | 70.9% | 20.1% |
| Sandy Springs | 97 | 62.2% | $150.29 | $91.65 | 55.8% | 3.9% |
| Castleberry Hill | 65 | 49.5% | $199.32 | $100.98 | 63.3% | 7.0% |
| Pittsburgh | 232 | 51.9% | $190.95 | $95.52 | 64.0% | 13.0% |
| Chosewood Park | 67 | 53.5% | $190.85 | $97.09 | 59.0% | 5.3% |
| Mechanicsville | 126 | 48.0% | $174.22 | $81.92 | 50.2% | 7.4% |
| Cabbagetown | 69 | 59.4% | $195.21 | $111.86 | 59.4% | 26.7% |
| Summerhill | 142 | 48.2% | $218.45 | $103.41 | 58.7% | 5.2% |
| Lakewood Heights | 182 | 49.9% | $161.57 | $79.60 | 65.8% | 10.2% |
| Grant Park | 171 | 55.8% | $195.27 | $108.52 | 66.7% | 9.6% |
| Inman Park | 212 | 56.9% | $237.24 | $134.09 | 67.6% | 32.0% |
| Virginia Highland | 200 | 57.7% | $193.37 | $106.59 | 62.4% | 11.3% |
| West Midtown Atlanta | 505 | 52.4% | $230.32 | $117.71 | 69.9% | 20.6% |
| Buckhead | 323 | 45.7% | $286.20 | $127.74 | 54.4% | 11.5% |
| Midtown Atlanta | 542 | 53.4% | $209.42 | $112.81 | 74.2% | 26.7% |

Total: 39 submarkets in Atlanta



## Comp Data Tab - Property Listings (Atlanta)

### Metrics Available (16 columns):
1. Favorite (toggle)
2. Hidden (toggle)
3. Title (listing name)
4. Market Name
5. Occupancy
6. Days Available
7. ADR (Average Daily Rate)
8. Revenue (actual)
9. Revenue Potential
10. Property ID (Airbnb/VRBO ID)
11. Accommodates
12. Bedrooms
13. Bathrooms
14. Price Tier (economy/budget/midscale/upscale/luxury)
15. Property Type (house/apartment/bungalow/townhouse/cottage)
16. Zipcode

### Average for Atlanta:
- Occupancy: 48.0%
- Days Available: 150
- ADR: $220.00
- Revenue: $17,037.00
- Revenue Potential: $23,808.64
- Accommodates: 5
- Bedrooms: 2
- Bathrooms: 2

### Top Performers Sample:

| Title | Occupancy | ADR | Revenue | Type | Beds |
|-------|-----------|-----|---------|------|------|
| THE RED DOOR | 93.7% | $279.78 | $95,965 | house | 3 |
| SUN LIT BUNGALOW | 82.2% | $250.96 | $75,539 | bungalow | 3 |
| Grand Zen Manor (6BR) | 46.5% | $1,077.75 | $128,252 | house | 6 |
| Grand Zen Manor (VRBO) | 46.0% | $1,557.93 | $177,604 | house | 6 |
| Stunning Modern Oasis | 66.0% | $351.22 | $83,941 | house | 4 |
| Upscale Atlanta Retreat | 50.7% | $265.29 | $45,365 | cottage | 4 |
| Modern Estate near Ponce | 20.8% | $604.83 | $45,967 | house | 4 |

**Total listings in Atlanta: 11,303**

### Property ID Format:
- Airbnb: `abnb_XXXXXXXXX` (e.g., abnb_619000073368870508)
- VRBO: `vrbo_XXXXXXX` (e.g., vrbo_3314030)

Can construct Airbnb URL: https://airbnb.com/rooms/{property_id_number}



## Charts Tab - Seasonality Data (Atlanta)

### Charts Available:
1. **Metric by Month** - Line chart showing occupancy trends across 12 months
   - Shows seasonal patterns (peak vs low months)
   - Atlanta appears to have relatively stable occupancy (40-55% range)

2. **Year over Year Change %** - Line chart comparing YoY performance
   - Shows growth/decline trends by month
   - Multiple years displayed for comparison

3. **Metric by Year** - Line chart showing annual trends
   - Historical performance over multiple years
   - Helps identify long-term market trends

### Key Insights from Visual:
- Peak months appear to be around March-May and September-October
- Low months appear to be January-February and November-December
- YoY changes show some volatility but overall stable market

---

## Summary: Data Structure for Manus Scraping

### What Needs to Be Extracted:

1. **Dashboard Tab:**
   - Amenities % chart data
   - TTM Occupancy by month
   - Property Types distribution
   - Occupancy Heat Map by bedroom count

2. **Market Explorer Tab:**
   - Full table of submarkets (39 rows for Atlanta)
   - 15 metrics per submarket
   - Pagination support (25 per page)

3. **Comp Data Tab:**
   - Top performers table (11,303 listings for Atlanta)
   - 16 metrics per listing
   - Property IDs for Airbnb/VRBO links
   - Pagination support

4. **Charts Tab:**
   - Monthly occupancy data (12 months)
   - YoY change percentages
   - Historical annual data

5. **Map Tab:**
   - Geographic clusters (visual analysis)
   - Hotspot identification

### Technical Challenges:
1. **Authentication Required** - Site requires login
2. **Dynamic Loading** - Data loads via JavaScript after city selection
3. **Complex Dropdowns** - Multi-select with search
4. **Pagination** - Large datasets require multiple page loads
5. **Canvas Charts** - Chart data not in DOM, visual only

