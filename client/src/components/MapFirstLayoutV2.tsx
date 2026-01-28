/**
 * MapFirstLayoutV2 - AirDNA-inspired two-column layout
 * 
 * Features:
 * - Table on LEFT (60%), Map on RIGHT (40%)
 * - Table is the primary focus with horizontal columns
 * - Distance filter from user's property
 * - Distinct property marker on map
 * - Guiding question at top
 * - Tooltips for all metrics
 */

import { useState, useEffect, useRef, useMemo } from 'react';
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
  if (revenue >= thresholds.low) return '#f59e0b';
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
  const [bedroomFilter, setBedroomFilter] = useState('all');
  const [distanceFilter, setDistanceFilter] = useState('all');
  const [sortBy, setSortBy] = useState<string>('revenue-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [favoriteListingIds, setFavoriteListingIds] = useState<Set<string>>(new Set());
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [propertyAddressInput, setPropertyAddressInput] = useState('');
  const [myPropertyLocation, setMyPropertyLocation] = useState<{address: string; lat: number; lng: number} | null>(null);
  
  // Refs
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const myPropertyMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  
  // API - First search for markets to get the market ID
  // Use marketExplorer.searchMarkets which has better fallback handling
  const marketsQuery = trpc.marketExplorer.searchMarkets.useQuery(
    { query: searchQuery, limit: 5 },
    { enabled: searchQuery.length >= 3 }
  );
  
  // Get the first market ID from search results
  // marketExplorer.searchMarkets returns an array directly, not wrapped in success/data
  const marketId = marketsQuery.data?.[0]?.id;
  
  // Then fetch listings for that market using marketExplorer.getListings
  const listingsQuery = trpc.marketExplorer.getListings.useQuery(
    { marketId: marketId || '', marketType: 'market', limit: 100 },
    { enabled: !!marketId }
  );
  
  // Update listings when query returns
  useEffect(() => {
    if (listingsQuery.data?.listings) {
      let processedListings = listingsQuery.data.listings.map((l: any) => ({
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
        distanceToMyProperty: myPropertyLocation 
          ? calculateDistance(myPropertyLocation.lat, myPropertyLocation.lng, l.latitude, l.longitude)
          : undefined
      }));
      
      // Filter out $0 revenue properties
      processedListings = processedListings.filter((l: Listing) => l.revenue > 0);
      
      setListings(processedListings);
      setLocationName(searchQuery);
    }
  }, [listingsQuery.data, myPropertyLocation]);
  
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
  const filteredListings = useMemo(() => {
    let result = [...listings];
    
    // Distance filter
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
  }, [listings, distanceFilter, sortBy, myPropertyLocation]);
  
  // Calculate thresholds
  const thresholds = useMemo(() => {
    if (filteredListings.length === 0) return { high: 0, low: 0, average: 0 };
    const revenues = filteredListings.map(l => l.revenue).sort((a, b) => b - a);
    const avg = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const highIdx = Math.floor(revenues.length * 0.33);
    const lowIdx = Math.floor(revenues.length * 0.67);
    return {
      high: revenues[highIdx] || avg,
      low: revenues[lowIdx] || avg * 0.5,
      average: avg
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
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          white-space: nowrap;
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
      
      markersRef.current.push(marker);
    });
    
    // Add my property marker
    if (myPropertyLocation && !myPropertyMarkerRef.current) {
      const myPropertyElement = document.createElement('div');
      myPropertyElement.innerHTML = `
        <div style="
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #F59E0B, #D97706);
          border-radius: 50%;
          border: 4px solid white;
          box-shadow: 0 4px 16px rgba(245, 158, 11, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
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
  
  // Initialize from context
  useEffect(() => {
    if (myProperty?.latitude && myProperty?.longitude && !myPropertyLocation) {
      setMyPropertyLocation({
        address: myProperty.address || '',
        lat: myProperty.latitude,
        lng: myProperty.longitude
      });
      if (myProperty.city) {
        setSearchQuery(`${myProperty.city}, ${myProperty.state || ''}`);
      }
    }
  }, [myProperty]);
  
  const handleSearch = () => {
    if (searchQuery.length > 2) {
      listingsQuery.refetch();
    }
  };
  
  const hasProperty = !!myPropertyLocation;
  
  return (
    <div className={`${embedded ? 'h-full' : ''} bg-white ${className}`}>
      {/* Header with Guiding Question */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white py-6 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl font-semibold mb-1">How does my property compare to nearby competition?</h2>
          <p className="text-slate-300 text-sm">
            See revenue, occupancy, and ADR for comparable properties in your market
          </p>
        </div>
      </div>
      
      {/* Set Your Property Section - shown when no property is set */}
      {!myPropertyLocation && (
        <div className="bg-amber-50 border-b border-amber-200 py-4 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                <Home className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900">Set Your Property First</h3>
                <p className="text-sm text-amber-700">Enter your address to see distance-based comparisons</p>
              </div>
            </div>
            <div className="flex gap-3 max-w-xl">
              <AddressAutocomplete
                value={propertyAddressInput}
                onChange={setPropertyAddressInput}
                onSelect={(address, placeId, details) => {
                  if (details) {
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
                    if (details.city) {
                      setSearchQuery(`${details.city}, ${details.state || ''}`.trim());
                    }
                    if (mapRef.current && details.lat && details.lng) {
                      mapRef.current.panTo({ lat: details.lat, lng: details.lng });
                      mapRef.current.setZoom(12);
                    }
                    setPropertyAddressInput('');
                  }
                }}
                placeholder="Enter your property address..."
                className="flex-1"
                inputClassName="bg-white border-amber-300 focus:border-amber-500"
                variant="light"
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Your Property Banner - shown when property is set */}
      {myPropertyLocation && (
        <div className="bg-blue-600 text-white py-3 px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Home className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-medium">Your Property:</span>
                <span className="ml-2 text-sm">{myPropertyLocation.address}</span>
              </div>
            </div>
            <button
              onClick={() => {
                if (mapRef.current) {
                  mapRef.current.panTo({ lat: myPropertyLocation.lat, lng: myPropertyLocation.lng });
                  mapRef.current.setZoom(14);
                }
              }}
              className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              Center on Map
            </button>
          </div>
        </div>
      )}
      
      {/* Search and Filters Bar */}
      <div className="border-b border-slate-200 py-4 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px] max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search city, zip, or market..."
                  className="pl-10 pr-4"
                />
              </div>
            </div>
            
            <Button onClick={handleSearch} disabled={listingsQuery.isFetching}>
              {listingsQuery.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </Button>
            
            {/* Filters */}
            <div className="flex items-center gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
                        <SelectTrigger className="w-[120px]">
                          <BedDouble className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="Bedrooms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All BR</SelectItem>
                          <SelectItem value="1">1 BR</SelectItem>
                          <SelectItem value="2">2 BR</SelectItem>
                          <SelectItem value="3">3 BR</SelectItem>
                          <SelectItem value="4">4 BR</SelectItem>
                          <SelectItem value="5">5+ BR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white">
                    <p>Filter by number of bedrooms to compare similar properties</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {hasProperty && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Select value={distanceFilter} onValueChange={setDistanceFilter}>
                          <SelectTrigger className="w-[140px]">
                            <MapPin className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Distance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any Distance</SelectItem>
                            <SelectItem value="1">Within 1 mi</SelectItem>
                            <SelectItem value="3">Within 3 mi</SelectItem>
                            <SelectItem value="5">Within 5 mi</SelectItem>
                            <SelectItem value="10">Within 10 mi</SelectItem>
                            <SelectItem value="25">Within 25 mi</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white">
                      <p>Filter properties by distance from your property</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[150px]">
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
                  <TooltipContent className="bg-slate-900 text-white">
                    <p>Sort properties to find the best performers</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content - Two Column Layout */}
      <div className="flex flex-col lg:flex-row min-h-[600px]">
        {/* Left Column - Table (60%) */}
        <div className="w-full lg:w-[60%] overflow-auto border-r border-slate-200">
          {listingsQuery.isFetching ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                <p className="text-slate-600">Loading properties...</p>
              </div>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-6">
                <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No Properties Found</h3>
                <p className="text-slate-500 mb-4">Search for a city, zip code, or market to see comparable properties</p>
              </div>
            </div>
          ) : (
            <div className="p-4">
              {/* Table Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {filteredListings.length} Properties
                    {locationName && <span className="font-normal text-slate-500"> in {locationName}</span>}
                  </h3>
                  {favoriteListingIds.size > 0 && (
                    <span className="text-sm text-red-600">
                      <Heart className="w-3 h-3 inline mr-1 fill-current" />
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
              
              {/* Table */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left p-3 font-semibold text-slate-700">Property</th>
                      <th className="text-center p-3 font-semibold text-slate-700 w-16">BR/BA</th>
                      {hasProperty && (
                        <th className="text-right p-3 font-semibold text-slate-700 w-20">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Dist
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white">
                                <p>Distance from your property in miles</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </th>
                      )}
                      <th className="text-right p-3 font-semibold text-slate-700 w-24">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button 
                                onClick={() => setSortBy(sortBy === 'revenue-desc' ? 'revenue-asc' : 'revenue-desc')}
                                className="inline-flex items-center gap-1 hover:text-emerald-600"
                              >
                                Revenue
                                {sortBy.startsWith('revenue') && (
                                  sortBy === 'revenue-desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white">
                              <p>Estimated annual revenue from short-term rentals</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </th>
                      <th className="text-right p-3 font-semibold text-slate-700 w-20">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button 
                                onClick={() => setSortBy(sortBy === 'occupancy-desc' ? 'occupancy-asc' : 'occupancy-desc')}
                                className="inline-flex items-center gap-1 hover:text-amber-600"
                              >
                                Occ
                                {sortBy.startsWith('occupancy') && (
                                  sortBy === 'occupancy-desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white">
                              <p>Occupancy rate - percentage of nights booked</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </th>
                      <th className="text-right p-3 font-semibold text-slate-700 w-20">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>ADR</TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white">
                              <p>Average Daily Rate - typical nightly price</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </th>
                      <th className="text-center p-3 font-semibold text-slate-700 w-14">
                        <Star className="w-4 h-4 mx-auto" />
                      </th>
                      <th className="text-center p-3 w-10"></th>
                      <th className="text-center p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedListings.map((listing) => {
                      const markerColor = getMarkerColor(listing.revenue, thresholds, null);
                      const occupancyDisplay = listing.occupancy > 1 ? Math.round(listing.occupancy) : Math.round(listing.occupancy * 100);
                      const isFavorite = favoriteListingIds.has(listing.id);
                      
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
                                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                  <Home className="w-5 h-5 text-slate-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900 truncate max-w-[180px]" title={listing.title}>
                                  {listing.title}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {listing.propertyType || 'home'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-sm font-medium text-slate-700">
                              {listing.bedrooms}/{listing.bathrooms}
                            </span>
                          </td>
                          {hasProperty && (
                            <td className="p-3 text-right">
                              <span className="text-sm font-medium text-blue-600">
                                {listing.distanceToMyProperty !== undefined 
                                  ? formatDistance(listing.distanceToMyProperty)
                                  : '—'}
                              </span>
                            </td>
                          )}
                          <td className="p-3 text-right">
                            <span className="text-sm font-bold" style={{ color: markerColor }}>
                              {formatCurrency(listing.revenue)}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className={`text-sm font-semibold ${occupancyDisplay >= 70 ? 'text-green-600' : occupancyDisplay >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                              {occupancyDisplay}%
                            </span>
                          </td>
                          <td className="p-3 text-right text-sm font-medium text-slate-700">
                            {formatCurrency(listing.adr)}
                          </td>
                          <td className="p-3 text-center">
                            {listing.rating ? (
                              <span className="text-sm font-medium text-amber-700">{listing.rating.toFixed(1)}</span>
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
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </td>
                          <td className="p-3 text-center">
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
                                  : 'bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500'
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
                <div className="px-3 py-2 bg-emerald-50 rounded-lg text-sm border border-emerald-100">
                  <span className="text-slate-500">Avg Revenue:</span>
                  <span className="font-bold text-emerald-600 ml-1">{formatCurrency(thresholds.average)}</span>
                </div>
                <div className="px-3 py-2 bg-amber-50 rounded-lg text-sm border border-amber-100">
                  <span className="text-slate-500">Avg Occupancy:</span>
                  <span className="font-bold text-amber-600 ml-1">
                    {filteredListings.length > 0 
                      ? Math.round(filteredListings.reduce((sum, l) => sum + (l.occupancy > 1 ? l.occupancy : l.occupancy * 100), 0) / filteredListings.length)
                      : 0}%
                  </span>
                </div>
                <div className="px-3 py-2 bg-blue-50 rounded-lg text-sm border border-blue-100">
                  <span className="text-slate-500">Avg ADR:</span>
                  <span className="font-bold text-blue-600 ml-1">
                    {filteredListings.length > 0 
                      ? formatCurrency(filteredListings.reduce((sum, l) => sum + l.adr, 0) / filteredListings.length)
                      : '$0'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Right Column - Map (40%) */}
        <div className="w-full lg:w-[40%] relative min-h-[400px] lg:min-h-[600px]">
          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsMapFullscreen(true)}
            className="absolute top-4 right-4 z-10 bg-white/90 hover:bg-white p-2 rounded-lg shadow-lg"
          >
            <Maximize2 className="w-5 h-5" />
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
              className="absolute top-4 left-4 z-10 bg-amber-500 hover:bg-amber-600 p-2 rounded-lg shadow-lg"
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
            }}
          />
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
                className="bg-amber-500 hover:bg-amber-600 p-3 rounded-xl shadow-lg"
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
                      padding: 4px 8px;
                      border-radius: 12px;
                      font-size: 11px;
                      font-weight: 600;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                      white-space: nowrap;
                    ">
                      ${formatCurrency(listing.revenue)}
                    </div>
                  `;
                  new google.maps.marker.AdvancedMarkerElement({
                    map: map,
                    position: { lat: listing.latitude, lng: listing.longitude },
                    title: listing.title,
                    content: markerElement.firstElementChild as HTMLElement,
                  });
                });
                
                if (myPropertyLocation) {
                  const myPropertyElement = document.createElement('div');
                  myPropertyElement.innerHTML = `
                    <div style="
                      width: 44px;
                      height: 44px;
                      background: linear-gradient(135deg, #F59E0B, #D97706);
                      border-radius: 50%;
                      border: 4px solid white;
                      box-shadow: 0 4px 16px rgba(245, 158, 11, 0.6);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                    ">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
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
    </div>
  );
}
