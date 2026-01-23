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
} from 'lucide-react';

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
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
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
  
  // Refs
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // tRPC queries - using manual fetch pattern for dynamic queries
  const trpcUtils = trpc.useUtils();
  
  // Helper function to search markets
  const searchMarketsAsync = async (searchTerm: string) => {
    return trpcUtils.rental.searchMarkets.fetch({ searchTerm });
  };
  
  // Helper function to get listings
  const getListingsAsync = async (submarketId: string) => {
    return trpcUtils.compData.getListings.fetch({ submarketId });
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
  
  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Check if it's a zip code (5 digits)
        const isZipCode = /^\d{5}$/.test(searchQuery.trim());
        
        const response = await searchMarketsAsync(searchQuery);
        const results = Array.isArray(response) ? response : ((response as any)?.data || response || []);
        
        if (results.length > 0) {
          setSearchResults(results.slice(0, 10));
          setShowSearchResults(true);
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
    
    try {
      // Determine if this is a market-level or submarket-level search
      const isMarketLevel = location.type === 'market';
      const marketId = location.id || location.submarketId || location.marketId || '';
      
      console.log('[MapFirstLayout] fetchListings called:', {
        name: location.name,
        type: location.type,
        id: marketId,
        isMarketLevel
      });
      
      // Build API params for getAllListings (handles pagination to get more than 25 listings)
      const apiParams: any = { 
        submarketId: marketId, 
        isMarketLevel, 
        maxListings: 200 
      };
      
      if (apiBedroomFilter) {
        apiParams.bedrooms = apiBedroomFilter;
      }
      
      // Use getAllListings endpoint which properly handles both markets and submarkets
      const response = await fetch(`/api/trpc/compData.getAllListings?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: apiParams } }))}`);  
      const data = await response.json();
      const listingsData = data?.[0]?.result?.data?.json?.listings || [];
      
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
      console.error('Error fetching listings:', err);
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
            ${listing.distanceToMyProperty ? `<div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">📍 ${listing.distanceToMyProperty.toFixed(1)} mi from your property</div>` : ''}
            <a href="${listing.airbnbUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #C9A962; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">View on Airbnb →</a>
          </div>
        `;
        
        infoWindowRef.current!.setContent(infoContent);
        infoWindowRef.current!.open(mapRef.current, marker);
      });
      
      markersRef.current.push(marker);
    });
    
    // Add my property marker
    if (myPropertyLocation) {
      const myPropertyElement = document.createElement('div');
      myPropertyElement.innerHTML = `
        <div style="
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
      `;
      
      const myMarker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: myPropertyLocation.lat, lng: myPropertyLocation.lng },
        title: 'My Property',
        content: myPropertyElement.firstElementChild as HTMLElement,
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
  
  // Initialize from myProperty prop
  useEffect(() => {
    if (myProperty?.address) {
      setMyPropertyAddress(myProperty.address);
    }
    if (myProperty?.zipCode) {
      setSearchQuery(myProperty.zipCode);
      // Auto-search
      setTimeout(() => {
        searchMarketsAsync(myProperty.zipCode!).then((response: any) => {
          const results = Array.isArray(response) ? response : ((response as any)?.data || response || []);
          if (results.length > 0) {
            handleSelectLocation(results[0]);
          }
        });
      }, 500);
    }
  }, [myProperty]);
  
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
                      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                      border-radius: 50%;
                      border: 3px solid white;
                      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
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
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Search className="w-5 h-5 text-amber-600" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
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
                      <SelectItem value="all">All Beds</SelectItem>
                      <SelectItem value="1">1 BR</SelectItem>
                      <SelectItem value="2">2 BR</SelectItem>
                      <SelectItem value="3">3 BR</SelectItem>
                      <SelectItem value="4">4 BR</SelectItem>
                      <SelectItem value="5">5+ BR</SelectItem>
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border transition-all ${
                showFiltersPanel ? 'bg-slate-900 text-white border-slate-900' : 'bg-white/95 hover:bg-white text-slate-700 border-slate-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filters</span>
              {(bedroomFilter !== 'all' || propertyTypeFilter !== 'all' || Object.values(amenitiesFilter).some(v => v)) && (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
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
                      {[1, 2, 3, 4, 5, 6].map(br => {
                        const count = listings.filter(l => l.bedrooms === br).length;
                        return (
                          <SelectItem key={br} value={String(br)}>
                            {br} Bedroom{br !== 1 ? 's' : ''} ({count})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Property Type</Label>
                  <Select value={propertyTypeFilter} onValueChange={setPropertyTypeFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {Array.from(new Set(listings.map(l => l.propertyType))).filter(Boolean).sort().map(type => (
                        <SelectItem key={type} value={type!}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {myPropertyLocation && (
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Max Distance</Label>
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
                
                {/* Amenities Filter */}
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Amenities</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setAmenitiesFilter(prev => ({ ...prev, pool: !prev.pool }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        amenitiesFilter.pool
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Waves className="w-3.5 h-3.5" />
                      Pool
                      {amenitiesFilter.pool && <Check className="w-3 h-3 ml-auto" />}
                    </button>
                    <button
                      onClick={() => setAmenitiesFilter(prev => ({ ...prev, hotTub: !prev.hotTub }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        amenitiesFilter.hotTub
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Thermometer className="w-3.5 h-3.5" />
                      Hot Tub
                      {amenitiesFilter.hotTub && <Check className="w-3 h-3 ml-auto" />}
                    </button>
                    <button
                      onClick={() => setAmenitiesFilter(prev => ({ ...prev, petFriendly: !prev.petFriendly }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        amenitiesFilter.petFriendly
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <PawPrint className="w-3.5 h-3.5" />
                      Pets OK
                      {amenitiesFilter.petFriendly && <Check className="w-3 h-3 ml-auto" />}
                    </button>
                    <button
                      onClick={() => setAmenitiesFilter(prev => ({ ...prev, parking: !prev.parking }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        amenitiesFilter.parking
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Car className="w-3.5 h-3.5" />
                      Parking
                      {amenitiesFilter.parking && <Check className="w-3 h-3 ml-auto" />}
                    </button>
                    <button
                      onClick={() => setAmenitiesFilter(prev => ({ ...prev, kitchen: !prev.kitchen }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        amenitiesFilter.kitchen
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <UtensilsCrossed className="w-3.5 h-3.5" />
                      Kitchen
                      {amenitiesFilter.kitchen && <Check className="w-3 h-3 ml-auto" />}
                    </button>
                    <button
                      onClick={() => setAmenitiesFilter(prev => ({ ...prev, washerDryer: !prev.washerDryer }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        amenitiesFilter.washerDryer
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <WashingMachine className="w-3.5 h-3.5" />
                      Washer
                      {amenitiesFilter.washerDryer && <Check className="w-3 h-3 ml-auto" />}
                    </button>
                  </div>
                  {Object.values(amenitiesFilter).some(v => v) && (
                    <button
                      onClick={() => setAmenitiesFilter({ pool: false, hotTub: false, petFriendly: false, parking: false, kitchen: false, washerDryer: false })}
                      className="w-full mt-2 text-xs text-slate-500 hover:text-slate-700"
                    >
                      Clear amenities
                    </button>
                  )}
                </div>
                
                {/* Comp Set Mode */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Custom Comp Set</Label>
                    <Switch checked={showCompSetMode} onCheckedChange={setShowCompSetMode} />
                  </div>
                  {showCompSetMode && excludedListingIds.size > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExcludedListingIds(new Set())}
                      className="w-full mt-2 text-xs"
                    >
                      Reset ({excludedListingIds.size} excluded)
                    </Button>
                  )}
                </div>
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
          
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-30">
              <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-[#C9A962] animate-spin" />
                <div className="text-center">
                  <p className="font-semibold text-slate-800">Loading Properties</p>
                  <p className="text-sm text-slate-500">Fetching comparable listings...</p>
                </div>
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
        
        {/* Table Section - Below Map */}
        {filteredListings.length > 0 && !embedded && (
          <div className="flex-1 bg-white border-t border-slate-200">
            <div className="container py-6">
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
                
                {/* Location Privacy Note */}
                <div className="hidden md:flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                  <Info className="w-4 h-4" />
                  Locations are approximate (~1km offset) for privacy
                </div>
              </div>
              
              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left p-3 font-semibold text-slate-700">Property</th>
                      <th className="text-center p-3 font-semibold text-slate-700">BR/BA</th>
                      <th className="text-right p-3 font-semibold text-slate-700">
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
                      <th className="text-right p-3 font-semibold text-slate-700">
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
                      <th className="text-right p-3 font-semibold text-slate-700">ADR</th>
                      <th className="text-center p-3 font-semibold text-slate-700">Rating</th>
                      {myPropertyLocation && (
                        <th className="text-right p-3 font-semibold text-slate-700">Distance</th>
                      )}
                      <th className="text-center p-3 font-semibold text-slate-700">Link</th>
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
                          {myPropertyLocation && (
                            <td className="p-3 text-right font-semibold text-blue-600">
                              {listing.distanceToMyProperty !== undefined 
                                ? formatDistance(listing.distanceToMyProperty)
                                : '—'}
                            </td>
                          )}
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
              
              {/* Pagination */}
              {totalPages > 1 && (
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
