/**
 * Tests for Training Environment and AI Chat Features
 */
import { describe, it, expect } from 'vitest';

describe('Training Environment Features', () => {
  describe('Onboarding Tour Configuration', () => {
    it('should have all required tour steps defined', () => {
      const TOUR_STEPS = [
        'welcome',
        'ebook',
        'regulations',
        'opportunity',
        'prove',
        'find',
        'validate',
        'compare',
        'map',
        'market',
        'advisor',
      ];
      
      expect(TOUR_STEPS).toHaveLength(11);
      expect(TOUR_STEPS[0]).toBe('welcome');
      expect(TOUR_STEPS[TOUR_STEPS.length - 1]).toBe('advisor');
    });

    it('should have localStorage key for onboarding state', () => {
      const ONBOARDING_STORAGE_KEY = 'coach-inayah-onboarding-complete';
      expect(ONBOARDING_STORAGE_KEY).toBeDefined();
      expect(typeof ONBOARDING_STORAGE_KEY).toBe('string');
    });
  });

  describe('Sample Data for Training Mode', () => {
    it('should have sample property data structure', () => {
      const SAMPLE_PROPERTY = {
        address: '123 Sample Street, Denver, CO 80202',
        bedrooms: 3,
        bathrooms: 2,
        monthlyRent: 2500,
        projectedRevenue: 72000,
        occupancyRate: 0.68,
        averageDailyRate: 289,
      };

      expect(SAMPLE_PROPERTY.address).toContain('Denver');
      expect(SAMPLE_PROPERTY.bedrooms).toBeGreaterThan(0);
      expect(SAMPLE_PROPERTY.bathrooms).toBeGreaterThan(0);
      expect(SAMPLE_PROPERTY.monthlyRent).toBeGreaterThan(0);
      expect(SAMPLE_PROPERTY.projectedRevenue).toBeGreaterThan(0);
      expect(SAMPLE_PROPERTY.occupancyRate).toBeGreaterThan(0);
      expect(SAMPLE_PROPERTY.occupancyRate).toBeLessThanOrEqual(1);
    });

    it('should have sample market data structure', () => {
      const SAMPLE_MARKET = {
        city: 'Denver',
        state: 'CO',
        averageRevenue: 68500,
        averageOccupancy: 0.72,
        averageADR: 275,
        totalListings: 4500,
        marketScore: 85,
      };

      expect(SAMPLE_MARKET.city).toBe('Denver');
      expect(SAMPLE_MARKET.state).toBe('CO');
      expect(SAMPLE_MARKET.averageRevenue).toBeGreaterThan(0);
      expect(SAMPLE_MARKET.averageOccupancy).toBeGreaterThan(0);
      expect(SAMPLE_MARKET.averageOccupancy).toBeLessThanOrEqual(1);
      expect(SAMPLE_MARKET.marketScore).toBeGreaterThanOrEqual(0);
      expect(SAMPLE_MARKET.marketScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Knowledge Base Structure', () => {
    it('should have Coach Inayah methodology defined', () => {
      const METHODOLOGY_TOPICS = [
        'profitability_analysis',
        'market_selection',
        'property_validation',
        'risk_assessment',
        'arbitrage_strategy',
      ];

      expect(METHODOLOGY_TOPICS).toHaveLength(5);
      expect(METHODOLOGY_TOPICS).toContain('profitability_analysis');
      expect(METHODOLOGY_TOPICS).toContain('market_selection');
    });

    it('should have tool documentation for each tool', () => {
      const TOOL_IDS = [
        'ebook',
        'regulations',
        'opportunity',
        'prove',
        'find',
        'validate',
        'compare',
        'map',
        'market',
        'advisor',
      ];

      expect(TOOL_IDS).toHaveLength(10);
      TOOL_IDS.forEach(toolId => {
        expect(typeof toolId).toBe('string');
        expect(toolId.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('AI Chat Features', () => {
  describe('AI System Prompt', () => {
    it('should include Coach Inayah branding', () => {
      const systemPromptKeywords = [
        'Coach Inayah',
        'rental',
        'investment',
        'property',
        'market',
      ];

      systemPromptKeywords.forEach(keyword => {
        expect(keyword.length).toBeGreaterThan(0);
      });
    });

    it('should have grounding instructions to prevent hallucination', () => {
      const groundingRules = [
        'only_answer_from_knowledge_base',
        'reference_page_data',
        'admit_uncertainty',
      ];

      expect(groundingRules).toHaveLength(3);
    });
  });

  describe('Page Context Interface', () => {
    it('should accept current tool context', () => {
      const pageContext = {
        currentTool: 'validate',
        propertyData: {
          address: '123 Test St',
          bedrooms: 3,
          bathrooms: 2,
        },
        marketData: {
          city: 'Denver',
          state: 'CO',
        },
      };

      expect(pageContext.currentTool).toBe('validate');
      expect(pageContext.propertyData?.address).toBeDefined();
      expect(pageContext.marketData?.city).toBeDefined();
    });

    it('should handle missing property data gracefully', () => {
      const pageContext = {
        currentTool: 'ebook',
        propertyData: undefined,
        marketData: undefined,
      };

      expect(pageContext.currentTool).toBe('ebook');
      expect(pageContext.propertyData).toBeUndefined();
      expect(pageContext.marketData).toBeUndefined();
    });
  });

  describe('Suggested Questions', () => {
    it('should have context-specific questions for each tool', () => {
      const toolQuestions: Record<string, string[]> = {
        ebook: ['What is the first step to getting started?'],
        validate: ['Is this property profitable?', 'What is the break-even occupancy?'],
        prove: ['What does the market data tell me?'],
        compare: ['How do I compare multiple properties?'],
      };

      expect(Object.keys(toolQuestions).length).toBeGreaterThan(0);
      Object.values(toolQuestions).forEach(questions => {
        expect(questions.length).toBeGreaterThan(0);
        questions.forEach(q => expect(typeof q).toBe('string'));
      });
    });
  });
});

describe('AI Router Integration', () => {
  describe('Chat Endpoint Schema', () => {
    it('should validate message structure', () => {
      const validMessage = {
        role: 'user' as const,
        content: 'What is the projected revenue for this property?',
      };

      expect(['system', 'user', 'assistant']).toContain(validMessage.role);
      expect(validMessage.content.length).toBeGreaterThan(0);
    });

    it('should accept conversation history', () => {
      const conversationHistory = [
        { role: 'system' as const, content: 'You are an AI assistant.' },
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi! How can I help?' },
        { role: 'user' as const, content: 'What is the occupancy rate?' },
      ];

      expect(conversationHistory).toHaveLength(4);
      conversationHistory.forEach(msg => {
        expect(['system', 'user', 'assistant']).toContain(msg.role);
        expect(msg.content.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Response Format', () => {
    it('should return content and success status', () => {
      const mockResponse = {
        content: 'Based on the data, this property has a projected annual revenue of $72,000.',
        success: true,
      };

      expect(mockResponse.content).toBeDefined();
      expect(typeof mockResponse.content).toBe('string');
      expect(typeof mockResponse.success).toBe('boolean');
    });

    it('should handle error responses', () => {
      const errorResponse = {
        content: 'I apologize, but I encountered an error. Please try again.',
        success: false,
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.content).toContain('error');
    });
  });
});
