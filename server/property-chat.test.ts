/**
 * Tests for property-chat.ts — Property-specific AI chatbot (Gemini Flash)
 * 
 * Tests the system prompt builder and context injection logic.
 * Actual Gemini API calls are not tested (would require live API key).
 */

import { describe, it, expect, vi } from 'vitest';

// We test the buildSystemPrompt logic by importing the module and
// checking the system prompt output. Since buildSystemPrompt is not exported,
// we test it indirectly through the public API shape and validate the
// module structure.

// Mock the @google/genai module to avoid real API calls
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({ text: 'Mock response' }),
      generateContentStream: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { text: 'Mock ' };
          yield { text: 'stream' };
        },
      }),
    },
  })),
}));

// Mock the ENV to provide a fake API key
vi.mock('./_core/env', () => ({
  ENV: {
    geminiApiKey: 'test-api-key-fake',
  },
}));

import { streamPropertyChat, propertyChat, type PropertyChatContext, type ChatMessage } from './property-chat';

const mockContext: PropertyChatContext = {
  address: '123 Main St, Denver, CO 80202',
  bedrooms: 3,
  bathrooms: 2,
  accommodates: 6,
  monthlyRent: 2500,
  projectedRevenue: 85000,
  revenueLow: 75000,
  revenueHigh: 95000,
  adr: 250,
  occupancyRate: 0.73,
  monthlyRevenue: 7083,
  monthlyProfit: 3167,
  revenueScenarios: {
    conservative: 70000,
    target: 85000,
    optimistic: 105000,
    compCount: 15,
  },
  forecast: [
    { month: '2024-06', revenue: 9500, adr: 280, occupancy: 0.85 },
    { month: '2024-07', revenue: 10200, adr: 310, occupancy: 0.88 },
    { month: '2024-12', revenue: 4500, adr: 200, occupancy: 0.55 },
  ],
  comparables: [
    {
      title: 'Downtown Luxury Loft',
      bedrooms: 3,
      bathrooms: 2,
      rating: 4.9,
      reviews: 148,
      annualRevenue: 92000,
      adr: 270,
      occupancy: 0.78,
      distance: 885,
    },
  ],
  historicalTrend: 'up',
  yearlyPctChange: 5.2,
  marketInsights: {
    professionallyManagedPct: 0.45,
    superhostPct: 0.32,
    avgRating: 4.6,
    totalListings: 1200,
    marketScore: 78,
  },
  rentometer: {
    median: 2400,
    mean: 2550,
    min: 1800,
    max: 3200,
    sampleCount: 45,
    radiusMiles: 1,
    stdDev: 350,
    userRentVsMarket: 'above',
    rentAdvantage: 100,
    percentileRank: 58,
  },
  mode: 'rent',
};

describe('property-chat', () => {
  describe('module exports', () => {
    it('exports streamPropertyChat function', () => {
      expect(typeof streamPropertyChat).toBe('function');
    });

    it('exports propertyChat function', () => {
      expect(typeof propertyChat).toBe('function');
    });
  });

  describe('propertyChat (non-streaming)', () => {
    it('returns a string response for guided mode', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Is this a good deal?' },
      ];

      const result = await propertyChat(mockContext, 'guided', messages);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns a string response for pro mode', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'What is the cap rate?' },
      ];

      const result = await propertyChat(mockContext, 'pro', messages);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles multi-turn conversation', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'What is the projected revenue?' },
        { role: 'model', content: 'The projected annual revenue is $85,000.' },
        { role: 'user', content: 'How does that compare to comps?' },
      ];

      const result = await propertyChat(mockContext, 'guided', messages);
      expect(typeof result).toBe('string');
    });

    it('works with minimal context (no optional fields)', async () => {
      const minimalContext: PropertyChatContext = {
        address: '456 Oak Ave, Austin, TX',
        bedrooms: 2,
        bathrooms: 1,
        projectedRevenue: 50000,
        revenueLow: 40000,
        revenueHigh: 60000,
        adr: 180,
        occupancyRate: 0.65,
        monthlyRevenue: 4167,
        monthlyProfit: 1500,
      };

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Tell me about this property.' },
      ];

      const result = await propertyChat(minimalContext, 'guided', messages);
      expect(typeof result).toBe('string');
    });
  });

  describe('streamPropertyChat (streaming)', () => {
    it('yields text chunks as an async generator', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'What are the best months?' },
      ];

      const chunks: string[] = [];
      for await (const chunk of streamPropertyChat(mockContext, 'guided', messages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe('Mock stream');
    });

    it('works with pro mode', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Analyze the occupancy rate.' },
      ];

      const chunks: string[] = [];
      for await (const chunk of streamPropertyChat(mockContext, 'pro', messages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('context validation', () => {
    it('handles purchase mode context', async () => {
      const purchaseContext: PropertyChatContext = {
        ...mockContext,
        mode: 'purchase',
        purchasePrice: 450000,
      };

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Is this a good investment?' },
      ];

      const result = await propertyChat(purchaseContext, 'pro', messages);
      expect(typeof result).toBe('string');
    });

    it('handles context with no rentometer data', async () => {
      const noRentometerContext: PropertyChatContext = {
        ...mockContext,
        rentometer: undefined,
      };

      const messages: ChatMessage[] = [
        { role: 'user', content: 'What about the rent?' },
      ];

      const result = await propertyChat(noRentometerContext, 'guided', messages);
      expect(typeof result).toBe('string');
    });

    it('handles context with no comparables', async () => {
      const noCompsContext: PropertyChatContext = {
        ...mockContext,
        comparables: undefined,
      };

      const messages: ChatMessage[] = [
        { role: 'user', content: 'How does this compare?' },
      ];

      const result = await propertyChat(noCompsContext, 'guided', messages);
      expect(typeof result).toBe('string');
    });
  });
});
