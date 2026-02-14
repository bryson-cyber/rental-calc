import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { trpc } from '@/lib/trpc';

interface DataPoint {
  month: string;
  value: number;
}

interface MultiYearTrendsProps {
  marketId: string;
}

type TimeRange = 12 | 24 | 36 | 60;

const timeRangeLabels: Record<TimeRange, string> = {
  12: '1 Year Ago',
  24: '2 Years Ago',
  36: '3 Years Ago',
  60: '5 Years Ago',
};

function calculateCAGR(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || years <= 0) return 0;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

function calculateYoY(data: DataPoint[]): number {
  if (data.length < 13) return 0;
  const currentValue = data[data.length - 1]?.value || 0;
  const yearAgoValue = data[data.length - 13]?.value || 0;
  if (yearAgoValue === 0) return 0;
  return ((currentValue - yearAgoValue) / yearAgoValue) * 100;
}

// Calculate average of all values in the selected time range
function calculateAverage(data: DataPoint[]): number {
  if (!data || data.length === 0) return 0;
  const sum = data.reduce((acc, d) => acc + d.value, 0);
  return sum / data.length;
}

// Calculate change from first to last value in the period
function calculatePeriodChange(data: DataPoint[]): number {
  if (!data || data.length < 2) return 0;
  const firstValue = data[0]?.value || 0;
  const lastValue = data[data.length - 1]?.value || 0;
  if (firstValue === 0) return 0;
  return ((lastValue - firstValue) / firstValue) * 100;
}

function Sparkline({ data, color }: { data: DataPoint[]; color: string }) {
  if (!data || data.length === 0) return null;
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 120;
  const height = 32;
  const padding = 2;
  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((value - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendIndicator({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const isPositive = value > 0;
  const isNeutral = Math.abs(value) < 0.5;
  if (isNeutral) {
    return (
      <span className="flex items-center gap-1 text-white/50">
        <Minus className="w-3 h-3" />
        <span className="text-xs">0{suffix}</span>
      </span>
    );
  }
  return (
    <span className={`flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      <span className="text-xs">{isPositive ? '+' : ''}{value.toFixed(1)}{suffix}</span>
    </span>
  );
}

export function MultiYearTrends({ marketId }: MultiYearTrendsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(24);
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, error } = trpc.compData.getHistoricalData.useQuery({ marketId, numMonths: timeRange }, {
    staleTime: 1000 * 60 * 10, // 10 minutes — historical data doesn't change often
    refetchOnWindowFocus: false,
  });

  const metrics = useMemo(() => {
    if (!data?.success || !data.data) return null;
    const { occupancy, revenue, adr, listings } = data.data;
    const years = timeRange / 12;
    const getFirstLast = (arr: DataPoint[]) => ({ first: arr[0]?.value || 0, last: arr[arr.length - 1]?.value || 0 });
    const occValues = getFirstLast(occupancy);
    const revValues = getFirstLast(revenue);
    const adrValues = getFirstLast(adr);
    const listValues = getFirstLast(listings);
    
    // Use AVERAGE values for the display, not just the latest
    const occAvg = calculateAverage(occupancy);
    const revAvg = calculateAverage(revenue);
    const adrAvg = calculateAverage(adr);
    const listAvg = calculateAverage(listings);
    
    // Use period change (first to last) for the trend indicator
    const occChange = calculatePeriodChange(occupancy);
    const revChange = calculatePeriodChange(revenue);
    const adrChange = calculatePeriodChange(adr);
    const listChange = calculatePeriodChange(listings);
    
    return {
      occupancy: { 
        data: occupancy, 
        current: occAvg, // Average over period
        latest: occValues.last, // Latest value for reference
        yoy: occChange, // Change over selected period
        cagr: calculateCAGR(occValues.first, occValues.last, years), 
        color: '#22c55e', 
        format: (v: number) => `${Math.round(v)}%` 
      },
      revenue: { 
        data: revenue, 
        current: revAvg, 
        latest: revValues.last,
        yoy: revChange, 
        cagr: calculateCAGR(revValues.first, revValues.last, years), 
        color: '#C9A962', 
        format: (v: number) => `$${Math.round(v).toLocaleString()}` 
      },
      adr: { 
        data: adr, 
        current: adrAvg, 
        latest: adrValues.last,
        yoy: adrChange, 
        cagr: calculateCAGR(adrValues.first, adrValues.last, years), 
        color: '#3b82f6', 
        format: (v: number) => `$${Math.round(v)}` 
      },
      listings: { 
        data: listings, 
        current: listAvg, 
        latest: listValues.last,
        yoy: listChange, 
        cagr: calculateCAGR(listValues.first, listValues.last, years), 
        color: '#a855f7', 
        format: (v: number) => Math.round(v).toLocaleString() 
      },
    };
  }, [data, timeRange]);

  if (isLoading) {
    return (
      <div className="bg-[#0F172A]/50 rounded-xl border border-white/10 p-6 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-48 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-white/10 rounded" />
          <div className="h-24 bg-white/10 rounded" />
          <div className="h-24 bg-white/10 rounded" />
          <div className="h-24 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="bg-[#0F172A]/50 rounded-xl border border-white/10 p-6">
        <p className="text-white/50 text-sm">Unable to load historical trends</p>
      </div>
    );
  }

  return (
    <div className="bg-[oklch(0.98_0.01_265)] rounded-xl border border-[oklch(0.90_0.01_265)] overflow-hidden">
      <div className="p-4 border-b border-[oklch(0.90_0.01_265)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
            <h3 className="text-base font-medium text-[oklch(0.30_0_0)]">Multi-Year Trends</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-[oklch(0.60_0_0)] cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-3 bg-white text-[oklch(0.30_0_0)] shadow-lg border border-[oklch(0.90_0_0)]">
                <p className="text-sm leading-relaxed">See how this market has performed over time. Like looking at a stock chart - you can see if the market is growing, stable, or declining. Use the buttons to view 1, 2, 3, or 5 years of history.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[oklch(0.95_0_0)] rounded-lg p-1">
              {([12, 24, 36, 60] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    timeRange === range ? 'bg-[oklch(0.55_0.14_75)] text-white' : 'text-[oklch(0.50_0_0)] hover:text-[oklch(0.30_0_0)]'
                  }`}
                >
                  {timeRangeLabels[range]}
                </button>
              ))}
            </div>
            <button onClick={() => setExpanded(!expanded)} className="text-[oklch(0.50_0_0)] hover:text-[oklch(0.30_0_0)] transition-colors">
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {/* Period indicator */}
        <p className="text-xs text-[oklch(0.55_0_0)] mt-1">
          Showing {timeRangeLabels[timeRange]} average • Change from start to end of period
        </p>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-[oklch(0.96_0.01_265)] rounded-lg border border-[oklch(0.90_0.01_265)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[oklch(0.45_0_0)]">Occupancy</span>
              <TrendIndicator value={metrics.occupancy.yoy} />
            </div>
            <div className="text-2xl font-bold text-[oklch(0.25_0_0)] mb-1">{metrics.occupancy.format(metrics.occupancy.current)}</div>
            <div className="text-xs text-[oklch(0.55_0_0)] mb-2">avg over {timeRangeLabels[timeRange]}</div>
            <Sparkline data={metrics.occupancy.data} color={metrics.occupancy.color} />
          </div>
          <div className="p-4 bg-[oklch(0.96_0.01_265)] rounded-lg border border-[oklch(0.90_0.01_265)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[oklch(0.45_0_0)]">Avg Revenue</span>
              <TrendIndicator value={metrics.revenue.yoy} />
            </div>
            <div className="text-2xl font-bold text-[oklch(0.25_0_0)] mb-1">{metrics.revenue.format(metrics.revenue.current)}</div>
            <div className="text-xs text-[oklch(0.55_0_0)] mb-2">avg over {timeRangeLabels[timeRange]}</div>
            <Sparkline data={metrics.revenue.data} color={metrics.revenue.color} />
          </div>
          <div className="p-4 bg-[oklch(0.96_0.01_265)] rounded-lg border border-[oklch(0.90_0.01_265)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[oklch(0.45_0_0)]">Avg Daily Rate</span>
              <TrendIndicator value={metrics.adr.yoy} />
            </div>
            <div className="text-2xl font-bold text-[oklch(0.25_0_0)] mb-1">{metrics.adr.format(metrics.adr.current)}</div>
            <div className="text-xs text-[oklch(0.55_0_0)] mb-2">avg over {timeRangeLabels[timeRange]}</div>
            <Sparkline data={metrics.adr.data} color={metrics.adr.color} />
          </div>
          <div className="p-4 bg-[oklch(0.96_0.01_265)] rounded-lg border border-[oklch(0.90_0.01_265)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[oklch(0.45_0_0)]">Active Listings</span>
              <TrendIndicator value={metrics.listings.yoy} />
            </div>
            <div className="text-2xl font-bold text-[oklch(0.25_0_0)] mb-1">{metrics.listings.format(metrics.listings.current)}</div>
            <div className="text-xs text-[oklch(0.55_0_0)] mb-2">avg over {timeRangeLabels[timeRange]}</div>
            <Sparkline data={metrics.listings.data} color={metrics.listings.color} />
          </div>
        </div>
      </div>
      {expanded && (
        <div className="p-4 border-t border-white/10 bg-white/5">
          <h4 className="text-sm font-medium text-white/70 mb-3">Compound Annual Growth Rate (CAGR) - {timeRangeLabels[timeRange]}</h4>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-xs text-white/50 mb-1">Occupancy</div>
              <TrendIndicator value={metrics.occupancy.cagr} suffix="% CAGR" />
            </div>
            <div className="text-center">
              <div className="text-xs text-white/50 mb-1">Revenue</div>
              <TrendIndicator value={metrics.revenue.cagr} suffix="% CAGR" />
            </div>
            <div className="text-center">
              <div className="text-xs text-white/50 mb-1">ADR</div>
              <TrendIndicator value={metrics.adr.cagr} suffix="% CAGR" />
            </div>
            <div className="text-center">
              <div className="text-xs text-white/50 mb-1">Listings</div>
              <TrendIndicator value={metrics.listings.cagr} suffix="% CAGR" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
