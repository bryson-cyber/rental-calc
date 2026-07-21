# Fix Notes - Step 2 & Navigation Issues

## Current State
- ALL_TABS (line 463): ['ebook', 'regulations', 'opportunity', 'validate', 'compare', 'map', 'lease']
- Step label mapping (line 2778): regulations=Step 1, opportunity=Step 2, prove=Step 3, find=Step 4, validate=Step 5, compare=Step 6, map=Step 7, market=Step 8, advisor=Step 9
- Problem: 'prove', 'find', 'market', 'advisor' are NOT in ALL_TABS but still in label mapping

## Correct Step Labels (based on ALL_TABS order)
- ebook = Guide
- regulations = Step 1
- opportunity = Step 2
- validate = Step 3
- compare = Step 4
- map = Step 5
- lease = Step 6

## Fix 1: Step 2 → Step 5 Navigation
- After analysis shows on card, add "View Full Analysis →" button
- Button should call onSelectProperty AND navigate to 'validate' tab
- OpportunityFinderStep already has onSelectProperty prop (line 161)
- Need to add onNavigateToValidate prop or modify onSelectProperty to also trigger tab switch
- In LeadMagnet.tsx line 4054-4063: onSelectProperty already sets address/bedrooms/bathrooms/monthlyRent but comments say "Don't switch tabs"
- FIX: Add a separate "View Full Analysis" button that calls onSelectProperty AND triggers setActiveTab('validate')

## Fix 2: Step Ordering
- Line 2778 in LeadMagnet.tsx: Update the ternary to match ALL_TABS
- Line 2851: Same step number mapping needs updating
- Line 726-735: stepMapping for URL params needs updating

## Fix 3: Remove One-Click Market Evaluation
- Lines 6986-7010 in LeadMagnet.tsx: The Market Evaluation card in the "Go Deeper" section
- Just remove that button/card, keep the Deal Alerts card

## Fix 4: Remove Trends Tab
- Line 2560-2588 in OpportunityFinderStep.tsx: The Trends TooltipProvider block
- Also change grid-cols-5 to grid-cols-4 on line 2441

## Fix 5: Map Tab
- Line 2467-2487 in OpportunityFinderStep.tsx: Map button navigates to /?tab=map
- The Map tab in LeadMagnet is in ALL_TABS as 'map'
- Need to check if the map tab content renders properly
