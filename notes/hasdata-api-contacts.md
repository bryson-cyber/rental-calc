# HasData Zillow Property API - Contact Details

## Key Finding
The HasData Zillow Property API has an `extractAgentEmails` parameter that can extract agent contact information.

**API Endpoint**: `https://api.hasdata.com/scrape/zillow/property`

**Parameters**:
- `url` (Required): The Zillow property URL
- `extractAgentEmails` (Optional): Set to `true` to extract agent email addresses

**Cost**: 5 API Credits per request

## Implementation Notes
- The Property API (not Listing API) is needed to get contact details
- Need to call this endpoint for each property when user clicks "Contact Now"
- This is a separate API call from the listing search

## Source
https://docs.hasdata.com/apis/zillow/property#zillow-property-api
