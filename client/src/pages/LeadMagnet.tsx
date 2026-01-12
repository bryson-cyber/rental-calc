/**
 * Job-Focused Lead Magnet Tool
 * 
 * Three core jobs this tool accomplishes:
 * 1. "Prove to myself I can make money" - Market validation & confidence building
 * 2. "Find the best market to invest in" - Market discovery
 * 3. "Find if this specific property is worth it" - Property validation
 * 
 * Flow:
 * - Ebook at top (belief-building entry point)
 * - Tools below in job sequence:
 *   1. Prove the Market (Market Research) - shows real revenue data
 *   2. Find Your Market (Explore Area) - identifies opportunities
 *   3. Validate the Deal (One Home) - checks specific property
 *   4. Find the Best Deal (Compare Many) - compares options
 */

import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { EbookViewer } from '@/components/EbookViewer';
import { HelpSection } from '@/components/HelpSection';
import { InlineEbook } from '@/components/InlineEbook';

import { 
  MapPin,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Bed,
  Bath,
  Star,
  Users,
  Home,
  ExternalLink,
  BarChart3,
  BookOpen,
  Target,
  Sparkles,
  ArrowUpRight,
  Clock,
  Percent,
  List,
  Grid3X3,
  Search,
  Plus,
  Trash2,
  SortAsc,
  SortDesc,
  Filter,
  X,
  Map,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Play,
  Zap,
  Trophy,
  Shield
} from 'lucide-react';
import { MapView } from '@/components/Map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { toast } from 'sonner';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface MonthlyForecast {
  month: string;
  revenue: number;
  adr: number;
  occupancy: number;
}

interface CompMonthlyMetric {
  date: string;
  occupancy: number;
  adr: number;
  revenue: number;
  revenue_potential: number;
}

interface Comparable {
  id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  revenue: number;
  adr: number;
  occupancy: number;
  rating: number;
  reviews: number;
  imageUrl?: string;
  airbnbUrl?: string;
  distanceMeters?: number;
  monthlyMetrics?: CompMonthlyMetric[];
}

interface HistoricalData {
  summary: {
    monthly_pct_change: number;
    yearly_pct_change: number;
    trend: 'up' | 'down' | 'stable';
  };
  months: Array<{
    date: string;
    revenue: number;
    occupancy: number;
    adr: number;
  }>;
}

interface AnalysisResult {
  revenue: {
    projected: number;
    low: number;
    high: number;
  };
  metrics: {
    adr: number;
    occupancy: number;
  };
  cashFlow: {
    monthlyRevenue: number;
    monthlyRent: number;
    monthlyProfit: number;
  };
  forecast: MonthlyForecast[];
  comparables: Comparable[];
  historicalData?: HistoricalData;
}

interface BulkPropertyInput {
  id: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
}

interface BulkPropertyResult {
  id: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  revenue: number;
  profit: number;
  ratio: number;
  adr: number;
  occupancy: number;
  status: 'success' | 'error';
  error?: string;
}

interface MarketResearchResult {
  marketName: string;
  avgRevenue: number;
  avgAdr: number;
  avgOccupancy: number;
  totalListings: number;
  propertyTypes: Array<{
    type: string;
    count: number;
    avgRevenue: number;
  }>;
  seasonality: Array<{
    month: string;
    occupancy: number;
    adr: number;
  }>;
}

interface AreaListing {
  id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  property_type: string;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  distance_meters: number;
  airbnb_url?: string;
  image_url?: string;
  superhost?: boolean;
  latitude?: number;
  longitude?: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatMonth = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short' });
};

const getMonthAbbr = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short' }).substring(0, 3);
};

// ============================================
// MAIN COMPONENT
// ============================================
type TabType = 'prove' | 'find' | 'validate' | 'compare';

export default function LeadMagnet() {
  // Tab state - now in job sequence
  const [activeTab, setActiveTab] = useState<TabType>('prove');
  
  // Ebook state
  const [isEbookExpanded, setIsEbookExpanded] = useState(true);
  const [isEbookOpen, setIsEbookOpen] = useState(false);
  
  // Help state
  const [showHelp, setShowHelp] = useState<TabType | null>(null);
  
  // ============================================
  // VALIDATE THE DEAL STATE (formerly Single Property)
  // ============================================
  const [address, setAddress] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [bedrooms, setBedrooms] = useState('2');
  const [bathrooms, setBathrooms] = useState('1');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  
  // ============================================
  // FIND THE BEST DEAL STATE (formerly Compare)
  // ============================================
  const [bulkProperties, setBulkProperties] = useState<BulkPropertyInput[]>([
    { id: '1', address: '', bedrooms: 2, bathrooms: 1, rent: 0 }
  ]);
  const [bulkResults, setBulkResults] = useState<BulkPropertyResult[] | null>(null);
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  const [bulkSortBy, setBulkSortBy] = useState<'profit' | 'revenue' | 'ratio'>('profit');
  const [bulkSortDir, setBulkSortDir] = useState<'desc' | 'asc'>('desc');
  
  // ============================================
  // FIND YOUR MARKET STATE (formerly Explore Area)
  // ============================================
  const [exploreAddress, setExploreAddress] = useState('');
  const [exploreRadius, setExploreRadius] = useState(3000);
  const [exploreBedroomFilter, setExploreBedroomFilter] = useState<number | null>(null);
  const [exploreMinRating, setExploreMinRating] = useState<number | null>(null);
  const [exploreSortBy, setExploreSortBy] = useState<'proximity' | 'revenue' | 'rating' | 'occupancy'>('revenue');
  const [areaListings, setAreaListings] = useState<AreaListing[] | null>(null);
  const [isExploring, setIsExploring] = useState(false);
  const [totalListings, setTotalListings] = useState(0);
  const [showMapView, setShowMapView] = useState(false);
  const [exploreCenter, setExploreCenter] = useState<{lat: number; lng: number} | null>(null);
  const [mapReady, setMapReady] = useState(false);
  
  // ============================================
  // PROVE THE MARKET STATE (formerly Market Research)
  // ============================================
  const [researchMarket, setResearchMarket] = useState('');
  const [researchResult, setResearchResult] = useState<MarketResearchResult | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [showMarketSuggestions, setShowMarketSuggestions] = useState(false);

  // ============================================
  // TRPC MUTATIONS
  // ============================================
  const analyzeProperty = trpc.rental.getPropertyReport.useMutation();
  const getAreaListings = trpc.listingsByArea.get.useMutation();
  const searchMarkets = trpc.marketResearchSimple.searchMarkets.useMutation();
  const getMarketReport = trpc.marketResearchSimple.getMarketReport.useMutation();

  // ============================================
  // HANDLERS
  // ============================================
  
  // Validate the Deal (Single Property)
  const handleAnalyze = async () => {
    if (!address) {
      toast.error('Please enter a property address');
      return;
    }
    
    setIsAnalyzing(true);
    setLoadingStep(1);
    
    try {
      const loadingInterval = setInterval(() => {
        setLoadingStep(prev => prev < 4 ? prev + 1 : prev);
      }, 1500);
      
      const response = await analyzeProperty.mutateAsync({
        address,
        bedrooms: parseInt(bedrooms),
        bathrooms: parseFloat(bathrooms),
      });
      
      clearInterval(loadingInterval);
      
      if (!response.success || !response.data) {
        toast.error(response.error || 'Could not analyze this property');
        return;
      }
      
      const data = response.data;
      const rent = parseFloat(monthlyRent) || 0;
      const annualRevenue = data.property.estimates?.annual_revenue || 0;
      const monthlyRevenue = annualRevenue / 12;
      
      // Transform API response to our result format
      setResult({
        revenue: {
          projected: annualRevenue,
          low: data.property.estimates?.annual_revenue_low || annualRevenue * 0.8,
          high: data.property.estimates?.annual_revenue_high || annualRevenue * 1.2,
        },
        metrics: {
          adr: data.property.estimates?.average_daily_rate || 0,
          occupancy: data.property.estimates?.occupancy_rate || 0,
        },
        cashFlow: {
          monthlyRevenue,
          monthlyRent: rent,
          monthlyProfit: monthlyRevenue - rent,
        },
        forecast: [],
        comparables: (data.same_bedroom_comps || []).map((c: any) => ({
          id: c.id || String(Math.random()),
          title: c.title || `${c.bedrooms}BR Property`,
          bedrooms: c.bedrooms,
          bathrooms: c.bathrooms,
          accommodates: c.accommodates,
          revenue: c.annual_revenue || 0,
          adr: c.adr || 0,
          occupancy: c.occupancy || 0,
          rating: c.rating || 0,
          reviews: c.reviews || 0,
          airbnbUrl: c.airbnb_url,
        })),
      });
      
      toast.success('Property validated! See your results below.');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Could not analyze this property. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setLoadingStep(0);
    }
  };
  
  // Find the Best Deal (Bulk Compare)
  const addBulkProperty = () => {
    if (bulkProperties.length >= 25) {
      toast.error('Maximum 25 properties allowed');
      return;
    }
    setBulkProperties([
      ...bulkProperties,
      { id: Date.now().toString(), address: '', bedrooms: 2, bathrooms: 1, rent: 0 }
    ]);
  };
  
  const removeBulkProperty = (id: string) => {
    if (bulkProperties.length <= 1) return;
    setBulkProperties(bulkProperties.filter(p => p.id !== id));
  };
  
  const updateBulkProperty = (id: string, field: keyof BulkPropertyInput, value: string | number) => {
    setBulkProperties(bulkProperties.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };
  
  const handleBulkAnalyze = async () => {
    const validProperties = bulkProperties.filter(p => p.address.trim());
    if (validProperties.length === 0) {
      toast.error('Please enter at least one property address');
      return;
    }
    
    setIsBulkAnalyzing(true);
    const results: BulkPropertyResult[] = [];
    
    for (const prop of validProperties) {
      try {
        const response = await analyzeProperty.mutateAsync({
          address: prop.address,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
        });
        
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to analyze');
        }
        
        const data = response.data;
        const annualRevenue = data.property.estimates?.annual_revenue || 0;
        const monthlyRevenue = annualRevenue / 12;
        const profit = monthlyRevenue - prop.rent;
        
        results.push({
          id: prop.id,
          address: prop.address,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          rent: prop.rent,
          revenue: monthlyRevenue,
          profit,
          ratio: prop.rent > 0 ? monthlyRevenue / prop.rent : 0,
          adr: data.property.estimates?.average_daily_rate || 0,
          occupancy: data.property.estimates?.occupancy_rate || 0,
          status: 'success',
        });
      } catch (error) {
        results.push({
          id: prop.id,
          address: prop.address,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          rent: prop.rent,
          revenue: 0,
          profit: 0,
          ratio: 0,
          adr: 0,
          occupancy: 0,
          status: 'error',
          error: 'Could not analyze this property',
        });
      }
    }
    
    setBulkResults(results);
    setIsBulkAnalyzing(false);
    toast.success(`Found the best deal from ${results.filter(r => r.status === 'success').length} properties!`);
  };
  
  // Find Your Market (Explore Area)
  const handleExplore = async () => {
    if (!exploreAddress) {
      toast.error('Please enter an address or city');
      return;
    }
    
    setIsExploring(true);
    
    try {
      const response = await getAreaListings.mutateAsync({
        address: exploreAddress,
        radiusMeters: exploreRadius,
        bedrooms: exploreBedroomFilter || undefined,
        minRating: exploreMinRating || undefined,
        sortBy: exploreSortBy,
        sortDirection: exploreSortBy === 'revenue' ? 'descending' : 'ascending',
      });
      
      if (response.success && response.data) {
        const listings = response.data.listings.map((l: any) => ({
          id: l.id,
          title: l.title,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          accommodates: l.accommodates,
          property_type: l.property_type,
          rating: l.rating,
          reviews: l.reviews,
          annual_revenue: l.annual_revenue,
          adr: l.adr,
          occupancy: l.occupancy,
          distance_meters: l.distance_meters,
          airbnb_url: l.airbnb_url,
          image_url: l.image_url,
          latitude: l.latitude,
          longitude: l.longitude,
        }));
        setAreaListings(listings);
        setTotalListings(response.data.total_count);
        if (response.data.center) {
          setExploreCenter({ lat: response.data.center.latitude, lng: response.data.center.longitude });
        }
        toast.success(`Found ${response.data.total_count} opportunities in this market!`);
      } else {
        toast.error(response.error || 'Could not explore this area');
      }
    } catch (error) {
      console.error('Explore error:', error);
      toast.error('Could not explore this area. Please try again.');
    } finally {
      setIsExploring(false);
    }
  };
  
  // Prove the Market (Market Research)
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  
  const handleResearch = async () => {
    if (!researchMarket) {
      toast.error('Please enter a market name');
      return;
    }
    
    setIsResearching(true);
    setShowMarketSuggestions(false);
    
    try {
      // First search for the market to get its ID
      const searchResults = await searchMarkets.mutateAsync({ query: researchMarket });
      
      if (!searchResults || searchResults.length === 0) {
        toast.error('Market not found. Please try a different city.');
        setIsResearching(false);
        return;
      }
      
      const market = searchResults[0];
      setSelectedMarketId(market.id);
      
      // Now get the full market report
      const report = await getMarketReport.mutateAsync({
        marketId: market.id,
        marketName: market.name
      });
      
      // Transform to our result format
      setResearchResult({
        marketName: report.market.name,
        avgRevenue: report.overview.avgRevenue,
        avgAdr: report.overview.avgAdr,
        avgOccupancy: report.overview.avgOccupancy,
        totalListings: report.overview.totalListings,
        propertyTypes: report.bedroomBreakdown.map(b => ({
          type: `${b.bedrooms} Bedroom`,
          count: b.count,
          avgRevenue: b.avgRevenue
        })),
        seasonality: report.seasonality.monthlyData.map(m => ({
          month: m.month,
          occupancy: m.occupancy,
          adr: m.adr
        }))
      });
      
      toast.success('Market proven! See the real revenue data below.');
    } catch (error) {
      console.error('Research error:', error);
      toast.error('Could not research this market. Please try again.');
    } finally {
      setIsResearching(false);
    }
  };
  
  // Sorted bulk results
  const sortedBulkResults = bulkResults ? [...bulkResults].sort((a, b) => {
    if (a.status === 'error') return 1;
    if (b.status === 'error') return -1;
    const aVal = bulkSortBy === 'profit' ? a.profit : bulkSortBy === 'revenue' ? a.revenue : a.ratio;
    const bVal = bulkSortBy === 'profit' ? b.profit : bulkSortBy === 'revenue' ? b.revenue : b.ratio;
    return bulkSortDir === 'desc' ? bVal - aVal : aVal - bVal;
  }) : null;

  // ============================================
  // JOB DESCRIPTIONS FOR EACH TOOL
  // ============================================
  const jobDescriptions = {
    prove: {
      title: "See Real Revenue",
      subtitle: "View actual Airbnb earnings data from any market",
      job: "Answer: How much do hosts actually make here?",
      icon: DollarSign,
      color: "from-emerald-500 to-teal-500"
    },
    find: {
      title: "Explore Listings",
      subtitle: "Browse active rentals and see what's working in any area",
      job: "Answer: What properties are succeeding here?",
      icon: Search,
      color: "from-blue-500 to-cyan-500"
    },
    validate: {
      title: "Validate the Deal",
      subtitle: "Check if a specific property will actually make you money",
      job: "Answer: Is this property worth it?",
      icon: Target,
      color: "from-purple-500 to-pink-500"
    },
    compare: {
      title: "Find the Best Deal",
      subtitle: "Compare multiple properties to find the winner",
      job: "Answer: Which property should I choose?",
      icon: Trophy,
      color: "from-amber-500 to-orange-500"
    }
  };

  // ============================================
  // RENDER
  // ============================================
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      
      {/* ============================================ */}
      {/* INLINE EBOOK - ALWAYS VISIBLE AT TOP */}
      {/* ============================================ */}
      <section className="relative py-8 md:py-12 border-b border-slate-800">
        <div className="container max-w-5xl mx-auto px-4">
          <InlineEbook onStartTools={() => {
            const toolsSection = document.getElementById('tools-section');
            if (toolsSection) {
              toolsSection.scrollIntoView({ behavior: 'smooth' });
            }
          }} />
        </div>
      </section>

      {/* ============================================ */}
      {/* TOOLS SECTION - JOB-FOCUSED */}
      {/* ============================================ */}
      <section id="tools-section" className="relative py-12 md:py-16">
        <div className="container max-w-5xl mx-auto px-4">
          
          {/* Section Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4A84B]/10 border border-[#D4A84B]/20 rounded-full text-[#D4A84B] text-sm font-medium mb-4">
              <Zap className="w-4 h-4" />
              Free Tools That Do The Work For You
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Your Journey to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4]">
                Rental Riches
              </span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Each tool answers a specific question on your path to profitable short-term rentals
            </p>
          </div>
          
          {/* Job-Focused Tab Navigation */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {(['prove', 'find', 'validate', 'compare'] as TabType[]).map((tab, index) => {
              const job = jobDescriptions[tab];
              const Icon = job.icon;
              const isActive = activeTab === tab;
              
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative p-4 rounded-xl border transition-all text-left ${
                    isActive
                      ? 'bg-slate-800/80 border-slate-600 shadow-lg'
                      : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${job.color} flex items-center justify-center`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs text-slate-500 font-medium">Step {index + 1}</span>
                  </div>
                  <h3 className={`font-semibold text-sm mb-1 ${isActive ? 'text-white' : 'text-slate-300'}`}>
                    {job.title}
                  </h3>
                  <p className="text-xs text-slate-500 hidden md:block">
                    {job.job}
                  </p>
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-slate-800 border-l border-b border-slate-600 rotate-[-45deg]" />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Tool Content Area */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-2xl">
            
            {/* Current Job Header */}
            <div className="mb-6 pb-6 border-b border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                {(() => {
                  const job = jobDescriptions[activeTab];
                  const Icon = job.icon;
                  return (
                    <>
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${job.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{job.title}</h3>
                        <p className="text-sm text-slate-400">{job.subtitle}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <p className="text-[#D4A84B] font-medium text-sm mt-3">
                {jobDescriptions[activeTab].job}
              </p>
            </div>
            
            {/* ============================================ */}
            {/* PROVE THE MARKET TAB */}
            {/* ============================================ */}
            {activeTab === 'prove' && (
              <div className="grid gap-6">
                <HelpSection
                  title="How This Tool Helps You"
                  description="See real revenue data from actual Airbnb hosts to prove that short-term rentals make money in any market"
                  steps={[
                    'Enter any city or market name',
                    'Click "Prove This Market"',
                    'See average revenue hosts are actually making',
                    'View occupancy rates and seasonal trends',
                    'Understand which property types perform best'
                  ]}
                  isOpen={showHelp === 'prove'}
                  onToggle={() => setShowHelp(showHelp === 'prove' ? null : 'prove')}
                />
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    City or Market Name
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={researchMarket}
                      onChange={(e) => {
                        setResearchMarket(e.target.value);
                        setShowMarketSuggestions(true);
                      }}
                      onFocus={() => setShowMarketSuggestions(true)}
                      placeholder="Enter any market (e.g., Austin, TX or 78701)..."
                      className="h-12 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                      disabled={isResearching}
                    />
                    {showMarketSuggestions && !isResearching && (
                      <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {[
                          'Atlanta, GA', 'Austin, TX', 'Boston, MA', 'Charlotte, NC', 'Chicago, IL',
                          'Dallas, TX', 'Denver, CO', 'Houston, TX', 'Las Vegas, NV', 'Los Angeles, CA',
                          'Miami, FL', 'Nashville, TN', 'New York, NY', 'Orlando, FL', 'Phoenix, AZ',
                          'Portland, OR', 'San Diego, CA', 'San Francisco, CA', 'Seattle, WA', 'Tampa, FL'
                        ]
                          .filter(m => m.toLowerCase().includes(researchMarket.toLowerCase()))
                          .map(market => (
                            <button
                              key={market}
                              onClick={() => {
                                setResearchMarket(market);
                                setShowMarketSuggestions(false);
                              }}
                              className="w-full px-4 py-2 text-left text-slate-300 hover:bg-slate-700 transition-colors"
                            >
                              {market}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Type any city, neighborhood, or zip code
                  </p>
                </div>
                
                <Button
                  onClick={handleResearch}
                  disabled={isResearching || !researchMarket}
                  className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-lg rounded-xl shadow-lg"
                >
                  {isResearching ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Proving the Market...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Prove This Market
                    </span>
                  )}
                </Button>
              </div>
            )}
            
            {/* ============================================ */}
            {/* FIND YOUR MARKET TAB */}
            {/* ============================================ */}
            {activeTab === 'find' && (
              <div className="grid gap-6">
                <HelpSection
                  title="How This Tool Helps You"
                  description="Discover all the profitable Airbnb properties in any area to find where the opportunities are"
                  steps={[
                    'Enter any city or neighborhood',
                    'Set your search radius',
                    'Filter by bedrooms if needed',
                    'Click "Find Opportunities"',
                    'See all properties ranked by revenue'
                  ]}
                  isOpen={showHelp === 'find'}
                  onToggle={() => setShowHelp(showHelp === 'find' ? null : 'find')}
                />
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Address or City
                  </label>
                  <AddressAutocomplete
                    value={exploreAddress}
                    onChange={setExploreAddress}
                    placeholder="Type an address or city name..."
                    className="h-12 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Search Radius
                    </label>
                    <select
                      value={exploreRadius}
                      onChange={(e) => setExploreRadius(parseInt(e.target.value))}
                      className="w-full h-12 px-4 bg-slate-900/50 border border-slate-600 rounded-md text-white"
                    >
                      <option value={1000}>1 km (~0.6 mi)</option>
                      <option value={3000}>3 km (~2 mi)</option>
                      <option value={5000}>5 km (~3 mi)</option>
                      <option value={10000}>10 km (~6 mi)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Bedrooms
                    </label>
                    <select
                      value={exploreBedroomFilter ?? ''}
                      onChange={(e) => setExploreBedroomFilter(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full h-12 px-4 bg-slate-900/50 border border-slate-600 rounded-md text-white"
                    >
                      <option value="">Any</option>
                      <option value="1">1 BR</option>
                      <option value="2">2 BR</option>
                      <option value="3">3 BR</option>
                      <option value="4">4 BR</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Sort By
                    </label>
                    <select
                      value={exploreSortBy}
                      onChange={(e) => setExploreSortBy(e.target.value as typeof exploreSortBy)}
                      className="w-full h-12 px-4 bg-slate-900/50 border border-slate-600 rounded-md text-white"
                    >
                      <option value="revenue">Most Money</option>
                      <option value="proximity">Closest</option>
                    </select>
                  </div>
                </div>
                
                <Button
                  onClick={handleExplore}
                  disabled={isExploring || !exploreAddress}
                  className="w-full h-14 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold text-lg rounded-xl shadow-lg"
                >
                  {isExploring ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Finding Opportunities...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Search className="w-5 h-5" />
                      Find Opportunities
                    </span>
                  )}
                </Button>
              </div>
            )}
            
            {/* ============================================ */}
            {/* VALIDATE THE DEAL TAB */}
            {/* ============================================ */}
            {activeTab === 'validate' && (
              <div className="grid gap-6">
                <HelpSection
                  title="How This Tool Helps You"
                  description="Check if a specific property will actually make you money by comparing it to nearby successful Airbnbs"
                  steps={[
                    'Enter the property address you\'re considering',
                    'Enter the monthly rent you\'d pay',
                    'Select bedrooms and bathrooms',
                    'Click "Validate This Deal"',
                    'See if the numbers work for you'
                  ]}
                  isOpen={showHelp === 'validate'}
                  onToggle={() => setShowHelp(showHelp === 'validate' ? null : 'validate')}
                />
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Property Address
                  </label>
                  <AddressAutocomplete
                    value={address}
                    onChange={setAddress}
                    placeholder="Enter the property address..."
                    className="h-12 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Monthly Rent
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <Input
                        type="number"
                        value={monthlyRent}
                        onChange={(e) => setMonthlyRent(e.target.value)}
                        placeholder="2,000"
                        className="h-12 pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Bedrooms
                    </label>
                    <select
                      value={bedrooms}
                      onChange={(e) => setBedrooms(e.target.value)}
                      className="w-full h-12 px-4 bg-slate-900/50 border border-slate-600 rounded-md text-white"
                    >
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <option key={num} value={num}>{num} Bedroom{num > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Bathrooms
                    </label>
                    <select
                      value={bathrooms}
                      onChange={(e) => setBathrooms(e.target.value)}
                      className="w-full h-12 px-4 bg-slate-900/50 border border-slate-600 rounded-md text-white"
                    >
                      {[1, 1.5, 2, 2.5, 3, 3.5, 4].map(num => (
                        <option key={num} value={num}>{num} Bathroom{num > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !address}
                  className="w-full h-14 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold text-lg rounded-xl shadow-lg"
                >
                  {isAnalyzing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Validating Deal...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Validate This Deal
                    </span>
                  )}
                </Button>
              </div>
            )}
            
            {/* ============================================ */}
            {/* FIND THE BEST DEAL TAB */}
            {/* ============================================ */}
            {activeTab === 'compare' && (
              <div className="grid gap-6">
                <HelpSection
                  title="How This Tool Helps You"
                  description="Compare up to 25 properties side-by-side to find which one will make you the most money"
                  steps={[
                    'Add multiple property addresses',
                    'Enter rent and details for each',
                    'Click "Find the Winner"',
                    'See all properties ranked by profit',
                    'Choose the best deal with confidence'
                  ]}
                  isOpen={showHelp === 'compare'}
                  onToggle={() => setShowHelp(showHelp === 'compare' ? null : 'compare')}
                />
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Compare Up to 25 Properties</h3>
                    <p className="text-sm text-slate-400">Add properties to find which one makes the most money</p>
                  </div>
                  <span className="text-sm text-slate-500">{bulkProperties.length}/25 properties</span>
                </div>
                
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {bulkProperties.map((prop, index) => (
                    <div key={prop.id} className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-6 h-6 rounded-full bg-[#D4A84B]/20 text-[#D4A84B] text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-sm text-slate-400">Property {index + 1}</span>
                        {bulkProperties.length > 1 && (
                          <button
                            onClick={() => removeBulkProperty(prop.id)}
                            className="ml-auto text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2">
                          <AddressAutocomplete
                            value={prop.address}
                            onChange={(val) => updateBulkProperty(prop.id, 'address', val)}
                            placeholder="Property address..."
                            className="h-10 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 text-sm"
                          />
                        </div>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <Input
                            type="number"
                            value={prop.rent || ''}
                            onChange={(e) => updateBulkProperty(prop.id, 'rent', parseFloat(e.target.value) || 0)}
                            placeholder="Rent/mo"
                            className="h-10 pl-7 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={prop.bedrooms}
                            onChange={(e) => updateBulkProperty(prop.id, 'bedrooms', parseInt(e.target.value))}
                            className="flex-1 h-10 px-2 bg-slate-800/50 border border-slate-600 rounded-md text-white text-sm"
                          >
                            {[1, 2, 3, 4, 5, 6].map(num => (
                              <option key={num} value={num}>{num}BR</option>
                            ))}
                          </select>
                          <select
                            value={prop.bathrooms}
                            onChange={(e) => updateBulkProperty(prop.id, 'bathrooms', parseFloat(e.target.value))}
                            className="flex-1 h-10 px-2 bg-slate-800/50 border border-slate-600 rounded-md text-white text-sm"
                          >
                            {[1, 1.5, 2, 2.5, 3, 3.5, 4].map(num => (
                              <option key={num} value={num}>{num}BA</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={addBulkProperty}
                  disabled={bulkProperties.length >= 25}
                  className="w-full py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:text-white hover:border-slate-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Another Property
                </button>
                
                <Button
                  onClick={handleBulkAnalyze}
                  disabled={isBulkAnalyzing || bulkProperties.every(p => !p.address.trim())}
                  className="w-full h-14 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-lg rounded-xl shadow-lg"
                >
                  {isBulkAnalyzing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Finding the Winner...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      Find the Winner
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* RESULTS SECTIONS */}
      {/* ============================================ */}
      
      {/* Prove the Market Results */}
      {activeTab === 'prove' && researchResult && (
        <section className="py-12 bg-slate-900/50">
          <div className="container max-w-5xl mx-auto px-4">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-4">
                <CheckCircle2 className="w-4 h-4" />
                Market Proven
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {researchResult.marketName} Works!
              </h3>
              <p className="text-slate-400">
                Here's the proof that hosts are making real money in this market
              </p>
            </div>
            
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-400 mb-1">Avg Annual Revenue</p>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(researchResult.avgRevenue)}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-400 mb-1">Avg Nightly Rate</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(researchResult.avgAdr)}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-400 mb-1">Avg Occupancy</p>
                <p className="text-2xl font-bold text-white">{Math.round(researchResult.avgOccupancy)}%</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-400 mb-1">Active Listings</p>
                <p className="text-2xl font-bold text-white">{researchResult.totalListings.toLocaleString()}</p>
              </div>
            </div>
            
            {/* Property Types */}
            {researchResult.propertyTypes && researchResult.propertyTypes.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-8">
                <h4 className="text-lg font-semibold text-white mb-4">What's Working in This Market</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {researchResult.propertyTypes.slice(0, 6).map((type, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{type.type}</p>
                        <p className="text-sm text-slate-400">{type.count} listings</p>
                      </div>
                      <p className="text-emerald-400 font-semibold">{formatCurrency(type.avgRevenue)}/yr</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Next Step CTA */}
            <div className="text-center">
              <p className="text-slate-400 mb-4">Ready to find specific opportunities in this market?</p>
              <Button
                onClick={() => {
                  setExploreAddress(researchResult.marketName);
                  setActiveTab('find');
                }}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              >
                <Search className="w-4 h-4 mr-2" />
                Find Opportunities in {researchResult.marketName}
              </Button>
            </div>
          </div>
        </section>
      )}
      
      {/* Find Your Market Results */}
      {activeTab === 'find' && areaListings && (
        <section className="py-12 bg-slate-900/50">
          <div className="container max-w-5xl mx-auto px-4">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm font-medium mb-4">
                <CheckCircle2 className="w-4 h-4" />
                {totalListings} Opportunities Found
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Here's What's Making Money
              </h3>
              <p className="text-slate-400">
                These are real Airbnb properties near {exploreAddress}
              </p>
            </div>
            
            {/* View Toggle */}
            <div className="flex justify-center gap-2 mb-6">
              <button
                onClick={() => setShowMapView(false)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  !showMapView ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <List className="w-4 h-4 inline mr-2" />
                List View
              </button>
              <button
                onClick={() => setShowMapView(true)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  showMapView ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <Map className="w-4 h-4 inline mr-2" />
                Map View
              </button>
            </div>
            
            {/* Listings */}
            {!showMapView ? (
              <div className="grid gap-4">
                {areaListings.slice(0, 10).map((listing, idx) => (
                  <div key={listing.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-medium">{listing.title}</h4>
                      <p className="text-sm text-slate-400">
                        {listing.bedrooms} BR · {listing.bathrooms} BA · {listing.property_type}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-bold">{formatCurrency(listing.annual_revenue)}/yr</p>
                      <p className="text-sm text-slate-400">{Math.round(listing.occupancy)}% occupied</p>
                    </div>
                    {listing.airbnb_url && (
                      <a
                        href={listing.airbnb_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-slate-300" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              exploreCenter && (
                <div className="h-[500px] rounded-xl overflow-hidden border border-slate-700">
                  <MapView
                    initialCenter={exploreCenter}
                    initialZoom={13}
                    onMapReady={() => setMapReady(true)}
                  />
                </div>
              )
            )}
            
            {/* Next Step CTA */}
            <div className="text-center mt-8">
              <p className="text-slate-400 mb-4">Found a property you like? Validate if it will actually make you money.</p>
              <Button
                onClick={() => setActiveTab('validate')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Target className="w-4 h-4 mr-2" />
                Validate a Specific Deal
              </Button>
            </div>
          </div>
        </section>
      )}
      
      {/* Validate the Deal Results */}
      {activeTab === 'validate' && result && (
        <section className="py-12 bg-slate-900/50">
          <div className="container max-w-5xl mx-auto px-4">
            <div className="text-center mb-8">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4 ${
                result.cashFlow.monthlyProfit > 0 
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {result.cashFlow.monthlyProfit > 0 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Deal Validated - Profitable!
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    Warning - May Not Be Profitable
                  </>
                )}
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Your Property Analysis
              </h3>
              <p className="text-slate-400">{address}</p>
            </div>
            
            {/* Key Numbers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 text-center">
                <p className="text-sm text-slate-400 mb-2">Expected Monthly Revenue</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(result.cashFlow.monthlyRevenue)}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 text-center">
                <p className="text-sm text-slate-400 mb-2">Your Monthly Rent</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(result.cashFlow.monthlyRent)}</p>
              </div>
              <div className={`border rounded-xl p-6 text-center ${
                result.cashFlow.monthlyProfit > 0 
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <p className="text-sm text-slate-400 mb-2">Your Monthly Profit</p>
                <p className={`text-3xl font-bold ${
                  result.cashFlow.monthlyProfit > 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {formatCurrency(result.cashFlow.monthlyProfit)}
                </p>
              </div>
            </div>
            
            {/* Additional Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-400 mb-1">Nightly Rate</p>
                <p className="text-xl font-bold text-white">{formatCurrency(result.metrics.adr)}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-400 mb-1">Occupancy</p>
                <p className="text-xl font-bold text-white">{Math.round(result.metrics.occupancy)}%</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-400 mb-1">Annual Revenue</p>
                <p className="text-xl font-bold text-white">{formatCurrency(result.revenue.projected)}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-400 mb-1">Revenue Range</p>
                <p className="text-xl font-bold text-white">
                  {formatCurrency(result.revenue.low)} - {formatCurrency(result.revenue.high)}
                </p>
              </div>
            </div>
            
            {/* Comparables */}
            {result.comparables && result.comparables.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-8">
                <h4 className="text-lg font-semibold text-white mb-4">Similar Properties Making Money Nearby</h4>
                <div className="grid gap-3">
                  {result.comparables.slice(0, 5).map((comp, idx) => (
                    <div key={comp.id} className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-lg">
                      <span className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-sm font-medium">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-white font-medium">{comp.title}</p>
                        <p className="text-sm text-slate-400">{comp.bedrooms} BR · {comp.bathrooms} BA</p>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-semibold">{formatCurrency(comp.revenue)}/yr</p>
                        <p className="text-sm text-slate-400">{Math.round(comp.occupancy)}% occ</p>
                      </div>
                      {comp.airbnbUrl && (
                        <a
                          href={comp.airbnbUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 text-slate-300" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Next Step CTA */}
            <div className="text-center">
              <p className="text-slate-400 mb-4">Have multiple properties to compare? Find the best one.</p>
              <Button
                onClick={() => {
                  setBulkProperties([
                    { id: '1', address: address, bedrooms: parseInt(bedrooms), bathrooms: parseFloat(bathrooms), rent: parseFloat(monthlyRent) || 0 },
                    { id: '2', address: '', bedrooms: 2, bathrooms: 1, rent: 0 }
                  ]);
                  setActiveTab('compare');
                }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Compare With Other Properties
              </Button>
            </div>
          </div>
        </section>
      )}
      
      {/* Find the Best Deal Results */}
      {activeTab === 'compare' && sortedBulkResults && (
        <section className="py-12 bg-slate-900/50">
          <div className="container max-w-5xl mx-auto px-4">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm font-medium mb-4">
                <Trophy className="w-4 h-4" />
                Winner Found!
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Your Best Deal
              </h3>
              <p className="text-slate-400">
                Compared {sortedBulkResults.filter(r => r.status === 'success').length} properties to find the winner
              </p>
            </div>
            
            {/* Sort Controls */}
            <div className="flex justify-center gap-2 mb-6">
              {(['profit', 'revenue', 'ratio'] as const).map(sortType => (
                <button
                  key={sortType}
                  onClick={() => {
                    if (bulkSortBy === sortType) {
                      setBulkSortDir(bulkSortDir === 'desc' ? 'asc' : 'desc');
                    } else {
                      setBulkSortBy(sortType);
                      setBulkSortDir('desc');
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                    bulkSortBy === sortType ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {sortType === 'profit' ? 'Profit' : sortType === 'revenue' ? 'Revenue' : 'ROI Ratio'}
                  {bulkSortBy === sortType && (
                    bulkSortDir === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />
                  )}
                </button>
              ))}
            </div>
            
            {/* Results */}
            <div className="grid gap-4">
              {sortedBulkResults.map((result, idx) => (
                <div 
                  key={result.id} 
                  className={`border rounded-xl p-4 flex items-center gap-4 ${
                    idx === 0 && result.status === 'success'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : result.status === 'error'
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-slate-800/50 border-slate-700/50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                    idx === 0 && result.status === 'success'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}>
                    {idx === 0 && result.status === 'success' ? (
                      <Trophy className="w-6 h-6" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">{result.address}</h4>
                    <p className="text-sm text-slate-400">
                      {result.bedrooms} BR · {result.bathrooms} BA · {formatCurrency(result.rent)}/mo rent
                    </p>
                  </div>
                  {result.status === 'success' ? (
                    <div className="text-right">
                      <p className={`text-xl font-bold ${result.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(result.profit)}/mo
                      </p>
                      <p className="text-sm text-slate-400">
                        {formatCurrency(result.revenue)}/mo revenue · {result.ratio.toFixed(1)}x ratio
                      </p>
                    </div>
                  ) : (
                    <p className="text-red-400 text-sm">{result.error}</p>
                  )}
                </div>
              ))}
            </div>
            
            {/* CTA */}
            <div className="text-center mt-8 p-6 bg-gradient-to-r from-[#D4A84B]/10 to-[#4ECDC4]/10 border border-[#D4A84B]/20 rounded-xl">
              <h4 className="text-xl font-bold text-white mb-2">Ready to Take Action?</h4>
              <p className="text-slate-400 mb-4">
                Get personalized guidance on your next steps with Coach Inayah's Turnkey Program
              </p>
              <Button className="bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] hover:opacity-90">
                Learn About the Turnkey Program
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* FOOTER CTA */}
      {/* ============================================ */}
      <section className="py-16 border-t border-slate-800">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Start Your Journey?
          </h2>
          <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
            These free tools prove the opportunity is real. When you're ready for personalized guidance, 
            Coach Inayah's Turnkey Program will help you take action.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => setIsEbookOpen(true)}
              variant="outline" 
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Read the Guide First
            </Button>
            <Button className="bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] hover:opacity-90">
              Explore the Turnkey Program
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
