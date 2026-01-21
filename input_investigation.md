# Input Investigation - Jan 21, 2026

## Issue
User reported placeholder text was hard to see in input fields.

## Fix Applied
Updated placeholder text color from light gray to a darker shade (slate-500) across all input components:

1. **index.css** - Added global placeholder styling with `oklch(0.45 0 0)` 
2. **AddressAutocomplete.tsx** - Changed from `placeholder:text-slate-400` to `placeholder:text-slate-500`
3. **Home.tsx** - Added `placeholder:text-slate-500` to all input fields
4. **StartWithProperty.tsx** - Changed from `placeholder:text-slate-400` to `placeholder:text-slate-500`
5. **MarketComparison.tsx** - Changed from `placeholder:text-[#0F172A]/40` to `placeholder:text-[#0F172A]/60`

## Verification
Screenshot shows placeholder text "Enter your property address..." and "2,500" are now more visible against the white background.

## Status
FIXED - Placeholder text is now darker and more readable.
