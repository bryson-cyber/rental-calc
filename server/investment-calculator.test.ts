import { describe, it, expect } from 'vitest';

/**
 * Investment Calculator Loan Calculation Tests
 * 
 * These tests verify the loan calculation formulas used in the Investment Calculator.
 * The calculations are done client-side in LoanCalculator.tsx, but we test the
 * formulas here to ensure correctness.
 */

// Loan calculation helper functions (matching LoanCalculator.tsx logic)
function calculateMonthlyMortgage(loanAmount: number, annualRate: number, termYears: number): number {
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = termYears * 12;
  if (monthlyRate === 0) return loanAmount / numPayments;
  return (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
         (Math.pow(1 + monthlyRate, numPayments) - 1);
}

function calculateCapRate(noi: number, purchasePrice: number): number {
  if (purchasePrice === 0) return 0;
  return (noi / purchasePrice) * 100;
}

function calculateCashOnCash(annualCashFlow: number, totalCashInvested: number): number {
  if (totalCashInvested === 0) return 0;
  return (annualCashFlow / totalCashInvested) * 100;
}

function calculateDSCR(noi: number, annualDebtService: number): number {
  if (annualDebtService === 0) return 0;
  return noi / annualDebtService;
}

function calculateBreakEvenOccupancy(
  annualExpenses: number,
  annualMortgage: number,
  projectedRevenue: number
): number {
  if (projectedRevenue === 0) return 0;
  return ((annualExpenses + annualMortgage) / projectedRevenue) * 100;
}

describe('Investment Calculator - Loan Calculations', () => {
  describe('Monthly Mortgage Payment', () => {
    it('should calculate correct monthly payment for conventional loan', () => {
      // $360,000 loan at 7% for 30 years
      const loanAmount = 360000;
      const annualRate = 7;
      const termYears = 30;
      
      const monthlyPayment = calculateMonthlyMortgage(loanAmount, annualRate, termYears);
      
      // Expected: approximately $2,395/month
      expect(monthlyPayment).toBeCloseTo(2395.09, 0);
    });

    it('should calculate correct monthly payment for DSCR loan', () => {
      // $337,500 loan at 7.5% for 30 years (75% LTV)
      const loanAmount = 337500;
      const annualRate = 7.5;
      const termYears = 30;
      
      const monthlyPayment = calculateMonthlyMortgage(loanAmount, annualRate, termYears);
      
      // Expected: approximately $2,360/month
      expect(monthlyPayment).toBeCloseTo(2360.23, 0);
    });

    it('should calculate correct monthly payment for FHA loan', () => {
      // $434,250 loan at 6.5% for 30 years (96.5% LTV)
      const loanAmount = 434250;
      const annualRate = 6.5;
      const termYears = 30;
      
      const monthlyPayment = calculateMonthlyMortgage(loanAmount, annualRate, termYears);
      
      // Expected: approximately $2,745/month
      expect(monthlyPayment).toBeCloseTo(2745.02, 0);
    });

    it('should handle zero interest rate', () => {
      const loanAmount = 360000;
      const annualRate = 0;
      const termYears = 30;
      
      const monthlyPayment = calculateMonthlyMortgage(loanAmount, annualRate, termYears);
      
      // With 0% interest, monthly payment is simply loan / (years * 12)
      expect(monthlyPayment).toBe(1000);
    });
  });

  describe('Cap Rate', () => {
    it('should calculate correct cap rate', () => {
      // NOI of $52,713 on $450,000 purchase
      const noi = 52713;
      const purchasePrice = 450000;
      
      const capRate = calculateCapRate(noi, purchasePrice);
      
      // Expected: 11.71%
      expect(capRate).toBeCloseTo(11.71, 1);
    });

    it('should handle zero purchase price', () => {
      const noi = 52713;
      const purchasePrice = 0;
      
      const capRate = calculateCapRate(noi, purchasePrice);
      
      expect(capRate).toBe(0);
    });
  });

  describe('Cash-on-Cash Return', () => {
    it('should calculate correct cash-on-cash return', () => {
      // Annual cash flow of $23,972 on $103,500 invested
      const annualCashFlow = 23972;
      const totalCashInvested = 103500;
      
      const cashOnCash = calculateCashOnCash(annualCashFlow, totalCashInvested);
      
      // Expected: 23.16%
      expect(cashOnCash).toBeCloseTo(23.16, 1);
    });

    it('should handle zero investment', () => {
      const annualCashFlow = 23972;
      const totalCashInvested = 0;
      
      const cashOnCash = calculateCashOnCash(annualCashFlow, totalCashInvested);
      
      expect(cashOnCash).toBe(0);
    });
  });

  describe('DSCR (Debt Service Coverage Ratio)', () => {
    it('should calculate correct DSCR', () => {
      // NOI of $52,713 with annual debt service of $28,741
      const noi = 52713;
      const annualDebtService = 28741;
      
      const dscr = calculateDSCR(noi, annualDebtService);
      
      // Expected: 1.83
      expect(dscr).toBeCloseTo(1.83, 1);
    });

    it('should handle zero debt service (cash purchase)', () => {
      const noi = 52713;
      const annualDebtService = 0;
      
      const dscr = calculateDSCR(noi, annualDebtService);
      
      expect(dscr).toBe(0);
    });

    it('should return value > 1 for profitable property', () => {
      // A DSCR > 1 means the property income covers the debt
      const noi = 60000;
      const annualDebtService = 40000;
      
      const dscr = calculateDSCR(noi, annualDebtService);
      
      expect(dscr).toBeGreaterThan(1);
    });
  });

  describe('Break-Even Occupancy', () => {
    it('should calculate correct break-even occupancy', () => {
      // Expenses: $48,759, Mortgage: $28,741, Revenue: $101,472
      const annualExpenses = 48759;
      const annualMortgage = 28741;
      const projectedRevenue = 101472;
      
      const breakEven = calculateBreakEvenOccupancy(annualExpenses, annualMortgage, projectedRevenue);
      
      // Expected: 76.4% (need 76.4% occupancy to break even)
      expect(breakEven).toBeCloseTo(76.4, 0);
    });

    it('should handle zero revenue', () => {
      const annualExpenses = 48759;
      const annualMortgage = 28741;
      const projectedRevenue = 0;
      
      const breakEven = calculateBreakEvenOccupancy(annualExpenses, annualMortgage, projectedRevenue);
      
      expect(breakEven).toBe(0);
    });

    it('should return lower break-even for cash purchase', () => {
      // Cash purchase has no mortgage, so break-even is lower
      const annualExpenses = 48759;
      const annualMortgageFinanced = 28741;
      const annualMortgageCash = 0;
      const projectedRevenue = 101472;
      
      const breakEvenFinanced = calculateBreakEvenOccupancy(annualExpenses, annualMortgageFinanced, projectedRevenue);
      const breakEvenCash = calculateBreakEvenOccupancy(annualExpenses, annualMortgageCash, projectedRevenue);
      
      expect(breakEvenCash).toBeLessThan(breakEvenFinanced);
    });
  });
});

describe('Investment Calculator - Loan Type Scenarios', () => {
  const purchasePrice = 450000;
  const projectedRevenue = 101472;
  const expenseRate = 0.48; // 48% expense ratio
  const expenses = projectedRevenue * expenseRate;
  const noi = projectedRevenue - expenses;

  describe('Conventional Loan (20% down)', () => {
    const downPayment = purchasePrice * 0.20;
    const loanAmount = purchasePrice - downPayment;
    const closingCosts = purchasePrice * 0.03;
    const totalCashInvested = downPayment + closingCosts;
    const monthlyMortgage = calculateMonthlyMortgage(loanAmount, 7, 30);
    const annualMortgage = monthlyMortgage * 12;
    const annualCashFlow = noi - annualMortgage;

    it('should have positive cash flow', () => {
      expect(annualCashFlow).toBeGreaterThan(0);
    });

    it('should have cap rate above 10%', () => {
      const capRate = calculateCapRate(noi, purchasePrice);
      expect(capRate).toBeGreaterThan(10);
    });

    it('should have DSCR above 1.0', () => {
      const dscr = calculateDSCR(noi, annualMortgage);
      expect(dscr).toBeGreaterThan(1);
    });
  });

  describe('DSCR Loan (25% down)', () => {
    const downPayment = purchasePrice * 0.25;
    const loanAmount = purchasePrice - downPayment;
    const closingCosts = purchasePrice * 0.035;
    const totalCashInvested = downPayment + closingCosts;
    const monthlyMortgage = calculateMonthlyMortgage(loanAmount, 7.5, 30);
    const annualMortgage = monthlyMortgage * 12;
    const annualCashFlow = noi - annualMortgage;

    it('should have positive cash flow', () => {
      expect(annualCashFlow).toBeGreaterThan(0);
    });

    it('should qualify with DSCR above 1.0', () => {
      const dscr = calculateDSCR(noi, annualMortgage);
      expect(dscr).toBeGreaterThan(1);
    });
  });

  describe('Cash Purchase', () => {
    const totalCashInvested = purchasePrice + (purchasePrice * 0.02); // 2% closing costs
    const annualCashFlow = noi; // No mortgage payment

    it('should have highest cash flow', () => {
      // Cash purchase should have higher cash flow than financed options
      const conventionalMonthlyMortgage = calculateMonthlyMortgage(purchasePrice * 0.80, 7, 30);
      const conventionalAnnualCashFlow = noi - (conventionalMonthlyMortgage * 12);
      
      expect(annualCashFlow).toBeGreaterThan(conventionalAnnualCashFlow);
    });

    it('should have infinite DSCR (no debt)', () => {
      // With no debt, DSCR is technically infinite, but we return 0 to indicate N/A
      const dscr = calculateDSCR(noi, 0);
      expect(dscr).toBe(0);
    });

    it('should have lowest break-even occupancy', () => {
      const breakEvenCash = calculateBreakEvenOccupancy(expenses, 0, projectedRevenue);
      const conventionalMonthlyMortgage = calculateMonthlyMortgage(purchasePrice * 0.80, 7, 30);
      const breakEvenConventional = calculateBreakEvenOccupancy(expenses, conventionalMonthlyMortgage * 12, projectedRevenue);
      
      expect(breakEvenCash).toBeLessThan(breakEvenConventional);
    });
  });
});
