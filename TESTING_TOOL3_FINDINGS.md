# Tool 3: See Real Revenue (Market Research) - Testing Findings

## Test Date: Jan 21, 2026

## Test Case
- Market: Miami, Florida, United States

## Results Observed

### Working Features
- ✅ City autocomplete works - shows suggestions with listing counts
- ✅ "Market Validated" badge appears with "Miami is Profitable" header
- ✅ Revenue by Property Type section shows data for 1-5 bedrooms
- ✅ Market Seasonality section with monthly charts
- ✅ Occupancy by Month chart with color coding (green = above avg, amber = below)
- ✅ Average Daily Rate by Month chart with color coding (blue = above avg, gray = below)

### Data Quality Check
| Bedroom | Revenue/yr | Occupancy | Listings |
|---------|-----------|-----------|----------|
| 1 BR | $375,578 | 69% | 7 listings |
| 2 BR | $316,096 | 78% | 54 listings |
| 3 BR | $426,505 | 75% | 25 listings |
| 4 BR | $375,165 | 64% | 23 listings |
| 5 BR | $337,245 | 61% | 35 listings |

### Seasonality Data (Miami)
| Month | Occupancy | ADR |
|-------|-----------|-----|
| Jan | 64% | $257 |
| Feb | 74% | $272 |
| Mar | 72% | $282 |
| Apr | 60% | $262 |
| May | 58% | $251 |
| Jun | 62% | $228 |
| Jul | 60% | $217 |
| Aug | 57% | $206 |
| Sep | 51% | $193 |
| Oct | 58% | $207 |
| Nov | 60% | $220 |
| Dec | 65% | $273 |

Average: 62% occupancy, $239 ADR

### UI Elements Working
- ✅ State/City/Neighborhood/Zip Code drill-down selectors
- ✅ Search button functionality
- ✅ Reset All button
- ✅ "Find Opportunities in Miami" button
- ✅ "Save Market" button
- ✅ Color-coded charts with legends

### Issues Found
- None so far - Tool 3 appears to be working correctly
- Need to scroll more to check for additional sections


## Comp Data Section

### Working Features
- ✅ "Comp Data - Miami" section shows listings (74 total)
- ✅ Listing images displayed
- ✅ Property details: beds, baths, guests
- ✅ Annual Revenue, ADR, Occupancy, Rating shown
- ✅ "View on Airbnb" links for each listing
- ✅ Property type badges (House, Cabin, Villa)
- ✅ Superhost badges displayed
- ✅ "Show Filters" button available
- ✅ "Find Opportunities in Miami" and "Save Market" buttons

### Sample Listings Displayed
| Property | BR/BA | Revenue | ADR | Occupancy | Rating |
|----------|-------|---------|-----|-----------|--------|
| Red Hawk Ridge Manzanita | 5BR/4BA | $293,xxx | $2,405 | 47% | 4.5 (0) |
| Grand Alpine Estate | 5BR/3.5BA | $128,xxx | $673 | 57% | 4.8 (29) |
| Perfect Mountain Retreat | 4BR/2.5BA | $111,xxx | $595 | 57% | 4.9 (37) |
| Japatul House-Log Mansion | 4BR/2.5BA | $94,6xx | $745 | 45% | 5.0 (7) |
| Luxury San Diego Estate | 6BR/5.5BA | (visible) | - | - | - |

### Issues Found
- ⚠️ Some properties appear to be from San Diego area (Red Hawk Ridge Manzanita, Japatul House) but showing in Miami search - possible data issue
- ⚠️ Revenue numbers appear truncated (showing $293, $128, $111 instead of full amounts)
