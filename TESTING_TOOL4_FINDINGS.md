# Tool 4: Explore Listings - Testing Findings

## Test Date: Jan 21, 2026

## Test Case
- Location: Texas 130, Austin, TX, USA
- Radius: 3 km (~2 mi)
- Beds: 2 Bedrooms (Apples-to-apples filter applied)
- Sort: Highest Revenue

## UI Elements Observed

### Working Features
- ✅ Location autocomplete works - shows street/area suggestions
- ✅ Radius dropdown with options: 1km, 3km, 5km, 10km
- ✅ Beds dropdown with "Apples-to-apples" label showing property match
- ✅ Sort dropdown: Highest Revenue, Closest to Address, Highest Occupancy, Best Rated
- ✅ "Find Opportunities" button
- ✅ "What You'll Discover" expandable section

### Issues Found
- ⚠️ Location input shows empty after selection (visible in screenshot - input field appears blank)
- Need to click "Find Opportunities" to see results

## Next Step
Click "Find Opportunities" to see the listing results


## Listing Results

### Working Features
- ✅ "3 Opportunities Found" badge displayed
- ✅ "Here's What's Making Money" header with location context
- ✅ Filter & Sort section with multiple dropdowns
- ✅ List View / Map View toggle buttons
- ✅ Property cards with images, ratings, and metrics
- ✅ "View Listing" and bookmark buttons on each card
- ✅ "Validate a Specific Deal" CTA at bottom

### Sample Listings Displayed
| # | Type | Name | Beds/Bath | Revenue | Daily Rate | Occupancy | RevPAR | Rating |
|---|------|------|-----------|---------|------------|-----------|--------|--------|
| 1 | Guest_house | Garage Apartment | 2 bed / 1 bath | $7,038 | $172 | 15% | $19 | 4.8 (25) |
| 2 | House | Quiet, Clean, Home near Airport | 2 bed / 1.5 bath | $4,437 | $60 | 76% | $12 | 5.0 (3) |
| 3 | House | A hidden gem in Del Valle | 2 bed / 1 bath | $996 | $332 | 10% | $3 | 4.4 (8) |

### Issues Found
- ⚠️ **CRITICAL BUG**: Revenue numbers appear extremely low ($7,038, $4,437, $996 annual) - these should be much higher for Austin area
- ⚠️ **BUG**: Occupancy rates very low (15%, 10%) for some listings - may indicate data quality issues
- ⚠️ **BUG**: RevPAR values ($19, $12, $3) seem incorrect - should be Daily Rate × Occupancy
- ⚠️ Location input field appears blank after selection (minor UI issue)

### Calculations Check
- Listing #1: RevPAR should be $172 × 0.15 = $25.80, shows $19 ❌
- Listing #2: RevPAR should be $60 × 0.76 = $45.60, shows $12 ❌
- Listing #3: RevPAR should be $332 × 0.10 = $33.20, shows $3 ❌

**ROOT CAUSE**: RevPAR calculation appears to be wrong or using different data source
