# URL Parameters Issue - CRITICAL FIX NEEDED

## Current Behavior
When visiting `/?tab=prove&city=Loma+Linda&state=CA&autoAnalyze=true`:
1. Page loads but does NOT scroll to the "See Real Revenue" (prove) section
2. The tab is NOT auto-expanded
3. The city/state fields are NOT auto-populated
4. The "Quick Search by City/Market" field is empty

## Expected Behavior
1. Page should auto-scroll to Step 3 (See Real Revenue)
2. The prove tab should be expanded
3. City "Loma Linda" should be pre-filled in the search field
4. State "CA" should be selected
5. If autoAnalyze=true, search should trigger automatically

## Root Cause Investigation
Need to check LeadMagnet.tsx to see:
1. Is the URL param handling code running?
2. Is the scroll function being called?
3. Is the city/state being passed to the correct component?

## Fix Required
1. Debug the useEffect that reads URL params
2. Ensure the prove tab expands when tab=prove
3. Auto-populate the city search field
4. Trigger search when autoAnalyze=true
