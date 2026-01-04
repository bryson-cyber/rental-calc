import { describe, it, expect } from 'vitest';
import { generateNarrativeWithPoe } from '../poe-ai';

describe('Claude Sonnet Risk Assessment', () => {
  it('should generate a complete risk assessment with Claude', async () => {
    const prompt = `You are a risk management consultant for real estate investments. Write a comprehensive risk assessment.

SPECIFIC RISKS IDENTIFIED FROM DATA:
- Primary: high seasonality with 77% revenue swing
- Secondary: standard STR operational risks

Write a risk assessment (120-150 words) that identifies and analyzes risks. DO NOT use markdown headers or formatting - write in plain prose paragraphs:

1. PRIMARY RISK: high seasonality with 77% revenue swing - explain the specific impact on this investment
2. MARKET RISK: Competition and saturation analysis for 6 listings
3. FINANCIAL RISK: The 2.67x ratio and 38% break-even implications
4. OPERATIONAL RISK: What could affect performance
5. MITIGATION FACTORS: What the data shows that reduces risk

Be specific and direct. Quantify risks where possible. This is expert risk analysis.`;

    const response = await generateNarrativeWithPoe(prompt, {
      model: 'Claude-Sonnet-4',
      maxTokens: 1500,
      timeoutMs: 45000,
    });

    console.log('Claude Response:', response);
    console.log('Response length:', response.length, 'chars');
    
    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(300);
  }, 60000);
});
