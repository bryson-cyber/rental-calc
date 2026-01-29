# HasData Zillow Listing API - Pagination Findings

## Source
URL: https://docs.hasdata.com/apis/zillow/listing#zillow-listing-api

## Key Findings

### Pagination Parameter
- `page` - The page number of the results to retrieve (optional)
- No explicit maximum page limit documented
- No explicit results per page limit documented

### API Cost
- 5 API Credits per request

### Current Implementation
- Currently fetching up to 5 pages (200 properties max)
- Each page returns ~40 properties

### Recommendations
1. The API doesn't document a hard limit on pages
2. Zillow itself typically limits search results to ~40 pages (1600 properties)
3. We can increase our page limit or implement "Load More" button for user-controlled pagination

### Implementation Plan
- Add "Load More" button to UI
- Start with first 2-3 pages (80-120 properties)
- Load additional pages on demand when user clicks "Load More"
- This saves API credits while giving users access to all available properties
