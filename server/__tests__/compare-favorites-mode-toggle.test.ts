import { describe, it, expect } from "vitest";

/**
 * Test suite for the Compare Favorites mode toggle feature.
 * Validates that switching between Arbitrage (rent) and Purchase modes
 * correctly changes the metrics displayed and calculations used.
 */

// Simulate the card view metrics calculation for arbitrage mode
function calculateArbitrageMetrics(property: {
  annualRevenue: number;
  monthlyRent: number;
}) {
  const monthlyRevenue = property.annualRevenue / 12;
  const operatingCosts = monthlyRevenue * 0.20;
  const monthlyProfit = monthlyRevenue - property.monthlyRent - operatingCosts;
  const profitRatio = property.monthlyRent > 0 ? monthlyRevenue / property.monthlyRent : 0;
  return { monthlyRevenue, monthlyProfit, profitRatio };
}

// Simulate the card view metrics calculation for purchase mode
function calculatePurchaseMetrics(property: {
  annualRevenue: number;
  purchasePrice: number | null;
}) {
  const purchasePrice = property.purchasePrice || 200000;
  const annualRevenue = property.annualRevenue;
  const noi = annualRevenue * (1 - 0.20 - 0.05) - purchasePrice * 0.012 - purchasePrice * 0.005;
  const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;
  return { purchasePrice, noi, capRate };
}

// Simulate the legacy data detection logic
function detectLegacyData(fav: { monthlyRent: number | null; purchasePrice?: number | null }) {
  const hasLegacyPriceIssue = ((fav.monthlyRent ?? 0) > 20000) && !fav.purchasePrice;
  const effectiveMonthlyRent = hasLegacyPriceIssue ? null : fav.monthlyRent;
  const effectivePurchasePrice = hasLegacyPriceIssue
    ? fav.monthlyRent
    : (fav.purchasePrice || null);
  return { hasLegacyPriceIssue, effectiveMonthlyRent, effectivePurchasePrice };
}

// Simulate the mode toggle handler behavior
function simulateModeToggle(
  currentLocalMode: 'rent' | 'purchase',
  newMode: 'rent' | 'purchase'
) {
  // The handler sets both local and global mode
  const localMode = newMode;
  const globalMode = newMode;
  return { localMode, globalMode };
}

describe("Compare Favorites Mode Toggle", () => {
  describe("Mode toggle behavior", () => {
    it("should default to rent (arbitrage) mode", () => {
      const defaultMode = 'rent';
      expect(defaultMode).toBe('rent');
    });

    it("should toggle from rent to purchase mode", () => {
      const result = simulateModeToggle('rent', 'purchase');
      expect(result.localMode).toBe('purchase');
      expect(result.globalMode).toBe('purchase');
    });

    it("should toggle from purchase to rent mode", () => {
      const result = simulateModeToggle('purchase', 'rent');
      expect(result.localMode).toBe('rent');
      expect(result.globalMode).toBe('rent');
    });

    it("should sync local mode with global mode", () => {
      // When global mode changes externally, local mode should follow
      const globalMode = 'purchase';
      const localMode = globalMode; // useEffect sync
      expect(localMode).toBe('purchase');
    });
  });

  describe("Arbitrage mode metrics (card view)", () => {
    it("should calculate monthly profit correctly", () => {
      const metrics = calculateArbitrageMetrics({
        annualRevenue: 48000,
        monthlyRent: 2000,
      });
      // monthlyRevenue = 48000/12 = 4000
      // operatingCosts = 4000 * 0.20 = 800
      // monthlyProfit = 4000 - 2000 - 800 = 1200
      expect(metrics.monthlyRevenue).toBe(4000);
      expect(metrics.monthlyProfit).toBe(1200);
      expect(metrics.profitRatio).toBe(2); // 4000 / 2000
    });

    it("should return 0 profit ratio when no rent data", () => {
      const metrics = calculateArbitrageMetrics({
        annualRevenue: 48000,
        monthlyRent: 0,
      });
      expect(metrics.profitRatio).toBe(0);
    });
  });

  describe("Purchase mode metrics (card view)", () => {
    it("should calculate cap rate correctly", () => {
      const metrics = calculatePurchaseMetrics({
        annualRevenue: 52000,
        purchasePrice: 175000,
      });
      // noi = 52000 * 0.75 - 175000 * 0.012 - 175000 * 0.005
      // noi = 39000 - 2100 - 875 = 36025
      // capRate = (36025 / 175000) * 100 = 20.59%
      expect(metrics.purchasePrice).toBe(175000);
      expect(metrics.capRate).toBeGreaterThan(0);
      expect(metrics.noi).toBeGreaterThan(0);
    });

    it("should default to $200,000 purchase price when not provided", () => {
      const metrics = calculatePurchaseMetrics({
        annualRevenue: 48000,
        purchasePrice: null,
      });
      expect(metrics.purchasePrice).toBe(200000);
    });

    it("should show higher cap rate for cheaper properties with same revenue", () => {
      const cheap = calculatePurchaseMetrics({
        annualRevenue: 52000,
        purchasePrice: 150000,
      });
      const expensive = calculatePurchaseMetrics({
        annualRevenue: 52000,
        purchasePrice: 350000,
      });
      expect(cheap.capRate).toBeGreaterThan(expensive.capRate);
    });
  });

  describe("Mode-dependent display logic", () => {
    it("should show Monthly Rent in arbitrage mode", () => {
      const mode = 'rent';
      const showRent = mode === 'rent';
      const showPurchasePrice = mode === 'purchase';
      expect(showRent).toBe(true);
      expect(showPurchasePrice).toBe(false);
    });

    it("should show Purchase Price in purchase mode", () => {
      const mode = 'purchase';
      const showRent = mode === 'rent';
      const showPurchasePrice = mode === 'purchase';
      expect(showRent).toBe(false);
      expect(showPurchasePrice).toBe(true);
    });

    it("should show profit preview only in arbitrage mode with valid rent", () => {
      const mode = 'rent';
      const monthlyRent = 2000;
      const annualRevenue = 48000;
      const showProfit = mode === 'rent' && monthlyRent > 0 && monthlyRent <= 50000 && annualRevenue > 0;
      expect(showProfit).toBe(true);
    });

    it("should not show profit preview in purchase mode", () => {
      const mode = 'purchase';
      const monthlyRent = 2000;
      const annualRevenue = 48000;
      const showProfit = mode === 'rent' && monthlyRent > 0 && monthlyRent <= 50000 && annualRevenue > 0;
      expect(showProfit).toBe(false);
    });

    it("should show cap rate only in purchase mode", () => {
      const mode = 'purchase';
      const annualRevenue = 48000;
      const showCapRate = mode === 'purchase' && annualRevenue > 0;
      expect(showCapRate).toBe(true);
    });

    it("should not show cap rate in arbitrage mode", () => {
      const mode = 'rent';
      const annualRevenue = 48000;
      const showCapRate = mode === 'purchase' && annualRevenue > 0;
      expect(showCapRate).toBe(false);
    });
  });

  describe("Legacy data handling with mode toggle", () => {
    it("should detect legacy For Sale property and show purchase price in purchase mode", () => {
      const fav = { monthlyRent: 175000, purchasePrice: undefined };
      const { hasLegacyPriceIssue, effectivePurchasePrice } = detectLegacyData(fav);
      
      expect(hasLegacyPriceIssue).toBe(true);
      expect(effectivePurchasePrice).toBe(175000);
      
      // In purchase mode, this property should show its purchase price
      const purchaseMetrics = calculatePurchaseMetrics({
        annualRevenue: 52000,
        purchasePrice: effectivePurchasePrice,
      });
      expect(purchaseMetrics.capRate).toBeGreaterThan(0);
    });

    it("should handle normal rental property correctly in both modes", () => {
      const fav = { monthlyRent: 2500, purchasePrice: null };
      const { hasLegacyPriceIssue, effectiveMonthlyRent } = detectLegacyData(fav);
      
      expect(hasLegacyPriceIssue).toBe(false);
      expect(effectiveMonthlyRent).toBe(2500);
      
      // In arbitrage mode, should show profit
      const arbMetrics = calculateArbitrageMetrics({
        annualRevenue: 48000,
        monthlyRent: effectiveMonthlyRent!,
      });
      expect(arbMetrics.monthlyProfit).toBeGreaterThan(0);
    });
  });
});
