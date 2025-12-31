# Distance Display Test Findings

## Current Status
The competition section shows:
- "Luxurious Urban Townhome in Denver"
- "2 BR • townhouse • 63% occupancy"
- Rating: 5.0
- Revenue: $56,544/year
- ADR: $261/night

## Issue
The distance display is NOT showing in the competition cards. The code has `{comp.distance_meters && ...}` but the distance is not appearing.

## Possible Causes
1. The `distance_meters` field may not be coming from the AirDNA API
2. The field may be named differently in the API response
3. The field may be null/undefined in the response

## Next Steps
1. Check the backend to see what fields are returned from the AirDNA API for comps
2. Verify the field name matches what we're expecting
3. Add the distance calculation if not provided by the API
