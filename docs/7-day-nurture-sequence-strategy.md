# 7-Day Webinar Nurture Email Sequence

## Overview

This sequence is designed to increase webinar show-up rate by sending personalized, relevant content to registrants based on their target market (stored in `data_perfection_city` and `data_perfection_state` HubSpot properties).

## Trigger

- **When:** Contact opts into Webby flow (webinar registration)
- **Data Source:** `data_perfection_city` and `data_perfection_state` properties

## Content Strategy

Each email uses REAL data from AirDNA for the contact's specific city/state. The variety keeps engagement high while building excitement for the webinar.

---

## Day 1: Welcome + Market Snapshot

**Subject Line Options:**
- `Welcome {{ contact.firstname }}! Here's what [City] looks like for STR right now 📊`
- `{{ contact.firstname }}, I pulled the numbers on [City] for you`

**Content Focus:**
- Welcome to the webinar journey
- High-level market snapshot for their city
- Key metrics: Average revenue, occupancy rate, ADR
- Tease: "Over the next 7 days, I'm going to show you exactly why [City] is a great market for rental arbitrage"

**Data Needed:**
- Average annual revenue
- Average occupancy rate
- Average ADR
- Number of active listings

**CTA:** "See you Sunday! In the meantime, here's what top performers in [City] are earning..."

---

## Day 2: Regulation Update

**Subject Line Options:**
- `{{ contact.firstname }}, here's what you need to know about STR rules in [City]`
- `Before you start in [City], read this 👀`

**Content Focus:**
- STR regulations for their city/state
- Permit requirements (if any)
- Zoning considerations
- How arbitrage works around ownership restrictions
- "This is exactly what we cover in Sunday's masterclass"

**Data Needed:**
- Regulation status (permitted, restricted, banned)
- Permit requirements
- Any recent regulation changes
- Arbitrage-friendly notes

**CTA:** "Want to know how to navigate these rules? That's exactly what we cover Sunday..."

---

## Day 3: Deal Alert

**Subject Line Options:**
- `{{ contact.firstname }}, I found this deal in [City] for you 🏠`
- `This [City] property caught my attention...`

**Content Focus:**
- Specific property opportunity in their market
- Revenue projection
- Profit potential
- Why this deal works for arbitrage

**Data Needed:**
- Property address
- Bedrooms/bathrooms
- Monthly revenue estimate
- Monthly rent estimate
- Monthly profit potential
- Occupancy rate
- ADR

**CTA:** Link to Turnkey Tool analysis page

---

## Day 4: Market Deep Dive

**Subject Line Options:**
- `The [City] STR market - here's the real data 📈`
- `{{ contact.firstname }}, let's talk about [City]'s numbers`

**Content Focus:**
- Detailed market analysis
- Revenue trends (up/down/stable)
- Seasonality patterns
- Best performing property types
- Revenue by bedroom count

**Data Needed:**
- 12-month revenue trend
- Seasonality chart data
- Top property types
- Revenue by bedroom (1BR, 2BR, 3BR, etc.)
- Year-over-year growth

**CTA:** "This is the kind of analysis we do for every market. Sunday I'll show you how to find these opportunities yourself..."

---

## Day 5: New Listings Alert

**Subject Line Options:**
- `X new properties just hit [City] this week 🆕`
- `{{ contact.firstname }}, fresh listings in [City]`

**Content Focus:**
- New rental listings in their market
- Quick profit analysis for each
- "These are the kinds of opportunities we help you find"

**Data Needed:**
- Recent rental listings (from Zillow/Apartments.com)
- Basic profit projections for each
- Property details

**CTA:** "Want us to analyze these for you? That's what we do in the Turnkey Program..."

---

## Day 6: Competitor Analysis

**Subject Line Options:**
- `Here's what top performers in [City] are doing 🏆`
- `{{ contact.firstname }}, learn from [City]'s best hosts`

**Content Focus:**
- Top 3-5 performing properties in their market
- What makes them successful
- Pricing strategies
- Amenities that matter
- Reviews and ratings

**Data Needed:**
- Top performers by revenue
- Their ADR and occupancy
- Property features
- Review highlights

**CTA:** "These are your future competitors. Sunday I'll show you how to beat them..."

---

## Day 7: Webinar Reminder + Opportunity Summary

**Subject Line Options:**
- `See you tomorrow {{ contact.firstname }}! Here's your [City] opportunity summary`
- `Tomorrow's the day! Here's why [City] is ready for you 🎯`

**Content Focus:**
- Webinar reminder with time/link
- Summary of everything they learned this week
- Best opportunity from the week
- "This is just the beginning"

**Data Needed:**
- Best deal from the week
- Market summary stats
- Webinar details

**CTA:** "See you Sunday at [TIME]! Click here to add to your calendar..."

---

## HubSpot Properties Needed

### Existing Properties to Use:
- `data_perfection_city` - Contact's target city
- `data_perfection_state` - Contact's target state

### New Properties to Create:

**Market Data Properties:**
- `nurture_market_avg_revenue` - Average annual revenue for their market
- `nurture_market_avg_occupancy` - Average occupancy rate
- `nurture_market_avg_adr` - Average daily rate
- `nurture_market_listing_count` - Number of active listings
- `nurture_market_revenue_trend` - Up/Down/Stable
- `nurture_market_top_property_type` - Most common property type

**Regulation Properties:**
- `nurture_regulation_status` - Permitted/Restricted/Banned
- `nurture_regulation_notes` - Key regulation details

**Deal Properties:**
- `nurture_deal_address` - Featured deal address
- `nurture_deal_revenue` - Monthly revenue estimate
- `nurture_deal_profit` - Monthly profit estimate
- `nurture_deal_url` - Link to Turnkey Tool analysis

**Competitor Properties:**
- `nurture_top_performer_1_title` - Top performer name
- `nurture_top_performer_1_revenue` - Top performer revenue
- `nurture_top_performer_1_occupancy` - Top performer occupancy

---

## Data Pipeline

### Trigger: Webby Flow Opt-In

1. **Capture city/state** from registration form
2. **Call AirDNA API** to get market data for their city
3. **Store data** in HubSpot contact properties
4. **Trigger workflow** to start 7-day sequence

### Daily Data Refresh (Optional)

For deals and new listings, we may want to refresh data daily to ensure freshness.

---

## Workflow Timing

| Day | Email | Delay |
|-----|-------|-------|
| Day 1 | Welcome + Market Snapshot | Immediate (on opt-in) |
| Day 2 | Regulation Update | 24 hours |
| Day 3 | Deal Alert | 24 hours |
| Day 4 | Market Deep Dive | 24 hours |
| Day 5 | New Listings Alert | 24 hours |
| Day 6 | Competitor Analysis | 24 hours |
| Day 7 | Webinar Reminder | 24 hours |

---

## Success Metrics

- **Open Rate:** Target 40%+ (personalized content should drive higher opens)
- **Click Rate:** Target 15%+ (relevant deals should drive clicks)
- **Show-Up Rate:** Target 50%+ (engaged leads more likely to attend)
- **Conversion Rate:** Track from email engagement to webinar attendance to sale

---

## Brand Voice

All emails should:
- Use simple, direct language (5th grade reading level)
- Feel personal and warm (Coach Inayah talking to a friend)
- Create excitement about opportunities in THEIR market
- Build anticipation for Sunday's masterclass
- Include real data and real opportunities
- Link to Turnkey Tool for property analysis
