/**
 * Premium Property Report - Sales Qualified Lead Tool
 * 
 * Three modes:
 * 1. Single Property - Analyze one property (original functionality)
 * 2. Compare Properties - Compare up to 25 properties at once
 * 3. Market Explorer - See all Airbnbs in an area
 * 
 * Data displayed (all from AirDNA APIs):
 * - Revenue estimate with confidence range (low/high)
 * - Cash flow breakdown (revenue - rent = profit)
 * - Average Daily Rate (ADR)
 * - Occupancy rate
 * - 12-month seasonality forecast
 * - Comparable properties with Airbnb links
 */

import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { EbookViewer } from '@/components/EbookViewer';
import { HelpSection } from '@/components/HelpSection';

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
  AlertCircle
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
  };
  metrics: Array<{
    date: string;
    revenue_valuation: number;
  }>;
}

interface AnalysisResult {
  revenue: number;
  revenueLow: number;
  revenueHigh: number;
  adr: number;
  occupancy: number;
  rent: number;
  profit: number;
  profitLow: number;
  profitHigh: number;
  address: string;
  bedrooms: number;
  bathrooms: number;
  monthlyForecast: MonthlyForecast[];
  comparables: Comparable[];
  historical?: HistoricalData;
}

// Bulk comparison types
interface BulkPropertyInput {
  id: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
}

interface BulkPropertyResult extends BulkPropertyInput {
  revenue: number;
  adr: number;
  occupancy: number;
  profit: number;
  ratio: number;
  success: boolean;
  error?: string;
}

// Area listing types
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
type TabType = 'single' | 'compare' | 'explore' | 'research' | 'ebook';

export default function LeadMagnet() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('single');
  
  // ============================================
  // SINGLE PROPERTY STATE
  // ============================================
  const [address, setAddress] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [bedrooms, setBedrooms] = useState('2');
  const [bathrooms, setBathrooms] = useState('1');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  
  // ============================================
  // BULK COMPARE STATE
  // ============================================
  const [bulkProperties, setBulkProperties] = useState<BulkPropertyInput[]>([
    { id: '1', address: '', bedrooms: 2, bathrooms: 1, rent: 0 }
  ]);
  const [bulkResults, setBulkResults] = useState<BulkPropertyResult[] | null>(null);
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  const [bulkSortBy, setBulkSortBy] = useState<'profit' | 'revenue' | 'ratio'>('profit');
  const [bulkSortDir, setBulkSortDir] = useState<'desc' | 'asc'>('desc');
  
  // ============================================
  // MARKET EXPLORER STATE
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
  // EBOOK STATE
  // ============================================
  const [isEbookOpen, setIsEbookOpen] = useState(false);
  
  // ============================================
  // HELP STATE
  // ============================================
  const [showHelp, setShowHelp] = useState<TabType | null>(null);
  

  
  // ============================================
  // MARKET RESEARCH STATE
  // ============================================
  const [researchMarket, setResearchMarket] = useState('');
  const [selectedMarketId, setSelectedMarketId] = useState<number | null>(null);
  const [showMarketSuggestions, setShowMarketSuggestions] = useState(false);
  const [marketSearchResults, setMarketSearchResults] = useState<Array<{id: number, name: string, country: string}>>([]);
  const [isResearching, setIsResearching] = useState(false);
  const [researchProgress, setResearchProgress] = useState(0);
  const [researchStep, setResearchStep] = useState('');
  const [researchResult, setResearchResult] = useState<any | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [researchId, setResearchId] = useState<string | null>(null);
  
  // Opportunity Finder state
  const [oppCity, setOppCity] = useState('');
  const [oppMinRent, setOppMinRent] = useState(1000);
  const [oppMaxRent, setOppMaxRent] = useState(3500);
  const [isSearchingOpportunities, setIsSearchingOpportunities] = useState(false);
  const [oppProgress, setOppProgress] = useState(0);
  const [oppStep, setOppStep] = useState('');
  const [oppResult, setOppResult] = useState<any | null>(null);
  const [oppError, setOppError] = useState<string | null>(null);
  const [oppTaskId, setOppTaskId] = useState<string | null>(null);
  const [oppSessionId, setOppSessionId] = useState<string | null>(null);
  
  const resultsRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const exploreCenterRef = useRef<{lat: number; lng: number} | null>(null);
  
  // Keep ref in sync with state
  exploreCenterRef.current = exploreCenter;
  
  // tRPC mutations
  const analysisMutation = trpc.rental.getEstimate.useMutation();
  const bulkMutation = trpc.bulkSummary.get.useMutation();
  const areaMutation = trpc.listingsByArea.get.useMutation();
  // Simplified Market Research (AirDNA only - instant results)
  const searchMarketsMutation = trpc.marketResearchSimple.searchMarkets.useMutation();
  const getMarketReportMutation = trpc.marketResearchSimple.getMarketReport.useMutation();
  
  // Opportunity Finder mutations (simplified)
  const findOpportunitiesMutation = trpc.opportunityFinder.findOpportunities.useMutation();
  const oppStatusQuery = trpc.opportunityFinder.getSearchStatus.useQuery(
    { taskId: oppTaskId! },
    { enabled: !!oppTaskId && isSearchingOpportunities, refetchInterval: 3000 }
  );
  const processResultsMutation = trpc.opportunityFinder.processResults.useMutation();
  const cleanupMutation = trpc.opportunityFinder.cleanup.useMutation();
  
  // Loading steps
  const loadingSteps = [
    'Looking for your home...',
    'Checking the area...',
    'Seeing how much you can make...',
    'Finding nearby Airbnbs...',
    'Making your report...'
  ];
  
  useEffect(() => {
    if (isAnalyzing) {
      setLoadingStep(0);
      const interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % loadingSteps.length);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isAnalyzing]);
  
  // Add YOUR PROPERTY marker when map and center are both ready
  const yourPropertyMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  
  // Create YOUR PROPERTY marker when both map and center are available
  useEffect(() => {
    // Only proceed if we have a map instance, center coordinates, and Google Maps API is loaded
    if (!mapRef.current || !exploreCenter || !showMapView || !mapReady) {
      return;
    }
    
    // Check if Google Maps marker API is available
    if (typeof google === 'undefined' || !google.maps?.marker?.AdvancedMarkerElement) {
      console.log('Google Maps marker API not yet available');
      return;
    }
    
    // Remove existing YOUR PROPERTY marker if any
    if (yourPropertyMarkerRef.current) {
      yourPropertyMarkerRef.current.map = null;
      yourPropertyMarkerRef.current = null;
    }
    
    // Create the marker content
    const searchedMarkerContent = document.createElement('div');
    searchedMarkerContent.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #D4A84B, #F59E0B);
        color: #1a1a2e;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 16px rgba(212, 168, 75, 0.6);
        cursor: default;
        white-space: nowrap;
        border: 3px solid white;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        YOUR PROPERTY
      </div>
    `;
    
    try {
      // Create the marker
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: exploreCenter,
        title: 'Your Property',
        content: searchedMarkerContent,
        zIndex: 9999,
      });
      
      yourPropertyMarkerRef.current = marker;
    } catch (error) {
      console.error('Error creating YOUR PROPERTY marker:', error);
    }
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (yourPropertyMarkerRef.current) {
        yourPropertyMarkerRef.current.map = null;
        yourPropertyMarkerRef.current = null;
      }
    };
  }, [exploreCenter, showMapView, mapReady]);
  
  // ============================================
  // SINGLE PROPERTY ANALYSIS
  // ============================================
  
  const runAnalysis = async () => {
    if (!address.trim()) {
      toast.error('Please type in an address');
      return;
    }
    if (!monthlyRent || parseFloat(monthlyRent) <= 0) {
      toast.error('Please type in the rent');
      return;
    }
    
    setIsAnalyzing(true);
    setResult(null);
    
    try {
      const response = await analysisMutation.mutateAsync({
        address: address.trim(),
        bedrooms: parseInt(bedrooms) || 2,
        bathrooms: parseFloat(bathrooms) || 1,
      });
      
      if (response.success && response.data) {
        const data = response.data;
        const annualRent = parseFloat(monthlyRent) * 12;
        
        const annualRevenue = data.estimates?.annual_revenue || 0;
        const revenueLow = data.estimates?.annual_revenue_low || annualRevenue * 0.85;
        const revenueHigh = data.estimates?.annual_revenue_high || annualRevenue * 1.15;
        
        const profit = annualRevenue - annualRent;
        const profitLow = revenueLow - annualRent;
        const profitHigh = revenueHigh - annualRent;
        
        const monthlyForecast: MonthlyForecast[] = (data.monthly_forecast || []).map((m: any) => ({
          month: m.month,
          revenue: m.revenue,
          adr: m.adr,
          occupancy: m.occupancy > 1 ? m.occupancy : m.occupancy * 100,
        }));
        
        const comparables: Comparable[] = (data.comps || []).slice(0, 10).map((comp: any, index: number) => {
          let occupancy = comp.occupancy || comp.occupancy_rate || 0;
          if (occupancy > 0 && occupancy <= 1) {
            occupancy = occupancy * 100;
          }
          
          const airbnbListingId = comp.airbnb_listing_id || comp.listing_id || null;
          const airbnbUrl = comp.airbnb_url || (airbnbListingId ? `https://www.airbnb.com/rooms/${airbnbListingId}` : null);
          
          return {
            id: comp.id || `comp-${index}`,
            title: comp.title || `${comp.bedrooms || 2}BR Rental`,
            bedrooms: comp.bedrooms || 2,
            bathrooms: comp.bathrooms || 1,
            accommodates: comp.accommodates || (comp.bedrooms || 2) * 2,
            revenue: comp.revenue || comp.annual_revenue || 0,
            adr: comp.adr || comp.average_daily_rate || 0,
            occupancy: occupancy,
            rating: comp.rating || 4.5,
            reviews: comp.reviews || comp.review_count || 0,
            imageUrl: comp.image_url || comp.thumbnail_url || null,
            airbnbUrl: airbnbUrl,
            distanceMeters: comp.distance_meters,
            monthlyMetrics: comp.monthly_metrics,
          };
        });
        
        setResult({
          revenue: annualRevenue,
          revenueLow: revenueLow,
          revenueHigh: revenueHigh,
          adr: data.estimates?.average_daily_rate || 0,
          occupancy: data.estimates?.occupancy_rate || 0,
          rent: annualRent,
          profit: profit,
          profitLow: profitLow,
          profitHigh: profitHigh,
          address: data.property?.address || address,
          bedrooms: data.property?.bedrooms || parseInt(bedrooms),
          bathrooms: data.property?.bathrooms || parseFloat(bathrooms),
          monthlyForecast: monthlyForecast,
          comparables: comparables,
          historical: data.historical,
        });
        
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        toast.error('We could not check this home. Try a different address.');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Oops! Something broke. Try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // ============================================
  // BULK COMPARE FUNCTIONS
  // ============================================
  
  const addBulkProperty = () => {
    if (bulkProperties.length >= 25) {
      toast.error('You can compare up to 25 homes at once');
      return;
    }
    setBulkProperties([
      ...bulkProperties,
      { id: Date.now().toString(), address: '', bedrooms: 2, bathrooms: 1, rent: 0 }
    ]);
  };
  
  const removeBulkProperty = (id: string) => {
    if (bulkProperties.length <= 1) {
      toast.error('You need at least one home to compare');
      return;
    }
    setBulkProperties(bulkProperties.filter(p => p.id !== id));
  };
  
  const updateBulkProperty = (id: string, field: keyof BulkPropertyInput, value: any) => {
    setBulkProperties(bulkProperties.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };
  
  const runBulkAnalysis = async () => {
    const validProperties = bulkProperties.filter(p => p.address.trim() && p.rent > 0);
    
    if (validProperties.length === 0) {
      toast.error('Add at least one home with an address and rent');
      return;
    }
    
    setIsBulkAnalyzing(true);
    setBulkResults(null);
    
    try {
      const response = await bulkMutation.mutateAsync({
        queries: validProperties.map(p => ({
          address: p.address.trim(),
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
        }))
      });
      
      if (response.success && response.data) {
        const results: BulkPropertyResult[] = response.data.results.map((r, index) => {
          const prop = validProperties[index];
          const annualRent = prop.rent * 12;
          const profit = r.revenue - annualRent;
          const ratio = annualRent > 0 ? r.revenue / annualRent : 0;
          
          let occupancy = r.occupancy || 0;
          if (occupancy > 0 && occupancy <= 1) {
            occupancy = occupancy * 100;
          }
          
          return {
            ...prop,
            revenue: r.revenue,
            adr: r.adr,
            occupancy: occupancy,
            profit: profit,
            ratio: ratio,
            success: r.success,
            error: r.error,
          };
        });
        
        setBulkResults(results);
        
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        toast.error('Could not check these homes. Try again.');
      }
    } catch (error) {
      console.error('Bulk analysis error:', error);
      toast.error('Oops! Something broke. Try again.');
    } finally {
      setIsBulkAnalyzing(false);
    }
  };
  
  const sortedBulkResults = bulkResults ? [...bulkResults].sort((a, b) => {
    const multiplier = bulkSortDir === 'desc' ? -1 : 1;
    if (bulkSortBy === 'profit') return (a.profit - b.profit) * multiplier;
    if (bulkSortBy === 'revenue') return (a.revenue - b.revenue) * multiplier;
    return (a.ratio - b.ratio) * multiplier;
  }) : null;
  
  // ============================================
  // MARKET EXPLORER FUNCTIONS
  // ============================================
  
  const runExplore = async () => {
    if (!exploreAddress.trim()) {
      toast.error('Type in an address or city to explore');
      return;
    }
    
    setIsExploring(true);
    setAreaListings(null);
    
    try {
      const response = await areaMutation.mutateAsync({
        address: exploreAddress.trim(),
        radiusMeters: exploreRadius,
        bedrooms: exploreBedroomFilter || undefined,
        minRating: exploreMinRating || undefined,
        pageSize: 25,
        sortBy: exploreSortBy,
        sortDirection: 'descending',
      });
      
      if (response.success && response.data) {
        const listings: AreaListing[] = response.data.listings.map((l: any) => ({
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
          occupancy: l.occupancy > 1 ? l.occupancy : l.occupancy * 100,
          distance_meters: l.distance_meters,
          airbnb_url: l.airbnb_url,
          image_url: l.image_url,
          superhost: l.superhost,
          latitude: l.latitude,
          longitude: l.longitude,
        }));
        
        setAreaListings(listings);
        setTotalListings(response.data.total_count || listings.length);
        
        // Set map center from response or first listing
        console.log('Explore response center:', response.data.center);
        if (response.data.center?.latitude && response.data.center?.longitude) {
          console.log('Setting explore center to:', response.data.center.latitude, response.data.center.longitude);
          setExploreCenter({ lat: response.data.center.latitude, lng: response.data.center.longitude });
        } else if (listings.length > 0 && listings[0].latitude && listings[0].longitude) {
          setExploreCenter({ lat: listings[0].latitude, lng: listings[0].longitude });
        }
        
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        toast.error('Could not find Airbnbs in this area. Try a different location.');
      }
    } catch (error) {
      console.error('Explore error:', error);
      toast.error('Oops! Something broke. Try again.');
    } finally {
      setIsExploring(false);
    }
  };
  
  // ============================================
  // MARKET RESEARCH FUNCTIONS
  // ============================================
  
  const runResearch = async () => {
    if (!selectedMarketId || !researchMarket.trim()) {
      toast.error('Please select a market from the suggestions');
      return;
    }
    
    setIsResearching(true);
    setResearchProgress(10);
    setResearchStep('Fetching market data...');
    setResearchResult(null);
    setResearchError(null);
    
    try {
      setResearchProgress(30);
      setResearchStep('Analyzing market metrics...');
      
      const report = await getMarketReportMutation.mutateAsync({
        marketId: String(selectedMarketId),
        marketName: researchMarket.trim(),
      });
      
      setResearchProgress(100);
      setResearchStep('Complete!');
      
      // Transform to match existing result format
      const transformedResult = {
        market: report.market.name,
        executiveSummary: {
          optimalBedroomSize: report.bedroomBreakdown.length > 0 
            ? `${[...report.bedroomBreakdown].sort((a, b) => b.avgRevenue - a.avgRevenue)[0]?.bedrooms || 2} BR` 
            : '2 BR',
          targetNeighborhoods: report.submarkets.slice(0, 3).map(s => s.name),
          keyFinding: report.insights[0] || 'Market data analyzed successfully.',
        },
        marketOverview: {
          totalListings: report.overview.totalListings,
          avgOccupancy: report.overview.avgOccupancy,
          avgAdr: report.overview.avgAdr,
          avgRevenue: report.overview.avgRevenue,
          topPropertyTypes: ['House', 'Apartment', 'Condo'],
        },
        bedroomAnalysis: report.bedroomBreakdown.map(b => ({
          bedrooms: b.bedrooms,
          occupancy: b.avgOccupancy,
          adr: 0,
          revenue: b.avgRevenue,
          count: b.count,
        })),
        topSubmarkets: report.submarkets.map(s => ({
          name: s.name,
          listings: s.listingCount,
          occupancy: s.avgOccupancy,
          revenue: s.avgRevenue,
        })),
        topPerformers: report.topPerformers.map(p => ({
          title: p.title,
          revenue: p.revenue,
          occupancy: p.occupancy,
          bedrooms: p.bedrooms,
          airbnbUrl: p.airbnbUrl,
        })),
        seasonality: {
          peakMonths: report.seasonality.peakMonths,
          lowMonths: report.seasonality.lowMonths,
          yoyTrend: '+0%',
        },
        recommendations: report.insights,
      };
      
      setResearchResult(transformedResult);
      setIsResearching(false);
      toast.success('Market research completed!');
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error) {
      console.error('Research error:', error);
      toast.error('Failed to get market data');
      setIsResearching(false);
      setResearchError('Failed to get market data. Please try a different market.');
    }
  };
  
  // ============================================
  // OPPORTUNITY FINDER FUNCTIONS
  // ============================================
  
  const runOpportunitySearch = async () => {
    if (!oppCity.trim()) {
      toast.error('Please enter a city name');
      return;
    }
    
    setIsSearchingOpportunities(true);
    setOppProgress(0);
    setOppStep('Starting search...');
    setOppResult(null);
    setOppError(null);
    
    try {
      const response = await findOpportunitiesMutation.mutateAsync({
        city: oppCity.trim(),
        minRent: oppMinRent,
        maxRent: oppMaxRent,
      });
      
      if (response.success) {
        setOppTaskId(response.taskId);
        setOppSessionId(response.sessionId);
        toast.success('Opportunity search started!');
      } else {
        throw new Error('Failed to start search');
      }
    } catch (error) {
      console.error('Opportunity search error:', error);
      toast.error('Failed to start opportunity search');
      setIsSearchingOpportunities(false);
      setOppError('Failed to start search');
    }
  };
  
  // Poll for opportunity search status (simplified)
  useEffect(() => {
    if (oppStatusQuery.data) {
      const { status, progress, currentStep, output } = oppStatusQuery.data;
      
      setOppProgress(progress);
      setOppStep(currentStep);
      
      if (status === 'ready' && output && oppTaskId) {
        // Process the rental results with AirDNA
        processResultsMutation.mutate(
          {
            city: oppCity,
            rentalOutput: output,
          },
          {
            onSuccess: (result) => {
              setOppResult(result);
              setIsSearchingOpportunities(false);
              setOppProgress(100);
              toast.success('Found opportunities!');
              
              // Cleanup session
              if (oppSessionId) {
                cleanupMutation.mutate({ sessionId: oppSessionId });
              }
              
              setTimeout(() => {
                resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            },
            onError: (error) => {
              setOppError('Failed to process results');
              setIsSearchingOpportunities(false);
              toast.error('Failed to process results');
            },
          }
        );
      } else if (status === 'error') {
        setOppError('Search failed. Please try again.');
        setIsSearchingOpportunities(false);
        toast.error('Search failed');
      }
    }
  }, [oppStatusQuery.data]);
  
  // Calculate max revenue for chart scaling
  const maxMonthlyRevenue = result?.monthlyForecast.length 
    ? Math.max(...result.monthlyForecast.map(m => m.revenue))
    : 0;
  
  // Determine if profitable
  const isProfitable = result ? result.profit > 0 : false;
  const profitRatio = result ? result.revenue / result.rent : 0;
  
  // ============================================
  // RENDER
  // ============================================
  

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#D4A84B]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#4ECDC4]/10 rounded-full blur-3xl" />
        </div>
        
        <div className="container relative z-10 max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4A84B]/10 border border-[#D4A84B]/20 rounded-full text-[#D4A84B] text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Free Home Check
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
              Can This Home
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4]">
                Make You Money?
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
              See how much money this home can make. We show you what nearby Airbnbs earn.
            </p>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex justify-center mb-8 px-2">
            <div className="inline-flex bg-slate-800/50 border border-slate-700/50 rounded-xl p-1 overflow-x-auto max-w-full">
              <button
                onClick={() => { setActiveTab('single'); setResult(null); }}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === 'single'
                    ? 'bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Home className="w-4 h-4" />
                One Home
              </button>
              <button
                onClick={() => { setActiveTab('compare'); setBulkResults(null); }}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === 'compare'
                    ? 'bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                Compare Many
              </button>
              <button
                onClick={() => { setActiveTab('explore'); setAreaListings(null); }}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === 'explore'
                    ? 'bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Search className="w-4 h-4" />
                Explore Area
              </button>
              <button
                onClick={() => { setActiveTab('research'); }}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === 'research'
                    ? 'bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Market Research
              </button>
              <button
                onClick={() => { setActiveTab('ebook'); }}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === 'ebook'
                    ? 'bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Free Ebook
              </button>

            </div>
          </div>
          
          {/* Search Form */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-2xl">
            
            {/* ============================================ */}
            {/* SINGLE PROPERTY TAB */}
            {/* ============================================ */}
            {activeTab === 'single' && (
              <div className="grid gap-6">
                <HelpSection
                  title="How to Use: One Home"
                  description="Analyze a single property to see how much money it could make on Airbnb"
                  steps={[
                    'Enter the property address',
                    'Enter the monthly rent you\'d pay',
                    'Select number of bedrooms and bathrooms',
                    'Click "Check This Home"',
                    'See revenue, profit, and comparable properties'
                  ]}
                  isOpen={showHelp === 'single'}
                  onToggle={() => setShowHelp(showHelp === 'single' ? null : 'single')}
                />
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Home Address
                  </label>
                  <AddressAutocomplete
                    value={address}
                    onChange={setAddress}
                    placeholder="Type the home address here..."
                    className="h-12 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Rent Per Month
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
                        <option key={num} value={num}>{num} {num === 1 ? 'Bedroom' : 'Bedrooms'}</option>
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
                        <option key={num} value={num}>{num} {num === 1 ? 'Bathroom' : 'Bathrooms'}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <Button
                  onClick={runAnalysis}
                  disabled={isAnalyzing}
                  size="lg"
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] hover:from-[#C9A43E] hover:to-[#45B8B0] text-white shadow-lg shadow-[#D4A84B]/25"
                >
                  {isAnalyzing ? (
                    <span className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {loadingSteps[loadingStep]}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Check This Home
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </Button>
              </div>
            )}
            
            {/* ============================================ */}
            {/* COMPARE PROPERTIES TAB */}
            {/* ============================================ */}
            {activeTab === 'compare' && (
              <div className="grid gap-6">
                <HelpSection
                  title="How to Use: Compare Many"
                  description="Compare up to 25 properties side-by-side to find the best opportunity"
                  steps={[
                    'Add multiple property addresses (up to 25)',
                    'Enter rent and bedroom/bathroom info for each',
                    'Click "Compare Properties"',
                    'See all properties ranked by profit',
                    'Sort by Money Made, Profit, or Money vs Rent ratio'
                  ]}
                  isOpen={showHelp === 'compare'}
                  onToggle={() => setShowHelp(showHelp === 'compare' ? null : 'compare')}
                />
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Compare Up to 25 Homes</h3>
                    <p className="text-sm text-slate-400">Add homes to see which one makes the most money</p>
                  </div>
                  <span className="text-sm text-slate-500">{bulkProperties.length}/25 homes</span>
                </div>
                
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {bulkProperties.map((prop, index) => (
                    <div key={prop.id} className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-6 h-6 rounded-full bg-[#D4A84B]/20 text-[#D4A84B] text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-sm text-slate-400">Home {index + 1}</span>
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
                            placeholder="Home address..."
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
                  className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:text-white hover:border-[#D4A84B]/50 transition-colors disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                  Add Another Home
                </button>
                
                <Button
                  onClick={runBulkAnalysis}
                  disabled={isBulkAnalyzing}
                  size="lg"
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] hover:from-[#C9A43E] hover:to-[#45B8B0] text-white shadow-lg shadow-[#D4A84B]/25"
                >
                  {isBulkAnalyzing ? (
                    <span className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Checking all homes...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Compare All Homes
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </Button>
              </div>
            )}
            
            {/* ============================================ */}
            {/* MARKET EXPLORER TAB */}
            {/* ============================================ */}
            {activeTab === 'explore' && (
              <div className="grid gap-6">
                <HelpSection
                  title="How to Use: Explore Area"
                  description="See all Airbnb listings in an area and find what's working"
                  steps={[
                    'Enter a city or neighborhood',
                    'Filter by number of bedrooms',
                    'See all active Airbnb listings nearby',
                    'Sort by "Most Money" or "Closest"',
                    'Click any listing to view on Airbnb'
                  ]}
                  isOpen={showHelp === 'explore'}
                  onToggle={() => setShowHelp(showHelp === 'explore' ? null : 'explore')}
                />
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">See All Airbnbs in an Area</h3>
                  <p className="text-sm text-slate-400">Find out what's already making money near any address</p>
                </div>
                
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
                      className="w-full h-10 px-3 bg-slate-900/50 border border-slate-600 rounded-md text-white text-sm"
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
                      value={exploreBedroomFilter || ''}
                      onChange={(e) => setExploreBedroomFilter(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full h-10 px-3 bg-slate-900/50 border border-slate-600 rounded-md text-white text-sm"
                    >
                      <option value="">Any</option>
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <option key={num} value={num}>{num} BR</option>
                      ))}
                    </select>
                  </div>
                  

                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Sort By
                    </label>
                    <select
                      value={exploreSortBy}
                      onChange={(e) => setExploreSortBy(e.target.value as any)}
                      className="w-full h-10 px-3 bg-slate-900/50 border border-slate-600 rounded-md text-white text-sm"
                    >
                      <option value="revenue">Most Money</option>
                      <option value="proximity">Closest</option>
                    </select>
                  </div>
                </div>
                
                <Button
                  onClick={runExplore}
                  disabled={isExploring}
                  size="lg"
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] hover:from-[#C9A43E] hover:to-[#45B8B0] text-white shadow-lg shadow-[#D4A84B]/25"
                >
                  {isExploring ? (
                    <span className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Finding Airbnbs...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Explore This Area
                      <Search className="w-5 h-5" />
                    </span>
                  )}
                </Button>
              </div>
            )}

            {/* ============================================ */}
            {/* MARKET RESEARCH TAB */}
            {/* ============================================ */}
            {activeTab === 'research' && (
              <div className="grid gap-6">
                <HelpSection
                  title="How to Use: Market Research"
                  description="Get instant market data and insights for any city"
                  steps={[
                    'Enter a city or market name',
                    'Click "Get Market Data"',
                    'See average revenue, occupancy rates, and trends',
                    'Learn what property types perform best',
                    'Understand seasonal patterns'
                  ]}
                  isOpen={showHelp === 'research'}
                  onToggle={() => setShowHelp(showHelp === 'research' ? null : 'research')}
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
                      placeholder="Type or select a market..."
                      className="h-12 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                      disabled={isResearching}
                    />
                    {showMarketSuggestions && !isResearching && (
                      <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {[
                          'Atlanta, GA', 'Austin, TX', 'Boston, MA', 'Charlotte, NC', 'Chicago, IL',
                          'Dallas, TX', 'Denver, CO', 'Houston, TX', 'Las Vegas, NV', 'Los Angeles, CA',
                          'Miami, FL', 'Nashville, TN', 'New Orleans, LA', 'New York, NY', 'Orlando, FL',
                          'Phoenix, AZ', 'Portland, OR', 'San Antonio, TX', 'San Diego, CA', 'San Francisco, CA',
                          'Seattle, WA', 'St. Louis, MO', 'Tampa, FL', 'Washington, DC'
                        ].filter(city => 
                          city.toLowerCase().includes(researchMarket.toLowerCase()) || researchMarket === ''
                        ).map((city) => (
                          <button
                            key={city}
                            type="button"
                            onClick={() => {
                              setResearchMarket(city);
                              setShowMarketSuggestions(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                          >
                            {city}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Select from popular markets or type your own</p>
                </div>
                
                <Button
                  onClick={runResearch}
                  disabled={isResearching || !researchMarket.trim()}
                  size="lg"
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] hover:from-[#C9A43E] hover:to-[#45B8B0] text-white shadow-lg shadow-[#D4A84B]/25"
                >
                  {isResearching ? (
                    <span className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Researching... {researchProgress}%
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Start Market Research
                      <BarChart3 className="w-5 h-5" />
                    </span>
                  )}
                </Button>
                
                {isResearching && (
                  <div className="space-y-3">
                    <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] transition-all duration-500"
                        style={{ width: `${researchProgress}%` }}
                      />
                    </div>
                    <p className="text-sm text-slate-400 text-center">
                      {researchStep || 'Processing...'}
                    </p>
                  </div>
                )}
                
                {researchError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {researchError}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </section>
      
      {/* ============================================ */}
      {/* SINGLE PROPERTY RESULTS */}
      {/* ============================================ */}
      {activeTab === 'single' && result && (
        <section ref={resultsRef} className="py-12 md:py-16">
          <div className="container max-w-4xl mx-auto px-4">
            {/* Property Header */}
            <div className="flex items-start gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-[#D4A84B]" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-white">{result.address}</h2>
                <p className="text-slate-400 flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1">
                    <Bed className="w-4 h-4" />
                    {result.bedrooms} bed
                  </span>
                  <span className="flex items-center gap-1">
                    <Bath className="w-4 h-4" />
                    {result.bathrooms} bath
                  </span>
                </p>
              </div>
            </div>
            
            {/* Verdict Card */}
            <div className={`rounded-2xl p-6 md:p-8 mb-8 border ${
              profitRatio >= 2.5 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : profitRatio >= 1.5 
                  ? 'bg-[#D4A84B]/10 border-[#D4A84B]/30'
                  : 'bg-slate-800/50 border-slate-700/50'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                {profitRatio >= 1.5 ? (
                  <CheckCircle2 className={`w-8 h-8 ${profitRatio >= 2.5 ? 'text-emerald-400' : 'text-[#D4A84B]'}`} />
                ) : (
                  <Target className="w-8 h-8 text-slate-400" />
                )}
                <div>
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                    profitRatio >= 2.5 
                      ? 'bg-emerald-500/20 text-emerald-300' 
                      : profitRatio >= 1.5 
                        ? 'bg-[#D4A84B]/20 text-[#D4A84B]'
                        : 'bg-slate-700 text-slate-300'
                  }`}>
                    {profitRatio >= 2.5 ? 'Great Deal!' : profitRatio >= 1.5 ? 'Good Deal!' : 'Worth Looking At'}
                  </span>
                </div>
              </div>
              
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {profitRatio >= 1.5 
                  ? 'Yes! This Home Can Make Money' 
                  : 'This Home Might Work'}
              </h3>
              <p className="text-slate-400">
                {profitRatio >= 1.5 
                  ? `You can make ${profitRatio.toFixed(1)} times your rent! Other Airbnbs nearby are doing it too.`
                  : `This home makes ${profitRatio.toFixed(1)}x rent. You might need to lower rent or boost bookings.`}
              </p>
            </div>
            
            {/* Revenue Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Annual Revenue */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <DollarSign className="w-5 h-5" />
                  <span className="text-sm font-medium">Money You Can Make (Per Year)</span>
                </div>
                <div className="text-3xl md:text-4xl font-bold text-white mb-1">
                  {formatCurrency(result.revenue)}
                </div>
                <div className="text-sm text-slate-500">
                  Range: {formatCurrency(result.revenueLow)} – {formatCurrency(result.revenueHigh)}
                </div>
                {result.historical && result.historical.summary.yearly_pct_change !== 0 && (
                  <div className={`flex items-center gap-1 mt-2 text-sm ${
                    result.historical.summary.yearly_pct_change > 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {result.historical.summary.yearly_pct_change > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span>
                      {result.historical.summary.yearly_pct_change > 0 ? '+' : ''}
                      {result.historical.summary.yearly_pct_change.toFixed(1)}% more money this year
                    </span>
                  </div>
                )}
              </div>
              
              {/* Annual Profit */}
              <div className={`rounded-2xl p-6 border ${
                isProfitable 
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm font-medium">Your Profit (Per Year)</span>
                </div>
                <div className={`text-3xl md:text-4xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isProfitable ? '+' : ''}{formatCurrency(result.profit)}
                </div>
                <div className="text-sm text-slate-500">
                  {formatCurrency(Math.round(result.profit / 12))}/month after rent
                </div>
              </div>
            </div>
            
            {/* Cash Flow Breakdown */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 sm:p-6 mb-8">
              <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                <div>
                  <div className="text-xs sm:text-sm text-slate-400 mb-1">Airbnb Money</div>
                  <div className="text-base sm:text-xl font-bold text-white">{formatCurrency(result.revenue)}</div>
                  <div className="text-[10px] sm:text-xs text-slate-500">{formatCurrency(Math.round(result.revenue / 12))}/mo</div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-slate-400 mb-1">Rent You Pay</div>
                  <div className="text-base sm:text-xl font-bold text-red-400">-{formatCurrency(result.rent)}</div>
                  <div className="text-[10px] sm:text-xs text-slate-500">-{formatCurrency(Math.round(result.rent / 12))}/mo</div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-slate-400 mb-1">You Keep</div>
                  <div className={`text-base sm:text-xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isProfitable ? '+' : ''}{formatCurrency(result.profit)}
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-500">
                    {isProfitable ? '+' : ''}{formatCurrency(Math.round(result.profit / 12))}/mo
                  </div>
                </div>
              </div>
            </div>
            
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-8">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-xs sm:text-sm text-slate-400 mb-1">Price Per Night</div>
                <div className="text-lg sm:text-2xl font-bold text-white">{formatCurrency(result.adr)}</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-xs sm:text-sm text-slate-400 mb-1">Nights Booked</div>
                <div className="text-lg sm:text-2xl font-bold text-white">
                  {result.occupancy > 1 ? Math.round(result.occupancy) : Math.round(result.occupancy * 100)}%
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-xs sm:text-sm text-slate-400 mb-1">Money vs Rent</div>
                <div className="text-lg sm:text-2xl font-bold text-[#D4A84B]">{profitRatio.toFixed(1)}x</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-xs sm:text-sm text-slate-400 mb-1">Nearby Airbnbs</div>
                <div className="text-lg sm:text-2xl font-bold text-white">{result.comparables.length}</div>
              </div>
            </div>
            
            {/* Monthly Forecast */}
            {result.monthlyForecast.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 sm:p-6 mb-8">
                <div className="flex items-center gap-2 mb-4 sm:mb-6">
                  <BarChart3 className="w-4 sm:w-5 h-4 sm:h-5 text-[#4ECDC4]" />
                  <h3 className="text-base sm:text-lg font-semibold text-white">Money Each Month</h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mb-4">See which months make the most</p>
                
                <div className="flex items-end justify-between gap-1 sm:gap-2 h-32 sm:h-48">
                  {result.monthlyForecast.map((month, index) => {
                    const heightPercent = maxMonthlyRevenue > 0 ? (month.revenue / maxMonthlyRevenue) * 100 : 0;
                    const isHighMonth = month.revenue >= maxMonthlyRevenue * 0.8;
                    
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div className="text-[8px] sm:text-xs text-slate-400 mb-1 hidden sm:block">{formatCurrency(month.revenue)}</div>
                        <div 
                          className={`w-full rounded-t-lg transition-all ${
                            isHighMonth ? 'bg-emerald-500' : 'bg-slate-600'
                          }`}
                          style={{ height: `${Math.max(heightPercent, 5)}%` }}
                        />
                        <div className="text-[8px] sm:text-xs text-slate-500 mt-1 sm:mt-2">{getMonthAbbr(month.month)}</div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex items-center gap-2 mt-3 sm:mt-4 text-xs sm:text-sm text-slate-400">
                  <Calendar className="w-3 sm:w-4 h-3 sm:h-4 text-emerald-400" />
                  <span><span className="text-emerald-400 font-medium">Best months</span> are green</span>
                </div>
              </div>
            )}
            
            {/* Comparable Properties */}
            {result.comparables.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <Home className="w-5 h-5 text-[#D4A84B]" />
                  <h3 className="text-lg font-semibold text-white">Airbnbs Near You</h3>
                </div>
                <p className="text-sm text-slate-400 mb-6">
                  Real numbers from {result.comparables.length} Airbnbs close to this home
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.comparables.map((comp) => {
                    const compProfit = comp.revenue - result.rent;
                    const isProfitableComp = compProfit > 0;
                    
                    return (
                      <a
                        key={comp.id}
                        href={comp.airbnbUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 hover:border-[#D4A84B]/50 transition-all cursor-pointer"
                      >
                        <div className="flex gap-4">
                          {/* Image */}
                          <div className="w-20 h-20 rounded-lg bg-slate-700 overflow-hidden flex-shrink-0">
                            {comp.imageUrl ? (
                              <img 
                                src={comp.imageUrl} 
                                alt={comp.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Home className="w-8 h-8 text-slate-500" />
                              </div>
                            )}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                isProfitableComp 
                                  ? 'bg-emerald-500/20 text-emerald-300' 
                                  : 'bg-red-500/20 text-red-300'
                              }`}>
                                {isProfitableComp ? '+' : ''}{formatCurrency(compProfit)}/yr profit
                              </span>
                              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-[#D4A84B] transition-colors opacity-0 group-hover:opacity-100" />
                            </div>
                            
                            <h4 className="font-medium text-white text-sm truncate mb-1 group-hover:text-[#D4A84B] transition-colors">
                              {comp.title}
                            </h4>
                            
                            <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                              <span className="flex items-center gap-1">
                                <Bed className="w-3 h-3" />
                                {comp.bedrooms}
                              </span>
                              <span className="flex items-center gap-1">
                                <Bath className="w-3 h-3" />
                                {comp.bathrooms}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {comp.accommodates}
                              </span>
                              {comp.rating && (
                                <span className="flex items-center gap-1">
                                  <Star className="w-3 h-3 text-[#D4A84B] fill-[#D4A84B]" />
                                  {comp.rating.toFixed(1)}
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <div className="text-slate-500">Made</div>
                                <div className="text-white font-medium">{formatCurrency(comp.revenue)}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Per Night</div>
                                <div className="text-white font-medium">{formatCurrency(comp.adr)}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Booked</div>
                                <div className="text-white font-medium">{Math.round(comp.occupancy)}%</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
                
                {/* Market Insight */}
                {(() => {
                  const profitableCount = result.comparables.filter(c => c.revenue > result.rent).length;
                  const totalCount = result.comparables.length;
                  const isGoodNews = profitableCount >= Math.ceil(totalCount / 2); // Good if at least half are profitable
                  
                  return (
                    <div className={`mt-6 p-4 rounded-xl ${isGoodNews ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                      <div className={`flex items-center gap-2 font-medium mb-1 ${isGoodNews ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isGoodNews ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        {isGoodNews ? 'Good News' : 'Heads Up'}
                      </div>
                      <p className="text-sm text-slate-300">
                        {profitableCount === 0 
                          ? `None of the ${totalCount} nearby Airbnbs make more than your rent. This area may be tough for short-term rentals.`
                          : profitableCount === totalCount
                            ? `All ${totalCount} nearby Airbnbs make more than your rent. This is a hot market!`
                            : profitableCount >= Math.ceil(totalCount / 2)
                              ? `${profitableCount} out of ${totalCount} nearby Airbnbs make more than your rent. People want to stay here!`
                              : `Only ${profitableCount} out of ${totalCount} nearby Airbnbs make more than your rent. Do your research before jumping in.`
                        }
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
            
            {/* CTA Section */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl p-8 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#4ECDC4]/10 border border-[#4ECDC4]/20 rounded-full text-[#4ECDC4] text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                We Do It For You
              </div>
              
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Want Us to Set This Up?
              </h3>
              <p className="text-slate-400 mb-6 max-w-lg mx-auto">
                The numbers look good! But setting up an Airbnb is hard work. We can do it all for you so you can start making money fast.
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { icon: Search, label: 'Find Your Home', desc: 'We find the best deals for you' },
                  { icon: Home, label: 'Set Up Everything', desc: 'Furniture, decor, all of it' },
                  { icon: Star, label: 'Go Live on Airbnb', desc: 'Great photos and a perfect listing' },
                  { icon: Clock, label: 'Help For 12 Months', desc: 'We coach you the whole first year' },
                ].map((item, index) => (
                  <div key={index} className="text-center">
                    <div className="w-12 h-12 rounded-xl bg-[#D4A84B]/10 border border-[#D4A84B]/20 flex items-center justify-center mx-auto mb-2">
                      <item.icon className="w-6 h-6 text-[#D4A84B]" />
                    </div>
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="text-xs text-slate-500">{item.desc}</div>
                  </div>
                ))}
              </div>
              
              <Button
                asChild
                size="lg"
                className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/25"
              >
                <a href="https://masterclass.coachinayah.com/the-turnkey-program-2" target="_blank" rel="noopener noreferrer">
                  See How It Works
                  <ArrowUpRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
              
              <p className="mt-4 text-sm text-slate-500">
                Get up to $125K to start • We help you for 12 months
              </p>
            </div>
            
            {/* Data Source Attribution */}
            <div className="mt-12 pt-8 border-t border-slate-700/50">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span>
                  Powered by <span className="text-[#D4A84B] font-medium">Coach Inayah Market Data</span> — 
                  Data from Airbnb, Vrbo, and other major booking platforms
                </span>
              </div>
            </div>
            
          </div>
        </section>
      )}
      
      {/* ============================================ */}
      {/* BULK COMPARE RESULTS */}
      {/* ============================================ */}
      {activeTab === 'compare' && sortedBulkResults && (
        <section ref={resultsRef} className="py-12 md:py-16">
          <div className="container max-w-5xl mx-auto px-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Your Home Comparison</h2>
                <p className="text-sm sm:text-base text-slate-400">
                  {sortedBulkResults.filter(r => r.success).length} homes checked • 
                  Best one is at the top
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-slate-400">Sort by:</span>
                <select
                  value={bulkSortBy}
                  onChange={(e) => setBulkSortBy(e.target.value as any)}
                  className="h-9 px-3 bg-slate-800 border border-slate-600 rounded-md text-white text-sm"
                >
                  <option value="profit">Profit</option>
                  <option value="revenue">Money Made</option>
                  <option value="ratio">Money vs Rent</option>
                </select>
                <button
                  onClick={() => setBulkSortDir(bulkSortDir === 'desc' ? 'asc' : 'desc')}
                  className="h-9 w-9 flex items-center justify-center bg-slate-800 border border-slate-600 rounded-md text-slate-400 hover:text-white"
                >
                  {bulkSortDir === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              {sortedBulkResults.map((result, index) => {
                const isWinner = index === 0 && result.profit > 0;
                
                return (
                  <div
                    key={result.id}
                    className={`rounded-2xl p-6 border transition-all ${
                      isWinner 
                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                        : result.success 
                          ? 'bg-slate-800/50 border-slate-700/50'
                          : 'bg-red-500/10 border-red-500/30 opacity-60'
                    }`}
                  >
                    {!result.success ? (
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                          <X className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <div className="font-medium text-white">{result.address}</div>
                          <div className="text-sm text-red-400">Could not check this home</div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4 items-center">
                        {/* Rank & Address */}
                        <div className="col-span-2 sm:col-span-3 md:col-span-2 flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            isWinner 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-slate-700 text-slate-300'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium text-white text-sm truncate max-w-[200px]">
                              {result.address}
                            </div>
                            <div className="text-xs text-slate-400">
                              {result.bedrooms}BR • {result.bathrooms}BA • ${result.rent}/mo rent
                            </div>
                          </div>
                        </div>
                        
                        {/* Revenue */}
                        <div className="text-center">
                          <div className="text-xs text-slate-400 mb-1">Money Made</div>
                          <div className="text-lg font-bold text-white">{formatCurrency(result.revenue)}</div>
                        </div>
                        
                        {/* Profit */}
                        <div className="text-center">
                          <div className="text-xs text-slate-400 mb-1">Profit</div>
                          <div className={`text-lg font-bold ${result.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {result.profit > 0 ? '+' : ''}{formatCurrency(result.profit)}
                          </div>
                        </div>
                        
                        {/* Ratio */}
                        <div className="text-center">
                          <div className="text-xs text-slate-400 mb-1">Money vs Rent</div>
                          <div className={`text-lg font-bold ${
                            result.ratio >= 2 ? 'text-emerald-400' : result.ratio >= 1.5 ? 'text-[#D4A84B]' : 'text-slate-400'
                          }`}>
                            {result.ratio.toFixed(1)}x
                          </div>
                        </div>
                        
                        {/* Occupancy */}
                        <div className="text-center">
                          <div className="text-xs text-slate-400 mb-1">Booked</div>
                          <div className="text-lg font-bold text-white">{Math.round(result.occupancy)}%</div>
                        </div>
                      </div>
                    )}
                    
                    {isWinner && (
                      <div className="mt-4 pt-4 border-t border-emerald-500/30 flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-medium">Best Pick!</span>
                        <span className="text-emerald-300/70">This home makes the most money for you.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* CTA */}
            <div className="mt-8 text-center">
              <Button
                asChild
                size="lg"
                className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/25"
              >
                <a href="https://masterclass.coachinayah.com/the-turnkey-program-2" target="_blank" rel="noopener noreferrer">
                  Get Help Setting Up Your Best Pick
                  <ArrowUpRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
            </div>
            
            {/* Data Source Attribution */}
            <div className="mt-12 pt-8 border-t border-slate-700/50">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <span>
                  Powered by <span className="text-[#D4A84B] font-medium">Coach Inayah Market Data</span> — 
                  Data from Airbnb, Vrbo, and other major booking platforms
                </span>
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* ============================================ */}
      {/* MARKET EXPLORER RESULTS */}
      {/* ============================================ */}
      {activeTab === 'explore' && areaListings && (
        <section ref={resultsRef} className="py-12 md:py-16">
          <div className="container max-w-5xl mx-auto px-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Airbnbs in This Area</h2>
                <p className="text-sm sm:text-base text-slate-400">
                  Found {totalListings} Airbnbs • Showing top {areaListings.length}
                </p>
              </div>
            </div>
            
            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-xs sm:text-sm text-slate-400 mb-1">Total Airbnbs</div>
                <div className="text-lg sm:text-2xl font-bold text-white">{totalListings}</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-xs sm:text-sm text-slate-400 mb-1">Avg Money Made</div>
                <div className="text-lg sm:text-2xl font-bold text-emerald-400">
                  {formatCurrency(Math.round(areaListings.reduce((sum, l) => sum + l.annual_revenue, 0) / areaListings.length))}
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-xs sm:text-sm text-slate-400 mb-1">Avg Per Night</div>
                <div className="text-lg sm:text-2xl font-bold text-white">
                  {formatCurrency(Math.round(areaListings.reduce((sum, l) => sum + l.adr, 0) / areaListings.length))}
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-xs sm:text-sm text-slate-400 mb-1">Avg Booked</div>
                <div className="text-lg sm:text-2xl font-bold text-white">
                  {Math.round(areaListings.reduce((sum, l) => sum + l.occupancy, 0) / areaListings.length)}%
                </div>
              </div>
            </div>
            
            {/* Listings Grid */}
            {areaListings.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {areaListings.map((listing) => (
                  <a
                    key={listing.id}
                    href={listing.airbnb_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-[#D4A84B]/50 transition-all"
                  >
                    {/* Image Placeholder with Gradient */}
                    <div className="aspect-[4/3] relative overflow-hidden">
                      {/* Gradient Background based on property type */}
                      <div className={`w-full h-full flex flex-col items-center justify-center ${
                        listing.property_type?.toLowerCase().includes('house') 
                          ? 'bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-400'
                          : listing.property_type?.toLowerCase().includes('apartment') || listing.property_type?.toLowerCase().includes('condo')
                            ? 'bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-400'
                            : listing.property_type?.toLowerCase().includes('cabin') || listing.property_type?.toLowerCase().includes('cottage')
                              ? 'bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-400'
                              : 'bg-gradient-to-br from-slate-600 via-slate-500 to-slate-400'
                      }`}>
                        {/* Property Icon */}
                        <Home className="w-10 h-10 text-white/80 mb-2" />
                        <span className="text-white/90 text-xs font-medium px-2 py-1 bg-black/20 rounded-full">
                          {listing.property_type || 'Property'}
                        </span>
                        {/* Decorative Pattern */}
                        <div className="absolute inset-0 opacity-10">
                          <div className="absolute top-4 left-4 w-16 h-16 border-2 border-white rounded-full" />
                          <div className="absolute bottom-4 right-4 w-24 h-24 border-2 border-white rounded-full" />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-white rounded-full" />
                        </div>
                      </div>
                      
                      {/* Revenue Badge */}
                      <div className="absolute top-3 left-3 px-2 py-1 bg-emerald-500 text-white text-xs font-bold rounded-lg">
                        {formatCurrency(listing.annual_revenue)}/yr
                      </div>
                      
                      {/* Superhost Badge */}
                      {listing.superhost && (
                        <div className="absolute top-3 right-3 px-2 py-1 bg-[#D4A84B] text-white text-xs font-bold rounded-lg">
                          Superhost
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="p-4">
                      <h4 className="font-medium text-white text-sm truncate mb-2 group-hover:text-[#D4A84B] transition-colors">
                        {listing.title}
                      </h4>
                      
                      <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                        <span className="flex items-center gap-1">
                          <Bed className="w-3 h-3" />
                          {listing.bedrooms}
                        </span>
                        <span className="flex items-center gap-1">
                          <Bath className="w-3 h-3" />
                          {listing.bathrooms}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {listing.accommodates}
                        </span>
                        {listing.rating && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-[#D4A84B] fill-[#D4A84B]" />
                            {listing.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-slate-500">Per Night</div>
                          <div className="text-white font-medium">{formatCurrency(listing.adr)}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Booked</div>
                          <div className="text-white font-medium">{Math.round(listing.occupancy)}%</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Distance</div>
                          <div className="text-white font-medium">
                            {listing.distance_meters < 1000 
                              ? `${Math.round(listing.distance_meters)}m` 
                              : `${(listing.distance_meters / 1000).toFixed(1)}km`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
            
            {/* CTA */}
            <div className="mt-8 p-6 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl text-center">
              <h3 className="text-xl font-bold text-white mb-2">Want to Join These Airbnbs?</h3>
              <p className="text-slate-400 mb-4">We can help you set up your own Airbnb in this area.</p>
              <Button
                asChild
                size="lg"
                className="h-12 px-6 font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
              >
                <a href="https://masterclass.coachinayah.com/the-turnkey-program-2" target="_blank" rel="noopener noreferrer">
                  Get Started
                  <ArrowUpRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
            </div>
            
            {/* Data Source Attribution */}
            <div className="mt-12 pt-8 border-t border-slate-700/50">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <span>
                  Powered by <span className="text-[#D4A84B] font-medium">Coach Inayah Market Data</span> — 
                  Data from Airbnb, Vrbo, and other major booking platforms
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* MARKET RESEARCH TAB RESULTS */}
      {/* ============================================ */}
      {activeTab === 'research' && researchResult && (
        <section ref={resultsRef} className="py-8 md:py-16">
          <div className="max-w-6xl mx-auto px-3 sm:px-4">
            {/* Header */}
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4">
                {researchResult.market} Market Research
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-slate-400 px-2">
                {researchResult.executiveSummary?.keyFinding || 'Comprehensive market analysis'}
              </p>
            </div>
            
            {/* Executive Summary */}
            {researchResult.executiveSummary && (
              <div className="bg-gradient-to-br from-[#D4A84B]/10 to-[#4ECDC4]/10 border border-[#D4A84B]/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 mb-6 md:mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 md:mb-4">Executive Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <div className="text-slate-400 text-sm">Optimal Bedroom Size</div>
                    <div className="text-white font-semibold text-lg">{researchResult.executiveSummary.optimalBedroomSize}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-slate-400 text-sm">Target Neighborhoods</div>
                    <div className="text-white font-semibold">{researchResult.executiveSummary.targetNeighborhoods?.join(', ') || 'N/A'}</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Market Overview */}
            {researchResult.marketOverview && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 mb-6 md:mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 md:mb-6">Market Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
                  <div>
                    <div className="text-slate-400 text-xs sm:text-sm mb-1">Total Listings</div>
                    <div className="text-white font-bold text-lg sm:text-2xl">{researchResult.marketOverview.totalListings?.toLocaleString() || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs sm:text-sm mb-1">Avg Occupancy</div>
                    <div className="text-white font-bold text-lg sm:text-2xl">{((researchResult.marketOverview.avgOccupancy || 0) * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs sm:text-sm mb-1">Avg ADR</div>
                    <div className="text-white font-bold text-lg sm:text-2xl">${researchResult.marketOverview.avgADR?.toFixed(0) || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs sm:text-sm mb-1">Avg Revenue</div>
                    <div className="text-white font-bold text-lg sm:text-2xl">${(researchResult.marketOverview.avgRevenue || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Bedroom Analysis */}
            {researchResult.bedroomAnalysis && researchResult.bedroomAnalysis.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 mb-6 md:mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 md:mb-6">Bedroom Analysis</h3>
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-4">
                  {researchResult.bedroomAnalysis.map((br: any, idx: number) => (
                    <div key={idx} className="bg-slate-900/50 rounded-lg p-2 sm:p-4 text-center">
                      <div className="text-slate-400 text-xs sm:text-sm mb-1">{br.bedroomSize}</div>
                      <div className="text-white font-bold text-base sm:text-xl">{((br.occupancy || 0) * 100).toFixed(0)}%</div>
                      {br.avgRevenue && (
                        <div className="text-slate-500 text-[10px] sm:text-xs mt-1">${(br.avgRevenue).toLocaleString(undefined, {maximumFractionDigits: 0})}/yr</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Top Submarkets */}
            {researchResult.submarkets && researchResult.submarkets.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 mb-6 md:mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 md:mb-6">Top Submarkets</h3>
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <table className="w-full min-w-[400px] text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-slate-400 font-medium">Submarket</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-slate-400 font-medium">Listings</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-slate-400 font-medium">Occ.</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-slate-400 font-medium">ADR</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-slate-400 font-medium">RevPAR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {researchResult.submarkets.slice(0, 10).map((sm: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-700/50">
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-white font-medium truncate max-w-[120px] sm:max-w-none">{sm.name}</td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-slate-300">{sm.listings}</td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-slate-300">{((sm.occupancy || 0) * 100).toFixed(0)}%</td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-slate-300">${sm.adr?.toFixed(0)}</td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-white font-semibold">${sm.revpar?.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Top Performers */}
            {researchResult.topPerformers && researchResult.topPerformers.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 mb-6 md:mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 md:mb-6">Top Performing Properties</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {researchResult.topPerformers.slice(0, 6).map((prop: any, idx: number) => (
                    <div key={idx} className="bg-slate-900/50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-white font-semibold">{prop.title}</h4>
                        {prop.airbnbUrl && (
                          <a href={prop.airbnbUrl} target="_blank" rel="noopener noreferrer" className="text-[#4ECDC4] hover:underline text-sm">
                            View →
                          </a>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-slate-500">Revenue</div>
                          <div className="text-white font-semibold">${(prop.revenue || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Occupancy</div>
                          <div className="text-white font-semibold">{((prop.occupancy || 0) * 100).toFixed(0)}%</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Bedrooms</div>
                          <div className="text-white font-semibold">{prop.bedrooms} BR</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Recommendations */}
            {researchResult.recommendations && researchResult.recommendations.length > 0 && (
              <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 md:mb-4">Recommendations</h3>
                <ul className="space-y-3">
                  {researchResult.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-300">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* EBOOK TAB */}
      {/* ============================================ */}
      {activeTab === 'ebook' && (
        <div className="w-full h-screen flex flex-col bg-gradient-to-br from-slate-900 to-slate-800">
          {/* Ebook Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-6 text-white">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Rental Riches</h2>
            <p className="text-blue-100">Master Short-Term Rentals for Long-Term Wealth</p>
          </div>

          {/* Ebook Viewer */}
          <div className="flex-1 overflow-auto">
            <EbookViewer isOpen={activeTab === 'ebook'} onClose={() => setActiveTab('single')} />
          </div>
        </div>
      )}

    </div>
  );
}
