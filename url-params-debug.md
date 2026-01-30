# URL Parameters Debug - Jan 30, 2026

## Issue Identified
When visiting `/?tab=prove&city=Loma+Linda&state=CA`:
1. The page scrolls to the "See Real Revenue" section (Step 3) - WORKING
2. The prove tab panel is visible - WORKING
3. BUT: The city/state fields are NOT pre-populated in the search inputs
4. The search is NOT auto-triggered

## Root Cause
Looking at the screenshot, I can see:
- The "See Real Revenue" tab IS highlighted (gold background)
- The panel IS expanded showing "Select Your Market" section
- BUT the "Quick Search by City/Market" input shows placeholder text, not "Loma Linda"
- The State dropdown is not pre-selected to "CA"

## Code Analysis
In LeadMagnet.tsx lines 538-570:
- `setExploreAddress(hubspotLocation)` is called
- `setResearchMarket(hubspotLocation)` is called
- But these state variables may not be connected to the prove tab's search inputs

## Fix Needed
The prove tab uses HierarchicalLocationSelector component which has its own state.
Need to either:
1. Pass the URL params directly to HierarchicalLocationSelector
2. Or add a new state variable specifically for the prove tab's city search
3. Or auto-populate the "Quick Search by City/Market" input field
