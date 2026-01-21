# Bug 6: Location Input Appears Blank After Selection - Analysis

## The Problem
After selecting a location in Tool 4 (Explore Listings), the input field appears blank.

## Investigation
Looking at AddressAutocomplete component:
- Line 347: `value={value}` - The input receives the value prop correctly
- Line 259: `onChange(prediction.description)` - When selected, it updates the value
- Line 361-363: The text color depends on variant:
  - `dark` variant: `text-white` 
  - `light` variant: `text-slate-900`

Looking at LeadMagnet.tsx line 1247-1252:
```tsx
<AddressAutocomplete
  value={exploreAddress}
  onChange={setExploreAddress}
  placeholder="Enter a city or neighborhood..."
  className="input-apple h-12"
/>
```

**No variant prop is passed!** This means it defaults to `dark` variant (line 100).

## Root Cause
The AddressAutocomplete component defaults to `variant='dark'` which uses `text-white` for the input text.
However, in the Explore Listings section, the background is light (white/slate), so white text on white background = invisible text.

## Fix
Pass `variant="light"` to the AddressAutocomplete in the Explore Listings section:
```tsx
<AddressAutocomplete
  value={exploreAddress}
  onChange={setExploreAddress}
  placeholder="Enter a city or neighborhood..."
  className="input-apple h-12"
  variant="light"
/>
```

## Status
Ready to implement fix.
