/**
 * LoanCalculator Component
 * 
 * Comprehensive loan calculator for property investment analysis.
 * Supports multiple loan types:
 * - Conventional (20-25% down, standard rates)
 * - DSCR (Debt Service Coverage Ratio based, investor-focused)
 * - FHA (3.5% down for owner-occupants)
 * - Cash (no financing, cap rate focused)
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  DollarSign, 
  Percent, 
  Calendar, 
  Building, 
  TrendingUp, 
  Info,
  CheckCircle,
  AlertTriangle,
  Banknote,
  PiggyBank,
  Landmark,
  Wallet
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InfoTooltip } from '@/components/InfoTooltip';

// Tooltip component for explanations
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="relative group">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#0F172A] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal pointer-events-none z-10 max-w-[250px] text-center shadow-lg">
        {text}
      </span>
    </span>
  );
}

export interface LoanCalculatorProps {
  purchasePrice: number;
  projectedAnnualRevenue: number;
  projectedOccupancy: number;
  projectedADR: number;
  onCalculationsChange?: (calculations: LoanCalculations) => void;
}

export interface LoanCalculations {
  loanType: 'conventional' | 'dscr' | 'fha' | 'cash';
  purchasePrice: number;
  downPayment: number;
  downPaymentPercent: number;
  loanAmount: number;
  interestRate: number;
  loanTerm: number;
  monthlyMortgage: number;
  annualMortgage: number;
  closingCosts: number;
  totalCashNeeded: number;
  // Investment metrics
  noi: number;
  capRate: number;
  cashOnCash: number;
  dscr: number;
  breakEvenOccupancy: number;
  annualCashFlow: number;
  monthlyCashFlow: number;
}

// Default operating expense percentages
const DEFAULT_EXPENSES = {
  propertyManagement: 0.20, // 20% of revenue
  cleaning: 0.08, // 8% of revenue
  platformFees: 0.03, // 3% Airbnb fee
  maintenance: 0.05, // 5% of revenue
  supplies: 0.02, // 2% of revenue
  insurance: 200, // $200/month flat
  utilities: 200, // $200/month flat
  propertyTax: 0.012, // 1.2% of purchase price annually
};

export default function LoanCalculator({
  purchasePrice,
  projectedAnnualRevenue,
  projectedOccupancy,
  projectedADR,
  onCalculationsChange,
}: LoanCalculatorProps) {
  const [loanType, setLoanType] = useState<'conventional' | 'dscr' | 'fha' | 'cash'>('conventional');
  
  // Loan parameters by type
  const [conventionalParams, setConventionalParams] = useState({
    downPaymentPercent: 20,
    interestRate: 7.0,
    loanTerm: 30,
  });
  
  const [dscrParams, setDscrParams] = useState({
    downPaymentPercent: 25,
    interestRate: 7.5,
    loanTerm: 30,
  });
  
  const [fhaParams, setFhaParams] = useState({
    downPaymentPercent: 3.5,
    interestRate: 6.5,
    loanTerm: 30,
    mipUpfront: 1.75, // 1.75% upfront MIP
    mipAnnual: 0.55, // 0.55% annual MIP
  });
  
  // Operating expenses (adjustable)
  const [expenses, setExpenses] = useState({
    propertyManagement: DEFAULT_EXPENSES.propertyManagement * 100,
    insurance: DEFAULT_EXPENSES.insurance,
    utilities: DEFAULT_EXPENSES.utilities,
    propertyTaxRate: DEFAULT_EXPENSES.propertyTax * 100,
  });

  // Calculate all metrics
  const calculations = useMemo(() => {
    let downPaymentPercent: number;
    let interestRate: number;
    let loanTerm: number;
    let extraMonthlyPayment = 0;
    
    switch (loanType) {
      case 'conventional':
        downPaymentPercent = conventionalParams.downPaymentPercent;
        interestRate = conventionalParams.interestRate;
        loanTerm = conventionalParams.loanTerm;
        break;
      case 'dscr':
        downPaymentPercent = dscrParams.downPaymentPercent;
        interestRate = dscrParams.interestRate;
        loanTerm = dscrParams.loanTerm;
        break;
      case 'fha':
        downPaymentPercent = fhaParams.downPaymentPercent;
        interestRate = fhaParams.interestRate;
        loanTerm = fhaParams.loanTerm;
        // Add annual MIP to monthly payment
        const loanAmountForMip = purchasePrice * (1 - downPaymentPercent / 100);
        extraMonthlyPayment = (loanAmountForMip * fhaParams.mipAnnual / 100) / 12;
        break;
      case 'cash':
        downPaymentPercent = 100;
        interestRate = 0;
        loanTerm = 0;
        break;
      default:
        downPaymentPercent = 20;
        interestRate = 7.0;
        loanTerm = 30;
    }
    
    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPayment;
    
    // Calculate monthly mortgage payment (P&I)
    let monthlyMortgage = 0;
    if (loanType !== 'cash' && loanAmount > 0 && interestRate > 0) {
      const monthlyRate = interestRate / 100 / 12;
      const numPayments = loanTerm * 12;
      monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    }
    
    // Add MIP for FHA
    monthlyMortgage += extraMonthlyPayment;
    
    const annualMortgage = monthlyMortgage * 12;
    
    // Closing costs estimate (3% for financed, 1.5% for cash)
    const closingCostRate = loanType === 'cash' ? 0.015 : 0.03;
    let closingCosts = purchasePrice * closingCostRate;
    
    // Add upfront MIP for FHA
    if (loanType === 'fha') {
      closingCosts += loanAmount * (fhaParams.mipUpfront / 100);
    }
    
    const totalCashNeeded = downPayment + closingCosts;
    
    // Calculate operating expenses
    const annualPropertyManagement = projectedAnnualRevenue * (expenses.propertyManagement / 100);
    const annualCleaning = projectedAnnualRevenue * DEFAULT_EXPENSES.cleaning;
    const annualPlatformFees = projectedAnnualRevenue * DEFAULT_EXPENSES.platformFees;
    const annualMaintenance = projectedAnnualRevenue * DEFAULT_EXPENSES.maintenance;
    const annualSupplies = projectedAnnualRevenue * DEFAULT_EXPENSES.supplies;
    const annualInsurance = expenses.insurance * 12;
    const annualUtilities = expenses.utilities * 12;
    const annualPropertyTax = purchasePrice * (expenses.propertyTaxRate / 100);
    
    const totalOperatingExpenses = 
      annualPropertyManagement + 
      annualCleaning + 
      annualPlatformFees + 
      annualMaintenance + 
      annualSupplies + 
      annualInsurance + 
      annualUtilities + 
      annualPropertyTax;
    
    // Net Operating Income (before debt service)
    const noi = projectedAnnualRevenue - totalOperatingExpenses;
    
    // Cap Rate (NOI / Purchase Price)
    const capRate = (noi / purchasePrice) * 100;
    
    // Annual Cash Flow (after debt service)
    const annualCashFlow = noi - annualMortgage;
    const monthlyCashFlow = annualCashFlow / 12;
    
    // Cash-on-Cash Return (Annual Cash Flow / Total Cash Invested)
    const cashOnCash = totalCashNeeded > 0 ? (annualCashFlow / totalCashNeeded) * 100 : 0;
    
    // DSCR (NOI / Annual Debt Service)
    const dscr = annualMortgage > 0 ? noi / annualMortgage : Infinity;
    
    // Break-even Occupancy
    // Revenue needed = Operating Expenses + Debt Service
    // Revenue = ADR * Occupancy * 365
    // Break-even Occupancy = (Operating Expenses + Debt Service) / (ADR * 365)
    const totalAnnualCosts = totalOperatingExpenses + annualMortgage;
    const breakEvenOccupancy = projectedADR > 0 ? totalAnnualCosts / (projectedADR * 365) : 1;
    
    return {
      loanType,
      purchasePrice,
      downPayment,
      downPaymentPercent,
      loanAmount,
      interestRate,
      loanTerm,
      monthlyMortgage,
      annualMortgage,
      closingCosts,
      totalCashNeeded,
      noi,
      capRate,
      cashOnCash,
      dscr,
      breakEvenOccupancy,
      annualCashFlow,
      monthlyCashFlow,
      // Additional details for display
      operatingExpenses: {
        propertyManagement: annualPropertyManagement,
        cleaning: annualCleaning,
        platformFees: annualPlatformFees,
        maintenance: annualMaintenance,
        supplies: annualSupplies,
        insurance: annualInsurance,
        utilities: annualUtilities,
        propertyTax: annualPropertyTax,
        total: totalOperatingExpenses,
      },
    };
  }, [
    loanType, 
    purchasePrice, 
    projectedAnnualRevenue, 
    projectedADR,
    conventionalParams, 
    dscrParams, 
    fhaParams, 
    expenses
  ]);

  // Notify parent of calculation changes
  useEffect(() => {
    if (onCalculationsChange) {
      onCalculationsChange(calculations);
    }
  }, [calculations, onCalculationsChange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number, decimals = 1) => {
    return `${value.toFixed(decimals)}%`;
  };

  // Metric status colors
  const getCapRateColor = (rate: number) => {
    if (rate >= 8) return 'text-green-600';
    if (rate >= 6) return 'text-yellow-600';
    if (rate >= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  const getCashOnCashColor = (rate: number) => {
    if (rate >= 12) return 'text-green-600';
    if (rate >= 8) return 'text-yellow-600';
    if (rate >= 5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getDscrColor = (ratio: number) => {
    if (ratio >= 1.5) return 'text-green-600';
    if (ratio >= 1.25) return 'text-yellow-600';
    if (ratio >= 1.0) return 'text-orange-600';
    return 'text-red-600';
  };

  const getBreakEvenColor = (occupancy: number) => {
    if (occupancy <= 0.45) return 'text-green-600';
    if (occupancy <= 0.55) return 'text-yellow-600';
    if (occupancy <= 0.65) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Loan Type Tabs */}
      <Tabs value={loanType} onValueChange={(v) => setLoanType(v as typeof loanType)} className="w-full">
        <TabsList className="grid grid-cols-4 w-full bg-gray-100 p-1 rounded-xl">
          <TabsTrigger 
            value="conventional" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2.5"
          >
            <Landmark className="w-4 h-4" />
            <span className="hidden sm:inline">Conventional</span>
          </TabsTrigger>
          <TabsTrigger 
            value="dscr" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2.5"
          >
            <Building className="w-4 h-4" />
            <span className="hidden sm:inline">DSCR</span>
          </TabsTrigger>
          <TabsTrigger 
            value="fha" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2.5"
          >
            <PiggyBank className="w-4 h-4" />
            <span className="hidden sm:inline">FHA</span>
          </TabsTrigger>
          <TabsTrigger 
            value="cash" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2.5"
          >
            <Wallet className="w-4 h-4" />
            <span className="hidden sm:inline">Cash</span>
          </TabsTrigger>
        </TabsList>

        {/* Conventional Loan Settings */}
        <TabsContent value="conventional" className="mt-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-medium text-blue-900 mb-1">Conventional Loan</h4>
            <p className="text-sm text-blue-700">
              Standard mortgage with 20-25% down payment. Best rates for primary residence or investment property with good credit.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Down Payment</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[conventionalParams.downPaymentPercent]}
                  onValueChange={([v]) => setConventionalParams(p => ({ ...p, downPaymentPercent: v }))}
                  min={15}
                  max={40}
                  step={5}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-12 text-right">{conventionalParams.downPaymentPercent}%</span>
              </div>
            </div>
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Interest Rate</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[conventionalParams.interestRate]}
                  onValueChange={([v]) => setConventionalParams(p => ({ ...p, interestRate: v }))}
                  min={5}
                  max={10}
                  step={0.125}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-14 text-right">{conventionalParams.interestRate.toFixed(2)}%</span>
              </div>
            </div>
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Loan Term</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[conventionalParams.loanTerm]}
                  onValueChange={([v]) => setConventionalParams(p => ({ ...p, loanTerm: v }))}
                  min={15}
                  max={30}
                  step={15}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-16 text-right">{conventionalParams.loanTerm} years</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* DSCR Loan Settings */}
        <TabsContent value="dscr" className="mt-4 space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <h4 className="font-medium text-purple-900 mb-1">DSCR Loan (Investor Loan)</h4>
            <p className="text-sm text-purple-700">
              Qualifies based on property income, not your personal income. Ideal for investors with multiple properties. Requires DSCR of 1.0+ (property income covers debt).
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Down Payment</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[dscrParams.downPaymentPercent]}
                  onValueChange={([v]) => setDscrParams(p => ({ ...p, downPaymentPercent: v }))}
                  min={20}
                  max={40}
                  step={5}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-12 text-right">{dscrParams.downPaymentPercent}%</span>
              </div>
            </div>
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Interest Rate</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[dscrParams.interestRate]}
                  onValueChange={([v]) => setDscrParams(p => ({ ...p, interestRate: v }))}
                  min={6}
                  max={11}
                  step={0.125}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-14 text-right">{dscrParams.interestRate.toFixed(2)}%</span>
              </div>
            </div>
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Loan Term</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[dscrParams.loanTerm]}
                  onValueChange={([v]) => setDscrParams(p => ({ ...p, loanTerm: v }))}
                  min={15}
                  max={30}
                  step={15}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-16 text-right">{dscrParams.loanTerm} years</span>
              </div>
            </div>
          </div>
          
          {/* DSCR Qualification Status */}
          <div className={`p-4 rounded-xl border ${calculations.dscr >= 1.0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2">
              {calculations.dscr >= 1.0 ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              )}
              <span className={`font-medium ${calculations.dscr >= 1.0 ? 'text-green-900' : 'text-red-900'}`}>
                {calculations.dscr >= 1.0 
                  ? `Qualifies for DSCR Loan (DSCR: ${calculations.dscr.toFixed(2)})`
                  : `Does NOT qualify - DSCR too low (${calculations.dscr.toFixed(2)}). Need 1.0+`
                }
              </span>
            </div>
          </div>
        </TabsContent>

        {/* FHA Loan Settings */}
        <TabsContent value="fha" className="mt-4 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <h4 className="font-medium text-green-900 mb-1">FHA Loan</h4>
            <p className="text-sm text-green-700">
              Low down payment option (3.5%) for owner-occupants. Requires living in property for 1 year. Includes mortgage insurance premium (MIP).
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Down Payment</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[fhaParams.downPaymentPercent]}
                  onValueChange={([v]) => setFhaParams(p => ({ ...p, downPaymentPercent: v }))}
                  min={3.5}
                  max={20}
                  step={0.5}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-12 text-right">{fhaParams.downPaymentPercent}%</span>
              </div>
            </div>
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Interest Rate</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[fhaParams.interestRate]}
                  onValueChange={([v]) => setFhaParams(p => ({ ...p, interestRate: v }))}
                  min={5}
                  max={9}
                  step={0.125}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-14 text-right">{fhaParams.interestRate.toFixed(2)}%</span>
              </div>
            </div>
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Loan Term</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[fhaParams.loanTerm]}
                  onValueChange={([v]) => setFhaParams(p => ({ ...p, loanTerm: v }))}
                  min={15}
                  max={30}
                  step={15}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-16 text-right">{fhaParams.loanTerm} years</span>
              </div>
            </div>
          </div>
          
          {/* FHA MIP Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <span className="font-medium text-amber-900">Mortgage Insurance Premium (MIP)</span>
                <p className="text-sm text-amber-700 mt-1">
                  FHA loans require MIP: {fhaParams.mipUpfront}% upfront ({formatCurrency(calculations.loanAmount * fhaParams.mipUpfront / 100)}) + {fhaParams.mipAnnual}% annual ({formatCurrency(calculations.loanAmount * fhaParams.mipAnnual / 100)}/year).
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Cash Purchase Settings */}
        <TabsContent value="cash" className="mt-4 space-y-4">
          <div className="bg-[#C9A962]/10 border border-[#C9A962]/30 rounded-xl p-4">
            <h4 className="font-medium text-[#0F172A] mb-1">Cash Purchase</h4>
            <p className="text-sm text-[#0F172A]/70">
              No financing - pay full purchase price in cash. Best for investors who want maximum cash flow and no debt. Lower closing costs.
            </p>
          </div>
          
          <div className="text-center py-6 text-gray-500">
            <Wallet className="w-12 h-12 mx-auto mb-3 text-[#C9A962]" />
            <p>No loan parameters needed for cash purchase.</p>
            <p className="text-sm mt-2">Total cash needed: {formatCurrency(calculations.totalCashNeeded)}</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Investment Metrics Summary */}
      <div className="bg-gradient-to-br from-[#0F172A] to-[#1e293b] rounded-2xl p-6 text-white">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#C9A962]" />
          Investment Analysis
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Cap Rate */}
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-sm text-white/70">Cap Rate</span>
              <Tooltip text="Net Operating Income divided by Purchase Price. Shows return if you paid all cash. 6%+ is generally good for STR.">
                <Info className="w-3.5 h-3.5 text-white/50 cursor-help" />
              </Tooltip>
            </div>
            <div className={`text-2xl font-bold ${getCapRateColor(calculations.capRate)}`}>
              {formatPercent(calculations.capRate)}
            </div>
          </div>
          
          {/* Cash-on-Cash */}
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-sm text-white/70">Cash-on-Cash</span>
              <Tooltip text="Annual cash flow divided by total cash invested. Shows actual return on your money. 8%+ is good, 12%+ is excellent.">
                <Info className="w-3.5 h-3.5 text-white/50 cursor-help" />
              </Tooltip>
            </div>
            <div className={`text-2xl font-bold ${getCashOnCashColor(calculations.cashOnCash)}`}>
              {formatPercent(calculations.cashOnCash)}
            </div>
          </div>
          
          {/* DSCR */}
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-sm text-white/70">DSCR</span>
              <Tooltip text="Debt Service Coverage Ratio. Property income divided by mortgage payment. 1.0 = break even, 1.25+ preferred by lenders.">
                <Info className="w-3.5 h-3.5 text-white/50 cursor-help" />
              </Tooltip>
            </div>
            <div className={`text-2xl font-bold ${getDscrColor(calculations.dscr)}`}>
              {calculations.dscr === Infinity ? '∞' : calculations.dscr.toFixed(2)}
            </div>
          </div>
          
          {/* Break-even Occupancy */}
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-sm text-white/70">Break-even</span>
              <Tooltip text="Minimum occupancy needed to cover all costs. Lower is better - more room for error. Under 50% is excellent.">
                <Info className="w-3.5 h-3.5 text-white/50 cursor-help" />
              </Tooltip>
            </div>
            <div className={`text-2xl font-bold ${getBreakEvenColor(calculations.breakEvenOccupancy)}`}>
              {formatPercent(calculations.breakEvenOccupancy * 100, 0)}
            </div>
          </div>
        </div>
        
        {/* Cash Flow Summary */}
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-sm text-white/60">Monthly Cash Flow</div>
              <div className={`text-xl font-bold ${calculations.monthlyCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {calculations.monthlyCashFlow >= 0 ? '+' : ''}{formatCurrency(calculations.monthlyCashFlow)}
              </div>
            </div>
            <div>
              <div className="text-sm text-white/60">Annual Cash Flow</div>
              <div className={`text-xl font-bold ${calculations.annualCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {calculations.annualCashFlow >= 0 ? '+' : ''}{formatCurrency(calculations.annualCashFlow)}
              </div>
            </div>
            <div>
              <div className="text-sm text-white/60">Total Cash Needed</div>
              <div className="text-xl font-bold text-[#C9A962]">
                {formatCurrency(calculations.totalCashNeeded)}
              </div>
            </div>
            <div>
              <div className="text-sm text-white/60">Monthly Mortgage</div>
              <div className="text-xl font-bold text-white">
                {formatCurrency(calculations.monthlyMortgage)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">Detailed Breakdown</h4>
        </div>
        <div className="p-4 space-y-4">
          {/* Purchase & Financing */}
          <div>
            <h5 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Purchase & Financing</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Purchase Price</span>
                <span className="font-medium">{formatCurrency(calculations.purchasePrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Down Payment ({calculations.downPaymentPercent}%)</span>
                <span className="font-medium">{formatCurrency(calculations.downPayment)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Loan Amount</span>
                <span className="font-medium">{formatCurrency(calculations.loanAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Closing Costs</span>
                <span className="font-medium">{formatCurrency(calculations.closingCosts)}</span>
              </div>
            </div>
          </div>
          
          {/* Annual Income & Expenses */}
          <div className="pt-4 border-t border-gray-100">
            <h5 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Annual Income & Expenses</h5>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Projected Revenue</span>
                <span className="font-medium text-green-600">{formatCurrency(projectedAnnualRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Operating Expenses</span>
                <span className="font-medium text-red-600">-{formatCurrency(calculations.operatingExpenses.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Net Operating Income</span>
                <span className="font-medium">{formatCurrency(calculations.noi)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Annual Mortgage</span>
                <span className="font-medium text-red-600">-{formatCurrency(calculations.annualMortgage)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
