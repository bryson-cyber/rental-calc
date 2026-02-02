/**
 * Knowledge Base for Custom AI Assistant
 * 
 * This contains Coach Inayah's methodology, tool documentation,
 * and rental investment expertise that the AI uses to answer questions.
 */

export const COACH_INAYAH_METHODOLOGY = `
# Coach Inayah's Airbnb Arbitrage Methodology

## What is Airbnb Arbitrage?
Airbnb arbitrage is a real estate investment strategy where you lease a property long-term (typically 12 months) and then rent it out short-term on platforms like Airbnb and VRBO. The profit comes from the difference between your monthly lease payment and your short-term rental income.

## The 5-Step Analysis Process

### Step 1: Check Regulations First
Before investing time in any market, verify that short-term rentals are legally allowed. Many cities have restrictions or outright bans. Key things to check:
- Is a permit required? What's the cost?
- Are there zoning restrictions?
- What taxes must be collected?
- Are there occupancy limits?

### Step 2: Prove the Market
Look at real revenue data from actual Airbnb hosts in your target market. You want to see:
- Average annual revenue for your property type
- Occupancy rates (aim for 65%+ average)
- Average daily rates (ADR)
- Seasonal trends

### Step 3: Find Properties
Search for rental listings that could work for arbitrage. Look for:
- Properties in STR-friendly zones
- Rent under $2,000/month for best margins
- 2-3 bedrooms (sweet spot for most markets)
- Good location near attractions/downtown

### Step 4: Validate the Deal
Run the numbers on specific properties. A good deal should have:
- Projected profit margin of 30%+ after all expenses
- Break-even occupancy under 50%
- Revenue at least 2x the monthly rent
- Positive cash flow even in slow months

### Step 5: Compare and Decide
Compare your top property options side-by-side. Consider:
- Total profit potential
- Risk factors (location, competition)
- Startup costs
- Management complexity

## Key Metrics to Understand

### Annual Revenue
The total income a property generates in a year from short-term rentals. This is GROSS revenue before expenses.

### Average Daily Rate (ADR)
The average price per night the property earns. Higher ADR = more premium positioning.

### Occupancy Rate
The percentage of nights the property is booked. 70%+ is excellent, 50-70% is good, under 50% needs improvement.

### Profit Margin
(Revenue - Rent - Expenses) / Revenue × 100. Aim for 30%+ after all costs.

### Break-Even Occupancy
The minimum occupancy needed to cover your rent. Lower is better (more safety margin).

## Common Mistakes to Avoid

1. **Ignoring regulations** - Always check local laws first
2. **Overestimating revenue** - Use conservative estimates (low end of projections)
3. **Underestimating expenses** - Budget 20-30% of revenue for supplies, cleaning, repairs
4. **Choosing wrong location** - Near attractions and downtown typically performs better
5. **Skipping the numbers** - Always validate with real data before signing a lease

## Expense Categories to Budget

- Cleaning fees (per turnover)
- Supplies (toiletries, linens, kitchen items)
- Utilities (if not included in rent)
- Insurance (short-term rental policy)
- Platform fees (Airbnb takes 3%, guests pay more)
- Maintenance and repairs
- Furnishing (one-time startup cost)
- Photography (one-time)
- Permit fees (annual)
`;

export const TOOL_DOCUMENTATION = `
# Tool Documentation

## Tool 1: Check Regulations
**Purpose:** Verify if short-term rentals are allowed in your target market.
**How to use:** Enter a city or address to see local STR regulations, permit requirements, and restrictions.
**What you'll learn:** Whether you can legally operate, what permits are needed, and any restrictions to be aware of.

## Tool 2: Find a Property (Opportunity Finder)
**Purpose:** Browse available rental listings and validate their STR potential.
**How to use:** Search by city or zip code to see Zillow listings. Click "Analyze" on any property to see projected revenue.
**What you'll learn:** What properties are available in your target market and their profit potential.

## Tool 3: See Real Revenue (Prove the Market)
**Purpose:** View actual Airbnb earnings data from any market.
**How to use:** Select a state, then city/metro, then optionally narrow to neighborhood or zip code.
**What you'll learn:** Average revenue, occupancy rates, and seasonal trends for your target market.

## Tool 4: Explore Listings
**Purpose:** See what successful Airbnb properties look like in any area.
**How to use:** Enter a city or address to browse active listings with their performance data.
**What you'll learn:** What property types, amenities, and price points work best in your market.

## Tool 5: Validate the Deal
**Purpose:** Run detailed numbers on a specific property.
**How to use:** Enter the property address, bedrooms, bathrooms, and monthly rent.
**What you'll learn:** Projected revenue, profit margin, break-even occupancy, and comparison to nearby properties.

## Tool 6: Compare Favorites
**Purpose:** Compare multiple properties side-by-side.
**How to use:** Save properties from the Map view, then select them here to compare.
**What you'll learn:** Which of your saved properties has the best profit potential.

## Tool 7: See the Map
**Purpose:** Visualize competition and property locations.
**How to use:** Browse the map to see where successful Airbnbs are located.
**What you'll learn:** Competition density, location advantages, and market hotspots.

## Tool 8: Market AI Advisor
**Purpose:** Get AI-powered insights about a market.
**How to use:** Ask questions about any market and get personalized analysis.
**What you'll learn:** Market trends, investment recommendations, and strategic advice.

## Tool 9: Property AI Advisor
**Purpose:** Get AI-powered insights about a specific property.
**How to use:** After validating a property, ask the AI questions about it.
**What you'll learn:** Property-specific recommendations, risk factors, and optimization tips.
`;

export const FAQ_KNOWLEDGE = `
# Frequently Asked Questions

## Getting Started

**Q: Where should I start if I'm completely new?**
A: Start with the Guide (ebook) to learn the fundamentals, then use Tool 1 to check regulations in markets you're interested in.

**Q: How much money do I need to start?**
A: Typically $5,000-$15,000 for furnishing and startup costs, plus first month's rent and security deposit.

**Q: Do I need to own property to do Airbnb arbitrage?**
A: No! That's the beauty of arbitrage - you lease properties instead of buying them.

## Understanding the Data

**Q: How accurate is the revenue data?**
A: Our data comes from AirDNA, which tracks actual Airbnb and VRBO listings. It's based on real performance, not estimates.

**Q: What's a good profit margin to aim for?**
A: 30%+ after all expenses is considered good. 40%+ is excellent.

**Q: What occupancy rate should I expect?**
A: Varies by market, but 65-75% is typical for well-managed properties. Some markets see 80%+.

## Common Concerns

**Q: What if the landlord says no to Airbnb?**
A: Many landlords are open to it if you present professionally. Offer higher rent, provide insurance, and show your business plan.

**Q: What about slow seasons?**
A: Budget for seasonality. Use the monthly forecast to see when slow months occur and ensure you can cover rent during those times.

**Q: How do I handle cleaning and management?**
A: You can self-manage or hire a co-host/property manager (typically 20-25% of revenue).

## Using the Tools

**Q: Can I save my analyses?**
A: Yes! Use the Save button to bookmark properties and markets for later comparison.

**Q: How do I compare multiple properties?**
A: Save properties from the Map view, then use Tool 6 (Compare Favorites) to see them side-by-side.

**Q: What does "Training Mode" do?**
A: It loads sample data so you can practice using the tools without entering real property information.
`;

// System prompt for the AI assistant
export const AI_SYSTEM_PROMPT = `You are Coach Inayah's AI Assistant, an expert in Airbnb arbitrage and short-term rental investing. You help users analyze rental properties and make informed investment decisions.

## Your Knowledge Base
You have deep knowledge of:
1. Coach Inayah's Airbnb arbitrage methodology
2. How to use each tool in the platform
3. Key metrics for evaluating rental properties
4. Common mistakes to avoid in STR investing
5. Market analysis and property validation

## Your Personality
- Friendly and encouraging, especially to beginners
- Data-driven and practical
- Honest about risks and challenges
- Focused on helping users make informed decisions

## Response Guidelines
1. Always ground your answers in the methodology and data
2. When discussing a specific property or market, reference the actual data shown on the page
3. Provide actionable next steps when appropriate
4. If you don't have enough information, ask clarifying questions
5. Keep responses concise but thorough
6. Use bullet points for lists and steps
7. Highlight important numbers and metrics

## What You Should NOT Do
- Make up specific numbers or data that isn't provided
- Guarantee returns or promise specific outcomes
- Provide legal or tax advice (recommend consulting professionals)
- Encourage users to skip the analysis process

## Context Awareness
When the user provides context about their current analysis (property details, market data, etc.), incorporate that specific information into your response. Reference the actual numbers they're seeing.`;

// Suggested questions based on tool context
export const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  regulations: [
    "What permits do I need for this market?",
    "Are there any restrictions I should know about?",
    "How do I apply for an STR permit?",
  ],
  prove: [
    "Is this market good for Airbnb arbitrage?",
    "What bedroom count performs best here?",
    "When is the slow season in this market?",
  ],
  validate: [
    "Is this property a good deal?",
    "What's my break-even point?",
    "How does this compare to nearby properties?",
  ],
  compare: [
    "Which property should I choose?",
    "What factors should I prioritize?",
    "How do I reduce my risk?",
  ],
  map: [
    "Where are the best locations in this area?",
    "How much competition is there?",
    "What areas should I avoid?",
  ],
  general: [
    "How do I get started with Airbnb arbitrage?",
    "What's a good profit margin to aim for?",
    "How much money do I need to start?",
  ],
};
