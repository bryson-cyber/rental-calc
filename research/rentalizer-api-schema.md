# AirDNA Rentalizer Summary API - Response Schema

Source: https://airdna.redoc.ly/#tag/rentalizer_summary_data

## Endpoint
`POST /rentalizer/summary/individual`

## Request Body
- `address` (string, required) - Property address
- `bedrooms` (integer or null) - Number of bedrooms
- `bathrooms` (number or null) - Number of bathrooms
- `accommodates` (integer or null) - Number of guests
- `currency` (string) - Currency for metrics (e.g., "usd")

## Response Schema

### payload
- **details** (RentalizerPropertyDetails)
  - address
  - address_lookup
  - zipcode
  - accommodates
  - bedrooms
  - bathrooms

- **location** (GeomPoint - ISO 6709 Coordinates)
  - lat
  - lng

- **stats** (object)
  - currency (string, required)
  - currency_symbol (string, required)
  - property_value (number or null)
  - **future** (object, required)
    - **summary** (object)
      - adr (number, required) - Average Daily Rate
      - occupancy (number, required) - Occupancy rate
      - revenue (number, required) - Annual revenue

### status
- type (string)
- response_id (string)
- message (string)

---

## What We're Currently Displaying
1. ✅ Annual Revenue (from stats.future.summary.revenue)
2. ✅ Occupancy Rate (from stats.future.summary.occupancy)
3. ✅ ADR (from stats.future.summary.adr)
4. ❌ Property Value (stats.property_value) - NOT DISPLAYED
5. ✅ Address details
6. ✅ Location coordinates

## What We're NOT Using (Available in API)
1. **property_value** - Could show estimated property value if available
2. **Monthly breakdown** - The "future" object may contain monthly data (need to check actual response)

## Note
The Rentalizer Summary endpoint is a SIMPLIFIED version. It only returns:
- ADR (Average Daily Rate)
- Occupancy
- Revenue (annual)
- Property Value (optional)

For more detailed data like:
- Monthly forecasts
- Comparable properties (comps)
- Historical data

You need the **Rentalizer Data** endpoint (not Summary), which is a different API package.
