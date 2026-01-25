# Step 3 (Validate the Deal) - COMPLETE Code Reference for ChatGPT Codex

This document contains **ALL** the code needed to fix the Step 3 issues. It includes frontend components, backend API functions, and tRPC router definitions.

---

## ISSUES TO FIX

### Issue #1: Supply Trend Chart Bars Not Rendering (CRITICAL)

**Symptoms:**
- Month labels (Jan-Dec) display correctly
- Summary stats show correct data (Current: 1,688, 12-Month Change: 0%, Trend: Stable)
- Visual bars are NOT rendering despite data being present

**Root Cause:** The `active_listings` field in `monthly_data` is likely 0 or the field mapping doesn't match the API response.

**Files to Edit:**
- `client/src/components/MarketInsightsPanel.tsx` (lines 188-213) - Frontend chart rendering
- `server/airdna.ts` (lines 5424-5430) - Backend field mapping

---

### Issue #2: Forward Demand Detailed Metrics showing $0/0

**Symptoms:**
- Main percentages (Next 30 Days: 68%, Next 180 Days: 53%) display correctly
- Expanded "Detailed Metrics" shows $0 for Avg ADR, 0 for Avg Supply/Demand

**Root Cause:** The `avgAdr`, `avgSupply`, `avgDemand` fields may not be populated from the API.

**Files to Edit:**
- `server/airdna.ts` (lines 6883-6976) - `calculateForwardLookingDemand` function
- `client/src/components/ForwardDemandCard.tsx` - Frontend display

---

### Issue #3: Add Metric Tooltips

**Requirement:** Add explanatory tooltips to all metrics in Step 3.

**Files to Edit:**
- `client/src/components/TeslaDashboard.tsx` - Use existing `METRIC_TOOLTIPS` pattern

---

## COMPLETE CODE FILES

---

## FILE 1: MarketInsightsPanel.tsx (Frontend - Supply Trend Chart)

**Path:** `client/src/components/MarketInsightsPanel.tsx`

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
    return null;
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
                <Tooltip text="How far in advance guests typically book.">
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
                <Tooltip text="How long guests typically stay.">
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
      {/* SUPPLY TREND - BUG IS HERE - BARS NOT RENDERING */}
      {/* ============================================ */}
      {supplyTrend && supplyTrend.monthly_data && supplyTrend.monthly_data.length > 0 && (
        <div className="bg-[oklch(0.98_0.01_265)] rounded-xl p-6 border border-[oklch(0.90_0.01_265)]">
          <h4 className="text-base font-medium text-[oklch(0.30_0_0)] mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
            Supply Trend (Active Listings)
            <Tooltip text="How many Airbnbs are active in this market over time.">
              <Info className="w-3.5 h-3.5 text-[oklch(0.60_0_0)] cursor-help" />
            </Tooltip>
          </h4>
          
          {/* Bar chart - BARS NOT RENDERING */}
          <div className="h-32 flex items-end gap-1">
            {(() => {
              // DEBUG: Log the data to see what we're working with
              console.log('[SupplyTrend] monthly_data:', supplyTrend.monthly_data);
              console.log('[SupplyTrend] last 12 months:', supplyTrend.monthly_data.slice(-12));
              return null;
            })()}
            {supplyTrend.monthly_data.slice(-12).map((month: any, i: number) => {
              // Get all active_listings values to find max
              const allListings = supplyTrend.monthly_data.slice(-12).map((m: any) => m.active_listings || 0);
              const maxCount = Math.max(...allListings, 1); // Ensure at least 1 to avoid division by zero
              const height = ((month.active_listings || 0) / maxCount) * 100;
              
              // DEBUG: Log each month's calculation
              console.log(`[SupplyTrend] Month ${i}: active_listings=${month.active_listings}, maxCount=${maxCount}, height=${height}%`);
              
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  {/* THE BAR - This is what's not showing */}
                  <div 
                    className="w-full bg-[oklch(0.55_0.14_75)] rounded-t transition-all hover:bg-[oklch(0.50_0.14_75)]"
                    style={{ height: `${height}%` }}
                    title={`${month.month}: ${month.active_listings?.toLocaleString() || 0} listings`}
                  />
                  {/* Month label */}
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

## FILE 2: ForwardDemandCard.tsx (Frontend - Forward Demand)

**Path:** `client/src/components/ForwardDemandCard.tsx`

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

      {/* Main Content - THESE PERCENTAGES WORK */}
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

      {/* Expanded Details - MAY SHOW $0/0 VALUES - BUG IS HERE */}
      {expanded && (
        <div className="p-4 border-t border-white/10 bg-white/5">
          <h4 className="text-sm font-medium text-white/70 mb-3">Detailed Metrics</h4>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-white/50 mb-2">30-Day Forecast</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Avg ADR</span>
                  {/* BUG: This shows $0 */}
                  <span className="text-white font-medium">{formatCurrency(data.next30Days.avgAdr)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Avg Supply</span>
                  {/* BUG: This shows 0 */}
                  <span className="text-white font-medium">{Math.round(data.next30Days.avgSupply).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Avg Demand</span>
                  {/* BUG: This shows 0 */}
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

## FILE 3: routers.ts (tRPC Router - Relevant Sections)

**Path:** `server/routers.ts`

```typescript
// Lines 1596-1675 - The tRPC procedures that call the backend functions

    // Get booking patterns for a market
    getBookingPatterns: publicProcedure
      .input(z.object({ marketId: z.union([z.number(), z.string()]) }))
      .mutation(async ({ input }) => {
        try {
          const result = await getMarketBookingPatterns(String(input.marketId));
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error("[Rental] Error getting booking patterns:", error);
          return {
            success: false,
            error: "Failed to get booking patterns",
            data: null,
          };
        }
      }),

    // Get supply trend for a market
    getSupplyTrend: publicProcedure
      .input(z.object({ marketId: z.union([z.number(), z.string()]) }))
      .mutation(async ({ input }) => {
        try {
          const result = await getMarketSupplyTrend(String(input.marketId));
          console.log('[getSupplyTrend] Result monthly_data sample:', result?.monthly_data?.slice(0, 2));
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error("[Rental] Error getting supply trend:", error);
          return {
            success: false,
            error: "Failed to get supply trend",
            data: null,
          };
        }
      }),

    // Get forward-looking demand indicators
    getForwardDemand: publicProcedure
      .input(z.object({ 
        marketId: z.union([z.number(), z.string()]),
        numMonths: z.number().optional().default(6),
        bedrooms: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const futureDailyData = await getMarketFutureDailyData(
            String(input.marketId),
            input.numMonths,
            input.bedrooms
          );
          
          if (!futureDailyData || futureDailyData.length === 0) {
            return {
              success: false,
              error: "No future pricing data available",
              data: null,
            };
          }
          
          const indicators = calculateForwardLookingDemand(futureDailyData);
          
          return {
            success: true,
            data: indicators,
          };
        } catch (error) {
          console.error("[Rental] Error getting forward demand:", error);
          return {
            success: false,
            error: "Failed to get forward demand",
            data: null,
          };
        }
      }),
```

---

## FILE 4: airdna.ts (Backend - Supply Trend Function)

**Path:** `server/airdna.ts`

### getMarketSupplyTrend Function (Lines 5366-5440)

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

    // ============================================
    // KEY ISSUE: Check what field the API actually returns
    // The API might return: listing_count, value, active_listings, or active_listings_count
    // ============================================
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

    // ============================================
    // KEY ISSUE: This is where active_listings is mapped
    // If the API returns a different field name, this will be 0
    // ============================================
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

---

## FILE 5: airdna.ts (Backend - Forward Demand Functions)

**Path:** `server/airdna.ts`

### getMarketFutureDailyData Function (Lines 4406-4447)

```typescript
export interface FutureDailyData {
  date: string;
  supply: number;
  demand: number;
  adr: number;
  adr_percentile_25: number;
  adr_percentile_50: number;
  adr_percentile_75: number;
  occupancy: number;
}

export async function getMarketFutureDailyData(
  marketId: string,
  numMonths: number = 6,
  bedrooms?: number
): Promise<FutureDailyData[]> {
  try {
    const filters: any[] = [];
    if (bedrooms !== undefined) {
      filters.push({ type: "select", field: "bedrooms", value: bedrooms });
    }

    const response = await makeApiRequest(
      `/market/${marketId}/future_pricing`,
      "POST",
      {
        num_months: numMonths,
        filters: filters.length > 0 ? filters : undefined,
      }
    );

    // API returns payload.metrics, not payload.data
    const responseData = (response as any)?.payload?.metrics || (response as any)?.payload?.data;
    if (!responseData || !Array.isArray(responseData)) {
      console.log('[AirDNA] Future pricing response structure:', JSON.stringify(response, null, 2).slice(0, 500));
      return [];
    }

    return responseData.map((d: any) => ({
      date: d.date,
      supply: d.supply || 0,
      demand: d.demand || 0,
      adr: d.adr || 0,
      adr_percentile_25: d.adr_percentile_25 || 0,
      adr_percentile_50: d.adr_percentile_50 || 0,
      adr_percentile_75: d.adr_percentile_75 || 0,
      occupancy: d.occupancy || 0,
    }));
  } catch (error) {
    console.error("Error fetching future daily data:", error);
    return [];
  }
}
```

### calculateForwardLookingDemand Function (Lines 6883-6976)

```typescript
export interface ForwardDemandIndicators {
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

function classifyDemandTrend(occupancy: number): { trend: 'hot' | 'warm' | 'cool' | 'cold'; label: string } {
  if (occupancy >= 70) return { trend: 'hot', label: 'High Demand' };
  if (occupancy >= 55) return { trend: 'warm', label: 'Warm Market' };
  if (occupancy >= 35) return { trend: 'cool', label: 'Cool Market' };
  return { trend: 'cold', label: 'Cold Market' };
}

export function calculateForwardLookingDemand(
  futureDailyData: FutureDailyData[]
): ForwardDemandIndicators | null {
  if (!futureDailyData || futureDailyData.length === 0) {
    return null;
  }

  // Sort by date
  const sortedData = [...futureDailyData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Get next 30 days data
  const today = new Date();
  const next30DaysEnd = new Date(today);
  next30DaysEnd.setDate(next30DaysEnd.getDate() + 30);
  
  const next30DaysData = sortedData.filter(d => {
    const date = new Date(d.date);
    return date >= today && date <= next30DaysEnd;
  });

  // Get next 180 days data
  const next180DaysEnd = new Date(today);
  next180DaysEnd.setDate(next180DaysEnd.getDate() + 180);
  
  const next180DaysData = sortedData.filter(d => {
    const date = new Date(d.date);
    return date >= today && date <= next180DaysEnd;
  });

  // ============================================
  // KEY ISSUE: These calculations use supply, demand, adr fields
  // If the API doesn't return these fields, they will be 0
  // ============================================
  const calc30 = next30DaysData.length > 0 ? {
    avgOccupancy: next30DaysData.reduce((sum, d) => sum + (d.occupancy || 0), 0) / next30DaysData.length,
    avgAdr: next30DaysData.reduce((sum, d) => sum + (d.adr || 0), 0) / next30DaysData.length,
    avgSupply: next30DaysData.reduce((sum, d) => sum + (d.supply || 0), 0) / next30DaysData.length,
    avgDemand: next30DaysData.reduce((sum, d) => sum + (d.demand || 0), 0) / next30DaysData.length,
  } : { avgOccupancy: 0, avgAdr: 0, avgSupply: 0, avgDemand: 0 };

  const calc180 = next180DaysData.length > 0 ? {
    avgOccupancy: next180DaysData.reduce((sum, d) => sum + (d.occupancy || 0), 0) / next180DaysData.length,
    avgAdr: next180DaysData.reduce((sum, d) => sum + (d.adr || 0), 0) / next180DaysData.length,
    avgSupply: next180DaysData.reduce((sum, d) => sum + (d.supply || 0), 0) / next180DaysData.length,
    avgDemand: next180DaysData.reduce((sum, d) => sum + (d.demand || 0), 0) / next180DaysData.length,
  } : { avgOccupancy: 0, avgAdr: 0, avgSupply: 0, avgDemand: 0 };

  // Find peak and low periods (7-day rolling windows)
  let peakPeriod: ForwardDemandIndicators['peakPeriod'] = null;
  let lowPeriod: ForwardDemandIndicators['lowPeriod'] = null;
  let maxAvgOccupancy = -Infinity;
  let minAvgOccupancy = Infinity;

  for (let i = 0; i <= sortedData.length - 7; i++) {
    const window = sortedData.slice(i, i + 7);
    const avgOcc = window.reduce((sum, d) => sum + (d.occupancy || 0), 0) / 7;
    
    if (avgOcc > maxAvgOccupancy) {
      maxAvgOccupancy = avgOcc;
      peakPeriod = {
        startDate: window[0].date,
        endDate: window[6].date,
        avgOccupancy: avgOcc,
      };
    }
    
    if (avgOcc < minAvgOccupancy) {
      minAvgOccupancy = avgOcc;
      lowPeriod = {
        startDate: window[0].date,
        endDate: window[6].date,
        avgOccupancy: avgOcc,
      };
    }
  }

  const trend30 = classifyDemandTrend(calc30.avgOccupancy);
  const trend180 = classifyDemandTrend(calc180.avgOccupancy);

  return {
    next30Days: {
      ...calc30,
      trend: trend30.trend,
      trendLabel: trend30.label,
    },
    next180Days: {
      ...calc180,
      trend: trend180.trend,
      trendLabel: trend180.label,
    },
    peakPeriod,
    lowPeriod,
  };
}
```

---

## DEBUGGING STEPS

### To Debug Supply Trend Chart:

1. **Check Browser Console** for these logs:
   ```
   [MarketInsightsPanel] supplyResult.data: {...}
   [SupplyTrend] monthly_data: [...]
   [SupplyTrend] Month 0: active_listings=X, maxCount=Y, height=Z%
   ```

2. **Check Server Logs** for:
   ```
   [getMarketSupplyTrend] Raw data sample: [...]
   [getSupplyTrend] Result monthly_data sample: [...]
   ```

3. **Verify the API Response Structure:**
   The AirDNA API might return different field names. Check if the raw data has:
   - `listing_count`
   - `value`
   - `active_listings`
   - `active_listings_count`

4. **Fix the Field Mapping:**
   In `airdna.ts` line 5426, update to include all possible field names:
   ```typescript
   active_listings: d.listing_count || d.value || d.active_listings || d.active_listings_count || 0,
   ```

### To Debug Forward Demand $0 Values:

1. **Check Server Logs** for:
   ```
   [AirDNA] Future pricing response structure: {...}
   ```

2. **Verify the API Response** has `supply`, `demand`, and `adr` fields.

3. **Check if the date filtering is correct** - the `today` comparison might be filtering out all data.

---

## SUMMARY OF FIXES NEEDED

| Issue | File | Line | Fix |
|-------|------|------|-----|
| Supply Trend bars not rendering | `server/airdna.ts` | 5426 | Update field mapping to check all possible API field names |
| Supply Trend bars not rendering | `client/src/components/MarketInsightsPanel.tsx` | 196-199 | Verify `active_listings` values are not 0 |
| Forward Demand $0 values | `server/airdna.ts` | 4433-4441 | Check if API returns `supply`, `demand`, `adr` fields |
| Forward Demand $0 values | `server/airdna.ts` | 6915-6920 | Verify date filtering isn't excluding all data |

---

*Complete reference for ChatGPT Codex - includes all code needed to fix Step 3 issues*
