# AirDNA Rentalizer PDF Report Format Analysis

## Page 1 - Property Overview

### Header
- AirDNA logo (top left)
- "Property Earning Potential" title (top right)

### Property Summary Card
- Submarket Score (86) with circular badge
- Address: "9XP9+GXV San Juan, Puerto Rico"
- Market: San Juan | Submarket: Rio Pedras
- Property specs: 3 Bed, 1 Bath, 6 Guests
- Property image (right side)

### Financial Metrics
- Operating Expenses: $9.8K
- Net Operating Income: $17.7K
- Cap Rate: ---

### Key Performance Indicators (4 boxes)
- $27.4K Projected Revenue
- 50% Occupancy
- $149 Average Daily Rate
- Medium Confidence Score

### Comparable Listings Table
Columns: Title, Bedrooms, Baths, Revenue Potential, Days Available, Revenue, Occupancy, ADR
- Shows 9 comparable properties with all metrics

### Map Visualization
- Google Maps with revenue markers ($17.2K, $14.5K, $12.6K, $11.3K, $32.2K)
- Shows property locations with revenue labels

### Footer
- QR code
- AIRDNA.CO
- Property address

---

## Page 2 - Detailed Analysis

### Amenities Section
"Comparable short-term rental amenities"
Two columns showing amenity percentages:
- Air Conditioning: 90%
- Dryer: 70%
- Heating: 0%
- Hot Tub: 0%
- Kitchen: 100%
- Parking: 90%
- Pool: 30%
- Cable TV: 80%
- Washer: 80%
- Wireless Internet: 100%

### Monthly Revenue Projection Chart
"What is the projected monthly revenue over the next year?"
- Line chart showing Jan-Dec 2026
- Y-axis: $0 to $4K
- Shows Monthly Revenue line and Revenue Range band
- Peak around Apr-May (~$3.5K), low in Nov-Dec (~$1K)

### Annual Revenue Trend Chart
"How has the annual projected revenue changed over time?"
- Line chart showing Jan 2024 - Dec 2025
- Y-axis: $24K to $30K
- Shows "Estimated Revenue" trend line
- Fluctuates between ~$25K and ~$29K

### Explanation Boxes
1. "How does the revenue calculator work?"
   - Explains comparable property matching
   - Index creation based on relevance
   - Factors in seasonality, rental demand, revenue growth

2. "How are the financial numbers determined?"
   - Explains operating expenses calculation
   - HOA fees, taxes included
   - Net operating income = Revenue - Expenses
   - Cap rate explanation

### Footer
- QR code
- AIRDNA.CO
- Property address

---

## Key Features to Implement

### Must Have (Critical)
1. ✅ Comp Data Table - DONE (needs formatting improvements)
2. ⚠️ Historical Trends - PARTIAL (fix submarket data)
3. ❌ Map with Revenue Markers - NOT DONE
4. ❌ PDF Export - NOT DONE

### Data Points Needed
- Submarket Score
- Operating Expenses calculation
- Net Operating Income
- Cap Rate
- Confidence Score
- Days Available per listing
- Revenue Potential per listing
- Amenities percentages
- Monthly revenue projection
- Annual revenue trend

### API Endpoints to Use
- /submarket/{id}/listings - for comp data ✅
- /metrics/occupancy - for historical trends
- /metrics/avg_revenue - for revenue trends
- /metrics/adr - for ADR trends
- /metrics/active_listings_count - for listing trends
- Rentalizer API - for property-specific estimates
