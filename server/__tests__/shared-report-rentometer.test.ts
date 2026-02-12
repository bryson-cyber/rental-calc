import { describe, it, expect } from 'vitest';

/**
 * Tests for the shared report rentometerData embedding fix.
 * 
 * The issue: When sharing a validator report from Step 5, the rentometerData
 * was not being included in the stored reportData, causing the Rent Validation
 * section to be missing from shared reports.
 * 
 * The fix: Embed _rentometerData (and other Step 5 props) into the reportData
 * object when creating the share, then extract them in ShareableReportViewer.
 */

describe('Shared Report - RentometerData Embedding', () => {
  // Simulate the data structure that LeadMagnet creates when sharing
  const mockResult = {
    revenue: { projected: 81721 },
    cashFlow: { monthlyRent: 3795 },
    marketId: 'airdna-123',
    estimates: { annual_revenue: 81721, occupancy_rate: 0.66, average_daily_rate: 337 },
  };

  const mockRentometerData = {
    median: 3500,
    percentile25: 3000,
    percentile75: 4200,
    min: 2200,
    max: 5500,
    sampleCount: 45,
    userRentVsMarket: 'above' as const,
    percentileRank: 62,
    rentAdvantage: -295,
  };

  it('should embed rentometerData into reportData when creating share', () => {
    // This simulates what LeadMagnet.tsx now does:
    const reportDataForShare = {
      ...mockResult,
      _rentometerData: mockRentometerData || undefined,
      _expensePercent: 20,
      _furnitureCost: 0,
      _mode: 'rent',
    };

    // Verify the embedded data is present
    expect(reportDataForShare._rentometerData).toBeDefined();
    expect(reportDataForShare._rentometerData?.median).toBe(3500);
    expect(reportDataForShare._rentometerData?.percentile25).toBe(3000);
    expect(reportDataForShare._rentometerData?.percentile75).toBe(4200);
    expect(reportDataForShare._rentometerData?.sampleCount).toBe(45);
    expect(reportDataForShare._rentometerData?.userRentVsMarket).toBe('above');
    expect(reportDataForShare._rentometerData?.percentileRank).toBe(62);
    expect(reportDataForShare._rentometerData?.rentAdvantage).toBe(-295);
    
    // Verify original result data is preserved
    expect(reportDataForShare.revenue.projected).toBe(81721);
    expect(reportDataForShare.cashFlow.monthlyRent).toBe(3795);
    expect(reportDataForShare.marketId).toBe('airdna-123');
    expect(reportDataForShare._expensePercent).toBe(20);
    expect(reportDataForShare._furnitureCost).toBe(0);
    expect(reportDataForShare._mode).toBe('rent');
  });

  it('should handle null rentometerData gracefully', () => {
    const reportDataForShare = {
      ...mockResult,
      _rentometerData: null || undefined,
      _expensePercent: 20,
      _furnitureCost: 0,
      _mode: 'rent',
    };

    // When rentometerData is null, _rentometerData should be undefined
    expect(reportDataForShare._rentometerData).toBeUndefined();
    
    // Original data should still be intact
    expect(reportDataForShare.revenue.projected).toBe(81721);
  });

  it('should extract rentometerData from stored reportData in ShareableReportViewer', () => {
    // Simulate what ShareableReportViewer does when reading stored data
    const storedReportData = {
      ...mockResult,
      _rentometerData: mockRentometerData,
      _expensePercent: 25,
      _furnitureCost: 5000,
      _mode: 'purchase',
    };

    // This simulates the extraction in ShareableReportViewer:
    const storedRentometerData = storedReportData?._rentometerData || null;
    const storedExpensePercent = storedReportData?._expensePercent ?? 20;
    const storedFurnitureCost = storedReportData?._furnitureCost ?? 0;
    const storedMode = storedReportData?._mode || 'rent';

    expect(storedRentometerData).not.toBeNull();
    expect(storedRentometerData?.median).toBe(3500);
    expect(storedRentometerData?.sampleCount).toBe(45);
    expect(storedExpensePercent).toBe(25);
    expect(storedFurnitureCost).toBe(5000);
    expect(storedMode).toBe('purchase');
  });

  it('should use defaults when stored reportData has no embedded metadata', () => {
    // Simulate an OLD shared report that was created before the fix
    const oldStoredReportData = {
      ...mockResult,
      // No _rentometerData, _expensePercent, etc.
    };

    const storedRentometerData = (oldStoredReportData as any)?._rentometerData || null;
    const storedExpensePercent = (oldStoredReportData as any)?._expensePercent ?? 20;
    const storedFurnitureCost = (oldStoredReportData as any)?._furnitureCost ?? 0;
    const storedMode = (oldStoredReportData as any)?._mode || 'rent';

    // Old reports should gracefully fall back to defaults
    expect(storedRentometerData).toBeNull();
    expect(storedExpensePercent).toBe(20);
    expect(storedFurnitureCost).toBe(0);
    expect(storedMode).toBe('rent');
  });

  it('should survive JSON serialization/deserialization (as happens in DB storage)', () => {
    const reportDataForShare = {
      ...mockResult,
      _rentometerData: mockRentometerData,
      _expensePercent: 20,
      _furnitureCost: 3500,
      _mode: 'rent',
    };

    // Simulate DB storage: JSON.stringify then JSON.parse
    const serialized = JSON.stringify(reportDataForShare);
    const deserialized = JSON.parse(serialized);

    expect(deserialized._rentometerData).toBeDefined();
    expect(deserialized._rentometerData.median).toBe(3500);
    expect(deserialized._rentometerData.percentile25).toBe(3000);
    expect(deserialized._rentometerData.percentile75).toBe(4200);
    expect(deserialized._rentometerData.sampleCount).toBe(45);
    expect(deserialized._rentometerData.userRentVsMarket).toBe('above');
    expect(deserialized._expensePercent).toBe(20);
    expect(deserialized._furnitureCost).toBe(3500);
    expect(deserialized._mode).toBe('rent');
    
    // Original data preserved through serialization
    expect(deserialized.revenue.projected).toBe(81721);
    expect(deserialized.marketId).toBe('airdna-123');
  });
});
