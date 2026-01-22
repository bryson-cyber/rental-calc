/**
 * Market Insights Panel Component
 * 
 * Displays booking patterns and supply trend data from AirDNA API.
 * Uses third-grade level explanations for all metrics.
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Home,
  Info,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  BarChart3
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface BookingPatterns {
  booking_lead_time: {
    avg_days: number;
    median_days: number;
    last_minute_percent: number;
    advance_booking_percent: number;
  };
  length_of_stay: {
    avg_nights: number;
    median_nights: number;
    weekend_percent: number;
    week_percent: number;
  };
  insights: string[];
}

interface SupplyTrend {
  current_listings: number;
  listings_12_months_ago: number;
  net_change: number;
  percent_change: number;
  monthly_data: Array<{
    month: string;
    active_listings: number;
    change_from_previous: number;
  }>;
  trend: 'growing' | 'stable' | 'declining';
  insight: string;
}

interface MarketInsightsPanelProps {
  marketId: string;
  bedrooms?: number;
  className?: string;
}

// ============================================
// TOOLTIP EXPLANATIONS (Third-grader friendly)
// ============================================

const TOOLTIPS = {
  bookingLeadTime: "This tells you how far ahead guests book their stay. If it's 14 days, most guests book about 2 weeks before they arrive. Knowing this helps you plan when to adjust your prices!",
  lengthOfStay: "This shows how many nights guests usually stay. If it's 3 nights, most guests book for a long weekend. Shorter stays mean more cleaning, longer stays mean less work!",
  lastMinute: "This is the percentage of guests who book at the last minute (within 7 days). High last-minute bookings mean you can raise prices when you have open dates!",
  advanceBooking: "This shows how many guests plan ahead and book 30+ days in advance. More advance bookings = more predictable income!",
  weekendStays: "Short stays of 1-2 nights, usually weekends. More weekend stays = more cleaning and turnover work.",
  weekLongStays: "Longer stays of 7+ nights. More week-long stays = less cleaning, more stable income!",
  supplyTrend: "This shows if more or fewer rentals are entering the market. Growing = more competition. Declining = less competition, but investigate why!",
  currentListings: "The total number of active short-term rentals in this market right now.",
  netChange: "How many listings were added or removed in the past year. Positive = more competition, negative = less competition."
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatMonth = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

// ============================================
// SUB-COMPONENTS
// ============================================

function MetricCard({
  icon,
  label,
  value,
  sublabel,
  tooltip,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  tooltip: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 bg-slate-100 rounded-lg">
          {icon}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1 hover:bg-slate-100 rounded transition-colors">
              <Info className="w-4 h-4 text-slate-400" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs p-3 bg-white text-slate-900 shadow-lg border">
            <p className="text-sm leading-relaxed">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {trend && (
          <span className={`flex items-center ${
            trend === 'up' ? 'text-emerald-600' : 
            trend === 'down' ? 'text-red-600' : 
            'text-slate-500'
          }`}>
            {trend === 'up' && <TrendingUp className="w-4 h-4" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4" />}
            {trend === 'neutral' && <Minus className="w-4 h-4" />}
          </span>
        )}
      </div>
      {sublabel && <p className="text-xs text-slate-500 mt-1">{sublabel}</p>}
    </div>
  );
}

function SupplyChart({ data }: { data: SupplyTrend['monthly_data'] }) {
  if (!data || data.length === 0) return null;
  
  const maxListings = Math.max(...data.map(d => d.active_listings));
  const minListings = Math.min(...data.map(d => d.active_listings));
  const range = maxListings - minListings || 1;
  
  return (
    <div className="mt-4">
      <p className="text-xs text-slate-500 font-medium mb-2">Supply Over Time</p>
      <div className="flex items-end gap-1 h-24">
        {data.map((month, idx) => {
          const heightPct = ((month.active_listings - minListings) / range) * 80 + 20;
          const isGrowing = month.change_from_previous > 0;
          const isDecreasing = month.change_from_previous < 0;
          
          return (
            <div key={idx} className="flex-1 flex flex-col items-center group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-slate-900 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap">
                  <p className="font-medium">{formatMonth(month.month)}</p>
                  <p>{month.active_listings.toLocaleString()} listings</p>
                  {month.change_from_previous !== 0 && (
                    <p className={isGrowing ? 'text-emerald-400' : 'text-red-400'}>
                      {isGrowing ? '+' : ''}{month.change_from_previous}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Bar */}
              <div 
                className={`w-full rounded-t transition-all cursor-pointer ${
                  isGrowing ? 'bg-emerald-500' : 
                  isDecreasing ? 'bg-red-400' : 
                  'bg-slate-400'
                }`}
                style={{ height: `${heightPct}%` }}
              />
              
              {/* Month label (show every 3rd) */}
              {idx % 3 === 0 && (
                <span className="text-[9px] text-slate-400 mt-1">
                  {formatMonth(month.month).split(' ')[0]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function MarketInsightsPanel({ marketId, bedrooms, className = '' }: MarketInsightsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  
  // Fetch booking patterns
  const { data: bookingData, isLoading: bookingLoading, error: bookingError } = trpc.rental.getBookingPatterns.useQuery(
    { marketId, bedrooms },
    { enabled: !!marketId }
  );
  
  // Fetch supply trend
  const { data: supplyData, isLoading: supplyLoading, error: supplyError } = trpc.rental.getSupplyTrend.useQuery(
    { marketId, bedrooms },
    { enabled: !!marketId }
  );
  
  const isLoading = bookingLoading || supplyLoading;
  const hasError = bookingError || supplyError || (!bookingData?.success && !supplyData?.success);
  
  const bookingPatterns = bookingData?.data as BookingPatterns | null;
  const supplyTrend = supplyData?.data as SupplyTrend | null;
  
  // Don't render if no market ID
  if (!marketId) return null;
  
  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <BarChart3 className="w-5 h-5 text-slate-700" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-slate-900">Market Insights</h3>
            <p className="text-sm text-slate-500">Booking patterns & supply trends</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      
      {/* Content */}
      {expanded && (
        <div className="p-4 pt-0 space-y-6">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              <span className="ml-2 text-slate-500">Loading market insights...</span>
            </div>
          )}
          
          {/* Error State */}
          {!isLoading && hasError && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Some market insights are unavailable. This data may not be available for all markets.
              </p>
            </div>
          )}
          
          {/* Booking Patterns Section */}
          {!isLoading && bookingPatterns && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Booking Patterns
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  icon={<Calendar className="w-5 h-5 text-blue-600" />}
                  label="Booking Lead Time"
                  value={`${bookingPatterns.booking_lead_time.avg_days} days`}
                  sublabel="Average advance booking"
                  tooltip={TOOLTIPS.bookingLeadTime}
                />
                <MetricCard
                  icon={<Users className="w-5 h-5 text-purple-600" />}
                  label="Length of Stay"
                  value={`${bookingPatterns.length_of_stay.avg_nights} nights`}
                  sublabel="Average stay duration"
                  tooltip={TOOLTIPS.lengthOfStay}
                />
                <MetricCard
                  icon={<Clock className="w-5 h-5 text-amber-600" />}
                  label="Last-Minute"
                  value={`${bookingPatterns.booking_lead_time.last_minute_percent}%`}
                  sublabel="Book within 7 days"
                  tooltip={TOOLTIPS.lastMinute}
                />
                <MetricCard
                  icon={<Calendar className="w-5 h-5 text-emerald-600" />}
                  label="Advance Bookings"
                  value={`${bookingPatterns.booking_lead_time.advance_booking_percent}%`}
                  sublabel="Book 30+ days ahead"
                  tooltip={TOOLTIPS.advanceBooking}
                />
              </div>
              
              {/* Insights */}
              {bookingPatterns.insights && bookingPatterns.insights.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Insight:</span> {bookingPatterns.insights[0]}
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Supply Trend Section */}
          {!isLoading && supplyTrend && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Home className="w-4 h-4" />
                Supply Trend
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard
                  icon={<Home className="w-5 h-5 text-slate-600" />}
                  label="Active Listings"
                  value={supplyTrend.current_listings.toLocaleString()}
                  sublabel="Current supply"
                  tooltip={TOOLTIPS.currentListings}
                />
                <MetricCard
                  icon={
                    supplyTrend.trend === 'growing' ? <TrendingUp className="w-5 h-5 text-emerald-600" /> :
                    supplyTrend.trend === 'declining' ? <TrendingDown className="w-5 h-5 text-red-600" /> :
                    <Minus className="w-5 h-5 text-slate-600" />
                  }
                  label="12-Month Change"
                  value={`${supplyTrend.net_change >= 0 ? '+' : ''}${supplyTrend.net_change}`}
                  sublabel={`${supplyTrend.percent_change >= 0 ? '+' : ''}${supplyTrend.percent_change}% YoY`}
                  tooltip={TOOLTIPS.netChange}
                  trend={supplyTrend.trend === 'growing' ? 'up' : supplyTrend.trend === 'declining' ? 'down' : 'neutral'}
                />
                <MetricCard
                  icon={
                    supplyTrend.trend === 'growing' ? <TrendingUp className="w-5 h-5 text-amber-600" /> :
                    supplyTrend.trend === 'declining' ? <TrendingDown className="w-5 h-5 text-emerald-600" /> :
                    <Minus className="w-5 h-5 text-slate-600" />
                  }
                  label="Market Trend"
                  value={supplyTrend.trend.charAt(0).toUpperCase() + supplyTrend.trend.slice(1)}
                  sublabel={supplyTrend.trend === 'growing' ? 'More competition' : supplyTrend.trend === 'declining' ? 'Less competition' : 'Stable market'}
                  tooltip={TOOLTIPS.supplyTrend}
                />
              </div>
              
              {/* Supply Chart */}
              <SupplyChart data={supplyTrend.monthly_data} />
              
              {/* Insight */}
              {supplyTrend.insight && (
                <div className={`mt-3 p-3 rounded-lg border ${
                  supplyTrend.trend === 'growing' 
                    ? 'bg-amber-50 border-amber-100' 
                    : supplyTrend.trend === 'declining'
                    ? 'bg-emerald-50 border-emerald-100'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <p className={`text-sm ${
                    supplyTrend.trend === 'growing' 
                      ? 'text-amber-800' 
                      : supplyTrend.trend === 'declining'
                      ? 'text-emerald-800'
                      : 'text-slate-700'
                  }`}>
                    <span className="font-medium">Insight:</span> {supplyTrend.insight}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MarketInsightsPanel;
