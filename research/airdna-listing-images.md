# AirDNA API - Listing Images Research

## Key Findings

Based on the AirDNA API documentation, there are several endpoints that may contain listing images:

### 1. Single Property Endpoint (`/listing/{property_id}`)
- Returns "Property attributes and rental performance details for a single Airbnb listing"
- This endpoint likely includes images since it returns full property details
- Requires the Airbnb property ID

### 2. Comparable Properties Endpoint
- Returns "Property attributes and rental performance for up to 25 competing Airbnb listings"
- May include images in the `details.images` array

### 3. Rentalizer Endpoint
- Returns comps with `details.images` field (we're already using this)
- The images array may be empty for some properties

## Solution Approach

Since the AirDNA API may not consistently return images, we have two options:

### Option A: Use Airbnb Listing URL to construct image URL
- Each comp has an `airbnb_url` field (e.g., `https://www.airbnb.com/rooms/12345`)
- We can extract the listing ID and construct a thumbnail URL
- Airbnb image URLs follow a pattern: `https://a0.muscache.com/im/pictures/{property_id}/...`

### Option B: Fetch images from Single Property endpoint
- For each competitor, make an additional API call to `/listing/{property_id}`
- This would increase API calls but guarantee images
- May be rate-limited or expensive

### Option C: Use placeholder images based on property type
- Show generic bedroom/property images based on bedroom count
- Less ideal but ensures visual consistency

## Recommendation

Try Option A first - construct Airbnb thumbnail URLs from the listing ID. If that doesn't work, fall back to Option C with placeholder images.
