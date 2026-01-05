# Rental Calculator - Lead Magnet Tool

## Current State (January 4, 2026)

A simplified Airbnb rental profitability calculator that serves as a lead magnet for Coach Inayah's Turnkey Program.

### Core Features (Complete)
- [x] Address input with Google Places autocomplete
- [x] Monthly rent, bedrooms, bathrooms inputs
- [x] Revenue projection with confidence range
- [x] Profit calculation and verdict display
- [x] Monthly revenue forecast bar chart (12 months)
- [x] 6 comparable properties with Airbnb links
- [x] Market insight summary
- [x] Turnkey Program CTA (12 months coaching)
- [x] Data source attribution (AirDNA)

### Tech Stack
- React + TypeScript + Tailwind CSS + shadcn/ui
- tRPC API
- AirDNA Rentalizer API (single endpoint)
- No AI generation - pure data display

### API Data Used
From AirDNA Rentalizer endpoint:
- Property details (address, beds, baths, coordinates)
- Revenue estimates (annual, low, high)
- ADR and occupancy rate
- 12-month forecast
- 6 comparable properties

---

## New Requests (Jan 4, 2026)
- [x] Remove AirDNA branding - attribute data to original sources (Airbnb, Vrbo, etc.)
- [x] Add "Powered by Coach Inayah" branding
- [x] Update color scheme to match Coach Inayah brand (gold/pink/teal from masterclass site)
  - Updated LeadMagnet.tsx with gold (#D4A84B) and teal (#4ECDC4) colors
  - Updated ChapterPropertyReport.tsx with brand colors
  - Button gradients now gold-to-teal
  - Badge and headline use brand colors
- [x] Request more comps (increased from 20 to 30 same-bedroom comps, chart shows 15)
- [x] Audit Rentalizer API for additional features to add to report
  - API supports up to 10 comps (we show 6)
  - Historical performance data available (12 months)
  - Property value estimate field exists
  - Each comp has 12 months historical data

## Future Ideas (Not Started)

- [ ] Break-even occupancy calculator
- [ ] Shareable results URL
- [ ] PDF report download
- [ ] Peak vs off-season revenue visualization
- [ ] Mobile-optimized bar chart
- [ ] Social proof / testimonials section

## Bug Reports (Jan 4, 2026)
- [x] Address "4218 Delmar Blvd, St. Louis, MO, USA" doesn't load - FIXED with retry logic for bathroom fallback
  - AirDNA API returns 500 for certain bed/bath combinations (e.g., 2 bed / 1 bath at this address)
  - Added automatic retry with alternative bathroom counts (1 → 2 → 1.5 → bedrooms-1)
  - Successfully loads with 2 bed / 2 bath fallback

## New Requests (Jan 4, 2026 - Part 2)
- [x] Update Turnkey Program link to https://masterclass.coachinayah.com/the-turnkey-program-2
- [x] Audit Rentalizer API to verify we're using all available features
  - Currently using: revenue estimates, ADR, occupancy, 12-month forecast, 6 comps
  - Available but not using: historical data (12 months), up to 10 comps, comp historical trends
- [x] Evaluate AI feature recommendations for the lead magnet
  - See detailed analysis below
