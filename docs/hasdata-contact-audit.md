# HasData Contact Data Audit

## Where contact data appears

### 1. `hasdata.ts` - `getZillowPropertyWithContacts()`
- Uses `extractAgentEmails=true` parameter
- Returns `ZillowPropertyWithContacts` which extends `ZillowProperty` with:
  - `agent: ZillowAgentContact | null` — from `data.listingAgent` or `data.agent` or `data.attributionInfo`
  - `listingAgent: ZillowAgentContact | null` — from building/property manager fields
  - `buildingName?: string`
  - `description?: string`

### 2. `ZillowAgentContact` interface:
```ts
{
  name: string;
  phone: string | null;
  email: string | null;
  brokerage: string | null;
}
```

### 3. Management company indicators in HasData response:
- `data.managementCompany` — explicitly set for apartments/managed properties
- `data.buildingName` — often indicates a managed property
- `data.buildingPhoneNumber` / `data.propertyPhoneNumber` — property manager contact
- `listingAgent.name` contains "Property Manager"
- `agent.brokerage` may contain management company name

### 4. Listing API (`searchZillowListings`) — NO contact data
- The listing search API does NOT return contact/agent info
- Contact info only comes from the Property API (`getZillowPropertyWithContacts`)
- This means filtering must happen at the Property API level, not during search

## Where filtering should happen

### Option A: Filter at `getZillowPropertyWithContacts` level
- Pro: Catches all management companies before they reach any consumer
- Con: This is a per-property API call (5 credits each), already expensive

### Option B: Filter at `opportunity-finder.ts` `getPropertyContacts` endpoint
- Pro: Only filters when contacts are actually requested
- Con: Properties still show up in search results

### Option C: Filter at the listing level using homeType
- Listings with homeType "APARTMENT" are almost always management companies
- Can filter by homeType in the search params or post-search

### Recommendation: Multi-layer approach
1. In listing search results, flag/filter properties where homeType is "APARTMENT" (likely managed)
2. When `getPropertyContacts` is called, check if contact indicates management company
3. Return a `isManagementCompany` flag so the frontend can filter/hide
