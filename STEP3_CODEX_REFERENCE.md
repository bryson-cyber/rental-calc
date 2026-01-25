# Step 3 (Validate the Deal) - Complete Code Reference for ChatGPT Codex

This document contains all the code, context, and known issues for the Step 3 "Validate the Deal" section of the rental property calculator. Use this as a reference when making edits in ChatGPT Codex.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Known Issues to Fix](#known-issues-to-fix)
3. [Component Files](#component-files)
   - [MarketInsightsPanel.tsx](#1-marketinsightspaneltsx---supply-trend-chart-issue)
   - [ForwardDemandCard.tsx](#2-forwarddemandcardtsx)
   - [MultiYearTrends.tsx](#3-multiyeartrendstsx)
   - [TeslaDashboard.tsx (Relevant Sections)](#4-tesladashboardtsx-relevant-sections)
4. [Backend API Code](#backend-api-code)
   - [getMarketSupplyTrend Function](#getmarketsupplytrend-function)
   - [getMarketMetric Function](#getmarketmetric-function)
5. [Data Flow Diagram](#data-flow-diagram)
6. [Debugging Tips](#debugging-tips)

---

## Architecture Overview

**Tech Stack:**
- Frontend: React 19 + TypeScript + Tailwind CSS 4
- Backend: tRPC with Express
- Data Source: AirDNA API

**Step 3 Components Hierarchy:**
```
TeslaDashboard.tsx (main container)
├── HeroRevenueCard (Cash Flow Hero - FIXED to light mode)
├── KeyMetricsRow (ADR, Occupancy, Conservative, Optimistic)
├── SeasonalForecast (12-month chart)
├── MarketInsightsPanel.tsx
│   ├── ForwardDemandCard.tsx (Next 30/180 days)
│   ├── MultiYearTrends.tsx (Historical trends)
│   ├── Booking Patterns (inline)
│   └── Supply Trend Chart (ISSUE: bars not rendering)
└── Comparables Section
```

---

## Known Issues to Fix

### Issue #1: Supply Trend Chart Bars Not Rendering (CRITICAL)

**Location:** `client/src/components/MarketInsightsPanel.tsx` lines 188-213

**Symptoms:**
- Month labels (Jan-Dec) display correctly
- Summary stats show correct data (Current: 1,688, 12-Month Change: 0%, Trend: Stable)
- Visual bars are NOT rendering despite data being present

**Root Cause Analysis:**
The chart calculates bar height using: `height = (month.active_listings / maxCount) * 100`

Possible issues:
1. `active_listings` field might be 0 or undefined in the monthly_data array
2. `maxCount` calculation might be returning 0 or NaN
3. CSS height styling might not be applying correctly

**Debug logs show:**
```javascript
console.log('[SupplyTrend] monthly_data:', supplyTrend.monthly_data);
// Shows array with month objects
console.log(`[SupplyTrend] Month ${i}: active_listings=${month.active_listings}, maxCount=${maxCount}, height=${height}%`);
// Need to check what values are logged
```

**Backend mapping (airdna.ts line 5424-5426):**
```javascript
const monthlyData = sortedData.map((d: any, i: number) => ({
  month: d.date || d.month,
  active_listings: d.listing_count || d.value || 0,  // <-- Check if this is mapping correctly
  change_from_previous: ...
}));
```

---

### Issue #2: Forward-Looking Demand Detailed Metrics May Show $0/0

**Location:** `client/src/components/ForwardDemandCard.tsx` lines 163-202

**Symptoms:**
- Main percentages (Next 30 Days: 68%, Next 180 Days: 53%) display correctly
- Expanded "Detailed Metrics" section may show $0 for ADR, 0 for Supply/Demand

**Possible Cause:**
The `avgAdr`, `avgSupply`, `avgDemand` fields might not be populated from the API response.

---

### Issue #3: Metric Tooltips Need to be Added

**Location:** `client/src/components/TeslaDashboard.tsx`

**Current State:**
- `METRIC_TOOLTIPS` object exists at lines 279-286
- Some metrics have tooltips, but not all sections have them

**Requirement:**
Add explanatory tooltips to all metrics in Step 3 so users understand what each number means.

---

## Component Files

### 1. MarketInsightsPanel.tsx - Supply Trend Chart (ISSUE)

**File:** `client/src/components/MarketInsightsPanel.tsx`

```tsx
/**
 * MarketInsightsPanel Component
 * 
 * Displays booking patterns, supply trend data, forward-looking demand,
 * and multi-year historical trends from market data API.
 */
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Calendar, Clock, TrendingUp, Users, Info } from 'lucide-react';
import { ForwardDemandCard } from './ForwardDemandCard';
import { MultiYearTrends } from './MultiYearTrends';

interface MarketInsightsPanelProps {
  marketId?: string | number;
}

// Simple tooltip component
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="relative group">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[oklch(0.20_0.01_265)] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 max-w-[200px] text-center">
        {text}
      </span>
    </span>
  );
}

export default function MarketInsightsPanel({ marketId }: MarketInsightsPanelProps) {
  const [bookingPatterns, setBookingPatterns] = useState<any>(null);
  const [supplyTrend, setSupplyTrend] = useState<any>(null);
  const [forwardDemand, setForwardDemand] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getBookingPatterns = trpc.rental.getBookingPatterns.useMutation();
  const getSupplyTrend = trpc.rental.getSupplyTrend.useMutation();
  const getForwardDemand = trpc.rental.getForwardDemand.useMutation();

  useEffect(() => {
    async function fetchData() {
      if (!marketId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Convert marketId to string for API call (API accepts both but we normalize)
        const marketIdStr = String(marketId);
        const [patternsResult, supplyResult, forwardResult] = await Promise.all([
          getBookingPatterns.mutateAsync({ marketId: marketIdStr }),
          getSupplyTrend.mutateAsync({ marketId: marketIdStr }),
          getForwardDemand.mutateAsync({ marketId: marketIdStr }).catch(() => null)
        ]);
        
        if (patternsResult.success) {
          setBookingPatterns(patternsResult.data);
        }
        if (supplyResult.success) {
          console.log('[MarketInsightsPanel] supplyResult.data:', JSON.stringify(supplyResult.data, null, 2));
          setSupplyTrend(supplyResult.data);
        }
        if (forwardResult?.success) {
          setForwardDemand(forwardResult.data);
        }
      } catch (err) {
        console.error('Error fetching market insights:', err);
        setError('Could not load market insights');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [marketId]);

  if (loading) {
    return (
      <div className="bg-[oklch(0.98_0.01_265)] rounded-xl p-6 border border-[oklch(0.90_0.01_265)]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[oklch(0.55_0.14_75)]/30 border-t-[oklch(0.55_0.14_75)] rounded-full animate-spin" />
          <span className="text-[oklch(0.50_0_0)]">Loading market insights...</span>
        </div>
      </div>
    );
  }

  if (error || (!bookingPatterns && !supplyTrend && !forwardDemand)) {
    return null; // Silently fail if no data
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
        <h3 className="text-lg font-semibold text-[oklch(0.25_0_0)]">Market Insights</h3>
      </div>

      {/* Forward-Looking Demand */}
      {forwardDemand && (
        <ForwardDemandCard data={forwardDemand} />
      )}

      {/* Multi-Year Historical Trends */}
      {marketId && (
        <MultiYearTrends marketId={String(marketId)} />
      )}

      {/* Booking Patterns */}
      {bookingPatterns && (
        <div className="bg-[oklch(0.98_0.01_265)] rounded-xl p-6 border border-[oklch(0.90_0.01_265)]">
          <h4 className="text-base font-medium text-[oklch(0.30_0_0)] mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
            Booking Patterns
          </h4>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Lead Time */}
            <div>
              <div className="flex items-center gap-1 mb-2">
                <span className="text-sm text-[oklch(0.50_0_0)]">Booking Lead Time</span>
                <Tooltip text="How far in advance guests typically book. Like buying concert tickets - some people plan ahead, others wait until the last minute.">
                  <Info className="w-3.5 h-3.5 text-[oklch(0.60_0_0)] cursor-help" />
                </Tooltip>
              </div>
              <div className="text-2xl font-semibold text-[oklch(0.25_0_0)]">
                {bookingPatterns.lead_time?.avg_days || 'N/A'} days
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[oklch(0.50_0_0)]">Last-minute (0-7 days)</span>
                  <span className="font-medium text-[oklch(0.35_0_0)]">{bookingPatterns.lead_time?.last_minute_percent || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[oklch(0.50_0_0)]">Advance (30+ days)</span>
                  <span className="font-medium text-[oklch(0.35_0_0)]">{bookingPatterns.lead_time?.advance_booking_percent || 0}%</span>
                </div>
              </div>
            </div>
            
            {/* Length of Stay */}
            <div>
              <div className="flex items-center gap-1 mb-2">
                <span className="text-sm text-[oklch(0.50_0_0)]">Length of Stay</span>
                <Tooltip text="How long guests typically stay. Weekend trips are 2-3 nights, vacations are 5-7 nights. Longer stays mean less cleaning and turnover.">
                  <Info className="w-3.5 h-3.5 text-[oklch(0.60_0_0)] cursor-help" />
                </Tooltip>
              </div>
              <div className="text-2xl font-semibold text-[oklch(0.25_0_0)]">
                {bookingPatterns.length_of_stay?.avg_nights || 'N/A'} nights
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[oklch(0.50_0_0)]">Weekend stays (1-3 nights)</span>
                  <span className="font-medium text-[oklch(0.35_0_0)]">{bookingPatterns.length_of_stay?.weekend_percent || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[oklch(0.50_0_0)]">Week+ stays (7+ nights)</span>
                  <span className="font-medium text-[oklch(0.35_0_0)]">{bookingPatterns.length_of_stay?.week_percent || 0}%</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Insights */}
          {bookingPatterns.insights && bookingPatterns.insights.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[oklch(0.90_0.01_265)]">
              <p className="text-sm text-[oklch(0.45_0_0)] italic">
                {bookingPatterns.insights[0]}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* SUPPLY TREND - THIS IS WHERE THE BUG IS */}
      {/* ============================================ */}
      {supplyTrend && supplyTrend.monthly_data && supplyTrend.monthly_data.length > 0 && (
        <div className="bg-[oklch(0.98_0.01_265)] rounded-xl p-6 border border-[oklch(0.90_0.01_265)]">
          <h4 className="text-base font-medium text-[oklch(0.30_0_0)] mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
            Supply Trend (Active Listings)
            <Tooltip text="How many Airbnbs are active in this market over time. More listings = more competition. Growing markets attract more hosts.">
              <Info className="w-3.5 h-3.5 text-[oklch(0.60_0_0)] cursor-help" />
            </Tooltip>
          </h4>
          
          {/* Simple bar chart - BARS NOT RENDERING */}
          <div className="h-32 flex items-end gap-1">
            {(() => {
              console.log('[SupplyTrend] monthly_data:', supplyTrend.monthly_data);
              console.log('[SupplyTrend] last 12 months:', supplyTrend.monthly_data.slice(-12));
              return null;
            })()}
            {supplyTrend.monthly_data.slice(-12).map((month: any, i: number) => {
              const allListings = supplyTrend.monthly_data.slice(-12).map((m: any) => m.active_listings || 0);
              const maxCount = Math.max(...allListings, 1); // Ensure at least 1 to avoid division by zero
              const height = ((month.active_listings || 0) / maxCount) * 100;
              console.log(`[SupplyTrend] Month ${i}: active_listings=${month.active_listings}, maxCount=${maxCount}, height=${height}%`);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-[oklch(0.55_0.14_75)] rounded-t transition-all hover:bg-[oklch(0.50_0.14_75)]"
                    style={{ height: `${height}%` }}
                    title={`${month.month}: ${month.active_listings.toLocaleString()} listings`}
                  />
                  <span className="text-[10px] text-[oklch(0.50_0_0)]">
                    {new Date(month.month + '-01').toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Summary stats - THESE WORK CORRECTLY */}
          <div className="mt-4 pt-4 border-t border-[oklch(0.90_0.01_265)] grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-[oklch(0.50_0_0)]">Current</div>
              <div className="font-semibold text-[oklch(0.30_0_0)]">
                {supplyTrend.monthly_data[supplyTrend.monthly_data.length - 1]?.active_listings?.toLocaleString() || 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-[oklch(0.50_0_0)]">12-Month Change</div>
              <div className={`font-semibold ${supplyTrend.yoy_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {supplyTrend.yoy_change >= 0 ? '+' : ''}{supplyTrend.yoy_change?.toFixed(1) || 0}%
              </div>
            </div>
            <div>
              <div className="text-xs text-[oklch(0.50_0_0)]">Trend</div>
              <div className="font-semibold text-[oklch(0.30_0_0)]">
                {supplyTrend.yoy_change > 5 ? 'Growing' : supplyTrend.yoy_change < -5 ? 'Shrinking' : 'Stable'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 2. ForwardDemandCard.tsx

**File:** `client/src/components/ForwardDemandCard.tsx`

```tsx
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

      {/* Expanded Details - MAY SHOW $0/0 VALUES */}
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
```

---

### 3. MultiYearTrends.tsx

**File:** `client/src/components/MultiYearTrends.tsx`

```tsx
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
```

---

### 4. TeslaDashboard.tsx (Relevant Sections)

**File:** `client/src/components/TeslaDashboard.tsx`

**METRIC_TOOLTIPS Object (lines 279-286):**
```tsx
const METRIC_TOOLTIPS = {
  adr: "This is how much you charge per night, on average. If you charge $200 one night and $300 another, your average is $250. Higher is better!",
  occupancy: "This shows how often your place is booked. 70% means guests stay 7 out of every 10 nights. More bookings = more money!",
  conservative: "This is the 'worst case' estimate - what you'd make if things go a bit slower than expected. Good for planning safely.",
  optimistic: "This is the 'best case' estimate - what you could make if everything goes great. Aim for this, plan for conservative!",
  revenue: "This is your total money earned before expenses. It's calculated by: Nightly Rate × Occupancy × 365 days.",
  revpar: "Revenue Per Available Room - combines your nightly rate and how often you're booked into one number. Higher = better performance!"
};
```

**HeroRevenueCard (Cash Flow Hero) - Lines 169-273:**
This component is now using light mode styling with `oklch` colors. The key classes are:
- Background: `bg-gradient-to-br from-[oklch(0.98_0.01_265)] to-white`
- Text: `text-[oklch(0.25_0_0)]` for dark text on light background
- Cards: `bg-[oklch(0.95_0.01_265)]` for light gray backgrounds

---

## Backend API Code

### getMarketSupplyTrend Function

**File:** `server/airdna.ts` (lines 5378-5440)

```typescript
export interface SupplyTrend {
  current_listings: number;
  listings_12_months_ago: number;
  net_change: number;
  percent_change: number;
  monthly_data: Array<{
    month: string;
    active_listings: number;
    change_from_previous: number;
  }>;
  trend: "growing" | "stable" | "declining";
  insight: string;
}

export async function getMarketSupplyTrend(
  marketId: string,
  bedrooms?: number
): Promise<SupplyTrend | null> {
  try {
    const filters: any[] = [];
    if (bedrooms !== undefined) {
      filters.push({ type: "select", field: "bedrooms", value: bedrooms });
    }

    const response = await makeApiRequest(
      `/market/${marketId}/metrics/active_listings_count`,
      "POST",
      { num_months: 12, filters }
    );

    const responseData = (response as any)?.payload?.metrics;
    if (!responseData || !Array.isArray(responseData) || responseData.length === 0) {
      return null;
    }

    const data = responseData;
    console.log('[getMarketSupplyTrend] Raw data sample:', JSON.stringify(data.slice(0, 2)));
    const sortedData = [...data].sort((a: any, b: any) => 
      new Date(a.date || a.month).getTime() - new Date(b.date || b.month).getTime()
    );
    console.log('[getMarketSupplyTrend] Sorted data sample:', JSON.stringify(sortedData.slice(0, 2)));

    // KEY LINE: This is where active_listings is mapped from the API response
    const current = sortedData[sortedData.length - 1]?.listing_count || sortedData[sortedData.length - 1]?.value || 0;
    const yearAgo = sortedData[0]?.listing_count || sortedData[0]?.value || current;
    const netChange = current - yearAgo;
    const percentChange = yearAgo > 0 ? Math.round((netChange / yearAgo) * 100) : 0;

    let trend: "growing" | "stable" | "declining" = "stable";
    if (percentChange > 10) trend = "growing";
    else if (percentChange < -10) trend = "declining";

    let insight = "";
    if (trend === "growing") {
      insight = `Competition is increasing - ${netChange} new listings entered the market (+${percentChange}%). Focus on differentiation.`;
    } else if (trend === "declining") {
      insight = `Market is contracting - ${Math.abs(netChange)} listings left (${percentChange}%). Opportunity for market share.`;
    } else {
      insight = `Market supply is stable. Focus on outperforming existing competition.`;
    }

    // KEY LINE: This maps the monthly data with active_listings field
    const monthlyData = sortedData.map((d: any, i: number) => ({
      month: d.date || d.month,
      active_listings: d.listing_count || d.value || 0,  // <-- CHECK THIS MAPPING
      change_from_previous: i > 0 
        ? (d.listing_count || d.value || 0) - (sortedData[i-1].listing_count || sortedData[i-1].value || 0)
        : 0,
    }));

    return {
      current_listings: current,
      listings_12_months_ago: yearAgo,
      net_change: netChange,
      percent_change: percentChange,
      monthly_data: monthlyData,
      trend,
      insight,
    };
  } catch (error) {
    console.error('[getMarketSupplyTrend] Error:', error);
    return null;
  }
}
```

### getMarketMetric Function

**File:** `server/airdna.ts` (lines 995-1059)

```typescript
async function getMarketMetric(
  marketId: string,
  metricType: "occupancy" | "avg_revenue" | "adr" | "revpar" | "active_listings_count" | "booking_lead_time" | "los",
  numMonths: number = 12
): Promise<HistoricalDataPoint[]> {
  try {
    const response = await makeApiRequest<{
      payload: {
        metrics?: Array<{
          month?: string;
          date?: string;
          value?: number;
          occupancy?: number;
          occupancy_rate?: number;
          avg_revenue?: number;
          revenue?: number;
          adr?: number;
          revpar?: number;
          active_listings_count?: number;
          active_listings?: number;
          available_listings?: number;
          listing_count?: number;
          booking_lead_time?: number;
          los?: number;
        }>;
      };
    }>(`/market/${marketId}/metrics/${metricType}`, "POST", {
      num_months: numMonths,
    });
    
    const results = response.payload.metrics || [];
    
    if (results.length === 0) {
      console.log(`[AirDNA] ${metricType} returned 0 results for ${numMonths} months`);
    } else {
      console.log(`[AirDNA] ${metricType} returned ${results.length} results for ${numMonths} months`);
      if (metricType === 'active_listings_count') {
        console.log(`[AirDNA] active_listings_count sample result:`, JSON.stringify(results[0], null, 2));
      }
    }
    
    return results.map((r) => {
      const date = r.month || r.date || "";
      let value = r.value;
      
      // Handle different response field names
      if (value === undefined) {
        switch (metricType) {
          case "occupancy": value = r.occupancy_rate || r.occupancy; break;
          case "avg_revenue": value = r.revenue || r.avg_revenue; break;
          case "adr": value = r.adr; break;
          case "revpar": value = r.revpar; break;
          case "active_listings_count": value = r.listing_count || r.active_listings || r.active_listings_count; break;
          case "booking_lead_time": value = r.booking_lead_time; break;
          case "los": value = r.los; break;
        }
      }
      
      return { date, value: value || 0 };
    });
  } catch (error) {
    console.error(`Error fetching ${metricType} for market ${marketId}:`, error);
    return [];
  }
}
```

---

## Data Flow Diagram

```
User loads Step 3 (Validate the Deal)
         │
         ▼
┌─────────────────────────────────────┐
│     TeslaDashboard.tsx              │
│     (Main Container)                │
│                                     │
│  Props: result, address, marketId   │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     MarketInsightsPanel.tsx         │
│                                     │
│  useEffect fetches:                 │
│  - getBookingPatterns.mutateAsync() │
│  - getSupplyTrend.mutateAsync()     │◄──── ISSUE: Data fetched but bars don't render
│  - getForwardDemand.mutateAsync()   │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     tRPC Router (routers.ts)        │
│                                     │
│  rental.getSupplyTrend calls:       │
│  airdna.getMarketSupplyTrend()      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     airdna.ts                       │
│                                     │
│  getMarketSupplyTrend():            │
│  - Calls AirDNA API                 │
│  - Maps response to monthly_data    │
│  - Returns { monthly_data: [...] }  │◄──── CHECK: Is active_listings populated?
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     AirDNA API                      │
│                                     │
│  /market/{id}/metrics/              │
│  active_listings_count              │
│                                     │
│  Returns: { payload: { metrics: []}}│
│  Each metric has: listing_count,    │
│  value, or active_listings field    │
└─────────────────────────────────────┘
```

---

## Debugging Tips

### To Debug Supply Trend Chart:

1. **Check Browser Console** for these logs:
   ```
   [MarketInsightsPanel] supplyResult.data: {...}
   [SupplyTrend] monthly_data: [...]
   [SupplyTrend] Month 0: active_listings=X, maxCount=Y, height=Z%
   ```

2. **Verify Data Structure:**
   The `supplyTrend.monthly_data` should look like:
   ```json
   [
     { "month": "2024-01", "active_listings": 1650, "change_from_previous": 0 },
     { "month": "2024-02", "active_listings": 1660, "change_from_previous": 10 },
     ...
   ]
   ```

3. **Check if `active_listings` is 0:**
   If all `active_listings` values are 0, the bars will have 0% height.

4. **Check CSS Height Calculation:**
   The bar height is set via inline style: `style={{ height: \`${height}%\` }}`
   If `height` is 0 or NaN, bars won't show.

5. **Possible Fix - Check Field Mapping:**
   In `airdna.ts` line 5426, the mapping is:
   ```javascript
   active_listings: d.listing_count || d.value || 0
   ```
   The API might be returning a different field name. Check the raw API response.

---

## Quick Reference: File Locations

| Component | File Path |
|-----------|-----------|
| Supply Trend Chart | `client/src/components/MarketInsightsPanel.tsx` |
| Forward Demand | `client/src/components/ForwardDemandCard.tsx` |
| Multi-Year Trends | `client/src/components/MultiYearTrends.tsx` |
| Cash Flow Hero | `client/src/components/TeslaDashboard.tsx` |
| Seasonal Forecast | `client/src/components/TeslaDashboard.tsx` |
| Backend API | `server/airdna.ts` |
| tRPC Router | `server/routers.ts` |

---

*Generated for ChatGPT Codex editing reference*
