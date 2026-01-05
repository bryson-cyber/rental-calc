# AirDNA Rentalizer API Research

## Key Findings from Official Documentation (airdna.redoc.ly)

### Rentalizer Endpoint Features

The Individual Rentalizer Estimate endpoint (`POST /rentalizer/estimate`) provides:

1. **High-level summaries** for future and historical performance estimates
2. **12 months of monthly future** performance estimates for rates, revenue and occupancy
3. **12 months of monthly historical** performance estimates for annual revenue valuation
4. **Up to 10 comps**, each with up to 12 months of monthly historical performance data for rates, revenue, revenue potential and occupancy

### Request Parameters
- `address` (required): String representing an address
- `bedrooms`: Number of bedrooms at the requested location
- `bathrooms`: Number of bathrooms at the requested location
- `accommodates`: Number of guests that can be accommodated
- `currency`: Currency for metrics (164 options available)

### Response Data Available

From the response sample visible in the documentation:

**Details:**
- address
- address_lookup
- zipcode
- accommodates
- bedrooms
- bathrooms
- currency

**Location:**
- lat
- lng

**Stats:**
- currency
- currency_symbol
- property_value (null in sample)
- future: summary with adr, occupancy, revenue
- historical: (available)

**Comps:**
- Up to 10 comparable properties (not 6 as currently implemented!)
- Each comp has 12 months of historical data

## Key Insight: More Comps Available!

The documentation states **"Up to 10 comps"** - we may be able to get more comps than the current 6 we're displaying. Need to check if there's a parameter to request more, or if the API simply returns up to 10 by default.

## Additional Features We Could Add

Based on the API response structure:

1. **Historical Performance Data** - 12 months of past performance (currently only showing future)
2. **Property Value Estimate** - `property_value` field exists (may be null for some properties)
3. **More Comps** - Up to 10 instead of current 6
4. **Comp Historical Data** - Each comp has 12 months of historical data we could display

## STR Listing Data Endpoint

There's also an "STR Listing Data" endpoint that could provide:
- More detailed listing information
- Up to 25 comparable properties (from comp set API)
- Additional filtering options

## Recommendations

1. Check if we're already receiving 10 comps and only displaying 6
2. Add historical performance data to the report
3. Consider using the STR Listing Data endpoint for more comps if needed
4. Display comp historical trends
