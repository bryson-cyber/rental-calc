# AirDNA API Endpoints Research

## 1. Explore Listings Within a Given Radius (fetchListingsByArea)
Endpoint: POST /listing/comps/area

Purpose: Returns a list of comparable listings within a radius of a given address or location.

Key Features:
- Number of bedrooms and bathrooms
- Overall Rating
- Review Count
- Metrics: ADR, Revenue, and Occupancy
- Amenities

Request Parameters:
- address (required): String representing an address
- radius (required): Distance in meters to search from location
- pagination: Object to request specific page of data
- filters: Array of filters (bedrooms, bathrooms, etc.)

## 2. Rentalizer Bulk Summary (rentalizerBulkSummary)
Endpoint: POST /rentalizer/bulk_summary

Purpose: Request summarized performance estimates for up to 25 addresses in a single request.

Returns for each address:
- Average Daily Rate (based on next 12 months)
- Total Revenue (based on next 12 months)
- Occupancy (based on next 12 months)

Request Parameters:
- queries (required): Array of objects [1..25]
  - address (required): String representing an address
  - bedrooms: Number of bedrooms
  - bathrooms: Number of bathrooms
  - accommodates: Number of guests
  - currency: Currency for metrics (default USD)

Use Case: Quick market comparison without full detailed report.

## 3. Rentalizer Estimate - ALREADY IMPLEMENTED
Currently using all major features.

## Implementation Plan
1. Market Explorer - show all active listings in the area
2. Market Overview - show market-wide averages
3. Simplify all text to 3rd grade reading level
