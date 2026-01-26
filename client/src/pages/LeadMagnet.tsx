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
import { AIAdvisorStep } from '@/components/AIAdvisorStep';
import PropertyCard from '@/components/PropertyCard';
import { CompDataTable } from '@/components/CompDataTable';
import { HistoricalCharts } from '@/components/HistoricalCharts';

import { 
  MapPin,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Bed,
  BedDouble,
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
  Shield,
  Bookmark,
  BookmarkCheck,
  Heart,
  HeartOff,
  Building
} from 'lucide-react';
import { MapView } from '@/components/Map';
import { MapViewContent } from '@/components/MapViewContent';
import MapFirstLayout from '@/components/MapFirstLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { HierarchicalLocationSelector, type LocationSelection } from '@/components/HierarchicalLocationSelector';
import { toast } from 'sonner';
import { useSavedItems } from '@/hooks/useSavedItems';
import { SavedItemsPanel } from '@/components/SavedItemsPanel';
import { StartWithProperty } from '@/components/StartWithProperty';
import { useProperty } from '@/contexts/PropertyContext';
import { TeslaDashboard } from '@/components/TeslaDashboard';
import { StandaloneMarketAdvisor } from '@/components/StandaloneMarketAdvisor';
import { NotificationBell } from '@/components/NotificationBell';

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
  images?: string[];  // All images for carousel
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
  marketInsights?: {
    professionallyManagedPct: number;
    superhostPct: number;
    avgRating?: number;
    totalListings?: number;
    marketScore?: number;
  };
  marketId?: string | number;  // For MarketInsightsPanel
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
  imageUrl?: string;
  propertyType?: string;
  rating?: number;
  reviews?: number;
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
    occupancy?: number;
  }>;
  seasonality: Array<{
    month: string;
    occupancy: number;
    adr: number;
  }>;
  // Step 1 Super Experience fields
  marketScores?: {
    overall: number;
    investability: number;
    rentalDemand: number;
    revenueGrowth: number;
    seasonality: number;
    regulation: number;
  };
  bookingPatterns?: {
    avgLeadTime: number;
    lastMinutePercent: number;
    advanceBookingPercent: number;
    avgLengthOfStay: number;
    weekendPercent: number;
    weekPlusPercent: number;
  };
  revenuePercentiles?: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  competitionData?: {
    professionallyManagedPct: number;
    superhostPct: number;
    entireHomePct: number;
    privateRoomPct: number;
    sharedRoomPct: number;
    singleHostPct: number;
    multiHostPct: number;
  };
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
  // Handle short month names like "Jan", "Feb"
  if (dateStr && dateStr.length <= 3) {
    return dateStr;
  }
  // Handle YYYY-MM format like "2026-01"
  if (dateStr && dateStr.includes('-') && dateStr.length === 7) {
    const [year, monthNum] = dateStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(monthNum, 10) - 1;
    return monthNames[monthIndex] || dateStr;
  }
  // Try parsing as date
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString('en-US', { month: 'short' });
  }
  return dateStr || 'N/A';
};

const getMonthAbbr = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short' }).substring(0, 3);
};

// ============================================
// MAIN COMPONENT
// ============================================
type TabType = 'ebook' | 'prove' | 'find' | 'validate' | 'compare' | 'map' | 'advisor' | 'market';

export default function LeadMagnet() {
  // Property context for property-centric workflow
  const { myProperty, hasProperty, bedroomFilter, setMyProperty } = useProperty();
  
  // Tab state - now in job sequence
  const [activeTab, setActiveTab] = useState<TabType>('ebook');
  
  // Ebook state
  const [isEbookExpanded, setIsEbookExpanded] = useState(true);
  const [isEbookOpen, setIsEbookOpen] = useState(false);
  
  // Help state
  const [showHelp, setShowHelp] = useState<TabType | null>(null);
  
  // Saved items
  const {
    savedMarkets,
    savedProperties,
    saveMarket,
    removeMarket,
    updateMarketNote,
    saveProperty,
    removeProperty,
    updatePropertyNote,
    isMarketSaved,
    isPropertySaved,
    clearAll,
    totalSaved,
  } = useSavedItems();
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  
  // ============================================
  // VALIDATE THE DEAL STATE (formerly Single Property)
  // ============================================
  const [address, setAddress] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [bedrooms, setBedrooms] = useState('2');
  const [bathrooms, setBathrooms] = useState('1');
  const [furnitureCost, setFurnitureCost] = useState('15000');
  const [expensePercent, setExpensePercent] = useState(20);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Rentometer state for rent validation
  const [rentometerData, setRentometerData] = useState<{
    median: number;
    percentile25: number;
    percentile75: number;
    min: number;
    max: number;
    sampleCount: number;
    userRentVsMarket: 'below' | 'at' | 'above';
    rentAdvantage: number;
    percentileRank: number;
  } | null>(null);
  const [isLoadingRentometer, setIsLoadingRentometer] = useState(false);
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
  const [exploreSortBy, setExploreSortBy] = useState<'proximity' | 'revenue' | 'rating' | 'occupancy' | 'revpar'>('revenue');
  const [explorePropertyType, setExplorePropertyType] = useState<string | null>(null);
  const [exploreMinOccupancy, setExploreMinOccupancy] = useState<number | null>(null);
  const [exploreMinRevenue, setExploreMinRevenue] = useState<number | null>(null);
  const [exploreSuperhostOnly, setExploreSuperhostOnly] = useState(false);
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
  const [marketSuggestions, setMarketSuggestions] = useState<Array<{
    id: string;
    name: string;
    type: 'market' | 'submarket';
    listingCount: number;
    state?: string;
    locationName?: string;
    parentMarket?: { id: string; name: string };
  }>>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [locationSelection, setLocationSelection] = useState<LocationSelection | null>(null);

  // ============================================
  // TRPC MUTATIONS
  // ============================================
  const analyzeProperty = trpc.rental.getPropertyReport.useMutation();
  const getAreaListings = trpc.listingsByArea.get.useMutation();
  const searchMarkets = trpc.marketResearchSimple.searchMarkets.useMutation();
  const getMarketReport = trpc.marketResearchSimple.getMarketReport.useMutation();
  const getSubmarketReport = trpc.marketResearchSimple.getSubmarketReport.useMutation();
  const getMarketReportByLocation = trpc.marketResearchSimple.getMarketReportByLocation.useMutation();
  const analyzeRent = trpc.rentometer.analyzeRent.useMutation();

  // ============================================
  // AUTO-POPULATE FROM PROPERTY CONTEXT
  // ============================================
  useEffect(() => {
    // When property context changes, auto-populate bedroom filter for apples-to-apples comparison
    if (hasProperty && myProperty?.bedrooms) {
      // Step 2: Explore Listings - set bedroom filter for apples-to-apples
      setExploreBedroomFilter(myProperty.bedrooms);
      
      // Step 3: Validate the Deal - auto-populate form if not already set
      if (!address && myProperty.address) {
        setAddress(myProperty.address);
        setBedrooms(String(myProperty.bedrooms));
        setBathrooms(String(myProperty.bathrooms));
        if (myProperty.monthlyRent) {
          setMonthlyRent(String(myProperty.monthlyRent));
        }
      }
      // Note: Step 4 (Find the Best Deal) is intentionally NOT auto-populated
      // because it's for comparing multiple different properties
    }
  }, [hasProperty, myProperty]);

  // ============================================
  // DEBOUNCED MARKET SEARCH
  // ============================================
  useEffect(() => {
    // Don't search if input is too short or empty
    if (researchMarket.length < 2) {
      setMarketSuggestions([]);
      return;
    }
    
    // Debounce the search
    const timeoutId = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const results = await searchMarkets.mutateAsync({ query: researchMarket });
        setMarketSuggestions(results);
      } catch (error) {
        console.error('Error searching markets:', error);
        setMarketSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [researchMarket]);

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
    setRentometerData(null); // Clear previous rentometer data
    
    try {
      // Fetch Rentometer data in parallel if rent is provided
      const rentValue = parseFloat(monthlyRent) || 0;
      if (rentValue > 0 && address) {
        setIsLoadingRentometer(true);
        try {
          const rentometerResponse = await analyzeRent.mutateAsync({
            address,
            bedrooms: parseInt(bedrooms),
            userRent: rentValue,
          });
          if (rentometerResponse.success && rentometerResponse.data) {
            const data = rentometerResponse.data;
            const userRentVsMarket = data.userRentComparison.rentAdvantage > 0 ? 'below' 
              : data.userRentComparison.rentAdvantage < 0 ? 'above' 
              : 'at';
            // Calculate percentile rank based on where user's rent falls
            const userRent = rentValue;
            let percentileRank = 50; // default to median
            if (userRent <= data.marketData.percentile25) {
              percentileRank = 25;
            } else if (userRent <= data.marketData.median) {
              percentileRank = 50 - ((data.marketData.median - userRent) / (data.marketData.median - data.marketData.percentile25)) * 25;
            } else if (userRent <= data.marketData.percentile75) {
              percentileRank = 50 + ((userRent - data.marketData.median) / (data.marketData.percentile75 - data.marketData.median)) * 25;
            } else {
              percentileRank = 75 + ((userRent - data.marketData.percentile75) / (data.marketData.max - data.marketData.percentile75)) * 25;
            }
            
            setRentometerData({
              median: data.marketData.median,
              percentile25: data.marketData.percentile25,
              percentile75: data.marketData.percentile75,
              min: data.marketData.min,
              max: data.marketData.max,
              sampleCount: data.marketData.samples,
              userRentVsMarket,
              rentAdvantage: data.userRentComparison.rentAdvantage,
              percentileRank: Math.round(percentileRank),
            });
          }
        } catch (rentError) {
          console.log('[Rentometer] Could not fetch rent data:', rentError);
          // Don't fail the main analysis if Rentometer fails
        } finally {
          setIsLoadingRentometer(false);
        }
      }
      const loadingInterval = setInterval(() => {
        setLoadingStep(prev => prev < 4 ? prev + 1 : prev);
      }, 1500);
      
      // Add timeout handling - 45 second timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. The property analysis is taking longer than expected. Please try again.')), 45000);
      });
      
      const response = await Promise.race([
        analyzeProperty.mutateAsync({
          address,
          bedrooms: parseInt(bedrooms),
          bathrooms: parseFloat(bathrooms),
        }),
        timeoutPromise
      ]);
      
      clearInterval(loadingInterval);
      
      if (!response.success || !response.data) {
        toast.error(response.error || 'Could not analyze this property');
        return;
      }
      
      const data = response.data;
      console.log('[Validate Deal] API Response:', JSON.stringify(data, null, 2));
      console.log('[Validate Deal] Property estimates:', data.property?.estimates);
      const rent = parseFloat(monthlyRent) || 0;
      const annualRevenue = data.property.estimates?.annual_revenue || 0;
      console.log('[Validate Deal] Annual revenue:', annualRevenue);
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
          // Convert occupancy from decimal to percentage if needed (API returns 0.57 for 57%)
          occupancy: (() => {
            const occ = data.property.estimates?.occupancy_rate || 0;
            return occ < 1 ? Math.round(occ * 100) : Math.round(occ);
          })(),
        },
        cashFlow: {
          monthlyRevenue,
          monthlyRent: rent,
          monthlyProfit: monthlyRevenue - rent,
        },
        forecast: (data.property?.monthly_forecast || []).map((m: any) => ({
          month: m.month,
          revenue: m.revenue || 0,
          adr: m.adr || 0,
          occupancy: (m.occupancy || 0) > 1 ? m.occupancy : (m.occupancy || 0) * 100,
        })),
        comparables: (data.same_bedroom_comps || []).map((c: any) => ({
          id: c.id || String(Math.random()),
          title: c.title || `${c.bedrooms}BR Property`,
          bedrooms: c.bedrooms,
          bathrooms: c.bathrooms,
          accommodates: c.accommodates,
          revenue: c.annual_revenue || 0,
          adr: c.adr || 0,
          // Convert occupancy from decimal to percentage if needed (API returns 0.57 for 57%)
          occupancy: (() => {
            const occ = c.occupancy || 0;
            return occ < 1 ? Math.round(occ * 100) : Math.round(occ);
          })(),
          rating: c.rating || 0,
          reviews: c.reviews || 0,
          imageUrl: c.image_url || c.thumbnail_url || undefined,
          images: c.images || [],
          airbnbUrl: c.airbnb_url,
          distanceMeters: c.distance_meters,
        })),
        // Market insights for professional management and superhost stats
        marketInsights: data.insights ? {
          professionallyManagedPct: data.insights.professionally_managed_pct || 0,
          superhostPct: data.insights.superhost_pct || 0,
          avgRating: (() => {
            const comps = data.same_bedroom_comps || [];
            if (comps.length === 0) return undefined;
            const ratings = comps.filter((c: any) => c.rating && c.rating > 0).map((c: any) => c.rating);
            return ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : undefined;
          })(),
          totalListings: data.market?.listing_count || (data.same_bedroom_comps || []).length,
          marketScore: data.market?.metrics?.market_score || undefined,
        } : undefined,
        // Market ID for MarketInsightsPanel
        marketId: (() => {
          const id = data.market?.id;
          console.log('[handleAnalyze] market data:', data.market);
          console.log('[handleAnalyze] marketId:', id);
          // Debug: show toast with marketId
          if (id) {
            toast.success(`MarketId found: ${id}`);
          } else {
            toast.error('MarketId not found in API response');
          }
          return id || undefined;
        })(),
        // Historical data for YoY trends - always use market.historical for months data
        historicalData: (() => {
          // Use market.historical for monthly data (needed for per-month YoY comparison)
          const historical = data.market?.historical;
          if (!historical?.revenue || historical.revenue.length < 2) {
            // Fallback: if no market historical data, use historical_valuation summary only
            const historicalValuation = data.historical_valuation;
            if (historicalValuation && historicalValuation.yoy_perc_chg !== undefined) {
              return {
                summary: {
                  monthly_pct_change: historicalValuation.mom_perc_chg || historicalValuation.yoy_perc_chg / 12,
                  yearly_pct_change: historicalValuation.yoy_perc_chg,
                  trend: historicalValuation.yoy_perc_chg > 2 ? 'up' as const : historicalValuation.yoy_perc_chg < -2 ? 'down' as const : 'stable' as const,
                },
                months: [],
              };
            }
            return undefined;
          }
          
          // Get the most recent 12 months and previous 12 months to calculate YoY change
          const sortedRevenue = [...historical.revenue].sort((a, b) => 
            new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
          );
          
          // Also get occupancy and ADR historical data
          const sortedOccupancy = historical.occupancy ? [...historical.occupancy].sort((a, b) => 
            new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
          ) : [];
          const sortedAdr = historical.adr ? [...historical.adr].sort((a, b) => 
            new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
          ) : [];
          
          if (sortedRevenue.length < 13) return undefined;
          
          const currentYearRevenue = sortedRevenue.slice(0, 12).reduce((sum, m) => sum + (m.value || 0), 0);
          const previousYearRevenue = sortedRevenue.slice(12, 24).reduce((sum, m) => sum + (m.value || 0), 0);
          
          if (previousYearRevenue === 0) return undefined;
          
          const yoyChange = ((currentYearRevenue - previousYearRevenue) / previousYearRevenue) * 100;
          
          // Build months array with all metrics for YoY comparison
          const months = sortedRevenue.slice(0, 24).map((m, idx) => {
            // Find matching occupancy and ADR by date
            const occupancyData = sortedOccupancy.find(o => o.date === m.date);
            const adrData = sortedAdr.find(a => a.date === m.date);
            
            return {
              date: m.date || '',
              revenue: m.value || 0,
              occupancy: occupancyData?.value || 0,
              adr: adrData?.value || 0,
            };
          });
          
          return {
            summary: {
              monthly_pct_change: yoyChange / 12,
              yearly_pct_change: yoyChange,
              trend: yoyChange > 2 ? 'up' as const : yoyChange < -2 ? 'down' as const : 'stable' as const,
            },
            months,
          };
        })(),
      });
      
      toast.success('Property validated! See your results below.');
      console.log('[handleAnalyze] Result set successfully:', { hasResult: true, activeTab });
    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Could not analyze this property. Please try again.';
      toast.error(errorMessage);
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
    
    // Check if any property is missing rent
    const propertiesWithoutRent = validProperties.filter(p => !p.rent || p.rent <= 0);
    if (propertiesWithoutRent.length > 0) {
      toast.error(`Please enter monthly rent for all properties (${propertiesWithoutRent.length} missing)`);
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
        
        // Get image from first comparable property if available
        const firstComp = data.property.comps?.[0];
        const imageUrl = firstComp?.image_url || undefined;
        const propertyType = firstComp?.property_type || undefined;
        const rating = firstComp?.rating || undefined;
        const reviews = firstComp?.reviews || undefined;
        
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
          // Convert occupancy from decimal to percentage if needed (API returns 0.57 for 57%)
          occupancy: (() => {
            const occ = data.property.estimates?.occupancy_rate || 0;
            return occ < 1 ? Math.round(occ * 100) : Math.round(occ);
          })(),
          status: 'success',
          imageUrl,
          propertyType,
          rating,
          reviews,
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
        sortBy: exploreSortBy === 'revpar' ? 'revenue' : exploreSortBy,
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
  
  const handleResearch = async (directSelection?: LocationSelection) => {
    // Support hierarchical selection at any level
    // Use directSelection if provided (for immediate calls after state update)
    const selection = directSelection || locationSelection;
    const hasHierarchicalSelection = selection && (selection.market || selection.submarket || selection.zipcode);
    
    if (!researchMarket && !hasHierarchicalSelection) {
      toast.error('Please select a location');
      return;
    }
    
    setIsResearching(true);
    setShowMarketSuggestions(false);
    
    try {
      let report;
      
      // If we have a hierarchical selection, use the appropriate endpoint
      if (hasHierarchicalSelection && selection) {
        // Check the selection level: zipcode > submarket > market
        if (selection.zipcode && selection.submarket?.id) {
          // For zip code, we use the submarket data but display with zip code context
          // The submarket endpoint gives us the most specific data available
          const submarketId = selection.submarket.id;
          const submarketName = `${selection.zipcode} (${selection.submarket.name})`;
          console.log(`[handleResearch] Using submarket endpoint for zip code ${selection.zipcode} in ${selection.submarket.name}`);
          report = await getSubmarketReport.mutateAsync({ submarketId, submarketName });
        } else if (selection.submarket?.id) {
          // Use submarket endpoint for neighborhood-level data
          const submarketId = selection.submarket.id;
          const submarketName = selection.submarket.name;
          console.log(`[handleResearch] Using submarket endpoint for ${submarketName} (${submarketId})`);
          report = await getSubmarketReport.mutateAsync({ submarketId, submarketName });
        } else if (selection.market?.id) {
          // Check if this is a submarket being treated as a market (e.g., Downtown Nashville, Glendale AZ)
          if (selection.market.isSubmarketAsMarket) {
            // Use submarket endpoint for submarkets selected as markets
            const submarketId = selection.market.id;
            const submarketName = selection.market.name;
            console.log(`[handleResearch] Using submarket endpoint for market-as-submarket: ${submarketName} (${submarketId})`);
            report = await getSubmarketReport.mutateAsync({ submarketId, submarketName });
          } else {
            // Use market endpoint for regular city-level data
            const marketId = selection.market.id;
            const marketName = selection.market.name;
            console.log(`[handleResearch] Using market endpoint for ${marketName} (${marketId})`);
            report = await getMarketReport.mutateAsync({ marketId, marketName });
          }
        } else {
          // Fallback to location-based search
          report = await getMarketReportByLocation.mutateAsync({ location: researchMarket });
        }
      } else {
        // Use the location-based endpoint for text search
        report = await getMarketReportByLocation.mutateAsync({ location: researchMarket });
      }
      
      setSelectedMarketId(report.market.id);
      
      // Transform to our result format
      // Use the user's searched zip code in the display name if available
      // Use selection (which is directSelection or locationSelection) to avoid race conditions
      let displayMarketName = report.market.name;
      if (selection?.zipcode) {
        // For zip code searches, show the user's searched zip code with the market name
        const marketNameWithoutZip = report.market.name.replace(/\s*\d{5}\s*/, '').trim();
        displayMarketName = `${marketNameWithoutZip} ${selection.zipcode}`;
      }
      
      console.log('[handleResearch] Raw report:', JSON.stringify(report, null, 2));
      console.log('[handleResearch] report.overview.avgRevenue:', report.overview.avgRevenue);
      console.log('[handleResearch] report.overview.avgOccupancy:', report.overview.avgOccupancy);
      console.log('[handleResearch] report.overview.avgAdr:', report.overview.avgAdr);
      console.log('[handleResearch] report.overview.totalListings:', report.overview.totalListings);
      
      setResearchResult({
        marketName: displayMarketName,
        avgRevenue: report.overview.avgRevenue,
        avgAdr: report.overview.avgAdr,
        avgOccupancy: report.overview.avgOccupancy,
        totalListings: report.overview.totalListings,
        propertyTypes: report.bedroomBreakdown.map(b => ({
          type: `${b.bedrooms} Bedroom`,
          count: b.count,
          avgRevenue: b.avgRevenue,
          occupancy: b.avgOccupancy
        })),
        seasonality: report.seasonality.monthlyData.map(m => ({
          month: m.month,
          occupancy: m.occupancy,
          adr: m.adr
        })),
        // Step 1 Super Experience fields
        marketScores: (report as any).marketScores,
        bookingPatterns: (report as any).bookingPatterns,
        revenuePercentiles: (report as any).revenuePercentiles,
        competitionData: (report as any).competitionData,
      });
      
      toast.success('Market proven! See the real revenue data below.');
    } catch (error) {
      console.error('Research error:', error);
      toast.error('Could not research this market. Please try again.');
    } finally {
      setIsResearching(false);
    }
  };
  
  // Handle hierarchical location search
  const handleHierarchicalSearch = async (selection: LocationSelection) => {
    setLocationSelection(selection);
    
    // Build a display name for the selection
    let displayName = '';
    if (selection.zipcode) {
      displayName = `${selection.zipcode}, ${selection.submarket?.name}`;
    } else if (selection.submarket) {
      displayName = `${selection.submarket.name}, ${selection.market?.name}`;
    } else if (selection.market) {
      displayName = selection.market.name;
    }
    
    setResearchMarket(displayName);
    
    // Trigger the research - pass selection directly to avoid state timing issues
    handleResearch(selection);
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
    ebook: {
      title: "Read the Guide",
      subtitle: "Learn the fundamentals of Airbnb arbitrage",
      job: "Answer: How does this business actually work?",
      icon: BookOpen,
      color: "from-violet-500 to-purple-500"
    },
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
    },
    map: {
      title: "See the Map",
      subtitle: "Visualize competitors and compare your property location",
      job: "Answer: How does my property compare to nearby competition?",
      icon: Map,
      color: "from-teal-500 to-cyan-500"
    },
    advisor: {
      title: "AI Advisor",
      subtitle: "Get comprehensive AI-powered analysis of your property or market",
      job: "Answer: What does all this data mean for me?",
      icon: Sparkles,
      color: "from-amber-500 to-yellow-500"
    },
    market: {
      title: "Market Advisor",
      subtitle: "Deep-dive into any market with 5 years of data",
      job: "Answer: Is this market worth investing in?",
      icon: TrendingUp,
      color: "from-blue-500 to-indigo-500"
    }
  };

  // ============================================
  // RENDER
  // ============================================
  
  return (
    <div className="min-h-screen bg-white">
      
      {/* Fixed Notification Bell */}
      <div className="fixed top-4 right-4 z-50">
        <NotificationBell />
      </div>
      
      {/* ============================================ */}
      {/* HERO HEADLINE */}
      {/* ============================================ */}
      <section className="relative pt-12 pb-8 md:pt-20 md:pb-12 bg-gradient-to-b from-[oklch(0.98_0_0)] to-white">
        <div className="container max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[oklch(0.75_0.14_75)]/10 border border-[oklch(0.75_0.14_75)]/20 rounded-full text-[oklch(0.55_0.12_75)] text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Free Tools by Coach Inayah
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-[oklch(0.15_0_0)] mb-6 leading-tight">
            Discover Your Path to{' '}
            <span className="text-[oklch(0.55_0.14_75)]">Rental Riches</span>
          </h1>
          <p className="text-lg md:text-xl text-[oklch(0.45_0_0)] max-w-2xl mx-auto leading-relaxed mb-8">
            Use these free tools to analyze any market, validate any property, and find profitable Airbnb opportunities—before you invest a single dollar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => {
                const toolsSection = document.getElementById('tools-section');
                if (toolsSection) {
                  toolsSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="btn-gold-light flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Start Analyzing Now
            </button>
            <a 
              href="https://masterclass.coachinayah.com/the-turnkey-program"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline-light flex items-center justify-center gap-2"
            >
              Learn About the Turnkey Program
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
      

      {/* ============================================ */}
      {/* TOOLS SECTION - JOB-FOCUSED */}
      {/* ============================================ */}
      <section id="tools-section" className="section-padding">
        <div className="container max-w-4xl mx-auto">
          
          {/* Start With Property - Property-Centric Entry Point */}
          <div className="mb-12">
            <StartWithProperty
              onPropertySet={(property) => {
                // When property is set, auto-fill the validate form
                setAddress(property.address);
                setBedrooms(String(property.bedrooms));
                setBathrooms(String(property.bathrooms));
                if (property.monthlyRent) {
                  setMonthlyRent(String(property.monthlyRent));
                }
              }}
              onNavigateToStep={(step) => {
                setActiveTab(step as TabType);
              }}
            />
          </div>
          
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-[oklch(0.55_0.14_75)]/10 border border-[oklch(0.55_0.14_75)]/20 rounded-full text-gold text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              Free Tools That Do The Work For You
            </div>
            <h2 className="text-4xl md:text-5xl font-semibold text-[oklch(0.15_0_0)] mb-6">
              Your Journey to{' '}
              <span className="text-gradient-gold">
                Rental Riches
              </span>
            </h2>
            <p className="text-[oklch(0.45_0_0)] text-xl max-w-xl mx-auto leading-relaxed">
              Each tool answers a specific question on your path to profitable short-term rentals
            </p>
            
            {/* Saved Items Button */}
            {totalSaved > 0 && (
              <button
                onClick={() => setShowSavedPanel(!showSavedPanel)}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[oklch(0.78_0.12_75)]/10 border border-[oklch(0.78_0.12_75)]/30 rounded-full text-[oklch(0.78_0.12_75)] text-sm font-medium hover:bg-[oklch(0.78_0.12_75)]/20 transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                {totalSaved} Saved Item{totalSaved !== 1 ? 's' : ''}
              </button>
            )}
          </div>
          
          {/* Saved Items Panel */}
          {showSavedPanel && (
            <div className="mb-12 bg-[oklch(0.98_0_0)] border border-[oklch(0.90_0_0)] rounded-2xl p-6">
              <SavedItemsPanel
                savedMarkets={savedMarkets}
                savedProperties={savedProperties}
                onRemoveMarket={removeMarket}
                onRemoveProperty={removeProperty}
                onUpdateMarketNote={updateMarketNote}
                onUpdatePropertyNote={updatePropertyNote}
                onClearAll={clearAll}
                onUseProperty={(property) => {
                  // Auto-fill Step 3 form with saved property data
                  setAddress(property.address);
                  setBedrooms(String(property.bedrooms));
                  setBathrooms(String(property.bathrooms));
                  // Switch to validate tab
                  setActiveTab('validate');
                  // Close the saved panel
                  setShowSavedPanel(false);
                  // Scroll to the form
                  setTimeout(() => {
                    document.getElementById('tools-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                  toast.success('Property loaded! Enter the monthly rent to validate.');
                }}
                onCompareProperties={(properties) => {
                  // Auto-fill Step 4 form with selected properties
                  const bulkInputs = properties.map((prop, index) => ({
                    id: String(index + 1),
                    address: prop.address,
                    bedrooms: prop.bedrooms,
                    bathrooms: prop.bathrooms,
                    rent: 0 // User will need to enter rent
                  }));
                  setBulkProperties(bulkInputs);
                  // Switch to compare tab
                  setActiveTab('compare');
                  // Close the saved panel
                  setShowSavedPanel(false);
                  // Scroll to the form
                  setTimeout(() => {
                    document.getElementById('tools-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                  toast.success(`${properties.length} properties loaded! Enter the monthly rent for each to compare.`);
                }}
              />
            </div>
          )}
          
          {/* Job-Focused Tab Navigation */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {(['ebook', 'prove', 'find', 'validate', 'compare', 'map', 'market', 'advisor'] as TabType[]).map((tab, index) => {
              const job = jobDescriptions[tab];
              const Icon = job.icon;
              const isActive = activeTab === tab;
              
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative p-4 rounded-2xl transition-all duration-300 text-left hover-lift w-[140px] flex-shrink-0 ${
                    isActive
                      ? 'apple-card ring-2 ring-[oklch(0.55_0.14_75)]/30'
                      : 'apple-card'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`step-badge flex-shrink-0 ${
                      isActive 
                        ? 'bg-[oklch(0.55_0.14_75)]' 
                        : 'bg-[oklch(0.92_0_0)]'
                    }`}>
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[oklch(0.50_0_0)]'}`} />
                    </div>
                    <span className="text-[10px] text-[oklch(0.55_0_0)] font-medium uppercase tracking-wider whitespace-nowrap">
                      {tab === 'ebook' ? 'Guide' : tab === 'map' ? 'Step 5' : tab === 'market' ? 'Step 6' : tab === 'advisor' ? 'Step 7' : `Step ${index}`}
                    </span>
                  </div>
                  <h3 className={`font-semibold text-sm mb-1 ${isActive ? 'text-[oklch(0.55_0.14_75)]' : 'text-[oklch(0.25_0_0)]'}`}>
                    {job.title}
                  </h3>
                  <p className="text-xs text-[oklch(0.55_0_0)] leading-snug line-clamp-2">
                    {job.job}
                  </p>
                </button>
              );
            })}
          </div>
          
          
          {/* Tool Content Area */}
          <div className="apple-card p-8 md:p-12">
            
            {/* Current Job Header */}
            <div className="mb-10 pb-10 border-b border-[oklch(0.92_0_0)]">
              <div className="flex items-center gap-5 mb-4">
                {(() => {
                  const job = jobDescriptions[activeTab];
                  const Icon = job.icon;
                  return (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-[oklch(0.55_0.14_75)] flex items-center justify-center glow-gold">
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl md:text-3xl font-semibold text-[oklch(0.15_0_0)]">{job.title}</h3>
                        <p className="text-[oklch(0.50_0_0)] text-lg">{job.subtitle}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <p className="text-gold font-medium text-lg mt-5">
                {jobDescriptions[activeTab].job}
              </p>
            </div>
            
            {/* ============================================ */}
            {/* EBOOK TAB */}
            {/* ============================================ */}
            {activeTab === 'ebook' && (
              <div className="space-y-8">
                <div className="text-center mb-8">
                  <p className="text-[oklch(0.50_0_0)] text-lg leading-relaxed">
                    Start here to learn the fundamentals of Airbnb arbitrage. This guide will teach you everything you need to know before using the analysis tools.
                  </p>
                </div>
                <InlineEbook onStartTools={() => {
                  setActiveTab('prove');
                }} />
              </div>
            )}
            
            {/* ============================================ */}
            {/* PROVE THE MARKET TAB */}
            {/* ============================================ */}
            {activeTab === 'prove' && (
              <div className="space-y-8">
                <HelpSection
                  title="How This Tool Helps You"
                  description="See real revenue data from actual Airbnb hosts to prove that short-term rentals make money in any market"
                  example="You're curious about Nashville and want to see if hosts there are actually making good money before you invest any time researching properties."
                  steps={[
                    'Select a state from the dropdown',
                    'Choose a city/metro, then optionally narrow down to neighborhood or zip code',
                    'Click the search button at your desired level',
                    'See average revenue hosts are actually making',
                    'View occupancy rates and seasonal trends'
                  ]}
                  isOpen={showHelp === 'prove'}
                  onToggle={() => setShowHelp(showHelp === 'prove' ? null : 'prove')}
                />
                
                {/* Hierarchical Location Selector */}
                <div className="space-y-4">
                  <label className="block text-base font-medium text-[oklch(0.25_0_0)]">
                    Select Your Market
                  </label>
                  <HierarchicalLocationSelector
                    onSelectionChange={setLocationSelection}
                    onSearch={handleHierarchicalSearch}
                    disabled={isResearching}
                  />
                </div>
                
                {/* Loading indicator when researching */}
                {isResearching && (
                  <div className="flex items-center justify-center gap-3 py-8">
                    <div className="w-6 h-6 border-2 border-[oklch(0.75_0.15_75)]/30 border-t-[oklch(0.75_0.15_75)] rounded-full animate-spin" />
                    <span className="text-[oklch(0.50_0_0)] text-lg">Analyzing market data...</span>
                  </div>
                )}
              </div>
            )}
            
            {/* ============================================ */}
            {/* FIND YOUR MARKET TAB */}
            {/* ============================================ */}
            {activeTab === 'find' && (
              <div className="space-y-8">
                <HelpSection
                  title="What You'll Discover"
                  description="See every successful Airbnb in your target area. Perfect for finding which neighborhoods and property types perform best before you start looking at specific deals."
                  example="You've decided Nashville looks promising and now you want to see which specific neighborhoods have the highest-earning properties before you start searching Zillow."
                  steps={[
                    'Enter a city or neighborhood you want to explore',
                    'Adjust the search radius (1-10 km)',
                    'Filter by bedroom count if you have a preference',
                    'Click "Find Opportunities" to search',
                    'Browse all active listings ranked by annual revenue'
                  ]}
                  isOpen={showHelp === 'find'}
                  onToggle={() => setShowHelp(showHelp === 'find' ? null : 'find')}
                />
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                    Location to Explore
                  </label>
                  <AddressAutocomplete
                    value={exploreAddress}
                    onChange={setExploreAddress}
                    placeholder="Enter a city or neighborhood..."
                    className="input-apple h-12"
                    variant="light"
                  />
                </div>
                
                {/* Search Filters */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                      Radius
                    </label>
                    <select
                      value={exploreRadius}
                      onChange={(e) => setExploreRadius(parseInt(e.target.value))}
                      className="input-apple h-12"
                    >
                      <option value={1000}>1 km (~0.6 mi)</option>
                      <option value={3000}>3 km (~2 mi)</option>
                      <option value={5000}>5 km (~3 mi)</option>
                      <option value={10000}>10 km (~6 mi)</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)] flex items-center gap-2">
                      Beds
                      {hasProperty && exploreBedroomFilter === myProperty?.bedrooms && (
                        <span className="text-xs px-2 py-0.5 bg-[oklch(0.55_0.14_75)]/10 text-[oklch(0.55_0.14_75)] rounded-full">
                          Apples-to-apples
                        </span>
                      )}
                    </label>
                    <select
                      value={exploreBedroomFilter ?? ''}
                      onChange={(e) => setExploreBedroomFilter(e.target.value ? parseInt(e.target.value) : null)}
                      className="input-apple h-12"
                    >
                      <option value="">Any</option>
                      <option value="1">1 Bedroom</option>
                      <option value="2">2 Bedrooms</option>
                      <option value="3">3 Bedrooms</option>
                      <option value="4">4+ Bedrooms</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                    Sort
                  </label>
                  <select
                    value={exploreSortBy}
                    onChange={(e) => setExploreSortBy(e.target.value as typeof exploreSortBy)}
                    className="input-apple h-12"
                  >
                    <option value="revenue">Highest Revenue</option>
                    <option value="proximity">Closest to Address</option>
                    <option value="occupancy">Highest Occupancy</option>
                    <option value="rating">Best Rated</option>
                  </select>
                </div>
                
                <button
                  onClick={handleExplore}
                  disabled={isExploring || !exploreAddress}
                  className="btn-gold w-full h-12 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isExploring ? (
                    <>
                      <div className="w-5 h-5 border-2 border-[oklch(0.55_0.14_75)]/30 border-t-[oklch(0.55_0.14_75)] rounded-full animate-spin" />
                      <span>Finding Opportunities...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      <span>Find Opportunities</span>
                    </>
                  )}
                </button>
              </div>
            )}
            
            {/* ============================================ */}
            {/* VALIDATE THE DEAL TAB */}
            {/* ============================================ */}
            {activeTab === 'validate' && (
              <div className="space-y-8">
                <HelpSection
                  title="Run the Numbers on Your Deal"
                  description="Found a property you like? Enter the exact address and rent amount to see projected revenue, profit margins, and how it compares to similar properties nearby."
                  example="You found a 2-bedroom apartment on Zillow for $1,800/month in East Nashville and want to know if it will actually make you money as a short-term rental."
                  steps={[
                    'Enter the exact property address you found',
                    'Enter the monthly rent the landlord is asking',
                    'Select the bedroom and bathroom count',
                    'Click "Validate This Deal" to analyze',
                    'Review projected revenue, profit, and market comparison'
                  ]}
                  isOpen={showHelp === 'validate'}
                  onToggle={() => setShowHelp(showHelp === 'validate' ? null : 'validate')}
                />
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                    Property Address
                  </label>
                  <AddressAutocomplete
                    value={address}
                    onChange={setAddress}
                    placeholder="Enter the property address..."
                    variant="light"
                  />
                </div>
                
                {/* Monthly Rent or Mortgage */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                    Rent or Mortgage <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      value={monthlyRent}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Prevent negative values
                        if (val === '' || parseFloat(val) >= 0) {
                          setMonthlyRent(val);
                          // Clear rentometer data when rent changes
                          setRentometerData(null);
                        }
                      }}
                      placeholder="2000"
                      className="input-apple h-12"
                    />
                    {isLoadingRentometer && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                </div>
                
                {/* Bedrooms & Bathrooms */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                      Beds
                    </label>
                    <select
                      value={bedrooms}
                      onChange={(e) => setBedrooms(e.target.value)}
                      className="input-apple h-12"
                    >
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <option key={num} value={num}>{num} Bedroom{num > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                      Baths
                    </label>
                    <select
                      value={bathrooms}
                      onChange={(e) => setBathrooms(e.target.value)}
                      className="input-apple h-12"
                    >
                      {[1, 1.5, 2, 2.5, 3, 3.5, 4].map(num => (
                        <option key={num} value={num}>{num} Bathroom{num > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Furniture/Setup Cost */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                    Furniture & Setup Cost
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={furnitureCost}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) {
                        setFurnitureCost(val);
                      }
                    }}
                    placeholder="15000"
                    className="input-apple h-12"
                  />
                  <p className="text-xs text-slate-500">Estimated cost to furnish and set up the property</p>
                </div>
                
                {/* Expense Percentage Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                      Operating Expenses
                    </label>
                    <span className="text-sm font-semibold text-amber-600">{expensePercent}%</span>
                  </div>
                  <div className="relative pb-8">
                    <input
                      type="range"
                      min="10"
                      max="40"
                      step="5"
                      value={expensePercent}
                      onChange={(e) => setExpensePercent(parseInt(e.target.value))}
                      className="expense-slider"
                      style={{ '--slider-progress': `${((expensePercent - 10) / 30) * 100}%` } as React.CSSProperties}
                    />
                    {/* Tick marks - positioned at actual percentage positions */}
                    {/* 10% = 0%, 20% = 33.33%, 30% = 66.67%, 40% = 100% of the range */}
                    <div className="absolute top-4 left-0 right-0 pointer-events-none">
                      {/* 10% tick - at 0% */}
                      <div className="absolute left-0 flex flex-col items-center" style={{ transform: 'translateX(-50%)' }}>
                        <div className="w-0.5 h-2 bg-slate-300"></div>
                        <span className="text-[10px] text-slate-400 mt-1">10%</span>
                      </div>
                      {/* 20% tick - at 33.33% (recommended) */}
                      <div className="absolute flex flex-col items-center" style={{ left: '33.33%', transform: 'translateX(-50%)' }}>
                        <div className="w-0.5 h-3 bg-emerald-500"></div>
                        <span className="text-[10px] text-emerald-600 font-medium mt-1">20%</span>
                        <span className="text-[9px] text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5">Recommended</span>
                      </div>
                      {/* 30% tick - at 66.67% */}
                      <div className="absolute flex flex-col items-center" style={{ left: '66.67%', transform: 'translateX(-50%)' }}>
                        <div className="w-0.5 h-2 bg-slate-300"></div>
                        <span className="text-[10px] text-slate-400 mt-1">30%</span>
                      </div>
                      {/* 40% tick - at 100% */}
                      <div className="absolute right-0 flex flex-col items-center" style={{ transform: 'translateX(50%)' }}>
                        <div className="w-0.5 h-2 bg-slate-300"></div>
                        <span className="text-[10px] text-slate-400 mt-1">40%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-4">
                    <span>Below Avg</span>
                    <span>Above Avg</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Covers cleaning, supplies, utilities, repairs, and platform fees</p>
                </div>
                
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !address || !monthlyRent || parseFloat(monthlyRent) <= 0}
                  className="btn-gold w-full h-12 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-[oklch(0.55_0.14_75)]/30 border-t-[oklch(0.55_0.14_75)] rounded-full animate-spin" />
                      <span>Validating Deal...</span>
                    </>
                  ) : (
                    <>
                      <Target className="w-5 h-5" />
                      <span>Validate This Deal</span>
                    </>
                  )}
                </button>
              </div>
            )}
            
            {/* ============================================ */}
            {/* FIND THE BEST DEAL TAB */}
            {/* ============================================ */}
            {activeTab === 'compare' && (
              <div className="space-y-8">
                <HelpSection
                  title="How This Tool Helps You"
                  description="Compare up to 25 properties side-by-side to find which one will make you the most money"
                  example="You've found 3 different apartments in Nashville and can't decide which one to pursue. Add all 3 and instantly see which one has the highest profit potential."
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
                    <h3 className="text-lg font-semibold text-[oklch(0.15_0_0)]">Compare Up to 25 Properties</h3>
                    <p className="text-sm text-[oklch(0.55_0.02_265)]">Add properties to find which one makes the most money</p>
                  </div>
                  <span className="text-sm text-[oklch(0.50_0.02_265)]">{bulkProperties.length}/25 properties</span>
                </div>
                
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {bulkProperties.map((prop, index) => (
                    <div key={prop.id} className="bg-[oklch(0.98_0_0)] border border-[oklch(0.90_0_0)] rounded-xl p-6 shadow-sm">
                      {/* Property Header */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-[oklch(0.55_0.14_75)]/15 text-[oklch(0.55_0.14_75)] text-sm font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="font-medium text-[oklch(0.25_0.02_265)]">Property {index + 1}</span>
                        </div>
                        {bulkProperties.length > 1 && (
                          <button
                            onClick={() => removeBulkProperty(prop.id)}
                            className="text-[oklch(0.50_0.02_265)] hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      
                      {/* Address */}
                      <div className="space-y-2 mb-4">
                        <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">Address</label>
                        <AddressAutocomplete
                          value={prop.address}
                          onChange={(val) => updateBulkProperty(prop.id, 'address', val)}
                          placeholder="Enter address..."
                          className="input-apple h-12"
                        />
                      </div>
                      
                      {/* Rent */}
                      <div className="space-y-2 mb-4">
                        <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">Rent</label>
                        <Input
                          type="number"
                          value={prop.rent || ''}
                          onChange={(e) => updateBulkProperty(prop.id, 'rent', parseFloat(e.target.value) || 0)}
                          placeholder="2000"
                          className="input-apple h-12"
                        />
                      </div>
                      
                      {/* Beds & Baths */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">Beds</label>
                          <select
                            value={prop.bedrooms}
                            onChange={(e) => updateBulkProperty(prop.id, 'bedrooms', parseInt(e.target.value))}
                            className="input-apple w-full h-12"
                          >
                            {[1, 2, 3, 4, 5, 6].map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">Baths</label>
                          <select
                            value={prop.bathrooms}
                            onChange={(e) => updateBulkProperty(prop.id, 'bathrooms', parseFloat(e.target.value))}
                            className="input-apple w-full h-12"
                          >
                            {[1, 1.5, 2, 2.5, 3, 3.5, 4].map(num => (
                              <option key={num} value={num}>{num}</option>
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
                  className="w-full py-4 border-2 border-dashed border-[oklch(0.85_0_0)] rounded-xl text-[oklch(0.50_0_0)] hover:text-[oklch(0.25_0_0)] hover:border-[oklch(0.70_0_0)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                  Add Another Property
                </button>
                
                <button
                  onClick={handleBulkAnalyze}
                  disabled={isBulkAnalyzing || bulkProperties.every(p => !p.address.trim())}
                  className="btn-gold w-full h-12 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isBulkAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-[oklch(0.55_0.14_75)]/30 border-t-[oklch(0.55_0.14_75)] rounded-full animate-spin" />
                      <span>Finding the Winner...</span>
                    </>
                  ) : (
                    <>
                      <Trophy className="w-5 h-5" />
                      <span>Find the Winner</span>
                    </>
                  )}
                </button>
              </div>
            )}
            
            {/* ============================================ */}
            {/* MAP TAB */}
            {/* ============================================ */}
            {activeTab === 'map' && (
              <MapFirstLayout 
                key={`map-${myProperty?.address || 'no-property'}`}
                myProperty={myProperty}
                embedded={false} 
                className="min-h-[600px]" 
              />
            )}

            {/* ============================================ */}
            {/* AI ADVISOR TAB */}
            {/* ============================================ */}
            {activeTab === 'advisor' && result && (
              <AIAdvisorStep
                property={{
                  address: address,
                  city: '',
                  state: '',
                  zipCode: '',
                  bedrooms: parseInt(bedrooms) || 2,
                  bathrooms: parseFloat(bathrooms) || 1,
                  accommodates: (parseInt(bedrooms) || 2) * 2,
                  monthlyRent: parseFloat(monthlyRent) || undefined,
                }}
                revenue={{
                  projected: result.revenue.projected,
                  low: result.revenue.low,
                  high: result.revenue.high,
                  adr: result.metrics.adr,
                  occupancy: result.metrics.occupancy,
                  revpar: result.metrics.adr * result.metrics.occupancy,
                }}
                cashFlow={result.cashFlow.monthlyRent ? {
                  monthlyRevenue: result.cashFlow.monthlyRevenue,
                  monthlyRent: result.cashFlow.monthlyRent,
                  monthlyProfit: result.cashFlow.monthlyProfit,
                  annualProfit: result.cashFlow.monthlyProfit * 12,
                  profitMargin: (result.cashFlow.monthlyProfit / result.cashFlow.monthlyRevenue) * 100,
                  breakEvenOccupancy: result.cashFlow.monthlyRent / (result.metrics.adr * 30),
                } : undefined}
                comparables={(result.comparables || []).map(c => ({
                  title: c.title,
                  bedrooms: c.bedrooms,
                  bathrooms: c.bathrooms,
                  accommodates: c.accommodates,
                  revenue: c.revenue,
                  adr: c.adr,
                  occupancy: c.occupancy,
                  revpar: c.adr * c.occupancy,
                  rating: c.rating,
                  reviews: c.reviews,
                  distanceMeters: c.distanceMeters,
                }))}
                marketInsights={{
                  professionallyManagedPct: result.marketInsights?.professionallyManagedPct || 0,
                  superhostPct: result.marketInsights?.superhostPct || 0,
                  avgRating: result.marketInsights?.avgRating || 0,
                  totalListings: result.marketInsights?.totalListings || 0,
                  marketScore: result.marketInsights?.marketScore || 50,
                }}
                historicalData={{
                  yoyChange: result.historicalData?.summary?.yearly_pct_change || 0,
                  trend: (result.historicalData?.summary?.trend as 'up' | 'down' | 'stable') || 'stable',
                  months: (result.historicalData?.months || []).map((m: { date: string; revenue: number; occupancy: number; adr: number; listingCount?: number }) => ({
                    date: m.date,
                    revenue: m.revenue,
                    occupancy: m.occupancy,
                    adr: m.adr,
                    revpar: m.adr * m.occupancy,
                    listingCount: m.listingCount,
                  })),
                }}
                seasonality={(result.forecast || []).map((s: { month: string; revenue: number; adr: number; occupancy: number }) => ({
                  month: s.month,
                  revenue: s.revenue,
                  adr: s.adr,
                  occupancy: s.occupancy,
                  revpar: s.adr * s.occupancy,
                  yoyChange: undefined,
                }))}
                marketGrade={{
                  grade: 'C',
                  score: result.marketInsights?.marketScore || 50,
                  description: 'Market conditions based on available data',
                  factors: [],
                }}
                marketPosition={{
                  percentile: 50,
                  rank: 0,
                  totalListings: result.marketInsights?.totalListings || 0,
                  vsAverage: 0,
                }}
              />
            )}

            {activeTab === 'advisor' && !result && (
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl mb-4">
                    <Sparkles className="w-8 h-8 text-amber-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">AI Property Advisor</h2>
                  <p className="text-slate-600">
                    Get AI-powered analysis of any property. Enter an address below to see projected revenue, 
                    market insights, and personalized recommendations.
                  </p>
                </div>
                
                {/* Standalone Address Input Form */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="space-y-4">
                    {/* Address Input */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Property Address</label>
                      <AddressAutocomplete
                        value={address}
                        onChange={setAddress}
                        placeholder="Enter property address..."
                        required
                      />
                    </div>
                    
                    {/* Property Details Row */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Bedrooms</label>
                        <select
                          value={bedrooms}
                          onChange={(e) => setBedrooms(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                            <option key={n} value={n}>{n} BR</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Bathrooms</label>
                        <select
                          value={bathrooms}
                          onChange={(e) => setBathrooms(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                        >
                          {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(n => (
                            <option key={n} value={n}>{n} BA</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Monthly Rent</label>
                        <Input
                          type="number"
                          value={monthlyRent}
                          onChange={(e) => setMonthlyRent(e.target.value)}
                          placeholder="Optional"
                          min="0"
                          className="w-full"
                        />
                      </div>
                    </div>
                    
                    {/* Analyze Button */}
                    <Button
                      onClick={handleAnalyze}
                      disabled={!address || isAnalyzing}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 text-lg font-semibold"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          Analyzing Property...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          Get AI Analysis
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Or use existing data hint */}
                {hasProperty && myProperty?.address && (
                  <div className="mt-6 text-center">
                    <p className="text-sm text-slate-500 mb-2">Or use your saved property:</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAddress(myProperty.address);
                        setBedrooms(String(myProperty.bedrooms));
                        setBathrooms(String(myProperty.bathrooms));
                        if (myProperty.monthlyRent) setMonthlyRent(String(myProperty.monthlyRent));
                      }}
                      className="text-amber-600 border-amber-200 hover:bg-amber-50"
                    >
                      <Home className="w-4 h-4 mr-2" />
                      Use {myProperty.address.split(',')[0]}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ============================================ */}
            {/* MARKET ADVISOR TAB */}
            {/* ============================================ */}
            <div className={activeTab === 'market' ? '' : 'hidden'}>
              <StandaloneMarketAdvisor key="market-advisor-stable" myProperty={myProperty || undefined} />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* RESULTS SECTIONS */}
      {/* ============================================ */}
      
      {/* Prove the Market Results - Loading Skeleton */}
      {activeTab === 'prove' && isResearching && (
        <section className="py-12 bg-[oklch(0.97_0_0)]">
          <div className="container max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[oklch(0.90_0_0)] rounded-full mb-4 animate-pulse">
                <div className="w-4 h-4 bg-[oklch(0.85_0_0)] rounded-full" />
                <div className="w-24 h-4 bg-[oklch(0.85_0_0)] rounded" />
              </div>
              <div className="h-8 w-64 bg-[oklch(0.90_0_0)] rounded mx-auto mb-2 animate-pulse" />
              <div className="h-4 w-80 bg-[oklch(0.92_0_0)] rounded mx-auto animate-pulse" />
            </div>
            
            {/* Key Metrics Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[oklch(0.98_0_0)] border border-[oklch(0.90_0_0)] rounded-xl p-4 text-center">
                  <div className="h-4 w-24 bg-[oklch(0.90_0_0)] rounded mx-auto mb-2 animate-pulse" />
                  <div className="h-8 w-20 bg-[oklch(0.88_0_0)] rounded mx-auto animate-pulse" />
                </div>
              ))}
            </div>
            
            {/* Property Types Skeleton */}
            <div className="bg-[oklch(0.98_0_0)] border border-[oklch(0.90_0_0)] rounded-xl p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 w-48 bg-[oklch(0.90_0_0)] rounded animate-pulse" />
                <div className="h-5 w-24 bg-[oklch(0.92_0_0)] rounded animate-pulse" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-[oklch(0.96_0_0)] rounded-lg p-4 border border-[oklch(0.92_0_0)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-5 w-20 bg-[oklch(0.90_0_0)] rounded animate-pulse" />
                      <div className="h-4 w-12 bg-[oklch(0.92_0_0)] rounded animate-pulse" />
                    </div>
                    <div className="h-3 w-full bg-[oklch(0.92_0_0)] rounded mb-2 animate-pulse" />
                    <div className="flex justify-between">
                      <div className="h-4 w-16 bg-[oklch(0.90_0_0)] rounded animate-pulse" />
                      <div className="h-4 w-12 bg-[oklch(0.90_0_0)] rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Seasonality Skeleton */}
            <div className="bg-[oklch(0.98_0_0)] border border-[oklch(0.90_0_0)] rounded-xl p-6 mb-8">
              <div className="h-6 w-40 bg-[oklch(0.90_0_0)] rounded mb-4 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="h-4 w-32 bg-[oklch(0.92_0_0)] rounded mb-3 animate-pulse" />
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <div className="h-3 w-8 bg-[oklch(0.92_0_0)] rounded animate-pulse" />
                      <div className="flex-1 h-4 bg-[oklch(0.90_0_0)] rounded animate-pulse" style={{ width: `${70 - i * 8}%` }} />
                      <div className="h-3 w-8 bg-[oklch(0.92_0_0)] rounded animate-pulse" />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="h-4 w-40 bg-[oklch(0.92_0_0)] rounded mb-3 animate-pulse" />
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <div className="h-3 w-8 bg-[oklch(0.92_0_0)] rounded animate-pulse" />
                      <div className="flex-1 h-4 bg-[oklch(0.90_0_0)] rounded animate-pulse" style={{ width: `${60 + i * 5}%` }} />
                      <div className="h-3 w-10 bg-[oklch(0.92_0_0)] rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Loading message */}
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-3 text-[oklch(0.50_0_0)]">
                <div className="w-5 h-5 border-2 border-[oklch(0.75_0.15_75)]/30 border-t-[oklch(0.75_0.15_75)] rounded-full animate-spin" />
                <span>Analyzing market data...</span>
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* Prove the Market Results */}
      {activeTab === 'prove' && researchResult && !isResearching && (() => {
        // Get bedroom-filtered metrics if filter is active
        const filteredBedroomData = bedroomFilter && researchResult.propertyTypes 
          ? researchResult.propertyTypes.find(t => {
              const bedroomNum = parseInt(t.type.split(' ')[0]) || 0;
              return bedroomNum === bedroomFilter;
            })
          : null;
        
        // Use filtered data if available, otherwise use market-wide averages
        const displayRevenue = filteredBedroomData?.avgRevenue || researchResult.avgRevenue;
        const displayOccupancy = filteredBedroomData?.occupancy || researchResult.avgOccupancy;
        const displayListings = filteredBedroomData?.count || researchResult.totalListings;
        const isFiltered = bedroomFilter && filteredBedroomData;
        
        return (
        <section className="py-12 bg-slate-50">
          <div className="container max-w-4xl mx-auto">
            {/* Hero Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 text-sm font-medium mb-4">
                <CheckCircle2 className="w-4 h-4" />
                Market Validated
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                {researchResult.marketName} is Profitable
              </h3>
              <p className="text-slate-500">
                {isFiltered 
                  ? `Avg revenue data for ${bedroomFilter}BR properties in this market`
                  : 'Avg revenue data from active Airbnb hosts in this market'
                }
              </p>
            </div>
            
            {/* Quick Insights Summary */}
            {researchResult.propertyTypes && researchResult.propertyTypes.length > 0 && (() => {
              // Find the best performing bedroom type
              const sortedByRevenue = [...researchResult.propertyTypes]
                .filter(t => t.count > 0)
                .sort((a, b) => b.avgRevenue - a.avgRevenue);
              const bestPerformer = sortedByRevenue[0];
              const highestOccupancy = [...researchResult.propertyTypes]
                .filter(t => t.count > 0)
                .sort((a, b) => (b.occupancy || 0) - (a.occupancy || 0))[0];
              
              return (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 mb-8 text-white">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <h4 className="font-semibold">Quick Insights</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Best Revenue */}
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span className="text-sm text-white/70">Top Earner</span>
                      </div>
                      <p className="text-lg font-bold text-emerald-400">{bestPerformer?.type || 'N/A'}</p>
                      <p className="text-sm text-white/60">{formatCurrency(bestPerformer?.avgRevenue || 0)}/year avg</p>
                    </div>
                    
                    {/* Highest Occupancy */}
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-white/70">Most Booked</span>
                      </div>
                      <p className="text-lg font-bold text-blue-400">{highestOccupancy?.type || 'N/A'}</p>
                      <p className="text-sm text-white/60">{highestOccupancy?.occupancy || 0}% occupancy</p>
                    </div>
                    
                    {/* Market Size */}
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Home className="w-4 h-4 text-purple-400" />
                        <span className="text-sm text-white/70">Market Size</span>
                      </div>
                      <p className="text-lg font-bold text-purple-400">{researchResult.totalListings.toLocaleString()}</p>
                      <p className="text-sm text-white/60">active listings</p>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Market Health Score Card */}
            {researchResult.marketScores && (() => {
              const scores = researchResult.marketScores;
              const getScoreColor = (score: number) => {
                if (score >= 70) return 'text-emerald-500';
                if (score >= 50) return 'text-amber-500';
                return 'text-red-500';
              };
              const getScoreBg = (score: number) => {
                if (score >= 70) return 'bg-emerald-500';
                if (score >= 50) return 'bg-amber-500';
                return 'bg-red-500';
              };
              const getScoreLabel = (score: number) => {
                if (score >= 80) return 'Excellent';
                if (score >= 70) return 'Good';
                if (score >= 50) return 'Fair';
                return 'Needs Review';
              };
              
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Market Health Score</h4>
                      <p className="text-slate-500 text-sm">Overall investment potential assessment</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${getScoreColor(scores.overall)}`}>{scores.overall}</div>
                      <div className="text-xs text-slate-500">{getScoreLabel(scores.overall)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: 'Investability', value: scores.investability, icon: '💰', desc: 'ROI potential' },
                      { label: 'Rental Demand', value: scores.rentalDemand, icon: '📈', desc: 'Guest interest' },
                      { label: 'Revenue Growth', value: scores.revenueGrowth, icon: '🚀', desc: 'YoY trend' },
                      { label: 'Seasonality', value: scores.seasonality, icon: '📅', desc: 'Consistency' },
                      { label: 'Regulation', value: scores.regulation, icon: '📋', desc: 'STR friendliness' },
                    ].map((item, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{item.icon}</span>
                          <span className="text-xs text-slate-600 font-medium">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div className={`h-2 rounded-full ${getScoreBg(item.value)}`} style={{ width: `${item.value}%` }} />
                          </div>
                          <span className={`text-sm font-bold ${getScoreColor(item.value)}`}>{item.value}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            
            {/* Revenue Distribution */}
            {researchResult.revenuePercentiles && (() => {
              const percentiles = researchResult.revenuePercentiles;
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Revenue Distribution</h4>
                      <p className="text-slate-500 text-sm">What hosts actually earn in this market</p>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">Annual revenue</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {[
                      { label: 'Bottom 10%', value: percentiles.p10, color: 'bg-red-100 text-red-700 border-red-200' },
                      { label: 'Lower 25%', value: percentiles.p25, color: 'bg-amber-100 text-amber-700 border-amber-200' },
                      { label: 'Median', value: percentiles.p50, color: 'bg-blue-100 text-blue-700 border-blue-200' },
                      { label: 'Upper 25%', value: percentiles.p75, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                      { label: 'Top 10%', value: percentiles.p90, color: 'bg-purple-100 text-purple-700 border-purple-200' },
                    ].map((item, idx) => (
                      <div key={idx} className={`rounded-lg p-3 border ${item.color}`}>
                        <p className="text-xs font-medium mb-1">{item.label}</p>
                        <p className="text-lg font-bold">{formatCurrency(item.value)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-600">
                      💡 <strong>What this means:</strong> Top performers (90th percentile) earn {formatCurrency(percentiles.p90)}/year, 
                      while the median host earns {formatCurrency(percentiles.p50)}. The gap of {formatCurrency(percentiles.p90 - percentiles.p50)} 
                      shows the potential upside with better optimization.
                    </p>
                  </div>
                </div>
              );
            })()}
            
            {/* Guest Behavior Insights */}
            {researchResult.bookingPatterns && (() => {
              const patterns = researchResult.bookingPatterns;
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Guest Behavior Insights</h4>
                      <p className="text-slate-500 text-sm">How guests book in this market</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-blue-500" />
                        <span className="text-sm font-medium text-blue-900">Booking Lead Time</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">{Math.round(patterns.avgLeadTime)} days</p>
                      <p className="text-xs text-blue-600 mt-1">Average advance booking</p>
                      <div className="mt-2 flex gap-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {Math.round(patterns.lastMinutePercent)}% last-minute
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {Math.round(patterns.advanceBookingPercent)}% advance
                        </span>
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-5 h-5 text-purple-500" />
                        <span className="text-sm font-medium text-purple-900">Length of Stay</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-700">{patterns.avgLengthOfStay.toFixed(1)} nights</p>
                      <p className="text-xs text-purple-600 mt-1">Average stay duration</p>
                      <div className="mt-2 flex gap-2">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {Math.round(patterns.weekendPercent)}% weekends
                        </span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {Math.round(patterns.weekPlusPercent)}% week+
                        </span>
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-5 h-5 text-amber-500" />
                        <span className="text-sm font-medium text-amber-900">Guest Mix</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-amber-700">Weekend Stays</span>
                            <span className="font-medium text-amber-800">{Math.round(patterns.weekendPercent)}%</span>
                          </div>
                          <div className="bg-amber-200 rounded-full h-2">
                            <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${patterns.weekendPercent}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-amber-700">Week+ Stays</span>
                            <span className="font-medium text-amber-800">{Math.round(patterns.weekPlusPercent)}%</span>
                          </div>
                          <div className="bg-amber-200 rounded-full h-2">
                            <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${patterns.weekPlusPercent}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Competition Landscape */}
            {researchResult.competitionData && (() => {
              const comp = researchResult.competitionData;
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Competition Landscape</h4>
                      <p className="text-slate-500 text-sm">Who you're competing against</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Building className="w-4 h-4 text-slate-500" />
                        <span className="text-xs text-slate-600 font-medium">Pro Managed</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">{comp.professionallyManagedPct}%</p>
                      <p className="text-xs text-slate-500">Professional hosts</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-slate-600 font-medium">Superhosts</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">{comp.superhostPct}%</p>
                      <p className="text-xs text-slate-500">Top-rated hosts</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Home className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-slate-600 font-medium">Entire Homes</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">{comp.entireHomePct}%</p>
                      <p className="text-xs text-slate-500">Full property rentals</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-purple-500" />
                        <span className="text-xs text-slate-600 font-medium">Single Hosts</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">{comp.singleHostPct}%</p>
                      <p className="text-xs text-slate-500">1 listing only</p>
                    </div>
                  </div>
                  <div className="mt-4 bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-600">
                      💡 <strong>Market insight:</strong> 
                      {comp.professionallyManagedPct > 30 
                        ? ` This is a competitive market with ${comp.professionallyManagedPct}% professional managers. Focus on unique amenities and guest experience to stand out.`
                        : ` This market has ${100 - comp.professionallyManagedPct}% individual hosts, suggesting opportunity for professional-level service to differentiate.`
                      }
                    </p>
                  </div>
                </div>
              );
            })()}
            
            {/* Key Metrics - Tesla Dashboard Style */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <div className={`bg-white border rounded-xl p-4 hover:shadow-md transition-shadow ${isFiltered ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'}`}>
                <div className="inline-flex p-2 rounded-lg mb-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <DollarSign className="w-5 h-5" />
                </div>
                <p className="text-slate-500 text-xs font-medium">Avg Annual Revenue</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(displayRevenue)}</p>
                <p className="text-slate-400 text-xs">{isFiltered ? `${bedroomFilter}BR avg` : 'All property types'}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="inline-flex p-2 rounded-lg mb-2 bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <Calendar className="w-5 h-5" />
                </div>
                <p className="text-slate-500 text-xs font-medium">Avg Nightly Rate</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(researchResult.avgAdr)}</p>
                <p className="text-slate-400 text-xs">Market average ADR</p>
              </div>
              <div className={`bg-white border rounded-xl p-4 hover:shadow-md transition-shadow ${isFiltered ? 'border-purple-300 ring-1 ring-purple-100' : 'border-slate-200'}`}>
                <div className="inline-flex p-2 rounded-lg mb-2 bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  <Percent className="w-5 h-5" />
                </div>
                <p className="text-slate-500 text-xs font-medium">Avg Occupancy</p>
                <p className="text-xl font-bold text-slate-900">{Math.round(displayOccupancy)}%</p>
                <p className="text-slate-400 text-xs">{isFiltered ? `${bedroomFilter}BR avg` : 'Market average'}</p>
              </div>
              <div className={`bg-white border rounded-xl p-4 hover:shadow-md transition-shadow ${isFiltered ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'}`}>
                <div className="inline-flex p-2 rounded-lg mb-2 bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Home className="w-5 h-5" />
                </div>
                <p className="text-slate-500 text-xs font-medium">{isFiltered ? 'Similar Listings' : 'Active Listings'}</p>
                <p className="text-xl font-bold text-slate-900">{displayListings.toLocaleString()}</p>
                <p className="text-slate-400 text-xs">{isFiltered ? `${bedroomFilter}BR in market` : 'All types in market'}</p>
              </div>
            </div>
            
            {/* Property Types - Show all bedroom types */}
            {researchResult.propertyTypes && researchResult.propertyTypes.length > 0 && (() => {
              // Ensure we show all bedroom types from Studio to 5+
              const allBedroomTypes = [0, 1, 2, 3, 4, 5];
              const existingTypesMap: Record<number, typeof researchResult.propertyTypes[0]> = {};
              researchResult.propertyTypes.forEach(t => {
                const bedroomNum = parseInt(t.type.split(' ')[0]) || 0;
                existingTypesMap[bedroomNum] = t;
              });
              
              // Create complete list with placeholders for missing types
              const completeTypes = allBedroomTypes.map(bedrooms => {
                const existing = existingTypesMap[bedrooms];
                if (existing) return existing;
                return {
                  type: bedrooms === 0 ? 'Studio' : `${bedrooms} Bedroom`,
                  count: 0,
                  avgRevenue: 0,
                  occupancy: 0
                };
              });
              
              // Filter to only show types with data or common types (1-4 BR)
              const typesToShow = completeTypes.filter(t => {
                const bedroomNum = t.type === 'Studio' ? 0 : parseInt(t.type.split(' ')[0]);
                return t.count > 0 || (bedroomNum >= 1 && bedroomNum <= 4);
              });
              
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Revenue by Property Type</h4>
                      <p className="text-slate-500 text-sm">See what's working in this market</p>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full font-medium">By Bedroom</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {typesToShow.map((type, idx) => (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-xl border transition-all ${
                          type.count > 0 
                            ? 'bg-slate-50 border-slate-200 hover:border-slate-300' 
                            : 'bg-slate-50/50 border-dashed border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                              type.count > 0 ? 'bg-blue-500/10 text-blue-600' : 'bg-slate-200 text-slate-400'
                            }`}>
                              {type.type === 'Studio' ? 'S' : type.type.split(' ')[0]}
                            </div>
                            <p className={`font-semibold text-sm ${type.count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                              {type.type}
                            </p>
                          </div>
                        </div>
                        {type.count > 0 ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between group relative">
                              <p className="text-xs text-slate-500 cursor-help border-b border-dotted border-slate-400">Revenue/yr</p>
                              <p className="text-emerald-600 font-bold text-sm">{formatCurrency(type.avgRevenue)}</p>
                              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-48">
                                <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-lg">
                                  Average annual income from similar {type.type} properties in this area
                                  <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between group relative">
                              <p className="text-xs text-slate-500 cursor-help border-b border-dotted border-slate-400">Occupancy</p>
                              <p className="text-slate-900 font-semibold text-sm">{type.occupancy}%</p>
                              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-48">
                                <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-lg">
                                  How often these properties are booked. Higher = more demand for this type
                                  <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-slate-400">{type.count} listings</p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            Limited data available
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {typesToShow.some(t => t.count === 0) && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-700">
                        💡 Some bedroom types show limited data because there are few active listings in this specific area. Try searching a broader market for more complete data.
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
            
            
            {/* Seasonality Summary */}
            {isResearching && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Market Seasonality</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-slate-500 mb-3">Occupancy by Month</p>
                    <div className="space-y-2">
                      {[...Array(12)].map((_, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-12 h-4 bg-slate-200 rounded animate-pulse" />
                          <div className="flex-1 bg-slate-200 rounded-full h-5 animate-pulse" />
                          <div className="w-10 h-4 bg-slate-200 rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-3">Average Daily Rate by Month</p>
                    <div className="space-y-2">
                      {[...Array(12)].map((_, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="w-12 h-4 bg-slate-200 rounded animate-pulse" />
                          <div className="w-16 h-4 bg-slate-200 rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!isResearching && researchResult.seasonality && researchResult.seasonality.length > 0 && (() => {
              // Calculate averages for the guide lines
              const avgOccupancy = researchResult.seasonality.reduce((sum, m) => sum + m.occupancy, 0) / researchResult.seasonality.length;
              const avgAdr = researchResult.seasonality.reduce((sum, m) => sum + m.adr, 0) / researchResult.seasonality.length;
              const maxAdr = Math.max(...researchResult.seasonality.map(m => m.adr));
              const minAdr = Math.min(...researchResult.seasonality.map(m => m.adr));
              const adrRange = maxAdr - minAdr || 1;
              
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Historical Seasonality</h4>
                      <p className="text-slate-500 text-sm">Avg monthly performance based on historical data</p>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">12-month avg</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Occupancy Chart */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-slate-500">Avg Occupancy by Month</p>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-0.5 bg-amber-500"></div>
                          <span className="text-xs text-amber-600 font-medium">Avg: {Math.round(avgOccupancy)}%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {researchResult.seasonality.map((month, idx) => {
                          const isAboveAvg = month.occupancy >= avgOccupancy;
                          return (
                            <div key={idx} className="flex items-center gap-3">
                              <span className="text-xs text-slate-500 w-12">{formatMonth(month.month)}</span>
                              <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden relative">
                                {/* Average line indicator */}
                                <div 
                                  className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
                                  style={{left: `${avgOccupancy}%`}}
                                />
                                <div 
                                  className={`h-full transition-all ${isAboveAvg ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : 'bg-gradient-to-r from-amber-300 to-amber-400'}`}
                                  style={{width: `${month.occupancy}%`}}
                                />
                              </div>
                              <span className={`text-xs font-semibold w-10 text-right ${isAboveAvg ? 'text-emerald-600' : 'text-amber-600'}`}>{Math.round(month.occupancy)}%</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-400 mt-3">Green = above average, Amber = below average</p>
                    </div>
                    {/* ADR Chart */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-slate-500">Avg Nightly Rate by Month</p>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-0.5 bg-blue-500"></div>
                          <span className="text-xs text-blue-600 font-medium">Avg: {formatCurrency(avgAdr)}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {researchResult.seasonality.map((month, idx) => {
                          // Calculate bar width as percentage of range (min 20%, max 100%)
                          const barWidth = 20 + ((month.adr - minAdr) / adrRange) * 80;
                          const isAboveAvg = month.adr >= avgAdr;
                          const avgPosition = 20 + ((avgAdr - minAdr) / adrRange) * 80;
                          return (
                            <div key={idx} className="flex items-center gap-3">
                              <span className="text-xs text-slate-500 w-12">{formatMonth(month.month)}</span>
                              <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden relative">
                                {/* Average line indicator */}
                                <div 
                                  className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10"
                                  style={{left: `${avgPosition}%`}}
                                />
                                <div 
                                  className={`h-full transition-all ${isAboveAvg ? 'bg-gradient-to-r from-blue-400 to-cyan-400' : 'bg-gradient-to-r from-slate-300 to-slate-400'}`}
                                  style={{width: `${barWidth}%`}}
                                />
                              </div>
                              <span className={`text-xs font-semibold w-14 text-right ${isAboveAvg ? 'text-blue-600' : 'text-slate-500'}`}>{formatCurrency(month.adr)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-400 mt-3">Blue = above average, Gray = below average</p>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Historical Charts - Market Trends (YoY Data) */}
            {/* Moved closer to Seasonality section per feedback */}
            {/* Note: Historical data API only works with market IDs, not submarket IDs */}
            {/* When a submarket is selected as a market (isSubmarketAsMarket), use the parent market ID if available */}
            {locationSelection?.market?.id && (
              <div className="mt-8">
                <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-slate-600 text-sm">
                    <span className="font-medium">Historical Trends:</span> Year-over-year market data showing how this market has performed over time. These are metro-level averages across all property types.
                  </p>
                </div>
                {/* For submarkets with parent market info, show the charts with parent market data */}
                {locationSelection.market.isSubmarketAsMarket && locationSelection.market.parentMarketId ? (
                  <div>
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-700 text-sm">
                        <span className="font-medium">Note:</span> Historical trends shown for {locationSelection.market.parentMarketName || 'parent market'} (broader market area)
                      </p>
                    </div>
                    <HistoricalCharts
                      marketId={locationSelection.market.parentMarketId}
                      marketName={locationSelection.market.parentMarketName || researchResult.marketName}
                    />
                  </div>
                ) : locationSelection.market.isSubmarketAsMarket ? (
                  /* For submarkets without parent market info, show a message */
                  <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <BarChart3 className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-amber-900">Historical Trends</h4>
                        <p className="text-amber-700 text-sm mt-1">
                          Historical trend data is available at the city/metro level. Select a parent market (like Austin instead of Downtown Austin) to view historical occupancy, revenue, and ADR trends.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* For regular markets, show charts directly */
                  <HistoricalCharts
                    marketId={locationSelection.market.id}
                    marketName={researchResult.marketName}
                  />
                )}
              </div>
            )}
            
            {/* Comp Data Table - Individual Property Listings */}
            {(locationSelection?.submarket?.id || locationSelection?.market?.id) && (
              <div className="mt-8">
                <CompDataTable
                  key={`comp-table-${locationSelection.submarket?.id || locationSelection.market?.id}-${researchResult.marketName}`}
                  submarketId={locationSelection.submarket?.id || locationSelection.market?.id || ''}
                  marketName={researchResult.marketName}
                  isMarketLevel={!locationSelection?.submarket?.id && !!locationSelection?.market?.id}
                />
              </div>
            )}
            
            {/* Next Step CTA - Moved after Comp Data per feedback */}
            <div className="mt-8 bg-white border border-slate-200 rounded-xl p-6 text-center">
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Ready for the Next Step?</h4>
              <p className="text-slate-500 mb-4">Find specific opportunities in this market</p>
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
              <Button
                variant="outline"
                onClick={() => {
                  const marketName = researchResult.marketName.split(',')[0].trim();
                  const state = researchResult.marketName.split(',')[1]?.trim() || '';
                  saveMarket({
                    name: marketName,
                    state: state,
                    avgRevenue: researchResult.avgRevenue,
                    avgOccupancy: researchResult.avgOccupancy,
                  });
                  toast.success(`Saved ${marketName} to your list!`);
                }}
                className={`ml-3 border-amber-500 text-amber-600 hover:bg-amber-50 ${isMarketSaved(researchResult.marketName.split(',')[0].trim(), researchResult.marketName.split(',')[1]?.trim() || '') ? 'bg-amber-50' : ''}`}
              >
                {isMarketSaved(researchResult.marketName.split(',')[0].trim(), researchResult.marketName.split(',')[1]?.trim() || '') ? (
                  <>
                    <BookmarkCheck className="w-4 h-4 mr-2" />
                    Saved
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4 mr-2" />
                    Save Market
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>
        );
      })()}
      
      {/* Find Your Market Results */}
      {activeTab === 'find' && areaListings && (
        <section className="py-12 bg-white">
          <div className="container max-w-5xl mx-auto">
            {/* Tesla Dashboard Style Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 text-sm font-medium mb-4">
                <CheckCircle2 className="w-4 h-4" />
                {totalListings} Opportunities Found
              </div>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
                Here's What's Making Money
              </h3>
              <p className="text-slate-500 text-lg">
                Real Airbnb properties near <span className="font-medium text-slate-700">{exploreAddress}</span>
              </p>
            </div>
            
            
            {/* Tesla Dashboard Style Filters */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Filter className="w-4 h-4 text-slate-600" />
                </div>
                <h4 className="font-semibold text-slate-900">Filter & Sort</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Sort By</label>
                  <select 
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    value={exploreSortBy}
                    onChange={(e) => setExploreSortBy(e.target.value as typeof exploreSortBy)}
                  >
                    <option value="revenue">Most Revenue</option>
                    <option value="occupancy">Highest Occupancy</option>
                    <option value="rating">Best Rating</option>
                    <option value="revpar">Highest RevPAR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Property Type</label>
                  <select 
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    value={explorePropertyType || ''}
                    onChange={(e) => setExplorePropertyType(e.target.value || null)}
                  >
                    <option value="">All Types</option>
                    <option value="entire_home">Entire Home</option>
                    <option value="private_room">Private Room</option>
                    <option value="shared_room">Shared Room</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Min Rating</label>
                  <select 
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    value={exploreMinRating || ''}
                    onChange={(e) => setExploreMinRating(e.target.value ? parseFloat(e.target.value) : null)}
                  >
                    <option value="">Any Rating</option>
                    <option value="4.5">4.5+ Stars</option>
                    <option value="4.7">4.7+ Stars</option>
                    <option value="4.9">4.9+ Stars</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Min Occupancy</label>
                  <select 
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    value={exploreMinOccupancy || ''}
                    onChange={(e) => setExploreMinOccupancy(e.target.value ? parseFloat(e.target.value) : null)}
                  >
                    <option value="">Any Occupancy</option>
                    <option value="50">50%+ Booked</option>
                    <option value="70">70%+ Booked</option>
                    <option value="85">85%+ Booked</option>
                  </select>
                </div>
              </div>
              {/* Second row of filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Min Revenue</label>
                  <select 
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    value={exploreMinRevenue || ''}
                    onChange={(e) => setExploreMinRevenue(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">Any Revenue</option>
                    <option value="30000">$30K+/year</option>
                    <option value="50000">$50K+/year</option>
                    <option value="75000">$75K+/year</option>
                    <option value="100000">$100K+/year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Host Type</label>
                  <button
                    onClick={() => setExploreSuperhostOnly(!exploreSuperhostOnly)}
                    className={`w-full h-11 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      exploreSuperhostOnly 
                        ? 'bg-amber-500 text-white border-amber-500' 
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${exploreSuperhostOnly ? 'fill-white' : ''}`} />
                    {exploreSuperhostOnly ? 'Superhosts Only' : 'All Hosts'}
                  </button>
                </div>
              </div>
            </div>
            {/* View Toggle - Tesla Dashboard Style */}
            <div className="flex justify-center gap-2 mb-8">
              <button
                onClick={() => setShowMapView(false)}
                className={`px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                  !showMapView 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <List className="w-4 h-4" />
                List View
              </button>
              <button
                onClick={() => setShowMapView(true)}
                className={`px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                  showMapView 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Map className="w-4 h-4" />
                Map View
              </button>
            </div>
            
            {/* Listings */}
            {!showMapView ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {areaListings
                  // Filter to only show Airbnb listings
                  .filter(listing => listing.airbnb_url && listing.airbnb_url.includes('airbnb.com'))
                  // Filter by property type
                  .filter(listing => !explorePropertyType || listing.property_type?.toLowerCase().replace(/\s+/g, '_') === explorePropertyType)
                  // Filter by min rating
                  .filter(listing => !exploreMinRating || (listing.rating && listing.rating >= exploreMinRating))
                  // Filter by min occupancy
                  .filter(listing => !exploreMinOccupancy || (listing.occupancy && listing.occupancy >= exploreMinOccupancy))
                  // Filter by min revenue
                  .filter(listing => !exploreMinRevenue || (listing.annual_revenue && listing.annual_revenue >= exploreMinRevenue))
                  // Filter by superhost
                  .filter(listing => !exploreSuperhostOnly || listing.superhost === true)
                  // Sort by selected criteria
                  .sort((a, b) => {
                    if (exploreSortBy === 'revenue') return (b.annual_revenue || 0) - (a.annual_revenue || 0);
                    if (exploreSortBy === 'occupancy') return (b.occupancy || 0) - (a.occupancy || 0);
                    if (exploreSortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
                    if (exploreSortBy === 'revpar') {
                      const revparA = (a.adr || 0) * ((a.occupancy || 0) / 100);
                      const revparB = (b.adr || 0) * ((b.occupancy || 0) / 100);
                      return revparB - revparA;
                    }
                    return 0;
                  })
                  .slice(0, 15)
                  .map((listing, idx) => (
                  <PropertyCard
                    key={listing.id}
                    id={listing.id}
                    title={listing.title}
                    imageUrl={listing.image_url}
                    bedrooms={listing.bedrooms}
                    bathrooms={listing.bathrooms}
                    propertyType={listing.property_type}
                    rating={listing.rating}
                    reviews={listing.reviews}
                    annualRevenue={listing.annual_revenue}
                    occupancy={listing.occupancy}
                    adr={listing.adr}
                    airbnbUrl={listing.airbnb_url}
                    superhost={listing.superhost}
                    index={idx}
                    isSaved={isPropertySaved(listing.title)}
                    onSave={() => {
                      saveProperty({
                        title: listing.title,
                        address: exploreAddress,
                        bedrooms: listing.bedrooms,
                        bathrooms: listing.bathrooms,
                        revenue: listing.annual_revenue,
                        adr: listing.adr,
                        occupancy: listing.occupancy,
                        airbnbUrl: listing.airbnb_url,
                      });
                      toast.success(`Saved "${listing.title.substring(0, 30)}..." to your list!`);
                    }}
                    onAnalyze={() => {
                      // Pre-fill the validate form with this property's data
                      setAddress(exploreAddress);
                      setBedrooms(listing.bedrooms.toString());
                      setBathrooms(listing.bathrooms.toString());
                      setActiveTab('validate');
                      // Scroll to top
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      toast.success('Property loaded! Fill in the monthly rent to analyze.');
                    }}
                  />
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
              <p className="text-[oklch(0.50_0_0)] mb-4">Found a property you like? Validate if it will actually make you money.</p>
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
      
      {/* Validate the Deal Results - Tesla Dashboard */}
      {activeTab === 'validate' && result && (
        <section className="py-12 bg-slate-50">
          <div className="container max-w-5xl mx-auto px-4">
            <TeslaDashboard
              result={result}
              address={address}
              bedrooms={parseInt(bedrooms)}
              bathrooms={parseFloat(bathrooms)}
              monthlyRent={parseFloat(monthlyRent) || undefined}
              furnitureCost={parseFloat(furnitureCost) || 0}
              expensePercent={expensePercent}
              marketId={result.marketId}
              rentometerData={rentometerData}
            />
            
            {/* Next Step CTA */}
            <div className="text-center mt-8">
              <p className="text-slate-500 mb-4">Have multiple properties to compare? Find the best one.</p>
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
        <section className="py-12 bg-slate-50">
          <div className="container max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 text-sm font-medium mb-4">
                <Trophy className="w-4 h-4" />
                {sortedBulkResults.filter(r => r.status === 'success').length} Properties Compared
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                Property Comparison Results
              </h3>
              <p className="text-slate-500">
                Ranked by profitability to help you find the best investment opportunity
              </p>
            </div>
            
            {/* Sort Controls */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-sm font-medium text-slate-700">Sort by:</span>
                <div className="flex gap-2">
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
                      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        bulkSortBy === sortType 
                          ? 'bg-slate-900 text-white shadow-md' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {sortType === 'profit' ? 'Monthly Profit' : sortType === 'revenue' ? 'Revenue' : 'ROI Ratio'}
                      {bulkSortBy === sortType && (
                        bulkSortDir === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Results */}
            <div className="space-y-4">
              {sortedBulkResults.map((result, idx) => (
                <div 
                  key={result.id} 
                  className={`bg-white border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 ${
                    idx === 0 && result.status === 'success'
                      ? 'border-emerald-500/50 ring-2 ring-emerald-500/20'
                      : result.status === 'error'
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="p-5">
                    <div className="flex flex-col lg:flex-row gap-5">
                      {/* Left: Rank + Image */}
                      <div className="flex gap-4 items-start">
                        {/* Rank Badge */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${
                          idx === 0 && result.status === 'success'
                            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                            : idx === 1 && result.status === 'success'
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                            : idx === 2 && result.status === 'success'
                            ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {idx === 0 && result.status === 'success' ? (
                            <Trophy className="w-6 h-6" />
                          ) : (
                            <span className="text-lg">#{idx + 1}</span>
                          )}
                        </div>
                        
                        {/* Property Image */}
                        {result.imageUrl ? (
                          <div className="w-28 h-20 rounded-xl overflow-hidden flex-shrink-0 relative">
                            <img 
                              src={result.imageUrl} 
                              alt={result.address}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.classList.add('bg-gradient-to-br', 'from-slate-100', 'to-slate-200');
                              }}
                            />
                            {result.propertyType && (
                              <span className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/70 text-white text-xs rounded-full">
                                {result.propertyType}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="w-28 h-20 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                            <Home className="w-8 h-8 text-slate-400" />
                          </div>
                        )}
                      </div>
                      
                      {/* Middle: Property Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="text-slate-900 font-semibold text-lg truncate">{result.address}</h4>
                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                              <span className="flex items-center gap-1">
                                <BedDouble className="w-4 h-4" />
                                {result.bedrooms} bed
                              </span>
                              <span className="flex items-center gap-1">
                                <Bath className="w-4 h-4" />
                                {result.bathrooms} bath
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-4 h-4" />
                                {formatCurrency(result.rent)}/mo rent
                              </span>
                            </div>
                            {result.status === 'success' && (result.rating || result.reviews) && (
                              <div className="flex items-center gap-2 mt-2">
                                {result.rating && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 text-xs font-medium rounded-full">
                                    <Star className="w-3 h-3 fill-current" />
                                    {result.rating.toFixed(1)}
                                  </span>
                                )}
                                {result.reviews && (
                                  <span className="text-xs text-slate-400">
                                    {result.reviews} reviews
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Financial Stats Grid */}
                        {result.status === 'success' && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                            {/* Monthly Profit */}
                            <div className={`p-3 rounded-xl ${
                              result.profit > 0 
                                ? 'bg-emerald-500/10 border border-emerald-500/20' 
                                : 'bg-red-500/10 border border-red-500/20'
                            }`}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <TrendingUp className={`w-3.5 h-3.5 ${result.profit > 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                                <span className="text-xs font-medium text-slate-500">Profit</span>
                              </div>
                              <p className={`text-lg font-bold ${result.profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(result.profit)}
                              </p>
                              <p className="text-xs text-slate-400">per month</p>
                            </div>
                            
                            {/* Revenue */}
                            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
                              <div className="flex items-center gap-1.5 mb-1">
                                <DollarSign className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-xs font-medium text-slate-500">Revenue</span>
                              </div>
                              <p className="text-lg font-bold text-blue-600">
                                {formatCurrency(result.revenue)}
                              </p>
                              <p className="text-xs text-slate-400">per month</p>
                            </div>
                            
                            {/* Occupancy */}
                            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-xs font-medium text-slate-500">Occupancy</span>
                              </div>
                              <p className="text-lg font-bold text-amber-600">
                                {Math.round((result.occupancy > 1 ? result.occupancy : result.occupancy * 100))}%
                              </p>
                              <p className="text-xs text-slate-400">booked nights</p>
                            </div>
                            
                            {/* ROI Ratio */}
                            <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Percent className="w-3.5 h-3.5 text-purple-500" />
                                <span className="text-xs font-medium text-slate-500">ROI Ratio</span>
                              </div>
                              <p className="text-lg font-bold text-purple-600">
                                {result.ratio.toFixed(1)}x
                              </p>
                              <p className="text-xs text-slate-400">${Math.round(result.adr)}/night ADR</p>
                            </div>
                          </div>
                        )}
                        
                        {result.status === 'error' && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-600 text-sm flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" />
                              {result.error}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Winner Badge */}
                    {idx === 0 && result.status === 'success' && (
                      <div className="mt-4 pt-4 border-t border-emerald-500/20">
                        <div className="flex items-center gap-2 text-emerald-600">
                          <Trophy className="w-5 h-5" />
                          <span className="font-semibold">Best Deal!</span>
                          <span className="text-sm text-emerald-500">Highest profitability based on your criteria</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* CTA */}
            <div className="mt-8 bg-white border border-slate-200 rounded-xl p-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 rounded-xl mb-4">
                  <Zap className="w-7 h-7 text-emerald-500" />
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-2">Ready to Take Action?</h4>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                  Get personalized guidance on your next steps with Coach Inayah's Turnkey Program
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    className="bg-slate-900 hover:bg-slate-800 text-white"
                    onClick={() => window.open('https://masterclass.coachinayah.com/the-turnkey-program', '_blank')}
                  >
                    Learn About the Turnkey Program
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setBulkProperties([
                        { id: '1', address: '', bedrooms: 2, bathrooms: 1, rent: 0 },
                        { id: '2', address: '', bedrooms: 2, bathrooms: 1, rent: 0 }
                      ]);
                      setBulkResults(null);
                    }}
                  >
                    Compare More Properties
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* FOOTER CTA */}
      {/* ============================================ */}
      <section className="section-padding border-t border-[oklch(0.92_0_0)] bg-[oklch(0.97_0_0)]">
        <div className="container max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-semibold text-[oklch(0.15_0_0)] mb-4 tracking-tight">
            Ready to Start Your Journey?
          </h2>
          <p className="text-[oklch(0.45_0_0)] text-lg mb-10 leading-relaxed">
            These free tools prove the opportunity is real. When you're ready for personalized guidance, 
            Coach Inayah's Turnkey Program will help you take action.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="btn-gold-outline flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Read the Guide First
            </button>
            <a 
              href="https://masterclass.coachinayah.com/the-turnkey-program"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold flex items-center justify-center gap-2"
            >
              Explore the Turnkey Program
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
