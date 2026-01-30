# Zapier Webhook URL for Rental Calculator Integration

**Webhook URL:** `https://hooks.zapier.com/hooks/catch/12617088/ul14f3u`

This webhook will receive data from the rental calculator tool when:
- A user opts in for personalized emails
- A user generates a revenue report
- A user searches for regulations
- A user uses any tool

## Data Payload Format
The webhook will receive JSON data like:
```json
{
  "event_type": "tool_usage",
  "tool_name": "revenue_calculator",
  "city": "Loma Linda",
  "state": "CA",
  "zip": "92354",
  "email": "user@example.com",
  "timestamp": "2026-01-30T12:42:00Z",
  "revenue_estimate": 35259,
  "occupancy_rate": 62
}
```

## Next Steps
1. Add this webhook URL to the rental calculator's environment variables
2. Set up the HubSpot action in Zapier to update contacts
3. Test the integration
