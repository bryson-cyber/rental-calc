/**
 * STRvsLTRComparison - Side-by-side comparison of Short-Term Rental vs Long-Term Rental income
 * 
 * This component shows investors the difference between:
 * - STR (Short-Term Rental): Airbnb/VRBO income with higher revenue but more management
 * - LTR (Long-Term Rental): Traditional 12-month lease with stable but lower income
 * 
 * Helps investors make informed decisions about their rental strategy.
 */

import { useMemo } from 'react';
import { 
  Home, 
  Building2, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Clock,
  DollarSign,
  Users,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Info
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface STRvsLTRComparisonProps {
  // STR data from AirDNA
  strAnnualRevenue: number;
  strOccupancyRate: number; // 0-1
  strAdr: number;
  
  // LTR data (estimated or from Rentometer)
  ltrMonthlyRent?: number; // If not provided, we estimate based on STR data
  
  // Property details for estimation
  bedrooms: number;
  city?: string;
  state?: string;
  
  // Purchase mode data (optional)
  purchasePrice?: number;
  monthlyMortgage?: number;
  downPaymentPercent?: number;
}

// Estimated expense ratios
const STR_EXPENSE_RATIO = 0.35; // 35% for STR (cleaning, supplies, utilities, platform fees)
const LTR_EXPENSE_RATIO = 0.10; // 10% for LTR (maintenance, vacancy allowance)
const PROPERTY_TAX_RATE = 0.012; // 1.2% of property value annually
const INSURANCE_RATE = 0.005; // 0.5% of property value annually

export function STRvsLTRComparison({
  strAnnualRevenue,
  strOccupancyRate,
  strAdr,
  ltrMonthlyRent,
  bedrooms,
  city,
  state,
  purchasePrice,
  monthlyMortgage,
  downPaymentPercent,
}: STRvsLTRComparisonProps) {
  
  // Estimate LTR rent if not provided (typically 40-60% of STR monthly revenue)
  const estimatedLtrMonthlyRent = useMemo(() => {
    if (ltrMonthlyRent) return ltrMonthlyRent;
    
    // Estimate based on STR revenue (LTR is typically 50-60% of STR monthly)
    const strMonthlyRevenue = strAnnualRevenue / 12;
    return Math.round(strMonthlyRevenue * 0.55);
  }, [ltrMonthlyRent, strAnnualRevenue]);
  
  // Calculate STR metrics
  const strMetrics = useMemo(() => {
    const grossRevenue = strAnnualRevenue;
    const operatingExpenses = grossRevenue * STR_EXPENSE_RATIO;
    const propertyTax = purchasePrice ? purchasePrice * PROPERTY_TAX_RATE : 0;
    const insurance = purchasePrice ? purchasePrice * INSURANCE_RATE : 0;
    const annualMortgage = monthlyMortgage ? monthlyMortgage * 12 : 0;
    
    const totalExpenses = operatingExpenses + propertyTax + insurance;
    const noi = grossRevenue - totalExpenses;
    const cashFlow = noi - annualMortgage;
    
    return {
      grossRevenue,
      operatingExpenses,
      propertyTax,
      insurance,
      noi,
      annualMortgage,
      cashFlow,
      monthlyRevenue: grossRevenue / 12,
      monthlyCashFlow: cashFlow / 12,
    };
  }, [strAnnualRevenue, purchasePrice, monthlyMortgage]);
  
  // Calculate LTR metrics
  const ltrMetrics = useMemo(() => {
    const grossRevenue = estimatedLtrMonthlyRent * 12;
    const operatingExpenses = grossRevenue * LTR_EXPENSE_RATIO;
    const propertyTax = purchasePrice ? purchasePrice * PROPERTY_TAX_RATE : 0;
    const insurance = purchasePrice ? purchasePrice * INSURANCE_RATE : 0;
    const annualMortgage = monthlyMortgage ? monthlyMortgage * 12 : 0;
    
    const totalExpenses = operatingExpenses + propertyTax + insurance;
    const noi = grossRevenue - totalExpenses;
    const cashFlow = noi - annualMortgage;
    
    return {
      grossRevenue,
      operatingExpenses,
      propertyTax,
      insurance,
      noi,
      annualMortgage,
      cashFlow,
      monthlyRevenue: grossRevenue / 12,
      monthlyCashFlow: cashFlow / 12,
    };
  }, [estimatedLtrMonthlyRent, purchasePrice, monthlyMortgage]);
  
  // Calculate differences
  const comparison = useMemo(() => {
    const revenueDiff = strMetrics.grossRevenue - ltrMetrics.grossRevenue;
    const revenueDiffPercent = (revenueDiff / ltrMetrics.grossRevenue) * 100;
    const cashFlowDiff = strMetrics.cashFlow - ltrMetrics.cashFlow;
    const cashFlowDiffPercent = ltrMetrics.cashFlow !== 0 
      ? (cashFlowDiff / Math.abs(ltrMetrics.cashFlow)) * 100 
      : 0;
    
    // Calculate ROI if purchase price is available
    const totalCashInvested = purchasePrice && downPaymentPercent 
      ? purchasePrice * (downPaymentPercent / 100) + (purchasePrice * 0.03)
      : 0;
    
    const strCashOnCash = totalCashInvested > 0 
      ? (strMetrics.cashFlow / totalCashInvested) * 100 
      : 0;
    const ltrCashOnCash = totalCashInvested > 0 
      ? (ltrMetrics.cashFlow / totalCashInvested) * 100 
      : 0;
    
    return {
      revenueDiff,
      revenueDiffPercent,
      cashFlowDiff,
      cashFlowDiffPercent,
      strCashOnCash,
      ltrCashOnCash,
      strWins: strMetrics.cashFlow > ltrMetrics.cashFlow,
    };
  }, [strMetrics, ltrMetrics, purchasePrice, downPaymentPercent]);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };
  
  return (
    <TooltipProvider>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-teal-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">STR vs LTR Comparison</h3>
              <p className="text-sm text-slate-500">
                Short-Term Rental vs Long-Term Rental income analysis
              </p>
            </div>
          </div>
          {!ltrMonthlyRent && (
            <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
              <Info className="w-3 h-3" />
              <span>LTR rent estimated</span>
            </div>
          )}
        </div>
        
        {/* Main Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* STR Card */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Home className="w-5 h-5 text-amber-600" />
              <h4 className="font-semibold text-slate-900">Short-Term Rental</h4>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Annual Revenue</span>
                <span className="font-semibold text-slate-900">{formatCurrency(strMetrics.grossRevenue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Operating Expenses (35%)</span>
                <span className="text-slate-700">-{formatCurrency(strMetrics.operatingExpenses)}</span>
              </div>
              {purchasePrice && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Property Tax</span>
                    <span className="text-slate-700">-{formatCurrency(strMetrics.propertyTax)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Insurance</span>
                    <span className="text-slate-700">-{formatCurrency(strMetrics.insurance)}</span>
                  </div>
                </>
              )}
              <div className="border-t border-amber-200 pt-2 flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">NOI</span>
                <span className="font-semibold text-slate-900">{formatCurrency(strMetrics.noi)}</span>
              </div>
              {monthlyMortgage && monthlyMortgage > 0 && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Annual Mortgage</span>
                    <span className="text-slate-700">-{formatCurrency(strMetrics.annualMortgage)}</span>
                  </div>
                  <div className="border-t border-amber-200 pt-2 flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">Annual Cash Flow</span>
                    <span className={`font-bold ${strMetrics.cashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(strMetrics.cashFlow)}
                    </span>
                  </div>
                </>
              )}
              
              {/* Monthly breakdown */}
              <div className="bg-white/60 rounded-lg p-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Monthly Cash Flow</span>
                  <span className={`font-bold ${strMetrics.monthlyCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(strMetrics.monthlyCashFlow)}/mo
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* LTR Card */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-slate-600" />
              <h4 className="font-semibold text-slate-900">Long-Term Rental</h4>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Annual Revenue</span>
                <span className="font-semibold text-slate-900">{formatCurrency(ltrMetrics.grossRevenue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Operating Expenses (10%)</span>
                <span className="text-slate-700">-{formatCurrency(ltrMetrics.operatingExpenses)}</span>
              </div>
              {purchasePrice && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Property Tax</span>
                    <span className="text-slate-700">-{formatCurrency(ltrMetrics.propertyTax)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Insurance</span>
                    <span className="text-slate-700">-{formatCurrency(ltrMetrics.insurance)}</span>
                  </div>
                </>
              )}
              <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">NOI</span>
                <span className="font-semibold text-slate-900">{formatCurrency(ltrMetrics.noi)}</span>
              </div>
              {monthlyMortgage && monthlyMortgage > 0 && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Annual Mortgage</span>
                    <span className="text-slate-700">-{formatCurrency(ltrMetrics.annualMortgage)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">Annual Cash Flow</span>
                    <span className={`font-bold ${ltrMetrics.cashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(ltrMetrics.cashFlow)}
                    </span>
                  </div>
                </>
              )}
              
              {/* Monthly breakdown */}
              <div className="bg-white/60 rounded-lg p-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Monthly Cash Flow</span>
                  <span className={`font-bold ${ltrMetrics.monthlyCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(ltrMetrics.monthlyCashFlow)}/mo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Difference Summary */}
        <div className={`rounded-xl p-4 mb-6 ${comparison.strWins ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            {comparison.strWins ? (
              <TrendingUp className="w-5 h-5 text-amber-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-slate-600" />
            )}
            <span className="font-semibold text-slate-900">
              {comparison.strWins ? 'STR generates more cash flow' : 'LTR generates more cash flow'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Revenue Difference</span>
              <p className={`font-semibold ${comparison.revenueDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(comparison.revenueDiff)}/yr
              </p>
              <p className="text-xs text-slate-500">{formatPercent(comparison.revenueDiffPercent)} vs LTR</p>
            </div>
            <div>
              <span className="text-slate-500">Cash Flow Difference</span>
              <p className={`font-semibold ${comparison.cashFlowDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(comparison.cashFlowDiff)}/yr
              </p>
              <p className="text-xs text-slate-500">{formatCurrency(comparison.cashFlowDiff / 12)}/mo</p>
            </div>
            {comparison.strCashOnCash > 0 && (
              <>
                <div>
                  <span className="text-slate-500">STR Cash-on-Cash</span>
                  <p className="font-semibold text-amber-600">{comparison.strCashOnCash.toFixed(1)}%</p>
                </div>
                <div>
                  <span className="text-slate-500">LTR Cash-on-Cash</span>
                  <p className="font-semibold text-slate-700">{comparison.ltrCashOnCash.toFixed(1)}%</p>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Pros/Cons Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* STR Considerations */}
          <div className="space-y-2">
            <h5 className="font-medium text-slate-900 flex items-center gap-2">
              <Home className="w-4 h-4 text-amber-600" />
              STR Considerations
            </h5>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600">Higher revenue potential ({formatPercent(comparison.revenueDiffPercent)} more)</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600">Flexibility to use property yourself</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600">More management (guests, cleaning, turnover)</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600">Seasonal income fluctuations</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600">Higher operating expenses (35%)</span>
              </div>
            </div>
          </div>
          
          {/* LTR Considerations */}
          <div className="space-y-2">
            <h5 className="font-medium text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-600" />
              LTR Considerations
            </h5>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600">Stable, predictable income</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600">Minimal management required</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600">Lower operating expenses (10%)</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600">Lower revenue potential</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-600">Less flexibility (12-month lease)</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Assumptions Note */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            <strong>Assumptions:</strong> STR expenses at 35% (cleaning, supplies, utilities, platform fees). 
            LTR expenses at 10% (maintenance, vacancy). Property tax at 1.2%, insurance at 0.5% of property value.
            {!ltrMonthlyRent && ' LTR rent estimated at 55% of STR monthly revenue.'}
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
