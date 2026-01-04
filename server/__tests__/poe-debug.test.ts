import { describe, it, expect } from 'vitest';
import { generateNarrativeWithPoe } from '../poe-ai';

describe('Poe AI Debug', () => {
  it('should respond to a simple prompt', async () => {
    const start = Date.now();
    try {
      const response = await generateNarrativeWithPoe(
        'Say "Hello, this is working!" in exactly those words.',
        { maxTokens: 50, timeoutMs: 30000 }
      );
      const elapsed = Date.now() - start;
      console.log(`Response in ${elapsed}ms:`, response);
      expect(response).toBeTruthy();
    } catch (error: any) {
      const elapsed = Date.now() - start;
      console.error(`Error after ${elapsed}ms:`, error.message);
      throw error;
    }
  }, 60000);
});
