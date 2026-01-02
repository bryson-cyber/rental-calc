# AirDNA API & Gemini Utilization Analysis

**Prepared by:** Manus AI  
**Date:** January 2, 2026  
**Project:** Rental Revenue Calculator  

---

## Executive Summary

This analysis reveals that the Rental Revenue Calculator is using **only 28% of available AirDNA functions** (11 of 39) and passing approximately **65% of fetched data** to Gemini for analysis. There are significant opportunities to enhance the AI output by utilizing more AirDNA endpoints and passing richer data to Gemini.

---

## Part 1: AirDNA API Endpoint Analysis

### API Endpoints Currently Called

The application makes calls to **16 unique AirDNA API endpoints**:

| Endpoint | Purpose | Used in Report |
|----------|---------|----------------|
| `/rentalizer/estimate` | Property revenue estimates | ✅ Yes |
| `/market/search` | Find market by location | ✅ Yes |
| `/market/${id}` | Market details & metrics | ✅ Yes |
| `/market/${id}/listings` | Market listings | ✅ Yes |
| `/market/${id}/metrics/${type}` | Historical metrics | ✅ Yes |
| `/market/${id}/metrics/active_listings_count` | Supply data | ✅ Yes |
| `/market/${id}/metrics/booking_lead_time` | Booking patterns | ✅ Yes |
| `/market/${id}/metrics/los` | Length of stay | ✅ Yes |
| `/market/${id}/future_pricing` | Future daily data | ✅ Yes |
| `/submarket/${id}` | Submarket details | ❌ Not used |
| `/submarket/${id}/listings` | Submarket listings | ❌ Not used |
| `/listing/${id}` | Single property details | ❌ Not used |
| `/listing/${id}/metrics` | Listing historical data | ❌ Not used |
| `/listing/${id}/comps` | Listing comparables | ❌ Not used |
| `/listing/${id}/future/pricing` | Listing future pricing | ❌ Not used |
| `/listing/explore/market/${id}` | Explore listings | ❌ Not used |

### AirDNA Functions: Used vs. Available

| Category | Total Functions | Used in Analysis | Utilization |
|----------|-----------------|------------------|-------------|
| Market Functions | 15 | 8 | 53% |
| Listing Functions | 12 | 0 | 0% |
| Property Functions | 6 | 2 | 33% |
| Utility Functions | 6 | 1 | 17% |
| **Total** | **39** | **11** | **28%** |

### Functions Currently Used (11)

| Function | API Calls | Data Returned |
|----------|-----------|---------------|
| `getRentalizerEstimate` | 1 | Property estimates, monthly forecast, comps |
| `searchByZipcode` | 1 | Market/submarket IDs |
| `getComprehensiveMarketReport` | 3 | Market details, historical, listings |
| `getMarketDetails` | 1 | Market metrics, location |
| `getMarketHistoricalData` | 1 | 12-60 months of metrics |
| `getMarketSeasonality` | 1 | Monthly seasonality patterns |
| `getMarketFutureDailyData` | 1 | 90-day forward forecast |
| `getMarketBookingPatterns` | 1 | Lead time, length of stay |
| `getMarketSupplyTrend` | 1 | Listing count changes |
| `getMarketProfessionalStats` | 1 | Host type breakdown |
| `getMarketCancellationPolicies` | 1 | Policy distribution |

### Functions NOT Used (28)

| Function | Potential Value | Difficulty |
|----------|-----------------|------------|
| `getListingHistoricalMetrics` | See actual competitor performance over time | Low |
| `getListingComps` | Better comp matching than radius-based | Low |
| `getListingFuturePricing` | See competitor pricing strategies | Low |
| `getSinglePropertyDetails` | Deep dive on specific competitors | Low |
| `getTopPerformers` | Find the best in market with filters | Medium |
| `calculateArbitrageFeasibility` | Pre-built feasibility calculation | Low |
| `getQualifyingCompetitors` | Better competitor filtering | Medium |
| `enrichListingsWithImages` | Add images to competitor analysis | Medium |
| `exploreSubmarketsWithMetrics` | Submarket comparison | Medium |
| `getSubmarketDetails` | Neighborhood-level analysis | Medium |
| `getSubmarketListings` | Neighborhood competitors | Medium |
| `getCountryMarkets` | Market discovery | Low |
| `getListingsInRadius` | Hyper-local competition | Medium |
| `getAllMarketListings` | Complete market picture | High |
| `getFilteredMarketListings` | Advanced filtering | Medium |

---

## Part 2: Data Flow to Gemini

### Data Currently Passed to Gemini

The `generateNarrativeReport` function receives and passes the following data:

| Data Category | Fields Passed | Utilization |
|---------------|---------------|-------------|
| **Property Details** | address, monthly_rent, bedrooms, bathrooms | 100% |
| **Market Overview** | market_name, occupancy, ADR, active_listings | 100% |
| **Revenue Projections** | low, mid, high estimates | 100% |
| **Profitability** | monthly_expenses, annual_profit (3 scenarios) | 100% |
| **Competitors** | Top 5 only (name, revenue, occupancy, ADR, rating) | 50% |
| **Seasonality** | 12 months (revenue, occupancy, ADR, season_type) | 100% |
| **Historical (5yr)** | Occupancy, ADR, revenue trends | 100% |
| **Supply Trend** | Current listings, net change, trend | 100% |
| **Professional Stats** | Professional %, superhost %, premium | 100% |
| **Amenities** | Top 8 amenities with percentages | 80% |
| **Risks** | Top 5 risks with severity | 50% |
| **Booking Patterns** | Lead time, length of stay | 100% |

### Data Fetched But NOT Passed to Gemini

| Data Available | Source | Why It's Valuable |
|----------------|--------|-------------------|
| Competitor amenities list | Rentalizer comps | Could recommend specific amenities |
| Competitor images | Rentalizer comps | Photo analysis for design insights |
| Competitor property types | Rentalizer comps | Property type performance comparison |
| Competitor last review date | Rentalizer comps | Identify active vs. stale listings |
| Submarket breakdown | Market report | Neighborhood-level insights |
| Bedroom performance | Market report | Optimal bedroom count analysis |
| Future daily pricing | Future data | Day-by-day pricing recommendations |
| ADR percentiles (25/50/75) | Future data | Pricing tier recommendations |
| Cancellation policies | Policy stats | Policy recommendations |
| RevPAR | Market metrics | Efficiency metric |
| Market score | Market metrics | Overall market health |

---

## Part 3: Gemini Utilization Assessment

### Current Prompt Structure

The narrative report prompt is approximately **2,500 tokens** and includes:

| Section | Token Estimate | Quality |
|---------|----------------|---------|
| Property Details | ~100 | Good |
| Market Overview | ~150 | Good |
| Revenue Projections | ~200 | Good |
| Profitability | ~200 | Good |
| Competitors | ~300 | Limited (only 5) |
| Seasonality | ~200 | Good |
| Historical Context | ~300 | Good |
| Supply/Professional | ~200 | Good |
| Amenities/Risks | ~200 | Partial |
| Instructions | ~650 | Good |

### What Gemini Could Do With More Data

| Enhancement | Data Needed | AI Capability |
|-------------|-------------|---------------|
| **Competitor Deep Dive** | Full competitor list with amenities | Pattern recognition across 20+ listings |
| **Pricing Optimization** | Daily pricing data, ADR percentiles | Specific daily rate recommendations |
| **Amenity Prioritization** | Competitor amenities + revenue correlation | ROI-ranked amenity recommendations |
| **Neighborhood Analysis** | Submarket data | Location-specific insights |
| **Photo-Based Insights** | Competitor images | Design and staging recommendations |
| **Trend Prediction** | 5-year historical + future data | Market trajectory forecasting |
| **Risk Quantification** | More granular risk data | Probability-weighted risk assessment |

---

## Part 4: Specific Enhancement Opportunities

### Opportunity 1: Competitor Deep Dive (High Impact)

**Current State:** Only top 5 competitors passed to Gemini with basic metrics.

**Enhancement:** Pass all 10-20 competitors with full data including amenities, property type, and review recency.

**New AI Capabilities:**
- Identify which amenities correlate with higher revenue
- Spot underserved property types in the market
- Find "stale" competitors (no recent reviews) as weak competition
- Calculate what it takes to reach top 10% performance

**Implementation:**
```typescript
// Add to narrative report input
competitors_full: Array<{
  name: string;
  annual_revenue: number;
  occupancy: number;
  adr: number;
  rating: number | null;
  reviews: number;
  amenities: string[];  // NEW
  property_type: string;  // NEW
  last_review_date: string;  // NEW
  is_superhost: boolean;  // NEW
  is_professional: boolean;  // NEW
}>
```

---

### Opportunity 2: Daily Pricing Intelligence (High Impact)

**Current State:** Only monthly averages passed to Gemini.

**Enhancement:** Pass daily pricing data with percentiles.

**New AI Capabilities:**
- Recommend specific prices for each day of the week
- Identify pricing gaps (days where you could charge more)
- Suggest minimum stay strategies by season
- Calculate weekend premium opportunities

**Implementation:**
```typescript
// Add to narrative report input
daily_pricing: Array<{
  date: string;
  adr_25th: number;
  adr_50th: number;
  adr_75th: number;
  occupancy: number;
  is_weekend: boolean;
  is_holiday: boolean;
}>
```

---

### Opportunity 3: Submarket/Neighborhood Analysis (Medium Impact)

**Current State:** Only market-level data used.

**Enhancement:** Include submarket breakdown.

**New AI Capabilities:**
- Identify best-performing neighborhoods
- Recommend optimal location within the market
- Compare property's submarket to market average
- Spot emerging neighborhoods

**Implementation:**
```typescript
// Add to narrative report input
submarkets: Array<{
  name: string;
  listing_count: number;
  avg_revenue: number;
  avg_occupancy: number;
  avg_adr: number;
  growth_trend: 'growing' | 'stable' | 'declining';
}>
```

---

### Opportunity 4: Bedroom Optimization (Medium Impact)

**Current State:** Bedroom performance data fetched but not passed to Gemini.

**Enhancement:** Include bedroom-level performance analysis.

**New AI Capabilities:**
- Recommend optimal bedroom configuration
- Calculate revenue per bedroom
- Identify if property is over/under-bedroomed for market
- Suggest conversion opportunities

**Implementation:**
```typescript
// Add to narrative report input
bedroom_performance: Array<{
  bedrooms: number;
  count: number;
  avg_revenue: number;
  avg_adr: number;
  avg_occupancy: number;
}>
```

---

### Opportunity 5: Listing-Level Historical Data (High Impact)

**Current State:** Not using `getListingHistoricalMetrics` at all.

**Enhancement:** Fetch historical data for top competitors.

**New AI Capabilities:**
- Show competitor revenue trends (growing vs. declining)
- Identify seasonal patterns of successful listings
- Spot competitors losing market share
- Calculate realistic ramp-up timeline based on competitor history

**API Calls Required:** 5-10 additional calls (one per competitor)

---

## Part 5: Recommended Implementation Priority

### Phase 1: Quick Wins (1-2 days)

| Enhancement | Effort | Impact |
|-------------|--------|--------|
| Pass full competitor data to Gemini | Low | High |
| Add bedroom performance to prompt | Low | Medium |
| Include cancellation policy recommendations | Low | Low |

### Phase 2: Medium Effort (3-5 days)

| Enhancement | Effort | Impact |
|-------------|--------|--------|
| Add daily pricing intelligence | Medium | High |
| Include submarket analysis | Medium | Medium |
| Fetch competitor historical data | Medium | High |

### Phase 3: Advanced Features (1-2 weeks)

| Enhancement | Effort | Impact |
|-------------|--------|--------|
| Photo analysis integration | High | Medium |
| Real-time competitor tracking | High | High |
| Market comparison mode | High | High |

---

## Part 6: Token Budget Analysis

### Current Token Usage

| Component | Input Tokens | Output Tokens |
|-----------|--------------|---------------|
| Narrative Report | ~2,500 | ~4,000 |
| Enhanced Report | ~3,000 | ~4,000 |
| Other AI Functions | ~2,000 | ~2,000 |
| **Total per Analysis** | **~7,500** | **~10,000** |

### With Full Data Enhancement

| Component | Input Tokens | Output Tokens |
|-----------|--------------|---------------|
| Narrative Report (enhanced) | ~5,000 | ~5,000 |
| Enhanced Report | ~4,000 | ~5,000 |
| Other AI Functions | ~2,000 | ~2,000 |
| **Total per Analysis** | **~11,000** | **~12,000** |

**Cost Impact:** Approximately 50% increase in Gemini API costs (~$0.003 per analysis instead of ~$0.002).

---

## Conclusion

The Rental Revenue Calculator has significant untapped potential in both AirDNA data collection and Gemini utilization. The current implementation uses only 28% of available AirDNA functions and passes approximately 65% of fetched data to Gemini.

**Key Recommendations:**

1. **Immediate:** Pass full competitor data including amenities, property types, and review dates to Gemini
2. **Short-term:** Add daily pricing intelligence and submarket analysis
3. **Medium-term:** Integrate listing-level historical data for competitor trend analysis

These enhancements would transform the AI output from "good market overview" to "actionable investment intelligence" without requiring new API integrations—just better utilization of existing capabilities.

---

*Analysis prepared by Manus AI for the Rental Revenue Calculator project.*
