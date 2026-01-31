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

import { useState, useEffect } from 'react';
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
  RotateCcw
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
  initialLocation?: string; // For pre-filling from URL params (HubSpot emails)
  onLocationChange?: (location: { city?: string; state?: string }) => void;
  initialCity?: string;
  initialState?: string;
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

export default function OpportunityFinderStep({ onSelectProperty, initialLocation, onLocationChange, initialCity, initialState }: OpportunityFinderStepProps) {
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
  const [pageSize, setPageSize] = useState<number>(20); // 20, 50, or 100 per page
  
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
      
      const newProperties = append 
        ? [...properties, ...result.properties]
        : result.properties;
      
      if (append) {
        setProperties(prev => [...prev, ...result.properties]);
        // When appending, only update totalResults if the new value is greater
        // This prevents the "32 of 0" issue when API returns 0 on subsequent pages
        setTotalResults(prev => result.totalResults > 0 ? result.totalResults : prev);
      } else {
        setProperties(result.properties);
        setTotalResults(result.totalResults);
      }
      setHasMore(result.hasMore || false);
      setCurrentPage(page);
      
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
    setDisplayPage(1);
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
        bedrooms: property.bedrooms || 2,
        bathrooms: property.bathrooms || 1,
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
          bedrooms: property.bedrooms || 2,
          bathrooms: property.bathrooms || 1,
          monthlyRent: property.price,
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
  
  // Client-side pagination state for viewing loaded results
  const [displayPage, setDisplayPage] = useState(1);
  
  // Calculate pagination values
  const totalPages = Math.ceil(sortedProperties.length / pageSize);
  const startIndex = (displayPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const displayedProperties = sortedProperties.slice(startIndex, endIndex);
  
  // Reset display page when properties change significantly
  useEffect(() => {
    if (displayPage > totalPages && totalPages > 0) {
      setDisplayPage(totalPages);
    }
  }, [sortedProperties.length, pageSize, displayPage, totalPages]);
  
  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (displayPage > 3) {
        pages.push('ellipsis');
      }
      
      // Show pages around current page
      const start = Math.max(2, displayPage - 1);
      const end = Math.min(totalPages - 1, displayPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (displayPage < totalPages - 2) {
        pages.push('ellipsis');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  };
  
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
          {/* Results Header with Sorting, Per-Page Selector, and Pagination */}
          <div className="flex flex-col gap-4">
            {/* Top Row: Count and Controls */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <p className="text-sm" style={{ color: 'oklch(0.45 0 0)' }}>
                {isSearching ? (
                  'Searching...'
                ) : (
                  <>
                    Showing <span className="font-semibold" style={{ color: 'oklch(0.15 0 0)' }}>{startIndex + 1}-{Math.min(endIndex, sortedProperties.length)}</span> of <span className="font-semibold" style={{ color: 'oklch(0.15 0 0)' }}>{totalResults > 0 ? totalResults : sortedProperties.length}</span> properties
                  </>
                )}
              </p>
              
              {/* Controls Row */}
              {sortedProperties.length > 0 && (
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Per-Page Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>Show:</span>
                    <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setDisplayPage(1); }}>
                      <SelectTrigger className="w-[80px] h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Sorting Dropdown */}
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
                </div>
              )}
            </div>
            
            {/* Pagination Controls - At Top */}
            {sortedProperties.length > 0 && (totalPages > 1 || hasMore) && (
              <div className="flex items-center justify-center gap-3 py-2 px-4 rounded-xl" style={{ backgroundColor: 'oklch(0.97 0 0)', border: '1px solid oklch(0.92 0 0)' }}>
                {/* Previous Button */}
                <Button
                  onClick={() => setDisplayPage(Math.max(1, displayPage - 1))}
                  disabled={displayPage === 1}
                  variant="outline"
                  size="sm"
                  className="px-3"
                  style={{ borderRadius: '8px' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((page, index) => (
                    page === 'ellipsis' ? (
                      <span key={`ellipsis-${index}`} className="px-2 text-sm" style={{ color: 'oklch(0.55 0 0)' }}>...</span>
                    ) : (
                      <Button
                        key={page}
                        onClick={() => setDisplayPage(page)}
                        variant={displayPage === page ? 'default' : 'outline'}
                        size="sm"
                        className="w-9 h-9 p-0"
                        style={{ 
                          borderRadius: '8px',
                          backgroundColor: displayPage === page ? 'oklch(0.55 0.14 75)' : undefined,
                        }}
                      >
                        {page}
                      </Button>
                    )
                  ))}
                </div>
                
                {/* Next Button - Auto-loads more when at end of loaded results */}
                <Button
                  onClick={() => {
                    const nextDisplayPage = displayPage + 1;
                    if (nextDisplayPage > totalPages && hasMore) {
                      // Need to load more data from API
                      handleLoadMore();
                      // After loading, we'll be on the new page
                    } else if (nextDisplayPage <= totalPages) {
                      setDisplayPage(nextDisplayPage);
                    }
                  }}
                  disabled={displayPage === totalPages && !hasMore}
                  variant="outline"
                  size="sm"
                  className="px-3"
                  style={{ borderRadius: '8px' }}
                >
                  {isLoadingMore ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
                
                {/* Page Info */}
                <span className="text-xs ml-2" style={{ color: 'oklch(0.55 0 0)' }}>
                  Page {displayPage} of {hasMore ? `${totalPages}+` : totalPages}
                </span>
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
                {displayedProperties.map((property, index) => {
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
                      key={`${property.id}-${index}`}
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
                                const propertyTax = purchasePrice * 0.012; // ~1.2% of purchase price
                                const insurance = purchasePrice * 0.005; // ~0.5% of purchase price
                                const managementFee = validation.projection.annualRevenue * 0.20; // 20% management
                                const maintenance = validation.projection.annualRevenue * 0.05; // 5% maintenance reserve
                                const utilities = 200 * 12; // $200/month utilities estimate
                                
                                // Cash flow calculation
                                const totalExpenses = annualMortgage + propertyTax + insurance + managementFee + maintenance + utilities;
                                const annualCashFlow = validation.projection.annualRevenue - totalExpenses;
                                const monthlyCashFlow = annualCashFlow / 12;
                                
                                // NOI (Net Operating Income) - before debt service
                                const operatingExpenses = propertyTax + insurance + managementFee + maintenance + utilities;
                                const noi = validation.projection.annualRevenue - operatingExpenses;
                                
                                // Investment metrics
                                const closingCosts = purchasePrice * 0.03; // ~3% closing costs
                                const startupCosts = 8000 + (property.bedrooms * 4000); // Furnishing
                                const totalCashInvested = downPayment + closingCosts + startupCosts;
                                const cashOnCashReturn = (annualCashFlow / totalCashInvested) * 100;
                                const capRate = (noi / purchasePrice) * 100;
                                
                                // Tax benefits (simplified - assumes 25% tax bracket)
                                const taxBracket = 0.25;
                                const annualDepreciation = (purchasePrice * 0.85) / 27.5; // Building value / 27.5 years
                                const mortgageInterestYear1 = loanAmount * (interestRate / 100) * 0.95; // Approximate first year interest
                                const taxDeductions = annualDepreciation + mortgageInterestYear1 + operatingExpenses;
                                const taxSavings = taxDeductions * taxBracket;
                                
                                // Equity buildup (first year principal paydown)
                                const firstYearPrincipal = annualMortgage - mortgageInterestYear1;
                                
                                // Total return
                                const totalReturn = annualCashFlow + taxSavings + firstYearPrincipal;
                                const totalReturnPercent = (totalReturn / totalCashInvested) * 100;
                                
                                return (
                                <div className="mb-4">
                                  {/* Annual Revenue - Hero metric */}
                                  <div className="text-center mb-4 pb-3" style={{ borderBottom: '1px solid oklch(0.90 0 0)' }}>
                                    <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'oklch(0.55 0.14 75)' }}>
                                      Projected Annual Revenue
                                    </p>
                                    <p 
                                      className="text-4xl font-black"
                                      style={{ 
                                        color: 'oklch(0.35 0.12 75)',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                      }}
                                    >
                                      {formatCurrency(validation.projection.annualRevenue)}
                                    </p>
                                    <p className="text-sm font-medium mt-1" style={{ color: 'oklch(0.45 0 0)' }}>
                                      {formatCurrency(validation.projection.monthlyRevenue)}/month • {Math.round(validation.projection.occupancy)}% occ • {formatCurrency(validation.projection.adr)}/night
                                    </p>
                                  </div>
                                  
                                  {/* Cash Flow - The key metric for investors */}
                                  <div className="text-center mb-3 p-3 rounded-lg" style={{ backgroundColor: annualCashFlow > 0 ? 'oklch(0.55 0.15 145 / 0.08)' : 'oklch(0.55 0.20 25 / 0.08)' }}>
                                    <p className="text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: annualCashFlow > 0 ? 'oklch(0.45 0.15 145)' : 'oklch(0.50 0.15 25)' }}>
                                      Annual Cash Flow
                                    </p>
                                    <p 
                                      className="text-2xl font-bold"
                                      style={{ color: annualCashFlow > 0 ? 'oklch(0.40 0.15 145)' : 'oklch(0.50 0.20 25)' }}
                                    >
                                      {formatCurrency(annualCashFlow)}
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: 'oklch(0.50 0 0)' }}>
                                      {formatCurrency(monthlyCashFlow)}/month after all expenses
                                    </p>
                                  </div>
                                  
                                  {/* Return Metrics Grid */}
                                  <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div className="p-2 rounded-lg text-center" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                                      <p className="text-lg font-bold" style={{ color: cashOnCashReturn > 10 ? 'oklch(0.45 0.15 145)' : 'oklch(0.35 0 0)' }}>
                                        {cashOnCashReturn.toFixed(1)}%
                                      </p>
                                      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'oklch(0.55 0 0)' }}>Cash-on-Cash</p>
                                    </div>
                                    <div className="p-2 rounded-lg text-center" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                                      <p className="text-lg font-bold" style={{ color: capRate > 8 ? 'oklch(0.45 0.15 145)' : 'oklch(0.35 0 0)' }}>
                                        {capRate.toFixed(1)}%
                                      </p>
                                      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'oklch(0.55 0 0)' }}>Cap Rate</p>
                                    </div>
                                  </div>
                                  
                                  {/* Tax Benefits & Total Return */}
                                  <details className="text-xs mb-3">
                                    <summary className="cursor-pointer font-medium py-1 flex items-center gap-1" style={{ color: 'oklch(0.45 0 0)' }}>
                                      <ChevronDown className="w-3 h-3" />
                                      View Tax Benefits & Total Return
                                    </summary>
                                    <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                                      <div className="space-y-2">
                                        <div className="flex justify-between">
                                          <span style={{ color: 'oklch(0.55 0 0)' }}>Annual Depreciation</span>
                                          <span className="font-medium" style={{ color: 'oklch(0.35 0 0)' }}>{formatCurrency(annualDepreciation)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span style={{ color: 'oklch(0.55 0 0)' }}>Est. Tax Savings (25% bracket)</span>
                                          <span className="font-medium" style={{ color: 'oklch(0.45 0.15 145)' }}>+{formatCurrency(taxSavings)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span style={{ color: 'oklch(0.55 0 0)' }}>Equity Buildup (Yr 1)</span>
                                          <span className="font-medium" style={{ color: 'oklch(0.45 0.15 145)' }}>+{formatCurrency(firstYearPrincipal)}</span>
                                        </div>
                                        <div className="flex justify-between pt-2 mt-2" style={{ borderTop: '1px dashed oklch(0.85 0 0)' }}>
                                          <span className="font-semibold" style={{ color: 'oklch(0.35 0 0)' }}>Total Return (Yr 1)</span>
                                          <span className="font-bold" style={{ color: 'oklch(0.45 0.15 145)' }}>{formatCurrency(totalReturn)} ({totalReturnPercent.toFixed(1)}%)</span>
                                        </div>
                                      </div>
                                    </div>
                                  </details>
                                  
                                  {/* Investment Breakdown */}
                                  <details className="text-xs mb-3">
                                    <summary className="cursor-pointer font-medium py-1 flex items-center gap-1" style={{ color: 'oklch(0.45 0 0)' }}>
                                      <ChevronDown className="w-3 h-3" />
                                      View Investment Breakdown
                                    </summary>
                                    <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                                      <p className="text-xs font-semibold mb-2" style={{ color: 'oklch(0.35 0 0)' }}>Cash Needed to Close:</p>
                                      <div className="space-y-1 mb-3">
                                        <div className="flex justify-between">
                                          <span style={{ color: 'oklch(0.55 0 0)' }}>Down Payment ({downPaymentPercent}%)</span>
                                          <span style={{ color: 'oklch(0.35 0 0)' }}>{formatCurrency(downPayment)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span style={{ color: 'oklch(0.55 0 0)' }}>Closing Costs (~3%)</span>
                                          <span style={{ color: 'oklch(0.35 0 0)' }}>{formatCurrency(closingCosts)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span style={{ color: 'oklch(0.55 0 0)' }}>Furnishing</span>
                                          <span style={{ color: 'oklch(0.35 0 0)' }}>{formatCurrency(startupCosts)}</span>
                                        </div>
                                        <div className="flex justify-between pt-1 font-semibold" style={{ borderTop: '1px solid oklch(0.90 0 0)' }}>
                                          <span style={{ color: 'oklch(0.35 0 0)' }}>Total Cash Needed</span>
                                          <span style={{ color: 'oklch(0.55 0.14 75)' }}>{formatCurrency(totalCashInvested)}</span>
                                        </div>
                                      </div>
                                      
                                      <p className="text-xs font-semibold mb-2 pt-2" style={{ color: 'oklch(0.35 0 0)', borderTop: '1px dashed oklch(0.85 0 0)' }}>Monthly Expenses:</p>
                                      <div className="space-y-1">
                                        {loanType !== 'cash' && (
                                          <div className="flex justify-between">
                                            <span style={{ color: 'oklch(0.55 0 0)' }}>Mortgage ({interestRate}%)</span>
                                            <span style={{ color: 'oklch(0.35 0 0)' }}>{formatCurrency(monthlyMortgage)}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between">
                                          <span style={{ color: 'oklch(0.55 0 0)' }}>Property Tax</span>
                                          <span style={{ color: 'oklch(0.35 0 0)' }}>{formatCurrency(propertyTax / 12)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span style={{ color: 'oklch(0.55 0 0)' }}>Insurance</span>
                                          <span style={{ color: 'oklch(0.35 0 0)' }}>{formatCurrency(insurance / 12)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span style={{ color: 'oklch(0.55 0 0)' }}>Management (20%)</span>
                                          <span style={{ color: 'oklch(0.35 0 0)' }}>{formatCurrency(managementFee / 12)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span style={{ color: 'oklch(0.55 0 0)' }}>Maintenance (5%)</span>
                                          <span style={{ color: 'oklch(0.35 0 0)' }}>{formatCurrency(maintenance / 12)}</span>
                                        </div>
                                        <div className="flex justify-between pt-1 font-semibold" style={{ borderTop: '1px solid oklch(0.90 0 0)' }}>
                                          <span style={{ color: 'oklch(0.35 0 0)' }}>Total Monthly</span>
                                          <span style={{ color: 'oklch(0.55 0.15 25)' }}>{formatCurrency(totalExpenses / 12)}</span>
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
                                              <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'oklch(0.55 0.14 75)', color: 'white' }}>🏠</div>
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
                                            💡 STR startup: ~{formatCurrency(property.price * 3 + (property.bedrooms || 1) * 5000)} (deposit + furniture). Still far less than {formatCurrency(Math.round(validation.projection.monthlyProfit * 12 / 0.10))} for the same monthly return.
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
                            // After analysis - show action buttons with clean layout
                            <div className="space-y-2">
                              {/* Primary Action - Deep Analysis (full width) */}
                              <Button
                                className="w-full h-11 text-xs font-semibold px-3"
                                style={{
                                  backgroundColor: 'oklch(0.55 0.14 75)',
                                  borderRadius: '0.75rem',
                                }}
                                onClick={() => {
                                  // Store auto-analyze intent in localStorage
                                  const autoAnalyzeData = {
                                    address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
                                    bedrooms: property.bedrooms,
                                    bathrooms: property.bathrooms,
                                    rent: property.price,
                                    timestamp: Date.now()
                                  };
                                  localStorage.setItem('autoAnalyzeProperty', JSON.stringify(autoAnalyzeData));
                                  // Navigate to validate tab
                                  window.location.href = `/?tab=validate`;
                                }}
                              >
                                <Microscope className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                <span className="truncate">Full Analysis</span>
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
                              <div className="grid grid-cols-5 gap-0.5 pt-2 border-t border-slate-100">
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
                                
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button 
                                        className="flex flex-col items-center py-2 text-slate-500 hover:text-amber-600 transition-colors w-full"
                                        onClick={() => {
                                          const toolData = {
                                            tab: 'market-advisor',
                                            location: `${property.city}, ${property.state}`,
                                            address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
                                            zipCode: property.zipCode,
                                            timestamp: Date.now()
                                          };
                                          localStorage.setItem('autoToolData', JSON.stringify(toolData));
                                          window.location.href = '/?tab=market-advisor';
                                        }}
                                      >
                                        <TrendingUp className="w-4 h-4 mb-0.5" />
                                        <span className="text-[9px] font-medium">Trends</span>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[200px] text-center">
                                      <p className="text-xs">See market trends and investment outlook for this area</p>
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
