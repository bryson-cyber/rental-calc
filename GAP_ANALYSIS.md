# Gap Analysis: Current AI vs SOP Requirements

## Executive Summary

After analyzing the 4 SOPs and the current AI implementation, there are significant gaps between what the manual process delivers and what the AI currently provides. The AI has good foundational capabilities but is missing the **structured report generation**, **revenue percentile data**, **competitor success factor analysis**, and **profitability calculation formulas** that the SOPs require.

---

## Current AI Capabilities (What We Have)

### Existing Functions (14 base + 15 enhanced = 29 total)

| Function | Purpose | SOP Alignment |
|----------|---------|---------------|
| search_market | Find market by name | ✅ Supports market lookup |
| get_market_data | Comprehensive market report | ✅ Provides revenue, occupancy, ADR |
| get_top_performers | Top listings by revenue | ⚠️ Missing revenue threshold filter |
| get_seasonality | Monthly patterns | ✅ Supports seasonality analysis |
| get_bedroom_estimate | Revenue by bedroom count | ✅ Supports bedroom analysis |
| analyze_property | Property revenue estimate | ⚠️ Missing percentile context |
| search_nearby_listings | Competitor search | ⚠️ Missing success factor analysis |
| calculate_profit | Financial analysis | ⚠️ Uses different formula than SOP |
| search_by_zipcode | ZIP code market data | ✅ Core functionality |
| generate_listing_description | Listing copy | ✅ Bonus feature |
| calculate_investment_score | Investment rating | ⚠️ Not aligned with SOP scoring |
| calculate_amenity_impact | Amenity ROI | ✅ Bonus feature |
| find_markets_for_budget | Budget-based search | ✅ Bonus feature |
| explore_submarkets | Neighborhood analysis | ✅ Supports neighborhood tiers |

### Enhanced Functions (Recently Added)
- compare_multiple_markets
- analyze_market_submarkets
- find_top_markets_nationwide
- analyze_arbitrage_feasibility
- compare_property_configurations
- analyze_competition_landscape
- generate_investment_thesis
- calculate_scenario_analysis
- identify_market_gaps
- get_bedroom_performance_breakdown
- compare_property_types
- analyze_amenity_correlation
- calculate_revenue_percentile
- calculate_seasonality_adjusted_revenue
- generate_deal_analysis

---

## Critical Gaps (What's Missing)

### Gap 1: Revenue Percentile Data
**SOP Requirement:** Report must show Top 10% (90th percentile), Top 25% (75th percentile), and Median (50th percentile) revenue.

**Current State:** We have `calculate_revenue_percentile` but it calculates where a property ranks, not the actual percentile values for the market.

**Fix Required:** Add function to retrieve market percentile benchmarks:
```typescript
get_market_percentiles(market_id, bedrooms) → {
  top_10_percent: $X,
  top_25_percent: $X,
  median: $X,
  average: $X
}
```

### Gap 2: Minimum Competitor Revenue Threshold
**SOP Requirement:** Only analyze competitors earning ≥ Monthly Rent × 12 × 2

**Current State:** `get_top_performers` returns top by revenue but doesn't filter by threshold.

**Fix Required:** Add threshold parameter to top performers:
```typescript
get_top_performers_above_threshold(market_name, bedrooms, min_revenue_threshold)
```

### Gap 3: Competitor Success Factor Analysis
**SOP Requirement:** For each competitor, identify the "single most important reason for their success" (e.g., "A Private Hot Tub", "Incredible Design & Branding").

**Current State:** We return competitor data but don't analyze WHY they succeed.

**Fix Required:** Add AI-powered success factor analysis:
```typescript
analyze_competitor_success_factors(listing_id) → {
  key_success_factor: "Private Hot Tub",
  supporting_factors: ["5.0 rating", "Professional photos"],
  competitive_edge: "Only property with hot tub in ZIP"
}
```

### Gap 4: Structured Report Generation
**SOP Requirement:** Generate reports following exact templates with specific sections, tables, and formatting.

**Current State:** AI generates free-form responses, not structured reports.

**Fix Required:** Add report generation functions:
```typescript
generate_arbitrage_report(property_data, market_data, competitors) → Markdown report
generate_simplified_report(property_data, market_data, competitors) → Markdown report
generate_market_ebook(city, market_data, neighborhoods) → Markdown eBook
```

### Gap 5: Profitability Calculation Formulas
**SOP Requirement:**
- Startup costs: Fixed $20,000
- Monthly expenses: Rent + $250 (utilities) + $80 (internet) + $250 (supplies) + $200 (maintenance)
- Three scenarios: Conservative (Median), Realistic (Top 25%), Optimistic (Top 10%)

**Current State:** `calculate_profit` uses different formula and doesn't show three scenarios.

**Fix Required:** Update profit calculation to match SOP:
```typescript
calculate_sop_profitability(monthly_rent, market_percentiles) → {
  startup_costs: 20000,
  monthly_expenses: rent + 780,
  annual_expenses: (rent + 780) * 12,
  scenarios: {
    conservative: { revenue: median, profit: X },
    realistic: { revenue: top_25, profit: X },
    optimistic: { revenue: top_10, profit: X }
  }
}
```

### Gap 6: Neighborhood Tiering
**SOP Requirement:** Categorize neighborhoods into:
- Tier 1: Premier (best all-around)
- Tier 2: High-Occupancy (always booked)
- Tier 3: Up-and-Coming (growth signals)
- Caution: Declining metrics

**Current State:** `analyze_market_submarkets` ranks neighborhoods but doesn't tier them.

**Fix Required:** Add tiering logic based on RevPAR, occupancy, and growth metrics.

### Gap 7: Plain Language Explanations
**SOP Requirement:** Don't use technical terms. Instead of "ADR of $446 and RevPAR of $296", write "you can charge an average of $446 per night, and properties earn more income here than anywhere else."

**Current State:** AI uses technical terminology.

**Fix Required:** Update system prompt to enforce plain language explanations with "What This Means" sections.

### Gap 8: Airbnb URL Retrieval
**SOP Requirement:** All competitor listings must have hyperlinked Airbnb URLs.

**Current State:** We have listing IDs but don't always return Airbnb URLs.

**Fix Required:** Ensure all listing data includes Airbnb URL in format: `https://www.airbnb.com/rooms/{airbnb_property_id}`

---

## Data Availability Check

### What AirDNA API Provides (Confirmed)

| Data Point | Endpoint | Available |
|------------|----------|-----------|
| Market averages (Revenue, Occ, ADR) | /market/{id}/details | ✅ |
| Revenue percentiles | /market/{id}/details | ⚠️ Need to verify |
| Top performers by revenue | /market/{id}/listings | ✅ |
| Listing details (amenities, photos) | /listing/{id} | ✅ |
| Seasonality data | /market/{id}/seasonality | ✅ |
| Submarket/neighborhood data | /market/{id}/submarkets | ✅ |
| Property estimate (Rentalizer) | /rentalizer | ✅ |
| Airbnb property ID | /listing/{id} | ✅ |

### What We Need to Verify
1. Does AirDNA return revenue percentiles (P90, P75, P50)?
2. Can we filter listings by minimum revenue?
3. Do listing details include Airbnb URL?

---

## Implementation Priority

### Phase 1: Critical Fixes (Immediate)
1. **Add market percentile retrieval** - Required for all report types
2. **Update profit calculation** - Match SOP formulas exactly
3. **Add competitor threshold filtering** - Only show viable comps
4. **Ensure Airbnb URLs in listings** - Required for reports

### Phase 2: Report Generation (High Priority)
5. **Create structured report templates** - Match SOP formats
6. **Add success factor analysis** - AI-powered competitor insights
7. **Implement neighborhood tiering** - Categorize by performance

### Phase 3: Polish (Medium Priority)
8. **Update system prompt for plain language** - No technical jargon
9. **Add "What This Means" explanations** - After every data point
10. **Create eBook generation** - For market-level reports

---

## Recommended New Functions

```typescript
// Phase 1
get_market_percentiles(market_id, bedrooms)
get_competitors_above_threshold(market_name, bedrooms, monthly_rent)
calculate_sop_profitability(monthly_rent, market_percentiles)

// Phase 2
generate_arbitrage_report(address, monthly_rent)
generate_simplified_report(address, monthly_rent)
generate_market_ebook(city_name)
analyze_competitor_success_factor(listing_id)
tier_neighborhoods(market_id)

// Phase 3
explain_metric_plain_language(metric_name, value, context)
```

---

## Summary

The current AI has **~60% of required capabilities** but is missing the structured output and specific calculations that make the SOPs valuable. The key insight is that the SOPs don't just provide data—they provide **analysis, context, and actionable recommendations** in a specific format that clients expect.

**Bottom Line:** We need to transform the AI from a "data retrieval assistant" into a "report generation engine" that follows the exact SOP templates.


---

# Updated Gap Analysis (January 2026)

## AirDNA API - Unused Endpoints

| Endpoint | Description | Value |
|----------|-------------|-------|
| `/listing/{listingId}/smart_rates/pricing_strategies` | Smart pricing recommendations | HIGH - Show optimal pricing |
| `/submarket/{submarketId}/metrics/active_listings_count` | 12-60 months of supply data | HIGH - Market supply trends |
| `/submarket/{submarketId}/metrics/booking_lead_time` | How far in advance guests book | MEDIUM - Booking patterns |
| `/submarket/{submarketId}/metrics/average_length_of_stay` | Typical guest stay duration | MEDIUM - Guest behavior |
| `/market/{marketId}/future_pricing` | Forward-looking daily rates | HIGH - Future pricing data |

---

## Step-by-Step UI/Feature Gaps

### Step 1: Guide (Address Input)
- [ ] Zillow link auto-import
- [ ] Recent search history (localStorage)
- [ ] Address doesn't auto-fill between forms

### Step 2: Explore Listings
- [ ] **Freshness filter** - Exclude last review > 2 months (USER REQUIREMENT)
- [ ] **Amenities filter** (USER REQUIREMENT)
- [ ] Revenue range filter
- [ ] Rating/Superhost filter
- [ ] Bulk export to CSV
- [ ] Image gallery (multiple photos per listing)

### Step 3: Validate the Deal
- [ ] Booking lead time metric (API available)
- [ ] Average length of stay metric (API available)
- [ ] Active listings trend (API available)
- [ ] Smart pricing recommendations (API available)
- [ ] Future pricing forecast (API available)
- [ ] Break-even calculator with actual rent input
- [ ] Expense estimator

### Step 4: Find the Best Deal
- [ ] Deal score explanation
- [ ] Custom weighting for factors
- [ ] Save favorites
- [ ] Side-by-side compare mode

### Step 5: Map View
- [x] User property marker (FIXED)
- [x] Location disclaimer (FIXED)
- [x] Custom comp set (FIXED)
- [ ] Heatmap view
- [ ] Neighborhood boundaries
- [ ] Points of interest
- [ ] Walk score integration

### Step 6: AI Advisor
- [ ] Market Advisor data connection
- [ ] Follow-up questions
- [ ] PDF export
- [ ] Share link

---

## Priority Implementation Order

### CRITICAL (Do First)
1. Freshness filter (exclude stale listings)
2. Booking lead time + length of stay metrics
3. Active listings trend (supply/demand)
4. Break-even calculator with rent input
5. Market Advisor data connection

### HIGH (Do Next)
6. Smart pricing recommendations
7. Future pricing forecast
8. Amenities filter
9. PDF export for AI reports
10. Image gallery for comps

### MEDIUM (Enhancement)
11. Zillow link import
12. Heatmap view
13. Bulk export to CSV
14. Save favorites

---

## Current Capability: ~65%

**What's Working Well:**
- Property revenue estimates
- Competitor analysis (same bedroom)
- Seasonality display
- YoY comparison
- AI Property Advisor (rental arbitrage focus)
- Map with custom comp sets
- Metric tooltips

**What's Missing:**
- 5 unused AirDNA endpoints
- Key filters (freshness, amenities)
- Break-even calculator
- Market Advisor
- Export capabilities
