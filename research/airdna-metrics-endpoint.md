# AirDNA Metrics API Endpoint - Correct Format

## Key Finding
The API endpoint uses `/api/enterprise/v2/` prefix, NOT `/api/v2/`

## Correct Endpoint Format
```
POST https://api.airdna.co/api/enterprise/v2/market/{marketId}/metrics/occupancy
```

## Request Body
```json
{
  "num_months": 12,  // Required: 12 to 60 months
  "filters": [],     // Optional
  "percentiles": []  // Optional
}
```

## Response Format
```json
{
  "payload": {
    "metrics": [
      {
        "month": "2024-01",
        "occupancy_rate": 0.65,
        // ... other fields
      }
    ]
  },
  "status": {
    "type": "success"
  }
}
```

## Current Issue
Our code uses: `/api/v2/market/{marketId}/metrics/occupancy`
Should use: `/api/enterprise/v2/market/{marketId}/metrics/occupancy`

## Available Metrics Endpoints
- `/market/{marketId}/metrics/occupancy`
- `/market/{marketId}/metrics/avg_revenue`
- `/market/{marketId}/metrics/adr`
- `/market/{marketId}/metrics/revpar`
- `/market/{marketId}/metrics/active_listings_count`
- `/market/{marketId}/metrics/booking_lead_time`
- `/market/{marketId}/metrics/los`
