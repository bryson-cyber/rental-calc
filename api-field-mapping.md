# AirDNA API Field Mapping

## Actual Response Fields (from testing):

### Occupancy Endpoint (`/metrics/occupancy`)
- Field: `occupancy_rate`
- Example: `{"date":"2024-12","occupancy_rate":59.65,...}`

### Average Revenue Endpoint (`/metrics/avg_revenue`)
- Field: `adr` (confusingly named - this is actually avg revenue, not ADR)
- Example: `{"date":"2024-12","adr":157.15}`
- Note: The response message says "average daily rate metrics" but endpoint is avg_revenue

### Active Listings Endpoint (`/metrics/active_listings`)
- Field: `revenue` (confusingly named - this is actually active listings count or revenue)
- Example: `{"date":"2024-12","revenue":2621.038377615197}`

## Key Insight:
The API naming is inconsistent:
- avg_revenue endpoint returns `adr` field
- active_listings endpoint returns `revenue` field
- occupancy endpoint returns `occupancy_rate` field

## Solution:
Since the property data from Rentalizer already gives us good estimates, we can:
1. Use the Rentalizer data for property-specific metrics (which is working)
2. For market overview, we can calculate from the property data or skip the market metrics

The property estimate already shows:
- Annual revenue: $69,618
- Monthly average: $5,802
- ADR: $310
- Occupancy: 62%

The market metrics are just supplementary context.
