# Debug Notes - Jan 30, 2026

## Issues Identified from Screenshot

1. **Google Places Dropdown UI** - The screenshot shows the dropdown is using building icons (🏙️) instead of MapPin icons, and the styling looks different from the rest of the app. The dropdown appears to be floating with a gap between input and results.

2. **Tab Persistence** - Need to investigate why localStorage state isn't being restored

3. **Map Not Loading** - Coordinates aren't being passed to the map component

4. **Compare Zero Revenue** - Favorites showing zero revenue

## Root Cause Analysis

### Google Places Dropdown
- Current styling uses emoji icons instead of Lucide icons
- Dropdown has `mt-2` gap which creates visual separation
- Need to match the styling of MarketAutocomplete component

### Tab Persistence
- Need to verify localStorage is being read on component mount
- Check if savedState is null or has expired

### Map Loading
- Check if lat/lng are being passed in URL parameters
- Verify MapFirstLayoutV2 is reading the coordinates correctly

### Compare Zero Revenue
- Check if favoriteProperties table has revenue data
- Verify the query is returning the data correctly
