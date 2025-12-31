# AirDNA Interface Study Notes

## Key Observations from St. Louis / Debaliviere Place Market

### Market Header Display
- Shows: "Market Overview: St. Louis > Debaliviere Place"
- Clear breadcrumb navigation showing parent market > submarket
- Location name is prominently displayed

### Key Metrics Cards (Top Section)
1. **Submarket Score**: 96 (circular gauge)
   - Investability: 85
   - Rental Demand: 90
   - Revenue Growth: 91
   - Seasonality: 76
   - Regulation: 57

2. **Annual Revenue**: $30,395 (+20% change indicator)
3. **Occupancy Rate**: 66% (+12% change indicator)
4. **Average Daily Rate**: $138.11 (+9% change indicator)
5. **RevPAR**: $91.28 (+21% change indicator)

### Top Short-term Rentals Section
- Title: "Top Short-term Rentals"
- Subtitle: "Top listings based on revenue and reviews"
- Card format showing:
  - Property image with badges (beds, baths, guests, rating)
  - Property title (truncated with ellipsis)
  - Location: "St. Louis"
  - Revenue Potential: $136.3k
  - Days Available: 270
  - Revenue: $106.7k
  - Occupancy: 79%
  - Daily Rate: $503.2

### Formatting Patterns
- Currency: $30,395 (with comma), $136.3k (abbreviated for large numbers)
- Percentages: 66%, 79%, 92% (no decimal for whole numbers)
- Change indicators: +20%, +12% (green color for positive)
- Ratings: 4.0 (17), 5.0 (43) - rating followed by review count in parentheses

### Top Performers Characteristics
- Entertainment Oasis: 5 bed, 3 bath, 16 guests, 4.0 rating, $106.7k revenue, 79% occupancy
- Charming Forest Park: 6 bed, 3 bath, 14 guests, 5.0 rating, $93.3k revenue, 55% occupancy
- Brand New Townhome: 5 bed, 3 bath, 9 guests, 5.0 rating, $76.2k revenue, 92% occupancy

### For-Sale Properties Section
- Shows yield percentage (21.0%, 6.8%, 6.7%)
- Days on Market
- Revenue, Occupancy, Daily Rate

### Top Submarkets Section
- Score badge (100, 99, 99)
- Submarket name
- Parent market
- Revenue Potential
- Occupancy
- Daily Rate
- "Over the last 12 months" label

## Issues to Fix in Our App
1. "Unknown Location" - need to properly extract and display market/submarket name
2. Occupancy formatting - should show as "79%" not "0.79" or broken format
3. Top performers - need proper card layout with all metrics visible
4. Revenue formatting - use $30.4k format for large numbers
