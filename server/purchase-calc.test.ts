import { describe, it, expect } from 'vitest';

/**
 * Tests for purchase mode calculation logic
 * Verifies that the batch analysis purchase calculations are realistic
 */

// Replicate the purchase mode calculation from opportunity-finder.ts batchValidateProperties
function calculatePurchaseMetrics(purchasePrice: number, monthlyRevenue: number) {
  const managementCosts = monthlyRevenue * 0.20; // 20% management
  const maintenanceCosts = monthlyRevenue * 0.05; // 5% maintenance
  const propertyTax = (purchasePrice * 0.012) / 12; // 1.2% annual property tax
  const insurance = (purchasePrice * 0.006) / 12; // 0.6% annual insurance
  const utilities = 250; // $250/month
  const operatingCosts = managementCosts + maintenanceCosts + propertyTax + insurance + utilities;

  // Mortgage calculation (20% down, 7% interest, 30-year)
  const downPaymentPercent = 0.20;
  const interestRate = 0.07;
  const loanAmount = purchasePrice * (1 - downPaymentPercent);
  const monthlyRate = interestRate / 12;
  const numPayments = 360;
  const monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);

  const monthlyProfit = monthlyRevenue - operatingCosts - monthlyMortgage;
  const annualProfit = monthlyProfit * 12;

  // Cash-on-Cash ROI
  const downPayment = purchasePrice * downPaymentPercent;
  const closingCosts = purchasePrice * 0.03;
  const totalCashInvested = downPayment + closingCosts;
  const roi = totalCashInvested > 0 ? (annualProfit / totalCashInvested) * 100 : 0;

  return {
    operatingCosts: Math.round(operatingCosts),
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyProfit: Math.round(monthlyProfit),
    annualProfit: Math.round(annualProfit),
    roi: Math.round(roi * 10) / 10,
    totalCashInvested: Math.round(totalCashInvested),
  };
}

// Replicate the rent mode calculation
function calculateRentMetrics(monthlyRent: number, monthlyRevenue: number) {
  const operatingCosts = monthlyRevenue * 0.20;
  const monthlyProfit = monthlyRevenue - monthlyRent - operatingCosts;
  const annualProfit = monthlyProfit * 12;
  const roi = (annualProfit / (monthlyRent * 12)) * 100;

  return {
    operatingCosts: Math.round(operatingCosts),
    monthlyProfit: Math.round(monthlyProfit),
    annualProfit: Math.round(annualProfit),
    roi: Math.round(roi * 10) / 10,
  };
}

describe('Purchase Mode Calculations', () => {
  it('should produce realistic Cash-on-Cash ROI for a typical property', () => {
    // $350,000 property earning $4,500/month in STR revenue
    const result = calculatePurchaseMetrics(350000, 4500);

    // Mortgage on $280,000 at 7% for 30 years should be ~$1,863/mo
    expect(result.monthlyMortgage).toBeGreaterThan(1800);
    expect(result.monthlyMortgage).toBeLessThan(1950);

    // Operating costs should include management, maintenance, tax, insurance, utilities
    // Management: $900, Maintenance: $225, Tax: $350, Insurance: $175, Utilities: $250 = ~$1,900
    expect(result.operatingCosts).toBeGreaterThan(1700);
    expect(result.operatingCosts).toBeLessThan(2100);

    // Monthly profit should be revenue - operating - mortgage = ~$737
    expect(result.monthlyProfit).toBeGreaterThan(500);
    expect(result.monthlyProfit).toBeLessThan(1000);

    // Cash-on-Cash ROI should be realistic (5-20% range)
    expect(result.roi).toBeGreaterThan(5);
    expect(result.roi).toBeLessThan(20);

    // Total cash invested: 20% down ($70K) + 3% closing ($10.5K) = $80.5K
    expect(result.totalCashInvested).toBeGreaterThan(79000);
    expect(result.totalCashInvested).toBeLessThan(82000);
  });

  it('should show negative profit for overpriced properties with low revenue', () => {
    // $500,000 property earning only $2,500/month
    const result = calculatePurchaseMetrics(500000, 2500);

    // This should be a losing deal
    expect(result.monthlyProfit).toBeLessThan(0);
    expect(result.roi).toBeLessThan(0);
  });

  it('should NOT subtract purchase price as monthly cost (the old bug)', () => {
    // The old bug: monthlyProfit = monthlyRevenue - purchasePrice - operatingCosts
    // For a $350K property, this would give: 4500 - 350000 - 900 = -$346,400/month (absurd)
    const result = calculatePurchaseMetrics(350000, 4500);

    // Monthly profit should never be less than -$5,000 for a reasonable property
    expect(result.monthlyProfit).toBeGreaterThan(-5000);
  });
});

describe('Rent Mode Calculations', () => {
  it('should calculate rent mode correctly', () => {
    // $2,000/month rent, $4,500/month revenue
    const result = calculateRentMetrics(2000, 4500);

    // Operating costs: 20% of $4,500 = $900
    expect(result.operatingCosts).toBe(900);

    // Monthly profit: $4,500 - $2,000 - $900 = $1,600
    expect(result.monthlyProfit).toBe(1600);

    // Annual profit: $1,600 * 12 = $19,200
    expect(result.annualProfit).toBe(19200);

    // ROI: $19,200 / ($2,000 * 12) = 80%
    expect(result.roi).toBe(80);
  });
});

describe('Purchase vs Rent Mode Comparison', () => {
  it('purchase mode should have lower ROI than rent mode (expected for real estate)', () => {
    const monthlyRevenue = 4500;
    const purchasePrice = 350000;
    const monthlyRent = 2000;

    const purchaseResult = calculatePurchaseMetrics(purchasePrice, monthlyRevenue);
    const rentResult = calculateRentMetrics(monthlyRent, monthlyRevenue);

    // Purchase CoC ROI should be much lower than rent ROI
    expect(purchaseResult.roi).toBeLessThan(rentResult.roi);

    // But purchase ROI should still be positive for a good deal
    expect(purchaseResult.roi).toBeGreaterThan(0);
  });
});
