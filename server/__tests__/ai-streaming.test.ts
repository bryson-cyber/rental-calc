/**
 * Unit tests for AI Streaming and Conversation Memory features
 * 
 * Updated for Gemini 3 REST API (no deprecated SDK)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally for the REST API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock ENV
vi.mock('../_core/env', () => ({
  ENV: {
    geminiApiKey: 'test-api-key',
  },
}));

function createMockResponse(text: string, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: vi.fn().mockResolvedValue({
      candidates: [{
        content: {
          parts: [{ text }]
        }
      }]
    }),
    text: vi.fn().mockResolvedValue(text),
  };
}

function createMockStreamResponse(chunks: string[]) {
  const sseData = chunks.map(c => `data: ${JSON.stringify({
    candidates: [{ content: { parts: [{ text: c }] } }]
  })}\n\n`).join('');

  const encoder = new TextEncoder();
  const encoded = encoder.encode(sseData);
  let read = false;

  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: vi.fn().mockImplementation(() => {
          if (!read) {
            read = true;
            return Promise.resolve({ done: false, value: encoded });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
      }),
    },
    text: vi.fn().mockResolvedValue(''),
  };
}

describe('Gemini Streaming Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('geminiChat function', () => {
    it('should export geminiChat function', async () => {
      const { geminiChat } = await import('../gemini-streaming');
      expect(typeof geminiChat).toBe('function');
    });

    it('should handle basic chat messages', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse('This is a test response from Gemini.'));
      
      const { geminiChat } = await import('../gemini-streaming');
      
      const response = await geminiChat([
        { role: 'user', content: 'Hello, how are you?' },
      ]);
      
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });

    it('should handle system prompts', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse('I am Coach Inayah\'s AI assistant.'));
      
      const { geminiChat } = await import('../gemini-streaming');
      
      const response = await geminiChat(
        [{ role: 'user', content: 'What can you help me with?' }],
        'You are Coach Inayah\'s AI assistant for rental arbitrage.'
      );
      
      expect(typeof response).toBe('string');
      
      // Verify systemInstruction was sent in the request body
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.systemInstruction).toBeDefined();
      expect(body.systemInstruction.parts[0].text).toContain('Coach Inayah');
    });

    it('should handle conversation history', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse('Here is how to get started with rental arbitrage.'));
      
      const { geminiChat } = await import('../gemini-streaming');
      
      const response = await geminiChat([
        { role: 'user', content: 'What is rental arbitrage?' },
        { role: 'assistant', content: 'Rental arbitrage is a strategy where you rent a property and then sublease it on platforms like Airbnb.' },
        { role: 'user', content: 'How do I get started?' },
      ]);
      
      expect(typeof response).toBe('string');
      
      // Verify conversation history was sent correctly
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.contents.length).toBe(3);
      expect(body.contents[0].role).toBe('user');
      expect(body.contents[1].role).toBe('model'); // assistant -> model
      expect(body.contents[2].role).toBe('user');
    });

    it('should use correct Gemini 3 model and thinkingConfig', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse('Test'));
      
      const { geminiChat } = await import('../gemini-streaming');
      await geminiChat([{ role: 'user', content: 'test' }]);
      
      const callArgs = mockFetch.mock.calls[0];
      const url = callArgs[0] as string;
      const body = JSON.parse(callArgs[1].body);
      
      // Should use gemini-3-flash-preview model
      expect(url).toContain('gemini-3-flash-preview');
      
      // Should have thinkingConfig inside generationConfig
      expect(body.generationConfig.thinkingConfig).toBeDefined();
      expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('medium');
      
      // Temperature should be 1.0 for thinking models
      expect(body.generationConfig.temperature).toBe(1.0);
    });
  });

  describe('streamGeminiChat function', () => {
    it('should export streamGeminiChat function', async () => {
      const { streamGeminiChat } = await import('../gemini-streaming');
      expect(typeof streamGeminiChat).toBe('function');
    });

    it('should call onChunk and onComplete callbacks', async () => {
      mockFetch.mockResolvedValueOnce(createMockStreamResponse(['Hello', ' there!', ' How can I help?']));
      
      const { streamGeminiChat } = await import('../gemini-streaming');
      
      const chunks: string[] = [];
      let finalResponse = '';
      
      await streamGeminiChat({
        messages: [{ role: 'user', content: 'Hello!' }],
        onChunk: (chunk) => chunks.push(chunk),
        onComplete: (response) => { finalResponse = response; },
        onError: (error) => { throw error; },
      });
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(finalResponse.length).toBeGreaterThan(0);
    });

    it('should use streaming endpoint with alt=sse', async () => {
      mockFetch.mockResolvedValueOnce(createMockStreamResponse(['Test']));
      
      const { streamGeminiChat } = await import('../gemini-streaming');
      
      await streamGeminiChat({
        messages: [{ role: 'user', content: 'Hello!' }],
        onChunk: () => {},
        onComplete: () => {},
        onError: (error) => { throw error; },
      });
      
      const callArgs = mockFetch.mock.calls[0];
      const url = callArgs[0] as string;
      expect(url).toContain('streamGenerateContent');
      expect(url).toContain('alt=sse');
    });
  });

  describe('checkGeminiHealth function', () => {
    it('should export checkGeminiHealth function', async () => {
      const { checkGeminiHealth } = await import('../gemini-streaming');
      expect(typeof checkGeminiHealth).toBe('function');
    });

    it('should return boolean', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse('OK'));
      
      const { checkGeminiHealth } = await import('../gemini-streaming');
      const result = await checkGeminiHealth();
      expect(typeof result).toBe('boolean');
    });
  });
});

describe('Conversation Memory', () => {
  describe('AI Conversations Schema', () => {
    it('should have aiConversations table defined', async () => {
      const schema = await import('../../drizzle/schema');
      expect(schema.aiConversations).toBeDefined();
    });

    it('should have aiMessages table defined', async () => {
      const schema = await import('../../drizzle/schema');
      expect(schema.aiMessages).toBeDefined();
    });

    it('should have correct fields in aiConversations', async () => {
      const schema = await import('../../drizzle/schema');
      const table = schema.aiConversations;
      
      expect(table.id).toBeDefined();
      expect(table.userId).toBeDefined();
      expect(table.sessionId).toBeDefined();
      expect(table.title).toBeDefined();
      expect(table.contextTool).toBeDefined();
      expect(table.messageCount).toBeDefined();
      expect(table.createdAt).toBeDefined();
    });

    it('should have correct fields in aiMessages', async () => {
      const schema = await import('../../drizzle/schema');
      const table = schema.aiMessages;
      
      expect(table.id).toBeDefined();
      expect(table.conversationId).toBeDefined();
      expect(table.role).toBeDefined();
      expect(table.content).toBeDefined();
      expect(table.isComplete).toBeDefined();
      expect(table.createdAt).toBeDefined();
    });
  });
});
