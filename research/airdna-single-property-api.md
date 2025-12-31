# AirDNA Single Property API Research

## Key Finding
The AirDNA API has a **Single Property** endpoint under "Listing Data" that returns:
- Property attributes
- Rental performance details
- **Potentially listing images**

## Endpoint Details
- **URI**: `/listing/{property_id}` (based on API structure)
- **Description**: "Property attributes and rental performance details for a single Airbnb listing"

## Other Relevant Endpoints
1. **Comparable Properties**: `/rentalizer/estimate` - Returns up to 10 comps with images
2. **Market Listings**: Returns listings but may not include images

## Strategy for Getting Listing Photos
1. Use the Single Property endpoint with the Airbnb property ID to fetch images
2. The property ID can be extracted from the `airbnb_url` field (e.g., `https://www.airbnb.com/rooms/12345` → ID is `12345`)
3. Make individual API calls for each competitor to get their images

## Implementation Plan
1. Create a new function `getSinglePropertyDetails(propertyId)` that calls the Single Property endpoint
2. For each competitor in the list, fetch their images using this endpoint
3. Cache the images to avoid repeated API calls
4. Display the images in the competitor cards
