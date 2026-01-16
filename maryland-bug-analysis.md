# Maryland Bug Analysis

## Issue
When selecting Maryland → Annapolis, the Neighborhood dropdown shows Salt Lake City, Utah neighborhoods instead of Annapolis, Maryland neighborhoods.

## Observed Neighborhoods (WRONG - These are Salt Lake City, UT):
- Canyon Rim $37k/yr 172 listings
- Downtown Salt Lake City $36k/yr 1,877 listings
- Draper $38k/yr 316 listings
- Herriman $26k/yr 94 listings
- Holladay $38k/yr 143 listings
- Jordan/Riverton $48k/yr 544 listings
- Kearns $26k/yr 73 listings
- Magna $19k/yr 46 listings
- Midvale $36k/yr 220 listings
- Millcreek $35k/yr 738 listings
- Murray $33k/yr 145 listings
- Riverton $39k/yr 155 listings
- Sandy $62k/yr 1,141 listings
- SLC Airport $26k/yr 237 listings
- South Jordan $40k/yr 167 listings
- South Salt Lake $31k/yr 129 listings
- Taylorsville $29k/yr 129 listings
- University $29k/yr 18 listings
- West Jordan $30k/yr 258 listings
- West Valley City $25k/yr 293 listings

## Root Cause Analysis
The issue is likely in the `getSubmarkets` function in `market-research-simple.ts`. When fetching submarkets for Annapolis, it's returning Salt Lake City's submarkets instead.

This suggests:
1. The market ID for Annapolis might be incorrectly mapped to Salt Lake City's market ID
2. OR the AirDNA API is returning wrong data for the Annapolis market ID
3. OR there's a caching issue where Salt Lake City's data is being returned for Annapolis

## Investigation Steps
1. Check what market ID is being used for Annapolis
2. Verify the market ID is correct in AirDNA's system
3. Check if there's a caching issue
