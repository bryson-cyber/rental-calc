/**
 * Tesla Dashboard Component
 * 
 * Design Philosophy:
 * - Same powerful insights as AirDNA, dramatically simpler interface
 * - One hero metric per section, progressive disclosure for details
 * - Smart defaults, visual over tabular, instant insights
 * - Color = meaning (green/yellow/red for quick decisions)
 */

import { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Calendar,
  Percent,
  DollarSign,
  Home,
  Star,
  AlertTriangle,
  CheckCircle2,
  Info,
  Bed,
  Bath,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Camera,
  Briefcase,
  Award,
  Building2
} from 'lucide-react';
import { ImageCarousel } from './ImageCarousel';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface MonthlyForecast {
  month: string;
  revenue: number;
  adr: number;
  occupancy: number;
}

interface Comparable {
  id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  revenue: number;
  adr: number;
  occupancy: number;
  rating: number;
  reviews: number;
  imageUrl?: string;
  images?: string[];  // All images for carousel
  airbnbUrl?: string;
  distanceMeters?: number;
}

interface AnalysisResult {
  revenue: {
    projected: number;
    low: number;
    high: number;
  };
  metrics: {
    adr: number;
    occupancy: number;
  };
  cashFlow: {
    monthlyRevenue: number;
    monthlyRent: number;
    monthlyProfit: number;
  };
  forecast: MonthlyForecast[];
  comparables: Comparable[];
  historicalData?: {
    summary: {
      monthly_pct_change: number;
      yearly_pct_change: number;
      trend: 'up' | 'down' | 'stable';
    };
    months: Array<{
      date: string;
      revenue: number;
      occupancy: number;
      adr: number;
    }>;
  };
  marketInsights?: {
    professionallyManagedPct: number;
    superhostPct: number;
    avgRating?: number;
    totalListings?: number;
  };
}

interface TeslaDashboardProps {
  result: AnalysisResult;
  address: string;
  bedrooms: number;
  bathrooms: number;
}

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

const formatCompactCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return formatCurrency(value);
};

const formatMonth = (dateStr: string): string => {
  if (dateStr && dateStr.length <= 3) return dateStr;
  if (dateStr && dateStr.includes('-') && dateStr.length === 7) {
    const [, monthNum] = dateStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[parseInt(monthNum, 10) - 1] || dateStr;
  }
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString('en-US', { month: 'short' });
  }
  return dateStr || 'N/A';
};

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Hero Revenue Card - The main number users care about
 */
function HeroRevenueCard({ 
  annualRevenue, 
  monthlyProfit, 
  monthlyRent,
  yearlyChange 
}: { 
  annualRevenue: number;
  monthlyProfit: number;
  monthlyRent: number;
  yearlyChange?: number;
}) {
  const isProfitable = monthlyProfit > 0;
  const profitMargin = monthlyRent > 0 ? ((monthlyProfit / monthlyRent) * 100) : 0;
  
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 md:p-8">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative">
        {/* Verdict Badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-4 ${
          isProfitable 
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {isProfitable ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              This Property Cash Flows
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" />
              Tight Margins - Review Carefully
            </>
          )}
        </div>
        
        {/* Hero Number */}
        <div className="mb-6">
          <p className="text-slate-400 text-sm font-medium mb-1">Projected Annual Revenue</p>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl md:text-5xl font-bold text-white tracking-tight">
              {formatCurrency(annualRevenue)}
            </span>
            {yearlyChange !== undefined && (
              <span className={`flex items-center gap-1 text-sm font-medium ${
                yearlyChange >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {yearlyChange >= 0 ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(yearlyChange).toFixed(1)}% vs last year
              </span>
            )}
          </div>
        </div>
        
        {/* Monthly Breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-slate-400 text-xs font-medium mb-1">Monthly Revenue</p>
            <p className="text-xl font-bold text-white">{formatCurrency(annualRevenue / 12)}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-slate-400 text-xs font-medium mb-1">Your Rent</p>
            <p className="text-xl font-bold text-white">{formatCurrency(monthlyRent)}</p>
          </div>
          <div className={`rounded-xl p-4 ${
            isProfitable ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}>
            <p className="text-slate-400 text-xs font-medium mb-1">Monthly Profit</p>
            <p className={`text-xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(monthlyProfit)}
            </p>
          </div>
        </div>
        
        {/* Profit Insight */}
        {monthlyRent > 0 && (
          <p className="text-slate-400 text-sm mt-4">
            {isProfitable ? (
              <>Your revenue covers rent <span className="text-emerald-400 font-medium">{(profitMargin + 100).toFixed(0)}%</span> — you keep {formatCurrency(monthlyProfit)}/month</>
            ) : (
              <>Revenue covers only <span className="text-red-400 font-medium">{(100 - Math.abs(profitMargin)).toFixed(0)}%</span> of rent — you'd lose {formatCurrency(Math.abs(monthlyProfit))}/month</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Key Metrics Row - Supporting stats at a glance
 */
function KeyMetricsRow({ 
  adr, 
  occupancy, 
  revenueLow, 
  revenueHigh 
}: { 
  adr: number;
  occupancy: number;
  revenueLow: number;
  revenueHigh: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard
        icon={<DollarSign className="w-5 h-5" />}
        label="Nightly Rate"
        value={formatCurrency(adr)}
        sublabel="Average Daily Rate"
        color="blue"
      />
      <MetricCard
        icon={<Percent className="w-5 h-5" />}
        label="Occupancy"
        value={`${Math.round(occupancy)}%`}
        sublabel="Booked nights"
        color="purple"
      />
      <MetricCard
        icon={<TrendingDown className="w-5 h-5" />}
        label="Conservative"
        value={formatCompactCurrency(revenueLow)}
        sublabel="Low estimate"
        color="amber"
      />
      <MetricCard
        icon={<TrendingUp className="w-5 h-5" />}
        label="Optimistic"
        value={formatCompactCurrency(revenueHigh)}
        sublabel="High estimate"
        color="emerald"
      />
    </div>
  );
}

function MetricCard({ 
  icon, 
  label, 
  value, 
  sublabel, 
  color 
}: { 
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  color: 'blue' | 'purple' | 'amber' | 'emerald';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  };
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${colorClasses[color]}`}>
        {icon}
      </div>
      <p className="text-slate-500 text-xs font-medium">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-slate-400 text-xs">{sublabel}</p>
    </div>
  );
}

/**
 * Seasonal Forecast Chart - Simplified bar chart with insights
 */
function SeasonalForecast({ forecast }: { forecast: MonthlyForecast[] }) {
  const [showDetails, setShowDetails] = useState(false);
  
  if (!forecast || forecast.length === 0) return null;
  
  // Calculate insights
  const maxRevenue = Math.max(...forecast.map(m => m.revenue));
  const minRevenue = Math.min(...forecast.map(m => m.revenue));
  const avgRevenue = forecast.reduce((sum, m) => sum + m.revenue, 0) / forecast.length;
  
  const peakMonth = forecast.find(m => m.revenue === maxRevenue);
  const slowMonth = forecast.find(m => m.revenue === minRevenue);
  
  // Find peak and slow seasons (consecutive months)
  const sortedByRevenue = [...forecast].sort((a, b) => b.revenue - a.revenue);
  const peakMonths = sortedByRevenue.slice(0, 3).map(m => formatMonth(m.month));
  const slowMonths = sortedByRevenue.slice(-3).map(m => formatMonth(m.month));
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Seasonal Forecast</h3>
          <p className="text-slate-500 text-sm">12-month revenue projection</p>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          {showDetails ? 'Hide' : 'Show'} details
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      
      {/* Quick Insight */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-xl">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-sm text-slate-600">
            <span className="font-medium">Peak:</span> {peakMonths.join(', ')} ({formatCurrency(peakMonth?.revenue || 0)}/mo)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm text-slate-600">
            <span className="font-medium">Slow:</span> {slowMonths.join(', ')} ({formatCurrency(slowMonth?.revenue || 0)}/mo)
          </span>
        </div>
      </div>
      
      {/* Bar Chart */}
      <div className="grid grid-cols-12 gap-1 h-32 items-end mb-2">
        {forecast.slice(0, 12).map((month, idx) => {
          const heightPct = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;
          const isPeak = month.revenue === maxRevenue;
          const isSlow = month.revenue === minRevenue;
          
          return (
            <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                  <p className="font-medium">{formatMonth(month.month)}</p>
                  <p>{formatCurrency(month.revenue)}</p>
                  <p>{Math.round(month.occupancy)}% occupancy</p>
                </div>
              </div>
              
              {/* Bar */}
              <div 
                className={`w-full rounded-t transition-all cursor-pointer ${
                  isPeak 
                    ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' 
                    : isSlow 
                    ? 'bg-gradient-to-t from-amber-500 to-amber-300'
                    : 'bg-gradient-to-t from-slate-400 to-slate-300 group-hover:from-slate-500 group-hover:to-slate-400'
                }`}
                style={{ height: `${Math.max(heightPct, 8)}%` }}
              />
              
              {/* Month label */}
              <div className="text-[10px] text-slate-500 mt-1 font-medium">
                {formatMonth(month.month).substring(0, 1)}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Month labels (full) */}
      <div className="grid grid-cols-12 gap-1 text-center">
        {forecast.slice(0, 12).map((month, idx) => (
          <div key={idx} className="text-[9px] text-slate-400 hidden md:block">
            {formatMonth(month.month)}
          </div>
        ))}
      </div>
      
      {/* Detailed Stats */}
      {showDetails && (
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-200">
          <div className="text-center">
            <p className="text-slate-500 text-xs mb-1">Average Monthly</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(avgRevenue)}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 text-xs mb-1">Seasonality Swing</p>
            <p className="text-lg font-bold text-slate-900">
              {Math.round(((maxRevenue - minRevenue) / avgRevenue) * 100)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 text-xs mb-1">Avg Occupancy</p>
            <p className="text-lg font-bold text-slate-900">
              {Math.round(forecast.reduce((sum, m) => sum + m.occupancy, 0) / forecast.length)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Arbitrage Calculator - Break-even and risk analysis
 */
function ArbitrageCalculator({ 
  monthlyRevenue, 
  monthlyRent, 
  occupancy,
  adr
}: { 
  monthlyRevenue: number;
  monthlyRent: number;
  occupancy: number;
  adr: number;
}) {
  // Calculate break-even occupancy
  // Monthly Revenue = ADR * Days * Occupancy
  // Break-even: Rent = ADR * 30 * BreakEvenOcc
  // BreakEvenOcc = Rent / (ADR * 30)
  const breakEvenOccupancy = monthlyRent > 0 && adr > 0 
    ? (monthlyRent / (adr * 30)) * 100 
    : 0;
  
  // Calculate cushion
  const occupancyCushion = occupancy - breakEvenOccupancy;
  
  // Risk scenario: 20% drop in occupancy
  const riskOccupancy = occupancy * 0.8;
  const riskRevenue = (riskOccupancy / 100) * adr * 30;
  const riskProfit = riskRevenue - monthlyRent;
  
  // Determine risk level
  const riskLevel = occupancyCushion >= 20 ? 'low' : occupancyCushion >= 10 ? 'medium' : 'high';
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Arbitrage Analysis</h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          riskLevel === 'low' 
            ? 'bg-emerald-100 text-emerald-700'
            : riskLevel === 'medium'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {riskLevel === 'low' ? 'Low Risk' : riskLevel === 'medium' ? 'Medium Risk' : 'High Risk'}
        </span>
      </div>
      
      <div className="space-y-4">
        {/* Break-even Analysis */}
        <div className="p-4 bg-slate-50 rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-600">Break-even Occupancy</span>
            <span className="font-bold text-slate-900">{breakEvenOccupancy.toFixed(0)}%</span>
          </div>
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 rounded-full"
              style={{ width: '100%' }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <div 
              className="flex flex-col items-center"
              style={{ marginLeft: `${Math.min(breakEvenOccupancy, 95)}%`, transform: 'translateX(-50%)' }}
            >
              <div className="w-0.5 h-2 bg-slate-900" />
              <span className="text-[10px] text-slate-500">Break-even</span>
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-3">
            You need <span className="font-medium">{breakEvenOccupancy.toFixed(0)}%</span> occupancy to cover rent. 
            Current projection is <span className="font-medium text-emerald-600">{Math.round(occupancy)}%</span> — 
            that's a <span className={`font-medium ${occupancyCushion >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {occupancyCushion.toFixed(0)}%
            </span> cushion.
          </p>
        </div>
        
        {/* Risk Scenario */}
        <div className={`p-4 rounded-xl ${
          riskProfit >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-4 h-4 ${riskProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
            <span className="text-sm font-medium text-slate-700">If occupancy drops 20%</span>
          </div>
          <p className={`text-lg font-bold ${riskProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {riskProfit >= 0 
              ? `You'd still profit ${formatCurrency(riskProfit)}/month`
              : `You'd lose ${formatCurrency(Math.abs(riskProfit))}/month`
            }
          </p>
          <p className="text-xs text-slate-500 mt-1">
            At {riskOccupancy.toFixed(0)}% occupancy = {formatCurrency(riskRevenue)}/month revenue
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Market Position Card - How property ranks
 */
function MarketPosition({ 
  propertyRevenue, 
  comparables 
}: { 
  propertyRevenue: number;
  comparables: Comparable[];
}) {
  if (!comparables || comparables.length === 0) return null;
  
  const allRevenues = comparables.map(c => c.revenue).sort((a, b) => b - a);
  const position = allRevenues.findIndex(r => propertyRevenue >= r);
  const rank = position === -1 ? allRevenues.length + 1 : position + 1;
  const percentile = Math.round(((allRevenues.length - rank + 1) / allRevenues.length) * 100);
  const avgCompRevenue = allRevenues.reduce((sum, r) => sum + r, 0) / allRevenues.length;
  const vsAvg = ((propertyRevenue - avgCompRevenue) / avgCompRevenue) * 100;
  
  // Determine grade
  const grade = percentile >= 90 ? 'A+' : percentile >= 80 ? 'A' : percentile >= 70 ? 'B+' : 
                percentile >= 60 ? 'B' : percentile >= 50 ? 'C+' : percentile >= 40 ? 'C' : 'D';
  
  const gradeColor = grade.startsWith('A') ? 'emerald' : grade.startsWith('B') ? 'blue' : 
                     grade.startsWith('C') ? 'amber' : 'red';
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Market Position</h3>
      
      <div className="flex items-center gap-6">
        {/* Grade Circle */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${
          gradeColor === 'emerald' ? 'bg-emerald-100 text-emerald-700 border-4 border-emerald-500' :
          gradeColor === 'blue' ? 'bg-blue-100 text-blue-700 border-4 border-blue-500' :
          gradeColor === 'amber' ? 'bg-amber-100 text-amber-700 border-4 border-amber-500' :
          'bg-red-100 text-red-700 border-4 border-red-500'
        }`}>
          {grade}
        </div>
        
        {/* Stats */}
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <div>
              <p className="text-slate-500 text-xs">Percentile</p>
              <p className="text-xl font-bold text-slate-900">{percentile}th</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Rank</p>
              <p className="text-xl font-bold text-slate-900">#{rank} of {allRevenues.length + 1}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">vs Average</p>
              <p className={`text-xl font-bold ${vsAvg >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {vsAvg >= 0 ? '+' : ''}{vsAvg.toFixed(0)}%
              </p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                gradeColor === 'emerald' ? 'bg-emerald-500' :
                gradeColor === 'blue' ? 'bg-blue-500' :
                gradeColor === 'amber' ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${percentile}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Bottom 25%</span>
            <span>Median</span>
            <span>Top 25%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Market Health Grade - Overall market assessment with letter grade
 */
function MarketHealthGrade({
  occupancy,
  yoyChange,
  professionalPct,
  superhostPct,
  totalListings,
  avgRating,
  forecast
}: {
  occupancy: number;
  yoyChange?: number;
  professionalPct?: number;
  superhostPct?: number;
  totalListings?: number;
  avgRating?: number;
  forecast?: MonthlyForecast[];
}) {
  // Calculate individual scores (0-100)
  
  // 1. Occupancy Score (higher is better)
  // 70%+ = excellent, 50-70% = good, 30-50% = fair, <30% = poor
  const occupancyScore = Math.min(100, Math.max(0, (occupancy / 0.75) * 100));
  
  // 2. Growth Score (based on YoY change)
  // +10%+ = excellent, +5-10% = good, 0-5% = fair, negative = poor
  let growthScore = 50; // neutral default
  if (yoyChange !== undefined) {
    if (yoyChange >= 10) growthScore = 100;
    else if (yoyChange >= 5) growthScore = 80;
    else if (yoyChange >= 0) growthScore = 60;
    else if (yoyChange >= -5) growthScore = 40;
    else growthScore = 20;
  }
  
  // 3. Competition Score (lower professional % = better for new hosts)
  // <30% = excellent opportunity, 30-50% = good, 50-70% = competitive, >70% = saturated
  let competitionScore = 70; // neutral default
  if (professionalPct !== undefined) {
    if (professionalPct < 30) competitionScore = 90;
    else if (professionalPct < 50) competitionScore = 70;
    else if (professionalPct < 70) competitionScore = 50;
    else competitionScore = 30;
  }
  
  // 4. Quality Score (based on avg rating and superhost %)
  let qualityScore = 70;
  if (avgRating !== undefined && avgRating > 0) {
    qualityScore = Math.min(100, (avgRating / 5) * 100);
  }
  
  // 5. Seasonality Score (how stable is revenue throughout the year)
  let seasonalityScore = 70;
  if (forecast && forecast.length >= 4) {
    const revenues = forecast.map(f => f.revenue);
    const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const variance = revenues.reduce((sum, r) => sum + Math.pow(r - avgRevenue, 2), 0) / revenues.length;
    const coefficientOfVariation = Math.sqrt(variance) / avgRevenue;
    // Lower CV = more stable = higher score
    seasonalityScore = Math.max(20, 100 - (coefficientOfVariation * 200));
  }
  
  // Calculate weighted average
  const weights = {
    occupancy: 0.30,
    growth: 0.25,
    competition: 0.20,
    quality: 0.15,
    seasonality: 0.10
  };
  
  const overallScore = 
    occupancyScore * weights.occupancy +
    growthScore * weights.growth +
    competitionScore * weights.competition +
    qualityScore * weights.quality +
    seasonalityScore * weights.seasonality;
  
  // Convert score to letter grade
  let grade: string;
  let gradeColor: string;
  let gradeBg: string;
  let gradeText: string;
  
  if (overallScore >= 90) {
    grade = 'A+';
    gradeColor = 'text-emerald-600';
    gradeBg = 'bg-emerald-100';
    gradeText = 'Exceptional market with strong fundamentals';
  } else if (overallScore >= 80) {
    grade = 'A';
    gradeColor = 'text-emerald-600';
    gradeBg = 'bg-emerald-100';
    gradeText = 'Excellent market for short-term rentals';
  } else if (overallScore >= 70) {
    grade = 'B+';
    gradeColor = 'text-blue-600';
    gradeBg = 'bg-blue-100';
    gradeText = 'Strong market with good potential';
  } else if (overallScore >= 60) {
    grade = 'B';
    gradeColor = 'text-blue-600';
    gradeBg = 'bg-blue-100';
    gradeText = 'Solid market worth considering';
  } else if (overallScore >= 50) {
    grade = 'C+';
    gradeColor = 'text-amber-600';
    gradeBg = 'bg-amber-100';
    gradeText = 'Average market - proceed with caution';
  } else if (overallScore >= 40) {
    grade = 'C';
    gradeColor = 'text-amber-600';
    gradeBg = 'bg-amber-100';
    gradeText = 'Below average - research thoroughly';
  } else if (overallScore >= 30) {
    grade = 'D';
    gradeColor = 'text-red-600';
    gradeBg = 'bg-red-100';
    gradeText = 'Challenging market conditions';
  } else {
    grade = 'F';
    gradeColor = 'text-red-600';
    gradeBg = 'bg-red-100';
    gradeText = 'High risk - not recommended';
  }
  
  // Factor breakdown
  const factors = [
    { name: 'Occupancy', score: occupancyScore, weight: weights.occupancy, icon: '📊' },
    { name: 'Growth Trend', score: growthScore, weight: weights.growth, icon: '📈' },
    { name: 'Competition', score: competitionScore, weight: weights.competition, icon: '🏆' },
    { name: 'Quality', score: qualityScore, weight: weights.quality, icon: '⭐' },
    { name: 'Seasonality', score: seasonalityScore, weight: weights.seasonality, icon: '📅' },
  ];
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-slate-600" />
            Market Health Grade
          </h3>
          <p className="text-sm text-slate-500 mt-1">Overall market assessment based on key factors</p>
        </div>
        
        {/* Big Grade Badge */}
        <div className={`${gradeBg} ${gradeColor} rounded-2xl px-6 py-4 text-center`}>
          <div className="text-4xl font-bold">{grade}</div>
          <div className="text-xs font-medium mt-1 opacity-80">
            {Math.round(overallScore)}/100
          </div>
        </div>
      </div>
      
      {/* Grade Summary */}
      <div className={`${gradeBg} rounded-lg p-4 mb-6`}>
        <p className={`${gradeColor} font-medium`}>{gradeText}</p>
      </div>
      
      {/* Factor Breakdown */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Score Breakdown</p>
        {factors.map((factor) => (
          <div key={factor.name} className="flex items-center gap-3">
            <span className="text-lg">{factor.icon}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-600">{factor.name}</span>
                <span className="text-sm font-medium text-slate-900">
                  {Math.round(factor.score)}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    factor.score >= 70 ? 'bg-emerald-500' :
                    factor.score >= 50 ? 'bg-blue-500' :
                    factor.score >= 30 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${factor.score}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Methodology Note */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Grade calculated from: occupancy rate (30%), growth trends (25%), competition level (20%), 
          quality indicators (15%), and seasonality stability (10%).
        </p>
      </div>
    </div>
  );
}

/**
 * Market Insights Card - Professional management and Superhost stats
 */
function MarketInsights({ 
  insights,
  totalComparables
}: { 
  insights?: {
    professionallyManagedPct: number;
    superhostPct: number;
    avgRating?: number;
    totalListings?: number;
  };
  totalComparables: number;
}) {
  if (!insights) return null;
  
  const { professionallyManagedPct, superhostPct, avgRating, totalListings } = insights;
  
  // Determine competitive landscape
  const isHighlyProfessional = professionallyManagedPct > 50;
  const isHighSuperhost = superhostPct > 40;
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-slate-600" />
        Market Landscape
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Professional Management */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isHighlyProfessional ? 'bg-amber-100' : 'bg-emerald-100'
            }`}>
              <Briefcase className={`w-4 h-4 ${
                isHighlyProfessional ? 'text-amber-600' : 'text-emerald-600'
              }`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {professionallyManagedPct.toFixed(0)}%
          </p>
          <p className="text-xs text-slate-500">Professionally Managed</p>
          <p className={`text-xs mt-1 ${
            isHighlyProfessional ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            {isHighlyProfessional ? 'High competition' : 'Opportunity for individuals'}
          </p>
        </div>
        
        {/* Superhost Percentage */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isHighSuperhost ? 'bg-amber-100' : 'bg-blue-100'
            }`}>
              <Award className={`w-4 h-4 ${
                isHighSuperhost ? 'text-amber-600' : 'text-blue-600'
              }`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {superhostPct.toFixed(0)}%
          </p>
          <p className="text-xs text-slate-500">Superhosts</p>
          <p className={`text-xs mt-1 ${
            isHighSuperhost ? 'text-amber-600' : 'text-blue-600'
          }`}>
            {isHighSuperhost ? 'Quality-focused market' : 'Room to stand out'}
          </p>
        </div>
        
        {/* Average Rating */}
        {avgRating !== undefined && avgRating > 0 && (
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Star className="w-4 h-4 text-yellow-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {avgRating.toFixed(1)}
            </p>
            <p className="text-xs text-slate-500">Avg Rating</p>
            <p className="text-xs mt-1 text-yellow-600">
              {avgRating >= 4.8 ? 'High standards' : avgRating >= 4.5 ? 'Good quality' : 'Mixed reviews'}
            </p>
          </div>
        )}
        
        {/* Total Listings */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Home className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {totalListings || totalComparables}
          </p>
          <p className="text-xs text-slate-500">Similar Listings</p>
          <p className="text-xs mt-1 text-purple-600">
            {(totalListings || totalComparables) > 50 ? 'Saturated market' : 
             (totalListings || totalComparables) > 20 ? 'Moderate competition' : 'Low competition'}
          </p>
        </div>
      </div>
      
      {/* Insight Summary */}
      <div className="mt-4 p-3 bg-slate-100 rounded-lg">
        <p className="text-sm text-slate-600">
          <span className="font-medium">Market Insight:</span>{' '}
          {isHighlyProfessional && isHighSuperhost ? (
            'This is a competitive, quality-focused market dominated by professionals. Focus on exceptional guest experience to succeed.'
          ) : isHighlyProfessional ? (
            'Professional operators dominate this market. Consider property management or develop strong systems to compete.'
          ) : isHighSuperhost ? (
            'Quality matters here. Invest in guest experience and aim for Superhost status to maximize bookings.'
          ) : (
            'This market has room for new hosts. Focus on quality photos, competitive pricing, and responsive communication to stand out.'
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * Comparable Properties Cards - Visual property cards with image carousel
 */
function ComparableProperties({ 
  comparables,
  onViewAll
}: { 
  comparables: Comparable[];
  onViewAll?: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [selectedComp, setSelectedComp] = useState<Comparable | null>(null);
  
  if (!comparables || comparables.length === 0) return null;
  
  const displayComps = showAll ? comparables : comparables.slice(0, 6);
  
  const openCarousel = (comp: Comparable) => {
    // Only open carousel if there are images
    const images = comp.images && comp.images.length > 0 ? comp.images : (comp.imageUrl ? [comp.imageUrl] : []);
    if (images.length > 0) {
      setSelectedComp(comp);
      setCarouselOpen(true);
    }
  };
  
  const getCompImages = (comp: Comparable): string[] => {
    if (comp.images && comp.images.length > 0) return comp.images;
    if (comp.imageUrl) return [comp.imageUrl];
    return [];
  };
  
  return (
    <>
      {/* Image Carousel Modal */}
      <ImageCarousel
        images={selectedComp ? getCompImages(selectedComp) : []}
        isOpen={carouselOpen}
        onClose={() => {
          setCarouselOpen(false);
          setSelectedComp(null);
        }}
        title={selectedComp?.title}
        airbnbUrl={selectedComp?.airbnbUrl}
      />
      
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Similar Properties Nearby</h3>
            <p className="text-slate-500 text-sm">{comparables.length} properties making money in this area</p>
          </div>
          {comparables.length > 6 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {showAll ? 'Show less' : `See all ${comparables.length}`}
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayComps.map((comp, idx) => {
            const hasImages = (comp.images && comp.images.length > 0) || !!comp.imageUrl;
            const imageCount = comp.images?.length || (comp.imageUrl ? 1 : 0);
            
            return (
              <div 
                key={comp.id} 
                className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Image - Clickable to open carousel */}
                <div 
                  className={`h-32 bg-gradient-to-br from-amber-50 to-amber-100 relative ${hasImages ? 'cursor-pointer group' : ''}`}
                  onClick={() => hasImages && openCarousel(comp)}
                >
                  {comp.imageUrl ? (
                    <img 
                      src={comp.imageUrl} 
                      alt={comp.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        // On error, hide the image and show placeholder
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const placeholder = target.nextElementSibling as HTMLElement;
                        if (placeholder) placeholder.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  {/* Placeholder - shown when no image or image fails to load */}
                  <div 
                    className="w-full h-full flex flex-col items-center justify-center absolute inset-0"
                    style={{ display: comp.imageUrl ? 'none' : 'flex' }}
                  >
                    <div className="w-12 h-12 rounded-full bg-amber-200/50 flex items-center justify-center mb-1">
                      <Home className="w-6 h-6 text-amber-600" />
                    </div>
                    <span className="text-xs font-medium text-amber-700">{comp.bedrooms} BR / {comp.bathrooms} BA</span>
                  </div>
                  {/* Hover overlay with photo count */}
                  {hasImages && imageCount > 1 && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex items-center gap-1.5 bg-black/70 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                        <Camera className="w-4 h-4" />
                        <span>{imageCount} photos</span>
                      </div>
                    </div>
                  )}
                  {/* Rank badge */}
                  <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-xs font-bold text-slate-700 shadow-sm">
                    {idx + 1}
                  </div>
                  {/* Rating badge */}
                  {comp.rating > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 rounded-full px-2 py-0.5 shadow-sm">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="text-xs font-medium text-slate-700">{comp.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
            
            {/* Content */}
            <div className="p-3">
              <h4 className="font-medium text-slate-900 text-sm line-clamp-1 mb-1">{comp.title}</h4>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <span className="flex items-center gap-1">
                  <Bed className="w-3 h-3" /> {comp.bedrooms}
                </span>
                <span className="flex items-center gap-1">
                  <Bath className="w-3 h-3" /> {comp.bathrooms}
                </span>
                {comp.accommodates && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {comp.accommodates}
                  </span>
                )}
              </div>
              
              {/* Revenue */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-600 font-bold">{formatCompactCurrency(comp.revenue)}/yr</p>
                  <p className="text-[10px] text-slate-400">{Math.round(comp.occupancy)}% occupancy · ${Math.round(comp.adr)}/night</p>
                </div>
                {comp.airbnbUrl && (
                  <a
                    href={comp.airbnbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-600" />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
    </>
  );
}
// ============================================
// MAIN COMPONENT
// ============================================

export function TeslaDashboard({ result, address, bedrooms, bathrooms }: TeslaDashboardProps) {
  const yearlyChange = result.historicalData?.summary?.yearly_pct_change;
  
  return (
    <div className="space-y-6">
      {/* Property Header */}
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
          Property Analysis
        </h2>
        <p className="text-slate-500">{address}</p>
        <div className="flex items-center justify-center gap-3 mt-2 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <Bed className="w-4 h-4" /> {bedrooms} BR
          </span>
          <span className="flex items-center gap-1">
            <Bath className="w-4 h-4" /> {bathrooms} BA
          </span>
        </div>
      </div>
      
      {/* Hero Revenue Card */}
      <HeroRevenueCard
        annualRevenue={result.revenue.projected}
        monthlyProfit={result.cashFlow.monthlyProfit}
        monthlyRent={result.cashFlow.monthlyRent}
        yearlyChange={yearlyChange}
      />
      
      {/* Key Metrics */}
      <KeyMetricsRow
        adr={result.metrics.adr}
        occupancy={result.metrics.occupancy}
        revenueLow={result.revenue.low}
        revenueHigh={result.revenue.high}
      />
      
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seasonal Forecast */}
        <SeasonalForecast forecast={result.forecast} />
        
        {/* Arbitrage Calculator */}
        <ArbitrageCalculator
          monthlyRevenue={result.cashFlow.monthlyRevenue}
          monthlyRent={result.cashFlow.monthlyRent}
          occupancy={result.metrics.occupancy}
          adr={result.metrics.adr}
        />
      </div>
      
      {/* Market Health Grade */}
      <MarketHealthGrade
        occupancy={result.metrics.occupancy}
        yoyChange={yearlyChange}
        professionalPct={result.marketInsights?.professionallyManagedPct}
        superhostPct={result.marketInsights?.superhostPct}
        totalListings={result.marketInsights?.totalListings}
        avgRating={result.marketInsights?.avgRating}
        forecast={result.forecast}
      />
      
      {/* Market Position */}
      <MarketPosition
        propertyRevenue={result.revenue.projected}
        comparables={result.comparables}
      />
      
      {/* Market Insights - Professional Management & Superhost Stats */}
      <MarketInsights
        insights={result.marketInsights}
        totalComparables={result.comparables.length}
      />
      
      {/* Comparable Properties */}
      <ComparableProperties comparables={result.comparables} />
    </div>
  );
}

export default TeslaDashboard;
