# Correct AirDNA API Endpoints

## Market Metrics Endpoints (Correct Paths):

1. **Occupancy**: POST `/market/{marketId}/metrics/occupancy` ✅ (works)
2. **Average Revenue**: POST `/market/{marketId}/metrics/avg_revenue` (NOT `/revenue`)
3. **Average Daily Rate (ADR)**: POST `/market/{marketId}/metrics/adr` 
4. **RevPAR**: POST `/market/{marketId}/metrics/revpar`
5. **Active Listings**: POST `/market/{marketId}/metrics/active_listings`

## Key Findings:
- The revenue endpoint is `avg_revenue` NOT `revenue`
- The occupancy endpoint returns `occupancy_rate` field, not `value`
- All endpoints require `num_months` in request body (12-60)

## Response Field Names:
- Occupancy: `occupancy_rate`
- Revenue: `avg_revenue` (likely)
- ADR: `adr`

## Next Steps:
1. Fix endpoint paths in airdna.ts
2. Fix response field parsing to match actual API response structure
