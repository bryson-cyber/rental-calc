# AirDNA Feature Implementation Tasks

> **Purpose:** Systematic implementation of AirDNA feature parity (excluding smart pricing)
> **Usage:** Give this file to Manus to work through each task one by one
> **Rule:** After each task is complete, update the checklist and save a checkpoint

---

## 🎯 PROMPT FOR MANUS

```
Read /home/ubuntu/rental-calculator/AIRDNA_FEATURE_IMPLEMENTATION.md and work through the next incomplete task. For each task:
1. Implement the feature
2. Write vitest tests
3. Run tests to verify
4. Update the checklist in this file
5. Save a checkpoint
Then move to the next task. Continue until all tasks are complete.
```

---

## ✅ COMPLETED FEATURES CHECKLIST

> **Update this section after each feature is implemented and tested**

| # | Feature | Implemented | Tests Pass | Checkpoint Saved | Date |
|---|---------|-------------|------------|------------------|------|
| 1 | Comp Set Strength Indicator | ✅ EXISTS | N/A | N/A | Pre-existing |
| 2 | Forward-Looking Demand | [ ] | [ ] | [ ] | |
| 3 | Calendar Heatmap | ✅ EXISTS | N/A | N/A | Pre-existing (SeasonalityCalendar.tsx) |
| 4 | Multi-Year Historical Trends | [ ] | [ ] | [ ] | |
| 5 | Share Report | [ ] | [ ] | [ ] | |
| 6 | Save Reports | ✅ EXISTS | N/A | N/A | Pre-existing (savedSearches router) |
| 7 | Map Integration (Comps) | [ ] | [ ] | [ ] | |
| 8 | Demand Driver Tags | ✅ EXISTS | N/A | N/A | Pre-existing (MarketTypeBadge) |

**Progress:** 4/8 features exist, 4/8 need implementation

---

## 📋 TASK 2: Forward-Looking Demand Indicators

**Status:** [ ] Not Started
**Location:** Market Advisor (MarketInsightsPanel or StandaloneMarketAdvisor)
**API:** `/market/{id}/future_pricing` (already have `getMarketFutureDailyData` function)

### Requirements
- Show next 30 days average occupancy, ADR, and demand trend
- Show next 180 days average occupancy, ADR, and demand trend
- Classify trend: Hot (75%+), Warm (55-75%), Cool (35-55%), Cold (<35%)
- Display as a card with expandable details

### Implementation Steps
1. [ ] Create `calculateForwardLookingDemand()` function in `server/airdna.ts`
2. [ ] Create `ForwardDemandCard.tsx` component in `client/src/components/`
3. [ ] Add router endpoint `compData.getForwardDemand` in `server/routers.ts`
4. [ ] Integrate into Market Advisor UI (MarketInsightsPanel or StandaloneMarketAdvisor)
5. [ ] Write vitest tests in `server/forwardDemand.test.ts`

### Test Requirements
```typescript
// server/forwardDemand.test.ts
describe('Forward-Looking Demand', () => {
  it('should calculate 30-day average occupancy correctly')
  it('should calculate 180-day average occupancy correctly')
  it('should classify Hot trend for 75%+ occupancy')
  it('should classify Warm trend for 55-75% occupancy')
  it('should classify Cool trend for 35-55% occupancy')
  it('should classify Cold trend for <35% occupancy')
  it('should handle empty data gracefully')
  it('should calculate average ADR correctly')
});
```

### Verification
- [ ] Tests pass: `pnpm vitest run server/forwardDemand.test.ts`
- [ ] UI displays correctly in Market Advisor
- [ ] Data matches expected format

---

## 📋 TASK 4: Multi-Year Historical Trends

**Status:** [ ] Not Started
**Location:** Market Advisor (MarketInsightsPanel or StandaloneMarketAdvisor)
**API:** `getHistoricalData` endpoint already supports up to 60 months

### Requirements
- Add year selector buttons (1 year, 2 years, 3 years, 5 years)
- Show sparkline charts for occupancy, revenue, ADR, active listings
- Calculate Year-over-Year (YoY) change percentages
- Calculate Compound Annual Growth Rate (CAGR) for multi-year periods
- Show trend arrows (up/down/flat)

### Implementation Steps
1. [ ] Create `MultiYearTrends.tsx` component in `client/src/components/`
2. [ ] Add YoY and CAGR calculation utilities
3. [ ] Integrate into Market Advisor UI
4. [ ] Write vitest tests in `server/multiYearTrends.test.ts`

### Test Requirements
```typescript
// server/multiYearTrends.test.ts
describe('Multi-Year Historical Trends', () => {
  it('should calculate YoY change correctly')
  it('should calculate CAGR correctly for 2 years')
  it('should calculate CAGR correctly for 3 years')
  it('should calculate CAGR correctly for 5 years')
  it('should handle missing data gracefully')
  it('should identify positive trends')
  it('should identify negative trends')
  it('should identify flat trends')
});
```

### Verification
- [ ] Tests pass: `pnpm vitest run server/multiYearTrends.test.ts`
- [ ] UI displays year selector and charts
- [ ] YoY and CAGR calculations are accurate

---

## 📋 TASK 5: Share Report Feature

**Status:** [ ] Not Started
**Location:** Property Advisor (ChapterPropertyReport)
**Database:** Need `shared_reports` table

### Requirements
- Generate unique shareable link for any property report
- Set expiration (1 day, 7 days, 30 days, never)
- Set view limit (1, 10, 100, unlimited)
- Track view count
- Public page to view shared report (no login required)

### Implementation Steps
1. [ ] Add `shared_reports` table to `drizzle/schema.ts`
2. [ ] Run `pnpm db:push` to sync schema
3. [ ] Create `sharedReports` router in `server/routers.ts` with create/get endpoints
4. [ ] Create `ShareReportButton.tsx` component
5. [ ] Create `SharedReportPage.tsx` for viewing shared reports
6. [ ] Add route `/report/:shareId` in `App.tsx`
7. [ ] Write vitest tests in `server/sharedReports.test.ts`

### Test Requirements
```typescript
// server/sharedReports.test.ts
describe('Share Report Feature', () => {
  it('should generate unique share ID')
  it('should create shared report with expiration')
  it('should create shared report with view limit')
  it('should retrieve shared report by ID')
  it('should return null for expired reports')
  it('should return null for reports exceeding view limit')
  it('should increment view count on access')
  it('should handle non-existent share IDs')
});
```

### Verification
- [ ] Tests pass: `pnpm vitest run server/sharedReports.test.ts`
- [ ] Share button appears in property report
- [ ] Shared link opens report without login
- [ ] Expiration and view limits work correctly

---

## 📋 TASK 7: Map Integration for Comps

**Status:** [ ] Not Started
**Location:** Property Advisor (ChapterPropertyReport)
**Component:** Use existing `Map.tsx` component

### Requirements
- Show subject property marker (amber/gold color, home icon)
- Show comp property markers (color-coded by revenue)
  - Green: $80k+ annual revenue
  - Blue: $50k-$80k annual revenue
  - Gray: <$50k annual revenue
- Clickable markers showing property details popup
- Legend showing color meanings
- Expandable/collapsible map view

### Implementation Steps
1. [ ] Create `CompsMapView.tsx` component in `client/src/components/`
2. [ ] Add latitude/longitude to comp data (if not already present)
3. [ ] Integrate into ChapterPropertyReport.tsx competitors section
4. [ ] Write vitest tests in `server/compsMapView.test.ts`

### Test Requirements
```typescript
// server/compsMapView.test.ts
describe('Comps Map View', () => {
  it('should categorize high revenue comps correctly (green)')
  it('should categorize medium revenue comps correctly (blue)')
  it('should categorize low revenue comps correctly (gray)')
  it('should handle comps without coordinates')
  it('should format distance correctly (meters to miles)')
  it('should include all required comp data for popup')
});
```

### Verification
- [ ] Tests pass: `pnpm vitest run server/compsMapView.test.ts`
- [ ] Map displays in property report
- [ ] Markers are color-coded correctly
- [ ] Clicking markers shows property details

---

## 🔄 CHECKPOINT HISTORY

> **Record each checkpoint saved after feature completion**

| Checkpoint | Features Included | Date | Version ID |
|------------|-------------------|------|------------|
| Initial | Pre-existing features (1, 3, 6, 8) | | |
| | | | |
| | | | |
| | | | |

---

## 📝 IMPLEMENTATION NOTES

> **Add notes here during implementation for future reference**

### Task 2 Notes:


### Task 4 Notes:


### Task 5 Notes:


### Task 7 Notes:


---

## 🚀 QUICK START

To continue implementation, give Manus this prompt:

```
Read /home/ubuntu/rental-calculator/AIRDNA_FEATURE_IMPLEMENTATION.md and implement the next incomplete task (Task 2: Forward-Looking Demand). Follow the implementation steps, write the tests, verify they pass, update the checklist, and save a checkpoint. Then report back what was completed.
```
