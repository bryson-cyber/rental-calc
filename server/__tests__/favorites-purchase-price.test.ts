import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Test suite for the purchasePrice field in favorites
 * Validates that the favorites.add input schema properly accepts purchasePrice
 * and that the ComparisonDashboard logic handles For Sale vs For Rent correctly
 */

// Replicate the favorites.add input schema
const favoritesAddSchema = z.object({
  sessionId: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().optional(),
  propertyType: z.string().optional(),
  marketId: z.string().optional(),
  marketName: z.string().optional(),
  annualRevenue: z.number().int().optional(),
  monthlyRevenue: z.number().int().optional(),
  occupancyRate: z.number().optional(),
  averageDailyRate: z.number().int().optional(),
  monthlyRent: z.number().int().optional(),
  estimatedProfit: z.number().int().optional(),
  purchasePrice: z.number().int().optional(),
  zillowUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  notes: z.string().optional(),
});

// Replicate the calculateMetrics logic for testing
function calculateMetrics(property: {
  annualRevenue: number;
  occupancyRate: number;
  averageDailyRate: number;
  monthlyRent: number | null;
  purchasePrice?: number | null;
}, mode: 'rent' | 'purchase') {
  const annualRevenue = property.annualRevenue || 0;
  const monthlyRevenue = annualRevenue / 12;
  const occupancy = property.occupancyRate || 0;
  const adr = property.averageDailyRate || 0;

  if (mode === 'rent') {
    const monthlyRent = property.monthlyRent || 0;
    const expenseRate = 0.20;
    const hasRentData = monthlyRent > 0;
    const monthlyProfit = hasRentData ? monthlyRevenue * (1 - expenseRate) - monthlyRent : 0;
    const annualProfit = monthlyProfit * 12;
    const profitRatio = hasRentData ? monthlyRevenue / monthlyRent : 0;

    return {
      monthlyRevenue,
      monthlyRent,
      monthlyProfit,
      annualProfit,
      profitRatio,
      occupancy: occupancy * 100,
      adr,
      cashFlow: null,
      cashOnCash: null,
      capRate: null,
      purchasePrice: null,
    };
  } else {
    const purchasePrice = property.purchasePrice || 200000;
    const downPaymentPercent = 20;
    const interestRate = 7;

    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPayment;

    const monthlyRate = interestRate / 100 / 12;
    const numPayments = 30 * 12;
    const monthlyMortgage = loanAmount > 0
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      : 0;

    const annualPropertyTax = purchasePrice * 0.012;
    const annualInsurance = purchasePrice * 0.005;
    const annualManagement = annualRevenue * 0.20;
    const annualMaintenance = annualRevenue * 0.05;
    const totalAnnualExpenses = annualPropertyTax + annualInsurance + annualManagement + annualMaintenance;

    const noi = annualRevenue - totalAnnualExpenses;
    const annualMortgage = monthlyMortgage * 12;
    const annualCashFlow = noi - annualMortgage;
    const monthlyCashFlow = annualCashFlow / 12;

    const closingCosts = purchasePrice * 0.03;
    const startupCosts = 5000;
    const totalCashInvested = downPayment + closingCosts + startupCosts;
    const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;
    const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;

    return {
      monthlyRevenue,
      monthlyRent: null,
      monthlyProfit: null,
      annualProfit: null,
      profitRatio: null,
      occupancy: occupancy * 100,
      adr,
      cashFlow: monthlyCashFlow,
      cashOnCash,
      capRate,
      purchasePrice,
    };
  }
}

describe("Favorites purchasePrice field", () => {
  describe("Schema validation", () => {
    it("should accept For Rent property with monthlyRent and no purchasePrice", () => {
      const input = {
        address: "123 Main St, Denver, CO",
        sessionId: "test-session",
        monthlyRent: 2500,
        annualRevenue: 48000,
      };
      const result = favoritesAddSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.monthlyRent).toBe(2500);
        expect(result.data.purchasePrice).toBeUndefined();
      }
    });

    it("should accept For Sale property with purchasePrice and no monthlyRent", () => {
      const input = {
        address: "456 Oak Ave, Denver, CO",
        sessionId: "test-session",
        purchasePrice: 175000,
        annualRevenue: 52000,
      };
      const result = favoritesAddSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.purchasePrice).toBe(175000);
        expect(result.data.monthlyRent).toBeUndefined();
      }
    });

    it("should accept property with both monthlyRent and purchasePrice", () => {
      const input = {
        address: "789 Elm St, Denver, CO",
        sessionId: "test-session",
        monthlyRent: 2000,
        purchasePrice: 250000,
        annualRevenue: 45000,
      };
      const result = favoritesAddSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.monthlyRent).toBe(2000);
        expect(result.data.purchasePrice).toBe(250000);
      }
    });

    it("should reject non-integer purchasePrice", () => {
      const input = {
        address: "123 Main St, Denver, CO",
        sessionId: "test-session",
        purchasePrice: 175000.50,
      };
      const result = favoritesAddSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("Metrics calculation - Rent mode", () => {
    it("should calculate profit correctly for For Rent property", () => {
      const property = {
        annualRevenue: 48000,
        occupancyRate: 0.75,
        averageDailyRate: 175,
        monthlyRent: 2000,
        purchasePrice: null,
      };
      const metrics = calculateMetrics(property, 'rent');
      expect(metrics.monthlyRent).toBe(2000);
      expect(metrics.monthlyRevenue).toBe(4000);
      // monthlyProfit = 4000 * 0.8 - 2000 = 1200
      expect(metrics.monthlyProfit).toBe(1200);
      expect(metrics.profitRatio).toBe(2); // 4000 / 2000
    });

    it("should return zero profit for For Sale property in rent mode (no rent data)", () => {
      const property = {
        annualRevenue: 52000,
        occupancyRate: 0.80,
        averageDailyRate: 200,
        monthlyRent: null,
        purchasePrice: 175000,
      };
      const metrics = calculateMetrics(property, 'rent');
      expect(metrics.monthlyRent).toBe(0);
      expect(metrics.monthlyProfit).toBe(0);
      expect(metrics.profitRatio).toBe(0);
    });
  });

  describe("Metrics calculation - Purchase mode", () => {
    it("should use purchasePrice for purchase mode calculations", () => {
      const property = {
        annualRevenue: 52000,
        occupancyRate: 0.80,
        averageDailyRate: 200,
        monthlyRent: null,
        purchasePrice: 175000,
      };
      const metrics = calculateMetrics(property, 'purchase');
      expect(metrics.purchasePrice).toBe(175000);
      expect(metrics.capRate).toBeGreaterThan(0);
      expect(metrics.cashOnCash).toBeDefined();
      expect(metrics.cashFlow).toBeDefined();
    });

    it("should default to $200,000 if no purchasePrice provided", () => {
      const property = {
        annualRevenue: 48000,
        occupancyRate: 0.75,
        averageDailyRate: 175,
        monthlyRent: 2000,
        purchasePrice: null,
      };
      const metrics = calculateMetrics(property, 'purchase');
      expect(metrics.purchasePrice).toBe(200000);
    });

    it("should calculate higher cap rate for lower purchase price", () => {
      const baseProperty = {
        annualRevenue: 52000,
        occupancyRate: 0.80,
        averageDailyRate: 200,
        monthlyRent: null,
      };

      const cheapProperty = { ...baseProperty, purchasePrice: 150000 };
      const expensiveProperty = { ...baseProperty, purchasePrice: 350000 };

      const cheapMetrics = calculateMetrics(cheapProperty, 'purchase');
      const expensiveMetrics = calculateMetrics(expensiveProperty, 'purchase');

      expect(cheapMetrics.capRate!).toBeGreaterThan(expensiveMetrics.capRate!);
    });
  });

  describe("Legacy data handling", () => {
    it("should detect legacy For Sale property with price stored as monthlyRent", () => {
      // Simulate the CompareFavoritesSection logic for legacy data
      const fav = {
        monthlyRent: 175000, // This was a purchase price stored incorrectly
        purchasePrice: undefined,
      };
      
      const hasLegacyPriceIssue = (fav.monthlyRent ?? 0) > 20000 && !fav.purchasePrice;
      const effectiveMonthlyRent = hasLegacyPriceIssue ? null : fav.monthlyRent;
      const effectivePurchasePrice = hasLegacyPriceIssue ? fav.monthlyRent : (fav.purchasePrice || null);

      expect(hasLegacyPriceIssue).toBe(true);
      expect(effectiveMonthlyRent).toBeNull();
      expect(effectivePurchasePrice).toBe(175000);
    });

    it("should not flag normal rent as legacy issue", () => {
      const fav = {
        monthlyRent: 2500,
        purchasePrice: undefined,
      };
      
      const hasLegacyPriceIssue = (fav.monthlyRent ?? 0) > 20000 && !fav.purchasePrice;
      expect(hasLegacyPriceIssue).toBe(false);
    });

    it("should not flag property with both purchasePrice and high monthlyRent as legacy", () => {
      const fav = {
        monthlyRent: 25000, // Very expensive rental
        purchasePrice: 500000,
      };
      
      const hasLegacyPriceIssue = (fav.monthlyRent ?? 0) > 20000 && !fav.purchasePrice;
      expect(hasLegacyPriceIssue).toBe(false);
    });
  });
});
