/**
 * BreakEvenCalculator Component
 * 
 * Comprehensive break-even analysis for rental arbitrage.
 * Shows break-even occupancy, ADR, cushion indicators, and 3-level scenario analysis
 * matching the Conservative/Realistic/Optimistic profit tiers.
 */
import { useState, useMemo } from 'react';
import { Calculator, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info, DollarSign, Clock, Target } from 'lucide-react';

interface BreakEvenCalculatorProps {
  monthlyRent: number;
  estimatedADR: number;
  estimatedOccupancy: number; // as decimal (e.g., 0.65 for 65%)
  estimatedMonthlyRevenue: number;
  // 3-level revenue scenarios (annual)
  conservativeRevenue?: number;
  realisticRevenue?: number;
  optimisticRevenue?: number;
  // Annual expenses (rent + utilities + supplies etc.)
  annualExpenses?: number;
}

// Simple tooltip component
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="relative group">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[oklch(0.20_0.01_265)] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal pointer-events-none z-10 max-w-[220px] text-center">
        {text}
      </span>
    </span>
  );
}

export default function BreakEvenCalculator({
  monthlyRent,
  estimatedADR,
  estimatedOccupancy,
  estimatedMonthlyRevenue,
  conservativeRevenue,
  realisticRevenue,
  optimisticRevenue,
  annualExpenses,
}: BreakEvenCalculatorProps) {
  const [startupCosts, setStartupCosts] = useState(5000);
  
  // Calculate break-even metrics
  const calculations = useMemo(() => {
    // Days in month (average)
    const daysInMonth = 30;
    
    // Break-even occupancy: What occupancy do you need to cover rent?
    const breakEvenOccupancy = monthlyRent / (estimatedADR * daysInMonth);
    
    // Break-even ADR: What nightly rate do you need to cover rent?
    const breakEvenADR = monthlyRent / (estimatedOccupancy * daysInMonth);
    
    // Cushion: How much room do you have before losing money?
    const occupancyCushion = estimatedOccupancy - breakEvenOccupancy;
    const adrCushion = estimatedADR - breakEvenADR;
    
    // Use the 3-level revenue scenarios if provided, otherwise fall back to estimate-based
    const totalAnnualExpenses = annualExpenses || (monthlyRent * 12);
    const monthlyExpenses = totalAnnualExpenses / 12;
    
    // 3-level monthly profits
    const conservativeMonthlyProfit = conservativeRevenue 
      ? (conservativeRevenue / 12) - monthlyExpenses
      : estimatedMonthlyRevenue * 0.7 - monthlyRent; // fallback: -30% bookings
    
    const realisticMonthlyProfit = realisticRevenue
      ? (realisticRevenue / 12) - monthlyExpenses
      : estimatedMonthlyRevenue - monthlyRent;
    
    const optimisticMonthlyProfit = optimisticRevenue
      ? (optimisticRevenue / 12) - monthlyExpenses
      : Math.min(estimatedMonthlyRevenue * 1.2, estimatedADR * 0.95 * daysInMonth) - monthlyRent; // fallback: +20% capped at 95%
    
    // 3-level break-even times
    const conservativeMonthsToBreakEven = conservativeMonthlyProfit > 0 
      ? startupCosts / conservativeMonthlyProfit : Infinity;
    const realisticMonthsToBreakEven = realisticMonthlyProfit > 0 
      ? startupCosts / realisticMonthlyProfit : Infinity;
    const optimisticMonthsToBreakEven = optimisticMonthlyProfit > 0 
      ? startupCosts / optimisticMonthlyProfit : Infinity;
    
    // 3-level annual profits for display
    const conservativeAnnualProfit = conservativeMonthlyProfit * 12;
    const realisticAnnualProfit = realisticMonthlyProfit * 12;
    const optimisticAnnualProfit = optimisticMonthlyProfit * 12;
    
    // Investment safety score (0-100)
    let safetyScore = 0;
    
    // Occupancy cushion (0-30 points)
    if (occupancyCushion > 0.3) safetyScore += 30;
    else if (occupancyCushion > 0.2) safetyScore += 25;
    else if (occupancyCushion > 0.1) safetyScore += 15;
    else if (occupancyCushion > 0) safetyScore += 5;
    
    // Profit margin based on realistic scenario (0-40 points)
    const profitMargin = realisticMonthlyProfit / (realisticRevenue ? realisticRevenue / 12 : estimatedMonthlyRevenue);
    if (profitMargin > 0.4) safetyScore += 40;
    else if (profitMargin > 0.3) safetyScore += 30;
    else if (profitMargin > 0.2) safetyScore += 20;
    else if (profitMargin > 0.1) safetyScore += 10;
    else if (profitMargin > 0) safetyScore += 5;
    
    // Break-even speed based on realistic (0-30 points)
    if (realisticMonthsToBreakEven <= 3) safetyScore += 30;
    else if (realisticMonthsToBreakEven <= 6) safetyScore += 25;
    else if (realisticMonthsToBreakEven <= 9) safetyScore += 15;
    else if (realisticMonthsToBreakEven <= 12) safetyScore += 10;
    else if (realisticMonthsToBreakEven < Infinity) safetyScore += 5;
    
    return {
      breakEvenOccupancy,
      breakEvenADR,
      occupancyCushion,
      adrCushion,
      conservativeMonthlyProfit,
      realisticMonthlyProfit,
      optimisticMonthlyProfit,
      conservativeAnnualProfit,
      realisticAnnualProfit,
      optimisticAnnualProfit,
      conservativeMonthsToBreakEven,
      realisticMonthsToBreakEven,
      optimisticMonthsToBreakEven,
      safetyScore,
    };
  }, [monthlyRent, estimatedADR, estimatedOccupancy, estimatedMonthlyRevenue, startupCosts, conservativeRevenue, realisticRevenue, optimisticRevenue, annualExpenses]);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  const formatPercent = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };
  
  const formatMonths = (months: number) => {
    if (months === Infinity) return '—';
    if (months < 1) return '< 1 mo';
    if (months < 12) return `${months.toFixed(1)} mo`;
    const years = Math.floor(months / 12);
    const remainingMonths = Math.round(months % 12);
    if (remainingMonths === 0) return `${years}y`;
    return `${years}y ${remainingMonths}mo`;
  };
  
  // Safety score color
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    if (score >= 30) return 'text-orange-600';
    return 'text-red-600';
  };
  
  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Low Risk';
    if (score >= 50) return 'Moderate Risk';
    if (score >= 30) return 'Higher Risk';
    return 'High Risk';
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Calculator className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
        <h3 className="text-lg font-semibold text-[oklch(0.25_0_0)]">Break-Even Analysis</h3>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Break-Even Occupancy */}
        <div className="bg-[oklch(0.98_0.01_265)] rounded-xl p-5 border border-[oklch(0.90_0.01_265)]">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm text-[oklch(0.50_0_0)]">Break-Even Occupancy</span>
            <Tooltip text="The minimum occupancy you need to cover your rent. If you book fewer nights than this, you lose money.">
              <Info className="w-3.5 h-3.5 text-[oklch(0.60_0_0)] cursor-help" />
            </Tooltip>
          </div>
          <div className="text-2xl font-semibold text-[oklch(0.25_0_0)]">
            {formatPercent(calculations.breakEvenOccupancy)}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {calculations.occupancyCushion > 0 ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600">
                  {formatPercent(calculations.occupancyCushion)} cushion
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-600">
                  Need {formatPercent(Math.abs(calculations.occupancyCushion))} more
                </span>
              </>
            )}
          </div>
        </div>

        {/* Break-Even ADR */}
        <div className="bg-[oklch(0.98_0.01_265)] rounded-xl p-5 border border-[oklch(0.90_0.01_265)]">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm text-[oklch(0.50_0_0)]">Break-Even Nightly Rate</span>
            <Tooltip text="The minimum nightly rate you need to cover your rent at your expected occupancy. Below this rate, you lose money.">
              <Info className="w-3.5 h-3.5 text-[oklch(0.60_0_0)] cursor-help" />
            </Tooltip>
          </div>
          <div className="text-2xl font-semibold text-[oklch(0.25_0_0)]">
            {formatCurrency(calculations.breakEvenADR)}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {calculations.adrCushion > 0 ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600">
                  {formatCurrency(calculations.adrCushion)} cushion
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-600">
                  Need {formatCurrency(Math.abs(calculations.adrCushion))} more
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Startup Cost Recovery — 3 Levels */}
      <div className="bg-[oklch(0.98_0.01_265)] rounded-xl p-5 border border-[oklch(0.90_0.01_265)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
            <span className="text-sm font-medium text-[oklch(0.35_0_0)]">Startup Cost Recovery</span>
            <Tooltip text="How long until you earn back your initial investment (furniture, deposits, supplies) at each profit level. Adjust the slider to match your expected startup costs.">
              <Info className="w-3.5 h-3.5 text-[oklch(0.60_0_0)] cursor-help" />
            </Tooltip>
          </div>
          <span className="text-sm font-semibold text-[oklch(0.55_0.14_75)]">
            {formatCurrency(startupCosts)}
          </span>
        </div>
        
        <input
          type="range"
          min={2000}
          max={20000}
          step={500}
          value={startupCosts}
          onChange={(e) => setStartupCosts(parseInt(e.target.value))}
          className="w-full h-2 bg-[oklch(0.90_0.01_265)] rounded-lg appearance-none cursor-pointer accent-[oklch(0.55_0.14_75)]"
        />
        
        <div className="flex justify-between text-xs text-[oklch(0.50_0_0)] mt-1 mb-5">
          <span>$2,000</span>
          <span>$20,000</span>
        </div>
        
        {/* 3-Level Break-Even Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Conservative */}
          <div className="bg-white rounded-xl p-4 border border-[oklch(0.90_0.01_265)] text-center">
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-[oklch(0.45_0_0)]">Conservative</span>
            </div>
            <div className="text-xs text-[oklch(0.55_0_0)] mb-1">Average performer</div>
            <div className={`text-sm font-semibold mb-2 ${calculations.conservativeMonthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {calculations.conservativeMonthlyProfit >= 0 ? '+' : ''}{formatCurrency(calculations.conservativeMonthlyProfit)}/mo
            </div>
            <div className="border-t border-[oklch(0.92_0.01_265)] pt-2">
              {calculations.conservativeMonthsToBreakEven < Infinity ? (
                <>
                  <div className="text-xl font-bold text-[oklch(0.35_0_0)]">
                    {formatMonths(calculations.conservativeMonthsToBreakEven)}
                  </div>
                  <div className="text-[10px] text-[oklch(0.55_0_0)]">to recover</div>
                </>
              ) : (
                <div className="text-sm text-red-500 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                  Not profitable
                </div>
              )}
            </div>
          </div>

          {/* Realistic — highlighted */}
          <div className="bg-[oklch(0.55_0.14_75)]/5 rounded-xl p-4 border-2 border-[oklch(0.55_0.14_75)]/30 text-center relative">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[oklch(0.55_0.14_75)] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Target
            </div>
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <Target className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
              <span className="text-xs font-medium text-[oklch(0.35_0_0)]">Realistic</span>
            </div>
            <div className="text-xs text-[oklch(0.50_0_0)] mb-1">Our target</div>
            <div className={`text-sm font-bold mb-2 ${calculations.realisticMonthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {calculations.realisticMonthlyProfit >= 0 ? '+' : ''}{formatCurrency(calculations.realisticMonthlyProfit)}/mo
            </div>
            <div className="border-t border-[oklch(0.55_0.14_75)]/20 pt-2">
              {calculations.realisticMonthsToBreakEven < Infinity ? (
                <>
                  <div className="text-2xl font-bold text-[oklch(0.55_0.14_75)]">
                    {formatMonths(calculations.realisticMonthsToBreakEven)}
                  </div>
                  <div className="text-[10px] text-[oklch(0.45_0_0)] font-medium">to recover</div>
                </>
              ) : (
                <div className="text-sm text-red-500 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                  Not profitable
                </div>
              )}
            </div>
          </div>

          {/* Optimistic */}
          <div className="bg-white rounded-xl p-4 border border-[oklch(0.90_0.01_265)] text-center">
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs font-medium text-[oklch(0.45_0_0)]">Optimistic</span>
            </div>
            <div className="text-xs text-[oklch(0.55_0_0)] mb-1">Superstar performer</div>
            <div className={`text-sm font-semibold mb-2 ${calculations.optimisticMonthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {calculations.optimisticMonthlyProfit >= 0 ? '+' : ''}{formatCurrency(calculations.optimisticMonthlyProfit)}/mo
            </div>
            <div className="border-t border-[oklch(0.92_0.01_265)] pt-2">
              {calculations.optimisticMonthsToBreakEven < Infinity ? (
                <>
                  <div className="text-xl font-bold text-green-600">
                    {formatMonths(calculations.optimisticMonthsToBreakEven)}
                  </div>
                  <div className="text-[10px] text-[oklch(0.55_0_0)]">to recover</div>
                </>
              ) : (
                <div className="text-sm text-red-500 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                  Not profitable
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scenario Analysis — 3 Levels */}
      <div className="bg-[oklch(0.98_0.01_265)] rounded-xl p-5 border border-[oklch(0.90_0.01_265)]">
        <div className="flex items-center gap-1 mb-4">
          <DollarSign className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
          <span className="text-sm font-medium text-[oklch(0.35_0_0)]">Annual Profit by Level</span>
          <Tooltip text="Your projected annual profit at each performance level, after all expenses. These match the 3 revenue tiers from the profitability analysis above.">
            <Info className="w-3.5 h-3.5 text-[oklch(0.60_0_0)] cursor-help" />
          </Tooltip>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          {/* Conservative */}
          <div>
            <div className="flex items-center justify-center gap-1 mb-2">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-[oklch(0.50_0_0)]">Conservative</span>
            </div>
            <div className="text-xs text-[oklch(0.60_0_0)] mb-1">Average performer</div>
            <div className={`text-lg font-semibold ${calculations.conservativeAnnualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {calculations.conservativeAnnualProfit >= 0 ? '+' : ''}{formatCurrency(calculations.conservativeAnnualProfit)}
            </div>
            <div className="text-[10px] text-[oklch(0.55_0_0)] mt-0.5">/year</div>
          </div>
          
          {/* Realistic */}
          <div className="border-x border-[oklch(0.90_0.01_265)]">
            <div className="flex items-center justify-center gap-1 mb-2">
              <Target className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
              <span className="text-xs text-[oklch(0.50_0_0)]">Realistic</span>
            </div>
            <div className="text-xs text-[oklch(0.60_0_0)] mb-1">Our target</div>
            <div className={`text-lg font-bold ${calculations.realisticAnnualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {calculations.realisticAnnualProfit >= 0 ? '+' : ''}{formatCurrency(calculations.realisticAnnualProfit)}
            </div>
            <div className="text-[10px] text-[oklch(0.55_0_0)] mt-0.5">/year</div>
          </div>
          
          {/* Optimistic */}
          <div>
            <div className="flex items-center justify-center gap-1 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-[oklch(0.50_0_0)]">Optimistic</span>
            </div>
            <div className="text-xs text-[oklch(0.60_0_0)] mb-1">Superstar</div>
            <div className={`text-lg font-semibold ${calculations.optimisticAnnualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {calculations.optimisticAnnualProfit >= 0 ? '+' : ''}{formatCurrency(calculations.optimisticAnnualProfit)}
            </div>
            <div className="text-[10px] text-[oklch(0.55_0_0)] mt-0.5">/year</div>
          </div>
        </div>
      </div>

      {/* Investment Safety Score */}
      <div className="bg-[oklch(0.98_0.01_265)] rounded-xl p-5 border border-[oklch(0.90_0.01_265)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-[oklch(0.35_0_0)]">Investment Safety Score</span>
            <Tooltip text="A score from 0-100 based on your cushion, profit margin, and how fast you recover startup costs. Higher is safer.">
              <Info className="w-3.5 h-3.5 text-[oklch(0.60_0_0)] cursor-help" />
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${getScoreColor(calculations.safetyScore)}`}>
              {calculations.safetyScore}
            </span>
            <span className={`text-sm ${getScoreColor(calculations.safetyScore)}`}>
              {getScoreLabel(calculations.safetyScore)}
            </span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-3 h-2 bg-[oklch(0.90_0.01_265)] rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              calculations.safetyScore >= 70 ? 'bg-green-500' :
              calculations.safetyScore >= 50 ? 'bg-yellow-500' :
              calculations.safetyScore >= 30 ? 'bg-orange-500' : 'bg-red-500'
            }`}
            style={{ width: `${calculations.safetyScore}%` }}
          />
        </div>
      </div>
    </div>
  );
}
