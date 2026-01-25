import { useState } from 'react';
import { TrendingUp, TrendingDown, Calendar, ChevronDown, ChevronUp, Flame, Sun, Cloud, Snowflake, Info } from 'lucide-react';

interface ForwardDemandIndicators {
  next30Days: {
    avgOccupancy: number;
    avgAdr: number;
    avgSupply: number;
    avgDemand: number;
    trend: 'hot' | 'warm' | 'cool' | 'cold';
    trendLabel: string;
  };
  next180Days: {
    avgOccupancy: number;
    avgAdr: number;
    avgSupply: number;
    avgDemand: number;
    trend: 'hot' | 'warm' | 'cool' | 'cold';
    trendLabel: string;
  };
  peakPeriod: {
    startDate: string;
    endDate: string;
    avgOccupancy: number;
  } | null;
  lowPeriod: {
    startDate: string;
    endDate: string;
    avgOccupancy: number;
  } | null;
}

interface ForwardDemandCardProps {
  data: ForwardDemandIndicators;
  isLoading?: boolean;
}

// Simple tooltip component - LIGHT MODE for professional look
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="relative group inline-flex w-full">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-white text-[oklch(0.30_0_0)] text-xs rounded-lg shadow-lg border border-[oklch(0.90_0_0)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal pointer-events-none z-10 max-w-xs text-center">
        {text}
      </span>
    </span>
  );
}

// Tooltip explanations (third-grader friendly)
const DEMAND_TOOLTIPS = {
  forwardDemand: "This shows how busy the market will be in the future. Think of it like a weather forecast, but for bookings!",
  next30Days: "How booked up properties will be in the next month. Hot = very busy, Cold = slow season.",
  next180Days: "A 6-month outlook. This helps you plan for the bigger picture.",
  peakPeriod: "The busiest week coming up - when most guests want to book. Great time to charge more!",
  lowPeriod: "The slowest week coming up - fewer guests booking. Consider discounts or minimum stays.",
  avgAdr: "Average nightly rate hosts are charging. Higher = guests willing to pay more.",
  avgSupply: "How many listings are available. More supply = more competition.",
  avgDemand: "How many nights guests want to book. Higher demand = easier to get bookings.",
};

const trendIcons = {
  hot: <Flame className="w-5 h-5 text-red-500" />,
  warm: <Sun className="w-5 h-5 text-orange-500" />,
  cool: <Cloud className="w-5 h-5 text-blue-400" />,
  cold: <Snowflake className="w-5 h-5 text-blue-600" />,
};

// Light theme colors matching other Step 3 cards
const trendColors = {
  hot: 'bg-emerald-50 border-emerald-200',
  warm: 'bg-amber-50 border-amber-200',
  cool: 'bg-slate-50 border-slate-200',
  cold: 'bg-blue-50 border-blue-200',
};

const trendTextColors = {
  hot: 'text-emerald-700',
  warm: 'text-amber-700',
  cool: 'text-slate-700',
  cold: 'text-blue-700',
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function ForwardDemandCard({ data, isLoading }: ForwardDemandCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-[oklch(0.98_0.01_265)] rounded-xl border border-[oklch(0.90_0.01_265)] p-6 animate-pulse">
        <div className="h-6 bg-[oklch(0.90_0.01_265)] rounded w-48 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-[oklch(0.90_0.01_265)] rounded" />
          <div className="h-32 bg-[oklch(0.90_0.01_265)] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[oklch(0.98_0.01_265)] rounded-xl border border-[oklch(0.90_0.01_265)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[oklch(0.90_0.01_265)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
            <h3 className="text-base font-medium text-[oklch(0.30_0_0)] flex items-center gap-2">
              Forward-Looking Demand
              <Tooltip text={DEMAND_TOOLTIPS.forwardDemand}>
                <Info className="w-4 h-4 text-[oklch(0.60_0_0)] cursor-help" />
              </Tooltip>
            </h3>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[oklch(0.50_0_0)] hover:text-[oklch(0.30_0_0)] transition-colors"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-[oklch(0.55_0_0)] mt-1">
          Forecast based on booking trends and market data
        </p>
      </div>

      {/* Main Content - Full width cards */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Next 30 Days - Full width card */}
          <Tooltip text={DEMAND_TOOLTIPS.next30Days}>
            <div className={`p-5 rounded-xl border-2 cursor-help w-full ${trendColors[data.next30Days.trend]}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {trendIcons[data.next30Days.trend]}
                  <span className={`text-sm font-semibold ${trendTextColors[data.next30Days.trend]}`}>Next 30 Days</span>
                </div>
              </div>
              <div className={`text-4xl font-bold mb-2 ${trendTextColors[data.next30Days.trend]}`}>
                {Math.round(data.next30Days.avgOccupancy)}%
              </div>
              <div className={`text-sm font-medium ${trendTextColors[data.next30Days.trend]} opacity-80`}>
                {data.next30Days.trendLabel}
              </div>
            </div>
          </Tooltip>

          {/* Next 180 Days - Full width card */}
          <Tooltip text={DEMAND_TOOLTIPS.next180Days}>
            <div className={`p-5 rounded-xl border-2 cursor-help w-full ${trendColors[data.next180Days.trend]}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {trendIcons[data.next180Days.trend]}
                  <span className={`text-sm font-semibold ${trendTextColors[data.next180Days.trend]}`}>Next 180 Days</span>
                </div>
              </div>
              <div className={`text-4xl font-bold mb-2 ${trendTextColors[data.next180Days.trend]}`}>
                {Math.round(data.next180Days.avgOccupancy)}%
              </div>
              <div className={`text-sm font-medium ${trendTextColors[data.next180Days.trend]} opacity-80`}>
                {data.next180Days.trendLabel}
              </div>
            </div>
          </Tooltip>
        </div>

        {/* Peak & Low Periods - Full width cards */}
        {(data.peakPeriod || data.lowPeriod) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {data.peakPeriod && (
              <Tooltip text={DEMAND_TOOLTIPS.peakPeriod}>
                <div className="p-4 bg-emerald-50 rounded-xl border-2 border-emerald-200 cursor-help w-full">
                  <div className="flex items-center gap-2 text-emerald-600 mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-semibold">Peak Period</span>
                  </div>
                  <div className="text-[oklch(0.25_0_0)] text-lg font-bold">
                    {formatDate(data.peakPeriod.startDate)} - {formatDate(data.peakPeriod.endDate)}
                  </div>
                  <div className="text-emerald-600 text-sm font-medium mt-1">
                    {Math.round(data.peakPeriod.avgOccupancy)}% occupancy
                  </div>
                </div>
              </Tooltip>
            )}
            {data.lowPeriod && (
              <Tooltip text={DEMAND_TOOLTIPS.lowPeriod}>
                <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-200 cursor-help w-full">
                  <div className="flex items-center gap-2 text-amber-600 mb-2">
                    <TrendingDown className="w-5 h-5" />
                    <span className="font-semibold">Low Period</span>
                  </div>
                  <div className="text-[oklch(0.25_0_0)] text-lg font-bold">
                    {formatDate(data.lowPeriod.startDate)} - {formatDate(data.lowPeriod.endDate)}
                  </div>
                  <div className="text-amber-600 text-sm font-medium mt-1">
                    {Math.round(data.lowPeriod.avgOccupancy)}% occupancy
                  </div>
                </div>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="p-4 border-t border-[oklch(0.90_0.01_265)] bg-[oklch(0.96_0.01_265)]">
          <h4 className="text-sm font-semibold text-[oklch(0.40_0_0)] mb-4">Detailed Metrics</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-4 border border-[oklch(0.90_0.01_265)]">
              <div className="text-sm font-medium text-[oklch(0.40_0_0)] mb-3 pb-2 border-b border-[oklch(0.92_0_0)]">30-Day Forecast</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[oklch(0.50_0_0)]">Avg Nightly Rate</span>
                  <span className="text-[oklch(0.25_0_0)] font-semibold">{formatCurrency(data.next30Days.avgAdr)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[oklch(0.50_0_0)]">Avg Supply</span>
                  <span className="text-[oklch(0.25_0_0)] font-semibold">{Math.round(data.next30Days.avgSupply).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[oklch(0.50_0_0)]">Avg Demand</span>
                  <span className="text-[oklch(0.25_0_0)] font-semibold">{Math.round(data.next30Days.avgDemand).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-[oklch(0.90_0.01_265)]">
              <div className="text-sm font-medium text-[oklch(0.40_0_0)] mb-3 pb-2 border-b border-[oklch(0.92_0_0)]">180-Day Forecast</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[oklch(0.50_0_0)]">Avg Nightly Rate</span>
                  <span className="text-[oklch(0.25_0_0)] font-semibold">{formatCurrency(data.next180Days.avgAdr)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[oklch(0.50_0_0)]">Avg Supply</span>
                  <span className="text-[oklch(0.25_0_0)] font-semibold">{Math.round(data.next180Days.avgSupply).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[oklch(0.50_0_0)]">Avg Demand</span>
                  <span className="text-[oklch(0.25_0_0)] font-semibold">{Math.round(data.next180Days.avgDemand).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
