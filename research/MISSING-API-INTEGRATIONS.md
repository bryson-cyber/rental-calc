# MISSING API INTEGRATIONS - COMPLETE LIST

## AirDNA Endpoints NOT Currently Implemented

### MARKET DATA - NOT USING
1. **`POST /market/{marketId}/charts/booking_lead_time`**
   - How far in advance guests book
   - Critical for: Understanding booking patterns, cash flow planning
   - Beginner value: "Guests book X days ahead - you need cash reserves for slow booking periods"

2. **`POST /market/{marketId}/charts/los`** (Length of Stay)
   - Average nights per booking
   - Critical for: Minimum stay strategy, turnover cost calculation
   - Beginner value: "Average stay is X nights - fewer turnovers = less cleaning costs"

3. **`POST /market/{marketId}/charts/future_pricing`**
   - How properties are priced for upcoming days
   - Critical for: Seasonality understanding, peak identification
   - Beginner value: "Prices spike in [months] - this is when you'll make the most money"

4. **`POST /market/explore`**
   - Explore all markets in a country
   - Critical for: Market comparison, finding best markets
   - Beginner value: "Here are the top markets near you ranked by revenue potential"

### SUBMARKET DATA - NOT USING
5. **`POST /submarket/explore/market`** ⭐ HIGH PRIORITY
   - Get ALL neighborhoods/zip codes within a market with metrics
   - Critical for: Finding the best neighborhood within a city
   - Beginner value: "Within [City], these are the TOP neighborhoods for arbitrage"

6. **`POST /submarket/{submarketId}/charts/booking_lead_time`**
   - Booking lead time for specific neighborhood
   - Critical for: Hyperlocal booking pattern analysis

7. **`POST /submarket/{submarketId}/charts/los`**
   - Length of stay for specific neighborhood
   - Critical for: Hyperlocal stay pattern analysis

8. **`POST /submarket/{submarketId}/charts/future_pricing`**
   - Future pricing for specific neighborhood
   - Critical for: Hyperlocal seasonality

### LISTING DATA - NOT USING
9. **`GET /listing/{listingId}`** ⭐ HIGH PRIORITY
   - Full listing details INCLUDING ALL IMAGES
   - Critical for: Competitor photo analysis, amenity verification
   - Beginner value: "Here's exactly what your competition looks like"

10. **`POST /listing/batch`**
    - Fetch multiple listings at once
    - Critical for: Efficient competitor data fetching

11. **`POST /listing/{listingId}/charts`**
    - Historical performance for a specific listing
    - Critical for: Understanding competitor trajectory
    - Beginner value: "This competitor has grown/declined X% over the past year"

12. **`POST /listing/{listingId}/comps`**
    - AirDNA's algorithm for finding comparable listings
    - Critical for: More accurate comp selection than radius-based
    - Beginner value: "These are the MOST similar properties to yours"

13. **`POST /listing/{listingId}/future_pricing`**
    - Future pricing for a specific listing
    - Critical for: Understanding competitor pricing strategy

### SMART RATES - NOT USING
14. **`GET /listing/{listingId}/smart_rates/pricing_strategies`**
    - Base rates for balanced/high_adr/high_occupancy strategies
    - Critical for: Pricing guidance
    - Beginner value: "Based on the market, you should charge $X/night"

15. **`POST /listing/{listingId}/smart_rates`**
    - Daily recommended rates
    - Critical for: Day-by-day pricing recommendations

### FILTERS NOT BEING USED
16. **amenities filter** (jsonb_boolean)
    - has_pool, has_hottub, has_parking, has_kitchen, has_washer, has_pets_allowed, etc.
    - Critical for: Apples-to-apples comparison
    - Beginner value: "Properties WITH hot tubs make $X more than those without"

17. **superhost filter**
    - Filter to only superhosts
    - Critical for: Understanding superhost premium
    - Beginner value: "Superhosts in this area make X% more"

18. **professionally_managed filter**
    - Filter to only professionally managed
    - Critical for: Understanding professional vs individual host performance

19. **price_tier filter** (budget/midrange/upscale/luxury)
    - Filter by price segment
    - Critical for: Understanding where your property fits

20. **listing_type filter** (entire_home/private_room/shared_room)
    - Filter by listing type
    - Critical for: Accurate comparison (entire home vs room)

21. **days_available_ltm filter**
    - Days available in last 12 months
    - Critical for: Filtering out part-time rentals

22. **occupancy_rate_ltm filter**
    - Filter by occupancy rate
    - Critical for: Finding high-performing properties

---

## GEMINI CAPABILITIES NOT BEING MAXIMIZED

### Vision Capabilities
1. **Analyze Zillow/rental listing photos**
   - User uploads or provides Zillow URL
   - AI analyzes the property's current state
   - Beginner value: "Your property has X, Y, Z - here's what you need to add"

2. **Analyze multiple competitor photos per listing**
   - Currently only analyzing 1 photo per competitor
   - Should analyze hero shot, bedrooms, kitchen, bathroom, amenities
   - Beginner value: "Top competitors all have: professional photos, staged spaces, etc."

3. **Generate design recommendations with visual examples**
   - Show "before/after" style recommendations
   - Beginner value: "Your bedroom should look like THIS, not like THAT"

### Analysis Capabilities
1. **Market trend analysis**
   - Analyze historical data to predict future performance
   - Beginner value: "This market is GROWING/DECLINING - here's the trend"

2. **Competitor strategy analysis**
   - Deep dive into why specific competitors succeed
   - Beginner value: "The #1 earner succeeds because..."

3. **Risk scenario modeling**
   - What happens if occupancy drops 20%? If ADR drops?
   - Beginner value: "Even in a bad scenario, you'd still make $X"

4. **Startup cost estimation by market**
   - Based on bedroom count and market tier
   - Beginner value: "To compete in this market, expect to invest $X-Y"

5. **Break-even timeline calculation**
   - Based on startup costs, rent, and projected revenue
   - Beginner value: "You'll recover your investment in X months"

6. **Amenity ROI analysis**
   - Which amenities have the best return on investment
   - Beginner value: "Adding a hot tub costs $X but adds $Y/year in revenue"

---

## DATA POINTS WE SHOULD SHOW (But Currently Don't)

### Market Health Indicators
- [ ] Listings entering market (new supply)
- [ ] Listings leaving market (churn)
- [ ] YoY listing growth rate
- [ ] YoY revenue change
- [ ] YoY occupancy change
- [ ] YoY ADR change
- [ ] Market saturation score

### Booking Behavior
- [ ] Average booking lead time
- [ ] Average length of stay
- [ ] Peak booking months
- [ ] Slow booking months
- [ ] Weekend vs weekday demand

### Competitor Intelligence
- [ ] % of market that are superhosts
- [ ] % professionally managed
- [ ] Average review count
- [ ] Average rating
- [ ] Property type distribution
- [ ] Amenity frequency analysis

### Financial Projections
- [ ] Startup cost range
- [ ] Monthly expense breakdown
- [ ] Break-even timeline
- [ ] Cash reserve recommendation
- [ ] Worst-case scenario projection
- [ ] Best-case scenario projection

### Seasonality
- [ ] Month-by-month revenue forecast
- [ ] Month-by-month occupancy forecast
- [ ] Peak season identification
- [ ] Slow season identification
- [ ] Seasonality score (how variable is revenue?)

---

## PRIORITY ORDER FOR IMPLEMENTATION

### P0 - Must Have for Lead Magnet
1. Booking lead time & length of stay
2. Submarket exploration (best neighborhoods)
3. Individual listing details with images
4. Amenity filtering for accurate comps
5. Historical trends (YoY changes)
6. Startup cost estimation
7. Break-even calculation

### P1 - Should Have
8. Future pricing data
9. Listing historical charts
10. Superhost/professional filters
11. Market saturation analysis
12. Risk scenario modeling

### P2 - Nice to Have
13. Smart rates integration
14. Listing comps endpoint
15. Bulk rentalizer
16. Market exploration
