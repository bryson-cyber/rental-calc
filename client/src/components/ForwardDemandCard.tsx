import { useState } from 'react';
import { TrendingUp, Sparkles, Calendar, ChevronDown, ChevronUp, Rocket, Target, Zap, Star, Info } from 'lucide-react';

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

// Optimistic tooltip explanations
const DEMAND_TOOLTIPS = {
  marketOutlook: "See what's coming up in this market! Use this to plan your launch timing and pricing strategy.",
  next30Days: "Your immediate opportunity window. This shows expected booking activity in the next month.",
  next180Days: "Your 6-month runway. Plan ahead and prepare for seasonal shifts.",
  peakPeriod: "Prime earning window! This is when guests are most eager to book - perfect for premium pricing.",
  opportunity: "Strategic opportunity! Lower competition means easier bookings and room to stand out.",
  avgAdr: "What guests are willing to pay. Higher rates = more revenue per booking.",
  avgSupply: "Number of active listings. Know your competition.",
  avgDemand: "Guest booking interest. Higher demand = more booking opportunities.",
};

// Optimistic trend labels based on occupancy
const getOptimisticLabel = (occupancy: number): { label: string; subtext: string } => {
  if (occupancy >= 70) return { label: 'High Demand', subtext: 'Excellent booking potential' };
  if (occupancy >= 55) return { label: 'Strong Activity', subtext: 'Good booking momentum' };
  if (occupancy >= 40) return { label: 'Steady Market', subtext: 'Consistent opportunities' };
  if (occupancy >= 25) return { label: 'Growing Season', subtext: 'Build your reviews now' };
  return { label: 'Strategic Window', subtext: 'Less competition, easier to stand out' };
};

// All-positive color scheme - greens and golds
const getOptimisticColors = (occupancy: number) => {
  if (occupancy >= 70) return { bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700', icon: <Rocket className="w-5 h-5 text-emerald-500" /> };
  if (occupancy >= 55) return { bg: 'bg-green-50 border-green-300', text: 'text-green-700', icon: <Zap className="w-5 h-5 text-green-500" /> };
  if (occupancy >= 40) return { bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700', icon: <Target className="w-5 h-5 text-amber-500" /> };
  if (occupancy >= 25) return { bg: 'bg-yellow-50 border-yellow-300', text: 'text-yellow-700', icon: <Star className="w-5 h-5 text-yellow-500" /> };
  return { bg: 'bg-orange-50 border-orange-300', text: 'text-orange-700', icon: <Sparkles className="w-5 h-5 text-orange-500" /> };
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

  const next30Colors = getOptimisticColors(data.next30Days.avgOccupancy);
  const next180Colors = getOptimisticColors(data.next180Days.avgOccupancy);
  const next30Label = getOptimisticLabel(data.next30Days.avgOccupancy);
  const next180Label = getOptimisticLabel(data.next180Days.avgOccupancy);

  return (
    <div className="bg-[oklch(0.98_0.01_265)] rounded-xl border border-[oklch(0.90_0.01_265)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[oklch(0.90_0.01_265)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
            <h3 className="text-base font-medium text-[oklch(0.30_0_0)] flex items-center gap-2">
              Market Outlook
              <Tooltip text={DEMAND_TOOLTIPS.marketOutlook}>
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
          Plan your timing based on upcoming market activity
        </p>
      </div>

      {/* Main Content - Full width cards */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Next 30 Days - Full width card */}
          <Tooltip text={DEMAND_TOOLTIPS.next30Days}>
            <div className={`p-5 rounded-xl border-2 cursor-help w-full ${next30Colors.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {next30Colors.icon}
                  <span className={`text-sm font-semibold ${next30Colors.text}`}>Next 30 Days</span>
                </div>
              </div>
              <div className={`text-4xl font-bold mb-1 ${next30Colors.text}`}>
                {Math.round(data.next30Days.avgOccupancy)}%
              </div>
              <div className={`text-sm font-semibold ${next30Colors.text}`}>
                {next30Label.label}
              </div>
              <div className={`text-xs ${next30Colors.text} opacity-75 mt-1`}>
                {next30Label.subtext}
              </div>
            </div>
          </Tooltip>

          {/* Next 180 Days - Full width card */}
          <Tooltip text={DEMAND_TOOLTIPS.next180Days}>
            <div className={`p-5 rounded-xl border-2 cursor-help w-full ${next180Colors.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {next180Colors.icon}
                  <span className={`text-sm font-semibold ${next180Colors.text}`}>Next 6 Months</span>
                </div>
              </div>
              <div className={`text-4xl font-bold mb-1 ${next180Colors.text}`}>
                {Math.round(data.next180Days.avgOccupancy)}%
              </div>
              <div className={`text-sm font-semibold ${next180Colors.text}`}>
                {next180Label.label}
              </div>
              <div className={`text-xs ${next180Colors.text} opacity-75 mt-1`}>
                {next180Label.subtext}
              </div>
            </div>
          </Tooltip>
        </div>

        {/* Peak Period & Strategic Opportunity - Full width cards */}
        {(data.peakPeriod || data.lowPeriod) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {data.peakPeriod && (
              <Tooltip text={DEMAND_TOOLTIPS.peakPeriod}>
                <div className="p-4 bg-emerald-50 rounded-xl border-2 border-emerald-300 cursor-help w-full">
                  <div className="flex items-center gap-2 text-emerald-600 mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-semibold">Peak Earning Window</span>
                  </div>
                  <div className="text-[oklch(0.25_0_0)] text-lg font-bold">
                    {formatDate(data.peakPeriod.startDate)} - {formatDate(data.peakPeriod.endDate)}
                  </div>
                  <div className="text-emerald-600 text-sm font-medium mt-1">
                    {Math.round(data.peakPeriod.avgOccupancy)}% booking activity
                  </div>
                  <div className="text-emerald-500 text-xs mt-1">
                    Great time for premium pricing
                  </div>
                </div>
              </Tooltip>
            )}
            {data.lowPeriod && (
              <Tooltip text={DEMAND_TOOLTIPS.opportunity}>
                <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-300 cursor-help w-full">
                  <div className="flex items-center gap-2 text-amber-600 mb-2">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-semibold">Strategic Opportunity</span>
                  </div>
                  <div className="text-[oklch(0.25_0_0)] text-lg font-bold">
                    {formatDate(data.lowPeriod.startDate)} - {formatDate(data.lowPeriod.endDate)}
                  </div>
                  <div className="text-amber-600 text-sm font-medium mt-1">
                    {Math.round(data.lowPeriod.avgOccupancy)}% booking activity
                  </div>
                  <div className="text-amber-500 text-xs mt-1">
                    Perfect time to build reviews & stand out
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
          <h4 className="text-sm font-semibold text-[oklch(0.40_0_0)] mb-4">Detailed Market Metrics</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-4 border border-[oklch(0.90_0.01_265)]">
              <div className="text-sm font-medium text-[oklch(0.40_0_0)] mb-3 pb-2 border-b border-[oklch(0.92_0_0)]">30-Day Outlook</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[oklch(0.50_0_0)]">Avg Nightly Rate</span>
                  <span className="text-[oklch(0.25_0_0)] font-semibold">{formatCurrency(data.next30Days.avgAdr)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[oklch(0.50_0_0)]">Active Listings</span>
                  <span className="text-[oklch(0.25_0_0)] font-semibold">{Math.round(data.next30Days.avgSupply).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[oklch(0.50_0_0)]">Guest Interest</span>
                  <span className="text-[oklch(0.25_0_0)] font-semibold">{Math.round(data.next30Days.avgDemand).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-[oklch(0.90_0.01_265)]">
              <div className="text-sm font-medium text-[oklch(0.40_0_0)] mb-3 pb-2 border-b border-[oklch(0.92_0_0)]">6-Month Outlook</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[oklch(0.50_0_0)]">Avg Nightly Rate</span>
                  <span className="text-[oklch(0.25_0_0)] font-semibold">{formatCurrency(data.next180Days.avgAdr)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[oklch(0.50_0_0)]">Active Listings</span>
                  <span className="text-[oklch(0.25_0_0)] font-semibold">{Math.round(data.next180Days.avgSupply).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[oklch(0.50_0_0)]">Guest Interest</span>
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
