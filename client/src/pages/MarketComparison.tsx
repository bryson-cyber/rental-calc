/**
 * Market Comparison Page
 * Compare 2-3 markets side-by-side to help investors decide where to invest
 */

import { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Building,
  DollarSign,
  Percent,
  BarChart3,
  Star,
  Users,
  Home,
  X,
  Plus,
  ChevronRight,
  Trophy,
  Target,
  Lightbulb,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { Link } from 'wouter';
import { useSaveSearch } from '@/components/SavedSearches';
import { SubmarketExplorer } from '@/components/SubmarketExplorer';
import { Bookmark, BookmarkCheck, MapPinned } from 'lucide-react';
import { toast } from 'sonner';
import { useReportMode } from '@/contexts/ReportModeContext';

interface MarketSearchResult {
  id: string;
  name: string;
  type: 'market' | 'submarket';
  listing_count: number;
  parent_market?: string;
}

interface MarketData {
  id: string;
  name: string;
  type: 'market' | 'submarket';
  metrics: {
    occupancy: number;
    adr: number;
    revenue: number;
    revpar: number;
    active_listings: number;
    market_score?: number;
  };
  insights?: {
    professionally_managed_pct: number;
    superhost_pct: number;
    avg_rating: number;
  };
  bedroom_performance?: Array<{
    bedrooms: number;
    revenue: number;
    adr: number;
    occupancy: number;
  }>;
  property_types?: Array<{
    type: string;
    count: number;
    pct: number;
    avg_revenue: number;
  }>;
}

export default function MarketComparison() {
  const { mode: reportMode } = useReportMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MarketSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMarkets, setSelectedMarkets] = useState<MarketData[]>([]);
  const [loadingMarket, setLoadingMarket] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [savedMarketIds, setSavedMarketIds] = useState<Set<string>>(new Set());
  const { saveMarket, isSaving } = useSaveSearch();

  // tRPC queries
  const marketReportMutation = trpc.rental.getSubmarketReport.useMutation();

  // Debounced search using fetch
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/trpc/rental.searchMarkets?input=${encodeURIComponent(JSON.stringify({ json: { searchTerm: searchQuery, limit: 10 } }))}`);
        const data = await response.json();
        const results = data?.result?.data?.json?.data || [];
        // Transform results to match our interface
        const markets: MarketSearchResult[] = results.map((r: any) => ({
          id: r.market_id || r.id || String(Math.random()),
          name: r.name || r.market_name || searchQuery,
          type: r.search_type === 'market' ? 'market' : 'submarket',
          listing_count: r.listing_count || 0,
          parent_market: r.parent_market
        }));
        setSearchResults(markets);
        setShowDropdown(true);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addMarket = async (market: MarketSearchResult) => {
    console.log('[addMarket] Called with:', market.name, market.id);
    // Prevent race conditions - don't add if already loading
    if (loadingMarket !== null) {
      console.log('[addMarket] Already loading, skipping');
      return;
    }
    
    if (selectedMarkets.length >= 3) {
      return; // Max 3 markets
    }
    
    if (selectedMarkets.find(m => m.name === market.name)) {
      return; // Already added
    }

    console.log('[addMarket] Starting for:', market.name, market.id);
    setLoadingMarket(market.id);
    setShowDropdown(false);
    setSearchQuery('');

    try {
      console.log('[addMarket] Calling mutation...');
      const report = await marketReportMutation.mutateAsync({
        submarketId: market.id,
        reportMode,
      });

      if (!report.success || !report.data) {
        // Show user-friendly error for markets that can't be found
        console.error('Market not found:', market.id, market.name, report.error);
        // Use the server's error message if available, otherwise show a generic message
        const errorMessage = report.error || `Unable to load data for "${market.name}". This market may not have sufficient data available. Please try a different market.`;
        alert(errorMessage);
        return;
      }
      
      // Check if the market has any listings
      if (report.data.submarket?.listing_count === 0 || report.data.submarket?.metrics?.active_listings === 0) {
        alert(`"${market.name}" shows 0 active rentals. This market may not have sufficient data. Please try a different market.`);
        return;
      }

      const reportData = report.data;
      const bedroomPerf = reportData.bedroom_performance?.map(bp => ({
        bedrooms: bp.bedrooms,
        revenue: bp.avg_revenue || 0,
        adr: bp.avg_adr || 0,
        occupancy: bp.avg_occupancy || 0
      }));
      
      const marketData: MarketData = {
        id: market.id,
        name: market.name,
        type: market.type,
        metrics: {
          occupancy: reportData.submarket?.metrics?.occupancy || 0,
          adr: reportData.submarket?.metrics?.adr || 0,
          revenue: reportData.submarket?.metrics?.revenue || 0,
          revpar: reportData.submarket?.metrics?.revpar || 0,
          active_listings: reportData.submarket?.listing_count || 0,
          market_score: reportData.submarket?.metrics?.market_score
        },
        insights: reportData.insights,
        bedroom_performance: bedroomPerf
      };

      // Double-check for duplicates before adding (race condition protection)
      setSelectedMarkets(prev => {
        if (prev.find(m => m.name === marketData.name)) {
          return prev; // Already exists, don't add
        }
        return [...prev, marketData];
      });
    } catch (error) {
      console.error('Error loading market:', error);
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while loading market data.';
      alert(`Error loading "${market.name}": ${errorMessage}`);
    } finally {
      setLoadingMarket(null);
    }
  };

  const removeMarket = (marketId: string) => {
    setSelectedMarkets(prev => prev.filter(m => m.id !== marketId));
  };

  const getWinner = (metric: keyof MarketData['metrics']) => {
    if (selectedMarkets.length < 2) return null;
    
    let best = selectedMarkets[0];
    for (const market of selectedMarkets) {
      const value = market.metrics[metric] || 0;
      const bestValue = best.metrics[metric] || 0;
      if (value > bestValue) {
        best = market;
      }
    }
    return best.id;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => {
    // If value is greater than 1, it's already a percentage (e.g., 68 means 68%)
    // If value is less than or equal to 1, it's a decimal (e.g., 0.68 means 68%)
    const pct = value > 1 ? value : value * 100;
    return `${Math.round(pct)}%`;
  };

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Header */}
      <div className="bg-[#0F172A] text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Link href="/market" className="inline-flex items-center gap-2 text-[#C9A962] hover:text-[#C9A962]/80 mb-4 font-sans text-sm">
              ← Back to Market Research
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#C9A962]/20 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[#C9A962]" />
            </div>
            <span className="text-[#C9A962] text-sm font-sans tracking-wider">MARKET COMPARISON</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-semibold mb-2">
            Compare Markets Side-by-Side
          </h1>
          <p className="text-white/60 font-sans">
            Add up to 3 markets to compare key metrics and find the best investment opportunity
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Search Section */}
        <div className="bg-white rounded-xl shadow-sm border border-[#0F172A]/10 p-6 mb-8">
          <h2 className="text-lg font-serif font-semibold text-[#0F172A] mb-4">
            Add Markets to Compare
          </h2>
          
          <div className="relative">
            <div className="flex items-center gap-2 bg-[#f8f7f4] rounded-lg px-4 py-3 border border-[#0F172A]/10 focus-within:border-[#C9A962] transition-colors">
              <Search className="w-5 h-5 text-[#0F172A]/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a city or zip code..."
                className="flex-1 bg-transparent outline-none text-[#0F172A] placeholder:text-[#0F172A]/60 font-sans"
                disabled={selectedMarkets.length >= 3}
              />
              {isSearching && <Loader2 className="w-5 h-5 text-[#C9A962] animate-spin" />}
            </div>

            {/* Search Results Dropdown */}
            <AnimatePresence>
              {showDropdown && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-[#0F172A]/10 max-h-64 overflow-y-auto z-50"
                >
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('[SearchResult] Clicked:', result.name, result.id);
                        // Call addMarket directly without any checks first
                        addMarket(result);
                      }}
                      disabled={selectedMarkets.find(m => m.name === result.name) !== undefined || loadingMarket !== null}
                      className="w-full px-4 py-3 text-left hover:bg-[#f8f7f4] transition-colors border-b border-[#0F172A]/5 last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-[#0F172A] font-sans">{result.name}</div>
                          <div className="text-sm text-[#0F172A]/60 font-sans">
                            {result.type === 'market' ? 'Market' : 'Neighborhood'} • {result.listing_count.toLocaleString()} listings
                          </div>
                        </div>
                        <Plus className="w-5 h-5 text-[#C9A962]" />
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Selected Markets Pills */}
          {selectedMarkets.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {selectedMarkets.map((market, index) => (
                <div
                  key={market.id}
                  className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-3 py-2 rounded-lg font-sans text-sm"
                >
                  <span className="w-5 h-5 bg-[#C9A962] rounded-full flex items-center justify-center text-[#0F172A] text-xs font-bold">
                    {index + 1}
                  </span>
                  {market.name}
                  <button
                    onClick={() => {
                      if (savedMarketIds.has(market.id)) {
                        toast.info('Market already saved');
                        return;
                      }
                      saveMarket({
                        marketId: market.id,
                        marketName: market.name,
                        cachedRevenue: market.metrics.revenue,
                        cachedOccupancy: market.metrics.occupancy,
                        cachedAdr: market.metrics.adr,
                      });
                      setSavedMarketIds(prev => new Set(Array.from(prev).concat(market.id)));
                    }}
                    className="hover:text-[#C9A962] transition-colors"
                    title="Save this market"
                    disabled={isSaving}
                  >
                    {savedMarketIds.has(market.id) ? (
                      <BookmarkCheck className="w-4 h-4 text-[#C9A962]" />
                    ) : (
                      <Bookmark className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => removeMarket(market.id)}
                    className="hover:text-red-400 transition-colors"
                    title="Remove from comparison"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {loadingMarket && (
                <div className="inline-flex items-center gap-2 bg-[#0F172A]/50 text-white px-3 py-2 rounded-lg font-sans text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              )}
            </div>
          )}

          {selectedMarkets.length < 2 && (
            <p className="text-sm text-[#0F172A]/60 mt-4 font-sans">
              Add at least 2 markets to start comparing
            </p>
          )}
        </div>

        {/* Comparison Table */}
        {selectedMarkets.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Key Metrics Comparison */}
            <div className="bg-white rounded-xl shadow-sm border border-[#0F172A]/10 overflow-hidden">
              <div className="bg-[#0F172A] text-white px-6 py-4">
                <h3 className="text-lg font-serif font-semibold">Key Metrics Comparison</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#f8f7f4]">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0F172A] font-sans">Metric</th>
                      {selectedMarkets.map((market, index) => (
                        <th key={market.id} className="px-6 py-4 text-center text-sm font-semibold text-[#0F172A] font-sans">
                          <div className="flex items-center justify-center gap-2">
                            <span className="w-6 h-6 bg-[#C9A962] rounded-full flex items-center justify-center text-[#0F172A] text-xs font-bold">
                              {index + 1}
                            </span>
                            {market.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0F172A]/10">
                    {/* Market Score */}
                    <tr>
                      <td className="px-6 py-4 text-sm text-[#0F172A] font-sans">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-[#C9A962]" />
                          Market Score
                        </div>
                      </td>
                      {selectedMarkets.map((market) => {
                        const isWinner = getWinner('market_score') === market.id;
                        return (
                          <td key={market.id} className="px-6 py-4 text-center">
                            <div className={`text-lg font-semibold font-sans ${isWinner ? 'text-green-600' : 'text-[#0F172A]'}`}>
                              {market.metrics.market_score ? `${Math.round(market.metrics.market_score)}/100` : 'N/A'}
                              {isWinner && <Trophy className="w-4 h-4 inline ml-1 text-[#C9A962]" />}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    
                    {/* Average Revenue */}
                    <tr className="bg-[#f8f7f4]/50">
                      <td className="px-6 py-4 text-sm text-[#0F172A] font-sans">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-[#C9A962]" />
                          Avg. Annual Revenue
                        </div>
                      </td>
                      {selectedMarkets.map((market) => {
                        const isWinner = getWinner('revenue') === market.id;
                        return (
                          <td key={market.id} className="px-6 py-4 text-center">
                            <div className={`text-lg font-semibold font-sans ${isWinner ? 'text-green-600' : 'text-[#0F172A]'}`}>
                              {formatCurrency(market.metrics.revenue)}
                              {isWinner && <Trophy className="w-4 h-4 inline ml-1 text-[#C9A962]" />}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    
                    {/* Occupancy */}
                    <tr>
                      <td className="px-6 py-4 text-sm text-[#0F172A] font-sans">
                        <div className="flex items-center gap-2">
                          <Percent className="w-4 h-4 text-[#C9A962]" />
                          Occupancy Rate
                        </div>
                      </td>
                      {selectedMarkets.map((market) => {
                        const isWinner = getWinner('occupancy') === market.id;
                        return (
                          <td key={market.id} className="px-6 py-4 text-center">
                            <div className={`text-lg font-semibold font-sans ${isWinner ? 'text-green-600' : 'text-[#0F172A]'}`}>
                              {formatPercent(market.metrics.occupancy)}
                              {isWinner && <Trophy className="w-4 h-4 inline ml-1 text-[#C9A962]" />}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    
                    {/* ADR */}
                    <tr className="bg-[#f8f7f4]/50">
                      <td className="px-6 py-4 text-sm text-[#0F172A] font-sans">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-[#C9A962]" />
                          Avg. Daily Rate
                        </div>
                      </td>
                      {selectedMarkets.map((market) => {
                        const isWinner = getWinner('adr') === market.id;
                        return (
                          <td key={market.id} className="px-6 py-4 text-center">
                            <div className={`text-lg font-semibold font-sans ${isWinner ? 'text-green-600' : 'text-[#0F172A]'}`}>
                              {formatCurrency(market.metrics.adr)}
                              {isWinner && <Trophy className="w-4 h-4 inline ml-1 text-[#C9A962]" />}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    
                    {/* RevPAR */}
                    <tr>
                      <td className="px-6 py-4 text-sm text-[#0F172A] font-sans">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-[#C9A962]" />
                          RevPAR
                        </div>
                      </td>
                      {selectedMarkets.map((market) => {
                        const isWinner = getWinner('revpar') === market.id;
                        return (
                          <td key={market.id} className="px-6 py-4 text-center">
                            <div className={`text-lg font-semibold font-sans ${isWinner ? 'text-green-600' : 'text-[#0F172A]'}`}>
                              {formatCurrency(market.metrics.revpar)}
                              {isWinner && <Trophy className="w-4 h-4 inline ml-1 text-[#C9A962]" />}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    
                    {/* Active Listings */}
                    <tr className="bg-[#f8f7f4]/50">
                      <td className="px-6 py-4 text-sm text-[#0F172A] font-sans">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-[#C9A962]" />
                          Active Listings
                        </div>
                      </td>
                      {selectedMarkets.map((market) => (
                        <td key={market.id} className="px-6 py-4 text-center">
                          <div className="text-lg font-semibold font-sans text-[#0F172A]">
                            {market.metrics.active_listings.toLocaleString()}
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Market Insights Comparison */}
            {selectedMarkets.some(m => m.insights) && (
              <div className="bg-white rounded-xl shadow-sm border border-[#0F172A]/10 overflow-hidden">
                <div className="bg-[#0F172A] text-white px-6 py-4">
                  <h3 className="text-lg font-serif font-semibold">Market Insights</h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#f8f7f4]">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0F172A] font-sans">Insight</th>
                        {selectedMarkets.map((market, index) => (
                          <th key={market.id} className="px-6 py-4 text-center text-sm font-semibold text-[#0F172A] font-sans">
                            {market.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0F172A]/10">
                      <tr>
                        <td className="px-6 py-4 text-sm text-[#0F172A] font-sans">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-[#C9A962]" />
                            Professionally Managed
                          </div>
                        </td>
                        {selectedMarkets.map((market) => (
                          <td key={market.id} className="px-6 py-4 text-center text-[#0F172A] font-sans">
                            {market.insights ? `${Math.round(market.insights.professionally_managed_pct)}%` : 'N/A'}
                          </td>
                        ))}
                      </tr>
                      <tr className="bg-[#f8f7f4]/50">
                        <td className="px-6 py-4 text-sm text-[#0F172A] font-sans">
                          <div className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-[#C9A962]" />
                            Superhost %
                          </div>
                        </td>
                        {selectedMarkets.map((market) => (
                          <td key={market.id} className="px-6 py-4 text-center text-[#0F172A] font-sans">
                            {market.insights ? `${Math.round(market.insights.superhost_pct)}%` : 'N/A'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm text-[#0F172A] font-sans">
                          <div className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-[#C9A962]" />
                            Avg. Rating
                          </div>
                        </td>
                        {selectedMarkets.map((market) => (
                          <td key={market.id} className="px-6 py-4 text-center text-[#0F172A] font-sans">
                            {market.insights ? market.insights.avg_rating.toFixed(1) : 'N/A'}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bedroom Performance Comparison */}
            {selectedMarkets.some(m => m.bedroom_performance && m.bedroom_performance.length > 0) && (
              <div className="bg-white rounded-xl shadow-sm border border-[#0F172A]/10 overflow-hidden">
                <div className="bg-[#0F172A] text-white px-6 py-4">
                  <h3 className="text-lg font-serif font-semibold">Revenue by Bedroom Count</h3>
                  <p className="text-white/60 text-sm font-sans mt-1">Compare how different property sizes perform in each market</p>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {selectedMarkets.map((market, index) => (
                      <div key={market.id} className="bg-[#f8f7f4] rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="w-6 h-6 bg-[#C9A962] rounded-full flex items-center justify-center text-[#0F172A] text-xs font-bold">
                            {index + 1}
                          </span>
                          <h4 className="font-semibold text-[#0F172A] font-sans">{market.name}</h4>
                        </div>
                        
                        {market.bedroom_performance && market.bedroom_performance.length > 0 ? (
                          <div className="space-y-2">
                            {[...market.bedroom_performance].sort((a, b) => a.bedrooms - b.bedrooms).slice(0, 5).map((bp) => (
                              <div key={bp.bedrooms} className="flex items-center justify-between text-sm font-sans">
                                <span className="text-[#0F172A]/70">{bp.bedrooms} BR</span>
                                <span className="font-medium text-[#0F172A]">{formatCurrency(bp.revenue)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-[#0F172A]/60 font-sans">No bedroom data available</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recommendation */}
            <div className="bg-gradient-to-br from-[#0F172A] to-[#1e293b] rounded-xl p-8 text-white">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#C9A962]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-6 h-6 text-[#C9A962]" />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-semibold mb-2">Our Analysis</h3>
                  <p className="text-white/80 font-sans mb-4">
                    Based on the comparison, <strong className="text-[#C9A962]">
                      {selectedMarkets.reduce((best, market) => {
                        const score = (market.metrics.revenue || 0) * (market.metrics.occupancy || 0);
                        const bestScore = (best.metrics.revenue || 0) * (best.metrics.occupancy || 0);
                        return score > bestScore ? market : best;
                      }).name}
                    </strong> shows the strongest combination of revenue potential and occupancy rates. 
                    However, each market has unique advantages depending on your investment strategy.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Link href="/market" className="inline-flex items-center gap-2 bg-[#C9A962] text-[#0F172A] px-6 py-3 rounded-lg font-semibold font-sans hover:bg-[#C9A962]/90 transition-colors">
                        Explore Individual Markets
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link href="/" className="inline-flex items-center gap-2 bg-white/10 text-white px-6 py-3 rounded-lg font-semibold font-sans hover:bg-white/20 transition-colors">
                        Analyze a Specific Property
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="bg-white rounded-xl shadow-sm border border-[#0F172A]/10 p-8 text-center">
              <h3 className="text-2xl font-serif font-semibold text-[#0F172A] mb-2">
                Ready to Invest?
              </h3>
              <p className="text-[#0F172A]/70 font-sans mb-6 max-w-2xl mx-auto">
                Our turnkey program helps you launch a profitable Airbnb business in any of these markets. 
                We handle everything from property selection to guest management.
              </p>
              <a
                href="#"
                className="inline-flex items-center gap-2 bg-[#C9A962] text-[#0F172A] px-8 py-4 rounded-lg font-semibold font-sans hover:bg-[#C9A962]/90 transition-colors"
              >
                Schedule Free Consultation
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </motion.div>
        )}

        {/* Submarket Explorer - Show for each selected market */}
        {selectedMarkets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 mt-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <MapPinned className="w-5 h-5 text-[#C9A962]" />
              <h2 className="text-xl font-serif font-semibold text-[#0F172A]">
                Drill Down: Where to Invest
              </h2>
            </div>
            <p className="text-[#0F172A]/70 font-sans -mt-2 mb-4">
              Explore neighborhoods and zip codes within each market to find the best investment opportunities
            </p>
            <div className="grid gap-6 lg:grid-cols-2">
              {selectedMarkets.slice(0, 2).map((market) => (
                <SubmarketExplorer
                  key={market.id}
                  marketId={market.id}
                  marketName={market.name}
                />
              ))}
            </div>
            {selectedMarkets.length > 2 && (
              <SubmarketExplorer
                marketId={selectedMarkets[2].id}
                marketName={selectedMarkets[2].name}
              />
            )}
          </motion.div>
        )}

        {/* Empty State */}
        {selectedMarkets.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-[#0F172A]/10 p-12 text-center">
            <div className="w-16 h-16 bg-[#C9A962]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-[#C9A962]" />
            </div>
            <h3 className="text-xl font-serif font-semibold text-[#0F172A] mb-2">
              Start Comparing Markets
            </h3>
            <p className="text-[#0F172A]/70 font-sans mb-6 max-w-md mx-auto">
              Search for cities or zip codes above to add markets to your comparison. 
              You can compare up to 3 markets side-by-side.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="text-sm text-[#0F172A]/60 font-sans">Popular markets:</span>
              {['Denver', 'Austin', 'Nashville', 'Phoenix'].map((city) => (
                <button
                  key={city}
                  onClick={() => setSearchQuery(city)}
                  className="text-sm text-[#C9A962] hover:underline font-sans"
                >
                  {city}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
