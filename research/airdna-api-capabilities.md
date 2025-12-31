# AirDNA API Capabilities Research

Source: https://apidocs.airdna.co/

## Available API Endpoints

### Property Valuations
1. **Rentalizer** - Annual and Monthly Revenue, ADR, and Occupancy projections with up to 10 comparable properties
2. **Rentalizer Summary** - Annual Revenue, ADR and Occupancy projection (lighter version)
3. **Rentalizer Redirect** - Redirect user to MarketMinder Rentalizer tab

### Listing Data
1. **Comparable Properties** - Property attributes and rental performance for up to 25 competing Airbnb listings
2. **Available** - Properties available during a given time period
3. **Single Property** - Property attributes and rental performance for a single Airbnb listing

### Market Data
1. **Market Summary** - Overview of market statistics for last calendar month
2. **Future Daily** - Daily rental supply and rates for next 6 months (refreshed daily)
3. **Active Listings** - Historical number of active listings by year/month
4. **Occupancy** - Historical occupancy rates by bedroom count, month, year
5. **ADR** - Historical Average Daily Rates by bedroom count, month, year
6. **RevPAR** - Historical Revenue Per Available Room by bedroom count, month, year
7. **Revenue** - Historical Revenue by bedroom count, month, year

### Property Availability
- **Property Availability** - Return availability and estimated price of a single property

### Smart Rates
- **Smart Rates** - Manage smart rates for a property

## Features We're Currently Using
- Rentalizer (property valuations)
- Comparable Properties
- Market Summary
- Some historical data

## Features We're NOT Using (Opportunities)
1. **Future Daily** - Could show 6-month forward-looking supply/demand
2. **Property Availability** - Could show real-time availability of comps
3. **Smart Rates** - Could provide pricing recommendations
4. **Available Properties** - Could show what's bookable in a date range
5. **Single Property Deep Dive** - Could get more details on specific competitors

## Detailed Market Data Endpoints (NOT Currently Using)

### Future Daily - /market/availability/daily
**HUGE OPPORTUNITY** - Real-time, future-looking (up to 6 months) Supply and Demand data
- Daily future supply numbers (count of properties available for rent each day)
- Corresponding rates for those days (ADR as well as ADR percentiles)
- Parameters: city_id, region_id, number_of_months, room_types, bedrooms, accommodates, currency, start_year, start_month

### Monthly Listing Counts - /market/supply/active
- Historical number of active listings by year/month

### Monthly Occupancy - /market/occupancy/monthly
- Historical occupancy rates by bedroom count, month, year

### Monthly ADR - /market/pricing/monthly
- Historical ADR by bedroom count, month, year

### Monthly RevPAR - /market/demand/revpar/monthly
- Historical RevPAR by bedroom count, month, year

### Monthly Revenue - /market/revenue/monthly
- Historical revenue by bedroom count, month, year

### Market Summary - /market/summary
- Overview of market statistics

## Key Data Points in Rentalizer Response We May Not Be Using

1. **property_value** - Estimated property value ($2,414,000 in example)
2. **historical_valuation** - Month-over-month and year-over-year % changes
3. **revenue_range** - Upper and lower bounds for revenue estimates
4. **mom_perc_chg** - Month-over-month percentage change
5. **yoy_perc_chg** - Year-over-year percentage change (19.07% in example)
6. **distance_meters** - Distance from subject property to each comp (WE HAVE THIS!)
7. **platforms** - Shows both airbnb_property_id AND vrbo_property_id
8. **rating** - Guest rating (1-10 scale)
9. **reviews** - Number of reviews

## Super App Feature Ideas from API

1. **6-Month Forward Forecast** - Use Future Daily to show upcoming supply/demand
2. **Property Value Integration** - Show estimated property value and ROI calculations
3. **Historical Trend Analysis** - Use mom_perc_chg and yoy_perc_chg for growth trends
4. **Revenue Confidence Bands** - Show upper/lower revenue ranges
5. **Distance to Competition** - Already have distance_meters, just need to display it
6. **Multi-Platform Analysis** - Show if comps are on both Airbnb AND Vrbo

## Next Steps
- Research user pain points with existing STR tools
- Research Gemini AI opportunities
