# HasData API Research: Redfin and Realtor.com Support

## Date: Jan 28, 2026

## Findings

### Redfin Support - YES
HasData has a dedicated **Redfin Data API** with two endpoints:
1. **Redfin Listing API** - Search by location (zip code, city, state) and listing type (forSale, forRent)
2. **Redfin Property API** - Get property details from a Redfin URL

The Redfin Property API accepts a `url` parameter with a Redfin property URL and returns:
- Property ID
- URL
- Price
- Street, City, State, Zipcode
- Property Type
- Beds, Baths
- Area
- Year Built
- Status (sold, for sale, etc.)
- Image URL
- Address details

API Endpoint: `https://api.hasdata.com/scrape/redfin/property`
Pricing: $0.42 / 1k requests

### Realtor.com Support - NOT FOUND
HasData does not appear to have a dedicated Realtor.com API. The available real estate APIs are:
- Zillow Data API
- Redfin Data API
- Airbnb Data API

## Implementation Plan

1. Add Redfin URL detection to SmartAddressInput
2. Create hasdata-redfin.ts module similar to hasdata-zillow.ts
3. Add redfin router endpoint to routers.ts
4. Update SmartAddressInput to handle both Zillow and Redfin URLs

## Redfin URL Patterns
- https://www.redfin.com/{state}/{city}/{address}/home/{id}
- https://www.redfin.com/{state}/{city}/{address}/unit-{unit}/home/{id}

