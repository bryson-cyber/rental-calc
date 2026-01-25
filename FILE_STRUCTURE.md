# Rental Calculator - File Structure Documentation

This document maps each part of the website to its corresponding source file, making it easy to find and edit specific sections.

---

## Main Entry Points

| File | Description |
|------|-------------|
| `client/src/App.tsx` | Main routing configuration - defines all page routes |
| `client/src/main.tsx` | Application bootstrap - tRPC client setup, providers |
| `client/src/pages/Home.tsx` | **Homepage** - The main landing page with all 4 steps |

---

## The 4 Main Steps (Homepage)

The homepage (`client/src/pages/Home.tsx`) contains 4 main steps. Each step uses specific components:

### Step 1: See Real Revenue
| Component | File | Description |
|-----------|------|-------------|
| Main Container | `client/src/pages/Home.tsx` | Step 1 section in Home.tsx |
| Market Search | `client/src/components/HierarchicalLocationSelector.tsx` | Market/city autocomplete dropdown |
| Revenue by Bedroom Chart | `client/src/pages/Home.tsx` | Bar chart showing revenue by bedroom count |

### Step 2: Find Your Market (Map View)
| Component | File | Description |
|-----------|------|-------------|
| Map Layout | `client/src/components/MapFirstLayout.tsx` | **Main map view with search, filters, and listings** |
| Map Component | `client/src/components/Map.tsx` | Google Maps integration |
| Map View Content | `client/src/components/MapViewContent.tsx` | Map markers and property popups |
| Comps Map View | `client/src/components/CompsMapView.tsx` | Comparable properties map overlay |

### Step 3: Validate the Deal (Property Analysis)
| Component | File | Description |
|-----------|------|-------------|
| Property Input Form | `client/src/pages/Home.tsx` | Address, rent, bedrooms, bathrooms inputs |
| Tesla Dashboard | `client/src/components/TeslaDashboard.tsx` | **Main property report display** |
| Cash Flow Section | `client/src/components/TeslaDashboard.tsx` | "This Property Cash Flows" hero section |
| Seasonal Forecast | `client/src/components/TeslaDashboard.tsx` | Monthly revenue chart with Best/Slowest months |
| Market Insights Panel | `client/src/components/MarketInsightsPanel.tsx` | Forward-Looking Demand, Supply Trend, Booking Patterns |
| Multi-Year Trends | `client/src/components/MultiYearTrends.tsx` | Historical occupancy, revenue, ADR, listings |
| Forward Demand Card | `client/src/components/ForwardDemandCard.tsx` | Next 30/180 days demand forecast |
| Break-Even Calculator | `client/src/components/BreakEvenCalculator.tsx` | Break-even occupancy analysis |
| AI Advisor | `client/src/components/AIAdvisorStep.tsx` | Property and Market AI advisor tabs |

### Step 4: Find the Best Deal (Compare Properties)
| Component | File | Description |
|-----------|------|-------------|
| Property Comparison | `client/src/pages/Home.tsx` | Multi-property comparison section |
| Comp Data Table | `client/src/components/CompDataTable.tsx` | Comparable properties table |
| Virtual Table | `client/src/components/VirtualizedTable.tsx` | Performance-optimized table for large datasets |

---

## Step 3 Detailed Breakdown (Property Report Sections)

The property report in Step 3 is rendered by `TeslaDashboard.tsx` and includes these sections:

| Section | Component/File | What it Shows |
|---------|----------------|---------------|
| **Cash Flow Hero** | `TeslaDashboard.tsx` (CashFlowHero) | Annual revenue, monthly profit, rent coverage |
| **Seasonal Forecast** | `TeslaDashboard.tsx` (SeasonalForecast) | 12-month revenue chart, best/slowest months |
| **Arbitrage Analysis** | `TeslaDashboard.tsx` | Break-even occupancy, cushion analysis |
| **Forward-Looking Demand** | `MarketInsightsPanel.tsx` | Next 30/180 days occupancy, peak/low periods |
| **Multi-Year Trends** | `MultiYearTrends.tsx` | Historical occupancy, revenue, ADR, active listings |
| **Booking Patterns** | `MarketInsightsPanel.tsx` | Lead time, length of stay, booking windows |
| **Supply Trend** | `MarketInsightsPanel.tsx` | Active listings chart, 12-month change |
| **Market Health Grade** | `MarketInsightsPanel.tsx` | Overall market score |
| **AI Advisor** | `AIAdvisorStep.tsx` | Property Advisor and Market Advisor tabs |

---

## Map View Components (Step 2)

| Component | File | Description |
|-----------|------|-------------|
| **MapFirstLayout** | `client/src/components/MapFirstLayout.tsx` | Main container with search, filters, map, listings |
| Search Input | `MapFirstLayout.tsx` | Market/location search with autocomplete |
| Bedroom Filter | `MapFirstLayout.tsx` | Filter by bedroom count |
| Listings Table | `MapFirstLayout.tsx` | Property listings with revenue, occupancy, ADR |
| Map Markers | `MapFirstLayout.tsx` | Color-coded revenue markers on map |
| Property Popup | `MapFirstLayout.tsx` | Click on marker to see property details |

---

## API Endpoints (Backend)

| Endpoint | File | Description |
|----------|------|-------------|
| All tRPC routes | `server/routers.ts` | Main API router with all endpoints |
| AirDNA functions | `server/airdna.ts` | AirDNA API integration (5000+ lines) |
| Gemini AI | `server/gemini.ts` | AI advisor prompts and responses |
| Database queries | `server/db.ts` | Database helper functions |

### Key API Endpoints:
| Endpoint | Purpose |
|----------|---------|
| `compData.getAllListings` | Get all listings for a market (used in Map View) |
| `compData.getListings` | Get comparable listings for a property |
| `rental.searchMarkets` | Search for markets by name |
| `rental.getMarketData` | Get market overview data |
| `rental.getSupplyTrend` | Get supply trend (active listings over time) |
| `rental.getHistoricalData` | Get historical metrics (occupancy, revenue, ADR) |
| `rental.getForwardDemand` | Get forward-looking demand forecast |
| `rental.getBookingPatterns` | Get booking lead time and length of stay |
| `rental.validateProperty` | Validate a property with full analysis |

---

## Styling Files

| File | Description |
|------|-------------|
| `client/src/index.css` | Global styles, Tailwind theme, CSS variables |
| `client/index.html` | HTML template, Google Fonts imports |
| `tailwind.config.js` | Tailwind configuration |

---

## Context Providers

| File | Description |
|------|-------------|
| `client/src/contexts/PropertyContext.tsx` | Shares property data between components |
| `client/src/contexts/ThemeContext.tsx` | Theme (light/dark) management |
| `client/src/contexts/ToastContext.tsx` | Toast notification system |

---

## Quick Reference: What to Edit

### To change the Cash Flow section styling:
→ Edit `client/src/components/TeslaDashboard.tsx` (CashFlowHero component)

### To change the Seasonal Forecast chart:
→ Edit `client/src/components/TeslaDashboard.tsx` (SeasonalForecast component)

### To change the Map View filters or listings:
→ Edit `client/src/components/MapFirstLayout.tsx`

### To change the Supply Trend chart:
→ Edit `client/src/components/MarketInsightsPanel.tsx`

### To change the Multi-Year Trends cards:
→ Edit `client/src/components/MultiYearTrends.tsx`

### To change the Forward-Looking Demand section:
→ Edit `client/src/components/ForwardDemandCard.tsx` or `MarketInsightsPanel.tsx`

### To change the AI Advisor prompts:
→ Edit `server/gemini.ts`

### To change API data fetching:
→ Edit `server/airdna.ts` (AirDNA functions) or `server/routers.ts` (tRPC endpoints)

### To add tooltips/explainers to metrics:
→ Edit the relevant component file and add Tooltip components from `client/src/components/ui/tooltip.tsx`

---

## File Size Reference

| File | Lines | Complexity |
|------|-------|------------|
| `server/airdna.ts` | ~5500 | High - All AirDNA API integrations |
| `client/src/components/TeslaDashboard.tsx` | ~2000 | High - Main property report |
| `client/src/components/MapFirstLayout.tsx` | ~1500 | High - Map view with all features |
| `client/src/pages/Home.tsx` | ~700 | Medium - Homepage layout |
| `server/routers.ts` | ~1500 | Medium - API endpoints |
| `client/src/components/MarketInsightsPanel.tsx` | ~500 | Medium - Market insights |

