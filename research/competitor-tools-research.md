# Competitor Tools Research - Short-Term Rental Investment Analysis

## Date: January 31, 2026

## Key Competitor Tools Identified

### 1. Rabbu (https://rabbu.com)
**Focus:** Full-service Airbnb investment platform
**Key Features:**
- Market Finder tool - identifies top ROI markets with 20+ active Airbnbs
- Turnkey Airbnb properties for sale with actual performance history
- Properties with STR potential (conversion opportunities)
- Built-in Airbnb Calculator with comparable analysis
- STR-specialized DSCR lenders connection
- Market Data tool with seasonality patterns
- Agent network for STR transactions

**Unique Value:**
- Combines exclusive listings with historical income data
- DSCR loan connections (qualify based on property income, not W-2)
- One integrated workflow from research to closed deals

### 2. AirDNA (https://airdna.co)
**Focus:** Data analytics for short-term rentals
**Key Features:**
- Airbnb Calculator - revenue projections
- Market analysis tools
- Nightly rate optimization data
- Occupancy rate tracking
- Historical performance data

### 3. Mashvisor (https://mashvisor.com)
**Focus:** Real estate investing and Airbnb property management
**Key Features:**
- Beginner-friendly tools
- Property management features
- Investment analysis

### 4. DealCheck
**Focus:** Speed and versatility in real estate analysis
**Key Features:**
- Quick property analysis
- Multiple property types supported
- ROI calculations

### 5. BNBCalc.com
**Focus:** Data-scraping reports for STR and LTR
**Key Features:**
- Short-term rental projections
- Long-term rental comparisons
- Free trial available

### 6. Chalet (https://getchalet.com)
**Focus:** Airbnb calculator accuracy
**Key Features:**
- Tested against real PM statements
- Comparison with AirDNA, Rabbu, Airbtics

### 7. Beyond Pricing (https://beyondpricing.com)
**Focus:** Dynamic pricing optimization
**Key Features:**
- Revenue optimization
- Market data integration
- Trusted by major platforms

### 8. Revedy (https://revedy.com)
**Focus:** Simplified STR investing
**Key Features:**
- Free profit check on properties
- Expert insights
- Powerful tools

### 9. Airbtics (https://airbtics.com)
**Focus:** Comparative market analysis
**Key Features:**
- Supply/demand data
- Revenue estimates
- Trend monitoring

### 10. AllTheRooms
**Focus:** Vacation rental market health
**Key Features:**
- Supply/demand data
- Revenue estimates
- Trend monitoring

## Key Features Investors Want (Must-Have)

### Location-Specific Demand Data
- Seasonal booking patterns (year-round vs. concentrated summer)
- Local competition density (listings per square mile)
- Key metrics to evaluate:
  - Occupancy by season (High: 75-90%, Shoulder: 50-65%, Low: 30-45%)
  - RevPAR trends (revenue per available room)
  - New supply velocity (competition growing or declining)
  - Booking windows (90+ day lead times vs. last-minute)
  - Regulation constraints (permit caps, minimum night requirements)

### Revenue Forecast Accuracy
- Historical performance data from comparable properties
- Verified ADR (Average Daily Rate) projections
- Difference between turnkey (verified income) vs. conversion (projected)

### Financing and Deal Analyzer
- STR-specific expense calculators (30-40% higher than LTR)
- DSCR loan integration (qualify on property income)
- Cash-on-cash return calculations

### Dynamic Pricing Integration
- Automated rate adjustments
- Competitor pricing analysis
- Occupancy vs. ADR optimization

## Purchase-Side Features (What's Missing in Current Tools)

Most tools focus on:
1. Rental arbitrage (analyzing existing rentals)
2. Market research (where to invest)
3. Revenue projections (how much you'll make)

**Gap for Property BUYERS:**
- Purchase price analysis
- Mortgage/DSCR loan calculations
- Cap rate calculations
- Cash-on-cash return
- Break-even analysis
- Property appreciation projections
- Total cost of ownership (closing costs, renovations, furnishing)
- Exit strategy analysis (sell vs. hold)

## Sources
- https://rabbu.com/blog/best-tools-for-airbnb-investors-essential-platforms-software
- https://www.airdna.co/
- https://www.mashvisor.com/
- https://www.getchalet.com/blog/the-best-airbnb-calculator
- https://www.techvestor.com/blog/best-airbnb-analyzer-investors


---

## SimpleTexting API Research

### Overview
SimpleTexting provides an SMS/MMS messaging API for businesses to communicate with their audience via text message.

### API Version: 2.0.0
Base URL: `https://api-app2.simpletexting.com/v2/api/`

### Authentication
- Bearer token in header
- API token found under Settings in SimpleTexting account
- Approval-only access (need to sign up for trial account)

### Key Endpoints

#### Messages
- **GET /api/messages** - Retrieve all messages sent to/from a specific contact
- **POST /api/messages** - Send a Message (SMS or MMS)
- **POST /api/messages/evaluate** - Evaluate a Message before sending
- **GET /api/messages/{id}** - Get a specific Message

#### Send a Message Parameters
```json
{
  "contactPhone": "1234567890",  // Required - recipient phone
  "accountPhone": "8005551234",  // Optional - sender phone (defaults to primary)
  "mode": "AUTO" | "SINGLE_SMS_STRICTLY" | "MMS_PREFERRED",
  "text": "Hello! How are you?",
  "subject": "Some message from SimpleTexting",
  "fallbackText": "[url=%fallback_link%]",
  "mediaItems": ["https://txt.so/img.jpg", "507f1f77bcf86cd799439011"]
}
```

#### Mode Options
- **AUTO**: SimpleTexting finds the best format for message content
- **SINGLE_SMS_STRICTLY**: Only sends as single SMS or returns error
- **MMS_PREFERRED**: Sends as MMS or fallback SMS

#### Campaigns
- **GET /api/campaigns** - List all campaigns
- **POST /api/campaigns** - Create a campaign
- **GET /api/campaigns/{id}** - Get campaign details
- **PUT /api/campaigns/{id}** - Update campaign
- **DELETE /api/campaigns/{id}** - Delete campaign

#### Contacts
- **GET /api/contacts** - List contacts
- **POST /api/contacts** - Create contact
- **GET /api/contacts/{id}** - Get contact
- **PUT /api/contacts/{id}** - Update contact
- **DELETE /api/contacts/{id}** - Delete contact

#### Contact Lists
- Manage subscriber lists
- Batch operations for bulk imports

#### Webhooks
- Receive notifications when messages are sent/received
- Webhook reports for delivery status

### Potential Use Cases for Coach Inayah Tool
1. **Lead Capture Follow-up**: Send SMS to leads after they use the calculator
2. **Report Delivery**: Send SMS with link to their property analysis report
3. **Appointment Reminders**: Remind leads about scheduled consultations
4. **Marketing Campaigns**: Send promotional messages to subscriber lists
5. **Two-Way Communication**: Receive and respond to lead inquiries

### Integration Considerations
- Need SimpleTexting account with API access
- Requires phone number verification
- Message costs apply per SMS/MMS
- Compliance with TCPA and SMS marketing regulations required
- Need opt-in consent from recipients

### Source
https://simpletexting.com/api/docs/v2/



---

## BNBCalc - Purchase-Side Analysis Features (Key Competitor)

### Overview
BNBCalc is specifically designed for property PURCHASE analysis, not just rental arbitrage. This is exactly what Coach Inayah needs for the investor side.

### Analysis Types Offered
1. **Buy** - Buy this property and list it on Airbnb (PURCHASE-FOCUSED)
2. **Own** - List a property you already own on Airbnb
3. **Rent** - Rent from landlord and list on Airbnb (Arbitrage)
4. **Cohost** - Manage property for the owner

### Key Purchase Analysis Features
- **Purchase Price Input** - Core to the analysis
- **Instant revenue projections** from Airbnb and Vrbo
- **40 short term and long term comps** with revenues
- **Financial summary** with expenses and financing
- **Estimated tax deductions** (huge selling point!)
- **Share link and printout** for clients
- **Import links from Zillow or MLS**

### Tax Features (Major Differentiator)
- 100% Bonus Depreciation Schedule Analysis
- Standard vs Accelerated Depreciation Comparison
- Section 179 Airbnb Tax Benefits Calculator
- Overall Tax Savings Projections
- Adjustable Tax Assumptions & Scenarios
- Cost Segregation Strategy Recommendations

### Upfront Costs Breakdown
- Detailed breakdown of upfront costs for property purchase
- Financing calculations
- Setup costs

### Target Users
- Investors (6,000+ users)
- Property managers
- Cohosts
- Real estate agents

### Free Tools Offered
- Amortization Calculator
- DSCR Calculator
- Section 8 / FMR Map
- Tax Calculator

### Lead Generation Features
- Share links that generate leads
- Automated social media content
- Lead form embed for agents

### Source
https://www.bnbcalc.com/

---

## Purchase-Side Features to Build for Coach Inayah Tool

Based on competitor analysis, here are the key features needed for property BUYERS:

### 1. Purchase Price Analysis Module
**Input Fields:**
- Purchase price
- Down payment percentage
- Loan type (Conventional, DSCR, FHA)
- Interest rate
- Loan term
- Closing costs estimate

**Output Metrics:**
- Monthly mortgage payment
- Total cash needed to close
- Cash-on-cash return
- Cap rate
- Break-even occupancy rate

### 2. Investment Returns Calculator
**Key Metrics:**
- Annual cash flow (revenue - expenses - mortgage)
- Cash-on-cash return (annual cash flow / total cash invested)
- Cap rate (NOI / purchase price)
- ROI (total return / total investment)
- IRR (internal rate of return)
- Payback period

### 3. Total Cost of Ownership
**Upfront Costs:**
- Down payment
- Closing costs (2-5% of purchase price)
- Inspection fees
- Appraisal fees
- Furnishing costs (for STR)
- Initial supplies and setup

**Ongoing Costs:**
- Mortgage payment
- Property taxes
- Insurance (STR-specific)
- HOA fees
- Utilities
- Property management (if applicable)
- Maintenance reserve
- Cleaning costs
- Platform fees (Airbnb/VRBO)

### 4. Tax Benefits Analysis
**Key Features:**
- Depreciation schedule
- Bonus depreciation calculator
- Cost segregation benefits
- Tax savings projections
- Deductible expenses summary

### 5. Scenario Comparison
**Compare:**
- STR vs LTR returns
- Different purchase prices
- Different down payment amounts
- Different financing options
- Different occupancy scenarios

### 6. Exit Strategy Analysis
**Metrics:**
- Property appreciation projections
- Equity buildup over time
- Refinance scenarios
- Sell vs hold analysis

### 7. DSCR Loan Calculator
**For Investors:**
- Debt Service Coverage Ratio calculation
- Loan qualification estimate
- Maximum loan amount based on projected income



---

## The Short Term Shop - Cash Flow Calculator

### Overview
Real estate brokerage focused on STR properties with built-in cash flow calculator for investors.

### Key Evaluation Metrics
1. **Cap Rate** - Net Operating Income / Purchase Price × 100%
   - Example: ($12,400 / $200,000) × 100% = 6.1%
   - Used when investor pays cash for property

2. **Cash on Cash Return** - Annual Cash Flow / Total Cash Invested × 100%
   - Example: ($3,600 / $42,000) × 100% = 8.6%
   - Used when investor takes out mortgage
   - Accounts for down payment + closing costs

3. **Net Annual Cash Flow** - Rental Income - Operating Expenses - Mortgage

### Calculator Features
- Adjustable occupancy rate
- Adjustable capex amount
- Adjustable maintenance fees
- Conservative vs aggressive analysis options

### Key Formulas Explained

**Cap Rate Calculation:**
- Purchase price: $200,000
- Monthly rent: $1,200
- Yearly cash flow: $14,400
- Subtract expenses (~$2,000): $12,400
- Cap Rate = $12,400 / $200,000 = 6.1%

**Cash on Cash Return:**
- Purchase price: $200,000
- Down payment (20%): $40,000
- Closing costs: $2,000
- Total cash invested: $42,000
- Monthly mortgage: $700
- Monthly rent: $1,000
- Annual cash flow: $3,600
- Cash on Cash = $3,600 / $42,000 = 8.6%

### Source
https://theshorttermshop.com/cash-flow-calculator/



---

## AirDNA Rentalizer - Enhanced Financial Calculator

### Overview
AirDNA's Rentalizer is described as "the world's #1 short-term rental calculator" with enhanced financial analysis features.

### New Rentalizer Workflow (5 Steps)
1. **Enter your address** - Analyze any address worldwide
2. **Review your confidence score** - Trust level based on comp data quality
3. **Customize your comp set** - Use AI-generated or build your own
4. **Adjust your financial inputs** - Fine-tune operating costs and startup expenses
5. **Save and track over time** - Monitor market conditions with savable reports

### Key Projections Provided
- Annual revenue
- Average Daily Rate (ADR)
- Occupancy rate
- Seasonality's impact on profits
- Competitive analysis of nearby rentals

### Financial Calculator Features
- **Operating costs** - Adjustable for true ROI
- **Startup expenses** - Initial investment calculation
- **True ROI potential** - Based on customized inputs

### Target Users
- First-time hosts
- Second-home owners
- Investors and property managers
- Real estate agents
- Arbitrage investors

### Confidence Score Feature
- Measures projection accuracy
- Based on quality of comparable property data
- Can be increased by creating custom comps

### Source
https://www.airdna.co/airbnb-calculator

---

## Summary: Key Features for Purchase-Side Tool

Based on all competitor research, here's the comprehensive feature set needed:

### Tier 1: Essential Purchase Analysis
| Feature | Description | Priority |
|---------|-------------|----------|
| Purchase Price Input | Core input for all calculations | Critical |
| Down Payment Calculator | Calculate cash needed | Critical |
| Mortgage Payment | Monthly P&I calculation | Critical |
| Cash-on-Cash Return | Annual cash flow / cash invested | Critical |
| Cap Rate | NOI / Purchase Price | Critical |
| Break-even Occupancy | Minimum occupancy to cover costs | High |

### Tier 2: Advanced Financial Analysis
| Feature | Description | Priority |
|---------|-------------|----------|
| DSCR Calculator | Debt Service Coverage Ratio | High |
| Total Cost of Ownership | All upfront + ongoing costs | High |
| IRR Calculator | Internal Rate of Return | Medium |
| Payback Period | Time to recoup investment | Medium |
| Equity Buildup | Loan paydown over time | Medium |

### Tier 3: Tax & Exit Strategy
| Feature | Description | Priority |
|---------|-------------|----------|
| Depreciation Schedule | Standard 27.5 year | Medium |
| Bonus Depreciation | 100% first-year deduction | Medium |
| Cost Segregation | Accelerated depreciation | Low |
| Exit Strategy Analysis | Sell vs Hold comparison | Low |

### Tier 4: Comparison Tools
| Feature | Description | Priority |
|---------|-------------|----------|
| STR vs LTR Comparison | Side-by-side returns | High |
| Scenario Comparison | Different purchase prices | Medium |
| Financing Comparison | Cash vs Mortgage vs DSCR | Medium |

