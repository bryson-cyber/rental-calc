/**
 * Market Report Page
 * Shows comprehensive market data for cities, submarkets, and zip codes
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MapPin, 
  Building,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  DollarSign,
  Percent,
  BarChart3,
  Users,
  Star,
  ExternalLink,
  Home,
  Target,
  Building2,
  PieChart,
  Award,
  Info,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { Link } from 'wouter';
import ChapterMarketReport from '@/components/ChapterMarketReport';

// Types
interface MarketSearchResult {
  id: string;
  name: string;
  type: 'market' | 'submarket';
  listing_count: number;
  location_name: string;
  state?: string;
  parent_market?: {
    id: string;
    name: string;
  };
}

interface MarketMetrics {
  occupancy: number;
  adr: number;
  revenue: number;
  revpar: number;
  active_listings: number;
  market_score?: number;
}

interface ListingData {
  id: string;
  title: string;
  airbnb_url?: string;
  image_url?: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  property_type: string;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  superhost?: boolean;
  professionally_managed?: boolean;
  host_size?: string;
}

interface BedroomPerformance {
  bedrooms: number;
  count: number;
  avg_revenue: number;
  avg_adr: number;
  avg_occupancy: number;
}

interface MarketInsights {
  total_listings: number;
  professionally_managed_count: number;
  professionally_managed_pct: number;
  superhost_count: number;
  superhost_pct: number;
  avg_rating: number;
  avg_reviews: number;
  avg_days_available: number;
  avg_days_reserved: number;
  property_type_breakdown: Array<{
    type: string;
    count: number;
    pct: number;
    avg_revenue: number;
  }>;
  host_size_breakdown: Array<{
    size: string;
    count: number;
    pct: number;
    avg_revenue: number;
  }>;
  revenue_percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
}

interface SubmarketReportData {
  submarket: {
    id: string;
    name: string;
    listing_count: number;
    parent_market?: string;
    market_type?: string;
    metrics: MarketMetrics;
  };
  top_listings: ListingData[];
  bedroom_performance: BedroomPerformance[];
  insights: MarketInsights;
  generated_at: string;
}

interface MarketReportData {
  market: {
    id: string;
    name: string;
    listing_count: number;
    location_name: string;
    market_type?: string;
    metrics: MarketMetrics;
    historical?: {
      occupancy: Array<{ date: string; value: number }>;
      adr: Array<{ date: string; value: number }>;
      revenue: Array<{ date: string; value: number }>;
      revpar: Array<{ date: string; value: number }>;
      active_listings: Array<{ date: string; value: number }>;
    };
  };
  submarkets: Array<{
    id: string;
    name: string;
    listing_count: number;
  }>;
  top_listings: ListingData[];
  bedroom_performance: BedroomPerformance[];
  insights?: MarketInsights;
  generated_at: string;
}

// Animated counter component
function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(value || 0);
  const animationRef = useRef<number | null>(null);
  const prevValueRef = useRef(value);
  
  useEffect(() => {
    if (value === prevValueRef.current || value === 0) {
      setDisplayValue(value);
      return;
    }
    
    const duration = 1500;
    const startTime = Date.now();
    const startValue = prevValueRef.current || 0;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(startValue + (value - startValue) * easeOutQuart);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = value;
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value]);
  
  return (
    <span>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}

export default function MarketReport() {
  const [step, setStep] = useState<'search' | 'loading' | 'results'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MarketSearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<MarketSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<MarketReportData | SubmarketReportData | null>(null);
  const [reportType, setReportType] = useState<'market' | 'submarket'>('market');
  const [isSearching, setIsSearching] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // tRPC queries and mutations
  const searchMarketsQuery = trpc.rental.searchMarkets.useQuery(
    { searchTerm: searchQuery, limit: 10 },
    { enabled: false }
  );
  const getMarketReportMutation = trpc.rental.getMarketReport.useMutation();
  const getSubmarketReportMutation = trpc.rental.getSubmarketReport.useMutation();

  // Debounced autocomplete - search as user types
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only search if query is at least 2 characters
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowAutocomplete(false);
      return;
    }

    // Debounce the search by 300ms
    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await searchMarketsQuery.refetch();
        if (result.data?.success && result.data.data) {
          setSearchResults(result.data.data);
          setShowAutocomplete(result.data.data.length > 0);
        }
      } catch (err) {
        console.error('Autocomplete error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setError(null);
    
    try {
      const result = await searchMarketsQuery.refetch();
      if (result.data?.success && result.data.data) {
        setSearchResults(result.data.data);
        if (result.data.data.length === 0) {
          setError('No markets found. Try a different search term.');
        }
      } else {
        setError('Search failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred while searching.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle market selection
  const handleSelectMarket = async (result: MarketSearchResult) => {
    setSelectedResult(result);
    setStep('loading');
    setError(null);
    
    try {
      if (result.type === 'submarket') {
        setReportType('submarket');
        const report = await getSubmarketReportMutation.mutateAsync({
          submarketId: result.id,
        });
        
        if (report.success && report.data) {
          setReportData(report.data);
          setStep('results');
        } else {
          setError(report.error || 'Failed to generate report');
          setStep('search');
        }
      } else {
        setReportType('market');
        const report = await getMarketReportMutation.mutateAsync({
          marketId: result.id,
        });
        
        if (report.success && report.data) {
          setReportData(report.data);
          setStep('results');
        } else {
          setError(report.error || 'Failed to generate report');
          setStep('search');
        }
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setError('An error occurred while generating the report.');
      setStep('search');
    }
  };

  // Format helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    const percent = value > 1 ? value : value * 100;
    return `${Math.round(percent)}%`;
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  // Search Page
  if (step === 'search') {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/hero-property.jpg)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A]/90 via-[#0F172A]/80 to-[#1e293b]/70" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-12">
          <motion.div 
            className="w-full max-w-2xl"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {/* Back Link */}
            <motion.div variants={itemVariants} className="mb-6">
              <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors font-sans text-sm">
                <ArrowLeft className="w-4 h-4" />
                Back to Property Calculator
              </Link>
            </motion.div>

            {/* Header */}
            <motion.div className="text-center mb-10" variants={itemVariants}>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#C9A962]/20 rounded-xl mb-6 backdrop-blur-sm border border-[#C9A962]/30">
                <Building2 className="w-8 h-8 text-[#C9A962]" />
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-semibold text-white mb-4 tracking-tight">
                Market Research
              </h1>
              <p className="text-lg text-white/70 font-sans max-w-lg mx-auto">
                Explore short-term rental markets by city, neighborhood, or zip code
              </p>
            </motion.div>
            
            {/* Search Card */}
            <motion.div 
              className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 md:p-10"
              variants={itemVariants}
            >
              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm font-sans">{error}</p>
                </div>
              )}

              {/* Search Input with Autocomplete */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans uppercase tracking-wider">
                  Search Markets
                </label>
                <div className="relative">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F172A]/40 z-10" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowAutocomplete(true);
                      }}
                      onFocus={() => searchResults.length > 0 && setShowAutocomplete(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchResults.length > 0) {
                          handleSelectMarket(searchResults[0]);
                        } else if (e.key === 'Escape') {
                          setShowAutocomplete(false);
                        }
                      }}
                      placeholder="Start typing a city, neighborhood, or zip code..."
                      className="w-full pl-12 pr-12 py-4 border-2 border-[#0F172A]/10 rounded-xl text-lg focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans bg-white"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C9A962] animate-spin" />
                    )}
                  </div>
                  
                  {/* Autocomplete Dropdown */}
                  {showAutocomplete && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-[#0F172A]/10 overflow-hidden z-50 max-h-80 overflow-y-auto">
                      {searchResults.map((result, index) => (
                        <button
                          key={result.id}
                          onClick={() => {
                            setShowAutocomplete(false);
                            handleSelectMarket(result);
                          }}
                          className={`w-full p-4 hover:bg-[#C9A962]/10 transition-all duration-200 flex items-center justify-between group text-left ${
                            index !== searchResults.length - 1 ? 'border-b border-[#0F172A]/5' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {result.type === 'market' ? (
                              <div className="w-10 h-10 bg-[#C9A962]/20 rounded-lg flex items-center justify-center">
                                <Building className="w-5 h-5 text-[#C9A962]" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 bg-[#0F172A]/5 rounded-lg flex items-center justify-center">
                                <MapPin className="w-5 h-5 text-[#0F172A]/50" />
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-[#0F172A] font-sans">{result.name}</p>
                              <p className="text-sm text-[#0F172A]/60 font-sans">
                                {result.type === 'market' ? 'Market' : 'Neighborhood'} • {result.listing_count.toLocaleString()} listings
                                {result.parent_market && ` • ${result.parent_market.name}`}
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="w-5 h-5 text-[#0F172A]/20 group-hover:text-[#C9A962] transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-[#0F172A]/50 mt-2 font-sans">
                  Start typing and select from suggestions • Examples: "Denver", "Miami Beach", "80202"
                </p>
              </div>

              {/* Compare Markets Link */}
              <div className="mt-6 p-4 bg-gradient-to-r from-[#0F172A]/5 to-[#C9A962]/10 rounded-xl border border-[#C9A962]/20">
                <Link href="/compare" className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#C9A962]/20 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-[#C9A962]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#0F172A] font-sans">Compare Markets</p>
                      <p className="text-sm text-[#0F172A]/60 font-sans">Compare up to 3 markets side-by-side</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#0F172A]/30 group-hover:text-[#C9A962] transition-colors" />
                </Link>
              </div>

              {/* Educational Content */}
              <div className="mt-8 pt-6 border-t border-[#0F172A]/10">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-3 font-sans flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#C9A962]" />
                  What You'll Learn
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm text-[#0F172A]/70 font-sans">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-[#C9A962] rounded-full" />
                    Average revenue & occupancy
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-[#C9A962] rounded-full" />
                    Top performing properties
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-[#C9A962] rounded-full" />
                    Professional vs. individual hosts
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-[#C9A962] rounded-full" />
                    Revenue by bedroom count
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Loading State
  if (step === 'loading') {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/hero-property.jpg)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A]/90 via-[#0F172A]/80 to-[#1e293b]/70" />
        </div>
        
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#C9A962]/20 rounded-2xl mb-6 backdrop-blur-sm border border-[#C9A962]/30">
              <Loader2 className="w-10 h-10 text-[#C9A962] animate-spin" />
            </div>
            <h2 className="text-2xl font-serif font-semibold text-white mb-3">
              Analyzing {selectedResult?.name}
            </h2>
            <p className="text-white/70 font-sans">
              Gathering market data and insights...
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // Results Page - Use ChapterMarketReport component
  if (step === 'results' && reportData) {
    return (
      <ChapterMarketReport
        data={reportData}
        reportType={reportType}
        onBack={() => {
          setStep('search');
          setReportData(null);
          setSearchResults([]);
          setSearchQuery('');
        }}
      />
    );
  }


  return null;
}
