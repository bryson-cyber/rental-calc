import { describe, expect, it } from "vitest";

/**
 * Tests for the purchase mode vs rent mode logic.
 * 
 * These are unit tests for the calculation logic that determines:
 * 1. In rent/arbitrage mode: rent is subtracted as an expense from revenue
 * 2. In purchase mode: rent is NOT an expense (you own the property), mortgage is the cost instead
 */

describe("Purchase mode cash flow calculations", () => {
  // Replicate the effectiveRent logic from LeadMagnet.tsx line 1331
  function calculateEffectiveRent(globalMode: 'rent' | 'purchase', rent: number): number {
    return globalMode === 'purchase' ? 0 : rent;
  }

  // Replicate the HeroRevenueCard profit calculation from TeslaDashboard.tsx
  function calculateMonthlyProfit(params: {
    annualRevenue: number;
    monthlyRent: number;
    expensePercent: number;
    mode: 'rent' | 'purchase';
    monthlyMortgage: number;
  }) {
    const monthlyRevenue = params.annualRevenue / 12;
    const monthlyExpenses = monthlyRevenue * (params.expensePercent / 100);
    const fixedCost = params.mode === 'purchase' ? params.monthlyMortgage : params.monthlyRent;
    const trueMonthlyProfit = monthlyRevenue - fixedCost - monthlyExpenses;
    return { monthlyRevenue, monthlyExpenses, fixedCost, trueMonthlyProfit };
  }

  describe("effectiveRent calculation", () => {
    it("returns 0 in purchase mode regardless of rent value", () => {
      expect(calculateEffectiveRent('purchase', 3795)).toBe(0);
      expect(calculateEffectiveRent('purchase', 5000)).toBe(0);
      expect(calculateEffectiveRent('purchase', 0)).toBe(0);
    });

    it("returns the actual rent in rent/arbitrage mode", () => {
      expect(calculateEffectiveRent('rent', 3795)).toBe(3795);
      expect(calculateEffectiveRent('rent', 2000)).toBe(2000);
      expect(calculateEffectiveRent('rent', 0)).toBe(0);
    });
  });

  describe("HeroRevenueCard profit calculation", () => {
    const baseParams = {
      annualRevenue: 128139, // ~$10,678/month
      expensePercent: 20,
    };

    it("uses rent as fixed cost in rent mode", () => {
      const result = calculateMonthlyProfit({
        ...baseParams,
        monthlyRent: 3795,
        mode: 'rent',
        monthlyMortgage: 2100,
      });
      
      // Fixed cost should be rent, not mortgage
      expect(result.fixedCost).toBe(3795);
      // Monthly revenue: 128139 / 12 = 10678.25
      expect(result.monthlyRevenue).toBeCloseTo(10678.25, 0);
      // Expenses: 10678.25 * 0.20 = 2135.65
      expect(result.monthlyExpenses).toBeCloseTo(2135.65, 0);
      // Profit: 10678.25 - 3795 - 2135.65 = 4747.60
      expect(result.trueMonthlyProfit).toBeCloseTo(4747.60, 0);
    });

    it("uses mortgage as fixed cost in purchase mode", () => {
      const result = calculateMonthlyProfit({
        ...baseParams,
        monthlyRent: 3795, // This should be ignored in purchase mode
        mode: 'purchase',
        monthlyMortgage: 2100,
      });
      
      // Fixed cost should be mortgage, not rent
      expect(result.fixedCost).toBe(2100);
      // Profit: 10678.25 - 2100 - 2135.65 = 6442.60
      expect(result.trueMonthlyProfit).toBeCloseTo(6442.60, 0);
    });

    it("handles cash purchase (no mortgage) correctly", () => {
      const result = calculateMonthlyProfit({
        ...baseParams,
        monthlyRent: 0,
        mode: 'purchase',
        monthlyMortgage: 0, // Cash purchase = no mortgage
      });
      
      expect(result.fixedCost).toBe(0);
      // Profit: 10678.25 - 0 - 2135.65 = 8542.60
      expect(result.trueMonthlyProfit).toBeCloseTo(8542.60, 0);
    });

    it("purchase mode profit is higher than rent mode when mortgage < rent", () => {
      const rentResult = calculateMonthlyProfit({
        ...baseParams,
        monthlyRent: 3795,
        mode: 'rent',
        monthlyMortgage: 2100,
      });
      
      const purchaseResult = calculateMonthlyProfit({
        ...baseParams,
        monthlyRent: 3795,
        mode: 'purchase',
        monthlyMortgage: 2100,
      });
      
      // Purchase mode should show higher profit because mortgage ($2100) < rent ($3795)
      expect(purchaseResult.trueMonthlyProfit).toBeGreaterThan(rentResult.trueMonthlyProfit);
    });

    it("correctly identifies unprofitable scenarios", () => {
      const result = calculateMonthlyProfit({
        annualRevenue: 24000, // $2000/month
        monthlyRent: 3000,
        mode: 'rent',
        monthlyMortgage: 0,
        expensePercent: 20,
      });
      
      // Revenue: $2000, Expenses: $400, Rent: $3000
      // Profit: 2000 - 3000 - 400 = -1400
      expect(result.trueMonthlyProfit).toBeLessThan(0);
      expect(result.trueMonthlyProfit).toBeCloseTo(-1400, 0);
    });
  });

  describe("Rent validation section visibility", () => {
    // Replicate the logic from TeslaDashboard.tsx line 2705-2707
    function shouldShowRentValidation(mode: string | undefined, rentometerData: any): boolean {
      return mode !== 'purchase' && !!rentometerData;
    }

    it("shows rent validation in rent mode when data exists", () => {
      expect(shouldShowRentValidation('rent', { median: 3000 })).toBe(true);
    });

    it("hides rent validation in purchase mode even when data exists", () => {
      expect(shouldShowRentValidation('purchase', { median: 3000 })).toBe(false);
    });

    it("hides rent validation when no data exists regardless of mode", () => {
      expect(shouldShowRentValidation('rent', null)).toBe(false);
      expect(shouldShowRentValidation('purchase', null)).toBe(false);
    });

    it("shows rent validation when mode is undefined (defaults to rent)", () => {
      expect(shouldShowRentValidation(undefined, { median: 3000 })).toBe(true);
    });
  });

  describe("Share button type selection", () => {
    // Replicate the logic from LeadMagnet.tsx line 2511-2543
    function getShareButtonType(activeTab: string, hasResult: boolean): 'universal' | 'tool' {
      if (activeTab === 'validate' && hasResult) {
        return 'universal'; // Uses UniversalShareButton → creates /share/:shareCode cached link
      }
      return 'tool'; // Uses ShareToolButton → creates deep-link with query params
    }

    it("uses UniversalShareButton when validate tab has results", () => {
      expect(getShareButtonType('validate', true)).toBe('universal');
    });

    it("uses ShareToolButton when validate tab has no results", () => {
      expect(getShareButtonType('validate', false)).toBe('tool');
    });

    it("uses ShareToolButton for other tabs regardless of results", () => {
      expect(getShareButtonType('prove', true)).toBe('tool');
      expect(getShareButtonType('market', true)).toBe('tool');
      expect(getShareButtonType('regulations', false)).toBe('tool');
    });
  });

  describe("Purchase props in shared report data", () => {
    // Verify that purchase props are included in the reportData stored for shared reports
    function buildShareableReportData(params: {
      result: any;
      globalMode: string;
      purchasePrice?: number;
      loanType?: string;
      downPaymentPercent?: number;
      interestRate?: number;
    }) {
      return {
        ...params.result,
        _mode: params.globalMode,
        _purchasePrice: params.purchasePrice,
        _loanType: params.loanType,
        _downPaymentPercent: params.downPaymentPercent,
        _interestRate: params.interestRate,
      };
    }

    it("includes purchase props when in purchase mode", () => {
      const data = buildShareableReportData({
        result: { revenue: { projected: 128139 } },
        globalMode: 'purchase',
        purchasePrice: 350000,
        loanType: 'conventional',
        downPaymentPercent: 20,
        interestRate: 7.0,
      });

      expect(data._mode).toBe('purchase');
      expect(data._purchasePrice).toBe(350000);
      expect(data._loanType).toBe('conventional');
      expect(data._downPaymentPercent).toBe(20);
      expect(data._interestRate).toBe(7.0);
    });

    it("has undefined purchase props in rent mode", () => {
      const data = buildShareableReportData({
        result: { revenue: { projected: 128139 } },
        globalMode: 'rent',
      });

      expect(data._mode).toBe('rent');
      expect(data._purchasePrice).toBeUndefined();
      expect(data._loanType).toBeUndefined();
    });

    it("preserves original result data", () => {
      const originalResult = { revenue: { projected: 128139 }, metrics: { adr: 480 } };
      const data = buildShareableReportData({
        result: originalResult,
        globalMode: 'purchase',
        purchasePrice: 350000,
      });

      expect(data.revenue.projected).toBe(128139);
      expect(data.metrics.adr).toBe(480);
    });
  });
});
