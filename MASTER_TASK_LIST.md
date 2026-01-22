# Master Task List - Rental Calculator Improvements

> **Last Updated:** January 22, 2026
> **Status:** In Progress
> **Total Tasks:** 47
> **Completed:** 0

---

## Phase 1: Market Advisor Data Maximization (HIGH PRIORITY)

### 1.1 Wire Up Missing API Endpoints to Market Advisor
- [x] **1.1.1** Add RevPAR data to Market Advisor data collection ✅ ALREADY IMPLEMENTED
  - Endpoint: `/market/{id}/metrics/revpar`
  - Returns: 60 months historical RevPAR data (already fetched)
  - Impact: Critical ROI metric for investors
  - Status: RevPAR is fetched in getStandaloneMarketAdvisorData, included in monthly data, and passed to Gemini prompt

- [x] **1.1.2** Add Booking Lead Time data to Market Advisor ✅ ALREADY IMPLEMENTED
  - Endpoint: `/market/{id}/metrics/booking_lead_time`
  - Returns: How far in advance guests book (avg_days, last_minute_percent, advance_booking_percent)
  - Impact: Helps with pricing and availability strategy
  - Status: Already fetched via getMarketBookingPatterns() and included in bookingPatterns data

- [x] **1.1.3** Add Average Length of Stay data to Market Advisor ✅ ALREADY IMPLEMENTED
  - Endpoint: `/market/{id}/metrics/avg_length_of_stay`
  - Returns: Average nights per booking (avg_nights, weekend_percent, week_percent)
  - Impact: Guest behavior insights, turnover costs
  - Status: Already fetched via getMarketBookingPatterns() and included in bookingPatterns data

- [x] **1.1.4** Add Active Listings Count trend to Market Advisor ✅ ALREADY IMPLEMENTED
  - Endpoint: `/market/{id}/metrics/active_listings_count`
  - Returns: 60 months of supply data (already fetched)
  - Impact: Market saturation trends
  - Status: Already fetched in getStandaloneMarketAdvisorData and getMarketSupplyTrend(), included in supplyTrend and listingCount data

- [ ] **1.1.5** Add Future Daily Pricing data to Market Advisor
  - Endpoint: `/market/{id}/future_pricing`
  - Returns: 1-12 months forward pricing
  - Impact: Forward-looking market expectations

- [x] **1.1.6** Add Submarkets List to Market Advisor ✅ ALREADY IMPLEMENTED
  - Endpoint: `/market/{id}/submarkets` via getSubmarketsInMarket()
  - Returns: All neighborhoods within market with metrics
  - Impact: Granular location analysis
  - Status: Already fetched and displayed in submarkets comparison table

### 1.2 Pass New Data to Gemini AI
- [x] **1.2.1** Update Market Advisor prompt to include RevPAR analysis ✅ ALREADY IMPLEMENTED
  - RevPAR is included in market metrics, historical data, and seasonality sections of Gemini prompt
- [x] **1.2.2** Update Market Advisor prompt to include Booking Lead Time insights - COMPLETED
- [x] **1.2.3** Update Market Advisor prompt to include Length of Stay patterns - COMPLETED
- [x] **1.2.4** Update Market Advisor prompt to include Supply Trend analysis - COMPLETED
- [x] **1.2.5** Update Market Advisor prompt to include Future Pricing outlook (removed per user request)
- [x] **1.2.6** Update Market Advisor prompt to include Submarket comparison - COMPLETED

### 1.3 Display New Metrics in UI
- [x] **1.3.1** Add RevPAR chart to Market Advisor results - COMPLETED
- [x] **1.3.2** Add Booking Lead Time visualization (already in Booking Patterns section)
- [x] **1.3.3** Add Length of Stay distribution chart (already in Booking Patterns section)
- [x] **1.3.4** Add Active Listings trend chart (supply over time) - COMPLETED
- [x] **1.3.5** Add Future Pricing calendar/chart (removed per user request)
- [x] **1.3.6** Add Submarkets comparison table - COMPLETED

---

## Phase 2: Property Advisor Enhancement

### 2.1 Comp Property Improvements
- [x] **2.1.1** Add comp property thumbnail images to display - ALREADY IMPLEMENTED
  - Source: Constructed from Airbnb CDN using listing ID
  - Display: Shows image in comp cards with fallback

- [x] **2.1.2** Add clickable Airbnb links for comp properties - ALREADY IMPLEMENTED
  - Source: `airbnb_url` field from API
  - Display: "View Listing" link with ExternalLink icon

- [x] **2.1.3** Fetch historical metrics for top 10 comp properties ✅ COMPLETED
  - Endpoint: `/listing/{id}/metrics`
  - Returns: 12 months of comp performance with revenue_trend (growing/stable/declining)
  - Display: Shows trend indicator badge in comp cards (green=growing, gray=stable, red=declining)
  - Implementation: Fetches metrics for top 10 comps in batches of 5 with rate limiting

- [x] **2.1.4** Add comp property amenities display - ALREADY IMPLEMENTED
  - Source: `amenities` array from API
  - Display: Shows up to 4 amenities with "+X more" indicator

- [ ] **2.1.5** Add comp property future pricing
  - Endpoint: `/listing/{id}/future_pricing`
  - Display: Show upcoming pricing for comps

### 2.2 Property Advisor Data Enhancements
- [x] **2.2.1** Add AirDNA's native comp algorithm - IMPLEMENTED
  - Endpoint: `/listing/{id}/comps`
  - Returns: airdna_native_comps with similarity_score
  - Compare: Our area-based comps vs AirDNA's algorithm

- [x] **2.2.2** Filter out inactive/unavailable properties - IMPLEMENTED
  - Rule: Exclude properties with last review > 2 months ago
  - Impact: Ensure fresh, relevant comp data
  - Implementation: Added excludeInactive option to getQualifyingCompetitors()

- [x] **2.2.3** Add property type to comp display - ALREADY IMPLEMENTED
  - Show: Property type displayed below comp title
  - Impact: Better apples-to-apples comparison

---

## Phase 3: Filter Enhancements

### 3.1 Amenities Filter
- [ ] **3.1.1** Add amenities filter dropdown to Map view
  - Options: Pool, Hot Tub, WiFi, Kitchen, Washer/Dryer, etc.
  - API: Use `amenities` parameter in listings endpoint

- [x] **3.1.2** Add amenities filter to Market Advisor - COMPLETED
  - Allow: Filter market analysis by amenity type
  - Impact: "Pool properties in St. Louis" analysis
  - Implementation: Added amenities dropdown with pool, hot tub, pet-friendly, parking, kitchen, washer/dryer

- [x] **3.1.3** Add amenities breakdown to AI analysis - COMPLETED
  - Show: Applied filters context in Gemini prompt
  - Impact: AI analysis notes which filters are applied

### 3.2 Property Type Filter
- [x] **3.2.1** Add property type filter dropdown - COMPLETED
  - Options: House, Apartment, Condo, Cabin, Townhouse, Villa, Loft, Cottage
  - API: Use `property_type` parameter
  - Implementation: Added dropdown to Market Advisor with filter context in Gemini prompt

- [x] **3.2.2** Add property type breakdown to Market Advisor - ALREADY EXISTS
  - Show: Revenue by property type (propertyTypes section already in data)
  - Impact: Identify best-performing property types

### 3.3 Rating & Review Filters
- [x] **3.3.1** Add rating filter (4.0+, 4.5+, 4.8+) - COMPLETED
  - API: Use `min_rating` parameter
  - Impact: Filter to quality properties only
  - Implementation: Added dropdown with star rating options

- [x] **3.3.2** Add review count filter (10+, 25+, 50+, 100+) - COMPLETED
  - API: Use `min_reviews` parameter
  - Impact: Filter to established properties
  - Implementation: Added dropdown with review count thresholds

### 3.4 Host Type Filters
- [x] **3.4.1** Add Superhost filter toggle ✅
  - API: Use `superhost` parameter
  - Impact: Compare superhost vs regular host performance

- [x] **3.4.2** Add Professional Management filter ✅
  - API: Use `professionally_managed` parameter
  - Impact: Pro vs amateur host comparison

### 3.5 Other Filters
- [x] **3.5.1** Add Instant Book filter ✅
  - API: Use `instant_book` parameter
  - Impact: Booking convenience analysis
  - COMPLETED: Added toggle button with Zap icon

- [x] **3.5.2** Add Pets Allowed filter ✅
  - API: Use `pets_allowed` parameter via amenities filter
  - Impact: Pet-friendly market analysis
  - COMPLETED: Already available in amenities dropdown

- [x] **3.5.3** Add Listing Type filter (Entire place, Private room, Shared) ✅
  - API: Use `listing_type` parameter
  - Impact: Listing type comparison
  - COMPLETED: Added dropdown with 3 listing types

---

## Phase 4: UI/UX Polish

### 4.1 Dropdown & Selection Fixes
- [ ] **4.1.1** Fix market search dropdown selection bug
  - Issue: Clicks sometimes register on wrong item
  - Solution: Improve click target areas

- [ ] **4.1.2** Fix bedroom filter dropdown selection
  - Issue: Wrong option sometimes selected
  - Solution: Add proper click handling

- [ ] **4.1.3** Fix map centering on market selection
  - Issue: Sometimes centers on wrong location
  - Solution: Verify coordinates before centering

### 4.2 Loading States & Feedback
- [x] **4.2.1** Add progress indicator for Market Advisor AI analysis ✅
  - Show: "Fetching market data... Analyzing with AI... Generating report..."
  - Impact: Better UX during 30-60 second waits
  - COMPLETED: Added 6-step visual progress indicator with checkmarks and progress bar

- [x] **4.2.2** Add progress indicator for Property Advisor AI analysis ✅
  - Show: Step-by-step progress
  - Impact: User knows what's happening
  - COMPLETED: Already implemented with visual step-by-step progress

- [x] **4.2.3** Add skeleton loaders for data cards ✅
  - Show: Placeholder shapes while loading
  - Impact: Perceived faster performance
  - COMPLETED: Created MarketAdvisorSkeleton, PropertyAdvisorSkeleton, DataCardSkeleton, and TableRowSkeleton components

### 4.3 Error Handling
- [x] **4.3.1** Add graceful error handling for API failures ✅
  - Show: User-friendly error messages with context-aware text (network, rate limit, generic)
  - Action: Retry button with "Try Again" and alternative options
  - COMPLETED: Enhanced error states in StandaloneMarketAdvisor and AIAdvisorStep

- [x] **4.3.2** Add timeout handling for long API calls ✅
  - Show: "This is taking longer than expected..." warning after 45s (Market) / 30s (Property)
  - Action: Cancel Analysis button to abort and retry
  - Display: Real-time elapsed seconds counter
  - COMPLETED: Enhanced StandaloneMarketAdvisor and AIAdvisorStep with timeout tracking

### 4.4 Mobile Responsiveness
- [ ] **4.4.1** Improve Map view on mobile devices
  - Fix: Touch interactions, zoom controls
  - Impact: Better mobile experience

- [ ] **4.4.2** Improve filter dropdowns on mobile
  - Fix: Touch-friendly dropdown menus
  - Impact: Easier filtering on mobile

---

## Phase 5: New Features

### 5.1 Smart Rates Integration
- [ ] **5.1.1** Implement Smart Rates API integration
  - Endpoint: `/listing/{id}/smart_rates`
  - Returns: Recommended daily rates

- [ ] **5.1.2** Add pricing strategy recommendations
  - Endpoint: `/listing/{id}/smart_rates/pricing_strategies`
  - Show: Balanced, High ADR, High Occupancy strategies

- [ ] **5.1.3** Display Smart Rates in Property Advisor
  - For: Existing Airbnb listings
  - Impact: Revenue optimization insights

### 5.2 Bulk Operations
- [ ] **5.2.1** Implement bulk listing fetch
  - Endpoint: `/listing/bulk/fetch`
  - Impact: Faster comp data loading

- [ ] **5.2.2** Implement bulk rentalizer estimates
  - Endpoint: `/rentalizer/bulk_summary`
  - Impact: Analyze multiple properties at once

### 5.3 Market Discovery
- [ ] **5.3.1** Add country-level market exploration
  - Endpoint: `/country/{code}/markets`
  - Impact: Discover all US markets

- [ ] **5.3.2** Add market comparison feature
  - Compare: Multiple markets side-by-side
  - Impact: Help users choose best market

---

## Progress Tracking

### Completion Summary
| Phase | Total Tasks | Completed | Percentage |
|-------|-------------|-----------|------------|
| Phase 1: Market Advisor Data | 18 | 0 | 0% |
| Phase 2: Property Advisor | 8 | 0 | 0% |
| Phase 3: Filter Enhancements | 11 | 0 | 0% |
| Phase 4: UI/UX Polish | 9 | 0 | 0% |
| Phase 5: New Features | 7 | 0 | 0% |
| **TOTAL** | **53** | **0** | **0%** |

---

## Notes

### API Rate Limits
- AirDNA API has rate limits - implement caching (already done with 30-day TTL)
- Batch requests where possible to minimize API calls

### Testing Requirements
- Each new feature should have corresponding vitest tests
- Test with multiple markets (St. Louis, Denver, Phoenix, etc.)
- Test edge cases (no data, API errors, etc.)

### White-Label Requirement
- Never display "AirDNA" to end users
- Use "powered by Coach Inayah market data" branding

### Non-Prescriptive Output
- AI analysis should present data and insights only
- Avoid prescriptive advice like "you should do X"
- Let users make their own informed decisions

---

## How to Use This List

1. **Start a session:** Tell me "Continue with the master task list"
2. **I'll work on the next unchecked item**
3. **After completing, I'll mark it [x] and move to the next**
4. **Save checkpoint after each phase completion**
5. **Repeat until all tasks are complete**

---

*This document is the single source of truth for all improvements.*
