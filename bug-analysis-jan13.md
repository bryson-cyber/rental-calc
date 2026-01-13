# Bug Analysis: Step 2 Listings Missing Images

## Issue
Step 2 (Explore Listings) shows "No image available" for all property cards.

## Root Cause
The AirDNA `/listing/comps/area` API endpoint does NOT return images in its response.

Looking at line 5083 in `server/airdna.ts`:
```typescript
image_url: undefined, // API doesn't return images in this endpoint
```

The `getListingsByArea` function explicitly sets `image_url: undefined` because the API doesn't provide image data.

## Possible Solutions

### Option 1: Scrape Airbnb images (Current approach for Step 3)
The codebase already has `batchScrapeAirbnbImages` in `airbnb-scraper.ts` that can fetch images from Airbnb URLs. However, this is slow and may hit rate limits.

### Option 2: Use Airbnb CDN pattern
The `ChapterPropertyReport.tsx` has a function `getAirbnbImageUrl` that constructs image URLs from Airbnb listing IDs:
```typescript
const getAirbnbImageUrl = (airbnbUrl?: string): string | null => {
  if (!airbnbUrl) return null;
  const match = airbnbUrl.match(/rooms\/(\d+)/);
  if (!match) return null;
  const listingId = match[1];
  return `https://a0.muscache.com/im/pictures/miso/Hosting-${listingId}/original/listing-photo.jpg`;
};
```
This may not work for all listings as Airbnb's CDN requires authentication.

### Option 3: Use a different AirDNA endpoint
Some other endpoints like `/market/{id}/listings` or `/submarket/{id}/listings` DO return images in their response (see line 1428, 1634).

## Recommended Fix
Modify `getListingsByArea` to try constructing Airbnb image URLs from the listing IDs, similar to how `ChapterPropertyReport.tsx` does it. This is a lightweight solution that doesn't require additional API calls.
