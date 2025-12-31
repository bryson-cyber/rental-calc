# AirDNA API Documentation Notes

## Authentication
- All requests require `Authorization: Bearer {API_KEY}` header
- Content-Type: application/json

## Rentalizer Estimate Endpoint (Individual)
**POST** `https://api.airdna.co/api/enterprise/v2/rentalizer/estimate`

### Request Body
```json
{
  "address": "1321 15th St. Denver, CO 80202",
  "bedrooms": 3,
  "bathrooms": 3.5,
  "accommodates": 6,
  "currency": "usd"
}
```

### Response (200)
Returns:
- `payload.details` - address, zipcode, accommodates, location (lat/lng)
- `payload.stats` - currency, currency_symbol, property_value
- `payload.stats.future` - future performance estimates
- `payload.stats.historical` - historical performance estimates
- `payload.comps` - array of comparable properties (up to 10)

### Key Data Points
- Annual revenue estimates (future and historical)
- Average daily rate
- Occupancy rate
- Monthly forecasts (12 months)
- Comparable properties with their performance data

## Bulk Summary Endpoint
**POST** `https://api.airdna.co/api/enterprise/v2/rentalizer/bulk_summary`

- Up to 25 addresses per request
- Returns: Average Daily Rate, Total Revenue, Occupancy (next 12 months)
