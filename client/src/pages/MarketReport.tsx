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

  // tRPC queries and mutations
  const searchMarketsQuery = trpc.rental.searchMarkets.useQuery(
    { searchTerm: searchQuery, limit: 10 },
    { enabled: false }
  );
  const getMarketReportMutation = trpc.rental.getMarketReport.useMutation();
  const getSubmarketReportMutation = trpc.rental.getSubmarketReport.useMutation();

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

              {/* Search Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans uppercase tracking-wider">
                  Search Markets
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F172A]/40" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Enter city, neighborhood, or zip code..."
                      className="w-full pl-12 pr-4 py-4 border-2 border-[#0F172A]/10 rounded-xl text-lg focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans bg-white"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-6 py-4 bg-[#0F172A] text-white rounded-xl font-semibold hover:bg-[#1e293b] transition-all duration-300 flex items-center gap-2 font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSearching ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-[#0F172A]/50 mt-2 font-sans">
                  Examples: "Denver", "Miami Beach", "80202", "Austin, TX"
                </p>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#0F172A]/70 font-sans mb-3">
                    Select a market:
                  </p>
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelectMarket(result)}
                      className="w-full p-4 bg-[#0F172A]/5 hover:bg-[#0F172A]/10 rounded-xl transition-all duration-300 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        {result.type === 'market' ? (
                          <Building className="w-5 h-5 text-[#C9A962]" />
                        ) : (
                          <MapPin className="w-5 h-5 text-[#0F172A]/40" />
                        )}
                        <div className="text-left">
                          <p className="font-medium text-[#0F172A] font-sans">{result.name}</p>
                          <p className="text-sm text-[#0F172A]/60 font-sans">
                            {result.type === 'market' ? 'Market' : 'Neighborhood'} • {result.listing_count.toLocaleString()} listings
                            {result.parent_market && ` • ${result.parent_market.name}`}
                          </p>
                        </div>
                      </div>
                      <ArrowLeft className="w-5 h-5 text-[#0F172A]/30 group-hover:text-[#C9A962] transition-colors rotate-180" />
                    </button>
                  ))}
                </div>
              )}

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

  // Results Page
  if (step === 'results' && reportData) {
    const isSubmarket = reportType === 'submarket';
    const data = isSubmarket 
      ? (reportData as SubmarketReportData)
      : (reportData as MarketReportData);
    
    const marketInfo = isSubmarket 
      ? (data as SubmarketReportData).submarket 
      : (data as MarketReportData).market;
    
    const insights = isSubmarket 
      ? (data as SubmarketReportData).insights 
      : (data as MarketReportData).insights;

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] to-[#f5f3f0]">
        {/* Header */}
        <div className="bg-[#0F172A] text-white">
          <div className="container mx-auto px-4 py-8">
            <button
              onClick={() => {
                setStep('search');
                setReportData(null);
                setSearchResults([]);
              }}
              className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors font-sans text-sm mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Search
            </button>
            
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {isSubmarket ? (
                    <MapPin className="w-6 h-6 text-[#C9A962]" />
                  ) : (
                    <Building className="w-6 h-6 text-[#C9A962]" />
                  )}
                  <span className="text-sm font-medium text-[#C9A962] uppercase tracking-wider font-sans">
                    {isSubmarket ? 'Neighborhood Report' : 'Market Report'}
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-serif font-semibold mb-2">
                  {marketInfo.name}
                </h1>
                {isSubmarket && (data as SubmarketReportData).submarket.parent_market && (
                  <p className="text-white/70 font-sans">
                    Part of {(data as SubmarketReportData).submarket.parent_market} market
                  </p>
                )}
              </div>
              
              {marketInfo.metrics.market_score && (
                <div className="text-right">
                  <p className="text-sm text-white/60 font-sans mb-1">Market Score</p>
                  <p className="text-4xl font-serif font-bold text-[#C9A962]">
                    {Math.round(marketInfo.metrics.market_score)}
                  </p>
                  <p className="text-xs text-white/50 font-sans">out of 100</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="container mx-auto px-4 -mt-6">
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="w-4 h-4 text-[#166534]" />
                <span className="text-sm font-medium text-[#0F172A]/60 font-sans">Occupancy</span>
              </div>
              <p className="text-3xl font-serif font-bold text-[#0F172A]">
                <AnimatedNumber value={Math.round(marketInfo.metrics.occupancy)} suffix="%" />
              </p>
            </motion.div>
            
            <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-[#C9A962]" />
                <span className="text-sm font-medium text-[#0F172A]/60 font-sans">Avg. Daily Rate</span>
              </div>
              <p className="text-3xl font-serif font-bold text-[#0F172A]">
                <AnimatedNumber value={Math.round(marketInfo.metrics.adr)} prefix="$" />
              </p>
            </motion.div>
            
            <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-[#0F172A]" />
                <span className="text-sm font-medium text-[#0F172A]/60 font-sans">Avg. Revenue</span>
              </div>
              <p className="text-3xl font-serif font-bold text-[#0F172A]">
                <AnimatedNumber value={Math.round(marketInfo.metrics.revenue)} prefix="$" />
              </p>
            </motion.div>
            
            <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <Building className="w-4 h-4 text-[#0F172A]/60" />
                <span className="text-sm font-medium text-[#0F172A]/60 font-sans">Active Listings</span>
              </div>
              <p className="text-3xl font-serif font-bold text-[#0F172A]">
                <AnimatedNumber value={marketInfo.metrics.active_listings || marketInfo.listing_count} />
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Insights */}
            <div className="lg:col-span-2 space-y-8">
              {/* Market Insights */}
              {insights && (
                <motion.div 
                  className="bg-white rounded-xl shadow-lg p-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h2 className="text-xl font-serif font-semibold text-[#0F172A] mb-6 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-[#C9A962]" />
                    Market Insights
                  </h2>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Professional Management */}
                    <div className="bg-[#0F172A]/5 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[#0F172A]/70 font-sans">Professionally Managed</span>
                        <span className="text-lg font-bold text-[#0F172A]">{insights.professionally_managed_pct}%</span>
                      </div>
                      <div className="w-full bg-[#0F172A]/10 rounded-full h-2">
                        <div 
                          className="bg-[#C9A962] h-2 rounded-full transition-all duration-1000"
                          style={{ width: `${insights.professionally_managed_pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#0F172A]/50 mt-2 font-sans">
                        {insights.professionally_managed_count} of {insights.total_listings} listings
                      </p>
                    </div>
                    
                    {/* Superhosts */}
                    <div className="bg-[#0F172A]/5 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[#0F172A]/70 font-sans">Superhosts</span>
                        <span className="text-lg font-bold text-[#0F172A]">{insights.superhost_pct}%</span>
                      </div>
                      <div className="w-full bg-[#0F172A]/10 rounded-full h-2">
                        <div 
                          className="bg-[#166534] h-2 rounded-full transition-all duration-1000"
                          style={{ width: `${insights.superhost_pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#0F172A]/50 mt-2 font-sans">
                        {insights.superhost_count} of {insights.total_listings} listings
                      </p>
                    </div>
                  </div>

                  {/* Revenue Percentiles */}
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-[#0F172A] mb-4 font-sans">Revenue Distribution</h3>
                    <div className="flex items-end justify-between h-32 px-4">
                      {[
                        { label: '10th', value: insights.revenue_percentiles.p10 },
                        { label: '25th', value: insights.revenue_percentiles.p25 },
                        { label: '50th', value: insights.revenue_percentiles.p50 },
                        { label: '75th', value: insights.revenue_percentiles.p75 },
                        { label: '90th', value: insights.revenue_percentiles.p90 },
                      ].map((p, idx) => {
                        const maxVal = insights.revenue_percentiles.p90;
                        const height = maxVal > 0 ? (p.value / maxVal * 100) : 0;
                        return (
                          <div key={p.label} className="flex flex-col items-center gap-2 flex-1">
                            <div className="relative w-full max-w-[40px] group">
                              <div 
                                className={`w-full rounded-t transition-all ${idx === 2 ? 'bg-[#C9A962]' : 'bg-[#0F172A]/20'}`}
                                style={{ height: `${height}%`, minHeight: '8px' }}
                              />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0F172A] text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                {formatCurrency(p.value)}
                              </div>
                            </div>
                            <span className="text-xs text-[#0F172A]/50 font-sans">{p.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-[#0F172A]/50 mt-2 text-center font-sans">
                      Median revenue: {formatCurrency(insights.revenue_percentiles.p50)}
                    </p>
                  </div>

                  {/* Property Type Breakdown */}
                  {insights.property_type_breakdown.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-semibold text-[#0F172A] mb-4 font-sans">Property Types</h3>
                      <div className="space-y-2">
                        {insights.property_type_breakdown.slice(0, 5).map((pt) => (
                          <div key={pt.type} className="flex items-center justify-between p-3 bg-[#0F172A]/5 rounded-lg">
                            <div className="flex items-center gap-3">
                              <Home className="w-4 h-4 text-[#0F172A]/40" />
                              <span className="font-medium text-[#0F172A] font-sans capitalize">{pt.type}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-medium text-[#0F172A]">{pt.pct}%</span>
                              <span className="text-xs text-[#0F172A]/50 ml-2 font-sans">
                                ({formatCurrency(pt.avg_revenue)} avg)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Bedroom Performance */}
              {data.bedroom_performance && data.bedroom_performance.length > 0 && (
                <motion.div 
                  className="bg-white rounded-xl shadow-lg p-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h2 className="text-xl font-serif font-semibold text-[#0F172A] mb-6 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#C9A962]" />
                    Performance by Bedroom Count
                  </h2>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#0F172A]/10">
                          <th className="text-left py-3 px-4 text-sm font-medium text-[#0F172A]/60 font-sans">Bedrooms</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-[#0F172A]/60 font-sans">Avg Revenue</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-[#0F172A]/60 font-sans">Avg ADR</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-[#0F172A]/60 font-sans">Occupancy</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-[#0F172A]/60 font-sans">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.bedroom_performance.map((br) => (
                          <tr key={br.bedrooms} className="border-b border-[#0F172A]/5 hover:bg-[#0F172A]/5 transition-colors">
                            <td className="py-3 px-4 font-medium text-[#0F172A] font-sans">{br.bedrooms} BR</td>
                            <td className="py-3 px-4 text-right text-[#0F172A] font-sans">{formatCurrency(br.avg_revenue)}</td>
                            <td className="py-3 px-4 text-right text-[#0F172A] font-sans">{formatCurrency(br.avg_adr)}</td>
                            <td className="py-3 px-4 text-right text-[#0F172A] font-sans">{br.avg_occupancy}%</td>
                            <td className="py-3 px-4 text-right text-[#0F172A]/60 font-sans">{br.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right Column - Top Listings */}
            <div className="space-y-8">
              {/* Top Performers */}
              <motion.div 
                className="bg-white rounded-xl shadow-lg p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-xl font-serif font-semibold text-[#0F172A] mb-6 flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#C9A962]" />
                  Top Performers
                </h2>
                
                <div className="space-y-4">
                  {data.top_listings.slice(0, 5).map((listing, idx) => (
                    <div 
                      key={listing.id}
                      className="p-4 bg-[#0F172A]/5 rounded-xl hover:bg-[#0F172A]/10 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-[#C9A962]/20 rounded-full flex items-center justify-center text-xs font-bold text-[#C9A962]">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium text-[#0F172A] font-sans line-clamp-1">
                            {listing.title}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs text-[#0F172A]/60 font-sans mb-2">
                        <span>{listing.bedrooms} BR • {listing.property_type}</span>
                        <span className="text-right">{formatPercent(listing.occupancy)} occ.</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-[#0F172A]">
                          {formatCurrency(listing.annual_revenue)}
                        </span>
                        {listing.rating && (
                          <span className="flex items-center gap-1 text-sm text-[#0F172A]/60">
                            <Star className="w-3 h-3 fill-[#C9A962] text-[#C9A962]" />
                            {listing.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      
                      {listing.airbnb_url && (
                        <a 
                          href={listing.airbnb_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#C9A962] hover:underline mt-2"
                        >
                          View on Airbnb <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Educational Tips */}
              <motion.div 
                className="bg-white rounded-xl shadow-lg p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <h3 className="text-lg font-serif font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-[#C9A962]" />
                  What This Means
                </h3>
                <div className="space-y-4 text-sm text-[#0F172A]/70 font-sans">
                  <div className="p-3 bg-[#166534]/5 rounded-lg border-l-3 border-[#166534]">
                    <p><strong>Occupancy {marketInfo.metrics.occupancy}%</strong> means properties are booked about {Math.round(marketInfo.metrics.occupancy * 3.65)} nights/year on average.</p>
                  </div>
                  <div className="p-3 bg-[#C9A962]/5 rounded-lg border-l-3 border-[#C9A962]">
                    <p><strong>ADR ${marketInfo.metrics.adr}</strong> is the average nightly rate. Top performers often charge 20-40% more.</p>
                  </div>
                  <div className="p-3 bg-[#0F172A]/5 rounded-lg border-l-3 border-[#0F172A]">
                    <p><strong>{insights?.professionally_managed_pct || 0}% professionally managed</strong> — professional hosts typically earn 15-25% more revenue.</p>
                  </div>
                </div>
              </motion.div>

              {/* CTA */}
              <motion.div 
                className="bg-gradient-to-br from-[#0F172A] to-[#1e293b] rounded-xl shadow-lg p-6 text-white"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="inline-flex items-center gap-2 bg-[#C9A962]/20 text-[#C9A962] px-3 py-1 rounded-full text-xs font-medium mb-3">
                  <Award className="w-3 h-3" />
                  Turnkey Solution
                </div>
                <h3 className="text-lg font-serif font-semibold mb-2">
                  Skip the Learning Curve
                </h3>
                <p className="text-white/70 text-sm font-sans mb-4">
                  New to short-term rentals? Our done-for-you program handles everything — 
                  from property setup to guest management. Start earning without the hassle.
                </p>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#C9A962]" />
                    <span>Professional photography & listing</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#C9A962]" />
                    <span>Dynamic pricing optimization</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#C9A962]" />
                    <span>24/7 guest communication</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <button className="w-full bg-[#C9A962] text-[#0F172A] px-4 py-3 rounded-lg font-semibold text-sm hover:bg-[#d4b876] transition-colors flex items-center justify-center gap-2">
                    Schedule Free Consultation
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <Link 
                    href="/"
                    className="w-full inline-flex items-center justify-center gap-2 bg-white/10 text-white px-4 py-3 rounded-lg font-semibold text-sm hover:bg-white/20 transition-colors border border-white/20"
                  >
                    <Target className="w-4 h-4" />
                    Analyze a Property
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
