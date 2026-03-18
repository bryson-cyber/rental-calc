/**
 * ExplorePage — Public Explore Area Tool
 *
 * This is just the Explore Area tool (tool #2 from the home page)
 * exposed as a standalone public page at /explore.
 *
 * - Search for a market (city, neighborhood, zip code)
 * - Browse rental property listings with revenue data
 * - Filter by bedrooms, sort by revenue/occupancy/adr/rating
 *
 * No login required. TOS acceptance required before interaction.
 * No upsells, no CTAs, no "Get Access" buttons.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Search,
  MapPin,
  TrendingUp,
  DollarSign,
  Star,
  BedDouble,
  Loader2,
  ExternalLink,
  BarChart3,
  ArrowUpDown,
  X,
  Home,
  Calendar,
} from 'lucide-react';
import { TermsAcceptanceModal, hasTosBeenAccepted } from '@/components/TermsAcceptanceModal';
import { trpc } from '@/lib/trpc';

// Format helpers
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonthLabel(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 2) return dateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(parts[1], 10) - 1;
  return monthNames[monthIdx] || dateStr;
}

// Types
interface MarketResult {
  id: string;
  name: string;
  type: string;
  listingCount: number;
  state: string;
  country: string;
}

interface Listing {
  id: string;
  title: string;
  imageUrl: string | null;
  images: string[];
  airbnbUrl: string | null;
  bedrooms: number;
  bathrooms: number;
  annualRevenue: number;
  occupancyRate: number;
  adr: number;
  rating: number;
  reviewCount: number;
  superhost: boolean;
}

interface Summary {
  avgRevenue: number;
  avgOccupancy: number;
  avgAdr: number;
  topRevenue: number;
}

interface EstimateResult {
  success: boolean;
  error?: string;
  property?: {
    address: string;
    bedrooms?: number;
    bathrooms?: number;
  };
  estimates?: {
    annualRevenue: number;
    annualRevenueLow: number;
    annualRevenueHigh: number;
    averageDailyRate: number;
    occupancyRate: number;
  };
  monthlyForecast?: Array<{
    month: string;
    revenue: number;
    adr: number;
    occupancy: number;
  }>;
}

type SortOption = 'revenue' | 'occupancy' | 'adr' | 'rating';

// Cookie key for tracking deep analysis usage
const DEEP_ANALYSIS_COOKIE = 'explore_deep_used';

function hasUsedDeepAnalysis(): boolean {
  try {
    return localStorage.getItem(DEEP_ANALYSIS_COOKIE) === 'true';
  } catch {
    return false;
  }
}

function markDeepAnalysisUsed(): void {
  try {
    localStorage.setItem(DEEP_ANALYSIS_COOKIE, 'true');
  } catch {}
}

export default function ExplorePage() {
  // TOS state
  const [showTos, setShowTos] = useState(!hasTosBeenAccepted());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MarketResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<MarketResult | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Listings state
  const [listings, setListings] = useState<Listing[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingListings, setLoadingListings] = useState(false);

  // Filters
  const [bedroomFilter, setBedroomFilter] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortOption>('revenue');

  // Analysis state
  const [deepAnalysisUsed, setDeepAnalysisUsed] = useState(hasUsedDeepAnalysis());
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [estimateResult, setEstimateResult] = useState<EstimateResult | null>(null);
  const [showEstimateModal, setShowEstimateModal] = useState(false);

  // Search markets query
  const searchMarketsQuery = trpc.publicExplore.searchMarkets.useQuery(
    { query: searchQuery },
    {
      enabled: searchQuery.length >= 2,
      staleTime: 30000,
    }
  );

  // Update search results when query returns
  useEffect(() => {
    if (searchMarketsQuery.data) {
      setSearchResults(searchMarketsQuery.data);
      setShowDropdown(true);
    }
  }, [searchMarketsQuery.data]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch listings when market is selected or filters change
  const fetchListings = useCallback(
    async (market: MarketResult, beds?: number, sort: SortOption = 'revenue') => {
      setLoadingListings(true);
      try {
        const result = await fetch(
          `/api/trpc/publicExplore.getListings?input=${encodeURIComponent(
            JSON.stringify({
              json: {
                marketId: market.id,
                marketType: market.type === 'submarket' ? 'submarket' : 'market',
                bedrooms: beds,
                sortBy: sort,
              },
            })
          )}`
        );
        const json = await result.json();
        const data = json?.result?.data?.json;
        if (data) {
          setListings(data.listings || []);
          setSummary(data.summary || null);
          setTotalCount(data.totalCount || 0);
        }
      } catch (err) {
        console.error('[ExplorePage] Failed to fetch listings:', err);
      } finally {
        setLoadingListings(false);
      }
    },
    []
  );

  const handleSelectMarket = useCallback(
    (market: MarketResult) => {
      setSelectedMarket(market);
      setSearchQuery(market.name);
      setShowDropdown(false);
      setBedroomFilter(undefined);
      setSortBy('revenue');
      fetchListings(market);
    },
    [fetchListings]
  );

  const handleBedroomChange = useCallback(
    (beds: number | undefined) => {
      setBedroomFilter(beds);
      if (selectedMarket) {
        fetchListings(selectedMarket, beds, sortBy);
      }
    },
    [selectedMarket, sortBy, fetchListings]
  );

  const handleSortChange = useCallback(
    (sort: SortOption) => {
      setSortBy(sort);
      if (selectedMarket) {
        fetchListings(selectedMarket, bedroomFilter, sort);
      }
    },
    [selectedMarket, bedroomFilter, fetchListings]
  );

  // Deep analysis
  const handleAnalyze = useCallback(
    async (listing: Listing) => {
      if (deepAnalysisUsed) return;
      setAnalyzingId(listing.id);
      try {
        const address = listing.title || `Property ${listing.id}`;
        const result = await fetch(
          `/api/trpc/publicExplore.getEstimate?input=${encodeURIComponent(
            JSON.stringify({
              json: {
                address,
                bedrooms: listing.bedrooms,
                bathrooms: listing.bathrooms,
              },
            })
          )}`
        );
        const json = await result.json();
        const data = json?.result?.data?.json;
        if (data && data.success) {
          setEstimateResult(data);
          setShowEstimateModal(true);
          markDeepAnalysisUsed();
          setDeepAnalysisUsed(true);
        } else {
          alert(data?.error || 'Unable to generate estimate for this property.');
        }
      } catch (err) {
        console.error('[ExplorePage] Analysis failed:', err);
        alert('Something went wrong. Please try again.');
      } finally {
        setAnalyzingId(null);
      }
    },
    [deepAnalysisUsed]
  );

  // TOS gate
  if (showTos) {
    return (
      <TermsAcceptanceModal
        isOpen={true}
        onAccept={() => setShowTos(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.005_265)] to-[oklch(0.95_0.01_265)]">
      {/* Header — simple branding only, no CTAs */}
      <header className="bg-white/80 backdrop-blur-md border-b border-[oklch(0.90_0_0)] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[oklch(0.55_0.14_75)] to-[oklch(0.45_0.14_75)] flex items-center justify-center">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[oklch(0.20_0.02_265)]">
              Explore Area
            </h1>
            <p className="text-xs text-[oklch(0.50_0_0)]">
              by Coach Inayah
            </p>
          </div>
        </div>
      </header>

      {/* Search Section */}
      <section className="max-w-6xl mx-auto px-4 pt-8 pb-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-[oklch(0.20_0.02_265)] mb-2">
            See What Properties Are Earning
          </h2>
          <p className="text-[oklch(0.45_0_0)] max-w-lg mx-auto">
            Search any city, neighborhood, or zip code to see real revenue data
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[oklch(0.55_0.14_75)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length >= 2) {
                  setShowDropdown(true);
                } else {
                  setShowDropdown(false);
                }
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              placeholder="Search city, neighborhood, or zip code..."
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-[oklch(0.88_0_0)] rounded-2xl text-base focus:ring-2 focus:ring-[oklch(0.55_0.14_75)]/30 focus:border-[oklch(0.55_0.14_75)] outline-none transition-all shadow-sm"
            />
            {searchMarketsQuery.isLoading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-[oklch(0.55_0.14_75)]" />
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-xl border border-[oklch(0.90_0_0)] z-50 max-h-72 overflow-y-auto">
              {searchResults.map((market) => (
                <button
                  key={`${market.type}-${market.id}`}
                  onClick={() => handleSelectMarket(market)}
                  className="w-full text-left px-4 py-3 hover:bg-[oklch(0.97_0.005_75)] transition-colors flex items-center gap-3 border-b border-[oklch(0.95_0_0)] last:border-0"
                >
                  <MapPin className="w-4 h-4 text-[oklch(0.55_0.14_75)] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-[oklch(0.25_0_0)] truncate">
                      {market.name}
                    </p>
                    <p className="text-xs text-[oklch(0.55_0_0)]">
                      {market.type === 'submarket' ? 'Neighborhood' : 'Market'} · {market.listingCount?.toLocaleString() || '—'} listings
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Results Section */}
      {selectedMarket && (
        <section className="max-w-6xl mx-auto px-4 pb-12">
          {/* Market Header */}
          <div className="bg-white rounded-2xl border border-[oklch(0.90_0_0)] p-6 mb-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[oklch(0.20_0.02_265)]">
                  {selectedMarket.name}
                </h3>
                <p className="text-sm text-[oklch(0.50_0_0)] mt-1">
                  {totalCount.toLocaleString()} active listings · Sorted by {sortBy}
                </p>
              </div>

              {/* Summary Stats */}
              {summary && (
                <div className="flex gap-4 flex-wrap">
                  <div className="bg-[oklch(0.97_0.005_145)] rounded-xl px-4 py-2 text-center">
                    <p className="text-xs text-[oklch(0.45_0.1_145)] font-medium">Avg Revenue</p>
                    <p className="text-lg font-bold text-[oklch(0.35_0.1_145)]">
                      {formatCurrency(summary.avgRevenue)}
                    </p>
                  </div>
                  <div className="bg-[oklch(0.97_0.005_265)] rounded-xl px-4 py-2 text-center">
                    <p className="text-xs text-[oklch(0.45_0.08_265)] font-medium">Avg Occupancy</p>
                    <p className="text-lg font-bold text-[oklch(0.35_0.08_265)]">
                      {Math.round(summary.avgOccupancy)}%
                    </p>
                  </div>
                  <div className="bg-[oklch(0.97_0.005_75)] rounded-xl px-4 py-2 text-center">
                    <p className="text-xs text-[oklch(0.45_0.1_75)] font-medium">Avg Nightly</p>
                    <p className="text-lg font-bold text-[oklch(0.35_0.1_75)]">
                      {formatCurrency(summary.avgAdr)}
                    </p>
                  </div>
                  <div className="bg-[oklch(0.97_0.01_30)] rounded-xl px-4 py-2 text-center">
                    <p className="text-xs text-[oklch(0.45_0.1_30)] font-medium">Top Earner</p>
                    <p className="text-lg font-bold text-[oklch(0.35_0.1_30)]">
                      {formatCurrency(summary.topRevenue)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-[oklch(0.93_0_0)]">
              {/* Bedroom Filter */}
              <div className="flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-[oklch(0.50_0_0)]" />
                <select
                  value={bedroomFilter ?? ''}
                  onChange={(e) =>
                    handleBedroomChange(
                      e.target.value === '' ? undefined : parseInt(e.target.value)
                    )
                  }
                  className="text-sm border border-[oklch(0.88_0_0)] rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-[oklch(0.55_0.14_75)]/30 focus:border-[oklch(0.55_0.14_75)] outline-none"
                >
                  <option value="">All Bedrooms</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} BR
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-[oklch(0.50_0_0)]" />
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value as SortOption)}
                  className="text-sm border border-[oklch(0.88_0_0)] rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-[oklch(0.55_0.14_75)]/30 focus:border-[oklch(0.55_0.14_75)] outline-none"
                >
                  <option value="revenue">Revenue (High → Low)</option>
                  <option value="occupancy">Occupancy (High → Low)</option>
                  <option value="adr">Nightly Rate (High → Low)</option>
                  <option value="rating">Rating (High → Low)</option>
                </select>
              </div>

              {/* Deep analysis badge */}
              <div className="ml-auto flex items-center gap-2 text-xs">
                {deepAnalysisUsed ? (
                  <span className="flex items-center gap-1 text-[oklch(0.50_0_0)] bg-[oklch(0.95_0_0)] px-3 py-1.5 rounded-full">
                    Free analysis used
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[oklch(0.40_0.12_145)] bg-[oklch(0.95_0.02_145)] px-3 py-1.5 rounded-full font-medium">
                    <BarChart3 className="w-3 h-3" />
                    1 free deep analysis available
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Loading */}
          {loadingListings && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[oklch(0.55_0.14_75)]" />
                <p className="text-sm text-[oklch(0.50_0_0)]">Loading properties...</p>
              </div>
            </div>
          )}

          {/* Listings Grid */}
          {!loadingListings && listings.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onAnalyze={handleAnalyze}
                  deepAnalysisUsed={deepAnalysisUsed}
                  isAnalyzing={analyzingId === listing.id}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loadingListings && listings.length === 0 && selectedMarket && (
            <div className="text-center py-16">
              <MapPin className="w-12 h-12 text-[oklch(0.75_0_0)] mx-auto mb-3" />
              <p className="text-[oklch(0.45_0_0)]">
                No listings found for this market with the selected filters.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Empty state before search */}
      {!selectedMarket && (
        <section className="max-w-6xl mx-auto px-4 py-16 text-center">
          <div className="bg-white rounded-2xl border border-[oklch(0.92_0_0)] p-12 shadow-sm">
            <Search className="w-16 h-16 text-[oklch(0.80_0_0)] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[oklch(0.30_0_0)] mb-2">
              Search a Market to Get Started
            </h3>
            <p className="text-[oklch(0.50_0_0)] max-w-md mx-auto">
              Enter any city, neighborhood, or zip code above to see active rental listings and their revenue data.
            </p>
          </div>
        </section>
      )}

      {/* Estimate Modal */}
      {showEstimateModal && estimateResult && estimateResult.success && (
        <EstimateModal
          result={estimateResult}
          onClose={() => setShowEstimateModal(false)}
        />
      )}

      {/* Footer — minimal, no CTAs */}
      <footer className="border-t border-[oklch(0.92_0_0)] py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-xs text-[oklch(0.60_0_0)]">
            Estimates are for informational purposes only
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Listing Card Component ────────────────────────────────────────────────

function ListingCard({
  listing,
  onAnalyze,
  deepAnalysisUsed,
  isAnalyzing,
}: {
  listing: Listing;
  onAnalyze: (listing: Listing) => void;
  deepAnalysisUsed: boolean;
  isAnalyzing: boolean;
}) {
  const imgSrc = listing.imageUrl || listing.images?.[0] || null;
  // AirDNA occupancy is already in percentage form (e.g. 65.37 = 65.37%)
  const occupancyPct = Math.round(listing.occupancyRate || 0);
  const dailyEarnings = listing.adr * ((listing.occupancyRate || 0) / 100);

  return (
    <div className="bg-white rounded-xl border border-[oklch(0.92_0_0)] overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
      {/* Image */}
      <div className="relative h-44 bg-[oklch(0.95_0_0)]">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={listing.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="w-10 h-10 text-[oklch(0.80_0_0)]" />
          </div>
        )}
        {/* Revenue badge */}
        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-lg">
          {formatCurrency(listing.annualRevenue)}/yr
        </div>
        {listing.superhost && (
          <div className="absolute top-3 right-3 bg-[oklch(0.55_0.14_75)]/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
            SUPERHOST
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h4 className="font-semibold text-[oklch(0.25_0_0)] text-sm truncate mb-2">
          {listing.title}
        </h4>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-[oklch(0.97_0_0)] rounded-lg px-2.5 py-1.5">
            <p className="text-[10px] text-[oklch(0.55_0_0)] uppercase tracking-wider">Nightly</p>
            <p className="text-sm font-bold text-[oklch(0.30_0_0)]">{formatCurrency(listing.adr)}</p>
          </div>
          <div className="bg-[oklch(0.97_0_0)] rounded-lg px-2.5 py-1.5">
            <p className="text-[10px] text-[oklch(0.55_0_0)] uppercase tracking-wider">Occupancy</p>
            <p className="text-sm font-bold text-[oklch(0.30_0_0)]">{occupancyPct}%</p>
          </div>
          <div className="bg-[oklch(0.97_0_0)] rounded-lg px-2.5 py-1.5">
            <p className="text-[10px] text-[oklch(0.55_0_0)] uppercase tracking-wider">Daily Earn</p>
            <p className="text-sm font-bold text-[oklch(0.30_0_0)]">{formatCurrency(Math.round(dailyEarnings))}</p>
          </div>
          <div className="bg-[oklch(0.97_0_0)] rounded-lg px-2.5 py-1.5">
            <p className="text-[10px] text-[oklch(0.55_0_0)] uppercase tracking-wider">Rating</p>
            <p className="text-sm font-bold text-[oklch(0.30_0_0)] flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              {listing.rating?.toFixed(1) || '—'} <span className="text-[10px] font-normal text-[oklch(0.55_0_0)]">({listing.reviewCount})</span>
            </p>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-[oklch(0.50_0_0)] mb-3">
          <span className="flex items-center gap-1">
            <BedDouble className="w-3 h-3" />
            {listing.bedrooms} BR
          </span>
          <span>{listing.bathrooms} BA</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {listing.airbnbUrl && (
            <a
              href={listing.airbnbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-[oklch(0.45_0_0)] border border-[oklch(0.88_0_0)] rounded-lg py-2 hover:bg-[oklch(0.97_0_0)] transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View Listing
            </a>
          )}
          {!deepAnalysisUsed && (
            <button
              onClick={() => onAnalyze(listing)}
              disabled={isAnalyzing}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg py-2 transition-all bg-gradient-to-r from-[oklch(0.50_0.15_300)] to-[oklch(0.45_0.15_280)] text-white hover:opacity-90 shadow-sm"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <BarChart3 className="w-3 h-3" />
                  Analyze
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Estimate Modal Component ──────────────────────────────────────────────

function EstimateModal({
  result,
  onClose,
}: {
  result: EstimateResult;
  onClose: () => void;
}) {
  if (!result.estimates || !result.property) return null;

  const { estimates, property, monthlyForecast } = result;
  const maxForecastRevenue = monthlyForecast
    ? Math.max(...monthlyForecast.map((m) => m.revenue))
    : 0;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[oklch(0.35_0.12_145)] to-[oklch(0.40_0.10_165)] px-6 py-5 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Revenue Estimate</h3>
              <p className="text-white/70 text-sm truncate max-w-[280px]">
                {property.address}
              </p>
            </div>
          </div>
        </div>

        {/* Revenue Stats */}
        <div className="px-6 py-5">
          <div className="text-center mb-5">
            <p className="text-xs text-[oklch(0.50_0_0)] uppercase tracking-wider mb-1">
              Estimated Annual Revenue
            </p>
            <p className="text-4xl font-bold text-[oklch(0.35_0.12_145)]">
              {formatCurrency(estimates.annualRevenue)}
            </p>
            <p className="text-sm text-[oklch(0.50_0_0)] mt-1">
              Range: {formatCurrency(estimates.annualRevenueLow)} – {formatCurrency(estimates.annualRevenueHigh)}
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-[oklch(0.97_0.005_75)] rounded-xl p-3 text-center">
              <DollarSign className="w-4 h-4 text-[oklch(0.55_0.14_75)] mx-auto mb-1" />
              <p className="text-lg font-bold text-[oklch(0.30_0_0)]">
                {formatCurrency(estimates.averageDailyRate)}
              </p>
              <p className="text-[10px] text-[oklch(0.50_0_0)]">Avg Nightly</p>
            </div>
            <div className="bg-[oklch(0.97_0.005_265)] rounded-xl p-3 text-center">
              <Calendar className="w-4 h-4 text-[oklch(0.45_0.08_265)] mx-auto mb-1" />
              <p className="text-lg font-bold text-[oklch(0.30_0_0)]">
                {Math.round(estimates.occupancyRate)}%
              </p>
              <p className="text-[10px] text-[oklch(0.50_0_0)]">Occupancy</p>
            </div>
            <div className="bg-[oklch(0.97_0.005_145)] rounded-xl p-3 text-center">
              <TrendingUp className="w-4 h-4 text-[oklch(0.45_0.1_145)] mx-auto mb-1" />
              <p className="text-lg font-bold text-[oklch(0.30_0_0)]">
                {formatCurrency(Math.round(estimates.annualRevenue / 12))}
              </p>
              <p className="text-[10px] text-[oklch(0.50_0_0)]">Monthly Avg</p>
            </div>
          </div>

          {/* Monthly Forecast */}
          {monthlyForecast && monthlyForecast.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-[oklch(0.30_0_0)] mb-3">
                Monthly Revenue Forecast
              </h4>
              <div className="flex items-end gap-1 h-28">
                {monthlyForecast.map((m, i) => {
                  const height = maxForecastRevenue > 0 ? (m.revenue / maxForecastRevenue) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[8px] text-[oklch(0.50_0_0)] font-medium">
                        {formatCurrency(m.revenue)}
                      </span>
                      <div
                        className="w-full bg-gradient-to-t from-[oklch(0.55_0.14_75)] to-[oklch(0.65_0.12_75)] rounded-t-sm"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-[8px] text-[oklch(0.55_0_0)]">
                        {formatMonthLabel(m.month)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
