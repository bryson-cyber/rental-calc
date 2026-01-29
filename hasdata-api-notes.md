# HasData API Notes

## Available Zillow APIs (from sidebar)
- **Zillow Listing API** - For searching listings
- **Zillow Property API** - For getting property details (this is what we need!)

## Other Relevant APIs
- Redfin: Listing API, Property API
- AirBnb: Listing API, Property API

## Zillow Property API Details

**Endpoint:** `https://api.hasdata.com/scrape/zillow/property`

**Method:** GET

**Parameters:**
- `url` (required): The Zillow property URL
- `extractAgentEmails` (optional): Extract agent emails (increases cost)

**Cost:** 5 API Credits per request

**Example:**
```bash
curl --request GET \
  --url 'https://api.hasdata.com/scrape/zillow/property?url=https%3A%2F%2Fwww.zillow.com%2Fhomedetails%2F...' \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: <your-api-key>'
```

## Implementation Plan
1. When a property has price = 0 or "Contact for Price", check if we have a Zillow URL
2. If yes, call the Zillow Property API to get detailed pricing
3. Update the property with the fetched price
4. Filter out properties that still have no price after the API call

