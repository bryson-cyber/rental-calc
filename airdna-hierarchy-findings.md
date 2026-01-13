# AirDNA API Hierarchy Findings

## Available Endpoints

### 1. Get Submarkets for a Market
**Endpoint:** `POST /market/{market_id}/submarkets`
**Body:** `{"pagination": {"page_size": 25, "offset": 0}}`

Example: Phoenix/Scottsdale (airdna-417) has 44 submarkets including:
- Glendale (airdna-146)
- Scottsdale (airdna-4275)
- Mesa (airdna-2239)
- Tempe (airdna-1353)
- Goodyear / Avondale (airdna-2898)

### 2. Get Listings in a Submarket (with Zip Codes)
**Endpoint:** `POST /submarket/{submarket_id}/listings`
**Body:** `{"pagination": {"page_size": 25, "offset": 0}}`

Each listing includes a `zipcode` field. We can aggregate unique zip codes.

Example: Glendale (airdna-146) has 1,109 listings across zip codes:
- 85301, 85302, 85303, 85304, 85305, 85307

### 3. Search Markets
**Endpoint:** `POST /market/search`
**Body:** `{"term": "search term", "pagination": {"page_size": 25, "offset": 0}}`

Returns markets and submarkets matching the search term.

## Hierarchy Structure

```
State (e.g., Arizona)
  └── Market (e.g., Phoenix/Scottsdale - airdna-417)
        └── Submarket (e.g., Glendale - airdna-146)
              └── Zip Codes (e.g., 85301, 85302, 85303...)
```

## Implementation Plan

### Step 1: State Selection
- Use a static list of US states
- When state is selected, search for markets in that state using `/market/search` with state name

### Step 2: City/Market Selection  
- Filter search results to show only markets (type: "market") in the selected state
- Display market name and listing count

### Step 3: Submarket Selection
- When market is selected, call `/market/{market_id}/submarkets`
- Display all submarkets with their metrics (revenue, occupancy, etc.)

### Step 4: Zip Code Selection (Optional)
- When submarket is selected, call `/submarket/{submarket_id}/listings`
- Aggregate unique zip codes from listings
- Allow user to filter by specific zip code

## Data at Each Level

- **State Level:** No direct data - just navigation
- **Market Level:** Full market metrics from `/market/{market_id}`
- **Submarket Level:** Full submarket metrics from `/submarket/{submarket_id}`
- **Zip Code Level:** Use Rentalizer API with address in that zip code
