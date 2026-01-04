# Stress Test Bug Report - Austin Property

## Test Date: January 4, 2026

## Summary
The stress test revealed several data inconsistency issues related to competitor counts being displayed differently across multiple sections. These are primarily **display/labeling issues** rather than data calculation bugs, as different sections intentionally show different scopes of data (radius-based, market-wide, same-bedroom, etc.).

## Root Cause Analysis
The "bugs" are actually **intentional design decisions** showing different data scopes:
1. **Direct Competitors** = nearby same-bedroom properties (radius-based)
2. **Market Saturation** = entire market analysis
3. **Qualifying Competitors** = properties meeting revenue threshold
4. **Same-Bedroom Radius** = same-bedroom within specific km radius

The issue is **poor labeling/UX** that confuses users about what each number represents.

## Test Property
- Address: 1500 S Congress Ave, Austin, TX, USA
- Monthly Rent: $2,500
- Bedrooms: 3
- Bathrooms: 2

## Analysis Results - Full Review

### Key Metrics Displayed (Top Cards)
- Projected Revenue: $132,750/year
- Monthly Profit: $8,083
- Market Occupancy: 57%
- Break Even: 2.0 months

### Executive Summary Metrics
- Revenue-to-rent ratio: 4.42x
- Break-even occupancy: 46%
- 8 direct competitors analyzed
- Market name: "Austin" - CORRECT

### Market Intelligence Report
- Avg Occupancy: 56%
- Avg Daily Rate: $351
- Direct Competitors: 15
- Est. RevPAR: $197
- "Local Market" section says: "25 same-bedroom competitors"

### 5-Year Market Trends
- Revenue: $3,507 (↑ 34.2%)
- Occupancy: 58% (→ 0.1%)
- Avg Daily Rate: $219 (↑ 32.2%)

### Market Saturation Analysis
- Total Listings: 200
- Same Bedroom Count: 5
- Concentration: FRAGMENTED
- Avg Revenue: $268,759
- Revenue Percentiles: 25th: $201,261, 50th: $239,402, 75th: $289,814, 90th: $362,643

### Qualifying Competitors
- Qualifying: 28
- Same Bedroom Total: 28
- Qualification Rate: 100%
- Revenue Threshold: $60,000

### AirDNA Feasibility Assessment
- Projected Revenue: $71,910
- Break-Even Occupancy: 23%
- Risk Level: MEDIUM
- vs Our Estimate: -46%

### Same-Bedroom Competitors (3 BR within 3.0km)
- Total Found: 25
- Avg Revenue: $123,757
- Superhosts: 21
- Professionals: 11

## BUGS IDENTIFIED

### Bug 1: Inconsistent Competitor Counts
Multiple sections show different competitor counts:
- "8 direct competitors analyzed" (top summary)
- "15 Direct Competitors" (Market Intelligence)
- "25 same-bedroom competitors" (Local Market)
- "5 Same Bedroom Count" (Market Saturation)
- "28 Qualifying" (Qualifying Competitors)
- "25 Total Found" (Same-Bedroom Competitors)

**Severity:** HIGH - Confusing to users

### Bug 2: Revenue Projection Exceeds Top Performer
- Our realistic projection: $132,750/year
- Top competitor earns: $96,860/year
- Executive summary says: "137% of what the top-performing competitor earns"

This is mathematically questionable - how can a new property be projected to earn 37% MORE than the current top performer?

**Severity:** MEDIUM - May be intentional but needs clarification

### Bug 3: AirDNA vs Our Estimate Discrepancy
- AirDNA Projected Revenue: $71,910
- Our Realistic Projection: $132,750
- Difference: -46%

This is a massive discrepancy that could mislead users.

**Severity:** HIGH - Needs explanation or reconciliation

### Bug 4: Market Saturation Data Seems Wrong
- Same Bedroom Count: 5 (but we found 25-28 competitors elsewhere)
- Avg Revenue: $268,759 (but competitors shown earn $70k-$200k)
- Revenue percentiles seem inflated (25th percentile at $201,261?)

**Severity:** HIGH - Data inconsistency

### Bug 5: 5-Year Trends Revenue Format
- Revenue shows "$3,507" which appears to be monthly, not annual
- But context suggests this should be annual revenue
- Format is confusing

**Severity:** LOW - Formatting/clarity issue

### Bug 6: "Your Competition" Shows Only 5 Properties
- Header says "10 similar properties" but only 5 are displayed
- This may be intentional (top 5) but header is misleading

**Severity:** LOW - UI inconsistency

## API ERRORS DETECTED (from server logs)
1. Error fetching property 5619107: "Could not find Listing for the requested id"
2. Error fetching top performers: "Input should be a valid list"

These API errors may be causing some data inconsistencies.

## RECOMMENDATIONS
1. Standardize competitor count across all sections
2. Add explanation for why projection exceeds top performer
3. Reconcile AirDNA vs Our Estimate or explain methodology difference
4. Fix Market Saturation data source
5. Clarify 5-Year Trends revenue format
6. Update "Your Competition" header to match actual count
