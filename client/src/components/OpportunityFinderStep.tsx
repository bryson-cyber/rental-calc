/**
 * Opportunity Finder Step Component
 * 
 * Browse rental listings, see STR revenue analysis inline on each card,
 * and take action to find your next investment opportunity.
 * 
 * Features:
 * - Search by city/zip code with autocomplete
 * - Pagination (Load More)
 * - Sorting by price, beds, days on market
 * - Inline revenue analysis
 * - Contact Now with agent details
 * - Deal Score badges
 * - Save to Favorites
 * 
 * Design: Coach Inayah brand system (gold accents, light theme)
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Search, 
  Home, 
  MapPin, 
  Bed, 
  Bath, 
  DollarSign, 
  Loader2,
  ExternalLink,
  TrendingUp,
  Info,
  Filter,
  Building,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Users,
  Map as MapIcon,
  BarChart3,
  ArrowRight,
  Calendar,
  Percent,
  Target,
  Phone,
  Mail,
  ArrowUpDown,
  ChevronRight,
  ChevronLeft,
  Award,
  Clock,
  Heart,
  Image
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { InfoTooltip } from '@/components/InfoTooltip';
import { MarketAutocomplete } from '@/components/MarketAutocomplete';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';

// Types
interface ZillowProperty {
  id: string;
  url: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  homeType: string;
  image: string;
  photos: string[]; // All property photos
  status: string;
  daysOnZillow?: number;
}

interface ValidationResult {
  success: boolean;
  property: {
    address: string;
    rent: number;
    bedrooms: number;
    bathrooms: number;
  };
  projection?: {
    annualRevenue: number;
    monthlyRevenue: number;
    occupancy: number;
    adr: number;
    operatingCosts: number;
    monthlyProfit: number;
    annualProfit: number;
    roi: number;
  };
  verdict?: string;
  isGoodDeal?: boolean;
  error?: string;
}

interface AgentContact {
  name: string;
  phone: string | null;
  email: string | null;
  brokerage: string | null;
}

interface ContactResult {
  success: boolean;
  contacts?: {
    agent: AgentContact | null;
    listingAgent: AgentContact | null;
    primaryContact: AgentContact | null;
    buildingName?: string;
  };
  error?: string;
}

interface OpportunityFinderStepProps {
  onSelectProperty?: (property: {
    address: string;
    bedrooms: number;
    bathrooms: number;
    monthlyRent: number;
  }) => void;
}

// Home type options
const HOME_TYPES = [
  { value: 'SINGLE_FAMILY', label: 'Single Family' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'TOWNHOUSE', label: 'Townhouse' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'MULTI_FAMILY', label: 'Multi-Family' },
];

// Sorting options
const SORT_OPTIONS = [
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'beds_desc', label: 'Bedrooms: Most First' },
  { value: 'beds_asc', label: 'Bedrooms: Least First' },
  { value: 'days_asc', label: 'Newest Listings' },
  { value: 'days_desc', label: 'Oldest Listings' },
];

// Calculate Deal Score based on ROI and profit
function calculateDealScore(roi: number, monthlyProfit: number, occupancy: number): { grade: string; color: string; label: string } {
  // Score based on ROI, profit, and occupancy
  let score = 0;
  
  // ROI scoring (max 40 points)
  if (roi >= 100) score += 40;
  else if (roi >= 75) score += 35;
  else if (roi >= 50) score += 30;
  else if (roi >= 25) score += 20;
  else if (roi >= 0) score += 10;
  
  // Monthly profit scoring (max 40 points)
  if (monthlyProfit >= 2000) score += 40;
  else if (monthlyProfit >= 1500) score += 35;
  else if (monthlyProfit >= 1000) score += 30;
  else if (monthlyProfit >= 500) score += 20;
  else if (monthlyProfit >= 0) score += 10;
  
  // Occupancy scoring (max 20 points)
  if (occupancy >= 70) score += 20;
  else if (occupancy >= 60) score += 15;
  else if (occupancy >= 50) score += 10;
  else score += 5;
  
  // Convert score to grade
  if (score >= 90) return { grade: 'A+', color: 'oklch(0.45 0.15 145)', label: 'Excellent Deal' };
  if (score >= 80) return { grade: 'A', color: 'oklch(0.50 0.15 145)', label: 'Great Deal' };
  if (score >= 70) return { grade: 'B+', color: 'oklch(0.55 0.12 85)', label: 'Good Deal' };
  if (score >= 60) return { grade: 'B', color: 'oklch(0.60 0.10 85)', label: 'Decent Deal' };
  if (score >= 50) return { grade: 'C', color: 'oklch(0.60 0.12 60)', label: 'Marginal' };
  if (score >= 30) return { grade: 'D', color: 'oklch(0.55 0.15 30)', label: 'Poor Deal' };
  return { grade: 'F', color: 'oklch(0.50 0.18 25)', label: 'Not Recommended' };
}

// Calculate startup costs
function calculateStartupCosts(monthlyRent: number, bedrooms: number): {
  firstMonth: number;
  deposit: number;
  furnishing: number;
  total: number;
} {
  const firstMonth = monthlyRent;
  const deposit = monthlyRent * 1.5; // 1.5x rent typical
  const furnishing = 8000 + (bedrooms * 4000); // Base + per bedroom
  const total = firstMonth + deposit + furnishing;
  
  return { firstMonth, deposit, furnishing, total };
}

// Generate or retrieve session ID for anonymous users
function getSessionId(): string {
  let sessionId = localStorage.getItem("rental_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("rental_session_id", sessionId);
  }
  return sessionId;
}

export default function OpportunityFinderStep({ onSelectProperty }: OpportunityFinderStepProps) {
  // Auth state
  const { user } = useAuth();
  
  // Search state
  const [location, setLocation] = useState('');
  const [searchType, setSearchType] = useState<'forRent' | 'forSale'>('forRent');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter state
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [bedsMin, setBedsMin] = useState<string>('');
  const [bedsMax, setBedsMax] = useState<string>('');
  const [bathsMin, setBathsMin] = useState<string>('');
  const [bathsMax, setBathsMax] = useState<string>('');
  const [homeType, setHomeType] = useState<string>('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('price_asc');
  
  // Results state
  const [properties, setProperties] = useState<ZillowProperty[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Validation state
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  
  // Contact modal state
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactProperty, setContactProperty] = useState<ZillowProperty | null>(null);
  const [contactResult, setContactResult] = useState<ContactResult | null>(null);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  
  // Favorites state (stored in localStorage)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('opportunityFinder_favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });
  
  // Map of property IDs to database IDs for removal
  const [favoritesDbIds, setFavoritesDbIds] = useState<Map<string, number>>(new Map());
  
  // Photo gallery state
  const [photoGalleryOpen, setPhotoGalleryOpen] = useState(false);
  const [photoGalleryProperty, setPhotoGalleryProperty] = useState<ZillowProperty | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  // Toggle favorite - saves to both localStorage and database
  const toggleFavorite = async (propertyId: string, property?: ZillowProperty) => {
    const isCurrentlyFavorite = favorites.has(propertyId);
    
    // Optimistically update UI
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (isCurrentlyFavorite) {
        newFavorites.delete(propertyId);
      } else {
        newFavorites.add(propertyId);
      }
      // Save to localStorage
      localStorage.setItem('opportunityFinder_favorites', JSON.stringify(Array.from(newFavorites)));
      return newFavorites;
    });
    
    // Save to database
    if (isCurrentlyFavorite) {
      // Get the database ID from favoritesDbIds map
      const dbId = favoritesDbIds.get(propertyId);
      if (dbId) {
        try {
          await removeFavorite.mutateAsync({
            id: dbId,
            sessionId: getSessionId(),
          });
          setFavoritesDbIds(prev => {
            const newMap = new Map(prev);
            newMap.delete(propertyId);
            return newMap;
          });
          toast.success('Removed from favorites');
        } catch (error) {
          console.error('Error removing favorite:', error);
          // Revert optimistic update on error
          setFavorites(prev => new Set(Array.from(prev).concat(propertyId)));
        }
      }
    } else if (property) {
      // Get validation result if available
      const validation = validationResults[propertyId];
      
      try {
        const result = await addFavorite.mutateAsync({
          sessionId: getSessionId(),
          address: property.address,
          city: property.city,
          state: property.state,
          zipCode: property.zipCode,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          propertyType: property.homeType,
          monthlyRent: property.price,
          // Include analysis data if available
          annualRevenue: validation?.projection?.annualRevenue,
          monthlyRevenue: validation?.projection?.monthlyRevenue,
          occupancyRate: validation?.projection?.occupancy,
          averageDailyRate: validation?.projection?.adr,
          estimatedProfit: validation?.projection?.annualProfit,
        });
        
        if (result.success && result.data?.id) {
          setFavoritesDbIds(prev => {
            const newMap = new Map(prev);
            newMap.set(propertyId, result.data!.id);
            return newMap;
          });
          toast.success('Added to favorites!');
        }
      } catch (error) {
        console.error('Error adding favorite:', error);
        // Revert optimistic update on error
        setFavorites(prev => {
          const newFavorites = new Set(prev);
          newFavorites.delete(propertyId);
          return newFavorites;
        });
        toast.error('Failed to save favorite');
      }
    }
  };
  
  // Mutations
  const searchRentals = trpc.opportunityFinder.searchZillowRentals.useMutation();
  const searchForSale = trpc.opportunityFinder.searchZillowForSale.useMutation();
  const validateProperty = trpc.opportunityFinder.validateProperty.useMutation();
  const getContacts = trpc.opportunityFinder.getPropertyContacts.useMutation();
  const addFavorite = trpc.favorites.add.useMutation();
  const removeFavorite = trpc.favorites.remove.useMutation();
  
  const isSearching = searchRentals.isPending || searchForSale.isPending;
  
  // Sort properties client-side
  const sortProperties = (props: ZillowProperty[]): ZillowProperty[] => {
    const sorted = [...props];
    switch (sortBy) {
      case 'price_asc':
        return sorted.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return sorted.sort((a, b) => b.price - a.price);
      case 'beds_desc':
        return sorted.sort((a, b) => b.bedrooms - a.bedrooms);
      case 'beds_asc':
        return sorted.sort((a, b) => a.bedrooms - b.bedrooms);
      case 'days_asc':
        return sorted.sort((a, b) => (a.daysOnZillow || 999) - (b.daysOnZillow || 999));
      case 'days_desc':
        return sorted.sort((a, b) => (b.daysOnZillow || 0) - (a.daysOnZillow || 0));
      default:
        return sorted;
    }
  };
  
  // Handle search
  const handleSearch = async (page: number = 1, append: boolean = false) => {
    if (!location.trim()) return;
    
    if (!append) {
      setHasSearched(true);
      setProperties([]);
      setValidationResults({});
      setCurrentPage(1);
    } else {
      setIsLoadingMore(true);
    }
    
    const params = {
      location: location.trim(),
      priceMin: priceMin ? parseInt(priceMin) : undefined,
      priceMax: priceMax ? parseInt(priceMax) : undefined,
      bedsMin: bedsMin ? parseInt(bedsMin) : undefined,
      bedsMax: bedsMax ? parseInt(bedsMax) : undefined,
      bathsMin: bathsMin ? parseFloat(bathsMin) : undefined,
      bathsMax: bathsMax ? parseFloat(bathsMax) : undefined,
      homeTypes: homeType ? [homeType] : undefined,
      page,
    };
    
    try {
      const result = searchType === 'forRent' 
        ? await searchRentals.mutateAsync(params)
        : await searchForSale.mutateAsync(params);
      
      if (append) {
        setProperties(prev => [...prev, ...result.properties]);
      } else {
        setProperties(result.properties);
      }
      setTotalResults(result.totalResults);
      setHasMore(result.hasMore || false);
      setCurrentPage(page);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };
  
  // Load more results
  const handleLoadMore = () => {
    handleSearch(currentPage + 1, true);
  };
  
  // Handle validation (Analyze button)
  const handleValidate = async (property: ZillowProperty) => {
    setValidatingId(property.id);
    
    try {
      const result = await validateProperty.mutateAsync({
        address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
        rent: property.price,
        bedrooms: property.bedrooms || 2,
        bathrooms: property.bathrooms || 1,
        zillowUrl: property.url,
        image: property.image,
      });
      
      setValidationResults(prev => ({
        ...prev,
        [property.id]: result,
      }));
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResults(prev => ({
        ...prev,
        [property.id]: {
          success: false,
          property: {
            address: property.address,
            rent: property.price,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
          },
          error: 'Could not get revenue estimate for this property',
        },
      }));
    } finally {
      setValidatingId(null);
    }
  };
  
  // Handle contact fetch
  const handleGetContacts = async (property: ZillowProperty) => {
    setContactProperty(property);
    setContactModalOpen(true);
    setIsLoadingContacts(true);
    setContactResult(null);
    
    try {
      const result = await getContacts.mutateAsync({
        zillowUrl: property.url,
      });
      setContactResult(result as ContactResult);
    } catch (error) {
      console.error('Contact fetch error:', error);
      setContactResult({
        success: false,
        error: 'Could not retrieve contact information',
      });
    } finally {
      setIsLoadingContacts(false);
    }
  };
  
  // Build URL for navigation to other tools
  const buildPropertyUrl = (property: ZillowProperty, path: string = '/') => {
    const params = new URLSearchParams({
      address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
      bedrooms: String(property.bedrooms || 2),
      bathrooms: String(property.bathrooms || 1),
      rent: String(property.price),
    });
    return `${path}?${params.toString()}`;
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  // Get sorted properties
  const sortedProperties = sortProperties(properties);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ backgroundColor: 'oklch(0.55 0.14 75 / 0.15)' }}>
          <Search className="w-7 h-7" style={{ color: 'oklch(0.55 0.14 75)' }} />
        </div>
        <h2 className="text-2xl font-semibold mb-2" style={{ color: 'oklch(0.15 0 0)' }}>
          Find Your Next Opportunity
        </h2>
        <p className="text-base max-w-xl mx-auto" style={{ color: 'oklch(0.45 0 0)' }}>
          Browse rentals and validate STR potential instantly. Click "Analyze" to get revenue projections right here.
        </p>
      </div>
      
      {/* Search Section */}
      <Card className="border" style={{ borderColor: 'oklch(0.90 0 0)', borderRadius: '1.25rem' }}>
        <CardContent className="p-6">
          {/* Search Type Toggle */}
          <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ backgroundColor: 'oklch(0.96 0 0)', border: '1px solid oklch(0.90 0 0)' }}>
            <button
              onClick={() => setSearchType('forRent')}
              className="flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300"
              style={{
                backgroundColor: searchType === 'forRent' ? 'oklch(0.55 0.14 75)' : 'transparent',
                color: searchType === 'forRent' ? 'oklch(0.98 0 0)' : 'oklch(0.45 0 0)',
              }}
            >
              <Home className="w-4 h-4 inline-block mr-2" />
              For Rent
            </button>
            <button
              onClick={() => setSearchType('forSale')}
              className="flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300"
              style={{
                backgroundColor: searchType === 'forSale' ? 'oklch(0.55 0.14 75)' : 'transparent',
                color: searchType === 'forSale' ? 'oklch(0.98 0 0)' : 'oklch(0.45 0 0)',
              }}
            >
              <Building className="w-4 h-4 inline-block mr-2" />
              For Sale
            </button>
          </div>
          
          {/* Location Search with Autocomplete */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <MarketAutocomplete
                placeholder="Search city, neighborhood, or zip code..."
                onSelect={(market) => {
                  // Set location from selected market
                  const locationStr = market.name;
                  setLocation(locationStr);
                  // Trigger search with the selected location directly
                  // Use the location string directly since state update is async
                  const params = {
                    location: locationStr,
                    priceMin: priceMin ? parseInt(priceMin) : undefined,
                    priceMax: priceMax ? parseInt(priceMax) : undefined,
                    bedsMin: bedsMin ? parseInt(bedsMin) : undefined,
                    bedsMax: bedsMax ? parseInt(bedsMax) : undefined,
                    bathsMin: bathsMin ? parseFloat(bathsMin) : undefined,
                    bathsMax: bathsMax ? parseFloat(bathsMax) : undefined,
                    homeTypes: homeType ? [homeType] : undefined,
                    page: 1,
                  };
                  setHasSearched(true);
                  setProperties([]);
                  setValidationResults({});
                  setCurrentPage(1);
                  if (searchType === 'forRent') {
                    searchRentals.mutateAsync(params).then(result => {
                      setProperties(result.properties);
                      setTotalResults(result.totalResults);
                    });
                  } else {
                    searchForSale.mutateAsync(params).then(result => {
                      setProperties(result.properties);
                      setTotalResults(result.totalResults);
                    });
                  }
                }}
              />
            </div>
            <Button
              onClick={() => handleSearch()}
              disabled={!location.trim() || isSearching}
              className="h-12 px-6"
              style={{
                backgroundColor: 'oklch(0.55 0.14 75)',
                borderRadius: '980px',
              }}
            >
              {isSearching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: 'oklch(0.45 0 0)' }}
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Hide' : 'Show'} Filters
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {/* Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 mt-4" style={{ borderTop: '1px solid oklch(0.92 0 0)' }}>
                  {/* Price Range */}
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: 'oklch(0.45 0 0)' }}>Min Price</Label>
                    <Input
                      type="number"
                      placeholder="$0"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: 'oklch(0.45 0 0)' }}>Max Price</Label>
                    <Input
                      type="number"
                      placeholder="No max"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  
                  {/* Min Bedrooms */}
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: 'oklch(0.45 0 0)' }}>Min Beds</Label>
                    <Select value={bedsMin} onValueChange={setBedsMin}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}+ beds</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Max Bedrooms */}
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: 'oklch(0.45 0 0)' }}>Max Beds</Label>
                    <Select value={bedsMax} onValueChange={setBedsMax}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <SelectItem key={n} value={String(n)}>{n} beds max</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Min Bathrooms */}
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: 'oklch(0.45 0 0)' }}>Min Baths</Label>
                    <Select value={bathsMin} onValueChange={setBathsMin}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {[1, 1.5, 2, 2.5, 3].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}+ baths</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Max Bathrooms */}
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: 'oklch(0.45 0 0)' }}>Max Baths</Label>
                    <Select value={bathsMax} onValueChange={setBathsMax}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {[1, 1.5, 2, 2.5, 3, 4].map(n => (
                          <SelectItem key={n} value={String(n)}>{n} baths max</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Home Type */}
                  <div className="col-span-2">
                    <Label className="text-xs mb-1.5 block" style={{ color: 'oklch(0.45 0 0)' }}>Property Type</Label>
                    <Select value={homeType} onValueChange={setHomeType}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        {HOME_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
      
      {/* Results */}
      {hasSearched && (
        <div className="space-y-4">
          {/* Results Header with Sorting */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-sm" style={{ color: 'oklch(0.45 0 0)' }}>
              {isSearching ? (
                'Searching...'
              ) : (
                <>
                  Showing <span className="font-semibold" style={{ color: 'oklch(0.15 0 0)' }}>{sortedProperties.length}</span> of <span className="font-semibold" style={{ color: 'oklch(0.15 0 0)' }}>{totalResults}</span> properties
                </>
              )}
            </p>
            
            {/* Sorting Dropdown */}
            {sortedProperties.length > 0 && (
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4" style={{ color: 'oklch(0.55 0 0)' }} />
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px] h-9 text-sm">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          {/* Property Grid */}
          {isSearching ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'oklch(0.55 0.14 75)' }} />
            </div>
          ) : sortedProperties.length === 0 ? (
            <Card className="p-8 text-center" style={{ borderRadius: '1.25rem' }}>
              <Home className="w-12 h-12 mx-auto mb-4" style={{ color: 'oklch(0.55 0 0)' }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'oklch(0.15 0 0)' }}>
                No Properties Found
              </h3>
              <p style={{ color: 'oklch(0.45 0 0)' }}>
                Try adjusting your filters or searching a different location.
              </p>
            </Card>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedProperties.map((property) => {
                  const validation = validationResults[property.id];
                  const isValidating = validatingId === property.id;
                  const hasAnalysis = validation?.success && validation?.projection;
                  
                  // Calculate deal score if we have analysis
                  const dealScore = hasAnalysis && validation.projection
                    ? calculateDealScore(validation.projection.roi, validation.projection.monthlyProfit, validation.projection.occupancy)
                    : null;
                  
                  // Calculate startup costs
                  const startupCosts = calculateStartupCosts(property.price, property.bedrooms || 2);
                  
                  return (
                    <motion.div
                      key={property.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card 
                        className="overflow-hidden transition-all duration-300 hover:shadow-lg"
                        style={{ 
                          borderRadius: '1rem',
                          border: validation?.isGoodDeal ? '2px solid oklch(0.55 0.15 145)' : '1px solid oklch(0.90 0 0)',
                        }}
                      >
                        {/* Property Image - Click to open gallery */}
                        <div 
                          className="relative h-44 bg-gray-100 cursor-pointer group"
                          onClick={() => {
                            setPhotoGalleryProperty(property);
                            setCurrentPhotoIndex(0);
                            setPhotoGalleryOpen(true);
                          }}
                        >
                          {property.image ? (
                            <img
                              src={property.image}
                              alt={property.address}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Home className="w-12 h-12" style={{ color: 'oklch(0.70 0 0)' }} />
                            </div>
                          )}
                          
                          {/* Photo Count Badge */}
                          {property.photos && property.photos.length > 1 && (
                            <div 
                              className="absolute top-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ 
                                backgroundColor: 'oklch(0.15 0 0 / 0.85)',
                                color: 'oklch(0.98 0 0)',
                              }}
                            >
                              <Image className="w-3 h-3" />
                              {property.photos.length} photos
                            </div>
                          )}
                          {/* Price Badge */}
                          <div 
                            className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-sm font-semibold"
                            style={{ 
                              backgroundColor: 'oklch(0.15 0 0 / 0.85)',
                              color: 'oklch(0.98 0 0)',
                            }}
                          >
                            {property.price > 0 ? (
                              <>{formatCurrency(property.price)}{searchType === 'forRent' ? '/mo' : ''}</>
                            ) : (
                              'Contact for Price'
                            )}
                          </div>
                          
                          {/* Deal Score Badge */}
                          {dealScore && (
                            <div 
                              className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                              style={{ 
                                backgroundColor: 'oklch(0.98 0 0 / 0.95)',
                                color: dealScore.color,
                                border: `2px solid ${dealScore.color}`,
                              }}
                            >
                              <Award className="w-3 h-3" />
                              {dealScore.grade}
                            </div>
                          )}
                          
                          {/* Days on Market */}
                          {property.daysOnZillow !== undefined && (
                            <div 
                              className="absolute bottom-3 left-3 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"
                              style={{ 
                                backgroundColor: 'oklch(0.98 0 0 / 0.9)',
                                color: 'oklch(0.35 0 0)',
                              }}
                            >
                              <Clock className="w-3 h-3" />
                              {property.daysOnZillow} days
                            </div>
                          )}
                          
                          {/* Favorite Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(property.id, property);
                            }}
                            className="absolute bottom-3 right-12 p-2 rounded-full transition-all hover:scale-110"
                            style={{ 
                              backgroundColor: favorites.has(property.id) ? 'oklch(0.65 0.25 15 / 0.95)' : 'oklch(0.98 0 0 / 0.9)',
                              color: favorites.has(property.id) ? 'oklch(0.98 0 0)' : 'oklch(0.35 0 0)',
                            }}
                            title={favorites.has(property.id) ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Heart className="w-4 h-4" fill={favorites.has(property.id) ? 'currentColor' : 'none'} />
                          </button>
                          
                          {/* View Listing */}
                          <button
                            onClick={() => window.open(property.url, '_blank')}
                            className="absolute bottom-3 right-3 p-2 rounded-full transition-all"
                            style={{ 
                              backgroundColor: 'oklch(0.98 0 0 / 0.9)',
                              color: 'oklch(0.35 0 0)',
                            }}
                            title="View full listing"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Property Details */}
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-sm mb-1 truncate" style={{ color: 'oklch(0.15 0 0)' }}>
                            {property.address}
                          </h3>
                          <p className="text-xs mb-3" style={{ color: 'oklch(0.55 0 0)' }}>
                            {property.city}, {property.state} {property.zipCode}
                          </p>
                          
                          {/* Property Stats */}
                          <div className="flex items-center gap-4 text-xs mb-4" style={{ color: 'oklch(0.45 0 0)' }}>
                            <span className="flex items-center gap-1">
                              <Bed className="w-3.5 h-3.5" />
                              {property.bedrooms || '?'} bed
                            </span>
                            <span className="flex items-center gap-1">
                              <Bath className="w-3.5 h-3.5" />
                              {property.bathrooms || '?'} bath
                            </span>
                            {property.squareFeet && (
                              <span>{property.squareFeet.toLocaleString()} sqft</span>
                            )}
                          </div>
                          
                          {/* INLINE ANALYSIS RESULTS */}
                          {hasAnalysis && validation.projection && (
                            <div 
                              className="rounded-xl p-4 mb-4"
                              style={{ 
                                backgroundColor: validation.isGoodDeal ? 'oklch(0.55 0.15 145 / 0.08)' : 'oklch(0.96 0 0)',
                                border: validation.isGoodDeal ? '1px solid oklch(0.55 0.15 145 / 0.2)' : '1px solid oklch(0.90 0 0)',
                              }}
                            >
                              {/* Deal Score Header */}
                              {dealScore && (
                                <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: '1px solid oklch(0.90 0 0)' }}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                                      style={{ backgroundColor: dealScore.color, color: 'white' }}
                                    >
                                      {dealScore.grade}
                                    </div>
                                    <span className="text-xs font-medium" style={{ color: dealScore.color }}>
                                      {dealScore.label}
                                    </span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Monthly Profit - Hero Metric */}
                              <div className="text-center mb-4 pb-3" style={{ borderBottom: '1px solid oklch(0.90 0 0)' }}>
                                <p className="text-xs font-medium mb-1" style={{ color: 'oklch(0.50 0 0)' }}>
                                  Estimated Monthly Profit
                                </p>
                                <p 
                                  className="text-2xl font-bold"
                                  style={{ 
                                    color: validation.projection.monthlyProfit > 0 ? 'oklch(0.45 0.15 145)' : 'oklch(0.55 0.20 25)',
                                  }}
                                >
                                  {formatCurrency(validation.projection.monthlyProfit)}
                                </p>
                                <p className="text-xs mt-1" style={{ color: 'oklch(0.55 0 0)' }}>
                                  {formatCurrency(validation.projection.annualProfit)}/year
                                </p>
                              </div>
                              
                              {/* Key Metrics - Compact Row */}
                              <div className="flex flex-wrap gap-2 mb-3 text-xs">
                                <div className="flex items-center gap-1 px-2 py-1 rounded-md" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                                  <DollarSign className="w-3 h-3" style={{ color: 'oklch(0.55 0.14 75)' }} />
                                  <span style={{ color: 'oklch(0.55 0 0)' }}>Revenue:</span>
                                  <span className="font-semibold" style={{ color: 'oklch(0.25 0 0)' }}>{formatCurrency(validation.projection.monthlyRevenue)}/mo</span>
                                </div>
                                <div className="flex items-center gap-1 px-2 py-1 rounded-md" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                                  <Calendar className="w-3 h-3" style={{ color: 'oklch(0.55 0.14 75)' }} />
                                  <span style={{ color: 'oklch(0.55 0 0)' }}>Occ:</span>
                                  <span className="font-semibold" style={{ color: 'oklch(0.25 0 0)' }}>{Math.round(validation.projection.occupancy)}%</span>
                                </div>
                                <div className="flex items-center gap-1 px-2 py-1 rounded-md" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                                  <Target className="w-3 h-3" style={{ color: 'oklch(0.55 0.14 75)' }} />
                                  <span style={{ color: 'oklch(0.55 0 0)' }}>ADR:</span>
                                  <span className="font-semibold" style={{ color: 'oklch(0.25 0 0)' }}>{formatCurrency(validation.projection.adr)}</span>
                                </div>
                                <div className="flex items-center gap-1 px-2 py-1 rounded-md" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                                  <Percent className="w-3 h-3" style={{ color: 'oklch(0.55 0.14 75)' }} />
                                  <span style={{ color: 'oklch(0.55 0 0)' }}>ROI:</span>
                                  <span className="font-semibold" style={{ color: validation.projection.roi > 25 ? 'oklch(0.45 0.15 145)' : 'oklch(0.25 0 0)' }}>{validation.projection.roi}%</span>
                                </div>
                              </div>
                              
                              
                              
                              {/* Startup Costs (collapsed by default) */}
                              <details className="text-xs mb-3">
                                <summary className="cursor-pointer font-medium py-1" style={{ color: 'oklch(0.45 0 0)' }}>
                                  View Startup Costs
                                </summary>
                                <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                                  <div className="flex justify-between mb-1">
                                    <span style={{ color: 'oklch(0.55 0 0)' }}>First Month Rent</span>
                                    <span style={{ color: 'oklch(0.25 0 0)' }}>{formatCurrency(startupCosts.firstMonth)}</span>
                                  </div>
                                  <div className="flex justify-between mb-1">
                                    <span style={{ color: 'oklch(0.55 0 0)' }}>Security Deposit</span>
                                    <span style={{ color: 'oklch(0.25 0 0)' }}>{formatCurrency(startupCosts.deposit)}</span>
                                  </div>
                                  <div className="flex justify-between mb-1">
                                    <span style={{ color: 'oklch(0.55 0 0)' }}>Furnishing Est.</span>
                                    <span style={{ color: 'oklch(0.25 0 0)' }}>{formatCurrency(startupCosts.furnishing)}</span>
                                  </div>
                                  <div className="flex justify-between pt-1 font-semibold" style={{ borderTop: '1px solid oklch(0.90 0 0)' }}>
                                    <span style={{ color: 'oklch(0.35 0 0)' }}>Total Startup</span>
                                    <span style={{ color: 'oklch(0.55 0.14 75)' }}>{formatCurrency(startupCosts.total)}</span>
                                  </div>
                                </div>
                              </details>
                              
                              {/* Verdict */}
                              <p 
                                className="text-xs font-medium text-center py-2 rounded-lg"
                                style={{ 
                                  backgroundColor: validation.isGoodDeal ? 'oklch(0.55 0.15 145 / 0.1)' : 'oklch(0.55 0.20 25 / 0.1)',
                                  color: validation.isGoodDeal ? 'oklch(0.40 0.15 145)' : 'oklch(0.50 0.15 25)',
                                }}
                              >
                                {validation.verdict}
                              </p>
                            </div>
                          )}
                          
                          {/* Error State */}
                          {validation && !validation.success && (
                            <div 
                              className="p-3 rounded-lg mb-4 text-center"
                              style={{ backgroundColor: 'oklch(0.55 0.14 75 / 0.1)' }}
                            >
                              <p className="text-xs" style={{ color: 'oklch(0.45 0 0)' }}>
                                {validation.error || 'Could not get revenue estimate'}
                              </p>
                              <p className="text-xs mt-1" style={{ color: 'oklch(0.55 0 0)' }}>
                                Try the full analysis for more options
                              </p>
                            </div>
                          )}
                          
                          {/* ACTION BUTTONS */}
                          {!validation ? (
                            // Before analysis - show Analyze button
                            <Button
                              onClick={() => handleValidate(property)}
                              disabled={isValidating}
                              className="w-full h-10 text-sm"
                              style={{
                                backgroundColor: 'oklch(0.55 0.14 75)',
                                borderRadius: '980px',
                              }}
                            >
                              {isValidating ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  <TrendingUp className="w-4 h-4 mr-2" />
                                  Analyze Property
                                </>
                              )}
                            </Button>
                          ) : (
                            // After analysis - show action buttons
                            <div className="space-y-3">
                              {/* Contact Now Button */}
                              <Button
                                onClick={() => handleGetContacts(property)}
                                variant="outline"
                                className="w-full h-10 text-sm"
                                style={{ borderRadius: '980px' }}
                              >
                                <Phone className="w-4 h-4 mr-2" />
                                Contact Now
                              </Button>
                              
                              {/* Deep Dive Buttons - Switch tabs with property data */}
                              <div className="grid grid-cols-3 gap-2">
                                <Link href={`/?tab=find&location=${encodeURIComponent(property.city + ', ' + property.state)}&address=${encodeURIComponent(property.address)}&bedrooms=${property.bedrooms}&bathrooms=${property.bathrooms}&rent=${property.price}`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-10 text-xs px-3"
                                    style={{ borderRadius: '0.5rem' }}
                                  >
                                    <Users className="w-3.5 h-3.5 mr-1.5" />
                                    Competition
                                  </Button>
                                </Link>
                                <Link href={`/?tab=map&location=${encodeURIComponent(property.city + ', ' + property.state)}&address=${encodeURIComponent(property.address)}&bedrooms=${property.bedrooms}&autoAnalyze=true`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-10 text-xs px-3"
                                    style={{ borderRadius: '0.5rem' }}
                                  >
                                    <MapIcon className="w-3.5 h-3.5 mr-1.5" />
                                    Map
                                  </Button>
                                </Link>
                                <Link href={`/?tab=prove&location=${encodeURIComponent(property.city + ', ' + property.state)}&autoAnalyze=true`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-10 text-xs px-3"
                                    style={{ borderRadius: '0.5rem' }}
                                  >
                                    <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                                    Market
                                  </Button>
                                </Link>
                              </div>
                              
                              {/* Turnkey CTA */}
                              <a 
                                href="https://coachinayah.com/turnkey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <Button
                                  className="w-full h-10 text-sm group"
                                  style={{
                                    backgroundColor: 'oklch(0.55 0.14 75)',
                                    borderRadius: '980px',
                                  }}
                                >
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Learn About Turnkey
                                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                              </a>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
              
              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center pt-6">
                  <Button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    variant="outline"
                    className="px-8"
                    style={{ borderRadius: '980px' }}
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More Properties
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {/* Empty State */}
      {!hasSearched && (
        <Card className="p-12 text-center" style={{ borderRadius: '1.25rem', backgroundColor: 'oklch(0.98 0 0)' }}>
          <div 
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: 'oklch(0.55 0.14 75 / 0.15)' }}
          >
            <Search className="w-8 h-8" style={{ color: 'oklch(0.55 0.14 75)' }} />
          </div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'oklch(0.15 0 0)' }}>
            Search for Rental Opportunities
          </h3>
          <p className="max-w-md mx-auto mb-6" style={{ color: 'oklch(0.45 0 0)' }}>
            Enter a city or zip code above to browse available rentals. Click "Analyze" on any property to see its STR profit potential instantly.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['Atlanta, GA', 'Denver, CO', 'Austin, TX', 'Nashville, TN'].map(city => (
              <button
                key={city}
                onClick={() => {
                  setLocation(city);
                  setTimeout(() => handleSearch(), 100);
                }}
                className="px-4 py-2 text-sm rounded-full transition-all duration-300 hover:scale-105"
                style={{
                  backgroundColor: 'oklch(0.96 0 0)',
                  color: 'oklch(0.35 0 0)',
                  border: '1px solid oklch(0.88 0 0)',
                }}
              >
                {city}
              </button>
            ))}
          </div>
        </Card>
      )}
      
      {/* Contact Modal */}
      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" style={{ color: 'oklch(0.55 0.14 75)' }} />
              Contact Information
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingContacts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'oklch(0.55 0.14 75)' }} />
            </div>
          ) : contactResult?.success && contactResult.contacts?.primaryContact ? (
            <div className="space-y-4">
              {/* Property Info */}
              {contactProperty && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'oklch(0.96 0 0)' }}>
                  <p className="font-medium text-sm" style={{ color: 'oklch(0.25 0 0)' }}>
                    {contactProperty.address}
                  </p>
                  <p className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>
                    {contactProperty.city}, {contactProperty.state} {contactProperty.zipCode}
                  </p>
                </div>
              )}
              
              {/* Contact Details */}
              <div className="space-y-3">
                {contactResult.contacts.primaryContact.name && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'oklch(0.55 0.14 75 / 0.15)' }}>
                      <Users className="w-5 h-5" style={{ color: 'oklch(0.55 0.14 75)' }} />
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: 'oklch(0.25 0 0)' }}>
                        {contactResult.contacts.primaryContact.name}
                      </p>
                      {contactResult.contacts.primaryContact.brokerage && (
                        <p className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>
                          {contactResult.contacts.primaryContact.brokerage}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {contactResult.contacts.primaryContact.phone && (
                  <a 
                    href={`tel:${contactResult.contacts.primaryContact.phone}`}
                    className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-[oklch(0.96_0_0)]"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'oklch(0.45 0.15 145 / 0.15)' }}>
                      <Phone className="w-5 h-5" style={{ color: 'oklch(0.45 0.15 145)' }} />
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>Phone</p>
                      <p className="font-medium" style={{ color: 'oklch(0.45 0.15 145)' }}>
                        {contactResult.contacts.primaryContact.phone}
                      </p>
                    </div>
                  </a>
                )}
                
                {contactResult.contacts.primaryContact.email && (
                  <a 
                    href={`mailto:${contactResult.contacts.primaryContact.email}`}
                    className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-[oklch(0.96_0_0)]"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'oklch(0.55 0.14 75 / 0.15)' }}>
                      <Mail className="w-5 h-5" style={{ color: 'oklch(0.55 0.14 75)' }} />
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>Email</p>
                      <p className="font-medium" style={{ color: 'oklch(0.55 0.14 75)' }}>
                        {contactResult.contacts.primaryContact.email}
                      </p>
                    </div>
                  </a>
                )}
              </div>
              
              {/* View Full Listing fallback */}
              <Button
                onClick={() => contactProperty && window.open(contactProperty.url, '_blank')}
                variant="outline"
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Full Listing
              </Button>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'oklch(0.96 0 0)' }}>
                <Info className="w-6 h-6" style={{ color: 'oklch(0.55 0 0)' }} />
              </div>
              <p className="text-sm mb-4" style={{ color: 'oklch(0.45 0 0)' }}>
                {contactResult?.error || 'Contact information not available for this listing.'}
              </p>
              <Button
                onClick={() => contactProperty && window.open(contactProperty.url, '_blank')}
                className="w-full"
                style={{ backgroundColor: 'oklch(0.55 0.14 75)' }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Contact via Listing
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Photo Gallery Modal */}
      <Dialog open={photoGalleryOpen} onOpenChange={setPhotoGalleryOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" style={{ color: 'oklch(0.55 0.14 75)' }} />
              Property Photos
              {photoGalleryProperty?.photos && photoGalleryProperty.photos.length > 0 && (
                <span className="text-sm font-normal" style={{ color: 'oklch(0.55 0 0)' }}>
                  ({currentPhotoIndex + 1} of {photoGalleryProperty.photos.length})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {photoGalleryProperty && photoGalleryProperty.photos && photoGalleryProperty.photos.length > 0 ? (
            <div className="relative">
              {/* Main Image */}
              <div className="relative h-[60vh] bg-black flex items-center justify-center">
                <img
                  src={photoGalleryProperty.photos[currentPhotoIndex]}
                  alt={`${photoGalleryProperty.address} - Photo ${currentPhotoIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
                
                {/* Navigation Arrows */}
                {photoGalleryProperty.photos.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentPhotoIndex(prev => prev === 0 ? photoGalleryProperty.photos.length - 1 : prev - 1)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                      style={{ backgroundColor: 'oklch(0.98 0 0 / 0.9)' }}
                    >
                      <ChevronLeft className="w-6 h-6" style={{ color: 'oklch(0.25 0 0)' }} />
                    </button>
                    <button
                      onClick={() => setCurrentPhotoIndex(prev => prev === photoGalleryProperty.photos.length - 1 ? 0 : prev + 1)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                      style={{ backgroundColor: 'oklch(0.98 0 0 / 0.9)' }}
                    >
                      <ChevronRight className="w-6 h-6" style={{ color: 'oklch(0.25 0 0)' }} />
                    </button>
                  </>
                )}
              </div>
              
              {/* Thumbnail Strip */}
              {photoGalleryProperty.photos.length > 1 && (
                <div className="p-3 bg-black/90 overflow-x-auto">
                  <div className="flex gap-2 min-w-max">
                    {photoGalleryProperty.photos.map((photo, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentPhotoIndex(index)}
                        className={`w-16 h-12 rounded overflow-hidden flex-shrink-0 transition-all ${
                          index === currentPhotoIndex ? 'ring-2 ring-white scale-105' : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={photo}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Property Info */}
              <div className="p-4" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                <h3 className="font-semibold" style={{ color: 'oklch(0.15 0 0)' }}>
                  {photoGalleryProperty.address}
                </h3>
                <p className="text-sm" style={{ color: 'oklch(0.55 0 0)' }}>
                  {photoGalleryProperty.city}, {photoGalleryProperty.state} {photoGalleryProperty.zipCode}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm" style={{ color: 'oklch(0.45 0 0)' }}>
                  <span className="font-semibold" style={{ color: 'oklch(0.55 0.14 75)' }}>
                    {photoGalleryProperty.price > 0 ? (
                      <>{formatCurrency(photoGalleryProperty.price)}{searchType === 'forRent' ? '/mo' : ''}</>
                    ) : (
                      'Contact for Price'
                    )}
                  </span>
                  <span>{photoGalleryProperty.bedrooms} bed</span>
                  <span>{photoGalleryProperty.bathrooms} bath</span>
                  {photoGalleryProperty.squareFeet && <span>{photoGalleryProperty.squareFeet.toLocaleString()} sqft</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Home className="w-12 h-12 mx-auto mb-3" style={{ color: 'oklch(0.70 0 0)' }} />
              <p style={{ color: 'oklch(0.55 0 0)' }}>No photos available for this property</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
