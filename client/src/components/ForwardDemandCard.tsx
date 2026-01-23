import { useState } from 'react';
import { TrendingUp, TrendingDown, Calendar, ChevronDown, ChevronUp, Flame, Sun, Cloud, Snowflake } from 'lucide-react';

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

const trendIcons = {
  hot: <Flame className="w-5 h-5 text-red-500" />,
  warm: <Sun className="w-5 h-5 text-orange-500" />,
  cool: <Cloud className="w-5 h-5 text-blue-400" />,
  cold: <Snowflake className="w-5 h-5 text-blue-600" />,
};

const trendColors = {
  hot: 'bg-red-500/20 text-red-400 border-red-500/30',
  warm: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  cool: 'bg-blue-400/20 text-blue-400 border-blue-400/30',
  cold: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
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
      <div className="bg-[#0F172A]/50 rounded-xl border border-white/10 p-6 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-48 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-white/10 rounded" />
          <div className="h-24 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0F172A]/50 rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#C9A962]" />
            <h3 className="text-lg font-semibold text-white">Forward-Looking Demand</h3>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-white/60 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Next 30 Days */}
          <div className={`p-4 rounded-lg border ${trendColors[data.next30Days.trend]}`}>
            <div className="flex items-center gap-2 mb-2">
              {trendIcons[data.next30Days.trend]}
              <span className="text-sm font-medium">Next 30 Days</span>
            </div>
            <div className="text-2xl font-bold mb-1">
              {Math.round(data.next30Days.avgOccupancy)}%
            </div>
            <div className="text-xs opacity-80">{data.next30Days.trendLabel}</div>
          </div>

          {/* Next 180 Days */}
          <div className={`p-4 rounded-lg border ${trendColors[data.next180Days.trend]}`}>
            <div className="flex items-center gap-2 mb-2">
              {trendIcons[data.next180Days.trend]}
              <span className="text-sm font-medium">Next 180 Days</span>
            </div>
            <div className="text-2xl font-bold mb-1">
              {Math.round(data.next180Days.avgOccupancy)}%
            </div>
            <div className="text-xs opacity-80">{data.next180Days.trendLabel}</div>
          </div>
        </div>

        {/* Peak & Low Periods */}
        {(data.peakPeriod || data.lowPeriod) && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            {data.peakPeriod && (
              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
                  <TrendingUp className="w-4 h-4" />
                  Peak Period
                </div>
                <div className="text-white text-sm font-medium">
                  {formatDate(data.peakPeriod.startDate)} - {formatDate(data.peakPeriod.endDate)}
                </div>
                <div className="text-green-400 text-xs">
                  {Math.round(data.peakPeriod.avgOccupancy)}% occupancy
                </div>
              </div>
            )}
            {data.lowPeriod && (
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                <div className="flex items-center gap-2 text-amber-400 text-sm mb-1">
                  <TrendingDown className="w-4 h-4" />
                  Low Period
                </div>
                <div className="text-white text-sm font-medium">
                  {formatDate(data.lowPeriod.startDate)} - {formatDate(data.lowPeriod.endDate)}
                </div>
                <div className="text-amber-400 text-xs">
                  {Math.round(data.lowPeriod.avgOccupancy)}% occupancy
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="p-4 border-t border-white/10 bg-white/5">
          <h4 className="text-sm font-medium text-white/70 mb-3">Detailed Metrics</h4>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-white/50 mb-2">30-Day Forecast</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Avg ADR</span>
                  <span className="text-white font-medium">{formatCurrency(data.next30Days.avgAdr)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Avg Supply</span>
                  <span className="text-white font-medium">{Math.round(data.next30Days.avgSupply).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Avg Demand</span>
                  <span className="text-white font-medium">{Math.round(data.next30Days.avgDemand).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs text-white/50 mb-2">180-Day Forecast</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Avg ADR</span>
                  <span className="text-white font-medium">{formatCurrency(data.next180Days.avgAdr)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Avg Supply</span>
                  <span className="text-white font-medium">{Math.round(data.next180Days.avgSupply).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Avg Demand</span>
                  <span className="text-white font-medium">{Math.round(data.next180Days.avgDemand).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
