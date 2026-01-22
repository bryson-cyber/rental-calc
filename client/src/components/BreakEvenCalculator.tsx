/**
 * Break-Even Calculator Component
 * 
 * Comprehensive break-even analysis for rental arbitrage.
 * Shows exactly what occupancy and ADR you need to be profitable.
 */

import { useState, useMemo } from 'react';
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Percent,
  Calendar,
  Info,
  ChevronDown,
  ChevronUp,
  Target,
  Shield,
  Zap
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface BreakEvenCalculatorProps {
  monthlyRent: number;
  projectedADR: number;
  projectedOccupancy: number; // as percentage (e.g., 65 for 65%)
  projectedRevenue: number;
  className?: string;
}

// ============================================
// TOOLTIP EXPLANATIONS (Third-grader friendly)
// ============================================

const TOOLTIPS = {
  breakEvenOccupancy: "This is the minimum number of nights you need to book each month to pay your rent. If you book fewer nights than this, you lose money!",
  breakEvenADR: "This is the minimum price per night you need to charge to pay your rent (at your current occupancy). If you charge less, you lose money!",
  cushion: "This is your safety margin - how much room you have before you start losing money. Bigger cushion = safer investment!",
  monthsToBreakEven: "This shows how many months of profit it takes to recover your startup costs (furniture, deposits, etc.). Shorter = better!",
  worstCase: "This shows what happens if bookings drop by 30%. If you're still profitable here, you have a very safe investment!",
  bestCase: "This shows what you could earn if bookings are 20% better than expected. This is your upside potential!",
  safetyScore: "A score from 0-100 showing how safe this investment is. Higher = safer. We look at your cushion, worst-case scenario, and market conditions."
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// ============================================
// SUB-COMPONENTS
// ============================================

function ScenarioCard({
  title,
  icon,
  occupancy,
  revenue,
  profit,
  isPositive,
  tooltip,
  variant = 'default'
}: {
  title: string;
  icon: React.ReactNode;
  occupancy: number;
  revenue: number;
  profit: number;
  isPositive: boolean;
  tooltip: string;
  variant?: 'default' | 'warning' | 'success';
}) {
  const bgColor = variant === 'warning' 
    ? 'bg-amber-50 border-amber-200' 
    : variant === 'success' 
    ? 'bg-emerald-50 border-emerald-200' 
    : 'bg-slate-50 border-slate-200';
    
  return (
    <div className={`p-4 rounded-xl border ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-slate-700">{title}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1 hover:bg-white/50 rounded transition-colors">
              <Info className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs p-3 bg-white text-slate-900 shadow-lg border">
            <p className="text-sm leading-relaxed">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Occupancy</span>
          <span className="font-medium">{occupancy.toFixed(0)}%</span>
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>Revenue</span>
          <span className="font-medium">{formatCurrency(revenue)}/mo</span>
        </div>
        <div className="flex justify-between text-sm pt-1 border-t border-slate-200 mt-1">
          <span className="font-medium text-slate-700">Profit</span>
          <span className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{formatCurrency(profit)}/mo
          </span>
        </div>
      </div>
    </div>
  );
}

function SafetyMeter({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'emerald';
    if (s >= 60) return 'blue';
    if (s >= 40) return 'amber';
    return 'red';
  };
  
  const color = getColor(score);
  const label = score >= 80 ? 'Very Safe' : score >= 60 ? 'Safe' : score >= 40 ? 'Moderate Risk' : 'High Risk';
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              color === 'emerald' ? 'bg-emerald-500' :
              color === 'blue' ? 'bg-blue-500' :
              color === 'amber' ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>High Risk</span>
          <span>Very Safe</span>
        </div>
      </div>
      <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
        color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
        color === 'blue' ? 'bg-blue-100 text-blue-700' :
        color === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
      }`}>
        {label}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function BreakEvenCalculator({
  monthlyRent,
  projectedADR,
  projectedOccupancy,
  projectedRevenue,
  className = ''
}: BreakEvenCalculatorProps) {
  const [expanded, setExpanded] = useState(true);
  const [startupCosts, setStartupCosts] = useState(15000); // Default startup costs
  
  // Calculate all break-even metrics
  const calculations = useMemo(() => {
    const daysPerMonth = 30;
    
    // Break-even occupancy (at current ADR)
    // Revenue = ADR * Days * Occupancy
    // Rent = ADR * Days * BreakEvenOcc
    // BreakEvenOcc = Rent / (ADR * Days)
    const breakEvenOccupancy = projectedADR > 0 
      ? (monthlyRent / (projectedADR * daysPerMonth)) * 100 
      : 100;
    
    // Break-even ADR (at current occupancy)
    // Rent = BreakEvenADR * Days * Occupancy
    // BreakEvenADR = Rent / (Days * Occupancy)
    const breakEvenADR = projectedOccupancy > 0 
      ? monthlyRent / (daysPerMonth * (projectedOccupancy / 100))
      : 0;
    
    // Cushion calculations
    const occupancyCushion = projectedOccupancy - breakEvenOccupancy;
    const adrCushion = projectedADR - breakEvenADR;
    const adrCushionPercent = breakEvenADR > 0 ? ((projectedADR - breakEvenADR) / breakEvenADR) * 100 : 0;
    
    // Monthly profit
    const monthlyProfit = projectedRevenue - monthlyRent;
    
    // Months to recover startup costs
    const monthsToBreakEven = monthlyProfit > 0 ? Math.ceil(startupCosts / monthlyProfit) : Infinity;
    
    // Worst case scenario (30% drop in occupancy)
    const worstCaseOccupancy = projectedOccupancy * 0.7;
    const worstCaseRevenue = projectedADR * daysPerMonth * (worstCaseOccupancy / 100);
    const worstCaseProfit = worstCaseRevenue - monthlyRent;
    
    // Best case scenario (20% increase in occupancy, capped at 95%)
    const bestCaseOccupancy = Math.min(projectedOccupancy * 1.2, 95);
    const bestCaseRevenue = projectedADR * daysPerMonth * (bestCaseOccupancy / 100);
    const bestCaseProfit = bestCaseRevenue - monthlyRent;
    
    // Safety score (0-100)
    // Based on: cushion size, worst case profitability, months to break even
    let safetyScore = 50; // Start at neutral
    
    // Cushion contribution (up to 30 points)
    if (occupancyCushion >= 25) safetyScore += 30;
    else if (occupancyCushion >= 15) safetyScore += 20;
    else if (occupancyCushion >= 10) safetyScore += 10;
    else if (occupancyCushion < 5) safetyScore -= 10;
    
    // Worst case contribution (up to 30 points)
    if (worstCaseProfit >= 500) safetyScore += 30;
    else if (worstCaseProfit >= 0) safetyScore += 15;
    else if (worstCaseProfit >= -500) safetyScore += 0;
    else safetyScore -= 20;
    
    // Break-even time contribution (up to 20 points)
    if (monthsToBreakEven <= 6) safetyScore += 20;
    else if (monthsToBreakEven <= 12) safetyScore += 10;
    else if (monthsToBreakEven <= 18) safetyScore += 0;
    else safetyScore -= 10;
    
    // Clamp to 0-100
    safetyScore = Math.max(0, Math.min(100, safetyScore));
    
    return {
      breakEvenOccupancy,
      breakEvenADR,
      occupancyCushion,
      adrCushion,
      adrCushionPercent,
      monthlyProfit,
      monthsToBreakEven,
      worstCaseOccupancy,
      worstCaseRevenue,
      worstCaseProfit,
      bestCaseOccupancy,
      bestCaseRevenue,
      bestCaseProfit,
      safetyScore
    };
  }, [monthlyRent, projectedADR, projectedOccupancy, projectedRevenue, startupCosts]);
  
  const isProfitable = calculations.monthlyProfit > 0;
  
  return (
    <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg">
            <Calculator className="w-5 h-5 text-slate-700" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-slate-900">Break-Even Calculator</h3>
            <p className="text-sm text-slate-500">Know your numbers before you invest</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
            isProfitable 
              ? 'bg-emerald-100 text-emerald-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {isProfitable ? 'Profitable' : 'Not Profitable'}
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>
      
      {/* Content */}
      {expanded && (
        <div className="p-4 pt-0 space-y-6">
          {/* Safety Score */}
          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-slate-600" />
                <span className="font-semibold text-slate-900">Investment Safety Score</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-white/50 rounded transition-colors">
                    <Info className="w-4 h-4 text-slate-400" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs p-3 bg-white text-slate-900 shadow-lg border">
                  <p className="text-sm leading-relaxed">{TOOLTIPS.safetyScore}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <SafetyMeter score={calculations.safetyScore} />
          </div>
          
          {/* Break-Even Metrics */}
          <div className="grid grid-cols-2 gap-4">
            {/* Break-Even Occupancy */}
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Break-Even Occupancy</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-1 hover:bg-white/50 rounded transition-colors">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs p-3 bg-white text-slate-900 shadow-lg border">
                    <p className="text-sm leading-relaxed">{TOOLTIPS.breakEvenOccupancy}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{calculations.breakEvenOccupancy.toFixed(0)}%</span>
                <span className="text-sm text-slate-500">minimum</span>
              </div>
              <div className="mt-2 flex items-center gap-1">
                <span className={`text-sm font-medium ${calculations.occupancyCushion >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {calculations.occupancyCushion >= 0 ? '+' : ''}{calculations.occupancyCushion.toFixed(0)}%
                </span>
                <span className="text-xs text-slate-500">cushion</span>
              </div>
            </div>
            
            {/* Break-Even ADR */}
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Break-Even Nightly Rate</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-1 hover:bg-white/50 rounded transition-colors">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs p-3 bg-white text-slate-900 shadow-lg border">
                    <p className="text-sm leading-relaxed">{TOOLTIPS.breakEvenADR}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{formatCurrency(calculations.breakEvenADR)}</span>
                <span className="text-sm text-slate-500">minimum</span>
              </div>
              <div className="mt-2 flex items-center gap-1">
                <span className={`text-sm font-medium ${calculations.adrCushion >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {calculations.adrCushion >= 0 ? '+' : ''}{formatCurrency(calculations.adrCushion)}
                </span>
                <span className="text-xs text-slate-500">cushion ({calculations.adrCushionPercent.toFixed(0)}%)</span>
              </div>
            </div>
          </div>
          
          {/* Months to Break Even */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-slate-900">Time to Recover Startup Costs</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-white/50 rounded transition-colors">
                    <Info className="w-4 h-4 text-slate-400" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs p-3 bg-white text-slate-900 shadow-lg border">
                  <p className="text-sm leading-relaxed">{TOOLTIPS.monthsToBreakEven}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-700">
                {calculations.monthsToBreakEven === Infinity ? '∞' : calculations.monthsToBreakEven}
              </span>
              <span className="text-blue-600">months</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              Based on {formatCurrency(startupCosts)} startup costs and {formatCurrency(calculations.monthlyProfit)}/month profit
            </p>
            
            {/* Startup Cost Adjuster */}
            <div className="mt-3 pt-3 border-t border-blue-200">
              <label className="text-xs text-blue-600 font-medium">Adjust Startup Costs:</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min="5000"
                  max="50000"
                  step="1000"
                  value={startupCosts}
                  onChange={(e) => setStartupCosts(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm font-medium text-blue-700 w-20 text-right">
                  {formatCurrency(startupCosts)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Scenario Analysis */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Scenario Analysis
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ScenarioCard
                title="Worst Case (-30%)"
                icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
                occupancy={calculations.worstCaseOccupancy}
                revenue={calculations.worstCaseRevenue}
                profit={calculations.worstCaseProfit}
                isPositive={calculations.worstCaseProfit >= 0}
                tooltip={TOOLTIPS.worstCase}
                variant="warning"
              />
              <ScenarioCard
                title="Expected"
                icon={<CheckCircle2 className="w-4 h-4 text-slate-600" />}
                occupancy={projectedOccupancy}
                revenue={projectedRevenue}
                profit={calculations.monthlyProfit}
                isPositive={calculations.monthlyProfit >= 0}
                tooltip="This is the projected scenario based on market data."
              />
              <ScenarioCard
                title="Best Case (+20%)"
                icon={<Zap className="w-4 h-4 text-emerald-600" />}
                occupancy={calculations.bestCaseOccupancy}
                revenue={calculations.bestCaseRevenue}
                profit={calculations.bestCaseProfit}
                isPositive={calculations.bestCaseProfit >= 0}
                tooltip={TOOLTIPS.bestCase}
                variant="success"
              />
            </div>
          </div>
          
          {/* Key Insight */}
          <div className={`p-4 rounded-xl border ${
            calculations.worstCaseProfit >= 0 
              ? 'bg-emerald-50 border-emerald-200' 
              : calculations.monthlyProfit >= 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <p className={`text-sm font-medium ${
              calculations.worstCaseProfit >= 0 
                ? 'text-emerald-800' 
                : calculations.monthlyProfit >= 0
                ? 'text-amber-800'
                : 'text-red-800'
            }`}>
              {calculations.worstCaseProfit >= 0 
                ? `Strong investment: Even if bookings drop 30%, you'd still profit ${formatCurrency(calculations.worstCaseProfit)}/month.`
                : calculations.monthlyProfit >= 0
                ? `Moderate risk: Profitable at expected occupancy, but a 30% drop would result in ${formatCurrency(Math.abs(calculations.worstCaseProfit))}/month loss.`
                : `High risk: This property is not profitable at current projections. Consider negotiating lower rent or finding a different property.`
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default BreakEvenCalculator;
