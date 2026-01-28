/**
 * MapFirstLayoutV2 - Premium Tesla-inspired two-column layout
 * 
 * Features:
 * - Table on LEFT (60%), Map on RIGHT (40%)
 * - Premium deep navy (#0F172A) + warm gold (#C9A962) theme
 * - Distance filter from user's property
 * - Distinct gold property marker on map
 * - Guiding question at top
 * - Tooltips for all metrics (beginner-friendly)
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useProperty } from '@/contexts/PropertyContext';
import { trpc } from '@/lib/trpc';
import { MapView } from '@/components/Map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
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
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Star,
  ExternalLink,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Heart,
  Info,
  Download,
  TrendingUp,
  Calendar,
  Building,
} from 'lucide-react';
import { ExportListings } from '@/components/ExportListings';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

interface MapFirstLayoutV2Props {
  className?: string;
  embedded?: boolean;
  initialLocation?: string;
}

const ITEMS_PER_PAGE = 15;

// Helper functions
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDistance = (meters: number) => {
  const miles = meters / 1609.34;
  if (miles < 0.1) return '<0.1 mi';
  if (miles < 1) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
};

const getMarkerColor = (revenue: number, thresholds: { high: number; low: number }, customThreshold: number | null) => {
  if (customThreshold !== null) {
    return revenue >= customThreshold ? '#22c55e' : '#94a3b8';
  }
  if (revenue >= thresholds.high) return '#22c55e';
  if (revenue >= thresholds.low) return '#C9A962';
  return '#ef4444';
};

export function MapFirstLayoutV2({ className = '', embedded = false, initialLocation }: MapFirstLayoutV2Props) {
  // Context
  const { myProperty, setMyProperty } = useProperty();
  
  // State
  const [searchQuery, setSearchQuery] = useState(initialLocation || '');
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [locationName, setLocationName] = useState('');
  
  // Progressive loading state
  const [loadingProgress, setLoadingProgress] = useState<{
    totalCount: number;
    fetchedCount: number;
    elapsedMs: number;
    currentPage: number;
    totalPages: number;
    isComplete: boolean;
    hasMore?: boolean;
  } | null>(null);
  const [cachedMarketId, setCachedMarketId] = useState<string | null>(null);
  const [hasMoreListings, setHasMoreListings] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [bedroomFilter, setBedroomFilter] = useState('all');
  // Default to 1 mile when user has property set (auto-filter nearby competition)
  const [distanceFilter, setDistanceFilter] = useState('1');
  const [sortBy, setSortBy] = useState<string>('revenue-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [favoriteListingIds, setFavoriteListingIds] = useState<Set<string>>(new Set());
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [propertyAddressInput, setPropertyAddressInput] = useState('');
  const [myPropertyLocation, setMyPropertyLocation] = useState<{address: string; lat: number; lng: number} | null>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  
  // Submarket state - when available, fetch only from user's submarket
  const [activeSubmarketId, setActiveSubmarketId] = useState<string | null>(null);
  const [activeSubmarketName, setActiveSubmarketName] = useState<string | null>(null);
  
  // Refs
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const myPropertyMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  
  // API - First search for markets to get the market ID
  const [searchTrigger, setSearchTrigger] = useState(0);
  
  // Mutation to get submarket ID from Rentalizer API
  const getEstimateMutation = trpc.rental.getEstimate.useMutation();
  
  const marketsQuery = trpc.marketExplorer.searchMarkets.useQuery(
    { query: searchQuery, limit: 5 },
    { 
      enabled: searchQuery.length >= 3,
      staleTime: 0, // Always refetch
    }
  );
  
  // Get the first market ID from search results
  const marketId = marketsQuery.data?.[0]?.id;
  
  // Fetch available neighborhoods/submarkets for the current market
  const neighborhoodsQuery = trpc.marketExplorer.getNeighborhoods.useQuery(
    { marketId: marketId || '' },
    {
      enabled: !!marketId && !activeSubmarketId, // Only fetch if we have a market and no submarket selected
      staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    }
  );
  
  // State for selected neighborhood from dropdown
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('all');
  
  // Convert distance filter value to meters
  const distanceToMeters = (distanceValue: string): number => {
    const milesMap: Record<string, number> = {
      '1': 1609,      // 1 mile
      '3': 4828,      // 3 miles
      '5': 8047,      // 5 miles
      '10': 16093,    // 10 miles
      '25': 40234,    // 25 miles
      'all': 80467,   // 50 miles (effectively all)
    };
    return milesMap[distanceValue] || 1609;
  };
  
  // Stream listings using radius-based SSE endpoint (more efficient)
  const startStreamingByRadius = useCallback((lat: number, lng: number, radiusMeters: number, bedrooms?: string) => {
    // Create a cache key based on location, radius, and bedrooms
    const cacheKey = `radius-${lat.toFixed(4)}-${lng.toFixed(4)}-${radiusMeters}-${bedrooms || 'all'}`;
    
    // Don't refetch if we already have this cached
    if (cacheKey === cachedMarketId) {
      console.log('[MapFirstLayoutV2] Using cached listings for:', cacheKey);
      return;
    }
    
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    // Reset state
    setListings([]);
    setIsLoading(true);
    setLoadingProgress({
      totalCount: 0,
      fetchedCount: 0,
      elapsedMs: 0,
      currentPage: 0,
      totalPages: 0,
      isComplete: false
    });
    
    console.log(`[MapFirstLayoutV2] Starting radius-based streaming: lat=${lat}, lng=${lng}, radius=${radiusMeters}m, bedrooms=${bedrooms || 'all'}`);
    
    // Create SSE connection to radius-based endpoint
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      radius: radiusMeters.toString(),
      sortBy: 'revenue'
    });
    if (bedrooms && bedrooms !== 'all') {
      params.append('bedrooms', bedrooms === '5+' ? '5' : bedrooms);
    }
    
    const url = `/api/stream/listings-by-radius?${params.toString()}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;
    
    let allListings: Listing[] = [];
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          setLoadingProgress({
            totalCount: data.totalCount,
            fetchedCount: data.fetchedCount,
            elapsedMs: data.elapsedMs,
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            isComplete: false
          });
        } else if (data.type === 'listings') {
          // Process and add new listings
          const newListings = data.listings.map((l: any) => ({
            id: l.id,
            title: l.title,
            thumbnailUrl: l.imageUrl,
            latitude: l.latitude,
            longitude: l.longitude,
            bedrooms: l.bedrooms,
            bathrooms: l.bathrooms,
            revenue: l.annualRevenue || 0,
            occupancy: l.occupancyRate || 0,
            adr: l.adr || 0,
            rating: l.rating || null,
            reviews: l.reviewCount || 0,
            airbnbUrl: l.airbnbUrl || '',
            zipcode: l.zipcode || null,
            // Use distance from API if available, otherwise calculate
            distanceToMyProperty: l.distanceMeters || (myPropertyLocation 
              ? calculateDistance(myPropertyLocation.lat, myPropertyLocation.lng, l.latitude, l.longitude)
              : undefined)
          })).filter((l: Listing) => l.revenue > 0);
          
          allListings = [...allListings, ...newListings];
          setListings([...allListings]);
          setLocationName(searchQuery || 'Your Area');
          
          // Center map on first listing if this is the first batch
          if (allListings.length === newListings.length && mapRef.current) {
            const firstListing = newListings[0];
            if (firstListing?.latitude && firstListing?.longitude) {
              mapRef.current.panTo({ lat: firstListing.latitude, lng: firstListing.longitude });
              mapRef.current.setZoom(12);
            }
          }
        } else if (data.type === 'complete') {
          setLoadingProgress(prev => prev ? { ...prev, isComplete: true, fetchedCount: data.fetchedCount, elapsedMs: data.elapsedMs, hasMore: false } : null);
          setIsLoading(false);
          setCachedMarketId(cacheKey);
          setHasMoreListings(false);
          eventSource.close();
          console.log(`[MapFirstLayoutV2] Radius streaming complete: ${data.fetchedCount} listings in ${(data.elapsedMs / 1000).toFixed(1)}s`);
        } else if (data.type === 'error') {
          console.error('[MapFirstLayoutV2] Stream error:', data.message);
          setIsLoading(false);
          eventSource.close();
        }
      } catch (err) {
        console.error('[MapFirstLayoutV2] Error parsing SSE data:', err);
      }
    };
    
    eventSource.onerror = (err) => {
      console.error('[MapFirstLayoutV2] SSE connection error:', err);
      setIsLoading(false);
      eventSource.close();
    };
  }, [cachedMarketId, myPropertyLocation, searchQuery]);
  
  // Legacy: Stream listings using SSE for progressive loading (market-wide, less efficient)
  const startStreamingListings = useCallback((marketIdToFetch: string) => {
    // Don't refetch if we already have this market cached
    if (marketIdToFetch === cachedMarketId) {
      console.log('[MapFirstLayoutV2] Using cached listings for market:', marketIdToFetch);
      return;
    }
    
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    // Reset state
    setListings([]);
    setIsLoading(true);
    setLoadingProgress({
      totalCount: 0,
      fetchedCount: 0,
      elapsedMs: 0,
      currentPage: 0,
      totalPages: 0,
      isComplete: false
    });
    
    // Determine if this is a submarket or market
    const isSubmarket = marketIdToFetch.startsWith('submarket-');
    const marketType = isSubmarket ? 'submarket' : 'market';
    console.log(`[MapFirstLayoutV2] Starting streaming for ${marketType}: ${marketIdToFetch}`);
    
    // Create SSE connection
    const url = `/api/stream/listings?marketId=${encodeURIComponent(marketIdToFetch)}&marketType=${marketType}&sortBy=revenue`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;
    
    let allListings: Listing[] = [];
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          setLoadingProgress({
            totalCount: data.totalCount,
            fetchedCount: data.fetchedCount,
            elapsedMs: data.elapsedMs,
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            isComplete: false
          });
        } else if (data.type === 'listings') {
          // Process and add new listings
          const newListings = data.listings.map((l: any) => ({
            id: l.id,
            title: l.title,
            thumbnailUrl: l.imageUrl,
            latitude: l.latitude,
            longitude: l.longitude,
            bedrooms: l.bedrooms,
            bathrooms: l.bathrooms,
            revenue: l.annualRevenue || 0,
            occupancy: l.occupancyRate || 0,
            adr: l.adr || 0,
            rating: l.rating || null,
            reviews: l.reviewCount || 0,
            airbnbUrl: l.airbnbUrl || '',
            zipcode: l.zipcode || null,
            distanceToMyProperty: myPropertyLocation 
              ? calculateDistance(myPropertyLocation.lat, myPropertyLocation.lng, l.latitude, l.longitude)
              : undefined
          })).filter((l: Listing) => l.revenue > 0);
          
          allListings = [...allListings, ...newListings];
          setListings([...allListings]);
          setLocationName(searchQuery);
          
          // Center map on first listing if this is the first batch
          if (allListings.length === newListings.length && mapRef.current) {
            const firstListing = newListings[0];
            if (firstListing?.latitude && firstListing?.longitude) {
              mapRef.current.panTo({ lat: firstListing.latitude, lng: firstListing.longitude });
              mapRef.current.setZoom(11);
            }
          }
        } else if (data.type === 'complete') {
          setLoadingProgress(prev => prev ? { ...prev, isComplete: true, fetchedCount: data.fetchedCount, elapsedMs: data.elapsedMs, hasMore: data.hasMore } : null);
          setIsLoading(false);
          setCachedMarketId(marketIdToFetch);
          setHasMoreListings(data.hasMore || false);
          eventSource.close();
          console.log(`[MapFirstLayoutV2] Streaming complete: ${data.fetchedCount} of ${data.totalCount} listings in ${(data.elapsedMs / 1000).toFixed(1)}s (hasMore: ${data.hasMore})`);
        } else if (data.type === 'error') {
          console.error('[MapFirstLayoutV2] Stream error:', data.message);
          setIsLoading(false);
          eventSource.close();
        }
      } catch (err) {
        console.error('[MapFirstLayoutV2] Error parsing SSE data:', err);
      }
    };
    
    eventSource.onerror = (err) => {
      console.error('[MapFirstLayoutV2] SSE connection error:', err);
      setIsLoading(false);
      eventSource.close();
    };
  }, [cachedMarketId, myPropertyLocation, searchQuery]);
  
  // Start streaming when user has property location - use radius-based search (more efficient)
  // This is the PRIMARY method when user has entered their property
  useEffect(() => {
    // If user has a property location, use radius-based search (most efficient)
    if (myPropertyLocation) {
      const radiusMeters = distanceToMeters(distanceFilter);
      console.log(`[MapFirstLayoutV2] User has property location, using radius-based search: ${radiusMeters}m, bedrooms=${bedroomFilter}`);
      startStreamingByRadius(
        myPropertyLocation.lat,
        myPropertyLocation.lng,
        radiusMeters,
        bedroomFilter
      );
    }
    // Fallback to market-based search if no property location (less efficient)
    else if (activeSubmarketId && `submarket-${activeSubmarketId}` !== cachedMarketId) {
      console.log('[MapFirstLayoutV2] Using submarket ID:', activeSubmarketId);
      startStreamingListings(`submarket-${activeSubmarketId}`);
    }
    else if (!activeSubmarketId && marketId && marketId !== cachedMarketId) {
      startStreamingListings(marketId);
    }
    
    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [myPropertyLocation, distanceFilter, bedroomFilter, marketId, activeSubmarketId, cachedMarketId, startStreamingByRadius, startStreamingListings]);
  
  // Recalculate distances when myPropertyLocation changes
  useEffect(() => {
    if (myPropertyLocation && listings.length > 0) {
      setListings(prev => prev.map(l => ({
        ...l,
        distanceToMyProperty: calculateDistance(myPropertyLocation.lat, myPropertyLocation.lng, l.latitude, l.longitude)
      })));
    }
  }, [myPropertyLocation]);
  
  // Calculate distance between two points
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  // Filter and sort listings
  // Note: When using radius-based search, bedroom and distance filtering happens on the API side
  // This useMemo is mainly for sorting and fallback filtering when using market-wide search
  const filteredListings = useMemo(() => {
    let result = [...listings];
    
    // Bedroom filter (only needed for market-wide search fallback, API already filters for radius search)
    // We still apply it client-side as a safety net
    if (bedroomFilter !== 'all') {
      const targetBedrooms = parseInt(bedroomFilter);
      if (bedroomFilter === '5+' || bedroomFilter === '5') {
        result = result.filter(l => l.bedrooms >= 5);
      } else if (bedroomFilter === '0') {
        // Studio
        result = result.filter(l => l.bedrooms === 0);
      } else {
        result = result.filter(l => l.bedrooms === targetBedrooms);
      }
    }
    
    // Distance filter (only needed for market-wide search fallback, API already filters for radius search)
    // We still apply it client-side as a safety net
    if (distanceFilter !== 'all' && myPropertyLocation) {
      const maxDistance = parseInt(distanceFilter) * 1609.34; // Convert miles to meters
      result = result.filter(l => l.distanceToMyProperty !== undefined && l.distanceToMyProperty <= maxDistance);
    }
    
    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'revenue-desc': return b.revenue - a.revenue;
        case 'revenue-asc': return a.revenue - b.revenue;
        case 'occupancy-desc': return b.occupancy - a.occupancy;
        case 'occupancy-asc': return a.occupancy - b.occupancy;
        case 'distance-asc': return (a.distanceToMyProperty || Infinity) - (b.distanceToMyProperty || Infinity);
        default: return b.revenue - a.revenue;
      }
    });
    
    return result;
  }, [listings, bedroomFilter, distanceFilter, sortBy, myPropertyLocation]);
  
  // Calculate thresholds
  const thresholds = useMemo(() => {
    if (filteredListings.length === 0) return { high: 0, low: 0, average: 0, middleCount: 0, topCount: 0, bottomCount: 0 };
    const revenues = filteredListings.map(l => l.revenue).sort((a, b) => b - a);
    const avg = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const highIdx = Math.floor(revenues.length * 0.33);
    const lowIdx = Math.floor(revenues.length * 0.67);
    return {
      high: revenues[highIdx] || avg,
      low: revenues[lowIdx] || avg * 0.5,
      average: avg,
      topCount: highIdx,
      middleCount: lowIdx - highIdx,
      bottomCount: revenues.length - lowIdx
    };
  }, [filteredListings]);
  
  // Pagination
  const totalPages = Math.ceil(filteredListings.length / ITEMS_PER_PAGE);
  const paginatedListings = filteredListings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [bedroomFilter, distanceFilter, sortBy]);
  
  // Update map markers
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps?.marker?.AdvancedMarkerElement) return;
    
    // Clear existing markers
    markersRef.current.forEach(m => m.map = null);
    markersRef.current = [];
    
    // Add listing markers
    filteredListings.forEach(listing => {
      // Skip listings with invalid coordinates
      if (!listing.latitude || !listing.longitude || isNaN(listing.latitude) || isNaN(listing.longitude)) {
        return;
      }
      const color = getMarkerColor(listing.revenue, thresholds, null);
      const markerElement = document.createElement('div');
      markerElement.innerHTML = `
        <div style="
          background: ${color};
          color: white;
          padding: 6px 10px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          white-space: nowrap;
          font-family: system-ui, -apple-system, sans-serif;
        ">
          ${formatCurrency(listing.revenue)}
        </div>
      `;
      
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current!,
        position: { lat: listing.latitude, lng: listing.longitude },
        title: listing.title,
        content: markerElement.firstElementChild as HTMLElement,
      });
      
      // Add click handler to show property card popup
      marker.addListener('click', () => {
        setSelectedListing(listing);
        if (mapRef.current) {
          mapRef.current.panTo({ lat: listing.latitude, lng: listing.longitude });
        }
      });
      
      markersRef.current.push(marker);
    });
    
    // Add my property marker
    if (myPropertyLocation && !myPropertyMarkerRef.current) {
      const myPropertyElement = document.createElement('div');
      myPropertyElement.innerHTML = `
        <div style="
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #C9A962, #a08840);
          border-radius: 50%;
          border: 4px solid white;
          box-shadow: 0 4px 16px rgba(201, 169, 98, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
      `;
      
      myPropertyMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current!,
        position: { lat: myPropertyLocation.lat, lng: myPropertyLocation.lng },
        title: 'My Property',
        content: myPropertyElement.firstElementChild as HTMLElement,
        zIndex: 1000,
      });
    }
  }, [filteredListings, thresholds, myPropertyLocation]);
  
  // Initialize from context - geocode address if coordinates are missing
  useEffect(() => {
    const initializeFromProperty = async () => {
      if (!myProperty || myPropertyLocation) return;
      
      console.log('[MapFirstLayoutV2] Initializing from property:', myProperty);
      
      // Check if we have a submarket ID - if so, use it for more focused results
      if (myProperty.submarketId) {
        console.log('[MapFirstLayoutV2] Using submarket:', myProperty.submarketId, myProperty.submarketName);
        setActiveSubmarketId(myProperty.submarketId);
        setActiveSubmarketName(myProperty.submarketName || null);
      }
      
      // If we have coordinates, use them directly
      if (myProperty.latitude && myProperty.longitude) {
        console.log('[MapFirstLayoutV2] Using existing coordinates');
        setMyPropertyLocation({
          address: myProperty.address || '',
          lat: myProperty.latitude,
          lng: myProperty.longitude
        });
        
        // If we don't have a submarket ID, fetch it from Rentalizer API
        if (!myProperty.submarketId && myProperty.address) {
          console.log('[MapFirstLayoutV2] Fetching submarket ID for existing property:', myProperty.address);
          try {
            const result = await getEstimateMutation.mutateAsync({
              address: myProperty.address,
              bedrooms: myProperty.bedrooms || 2,
              bathrooms: myProperty.bathrooms || 1,
            });
            
            if (result.success && result.data?.property?.submarket_id) {
              const submarketId = result.data.property.submarket_id;
              console.log('[MapFirstLayoutV2] Got submarket ID for existing property:', submarketId);
              setActiveSubmarketId(submarketId);
              setActiveSubmarketName(myProperty.city || null);
            } else {
              // Fallback to city search if no submarket found
              console.log('[MapFirstLayoutV2] No submarket ID found, falling back to city search');
              if (myProperty.city) {
                setSearchQuery(myProperty.city);
              }
            }
          } catch (error) {
            console.error('[MapFirstLayoutV2] Error getting submarket for existing property:', error);
            // Fallback to city search
            if (myProperty.city) {
              setSearchQuery(myProperty.city);
            }
          }
        }
        return;
      }
      
      // If we have an address but no coordinates, geocode it
      // Wait for Google Maps to be loaded
      if (myProperty.address && isGoogleMapsLoaded && window.google?.maps?.Geocoder) {
        console.log('[MapFirstLayoutV2] Geocoding address:', myProperty.address);
        const geocoder = new google.maps.Geocoder();
        try {
          const result = await geocoder.geocode({ address: myProperty.address });
          if (result.results?.[0]?.geometry?.location) {
            const location = result.results[0].geometry.location;
            console.log('[MapFirstLayoutV2] Geocoded location:', location.lat(), location.lng());
            setMyPropertyLocation({
              address: myProperty.address,
              lat: location.lat(),
              lng: location.lng()
            });
            // Also set the search query based on city/state
            if (myProperty.city) {
              // Use just city name for search (API returns better results without state suffix)
              setSearchQuery(myProperty.city);
            } else {
              // Try to extract city from address
              const addressParts = myProperty.address.split(',');
              if (addressParts.length >= 2) {
                setSearchQuery(addressParts.slice(1).join(',').trim());
              }
            }
          }
        } catch (error) {
          console.error('[MapFirstLayoutV2] Geocoding error:', error);
        }
      } else if (myProperty.address && !isGoogleMapsLoaded) {
        console.log('[MapFirstLayoutV2] Waiting for Google Maps to load...');
      }
    };
    
    initializeFromProperty();
  }, [myProperty, myPropertyLocation, isGoogleMapsLoaded]);
  
  // Separate effect to fetch submarket ID when we have coordinates but no submarket
  // This runs even if myPropertyLocation is already set (e.g., from previous session)
  // We use a ref to track if we've already attempted to fetch the submarket
  const submarketFetchAttemptedRef = useRef(false);
  
  useEffect(() => {
    const fetchSubmarketForExistingProperty = async () => {
      // Only run if we have property location but no active submarket
      // Skip if we've already attempted to fetch (prevents infinite loops)
      if (!myPropertyLocation || activeSubmarketId || submarketFetchAttemptedRef.current) return;
      if (!myProperty?.address) return;
      
      // Mark that we've attempted to fetch
      submarketFetchAttemptedRef.current = true;
      
      console.log('[MapFirstLayoutV2] Fetching submarket ID for property:', myProperty.address);
      try {
        const result = await getEstimateMutation.mutateAsync({
          address: myProperty.address,
          bedrooms: myProperty.bedrooms || 2,
          bathrooms: myProperty.bathrooms || 1,
        });
        
        if (result.success && result.data?.property?.submarket_id) {
          const submarketId = result.data.property.submarket_id;
          console.log('[MapFirstLayoutV2] Got submarket ID:', submarketId);
          setActiveSubmarketId(submarketId);
          setActiveSubmarketName(myProperty.city || null);
          // Clear the city search query since we're using submarket now
          setSearchQuery('');
        } else {
          // Fallback to city search if no submarket found
          console.log('[MapFirstLayoutV2] No submarket ID found, using city search');
          if (myProperty.city && !searchQuery) {
            setSearchQuery(myProperty.city);
          }
        }
      } catch (error) {
        console.error('[MapFirstLayoutV2] Error getting submarket:', error);
        // Fallback to city search
        if (myProperty?.city && !searchQuery) {
          setSearchQuery(myProperty.city);
        }
      }
    };
    
    fetchSubmarketForExistingProperty();
  }, [myPropertyLocation, myProperty, activeSubmarketId]);
  
  // Auto-trigger search when searchQuery is set from property context
  useEffect(() => {
    if (searchQuery.length >= 3 && myPropertyLocation && !marketsQuery.data?.length) {
      console.log('[MapFirstLayoutV2] Auto-triggering search for:', searchQuery);
      marketsQuery.refetch();
    }
  }, [searchQuery, myPropertyLocation]);
  
  const handleSearch = () => {
    if (searchQuery.length > 2) {
      // Trigger refetch by invalidating the query
      marketsQuery.refetch();
    }
  };
  
  const hasProperty = !!myPropertyLocation;
  
  // Calculate average occupancy
  const avgOccupancy = filteredListings.length > 0 
    ? Math.round(filteredListings.reduce((sum, l) => sum + (l.occupancy > 1 ? l.occupancy : l.occupancy * 100), 0) / filteredListings.length)
    : 0;
  
  // Calculate average ADR
  const avgAdr = filteredListings.length > 0 
    ? filteredListings.reduce((sum, l) => sum + l.adr, 0) / filteredListings.length
    : 0;
  
  return (
    <div className={`${embedded ? 'h-full' : ''} bg-white ${className}`}>
      {/* Premium Header with Guiding Question */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#0F172A] to-[#1e293b] text-white py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-[#C9A962]/20 flex items-center justify-center border border-[#C9A962]/30">
              <MapPin className="w-6 h-6 text-[#C9A962]" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-semibold text-white">How does my property compare to nearby competition?</h2>
              <p className="text-white/60 text-sm font-sans">
                See revenue, occupancy, and nightly rates for comparable properties in your market
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Set Your Property Section - Premium styling */}
      {!myPropertyLocation && (
        <div className="bg-gradient-to-r from-[#C9A962]/10 to-[#C9A962]/5 border-b border-[#C9A962]/20 py-5 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#C9A962] flex items-center justify-center shadow-lg">
                <Home className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0F172A] text-lg">Set Your Property First</h3>
                <p className="text-sm text-[#0F172A]/60">Enter your address to see distance-based comparisons and filter by proximity</p>
              </div>
            </div>
            <div className="flex gap-3 max-w-xl">
              <AddressAutocomplete
                value={propertyAddressInput}
                onChange={setPropertyAddressInput}
                onSelect={async (address, placeId, details) => {
                  if (details) {
                    // Set property location immediately for UI feedback
                    setMyProperty({
                      address: details.address,
                      formattedAddress: details.address,
                      zipCode: details.zipCode,
                      city: details.city,
                      state: details.state,
                      latitude: details.lat,
                      longitude: details.lng,
                      bedrooms: 2,
                      bathrooms: 1,
                    });
                    if (details.lat !== undefined && details.lng !== undefined) {
                      setMyPropertyLocation({
                        address: details.address,
                        lat: details.lat,
                        lng: details.lng
                      });
                    }
                    if (mapRef.current && details.lat && details.lng) {
                      mapRef.current.panTo({ lat: details.lat, lng: details.lng });
                      mapRef.current.setZoom(12);
                    }
                    setPropertyAddressInput('');
                    
                    // Call Rentalizer API to get submarket ID for more focused results
                    console.log('[MapFirstLayoutV2] Fetching submarket ID for:', details.address);
                    try {
                      const result = await getEstimateMutation.mutateAsync({
                        address: details.address,
                        bedrooms: 2,
                        bathrooms: 1,
                      });
                      
                      if (result.success && result.data?.property?.submarket_id) {
                        const submarketId = result.data.property.submarket_id;
                        console.log('[MapFirstLayoutV2] Got submarket ID:', submarketId);
                        setActiveSubmarketId(submarketId);
                        // Try to get submarket name from market search
                        setActiveSubmarketName(details.city || null);
                        // Update property context with submarket info
                        setMyProperty({
                          address: details.address,
                          formattedAddress: details.address,
                          zipCode: details.zipCode,
                          city: details.city,
                          state: details.state,
                          latitude: details.lat,
                          longitude: details.lng,
                          bedrooms: 2,
                          bathrooms: 1,
                          submarketId,
                          submarketName: details.city || undefined,
                        });
                      } else {
                        // Fallback to city search if no submarket found
                        console.log('[MapFirstLayoutV2] No submarket ID, falling back to city search');
                        if (details.city) {
                          setSearchQuery(details.city);
                        }
                      }
                    } catch (error) {
                      console.error('[MapFirstLayoutV2] Error getting submarket:', error);
                      // Fallback to city search
                      if (details.city) {
                        setSearchQuery(details.city);
                      }
                    }
                  }
                }}
                placeholder="Enter your property address..."
                className="flex-1"
                inputClassName="bg-white border-[#C9A962]/30 focus:border-[#C9A962] focus:ring-[#C9A962]/20"
                variant="light"
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Your Property Banner - Premium gold styling */}
      {myPropertyLocation && (
        <div className="bg-gradient-to-r from-[#C9A962] to-[#b8984f] text-white py-3 px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Home className="w-5 h-5 text-white" />
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-sm font-medium text-white/80">Your Property:</span>
                  <span className="ml-2 text-sm font-semibold">{myPropertyLocation.address}</span>
                </div>
                {activeSubmarketName && (
                  <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                    <Building className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Submarket: {activeSubmarketName}</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                if (mapRef.current) {
                  mapRef.current.panTo({ lat: myPropertyLocation.lat, lng: myPropertyLocation.lng });
                  mapRef.current.setZoom(14);
                }
              }}
              className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors font-medium backdrop-blur-sm"
            >
              Center on Map
            </button>
          </div>
        </div>
      )}
      
      {/* Search and Filters Bar - Premium styling */}
      <div className="border-b border-[#0F172A]/10 py-4 px-6 bg-[#f8f7f4]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px] max-w-md">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C9A962]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search city, zip, or market..."
                  className="pl-12 pr-4 h-12 border-[#0F172A]/10 focus:border-[#C9A962] focus:ring-[#C9A962]/20 rounded-xl text-[#0F172A]"
                />
              </div>
            </div>
            
            <Button 
              onClick={handleSearch} 
              disabled={isLoading || marketsQuery.isFetching}
              className="h-12 px-6 bg-[#0F172A] hover:bg-[#1e293b] text-white rounded-xl font-medium"
            >
              {(isLoading || marketsQuery.isFetching) ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </>
              )}
            </Button>
            
            {/* Filters */}
            <div className="flex items-center gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
                        <SelectTrigger className="w-[130px] h-10 border-[#0F172A]/10 rounded-lg">
                          <BedDouble className="w-4 h-4 mr-2 text-[#C9A962]" />
                          <SelectValue placeholder="Bedrooms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Bedrooms</SelectItem>
                          <SelectItem value="0">Studio</SelectItem>
                          <SelectItem value="1">1 Bedroom</SelectItem>
                          <SelectItem value="2">2 Bedrooms</SelectItem>
                          <SelectItem value="3">3 Bedrooms</SelectItem>
                          <SelectItem value="4">4 Bedrooms</SelectItem>
                          <SelectItem value="5">5+ Bedrooms</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-[#0F172A] text-white border-0">
                    <p>Filter by number of bedrooms to compare similar properties</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Distance Filter - Always show, default to 1 mile for nearby competition */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Select value={distanceFilter} onValueChange={setDistanceFilter}>
                        <SelectTrigger className={`w-[150px] h-10 rounded-lg ${hasProperty ? 'border-[#C9A962]/50 bg-[#C9A962]/5' : 'border-[#0F172A]/10'}`}>
                          <MapPin className="w-4 h-4 mr-2 text-[#C9A962]" />
                          <SelectValue placeholder="Distance" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Within 1 mile</SelectItem>
                          <SelectItem value="3">Within 3 miles</SelectItem>
                          <SelectItem value="5">Within 5 miles</SelectItem>
                          <SelectItem value="10">Within 10 miles</SelectItem>
                          <SelectItem value="25">Within 25 miles</SelectItem>
                          <SelectItem value="all">All Properties</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-[#0F172A] text-white border-0">
                    <p>{hasProperty ? 'Showing properties near your location. Expand to see more.' : 'Set your property to filter by distance'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[170px] h-10 border-[#0F172A]/10 rounded-lg">
                          <TrendingUp className="w-4 h-4 mr-2 text-[#C9A962]" />
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="revenue-desc">Revenue: High to Low</SelectItem>
                          <SelectItem value="revenue-asc">Revenue: Low to High</SelectItem>
                          <SelectItem value="occupancy-desc">Occupancy: High to Low</SelectItem>
                          <SelectItem value="occupancy-asc">Occupancy: Low to High</SelectItem>
                          {hasProperty && <SelectItem value="distance-asc">Distance: Nearest</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-[#0F172A] text-white border-0">
                    <p>Sort properties to find the best performers</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content - Two Column Layout */}
      <div className="flex flex-col lg:flex-row" style={{ height: 'calc(100vh - 180px)', minHeight: '600px' }}>
        {/* Left Column - Table (60%) */}
        <div className="w-full lg:w-[60%] overflow-auto border-r border-[#0F172A]/10">
          {(isLoading || marketsQuery.isFetching) ? (
            <div className="flex items-center justify-center h-full py-20">
              <div className="text-center w-full max-w-md px-6">
                <div className="w-16 h-16 rounded-2xl bg-[#C9A962]/10 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
                </div>
                <p className="text-[#0F172A]/70 font-medium text-lg mb-2">Loading properties...</p>
                
                {/* Progress indicator */}
                {loadingProgress && (
                  <div className="space-y-3">
                    {/* Progress bar */}
                    <div className="w-full bg-[#0F172A]/10 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-[#C9A962] to-[#b8984f] h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${loadingProgress.totalCount > 0 ? (loadingProgress.fetchedCount / loadingProgress.totalCount) * 100 : 0}%` }}
                      />
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center justify-center gap-4 text-sm">
                      <span className="text-[#C9A962] font-semibold">
                        {loadingProgress.fetchedCount.toLocaleString()} of {loadingProgress.totalCount.toLocaleString()}
                      </span>
                      <span className="text-[#0F172A]/50">•</span>
                      <span className="text-[#0F172A]/60">
                        {(loadingProgress.elapsedMs / 1000).toFixed(1)}s elapsed
                      </span>
                    </div>
                    
                    {/* Page info */}
                    {loadingProgress.totalPages > 0 && (
                      <p className="text-[#0F172A]/50 text-xs">
                        Page {loadingProgress.currentPage} of {loadingProgress.totalPages}
                      </p>
                    )}
                  </div>
                )}
                
                {!loadingProgress && (
                  <p className="text-[#0F172A]/50 text-sm">Searching for market...</p>
                )}
              </div>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="flex items-center justify-center h-full py-20">
              <div className="text-center px-6 max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-[#0F172A]/5 flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-[#0F172A]/30" />
                </div>
                <h3 className="text-xl font-semibold text-[#0F172A] mb-2">No Properties Found</h3>
                <p className="text-[#0F172A]/60 mb-4">Search for a city, zip code, or market to see comparable properties in that area.</p>
                <p className="text-sm text-[#C9A962]">Try searching for "Houston, TX" or "Miami, FL"</p>
              </div>
            </div>
          ) : (
            <div className="p-5">
              {/* Table Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-[#0F172A] text-lg">
                    {filteredListings.length} Properties
                    {activeSubmarketName ? (
                      <span className="font-normal text-[#0F172A]/50"> in {activeSubmarketName} submarket</span>
                    ) : locationName ? (
                      <span className="font-normal text-[#0F172A]/50"> in {locationName}</span>
                    ) : null}
                  </h3>
                  {favoriteListingIds.size > 0 && (
                    <span className="text-sm text-red-600 flex items-center gap-1 mt-1">
                      <Heart className="w-3 h-3 fill-current" />
                      {favoriteListingIds.size} saved
                    </span>
                  )}
                </div>
                <ExportListings
                  listings={filteredListings}
                  locationName={locationName}
                  filters={{ bedrooms: bedroomFilter, distance: distanceFilter }}
                />
              </div>
              
              {/* Premium Table */}
              <div className="rounded-xl border border-[#0F172A]/10 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#0F172A] text-white">
                      <th className="text-left p-4 font-semibold">Property</th>
                      <th className="text-center p-4 font-semibold w-16">BR/BA</th>
                      {hasProperty && (
                        <th className="text-right p-4 font-semibold w-20">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Dist
                              </TooltipTrigger>
                              <TooltipContent className="bg-[#0F172A] text-white border-0">
                                <p>Distance from your property in miles</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </th>
                      )}
                      <th className="text-right p-4 font-semibold w-28">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button 
                                onClick={() => setSortBy(sortBy === 'revenue-desc' ? 'revenue-asc' : 'revenue-desc')}
                                className="inline-flex items-center gap-1 hover:text-[#C9A962] transition-colors"
                              >
                                Revenue
                                {sortBy.startsWith('revenue') && (
                                  sortBy === 'revenue-desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#0F172A] text-white border-0">
                              <p>Estimated annual revenue from short-term rentals</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </th>
                      <th className="text-right p-4 font-semibold w-20">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button 
                                onClick={() => setSortBy(sortBy === 'occupancy-desc' ? 'occupancy-asc' : 'occupancy-desc')}
                                className="inline-flex items-center gap-1 hover:text-[#C9A962] transition-colors"
                              >
                                Occ
                                {sortBy.startsWith('occupancy') && (
                                  sortBy === 'occupancy-desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#0F172A] text-white border-0">
                              <p>Occupancy rate - percentage of nights booked per year</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </th>
                      <th className="text-right p-4 font-semibold w-20">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>ADR</TooltipTrigger>
                            <TooltipContent className="bg-[#0F172A] text-white border-0">
                              <p>Average Daily Rate - typical nightly price</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </th>
                      <th className="text-center p-4 font-semibold w-14">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Star className="w-4 h-4 mx-auto text-[#C9A962]" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#0F172A] text-white border-0">
                              <p>Guest rating out of 5 stars</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </th>
                      <th className="text-center p-4 w-10"></th>
                      <th className="text-center p-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedListings.map((listing, index) => {
                      const markerColor = getMarkerColor(listing.revenue, thresholds, null);
                      const occupancyDisplay = listing.occupancy > 1 ? Math.round(listing.occupancy) : Math.round(listing.occupancy * 100);
                      const isFavorite = favoriteListingIds.has(listing.id);
                      
                      return (
                        <tr 
                          key={listing.id} 
                          className={`border-b border-[#0F172A]/5 hover:bg-[#C9A962]/5 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-[#f8f7f4]/50'}`}
                          onClick={() => {
                            setSelectedListing(listing);
                            if (mapRef.current) {
                              mapRef.current.panTo({ lat: listing.latitude, lng: listing.longitude });
                              mapRef.current.setZoom(15);
                            }
                          }}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {listing.thumbnailUrl ? (
                                <img 
                                  src={listing.thumbnailUrl} 
                                  alt={listing.title}
                                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-[#0F172A]/10"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-lg bg-[#C9A962]/10 flex items-center justify-center flex-shrink-0">
                                  <Home className="w-6 h-6 text-[#C9A962]" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-[#0F172A] truncate max-w-[200px]" title={listing.title}>
                                  {listing.title}
                                </div>
                                <div className="text-xs text-[#0F172A]/50">
                                  {listing.propertyType || 'Home'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-sm font-medium text-[#0F172A]/70 bg-[#0F172A]/5 px-2 py-1 rounded">
                              {listing.bedrooms}/{listing.bathrooms}
                            </span>
                          </td>
                          {hasProperty && (
                            <td className="p-4 text-right">
                              <span className="text-sm font-medium text-blue-600">
                                {listing.distanceToMyProperty !== undefined 
                                  ? formatDistance(listing.distanceToMyProperty)
                                  : '—'}
                              </span>
                            </td>
                          )}
                          <td className="p-4 text-right">
                            <span className="text-sm font-bold" style={{ color: markerColor }}>
                              {formatCurrency(listing.revenue)}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <span className={`text-sm font-semibold ${occupancyDisplay >= 70 ? 'text-green-600' : occupancyDisplay >= 50 ? 'text-[#C9A962]' : 'text-red-500'}`}>
                              {occupancyDisplay}%
                            </span>
                          </td>
                          <td className="p-4 text-right text-sm font-medium text-[#0F172A]/70">
                            {formatCurrency(listing.adr)}
                          </td>
                          <td className="p-4 text-center">
                            {listing.rating ? (
                              <span className="text-sm font-medium text-[#C9A962] flex items-center justify-center gap-1">
                                <Star className="w-3 h-3 fill-[#C9A962]" />
                                {listing.rating.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-[#0F172A]/30">—</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <a 
                              href={listing.airbnbUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0F172A]/5 hover:bg-[#0F172A]/10 text-[#0F172A]/60 hover:text-[#0F172A] transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFavoriteListingIds(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(listing.id)) {
                                    newSet.delete(listing.id);
                                  } else {
                                    newSet.add(listing.id);
                                  }
                                  return newSet;
                                });
                              }}
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                                isFavorite
                                  ? 'bg-red-500 text-white'
                                  : 'bg-[#0F172A]/5 hover:bg-red-100 text-[#0F172A]/40 hover:text-red-500'
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-[#0F172A]/50">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredListings.length)} of {filteredListings.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="border-[#0F172A]/10"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-[#0F172A]/60 px-3">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="border-[#0F172A]/10"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              

            </div>
          )}
        </div>
        
        {/* Right Column - Map (40%) */}
        <div className="w-full lg:w-[40%] relative flex flex-col">
          {/* Map Container - fills available space */}
          <div className="flex-1 relative min-h-[400px]">
            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsMapFullscreen(true)}
              className="absolute top-4 right-4 z-10 bg-white/95 hover:bg-white p-2.5 rounded-xl shadow-lg border border-[#0F172A]/10 transition-all"
            >
              <Maximize2 className="w-5 h-5 text-[#0F172A]" />
            </button>
            
            {/* Home button */}
            {myPropertyLocation && (
              <button
                onClick={() => {
                  if (mapRef.current) {
                    mapRef.current.panTo({ lat: myPropertyLocation.lat, lng: myPropertyLocation.lng });
                    mapRef.current.setZoom(14);
                  }
                }}
                className="absolute top-4 left-4 z-10 bg-[#C9A962] hover:bg-[#b8984f] p-2.5 rounded-xl shadow-lg transition-all"
                title="Go to My Property"
              >
                <Home className="w-5 h-5 text-white" />
              </button>
            )}
            
            <MapView
              className="w-full h-full"
              initialCenter={{ lat: 39.8283, lng: -98.5795 }}
              initialZoom={4}
              onMapReady={(map) => {
                mapRef.current = map;
                // Signal that Google Maps is loaded so we can geocode
                if (!isGoogleMapsLoaded) {
                  setIsGoogleMapsLoaded(true);
                }
              }}
            />
          </div>
          
          {/* Stats Panel - Fixed at bottom of right column */}
          {filteredListings.length > 0 && (
            <div className="bg-white border-t border-[#0F172A]/10 p-4">
              {/* Compact Stats Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <DollarSign className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-[10px] font-medium text-green-700 uppercase tracking-wide">Avg Revenue</span>
                  </div>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(thresholds.average)}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-[#C9A962]/10 to-[#C9A962]/5 rounded-lg border border-[#C9A962]/20">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Calendar className="w-3.5 h-3.5 text-[#C9A962]" />
                    <span className="text-[10px] font-medium text-[#C9A962] uppercase tracking-wide">Occupancy</span>
                  </div>
                  <p className="text-lg font-bold text-[#0F172A]">{avgOccupancy}%</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Building className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-[10px] font-medium text-blue-700 uppercase tracking-wide">Nightly Rate</span>
                  </div>
                  <p className="text-lg font-bold text-blue-700">{formatCurrency(avgAdr)}</p>
                </div>
              </div>
              
              {/* Revenue Tier Legend - Compact */}
              <div className="mt-3 flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-[#0F172A]/60">Top 33% ({thresholds.topCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#C9A962]" />
                  <span className="text-[#0F172A]/60">Mid ({thresholds.middleCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-[#0F172A]/60">Bottom ({thresholds.bottomCount})</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Fullscreen Map Modal */}
      {isMapFullscreen && (
        <div className="fixed inset-0 z-50 bg-black">
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            {myPropertyLocation && (
              <button
                onClick={() => {
                  setIsMapFullscreen(false);
                  setTimeout(() => {
                    if (mapRef.current) {
                      mapRef.current.panTo({ lat: myPropertyLocation.lat, lng: myPropertyLocation.lng });
                      mapRef.current.setZoom(14);
                    }
                  }, 100);
                }}
                className="bg-[#C9A962] hover:bg-[#b8984f] p-3 rounded-xl shadow-lg"
                title="Go to My Property"
              >
                <Home className="w-6 h-6 text-white" />
              </button>
            )}
            <button
              onClick={() => setIsMapFullscreen(false)}
              className="bg-white/90 hover:bg-white p-3 rounded-xl shadow-lg"
            >
              <Minimize2 className="w-6 h-6" />
            </button>
          </div>
          <MapView
            className="w-full h-full"
            initialCenter={mapRef.current?.getCenter()?.toJSON() || { lat: 39.8283, lng: -98.5795 }}
            initialZoom={mapRef.current?.getZoom() || 4}
            onMapReady={(map) => {
              // Copy markers to fullscreen map
              if (window.google?.maps?.marker?.AdvancedMarkerElement) {
                filteredListings.forEach(listing => {
                  // Skip listings with invalid coordinates
                  if (!listing.latitude || !listing.longitude || isNaN(listing.latitude) || isNaN(listing.longitude)) {
                    return;
                  }
                  const color = getMarkerColor(listing.revenue, thresholds, null);
                  const markerElement = document.createElement('div');
                  markerElement.innerHTML = `
                    <div style="
                      background: ${color};
                      color: white;
                      padding: 6px 10px;
                      border-radius: 16px;
                      font-size: 12px;
                      font-weight: 600;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                      white-space: nowrap;
                      font-family: system-ui, -apple-system, sans-serif;
                    ">
                      ${formatCurrency(listing.revenue)}
                    </div>
                  `;
                  const marker = new google.maps.marker.AdvancedMarkerElement({
                    map: map,
                    position: { lat: listing.latitude, lng: listing.longitude },
                    title: listing.title,
                    content: markerElement.firstElementChild as HTMLElement,
                  });
                  
                  // Add click handler to show property card popup
                  marker.addListener('click', () => {
                    setSelectedListing(listing);
                    map.panTo({ lat: listing.latitude, lng: listing.longitude });
                  });
                });
                
                if (myPropertyLocation) {
                  const myPropertyElement = document.createElement('div');
                  myPropertyElement.innerHTML = `
                    <div style="
                      width: 48px;
                      height: 48px;
                      background: linear-gradient(135deg, #C9A962, #a08840);
                      border-radius: 50%;
                      border: 4px solid white;
                      box-shadow: 0 4px 16px rgba(201, 169, 98, 0.6);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                    ">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
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
                    zIndex: 1000,
                  });
                }
              }
            }}
          />
        </div>
      )}
      
      {/* Property Card Modal */}
      {selectedListing && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedListing(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Image */}
            <div className="relative h-56 bg-[#0F172A]/10">
              {selectedListing.thumbnailUrl ? (
                <img 
                  src={selectedListing.thumbnailUrl} 
                  alt={selectedListing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#C9A962]/20 to-[#0F172A]/10">
                  <Home className="w-20 h-20 text-[#C9A962]/50" />
                </div>
              )}
              {/* Close button */}
              <button
                onClick={() => setSelectedListing(null)}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              {/* Favorite button */}
              <button
                onClick={() => {
                  setFavoriteListingIds(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(selectedListing.id)) {
                      newSet.delete(selectedListing.id);
                    } else {
                      newSet.add(selectedListing.id);
                    }
                    return newSet;
                  });
                }}
                className={`absolute top-4 left-4 p-2 rounded-full transition-colors ${
                  favoriteListingIds.has(selectedListing.id)
                    ? 'bg-red-500 text-white'
                    : 'bg-black/50 hover:bg-black/70 text-white'
                }`}
              >
                <Heart className={`w-5 h-5 ${favoriteListingIds.has(selectedListing.id) ? 'fill-current' : ''}`} />
              </button>
              {/* Revenue badge */}
              <div className="absolute bottom-4 left-4 bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white px-4 py-2 rounded-xl shadow-lg">
                <div className="text-xs opacity-90">Annual Revenue</div>
                <div className="text-xl font-bold">{formatCurrency(selectedListing.revenue)}</div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {/* Title */}
              <h3 className="text-xl font-bold text-[#0F172A] mb-2 leading-tight">
                {selectedListing.title}
              </h3>
              <div className="flex items-center gap-2 text-sm text-[#0F172A]/60 mb-4">
                <span className="bg-[#0F172A]/5 px-2 py-1 rounded">
                  {selectedListing.bedrooms} BR / {selectedListing.bathrooms} BA
                </span>
                <span>{selectedListing.propertyType || 'Home'}</span>
                {selectedListing.rating && (
                  <span className="flex items-center gap-1 text-[#C9A962]">
                    <Star className="w-4 h-4 fill-[#C9A962]" />
                    {selectedListing.rating.toFixed(1)}
                  </span>
                )}
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#f8f7f4] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-[#0F172A]/60 text-sm mb-1">
                    <Calendar className="w-4 h-4" />
                    Occupancy
                  </div>
                  <div className={`text-2xl font-bold ${
                    (selectedListing.occupancy > 1 ? selectedListing.occupancy : selectedListing.occupancy * 100) >= 70 
                      ? 'text-green-600' 
                      : 'text-[#C9A962]'
                  }`}>
                    {selectedListing.occupancy > 1 ? Math.round(selectedListing.occupancy) : Math.round(selectedListing.occupancy * 100)}%
                  </div>
                </div>
                <div className="bg-[#f8f7f4] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-[#0F172A]/60 text-sm mb-1">
                    <DollarSign className="w-4 h-4" />
                    Avg Nightly Rate
                  </div>
                  <div className="text-2xl font-bold text-[#0F172A]">
                    {formatCurrency(selectedListing.adr)}
                  </div>
                </div>
                <div className="bg-[#f8f7f4] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-[#0F172A]/60 text-sm mb-1">
                    <TrendingUp className="w-4 h-4" />
                    Monthly Revenue
                  </div>
                  <div className="text-2xl font-bold text-[#0F172A]">
                    {formatCurrency(Math.round(selectedListing.revenue / 12))}
                  </div>
                </div>
                {selectedListing.distanceToMyProperty !== undefined && (
                  <div className="bg-[#f8f7f4] rounded-xl p-4">
                    <div className="flex items-center gap-2 text-[#0F172A]/60 text-sm mb-1">
                      <MapPin className="w-4 h-4" />
                      From Your Property
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatDistance(selectedListing.distanceToMyProperty)}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <a
                  href={selectedListing.airbnbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-[#0F172A] hover:bg-[#1e293b] text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  View on Airbnb
                </a>
                <button
                  onClick={() => {
                    if (mapRef.current) {
                      mapRef.current.panTo({ lat: selectedListing.latitude, lng: selectedListing.longitude });
                      mapRef.current.setZoom(17);
                    }
                    setSelectedListing(null);
                  }}
                  className="bg-[#C9A962] hover:bg-[#b8984f] text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <MapPin className="w-5 h-5" />
                  Show on Map
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
