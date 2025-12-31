# Test Results - Rental Revenue Calculator

## Test Date: December 30, 2025

## Property Tested
- **Address**: 100 Peachtree St, Atlanta, GA
- **Bedrooms**: 2
- **Bathrooms**: 1
- **Guests**: 4

## Property Estimate Results (Working!)
- **Annual Revenue**: $69,618
- **Revenue Range**: $63,967 - $75,268
- **Monthly Average**: $5,802
- **Average Nightly Rate**: $310
- **Occupancy Rate**: 62%

## Monthly Forecast (Working!)
- Best Month: July 2026 - $8,743 (87% occupancy)
- Slowest Month: November 2026 - $4,287 (53% occupancy)
- All 12 months showing with revenue and occupancy data

## Market Overview (Partially Working)
- **Average Occupancy**: 57%
- **Average Daily Rate**: $151
- **Average Revenue**: $2,421
- **Active Listings**: 0 (this field needs fixing)

## Performance by Bedroom Count (Working!)
| Bedrooms | Avg. Revenue | Avg. ADR | Occupancy |
|----------|-------------|----------|-----------|
| 1 BR     | $1,560      | $91      | 59%       |
| 2 BR     | $2,421      | $151     | 57%       |
| 3 BR     | $3,041      | $196     | 55%       |
| 4 BR     | $3,988      | $269     | 54%       |
| 5 BR     | $4,855      | $369     | 48%       |

## Top Performing Properties Nearby (Working!)
8 comparable properties showing with:
- Property names
- Bedroom/bathroom counts
- Ratings and reviews
- Annual revenue
- ADR and occupancy
- View Listing links

## Issues to Fix
1. Active Listings count showing 0 - the API endpoint returns revenue field instead of listing count
2. The market overview "avg revenue" shows $2,421 which is monthly, not annual

## Overall Status
The report is functional and displaying real AirDNA data. The main property estimate, monthly forecast, bedroom performance, and comparable properties are all working correctly.
