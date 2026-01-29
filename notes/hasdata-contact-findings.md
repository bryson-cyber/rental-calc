# HasData API Contact Information Findings

## Date: January 29, 2026

## Key Finding
The HasData Zillow Property API does NOT reliably return agent contact information for rental listings. Testing revealed:

1. **agentEmails field exists but is empty** - The API returns an `agentEmails` array but it's empty for tested listings
2. **No phone numbers returned** - The API doesn't extract phone numbers from listings
3. **brokerName is null** - Even the broker name field is empty

## Tested URLs
- https://www.zillow.com/homedetails/1136-Willow-St-1136-Denver-CO-80220/2060095918_zpid/ → agentEmails: []
- https://www.zillow.com/homedetails/1525-E-22nd-Ave-Denver-CO-80205/13145621_zpid/ → agentEmails: []

## API Response Structure
```json
{
  "property": {
    "id": "...",
    "address": {...},
    "price": 0,
    "status": "OFF_MARKET",
    "brokerName": null,
    "agentEmails": []
  }
}
```

## Alternative Solutions

### Option 1: Direct Zillow Link (Current Implementation)
- Show "Contact via Zillow" button that opens the Zillow listing page
- User can contact agent directly through Zillow's interface
- **Pros**: Always works, no additional API costs
- **Cons**: Extra step for user

### Option 2: Zillow Contact Request Form
- Use Zillow's contact form URL pattern
- Direct link to: https://www.zillow.com/rental-manager/contact/{zpid}
- **Pros**: One click to contact form
- **Cons**: May not work for all listings

### Option 3: Scrape Contact Info Directly
- Would require custom scraping solution
- Against Zillow ToS
- Not recommended

## Recommendation
Keep the current implementation with "Contact via Zillow" as the primary action. The HasData API doesn't provide reliable contact information for rental listings. This is a limitation of the Zillow data available through scraping APIs.

## Implementation Update
Update the Contact Now dialog to:
1. Show a clear message that direct contact info isn't available
2. Provide a prominent "Contact via Zillow" button
3. Include the property address for reference
4. Consider adding a "Copy Address" button for convenience
