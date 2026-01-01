# Platform Maximization Research

## Current State Analysis

### AirDNA API - Currently Used Endpoints
1. `/country/us/markets` - Get all US markets
2. `/market/{marketId}` - Get market details
3. `/market/{marketId}/metrics/{metricType}` - Get market metrics (occupancy, ADR, revenue)
4. `/market/{marketId}/listings` - Get listings in a market
5. `/submarket/{submarketId}/listings` - Get listings in a submarket
6. `/rentalizer/estimate` - Property revenue estimates
7. `/listing/comps/area` - Nearby comparable listings
8. `/listing/{propertyId}` - Individual listing details

### AirDNA API - Potentially Unused Capabilities
Based on research file and code audit:
1. `/market/availability/daily` - 6-month forward supply/demand forecast
2. `property_value` in Rentalizer - Estimated property value for ROI
3. `historical_valuation` - Month-over-month trends
4. `revenue_range` - Upper/lower bounds (confidence intervals)
5. `platforms` - Airbnb + Vrbo IDs for multi-platform analysis
6. Market Score endpoint - Investment scoring

### Gemini API - Currently Used Features
1. Function calling with 9 tools defined
2. Multi-turn conversation with history
3. System instructions for persona
4. Temperature and token configuration

### Gemini API - Unused Advanced Features
1. **Structured Outputs** - Force JSON schema responses for consistent data
2. **Parallel Function Calling** - Call multiple functions simultaneously
3. **Compositional Function Calling** - Chain functions in sequence
4. **Thinking Models** - Gemini 2.5/3 reasoning for better decisions
5. **Code Execution** - Run Python code for calculations
6. **Google Search Integration** - Real-time web search
7. **Context Caching** - Cache repeated context for efficiency

---

## ZIP CODE SEARCH - THE FIX

### Current Problem
The AI advisor detects zip codes but tells users it can't search by zip code. The AirDNA API doesn't have a direct zip-to-market endpoint.

### Solution Options

**Option 1: Geocoding Approach (Recommended)**
1. Use Google Geocoding API to convert zip code to lat/lng
2. Use lat/lng to search for nearby markets
3. Or use the Rentalizer API with a generic address in that zip

**Option 2: Zip Code Database**
1. Build a mapping of US zip codes to AirDNA market IDs
2. Pre-populate from market data that includes zip codes

**Option 3: Address-Based Workaround**
1. When user enters zip code, construct a generic address like "123 Main St, [zip]"
2. Use Rentalizer API which accepts addresses and returns market data

---

## FEATURES TO MAXIMIZE CLIENT VALUE

### High-Impact Features (Implement Now)

1. **ZIP CODE SEARCH** - Users expect this to work
   - Use geocoding to convert zip to coordinates
   - Query Rentalizer with constructed address
   - Return market data for that area

2. **INVESTMENT SCORE (1-100)** - Simple decision metric
   - Combine: revenue potential, occupancy, competition, seasonality
   - Show as prominent badge: "Investment Score: 78/100"
   - Explain what drives the score

3. **6-MONTH REVENUE FORECAST** - Future visibility
   - Use `/market/availability/daily` endpoint
   - Show projected demand by month
   - Help users time their launch

4. **LISTING DESCRIPTION GENERATOR** - Immediate value
   - Use Gemini to write optimized Airbnb listing copy
   - Based on property features and top performer analysis
   - Showcase AI power

5. **PROPERTY COMPARISON TOOL** - Side-by-side analysis
   - Compare 2-3 saved properties
   - AI-generated recommendation on which to pursue

### Medium-Impact Features (Next Sprint)

6. **REGULATORY ALERTS** - Trust builder
   - Warn about STR regulations in specific markets
   - Use Gemini with Google Search to find current rules

7. **PRICING CALENDAR** - Show complexity
   - Month-by-month recommended pricing
   - Based on seasonality data
   - "This is complex - let us manage it"

8. **ROI CALCULATOR** - Investment decision support
   - Include property purchase price
   - Calculate cash-on-cash return
   - Show payback timeline

### Gemini Enhancements

9. **STRUCTURED OUTPUTS** - Consistent responses
   - Define JSON schema for each response type
   - Ensure tables always format correctly
   - Better parsing for frontend

10. **PARALLEL FUNCTION CALLING** - Faster responses
    - Fetch market + seasonality + top performers simultaneously
    - Reduce response time significantly

11. **GOOGLE SEARCH TOOL** - Real-time info
    - Add as Gemini tool for regulatory questions
    - "What are the STR rules in Austin?"

---

## IMPLEMENTATION PRIORITY

### Phase 1: ZIP CODE FIX (Critical)
- Add geocoding function to convert zip to lat/lng
- Create new AI tool `search_by_zipcode`
- Return market data for that zip code area

### Phase 2: INVESTMENT SCORE
- Calculate score from existing data
- Add to property and market analyses
- Display prominently in UI

### Phase 3: LISTING GENERATOR
- New Gemini tool to generate listing copy
- Input: property features, market data, top performer insights
- Output: Title, description, amenity highlights

### Phase 4: STRUCTURED OUTPUTS
- Define response schemas
- Ensure consistent formatting
- Better frontend rendering

---

## SUCCESS METRICS

| Feature | User Value | Business Value |
|---------|------------|----------------|
| Zip Code Search | "It just works" | Removes friction |
| Investment Score | Quick decision | Memorable metric |
| Listing Generator | Immediate output | Shows AI power |
| 6-Month Forecast | Future planning | Uses more API |
| Regulatory Alerts | Risk awareness | Trust builder |
