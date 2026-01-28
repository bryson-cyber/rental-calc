import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  TrendingUp, 
  Loader2, 
  Search,
  MapPin,
  Building2,
  BarChart3,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  Clock,
  Home,
  DollarSign,
  Percent,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  MessageSquare,
  Zap,
  RefreshCw,
  WifiOff,
  ServerCrash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Streamdown } from 'streamdown';
import { trpc } from '@/lib/trpc';
import { useProperty, useMarketAdvisorFilters, type AmenitiesFilter } from '@/contexts/PropertyContext';

interface MarketSearchResult {
  id: string;
  name: string;
  type: 'market' | 'submarket';
  listing_count: number;
  location_name: string;
  state?: string;
  country?: string;
}

interface StandaloneMarketAdvisorProps {
  onMarketSelect?: (marketId: string, marketName: string) => void;
  myProperty?: {
    address?: string;
    zipCode?: string;
    city?: string;
  };
}

export function StandaloneMarketAdvisor({ onMarketSelect, myProperty }: StandaloneMarketAdvisorProps) {
  // Use context for all filters to persist across component remounts
  const {
    filters,
    setBedroomFilter,
    setAmenitiesFilter,
    setPropertyTypeFilter,
    setRatingFilter,
    setReviewCountFilter,
    setSuperhostOnly,
    setProfessionalOnly,
    setInstantBookOnly,
    setListingTypeFilter,
  } = useMarketAdvisorFilters();
  
  // Destructure filter values for easier access
  const bedroomFilter = filters.bedroomFilter;
  const amenitiesFilter = filters.amenitiesFilter;
  const propertyTypeFilter = filters.propertyTypeFilter;
  const ratingFilter = filters.ratingFilter;
  const reviewCountFilter = filters.reviewCountFilter;
  const superhostOnly = filters.superhostOnly;
  const professionalOnly = filters.professionalOnly;
  const instantBookOnly = filters.instantBookOnly;
  const listingTypeFilter = filters.listingTypeFilter;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MarketSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<{ id: string; name: string; type: 'market' | 'submarket' | 'zipcode' } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [marketAdvice, setMarketAdvice] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    scores: false,
    metrics: true,
    seasonality: false,
    historical: false,
    topPerformers: false,
    cancellationPolicies: false,
    professionalStats: false,
    futurePricing: false,
    submarkets: false,
    supplyChart: false,
    revparChart: false,
  });
  
  // Local UI state for dropdowns (these don't need to persist)
  const [showAmenitiesDropdown, setShowAmenitiesDropdown] = useState(false);
  const [showPropertyTypeDropdown, setShowPropertyTypeDropdown] = useState(false);
  const [showRatingDropdown, setShowRatingDropdown] = useState(false);
  const [showReviewCountDropdown, setShowReviewCountDropdown] = useState(false);
  const [showListingTypeDropdown, setShowListingTypeDropdown] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{
    step: number;
    message: string;
    steps: string[];
    startTime: number | null;
    elapsedSeconds: number;
    isTakingLong: boolean;
  }>({
    step: 0,
    message: '',
    steps: [
      'Fetching market overview...',
      'Gathering historical data...',
      'Analyzing seasonality patterns...',
      'Collecting top performers...',
      'Generating AI insights...',
      'Finalizing report...'
    ],
    startTime: null,
    elapsedSeconds: 0,
    isTakingLong: false
  });
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [justSelected, setJustSelected] = useState(false);

  const searchMarketsMutation = trpc.rental.searchMarkets.useQuery(
    { searchTerm: searchQuery, limit: 10 },
    { enabled: searchQuery.length >= 2 }
  );

  const standaloneMarketAdvisorMutation = trpc.advanced.standaloneMarketAdvisor.useMutation();

  // Auto-populate search with zip code from myProperty if available
  useEffect(() => {
    if (myProperty?.zipCode && !searchQuery && !selectedMarket) {
      setSearchQuery(myProperty.zipCode);
    }
  }, [myProperty?.zipCode]);

  // Update search results when query changes
  useEffect(() => {
    if (searchMarketsMutation.data?.success && searchMarketsMutation.data.data) {
      setSearchResults(searchMarketsMutation.data.data);
      // Only show results if we didn't just select a market
      if (!justSelected) {
        setShowResults(true);
      }
    }
  }, [searchMarketsMutation.data, justSelected]);


  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Reset the justSelected flag when user starts typing again
    setJustSelected(false);
    setSearchQuery(value);
    if (value.length < 2) {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleMarketSelect = async (market: MarketSearchResult) => {
    // Set flag to prevent dropdown from re-opening when query changes
    setJustSelected(true);
    setSelectedMarket({
      id: market.id,
      name: market.name,
      type: market.type,
    });
    setSearchQuery(market.name);
    setShowResults(false);
    setSearchResults([]);
    
    if (onMarketSelect) {
      onMarketSelect(market.id, market.name);
    }
  };

  const handleCancelAnalysis = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    standaloneMarketAdvisorMutation.reset();
    setAnalysisProgress(prev => ({ ...prev, step: 0, message: '', startTime: null, elapsedSeconds: 0, isTakingLong: false }));
  };

  const handleGenerateAnalysis = async () => {
    if (!selectedMarket) return;
    
    // Close the search dropdown when analysis starts
    setShowResults(false);
    
    const startTime = Date.now();
    const controller = new AbortController();
    setAbortController(controller);
    
    // Start progress simulation with elapsed time tracking
    setAnalysisProgress(prev => ({ 
      ...prev, 
      step: 0, 
      message: prev.steps[0], 
      startTime, 
      elapsedSeconds: 0, 
      isTakingLong: false 
    }));
    
    // Simulate progress steps and track elapsed time
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        const elapsed = Math.floor((Date.now() - (prev.startTime || startTime)) / 1000);
        const nextStep = Math.min(prev.step + 1, prev.steps.length - 1);
        const isTakingLong = elapsed >= 45; // Show warning after 45 seconds
        return { 
          ...prev, 
          step: nextStep, 
          message: prev.steps[nextStep],
          elapsedSeconds: elapsed,
          isTakingLong
        };
      });
    }, 8000); // Update every 8 seconds to cover ~48 seconds of analysis
    
    // Also update elapsed time every second for accurate display
    const elapsedInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (!prev.startTime) return prev;
        const elapsed = Math.floor((Date.now() - prev.startTime) / 1000);
        const isTakingLong = elapsed >= 45;
        return { ...prev, elapsedSeconds: elapsed, isTakingLong };
      });
    }, 1000);
    
    try {
      // Use context value directly - it persists across component remounts
      console.log('[handleGenerateAnalysis] bedroomFilter from context:', bedroomFilter);
      const result = await standaloneMarketAdvisorMutation.mutateAsync({
        marketId: selectedMarket.id,
        marketType: selectedMarket.type,
        bedrooms: bedroomFilter !== 'all' ? parseInt(bedroomFilter) : undefined,
        amenities: Object.values(amenitiesFilter).some(Boolean) ? amenitiesFilter : undefined,
        propertyType: propertyTypeFilter !== 'all' ? propertyTypeFilter : undefined,
        minRating: ratingFilter !== 'all' ? parseFloat(ratingFilter) : undefined,
        minReviews: reviewCountFilter !== 'all' ? parseInt(reviewCountFilter) : undefined,
        superhostOnly: superhostOnly || undefined,
        professionalOnly: professionalOnly || undefined,
        instantBookOnly: instantBookOnly || undefined,
        listingType: listingTypeFilter !== 'all' ? listingTypeFilter : undefined,
      });
      
      clearInterval(progressInterval);
      clearInterval(elapsedInterval);
      setAbortController(null);
      setAnalysisProgress(prev => ({ ...prev, step: prev.steps.length - 1, message: 'Complete!', startTime: null, elapsedSeconds: 0, isTakingLong: false }));
      
      if (result.success && result.data) {
        setMarketData(result.data);
        setMarketAdvice(result.data.advice);
      }
    } catch (error) {
      clearInterval(progressInterval);
      clearInterval(elapsedInterval);
      setAbortController(null);
      setAnalysisProgress(prev => ({ ...prev, step: 0, message: '', startTime: null, elapsedSeconds: 0, isTakingLong: false }));
      console.error('Error generating market analysis:', error);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${Math.round(value)}%`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-amber-600 bg-amber-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable' | 'growing' | 'declining') => {
    if (trend === 'up' || trend === 'growing') return <ArrowUpRight className="w-4 h-4 text-green-600" />;
    if (trend === 'down' || trend === 'declining') return <ArrowDownRight className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Market Advisor
          </CardTitle>
          <CardDescription>
            Search for any market, city, or zip code to get comprehensive AI-powered analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Market Search Input */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search for a market (e.g., Miami, Denver, 90210...)"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                className="pl-10 py-6 text-lg"
              />
            </div>
            
            {/* Search Results Dropdown */}
            <AnimatePresence>
              {showResults && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-lg border border-slate-200 max-h-80 overflow-y-auto"
                >
                  {searchResults.map((market) => (
                    <button
                      key={market.id}
                      onClick={() => handleMarketSelect(market)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center justify-between border-b border-slate-100 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="font-medium text-slate-900">{market.name}</div>
                          <div className="text-sm text-slate-500">{market.location_name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {market.type === 'submarket' ? 'Submarket' : 'Market'}
                        </Badge>
                        <span className="text-sm text-slate-500">
                          {market.listing_count?.toLocaleString()} listings
                        </span>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Bedroom Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Bedrooms:</label>
              <select
                value={bedroomFilter}
                onChange={(e) => {
                  console.log('[BedroomFilter] Changed to:', e.target.value);
                  setBedroomFilter(e.target.value);
                }}
                className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All</option>
                <option value="1">1 BR</option>
                <option value="2">2 BR</option>
                <option value="3">3 BR</option>
                <option value="4">4 BR</option>
                <option value="5">5+ BR</option>
              </select>
            </div>

            {/* Amenities Filter */}
            <div className="relative">
              <button
                onClick={() => setShowAmenitiesDropdown(!showAmenitiesDropdown)}
                className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm hover:bg-slate-50 transition-colors"
              >
                <span className="font-medium text-slate-700">Amenities</span>
                {Object.values(amenitiesFilter).filter(Boolean).length > 0 && (
                  <Badge className="bg-blue-100 text-blue-700 text-xs">
                    {Object.values(amenitiesFilter).filter(Boolean).length}
                  </Badge>
                )}
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showAmenitiesDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showAmenitiesDropdown && (
                <div className="absolute z-50 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 p-3">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Filter by Amenities</div>
                  <div className="space-y-2">
                    {[
                      { key: 'pool', label: 'Pool' },
                      { key: 'hotTub', label: 'Hot Tub' },
                      { key: 'petFriendly', label: 'Pet Friendly' },
                      { key: 'parking', label: 'Parking' },
                      { key: 'kitchen', label: 'Kitchen' },
                      { key: 'washerDryer', label: 'Washer/Dryer' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={amenitiesFilter[key as keyof typeof amenitiesFilter]}
                          onChange={(e) => setAmenitiesFilter({ ...amenitiesFilter, [key as keyof AmenitiesFilter]: e.target.checked })}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between">
                    <button
                      onClick={() => setAmenitiesFilter({ pool: false, hotTub: false, petFriendly: false, parking: false, kitchen: false, washerDryer: false })}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={() => setShowAmenitiesDropdown(false)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Property Type Filter */}
            <div className="relative">
              <button
                onClick={() => setShowPropertyTypeDropdown(!showPropertyTypeDropdown)}
                className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm hover:bg-slate-50 transition-colors"
              >
                <Home className="w-4 h-4 text-slate-500" />
                <span className="font-medium text-slate-700">
                  {propertyTypeFilter === 'all' ? 'Property Type' : propertyTypeFilter}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showPropertyTypeDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showPropertyTypeDropdown && (
                <div className="absolute z-50 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                  {[
                    { value: 'all', label: 'All Types' },
                    { value: 'house', label: 'House' },
                    { value: 'apartment', label: 'Apartment' },
                    { value: 'condo', label: 'Condo' },
                    { value: 'townhouse', label: 'Townhouse' },
                    { value: 'cabin', label: 'Cabin' },
                    { value: 'cottage', label: 'Cottage' },
                    { value: 'villa', label: 'Villa' },
                    { value: 'loft', label: 'Loft' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setPropertyTypeFilter(value);
                        setShowPropertyTypeDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                        propertyTypeFilter === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Rating Filter */}
            <div className="relative">
              <button
                onClick={() => setShowRatingDropdown(!showRatingDropdown)}
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors bg-white"
              >
                <Star className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-slate-700">
                  {ratingFilter === 'all' ? 'Any Rating' : `${ratingFilter}+ Stars`}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {showRatingDropdown && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  {[
                    { value: 'all', label: 'Any Rating' },
                    { value: '4.0', label: '4.0+ Stars' },
                    { value: '4.5', label: '4.5+ Stars' },
                    { value: '4.8', label: '4.8+ Stars' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setRatingFilter(value);
                        setShowRatingDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                        ratingFilter === value ? 'bg-amber-50 text-amber-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Review Count Filter */}
            <div className="relative">
              <button
                onClick={() => setShowReviewCountDropdown(!showReviewCountDropdown)}
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors bg-white"
              >
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-slate-700">
                  {reviewCountFilter === 'all' ? 'Any Reviews' : `${reviewCountFilter}+ Reviews`}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {showReviewCountDropdown && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  {[
                    { value: 'all', label: 'Any Reviews' },
                    { value: '10', label: '10+ Reviews' },
                    { value: '25', label: '25+ Reviews' },
                    { value: '50', label: '50+ Reviews' },
                    { value: '100', label: '100+ Reviews' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setReviewCountFilter(value);
                        setShowReviewCountDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                        reviewCountFilter === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Host Type Toggles */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSuperhostOnly(!superhostOnly)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                  superhostOnly
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Star className={`w-4 h-4 ${superhostOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
                <span className="text-sm font-medium">Superhosts Only</span>
              </button>
              <button
                onClick={() => setProfessionalOnly(!professionalOnly)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                  professionalOnly
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span className="text-sm font-medium">Pro Managed</span>
              </button>
              <button
                onClick={() => setInstantBookOnly(!instantBookOnly)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                  instantBookOnly
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Zap className={`w-4 h-4 ${instantBookOnly ? 'fill-green-400 text-green-400' : ''}`} />
                <span className="text-sm font-medium">Instant Book</span>
              </button>
            </div>

            {/* Listing Type Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowListingTypeDropdown(!showListingTypeDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
              >
                <Home className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-700">
                  {listingTypeFilter === 'all' ? 'All Listing Types' : 
                   listingTypeFilter === 'entire_home' ? 'Entire Home' :
                   listingTypeFilter === 'private_room' ? 'Private Room' : 'Shared Room'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {showListingTypeDropdown && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  {[
                    { value: 'all', label: 'All Listing Types' },
                    { value: 'entire_home', label: 'Entire Home/Apt' },
                    { value: 'private_room', label: 'Private Room' },
                    { value: 'shared_room', label: 'Shared Room' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setListingTypeFilter(value);
                        setShowListingTypeDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                        listingTypeFilter === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active Filters Display */}
            {(Object.values(amenitiesFilter).filter(Boolean).length > 0 || propertyTypeFilter !== 'all' || ratingFilter !== 'all' || reviewCountFilter !== 'all' || superhostOnly || professionalOnly || instantBookOnly || listingTypeFilter !== 'all') && (
              <div className="flex items-center gap-2 flex-wrap">
                {amenitiesFilter.pool && <Badge variant="secondary" className="text-xs">Pool</Badge>}
                {amenitiesFilter.hotTub && <Badge variant="secondary" className="text-xs">Hot Tub</Badge>}
                {amenitiesFilter.petFriendly && <Badge variant="secondary" className="text-xs">Pet Friendly</Badge>}
                {amenitiesFilter.parking && <Badge variant="secondary" className="text-xs">Parking</Badge>}
                {amenitiesFilter.kitchen && <Badge variant="secondary" className="text-xs">Kitchen</Badge>}
                {amenitiesFilter.washerDryer && <Badge variant="secondary" className="text-xs">Washer/Dryer</Badge>}
                {propertyTypeFilter !== 'all' && <Badge variant="secondary" className="text-xs">{propertyTypeFilter}</Badge>}
                {ratingFilter !== 'all' && <Badge variant="secondary" className="text-xs">{ratingFilter}+ Stars</Badge>}
                {reviewCountFilter !== 'all' && <Badge variant="secondary" className="text-xs">{reviewCountFilter}+ Reviews</Badge>}
                {superhostOnly && <Badge variant="secondary" className="text-xs">Superhosts Only</Badge>}
                {professionalOnly && <Badge variant="secondary" className="text-xs">Pro Managed</Badge>}
                {instantBookOnly && <Badge variant="secondary" className="text-xs">Instant Book</Badge>}
                {listingTypeFilter !== 'all' && <Badge variant="secondary" className="text-xs">{listingTypeFilter === 'entire_home' ? 'Entire Home' : listingTypeFilter === 'private_room' ? 'Private Room' : 'Shared Room'}</Badge>}
              </div>
            )}
          </div>

          {/* Selected Market Display */}
          {selectedMarket && !marketAdvice && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-slate-900">{selectedMarket.name}</div>
                    <div className="text-sm text-slate-500">
                      {selectedMarket.type === 'submarket' ? 'Submarket' : selectedMarket.type === 'zipcode' ? 'Zip Code' : 'Market'}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                  Ready to Analyze
                </Badge>
              </div>
            </div>
          )}

          {/* Generate Button */}
          {selectedMarket && !marketAdvice && (
            <div className="space-y-4">
              <Button
                onClick={handleGenerateAnalysis}
                disabled={standaloneMarketAdvisorMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
              >
                {standaloneMarketAdvisorMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {analysisProgress.message}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Comprehensive Market Analysis
                  </>
                )}
              </Button>
              
              {/* Progress Steps */}
              {standaloneMarketAdvisorMutation.isPending && (
                <div className={`rounded-lg p-4 border ${analysisProgress.isTakingLong ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className={`w-4 h-4 ${analysisProgress.isTakingLong ? 'text-amber-600' : 'text-slate-500'}`} />
                    <span className={`text-sm font-medium ${analysisProgress.isTakingLong ? 'text-amber-800' : 'text-slate-700'}`}>Analysis Progress</span>
                    <span className={`text-xs ml-auto font-mono ${analysisProgress.isTakingLong ? 'text-amber-600' : 'text-slate-500'}`}>
                      {analysisProgress.elapsedSeconds > 0 ? `${analysisProgress.elapsedSeconds}s elapsed` : '~30-60 seconds'}
                    </span>
                  </div>
                  
                  {/* Taking Too Long Warning */}
                  {analysisProgress.isTakingLong && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-3 p-3 bg-amber-100 rounded-lg border border-amber-200"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-800">This is taking longer than expected...</p>
                          <p className="text-xs text-amber-700 mt-1">The AI is processing a large amount of market data. You can continue waiting or cancel and try again.</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          onClick={handleCancelAnalysis}
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-100"
                        >
                          Cancel Analysis
                        </Button>
                      </div>
                    </motion.div>
                  )}
                  
                  <div className="space-y-2">
                    {analysisProgress.steps.map((step, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          index < analysisProgress.step
                            ? 'bg-green-500'
                            : index === analysisProgress.step
                            ? analysisProgress.isTakingLong ? 'bg-amber-500' : 'bg-blue-500'
                            : 'bg-slate-200'
                        }`}>
                          {index < analysisProgress.step ? (
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          ) : index === analysisProgress.step ? (
                            <Loader2 className="w-3 h-3 text-white animate-spin" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                          )}
                        </div>
                        <span className={`text-sm ${
                          index < analysisProgress.step
                            ? 'text-green-700 line-through'
                            : index === analysisProgress.step
                            ? analysisProgress.isTakingLong ? 'text-amber-700 font-medium' : 'text-blue-700 font-medium'
                            : 'text-slate-400'
                        }`}>
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${analysisProgress.isTakingLong ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${((analysisProgress.step + 1) / analysisProgress.steps.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error State with Retry */}
          {standaloneMarketAdvisorMutation.isError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ServerCrash className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-red-800 mb-1">Analysis Failed</div>
                  <div className="text-sm text-red-600 mb-3">
                    {standaloneMarketAdvisorMutation.error?.message?.includes('timeout') || standaloneMarketAdvisorMutation.error?.message?.includes('network')
                      ? 'Network connection issue. Please check your internet connection and try again.'
                      : standaloneMarketAdvisorMutation.error?.message?.includes('rate limit')
                      ? 'Too many requests. Please wait a moment and try again.'
                      : 'Unable to generate market analysis. This could be due to a temporary service issue.'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        standaloneMarketAdvisorMutation.reset();
                        handleGenerateAnalysis();
                      }}
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                    <Button
                      onClick={() => {
                        standaloneMarketAdvisorMutation.reset();
                        setSelectedMarket(null);
                        setSearchQuery('');
                      }}
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Select Different Market
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-red-200">
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  If the problem persists, try refreshing the page or contact support.
                </p>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Market Data Display */}
      {marketData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Market Overview Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{marketData.market.name}</CardTitle>
                  <CardDescription>
                    {marketData.market.city}, {marketData.market.state}
                    {marketData.market.type !== 'market' && (
                      <Badge variant="outline" className="ml-2">
                        {marketData.market.type === 'submarket' ? 'Submarket' : 'Zip Code'}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-2xl font-bold px-4 py-2 rounded-lg ${getScoreColor(marketData.scores.marketScore)}`}>
                    {Math.round(marketData.scores.marketScore)}
                    <span className="text-sm font-normal ml-1">/100</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-4 bg-slate-50 rounded-lg text-center cursor-help">
                        <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-600" />
                        <div className="text-2xl font-bold text-slate-900">
                          {formatCurrency(marketData.metrics.avgRevenue)}
                        </div>
                        <div className="text-xs text-slate-600 flex items-center justify-center gap-1">Avg Annual Revenue <Info className="w-3 h-3" /></div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium">Average Annual Revenue</p>
                      <p className="text-sm">The typical amount hosts earn per year in this market before expenses. Higher revenue means more earning potential, but also consider your costs.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-4 bg-slate-50 rounded-lg text-center cursor-help">
                        <Percent className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                        <div className="text-2xl font-bold text-slate-900">
                          {formatPercent(marketData.metrics.avgOccupancy)}
                        </div>
                        <div className="text-xs text-slate-600 flex items-center justify-center gap-1">Avg Occupancy <Info className="w-3 h-3" /></div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium">Average Occupancy Rate</p>
                      <p className="text-sm">How often properties are booked throughout the year. 70%+ is excellent, 50-70% is good, below 50% may indicate low demand or oversupply.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-4 bg-slate-50 rounded-lg text-center cursor-help">
                        <Calendar className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                        <div className="text-2xl font-bold text-slate-900">
                          {formatCurrency(marketData.metrics.avgAdr)}
                        </div>
                        <div className="text-xs text-slate-600 flex items-center justify-center gap-1">Avg Daily Rate <Info className="w-3 h-3" /></div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium">Average Daily Rate (ADR)</p>
                      <p className="text-sm">The average price guests pay per night. This varies by season, property type, and amenities. Higher ADR with good occupancy = strong market.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-4 bg-slate-50 rounded-lg text-center cursor-help">
                        <Building2 className="w-5 h-5 mx-auto mb-1 text-amber-600" />
                        <div className="text-2xl font-bold text-slate-900">
                          {marketData.metrics.totalListings.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-600 flex items-center justify-center gap-1">Total Listings <Info className="w-3 h-3" /></div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium">Total Active Listings</p>
                      <p className="text-sm">The number of short-term rentals currently active in this market. More listings means more competition, but also validates demand.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* YoY Trend */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center gap-4 p-3 bg-slate-100 rounded-lg cursor-help">
                      <span className="text-sm text-slate-600 flex items-center gap-1">Year-over-Year Revenue <Info className="w-3 h-3" /></span>
                      <div className={`flex items-center gap-1 font-medium ${
                        marketData.historicalData.yoyChange >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {getTrendIcon(marketData.historicalData.trend)}
                        {marketData.historicalData.yoyChange >= 0 ? '+' : ''}
                        {marketData.historicalData.yoyChange.toFixed(1)}%
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {marketData.historicalData.trend}
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium">Year-over-Year Revenue Change</p>
                    <p className="text-sm">Compares this year's average revenue to last year. Positive growth means hosts are earning more, negative means the market may be cooling down.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardContent>
          </Card>

          {/* Collapsible Sections */}
          
          {/* Market Scores */}
          <Card>
            <CardHeader 
              className="cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => toggleSection('scores')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Market Scores
                </CardTitle>
                {expandedSections.scores ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </CardHeader>
            {expandedSections.scores && (
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Market Score', value: marketData.scores.marketScore, description: 'Overall market health', tooltip: 'A combined score (0-100) that weighs all factors below. 80+ is excellent, 60-79 is good, 40-59 is average, below 40 may be challenging.' },
                    { label: 'Profit Potential', value: marketData.scores.investabilityScore, description: 'Can you make good money here?', tooltip: 'Measures how likely you are to earn a profit after expenses. Higher scores mean better revenue-to-cost ratios in this market.' },
                    { label: 'Guest Interest', value: marketData.scores.rentalDemandScore, description: 'How many people want to stay here?', tooltip: 'Based on booking rates and search volume. High demand means more guests looking for places to stay in this area.' },
                    { label: 'Earnings Trend', value: marketData.scores.revenueGrowthScore, description: 'Are hosts making more or less?', tooltip: 'Tracks whether host earnings are growing or declining. Positive trends suggest a healthy, expanding market.' },
                    { label: 'Income Stability', value: marketData.scores.seasonalityScore, description: 'Is income steady all year?', tooltip: 'Measures how consistent bookings are throughout the year. Higher scores mean less seasonal ups and downs in your income.' },
                    { label: 'Local Rules', value: marketData.scores.regulationScore, description: 'How easy is it to rent here?', tooltip: 'Reflects how friendly local regulations are for short-term rentals. Lower scores may indicate stricter rules or permit requirements.' },
                  ].map((score) => {
                    // Handle decimal values - if value is less than 1, it's likely a decimal that should be a percentage
                    const displayValue = score.value < 1 && score.value > 0 ? Math.round(score.value * 100) : Math.round(score.value);
                    const barWidth = Math.min(100, Math.max(0, displayValue));
                    return (
                      <TooltipProvider key={score.label}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="p-3 border rounded-lg cursor-help">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-slate-700 flex items-center gap-1">{score.label} <Info className="w-3 h-3 text-slate-400" /></span>
                                <Badge className={getScoreColor(displayValue)}>{displayValue}</Badge>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    displayValue >= 80 ? 'bg-green-500' :
                                    displayValue >= 60 ? 'bg-amber-500' :
                                    displayValue >= 40 ? 'bg-orange-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <div className="text-xs text-slate-500 mt-1">{score.description}</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-medium">{score.label}</p>
                            <p className="text-sm">{score.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Revenue by Bedroom */}
          {marketData.revenueByBedroom && marketData.revenueByBedroom.length > 0 && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('metrics')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Home className="w-5 h-5 text-purple-600" />
                    Revenue by Property Size
                  </CardTitle>
                  {expandedSections.metrics ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.metrics && (
                <CardContent>
                  {/* Show note if bedroom filter returned no results */}
                  {marketData.bedroomFilterNote && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{marketData.bedroomFilterNote}</span>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Bedrooms</th>
                          <th className="text-right py-2 px-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 justify-end cursor-help">
                                  Avg Revenue <Info className="w-3 h-3 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-sm">Average annual revenue for properties with this bedroom count in this market.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </th>
                          <th className="text-right py-2 px-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 justify-end cursor-help">
                                  Occupancy <Info className="w-3 h-3 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-sm">Percentage of nights booked per year. Higher occupancy = more consistent bookings.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </th>
                          <th className="text-right py-2 px-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 justify-end cursor-help">
                                  ADR <Info className="w-3 h-3 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-sm">Average Daily Rate - the average price per night guests pay for this property size.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </th>
                          <th className="text-right py-2 px-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 justify-end cursor-help">
                                  Listings <Info className="w-3 h-3 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-sm">Number of active listings with this bedroom count. More listings = more competition.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Data is already filtered on backend, just display it */}
                        {marketData.revenueByBedroom.map((br: any) => (
                          <tr key={br.bedrooms} className="border-b hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium">{br.bedrooms} BR</td>
                            <td className="text-right py-2 px-3 text-green-600 font-medium">
                              {formatCurrency(br.avgRevenue)}
                            </td>
                            <td className="text-right py-2 px-3">{formatPercent(br.avgOccupancy)}</td>
                            <td className="text-right py-2 px-3">{formatCurrency(br.avgAdr)}</td>
                            <td className="text-right py-2 px-3 text-slate-500">
                              {br.listingCount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Historical Data - 5 Year Summary */}
          {marketData.historicalData?.yearlySummary && marketData.historicalData.yearlySummary.length > 0 && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('historical')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600" />
                    5-Year Historical Summary
                  </CardTitle>
                  {expandedSections.historical ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.historical && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Year</th>
                          <th className="text-right py-2 px-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 justify-end cursor-help">
                                  Avg Revenue <Info className="w-3 h-3 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-sm">Average annual revenue for that year across all properties in this market.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </th>
                          <th className="text-right py-2 px-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 justify-end cursor-help">
                                  YoY Change <Info className="w-3 h-3 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-sm">Year-over-Year change in revenue compared to the previous year. Green = growth, Red = decline.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </th>
                          <th className="text-right py-2 px-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 justify-end cursor-help">
                                  Occupancy <Info className="w-3 h-3 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-sm">Average occupancy rate for that year. Shows how consistently properties were booked.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </th>
                          <th className="text-right py-2 px-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 justify-end cursor-help">
                                  ADR <Info className="w-3 h-3 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-sm">Average Daily Rate for that year. Shows how nightly prices have changed over time.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </th>
                          <th className="text-right py-2 px-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 justify-end cursor-help">
                                  Listings <Info className="w-3 h-3 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-sm">Average number of active listings that year. Shows market growth or contraction.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketData.historicalData.yearlySummary.map((year: any) => (
                          <tr key={year.year} className="border-b hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium">{year.year}</td>
                            <td className="text-right py-2 px-3 text-green-600 font-medium">
                              {formatCurrency(year.avgRevenue)}
                            </td>
                            <td className={`text-right py-2 px-3 font-medium ${
                              year.yoyRevenueChange === undefined ? 'text-slate-400' :
                              year.yoyRevenueChange >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {year.yoyRevenueChange !== undefined 
                                ? `${year.yoyRevenueChange >= 0 ? '+' : ''}${year.yoyRevenueChange.toFixed(1)}%`
                                : '-'
                              }
                            </td>
                            <td className="text-right py-2 px-3">{formatPercent(year.avgOccupancy)}</td>
                            <td className="text-right py-2 px-3">{formatCurrency(year.avgAdr)}</td>
                            <td className="text-right py-2 px-3 text-slate-500">
                              {year.avgListingCount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Booking Patterns & Supply Trend */}
          {(marketData.bookingPatterns || marketData.supplyTrend) && (
            <div className="grid md:grid-cols-2 gap-4">
              {marketData.bookingPatterns && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      Booking Patterns
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Avg Lead Time</span>
                      <span className="font-medium">{marketData.bookingPatterns.avgLeadTimeDays} days</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Last-Minute Bookings</span>
                      <span className="font-medium">{marketData.bookingPatterns.lastMinutePercent}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Avg Stay Length</span>
                      <span className="font-medium">{marketData.bookingPatterns.avgLengthOfStay} nights</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Weekend Stays</span>
                      <span className="font-medium">{marketData.bookingPatterns.weekendPercent}%</span>
                    </div>
                    {marketData.bookingPatterns.insights && marketData.bookingPatterns.insights.length > 0 && (
                      <div className="pt-2 border-t">
                        {marketData.bookingPatterns.insights.map((insight: string, i: number) => (
                          <p key={i} className="text-xs text-slate-500 mt-1">{insight}</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {marketData.supplyTrend && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      Supply Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Current Listings</span>
                      <span className="font-medium">{marketData.supplyTrend.currentListings.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">12 Months Ago</span>
                      <span className="font-medium">{marketData.supplyTrend.listings12MonthsAgo.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Net Change</span>
                      <span className={`font-medium ${marketData.supplyTrend.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {marketData.supplyTrend.netChange >= 0 ? '+' : ''}{marketData.supplyTrend.netChange.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Trend</span>
                      <Badge variant="outline" className="capitalize">
                        {getTrendIcon(marketData.supplyTrend.trend)}
                        <span className="ml-1">{marketData.supplyTrend.trend}</span>
                      </Badge>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-slate-500">{marketData.supplyTrend.insight}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Top Performers */}
          {marketData.topPerformers && marketData.topPerformers.length > 0 && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('topPerformers')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    Top Performers ({marketData.topPerformers.length})
                  </CardTitle>
                  {expandedSections.topPerformers ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.topPerformers && (
                <CardContent>
                  <div className="space-y-3">
                    {marketData.topPerformers
                      .filter((performer: any) => {
                        if (bedroomFilter === 'all') return true;
                        if (bedroomFilter === '5') return performer.bedrooms >= 5;
                        return performer.bedrooms === parseInt(bedroomFilter);
                      })
                      .slice(0, 10)
                      .map((performer: any, index: number) => (
                      <div key={index} className="p-3 border rounded-lg hover:bg-slate-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900 line-clamp-1">
                              {index + 1}. {performer.title}
                            </div>
                            <div className="text-sm text-slate-500 mt-1">
                              {performer.bedrooms} BR / {performer.bathrooms} BA
                              {performer.propertyType && ` • ${performer.propertyType}`}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              {performer.isSuperhost && (
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                  Superhost
                                </Badge>
                              )}
                              {performer.isProfessionallyManaged && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                  Pro Managed
                                </Badge>
                              )}
                              {performer.rating > 0 && (
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  {performer.rating.toFixed(1)} ({performer.reviews} reviews)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {formatCurrency(performer.revenue)}
                            </div>
                            <div className="text-xs text-slate-500">per year</div>
                            <div className="text-sm text-slate-600 mt-1">
                              {formatPercent(performer.occupancy)} occ • {formatCurrency(performer.adr)}/night
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Cancellation Policies */}
          {marketData.cancellationPolicies && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('cancellationPolicies')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Cancellation Policies
                  </CardTitle>
                  {expandedSections.cancellationPolicies ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.cancellationPolicies && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {marketData.cancellationPolicies.policies.slice(0, 5).map((policy: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium capitalize">{policy.policy.replace(/_/g, ' ')}</div>
                          <div className="text-sm text-slate-500">{policy.count} listings ({policy.percentage}%)</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-green-600">{formatCurrency(policy.avgRevenue)}/yr</div>
                          <div className="text-xs text-slate-500">{formatPercent(policy.avgOccupancy)} occ</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {marketData.cancellationPolicies.recommendation && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-800">{marketData.cancellationPolicies.recommendation}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* Professional Stats */}
          {marketData.professionalStats && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('professionalStats')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-500" />
                    Host Competition Analysis
                  </CardTitle>
                  {expandedSections.professionalStats ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.professionalStats && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-700">{marketData.professionalStats.professionalPercentage}%</div>
                      <div className="text-sm text-blue-600">Professionally Managed</div>
                      <div className="text-xs text-blue-500 mt-1">{marketData.professionalStats.professionalCount} listings</div>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-700">{marketData.professionalStats.superhostPercentage}%</div>
                      <div className="text-sm text-amber-600">Superhosts</div>
                      <div className="text-xs text-amber-500 mt-1">{marketData.professionalStats.superhostCount} listings</div>
                    </div>
                  </div>
                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Avg Revenue (Professional)</span>
                      <span className="font-medium text-green-600">{formatCurrency(marketData.professionalStats.avgRevenueProfessional)}/yr</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Avg Revenue (Individual)</span>
                      <span className="font-medium">{formatCurrency(marketData.professionalStats.avgRevenueIndividual)}/yr</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Professional Premium</span>
                      <Badge variant="outline" className={marketData.professionalStats.revenuePremiumPercent > 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                        {marketData.professionalStats.revenuePremiumPercent > 0 ? '+' : ''}{marketData.professionalStats.revenuePremiumPercent}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Submarkets Comparison */}
          {marketData.submarkets && marketData.submarkets.length > 0 && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('submarkets')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-teal-500" />
                    Neighborhoods & Submarkets ({marketData.submarkets.length})
                  </CardTitle>
                  {expandedSections.submarkets ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.submarkets && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left py-3 px-3 font-medium text-slate-600">Neighborhood</th>
                          <th className="text-right py-3 px-3 font-medium text-slate-600">Listings</th>
                          <th className="text-right py-3 px-3 font-medium text-slate-600">Avg Revenue</th>
                          <th className="text-right py-3 px-3 font-medium text-slate-600">ADR</th>
                          <th className="text-right py-3 px-3 font-medium text-slate-600">Occupancy</th>
                          <th className="text-right py-3 px-3 font-medium text-slate-600">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketData.submarkets
                          .sort((a: any, b: any) => (b.metrics?.revenue || 0) - (a.metrics?.revenue || 0))
                          .slice(0, 15)
                          .map((submarket: any, index: number) => (
                          <tr key={index} className="border-b last:border-b-0 hover:bg-slate-50">
                            <td className="py-3 px-3">
                              <div className="font-medium text-slate-900">{submarket.name}</div>
                            </td>
                            <td className="text-right py-3 px-3 text-slate-600">
                              {submarket.listingCount?.toLocaleString() || '-'}
                            </td>
                            <td className="text-right py-3 px-3 font-medium text-green-600">
                              {submarket.metrics?.revenue ? formatCurrency(submarket.metrics.revenue) : '-'}
                            </td>
                            <td className="text-right py-3 px-3">
                              {submarket.metrics?.adr ? formatCurrency(submarket.metrics.adr) : '-'}
                            </td>
                            <td className="text-right py-3 px-3">
                              {submarket.metrics?.occupancy ? formatPercent(submarket.metrics.occupancy) : '-'}
                            </td>
                            <td className="text-right py-3 px-3">
                              {submarket.metrics?.marketScore ? (
                                <Badge className={getScoreColor(submarket.metrics.marketScore)}>
                                  {submarket.metrics.marketScore}
                                </Badge>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    Showing top 15 neighborhoods by revenue. Higher scores indicate better investment potential.
                  </p>
                </CardContent>
              )}
            </Card>
          )}

          {/* Supply Trend Chart */}
          {marketData.supplyTrend?.monthlyData && marketData.supplyTrend.monthlyData.length > 0 && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('supplyChart')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-cyan-500" />
                    Active Listings Trend (12 Months)
                  </CardTitle>
                  {expandedSections.supplyChart ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.supplyChart && (
                <CardContent>
                  {/* Simple bar chart visualization */}
                  <div className="space-y-2">
                    {(() => {
                      const data = marketData.supplyTrend.monthlyData.slice(0, 12);
                      const maxListings = Math.max(...data.map((m: any) => m.activeListings));
                      return data.map((month: any, index: number) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="w-16 text-xs text-slate-600 text-right">
                            {month.month}
                          </div>
                          <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-cyan-400 to-cyan-600 rounded-full transition-all"
                              style={{ width: `${(month.activeListings / maxListings) * 100}%` }}
                            />
                          </div>
                          <div className="w-20 text-right">
                            <span className="text-sm font-medium">{month.activeListings.toLocaleString()}</span>
                            {month.changeFromPrevious !== 0 && (
                              <span className={`text-xs ml-1 ${month.changeFromPrevious > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {month.changeFromPrevious > 0 ? '+' : ''}{month.changeFromPrevious}
                              </span>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">12-Month Change:</span>
                      <span className={`font-medium ${marketData.supplyTrend.percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {marketData.supplyTrend.percentChange >= 0 ? '+' : ''}{marketData.supplyTrend.percentChange.toFixed(1)}%
                        ({marketData.supplyTrend.netChange >= 0 ? '+' : ''}{marketData.supplyTrend.netChange.toLocaleString()} listings)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">{marketData.supplyTrend.insight}</p>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* RevPAR Trend Chart */}
          {marketData.historicalData?.months && marketData.historicalData.months.length > 0 && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('revparChart')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    RevPAR Trend (Revenue Per Available Room)
                  </CardTitle>
                  {expandedSections.revparChart ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
                <CardDescription>
                  RevPAR = ADR × Occupancy Rate - measures market efficiency
                </CardDescription>
              </CardHeader>
              {expandedSections.revparChart && (
                <CardContent>
                  {/* RevPAR bar chart visualization */}
                  <div className="space-y-2">
                    {(() => {
                      const data = marketData.historicalData.months.slice(0, 12).filter((m: any) => m.revpar);
                      if (data.length === 0) {
                        return <p className="text-sm text-slate-500">RevPAR data not available for this market.</p>;
                      }
                      const maxRevpar = Math.max(...data.map((m: any) => m.revpar || 0));
                      const minRevpar = Math.min(...data.map((m: any) => m.revpar || 0));
                      const avgRevpar = Math.round(data.reduce((sum: number, m: any) => sum + (m.revpar || 0), 0) / data.length);
                      
                      return (
                        <>
                          {data.map((month: any, index: number) => {
                            const prevMonth = data[index + 1];
                            const change = prevMonth ? month.revpar - prevMonth.revpar : 0;
                            return (
                              <div key={index} className="flex items-center gap-3">
                                <div className="w-16 text-xs text-slate-600 text-right">
                                  {month.date}
                                </div>
                                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
                                    style={{ width: `${(month.revpar / maxRevpar) * 100}%` }}
                                  />
                                </div>
                                <div className="w-24 text-right">
                                  <span className="text-sm font-medium">${Math.round(month.revpar).toLocaleString()}</span>
                                  {change !== 0 && (
                                    <span className={`text-xs ml-1 ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {change > 0 ? '+' : ''}{Math.round(change)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-slate-600">Average:</span>
                                <span className="font-medium ml-2 text-emerald-700">${avgRevpar}</span>
                              </div>
                              <div>
                                <span className="text-slate-600">Peak:</span>
                                <span className="font-medium ml-2 text-emerald-700">${Math.round(maxRevpar)}</span>
                              </div>
                              <div>
                                <span className="text-slate-600">Low:</span>
                                <span className="font-medium ml-2 text-emerald-700">${Math.round(minRevpar)}</span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-600 mt-2">
                              RevPAR measures how efficiently a market converts available nights into revenue. Higher RevPAR indicates strong pricing power combined with good occupancy.
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Future Pricing */}
          {marketData.futurePricing && marketData.futurePricing.length > 0 && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('futurePricing')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                    Forward-Looking Pricing (Next 6 Months)
                  </CardTitle>
                  {expandedSections.futurePricing ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.futurePricing && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-slate-600">Month</th>
                          <th className="text-right py-2 font-medium text-slate-600">ADR</th>
                          <th className="text-right py-2 font-medium text-slate-600">ADR Range</th>
                          <th className="text-right py-2 font-medium text-slate-600">Occupancy</th>
                          <th className="text-right py-2 font-medium text-slate-600">Supply</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketData.futurePricing.slice(0, 30).filter((_: any, i: number) => i % 5 === 0).map((pricing: any, index: number) => (
                          <tr key={index} className="border-b last:border-b-0">
                            <td className="py-2 font-medium">
                              {new Date(pricing.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="py-2 text-right text-green-600 font-medium">
                              {formatCurrency(pricing.adr)}
                            </td>
                            <td className="py-2 text-right text-slate-500 text-xs">
                              {formatCurrency(pricing.adrPercentile25)} - {formatCurrency(pricing.adrPercentile75)}
                            </td>
                            <td className="py-2 text-right">
                              {formatPercent(pricing.occupancy * 100)}
                            </td>
                            <td className="py-2 text-right text-slate-500">
                              {pricing.supply.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* AI Analysis Result */}
          {marketAdvice && (
            <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
              <CardHeader>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">AI Analysis Complete</span>
                </div>
                <CardTitle className="flex items-center gap-2 text-xl mt-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Comprehensive Market Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-slate max-w-none">
                  <Streamdown>{marketAdvice}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate New Analysis Button */}
          {marketAdvice && (
            <Button
              onClick={() => {
                setMarketAdvice(null);
                setMarketData(null);
                setSelectedMarket(null);
                setSearchQuery('');
              }}
              variant="outline"
              className="w-full"
            >
              Analyze a Different Market
            </Button>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default StandaloneMarketAdvisor;
