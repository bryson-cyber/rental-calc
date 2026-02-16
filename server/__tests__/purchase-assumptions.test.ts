/**
 * Tests for Purchase Assumptions feature in ComparisonDashboard
 * Tests the calculateMetrics function with various assumption configurations
 */
import { describe, it, expect } from 'vitest';

// Replicate the core calculation logic from ComparisonDashboard for testing
interface PurchaseAssumptions {
  downPaymentPercent: number;
  interestRate: number;
  loanTermYears: number;
  closingCostPercent: number;
  propertyTaxPercent: number;
  insurancePercent: number;
  managementPercent: number;
  maintenancePercent: number;
  startupCosts: number;
}

const DEFAULT_ASSUMPTIONS: PurchaseAssumptions = {
  downPaymentPercent: 20,
  interestRate: 7,
  loanTermYears: 30,
  closingCostPercent: 3,
  propertyTaxPercent: 1.2,
  insurancePercent: 0.5,
  managementPercent: 20,
  maintenancePercent: 5,
  startupCosts: 5000,
};

interface TestProperty {
  annualRevenue: number;
  occupancyRate: number;
  averageDailyRate: number;
  monthlyRent: number | null;
  purchasePrice: number | null;
}

function calculatePurchaseMetrics(
  property: TestProperty,
  assumptions: PurchaseAssumptions,
  priceOverride?: number
) {
  const annualRevenue = property.annualRevenue || 0;
  const purchasePrice = priceOverride ?? property.purchasePrice ?? 200000;
  const { downPaymentPercent, interestRate, loanTermYears, closingCostPercent, propertyTaxPercent, insurancePercent, managementPercent, maintenancePercent, startupCosts } = assumptions;

  const downPayment = purchasePrice * (downPaymentPercent / 100);
  const loanAmount = purchasePrice - downPayment;

  // Monthly mortgage
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTermYears * 12;
  const monthlyMortgage = loanAmount > 0 && monthlyRate > 0
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : loanAmount > 0 ? loanAmount / numPayments : 0;

  // Expenses
  const annualPropertyTax = purchasePrice * (propertyTaxPercent / 100);
  const annualInsurance = purchasePrice * (insurancePercent / 100);
  const annualManagement = annualRevenue * (managementPercent / 100);
  const annualMaintenance = annualRevenue * (maintenancePercent / 100);
  const totalAnnualExpenses = annualPropertyTax + annualInsurance + annualManagement + annualMaintenance;

  // NOI
  const noi = annualRevenue - totalAnnualExpenses;

  // Cash flow
  const annualMortgage = monthlyMortgage * 12;
  const annualCashFlow = noi - annualMortgage;
  const monthlyCashFlow = annualCashFlow / 12;

  // CoC
  const closingCosts = purchasePrice * (closingCostPercent / 100);
  const totalCashInvested = downPayment + closingCosts + startupCosts;
  const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;

  // Cap Rate
  const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;

  return {
    monthlyCashFlow,
    annualCashFlow,
    cashOnCash,
    capRate,
    purchasePrice,
    monthlyMortgage,
    totalCashInvested,
    noi,
    downPayment,
    loanAmount,
    totalAnnualExpenses,
  };
}

const sampleProperty: TestProperty = {
  annualRevenue: 60000,
  occupancyRate: 0.75,
  averageDailyRate: 220,
  monthlyRent: null,
  purchasePrice: 300000,
};

describe('Purchase Assumptions - Default Calculations', () => {
  it('should calculate correct down payment with default 20%', () => {
    const result = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS);
    expect(result.downPayment).toBe(60000); // 300000 * 0.20
  });

  it('should calculate correct loan amount', () => {
    const result = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS);
    expect(result.loanAmount).toBe(240000); // 300000 - 60000
  });

  it('should calculate positive monthly mortgage', () => {
    const result = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS);
    expect(result.monthlyMortgage).toBeGreaterThan(0);
    // 30yr at 7% on 240k should be ~$1,597/mo
    expect(result.monthlyMortgage).toBeCloseTo(1597, -1);
  });

  it('should calculate total annual expenses correctly', () => {
    const result = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS);
    // Property tax: 300000 * 0.012 = 3600
    // Insurance: 300000 * 0.005 = 1500
    // Management: 60000 * 0.20 = 12000
    // Maintenance: 60000 * 0.05 = 3000
    // Total: 20100
    expect(result.totalAnnualExpenses).toBeCloseTo(20100, 0);
  });

  it('should calculate NOI correctly', () => {
    const result = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS);
    // NOI = 60000 - 20100 = 39900
    expect(result.noi).toBeCloseTo(39900, 0);
  });

  it('should calculate cap rate correctly', () => {
    const result = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS);
    // Cap rate = NOI / Price = 39900 / 300000 = 13.3%
    expect(result.capRate).toBeCloseTo(13.3, 0);
  });

  it('should calculate total cash invested correctly', () => {
    const result = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS);
    // Down: 60000, Closing: 300000 * 0.03 = 9000, Startup: 5000
    // Total: 74000
    expect(result.totalCashInvested).toBe(74000);
  });
});

describe('Purchase Assumptions - Custom Values', () => {
  it('should recalculate with 10% down payment', () => {
    const custom = { ...DEFAULT_ASSUMPTIONS, downPaymentPercent: 10 };
    const result = calculatePurchaseMetrics(sampleProperty, custom);
    expect(result.downPayment).toBe(30000);
    expect(result.loanAmount).toBe(270000);
    // Higher loan = higher mortgage
    expect(result.monthlyMortgage).toBeGreaterThan(
      calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS).monthlyMortgage!
    );
  });

  it('should recalculate with lower interest rate', () => {
    const custom = { ...DEFAULT_ASSUMPTIONS, interestRate: 5 };
    const result = calculatePurchaseMetrics(sampleProperty, custom);
    // Lower rate = lower mortgage = better cash flow
    const defaultResult = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS);
    expect(result.monthlyMortgage).toBeLessThan(defaultResult.monthlyMortgage!);
    expect(result.monthlyCashFlow).toBeGreaterThan(defaultResult.monthlyCashFlow);
  });

  it('should recalculate with 15-year loan term', () => {
    const custom = { ...DEFAULT_ASSUMPTIONS, loanTermYears: 15 };
    const result = calculatePurchaseMetrics(sampleProperty, custom);
    // Shorter term = higher monthly payment
    const defaultResult = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS);
    expect(result.monthlyMortgage).toBeGreaterThan(defaultResult.monthlyMortgage!);
  });

  it('should recalculate with 0% management (self-managed)', () => {
    const custom = { ...DEFAULT_ASSUMPTIONS, managementPercent: 0 };
    const result = calculatePurchaseMetrics(sampleProperty, custom);
    const defaultResult = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS);
    // No management fee = higher NOI = better cash flow
    expect(result.noi).toBeGreaterThan(defaultResult.noi!);
    expect(result.monthlyCashFlow).toBeGreaterThan(defaultResult.monthlyCashFlow);
  });

  it('should recalculate with higher closing costs', () => {
    const custom = { ...DEFAULT_ASSUMPTIONS, closingCostPercent: 6 };
    const result = calculatePurchaseMetrics(sampleProperty, custom);
    // Higher closing costs = more cash invested = lower CoC
    const defaultResult = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS);
    expect(result.totalCashInvested).toBeGreaterThan(defaultResult.totalCashInvested);
    expect(result.cashOnCash).toBeLessThan(defaultResult.cashOnCash);
  });

  it('should handle 100% down payment (no mortgage)', () => {
    const custom = { ...DEFAULT_ASSUMPTIONS, downPaymentPercent: 100 };
    const result = calculatePurchaseMetrics(sampleProperty, custom);
    expect(result.loanAmount).toBe(0);
    expect(result.monthlyMortgage).toBe(0);
    // Cash flow should be NOI / 12 (no mortgage payment)
    expect(result.monthlyCashFlow).toBeCloseTo(result.noi! / 12, 0);
  });

  it('should handle 0% interest rate', () => {
    const custom = { ...DEFAULT_ASSUMPTIONS, interestRate: 0 };
    const result = calculatePurchaseMetrics(sampleProperty, custom);
    // 0% rate: monthly payment = loan / numPayments
    expect(result.monthlyMortgage).toBeCloseTo(240000 / 360, 0);
  });
});

describe('Purchase Assumptions - Price Override', () => {
  it('should use override price instead of property price', () => {
    const result = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS, 250000);
    expect(result.purchasePrice).toBe(250000);
    expect(result.downPayment).toBe(50000); // 250000 * 0.20
  });

  it('should recalculate all metrics with override price', () => {
    const original = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS);
    const overridden = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS, 200000);
    
    // Lower price = lower mortgage = better cash flow
    expect(overridden.monthlyMortgage).toBeLessThan(original.monthlyMortgage!);
    expect(overridden.monthlyCashFlow).toBeGreaterThan(original.monthlyCashFlow);
  });

  it('should use default 200000 when no price available', () => {
    const noPriceProperty = { ...sampleProperty, purchasePrice: null };
    const result = calculatePurchaseMetrics(noPriceProperty, DEFAULT_ASSUMPTIONS);
    expect(result.purchasePrice).toBe(200000);
  });

  it('should prefer override over property price', () => {
    const result = calculatePurchaseMetrics(sampleProperty, DEFAULT_ASSUMPTIONS, 500000);
    expect(result.purchasePrice).toBe(500000);
    // Not 300000 (property price)
    expect(result.downPayment).toBe(100000); // 500000 * 0.20
  });
});

describe('Purchase Assumptions - Edge Cases', () => {
  it('should handle zero revenue property', () => {
    const zeroRevProperty = { ...sampleProperty, annualRevenue: 0 };
    const result = calculatePurchaseMetrics(zeroRevProperty, DEFAULT_ASSUMPTIONS);
    // No revenue = negative cash flow
    expect(result.monthlyCashFlow).toBeLessThan(0);
    expect(result.cashOnCash).toBeLessThan(0);
  });

  it('should handle very high revenue property', () => {
    const highRevProperty = { ...sampleProperty, annualRevenue: 200000 };
    const result = calculatePurchaseMetrics(highRevProperty, DEFAULT_ASSUMPTIONS);
    expect(result.monthlyCashFlow).toBeGreaterThan(0);
    expect(result.cashOnCash).toBeGreaterThan(20);
  });

  it('should handle all expenses at zero', () => {
    const noExpenses: PurchaseAssumptions = {
      downPaymentPercent: 100,
      interestRate: 0,
      loanTermYears: 30,
      closingCostPercent: 0,
      propertyTaxPercent: 0,
      insurancePercent: 0,
      managementPercent: 0,
      maintenancePercent: 0,
      startupCosts: 0,
    };
    const result = calculatePurchaseMetrics(sampleProperty, noExpenses);
    // NOI = revenue (no expenses), cash flow = NOI (no mortgage)
    expect(result.noi).toBe(60000);
    expect(result.monthlyCashFlow).toBeCloseTo(5000, 0);
  });

  it('should handle max expenses scenario', () => {
    const maxExpenses: PurchaseAssumptions = {
      downPaymentPercent: 5,
      interestRate: 15,
      loanTermYears: 30,
      closingCostPercent: 10,
      propertyTaxPercent: 5,
      insurancePercent: 3,
      managementPercent: 40,
      maintenancePercent: 20,
      startupCosts: 50000,
    };
    const result = calculatePurchaseMetrics(sampleProperty, maxExpenses);
    // Very high expenses should result in negative cash flow
    expect(result.monthlyCashFlow).toBeLessThan(0);
  });
});

describe('Default Assumptions Constant', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_ASSUMPTIONS.downPaymentPercent).toBe(20);
    expect(DEFAULT_ASSUMPTIONS.interestRate).toBe(7);
    expect(DEFAULT_ASSUMPTIONS.loanTermYears).toBe(30);
    expect(DEFAULT_ASSUMPTIONS.closingCostPercent).toBe(3);
    expect(DEFAULT_ASSUMPTIONS.propertyTaxPercent).toBe(1.2);
    expect(DEFAULT_ASSUMPTIONS.insurancePercent).toBe(0.5);
    expect(DEFAULT_ASSUMPTIONS.managementPercent).toBe(20);
    expect(DEFAULT_ASSUMPTIONS.maintenancePercent).toBe(5);
    expect(DEFAULT_ASSUMPTIONS.startupCosts).toBe(5000);
  });
});
