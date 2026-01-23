# AirDNA Feature Parity Tasks

## Overview
These 8 features bring our rental calculator to feature parity with AirDNA (excluding smart pricing).

## Progress Summary

| # | Task | Implemented | Tested |
|---|------|-------------|--------|
| 1 | Comp Set Strength Indicator | [ ] | [ ] |
| 2 | Forward-Looking Demand | [ ] | [ ] |
| 3 | Calendar Heatmap | [ ] | [ ] |
| 4 | Multi-Year Historical Trends | [ ] | [ ] |
| 5 | Share Report | [ ] | [ ] |
| 6 | Save Reports | [ ] | [ ] |
| 7 | Map Integration | [ ] | [ ] |
| 8 | Demand Driver Tags | [ ] | [ ] |

---

## Task 1: Comp Set Strength Indicator
**Status:** [ ] Not Started  
**Location:** Property Advisor (ChapterPropertyReport)  
**Description:** Show Low/Medium/High confidence in comparable properties

### Implementation:
- Calculate score (0-100) based on:
  - Comp count (more = higher confidence)
  - Distance (closer = better match)
  - Bedroom match (exact = better)
  - Data quality (reviews, rating)
- Display badge: High (70+), Medium (40-70), Low (<40)

---

## Task 2: Forward-Looking Demand Indicators
**Status:** [ ] Not Started  
**Location:** Market Advisor (MarketInsightsPanel)  
**Description:** Show next 30/180 days booking % and trends

### Implementation:
- Use future pricing API to get daily data
- Calculate avg occupancy, ADR for 30 and 180 days
- Classify trend: Hot (75%+), Warm (55-75%), Cool (35-55%), Cold (<35%)

---

## Task 3: Calendar Heatmap
**Status:** [ ] Not Started  
**Location:** Market Advisor (MarketInsightsPanel)  
**Description:** Daily RevPAR visualization by month

### Implementation:
- Create calendar grid component
- Color-code by occupancy (red → orange → yellow → green)
- Add month navigation (prev/next)
- Show monthly summary stats

---

## Task 4: Multi-Year Historical Trends
**Status:** [ ] Not Started  
**Location:** Market Advisor (MarketInsightsPanel)  
**Description:** 3-5 year trends, not just 12 months

### Implementation:
- Use existing getHistoricalData endpoint (supports up to 60 months)
- Add year selector (1/2/3/5 years)
- Show sparkline charts for occupancy, revenue, ADR
- Calculate YoY changes and CAGR

---

## Task 5: Share Report
**Status:** [ ] Not Started  
**Location:** Property Advisor  
**Description:** Shareable links to reports

### Implementation:
- Create shared_reports database table
- Generate unique share IDs
- Add expiration and view limit options
- Create SharedReportPage to display

---

## Task 6: Save Reports
**Status:** [ ] Check if exists  
**Location:** User account  
**Description:** Save reports to account for later

### Implementation:
- Check if savedSearches router already handles this
- If not, create similar functionality

---

## Task 7: Map Integration
**Status:** [ ] Not Started  
**Location:** Property Advisor (ChapterPropertyReport)  
**Description:** Show comps on interactive map

### Implementation:
- Create CompsMapView component
- Color-code markers by revenue
- Show subject property with different marker
- Add clickable markers with property details

---

## Task 8: Demand Driver Tags
**Status:** [ ] Not Started  
**Location:** Market cards, Market Advisor  
**Description:** Show market type badges (Coastal, Urban, etc.)

### Implementation:
- Create DemandDriverBadge component
- Support all market types from API
- Add icons and colors for each type
- Display in market reports

---

## Completion Log

| Task | Started | Completed | Notes |
|------|---------|-----------|-------|
