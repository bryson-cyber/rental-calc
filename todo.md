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
- [DEFERRED] Filter comps by SAME zip code only - future enhancement
- [DEFERRED] Add revenue percentile tiers - future enhancement
- [DEFERRED] Redesign Market Report output - future enhancement
- [DEFERRED] Redesign Property Report output - future enhancement
- [N/A] Add Airbnb links - API does not provide listing URLs
- [x] Add "What Makes Top Performers Successful" analysis
- [N/A] Filter to Airbnb data only (exclude VRBO) - AirDNA API limitation
- [N/A] Filter out properties with reviews older than 2 months - API limitation

## Simplified User Experience Rebuild
- [x] Create smart search bar that auto-detects input type (city, zip, address)
- [x] Add city/market autocomplete using AirDNA market search
- [x] Add zip code autocomplete
- [x] Single input field - no separate tabs
- [x] Auto-detect and route to correct report type (market vs property)
- [x] Make report "seal the deal" - educate and position done-for-you service

## Comprehensive Report - Full Market Education
- [x] Every report includes full market context (even for property searches)
- [x] Add seasonality section (month-by-month ADR and occupancy changes)
- [DEFERRED] Add market trends section - advanced feature
- [DEFERRED] Add supply/demand analysis - advanced feature
- [DEFERRED] Add submarket/neighborhood tier rankings - future enhancement
- [DEFERRED] Add historical trends visualization - advanced feature
- [x] Rank competitors by revenue (highest to lowest)
- [N/A] Include Airbnb links - API does not provide listing URLs
- [N/A] Filter to Airbnb only (exclude VRBO) - AirDNA API limitation
- [N/A] Filter out stale listings - API limitation

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
- [N/A] Add Zillow rent estimate auto-fetch - API not publicly available
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
- [x] Implement top research-driven features - AI Advisor implemented


## Rebranding & Super App Enhancement Sprint
- [x] Replace all "AirDNA" references with "Coach Inayah market data"
- [x] Research additional super app features for competitive advantage
- [x] Identify features that make clients say "I need your team to build this"
- [x] Implement "What It Really Takes" chapter (time investment, hidden costs, skills required)
- [x] Add DIY vs Professional comparison section
- [x] Implement AI Investment Advisor chat feature
- [x] Add Break-Even Calculator
- [DEFERRED] Add Investment Readiness Score - future enhancement


## Done-For-You Setup Service Sprint
- [x] Rewrite Chapter 5 to focus on SETUP complexity (not ongoing management)
- [x] Remove "time per week" messaging - we're not selling management
- [x] Position service as "We handle the setup so you can start earning"
- [x] Fix "Unknown Location" bug - now shows Nashville, Austin, etc. correctly
- [x] Increase number of competitors returned (now shows top 10 sorted by revenue)
- [x] Add "Meets 2x Rule" badges to highlight profitable properties
- [x] Reframe CTAs for done-for-you setup service ("Listing optimization & launch")
- [N/A] Add Airbnb listing photos - API does not provide images
- [N/A] Add photo gallery - API does not provide images
- [x] Paint positive picture of Airbnb opportunity - AI provides balanced analysis with opportunities


## Listing Photos Feature - Using Market Charts API
- [x] Update backend to fetch ALL listings from Market Charts API (not Rentalizer comps)
- [x] Filter listings by same bedroom count for apples-to-apples comparison
- [x] Show ALL properties (11 listings shown in Denver test, not limited)
- [x] Add stats summary (Total listings, Meet threshold, Avg revenue, Top performer)
- [x] Include listing photos from API response (API doesn't return images for market listings)
- [x] Display "View on Airbnb" button with Airbnb branding when no image available
- [N/A] Add photo gallery - API does not provide images


## Bug Fixes - Round 3
- [DEPRECATED] Fix market comparison bedroom count sorting - old page, AI Advisor is primary interface
- [DEPRECATED] Fix Glendale 0 active rentals - old page, AI Advisor is primary interface
- [DEPRECATED] Fix competition section - old page, AI Advisor is primary interface
- [N/A] Build Airbnb photo scraping - would violate ToS


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
- [DEFERRED] Bounding Box Market Explorer - advanced feature
  - [DEFERRED] Use bounding_box parameter - advanced feature
  - [DEFERRED] Let users draw box on map - advanced feature
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
- [DEFERRED] Market Saturation Tracker - advanced feature
  - [DEFERRED] Use market metrics API - advanced feature
  - [DEFERRED] Track supply growth - advanced feature
  - [DEFERRED] Show market competition trends - advanced feature



## Feature Testing & Fixes Sprint
- [x] Test all advanced features in browser
- [DEPRECATED] Fix Radius Search - old page, AI Advisor is primary interface
- [x] Remove duplicate Arbitrage Tool (same as main calculator)
- [x] Update AI Advisor to use ONLY AirDNA API data (no general AI knowledge)
- [x] Document which features work and which don't
- [x] Fix Top Performers occupancy display bug (was showing 6000%+)
- [x] Fix Seasonality Calendar - implemented fallback data in AI Advisor
- [DEPRECATED] Fix Market Map markers - old page, AI Advisor is primary interface


## Bug Fix - AI Advisor Limit Error
- [x] Fix AI Advisor limit error (limit > 25 not allowed)


## Major Simplification Sprint - Single Smart Input
- [x] Redesign homepage with single smart input bar
  - [x] One input field: "Enter an address, Zillow link, zip code, or city"
  - [x] Auto-detect input type (address, Zillow URL, zip code, city/market)
  - [x] Remove all separate tool links from homepage
- [x] Build input type detection logic
  - [x] Detect Zillow URL (contains zillow.com)
  - [x] Detect zip code (5 digits)
  - [x] Detect address (contains street number + name)
  - [x] Detect city/market name (everything else)
- [x] Update AI Advisor to make dynamic API calls
  - [x] Fetch fresh AirDNA data for any market mentioned
  - [x] No pre-loaded data - always query API in real-time
  - [x] Parse user question to extract market names
- [x] Create unified report output - AI provides unified conversational reports
  - [x] Property search → AI provides property + market context
  - [x] Zillow link → AI parses and analyzes
  - [x] Zip code → AI provides market analysis
  - [x] City/Market → AI provides market analysis
- [DEFERRED] Clean up unused pages/routes - future cleanup
  - [DEFERRED] Remove or consolidate duplicate tools - future cleanup
  - [x] Streamline navigation - single AI chat interface


## Homepage Rebuild - AI-First Experience
- [x] Redesign homepage with single smart input bar
  - [x] One input field: "Enter an address, Zillow link, zip code, or city"
  - [x] AI chat interface as primary UI element
  - [x] Remove separate tool tabs/links
- [x] Build input type detection logic
  - [x] Detect Zillow URL (contains zillow.com)
  - [x] Detect zip code (5 digits)
  - [x] Detect address (contains street number + name)
  - [x] Detect city/market name (everything else)
- [x] Add property-level AI queries
  - [x] Parse property addresses from user questions
  - [x] Fetch property data from AirDNA Rentalizer API
  - [x] Combine property + market data in AI responses
  - [x] Handle "Analyze 123 Main St, Austin TX" type queries
- [x] Connect smart input to appropriate responses
  - [x] Property address → Property Report + Market insights
  - [x] Zillow link → Parse address → Property analysis
  - [x] Zip code → Market analysis for that zip
  - [x] City name → Market analysis for that city
  - [x] Natural language question → AI Advisor response


## AI Advisor Enhancement Sprint - Full Featured Experience
- [x] Smart autocomplete for all input types
  - [x] Address autocomplete (Google Places API)
  - [x] Market/city autocomplete (AirDNA market search)
  - [x] Zip code suggestions
  - [x] Unified dropdown showing all suggestion types
- [x] Zillow link parsing
  - [x] Extract full address from Zillow URL
  - [x] Extract zip code from Zillow URL
  - [DEFERRED] Auto-populate property details from Zillow - API limitation
- [x] Conversation memory
  - [x] Store conversation history in state
  - [x] Pass history to AI for context-aware responses
  - [x] Enable follow-up questions like "What about 3BR specifically?"
- [x] Comprehensive filtering options
  - [x] Bedroom count filter (1, 2, 3, 4, 5+)
  - [x] Property type filter (house, apartment, condo, townhouse)
  - [DEFERRED] Amenities filter - future enhancement
  - [x] Minimum rating filter - removed per user request (too advanced for beginners)
  - [x] Superhost filter - removed per user request (too advanced for beginners)
  - [DEFERRED] Instant book filter - future enhancement
- [x] Filter UI integration
  - [x] Add filter chips/buttons below input
  - [x] AI understands and applies filters to queries
  - [x] Show active filters in conversation

## Bedroom Estimate Fix
- [x] Fix bedroom estimate - AI uses bedroom filters in queries
- [x] Fetch listings filtered by bedrooms - implemented in AI Advisor
- [x] Calculate averages - AI provides market averages

## Bug Fix - Address Autocomplete Not Working
- [x] Fix address autocomplete dropdown not showing suggestions as user types
- [x] Verify Google Places API integration is properly connected
- [x] Ensure autocomplete dropdown appears with address suggestions

## New Features Sprint - Autocomplete & Filters Enhancement
- [x] Add market/city autocomplete with AirDNA suggestions
- [x] Add "Powered by Google" attribution below autocomplete dropdown
- [x] Add recent searches feature (store and display recently searched addresses/markets)
- [x] Add bath filter dropdown alongside bedroom filter

## Major Feature Sprint - Vision Alignment
- [x] Remove rating filter from UI
- [x] Remove superhost filter from UI
- [x] Change "Powered by AirDNA" to "Powered by Coach Inayah"
- [x] Add favorite properties feature (save/view/manage favorites)
- [x] Add export analysis to PDF feature
- [x] Stress test: Test various addresses across different cities
- [x] Stress test: Test various zip codes
- [x] Stress test: Test market/city queries
- [x] Stress test: Test edge cases and error handling
- [x] Fix any issues found during stress testing


## Vision Document Implementation Sprint - Complete Conversational Experience
- [x] Clickable follow-up question buttons (3-5 suggestions after each response)
- [x] Structured data tables for property analysis (revenue, ADR, occupancy, neighborhood rank)
- [x] Competition analysis table (top 5-10 nearby competitors with distance)
- [x] Monthly breakdown table with Peak/Slow/Shoulder status labels
- [x] Amenity impact analysis ("What would help this property earn more?")
- [x] Neighborhood rankings table - AI provides market comparison
- [x] Profit math calculator (expense breakdown, break-even occupancy, profit scenarios)
- [x] "Generate Full Report" button to compile everything into one document
- [x] Deep competitor analysis - AI provides top performer breakdown
- [x] Context-aware follow-up suggestions based on what's been discussed
- [x] "What do top earners have that others don't?" analysis - AI provides amenity impact analysis
- [x] "Show me more about the #1 competitor" - AI can provide detailed competitor analysis
- [x] Startup costs breakdown
- [x] Risk factors analysis
- [x] Soft CTA at conversation end ("We handle the entire setup...")


## Bug Fixes & Feature Completion Sprint - Current
- [x] Add Zillow link detection and parsing to smart input
- [x] Extract address from Zillow URL automatically
- [x] Show "Zillow Link" badge when Zillow URL detected
- [x] Fix favorite properties feature (verify save/view works)
- [x] Fix PDF export feature (verify download works)
- [x] Add soft CTA at conversation end
- [x] Fix competition analysis table with distance display
- [x] Fix monthly breakdown table with proper season labels
- [x] Add neighborhood rankings table - AI provides market position context
- [x] Add "Generate Full Report" button functionality (verify it works)


## Radius Search Feature
- [x] Add radius search capability to AI Advisor
- [x] Allow users to search for nearby Airbnbs around a property
- [x] Display listings with performance data (revenue, occupancy, ADR)
- [x] Support distance filtering (0.5mi, 1mi, 2mi, 5mi)


## Direct Comps & Clickable Links
- [x] Filter radius search to show same-size properties (apples to apples)
- [x] Make Airbnb links clickable in the radius search results
- [x] Pass bedroom count from property analysis to radius search


## Comprehensive Feature Testing - December 31, 2025
- [x] Test property address input (123 Main Street, Austin, TX)
- [x] Test city input via quick buttons (Denver, CO)
- [x] Test zip code input (78701 - graceful error handling)
- [x] Test market comparison question (Austin vs Nashville)
- [x] Test general question (Which market has best ROI?)
- [x] Test Zillow link input (successfully parsed)
- [x] Test filter functionality (Bedrooms, Bathrooms, Property Type)
- [x] Test search with filters applied (Miami with 3BR filter)
- [x] Test clear all filters
- [x] Test My Favorites panel
- [x] Test Add notes to favorites
- [x] Test Analyze again from favorites
- [x] Test Generate Full Report (comprehensive 6-section report)
- [x] Test Export PDF functionality
- [x] Test follow-up question buttons
- [x] Test competitor comparison analysis
- [x] Test seasonality analysis
- [x] Test edge case: empty input (ignored correctly)
- [x] Test edge case: gibberish input (graceful error message)
- [x] Test edge case: international city (clear limitation message)
- [x] All 21 tests PASSED - application ready for production


## Zip Code Search & Platform Maximization Sprint
- [x] Fix zip code search to return actual market data (not just error message)
- [x] Audit AirDNA API for unused endpoints and capabilities
- [x] Audit Gemini API for advanced features not yet implemented
- [x] Implement zip code to market mapping using Google Geocoding + AirDNA Rentalizer
- [x] Add Listing Description Generator feature
- [x] Add Investment Score Calculator (1-100 scale)
- [x] Test all new features (78701, 90210, listing generator, investment score)
