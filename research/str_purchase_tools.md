# STR Purchase Analysis Tools Research

## Mashvisor (mashvisor.com)

**Target Audience:** Real Estate Investors, Airbnb Hosts, Property Managers, API Developers

### Key Features for Property PURCHASE Analysis:

1. **Market Finder** - Find best rental markets nationwide using:
   - Mashmeter score
   - Rental revenue
   - Cap rate
   - Crime rate

2. **Property Finder** - Search for investment properties with filters:
   - Location (up to 5 cities simultaneously)
   - Budget
   - Rental strategy (STR vs LTR)
   - Property type
   - Size

3. **Investment Property Calculator** - Analyze profitability:
   - ROI calculations
   - Cash flow projections
   - STR vs LTR comparison

4. **Key Metrics Displayed:**
   - Cap rate
   - Cash on cash return
   - Rental income potential
   - Property price
   - Occupancy rate (11% shown in example)
   - Beds/baths

5. **Additional Tools:**
   - Short-term regulations checker
   - Heatmap for neighborhood analysis
   - Migration trends
   - Rental revenue trends

### Differentiator from Arbitrage:
Mashvisor focuses on **buying properties** - showing purchase price, cap rate, cash on cash return, and comparing STR vs LTR strategies for the SAME property.

---

## Next: Research BNBCalc, Rabbu, and other purchase-focused tools


---

## BNBCalc (bnbcalc.com)

**Target Audience:** Investors, Real Estate Agents, Property Managers, Co-Hosts

### Analysis Types (KEY DIFFERENTIATOR):
1. **Buy** - Buy this property and list it on Airbnb
2. **Own** - List a property you already own on Airbnb
3. **Rent** - Rent from landlord and list it on Airbnb (ARBITRAGE)
4. **Co-Host** - Manage this property for the owner

### Key Features for Property PURCHASE Analysis:

1. **Instant Revenue Projections** from Airbnb and Vrbo

2. **40 Comps** - Both short-term AND long-term rental comps with revenues

3. **Financial Summary:**
   - Expenses breakdown
   - Financing details
   - Purchase price input
   - Upfront costs breakdown

4. **Tax Deductions Calculator (UNIQUE):**
   - 100% Bonus Depreciation Schedule Analysis
   - Standard vs Accelerated Depreciation Comparison
   - Section 179 Airbnb Tax Benefits Calculator
   - Overall Tax Savings Projections
   - Adjustable Tax Assumptions & Scenarios
   - Cost Segregation Strategy Recommendations

5. **Lead Generation Tools:**
   - Share link and printout
   - Import links from Zillow or MLS
   - Lead form embed for agents
   - Automated social media content

6. **Multi-Currency Support:**
   - USD, EUR, GBP, CAD, CHF, AUD, NZD, JPY, MXN

### Unique Value Props:
- Tax savings feature (bonus depreciation, cost segregation)
- Real estate agent tools (lead capture, social media automation)
- Zillow/MLS import
- 6,000+ users

---

## Next: Research Rabbu marketplace


---

## Rabbu (rabbu.com)

**Target Audience:** STR Investors looking to BUY properties

### Unique Position: STR-Specific Marketplace
Unlike Zillow (general real estate), Rabbu is built specifically for STR investors.

### Key Features:

1. **Marketplace for STR Properties:**
   - Curated inventory of properties currently operating as STRs
   - Actual income data from real bookings
   - Turnkey Airbnb acquisition opportunities
   - Filter by mountain markets, beach markets, etc.

2. **Airbnb Calculator (Free):**
   - Sales prices
   - Cash-on-cash return
   - Gross yield
   - Potential revenue

3. **Market Finder & Market Data Tools (Free):**
   - Occupancy rates
   - ADR (Average Daily Rate)
   - Returns analysis
   - Live market data

4. **Professional Network:**
   - Connect with trusted agents
   - Connect with STR lenders
   - DSCR loan qualification based on projected rental income

5. **Verified Performance Data:**
   - Historical income data
   - Standardized operational data
   - Property features and amenities analysis

### Key Differentiators:
- FREE access to entire marketplace and tools
- Properties with ACTUAL income data (not projections)
- STR-specific financing connections (DSCR loans)
- Turnkey properties ready to operate

---

## Next: Review SimpleTexting API documentation


---

## SimpleTexting API v2

**API Base URL:** `https://api-app2.simpletexting.com/v2/api/`
**Authentication:** Bearer token in header

### Key Endpoints:

1. **Send a Message (POST /api/messages)**
   - Send SMS or MMS to a contact
   - Required fields: `contactPhone`, `mode`
   - Mode options: `AUTO`, `SINGLE_SMS_STRICTLY`, `MMS_PREFERRED`
   - Can include media items (images) for MMS
   - Supports fallback text if MMS fails

2. **Get all Messages (GET /api/messages)**
   - Retrieve message history
   - Pagination support

3. **Contacts Management:**
   - Create/update contacts
   - Batch operations
   - Contact lists
   - Contact segments
   - Custom fields

4. **Webhooks:**
   - Receive notifications when messages are sent/received
   - Webhook reports

### Example Send SMS Request:
```json
{
  "contactPhone": "1234567890",
  "accountPhone": "8005551234",
  "mode": "MMS_PREFERRED",
  "text": "Hello! How are you?",
  "subject": "Some message from SimpleTexting",
  "fallbackText": "[url=%fallback_link%]",
  "mediaItems": ["https://txt.so/img.jpg", "507f1f77bcf86cd799439011"]
}
```

### Use Cases for Coach Inayah Tool:
1. **Lead follow-up** - Send SMS to leads after they use the calculator
2. **Property alerts** - Notify investors when new properties match criteria
3. **Market updates** - Send weekly market performance summaries
4. **Appointment reminders** - Remind leads of scheduled calls
5. **Report delivery** - Send links to generated reports via SMS

---
