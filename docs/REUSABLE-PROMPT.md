# Reusable Prompt for Maximizing the Rental Calculator Tool

Use this prompt whenever you want to improve or extend the Rental Calculator lead magnet tool.

---

## The Prompt

```
I have a Rental Calculator lead magnet tool that uses the AirDNA Rentalizer API. Here's what it currently does:

**Current Features:**
- Address input with Google Places autocomplete
- Monthly rent input
- Bedrooms/bathrooms selection
- Revenue projection with confidence range (low/high)
- Profit calculation (revenue - rent)
- Revenue-to-rent ratio with verdict (Strong Opportunity / Looks Profitable / Worth Exploring / Needs Work)
- Monthly revenue forecast bar chart (12 months)
- 6 comparable properties with photos, revenue, ADR, occupancy, ratings, and Airbnb links
- Market insight summary
- Turnkey Program CTA linking to coachinayahturnkey.com
- Data source attribution (AirDNA - aggregated from Airbnb, Vrbo, etc.)

**Tech Stack:**
- React + TypeScript frontend
- tRPC API
- AirDNA Rentalizer API (only endpoint used)
- Tailwind CSS + shadcn/ui

**API Data Available (from Rentalizer endpoint):**
- property: address, zipcode, bedrooms, bathrooms, accommodates, lat/lng, market_id
- estimates: annual_revenue, annual_revenue_low, annual_revenue_high, average_daily_rate, occupancy_rate
- monthly_forecast: 12 months of revenue, adr, occupancy
- comps: 6 comparable properties with title, beds, baths, rating, reviews, revenue, adr, occupancy, distance, airbnb_url, image_url

**Business Context:**
- This is a lead magnet for Coach Inayah's Turnkey Program
- Target audience: Beginners interested in Airbnb rental arbitrage
- Goal: Demonstrate value and expertise, warm up leads for sales calls
- NOT for email capture - users come from existing email list

**What I want to do:**
[DESCRIBE YOUR SPECIFIC REQUEST HERE]

Please only use the existing AirDNA Rentalizer API data - no additional API endpoints or AI generation.
```

---

## Example Uses

### Add a new visualization
```
What I want to do:
Add a pie chart showing the breakdown of peak season vs off-season revenue based on the monthly forecast data.
```

### Improve mobile experience
```
What I want to do:
Optimize the results page for mobile devices - the bar chart and competitor cards need better responsive design.
```

### Add a new metric
```
What I want to do:
Calculate and display the "break-even occupancy" - the minimum occupancy needed to cover rent based on the ADR.
```

### Improve the CTA
```
What I want to do:
Make the Turnkey Program CTA more compelling. Add urgency or social proof elements.
```

### Add share functionality
```
What I want to do:
Let users share their results via a unique URL or generate a PDF report they can download.
```

---

## Key Constraints to Remember

1. **Only use Rentalizer API** - Don't add other AirDNA endpoints or external APIs
2. **No AI generation** - All insights should be calculated from the raw data
3. **Keep it simple** - Target audience is beginners, avoid jargon
4. **Focus on value** - Every feature should help users understand if a property is profitable
5. **Lead to Turnkey** - The end goal is getting users interested in the coaching program
