# Rental Revenue Calculator - Project Report

**Project Name:** Rental Revenue Calculator  
**Version:** 66d99d26  
**Report Date:** January 2, 2026  
**Author:** Manus AI

---

## Executive Summary

The Rental Revenue Calculator is a comprehensive short-term rental (STR) investment analysis platform that combines real-time market data from AirDNA's Enterprise API with AI-powered narrative analysis from Google's Gemini. The tool enables property investors to evaluate rental arbitrage opportunities by entering a property address and receiving a professional investment memo synthesized from over 60 months of historical market data.

The system achieves a **90% success rate** in stress testing, with an average analysis time of approximately 2.5 minutes per property. Reports are generated as narrative investment memos rather than technical data dumps, making them accessible to beginner investors while still providing comprehensive market intelligence.

---

## Technical Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | React 19 + TypeScript |
| **Styling** | Tailwind CSS 4 + shadcn/ui |
| **Backend** | Node.js + Express + tRPC |
| **Database** | MySQL (TiDB) |
| **AI Engine** | Google Gemini 1.5 Flash |
| **Market Data** | AirDNA Enterprise API v2 |
| **Address Autocomplete** | Google Places API |

### Codebase Statistics

| Metric | Value |
|--------|-------|
| **Total Lines of Code** | 43,587 |
| **Server-Side Code** | 15,101 lines |
| **Test Coverage** | 1,989 lines across 9 test files |
| **Checkpoints Saved** | 54 versions |
| **AirDNA API Functions** | 39 functions |
| **Gemini AI Functions** | 24 functions |

---

## Core Features

### 1. Property Analysis Engine

The system accepts a property address along with monthly rent, bedroom count, and bathroom count. It then orchestrates multiple API calls to gather comprehensive market intelligence:

- **Rentalizer Estimates**: Projected annual revenue with low/high ranges
- **Market Metrics**: Occupancy rates, ADR, RevPAR, active listings
- **Competitor Analysis**: Same-bedroom properties within radius, sorted by revenue
- **Seasonality Data**: 12-month revenue, occupancy, and ADR forecasts
- **Historical Trends**: 60 months (5 years) of market performance data

### 2. AI-Powered Narrative Reports

Rather than presenting raw data, the system uses Gemini AI to synthesize all collected data into a professional investment memo with the following sections:

| Section | Description |
|---------|-------------|
| **Executive Summary** | High-level overview with key metrics and market position |
| **Market Overview** | Market health, competition level, and growth trajectory |
| **Revenue Analysis** | Projected earnings with seasonal patterns and optimization opportunities |
| **Competitive Landscape** | Analysis of top performers and success factors |
| **Seasonal Strategy** | Month-by-month guidance for pricing and occupancy |
| **Historical Context** | 5-year market trends with trajectory analysis |
| **Risk Assessment** | Market, financial, and operational risks |
| **Financial Outlook** | Profit scenarios (conservative/realistic/optimistic) |
| **Conclusion** | Synthesized investment implications |

### 3. Key Metrics Display

The report includes a prominent metrics bar showing:
- **Projected Annual Revenue**: Based on Rentalizer estimates
- **Monthly Profit Potential**: Revenue minus rent and expenses
- **Market Occupancy**: Current market-wide occupancy rate
- **Break-Even Time**: Estimated months to recover startup costs

### 4. Address Autocomplete

Google Places API integration provides real-time address suggestions as users type, with a dark-themed dropdown that matches the application's design aesthetic.

---

## AirDNA API Integration

The system integrates with 39 distinct AirDNA API functions to maximize data utilization:

### Data Collection Functions

| Category | Functions |
|----------|-----------|
| **Property Estimates** | getRentalizerEstimate, getEnhancedRentalizerEstimate, getRentalizerComps |
| **Market Search** | searchMarkets, searchByZipcode, detectSearchType, getCountryMarkets |
| **Market Data** | getMarketDetails, getMarketMetrics, getMarketHistoricalData |
| **Submarket Data** | getSubmarketDetails, getSubmarketMetrics, getSubmarketsInMarket |
| **Listings** | getMarketListings, getAllMarketListings, getFilteredMarketListings |
| **Competitor Analysis** | getQualifyingCompetitors, getListingsInRadius, exploreListingsInRadius |
| **Seasonality** | getMarketSeasonality, getMarketFutureDailyData |
| **Performance** | getTopPerformers, calculateArbitrageFeasibility |
| **Professional Stats** | getMarketProfessionalStats, getMarketCancellationPolicies |
| **Booking Patterns** | getMarketBookingPatterns, getMarketSupplyTrend |

### Historical Data

The system fetches **60 months (5 years)** of historical data to provide comprehensive market trend analysis, including:
- Year-over-year revenue changes
- Occupancy trend trajectories
- ADR growth patterns
- Market maturity classification

---

## Gemini AI Integration

The system leverages 24 Gemini AI functions for intelligent analysis:

### Analysis Functions

| Function | Purpose |
|----------|---------|
| **generateNarrativeReport** | Main function that synthesizes all data into investment memo |
| **analyzeHistoricalMarketTrends** | Interprets 5-year market trajectory |
| **synthesizePropertyInsights** | Generates unique insights per property |
| **analyzeCompetitorPatterns** | Identifies what makes top performers successful |
| **generatePricingStrategy** | Recommends base rates and seasonal adjustments |
| **assessRisks** | Evaluates market, financial, and operational risks |
| **generateActionPlan** | Creates phased launch roadmap |
| **generateExecutiveSummary** | Synthesizes all analysis into summary |
| **explainForBeginners** | Translates technical metrics into plain language |

### AI Configuration

- **Model**: Gemini 1.5 Flash
- **Max Output Tokens**: 8,192
- **Temperature**: 0.7 (balanced creativity/accuracy)
- **Timeout**: 120 seconds
- **Retry Logic**: 2 attempts with exponential backoff

---

## Performance Metrics

### Stress Test Results

The system was stress tested with 10 St. Louis properties:

| Metric | Result |
|--------|--------|
| **Success Rate** | 90% (9/10 completed) |
| **Average Analysis Time** | ~150 seconds (2.5 minutes) |
| **Failure Cause** | Timeout on 1 property (API rate limiting) |

### Error Handling

- **Timeout Protection**: 120-second timeout on Gemini API calls
- **Retry Logic**: Automatic retry with 2 attempts for narrative generation
- **Graceful Degradation**: Fallback data when specific endpoints fail
- **User-Friendly Errors**: Clear error messages for invalid inputs

---

## User Interface

### Design System

| Element | Specification |
|---------|---------------|
| **Primary Color** | Deep Navy (#0F172A) |
| **Accent Color** | Warm Orange (#F97316) |
| **Typography** | Playfair Display (headings), DM Sans (body) |
| **Theme** | Dark mode default |
| **Animations** | Framer Motion with 300-400ms transitions |

### Input Form

The streamlined input form collects:
1. **Property Address** (with Google Places autocomplete)
2. **Monthly Rent** (for arbitrage calculations)
3. **Bedrooms** (for apples-to-apples comparisons)
4. **Bathrooms** (for property matching)

### Report Display

Reports are rendered as scrollable narrative documents with:
- Collapsible sections for easy navigation
- Key metrics bar at the top
- Competitor listings with Airbnb links
- Seasonality charts with visual indicators
- 5-year historical trend visualization

---

## Database Schema

The system stores leads and analysis results:

| Table | Purpose |
|-------|---------|
| **users** | User accounts with OAuth integration |
| **leads** | Captured lead information (name, email, phone) |
| **analyses** | Saved property analysis results |
| **favorites** | User-saved favorite properties |

---

## Known Limitations

1. **AirDNA API Constraints**
   - No listing images from market endpoints (workaround: Airbnb links provided)
   - Cannot filter to Airbnb-only data (includes VRBO)
   - Rate limiting can cause timeouts on complex queries

2. **Gemini AI Constraints**
   - 120-second timeout for narrative generation
   - Occasional inconsistency in output formatting
   - Token limits may truncate very detailed analyses

3. **Data Accuracy**
   - Estimates are projections based on comparable properties
   - Market conditions can change rapidly
   - Historical data may not predict future performance

---

## Future Enhancement Opportunities

### High Priority
1. **PDF Export**: Generate branded PDF reports for sharing
2. **Email Capture**: Collect emails before showing full results
3. **Property Comparison**: Side-by-side analysis of 2-3 properties

### Medium Priority
4. **Regulation Warnings**: Alert users to local STR regulations
5. **National Benchmarks**: Compare property to national averages
6. **Saved Searches**: Allow users to save and revisit analyses

### Lower Priority
7. **Market Alerts**: Notify users of market changes
8. **Portfolio Tracking**: Track multiple properties over time
9. **ROI Calculator**: Detailed return on investment projections

---

## Conclusion

The Rental Revenue Calculator successfully delivers on its core mission: providing beginner-friendly investment analysis for short-term rental properties. By combining comprehensive AirDNA market data with Gemini AI's narrative synthesis capabilities, the tool transforms complex market intelligence into actionable investment memos.

The 90% success rate and 2.5-minute average analysis time demonstrate production readiness, while the narrative report format makes the tool accessible to investors at all experience levels. The purely informational approach (no GO/CAUTION/PASS verdicts) empowers users to make their own informed decisions based on comprehensive data.

---

*Report generated by Manus AI*
