import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
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
  12: '1 Year',
  24: '2 Years',
  36: '3 Years',
  60: '5 Years',
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
  const { data, isLoading, error } = trpc.compData.getHistoricalData.useQuery({ marketId, numMonths: timeRange });

  const metrics = useMemo(() => {
    if (!data?.success || !data.data) return null;
    const { occupancy, revenue, adr, listings } = data.data;
    const years = timeRange / 12;
    const getFirstLast = (arr: DataPoint[]) => ({ first: arr[0]?.value || 0, last: arr[arr.length - 1]?.value || 0 });
    const occValues = getFirstLast(occupancy);
    const revValues = getFirstLast(revenue);
    const adrValues = getFirstLast(adr);
    const listValues = getFirstLast(listings);
    return {
      occupancy: { data: occupancy, current: occValues.last, yoy: calculateYoY(occupancy), cagr: calculateCAGR(occValues.first, occValues.last, years), color: '#22c55e', format: (v: number) => `${Math.round(v)}%` },
      revenue: { data: revenue, current: revValues.last, yoy: calculateYoY(revenue), cagr: calculateCAGR(revValues.first, revValues.last, years), color: '#C9A962', format: (v: number) => `$${Math.round(v).toLocaleString()}` },
      adr: { data: adr, current: adrValues.last, yoy: calculateYoY(adr), cagr: calculateCAGR(adrValues.first, adrValues.last, years), color: '#3b82f6', format: (v: number) => `$${Math.round(v)}` },
      listings: { data: listings, current: listValues.last, yoy: calculateYoY(listings), cagr: calculateCAGR(listValues.first, listValues.last, years), color: '#a855f7', format: (v: number) => Math.round(v).toLocaleString() },
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
    <div className="bg-[#0F172A]/50 rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#C9A962]" />
            <h3 className="text-lg font-semibold text-white">Multi-Year Trends</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white/5 rounded-lg p-1">
              {([12, 24, 36, 60] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    timeRange === range ? 'bg-[#C9A962] text-[#0F172A]' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {timeRangeLabels[range]}
                </button>
              ))}
            </div>
            <button onClick={() => setExpanded(!expanded)} className="text-white/60 hover:text-white transition-colors">
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/70">Occupancy</span>
              <TrendIndicator value={metrics.occupancy.yoy} />
            </div>
            <div className="text-2xl font-bold text-white mb-2">{metrics.occupancy.format(metrics.occupancy.current)}</div>
            <Sparkline data={metrics.occupancy.data} color={metrics.occupancy.color} />
          </div>
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/70">Avg Revenue</span>
              <TrendIndicator value={metrics.revenue.yoy} />
            </div>
            <div className="text-2xl font-bold text-white mb-2">{metrics.revenue.format(metrics.revenue.current)}</div>
            <Sparkline data={metrics.revenue.data} color={metrics.revenue.color} />
          </div>
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/70">Avg Daily Rate</span>
              <TrendIndicator value={metrics.adr.yoy} />
            </div>
            <div className="text-2xl font-bold text-white mb-2">{metrics.adr.format(metrics.adr.current)}</div>
            <Sparkline data={metrics.adr.data} color={metrics.adr.color} />
          </div>
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/70">Active Listings</span>
              <TrendIndicator value={metrics.listings.yoy} />
            </div>
            <div className="text-2xl font-bold text-white mb-2">{metrics.listings.format(metrics.listings.current)}</div>
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
