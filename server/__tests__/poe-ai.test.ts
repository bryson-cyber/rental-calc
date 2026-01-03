import { describe, it, expect } from 'vitest';
import { testPoeConnection, callPoeAI } from '../poe-ai';

describe('Poe AI Integration', () => {
  it('should connect to Poe API successfully', async () => {
    const result = await testPoeConnection();
    
    console.log('Poe AI Test Result:', result);
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('successfully');
  }, 30000); // 30 second timeout for API call

  it('should generate a simple response', async () => {
    const response = await callPoeAI(
      [{ role: 'user', content: 'What is 2+2? Reply with just the number.' }],
      { maxTokens: 50, timeoutMs: 15000 }
    );
    
    console.log('Simple response:', response);
    
    expect(response).toBeTruthy();
    expect(response.length).toBeGreaterThan(0);
  }, 30000);
});
