/**
 * Maximum Purchase Price Calculator
 * 
 * Simple, beginner-friendly tool that answers:
 * "What's the most I can pay and still hit my target return?"
 * 
 * Uses Coach Inayah branding (gold/navy) with clear explainers.
 */
import { useState, useMemo } from 'react';
import { Calculator, HelpCircle, TrendingUp, DollarSign, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MaxPurchasePriceCalculatorProps {
  projectedAnnualRevenue: number;
  downPaymentPercent?: number;
  interestRate?: number;
  loanType?: 'conventional' | 'dscr' | 'fha' | 'cash';
}

export default function MaxPurchasePriceCalculator({
  projectedAnnualRevenue,
  downPaymentPercent = 20,
  interestRate = 7,
  loanType = 'conventional',
}: MaxPurchasePriceCalculatorProps) {
  const [targetCoC, setTargetCoC] = useState(12);

  const calculations = useMemo(() => {
    if (!projectedAnnualRevenue || targetCoC <= 0) return null;

    // Operating expenses (conservative estimates)
    const managementRate = 0.20; // 20% management
    const maintenanceRate = 0.05; // 5% maintenance
    const utilitiesAnnual = 2400; // $200/month
    const propertyTaxRate = 0.012; // 1.2% of purchase price
    const insuranceRate = 0.005; // 0.5% of purchase price
    const closingCostRate = loanType === 'cash' ? 0.015 : 0.03;
    const startupCosts = 15000; // Furnishing estimate

    // We need to solve for purchase price where:
    // Cash-on-Cash Return = Annual Cash Flow / Total Cash Invested
    // targetCoC/100 = (Revenue - Expenses - Mortgage) / (DownPayment + ClosingCosts + Startup)
    
    // Let P = purchase price
    // Down Payment = P * (downPaymentPercent/100)
    // Closing Costs = P * closingCostRate
    // Total Cash = P * (downPaymentPercent/100 + closingCostRate) + startupCosts
    
    // Annual Expenses (excluding mortgage):
    // = Revenue * (managementRate + maintenanceRate) + utilitiesAnnual + P * (propertyTaxRate + insuranceRate)
    
    // Mortgage (annual):
    // Loan Amount = P * (1 - downPaymentPercent/100)
    // Monthly Payment = Loan * (r(1+r)^n) / ((1+r)^n - 1) where r = monthly rate, n = 360
    // Annual Mortgage = Monthly * 12
    
    // For simplicity, approximate annual mortgage as ~7% of loan amount for typical rates
    const effectiveMortgageRate = loanType === 'cash' ? 0 : 0.07; // Approximate annual payment as % of loan
    
    // Solving the equation:
    // targetCoC/100 = (Revenue - Revenue*(mgmt+maint) - utilities - P*(propTax+ins) - P*(1-down%)*mortRate) / (P*(down%+closing) + startup)
    
    // Let's denote:
    // A = Revenue * (1 - managementRate - maintenanceRate) - utilitiesAnnual (fixed income after variable expenses)
    // B = propertyTaxRate + insuranceRate + (1 - downPaymentPercent/100) * effectiveMortgageRate (price-dependent expense rate)
    // C = downPaymentPercent/100 + closingCostRate (price-dependent cash investment rate)
    // D = startupCosts (fixed cash investment)
    // T = targetCoC/100
    
    // T = (A - P*B) / (P*C + D)
    // T * (P*C + D) = A - P*B
    // T*P*C + T*D = A - P*B
    // T*P*C + P*B = A - T*D
    // P * (T*C + B) = A - T*D
    // P = (A - T*D) / (T*C + B)
    
    const A = projectedAnnualRevenue * (1 - managementRate - maintenanceRate) - utilitiesAnnual;
    const B = propertyTaxRate + insuranceRate + (1 - downPaymentPercent/100) * effectiveMortgageRate;
    const C = downPaymentPercent/100 + closingCostRate;
    const D = startupCosts;
    const T = targetCoC / 100;
    
    const maxPurchasePrice = (A - T * D) / (T * C + B);
    
    if (maxPurchasePrice <= 0) {
      return {
        maxPrice: 0,
        downPayment: 0,
        closingCosts: 0,
        totalCashNeeded: 0,
        annualCashFlow: 0,
        isViable: false,
        message: "Target return too high for this revenue level"
      };
    }
    
    // Calculate the actual numbers at this price
    const downPayment = maxPurchasePrice * (downPaymentPercent / 100);
    const closingCosts = maxPurchasePrice * closingCostRate;
    const totalCashNeeded = downPayment + closingCosts + startupCosts;
    
    // Calculate cash flow at this price
    const loanAmount = maxPurchasePrice * (1 - downPaymentPercent / 100);
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = 360;
    const monthlyMortgage = loanType === 'cash' ? 0 : 
      loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    const annualMortgage = monthlyMortgage * 12;
    
    const operatingExpenses = 
      projectedAnnualRevenue * (managementRate + maintenanceRate) +
      utilitiesAnnual +
      maxPurchasePrice * (propertyTaxRate + insuranceRate);
    
    const annualCashFlow = projectedAnnualRevenue - operatingExpenses - annualMortgage;
    const actualCoC = (annualCashFlow / totalCashNeeded) * 100;
    
    return {
      maxPrice: Math.round(maxPurchasePrice),
      downPayment: Math.round(downPayment),
      closingCosts: Math.round(closingCosts),
      totalCashNeeded: Math.round(totalCashNeeded),
      annualCashFlow: Math.round(annualCashFlow),
      monthlyCashFlow: Math.round(annualCashFlow / 12),
      actualCoC: actualCoC.toFixed(1),
      isViable: maxPurchasePrice > 50000,
      message: maxPurchasePrice > 50000 ? "Viable investment" : "Revenue may be too low for this return target"
    };
  }, [projectedAnnualRevenue, targetCoC, downPaymentPercent, interestRate, loanType]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="border-2 border-[#C9A962]/30 bg-gradient-to-br from-white to-[#C9A962]/5">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-[#0F172A]">
          <div className="p-2 rounded-lg bg-[#C9A962]/20">
            <Target className="w-5 h-5 text-[#C9A962]" />
          </div>
          <div>
            <span className="text-lg font-semibold">Maximum Purchase Price</span>
            <p className="text-sm font-normal text-slate-500 mt-0.5">
              What's the most you can pay and still hit your target return?
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Label htmlFor="targetCoC" className="text-sm font-medium text-slate-700">
              Target Cash-on-Cash Return
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    <strong>Cash-on-Cash Return</strong> measures your annual cash flow as a percentage of your total cash invested.
                  </p>
                  <p className="text-sm mt-2">
                    • 8-10% = Good for stable markets<br/>
                    • 12-15% = Strong return<br/>
                    • 15%+ = Excellent (harder to find)
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-3">
            <Input
              id="targetCoC"
              type="number"
              value={targetCoC}
              onChange={(e) => setTargetCoC(Number(e.target.value))}
              className="w-24 text-center text-lg font-semibold"
              min={1}
              max={50}
            />
            <span className="text-lg font-medium text-slate-600">%</span>
            <div className="flex gap-2 ml-auto">
              {[8, 12, 15, 20].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setTargetCoC(preset)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    targetCoC === preset
                      ? 'bg-[#C9A962] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Section */}
        {calculations && (
          <div className="space-y-4">
            {/* Main Result */}
            <div className={`rounded-xl p-6 text-center ${
              calculations.isViable 
                ? 'bg-gradient-to-br from-[#0F172A] to-[#1e293b]' 
                : 'bg-slate-200'
            }`}>
              <p className={`text-sm font-medium mb-2 ${calculations.isViable ? 'text-white/70' : 'text-slate-500'}`}>
                Maximum Purchase Price
              </p>
              <p className={`text-4xl font-bold ${calculations.isViable ? 'text-[#C9A962]' : 'text-slate-400'}`}>
                {calculations.isViable ? formatCurrency(calculations.maxPrice) : 'N/A'}
              </p>
              <p className={`text-sm mt-2 ${calculations.isViable ? 'text-white/60' : 'text-slate-400'}`}>
                {calculations.message}
              </p>
            </div>

            {/* Breakdown */}
            {calculations.isViable && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-[#C9A962]" />
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Cash Needed</span>
                  </div>
                  <p className="text-xl font-bold text-[#0F172A]">{formatCurrency(calculations.totalCashNeeded)}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatCurrency(calculations.downPayment)} down + {formatCurrency(calculations.closingCosts)} closing + $15k startup
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Monthly Cash Flow</span>
                  </div>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(calculations.monthlyCashFlow || 0)}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatCurrency(calculations.annualCashFlow)}/year at {calculations.actualCoC}% CoC
                  </p>
                </div>
              </div>
            )}

            {/* Context Note */}
            <div className="bg-[#C9A962]/10 rounded-lg p-4 border border-[#C9A962]/20">
              <p className="text-sm text-[#0F172A]/70">
                <strong className="text-[#C9A962]">How to use this:</strong> If you find a property listed above this price, 
                you'll need to negotiate down or accept a lower return. Properties below this price could exceed your target return.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
