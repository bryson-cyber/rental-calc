# API Response Debug

## Market Occupancy Response Structure
The API returns `occupancy_rate` not just `value`:

```json
{
  "payload": {
    "metrics": [
      {
        "date": "2024-12",
        "occupancy_rate": 59.65,
        "available_listings": 636,
        "booked_listings": 7791,
        "days_available": 107755,
        "days_booked": 129945
      }
    ]
  }
}
```

## Issue Found
The code expects `value` but the API returns `occupancy_rate` for occupancy endpoint.

Need to check other endpoints for their field names too.
