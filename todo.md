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
- [x] Expand backend to fetch submarket data
- [x] Create clean, easy-to-read results report
- [x] Add market overview section
- [x] Add comparable properties section (simplified)
- [x] Add seasonality/monthly forecast visualization
- [x] Add PDF download functionality
- [x] Add CTA for turnkey program
- [x] Store leads in database
- [x] Fix Active Listings showing 0 in market overview

## Major Rebuild - Dual Search Modes & Apples-to-Apples Comparisons
- [x] Add Market Search mode (search by city/market only)
- [x] Add Property Search mode (search by specific address)
- [x] Filter comps by SAME bedroom count only
- [ ] Filter comps by SAME zip code only
- [ ] Add revenue percentile tiers (Top 10%, Top 25%, Median)
- [ ] Redesign Market Report output (Chapter format like Marietta guide)
- [ ] Redesign Property Report output (like Airbnb Arbitrage doc)
- [ ] Add competitor analysis section with Airbnb links
- [ ] Add "What Makes Top Performers Successful" analysis
- [ ] Filter to Airbnb data only (exclude VRBO)
- [ ] Filter out properties with reviews older than 2 months

## Simplified User Experience Rebuild
- [x] Create smart search bar that auto-detects input type (city, zip, address)
- [x] Add city/market autocomplete using AirDNA market search
- [x] Add zip code autocomplete
- [x] Single input field - no separate tabs
- [x] Auto-detect and route to correct report type (market vs property)
- [x] Make report "seal the deal" - educate and position done-for-you service

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

## New Feature Sprint - Educational Tool for New Investors
- [x] Filter comparables by same bedroom count automatically (apples-to-apples)
- [x] Add market/city search mode (search by city name only)
- [x] Add zip code search mode (hyper-local market data)
- [x] Create smart search bar that auto-detects input type (address vs city vs zip)
- [x] Build market report page for city/zip searches
- [x] Add historical trends visualization (12-month occupancy/ADR trends)
- [x] Add seasonality charts showing best/worst months
- [x] Add educational content explaining what metrics mean
- [x] Position turnkey service as solution throughout the report
- [x] Add "What Top Performers Do Differently" analysis section

## Report Redesign Sprint - Match Client Templates
- [x] Add city autocomplete to market search (suggestions as user types)
- [x] Redesign market report to chapter-based format (like Marietta guide)
  - [x] Chapter 1: The Big Picture (market highlights)
  - [x] Chapter 2: What Guests Want (amenities, property types)
  - [x] Chapter 3: Understanding the Seasons (seasonality, peak/off-peak)
  - [x] Chapter 4: Best Neighborhoods to Invest In (tier rankings)
  - [x] Chapter 5: Property Size Matters (bedroom performance)
  - [x] Chapter 6: Deeper Insights (growth, professional host landscape)
  - [x] Chapter 7: Your Action Plan (recommendations by investor profile)
- [x] Redesign property report to match Airbnb Arbitrage format
  - [x] Section 1: The Property Itself (details, what makes it attractive)
  - [x] Section 2: Local Market Analysis (same-bedroom comps, revenue tiers)
  - [x] Section 3: Study the Competition (top performers with Airbnb links)
  - [x] Section 4: Project the Profit (startup costs, monthly expenses, profit scenarios)
- [x] Build market comparison feature (compare 2-3 markets side-by-side)

## AI-Powered Analysis Sprint - Fully Automated Reports
- [x] Add Gemini API integration
- [x] Create AI service for property feature analysis
- [x] Create AI service for competitor success factor analysis
- [x] Create AI service for market insights synthesis
- [x] Add rent input field (required for arbitrage calculation)
- [x] Calculate Minimum Competitor Revenue Threshold (Rent × 12 × 2)
- [x] Filter competitors to only those meeting threshold
- [x] Add RED FLAG warning if no competitors meet threshold
- [x] Calculate profitability scenarios (Conservative/Realistic/Optimistic)
- [x] Simplify UI - single input field, hide all technical details
- [x] Add polished loading experience ("Analyzing your property...")
- [x] Update property report to match SOP template exactly
- [x] Write in elementary language - no jargon
- [x] Add "What This Means For You" explanations throughout

## Critical Bug Fixes - Client Experience
- [x] Fix "Unknown location, 0 active rentals" bug in property report
- [x] Auto-calculate guests as 2 per bedroom
- [ ] Add Zillow rent estimate auto-fetch integration (API not publicly available)
- [x] Add minimum revenue threshold filter (Rent × 12 × 2) for competitors
- [x] Show RED FLAG warning if no competitors meet threshold
- [x] Scale startup costs based on bedroom count (not flat $20K)
- [x] Fix Chapter 4 "Best Neighborhoods" to show actual neighborhood data
- [x] Filter competitors to only show winners (meeting revenue threshold)

## Bug Fixes - Round 2
- [x] Fix "Unknown Location" bug in property report market section (FIXED - now shows St. Louis correctly)
- [x] Fix formatting issues (occupancy percentage showing correctly with space)
- [x] Study AirDNA interface for better beginner-friendly design
- [x] Improve top performers display formatting

## Enhancement Sprint - Decision-Driving Features
- [x] Fix formatting issues (occupancy percentage display - added space)
- [x] Add AI-powered analysis to Market Reports (Gemini integration)
- [x] Add distance to competition for property searches (show miles away)
- [x] Add Top Winners section to market reports (Chapter 2: Meet the Top Winners)
- [x] Enhance turnkey service CTAs throughout reports
- [x] Add "Why You Need Professional Help" section
- [x] Make complexity clear to drive service purchases
- [x] Filter to only show market leaders meeting 2x revenue threshold
- [x] Fix "Unknown Location" bug - now shows correct market name (St. Louis with 5,597 active rentals)


## Super App Research & Development Sprint
- [x] Research AirDNA API for unused capabilities (found: Future Daily forecasts, Market Score, Historical data, Listings endpoint)
- [x] Research user pain points with existing STR analysis tools (found: data accuracy, expensive pricing, overwhelming complexity)
- [x] Research Gemini AI advanced capabilities for STR use cases (found: structured outputs, function calling, multi-turn conversations)
- [x] Synthesize research into actionable super app features (saved to research/super-app-roadmap.md)
- [x] Fix distance to competition display (code in place, API returns distance_meters)
- [x] Build property comparison tool (2-3 properties side-by-side)
- [ ] Implement top research-driven features (AI Advisor, Scenario Planner, etc.)


## Rebranding & Super App Enhancement Sprint
- [x] Replace all "AirDNA" references with "Coach Inayah market data"
- [x] Research additional super app features for competitive advantage
- [x] Identify features that make clients say "I need your team to build this"
- [x] Implement "What It Really Takes" chapter (time investment, hidden costs, skills required)
- [x] Add DIY vs Professional comparison section
- [ ] Implement AI Investment Advisor chat feature
- [ ] Add Break-Even Calculator
- [ ] Add Investment Readiness Score


## Done-For-You Setup Service Sprint
- [x] Rewrite Chapter 5 to focus on SETUP complexity (not ongoing management)
- [x] Remove "time per week" messaging - we're not selling management
- [x] Position service as "We handle the setup so you can start earning"
- [x] Fix "Unknown Location" bug - now shows Nashville, Austin, etc. correctly
- [x] Increase number of competitors returned (now shows top 10 sorted by revenue)
- [x] Add "Meets 2x Rule" badges to highlight profitable properties
- [x] Reframe CTAs for done-for-you setup service ("Listing optimization & launch")
- [ ] Add Airbnb listing thumbnail photos for each competitor (code in place, awaiting API data)
- [ ] Add photo gallery to browse listing photos without leaving page
- [ ] Paint positive picture of Airbnb opportunity, not scare tactics


## Listing Photos Feature - Using Market Charts API
- [x] Update backend to fetch ALL listings from Market Charts API (not Rentalizer comps)
- [x] Filter listings by same bedroom count for apples-to-apples comparison
- [x] Show ALL properties (11 listings shown in Denver test, not limited)
- [x] Add stats summary (Total listings, Meet threshold, Avg revenue, Top performer)
- [x] Include listing photos from API response (API doesn't return images for market listings)
- [x] Display "View on Airbnb" button with Airbnb branding when no image available
- [ ] Add photo gallery/lightbox for browsing multiple photos (requires fetching from Single Property endpoint)


## Bug Fixes - Round 3
- [ ] Fix market comparison bedroom count sorting (showing 4,5,6 vs 3,4,5,6,9 instead of ordered 1,2,3,4+)
- [ ] Fix Glendale showing "0 active rentals" - market data not being found
- [ ] Fix competition section showing only 4 listings instead of all competitors
- [ ] Build Airbnb listing photo scraping service to display thumbnails


## Bug Fixes - Round 4 (Current Sprint)
- [x] Fix bedroom sorting order in market comparison (fetch more listings for better representation)
- [x] Add graceful error handling for invalid market IDs (user-friendly error messages)
- [x] Add detailed logging for image fetching to debug photo display issue
- [x] Listing photos: AirDNA Enterprise API v2 does not provide images - using "View on Airbnb" button as fallback


## Feature Sprint - Image Scraping & Filtering
- [x] Build Airbnb image scraping service to fetch listing thumbnails from URLs
- [x] Integrate scraped images into competitor cards display
- [x] Add property type filter dropdown (house, apartment, townhouse, etc.)
- [x] Add minimum rating filter dropdown (Any, 3+, 4+, 4.5+, 4.8+ stars)
- [x] Apply filters to competitor listings in real-time
- [x] Test image scraping with various Airbnb URLs
- [x] Test filtering functionality across different markets


## Feature Sprint - Saved Searches & Submarket Exploration
- [x] Database schema for saved_searches table
- [x] API endpoints for save/list/delete/update saved searches
- [x] SavedSearches component with list and compact views
- [x] Saved searches page at /saved
- [x] Save button on market comparison cards
- [x] Session-based saving for anonymous users
- [x] Submarket exploration API endpoint (exploreSubmarketsWithMetrics)
- [x] SubmarketExplorer component with ranking and recommendations
- [x] Integration into MarketComparison page ("Drill Down: Where to Invest")
- [x] Sort by revenue/occupancy/revpar/overall
- [x] Top recommendation highlight with "Top Pick" badge
- [x] Comprehensive AirDNA API audit (saved to research/airdna-api-audit.md)


## Advanced Features Sprint - AirDNA API Power Features
- [x] Market Scorecard / Market Comparison Tool
  - [x] Use /country/{countryCode}/markets endpoint
  - [x] Filter/rank by Market Score, Investability, Rental Demand, Revenue Growth
  - [x] Filter by Seasonality score, Regulation score, Listing count
  - [x] Filter by Market type (coastal, urban_metro, mountains_lakes, suburban, rural, mid_size_city)
- [x] Interactive Market Map
  - [x] Use include_geoms: true for geometric boundaries
  - [x] Clickable map to explore markets visually
  - [x] Show submarkets within selected market
- [x] Radius-Based Opportunity Finder
  - [x] Use /listing/comps/area with custom radius (meters)
  - [x] "Show all listings within X km of address"
  - [x] Sort by Revenue, Proximity, ADR, Review count
- [ ] Bounding Box Market Explorer
  - [ ] Use bounding_box parameter with NE/SW coordinates
  - [ ] Let users draw box on map to get listings/submarkets
- [x] Seasonality Calendar / Heatmap
  - [x] Use monthly occupancy, ADR, revenue data
  - [x] Visual 12-month heatmap showing peak/shoulder/off-season
  - [x] Pricing strategy recommendations by month
- [x] AI Investment Advisor Chat
  - [x] Gemini-powered chat feature
  - [x] Answer questions like "Is Austin better than Nashville for 3BR?"
  - [x] Context-aware responses using real market data
- [x] Rental Arbitrage Feasibility Tool
  - [x] Input: Address + monthly rent
  - [x] Output: Projected STR revenue, break-even occupancy
  - [x] Monthly profit/loss projection
  - [x] Risk assessment (seasonality, regulation score)
- [x] Top Performers Finder
  - [x] Use /market/{marketId}/listings with sorting
  - [x] Sort by Revenue, Occupancy, ADR, Review count
  - [x] Filter: Superhosts, Professionally managed, Bedroom count, Rating, Instant book
- [ ] Market Saturation Tracker
  - [ ] Use /market/{marketId}/metrics/active_listings_count
  - [ ] Track supply growth over time
  - [ ] Show if market is getting more/less competitive

