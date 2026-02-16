# Studio Bedroom Bug - Root Cause Analysis

## Bug 1: Studios showing as 2 beds

### Root Cause Found
In `OpportunityFinderStep.tsx`, there are MULTIPLE places where `property.bedrooms` falls back to `2` when it's falsy (0 for studios):

1. **Line 672**: `bedrooms: property.bedrooms || 2` — in validateProperty.mutateAsync call
2. **Line 688**: `bedrooms: property.bedrooms || 2` — in onSelectProperty callback  
3. **Line 1038**: `bedrooms: String(property.bedrooms || 2)` — in buildPropertyUrl
4. **Line 1039**: `bathrooms: String(property.bathrooms || 1)` — in buildPropertyUrl

The problem: `0 || 2` evaluates to `2` in JavaScript because `0` is falsy.

### Fix
Replace all `property.bedrooms || 2` with `property.bedrooms ?? 2` (nullish coalescing).
This way `0` (studio) stays as `0`, but `null`/`undefined` still falls back to `2`.

### Display is correct
Line 1948 already handles display correctly: `property.bedrooms === 0 ? 'Studio' : ...`
Line 2905 also handles it: `photoGalleryProperty.bedrooms === 0 ? 'Studio' : ...`

## Bug 2: Math inconsistency between Step 2 and Step 5

### Likely Cause
When Step 2 passes data to Step 5 via `onSelectProperty`, the bedroom count is wrong (0 → 2).
This means the AirDNA/revenue estimate in Step 5 uses 2 bedrooms instead of 0 (studio),
which gives completely different revenue numbers.

The fix for Bug 1 should also fix Bug 2 since the wrong bedroom count cascades into wrong estimates.

## Files to fix
- `client/src/components/OpportunityFinderStep.tsx` — replace `|| 2` with `?? 2` and `|| 1` with `?? 1`
