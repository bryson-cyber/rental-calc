# HasData Zillow API Documentation

## Zillow Listing API
Retrieves real estate listings from Zillow based on search parameters.

**Endpoint:** `https://api.hasdata.com/scrape/zillow/listing`
**Cost:** 5 API Credits per request
**Auth:** `x-api-key` header

### Parameters:
| Parameter | Required | Description |
|-----------|----------|-------------|
| keyword | Yes | Search location (e.g., "Atlanta, GA") |
| type | Yes | Listing type: `forSale`, `forRent`, `sold` |
| sort | No | Sorting option |
| price[min] | No | Minimum price |
| price[max] | No | Maximum price |
| beds[min] | No | Minimum bedrooms |
| beds[max] | No | Maximum bedrooms |
| baths[min] | No | Minimum bathrooms |
| baths[max] | No | Maximum bathrooms |
| homeTypes[] | No | Array of home types |
| page | No | Page number for pagination |

### Example Request:
```bash
curl --request GET \
  --url 'https://api.hasdata.com/scrape/zillow/listing?keyword=Atlanta%2C%20GA&type=forRent&beds[min]=2&beds[max]=4' \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: <your-api-key>'
```

## Zillow Property API
Retrieves detailed property information from a Zillow URL.

**Endpoint:** `https://api.hasdata.com/scrape/zillow/property`
**Cost:** 5 API Credits per request

### Parameters:
| Parameter | Required | Description |
|-----------|----------|-------------|
| url | Yes | Full Zillow property URL |
| extractAgentEmails | No | Extract agent emails (increases cost) |

### Example Request:
```bash
curl --request GET \
  --url 'https://api.hasdata.com/scrape/zillow/property?url=https%3A%2F%2Fwww.zillow.com%2Fhomedetails%2F...' \
  --header 'x-api-key: <your-api-key>'
```

## Use Case for Deal Flow Machine:
1. Daily job runs `Zillow Listing API` for each contact's city with `type=forRent`
2. For each listing, run through AirDNA revenue estimation
3. Calculate deal score based on rent vs potential STR revenue
4. Cache deals in `newsletter_deals` table
5. Send deal alerts for high-scoring properties
