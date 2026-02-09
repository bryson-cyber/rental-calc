import { describe, it, expect } from 'vitest';
import { generateFullArbitrageAnalysis } from '../sop-reports';

describe('Competitor Data Check', () => {
  it('should return competitors array', async () => {
    const result = await generateFullArbitrageAnalysis(
      '1321 15th St, Denver, CO',
      2500,
      3,
      2
    );
    
    console.log('=== COMPETITOR CHECK ===');
    console.log('competitors type:', typeof result.competitors);
    console.log('competitors length:', result.competitors?.length);
    console.log('First competitor:', result.competitors?.[0]);
    
    expect(result.competitors).toBeDefined();
    expect(Array.isArray(result.competitors)).toBe(true);
  }, 300000);
});
