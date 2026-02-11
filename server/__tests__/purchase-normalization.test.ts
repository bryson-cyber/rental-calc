import { describe, it, expect } from 'vitest';

/**
 * Tests for the purchase data normalization logic used in FullPropertyReport.
 * The normalization handles both snake_case (legacy) and camelCase (new) keys.
 */

interface PurchaseScenario {
  purchasePrice: number;
  downPaymentPercent?: number;
  downPayment?: number;
  interestRate?: number;
  loanAmount?: number;
  loanType?: string;
  loanTerm?: number;
  monthlyMortgage?: number;
  monthlyRevenue?: number;
  monthlyExpenses?: number;
  monthlyCashFlow?: number;
  annualCashFlow?: number;
  capRate?: number;
  cashOnCash?: number;
  propertyTax?: number;
  insurance?: number;
  closingCosts?: number;
}

function normalizePurchase(purchase: any): PurchaseScenario | undefined {
  if (!purchase) return undefined;
  return {
    purchasePrice: purchase.purchasePrice ?? purchase.purchase_price,
    downPaymentPercent: purchase.downPaymentPercent ?? purchase.down_payment_percent,
    downPayment: purchase.downPayment ?? purchase.down_payment,
    interestRate: purchase.interestRate ?? purchase.interest_rate,
    loanAmount: purchase.loanAmount ?? purchase.loan_amount,
    loanType: purchase.loanType ?? purchase.loan_type,
    loanTerm: purchase.loanTerm ?? purchase.loan_term,
    monthlyMortgage: purchase.monthlyMortgage ?? purchase.monthly_mortgage,
    monthlyRevenue: purchase.monthlyRevenue ?? purchase.monthly_revenue,
    monthlyExpenses: purchase.monthlyExpenses ?? purchase.monthly_expenses,
    monthlyCashFlow: purchase.monthlyCashFlow ?? purchase.monthly_cash_flow,
    annualCashFlow: purchase.annualCashFlow ?? purchase.annual_cash_flow,
    capRate: purchase.capRate ?? purchase.cap_rate,
    cashOnCash: purchase.cashOnCash ?? purchase.cash_on_cash,
    propertyTax: purchase.propertyTax ?? purchase.property_tax,
    insurance: purchase.insurance,
    closingCosts: purchase.closingCosts ?? purchase.closing_costs,
  };
}

describe('Purchase Data Normalization', () => {
  it('should return undefined for null/undefined input', () => {
    expect(normalizePurchase(null)).toBeUndefined();
    expect(normalizePurchase(undefined)).toBeUndefined();
  });

  it('should normalize snake_case keys (legacy format) to camelCase', () => {
    const snakeCaseData = {
      purchase_price: 649900,
      down_payment_percent: 20,
      down_payment: 129980,
      interest_rate: 7,
      loan_amount: 519920,
      loan_type: 'conventional',
      monthly_mortgage: 3459,
      monthly_revenue: 8500,
      monthly_expenses: 2000,
      monthly_cash_flow: 3041,
      annual_cash_flow: 36492,
      cap_rate: 6.5,
      cash_on_cash: 12.3,
      property_tax: 7800,
      insurance: 3200,
      closing_costs: 19497,
    };

    const result = normalizePurchase(snakeCaseData);
    expect(result).toBeDefined();
    expect(result!.purchasePrice).toBe(649900);
    expect(result!.downPaymentPercent).toBe(20);
    expect(result!.downPayment).toBe(129980);
    expect(result!.interestRate).toBe(7);
    expect(result!.loanAmount).toBe(519920);
    expect(result!.loanType).toBe('conventional');
    expect(result!.monthlyMortgage).toBe(3459);
    expect(result!.monthlyRevenue).toBe(8500);
    expect(result!.monthlyExpenses).toBe(2000);
    expect(result!.monthlyCashFlow).toBe(3041);
    expect(result!.annualCashFlow).toBe(36492);
    expect(result!.capRate).toBe(6.5);
    expect(result!.cashOnCash).toBe(12.3);
    expect(result!.propertyTax).toBe(7800);
    expect(result!.insurance).toBe(3200);
    expect(result!.closingCosts).toBe(19497);
  });

  it('should pass through camelCase keys (new format) unchanged', () => {
    const camelCaseData = {
      purchasePrice: 500000,
      downPaymentPercent: 25,
      downPayment: 125000,
      interestRate: 6.5,
      loanAmount: 375000,
      loanType: 'dscr',
      monthlyMortgage: 2500,
      monthlyRevenue: 7000,
      monthlyExpenses: 1500,
      monthlyCashFlow: 3000,
      annualCashFlow: 36000,
      capRate: 7.2,
      cashOnCash: 15.0,
      propertyTax: 6000,
      insurance: 2500,
      closingCosts: 15000,
    };

    const result = normalizePurchase(camelCaseData);
    expect(result).toBeDefined();
    expect(result!.purchasePrice).toBe(500000);
    expect(result!.downPaymentPercent).toBe(25);
    expect(result!.loanType).toBe('dscr');
    expect(result!.capRate).toBe(7.2);
  });

  it('should prefer camelCase over snake_case when both exist', () => {
    const mixedData = {
      purchasePrice: 500000,
      purchase_price: 400000, // should be ignored
      downPaymentPercent: 25,
      down_payment_percent: 20, // should be ignored
    };

    const result = normalizePurchase(mixedData);
    expect(result!.purchasePrice).toBe(500000); // camelCase wins via ??
    expect(result!.downPaymentPercent).toBe(25);
  });

  it('should handle partial data (only purchasePrice)', () => {
    const partialData = {
      purchase_price: 300000,
    };

    const result = normalizePurchase(partialData);
    expect(result!.purchasePrice).toBe(300000);
    expect(result!.downPaymentPercent).toBeUndefined();
    expect(result!.loanType).toBeUndefined();
  });

  it('should correctly identify hasPurchase for snake_case data', () => {
    const snakeCaseData = { purchase_price: 649900 };
    const result = normalizePurchase(snakeCaseData);
    const hasPurchase = !!result?.purchasePrice;
    expect(hasPurchase).toBe(true);
  });

  it('should correctly identify hasPurchase as false for empty object', () => {
    const emptyData = {};
    const result = normalizePurchase(emptyData);
    const hasPurchase = !!result?.purchasePrice;
    expect(hasPurchase).toBe(false);
  });

  it('should handle cash purchase (loanType = cash)', () => {
    const cashData = {
      purchase_price: 400000,
      loan_type: 'cash',
      down_payment_percent: 100,
      monthly_mortgage: 0,
    };

    const result = normalizePurchase(cashData);
    expect(result!.loanType).toBe('cash');
    expect(result!.monthlyMortgage).toBe(0);
  });
});
