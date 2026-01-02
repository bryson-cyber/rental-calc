# AirDNA Historical Data Availability

## Key Finding: 12-60 Months of Historical Data Available

From the AirDNA Enterprise API documentation:

> "We provide between **12 and 60 months** of monthly historical data for the following key metrics:"

### Available Historical Metrics:

**Booking Data:**
- Occupancy
- Booking Demand
- Booking Lead Time
- Average Length of Stay

**Pricing Data:**
- Average Revenue
- Average Daily Rate
- RevPAR (Revenue Per Available Rental)

## Implementation Notes

1. **Current Implementation:** We're only fetching 12 months of historical data
2. **Maximum Available:** 60 months (5 years) of historical data
3. **API Parameter:** `num_months` parameter controls the range

## Recommended Changes

1. Update `getMarketHistoricalData()` to fetch 60 months instead of 12
2. Add a "5-Year Historical Summary" section to the report
3. Calculate year-over-year trends for:
   - Occupancy changes
   - ADR growth/decline
   - Revenue trajectory
   - Market saturation (active listings growth)

## API Endpoint Reference

```
POST /market/{marketId}/metrics/{metricType}
Body: { "num_months": 60 }
```

Supported metric types:
- occupancy
- avg_revenue
- adr
- revpar
- active_listings_count
- booking_lead_time
- los (length of stay)
