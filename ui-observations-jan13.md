# UI Observations - Jan 13, 2026

## Step 2 (Explore Listings) Form Issues

Looking at the screenshot, I can see the following issues:

1. **Input field text is not centered** - The placeholder "Enter address..." appears to be positioned at the top of the input field rather than vertically centered

2. **Labels are outside the input box** - The labels "Address or City", "Radius", "Beds", "Sort" are positioned above the inputs, which is correct, but the input fields themselves may have alignment issues

3. **The input field has a double border** - There appears to be a visual issue where the input has both an outer rounded border and the text is not properly aligned within it

## Root Cause Analysis

The issue is likely in the AddressAutocomplete component or the input-apple CSS class:
- The input may have excessive padding that pushes text to one side
- The flex alignment may not be centering the text vertically
- The placeholder text styling may be different from the actual input text

## Fixes Applied

1. Updated AddressAutocomplete to use only the passed className (removed conflicting inline styles)
2. Updated input-apple class to use:
   - display: flex
   - align-items: center
   - height: 3rem (fixed height)
   - padding: 0 1rem (horizontal only)
   - line-height: 1

## Current Status

Looking at the screenshot, the input field now shows "Enter address..." placeholder. The text appears to be within the input box but may still have alignment issues. Need to verify if the text is now properly centered vertically.
