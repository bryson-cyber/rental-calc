# Shared Report Page Issues - Jan 26, 2026

## URL Tested: https://coachinayahturnkeytool.com/report/n39omhslmkvdyhh3

## Issues Found:

### 1. Active Listings Shows 350 Instead of 25,103
- Market Overview shows "Active Listings: 350" 
- This is the sampled count, not the actual market total
- Should show 25,103 for Atlanta

### 2. Missing Sections
The shared report is missing several sections that exist in the main LeadMagnet view:
- Market Verdict Card (letter grade)
- Quick Insights (Top Earner, Most Booked, Market Size)
- Market Health Score (overall 63/100)
- Guest Behavior Insights
- Competition Landscape
- Historical Seasonality charts
- Market Performance Over Time
- Comp Data Table
- Submarket Comparison

### 3. What IS Displayed:
- Market Overview (revenue, ADR, occupancy, listings)
- Revenue by Property Type (1-5 BR cards)
- Market Scores (Investability 60/100, Seasonality 70/100)
- Revenue Distribution (25th, 50th, 75th, 90th percentiles)
- Competition Insights (Superhosts 54%)
- Booking Patterns (Avg Length of Stay 3 nights)
- Seasonality (section exists but no chart visible)

## Root Cause Analysis:
The SharedReportPage component is using a different/older data structure than the main LeadMagnet page. It needs to be updated to:
1. Use the correct totalListings count from the API
2. Include all the sections that exist in LeadMagnet
3. Display the Market Verdict Card with letter grade
