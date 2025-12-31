# SOP Analysis Notes

## Key Understanding

The user wants a **fully automated, AI-powered tool** that:
1. User enters a property (Zillow URL or address) OR a market/city
2. The system does ALL the work behind the scenes (API calls, data analysis, AI synthesis)
3. User receives a **polished, educational report** - they don't see the raw data or process

## For Property Analysis (Airbnb Arbitrage)

### Data Collection (Behind the Scenes)
1. **From Zillow/Property Input:**
   - Full Address, Neighborhood, Property Type
   - Bedrooms, Bathrooms, Square Footage
   - **Monthly Rent** (CRITICAL for arbitrage calculation)
   - 4-5 attractive features for Airbnb guests

2. **From AirDNA (our API):**
   - Market averages for same bedroom count in same ZIP
   - Revenue tiers: Top 10%, Top 25%, Median
   - Top 5 competitors earning above threshold (Monthly Rent × 12 × 2)

### Key Calculations
- **Minimum Competitor Revenue Threshold** = Monthly Rent × 12 × 2
  - Example: $3,800/month rent → $91,200 minimum competitor revenue
  - Only analyze competitors earning this or more
  - If NO competitors meet threshold = RED FLAG (not viable for arbitrage)

### Report Output (What User Sees)
1. **Section 1: The Property** - Details + attractive features
2. **Section 2: Local Market Analysis** - Same-bedroom comps, revenue tiers (Good/Better/Best)
3. **Section 3: Study the Competition** - Top 5 competitors with Airbnb links + success factors
4. **Section 4: Project the Profit** - Startup costs ($20K), monthly expenses, profit scenarios

### Profit Calculation
- **Monthly Expenses:**
  - Rent: [from Zillow]
  - Utilities: $250
  - Internet: $80
  - Supplies: $250
  - Maintenance: $200
  - Total: Rent + $780

- **Profit Scenarios:**
  - Conservative (Median revenue) - Annual Expenses = Profit
  - Realistic (Top 25% revenue) - Annual Expenses = Profit ← TARGET
  - Optimistic (Top 10% revenue) - Annual Expenses = Profit

## For Market Analysis (eBook Style)

### Report Structure (7 Chapters)
1. **The Big Picture** - Market overview, key stats
2. **What Guests Want** - Amenities breakdown, property types
3. **Understanding the Seasons** - Peak/shoulder/off seasons, occupancy by month
4. **Best Neighborhoods to Invest In** - Tiered rankings:
   - Tier 1: Premier (best all-around)
   - Tier 2: High-Occupancy (always booked)
   - Tier 3: Up-and-Coming (growth signals)
   - Caution: Declining areas
5. **Property Size Matters** - Bedroom count analysis
6. **Deeper Insights** - ADR trends, listing growth, booked listings
7. **Your Action Plan** - Recommendations

### Writing Style
- **Elementary level** - explain everything simply
- No jargon - instead of "ADR of $446", say "you can charge $446 per night"
- Add "What This Means For You" after each insight
- Tables for data, prose for explanations

## AI Integration Needed

Use Gemini AI to:
1. **Analyze property features** - Identify what makes it attractive for Airbnb
2. **Synthesize market data** - Turn raw numbers into insights
3. **Generate competitor success factors** - What makes top performers successful
4. **Write educational content** - Explain data in simple terms
5. **Create recommendations** - Personalized action plans

## Rent Estimation

For arbitrage, we MUST have the monthly rent. Options:
1. User provides Zillow URL → scrape rent from listing
2. User manually enters rent
3. Estimate rent using Zillow Rent Zestimate API or similar
4. Use market average rent for property type/size

## Implementation Plan

1. **Simplify the UI** - Single input field, user just enters property or market
2. **Add rent input** - Required for property analysis
3. **Integrate Gemini AI** - For content generation and insights
4. **Calculate profitability** - Using the formulas above
5. **Generate polished reports** - Following the exact SOP templates
6. **Hide all technical details** - User only sees final output
