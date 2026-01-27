# Zip Code Investigation

## User's Concern
User believes Soulard has more zip codes than just 63104, but the tool only shows 63104.

## API Response
When searching for "Soulard" or "63104", the AirDNA API returns:
```json
{
  "id": "airdna-180",
  "name": "Soulard",
  "type": "submarket",
  "listing_count": 469,
  "legacy_location": {
    "zipcodes": ["63104"]
  },
  "parent_market": {
    "id": "airdna-429",
    "name": "St. Louis"
  }
}
```

## Conclusion
According to the AirDNA API, Soulard submarket only has one zip code: 63104. This is the data that AirDNA provides for this submarket.

The zip codes displayed are directly from the API's `legacy_location.zipcodes` field. If the user believes Soulard should have more zip codes, this would be a data limitation from the source API, not a bug in our code.

## Possible Explanation
AirDNA may define "Soulard" as a specific neighborhood that only covers the 63104 zip code area. The broader Soulard area that the user is thinking of may span multiple AirDNA submarkets.

## Recommendation
The tool is correctly displaying the zip codes from the API. If the user wants to see properties from multiple zip codes, they should:
1. Search for the parent market "St. Louis" instead
2. Or search for each zip code individually
