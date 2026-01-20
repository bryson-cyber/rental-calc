# AirDNA Rentalizer UI Design Inspiration

## Color Palette
- **Primary Blue/Navy**: #1e3a5f (dark navy for sidebar, headers)
- **Accent Blue**: #3b82f6 (buttons, links, active states)
- **Success Green**: #22c55e (positive metrics, growth indicators like +8%, +5%)
- **Warning Orange/Yellow**: #f59e0b (charts, seasonal data)
- **Pink/Magenta**: #ec4899 (donut charts, type indicators)
- **Cyan/Teal**: #06b6d4 (line charts, secondary metrics)
- **Background**: #f8fafc (light gray-white)
- **Card Background**: #ffffff (pure white)
- **Text Primary**: #1e293b (dark slate)
- **Text Secondary**: #64748b (muted gray)

## Typography
- **Headlines**: Sans-serif, bold, large (24-32px)
- **Metric Values**: Extra bold, very large (36-48px) for key numbers
- **Labels**: Small caps, muted color, uppercase tracking
- **Body**: Clean sans-serif, 14-16px

## Layout Structure
1. **Left Sidebar Navigation**
   - Dark navy background (#1e3a5f)
   - White/light text
   - Icon + text menu items
   - Collapsible sections (Market Insights, Advanced Research, etc.)
   - Active state: highlighted background

2. **Top Search Bar**
   - Full-width search input
   - "Search market, submarket, or address"
   - Rounded corners with search icon

3. **Breadcrumb Navigation**
   - Back arrow + location hierarchy
   - "Market Overview: Austin > Upper Boggy Creek"
   - Dropdown for submarket selection

4. **Filter Tabs**
   - Horizontal tabs: Listings, Performance, Amenities
   - Dropdown menus for each

## Key UI Components

### Market Score Card
- Large circular gauge (0-100)
- Score number in center (e.g., "99")
- "Market Score" label below
- Sub-metrics with progress bars:
  - Investability (95)
  - Rental Demand (71)
  - Revenue Growth (87)
  - Seasonality (97)
  - Regulation (65)

### Metric Cards (Grid Layout)
- White card with subtle shadow
- Metric label at top (small, muted)
- Large value (e.g., "$28.8K", "56%")
- Change indicator (+8%, +5%) in green
- Mini sparkline chart below
- Month labels on x-axis

### Donut Charts
- Used for distribution data:
  - Listings by Rental Channel (Airbnb 60%, Vrbo 5%, Both 35%)
  - Listings by Rental Size (1BR 37%, 2BR 37%, 3BR 23%, etc.)
  - Listings by Rental Type (Entire Home 91%, Private Room 9%)
  - Listings by Annual Availability

### Line Charts
- Clean, minimal design
- Single or multi-line
- Subtle grid lines
- Month/year labels on x-axis
- Used for trends over time

### Horizontal Bar Charts
- Segmented bars for policies:
  - Cancellation Policy (Other, Flexible, Moderate, Strict, Super strict)
  - Minimum Stay (1 Night, 2 Nights, 3 Nights, etc.)
- Color-coded segments with percentages

### Filter Modal/Dropdown
- **Listing Type**: Icon buttons (View All, Entire Place, Private Room, Shared Room)
- **Real Estate Type**: Icon buttons (View All, Apartment, B&B, House, Unique)
- Reset + Apply buttons at bottom

### Explore Deeper Insights Section
- Card-based navigation
- Icon + Title + Description
- Arrow indicator for navigation
- Categories: Revenue, Occupancy, Rates, RevPAR

## Rentalizer Specific UI (Property Estimate)

### Property Input Form
- Address autocomplete input
- Bedroom/Bathroom/Guests selectors
- Property image placeholder
- "This property currently has no image available"

### Revenue Estimate Display
- **Rentalizer Estimate**: Large headline number ($121.3K)
- Comparison text: "a 5.1% above at 22.9%"
- "SAMPLE DATA" badge
- "Rentalizer Estimate History" with Purchase button
- Line chart showing estimate over time

### Key Metrics Row
- Annual Revenue: $53.4K
- Average Daily Rate: $266
- Occupancy Rate: 55%

### Financial Calculator Section
- Rental Revenue input
- Purchase Price input
- Operating Expenses: $16,158
- Net Operating Income: $37,267
- Cap Rate: 13.31%
- "Looking to buy or sell?" CTA
- "Looking for a property manager?" CTA

### Seasonal Revenue Forecast
- Line chart showing monthly revenue
- "SAMPLE DATA" badge
- Purchase button for full access

### Top Comparison Properties
- "12 of 50 comps" indicator
- Property cards with:
  - Thumbnail image
  - Property name
  - Location
  - Key metrics

## Design Principles
1. **Clean & Professional**: Lots of white space, minimal clutter
2. **Data-Forward**: Large, bold numbers for key metrics
3. **Visual Hierarchy**: Clear distinction between primary and secondary info
4. **Actionable**: Clear CTAs, filter options, navigation
5. **Trustworthy**: Professional color palette, clean typography
6. **Responsive Cards**: Grid-based layout that adapts to content

## Recommended Changes for Our App

### Immediate Priorities
1. Update color scheme to match AirDNA's professional palette
2. Add Market Score visualization with sub-metrics
3. Redesign metric cards with sparkline charts
4. Add donut charts for distribution data
5. Implement filter modal with icon buttons
6. Add "Explore Deeper Insights" navigation cards

### Layout Changes
1. Consider adding a collapsible sidebar for navigation
2. Add breadcrumb navigation for location hierarchy
3. Implement horizontal filter tabs
4. Use card-based grid layout for metrics

### Data Visualization
1. Add mini sparkline charts to metric cards
2. Use donut charts for categorical distributions
3. Add segmented horizontal bars for policy data
4. Implement line charts for trends

### Typography Updates
1. Use larger, bolder numbers for key metrics
2. Add small caps labels
3. Implement change indicators (+X%) with color coding
