# Project TODO

## Completed
- [x] Basic search form with property details
- [x] Lead capture form
- [x] Results display with revenue estimates
- [x] Monthly forecast chart
- [x] Comparable properties display
- [x] Integrate AirDNA API for real rental estimates
- [x] Create backend endpoint for rental estimates
- [x] Connect frontend to real API data
- [x] Write vitest tests for API integration
- [x] Integrate Google Places API for address autocomplete

## Client-Friendly Report Rebuild
- [x] Add Zillow link input option (parse address from URL)
- [x] Auto-extract property details from Zillow link
- [x] Expand backend to fetch market-level data
- [ ] Expand backend to fetch submarket data
- [x] Create clean, easy-to-read results report
- [x] Add market overview section
- [x] Add comparable properties section (simplified)
- [x] Add seasonality/monthly forecast visualization
- [x] Add PDF download functionality
- [x] Add CTA for turnkey program
- [x] Store leads in database
- [x] Fix Active Listings showing 0 in market overview

## Major Rebuild - Dual Search Modes & Apples-to-Apples Comparisons
- [ ] Add Market Search mode (search by city/market only)
- [ ] Add Property Search mode (search by specific address)
- [ ] Filter comps by SAME bedroom count only
- [ ] Filter comps by SAME zip code only
- [ ] Add revenue percentile tiers (Top 10%, Top 25%, Median)
- [ ] Redesign Market Report output (Chapter format like Marietta guide)
- [ ] Redesign Property Report output (like Airbnb Arbitrage doc)
- [ ] Add competitor analysis section with Airbnb links
- [ ] Add "What Makes Top Performers Successful" analysis
- [ ] Filter to Airbnb data only (exclude VRBO)
- [ ] Filter out properties with reviews older than 2 months

## Simplified User Experience Rebuild
- [ ] Create smart search bar that auto-detects input type (city, zip, address)
- [ ] Add city/market autocomplete using AirDNA market search
- [ ] Add zip code autocomplete
- [ ] Single input field - no separate tabs
- [ ] Auto-detect and route to correct report type (market vs property)
- [ ] Make report "seal the deal" - educate and position done-for-you service

## Comprehensive Report - Full Market Education
- [ ] Every report includes full market context (even for property searches)
- [ ] Add seasonality section (month-by-month ADR and occupancy changes)
- [ ] Add market trends section (listings entering vs leaving)
- [ ] Add supply/demand analysis
- [ ] Add submarket/neighborhood tier rankings
- [ ] Add historical trends visualization
- [ ] Rank competitors by revenue (highest to lowest)
- [ ] Include Airbnb links for competitor properties
- [ ] Filter to Airbnb only (exclude VRBO)
- [ ] Filter out stale listings (last review > 2 months old)

## Current Sprint - Bug Fixes & Enhancements
- [x] Fix $0 display bug in revenue section on initial load
- [x] Add market overview with historical trends
- [x] Add supply analysis (listings entering/leaving)
- [x] Add best neighborhoods section
