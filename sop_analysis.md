# MASTER SOP Analysis - Airbnb Arbitrage Market Analysis

## Overview
The SOP defines a comprehensive workflow for producing professional market analysis reports for Airbnb arbitrage properties. It has 5 phases and produces a 6-section report.

## Phase 1: Data Collection & Preparation

### Step 1.1: Zillow Property Data Extraction
- Full Address, Zillow URL
- Bedrooms & Bathrooms, Square Footage, Year Built, Lot Size
- Monthly Rent & Annual Rent (calculate if needed)
- Key Features & Amenities (renovation, backyard, hardwood, laundry, parking)
- Utilities Clause (who pays - critical for arbitrage)
- Lawn Care, Pet Policy, Parking
- Property Photos (assess condition, style, appeal)

### Step 1.2: Coach Inayah Market Data Extraction
- Enter ZIP code (CLICK dropdown, don't press Enter)
- Filter by bedroom count
- Collect Top 4-5 competitors by revenue:
  - Property Title/Name, Property ID
  - Annual Revenue, Revenue Potential
  - Occupancy Rate, ADR
  - Accommodates, Property Type
  - Key Amenities (Hot Tub, Pool, etc.)
- Collect Dashboard data (market-wide stats)
- Collect Charts data (seasonality, YoY trajectory)

### Step 1.3: Competitor Airbnb URL Collection
- Search for each competitor on Airbnb
- Verify match, check review recency (must be within 2 months)
- Perform Photo Analysis: Vibe, Furniture Quality, Photography Quality, Key Differentiators

### Step 1.4: Neighborhood & Cost Data
- Demographics (population, income, housing)
- Utility Costs ($350-$450/month conservative estimate)
- Location & Attractions

## Phase 2: Report Structure (6 Sections)

### Section 1: Executive Summary - Revenue Potential
- Hook with financial opportunity
- State property rent, competitor revenue (bold figures)
- Mention property strengths
- Promise clear projection

### Section 2: Your Property Analysis - Competitive Positioning
- Intro paragraph (sqft, bed/bath, appeal)
- Key Strengths (3-4 bullets)
- Areas for Strategic Consideration (2-3 bullets, utilities as operating cost)
- Summary of Competitive Stance
- Feature Comparison Table (Your Property vs Top Competitor Average)

### Section 3: Market Seasonality & Trends
- Combined Revenue Seasonality paragraph
- Year-Over-Year Market Trajectory paragraph
- Key Takeaways for Your Strategy (3-4 bullets)

### Section 4: Custom Market Visualizations
- OMITTED - covered in Section 3

### Section 5: Detailed Competitor Analysis
- For each top 4 competitors:
  - Hyperlinked title to Airbnb URL
  - Data points (ID, Revenue, Occupancy, ADR, Accommodates, Type)
  - Analysis paragraph explaining WHY they succeed

### Section 6: Market Statistics & Revenue Projection
- Revenue Projection Insights (NO conservative/moderate/optimistic labels)
- Bold revenue range justified by competitor data
- Market Statistics Summary Table (Market Average, Top Performer, Projected Performance)

### References Section
- [1] Zillow URL
- [2] Coach Inayah URL
- [3] Other sources

## Phase 3: Content Writing Guidelines

### Tone & Style
- Be a Consultant, Not a Reporter (explain what data MEANS)
- Data-Driven Language ("As indicated by market data...")
- Professional & Concise (full paragraphs, no slang)
- Arbitrage Operator Perspective (costs are their costs, revenue is opportunity)

## Phase 4: Quality Control Checklist
- Header correct (address, link, date)
- Executive Summary leads with bold revenue
- Property Analysis has utility budget
- Feature Comparison table present
- Competitor titles hyperlinked
- Projection is a RANGE, justified by competitors
- All references cited

## Phase 5: Critical Decision Rules

### Revenue Projection Logic
- Lower Bound: Slightly above market average (above-average occupancy due to modern condition)
- Upper Bound: Below top performers with premium amenities, in line with best non-amenity properties

### Occupancy & ADR Projections
- Occupancy: Project 5-15% above market average if strong fundamentals
- ADR: Competitive but not top unless premium amenity

### Utility Costs
- Default: $350-$450/month ($4,200-$5,400/year) for 1,000-1,200 sqft

### Handling Insufficient Data
- Expand from ZIP → Submarket → City
- Always state scope clearly in report

### Competitor Selection
- Must have review within last 2 months
- Select Top 4-5 by Annual Revenue

## What AI Needs to Automate

1. **Property Data Extraction** - From Zillow URL or address
2. **Market Data Retrieval** - From AirDNA API (same bedroom, same ZIP, Airbnb only)
3. **Top Competitor Identification** - Ranked by revenue
4. **Seasonality Analysis** - Monthly patterns
5. **Revenue Projection Calculation** - Based on market average and top performers
6. **Report Generation** - Following exact 6-section structure
7. **Utility Cost Estimation** - Based on property size and location
8. **Feature Comparison** - Property vs competitors


---

# Market Research Master Prompt Analysis (Pre-Property Mode)

## Purpose
Systematic identification of best STR markets and neighborhoods BEFORE having a specific property. Used to research where to start looking.

## 8-Step Workflow

### Step 1: Market Selection & ZIP Code Verification
- Select target submarket from dropdown
- Check if ZIP codes already exist in dropdown
- If YES: Select them and proceed (DON'T click Add/Refresh)
- If NO: Type ZIP, click Add/Refresh, wait 10-30 seconds

### Step 2: Market Explorer Analysis with Glossary
**11 Glossary Metrics to Record:**
1. Annual Revenue - Total revenue earned per year
2. Occupancy - Percentage of available nights booked
3. ADR (Average Daily Rate) - Average price per booked night
4. RevPAR - Revenue divided by all available nights
5. Average Rating - Mean guest review score
6. Total Reviews - Cumulative reviews across all listings
7. Listings - Total active STR listings
8. Avg Monthly Listings - Average listings per month
9. Listings % Change - YoY change in listings (competition growth)
10. Days Available - Average days listed per property
11. Market Size - Overall market scale indicator

**Market Health Assessment:**
- Growth Indicator: Listings % Change > 0 = growing market
- Demand Indicator: Occupancy > 60% = strong demand
- Saturation Risk: High listings + low occupancy = potential saturation

### Step 3: Bedroom Size Performance Analysis
For EACH bedroom count (1BR, 2BR, 3BR, 4BR, 5BR+):
- Filter by bedroom count
- Sort by Revenue descending (click twice)
- Record: Avg Revenue, Avg Occupancy, Avg ADR, # Listings, Top 3 performers

**Bedroom Comparison Table:**
| Bedroom Size | Avg Revenue | Avg Occupancy | Avg ADR | # Listings | Top Performer Revenue |

**Optimal Bedroom Size Criteria:**
- Highest average revenue
- Strong occupancy (50%+)
- Sufficient listings (indicates demand, not oversaturation)
- Top performers significantly above average

### Step 4: Favorite Top Performers
- Filter by optimal bedroom size
- Sort by Revenue descending
- Favorite top 10-15 properties (click heart icon)
- CRITICAL: Verify each has Airbnb link (skip VRBO-only)
- CRITICAL: Verify recent reviews (within 2 months)

**For Each Favorited Property, Analyze:**
- Property Title, Airbnb URL
- Annual Revenue, Occupancy, ADR, Capacity
- Competitive Strategy (how they compete, target audience)
- Unique Selling Proposition (what makes guests choose them)

**Key Competitive Insights to Summarize:**
- What amenities appear in top performers? (pool, hot tub, game room)
- What price positioning works best? (premium vs value)
- What neighborhoods cluster successful properties?
- What design/vibe themes are popular?
- What is the minimum standard to compete?

### Step 5: Map Analysis for Geographic Clusters
- Go to Map tab
- Green pins = favorited properties, Red pins = regular
- Identify clusters of green pins
- Document 3 target neighborhoods with rationale
- Use Metric dropdown to see Revenue heatmap (red/orange = high revenue areas)

### Step 6: Seasonality Analysis
- Go to Charts tab
- Analyze Revenue by Month (2024-2025 only)
- Record: Peak months, Low months, Revenue range
- Analyze YoY Change % chart
- Analyze ADR trends for seasonal pricing patterns

**Seasonality Summary Table:**
| Month | Revenue Trend | YoY Change | ADR Trend | Notes |

### Step 7: Visit Top Performer Airbnb Listings
For each top 5-7 favorited properties:
- Click property title → airBnb Property Page link
- Document: Listing Title, URL, Reviews, Rating

**Photo Analysis:**
- Total photos, Photo quality (Professional/Amateur)
- Staging quality (Excellent/Good/Average/Poor)

**Design & Vibe Breakdown:**
- Overall Aesthetic (Modern/Traditional/Bohemian/Industrial/Coastal)
- Color Palette, Flooring, Furniture Style
- Kitchen Status, Standout Features
- Interior Quality Rating (1-10)
- Outdoor Space Quality (1-10)
- Instagram-Worthiness (High/Medium/Low)
- Atmosphere (Cozy/Luxurious/Family-Friendly/Party-Ready/Romantic)
- Competitive Edge (what makes this listing succeed)

### Step 8: Compile Market Research Report

**8-Section Report Structure:**

**Section 1: Executive Summary**
- Market name, Analysis date
- Optimal Bedroom Size
- Target Neighborhoods (top 3)
- Market Verdict (Strong/Moderate/Weak opportunity)
- Key Finding (one sentence)

**Section 2: Market Overview**
- All 11 glossary metrics
- Market Health Assessment

**Section 3: Bedroom Size Analysis**
- Bedroom comparison table
- Optimal size determination with rationale

**Section 4: Geographic Analysis**
- Primary/Secondary/Tertiary target neighborhoods
- Green pin counts, Notable features, Why target

**Section 5: Top Performer Analysis**
- Competitor quality summary table
- For each: Title (hyperlinked), Revenue, Occupancy, Design Style, Competitive Edge, Quality Rating

**Section 6: Seasonality Insights**
- Seasonality table
- Peak/Low seasons, Revenue variance, YoY trend

**Section 7: Recommendations**
- Property Hunting Focus (bedroom size, neighborhoods, features)
- Pricing Strategy (target ADR, peak/low season adjustments)
- Design Investment (prioritized design elements)
- Revenue Expectations (conservative, target, stretch)

**Section 8: Next Steps**
1. Begin property search in [Primary Neighborhood]
2. Look for [X]-bedroom properties
3. Target monthly rent under $[X] to achieve 20% profit margin
4. Prioritize properties matching top performer design elements

## Arbitrage Profit Calculation Formula
- Target Monthly Rent × 12 = Annual Rent Cost
- Annual Rent Cost × 1.20 = Minimum Annual Revenue Required (for 20% profit)
- Example: $1,500/month × 12 = $18,000 annual rent
- $18,000 × 1.20 = $21,600 minimum annual revenue needed

## Critical Rules
1. NEVER click "Add/Refresh ZIP Data" if ZIPs already in dropdown
2. ALWAYS filter by bedroom count BEFORE sorting
3. ALWAYS sort by Revenue DESCENDING (click header twice)
4. ONLY favorite properties with Airbnb links (skip VRBO-only)
5. ALWAYS hyperlink all Airbnb URLs in reports
6. ALWAYS click "Show Glossary" before Market Explorer analysis
7. ONLY analyze 2024-2025 seasonality data
8. Green pins = favorited, Red pins = regular


---

# Simplified Airbnb Arbitrage Analysis SOP

## Purpose
Elementary-level report for clients NEW to the arbitrage business model. Explains concepts simply while providing professional analysis.

## Report Title
"Understanding the Airbnb Arbitrage Opportunity"

## Phase 1: Data Collection

### Step 1.1: Zillow Property Data
- Full Address, Neighborhood, Property Type
- Bedrooms, Bathrooms, Square Footage
- Monthly Rent
- 4-5 Key Attractive Features (backyard, parking, washer/dryer, pet-friendly, pool/hot tub, renovations)

### Step 1.2: Coach Inayah Market Data
- Filter by ZIP code AND bedroom count
- Market Average data: Annual Revenue, Occupancy Rate, ADR
- Revenue Tiers: Top 10% (90th percentile), Top 25% (75th percentile), Median (50th percentile)

### Step 1.3: Minimum Competitor Revenue Threshold
**FORMULA: Monthly Rent × 12 × 2**
- This ensures we only compare to properties that can deliver 30%+ profit margin
- Example: $3,800/month × 12 = $45,600 annual rent
- $45,600 × 2 = $91,200 minimum competitor revenue threshold
- Only analyze competitors earning $91,200+ per year

### Step 1.4: Top 5 Competitors
- Must earn at or above Minimum Competitor Revenue Threshold
- Find direct Airbnb listing URL for each
- Identify single most important reason for success (Key Success Factor)
  - Examples: "A Private Hot Tub", "Incredible Design & Branding", "A Perfect 5.0 Rating & Amazing Views"

**RED FLAG: If fewer than 5 competitors meet threshold, note this. If NO competitors meet threshold, property may not be viable at current rent.**

## Phase 2: Report Generation (5 Sections)

### Section 1: Property Overview
**Title: "1. First, We Look at the Property Itself"**

Property Details Table:
| Property Detail | Information |
|-----------------|-------------|
| Full Address | [Address] |
| Neighborhood | [Neighborhood] (A popular, trendy area) |
| Property Type | [Type] (A standalone house) |
| Bedrooms/Bathrooms | [X] Bedrooms / [X] Bathrooms |
| Size | [X] sqft |
| Monthly Rent | $[X] |

"What Makes This Property Attractive for Airbnb?"
- 4 attractive features with explanations of WHY they're valuable

### Section 2: Market Analysis
**Title: "2. Next, We Analyze the Local Market"**

Market Averages Table:
| Metric | Average Value | What This Means |
|--------|---------------|-----------------|
| Annual Revenue | $[X] | Total money average Airbnb makes per year |
| Occupancy Rate | [X]% | Properties booked [X]% of nights |
| Average Daily Rate | $[X] | Average price guests pay per night |

Revenue Potential Table (Good, Better, Best):
| Performance Level | Annual Revenue | Who Achieves This? |
|-------------------|----------------|-------------------|
| Top 10% (Best) | $[X] | Superstar hosts with amazing photos, perfect reviews, top-notch design |
| Top 25% (Better) | $[X] | Professionally run properties with great design. **This is our target.** |
| Median (Good) | $[X] | Average, standard Airbnb in the area |

### Section 3: Competitive Analysis
**Title: "3. Then, We Study the Competition"**

Competitor Table:
| Competitor Example | Annual Revenue | What Makes Them Successful? |
|-------------------|----------------|----------------------------|
| [Name](URL) | $[X] | [Key Success Factor] |
| [Name](URL) | $[X] | [Key Success Factor] |
| [Name](URL) | $[X] | [Key Success Factor] |
| [Name](URL) | $[X] | [Key Success Factor] |
| [Name](URL) | $[X] | [Key Success Factor] |

**Key Insight: "We are not just providing a place to sleep; we are selling an experience."**

### Section 4: Profitability Projections
**Title: "4. Finally, We Project the Profit"**

Startup Costs Table (FIXED at $20,000):
| Cost Item | Estimated Amount | What This Is For |
|-----------|------------------|------------------|
| Total Estimated Startup Costs | $20,000 | First month's rent, security deposit, furniture, decor, kitchen supplies, linens, photos, licenses |

Monthly Expenses Table:
| Expense Item | Estimated Monthly Cost | Notes |
|--------------|----------------------|-------|
| Monthly Rent | $[X] | Biggest consistent expense |
| Utilities | $250 | Gas, Electric, Water |
| High-Speed Internet | $80 | Must-have for guests |
| Supplies & Subscriptions | $250 | Restocking, software |
| Maintenance & Repairs | $200 | Small budget for fixes |
| **Total Monthly Expenses** | $[Calculate] | Total cost per month |

Profit Scenarios Table:
| Scenario | Projected Annual Revenue | Annual Operating Costs | Estimated Annual Profit |
|----------|-------------------------|----------------------|------------------------|
| Conservative (Average) | $[Median Revenue] | $[Monthly × 12] | $[Calculate] |
| Realistic (Our Target) | $[Top 25% Revenue] | $[Monthly × 12] | $[Calculate] |
| Optimistic (Superstar) | $[Top 10% Revenue] | $[Monthly × 12] | $[Calculate] |

### Section 5: References
- [1]: Zillow URL
- [2]: Coach Inayah Market Charts

## Phase 3: Final Review Checklist
1. All [Insert...] placeholders replaced with data
2. All calculations in Profitability section correct
3. All tables properly formatted in Markdown
4. Tone is elementary, educational, consistent
5. Report ready for delivery

## Key Formulas

**Minimum Competitor Revenue Threshold:**
Monthly Rent × 12 × 2 = Minimum Revenue for Viable Comps

**Monthly Operating Costs:**
Rent + $250 (utilities) + $80 (internet) + $250 (supplies) + $200 (maintenance) = Total

**Annual Operating Costs:**
Monthly Operating Costs × 12

**Annual Profit:**
Projected Annual Revenue - Annual Operating Costs


---

# STR Market Analysis & eBook Creation SOP

## Purpose
City-level market analysis for creating client-friendly eBooks. Analyzes entire markets rather than specific properties.

## Phase 1: Data Collection

### Step 1.1-1.2: Navigate and Select City
- Go to coachinayah.com/market-charts
- Select target city from "Select Cities" dropdown
- Wait 10-20 seconds for data to load

### Step 1.3: Dashboard Data
- **TTM Occupancy Heat Map by Bedrooms**: Occupancy % for 1BR, 2BR, 3BR, etc.
- **Amenities %**: Percentage of listings with each amenity (Internet, Pool, Parking)
  - This reveals what's standard vs. premium
- **Property Types**: Count by type (House, Guest House, etc.)
- **TTM Occupancy Chart**: Seasonal trend line for past year

### Step 1.4: Charts Data
- **Metric by Month**: Occupancy trends over several years
- **Year over Year Change %**: Growth or decline vs. previous year
- **Metric by Year**: Side-by-side yearly performance

### Step 1.5: Market Explorer Data (MOST IMPORTANT)
- Contains neighborhood-specific data
- Must paginate through all pages (e.g., "26-50 of 51")
- Copy entire table from each page

### Step 1.6: Glossary (CRITICAL)
- Click "Show Glossary" button
- Copy definitions for every metric
- Cannot interpret data without understanding terms

## Phase 2: Data Analysis & Synthesis

### Step 2.1: Consolidate Data
- Create single working document with all collected data

### Step 2.2: Identify Top-Performing Neighborhoods
Key metrics to evaluate:
- **High Annual RevPAR**: Best single metric for profitability
- **High Annual Occupancy**: Shows strong demand
- **Positive RevPAR % Change**: Income is growing
- **High Seasonality Score**: More stable year-round income (high score = LOW seasonality)

### Step 2.3: Categorize Neighborhoods into Tiers
- **Tier 1: Premier Neighborhoods** - Best all-around performers
- **Tier 2: High-Occupancy Neighborhoods** - Not highest income, but always booked
- **Tier 3: Up-and-Coming Neighborhoods** - Strong growth signals (high RevPAR % Change)
- **Neighborhoods to Approach with Caution** - Declining RevPAR, occupancy, or bookings

### Step 2.4: Extract Deeper Insights
- **Average Daily Rate (ADR)**: What can you charge per night in different areas?
- **Listing Growth/Decline**: Where is competition increasing or decreasing?
- **Booked Listings Trends**: Where is traveler demand actually growing?
- **Amenity Percentages**: What amenities are must-haves vs. nice-to-haves?

## Phase 3: Drafting the Client eBook

### Step 3.1: Standard eBook Template (7 Chapters)

**Title Page:** Your Guide to [City Name]'s Short-Term Rental Market

**Chapter 1: The Big Picture**
- Overview of the city's market

**Chapter 2: What Guests Want**
- Breakdown of amenities and property types

**Chapter 3: Understanding the Seasons**
- Peak, shoulder, and off-seasons with occupancy percentages

**Chapter 4: The Best Neighborhoods to Invest In**
- Present tiered neighborhood analysis

**Chapter 5: Property Size Matters**
- Occupancy rates by bedroom count

**Chapter 6: Deeper Insights from the Data**
- Extra insights from Step 2.4

**Chapter 7: Your Action Plan**
- Final summary of key takeaways

### Step 3.2: Writing Style Rules
- **CRUCIAL: Write in plain language**
- Don't use technical terms (RevPAR, ADR) - explain what they mean
- BAD: "Pacific Beach has an ADR of $446 and RevPAR of $296."
- GOOD: "In Pacific Beach, you can charge an average of $446 per night, and properties earn more income here than anywhere else in the city."
- Use tables to present data clearly
- Add "What This Means for You" or "The Takeaway" after each insight

## Phase 4: Finalize and Deliver

### Step 4.1: Review and Edit
- Check for typos, grammatical errors, clarity
- Ensure tone is helpful, confident, professional
- Replace all technical jargon with simple explanations

### Step 4.2: Deliver
- Save as Markdown (.md) or PDF
- Send with brief summary message

---

# SUMMARY: What AI Needs to Automate

## Three Report Types

### Type 1: Property-Specific Arbitrage Analysis (MASTER SOP)
**Input:** Zillow URL or property address + rent amount
**Output:** 6-section professional report
- Executive Summary with revenue potential
- Property Analysis with competitive positioning
- Market Seasonality & Trends
- Detailed Competitor Analysis (top 4-5 with Airbnb URLs)
- Revenue Projection (range justified by competitor data)

### Type 2: Simplified Arbitrage Report (For Beginners)
**Input:** Zillow URL or property address + rent amount
**Output:** 5-section educational report
- Property Overview (what makes it attractive)
- Market Analysis (average revenue, occupancy, ADR + percentiles)
- Competitive Analysis (top 5 competitors with success factors)
- Profitability Projections (startup costs, monthly expenses, 3 scenarios)
- References

### Type 3: Market Research / eBook (Pre-Property)
**Input:** City or submarket name
**Output:** 7-chapter market guide
- Big Picture overview
- What Guests Want (amenities, property types)
- Seasonality analysis
- Best Neighborhoods (tiered)
- Property Size analysis
- Deeper Insights
- Action Plan

## Critical Data Points AI Must Retrieve

### From AirDNA API (via existing endpoints):
1. Market averages: Revenue, Occupancy, ADR, RevPAR
2. Revenue percentiles: Top 10%, Top 25%, Median
3. Top performers by revenue (filtered by bedroom count)
4. Seasonality data (monthly patterns)
5. Submarket/neighborhood data
6. Listing details for competitors
7. Property type distribution
8. Amenity prevalence

### Calculations AI Must Perform:
1. **Minimum Competitor Revenue Threshold**: Monthly Rent × 12 × 2
2. **Annual Operating Costs**: (Rent + $780 fixed) × 12
3. **Profit Scenarios**: Revenue - Operating Costs
4. **Revenue Projections**: Based on market percentiles and property features

### Key Formulas:
- **20% Profit Threshold**: Annual Rent × 1.20 = Minimum Revenue Needed
- **30% Profit Threshold**: Annual Rent × 2 = Minimum Competitor Revenue
- **Monthly Operating Costs**: Rent + $250 (utilities) + $80 (internet) + $250 (supplies) + $200 (maintenance)
- **Startup Costs**: Fixed at $20,000 for simplified report

## What's Missing from Current AI Implementation

1. **Revenue Percentile Data** - Need Top 10%, Top 25%, Median from AirDNA
2. **Competitor Filtering by Revenue Threshold** - Must filter to 2x annual rent
3. **Competitor Success Factor Analysis** - Identify WHY each competitor succeeds
4. **Airbnb URL Retrieval** - Link to actual Airbnb listings
5. **Structured Report Generation** - Following exact SOP templates
6. **Profitability Calculations** - With startup costs and monthly expenses
7. **Neighborhood Tiering** - Categorize by performance level
8. **Seasonality Interpretation** - Peak/shoulder/off-season identification
9. **Plain Language Explanations** - Translate metrics to investor-friendly language
