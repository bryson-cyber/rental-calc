# HasData Zillow Property API - Contact Information

## API Endpoint
```
GET https://api.hasdata.com/scrape/zillow/property
```

## Key Parameters
| Parameter | Description | Required |
|-----------|-------------|----------|
| url | Full Zillow property URL (e.g., https://www.zillow.com/homedetails/301-E-79th-St-APT-23S-New-York-NY-10075/31543731_zpid/) | Yes |
| extractAgentEmails | Set to true to extract agent contact emails | No |

## Cost
- 5 API Credits per request

## Headers
- `x-api-key`: Your HasData API key
- `Content-Type`: application/json

## Example Request
```bash
curl --request GET \
  --url 'https://api.hasdata.com/scrape/zillow/property?url=https%3A%2F%2Fwww.zillow.com%2Fhomedetails%2F301-E-79th-St-APT-23S-New-York-NY-10075%2F31543731_zpid%2F&extractAgentEmails=true' \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: <your-api-key>'
```

## Key Finding
The `extractAgentEmails` parameter must be set to `true` to get agent contact information.
The response should include agent details in the response object.

## Implementation Plan
1. Update hasdata.ts getZillowPropertyWithContacts function to use extractAgentEmails=true
2. Parse the response for agent name, phone, email
3. Display in Contact Now dialog
