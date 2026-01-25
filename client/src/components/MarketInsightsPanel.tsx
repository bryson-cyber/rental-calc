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

      {/* Supply Trend */}
      {supplyTrend && supplyTrend.monthly_data && supplyTrend.monthly_data.length > 0 && (
        <div className="bg-[oklch(0.98_0.01_265)] rounded-xl p-6 border border-[oklch(0.90_0.01_265)]">
          <h4 className="text-base font-medium text-[oklch(0.30_0_0)] mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
            Supply Trend (Active Listings)
            <Tooltip text="How many Airbnbs are active in this market over time. More listings = more competition. Growing markets attract more hosts.">
              <Info className="w-3.5 h-3.5 text-[oklch(0.60_0_0)] cursor-help" />
            </Tooltip>
          </h4>
          
          {/* Simple bar chart */}
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
          
          {/* Summary stats */}
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
