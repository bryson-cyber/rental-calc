/**
 * BreakEvenCalculator Component
 * 
 * Comprehensive break-even analysis for rental arbitrage.
 * Shows break-even occupancy, ADR, cushion indicators, and scenario analysis.
 */
import { useState, useMemo } from 'react';
import { Calculator, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info, DollarSign } from 'lucide-react';

interface BreakEvenCalculatorProps {
  monthlyRent: number;
  estimatedADR: number;
  estimatedOccupancy: number; // as decimal (e.g., 0.65 for 65%)
  estimatedMonthlyRevenue: number;
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
}: BreakEvenCalculatorProps) {
  const [startupCosts, setStartupCosts] = useState(5000);
  
  // Calculate break-even metrics
  const calculations = useMemo(() => {
    // Days in month (average)
    const daysInMonth = 30;
    
    // Break-even occupancy: What occupancy do you need to cover rent?
    // Revenue = ADR * Occupancy * Days
    // Rent = ADR * BreakEvenOccupancy * Days
    // BreakEvenOccupancy = Rent / (ADR * Days)
    const breakEvenOccupancy = monthlyRent / (estimatedADR * daysInMonth);
    
    // Break-even ADR: What nightly rate do you need to cover rent?
    // Rent = BreakEvenADR * Occupancy * Days
    // BreakEvenADR = Rent / (Occupancy * Days)
    const breakEvenADR = monthlyRent / (estimatedOccupancy * daysInMonth);
    
    // Cushion: How much room do you have before losing money?
    const occupancyCushion = estimatedOccupancy - breakEvenOccupancy;
    const adrCushion = estimatedADR - breakEvenADR;
    
    // Monthly profit
    const monthlyProfit = estimatedMonthlyRevenue - monthlyRent;
    
    // Months to recover startup costs
    const monthsToBreakEven = monthlyProfit > 0 ? startupCosts / monthlyProfit : Infinity;
    
    // Scenario analysis
    const worstCaseOccupancy = estimatedOccupancy * 0.7; // 30% drop
    const worstCaseRevenue = estimatedADR * worstCaseOccupancy * daysInMonth;
    const worstCaseProfit = worstCaseRevenue - monthlyRent;
    
    const bestCaseOccupancy = Math.min(estimatedOccupancy * 1.2, 0.95); // 20% increase, capped at 95%
    const bestCaseRevenue = estimatedADR * bestCaseOccupancy * daysInMonth;
    const bestCaseProfit = bestCaseRevenue - monthlyRent;
    
    // Investment safety score (0-100)
    // Based on: occupancy cushion, profit margin, break-even speed
    let safetyScore = 0;
    
    // Occupancy cushion (0-30 points)
    if (occupancyCushion > 0.3) safetyScore += 30;
    else if (occupancyCushion > 0.2) safetyScore += 25;
    else if (occupancyCushion > 0.1) safetyScore += 15;
    else if (occupancyCushion > 0) safetyScore += 5;
    
    // Profit margin (0-40 points)
    const profitMargin = monthlyProfit / estimatedMonthlyRevenue;
    if (profitMargin > 0.4) safetyScore += 40;
    else if (profitMargin > 0.3) safetyScore += 30;
    else if (profitMargin > 0.2) safetyScore += 20;
    else if (profitMargin > 0.1) safetyScore += 10;
    else if (profitMargin > 0) safetyScore += 5;
    
    // Break-even speed (0-30 points)
    if (monthsToBreakEven <= 3) safetyScore += 30;
    else if (monthsToBreakEven <= 6) safetyScore += 25;
    else if (monthsToBreakEven <= 9) safetyScore += 15;
    else if (monthsToBreakEven <= 12) safetyScore += 10;
    else if (monthsToBreakEven < Infinity) safetyScore += 5;
    
    return {
      breakEvenOccupancy,
      breakEvenADR,
      occupancyCushion,
      adrCushion,
      monthlyProfit,
      monthsToBreakEven,
      worstCaseProfit,
      bestCaseProfit,
      safetyScore,
    };
  }, [monthlyRent, estimatedADR, estimatedOccupancy, estimatedMonthlyRevenue, startupCosts]);
  
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

      {/* Startup Cost Recovery */}
      <div className="bg-[oklch(0.98_0.01_265)] rounded-xl p-5 border border-[oklch(0.90_0.01_265)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-[oklch(0.35_0_0)]">Startup Cost Recovery</span>
            <Tooltip text="How long until you earn back your initial investment (furniture, deposits, supplies). Adjust the slider to match your expected startup costs.">
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
        
        <div className="flex justify-between text-xs text-[oklch(0.50_0_0)] mt-1">
          <span>$2,000</span>
          <span>$20,000</span>
        </div>
        
        <div className="mt-4 text-center">
          {calculations.monthsToBreakEven < Infinity ? (
            <div>
              <span className="text-3xl font-bold text-[oklch(0.55_0.14_75)]">
                {calculations.monthsToBreakEven.toFixed(1)}
              </span>
              <span className="text-lg text-[oklch(0.45_0_0)] ml-2">months to recover</span>
            </div>
          ) : (
            <div className="text-red-600">
              <AlertTriangle className="w-5 h-5 inline mr-2" />
              Not profitable - cannot recover costs
            </div>
          )}
        </div>
      </div>

      {/* Scenario Analysis */}
      <div className="bg-[oklch(0.98_0.01_265)] rounded-xl p-5 border border-[oklch(0.90_0.01_265)]">
        <div className="flex items-center gap-1 mb-4">
          <span className="text-sm font-medium text-[oklch(0.35_0_0)]">Scenario Analysis</span>
          <Tooltip text="What happens if bookings are better or worse than expected? This shows your profit in different situations.">
            <Info className="w-3.5 h-3.5 text-[oklch(0.60_0_0)] cursor-help" />
          </Tooltip>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          {/* Worst Case */}
          <div>
            <div className="flex items-center justify-center gap-1 mb-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-xs text-[oklch(0.50_0_0)]">Worst Case</span>
            </div>
            <div className="text-xs text-[oklch(0.60_0_0)] mb-1">-30% bookings</div>
            <div className={`text-lg font-semibold ${calculations.worstCaseProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {calculations.worstCaseProfit >= 0 ? '+' : ''}{formatCurrency(calculations.worstCaseProfit)}
            </div>
          </div>
          
          {/* Expected */}
          <div className="border-x border-[oklch(0.90_0.01_265)]">
            <div className="flex items-center justify-center gap-1 mb-2">
              <DollarSign className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
              <span className="text-xs text-[oklch(0.50_0_0)]">Expected</span>
            </div>
            <div className="text-xs text-[oklch(0.60_0_0)] mb-1">Current estimate</div>
            <div className={`text-lg font-semibold ${calculations.monthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {calculations.monthlyProfit >= 0 ? '+' : ''}{formatCurrency(calculations.monthlyProfit)}
            </div>
          </div>
          
          {/* Best Case */}
          <div>
            <div className="flex items-center justify-center gap-1 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-[oklch(0.50_0_0)]">Best Case</span>
            </div>
            <div className="text-xs text-[oklch(0.60_0_0)] mb-1">+20% bookings</div>
            <div className={`text-lg font-semibold ${calculations.bestCaseProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {calculations.bestCaseProfit >= 0 ? '+' : ''}{formatCurrency(calculations.bestCaseProfit)}
            </div>
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
