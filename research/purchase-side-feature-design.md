# Purchase-Side Feature Design for Coach Inayah Tool

## Executive Summary

This document outlines the design for purchase-side features to complement the existing rental arbitrage tools. The goal is to serve property investors who are looking to **buy** properties for short-term rental investment, not just analyze existing rentals.

## Current Tool Focus vs. New Direction

| Current Focus (Arbitrage) | New Focus (Purchase) |
|---------------------------|----------------------|
| Analyze existing rentals | Analyze properties for purchase |
| Revenue projections only | Full investment analysis |
| No financing calculations | Mortgage, DSCR, cash purchase |
| No upfront cost analysis | Total cost of ownership |
| No ROI metrics | Cap rate, cash-on-cash, IRR |

## Proposed Feature: Investment Calculator

### User Flow

```
Step 1: Property Search
└── User enters address or selects from market
    └── System pulls AirDNA revenue projections

Step 2: Purchase Details
└── User enters purchase price
└── User selects financing type (Cash/Conventional/DSCR)
└── System calculates mortgage details

Step 3: Cost Analysis
└── System calculates total upfront costs
└── System calculates ongoing monthly costs
└── User can adjust assumptions

Step 4: Investment Returns
└── System calculates all ROI metrics
└── System shows cash flow projections
└── System compares STR vs LTR returns

Step 5: Report Generation
└── Comprehensive investment report
└── Shareable link for clients
└── PDF export option
```

### Input Fields Required

#### Property Information
- **Address** (auto-populated from property search)
- **Purchase Price** (user input)
- **Bedrooms/Bathrooms** (auto-populated or user input)
- **Square Footage** (optional)
- **Property Type** (Single Family, Condo, Townhouse, Multi-family)

#### Financing Options
- **Financing Type**: Cash | Conventional | DSCR | FHA
- **Down Payment %**: Default 20%, adjustable
- **Interest Rate**: Default current market rate, adjustable
- **Loan Term**: 15 or 30 years
- **Points**: Optional

#### Upfront Costs (Defaults with override)
- **Closing Costs**: Default 3% of purchase price
- **Inspection Fee**: Default $500
- **Appraisal Fee**: Default $500
- **Furnishing Budget**: Default $15,000 (adjustable by bedroom count)
- **Initial Supplies**: Default $2,000
- **Professional Photography**: Default $500
- **Renovation Budget**: Default $0 (user adjustable)

#### Ongoing Costs (Monthly, defaults with override)
- **Property Taxes**: Auto-estimate or user input
- **Insurance (STR)**: Default $200/month
- **HOA Fees**: Default $0
- **Utilities**: Default $200/month
- **Property Management**: Default 20% of revenue
- **Cleaning (per turnover)**: Default $150
- **Maintenance Reserve**: Default 5% of revenue
- **Platform Fees**: Default 3% (Airbnb host fee)
- **Supplies/Consumables**: Default $100/month

### Output Metrics

#### Primary Investment Metrics
| Metric | Formula | Description |
|--------|---------|-------------|
| **Cap Rate** | NOI / Purchase Price × 100 | Return if paid cash |
| **Cash-on-Cash Return** | Annual Cash Flow / Total Cash Invested × 100 | Return on actual cash invested |
| **Net Operating Income (NOI)** | Gross Revenue - Operating Expenses | Before debt service |
| **Annual Cash Flow** | NOI - Annual Debt Service | After mortgage payments |
| **Break-even Occupancy** | (Expenses + Debt Service) / (ADR × 365) | Minimum occupancy to break even |

#### Secondary Metrics
| Metric | Formula | Description |
|--------|---------|-------------|
| **DSCR** | NOI / Annual Debt Service | Loan qualification metric |
| **Gross Rent Multiplier** | Purchase Price / Annual Gross Revenue | Quick valuation metric |
| **Payback Period** | Total Cash Invested / Annual Cash Flow | Years to recoup investment |
| **Total Return on Investment** | (Cash Flow + Equity Buildup + Appreciation) / Investment | Comprehensive return |

### Comparison Features

#### STR vs LTR Comparison
Show side-by-side analysis:
- STR projected revenue vs LTR market rent (from Rentometer)
- STR expenses vs LTR expenses
- STR cash flow vs LTR cash flow
- STR cap rate vs LTR cap rate

#### Scenario Comparison
Allow users to compare:
- Different purchase prices
- Different down payment amounts
- Different financing options
- Different occupancy scenarios (conservative/moderate/aggressive)

### Report Output

#### Investment Summary Card
```
┌─────────────────────────────────────────────────────┐
│  INVESTMENT ANALYSIS: 123 Main St, Dallas, TX       │
├─────────────────────────────────────────────────────┤
│  Purchase Price:        $350,000                    │
│  Down Payment (20%):    $70,000                     │
│  Total Cash Needed:     $95,000                     │
├─────────────────────────────────────────────────────┤
│  Projected Annual Revenue:    $48,000               │
│  Projected Annual Expenses:   $24,000               │
│  Annual Cash Flow:            $12,000               │
├─────────────────────────────────────────────────────┤
│  Cap Rate:              6.9%                        │
│  Cash-on-Cash Return:   12.6%                       │
│  DSCR:                  1.35                        │
│  Break-even Occupancy:  52%                         │
└─────────────────────────────────────────────────────┘
```

#### Monthly Cash Flow Projection
Show 12-month projection with seasonality from AirDNA data:
- Monthly revenue (with seasonality)
- Monthly expenses
- Monthly mortgage payment
- Monthly cash flow

#### 5-Year Projection
- Cumulative cash flow
- Equity buildup
- Estimated appreciation (3% default)
- Total return

## Integration with Existing Tool

### Where to Add in Current Flow

**Option A: New Step in Lead Magnet**
- Add as Step 9 or 10 after market analysis
- "Ready to buy? Analyze your investment"

**Option B: Separate Tool**
- New entry point from homepage
- "Investment Calculator" alongside "Revenue Calculator"

**Option C: Integrated Toggle**
- Add "Analysis Type" toggle on Step 1
- "Rental Arbitrage" vs "Property Purchase"

### Recommended Approach: Option B

Create a separate "Investment Calculator" tool that:
1. Shares the same design language and branding
2. Uses the same AirDNA data integration
3. Has its own dedicated flow optimized for buyers
4. Can be accessed from the main navigation

## Technical Implementation

### New API Endpoints Needed

```typescript
// Investment calculation endpoint
POST /api/trpc/investment.calculate
Input: {
  address: string
  purchasePrice: number
  financingType: 'cash' | 'conventional' | 'dscr' | 'fha'
  downPaymentPercent: number
  interestRate: number
  loanTerm: number
  // ... other inputs
}
Output: {
  metrics: {
    capRate: number
    cashOnCash: number
    noi: number
    annualCashFlow: number
    breakEvenOccupancy: number
    dscr: number
    paybackPeriod: number
  }
  monthlyProjection: MonthlyData[]
  fiveYearProjection: YearlyData[]
}
```

### Database Schema Additions

```sql
-- Investment analyses table
CREATE TABLE investment_analyses (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  lead_id VARCHAR(36),
  address TEXT,
  purchase_price DECIMAL(12,2),
  financing_type VARCHAR(20),
  down_payment_percent DECIMAL(5,2),
  interest_rate DECIMAL(5,3),
  loan_term INT,
  projected_revenue DECIMAL(12,2),
  cap_rate DECIMAL(5,2),
  cash_on_cash DECIMAL(5,2),
  annual_cash_flow DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
```

## UI/UX Design Principles

### For Beginner Investors
- Clear explanations for every metric (tooltips)
- "What does this mean?" expandable sections
- Conservative default assumptions
- Warning indicators for risky investments

### Visual Design
- Match existing Coach Inayah branding
- Gold/Navy color scheme
- Clean, professional layout
- Mobile-responsive

### Key UI Components
1. **Input Sliders** - For adjustable percentages
2. **Metric Cards** - Large, clear display of key numbers
3. **Comparison Tables** - Side-by-side analysis
4. **Charts** - Monthly cash flow, 5-year projection
5. **Share Button** - Generate shareable report link

## Priority Implementation Order

### Phase 1: Core Calculator (MVP)
- Purchase price input
- Basic financing (conventional mortgage)
- Cap rate and cash-on-cash calculation
- Simple report output

### Phase 2: Enhanced Analysis
- DSCR loan option
- Full cost breakdown
- Monthly projection with seasonality
- STR vs LTR comparison

### Phase 3: Advanced Features
- 5-year projection
- Tax benefits calculator
- Scenario comparison
- PDF export

## Success Metrics

- **Lead Conversion**: Track how many users who use the investment calculator become leads
- **Engagement**: Time spent on calculator, number of scenarios run
- **Sharing**: Number of reports shared with clients
- **Feedback**: User satisfaction with report quality

## Conclusion

The purchase-side investment calculator will position Coach Inayah's tool as a comprehensive solution for both rental arbitrage AND property purchase analysis. This differentiates from competitors who focus on one or the other, and provides maximum value to the target audience of beginner real estate investors.
