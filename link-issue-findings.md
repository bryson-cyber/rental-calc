# Personalized Link Issue - CRITICAL

## Problem Found
The generated link opens on the PUBLISHED site (coachinayahturnkeytool.com) but:
1. User is NOT logged in on the published site
2. The URL params (tab=prove, city=Loma Linda, state=CA) are present
3. But the page does NOT auto-scroll to Step 3 (prove)
4. The city/state are NOT auto-populated in the form

## URL Generated
`https://coachinayahturnkeytool.com/?tab=prove&city=Loma+Linda&state=CA&autoAnalyze=true`

## What Should Happen
1. Page should auto-scroll to the "See Real Revenue" (prove) section
2. City/State should be auto-populated in the market selector
3. Search should auto-trigger if autoAnalyze=true

## Root Cause
The URL parameter handling code exists in LeadMagnet.tsx but:
- It may not be running on the published version
- Or the scroll/populate logic has a bug

## Fix Needed
1. Verify the published site has the latest code with URL param handling
2. Debug why auto-scroll and auto-populate aren't working
3. Test on dev server first, then publish
