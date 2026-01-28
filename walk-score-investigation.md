# Walk Score Data Source Investigation

## Finding: Walk Score IS using real Google Places API

The walk score data comes from `server/location-quality.ts` which:

1. **Uses real Google Places API** via `makeRequest('/maps/api/place/nearbysearch/json', ...)`
2. **Searches for real place types**:
   - Walk Score: restaurant, cafe, bar, grocery_or_supermarket, convenience_store, pharmacy, bank
   - Transit Score: transit_station, subway_station, bus_station, train_station, light_rail_station
   - Attraction Score: tourist_attraction, museum, art_gallery, amusement_park, aquarium, zoo, stadium, night_club
   - Amenity Score: park, gym, shopping_mall, movie_theater, spa, laundry, hospital

3. **Score calculation**:
   - Base score from count (up to 70 points): `Math.min(places.length / maxPlaces, 1) * 70`
   - Bonus for highly-rated places (up to 30 points): `Math.min(ratedPlaces.length / 10, 1) * 30`
   - Maximum score = 100

## Why 100/100 scores may appear:

If a location has:
- 15+ restaurants/cafes/shops within 0.5 miles (maxPlaces for walk score = 15)
- 10+ of those places have 4.0+ ratings

Then the score would be:
- Count score: 15/15 * 70 = 70 points
- Rating bonus: 10/10 * 30 = 30 points
- Total: 100 points

**This is legitimate** - urban areas like Houston, downtown areas, or commercial districts would genuinely have high walk scores.

## Recommendation:

The data is real. If scores seem too high, we could:
1. Make the scoring more strict (require more places for max score)
2. Add a "Data source: Google Places API" label for transparency
3. Show the actual place count in the tooltip
