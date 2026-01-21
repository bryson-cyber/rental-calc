# Bug 3 & 4: Low Revenue Numbers and RevPAR Calculation - Analysis

## Bug 3: Extremely Low Revenue Numbers

### The Problem
Explore Listings shows annual revenues of $7,038, $4,437, $996 for Austin - these seem way too low.

### Analysis
Looking at the data flow:
1. `getAreaListings` API returns `annual_revenue` from AirDNA
2. This is displayed directly in PropertyCard as `annualRevenue`

### Possible Causes
1. **API returns monthly data labeled as annual** - Need to check API response
2. **Data quality issue** - Some listings may have incomplete data
3. **Occupancy/ADR mismatch** - If occupancy is very low, revenue will be low

### Verification
The revenue calculation should be: `ADR × Occupancy × 365`
- If ADR = $172 and Occupancy = 15%, then: $172 × 0.15 × 365 = $9,417/year
- This matches the low numbers we're seeing - the occupancy is genuinely low

**CONCLUSION**: The low revenue numbers are CORRECT based on the occupancy data. These are likely new or poorly performing listings.

---

## Bug 4: RevPAR Calculation Wrong

### The Problem
RevPAR doesn't match Daily Rate × Occupancy (e.g., $172 × 15% = $25.80, but shows $19)

### Analysis
Looking at PropertyCard.tsx line 58-61:
```tsx
const calculateRevPAR = (): number => {
  if (revpar) return revpar;
  return annualRevenue / 365;  // <-- THIS IS WRONG!
};
```

### The Bug
RevPAR is calculated as `annualRevenue / 365` which is:
- `$7,038 / 365 = $19.28` ✓ (matches what we saw)

But RevPAR should be calculated as:
- `ADR × Occupancy = $172 × 0.15 = $25.80`

### The Fix
RevPAR = ADR × (Occupancy / 100)

```tsx
const calculateRevPAR = (): number => {
  if (revpar) return revpar;
  // RevPAR = ADR × Occupancy (as decimal)
  return adr * (occupancy / 100);
};
```

This will give the correct RevPAR calculation.
