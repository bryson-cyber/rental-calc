# Bug 5: Wrong Market Comps in Tool 3 - Analysis

## The Problem
San Diego properties showing in Miami search results.

## Investigation
Looking at the CompDataTable component:
- It receives `submarketId` and `marketName` as props
- It calls `trpc.compData.getListings.useQuery({ submarketId, ... })`

The issue is likely:
1. **Stale submarketId** - When user searches a new market, the submarketId from a previous search may still be used
2. **Caching issue** - React Query may be returning cached data from a previous search

## Root Cause
Looking at LeadMagnet.tsx line 1971-1977:
```tsx
{(locationSelection?.submarket?.id || locationSelection?.market?.id) && (
  <div className="mt-8">
    <CompDataTable
      submarketId={locationSelection.submarket?.id || locationSelection.market?.id || ''}
      marketName={researchResult.marketName}
    />
  </div>
)}
```

The `locationSelection` state may not be properly cleared when a new search is performed.

## Verification Steps
1. Check if `locationSelection` is reset when `researchMarket` changes
2. Check if the CompDataTable query key includes all relevant parameters

## Potential Fix
Add a key prop to CompDataTable that changes when the market changes, forcing a re-render:
```tsx
<CompDataTable
  key={`${locationSelection.submarket?.id || locationSelection.market?.id}-${researchResult.marketName}`}
  submarketId={...}
  marketName={...}
/>
```

Or ensure `locationSelection` is cleared when starting a new search.

## Status
Need to verify if this is a state management issue or a caching issue.
