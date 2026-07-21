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

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Image,
  Bot,
  Brain,
  Microscope,
  X,
  RotateCcw,
  Zap,
  Trophy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bookmark,
  ArrowDownToLine,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { InfoTooltip } from '@/components/InfoTooltip';
import { GooglePlacesAutocomplete } from '@/components/GooglePlacesAutocomplete';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { useProperty } from '@/contexts/PropertyContext';

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
  latitude?: number;
  longitude?: number;
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
  onNavigateToValidate?: (property: {
    address: string;
    bedrooms: number;
    bathrooms: number;
    monthlyRent: number;
  }) => void;
  initialLocation?: string; // For pre-filling from URL params (HubSpot emails)
  onLocationChange?: (location: { city?: string; state?: string }) => void;
  initialCity?: string;
  initialState?: string;
  isAdmin?: boolean;
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
// Purchase mode uses different thresholds since CoC ROI of 10-20% is excellent for real estate
function calculateDealScore(roi: number, monthlyProfit: number, occupancy: number, mode: 'rent' | 'purchase' = 'rent'): { grade: string; color: string; label: string } {
  let score = 0;
  
  if (mode === 'purchase') {
    // Purchase mode: Cash-on-Cash ROI thresholds (realistic for real estate)
    if (roi >= 20) score += 40;
    else if (roi >= 15) score += 35;
    else if (roi >= 12) score += 30;
    else if (roi >= 8) score += 25;
    else if (roi >= 5) score += 15;
    else if (roi >= 0) score += 5;
    
    // Monthly cash flow scoring for purchase (max 40 points)
    if (monthlyProfit >= 1500) score += 40;
    else if (monthlyProfit >= 1000) score += 35;
    else if (monthlyProfit >= 500) score += 30;
    else if (monthlyProfit >= 200) score += 20;
    else if (monthlyProfit >= 0) score += 10;
  } else {
    // Rent mode: ROI scoring (max 40 points)
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
  }
  
  // Occupancy scoring (max 20 points) - same for both modes
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

// LocalStorage keys for state persistence
const OPPORTUNITY_FINDER_STATE_KEY = 'opportunityFinder_state';

// Load saved state from localStorage
function loadSavedState(): { location: string; searchType: 'forRent' | 'forSale'; properties: ZillowProperty[]; totalResults: number; hasMore: boolean; hasSearched: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(OPPORTUNITY_FINDER_STATE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Only restore if saved within last 30 minutes
      if (parsed.timestamp && Date.now() - parsed.timestamp < 30 * 60 * 1000) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('[OpportunityFinder] Error loading saved state:', e);
  }
  return null;
}

// Save state to localStorage
function saveState(state: { location: string; searchType: 'forRent' | 'forSale'; properties: ZillowProperty[]; totalResults: number; hasMore: boolean; hasSearched: boolean }): void {
  if (typeof window === 'undefined') return;
  try {
    console.log('[OpportunityFinder] Saving state:', state.location, state.properties?.length || 0, 'properties');
    const dataToSave = JSON.stringify({
      ...state,
      timestamp: Date.now()
    });
    localStorage.setItem(OPPORTUNITY_FINDER_STATE_KEY, dataToSave);
    console.log('[OpportunityFinder] State saved successfully, size:', dataToSave.length);
  } catch (e) {
    console.error('[OpportunityFinder] Error saving state:', e);
  }
}

export default function OpportunityFinderStep({ onSelectProperty, onNavigateToValidate, initialLocation, onLocationChange, initialCity, initialState, isAdmin = false }: OpportunityFinderStepProps) {
  // Auth state
  const { user } = useAuth();
  
  // Property context for purchase mode data
  const { globalMode, myProperty } = useProperty();
  
  // Search state - restore from localStorage if available using initializer function
  // This ensures state is loaded fresh on each mount (when switching tabs)
  // Priority: initialCity/State (from URL params) > initialLocation > saved state > empty
  const [location, setLocation] = useState(() => {
    // If initialCity/State is provided (from share link), use it
    if (initialCity && initialState) {
      const loc = `${initialCity}, ${initialState}`;
      console.log('[OpportunityFinder] Using initialCity/State from URL:', loc);
      return loc;
    }
    // If initialLocation is provided (from HubSpot email deep link), use it
    if (initialLocation) {
      console.log('[OpportunityFinder] Using initialLocation from URL:', initialLocation);
      return initialLocation;
    }
    const saved = loadSavedState();
    console.log('[OpportunityFinder] Loading saved location:', saved?.location);
    return saved?.location || '';
  });
  const [searchType, setSearchType] = useState<'forRent' | 'forSale'>(() => {
    const saved = loadSavedState();
    return saved?.searchType || 'forRent';
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Update location when initialLocation prop changes (for HubSpot email deep links)
  useEffect(() => {
    if (initialLocation && initialLocation !== location) {
      console.log('[OpportunityFinder] Updating location from initialLocation prop:', initialLocation);
      setLocation(initialLocation);
    }
  }, [initialLocation]);
  
  // Re-search when searchType changes (For Rent / For Sale toggle)
  useEffect(() => {
    if (location.trim() && hasSearched) {
      handleSearch(1, false);
    }
  }, [searchType]);
  
  // Notify parent when location changes (for share button)
  useEffect(() => {
    if (onLocationChange && location) {
      // Parse city and state from location string
      const parts = location.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        onLocationChange({ city: parts[0], state: parts[1] });
      } else {
        onLocationChange({ city: parts[0] });
      }
    }
  }, [location, onLocationChange]);
  
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
  
  // Infinite scroll sentinel ref
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('price_asc');
  
  // Results state - restore from localStorage if available
  const [properties, setProperties] = useState<ZillowProperty[]>(() => {
    const saved = loadSavedState();
    console.log('[OpportunityFinder] Loading saved properties:', saved?.properties?.length || 0);
    return saved?.properties || [];
  });
  const [totalResults, setTotalResults] = useState(() => {
    const saved = loadSavedState();
    return saved?.totalResults || 0;
  });
  const [hasMore, setHasMore] = useState(() => {
    const saved = loadSavedState();
    return saved?.hasMore || false;
  });
  const [hasSearched, setHasSearched] = useState(() => {
    const saved = loadSavedState();
    return saved?.hasSearched || false;
  });
  
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
      
      // Warn user if saving without analysis
      if (!validation?.success) {
        toast.info('Tip: Analyze the property first to save revenue data with your favorite!');
      }
      
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
          // For Sale properties: store price as purchasePrice, not monthlyRent
          monthlyRent: searchType === 'forRent' ? property.price : undefined,
          purchasePrice: searchType === 'forSale' ? property.price : undefined,
          zillowUrl: property.url,
          imageUrl: property.image, // Property thumbnail image
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
  const batchValidate = trpc.opportunityFinder.batchValidateProperties.useMutation();
  
  const isSearching = searchRentals.isPending || searchForSale.isPending;
  
  // Batch analysis state
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<{
    totalAnalyzed: number;
    successCount: number;
    failedCount: number;
    elapsedSeconds: number;
    topDeals: Array<{
      id: string;
      address: string;
      city?: string;
      state?: string;
      rent: number;
      monthlyProfit: number;
      annualProfit: number;
      roi: number;
      occupancy: number;
      adr: number;
      verdict: string;
      image?: string;
      zillowUrl?: string;
      bedrooms?: number;
      bathrooms?: number;
      annualRevenue?: number;
      monthlyRevenue?: number;
    }>;
  } | null>(null);
  const [showBatchResults, setShowBatchResults] = useState(false);
  const [isSavingTopDeals, setIsSavingTopDeals] = useState(false);
  const [profitThreshold, setProfitThreshold] = useState(500);
  const [savedTopDealsCount, setSavedTopDealsCount] = useState(0);
  
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
      loadMore: append, // Pass loadMore flag for for-sale pagination
    };
    
    try {
      const result = searchType === 'forRent' 
        ? await searchRentals.mutateAsync(params)
        : await searchForSale.mutateAsync(params);
      
      const newProperties = append 
        ? [...properties, ...result.properties]
        : result.properties;
      
      if (append) {
        setProperties(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newUnique = result.properties.filter((p: ZillowProperty) => !existingIds.has(p.id));
          return [...prev, ...newUnique];
        });
        // When appending, only update totalResults if the new value is greater
        // This prevents the "32 of 0" issue when API returns 0 on subsequent pages
        setTotalResults(prev => result.totalResults > 0 ? result.totalResults : prev);
      } else {
        setProperties(result.properties);
        setTotalResults(result.totalResults);
      }
      setHasMore(result.hasMore || false);
      // Use the backend's currentPage (which accounts for multi-page initial fetch)
      // e.g., initial load fetches pages 1-3, so currentPage should be 3, not 1
      setCurrentPage(result.currentPage ?? page);
      
      // Save state to localStorage for persistence when switching tabs
      // When appending, preserve the original totalResults if API returns 0
      const savedTotalResults = append && result.totalResults === 0 ? totalResults : result.totalResults;
      saveState({
        location: location.trim(),
        searchType,
        properties: newProperties,
        totalResults: savedTotalResults,
        hasMore: result.hasMore || false,
        hasSearched: true
      });
    } catch (error: any) {
      console.error('Search error:', error);
      const errorMsg = error?.message || '';
      if (errorMsg.includes('aborted') || errorMsg.includes('timed out')) {
        // Search timed out — show a helpful message
        toast.error('Search is taking longer than expected. Try searching by zip code for faster results.', { duration: 6000 });
      } else if (errorMsg.includes('limit')) {
        toast.error('Daily search limit reached. Please try again tomorrow.', { duration: 5000 });
      } else {
        toast.error('Search failed. Please try again.', { duration: 4000 });
      }
    } finally {
      setIsLoadingMore(false);
    }
  };
  
  // Load more results
  const handleLoadMore = () => {
    handleSearch(currentPage + 1, true);
  };
  
  // Go to previous page (reload from start)
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      // Reset to page 1 and reload
      setCurrentPage(1);
      handleSearch(1, false);
    }
  };
  
  // Clear search and reset all state
  const handleClearSearch = () => {
    // Clear location and results
    setLocation('');
    setProperties([]);
    setTotalResults(0);
    setHasMore(false);
    setHasSearched(false);
    setCurrentPage(1);
    setValidationResults({});
    
    // Clear all filters
    setPriceMin('');
    setPriceMax('');
    setBedsMin('');
    setBedsMax('');
    setBathsMin('');
    setBathsMax('');
    setHomeType('');
    setSortBy('price_asc');
    
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(OPPORTUNITY_FINDER_STATE_KEY);
    }
    
    toast.success('Search cleared');
  };
  
  // Handle validation (Analyze button)
  const handleValidate = async (property: ZillowProperty) => {
    setValidatingId(property.id);
    
    try {
      const result = await validateProperty.mutateAsync({
        address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
        rent: property.price,
        bedrooms: property.bedrooms ?? 2,
        bathrooms: property.bathrooms ?? 1,
        zillowUrl: property.url,
        image: property.image,
      });
      
      setValidationResults(prev => ({
        ...prev,
        [property.id]: result,
      }));
      
      // Call onSelectProperty to populate data in other tabs
      if (onSelectProperty && result.success) {
        onSelectProperty({
          address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
          bedrooms: property.bedrooms ?? 2,
          bathrooms: property.bathrooms ?? 1,
          monthlyRent: searchType === 'forRent' ? property.price : 0,
        });
      }
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
  
  // Handle batch analysis of all visible properties
  const handleBatchAnalyze = async () => {
    if (displayedProperties.length === 0) return;
    setIsBatchAnalyzing(true);
    setBatchProgress(0);
    setBatchResults(null);
    setShowBatchResults(false);
    
    // Simulate progress while waiting for API
    const progressInterval = setInterval(() => {
      setBatchProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 8;
      });
    }, 500);
    
    try {
      const propsToAnalyze = displayedProperties.map(p => ({
        id: p.id,
        address: p.address,
        rent: p.price,
        bedrooms: p.bedrooms ?? 2,
        bathrooms: p.bathrooms ?? 1,
        zillowUrl: p.url,
        image: p.image,
        city: p.city,
        state: p.state,
        zipCode: p.zipCode,
      }));
      
      const result = await batchValidate.mutateAsync({
        properties: propsToAnalyze,
        minProfitThreshold: profitThreshold,
        searchType: searchType === 'forSale' ? 'forSale' : 'forRent',
      });
      
      clearInterval(progressInterval);
      setBatchProgress(100);
      
      // Also update individual validation results so cards show inline
      if (result.results) {
        const newValidations: Record<string, ValidationResult> = {};
        for (const r of result.results) {
          newValidations[r.id] = {
            success: r.success,
            property: {
              address: r.property.address,
              rent: r.property.rent,
              bedrooms: r.property.bedrooms,
              bathrooms: r.property.bathrooms,
            },
            projection: r.projection,
            verdict: r.verdict,
            isGoodDeal: r.isGoodDeal,
            error: r.error,
          };
        }
        setValidationResults(prev => ({ ...prev, ...newValidations }));
      }
      
      setBatchResults({
        totalAnalyzed: result.totalAnalyzed,
        successCount: result.successCount,
        failedCount: result.failedCount,
        elapsedSeconds: result.elapsedSeconds,
        topDeals: result.topDeals,
      });
      setShowBatchResults(true);
      
      toast.success(`Analyzed ${result.successCount} of ${result.totalAnalyzed} properties!`);
    } catch (error) {
      console.error('Batch analysis error:', error);
      clearInterval(progressInterval);
      toast.error('Batch analysis failed. Please try again.');
    } finally {
      setIsBatchAnalyzing(false);
    }
  };
  
  // Handle saving all top deals to favorites in one click
  const handleSaveTopDeals = async () => {
    if (!batchResults?.topDeals?.length) return;
    
    setIsSavingTopDeals(true);
    setSavedTopDealsCount(0);
    let savedCount = 0;
    
    for (const deal of batchResults.topDeals) {
      // Skip only if we have a confirmed database ID for this deal
      // (localStorage favorites can be stale, so we check favoritesDbIds which tracks actual DB saves)
      if (favoritesDbIds.has(deal.id)) {
        savedCount++;
        setSavedTopDealsCount(savedCount);
        continue;
      }
      
      try {
        const result = await addFavorite.mutateAsync({
          sessionId: getSessionId(),
          address: deal.address,
          city: deal.city,
          state: deal.state,
          bedrooms: deal.bedrooms ?? undefined,
          bathrooms: deal.bathrooms ?? undefined,
          // For Sale properties: store price as purchasePrice, not monthlyRent
          monthlyRent: searchType === 'forRent' ? deal.rent : undefined,
          purchasePrice: searchType === 'forSale' ? deal.rent : undefined,
          zillowUrl: deal.zillowUrl,
          imageUrl: deal.image,
          annualRevenue: deal.annualRevenue ?? Math.round(deal.annualProfit + (searchType === 'forRent' ? deal.rent * 12 : 0)),
          monthlyRevenue: deal.monthlyRevenue ?? Math.round((deal.annualProfit + (searchType === 'forRent' ? deal.rent * 12 : 0)) / 12),
          occupancyRate: deal.occupancy,
          averageDailyRate: deal.adr,
          estimatedProfit: deal.annualProfit,
        });
        
        if (result.success && result.data?.id) {
          // Update favorites state
          setFavorites(prev => {
            const newFavorites = new Set(prev);
            newFavorites.add(deal.id);
            localStorage.setItem('opportunityFinder_favorites', JSON.stringify(Array.from(newFavorites)));
            return newFavorites;
          });
          setFavoritesDbIds(prev => {
            const newMap = new Map(prev);
            newMap.set(deal.id, result.data!.id);
            return newMap;
          });
          savedCount++;
          setSavedTopDealsCount(savedCount);
        }
      } catch (error) {
        console.error(`Error saving deal ${deal.address}:`, error);
      }
    }
    
    setIsSavingTopDeals(false);
    if (savedCount > 0) {
      toast.success(`Saved ${savedCount} top deal${savedCount > 1 ? 's' : ''} to favorites!`);
    } else {
      toast.info('All top deals are already in your favorites.');
    }
  };
  
  // Handle Load More & Auto-Analyze: fetches next page then batch-analyzes the new properties
  const handleLoadMoreAndAnalyze = async () => {
    if (!hasMore || isLoadingMore || isBatchAnalyzing) return;
    
    // Step 1: Load more properties
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    
    try {
      const params = {
        location: location.trim(),
        priceMin: priceMin ? parseInt(priceMin) : undefined,
        priceMax: priceMax ? parseInt(priceMax) : undefined,
        bedsMin: bedsMin ? parseInt(bedsMin) : undefined,
        bedsMax: bedsMax ? parseInt(bedsMax) : undefined,
        bathsMin: bathsMin ? parseFloat(bathsMin) : undefined,
        bathsMax: bathsMax ? parseFloat(bathsMax) : undefined,
        homeTypes: homeType ? [homeType] : undefined,
        page: nextPage,
        loadMore: true,
      };
      
      const result = searchType === 'forRent'
        ? await searchRentals.mutateAsync(params)
        : await searchForSale.mutateAsync(params);
      
      const newProperties = result.properties;
      
      // Append to existing properties (deduplicate)
      setProperties(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newUnique = newProperties.filter((p: ZillowProperty) => !existingIds.has(p.id));
        return [...prev, ...newUnique];
      });
      setTotalResults(prev => result.totalResults > 0 ? result.totalResults : prev);
      setHasMore(result.hasMore || false);
      setCurrentPage(result.currentPage ?? nextPage);
      setIsLoadingMore(false);
      
      // Save state
      const allProperties = [...properties, ...newProperties];
      const savedTotalResults = result.totalResults === 0 ? totalResults : result.totalResults;
      saveState({
        location: location.trim(),
        searchType,
        properties: allProperties,
        totalResults: savedTotalResults,
        hasMore: result.hasMore || false,
        hasSearched: true,
      });
      
      if (newProperties.length === 0) {
        toast.info('No more properties to load.');
        return;
      }
      
      // Step 2: Auto-navigate to the last page to show new properties
      // Properties are auto-displayed via infinite scroll, no page navigation needed
      
      // Step 3: Auto-run batch analysis on the newly loaded properties
      toast.info(`Loaded ${newProperties.length} new properties. Running analysis...`);
      
      setIsBatchAnalyzing(true);
      setBatchProgress(0);
      // Don't reset batchResults — we want cumulative merging
      setShowBatchResults(false);
      
      const progressInterval = setInterval(() => {
        setBatchProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 8;
        });
      }, 500);
      
      try {
        const propsToAnalyze = newProperties.map(p => ({
          id: p.id,
          address: p.address,
          rent: p.price,
          bedrooms: p.bedrooms ?? 2,
          bathrooms: p.bathrooms ?? 1,
          zillowUrl: p.url,
          image: p.image,
          city: p.city,
          state: p.state,
          zipCode: p.zipCode,
        }));
        
        const batchResult = await batchValidate.mutateAsync({
          properties: propsToAnalyze,
          minProfitThreshold: profitThreshold,
          searchType: searchType === 'forSale' ? 'forSale' : 'forRent',
        });
        
        clearInterval(progressInterval);
        setBatchProgress(100);
        
        // Update individual validation results
        if (batchResult.results) {
          const newValidations: Record<string, ValidationResult> = {};
          for (const r of batchResult.results) {
            newValidations[r.id] = {
              success: r.success,
              property: {
                address: r.property.address,
                rent: r.property.rent,
                bedrooms: r.property.bedrooms,
                bathrooms: r.property.bathrooms,
              },
              projection: r.projection,
              verdict: r.verdict,
              isGoodDeal: r.isGoodDeal,
              error: r.error,
            };
          }
          setValidationResults(prev => ({ ...prev, ...newValidations }));
        }
        
        // Cumulative leaderboard: merge new top deals with existing ones
        setBatchResults(prev => {
          if (!prev) {
            return {
              totalAnalyzed: batchResult.totalAnalyzed,
              successCount: batchResult.successCount,
              failedCount: batchResult.failedCount,
              elapsedSeconds: batchResult.elapsedSeconds,
              topDeals: batchResult.topDeals,
            };
          }
          // Merge: combine existing + new top deals, deduplicate by id, re-sort by profit
          const existingIds = new Set(prev.topDeals.map(d => d.id));
          const newDeals = batchResult.topDeals.filter(d => !existingIds.has(d.id));
          const mergedDeals = [...prev.topDeals, ...newDeals]
            .sort((a, b) => b.monthlyProfit - a.monthlyProfit);
          
          return {
            totalAnalyzed: prev.totalAnalyzed + batchResult.totalAnalyzed,
            successCount: prev.successCount + batchResult.successCount,
            failedCount: prev.failedCount + batchResult.failedCount,
            elapsedSeconds: prev.elapsedSeconds + batchResult.elapsedSeconds,
            topDeals: mergedDeals,
          };
        });
        setShowBatchResults(true);
        
        const newDealsFound = batchResult.topDeals.length;
        toast.success(`Loaded & analyzed ${batchResult.successCount} new properties! ${newDealsFound > 0 ? `Found ${newDealsFound} new deal${newDealsFound > 1 ? 's' : ''} above your bar.` : 'No new deals above your bar.'}`);
      } catch (error) {
        console.error('Auto-analyze error:', error);
        clearInterval(progressInterval);
        toast.error('Analysis failed, but properties were loaded.');
      } finally {
        setIsBatchAnalyzing(false);
      }
    } catch (error) {
      console.error('Load more error:', error);
      setIsLoadingMore(false);
      toast.error('Failed to load more properties.');
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
      bedrooms: String(property.bedrooms ?? 2),
      bathrooms: String(property.bathrooms ?? 1),
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
  
  // After batch analysis, filter out properties below the profit threshold
  const filteredProperties = useMemo(() => {
    if (!showBatchResults || !batchResults) return sortedProperties;
    return sortedProperties.filter(p => {
      const validation = validationResults[p.id];
      // Keep properties that haven't been analyzed yet (shouldn't happen after batch, but safe)
      if (!validation?.success || !validation?.projection) return false;
      return validation.projection.monthlyProfit >= profitThreshold;
    });
  }, [sortedProperties, showBatchResults, batchResults, validationResults, profitThreshold]);
  
  // Infinite scroll: show all loaded & filtered properties (no client-side pagination)
  const displayedProperties = filteredProperties;
  
  // Infinite scroll: IntersectionObserver to auto-load more when sentinel is visible
  useEffect(() => {
    if (!sentinelRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isLoadingMore && !isSearching) {
          handleLoadMore();
        }
      },
      { rootMargin: '400px' } // Start loading 400px before user reaches bottom
    );
    
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isSearching, currentPage]);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ backgroundColor: 'oklch(0.55 0.14 75 / 0.15)' }}>
          <Search className="w-7 h-7" style={{ color: 'oklch(0.55 0.14 75)' }} />
        </div>
        <h2 className="text-2xl md:text-3xl font-semibold mb-2" style={{ color: 'oklch(0.15 0 0)' }}>
          See What's Making Money in Your City
        </h2>
        <p className="text-base max-w-xl mx-auto" style={{ color: 'oklch(0.45 0 0)' }}>
          Search any city, browse real properties, and instantly see how much they could earn as short-term rentals.
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
              <GooglePlacesAutocomplete
                placeholder="Search city, neighborhood, or zip code..."
                types={[]} // Empty = all types (cities, neighborhoods, zip codes, addresses)
                countryRestriction="us"
                allowDirectSearch={true} // Allow searching even if Google doesn't recognize the location
                initialValue={initialLocation || location} // Pre-fill from URL params (HubSpot emails)
                onQueryChange={(query) => {
                  // Track query changes for manual search button
                  setLocation(query);
                }}
                onSelect={(place) => {
                  // Set location from selected place and trigger search
                  setLocation(place.name);
                  // Use setTimeout to ensure state is updated before search
                  setTimeout(() => handleSearch(), 50);
                }}
              />
            </div>
            <Button
              onClick={() => handleSearch()}
              disabled={!location.trim() || isSearching}
              className="h-12 px-6"
              data-opportunity-button
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
            
            {/* Clear Search Button - only show when there are results or filters */}
            {(hasSearched || location.trim()) && (
              <Button
                onClick={handleClearSearch}
                variant="outline"
                className="h-12 px-4"
                style={{
                  borderRadius: '980px',
                  borderColor: 'oklch(0.85 0 0)',
                  color: 'oklch(0.45 0 0)',
                }}
                title="Clear search and reset filters"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
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
          <div className="flex flex-col gap-4">
            {/* Top Row: Count and Controls */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <p className="text-sm" style={{ color: 'oklch(0.45 0 0)' }}>
                {isSearching ? (
                  'Searching...'
                ) : (
                  <>
                    Showing <span className="font-semibold" style={{ color: 'oklch(0.15 0 0)' }}>{filteredProperties.length}</span> properties{showBatchResults && filteredProperties.length < sortedProperties.length && <span style={{ color: 'oklch(0.55 0.12 85)' }}> ({sortedProperties.length - filteredProperties.length} hidden below ${profitThreshold.toLocaleString()}/mo)</span>}{totalResults > sortedProperties.length && <span style={{ color: 'oklch(0.55 0 0)' }}> ({totalResults.toLocaleString()} in market)</span>}
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
          </div>
          
          {/* Batch Analyze All Button - Admin Only */}
          {isAdmin && displayedProperties.length > 0 && !isSearching && (
            <div className="mt-4">
              {/* Profit Threshold + Analyze All Button */}
              {!isBatchAnalyzing && !showBatchResults && (
                <div className="space-y-3">
                  {/* Minimum Profit Threshold Input */}
                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'oklch(0.97 0.005 85)', border: '1px solid oklch(0.85 0.04 85)' }}>
                    <DollarSign className="w-5 h-5 flex-shrink-0" style={{ color: 'oklch(0.55 0.12 85)' }} />
                    <div className="flex-1">
                      <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'oklch(0.50 0.05 85)' }}>Minimum Monthly Profit</label>
                      <p className="text-xs mt-0.5" style={{ color: 'oklch(0.60 0 0)' }}>Only show deals that meet your profit bar</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Preset buttons */}
                      {[500, 1000, 2000, 3000].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setProfitThreshold(preset)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                          style={{
                            background: profitThreshold === preset ? 'oklch(0.55 0.12 85)' : 'white',
                            color: profitThreshold === preset ? 'white' : 'oklch(0.40 0.05 85)',
                            border: `1px solid ${profitThreshold === preset ? 'oklch(0.55 0.12 85)' : 'oklch(0.80 0.04 85)'}`,
                          }}
                        >
                          ${preset >= 1000 ? `${preset / 1000}K` : preset}
                        </button>
                      ))}
                      {/* Custom input */}
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium" style={{ color: 'oklch(0.40 0 0)' }}>$</span>
                        <input
                          type="number"
                          value={profitThreshold}
                          onChange={(e) => setProfitThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-20 px-2 py-1.5 rounded-lg text-sm font-semibold text-right"
                          style={{ 
                            background: 'white',
                            border: '1px solid oklch(0.80 0.04 85)',
                            color: 'oklch(0.30 0 0)',
                          }}
                          min={0}
                          step={100}
                          placeholder="500"
                        />
                        <span className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>/mo</span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleBatchAnalyze()}
                    className="w-full py-4 px-6 rounded-xl font-semibold text-white flex items-center justify-center gap-3 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg active:scale-[0.99]"
                    style={{ 
                      background: 'linear-gradient(135deg, oklch(0.45 0.15 145), oklch(0.40 0.12 160))',
                      boxShadow: '0 4px 14px oklch(0.45 0.15 145 / 0.3)',
                    }}
                  >
                    <Zap className="w-5 h-5" />
                    <span>Analyze All {displayedProperties.length} Properties</span>
                    <span className="text-sm opacity-80">— Show deals above ${profitThreshold.toLocaleString()}/mo</span>
                  </button>
                </div>
              )}
              
              {/* Progress Bar */}
              {isBatchAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-6"
                  style={{ backgroundColor: 'oklch(0.97 0.01 145)', border: '1px solid oklch(0.90 0.03 145)' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'oklch(0.45 0.15 145 / 0.15)' }}>
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'oklch(0.45 0.15 145)' }} />
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: 'oklch(0.15 0 0)' }}>Analyzing Properties...</p>
                      <p className="text-sm" style={{ color: 'oklch(0.45 0 0)' }}>Running revenue analysis on {displayedProperties.length} properties</p>
                    </div>
                  </div>
                  <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'oklch(0.90 0.03 145)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, oklch(0.45 0.15 145), oklch(0.55 0.14 75))' }}
                      initial={{ width: '0%' }}
                      animate={{ width: `${batchProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-xs mt-2 text-center" style={{ color: 'oklch(0.55 0 0)' }}>
                    {Math.round(batchProgress)}% complete — this may take 30-60 seconds
                  </p>
                </motion.div>
              )}
              
              {/* Batch Results Panel */}
              <AnimatePresence>
                {showBatchResults && batchResults && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="rounded-xl overflow-hidden"
                    style={{ border: '2px solid oklch(0.55 0.14 75)', boxShadow: '0 8px 30px oklch(0.55 0.14 75 / 0.15)' }}
                  >
                    {/* Results Header */}
                    <div className="p-5" style={{ background: 'linear-gradient(135deg, oklch(0.20 0.02 75), oklch(0.25 0.03 75))' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'oklch(0.55 0.14 75 / 0.2)' }}>
                            <Trophy className="w-5 h-5" style={{ color: 'oklch(0.75 0.14 75)' }} />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">
                              {batchResults.totalAnalyzed > 20 ? 'Cumulative Analysis' : 'Batch Analysis Complete'}
                            </h3>
                            <p className="text-sm" style={{ color: 'oklch(0.80 0 0)' }}>
                              {batchResults.successCount} of {batchResults.totalAnalyzed} analyzed{batchResults.totalAnalyzed > 20 ? ' across multiple pages' : ''} in {batchResults.elapsedSeconds}s
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => { setShowBatchResults(false); setBatchResults(null); }}
                          className="p-2 rounded-lg transition-colors hover:bg-white/10"
                        >
                          <X className="w-5 h-5 text-white/70" />
                        </button>
                      </div>
                      
                      {/* Summary Stats */}
                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'oklch(0.30 0.04 145 / 0.5)' }}>
                          <CheckCircle2 className="w-5 h-5 mx-auto mb-1" style={{ color: 'oklch(0.70 0.15 145)' }} />
                          <p className="text-xl font-bold text-white">{batchResults.topDeals.length}</p>
                          <p className="text-xs" style={{ color: 'oklch(0.75 0 0)' }}>Top Deals</p>
                        </div>
                        <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'oklch(0.30 0.04 75 / 0.5)' }}>
                          <TrendingUp className="w-5 h-5 mx-auto mb-1" style={{ color: 'oklch(0.75 0.14 75)' }} />
                          <p className="text-xl font-bold text-white">{batchResults.successCount}</p>
                          <p className="text-xs" style={{ color: 'oklch(0.75 0 0)' }}>Analyzed</p>
                        </div>
                        <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'oklch(0.30 0.04 25 / 0.5)' }}>
                          {batchResults.failedCount > 0 ? (
                            <><AlertTriangle className="w-5 h-5 mx-auto mb-1" style={{ color: 'oklch(0.75 0.12 60)' }} />
                            <p className="text-xl font-bold text-white">{batchResults.failedCount}</p>
                            <p className="text-xs" style={{ color: 'oklch(0.75 0 0)' }}>Failed</p></>
                          ) : (
                            <><CheckCircle2 className="w-5 h-5 mx-auto mb-1" style={{ color: 'oklch(0.70 0.15 145)' }} />
                            <p className="text-xl font-bold text-white">0</p>
                            <p className="text-xs" style={{ color: 'oklch(0.75 0 0)' }}>Failed</p></>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Top Deals List */}
                    {batchResults.topDeals.length > 0 ? (
                      <div className="p-4" style={{ backgroundColor: 'oklch(0.99 0 0)' }}>
                        <h4 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'oklch(0.45 0 0)' }}>
                          Top Deals — ${profitThreshold.toLocaleString()}+/mo Profit
                        </h4>
                        <div className="space-y-3">
                          {batchResults.topDeals.map((deal, idx) => (
                            <motion.div
                              key={deal.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className="flex items-center gap-4 p-4 rounded-xl transition-all hover:shadow-md cursor-pointer"
                              style={{ 
                                backgroundColor: 'white',
                                border: idx === 0 ? '2px solid oklch(0.55 0.14 75)' : '1px solid oklch(0.92 0 0)',
                              }}
                              onClick={() => {
                                const el = document.querySelector(`[data-property-id="${deal.id}"]`);
                                if (el) {
                                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  // Flash highlight effect
                                  el.classList.add('ring-4', 'ring-yellow-400');
                                  setTimeout(() => el.classList.remove('ring-4', 'ring-yellow-400'), 2000);
                                }
                              }}
                            >
                              {/* Rank Badge */}
                              <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                                style={{ 
                                  backgroundColor: idx === 0 ? 'oklch(0.55 0.14 75)' : idx === 1 ? 'oklch(0.65 0.05 0)' : 'oklch(0.80 0.03 55)',
                                  color: idx <= 1 ? 'white' : 'oklch(0.30 0 0)',
                                }}
                              >
                                #{idx + 1}
                              </div>
                              
                              {/* Property Image */}
                              {deal.image && (
                                <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0">
                                  <img src={deal.image} alt="" className="w-full h-full object-cover" />
                                </div>
                              )}
                              
                              {/* Property Info */}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate" style={{ color: 'oklch(0.15 0 0)' }}>
                                  {deal.address}
                                </p>
                                <p className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>
                                  {deal.city}{deal.state ? `, ${deal.state}` : ''} • Rent: {formatCurrency(deal.rent)}/mo
                                </p>
                              </div>
                              
                              {/* Profit Info */}
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-lg" style={{ color: deal.monthlyProfit > 1000 ? 'oklch(0.45 0.15 145)' : 'oklch(0.55 0.12 85)' }}>
                                  +{formatCurrency(deal.monthlyProfit)}/mo
                                </p>
                                <div className="flex items-center gap-2 justify-end">
                                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ 
                                    backgroundColor: deal.occupancy >= 65 ? 'oklch(0.92 0.03 145)' : 'oklch(0.92 0.03 60)',
                                    color: deal.occupancy >= 65 ? 'oklch(0.35 0.12 145)' : 'oklch(0.40 0.10 60)',
                                  }}>
                                    {Math.round(deal.occupancy)}% occ
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ 
                                    backgroundColor: 'oklch(0.92 0.03 75)',
                                    color: 'oklch(0.40 0.10 75)',
                                  }}>
                                    {Math.round(deal.roi)}% ROI
                                  </span>
                                </div>
                              </div>
                              
                              {/* Scroll to property card */}
                              <div
                                className="p-2 rounded-lg transition-colors flex-shrink-0"
                                style={{ backgroundColor: 'oklch(0.96 0 0)' }}
                                title="Scroll to property analysis"
                              >
                                <ArrowDownToLine className="w-4 h-4" style={{ color: 'oklch(0.45 0 0)' }} />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                        
                        {/* Action buttons: Save Top Deals + Re-analyze */}
                        <div className="mt-4 flex flex-wrap justify-center gap-3">
                          <button
                            onClick={handleSaveTopDeals}
                            disabled={isSavingTopDeals || batchResults.topDeals.every(d => favoritesDbIds.has(d.id))}
                            className="text-sm px-5 py-2.5 rounded-lg transition-all font-medium flex items-center gap-2 disabled:opacity-50"
                            style={{ 
                              backgroundColor: batchResults.topDeals.every(d => favoritesDbIds.has(d.id)) ? 'oklch(0.92 0.03 145)' : 'oklch(0.55 0.14 75)',
                              color: batchResults.topDeals.every(d => favoritesDbIds.has(d.id)) ? 'oklch(0.35 0.12 145)' : 'white',
                            }}
                          >
                            {isSavingTopDeals ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving {savedTopDealsCount}/{batchResults.topDeals.length}...
                              </>
                            ) : batchResults.topDeals.every(d => favoritesDbIds.has(d.id)) ? (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                All Saved to Favorites
                              </>
                            ) : (
                              <>
                                <Bookmark className="w-4 h-4" />
                                Save All {batchResults.topDeals.length} Top Deals
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => { setShowBatchResults(false); setBatchResults(null); setSavedTopDealsCount(0); }}
                            className="text-sm px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
                            style={{ color: 'oklch(0.45 0 0)', backgroundColor: 'oklch(0.96 0 0)' }}
                          >
                            <RotateCcw className="w-4 h-4" />
                            Analyze Again
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center" style={{ backgroundColor: 'oklch(0.99 0 0)' }}>
                        <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: 'oklch(0.60 0.12 60)' }} />
                        <p className="font-medium" style={{ color: 'oklch(0.25 0 0)' }}>No Strong Deals Found</p>
                        <p className="text-sm mt-1" style={{ color: 'oklch(0.55 0 0)' }}>
                          None of the {batchResults.totalAnalyzed} properties hit your ${profitThreshold.toLocaleString()}/mo profit bar. Try lowering your threshold or searching a different market.
                        </p>
                        <button
                          onClick={() => { setShowBatchResults(false); setBatchResults(null); }}
                          className="mt-3 text-sm px-4 py-2 rounded-lg transition-colors"
                          style={{ color: 'oklch(0.45 0 0)', backgroundColor: 'oklch(0.96 0 0)' }}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          
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
          ) : filteredProperties.length === 0 && showBatchResults ? (
            <Card className="p-8 text-center" style={{ borderRadius: '1.25rem', border: '1px solid oklch(0.85 0.08 85)' }}>
              <Search className="w-12 h-12 mx-auto mb-4" style={{ color: 'oklch(0.55 0.12 85)' }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'oklch(0.15 0 0)' }}>
                No Deals Above ${profitThreshold.toLocaleString()}/mo
              </h3>
              <p className="mb-4" style={{ color: 'oklch(0.45 0 0)' }}>
                All {sortedProperties.length} properties were analyzed but none met your ${profitThreshold.toLocaleString()}/mo minimum profit threshold.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setProfitThreshold(500);
                  }}
                  className="text-sm"
                >
                  Lower to $500/mo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBatchResults(false);
                    setBatchResults(null);
                  }}
                  className="text-sm"
                >
                  Show All Properties
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedProperties.map((property, index) => {
                  const validation = validationResults[property.id];
                  const isValidating = validatingId === property.id;
                  const hasAnalysis = validation?.success && validation?.projection;
                  
                  // Calculate deal score if we have analysis
                  // For purchase mode, use cashOnCash from card-level calc instead of server ROI
                  const dealScore = hasAnalysis && validation.projection
                    ? calculateDealScore(
                        validation.projection.roi, 
                        validation.projection.monthlyProfit, 
                        validation.projection.occupancy,
                        searchType === 'forSale' ? 'purchase' : 'rent'
                      )
                    : null;
                  
                  // Calculate startup costs
                  const startupCosts = calculateStartupCosts(property.price, property.bedrooms ?? 2);
                  
                  return (
                    <motion.div
                      key={`${property.id}-${index}`}
                      data-property-id={property.id}
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
                              {property.bedrooms === 0 ? 'Studio' : property.bedrooms ? `${property.bedrooms} bed` : '— bed'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Bath className="w-3.5 h-3.5" />
                              {property.bathrooms ? `${property.bathrooms} bath` : '— bath'}
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
                              
                              {/* For Sale: Show comprehensive investor metrics */}
                              {searchType === 'forSale' ? (() => {
                                // Calculate investor metrics using property price and user's financing settings
                                const purchasePrice = property.price;
                                const downPaymentPercent = myProperty?.downPaymentPercent || 20;
                                const interestRate = myProperty?.interestRate || 7;
                                const loanType = myProperty?.loanType || 'conventional';
                                
                                // Calculate mortgage payment (30-year fixed)
                                const downPayment = purchasePrice * (downPaymentPercent / 100);
                                const loanAmount = purchasePrice - downPayment;
                                const monthlyRate = interestRate / 100 / 12;
                                const numPayments = 30 * 12;
                                const monthlyMortgage = loanType === 'cash' ? 0 : 
                                  loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                                  (Math.pow(1 + monthlyRate, numPayments) - 1);
                                
                                // Annual expenses
                                const annualMortgage = monthlyMortgage * 12;
                                const propertyTax = purchasePrice * 0.012;
                                const insurance = purchasePrice * 0.006;
                                const managementFee = validation.projection.annualRevenue * 0.20;
                                const maintenance = validation.projection.annualRevenue * 0.05;
                                const utilities = 250 * 12;
                                
                                // Cash flow calculation
                                const totalExpenses = annualMortgage + propertyTax + insurance + managementFee + maintenance + utilities;
                                const annualCashFlow = validation.projection.annualRevenue - totalExpenses;
                                const monthlyCashFlow = annualCashFlow / 12;
                                const monthlyTotalExpenses = totalExpenses / 12;
                                const monthlyRevenue = validation.projection.monthlyRevenue;
                                
                                // NOI (Net Operating Income) - before debt service
                                const operatingExpenses = propertyTax + insurance + managementFee + maintenance + utilities;
                                const noi = validation.projection.annualRevenue - operatingExpenses;
                                
                                // Investment metrics
                                const closingCosts = purchasePrice * 0.03;
                                const startupFurnishing = 8000 + ((property.bedrooms || 2) * 4000);
                                const totalCashInvested = downPayment + closingCosts + startupFurnishing;
                                const cashOnCashReturn = (annualCashFlow / totalCashInvested) * 100;
                                const capRate = (noi / purchasePrice) * 100;
                                
                                // Tax benefits
                                const taxBracket = 0.25;
                                const annualDepreciation = (purchasePrice * 0.85) / 27.5;
                                const mortgageInterestYear1 = loanAmount * (interestRate / 100) * 0.95;
                                const taxSavings = (annualDepreciation + mortgageInterestYear1 + operatingExpenses) * taxBracket;
                                const firstYearPrincipal = annualMortgage - mortgageInterestYear1;
                                const totalReturn = annualCashFlow + taxSavings + firstYearPrincipal;
                                const totalReturnPercent = (totalReturn / totalCashInvested) * 100;
                                
                                // Revenue vs Expenses bar proportions
                                const revenueBarWidth = 100;
                                const expenseBarWidth = Math.min((monthlyTotalExpenses / monthlyRevenue) * 100, 100);
                                const cashFlowPositive = monthlyCashFlow > 0;
                                
                                return (
                                <div>
                                  {/* === HERO: Monthly Cash Flow === */}
                                  <div 
                                    className="rounded-xl p-4 mb-3 text-center"
                                    style={{ 
                                      background: cashFlowPositive 
                                        ? 'linear-gradient(135deg, oklch(0.96 0.03 145), oklch(0.98 0.01 145))' 
                                        : 'linear-gradient(135deg, oklch(0.96 0.03 25), oklch(0.98 0.01 25))',
                                    }}
                                  >
                                    <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: cashFlowPositive ? 'oklch(0.45 0.12 145)' : 'oklch(0.50 0.12 25)' }}>
                                      Monthly Cash Flow
                                    </p>
                                    <p className="text-3xl font-black tracking-tight" style={{ color: cashFlowPositive ? 'oklch(0.35 0.15 145)' : 'oklch(0.45 0.18 25)' }}>
                                      {formatCurrency(monthlyCashFlow)}
                                    </p>
                                    <p className="text-[11px] mt-1" style={{ color: 'oklch(0.50 0 0)' }}>
                                      {formatCurrency(monthlyRevenue)}/mo revenue – {formatCurrency(monthlyTotalExpenses)}/mo expenses
                                    </p>
                                  </div>
                                  
                                  {/* === VISUAL: Revenue vs Expenses Bar === */}
                                  <div className="mb-3 px-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[10px] font-medium w-14" style={{ color: 'oklch(0.50 0 0)' }}>Revenue</span>
                                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'oklch(0.94 0 0)' }}>
                                        <div className="h-full rounded-full" style={{ width: `${revenueBarWidth}%`, backgroundColor: 'oklch(0.55 0.14 75)' }} />
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-medium w-14" style={{ color: 'oklch(0.50 0 0)' }}>Expenses</span>
                                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'oklch(0.94 0 0)' }}>
                                        <div className="h-full rounded-full" style={{ width: `${expenseBarWidth}%`, backgroundColor: expenseBarWidth >= 100 ? 'oklch(0.55 0.18 25)' : 'oklch(0.60 0.08 250)' }} />
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* === KEY METRICS: 3-column grid === */}
                                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                                    <div className="text-center p-2 rounded-lg" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                                      <p className="text-base font-bold" style={{ color: cashOnCashReturn > 8 ? 'oklch(0.40 0.15 145)' : cashOnCashReturn > 0 ? 'oklch(0.35 0 0)' : 'oklch(0.50 0.15 25)' }}>
                                        {cashOnCashReturn.toFixed(1)}%
                                      </p>
                                      <p className="text-[9px] uppercase tracking-wider font-medium" style={{ color: 'oklch(0.55 0 0)' }}>CoC Return</p>
                                    </div>
                                    <div className="text-center p-2 rounded-lg" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                                      <p className="text-base font-bold" style={{ color: capRate > 6 ? 'oklch(0.40 0.15 145)' : 'oklch(0.35 0 0)' }}>
                                        {capRate.toFixed(1)}%
                                      </p>
                                      <p className="text-[9px] uppercase tracking-wider font-medium" style={{ color: 'oklch(0.55 0 0)' }}>Cap Rate</p>
                                    </div>
                                    <div className="text-center p-2 rounded-lg" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                                      <p className="text-base font-bold" style={{ color: 'oklch(0.35 0 0)' }}>
                                        {Math.round(validation.projection.occupancy)}%
                                      </p>
                                      <p className="text-[9px] uppercase tracking-wider font-medium" style={{ color: 'oklch(0.55 0 0)' }}>Occupancy</p>
                                    </div>
                                  </div>
                                  
                                  {/* === QUICK STATS ROW === */}
                                  <div className="flex items-center justify-between text-[11px] px-1 mb-3 py-2" style={{ borderTop: '1px solid oklch(0.92 0 0)', borderBottom: '1px solid oklch(0.92 0 0)' }}>
                                    <div>
                                      <span style={{ color: 'oklch(0.55 0 0)' }}>ADR </span>
                                      <span className="font-semibold" style={{ color: 'oklch(0.30 0 0)' }}>{formatCurrency(validation.projection.adr)}</span>
                                    </div>
                                    <div>
                                      <span style={{ color: 'oklch(0.55 0 0)' }}>Annual </span>
                                      <span className="font-semibold" style={{ color: 'oklch(0.30 0 0)' }}>{formatCurrency(validation.projection.annualRevenue)}</span>
                                    </div>
                                    <div>
                                      <span style={{ color: 'oklch(0.55 0 0)' }}>Cash In </span>
                                      <span className="font-semibold" style={{ color: 'oklch(0.55 0.14 75)' }}>{formatCurrency(totalCashInvested)}</span>
                                    </div>
                                  </div>
                                  
                                  {/* === SINGLE EXPANDABLE: Full Breakdown === */}
                                  <details className="text-xs mb-3 group">
                                    <summary className="cursor-pointer font-medium py-1.5 flex items-center gap-1.5 select-none" style={{ color: 'oklch(0.40 0 0)' }}>
                                      <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                                      Full Investment Breakdown
                                    </summary>
                                    <div className="mt-2 space-y-3">
                                      {/* Cash to Close */}
                                      <div className="p-3 rounded-lg" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'oklch(0.50 0 0)' }}>Cash to Close</p>
                                        <div className="space-y-1.5">
                                          <div className="flex justify-between">
                                            <span style={{ color: 'oklch(0.50 0 0)' }}>Down Payment ({downPaymentPercent}%)</span>
                                            <span className="font-medium" style={{ color: 'oklch(0.30 0 0)' }}>{formatCurrency(downPayment)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span style={{ color: 'oklch(0.50 0 0)' }}>Closing Costs (3%)</span>
                                            <span className="font-medium" style={{ color: 'oklch(0.30 0 0)' }}>{formatCurrency(closingCosts)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span style={{ color: 'oklch(0.50 0 0)' }}>Furnishing</span>
                                            <span className="font-medium" style={{ color: 'oklch(0.30 0 0)' }}>{formatCurrency(startupFurnishing)}</span>
                                          </div>
                                          <div className="flex justify-between pt-1.5 mt-1" style={{ borderTop: '1px solid oklch(0.92 0 0)' }}>
                                            <span className="font-semibold" style={{ color: 'oklch(0.30 0 0)' }}>Total</span>
                                            <span className="font-bold" style={{ color: 'oklch(0.55 0.14 75)' }}>{formatCurrency(totalCashInvested)}</span>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Monthly Expenses */}
                                      <div className="p-3 rounded-lg" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'oklch(0.50 0 0)' }}>Monthly Expenses</p>
                                        <div className="space-y-1.5">
                                          {loanType !== 'cash' && (
                                            <div className="flex justify-between">
                                              <span style={{ color: 'oklch(0.50 0 0)' }}>Mortgage ({interestRate}%)</span>
                                              <span className="font-medium" style={{ color: 'oklch(0.30 0 0)' }}>{formatCurrency(monthlyMortgage)}</span>
                                            </div>
                                          )}
                                          <div className="flex justify-between">
                                            <span style={{ color: 'oklch(0.50 0 0)' }}>Property Tax (1.2%)</span>
                                            <span className="font-medium" style={{ color: 'oklch(0.30 0 0)' }}>{formatCurrency(propertyTax / 12)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span style={{ color: 'oklch(0.50 0 0)' }}>Insurance (0.6%)</span>
                                            <span className="font-medium" style={{ color: 'oklch(0.30 0 0)' }}>{formatCurrency(insurance / 12)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span style={{ color: 'oklch(0.50 0 0)' }}>Management (20%)</span>
                                            <span className="font-medium" style={{ color: 'oklch(0.30 0 0)' }}>{formatCurrency(managementFee / 12)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span style={{ color: 'oklch(0.50 0 0)' }}>Maintenance (5%)</span>
                                            <span className="font-medium" style={{ color: 'oklch(0.30 0 0)' }}>{formatCurrency(maintenance / 12)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span style={{ color: 'oklch(0.50 0 0)' }}>Utilities</span>
                                            <span className="font-medium" style={{ color: 'oklch(0.30 0 0)' }}>{formatCurrency(utilities / 12)}</span>
                                          </div>
                                          <div className="flex justify-between pt-1.5 mt-1" style={{ borderTop: '1px solid oklch(0.92 0 0)' }}>
                                            <span className="font-semibold" style={{ color: 'oklch(0.30 0 0)' }}>Total Monthly</span>
                                            <span className="font-bold" style={{ color: 'oklch(0.55 0.15 25)' }}>{formatCurrency(monthlyTotalExpenses)}</span>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Year 1 Total Return */}
                                      <div className="p-3 rounded-lg" style={{ backgroundColor: 'oklch(0.55 0.14 75 / 0.06)' }}>
                                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'oklch(0.50 0.10 75)' }}>Year 1 Total Return</p>
                                        <div className="space-y-1.5">
                                          <div className="flex justify-between">
                                            <span style={{ color: 'oklch(0.50 0 0)' }}>Cash Flow</span>
                                            <span className="font-medium" style={{ color: cashFlowPositive ? 'oklch(0.40 0.12 145)' : 'oklch(0.50 0.15 25)' }}>{formatCurrency(annualCashFlow)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span style={{ color: 'oklch(0.50 0 0)' }}>Tax Savings (est.)</span>
                                            <span className="font-medium" style={{ color: 'oklch(0.40 0.12 145)' }}>+{formatCurrency(taxSavings)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span style={{ color: 'oklch(0.50 0 0)' }}>Equity Buildup</span>
                                            <span className="font-medium" style={{ color: 'oklch(0.40 0.12 145)' }}>+{formatCurrency(firstYearPrincipal)}</span>
                                          </div>
                                          <div className="flex justify-between pt-1.5 mt-1" style={{ borderTop: '1px dashed oklch(0.80 0.08 75)' }}>
                                            <span className="font-semibold" style={{ color: 'oklch(0.30 0 0)' }}>Total Return</span>
                                            <span className="font-bold" style={{ color: 'oklch(0.40 0.15 145)' }}>{formatCurrency(totalReturn)} ({totalReturnPercent.toFixed(1)}%)</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </details>
                                </div>
                                );
                              })() : (
                              /* For Rent: Show Monthly Profit prominently (original behavior) */
                              <TooltipProvider>
                                <Tooltip delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <div className="text-center mb-4 pb-3 cursor-help" style={{ borderBottom: '1px solid oklch(0.90 0 0)' }}>
                                      <p className="text-xs font-medium mb-1 flex items-center justify-center gap-1" style={{ color: 'oklch(0.50 0 0)' }}>
                                        Estimated Monthly Profit
                                        <Info className="w-3 h-3" />
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
                                  </TooltipTrigger>
                                  <TooltipContent 
                                    side="bottom" 
                                    className="w-80 p-0"
                                    style={{ backgroundColor: 'white', border: '1px solid oklch(0.85 0 0)' }}
                                  >
                                    <div className="p-4">
                                      {/* Calculation Breakdown */}
                                      <div className="mb-4 pb-3" style={{ borderBottom: '1px solid oklch(0.92 0 0)' }}>
                                        <p className="text-xs font-semibold mb-2" style={{ color: 'oklch(0.35 0 0)' }}>How We Calculate This:</p>
                                        <div className="space-y-1 text-xs" style={{ color: 'oklch(0.45 0 0)' }}>
                                          <div className="flex justify-between">
                                            <span>Monthly Revenue</span>
                                            <span className="font-medium" style={{ color: 'oklch(0.35 0 0)' }}>{formatCurrency(validation.projection.monthlyRevenue)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>− Monthly Rent</span>
                                            <span className="font-medium" style={{ color: 'oklch(0.55 0.15 25)' }}>−{formatCurrency(property.price)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>− Operating Costs (20%)</span>
                                            <span className="font-medium" style={{ color: 'oklch(0.55 0.15 25)' }}>−{formatCurrency(validation.projection.operatingCosts)}</span>
                                          </div>
                                          <div className="flex justify-between pt-1 mt-1" style={{ borderTop: '1px dashed oklch(0.85 0 0)' }}>
                                            <span className="font-semibold">= Monthly Profit</span>
                                            <span className="font-bold" style={{ color: validation.projection.monthlyProfit > 0 ? 'oklch(0.45 0.15 145)' : 'oklch(0.55 0.20 25)' }}>
                                              {formatCurrency(validation.projection.monthlyProfit)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Investment Comparison */}
                                      <div>
                                        <p className="text-xs font-semibold mb-2" style={{ color: 'oklch(0.35 0 0)' }}>To Earn {formatCurrency(validation.projection.monthlyProfit)}/mo Elsewhere:</p>
                                        <div className="space-y-2 text-xs">
                                          <div className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                                            <div className="flex items-center gap-2">
                                              <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'oklch(0.55 0.15 250)', color: 'white' }}>S&P</div>
                                              <span style={{ color: 'oklch(0.45 0 0)' }}>S&P 500 (10%/yr)</span>
                                            </div>
                                            <span className="font-semibold" style={{ color: 'oklch(0.35 0 0)' }}>
                                              {formatCurrency(Math.round(validation.projection.monthlyProfit * 12 / 0.10))} invested
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                                            <div className="flex items-center gap-2">
                                              <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'oklch(0.55 0.12 145)', color: 'white' }}>$</div>
                                              <span style={{ color: 'oklch(0.45 0 0)' }}>HYSA (5%/yr)</span>
                                            </div>
                                            <span className="font-semibold" style={{ color: 'oklch(0.35 0 0)' }}>
                                              {formatCurrency(Math.round(validation.projection.monthlyProfit * 12 / 0.05))} saved
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                                            <div className="flex items-center gap-2">
                                              <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'oklch(0.55 0.14 75)', color: 'white' }}>R</div>
                                              <span style={{ color: 'oklch(0.45 0 0)' }}>Rental Property (8%/yr)</span>
                                            </div>
                                            <span className="font-semibold" style={{ color: 'oklch(0.35 0 0)' }}>
                                              {formatCurrency(Math.round(validation.projection.monthlyProfit * 12 / 0.08))} down
                                            </span>
                                          </div>
                                        </div>
                                        
                                        {/* The Kicker - Honest comparison */}
                                        <div className="mt-3 p-2 rounded-lg" style={{ backgroundColor: 'oklch(0.55 0.15 145 / 0.1)', border: '1px solid oklch(0.55 0.15 145 / 0.2)' }}>
                                          <p className="text-xs font-medium" style={{ color: 'oklch(0.35 0.10 145)' }}>
                                            STR startup: ~{formatCurrency(property.price * 3 + (property.bedrooms ?? 1) * 5000)} (deposit + furniture). Still far less than {formatCurrency(Math.round(validation.projection.monthlyProfit * 12 / 0.10))} for the same monthly return.
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              )}
                              
                              {/* Key Metrics - Compact Row - Only show for rentals */}
                              {searchType === 'forRent' && (
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
                              )}
                              
                              {/* Startup Costs (collapsed by default) - Only for rentals */}
                              {searchType === 'forRent' && (
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
                                    <span style={{ color: 'oklch(0.55 0 0)' }}>Security Deposit (1.5x)</span>
                                    <span style={{ color: 'oklch(0.25 0 0)' }}>{formatCurrency(startupCosts.deposit)}</span>
                                  </div>
                                  <div className="flex justify-between mb-1">
                                    <span style={{ color: 'oklch(0.55 0 0)' }}>Furnishing*</span>
                                    <span style={{ color: 'oklch(0.25 0 0)' }}>{formatCurrency(startupCosts.furnishing)}</span>
                                  </div>
                                  <div className="flex justify-between pt-1 font-semibold" style={{ borderTop: '1px solid oklch(0.90 0 0)' }}>
                                    <span style={{ color: 'oklch(0.35 0 0)' }}>Total Startup</span>
                                    <span style={{ color: 'oklch(0.55 0.14 75)' }}>{formatCurrency(startupCosts.total)}</span>
                                  </div>
                                  <p className="text-[10px] mt-2 text-center" style={{ color: 'oklch(0.60 0 0)' }}>
                                    *Furnishing estimate: $8K base + $4K/bedroom (industry average)
                                  </p>
                                </div>
                              </details>
                              )}
                              
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
                            // Before analysis - run BNB Calc analysis inline
                            <Button
                              onClick={() => handleValidate(property)}
                              disabled={isValidating}
                              className="w-full h-10 text-sm text-white"
                              style={{
                                backgroundColor: isValidating ? 'oklch(0.55 0.14 75 / 0.7)' : 'oklch(0.55 0.14 75)',
                                borderRadius: '980px',
                              }}
                            >
                              {isValidating ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
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
                            // After analysis - show action buttons with clean layout
                            <div className="space-y-2">
                              {/* Primary Action - Re-analyze or View Full Report */}
                              <Button
                                className="w-full h-11 text-xs font-semibold px-3 text-white"
                                style={{
                                  backgroundColor: 'oklch(0.55 0.14 75)',
                                  borderRadius: '0.75rem',
                                }}
                                onClick={() => handleValidate(property)}
                                disabled={isValidating}
                              >
                                {isValidating ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5 flex-shrink-0" />
                                    <span className="truncate">Re-analyzing...</span>
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                    <span className="truncate">Re-Analyze Property</span>
                                  </>
                                )}
                              </Button>
                              
                              {/* View Full Analysis - Navigate to Validate tab */}
                              <Button
                                className="w-full h-11 text-xs font-semibold px-3 text-white"
                                style={{
                                  backgroundColor: 'oklch(0.30 0.10 150)',
                                  borderRadius: '0.75rem',
                                }}
                                onClick={() => {
                                  if (onNavigateToValidate) {
                                    onNavigateToValidate({
                                      address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
                                      bedrooms: property.bedrooms || 1,
                                      bathrooms: property.bathrooms || 1,
                                      monthlyRent: property.price || 0,
                                    });
                                  }
                                }}
                              >
                                <Target className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                <span className="truncate">View Full Analysis</span>
                                <ArrowRight className="w-3.5 h-3.5 ml-1.5 flex-shrink-0" />
                              </Button>
                              {/* Secondary Action - View Listing */}
                              <a 
                                href={property.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <Button
                                  variant="outline"
                                  className="w-full h-9 text-xs font-medium border-slate-200 hover:bg-slate-50"
                                  style={{ 
                                    borderRadius: '0.75rem',
                                  }}
                                >
                                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                  View on Zillow
                                </Button>
                              </a>
                              
                              {/* Research Tools - Compact grid layout with tooltips */}
                              <div className="grid grid-cols-4 gap-0.5 pt-2 border-t border-slate-100">
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button 
                                        className="flex flex-col items-center py-2 text-slate-500 hover:text-amber-600 transition-colors w-full"
                                        onClick={() => {
                                          const toolData = {
                                            tab: 'explore',
                                            location: `${property.city}, ${property.state}`,
                                            bedrooms: property.bedrooms,
                                            address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
                                            timestamp: Date.now()
                                          };
                                          localStorage.setItem('autoToolData', JSON.stringify(toolData));
                                          window.location.href = '/?tab=explore';
                                        }}
                                      >
                                        <Users className="w-4 h-4 mb-0.5" />
                                        <span className="text-[9px] font-medium">Comps</span>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[200px] text-center">
                                      <p className="text-xs">See similar Airbnb listings in this area</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button 
                                        className="flex flex-col items-center py-2 text-slate-500 hover:text-amber-600 transition-colors w-full"
                                        onClick={() => {
                                          const toolData = {
                                            tab: 'map',
                                            location: `${property.city}, ${property.state}`,
                                            address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
                                            bedrooms: property.bedrooms,
                                            lat: property.latitude,
                                            lng: property.longitude,
                                            timestamp: Date.now()
                                          };
                                          localStorage.setItem('autoToolData', JSON.stringify(toolData));
                                          window.location.href = '/?tab=map';
                                        }}
                                      >
                                        <MapIcon className="w-4 h-4 mb-0.5" />
                                        <span className="text-[9px] font-medium">Map</span>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[200px] text-center">
                                      <p className="text-xs">View competition on a map around this property</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button 
                                        className="flex flex-col items-center py-2 text-slate-500 hover:text-amber-600 transition-colors w-full"
                                        onClick={() => {
                                          const toolData = {
                                            tab: 'prove',
                                            location: `${property.city}, ${property.state}`,
                                            bedrooms: property.bedrooms,
                                            address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
                                            zipCode: property.zipCode,
                                            timestamp: Date.now()
                                          };
                                          localStorage.setItem('autoToolData', JSON.stringify(toolData));
                                          window.location.href = '/?tab=prove';
                                        }}
                                      >
                                        <BarChart3 className="w-4 h-4 mb-0.5" />
                                        <span className="text-[9px] font-medium">Revenue</span>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[200px] text-center">
                                      <p className="text-xs">See actual revenue data from hosts in this market</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button 
                                        className="flex flex-col items-center py-2 text-slate-500 hover:text-amber-600 transition-colors w-full"
                                        onClick={() => {
                                          const toolData = {
                                            tab: 'ai',
                                            address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
                                            bedrooms: property.bedrooms,
                                            bathrooms: property.bathrooms,
                                            rent: property.price,
                                            location: `${property.city}, ${property.state}`,
                                            timestamp: Date.now()
                                          };
                                          localStorage.setItem('autoToolData', JSON.stringify(toolData));
                                          window.location.href = '/?tab=ai';
                                        }}
                                      >
                                        <Bot className="w-4 h-4 mb-0.5" />
                                        <span className="text-[9px] font-medium">Ask AI</span>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[200px] text-center">
                                      <p className="text-xs">Get AI insights about this specific property</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                

                              </div>
                              
                              {/* Save for Comparison Button */}
                              <div className="pt-2 mt-2 border-t border-slate-100">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-8 text-xs font-medium"
                                  style={{ 
                                    borderRadius: '0.75rem',
                                    borderColor: favorites.has(property.id) ? 'oklch(0.55 0.14 75)' : 'oklch(0.85 0 0)',
                                    backgroundColor: favorites.has(property.id) ? 'oklch(0.55 0.14 75 / 0.1)' : 'transparent',
                                    color: favorites.has(property.id) ? 'oklch(0.45 0.12 75)' : 'oklch(0.45 0 0)',
                                  }}
                                  onClick={() => toggleFavorite(property.id, property)}
                                >
                                  <Heart 
                                    className="w-3.5 h-3.5 mr-1.5" 
                                    fill={favorites.has(property.id) ? 'currentColor' : 'none'}
                                  />
                                  {favorites.has(property.id) ? 'Saved for Comparison' : 'Save for Comparison'}
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
              
              {/* Infinite scroll: loading skeleton cards */}
              {isLoadingMore && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={`skeleton-${i}`} className="overflow-hidden animate-pulse" style={{ borderRadius: '1.25rem' }}>
                      <div className="h-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                      <CardContent className="p-4 space-y-3">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                        <div className="flex gap-2">
                          <div className="h-6 bg-gray-200 rounded w-16" />
                          <div className="h-6 bg-gray-200 rounded w-16" />
                          <div className="h-6 bg-gray-200 rounded w-16" />
                        </div>
                        <div className="h-10 bg-gray-100 rounded w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              {/* Infinite scroll sentinel — triggers auto-load when visible */}
              {hasMore && !isLoadingMore && (
                <div ref={sentinelRef} className="h-4" />
              )}
              
              {/* Admin: Load More & Auto-Analyze button */}
              {isAdmin && hasMore && !isLoadingMore && (
                <div className="mt-4 text-center">
                  <Button
                    onClick={handleLoadMoreAndAnalyze}
                    disabled={isLoadingMore || isBatchAnalyzing}
                    className="px-8 py-3 text-base font-semibold"
                    style={{
                      background: 'linear-gradient(135deg, oklch(0.45 0.15 145), oklch(0.55 0.14 75))',
                      borderRadius: '980px',
                      color: 'white',
                    }}
                  >
                    {isBatchAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 mr-2" />
                        Load More & Auto-Analyze
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {/* End of results indicator */}
              {!hasMore && sortedProperties.length > 0 && (
                <div className="mt-6 text-center py-4">
                  <p className="text-sm" style={{ color: 'oklch(0.55 0 0)' }}>
                    All {sortedProperties.length} loaded properties shown{totalResults > sortedProperties.length && ` of ${totalResults.toLocaleString()} in market`}
                  </p>
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
            <div className="relative overflow-hidden">
              {/* Main Image */}
              <div className="relative h-[60vh] bg-black flex items-center justify-center overflow-hidden">
                <img
                  src={photoGalleryProperty.photos[currentPhotoIndex]}
                  alt={`${photoGalleryProperty.address} - Photo ${currentPhotoIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
                
                {/* Navigation Arrows - Fixed z-index and larger buttons for visibility */}
                {photoGalleryProperty.photos.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentPhotoIndex(prev => prev === 0 ? photoGalleryProperty.photos.length - 1 : prev - 1)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 z-50 shadow-lg"
                      style={{ backgroundColor: 'oklch(0.98 0 0 / 0.95)' }}
                    >
                      <ChevronLeft className="w-7 h-7" style={{ color: 'oklch(0.25 0 0)' }} />
                    </button>
                    <button
                      onClick={() => setCurrentPhotoIndex(prev => prev === photoGalleryProperty.photos.length - 1 ? 0 : prev + 1)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 z-50 shadow-lg"
                      style={{ backgroundColor: 'oklch(0.98 0 0 / 0.95)' }}
                    >
                      <ChevronRight className="w-7 h-7" style={{ color: 'oklch(0.25 0 0)' }} />
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
                  <span>{photoGalleryProperty.bedrooms === 0 ? 'Studio' : photoGalleryProperty.bedrooms ? `${photoGalleryProperty.bedrooms} bed` : '— bed'}</span>
                  <span>{photoGalleryProperty.bathrooms ? `${photoGalleryProperty.bathrooms} bath` : '— bath'}</span>
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
