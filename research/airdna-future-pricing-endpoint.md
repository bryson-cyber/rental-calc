# AirDNA Future Pricing Endpoint

## Correct Endpoint
- **URL**: `POST /market/{marketId}/future_pricing`
- **NOT**: `/market/{marketId}/future/pricing` (which we were using - wrong!)

## Parameters
- `num_months`: integer [1..12] - The number of months to request metrics for
- `filters`: Array of filter objects (optional)
- `percentiles`: Array of numbers [0..1] - Optional percentiles to request
- `currency`: string (CurrencyISO) - ISO 4217 Currency Codes

## Response
Returns 200 with payload containing metrics array

## 404 Error
"Failed to find data matching your request" - This happens when the endpoint path is wrong

## Fix Required
Change our endpoint from:
`/market/${marketId}/future/pricing`
to:
`/market/${marketId}/future_pricing`
