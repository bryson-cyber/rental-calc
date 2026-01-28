/**
 * MarketInsightsPanel Component
 * 
 * Displays booking patterns, supply trend data, forward-looking demand,
 * and multi-year historical trends from market data API.
 * 
 * FIXED: Supply Trend chart bars now render correctly with proper height wrapper
 */
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Calendar, TrendingUp, Users, Info } from 'lucide-react';
import { ForwardDemandCard } from './ForwardDemandCard';
import { MultiYearTrends } from './MultiYearTrends';

interface MarketInsightsPanelProps {
  marketId?: string | number;
  bedrooms?: number;
}

// Simple tooltip component - DARK MODE for better visibility
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="relative group inline-flex">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#0F172A] text-white text-xs rounded-lg shadow-lg border-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 max-w-[200px] text-center whitespace-normal">
        {text}
      </span>
    </span>
  );
}

// Safe number conversion helper
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const num = Number(value.replace(/,/g, ''));
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}

// Extract listings value from any possible field name
function getListingsValue(month: any): number {
  return toNumber(
    month?.active_listings ??
      month?.active_listings_count ??
      month?.listing_count ??
      month?.value ??
      0
  );
}

// Format month label from date string
function formatMonthLabel(raw: string): string {
  if (!raw) return '';
  const date = raw.length >= 10 ? new Date(raw) : new Date(`${raw}-01`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-US', { month: 'short' });
}

export default function MarketInsightsPanel({ marketId, bedrooms }: MarketInsightsPanelProps) {
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
          getBookingPatterns.mutateAsync({ marketId: marketIdStr, bedrooms }),
          getSupplyTrend.mutateAsync({ marketId: marketIdStr, bedrooms }),
          getForwardDemand.mutateAsync({ marketId: marketIdStr, bedrooms }).catch(() => null),
        ]);

        if (patternsResult.success) {
          setBookingPatterns(patternsResult.data);
        }
        if (supplyResult.success) {
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

  // Pre-calculate chart data outside render loop
  const recentSupplyMonths = supplyTrend?.monthly_data?.slice(-12) ?? [];
  const chartData = recentSupplyMonths.map((month: any) => {
    const listings = getListingsValue(month);
    return {
      month: month?.month || '',
      listings,
      label: formatMonthLabel(month?.month || ''),
    };
  });
  const maxCount = Math.max(...chartData.map((d: { listings: number }) => d.listings), 1);
  const currentListings =
    recentSupplyMonths.length > 0
      ? getListingsValue(recentSupplyMonths[recentSupplyMonths.length - 1])
      : null;

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
      {forwardDemand && <ForwardDemandCard data={forwardDemand} />}

      {/* Multi-Year Historical Trends */}
      {marketId && <MultiYearTrends marketId={String(marketId)} />}

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
                  <span className="font-medium text-[oklch(0.35_0_0)]">
                    {bookingPatterns.lead_time?.last_minute_percent || 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[oklch(0.50_0_0)]">Advance (30+ days)</span>
                  <span className="font-medium text-[oklch(0.35_0_0)]">
                    {bookingPatterns.lead_time?.advance_booking_percent || 0}%
                  </span>
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
                  <span className="font-medium text-[oklch(0.35_0_0)]">
                    {bookingPatterns.length_of_stay?.weekend_percent || 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[oklch(0.50_0_0)]">Week+ stays (7+ nights)</span>
                  <span className="font-medium text-[oklch(0.35_0_0)]">
                    {bookingPatterns.length_of_stay?.week_percent || 0}%
                  </span>
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

      {/* Supply Trend - FIXED: Added proper height wrapper for percentage heights */}
      {supplyTrend && supplyTrend.monthly_data && supplyTrend.monthly_data.length > 0 && (
        <div className="bg-[oklch(0.98_0.01_265)] rounded-xl p-6 border border-[oklch(0.90_0.01_265)]">
          <h4 className="text-base font-medium text-[oklch(0.30_0_0)] mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
            Supply Trend (Active Listings)
            <Tooltip text="How many Airbnbs are active in this market over time. More listings = more competition. Growing markets attract more hosts.">
              <Info className="w-3.5 h-3.5 text-[oklch(0.60_0_0)] cursor-help" />
            </Tooltip>
          </h4>

          {/* Bar chart with Y-axis labels */}
          <div className="flex">
            {/* Y-axis labels */}
            <div className="flex flex-col justify-between h-32 pr-2 text-right">
              <span className="text-[10px] text-[oklch(0.50_0_0)]">{maxCount.toLocaleString()}</span>
              <span className="text-[10px] text-[oklch(0.50_0_0)]">{Math.round(maxCount * 0.75).toLocaleString()}</span>
              <span className="text-[10px] text-[oklch(0.50_0_0)]">{Math.round(maxCount * 0.5).toLocaleString()}</span>
              <span className="text-[10px] text-[oklch(0.50_0_0)]">{Math.round(maxCount * 0.25).toLocaleString()}</span>
              <span className="text-[10px] text-[oklch(0.50_0_0)]">0</span>
            </div>
            {/* Chart area */}
            <div className="flex-1 h-32 flex items-end gap-1 border-l border-b border-[oklch(0.85_0_0)]">
              {chartData.map((point: { month: string; listings: number; label: string }, i: number) => {
                const height = (point.listings / maxCount) * 100;
                return (
                  <div key={i} className="flex-1 h-full flex flex-col items-center">
                    {/* This wrapper has h-full and flex items-end so the bar can use percentage height */}
                    <div className="flex-1 w-full flex items-end relative group">
                      <div
                        className="w-full bg-[oklch(0.55_0.14_75)] rounded-t transition-all hover:bg-[oklch(0.50_0.14_75)] cursor-pointer"
                        style={{ height: `${height}%` }}
                      />
                      {/* Hover tooltip showing exact number - LIGHT MODE */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-white text-[oklch(0.25_0_0)] text-xs font-semibold rounded shadow-lg border border-[oklch(0.90_0_0)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                        {point.listings.toLocaleString()}
                      </div>
                    </div>
                    <span className="mt-1 text-[10px] text-[oklch(0.50_0_0)]">{point.label || '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary stats */}
          <div className="mt-4 pt-4 border-t border-[oklch(0.90_0.01_265)] grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-[oklch(0.50_0_0)]">Current</div>
              <div className="font-semibold text-[oklch(0.30_0_0)]">
                {currentListings === null ? 'N/A' : currentListings.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-[oklch(0.50_0_0)]">12-Month Change</div>
              <div
                className={`font-semibold ${
                  (supplyTrend.percent_change ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {(supplyTrend.percent_change ?? 0) >= 0 ? '+' : ''}
                {supplyTrend.percent_change ?? 0}%
              </div>
            </div>
            <div>
              <div className="text-xs text-[oklch(0.50_0_0)]">Trend</div>
              <div className="font-semibold text-[oklch(0.30_0_0)]">
                {(supplyTrend.percent_change ?? 0) > 5
                  ? 'Growing'
                  : (supplyTrend.percent_change ?? 0) < -5
                  ? 'Shrinking'
                  : 'Stable'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
