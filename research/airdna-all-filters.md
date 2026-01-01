# AirDNA API - All Available Listing Filters

## Complete Filter List (from API docs)

### 1. Accommodates (guests)
- Type: Numeric (gt, gte, lt, lte, range, select)
- Field: "accommodates"
- Example: `{"type": "gte", "field": "accommodates", "value": 4}`

### 2. Amenities (HUGE - 16+ amenities!)
- Type: jsonb_boolean
- Field: "amenities"
- Available amenities:
  - has_aircon: true/false
  - has_breakfast: true/false
  - has_cable_tv: true/false
  - has_dryer: true/false
  - has_elevator: true/false
  - has_gym: true/false
  - has_heating: true/false
  - has_hottub: true/false
  - has_kitchen: true/false
  - has_parking: true/false
  - has_pets_allowed: true/false
  - has_pool: true/false
  - has_smoking: true/false
  - has_tv: true/false
  - has_washer: true/false
  - has_wireless_internet: true/false

Example:
```json
{
  "field": "amenities",
  "type": "jsonb_boolean",
  "value": {
    "has_pool": true,
    "has_hottub": true,
    "has_pets_allowed": true
  }
}
```

### 3. Bathrooms
- Type: Numeric (gt, gte, lt, lte, range, select)
- Field: "bathrooms"
- Example: `{"type": "select", "field": "bathrooms", "value": 2}`

### 4. Bedrooms
- Type: Numeric (gt, gte, lt, lte, range, select)
- Field: "bedrooms"
- Example: `{"type": "range", "field": "bedrooms", "value": [2, 4]}`

### 5. Days Available LTM (Last 12 Months)
- Type: Numeric
- Field: "days_available_ltm"
- Filters by how many days the listing was available

### 6. Instant Book
- Type: Boolean select
- Field: "instant_book"
- Values: true/false
- Example: `{"type": "select", "field": "instant_book", "value": true}`

### 7. Listing Type
- Type: multi_select
- Field: "listing_type"
- Values: "entire_place", "private_room", "shared_room", "hotel_room"
- Example: `{"type": "multi_select", "field": "listing_type", "value": ["entire_place", "private_room"]}`

### 8. Occupancy Rate LTM
- Type: Numeric (percentage as decimal 0-1)
- Field: "occupancy_rate_ltm"
- Example: `{"type": "gte", "field": "occupancy_rate_ltm", "value": 0.5}` (50%+)

### 9. Price Tier
- Type: multi_select
- Field: "price_tier"
- Values: "budget", "midscale", "upscale", "luxury"
- Example: `{"type": "multi_select", "field": "price_tier", "value": ["upscale", "luxury"]}`

### 10. Professionally Managed
- Type: Boolean select
- Field: "professionally_managed"
- Values: true/false
- Example: `{"type": "select", "field": "professionally_managed", "value": true}`

### 11. Property Type
- Type: multi_select
- Field: "property_type"
- Values: "house", "apartment", "condominium", "townhouse", "loft", "villa", "cabin", "cottage", "bungalow", "chalet", "farm_stay", "guest_suite", "guesthouse", "houseboat", "tent", "tiny_house", "treehouse", "yurt", "barn", "boat", "bus", "camper_rv", "casa_particular", "castle", "cave", "cycladic_house", "dammuso", "dome_house", "earth_house", "hut", "igloo", "island", "kezhan", "lighthouse", "minsu", "pension", "plane", "ranch", "religious_building", "resort", "riad", "ryokan", "shepherds_hut", "shipping_container", "studio", "tipi", "tower", "train", "trullo", "windmill"
- Example: `{"type": "multi_select", "field": "property_type", "value": ["house", "apartment", "condominium"]}`

### 12. Ratings
- Type: Numeric (1-5 scale)
- Field: "ratings"
- Example: `{"type": "gte", "field": "ratings", "value": 4.5}`

### 13. Real Estate Type
- Type: multi_select
- Field: "real_estate_type"
- Values: "single_family", "multi_family", "condo", "townhouse"

### 14. Review Count
- Type: Numeric
- Field: "review_count"
- Example: `{"type": "gte", "field": "review_count", "value": 10}`

### 15. Superhost
- Type: Boolean select
- Field: "superhost"
- Values: true/false
- Example: `{"type": "select", "field": "superhost", "value": true}`

### 16. Percent Active
- Type: Numeric (percentage as decimal 0-1)
- Field: "percent_active"
- Filters by how active the listing is

---

## Filters to Implement in UI

### Priority 1 - Most Requested
1. **Bedrooms** - 1, 2, 3, 4, 5+ dropdown
2. **Bathrooms** - 1, 1.5, 2, 2.5, 3+ dropdown
3. **Property Type** - House, Apartment, Condo, Townhouse, etc.
4. **Pool** - Has Pool toggle
5. **Hot Tub** - Has Hot Tub toggle
6. **Pet Friendly** - Allows Pets toggle

### Priority 2 - Power User Filters
7. **Superhost** - Superhost only toggle
8. **Instant Book** - Instant book toggle
9. **Professionally Managed** - Pro managed toggle
10. **Rating** - 4+, 4.5+, 4.8+ dropdown
11. **Price Tier** - Budget, Midscale, Upscale, Luxury

### Priority 3 - Advanced
12. **Listing Type** - Entire place, Private room, etc.
13. **Accommodates** - Min guests slider
14. **Review Count** - Min reviews

---

## Current Implementation Gap

We currently only have:
- Bedrooms (basic)
- Property Type (basic)

We're MISSING:
- Bathrooms
- All 16 amenity filters (pool, hot tub, pets, etc.)
- Superhost
- Instant Book
- Professionally Managed
- Rating
- Price Tier
- Listing Type
- Accommodates
- Review Count
