# AirDNA API Endpoint Corrections

## Issue Found:
The market metrics endpoints are returning 404 errors because the URL path is incorrect.

## Current (Wrong) Path:
`/market/{marketId}/occupancy`

## Correct Path:
`/market/{marketId}/metrics/occupancy`

## All Market Metric Endpoints (Correct Format):
- POST `/market/{marketId}/metrics/occupancy`
- POST `/market/{marketId}/metrics/revenue`
- POST `/market/{marketId}/metrics/adr`
- POST `/market/{marketId}/metrics/revpar`
- POST `/market/{marketId}/metrics/active_listings`

## Request Body:
```json
{
  "num_months": 12,
  "filters": [
    {
      "field": "bedrooms",
      "type": "select",
      "value": 2
    }
  ]
}
```

## Example marketId:
`airdna-163` (Denver)
