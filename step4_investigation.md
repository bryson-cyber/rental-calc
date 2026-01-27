# Step 4 Backend Logic Investigation

## Current Behavior

Step 4 "Find the Best Deal" currently works as follows:

1. User enters multiple property addresses with bedrooms, bathrooms, and monthly rent
2. For each property, the system calls `analyzeProperty.mutateAsync()` which uses the AirDNA Rentalizer API
3. The Rentalizer API returns:
   - Revenue estimates (annual revenue, ADR, occupancy)
   - Comparable properties (`comps`) that are EXISTING Airbnb listings nearby

4. **The Problem**: The code then extracts data from the FIRST comparable property:
   ```javascript
   const firstComp = data.property.comps?.[0];
   const imageUrl = firstComp?.image_url || undefined;
   const propertyType = firstComp?.property_type || undefined;
   const rating = firstComp?.rating || undefined;
   const reviews = firstComp?.reviews || undefined;
   ```

5. This means the photo, rating, and reviews shown are from a NEARBY EXISTING AIRBNB LISTING, not the property being analyzed.

## Why This Is Misleading

- The user is analyzing a property they're CONSIDERING for rental arbitrage (not yet on Airbnb)
- Showing a photo, rating, and reviews from a nearby listing makes it look like the property IS already on Airbnb
- This creates confusion about what the tool is actually showing

## The "Could not analyze" Error

When the AirDNA Rentalizer API cannot find comparable properties for an address, it returns an error. This happens when:
- The address is in an area with very few Airbnb listings
- The address format is not recognized by the API
- The API cannot geocode the address properly

## Proposed Fix

1. **Remove misleading data**: Don't show photo, rating, or reviews from comparable properties
2. **Use a generic property icon**: Show a house icon instead of a photo from a nearby listing
3. **Make the estimates clear**: Show that revenue/occupancy are ESTIMATES based on market data, not actual performance
4. **Add a tooltip**: Explain that these are market-based estimates for a potential listing

## Revenue Estimates Are Still Valid

The revenue, ADR, and occupancy estimates from the Rentalizer API ARE valid for the user's use case because:
- They're based on what similar properties in the area earn
- They account for the specified bedrooms/bathrooms
- They're market-based projections, not actual listing data

The issue is only with the photo/rating/reviews being pulled from comparable listings.
