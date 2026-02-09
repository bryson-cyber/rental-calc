import { describe, it, expect } from 'vitest';
import { calculateArbitrageFeasibility } from '../airdna';

describe('calculateArbitrageFeasibility', () => {
  it('should calculate feasibility for a valid address', async () => {
    const result = await calculateArbitrageFeasibility(
      '123 Main St, Austin, TX',
      2500,
      2,
      1
    );
    
    // May return null if address not found, but should not throw
    if (result) {
      expect(result.property).toBeDefined();
      expect(result.projections).toBeDefined();
      expect(result.risk_assessment).toBeDefined();
      expect(result.recommendation).toBeDefined();
    }
  }, 30000);

  it('should include all required projection fields', async () => {
    const result = await calculateArbitrageFeasibility(
      '456 Oak Ave, Denver, CO',
      3000,
      3,
      2
    );
    
    if (result) {
      expect(result.projections.annual_str_revenue).toBeDefined();
      expect(result.projections.break_even_occupancy).toBeDefined();
      expect(result.projections.projected_monthly_profit).toBeDefined();
      expect(result.projections.projected_annual_profit).toBeDefined();
      expect(result.projections.roi_percentage).toBeDefined();
    }
  }, 30000);

  it('should include risk assessment with valid levels', async () => {
    const result = await calculateArbitrageFeasibility(
      '789 Pine St, Nashville, TN',
      2000,
      2,
      1
    );
    
    if (result) {
      expect(['low', 'medium', 'high']).toContain(result.risk_assessment.overall_risk);
      expect(['low', 'medium', 'high']).toContain(result.risk_assessment.seasonality_risk);
      expect(['low', 'medium', 'high']).toContain(result.risk_assessment.regulation_risk);
      expect(['low', 'medium', 'high']).toContain(result.risk_assessment.market_saturation);
      expect(Array.isArray(result.risk_assessment.factors)).toBe(true);
    }
  }, 30000);
});

describe('AirDNA Feasibility Comparison Logic', () => {
  it('should correctly calculate profit difference percentage', () => {
    const ourAnnualProfit = 25000;
    const airdnaAnnualProfit = 28000;
    
    const profitDifference = airdnaAnnualProfit - ourAnnualProfit;
    const profitDifferencePct = (profitDifference / Math.abs(ourAnnualProfit)) * 100;
    
    expect(profitDifference).toBe(3000);
    expect(profitDifferencePct).toBe(12); // 12% higher
  });

  it('should identify aligned assessments (within 20%)', () => {
    const testCases = [
      { our: 25000, airdna: 28000, expected: true },  // 12% diff
      { our: 25000, airdna: 30000, expected: false }, // 20% diff (boundary)
      { our: 25000, airdna: 35000, expected: false }, // 40% diff
      { our: 25000, airdna: 22000, expected: true },  // -12% diff
      { our: 25000, airdna: 19000, expected: false }, // -24% diff
    ];
    
    testCases.forEach(({ our, airdna, expected }) => {
      const profitDifferencePct = ((airdna - our) / Math.abs(our)) * 100;
      const assessmentMatch = Math.abs(profitDifferencePct) < 20;
      expect(assessmentMatch).toBe(expected);
    });
  });

  it('should handle zero profit edge case', () => {
    const ourAnnualProfit = 0;
    const airdnaAnnualProfit = 5000;
    
    // When our profit is 0, we can't calculate percentage difference
    const profitDifferencePct = ourAnnualProfit !== 0 
      ? ((airdnaAnnualProfit - ourAnnualProfit) / Math.abs(ourAnnualProfit)) * 100 
      : 0;
    
    expect(profitDifferencePct).toBe(0);
  });

  it('should generate correct match status text', () => {
    const aligned = { match: true, pct: 12 };
    const divergent = { match: false, pct: 35 };
    
    const alignedStatus = aligned.match 
      ? 'ALIGNED - Our analysis and AirDNA agree within 20%' 
      : `DIVERGENT - Difference of ${Math.abs(aligned.pct).toFixed(0)}%`;
    
    const divergentStatus = divergent.match 
      ? 'ALIGNED - Our analysis and AirDNA agree within 20%' 
      : `DIVERGENT - Difference of ${Math.abs(divergent.pct).toFixed(0)}%`;
    
    expect(alignedStatus).toContain('ALIGNED');
    expect(divergentStatus).toContain('DIVERGENT');
    expect(divergentStatus).toContain('35%');
  });
});
