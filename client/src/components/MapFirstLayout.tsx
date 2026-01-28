/**
 * MapFirstLayout - A map-centric redesign of the property explorer
 * 
 * Features:
 * - Full-height map as the hero element
 * - Unified floating search bar (accepts zip, city, or address)
 * - Collapsible floating panels for filters and controls
 * - Compact stats overlay
 * - All original functionality preserved
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useProperty } from '@/contexts/PropertyContext';
import { trpc } from '@/lib/trpc';
import { MapView } from '@/components/Map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  MapPin,
  Home,
  DollarSign,
  BedDouble,
  Filter,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Star,
  ExternalLink,
  Maximize2,
  Minimize2,
  Navigation,
  Info,
  Map,
  Building2,
  Hash,
  Layers,
  Settings2,
  Table2,
  ChevronLeft,
  ChevronRight,
  Waves,
  Thermometer,
  PawPrint,
  Car,
  UtensilsCrossed,
  WashingMachine,
  Check,
  Download,
} from 'lucide-react';
import { LoadingProgress } from '@/components/LoadingProgress';
import { ExportListings } from '@/components/ExportListings';
import { VirtualizedTable } from '@/components/VirtualizedTable';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Types
interface Listing {
  id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  revenue: number;
  occupancy: number;
  adr: number;
  rating: number | null;
  reviews: number;
  latitude: number;
  longitude: number;
  airbnbUrl: string;
  thumbnailUrl?: string;
  propertyType?: string;
  distanceToMyProperty?: number;
}

interface ThresholdData {
  high: number;
  low: number;
  average: number;
  topCount: number;
  middleCount: number;
  bottomCount: number;
}

interface MyPropertyData {
  address: string;
  bedrooms: number;
  bathrooms: number;
  zipCode?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

interface MapFirstLayoutProps {
  embedded?: boolean;
  className?: string;
  myProperty?: MyPropertyData | null;
}

// Utility functions
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDistance = (miles: number) => {
  if (miles < 0.1) return '< 0.1 mi';
  return `${miles.toFixed(1)} mi`;
};

const getMarkerColor = (revenue: number, thresholds: ThresholdData, customThreshold: number | null) => {
  if (customThreshold !== null) {
    return revenue >= customThreshold ? '#22c55e' : '#94a3b8';
  }
  if (revenue >= thresholds.high) return '#22c55e'; // green
  if (revenue >= thresholds.low) return '#f59e0b'; // amber
  return '#ef4444'; // red
};

const createMarkerElement = (color: string, revenue: number) => {
  const el = document.createElement('div');
  el.innerHTML = `
    <div style="
      width: 32px;
      height: 32px;
      background: ${color};
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 10px;
      font-weight: 600;
      color: white;
    ">
      $${Math.round(revenue / 1000)}k
    </div>
  `;
  return el.firstElementChild as HTMLElement;
};

const ITEMS_PER_PAGE = 20;

export default function MapFirstLayout({ embedded = false, className = '', myProperty }: MapFirstLayoutProps) {
  // DEBUG: Log component render
  console.warn('[MapFirstLayout] RENDER - myProperty:', myProperty?.address, 'embedded:', embedded);
  
  // PropertyContext integration
  const { myProperty: contextProperty, hasProperty: contextHasProperty } = useProperty();
  console.warn('[MapFirstLayout] Context - contextProperty:', contextProperty?.address, 'contextHasProperty:', contextHasProperty);
  
  // Load property from localStorage as fallback (for initial render before context is ready)
  const [localStorageProperty, setLocalStorageProperty] = useState<MyPropertyData | null>(() => {
    try {
      const stored = localStorage.getItem('myProperty');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed;
      }
    } catch (e) {
      console.error('[MapFirstLayout] Error loading from localStorage:', e);
    }
    return null;
  });
  
  // Combined hasProperty check - use context first, then localStorage fallback
  const hasProperty = contextHasProperty || (localStorageProperty !== null && localStorageProperty.address?.length > 0);
  
  // Get the effective property data (context takes precedence, then prop, then localStorage)
  const effectiveProperty = contextProperty || myProperty || localStorageProperty;
  
  // Check for URL parameter to force auto-search (for testing)
  const urlParams = new URLSearchParams(window.location.search);
  const forceAutoSearch = urlParams.get('autoSearch');
  
  // Search state - initialize from property if available
  const [searchQuery, setSearchQuery] = useState(() => {
    // If forceAutoSearch URL param is set, use it
    if (forceAutoSearch) {
      return forceAutoSearch;
    }
    // Try to get initial search term from property
    const property = contextProperty || myProperty || localStorageProperty;
    
    // First try to use the city field if available
    if (property?.city && property?.state) {
      return `${property.city}, ${property.state}`;
    }
    
    // Fall back to parsing the address
    if (property?.address) {
      const addressParts = property.address.split(',').map((p: string) => p.trim());
      
      // Handle "City, State Zip, Country" format (3 parts)
      if (addressParts.length === 3) {
        const city = addressParts[0];
        const stateZip = addressParts[1];
        const stateMatch = stateZip.match(/^([A-Z]{2})/);
        if (stateMatch) {
          return `${city}, ${stateMatch[1]}`;
        }
        return city;
      }
      
      // Handle "Street, City, State Zip, Country" format (4+ parts)
      if (addressParts.length >= 4) {
        const city = addressParts[1];
        const stateZip = addressParts[2];
        const stateMatch = stateZip.match(/^([A-Z]{2})/);
        if (stateMatch) {
          return `${city}, ${stateMatch[1]}`;
        }
        return city;
      }
    }
    return '';
  });
  console.warn('[MapFirstLayout] Initial searchQuery:', searchQuery);
  
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasAutoLoadedListings, setHasAutoLoadedListings] = useState(false);
  
  // Location state
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [locationName, setLocationName] = useState('');
  
  // Listings state
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [bedroomFilter, setBedroomFilter] = useState<string>('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('all');
  const [distanceFilter, setDistanceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('revenue-desc');
  const [apiBedroomFilter, setApiBedroomFilter] = useState<number | null>(null);
  
  // Amenities filter state
  const [amenitiesFilter, setAmenitiesFilter] = useState<{
    pool: boolean;
    hotTub: boolean;
    petFriendly: boolean;
    parking: boolean;
    kitchen: boolean;
    washerDryer: boolean;
  }>({
    pool: false,
    hotTub: false,
    petFriendly: false,
    parking: false,
    kitchen: false,
    washerDryer: false,
  });
  
  // Threshold state
  const [useCustomThreshold, setUseCustomThreshold] = useState(false);
  const [customThreshold, setCustomThreshold] = useState(50000);
  
  // My Property state
  const [myPropertyAddress, setMyPropertyAddress] = useState('');
  const [myPropertyLocation, setMyPropertyLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [isGeocodingMyProperty, setIsGeocodingMyProperty] = useState(false);
  const [myPropertyError, setMyPropertyError] = useState<string | null>(null);
  
  // UI state
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showThresholdsPanel, setShowThresholdsPanel] = useState(false);
  const [showMyPropertyPanel, setShowMyPropertyPanel] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [markerLibraryReady, setMarkerLibraryReady] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [excludedListingIds, setExcludedListingIds] = useState<Set<string>>(new Set());
  const [showCompSetMode, setShowCompSetMode] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  
  // Loading progress state
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [useVirtualizedTable, setUseVirtualizedTable] = useState(false);
  
  
  // Refs
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasAutoLoadedRef = useRef(false); // Ref to avoid stale closure in debounced search
  const listingsRef = useRef(listings); // Ref to track current listings for debounced callback
  const selectedLocationRef = useRef(selectedLocation); // Ref to track current selectedLocation for debounced callback
  
  // Keep refs in sync with state
  useEffect(() => {
    listingsRef.current = listings;
  }, [listings]);
  
  useEffect(() => {
    selectedLocationRef.current = selectedLocation;
  }, [selectedLocation]);
  
  // Calculate bedroom counts from listings
  const bedroomCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: listings.length,
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0, // 5+ bedrooms
    };
    
    listings.forEach(listing => {
      const br = listing.bedrooms;
      if (br === 1) counts['1']++;
      else if (br === 2) counts['2']++;
      else if (br === 3) counts['3']++;
      else if (br === 4) counts['4']++;
      else if (br >= 5) counts['5']++;
    });
    
    return counts;
  }, [listings]);
  
  // Track if we've already attempted auto-search for this component instance
  const hasAttemptedAutoSearch = useRef(false);
  
  // Auto-search effect that runs when the component mounts with a search query
  // This handles the case where the user clicks "See on Map" from their property card
  useEffect(() => {
    const performAutoSearch = async () => {
      // Only attempt auto-search once per component instance
      if (hasAttemptedAutoSearch.current) {
        return;
      }
      
      // Only run if we have a search query
      if (!searchQuery || searchQuery.length < 2) {
        return;
      }
      
      // Check current state using refs to avoid stale closures
      if (listingsRef.current.length > 0 || selectedLocationRef.current) {
        return;
      }
      
      // Mark that we've attempted auto-search
      hasAttemptedAutoSearch.current = true;
      
      // Mark that we're doing auto-search to prevent the debounced search from showing dropdown
      hasAutoLoadedRef.current = true;
      setHasAutoLoadedListings(true);
      
      try {
        // Extract just the city name for API compatibility
        const searchTerm = searchQuery.split(',')[0].trim();
        
        const response = await searchMarketsAsync(searchTerm);
        const results = Array.isArray(response) ? response : ((response as any)?.data || response || []);
        
        if (results.length > 0) {
          // Find the best match
          const searchTermLower = searchQuery.toLowerCase().split(',')[0].trim();
          const exactMatch = results.find((r: any) => 
            r.name?.toLowerCase().includes(searchTermLower)
          );
          const selectedResult = exactMatch || results[0];
          
          // Auto-select and fetch listings
          setSelectedLocation(selectedResult);
          setLocationName(selectedResult.name);
          setShowSearchResults(false);
          await fetchListings(selectedResult);
          // Update search query after fetch completes
          setSearchQuery(selectedResult.name);
        }
      } catch (error: any) {
        console.error('[MapFirstLayout] Auto-search error:', error);
        // Reset the flag so user can try manual search
        hasAutoLoadedRef.current = false;
        setHasAutoLoadedListings(false);
        hasAttemptedAutoSearch.current = false;
      }
    };
    
    // Add a small delay to ensure tRPC client is ready
    const timeoutId = setTimeout(() => {
      performAutoSearch();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery]); // Only run when searchQuery changes - use refs for other values to avoid re-render interruptions
  
  // Track if we've auto-populated from context
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false);
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  
  // Check for Google Maps availability
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google?.maps?.Geocoder) {
        setGoogleMapsReady(true);
      } else {
        setTimeout(checkGoogleMaps, 100);
      }
    };
    checkGoogleMaps();
  }, []);
  
  // Auto-populate myPropertyLocation from PropertyContext
  useEffect(() => {
    // If we have a property from context with coordinates, use them directly
    if (hasProperty && effectiveProperty?.latitude && effectiveProperty?.longitude && !myPropertyLocation) {
      console.log('[MapFirstLayout] Setting myPropertyLocation from context coordinates:', effectiveProperty.address);
      setMyPropertyLocation({
        address: effectiveProperty.address,
        lat: effectiveProperty.latitude,
        lng: effectiveProperty.longitude
      });
      setMyPropertyAddress(effectiveProperty.address);
      return;
    }
    
    // If we have a property from context but no coordinates, geocode the address
    // Note: Removed hasAutoPopulated check to allow re-geocoding when property changes
    if (hasProperty && effectiveProperty?.address && !myPropertyLocation && googleMapsReady) {
      console.log('[MapFirstLayout] Geocoding property address:', effectiveProperty.address);
      setIsGeocodingMyProperty(true);
      
      const geocoder = geocoderRef.current || new google.maps.Geocoder();
      if (!geocoderRef.current) {
        geocoderRef.current = geocoder;
      }
      
      geocoder.geocode({ address: effectiveProperty.address })
        .then((result) => {
          if (result.results && result.results.length > 0) {
            const location = result.results[0].geometry.location;
            const newLocation = {
              address: result.results[0].formatted_address,
              lat: location.lat(),
              lng: location.lng()
            };
            console.log('[MapFirstLayout] Geocoded successfully:', newLocation);
            setMyPropertyLocation(newLocation);
            setMyPropertyAddress(effectiveProperty.address);
          }
        })
        .catch((error) => {
          console.error('[MapFirstLayout] Geocoding failed:', error);
          setMyPropertyError('Could not locate this address on the map');
        })
        .finally(() => {
          setIsGeocodingMyProperty(false);
        });
    }
  }, [hasProperty, effectiveProperty?.address, effectiveProperty?.latitude, effectiveProperty?.longitude, myPropertyLocation, googleMapsReady]);
  
  // tRPC queries - using manual fetch pattern for dynamic queries
  const trpcUtils = trpc.useUtils();
  
  // Location quality query - fetches walk score, transit, attractions when property is set
  const locationQualityQuery = trpc.rental.getLocationQuality.useQuery(
    { lat: myPropertyLocation?.lat || 0, lng: myPropertyLocation?.lng || 0 },
    { enabled: !!myPropertyLocation }
  );
  
  // Helper function to search markets
  const searchMarketsAsync = async (searchTerm: string) => {
    return trpcUtils.rental.searchMarkets.fetch({ searchTerm });
  };
  
  // Helper function to get listings
  const getListingsAsync = async (submarketId: string) => {
    return trpcUtils.compData.getListings.fetch({ submarketId });
  };
  
  // Helper function to get ALL listings (handles pagination)
  const getAllListingsAsync = async (params: { submarketId: string; isMarketLevel: boolean; maxListings?: number; bedrooms?: number }) => {
    return trpcUtils.compData.getAllListings.fetch(params);
  };
  
  // Calculate thresholds
  const thresholds = useMemo((): ThresholdData => {
    if (listings.length === 0) {
      return { high: 0, low: 0, average: 0, topCount: 0, middleCount: 0, bottomCount: 0 };
    }
    const revenues = listings.map(l => l.revenue).sort((a, b) => b - a);
    const average = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const high = revenues[Math.floor(revenues.length * 0.33)] || average;
    const low = revenues[Math.floor(revenues.length * 0.67)] || average * 0.5;
    
    return {
      high,
      low,
      average,
      topCount: revenues.filter(r => r >= high).length,
      middleCount: revenues.filter(r => r >= low && r < high).length,
      bottomCount: revenues.filter(r => r < low).length,
    };
  }, [listings]);
  
  // Filter and sort listings
  const filteredListings = useMemo(() => {
    let filtered = listings.filter(l => !excludedListingIds.has(l.id));
    
    if (bedroomFilter !== 'all') {
      filtered = filtered.filter(l => l.bedrooms === parseInt(bedroomFilter));
    }
    if (propertyTypeFilter !== 'all') {
      filtered = filtered.filter(l => l.propertyType === propertyTypeFilter);
    }
    if (distanceFilter !== 'all' && myPropertyLocation) {
      const maxDist = parseFloat(distanceFilter);
      filtered = filtered.filter(l => (l.distanceToMyProperty || Infinity) <= maxDist);
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'revenue-desc': return b.revenue - a.revenue;
        case 'revenue-asc': return a.revenue - b.revenue;
        case 'occupancy-desc': return b.occupancy - a.occupancy;
        case 'occupancy-asc': return a.occupancy - b.occupancy;
        case 'rating-desc': return (b.rating || 0) - (a.rating || 0);
        case 'rating-asc': return (a.rating || 0) - (b.rating || 0);
        case 'adr-desc': return b.adr - a.adr;
        case 'adr-asc': return a.adr - b.adr;
        case 'distance-asc': return (a.distanceToMyProperty || Infinity) - (b.distanceToMyProperty || Infinity);
        case 'distance-desc': return (b.distanceToMyProperty || 0) - (a.distanceToMyProperty || 0);
        default: return 0;
      }
    });
    
    return filtered;
  }, [listings, bedroomFilter, propertyTypeFilter, distanceFilter, sortBy, excludedListingIds, myPropertyLocation]);
  
  // Pagination
  const totalPages = Math.ceil(filteredListings.length / ITEMS_PER_PAGE);
  const paginatedListings = filteredListings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [bedroomFilter, propertyTypeFilter, distanceFilter, sortBy]);
  
  // Debounced search - skip if we're auto-loading or already have listings
  useEffect(() => {
    console.log('[DEBOUNCED SEARCH] Effect triggered - searchQuery:', searchQuery, 'selectedLocation:', selectedLocation?.name, 'listings:', listings.length, 'hasAutoLoadedListings:', hasAutoLoadedListings, 'hasAutoLoadedRef:', hasAutoLoadedRef.current);
    
    // Skip if auto-search has already run - this prevents showing the dropdown after auto-search
    if (hasAutoLoadedRef.current) {
      console.log('[DEBOUNCED SEARCH] Skipping - auto-search has already run');
      return;
    }
    
    // Skip if we already have a selected location with listings
    if (selectedLocation && listings.length > 0) {
      console.log('[DEBOUNCED SEARCH] Skipping - already have location and listings');
      return;
    }
    
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    // Note: We'll check the ref inside the timeout callback to get the latest value
    console.log('[DEBOUNCED SEARCH] Effect starting - listings:', listings.length, 'selectedLocation:', selectedLocation?.name, 'hasAutoLoadedRef:', hasAutoLoadedRef.current);
    
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Check if it's a zip code (5 digits)
        const isZipCode = /^\d{5}$/.test(searchQuery.trim());
        
        // Extract just the city name for API compatibility
        // AirDNA API doesn't accept "City, State" format, only "City"
        const searchTerm = searchQuery.split(',')[0].trim();
        console.log('[DEBOUNCED SEARCH] Calling API with searchTerm:', searchTerm, '(original:', searchQuery, ')');
        
        const response = await searchMarketsAsync(searchTerm);
        const results = Array.isArray(response) ? response : ((response as any)?.data || response || []);
        
        if (results.length > 0) {
          // Check the ref NOW (inside the callback) to get the latest value
          // This avoids stale closure issues from capturing the value outside the timeout
          const shouldAutoSelect = listingsRef.current.length === 0 && !selectedLocationRef.current && !hasAutoLoadedRef.current;
          console.log('[AUTO-SELECT CHECK] shouldAutoSelect:', shouldAutoSelect, '(listingsRef:', listingsRef.current.length, 'selectedLocationRef:', selectedLocationRef.current?.name, 'hasAutoLoadedRef:', hasAutoLoadedRef.current, ')');
          
          if (shouldAutoSelect) {
            console.log('[AUTO-SELECT] Auto-selecting first result:', results[0]?.name);
            hasAutoLoadedRef.current = true;
            setHasAutoLoadedListings(true);
            
            const searchTermLower = searchQuery.toLowerCase().split(',')[0].trim();
            const exactMatch = results.find((r: any) => 
              r.name?.toLowerCase().includes(searchTermLower)
            );
            const selectedResult = exactMatch || results[0];
            
            // Auto-select and fetch listings
            setSelectedLocation(selectedResult);
            setLocationName(selectedResult.name);
            setShowSearchResults(false);
            await fetchListings(selectedResult);
            // Update search query after fetch completes
            setSearchQuery(selectedResult.name);
          } else {
            // Normal search - show dropdown ONLY if we haven't auto-loaded
            // If we've already auto-loaded listings, don't show the dropdown
            if (!hasAutoLoadedRef.current) {
              setSearchResults(results.slice(0, 10));
              setShowSearchResults(true);
            } else {
              // We've auto-loaded, so just update search results but don't show dropdown
              setSearchResults(results.slice(0, 10));
              setShowSearchResults(false);
            }
          }
        } else {
          setSearchResults([]);
          setShowSearchResults(false);
        }
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);
  
  // Handle search result selection
  const handleSelectLocation = async (result: any) => {
    setSelectedLocation(result);
    setLocationName(result.name);
    setSearchQuery(result.name);
    setShowSearchResults(false);
    
    // Fetch listings
    await fetchListings(result);
  };
  
  // Fetch listings for a location
  const fetchListings = async (location: any) => {
    setIsLoading(true);
    setError(null);
    setLoadingStartTime(Date.now());
    setLoadingProgress({ current: 0, total: 500 }); // Estimate total (API max is 500)
    
    try {
      // Determine if this is a market-level or submarket-level search
      const isMarketLevel = location.type === 'market';
      const marketId = location.id || location.submarketId || location.marketId || '';
      
      // Build API params for getAllListings (handles pagination to get more than 25 listings)
      // API max is 500, so we request the maximum allowed
      const apiParams: any = { 
        submarketId: marketId, 
        isMarketLevel, 
        maxListings: 500 // API max is 500
      };
      
      if (apiBedroomFilter) {
        apiParams.bedrooms = apiBedroomFilter;
      }
      
      // Use getAllListings endpoint which properly handles both markets and submarkets
      // Use tRPC client for proper response handling
      const response = await getAllListingsAsync(apiParams);
      
      const listingsData = response?.listings || [];
      
      // Update progress with actual count
      setLoadingProgress({ current: listingsData.length, total: listingsData.length });
      
      // Transform and calculate distances
      const processedListings = listingsData.map((listing: any) => {
        // Map API field names to component interface
        const revenue = listing.annual_revenue || listing.revenue || listing.revenue_ltm || 0;
        const lat = listing.latitude || listing.location?.lat || 0;
        const lng = listing.longitude || listing.location?.lng || 0;
        
        let distanceToMyProperty: number | undefined;
        if (myPropertyLocation && lat && lng) {
          const R = 3959; // Earth's radius in miles
          const dLat = (lat - myPropertyLocation.lat) * Math.PI / 180;
          const dLon = (lng - myPropertyLocation.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(myPropertyLocation.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          distanceToMyProperty = R * c;
        }
        
        return {
          id: listing.id || listing.airbnb_listing_id || String(Math.random()),
          title: listing.title || 'Untitled Listing',
          bedrooms: listing.bedrooms || 0,
          bathrooms: listing.bathrooms || 0,
          revenue: revenue,
          occupancy: listing.occupancy || listing.occupancy_rate_ltm || 0,
          adr: listing.adr || listing.average_daily_rate_ltm || 0,
          rating: listing.rating || null,
          reviews: listing.reviews || 0,
          latitude: lat,
          longitude: lng,
          airbnbUrl: listing.airbnb_url || listing.airbnb_property_url || `https://www.airbnb.com/rooms/${listing.airbnb_property_id || listing.airbnb_listing_id || ''}`,
          thumbnailUrl: listing.image_url || listing.thumbnail_url || '',
          propertyType: listing.property_type || 'Entire home',
          distanceToMyProperty,
        };
      });
      
      setListings(processedListings);
      
      // Enable virtualized table for large datasets (100+ listings)
      setUseVirtualizedTable(processedListings.length > 100);
      
      // Update map
      updateMapMarkers(processedListings);
      
      // Center map on listings
      if (processedListings.length > 0 && mapRef.current) {
        const bounds = new google.maps.LatLngBounds();
        processedListings.forEach((l: Listing) => {
          bounds.extend({ lat: l.latitude, lng: l.longitude });
        });
        mapRef.current.fitBounds(bounds, 50);
      }
    } catch (err: any) {
      console.error('[MapFirstLayout] Error fetching listings:', err);
      setError(err.message || 'Failed to fetch listings');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update map markers
  const updateMapMarkers = (listingsToShow: Listing[]) => {
    if (!mapRef.current || !markerLibraryReady || !window.google?.maps?.marker?.AdvancedMarkerElement) {
      return;
    }
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.map = null);
    markersRef.current = [];
    
    // Initialize info window if not exists
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }
    
    // Add new markers
    listingsToShow.forEach(listing => {
      const color = getMarkerColor(listing.revenue, thresholds, useCustomThreshold ? customThreshold : null);
      const markerElement = createMarkerElement(color, listing.revenue);
      
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: listing.latitude, lng: listing.longitude },
        title: listing.title,
        content: markerElement,
      });
      
      // Add click handler to show property details
      marker.addListener('click', () => {
        setSelectedListing(listing);
        
        const infoContent = `
          <div style="max-width: 300px; font-family: system-ui, sans-serif;">
            ${listing.thumbnailUrl ? `<img src="${listing.thumbnailUrl}" alt="${listing.title}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;" />` : ''}
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1e293b;">${listing.title}</h3>
            <div style="display: flex; gap: 12px; margin-bottom: 8px; font-size: 13px; color: #64748b;">
              <span>${listing.bedrooms} BR</span>
              <span>${listing.bathrooms} BA</span>
              <span>${listing.propertyType || 'Entire home'}</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
              <div style="background: #f1f5f9; padding: 8px; border-radius: 6px;">
                <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Revenue</div>
                <div style="font-size: 16px; font-weight: 600; color: #059669;">$${listing.revenue.toLocaleString()}</div>
              </div>
              <div style="background: #f1f5f9; padding: 8px; border-radius: 6px;">
                <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Occupancy</div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b;">${Math.round(listing.occupancy * 100)}%</div>
              </div>
              <div style="background: #f1f5f9; padding: 8px; border-radius: 6px;">
                <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">ADR</div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b;">$${Math.round(listing.adr)}</div>
              </div>
              <div style="background: #f1f5f9; padding: 8px; border-radius: 6px;">
                <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Rating</div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b;">${listing.rating ? `⭐ ${listing.rating.toFixed(1)}` : 'N/A'}</div>
              </div>
            </div>
            ${listing.distanceToMyProperty !== undefined ? `
              <div style="display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);">
                <span style="font-size: 14px;">📍</span>
                <span>${listing.distanceToMyProperty.toFixed(1)} mi from your property</span>
              </div>` : ''}
            <a href="${listing.airbnbUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #C9A962; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">View on Airbnb →</a>
          </div>
        `;
        
        infoWindowRef.current!.setContent(infoContent);
        infoWindowRef.current!.open(mapRef.current, marker);
      });
      
      markersRef.current.push(marker);
    });
    
    // Add my property marker - Enhanced for visibility
    if (myPropertyLocation) {
      const myPropertyElement = document.createElement('div');
      myPropertyElement.innerHTML = `
        <style>
          @keyframes pulse-ring-gold {
            0% { transform: scale(0.8); opacity: 0.8; }
            50% { transform: scale(1.2); opacity: 0.4; }
            100% { transform: scale(0.8); opacity: 0.8; }
          }
        </style>
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          <!-- Pulsing ring -->
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:70px;height:70px;background:rgba(245,158,11,0.4);border-radius:50%;animation:pulse-ring-gold 1.8s infinite;box-shadow:0 0 20px rgba(245,158,11,0.6);"></div>
          <!-- Main marker -->
          <div style="
            position:relative;
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, #F59E0B, #D97706);
            border-radius: 50%;
            border: 4px solid white;
            box-shadow: 0 6px 16px rgba(245, 158, 11, 0.6), 0 0 0 3px #B45309, 0 0 24px rgba(245, 158, 11, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10;
          ">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
          <!-- Label -->
          <div style="margin-top:4px;background:linear-gradient(135deg, #B45309, #92400E);color:white;font-size:12px;font-weight:700;padding:4px 12px;border-radius:6px;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,0.3);letter-spacing:0.5px;">
            YOUR PROPERTY
          </div>
        </div>
      `;
      
      const myMarker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: myPropertyLocation.lat, lng: myPropertyLocation.lng },
        title: 'My Property',
        content: myPropertyElement.firstElementChild as HTMLElement,
        zIndex: 9999 // Ensure it's always on top
      });
      
      markersRef.current.push(myMarker);
    }
  };
  
  // Update markers when thresholds or filters change
  useEffect(() => {
    updateMapMarkers(filteredListings);
  }, [filteredListings, thresholds, useCustomThreshold, customThreshold, myPropertyLocation, markerLibraryReady]);
  
  // Geocode my property
  const geocodeMyProperty = async () => {
    if (!myPropertyAddress.trim() || !geocoderRef.current) return;
    
    setIsGeocodingMyProperty(true);
    setMyPropertyError(null);
    
    try {
      const result = await new Promise<google.maps.GeocoderResult>((resolve, reject) => {
        geocoderRef.current!.geocode({ address: myPropertyAddress }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            resolve(results[0]);
          } else {
            reject(new Error('Could not find address'));
          }
        });
      });
      
      setMyPropertyLocation({
        lat: result.geometry.location.lat(),
        lng: result.geometry.location.lng(),
        address: result.formatted_address,
      });
      
      // Recalculate distances
      if (listings.length > 0) {
        const updatedListings = listings.map(listing => {
          const R = 3959;
          const lat1 = result.geometry.location.lat();
          const lng1 = result.geometry.location.lng();
          const dLat = (listing.latitude - lat1) * Math.PI / 180;
          const dLon = (listing.longitude - lng1) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(listing.latitude * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return { ...listing, distanceToMyProperty: R * c };
        });
        setListings(updatedListings);
      }
    } catch (err) {
      setMyPropertyError('Could not find that address. Please try again.');
    } finally {
      setIsGeocodingMyProperty(false);
    }
  };
  
  // Initialize from myProperty prop or effectiveProperty from context
  // Set the address field from effectiveProperty if available on mount
  useEffect(() => {
    const propertyToUse = effectiveProperty || myProperty;
    if (propertyToUse?.address && !myPropertyAddress) {
      setMyPropertyAddress(propertyToUse.address);
    }
  }, [effectiveProperty, myProperty, myPropertyAddress]);
  
  return (
    <div className={`relative ${embedded ? 'h-full' : 'min-h-screen'} bg-slate-50 ${className}`}>
      {/* Fullscreen Map Modal */}
      {isMapFullscreen && (
        <div className="fixed inset-0 z-50 bg-black">
          <button
            onClick={() => setIsMapFullscreen(false)}
            className="absolute top-4 right-4 z-10 bg-white/90 hover:bg-white p-3 rounded-xl shadow-lg"
          >
            <Minimize2 className="w-6 h-6" />
          </button>
          <MapView
            className="w-full h-full"
            initialCenter={mapRef.current?.getCenter()?.toJSON() || { lat: 39.8283, lng: -98.5795 }}
            initialZoom={mapRef.current?.getZoom() || 4}
            onMapReady={(map) => {
              // Copy markers to fullscreen map
              if (window.google?.maps?.marker?.AdvancedMarkerElement) {
                filteredListings.forEach(listing => {
                  const color = getMarkerColor(listing.revenue, thresholds, useCustomThreshold ? customThreshold : null);
                  const markerElement = createMarkerElement(color, listing.revenue);
                  new google.maps.marker.AdvancedMarkerElement({
                    map: map,
                    position: { lat: listing.latitude, lng: listing.longitude },
                    title: listing.title,
                    content: markerElement,
                  });
                });
                
                if (myPropertyLocation) {
                  const myPropertyElement = document.createElement('div');
                  myPropertyElement.innerHTML = `
                    <div style="
                      width: 40px;
                      height: 40px;
                      background: linear-gradient(135deg, #F59E0B, #D97706);
                      border-radius: 50%;
                      border: 3px solid white;
                      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.5);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                    ">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                      </svg>
                    </div>
                  `;
                  new google.maps.marker.AdvancedMarkerElement({
                    map: map,
                    position: { lat: myPropertyLocation.lat, lng: myPropertyLocation.lng },
                    title: 'My Property',
                    content: myPropertyElement.firstElementChild as HTMLElement,
                  });
                }
              }
            }}
          />
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex flex-col h-full">
        {/* Map Section - Hero */}
        <div className="relative" style={{ height: embedded ? '100%' : '70vh', minHeight: '400px' }}>
          {/* Map */}
          <MapView
            className="w-full h-full"
            initialCenter={{ lat: 39.8283, lng: -98.5795 }}
            initialZoom={4}
            onMapReady={(map) => {
              mapRef.current = map;
              if (window.google) {
                geocoderRef.current = new google.maps.Geocoder();
                
                const checkMarkerLibrary = () => {
                  if (window.google?.maps?.marker?.AdvancedMarkerElement) {
                    setMarkerLibraryReady(true);
                  } else {
                    setTimeout(checkMarkerLibrary, 100);
                  }
                };
                checkMarkerLibrary();
              }
            }}
          />
          
          {/* Floating Search Bar */}
          <div className="absolute top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-10">
            {/* Property Address Banner */}
            {myProperty && (
              <div className="bg-blue-600 text-white px-4 py-2 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  <span className="text-sm font-medium">Your Property: {myProperty.address}</span>
                </div>
                <button
                  onClick={() => {
                    if (mapRef.current && myProperty.latitude && myProperty.longitude) {
                      mapRef.current.panTo({ lat: myProperty.latitude, lng: myProperty.longitude });
                      mapRef.current.setZoom(14);
                    }
                  }}
                  className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors"
                >
                  Go to property
                </button>
              </div>
            )}
            <div className={`bg-white ${myProperty ? 'rounded-b-2xl' : 'rounded-2xl'} shadow-xl border border-slate-200 overflow-hidden`}>
              <div className="flex items-center gap-3 p-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Search className="w-5 h-5 text-amber-600" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && !hasAutoLoadedListings && setShowSearchResults(true)}
                  placeholder="Search by city, zip code, or market name..."
                  className="flex-1 text-lg outline-none placeholder:text-slate-400"
                />
                {isSearching && <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
                {searchQuery && !isSearching && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setShowSearchResults(false);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                )}
                
                {/* Bedroom Filter in Search Bar */}
                <div className="hidden md:block border-l border-slate-200 pl-3">
                  <Select 
                    value={apiBedroomFilter?.toString() || 'all'} 
                    onValueChange={(val) => setApiBedroomFilter(val === 'all' ? null : parseInt(val))}
                  >
                    <SelectTrigger className="w-32 border-0 bg-slate-50 h-9">
                      <BedDouble className="w-4 h-4 mr-2 text-slate-500" />
                      <SelectValue placeholder="Beds" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Beds ({bedroomCounts.all})</SelectItem>
                      <SelectItem value="1">1 BR ({bedroomCounts['1']})</SelectItem>
                      <SelectItem value="2">2 BR ({bedroomCounts['2']})</SelectItem>
                      <SelectItem value="3">3 BR ({bedroomCounts['3']})</SelectItem>
                      <SelectItem value="4">4 BR ({bedroomCounts['4']})</SelectItem>
                      <SelectItem value="5">5+ BR ({bedroomCounts['5']})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  onClick={() => selectedLocation && fetchListings(selectedLocation)}
                  disabled={!selectedLocation || isLoading}
                  className="bg-[#C9A962] hover:bg-[#b8984f] text-white px-6"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </Button>
              </div>
              
              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="border-t border-slate-100 max-h-64 overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <button
                      key={result.id || index}
                      onClick={() => handleSelectLocation(result)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          result.type === 'market' ? 'bg-blue-100 text-blue-600' :
                          result.type === 'submarket' ? 'bg-purple-100 text-purple-600' :
                          'bg-emerald-100 text-emerald-600'
                        }`}>
                          {result.type === 'market' ? <Building2 className="w-4 h-4" /> :
                           result.type === 'submarket' ? <MapPin className="w-4 h-4" /> :
                           <Hash className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{result.name}</div>
                          {result.locationName && result.locationName !== result.name && (
                            <div className="text-sm text-slate-500">{result.locationName}</div>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {result.listingCount && result.listingCount > 0 
                          ? `${result.listingCount.toLocaleString()} listings`
                          : 'View listings →'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Floating Control Buttons */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-10 hidden md:flex">
            {/* Home Button - Go to My Property */}
            {myProperty && (
              <button
                onClick={() => {
                  if (mapRef.current && myProperty.latitude && myProperty.longitude) {
                    mapRef.current.panTo({ lat: myProperty.latitude, lng: myProperty.longitude });
                    mapRef.current.setZoom(14);
                  }
                }}
                className="bg-amber-500 hover:bg-amber-600 p-2.5 rounded-xl shadow-lg border border-amber-600 transition-all"
                title="Go to My Property"
              >
                <Home className="w-5 h-5 text-white" />
              </button>
            )}
            <button
              onClick={() => setIsMapFullscreen(true)}
              className="bg-white/90 hover:bg-white p-2.5 rounded-xl shadow-lg border border-slate-200 transition-all"
              title="Fullscreen"
            >
              <Maximize2 className="w-5 h-5 text-slate-700" />
            </button>
          </div>
          
          {/* Floating Filters Button - Bottom Right */}
          <div className="absolute bottom-20 right-4 flex flex-col gap-2 z-20">
            {/* Filters Panel Toggle */}
            <button
              onClick={() => {
                setShowFiltersPanel(!showFiltersPanel);
                setShowThresholdsPanel(false);
                setShowMyPropertyPanel(false);
              }}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl border-2 transition-all ${
                showFiltersPanel ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-amber-50 text-slate-900 border-amber-400'
              }`}
            >
              <Filter className="w-5 h-5" />
              <span className="text-base font-semibold">Filters</span>
              {(bedroomFilter !== 'all' || distanceFilter !== 'all') && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              )}
            </button>
          </div>
          
          {/* Filters Panel */}
          {showFiltersPanel && (
            <div className="absolute bottom-20 right-4 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-20 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Filters</h3>
                <button onClick={() => setShowFiltersPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Bedrooms</Label>
                  <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Bedrooms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Bedrooms ({listings.length})</SelectItem>
                      {[0, 1, 2, 3, 4, 5, 6].map(br => {
                        const count = listings.filter(l => l.bedrooms === br).length;
                        return (
                          <SelectItem key={br} value={String(br)}>
                            {br === 0 ? 'Studio' : `${br} Bedroom${br !== 1 ? 's' : ''}`} ({count})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                {hasProperty && (
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Max Distance from My Property</Label>
                    {myPropertyLocation ? (
                      <Select value={distanceFilter} onValueChange={setDistanceFilter}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Any Distance" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any Distance</SelectItem>
                          <SelectItem value="0.5">Within 0.5 miles</SelectItem>
                          <SelectItem value="1">Within 1 mile</SelectItem>
                          <SelectItem value="2">Within 2 miles</SelectItem>
                          <SelectItem value="5">Within 5 miles</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-9 flex items-center text-sm text-slate-400">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Locating your property...
                      </div>
                    )}
                  </div>
                )}
                
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue-desc">Revenue (High to Low)</SelectItem>
                      <SelectItem value="revenue-asc">Revenue (Low to High)</SelectItem>
                      <SelectItem value="occupancy-desc">Occupancy (High to Low)</SelectItem>
                      <SelectItem value="adr-desc">ADR (High to Low)</SelectItem>
                      <SelectItem value="rating-desc">Rating (High to Low)</SelectItem>
                      {myPropertyLocation && (
                        <SelectItem value="distance-asc">Distance (Closest)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Reset All Filters */}
                {(bedroomFilter !== 'all' || distanceFilter !== 'all') && (
                  <div className="pt-3 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBedroomFilter('all');
                        setDistanceFilter('all');
                        setSortBy('revenue-desc');
                      }}
                      className="w-full text-amber-600 border-amber-200 hover:bg-amber-50"
                    >
                      Reset All Filters
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* My Property Panel */}
          {showMyPropertyPanel && (
            <div className="absolute bottom-20 right-4 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">My Property</h3>
                <button onClick={() => setShowMyPropertyPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              
              {myPropertyLocation ? (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <div className="flex items-center gap-2 text-blue-700 font-medium mb-1">
                      <MapPin className="w-4 h-4" />
                      Location Set
                    </div>
                    <div className="text-sm text-blue-600 truncate">{myPropertyLocation.address}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMyPropertyLocation(null);
                      setMyPropertyAddress('');
                    }}
                    className="w-full text-red-500 border-red-200 hover:bg-red-50"
                  >
                    Clear Location
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">
                    Enter your property address to see distances to competitors.
                  </p>
                  <AddressAutocomplete
                    value={myPropertyAddress}
                    onChange={setMyPropertyAddress}
                    onSelect={(address, placeId, details) => {
                      setMyPropertyAddress(address);
                      // Auto-set location from place details if available
                      if (details?.lat && details?.lng) {
                        setMyPropertyLocation({
                          address: address,
                          lat: details.lat,
                          lng: details.lng
                        });
                      } else {
                        // Fallback to geocoding if no lat/lng in details
                        geocodeMyProperty();
                      }
                    }}
                    placeholder="Enter your address..."
                    inputClassName="text-sm"
                    variant="light"
                  />
                  <Button
                    onClick={geocodeMyProperty}
                    disabled={isGeocodingMyProperty || !myPropertyAddress.trim()}
                    className="w-full bg-blue-500 hover:bg-blue-600"
                  >
                    {isGeocodingMyProperty ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Navigation className="w-4 h-4 mr-2" />
                    )}
                    Set Location
                  </Button>
                  {myPropertyError && (
                    <p className="text-xs text-red-600">{myPropertyError}</p>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Stats Bar - Bottom of Map */}
          {listings.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 px-4 py-3 flex items-center gap-4">
                <div className="text-center">
                  <div className="text-xs text-slate-500">Properties</div>
                  <div className="text-lg font-bold text-slate-900">{filteredListings.length}</div>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-center">
                  <div className="text-xs text-slate-500">Avg Revenue</div>
                  <div className="text-lg font-bold text-emerald-600">{formatCurrency(thresholds.average)}</div>
                </div>
                <div className="w-px h-8 bg-slate-200 hidden md:block" />
                <div className="text-center hidden md:block">
                  <div className="text-xs text-slate-500">Top Performer</div>
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(Math.max(...filteredListings.map(l => l.revenue)))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Loading Overlay with Progress */}
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-30">
              <div className="w-full max-w-md px-4">
                <LoadingProgress
                  current={loadingProgress.current}
                  total={loadingProgress.total}
                  label="Loading Properties"
                  showEstimate={true}
                  startTime={loadingStartTime || undefined}
                />
              </div>
            </div>
          )}
          
          {/* Error Message */}
          {error && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 max-w-md">
              {error}
            </div>
          )}
          
          {/* Empty State - Removed distracting overlay, map is self-explanatory */}
        </div>
        
        {/* Search Guidance - Below Map when no listings */}
        {!isLoading && listings.length === 0 && !error && (
          <div className="bg-slate-50 border-t border-slate-200 py-4">
            <div className="container">
              <div className="flex items-center justify-center gap-3 text-slate-600">
                <Map className="w-5 h-5 text-slate-400" />
                <p className="text-sm">
                  <span className="font-medium">Search for a location</span> — Enter a city, zip code, or market name above to see property performance data
                </p>
              </div>

            </div>
          </div>
        )}
        
        {/* Legend Bar - Below Map */}
        {listings.length > 0 && (
          <div className="bg-slate-50 border-t border-b border-slate-200 py-3">
            <div className="container">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <span className="text-sm font-medium text-slate-600">Revenue Legend:</span>
                  {useCustomThreshold ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-500" />
                        <span className="text-sm text-slate-600">≥ {formatCurrency(customThreshold)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-slate-400" />
                        <span className="text-sm text-slate-600">&lt; {formatCurrency(customThreshold)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-500" />
                        <span className="text-sm text-slate-600">Top 33% ({thresholds.topCount})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-amber-500" />
                        <span className="text-sm text-slate-600">Middle 33% ({thresholds.middleCount})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-red-500" />
                        <span className="text-sm text-slate-600">Bottom 33% ({thresholds.bottomCount})</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={useCustomThreshold} onCheckedChange={setUseCustomThreshold} />
                    <span className="text-sm text-slate-600">Custom Threshold</span>
                  </div>
                  {useCustomThreshold && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">$</span>
                      <Input
                        type="number"
                        value={customThreshold}
                        onChange={(e) => setCustomThreshold(Number(e.target.value))}
                        className="h-8 w-28"
                      />
                    </div>
                  )}
                  <div className="text-sm text-slate-500">
                    Avg: <span className="font-semibold text-emerald-600">{formatCurrency(thresholds.average)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Location Quality Score - Shows when user has set their property */}
        {myPropertyLocation && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-t border-b border-purple-100 py-4">
            <div className="container">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                      Your Property Location
                      {locationQualityQuery.isLoading && (
                        <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                      )}
                    </h3>
                    <p className="text-sm text-slate-600 truncate max-w-md">{myPropertyLocation.address}</p>
                  </div>
                </div>
                
                {/* Location Quality Scores */}
                {locationQualityQuery.data?.success && locationQualityQuery.data.data && (
                  <div className="flex items-center gap-6">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="text-center">
                            <div className={`px-4 py-2 rounded-lg text-xl font-bold ${
                              locationQualityQuery.data.data.overallScore >= 80 ? 'bg-green-100 text-green-700' :
                              locationQualityQuery.data.data.overallScore >= 60 ? 'bg-blue-100 text-blue-700' :
                              locationQualityQuery.data.data.overallScore >= 40 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {locationQualityQuery.data.data.overallGrade}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">Location Score</div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-slate-900 text-white border-slate-700">
                          <p className="font-semibold text-white">{locationQualityQuery.data.data.overallLabel}</p>
                          <p className="text-xs mt-1 text-slate-200">Based on walkability, transit access, nearby attractions, and amenities.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <div className="hidden md:flex items-center gap-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="text-center px-3 py-1 bg-white rounded-lg border border-slate-200">
                              <div className={`text-sm font-bold ${
                                locationQualityQuery.data.data.walkScore.score >= 70 ? 'text-green-600' :
                                locationQualityQuery.data.data.walkScore.score >= 50 ? 'text-blue-600' :
                                'text-amber-600'
                              }`}>{locationQualityQuery.data.data.walkScore.grade}</div>
                              <div className="text-xs text-slate-500">Walk</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-900 text-white border-slate-700">
                            <p className="font-semibold text-white">Walk Score: {locationQualityQuery.data.data.walkScore.score}/100</p>
                            <p className="text-xs mt-1 text-slate-200">{locationQualityQuery.data.data.walkScore.nearbyPlaces} restaurants, cafes, and shops within walking distance.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="text-center px-3 py-1 bg-white rounded-lg border border-slate-200">
                              <div className={`text-sm font-bold ${
                                locationQualityQuery.data.data.transitScore.score >= 70 ? 'text-green-600' :
                                locationQualityQuery.data.data.transitScore.score >= 50 ? 'text-blue-600' :
                                'text-amber-600'
                              }`}>{locationQualityQuery.data.data.transitScore.grade}</div>
                              <div className="text-xs text-slate-500">Transit</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-900 text-white border-slate-700">
                            <p className="font-semibold text-white">Transit Score: {locationQualityQuery.data.data.transitScore.score}/100</p>
                            <p className="text-xs mt-1 text-slate-200">{locationQualityQuery.data.data.transitScore.nearbyStops} transit stops within 1 mile.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="text-center px-3 py-1 bg-white rounded-lg border border-slate-200">
                              <div className={`text-sm font-bold ${
                                locationQualityQuery.data.data.attractionScore.score >= 70 ? 'text-green-600' :
                                locationQualityQuery.data.data.attractionScore.score >= 50 ? 'text-blue-600' :
                                'text-amber-600'
                              }`}>{locationQualityQuery.data.data.attractionScore.grade}</div>
                              <div className="text-xs text-slate-500">Attractions</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-900 text-white border-slate-700">
                            <p className="font-semibold text-white">Attraction Score: {locationQualityQuery.data.data.attractionScore.score}/100</p>
                            <p className="text-xs mt-1 text-slate-200">{locationQualityQuery.data.data.attractionScore.nearbyAttractions} attractions within 2 miles.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMyPropertyLocation(null);
                        setMyPropertyAddress('');
                      }}
                      className="text-red-500 border-red-200 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                )}
                
                {/* Loading state */}
                {locationQualityQuery.isLoading && (
                  <div className="flex items-center gap-2 text-purple-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analyzing location...</span>
                  </div>
                )}
              </div>
              
              {/* Guest Appeal - Why guests would stay here */}
              {locationQualityQuery.data?.success && locationQualityQuery.data.data?.guestAppeal && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-purple-100">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-purple-700">Why guests would stay here:</span>{' '}
                    {locationQualityQuery.data.data.guestAppeal}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Table Section - Below Map */}
        {filteredListings.length > 0 && !embedded && (
          <div className="flex-1 bg-white border-t border-slate-200">
            <div className="container py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Table2 className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Comparable Properties
                      <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-full">
                        {filteredListings.length}
                      </span>
                    </h2>
                    <p className="text-sm text-slate-500">
                      {locationName ? `Properties in ${locationName}` : 'All properties shown on map'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Export Button */}
                  <ExportListings
                    listings={filteredListings}
                    locationName={locationName}
                    filters={{
                      bedrooms: bedroomFilter,
                      propertyType: propertyTypeFilter,
                      distance: distanceFilter,
                    }}
                  />
                  
                  {/* Location Privacy Note */}
                  <div className="hidden md:flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                    <Info className="w-4 h-4" />
                    Locations are approximate (~1km offset) for privacy
                  </div>
                </div>
              </div>
              
              {/* Table - Use virtualized table for large datasets */}
              {useVirtualizedTable && filteredListings.length > 100 ? (
                <VirtualizedTable
                  listings={filteredListings}
                  thresholds={thresholds}
                  customThreshold={useCustomThreshold ? customThreshold : null}
                  hasProperty={hasProperty}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  onRowClick={(listing) => setSelectedListing(listing)}
                  showCompSetMode={showCompSetMode}
                  excludedListingIds={excludedListingIds}
                  onExcludeListing={(id) => setExcludedListingIds(prev => new Set([...Array.from(prev), id]))}
                />
              ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left p-3 font-semibold text-slate-700 w-[280px]">Property</th>
                      <th className="text-center p-3 font-semibold text-slate-700 w-[70px]">BR/BA</th>
                      {hasProperty && (
                        <th className="text-right p-3 font-semibold text-slate-700 w-[80px]">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-500" />
                            Distance
                          </span>
                        </th>
                      )}
                      <th className="text-right p-3 font-semibold text-slate-700 w-[100px]">
                        <button 
                          onClick={() => setSortBy(sortBy === 'revenue-desc' ? 'revenue-asc' : 'revenue-desc')}
                          className="inline-flex items-center gap-1 hover:text-emerald-600"
                        >
                          Revenue
                          {sortBy.startsWith('revenue') && (
                            sortBy === 'revenue-desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                          )}
                        </button>
                      </th>
                      <th className="text-right p-3 font-semibold text-slate-700 w-[90px]">
                        <button 
                          onClick={() => setSortBy(sortBy === 'occupancy-desc' ? 'occupancy-asc' : 'occupancy-desc')}
                          className="inline-flex items-center gap-1 hover:text-amber-600"
                        >
                          Occupancy
                          {sortBy.startsWith('occupancy') && (
                            sortBy === 'occupancy-desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                          )}
                        </button>
                      </th>
                      <th className="text-right p-3 font-semibold text-slate-700 w-[70px]">ADR</th>
                      <th className="text-center p-3 font-semibold text-slate-700 w-[70px]">Rating</th>
                      <th className="text-center p-3 font-semibold text-slate-700 w-[50px]">Link</th>
                      {showCompSetMode && <th className="w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedListings.map((listing) => {
                      const markerColor = getMarkerColor(listing.revenue, thresholds, useCustomThreshold ? customThreshold : null);
                      const occupancyDisplay = listing.occupancy > 1 ? Math.round(listing.occupancy) : Math.round(listing.occupancy * 100);
                      
                      return (
                        <tr 
                          key={listing.id} 
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => {
                            if (mapRef.current) {
                              mapRef.current.panTo({ lat: listing.latitude, lng: listing.longitude });
                              mapRef.current.setZoom(15);
                            }
                          }}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              {listing.thumbnailUrl ? (
                                <img 
                                  src={listing.thumbnailUrl} 
                                  alt={listing.title}
                                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-slate-200"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                                  <Home className="w-5 h-5 text-slate-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 truncate max-w-[200px]" title={listing.title}>
                                  {listing.title}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {listing.propertyType || 'Entire home'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-700">
                              {listing.bedrooms}BR / {listing.bathrooms}BA
                            </span>
                          </td>
                          {hasProperty && (
                            <td className="p-3 text-right">
                              {myPropertyLocation ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-lg border border-blue-100">
                                  <MapPin className="w-3 h-3 text-blue-500" />
                                  <span className="font-semibold text-blue-600">
                                    {listing.distanceToMyProperty !== undefined 
                                      ? formatDistance(listing.distanceToMyProperty)
                                      : '—'}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">Locating...</span>
                              )}
                            </td>
                          )}
                          <td className="p-3 text-right">
                            <span className="font-semibold" style={{ color: markerColor }}>
                              {formatCurrency(listing.revenue)}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className={`font-semibold ${occupancyDisplay >= 70 ? 'text-green-600' : occupancyDisplay >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                              {occupancyDisplay}%
                            </span>
                          </td>
                          <td className="p-3 text-right font-medium text-slate-700">
                            {formatCurrency(listing.adr)}/night
                          </td>
                          <td className="p-3 text-center">
                            {listing.rating ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg border border-amber-100">
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                <span className="font-semibold text-amber-700">{listing.rating.toFixed(1)}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <a 
                              href={listing.airbnbUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </td>
                          {showCompSetMode && (
                            <td className="p-3 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExcludedListingIds(prev => {
                                    const newSet = new Set(prev);
                                    newSet.add(listing.id);
                                    return newSet;
                                  });
                                }}
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600"
                                title="Exclude from comp set"
                              >
                                <span className="text-xs font-bold">×</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
              
              {/* Pagination - only show for non-virtualized table */}
              {!useVirtualizedTable && totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredListings.length)} of {filteredListings.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Summary Stats */}
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm">
                  <span className="font-bold text-slate-900">{filteredListings.length}</span>
                  <span className="text-slate-500 ml-1">properties</span>
                </div>
                <div className="px-3 py-1.5 bg-emerald-50 rounded-lg text-sm border border-emerald-100">
                  <span className="text-slate-500">Avg Revenue:</span>
                  <span className="font-bold text-emerald-600 ml-1">{formatCurrency(thresholds.average)}</span>
                </div>
                <div className="px-3 py-1.5 bg-amber-50 rounded-lg text-sm border border-amber-100">
                  <span className="text-slate-500">Avg Occupancy:</span>
                  <span className="font-bold text-amber-600 ml-1">
                    {filteredListings.length > 0 
                      ? Math.round(filteredListings.reduce((sum, l) => sum + (l.occupancy > 1 ? l.occupancy : l.occupancy * 100), 0) / filteredListings.length)
                      : 0}%
                  </span>
                </div>
                <div className="px-3 py-1.5 bg-blue-50 rounded-lg text-sm border border-blue-100">
                  <span className="text-slate-500">Avg ADR:</span>
                  <span className="font-bold text-blue-600 ml-1">
                    {filteredListings.length > 0 
                      ? formatCurrency(filteredListings.reduce((sum, l) => sum + l.adr, 0) / filteredListings.length)
                      : '$0'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
