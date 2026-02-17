/**
 * Unit tests for AI Streaming and Conversation Memory features
 * 
 * Updated for Claude API via llm-provider.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the llm-provider module
const mockCallLLM = vi.fn().mockResolvedValue('This is a test response from Claude.');
const mockCallLLMStreaming = vi.fn();

vi.mock('../llm-provider', () => ({
  callLLM: (...args: any[]) => mockCallLLM(...args),
  callLLMStreaming: (...args: any[]) => mockCallLLMStreaming(...args),
}));

describe('AI Streaming Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallLLM.mockResolvedValue('This is a test response from Claude.');
    mockCallLLMStreaming.mockImplementation(async function* () {
      yield 'Hello';
      yield ' there!';
      yield ' How can I help?';
    });
  });

  describe('claudeChat function', () => {
    it('should export claudeChat function', async () => {
      const { claudeChat } = await import('../ai-streaming');
      expect(typeof claudeChat).toBe('function');
    });

    it('should handle basic chat messages', async () => {
      const { claudeChat } = await import('../ai-streaming');
      
      const response = await claudeChat([
        { role: 'user', content: 'Hello, how are you?' },
      ]);
      
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      expect(mockCallLLM).toHaveBeenCalledTimes(1);
    });

    it('should handle system prompts', async () => {
      const { claudeChat } = await import('../ai-streaming');
      
      const response = await claudeChat(
        [{ role: 'user', content: 'What can you help me with?' }],
        'You are Coach Inayah\'s AI assistant for rental arbitrage.'
      );
      
      expect(typeof response).toBe('string');
      // Verify systemPrompt was passed to callLLM
      expect(mockCallLLM).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          systemPrompt: expect.stringContaining('Coach Inayah'),
        })
      );
    });

    it('should handle conversation history', async () => {
      const { claudeChat } = await import('../ai-streaming');
      
      const response = await claudeChat([
        { role: 'user', content: 'What is rental arbitrage?' },
        { role: 'assistant', content: 'Rental arbitrage is a strategy...' },
        { role: 'user', content: 'How do I get started?' },
      ]);
      
      expect(typeof response).toBe('string');
      // Verify the prompt includes conversation history
      const prompt = mockCallLLM.mock.calls[0][0];
      expect(prompt).toContain('rental arbitrage');
      expect(prompt).toContain('How do I get started');
    });

    it('should return error message when no user message found', async () => {
      const { claudeChat } = await import('../ai-streaming');
      
      // claudeChat catches the error and returns an error message string
      const response = await claudeChat([]);
      
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      // Should return a user-friendly error, not throw
      expect(response).toContain('error');
    });
  });

  describe('streamClaudeChat function', () => {
    it('should export streamClaudeChat function', async () => {
      const { streamClaudeChat } = await import('../ai-streaming');
      expect(typeof streamClaudeChat).toBe('function');
    });

    it('should call onChunk and onComplete callbacks', async () => {
      const { streamClaudeChat } = await import('../ai-streaming');
      
      const chunks: string[] = [];
      let finalResponse = '';
      
      await streamClaudeChat({
        messages: [{ role: 'user', content: 'Hello!' }],
        onChunk: (chunk) => chunks.push(chunk),
        onComplete: (response) => { finalResponse = response; },
        onError: (error) => { throw error; },
      });
      
      expect(chunks.length).toBe(3);
      expect(chunks).toEqual(['Hello', ' there!', ' How can I help?']);
      expect(finalResponse).toBe('Hello there! How can I help?');
    });

    it('should call onError when no user message found', async () => {
      const { streamClaudeChat } = await import('../ai-streaming');
      
      let caughtError: Error | null = null;
      
      await streamClaudeChat({
        messages: [],
        onChunk: () => {},
        onComplete: () => {},
        onError: (error) => { caughtError = error; },
      });
      
      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toContain('No user message');
    });
  });

  describe('checkClaudeHealth function', () => {
    it('should export checkClaudeHealth function', async () => {
      const { checkClaudeHealth } = await import('../ai-streaming');
      expect(typeof checkClaudeHealth).toBe('function');
    });

    it('should return true when Claude responds with ok', async () => {
      mockCallLLM.mockResolvedValueOnce('OK');
      const { checkClaudeHealth } = await import('../ai-streaming');
      const result = await checkClaudeHealth();
      expect(result).toBe(true);
    });

    it('should return false when Claude API fails', async () => {
      mockCallLLM.mockRejectedValueOnce(new Error('API error'));
      const { checkClaudeHealth } = await import('../ai-streaming');
      const result = await checkClaudeHealth();
      expect(result).toBe(false);
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
