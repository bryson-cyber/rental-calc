import { describe, it, expect } from 'vitest';

// Test the knowledge base content structure and completeness
describe('AI Knowledge Base', () => {
  describe('Knowledge Base Exports', () => {
    it('should export all required knowledge base modules', async () => {
      const kb = await import('../client/src/data/knowledgeBase');
      
      expect(kb.COACH_INAYAH_METHODOLOGY).toBeDefined();
      expect(kb.TOOL_DOCUMENTATION).toBeDefined();
      expect(kb.MARKET_BENCHMARKS).toBeDefined();
      expect(kb.SEASONAL_PATTERNS).toBeDefined();
      expect(kb.CASE_STUDIES).toBeDefined();
      expect(kb.RED_FLAGS_AND_DEAL_BREAKERS).toBeDefined();
      expect(kb.LANDLORD_NEGOTIATION).toBeDefined();
      expect(kb.FINANCING_STRATEGIES).toBeDefined();
      expect(kb.FAQ_KNOWLEDGE).toBeDefined();
      expect(kb.BREAK_EVEN_FORMULAS).toBeDefined();
      expect(kb.AI_SYSTEM_PROMPT).toBeDefined();
      expect(kb.SUGGESTED_QUESTIONS).toBeDefined();
    });
  });

  describe('Coach Inayah Methodology', () => {
    it('should contain the 5-step analysis process', async () => {
      const { COACH_INAYAH_METHODOLOGY } = await import('../client/src/data/knowledgeBase');
      
      expect(COACH_INAYAH_METHODOLOGY).toContain('Step 1: Check Regulations');
      expect(COACH_INAYAH_METHODOLOGY).toContain('Step 2: Prove the Market');
      expect(COACH_INAYAH_METHODOLOGY).toContain('Step 3: Find Properties');
      expect(COACH_INAYAH_METHODOLOGY).toContain('Step 4: Validate the Deal');
      expect(COACH_INAYAH_METHODOLOGY).toContain('Step 5: Compare and Decide');
    });

    it('should contain key metrics definitions', async () => {
      const { COACH_INAYAH_METHODOLOGY } = await import('../client/src/data/knowledgeBase');
      
      expect(COACH_INAYAH_METHODOLOGY).toContain('Annual Revenue');
      expect(COACH_INAYAH_METHODOLOGY).toContain('Average Daily Rate');
      expect(COACH_INAYAH_METHODOLOGY).toContain('Occupancy Rate');
      expect(COACH_INAYAH_METHODOLOGY).toContain('Profit Margin');
      expect(COACH_INAYAH_METHODOLOGY).toContain('Break-Even Occupancy');
    });

    it('should contain common mistakes to avoid', async () => {
      const { COACH_INAYAH_METHODOLOGY } = await import('../client/src/data/knowledgeBase');
      
      expect(COACH_INAYAH_METHODOLOGY).toContain('Common Mistakes to Avoid');
      expect(COACH_INAYAH_METHODOLOGY).toContain('Ignoring regulations');
      expect(COACH_INAYAH_METHODOLOGY).toContain('Overestimating revenue');
    });
  });

  describe('Tool Documentation', () => {
    it('should document all 9 tools', async () => {
      const { TOOL_DOCUMENTATION } = await import('../client/src/data/knowledgeBase');
      
      expect(TOOL_DOCUMENTATION).toContain('Tool 1:');
      expect(TOOL_DOCUMENTATION).toContain('Tool 2:');
      expect(TOOL_DOCUMENTATION).toContain('Tool 3:');
      expect(TOOL_DOCUMENTATION).toContain('Tool 4:');
      expect(TOOL_DOCUMENTATION).toContain('Tool 5:');
      expect(TOOL_DOCUMENTATION).toContain('Tool 6:');
      expect(TOOL_DOCUMENTATION).toContain('Tool 7:');
      expect(TOOL_DOCUMENTATION).toContain('Tool 8:');
      expect(TOOL_DOCUMENTATION).toContain('Tool 9:');
    });

    it('should include purpose and how-to for each tool', async () => {
      const { TOOL_DOCUMENTATION } = await import('../client/src/data/knowledgeBase');
      
      // Count occurrences of key sections
      const purposeCount = (TOOL_DOCUMENTATION.match(/\*\*Purpose:\*\*/g) || []).length;
      const howToCount = (TOOL_DOCUMENTATION.match(/\*\*How to use:\*\*/g) || []).length;
      
      expect(purposeCount).toBeGreaterThanOrEqual(9);
      expect(howToCount).toBeGreaterThanOrEqual(9);
    });
  });

  describe('Market Benchmarks', () => {
    it('should contain tier classifications', async () => {
      const { MARKET_BENCHMARKS } = await import('../client/src/data/knowledgeBase');
      
      expect(MARKET_BENCHMARKS).toContain('Tier 1: Premium Markets');
      expect(MARKET_BENCHMARKS).toContain('Tier 2: Strong Markets');
      expect(MARKET_BENCHMARKS).toContain('Tier 3: Emerging Markets');
      expect(MARKET_BENCHMARKS).toContain('Seasonal Markets');
    });

    it('should contain major US markets', async () => {
      const { MARKET_BENCHMARKS } = await import('../client/src/data/knowledgeBase');
      
      expect(MARKET_BENCHMARKS).toContain('Miami');
      expect(MARKET_BENCHMARKS).toContain('Nashville');
      expect(MARKET_BENCHMARKS).toContain('Austin');
      expect(MARKET_BENCHMARKS).toContain('Denver');
      expect(MARKET_BENCHMARKS).toContain('Atlanta');
    });

    it('should contain revenue by bedroom count', async () => {
      const { MARKET_BENCHMARKS } = await import('../client/src/data/knowledgeBase');
      
      expect(MARKET_BENCHMARKS).toContain('Revenue by Bedroom Count');
      expect(MARKET_BENCHMARKS).toContain('Studio');
      expect(MARKET_BENCHMARKS).toContain('1 BR');
      expect(MARKET_BENCHMARKS).toContain('2 BR');
      expect(MARKET_BENCHMARKS).toContain('3 BR');
    });
  });

  describe('Seasonal Patterns', () => {
    it('should contain market type seasonality', async () => {
      const { SEASONAL_PATTERNS } = await import('../client/src/data/knowledgeBase');
      
      expect(SEASONAL_PATTERNS).toContain('Beach/Coastal Markets');
      expect(SEASONAL_PATTERNS).toContain('Mountain/Ski Markets');
      expect(SEASONAL_PATTERNS).toContain('Urban/Business Markets');
      expect(SEASONAL_PATTERNS).toContain('Year-Round Markets');
    });

    it('should contain monthly revenue index examples', async () => {
      const { SEASONAL_PATTERNS } = await import('../client/src/data/knowledgeBase');
      
      expect(SEASONAL_PATTERNS).toContain('Monthly Revenue Index');
      expect(SEASONAL_PATTERNS).toContain('January');
      expect(SEASONAL_PATTERNS).toContain('December');
    });
  });

  describe('Case Studies', () => {
    it('should contain multiple case studies', async () => {
      const { CASE_STUDIES } = await import('../client/src/data/knowledgeBase');
      
      expect(CASE_STUDIES).toContain('Case Study 1:');
      expect(CASE_STUDIES).toContain('Case Study 2:');
      expect(CASE_STUDIES).toContain('Case Study 3:');
      expect(CASE_STUDIES).toContain('Case Study 4:'); // Failure example
    });

    it('should include financial breakdowns', async () => {
      const { CASE_STUDIES } = await import('../client/src/data/knowledgeBase');
      
      expect(CASE_STUDIES).toContain('Financial Breakdown');
      expect(CASE_STUDIES).toContain('Monthly Revenue');
      expect(CASE_STUDIES).toContain('Monthly Rent');
      expect(CASE_STUDIES).toContain('Monthly Profit');
      expect(CASE_STUDIES).toContain('Profit Margin');
    });

    it('should include a failure example with lessons learned', async () => {
      const { CASE_STUDIES } = await import('../client/src/data/knowledgeBase');
      
      expect(CASE_STUDIES).toContain('Failure Example');
      expect(CASE_STUDIES).toContain('What Went Wrong');
      expect(CASE_STUDIES).toContain('Lessons Learned');
    });
  });

  describe('Red Flags and Deal Breakers', () => {
    it('should contain deal breakers section', async () => {
      const { RED_FLAGS_AND_DEAL_BREAKERS } = await import('../client/src/data/knowledgeBase');
      
      expect(RED_FLAGS_AND_DEAL_BREAKERS).toContain('Absolute Deal Breakers');
      expect(RED_FLAGS_AND_DEAL_BREAKERS).toContain('HOA Prohibits');
      expect(RED_FLAGS_AND_DEAL_BREAKERS).toContain('City/County Bans');
    });

    it('should contain red flags section', async () => {
      const { RED_FLAGS_AND_DEAL_BREAKERS } = await import('../client/src/data/knowledgeBase');
      
      expect(RED_FLAGS_AND_DEAL_BREAKERS).toContain('Major Red Flags');
      expect(RED_FLAGS_AND_DEAL_BREAKERS).toContain('Yellow Flags');
    });
  });

  describe('Landlord Negotiation', () => {
    it('should contain negotiation strategies', async () => {
      const { LANDLORD_NEGOTIATION } = await import('../client/src/data/knowledgeBase');
      
      expect(LANDLORD_NEGOTIATION).toContain('Understanding Landlord Psychology');
      expect(LANDLORD_NEGOTIATION).toContain('Professional Approach');
      expect(LANDLORD_NEGOTIATION).toContain('Sweetening the Deal');
    });

    it('should contain sample scripts', async () => {
      const { LANDLORD_NEGOTIATION } = await import('../client/src/data/knowledgeBase');
      
      expect(LANDLORD_NEGOTIATION).toContain('Sample Scripts');
      expect(LANDLORD_NEGOTIATION).toContain('Initial Inquiry');
      expect(LANDLORD_NEGOTIATION).toContain('Addressing Concerns');
    });
  });

  describe('Financing Strategies', () => {
    it('should contain startup costs breakdown', async () => {
      const { FINANCING_STRATEGIES } = await import('../client/src/data/knowledgeBase');
      
      expect(FINANCING_STRATEGIES).toContain('Startup Costs Breakdown');
      expect(FINANCING_STRATEGIES).toContain('Per-Property Costs');
    });

    it('should contain funding sources', async () => {
      const { FINANCING_STRATEGIES } = await import('../client/src/data/knowledgeBase');
      
      expect(FINANCING_STRATEGIES).toContain('Funding Sources');
      expect(FINANCING_STRATEGIES).toContain('Personal Savings');
      expect(FINANCING_STRATEGIES).toContain('Business Line of Credit');
      expect(FINANCING_STRATEGIES).toContain('0% APR Credit Cards');
    });
  });

  describe('Break-Even Formulas', () => {
    it('should contain core formulas', async () => {
      const { BREAK_EVEN_FORMULAS } = await import('../client/src/data/knowledgeBase');
      
      expect(BREAK_EVEN_FORMULAS).toContain('Break-Even Occupancy');
      expect(BREAK_EVEN_FORMULAS).toContain('Break-Even ADR');
      expect(BREAK_EVEN_FORMULAS).toContain('Profit Margin');
      expect(BREAK_EVEN_FORMULAS).toContain('Rent-to-Revenue Ratio');
    });

    it('should contain benchmark reference table', async () => {
      const { BREAK_EVEN_FORMULAS } = await import('../client/src/data/knowledgeBase');
      
      expect(BREAK_EVEN_FORMULAS).toContain('Quick Reference Benchmarks');
      expect(BREAK_EVEN_FORMULAS).toContain('Poor');
      expect(BREAK_EVEN_FORMULAS).toContain('Acceptable');
      expect(BREAK_EVEN_FORMULAS).toContain('Good');
      expect(BREAK_EVEN_FORMULAS).toContain('Excellent');
    });
  });

  describe('FAQ Knowledge', () => {
    it('should contain categorized FAQs', async () => {
      const { FAQ_KNOWLEDGE } = await import('../client/src/data/knowledgeBase');
      
      expect(FAQ_KNOWLEDGE).toContain('Getting Started');
      expect(FAQ_KNOWLEDGE).toContain('Understanding the Data');
      expect(FAQ_KNOWLEDGE).toContain('Common Concerns');
      expect(FAQ_KNOWLEDGE).toContain('Using the Tools');
    });

    it('should contain Q&A format', async () => {
      const { FAQ_KNOWLEDGE } = await import('../client/src/data/knowledgeBase');
      
      // Check for Q&A pattern
      expect(FAQ_KNOWLEDGE).toContain('**Q:');
      expect(FAQ_KNOWLEDGE).toContain('A:');
    });
  });

  describe('AI System Prompt', () => {
    it('should define AI personality and guidelines', async () => {
      const { AI_SYSTEM_PROMPT } = await import('../client/src/data/knowledgeBase');
      
      expect(AI_SYSTEM_PROMPT).toContain('Your Knowledge Base');
      expect(AI_SYSTEM_PROMPT).toContain('Your Personality');
      expect(AI_SYSTEM_PROMPT).toContain('Response Guidelines');
      expect(AI_SYSTEM_PROMPT).toContain('What You Should NOT Do');
    });

    it('should include context awareness instructions', async () => {
      const { AI_SYSTEM_PROMPT } = await import('../client/src/data/knowledgeBase');
      
      expect(AI_SYSTEM_PROMPT).toContain('Context Awareness');
    });
  });

  describe('Suggested Questions', () => {
    it('should have questions for all tool contexts', async () => {
      const { SUGGESTED_QUESTIONS } = await import('../client/src/data/knowledgeBase');
      
      expect(SUGGESTED_QUESTIONS.ebook).toBeDefined();
      expect(SUGGESTED_QUESTIONS.regulations).toBeDefined();
      expect(SUGGESTED_QUESTIONS.prove).toBeDefined();
      expect(SUGGESTED_QUESTIONS.find).toBeDefined();
      expect(SUGGESTED_QUESTIONS.validate).toBeDefined();
      expect(SUGGESTED_QUESTIONS.compare).toBeDefined();
      expect(SUGGESTED_QUESTIONS.map).toBeDefined();
      expect(SUGGESTED_QUESTIONS.advisor).toBeDefined();
      expect(SUGGESTED_QUESTIONS.general).toBeDefined();
    });

    it('should have at least 3 questions per context', async () => {
      const { SUGGESTED_QUESTIONS } = await import('../client/src/data/knowledgeBase');
      
      Object.values(SUGGESTED_QUESTIONS).forEach(questions => {
        expect(questions.length).toBeGreaterThanOrEqual(3);
      });
    });
  });
});
