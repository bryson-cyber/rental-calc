/**
 * RentometerSection Component
 * Displays comprehensive Rentometer data within property reports.
 * Fetches data on-demand if not already provided.
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import {
  DollarSign,
  TrendingUp,
  MapPin,
  Loader2,
  AlertCircle,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Building,
  Ruler,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────

interface RentometerSummary {
  address: string;
  latitude: string;
  longitude: string;
  bedrooms: number;
  baths: string;
  building_type: string;
  look_back_days: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  percentile_25: number;
  percentile_75: number;
  std_dev: number;
  samples: number;
  radius_miles: number;
  quickview_url: string;
  token: string;
}

interface PropertyListing {
  id: number;
  bedrooms: number;
  baths: string;
  price: number;
  sqft: number;
  last_seen: string;
  price_per_sqft: number;
}

interface PropertyRentsData {
  formatted_address: string;
  latitude: number;
  longitude: number;
  average_update_days: number;
  count: number;
  property_listings: PropertyListing[];
}

interface NearbyProperty {
  address: string;
  latitude: number;
  longitude: number;
  distance: number;
  price: number;
  bedrooms: number;
  baths: string;
  property_type: string;
  last_seen: string;
  sqft: number;
  dollar_sqft: number;
}

interface NearbyCompsData {
  search_address: string;
  count: number;
  nearby_properties: NearbyProperty[];
}

interface RentometerData {
  summary: RentometerSummary | null;
  propertyRents: PropertyRentsData | null;
  nearbyComps: NearbyCompsData | null;
  errors?: string[];
}

interface RentometerSectionProps {
  address: string;
  bedrooms: number;
  monthlyRent?: number;
  /** Pre-fetched data from report generation (optional) */
  preloadedData?: RentometerData;
}

// ─── Helpers ────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

// ─── Sub-Components ─────────────────────────────────────────────────

function RentDistributionBar({ 
  min, max, percentile25, median, percentile75, userRent 
}: { 
  min: number; max: number; percentile25: number; median: number; percentile75: number; userRent?: number;
}) {
  const range = max - min;
  if (range <= 0) return null;

  const toPercent = (val: number) => Math.max(0, Math.min(100, ((val - min) / range) * 100));

  return (
    <div className="relative mt-4 mb-8">
      {/* Labels */}
      <div className="flex justify-between text-xs text-[oklch(0.15_0_0)]/50 mb-1">
        <span>{formatCurrency(min)}</span>
        <span>{formatCurrency(max)}</span>
      </div>
      
      {/* Bar */}
      <div className="relative h-8 bg-[oklch(0.15_0_0)]/5 rounded-full overflow-hidden">
        {/* IQR range (25th-75th) */}
        <div
          className="absolute top-0 h-full bg-[oklch(0.55_0.14_75)]/20 rounded-full"
          style={{
            left: `${toPercent(percentile25)}%`,
            width: `${toPercent(percentile75) - toPercent(percentile25)}%`,
          }}
        />
        
        {/* Median marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-[oklch(0.55_0.14_75)]"
          style={{ left: `${toPercent(median)}%` }}
        />
        
        {/* User rent marker */}
        {userRent && userRent >= min && userRent <= max && (
          <div
            className="absolute top-0 h-full w-1 bg-emerald-500 rounded-full"
            style={{ left: `${toPercent(userRent)}%` }}
          />
        )}
      </div>
      
      {/* Marker labels */}
      <div className="relative h-6 mt-1">
        <div
          className="absolute text-xs font-medium text-[oklch(0.55_0.14_75)] -translate-x-1/2"
          style={{ left: `${toPercent(percentile25)}%` }}
        >
          25th
        </div>
        <div
          className="absolute text-xs font-semibold text-[oklch(0.55_0.14_75)] -translate-x-1/2"
          style={{ left: `${toPercent(median)}%` }}
        >
          Median
        </div>
        <div
          className="absolute text-xs font-medium text-[oklch(0.55_0.14_75)] -translate-x-1/2"
          style={{ left: `${toPercent(percentile75)}%` }}
        >
          75th
        </div>
        {userRent && userRent >= min && userRent <= max && (
          <div
            className="absolute text-xs font-semibold text-emerald-600 -translate-x-1/2"
            style={{ left: `${toPercent(userRent)}%` }}
          >
            You
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, subtext, icon: Icon, variant = 'default' }: {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ElementType;
  variant?: 'default' | 'highlight' | 'success' | 'warning';
}) {
  const variantStyles = {
    default: 'bg-white border-[oklch(0.15_0_0)]/10',
    highlight: 'bg-[oklch(0.55_0.14_75)]/5 border-[oklch(0.55_0.14_75)]/20',
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
  };

  return (
    <div className={`rounded-xl border p-4 ${variantStyles[variant]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
        <span className="text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-[oklch(0.15_0_0)]">{value}</p>
      {subtext && <p className="text-xs text-[oklch(0.15_0_0)]/50 mt-0.5">{subtext}</p>}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function RentometerSection({
  address,
  bedrooms,
  monthlyRent,
  preloadedData,
}: RentometerSectionProps) {
  const [showAllComps, setShowAllComps] = useState(false);
  const [showPropertyRents, setShowPropertyRents] = useState(false);
  
  // Fetch data on-demand if not preloaded
  const fetchMutation = trpc.rentometer.getComprehensiveData.useMutation();
  
  const [fetchedData, setFetchedData] = useState<RentometerData | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (preloadedData) return;
    if (hasFetched) return;
    if (!address || bedrooms === undefined) return;

    setHasFetched(true);
    fetchMutation.mutate(
      {
        address,
        bedrooms,
        buildingType: 'house',
      },
      {
        onSuccess: (result) => {
          if (result.success && result.data) {
            setFetchedData(result.data as any);
          }
        },
      }
    );
  }, [address, bedrooms, preloadedData, hasFetched]);

  const data = preloadedData || fetchedData;
  const isLoading = !preloadedData && fetchMutation.isPending;
  const hasError = !preloadedData && fetchMutation.isError;

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[oklch(0.55_0.14_75)] mx-auto mb-3" />
        <p className="text-[oklch(0.15_0_0)]/70">Loading rent market data...</p>
        <p className="text-xs text-[oklch(0.15_0_0)]/40 mt-1">Fetching rent summary, nearby comps, and property listings</p>
      </div>
    );
  }

  // Error state
  if (hasError || (!data && hasFetched)) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
        <p className="text-[oklch(0.15_0_0)]/70 font-medium">Rent market data unavailable</p>
        <p className="text-xs text-[oklch(0.15_0_0)]/40 mt-1">
          {fetchMutation.error?.message || 'Could not retrieve rent market data for this address.'}
        </p>
        <button
          onClick={() => {
            setHasFetched(false);
            setFetchedData(null);
          }}
          className="mt-4 inline-flex items-center gap-2 text-sm text-[oklch(0.55_0.14_75)] hover:underline"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </button>
      </div>
    );
  }

  // No data yet (waiting for fetch)
  if (!data) return null;

  const { summary, propertyRents, nearbyComps } = data;

  // If no summary data at all, show a minimal message
  if (!summary) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[oklch(0.55_0.14_75)]/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[oklch(0.15_0_0)]">Rent Market Data</h3>
            <p className="text-xs text-[oklch(0.15_0_0)]/50">Powered by Coach Inayah market data</p>
          </div>
        </div>
        <p className="text-[oklch(0.15_0_0)]/60 text-sm">
          Rent summary data is not available for this address. This may be due to limited rental listings in the area.
        </p>
      </div>
    );
  }

  // Calculate user rent comparison if available
  const rentComparison = monthlyRent && summary.median > 0 ? {
    difference: monthlyRent - summary.median,
    percentDiff: Math.round(((monthlyRent - summary.median) / summary.median) * 100),
    position: monthlyRent <= summary.percentile_25 ? 'bottom 25%' 
      : monthlyRent <= summary.median ? 'below median'
      : monthlyRent <= summary.percentile_75 ? 'above median'
      : 'top 25%',
    isBelow: monthlyRent < summary.median,
  } : null;

  const nearbyCompsToShow = nearbyComps?.nearby_properties || [];
  const visibleComps = showAllComps ? nearbyCompsToShow : nearbyCompsToShow.slice(0, 8);
  const propertyListings = propertyRents?.property_listings || [];

  return (
    <div className="space-y-6">
      {/* Header Card: Rent Summary */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-[oklch(0.55_0.14_75)] to-amber-500 p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Long-Term Rent Market Analysis
          </h3>
          {summary.quickview_url && (
            <a
              href={summary.quickview_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-white text-xs flex items-center gap-1 transition-colors"
            >
              View Details <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="p-6">
          {/* Context */}
          <div className="flex items-start gap-3 mb-6 p-3 bg-[oklch(0.15_0_0)]/3 rounded-lg">
            <Info className="w-4 h-4 text-[oklch(0.55_0.14_75)] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-[oklch(0.15_0_0)]/60">
              Based on <strong>{summary.samples} rental listings</strong> within a <strong>{summary.radius_miles}-mile radius</strong> over 
              the past {Math.round(summary.look_back_days / 30)} months. This data represents the <strong>long-term rental market</strong> — 
              what tenants pay for traditional leases in this area.
            </p>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatBox
              label="Median Rent"
              value={formatCurrency(summary.median)}
              subtext="50th percentile"
              icon={DollarSign}
              variant="highlight"
            />
            <StatBox
              label="Average Rent"
              value={formatCurrency(summary.mean)}
              subtext={`Std dev: ${formatCurrency(summary.std_dev)}`}
              icon={BarChart3}
            />
            <StatBox
              label="Rent Range"
              value={`${formatCurrency(summary.min)} – ${formatCurrency(summary.max)}`}
              subtext={`${summary.samples} samples`}
              icon={TrendingUp}
            />
            <StatBox
              label="IQR"
              value={`${formatCurrency(summary.percentile_25)} – ${formatCurrency(summary.percentile_75)}`}
              subtext="25th – 75th percentile"
              icon={Ruler}
            />
          </div>

          {/* Distribution Bar */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-[oklch(0.15_0_0)] mb-2">Rent Distribution</h4>
            <RentDistributionBar
              min={summary.min}
              max={summary.max}
              percentile25={summary.percentile_25}
              median={summary.median}
              percentile75={summary.percentile_75}
              userRent={monthlyRent}
            />
          </div>

          {/* User Rent Comparison */}
          {rentComparison && (
            <div className={`rounded-xl p-4 border ${
              rentComparison.isBelow 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-center gap-3">
                {rentComparison.isBelow ? (
                  <ArrowDownRight className="w-6 h-6 text-emerald-600" />
                ) : (
                  <ArrowUpRight className="w-6 h-6 text-amber-600" />
                )}
                <div>
                  <p className="font-semibold text-[oklch(0.15_0_0)]">
                    Your rent of {formatCurrency(monthlyRent!)} is{' '}
                    <span className={rentComparison.isBelow ? 'text-emerald-600' : 'text-amber-600'}>
                      {formatCurrency(Math.abs(rentComparison.difference))}/mo {rentComparison.isBelow ? 'below' : 'above'} market median
                    </span>
                  </p>
                  <p className="text-sm text-[oklch(0.15_0_0)]/60 mt-0.5">
                    Positioned in the <strong>{rentComparison.position}</strong> of the market ({Math.abs(rentComparison.percentDiff)}% {rentComparison.isBelow ? 'savings' : 'premium'})
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Property Rents (if available) */}
      {propertyListings.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <button
            onClick={() => setShowPropertyRents(!showPropertyRents)}
            className="w-full p-4 flex items-center justify-between hover:bg-[oklch(0.15_0_0)]/3 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[oklch(0.55_0.14_75)]/10 flex items-center justify-center">
                <Building className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-[oklch(0.15_0_0)]">
                  Recent Listings at This Property ({propertyListings.length})
                </h4>
                <p className="text-xs text-[oklch(0.15_0_0)]/50">
                  {propertyRents?.average_update_days 
                    ? `New listings every ~${propertyRents.average_update_days} days`
                    : 'Recently listed rents at this address'}
                </p>
              </div>
            </div>
            {showPropertyRents ? (
              <ChevronUp className="w-5 h-5 text-[oklch(0.15_0_0)]/40" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[oklch(0.15_0_0)]/40" />
            )}
          </button>
          
          <AnimatePresence>
            {showPropertyRents && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[oklch(0.15_0_0)]/10">
                          <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">Beds</th>
                          <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">Baths</th>
                          <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">Rent</th>
                          <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">Sq Ft</th>
                          <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">$/Sq Ft</th>
                          <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">Last Seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {propertyListings.map((listing, idx) => (
                          <tr key={listing.id || idx} className="border-b border-[oklch(0.15_0_0)]/5 hover:bg-[oklch(0.15_0_0)]/3 transition-colors">
                            <td className="py-2.5 px-3 font-medium text-[oklch(0.15_0_0)]">{listing.bedrooms} BR</td>
                            <td className="py-2.5 px-3 text-[oklch(0.15_0_0)]/70">{listing.baths}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-[oklch(0.15_0_0)]">{formatCurrency(listing.price)}</td>
                            <td className="py-2.5 px-3 text-right text-[oklch(0.15_0_0)]/70">{listing.sqft > 0 ? listing.sqft.toLocaleString() : '—'}</td>
                            <td className="py-2.5 px-3 text-right text-[oklch(0.15_0_0)]/70">{listing.price_per_sqft > 0 ? `$${listing.price_per_sqft.toFixed(2)}` : '—'}</td>
                            <td className="py-2.5 px-3 text-right text-[oklch(0.15_0_0)]/50 text-xs">{formatDate(listing.last_seen)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Nearby Comps */}
      {nearbyCompsToShow.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 border-b border-[oklch(0.15_0_0)]/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[oklch(0.55_0.14_75)]/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
              </div>
              <div>
                <h4 className="font-semibold text-[oklch(0.15_0_0)]">
                  Nearby Rental Comps ({nearbyCompsToShow.length})
                </h4>
                <p className="text-xs text-[oklch(0.15_0_0)]/50">
                  Comparable {bedrooms}-bedroom rentals sorted by distance
                </p>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[oklch(0.15_0_0)]/10 bg-[oklch(0.15_0_0)]/3">
                  <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">Address</th>
                  <th className="text-center py-2.5 px-3 text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">Type</th>
                  <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">Rent</th>
                  <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">Sq Ft</th>
                  <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">$/Sq Ft</th>
                  <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">Distance</th>
                  <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-[oklch(0.15_0_0)]/50 font-medium">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {visibleComps.map((comp, idx) => {
                  const isAboveMedian = comp.price > summary.median;
                  return (
                    <tr key={idx} className="border-b border-[oklch(0.15_0_0)]/5 hover:bg-[oklch(0.15_0_0)]/3 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="max-w-[200px]">
                          <p className="text-[oklch(0.15_0_0)] font-medium truncate text-xs">{comp.address}</p>
                          <p className="text-[oklch(0.15_0_0)]/40 text-xs">{comp.bedrooms} BR · {comp.baths}</p>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[oklch(0.15_0_0)]/5 text-[oklch(0.15_0_0)]/60 capitalize">
                          {comp.property_type?.toLowerCase() || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`font-semibold ${isAboveMedian ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {formatCurrency(comp.price)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-[oklch(0.15_0_0)]/70 text-xs">
                        {comp.sqft > 0 && comp.sqft < 9999 ? comp.sqft.toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[oklch(0.15_0_0)]/70 text-xs">
                        {comp.dollar_sqft > 0 && comp.dollar_sqft < 50 ? `$${comp.dollar_sqft.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[oklch(0.15_0_0)]/60 text-xs">
                        {comp.distance.toFixed(2)} mi
                      </td>
                      <td className="py-2.5 px-3 text-right text-[oklch(0.15_0_0)]/40 text-xs">
                        {formatDate(comp.last_seen)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {nearbyCompsToShow.length > 8 && (
            <div className="p-3 text-center border-t border-[oklch(0.15_0_0)]/10">
              <button
                onClick={() => setShowAllComps(!showAllComps)}
                className="text-sm text-[oklch(0.55_0.14_75)] hover:underline font-medium inline-flex items-center gap-1"
              >
                {showAllComps ? (
                  <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
                ) : (
                  <>Show All {nearbyCompsToShow.length} Comps <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Arbitrage Insight (if user rent is provided) */}
      {monthlyRent && summary.median > 0 && (
        <div className="bg-gradient-to-br from-[oklch(0.15_0_0)] to-[oklch(0.25_0.02_265)] rounded-2xl shadow-lg p-6 text-white">
          <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
            Arbitrage Insight
          </h4>
          <p className="text-white/80 text-sm leading-relaxed">
            {rentComparison?.isBelow ? (
              <>
                At {formatCurrency(monthlyRent)}/mo, your lease cost is <strong className="text-emerald-400">{formatCurrency(Math.abs(rentComparison.difference))}/mo below</strong> the 
                market median of {formatCurrency(summary.median)}. This positions you in the <strong>{rentComparison.position}</strong> of the rental market, 
                giving you a <strong>favorable cost basis</strong> for short-term rental arbitrage. The lower your lease cost relative to market, 
                the wider your profit margin potential.
              </>
            ) : (
              <>
                At {formatCurrency(monthlyRent)}/mo, your lease cost is <strong className="text-amber-400">{formatCurrency(Math.abs(rentComparison?.difference || 0))}/mo above</strong> the 
                market median of {formatCurrency(summary.median)}. While this is in the <strong>{rentComparison?.position}</strong> of the rental market, 
                the short-term rental revenue potential may still make this viable. Focus on maximizing occupancy and nightly rates to offset the higher base cost.
              </>
            )}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-white/50 uppercase tracking-wider">Your Rent</p>
              <p className="text-lg font-bold">{formatCurrency(monthlyRent)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-white/50 uppercase tracking-wider">Market Median</p>
              <p className="text-lg font-bold">{formatCurrency(summary.median)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-white/50 uppercase tracking-wider">Annual Cost</p>
              <p className="text-lg font-bold">{formatCurrency(monthlyRent * 12)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Data Source Attribution */}
      <div className="text-center text-xs text-[oklch(0.15_0_0)]/30 py-2">
        Powered by Coach Inayah market data · {summary.samples} listings within {summary.radius_miles} miles · Updated within last {Math.round(summary.look_back_days / 30)} months
      </div>
    </div>
  );
}
