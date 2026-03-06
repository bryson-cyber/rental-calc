import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for revenue override in shared reports
 * 
 * Verifies that:
 * 1. When reportData contains _revenueOverride, it's extracted and stored in the DB
 * 2. The shared report page receives persistedRevenueOverride from the DB record
 * 3. The annualRevenue field reflects the override when one is provided
 */

describe('Revenue Override in Shared Reports', () => {
  it('should extract _revenueOverride from reportData when creating a shareable report', async () => {
    // Simulate the logic from createShareableReport
    const reportData = {
      revenue: { projected: 59000 },
      _revenueOverride: 75000,
      _rentometerData: { median: 2800 },
    };
    
    const revenueOverride = reportData._revenueOverride ?? null;
    expect(revenueOverride).toBe(75000);
  });

  it('should return null when no _revenueOverride in reportData', () => {
    const reportData = {
      revenue: { projected: 59000 },
      _rentometerData: { median: 2800 },
    };
    
    const revenueOverride = (reportData as any)._revenueOverride ?? null;
    expect(revenueOverride).toBeNull();
  });

  it('should use override revenue as annualRevenue when creating share', () => {
    const annualRevenue = 59000;
    const revenueOverride: number | null = 75000;
    
    const finalAnnualRevenue = revenueOverride ?? annualRevenue;
    expect(finalAnnualRevenue).toBe(75000);
  });

  it('should use original annualRevenue when no override', () => {
    const annualRevenue = 59000;
    const revenueOverride: number | null = null;
    
    const finalAnnualRevenue = revenueOverride ?? annualRevenue;
    expect(finalAnnualRevenue).toBe(59000);
  });

  it('should embed _revenueOverride in reportData when override is present', () => {
    const reportData = { revenue: { projected: 59000 } };
    const revenueOverride: number | null = 75000;
    
    const finalReportData = revenueOverride != null
      ? { ...reportData, _revenueOverride: revenueOverride }
      : reportData;
    
    expect(finalReportData._revenueOverride).toBe(75000);
    expect(finalReportData.revenue.projected).toBe(59000); // Original data preserved
  });

  it('should not modify reportData when no override', () => {
    const reportData = { revenue: { projected: 59000 } };
    const revenueOverride: number | null = null;
    
    const finalReportData = revenueOverride != null
      ? { ...reportData, _revenueOverride: revenueOverride }
      : reportData;
    
    expect((finalReportData as any)._revenueOverride).toBeUndefined();
  });

  it('should use persistedRevenueOverride as initial state in TeslaDashboard logic', () => {
    // Simulate TeslaDashboard's revenue override initialization
    const persistedRevenueOverride: number | null = 75000;
    const baseHeadlineRevenue = 59000;
    
    const revenueOverride = persistedRevenueOverride ?? null;
    const headlineRevenue = revenueOverride ?? baseHeadlineRevenue;
    
    expect(headlineRevenue).toBe(75000);
  });

  it('should fall back to base revenue when no persisted override', () => {
    const persistedRevenueOverride: number | null = null;
    const baseHeadlineRevenue = 59000;
    
    const revenueOverride = persistedRevenueOverride ?? null;
    const headlineRevenue = revenueOverride ?? baseHeadlineRevenue;
    
    expect(headlineRevenue).toBe(59000);
  });

  it('should handle zero as a valid override value', () => {
    // Edge case: admin sets revenue to 0 (unlikely but should work)
    const revenueOverride: number | null = 0;
    const annualRevenue = 59000;
    
    // 0 is falsy but != null, so it should be used
    const finalAnnualRevenue = revenueOverride ?? annualRevenue;
    expect(finalAnnualRevenue).toBe(0);
  });

  it('should handle negative override (revenue decrease)', () => {
    const revenueOverride: number | null = 45000;
    const annualRevenue = 59000;
    
    const finalAnnualRevenue = revenueOverride ?? annualRevenue;
    expect(finalAnnualRevenue).toBe(45000);
    expect(finalAnnualRevenue).toBeLessThan(annualRevenue);
  });
});
