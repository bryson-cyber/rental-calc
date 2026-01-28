# AirDNA Rentalizer Layout - Inspiration for Step 5

## Key Layout Observations

### Overall Structure
- **Two-column layout**: Left side has property info + comparable properties table, right side has map
- **Map is NOT full width** - it's a smaller panel on the right side (~40% of viewport)
- **Table is the main focus** - takes up the left ~60% of the viewport

### Header Section
- Property address prominently displayed with photo
- Key metrics in a row: Projected Revenue ($33.7K), Occupancy (78%), ADR ($119)
- Comp Revenue Range bar chart showing distribution

### Comparable Properties Table
- **Clean horizontal table layout**
- Columns: Listings (with thumbnail), Revenue Potential, ADR, Occupancy, Bedrooms, Bathrooms
- Shows "1-9 of 26" pagination
- "Edit Comps" button to customize
- Comp Set Strength indicator (Low/Medium/High)

### Map Panel (Right Side)
- Smaller map showing property location and comps
- Revenue labels on map markers ($35.9k, $22k, etc.)
- Legend: "Your property" (different marker) vs "Included in comp set"
- "More Map" button to expand

### Key Design Principles
1. **Table is primary, map is secondary** - opposite of our current layout
2. **Compact, information-dense** - not spread out
3. **Clear visual hierarchy** - key metrics at top, details below
4. **Horizontal table** - all columns visible without scrolling
5. **Property context always visible** - address, beds, baths at top

## Recommended Changes for Step 5

1. **Switch to two-column layout**: Table on left (60%), Map on right (40%)
2. **Reduce map size** - make it a supporting element, not the main focus
3. **Make table the primary element** - horizontal layout with all columns visible
4. **Add property context header** - show user's property address and key metrics at top
5. **Use compact table design** - smaller rows, clear columns
6. **Add pagination** - "Showing 1-20 of 450" instead of virtualized scroll
