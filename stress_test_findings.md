# Rental Calculator Stress Test Findings

## Test 1: Denver Property (1500 Market Street, Denver, CO)
- **Input**: $2500/month rent, 3 bed, 2 bath
- **Analysis Time**: ~2 minutes
- **Status**: Completed successfully

### Key Output Observations:

#### Revenue Projections:
- Conservative: $86,235/yr
- Realistic: $101,084/yr  
- Optimistic: $125,300/yr
- Monthly Profit: $5,144
- Revenue Ratio: 3.37x

#### Market Intelligence:
- Avg Occupancy: 56% (but report says 68% in text - INCONSISTENCY)
- Avg Daily Rate: $503 (but report says $169 in text - MAJOR INCONSISTENCY)
- Active Listings: 9 (but report says 13,376 in text - MAJOR INCONSISTENCY)
- Est. RevPAR: $282 (but report says $115 in text - INCONSISTENCY)

### Issues Found:

1. **DATA INCONSISTENCY**: The Market Intelligence Report card shows:
   - 9 active listings, $503 ADR, 56% occupancy, $282 RevPAR
   - But the AI-generated text mentions:
   - 13,376 active listings, $169 ADR, 68% occupancy, $115 RevPAR
   - These are completely different numbers!

2. **Potential Prompt Engineering Issues**:
   - The AI seems to be generating text based on different data than what's displayed in the cards
   - The narrative mentions "13,376 active listings" which seems like market-wide data
   - The card shows "9 active listings" which seems like local/comparable data
   - Need to clarify in the prompt which data source to use for narrative

3. **Good Elements**:
   - Executive summary is comprehensive
   - Seasonal analysis is detailed
   - Risk assessment is thorough
   - Competitor cards with images are working well
   - Revenue projections show conservative/realistic/optimistic ranges

4. **Competitor Section**:
   - Shows 5 competitors with images, ratings, revenue, occupancy
   - Links to view listings appear functional

---

## Test 2: Miami Beach Property (500 Ocean Drive, Miami Beach, FL)
- **Input**: $4000/month rent, 2 bed, 2 bath
- **Analysis Time**: ~2 minutes
- **Status**: Completed successfully

### Key Output Observations:

#### Revenue Projections:
- Conservative: $54,459/yr
- Realistic: $91,680/yr
- Optimistic: $111,140/yr
- Monthly Profit: $2,860
- Revenue Ratio: 1.91x

#### Market Intelligence Card Shows:
- Avg Occupancy: 64% (text says 62% - minor inconsistency)
- Avg Daily Rate: $335 (text says $243 - MAJOR INCONSISTENCY)
- Active Listings: 3 (text says 31,084 - MAJOR INCONSISTENCY)
- Est. RevPAR: $214 (text says $151 - INCONSISTENCY)

### Issues Found:

1. **SAME DATA INCONSISTENCY PATTERN**: The Market Intelligence Report card shows:
   - 3 active listings, $335 ADR, 64% occupancy, $214 RevPAR
   - But the AI-generated text mentions:
   - 31,084 active listings, $243 ADR, 62% occupancy, $151 RevPAR
   - This confirms the systematic issue - card data vs narrative data mismatch

2. **Competitor Count Mismatch**:
   - Card says "3 similar properties" 
   - Text says "31,084 active listings"
   - The AI is using broader market data while cards show local comparables

3. **Good Elements**:
   - Only 3 competitors shown (correctly matches card)
   - Competitor images and data look accurate
   - Seasonal analysis is detailed and market-specific
   - Revenue projections seem reasonable

---

## Test 3: Rural Kansas Property (123 Main Street, Claflin, Kansas)
- **Input**: $800/month rent, 2 bed, 1 bath
- **Analysis Time**: ~2 minutes
- **Status**: Completed successfully

### Key Output Observations:

#### Revenue Projections:
- Conservative: $19,947/yr (profit $987)
- Realistic: $20,584/yr (profit $1,624)
- Optimistic: $20,584/yr (profit $1,624)
- Monthly Profit: $135
- Revenue Ratio: 2.14x

#### Market Intelligence Card Shows:
- Avg Occupancy: 75% (text says 52% - MAJOR INCONSISTENCY)
- Avg Daily Rate: $78 (text says $135 - MAJOR INCONSISTENCY)
- Active Listings: 2 (text says 4,152 - MAJOR INCONSISTENCY)
- Est. RevPAR: $59 (text says $70 - INCONSISTENCY)
- Local Market note: "2 active short-term rental listings"

### Issues Found:

1. **SAME DATA INCONSISTENCY PATTERN CONFIRMED**: 
   - Card shows: 2 active listings, $78 ADR, 75% occupancy, $59 RevPAR
   - AI narrative says: 4,152 active listings, $135 ADR, 52% occupancy, $70 RevPAR
   - The card data appears to be LOCAL/COMPARABLE data
   - The AI narrative is using BROADER MARKET/REGIONAL data

2. **Occupancy Data Anomaly**:
   - AI mentions "occupancy rates reaching 98% in July and October"
   - Also mentions "occupancy data shows unusual patterns with rates exceeding 100%"
   - This suggests data quality issues in the underlying AirDNA data

3. **Good Elements**:
   - Only 2 competitors shown (correctly matches card)
   - Competitor images and data look accurate
   - Seasonal analysis is detailed
   - The AI correctly identifies this as a "small, niche market"

---

## SUMMARY OF FINDINGS

### Critical Issue: Data Source Mismatch

The AI narrative is using DIFFERENT DATA than what's displayed in the Market Intelligence Report cards:

| Property | Card Data | AI Narrative Data |
|----------|-----------|-------------------|
| Denver | 9 listings, $503 ADR | 13,376 listings, $169 ADR |
| Miami Beach | 3 listings, $335 ADR | 31,084 listings, $243 ADR |
| Kansas | 2 listings, $78 ADR | 4,152 listings, $135 ADR |

### Root Cause Analysis:

The prompt engineering issue appears to be:
1. **Card data** = Local comparable properties (nearby similar listings)
2. **AI narrative data** = Broader market/regional statistics

The AI is being fed BOTH datasets but is using the broader market data in its narrative while the UI displays local comparable data. This creates confusion for users who see contradictory numbers.

### Prompt Engineering Improvements Needed:

1. **Clarify data source in prompt**: Tell the AI explicitly which data set to use for narrative generation
2. **Align terminology**: Use consistent terms like "local comparables" vs "regional market"
3. **Add context labels**: Make it clear in the UI which numbers are local vs regional
4. **Validate data consistency**: Ensure the AI references the same numbers shown in cards

---

## Test 4: [Additional testing if needed]

---

## ROOT CAUSE ANALYSIS

After reviewing the codebase, I found the source of the data inconsistency:

### The Problem:

1. **Two Different Data Sources**:
   - **Market Intelligence Card** (UI): Uses `competitors.length` for active listings count
   - **AI Narrative**: Uses `marketData?.market?.metrics` which comes from `getComprehensiveMarketReport()`

2. **In `sop-reports.ts` line 3190**:
   ```typescript
   active_listings: competitors.length,  // This is LOCAL comparables (2-10 properties)
   ```
   But the AI prompt also receives:
   ```typescript
   market_occupancy: marketData?.market?.metrics?.occupancy  // This is REGIONAL market data
   market_adr: marketData?.market?.metrics?.adr  // This is REGIONAL market data
   ```

3. **The `competitors` array** contains only nearby comparable properties (filtered by bedroom count and radius)
4. **The `marketData` object** contains broader regional market statistics from AirDNA's comprehensive market report

### Why This Happens:

The code passes `competitors.length` as `active_listings` to the narrative generator, but the AI prompt template at line 4035 says:
```
MARKET OVERVIEW:
- Active Listings: ${input.active_listings}
```

The AI then sees a small number (2-10) but also sees regional occupancy/ADR data, and it tries to reconcile these by referencing the broader market data in its narrative.

### The Fix:

The prompt needs to be clearer about what data represents:

1. **Option A**: Pass ONLY local comparable data to the AI
   - Change `market_occupancy` and `market_adr` to use averages from competitors
   - This ensures consistency but loses regional context

2. **Option B**: Pass BOTH datasets with clear labels
   - Add separate fields: `local_competitors_count`, `regional_active_listings`
   - Update prompt to distinguish: "Local Comparables: X" vs "Regional Market: Y listings"

3. **Option C**: Update the prompt instructions (RECOMMENDED)
   - Add explicit instruction: "The Active Listings count represents direct competitors near this property. Use this number, not regional market totals."
   - Add: "When discussing market size, refer to the competitor count provided, not broader regional statistics."

---

## PROMPT ENGINEERING RECOMMENDATIONS

### Issue 1: Data Source Confusion
**Current Prompt** (line 4022-4035):
```
MARKET OVERVIEW:
- Market: ${input.market_name}
- Market Occupancy: ${formatOccupancy(input.market_occupancy)}%
- Market ADR: $${input.market_adr.toFixed(0)}
- Active Listings: ${input.active_listings}
```

**Recommended Fix**:
```
MARKET OVERVIEW:
- Market: ${input.market_name}
- Regional Market Occupancy: ${formatOccupancy(input.market_occupancy)}%
- Regional Market ADR: $${input.market_adr.toFixed(0)}
- Direct Competitors Analyzed: ${input.active_listings} (nearby same-bedroom properties)
- Regional Active Listings: ${input.regional_listings || 'N/A'}

IMPORTANT: When discussing "active listings" or "market size" in your analysis, 
use the Direct Competitors count (${input.active_listings}), not regional totals.
The regional metrics provide context but the competitor count reflects the actual 
competitive set this property will face.
```

### Issue 2: Missing Data Consistency Instruction
**Add to prompt** (around line 4100):
```
DATA CONSISTENCY RULES:
1. When stating "active listings" or "competitors", use the exact number from TOP COMPETITORS section
2. The occupancy and ADR figures are regional averages - note this context
3. Revenue projections are based on local comparable performance, not regional averages
4. Always cross-reference numbers you cite with the data sections above
```

### Issue 3: Occupancy Data Anomalies
The AI mentioned "occupancy rates exceeding 100%" which indicates data quality issues.

**Add validation instruction**:
```
DATA VALIDATION:
- If occupancy exceeds 100%, note this as a data anomaly and use capped values
- If metrics seem inconsistent, acknowledge the limitation rather than fabricating explanations
```

### Issue 4: Revenue Ratio vs Profit Confusion
The AI sometimes conflates revenue-to-rent ratio with profitability.

**Add clarification**:
```
KEY DEFINITIONS:
- Revenue-to-Rent Ratio: Annual STR Revenue ÷ Annual Rent (target: 2.5x+)
- Monthly Profit: (Monthly Revenue) - (Monthly Rent + Operating Expenses)
- Break-even Occupancy: Minimum occupancy needed to cover all costs
```

---

## IMPLEMENTATION PRIORITY

1. **HIGH**: Fix the `active_listings` data source mismatch
2. **HIGH**: Add data consistency instructions to prompt
3. **MEDIUM**: Add regional vs local data labels
4. **LOW**: Add data validation instructions

---

## ADDITIONAL OBSERVATIONS

### Positive Findings:
- AI narrative quality is generally good
- Seasonal analysis is detailed and useful
- Competitor analysis provides actionable insights
- The report structure is comprehensive

### Areas for Improvement:
- Consider adding a "Data Sources" section at the end of the report
- Add confidence intervals to revenue projections
- Include a "Key Assumptions" section
- Consider showing both local and regional data in the UI with clear labels

