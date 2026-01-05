# Lead Magnet Rebuild Plan

## Current State Analysis

The current Rental Calculator has grown complex with multiple features:

- AI Investment Advisor chat

- Deep Analysis with 6 AI-generated sections

- Market comparison tools

- Submarket exploration

- Saved searches

- Multiple report types (property vs market)

**Problem:** Too many options overwhelm beginners. The tool tries to do everything instead of one thing well.

---

## Lead Magnet Strategy

### Goal

Convert curious property investors into qualified leads by answering ONE question:

> **"Will this rental property make money?"**

### Target User

- First-time Airbnb arbitrage investor

- Has found a property on Zillow/Apartments.com

- Knows the monthly rent

- Wants a quick answer: Yes or No?

---

## Simplified User Flow

### Step 1: Homepage (5 seconds)

**User sees:**

- Bold headline: "Will This Property Make Money on Airbnb?"

- Subheadline: "Find out in 30 seconds. Free."

- Two inputs only:
    1. Property address (with autocomplete)
    1. Monthly rent ($)

- One button: "Analyze This Property"

**No distractions:** No navigation menu, no feature links, no explanations.

### Step 2: Loading (10-15 seconds)

**User sees:**

- Simple progress indicator

- "Analyzing your property..."

- Brief educational tips while waiting (optional)

### Step 3: Quick Results (The Hook)

**User sees THREE numbers only:**

```
┌─────────────────────────────────────────────┐
│                                             │
│   ✅ THIS PROPERTY LOOKS PROFITABLE         │
│                                             │
│   Projected Revenue    $98,770/year         │
│   Your Rent Cost       $21,600/year         │
│   Estimated Profit     $71,410/year         │
│                                             │
│   "Properties like this earn 4.5x their     │
│    rent in this market."                    │
│                                             │
└─────────────────────────────────────────────┘
```

OR if not profitable:

```
┌─────────────────────────────────────────────┐
│                                             │
│   ⚠️ THIS PROPERTY MAY BE RISKY            │
│                                             │
│   Projected Revenue    $28,000/year         │
│   Your Rent Cost       $24,000/year         │
│   Estimated Profit     $4,000/year          │
│                                             │
│   "The profit margin is thin. Most          │
│    successful hosts earn 2x+ their rent."   │
│                                             │
└─────────────────────────────────────────────┘
```

### Step 4: Lead Capture Gate

**User sees:**

- "Want the full breakdown?"

- Preview of what's in the full report:
  - ✓ Top 10 competitors in your area
  - ✓ Best months to maximize bookings
  - ✓ What successful hosts do differently
  - ✓ Startup costs breakdown

- Email input field

- Button: "Send Me the Free Report"

### Step 5: Full Report (Email Delivered or Unlocked)

**User gets access to:**

- Detailed competitor analysis

- Seasonality chart

- Market context

- Startup costs

- Risk factors

- CTA: "Ready to get started? Let us set up your Airbnb for you."

---

## Technical Implementation

- x

### What We Remove/Hide

- AI Advisor chat

- Deep Analysis page

- Market comparison

- Submarket exploration

- Saved searches

- Complex navigation

### What We Simplify

- Homepage: 2 inputs instead of 4

- Results: 3 numbers instead of 20+ data points

- Report: Gated behind email, not shown upfront

---

## UI Design Principles

1. **One Action Per Screen**
  - Homepage: Enter property
  - Results: See verdict
  - Gate: Enter email
  - Report: Schedule call

1. **No Jargon**
  - "Revenue" not "ADR"
  - "Profit" not "ROI"
  - "Similar properties" not "Comparables"

1. **Visual Clarity**
  - Green = Good (profitable)
  - Red = Bad (not profitable)
  - Yellow = Caution (marginal)

1. **Mobile-First**
  - Large touch targets
  - Minimal scrolling
  - Fast loading

---

## Success Metrics

1. **Conversion Rate:** % of visitors who enter an address

1. **Email Capture Rate:** % of results viewers who provide email

1. **Lead Quality:** % of leads who schedule a call

1. **Time to Value:** Seconds from landing to seeing results

---

## Implementation Phases

### Phase 1: Strip Down (Day 1)

- Remove navigation links

- Hide complex features

- Simplify homepage to 2 inputs

### Phase 2: Results Redesign (Day 1-2)

- Create new simple results component

- Show only 3 key numbers

- Add clear verdict (Go/No-Go)

### Phase 3: Lead Gate (Day 2)

- Add email capture modal after results

- Gate detailed report behind email

- Store leads in database

### Phase 4: Polish (Day 2-3)

- Mobile optimization

- Loading states

- Error handling

- Thank you page

---

## Questions to Resolve

1. **Auto-detect bedrooms?**
  - Option A: Ask user (adds friction)
  - Option B: Use API default (less accurate)
  - Recommendation: Ask, but make it optional with smart default

1. **Show competitors on free tier?**
  - Option A: Hide completely (stronger gate)
  - Option B: Show 2-3 teaser (builds trust)
  - Recommendation: Show 2-3 blurred/teaser

1. **Immediate email or delayed?**
  - Option A: Gate results behind email (aggressive)
  - Option B: Show results, gate report (balanced)
  - Recommendation: Option B - show quick verdict, gate details

---

## Next Steps

1. Review this plan with stakeholder

1. Confirm design direction

1. Begin Phase 1 implementation

