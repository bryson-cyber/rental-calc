# Gemini Prompt Engineering Audit

## Overview
This document maps all Gemini functions, their data inputs, and optimization opportunities.

## Functions Inventory

### 1. synthesizePropertyInsights
**Purpose:** Generate 5 unique, actionable insights specific to the property
**Data Inputs:**
- property (address, bedrooms, bathrooms, monthly_rent)
- market (name, occupancy, adr, revenue, active_listings)
- competitors (name, annual_revenue, occupancy, adr, rating, reviews, success_factor)
- percentiles (top_10_percent, top_25_percent, median)
- seasonality (month, revenue, season_type)

**Pre-computed Metrics (ADDED):**
- Revenue-to-rent ratio (median and top 25%)
- Qualification rate (% meeting 2x threshold)
- Revenue gap to top performer
- Seasonal swing %
- Avg competitor rating, reviews, ADR

**Forcing Questions (ADDED):**
1. Profitability probability based on qualification rate
2. Top 3 competitor strategies to replicate
3. Pricing strategy (above/below market)
4. Review count needed to compete
5. Biggest risk and opportunity

---

### 2. analyzeCompetitorPatterns
**Purpose:** Identify patterns that make top performers successful
**Data Inputs:**
- competitors (full list with all fields)
- property (bedrooms, bathrooms, monthly_rent)

**Pre-computed Metrics (ADDED):**
- Avg revenue, ADR, occupancy, rating, reviews
- High ADR vs High Occupancy competitor counts
- Top 3 vs Bottom 3 revenue gap
- Strategy segment identification

**Forcing Questions (ADDED):**
1. Pricing strategy pattern (high ADR vs high occupancy)
2. Rating/review correlation with revenue
3. Naming/branding patterns
4. Revenue distribution analysis
5. Success factor themes

---

### 3. generateInvestmentVerdict
**Purpose:** Provide GO/CAUTION/PASS verdict with confidence score
**Data Inputs:**
- property, market, competitors, percentiles, profitability

**Pre-computed Metrics (ADDED):**
- Qualification rate
- Revenue-to-rent ratios (median, top 25%, top 10%)
- Break-even occupancy
- Cushion above break-even
- Profit margins
- 4-dimension scoring (qualification, revenue ratio, occupancy, profit)
- Composite score
- Downside scenario (20% occupancy drop)

**Decision Framework (ADDED):**
- GO: Composite ≥7
- CAUTION: Composite 4-7
- PASS: Composite <4

---

### 4. generatePricingStrategy
**Purpose:** Create data-driven pricing recommendations
**Data Inputs:**
- property, market, competitors, seasonality

**Pre-computed Metrics (ADDED):**
- Seasonal ADR averages (peak, slow, shoulder)
- Seasonal swing %
- Competitor ADR range, median, average
- High ADR vs High Occupancy strategy analysis
- Break-even ADR
- Revenue scenarios at different price points
- Optimal strategy identification

**Forcing Questions (ADDED):**
1. Base rate positioning vs competitor median
2. Peak premium based on seasonal swing
3. Slow discount to maintain occupancy
4. Weekend premium analysis
5. Minimum stay optimization

---

### 5. assessRisks
**Purpose:** Comprehensive risk assessment with mitigation strategies
**Data Inputs:**
- property, market, competitors, seasonality

**Pre-computed Metrics (ADDED):**
- Financial risk calculations (break-even, cushion, downside)
- Seasonality variance
- Competition density
- Qualification rate
- 4-dimension risk scoring (seasonality, competition, financial, qualification)
- Composite risk score
- Cash reserves needed for slow season

**Forcing Questions (ADDED):**
1. Market risk with specific listing count
2. Financial risk with break-even analysis
3. Operational risk factors
4. Regulatory risk assessment

---

### 6. generateActionPlan
**Purpose:** Step-by-step launch plan with timeline and costs
**Data Inputs:**
- property, verdict, pricingStrategy

**Pre-computed Metrics (ADDED):**
- Startup cost estimates (furnishing, photography, essentials)
- Monthly revenue and profit projections
- Months to break-even
- Review timeline calculations (bookings/month, reviews/month)

**Phase Requirements (ADDED):**
1. Pre-launch with budget breakdown
2. Soft launch with pricing strategy
3. Review building with targets
4. Optimization milestones
5. Scale/maintain criteria

---

### 7. generateNarrativeReport
**Purpose:** Comprehensive investment report with 8 sections
**Data Inputs:** 35+ data sections from NarrativeReportInput

**Section Requirements (ALREADY DETAILED):**
- Executive summary with 3 key metrics
- Market overview with saturation and neighborhood analysis
- Revenue analysis with qualification rate
- Competitive landscape with superhost benchmark
- Seasonal strategy with booking patterns
- Historical context with 5-year trends
- Risk assessment with AirDNA feasibility
- Financial outlook with scenarios

**Cross-referencing (ALREADY ADDED):**
7 specific cross-referencing requirements connecting data across sections

**Analytical Questions (ALREADY ADDED):**
15 specific questions that must be answered

---

## Optimization Opportunities

### A. Data Utilization Gaps
1. **Amenity analysis** - Not fully leveraged for competitive positioning
2. **Property type breakdown** - Could inform positioning strategy
3. **Host size distribution** - Competitive landscape insight
4. **Distance metrics** - Hyper-local competition analysis

### B. Pre-computation Opportunities
1. **RevPAR calculations** - ADR × Occupancy
2. **Revenue per listing density** - Market efficiency metric
3. **Superhost premium** - Revenue difference calculation
4. **Time to superhost** - Based on review velocity

### C. Cross-referencing Opportunities
1. **Booking patterns → Pricing** - Last-minute % drives dynamic pricing
2. **Qualification rate → Risk** - Low rate = high risk
3. **Historical trends → Current competition** - Growing supply + declining revenue = red flag
4. **Bedroom performance → Property config** - Is this the optimal bedroom count?

### D. Output Schema Enhancements
1. **Confidence intervals** - Not just point estimates
2. **Sensitivity analysis** - What if occupancy drops 10%?
3. **Timeline projections** - Month-by-month ramp-up
4. **Competitor benchmarks** - Specific targets to hit

---

## Implementation Status

| Function | Pre-computed Metrics | Forcing Questions | Cross-refs | Status |
|----------|---------------------|-------------------|------------|--------|
| synthesizePropertyInsights | ✅ | ✅ | Partial | Enhanced |
| analyzeCompetitorPatterns | ✅ | ✅ | Partial | Enhanced |
| generateInvestmentVerdict | ✅ | ✅ | ✅ | Enhanced |
| generatePricingStrategy | ✅ | ✅ | Partial | Enhanced |
| assessRisks | ✅ | ✅ | ✅ | Enhanced |
| generateActionPlan | ✅ | ✅ | Partial | Enhanced |
| generateNarrativeReport | ✅ | ✅ | ✅ | Already optimized |

---

## Next Enhancement Priorities

1. **Add amenity gap analysis** to competitive landscape
2. **Add RevPAR calculations** to all revenue sections
3. **Add time-to-superhost** calculation to action plan
4. **Add sensitivity tables** to financial outlook
5. **Add month-by-month projections** to revenue analysis
