import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapView } from '@/components/Map';
import { HierarchicalLocationSelector, LocationSelection } from '@/components/HierarchicalLocationSelector';
import { AddressAutocomplete, PlaceDetails } from '@/components/AddressAutocomplete';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/contexts/PropertyContext';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Map, MapPin, DollarSign, Info, BedDouble, Home, Navigation, ArrowUpDown, Building2, ExternalLink, Star, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Table2, Maximize2, Minimize2, X, Download } from 'lucide-react';
import { ExportListings } from '@/components/ExportListings';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PropertyListing {
  id: string;
  title: string;
  revenue: number;
  occupancy: number;
  adr: number;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  rating: number | null;
  reviews: number;
  latitude: number;
  longitude: number;
  propertyType: string;
  airbnbUrl: string;
  thumbnailUrl: string | null;
  distanceToMyProperty?: number;
}

interface RevenueThresholds {
  high: number;
  low: number;
  average: number;
  topCount?: number;
  middleCount?: number;
  bottomCount?: number;
}

interface MyPropertyLocation {
  address: string;
  lat: number;
  lng: number;
}

interface MapViewContentProps {
  embedded?: boolean; // If true, removes the header for embedded use
  className?: string;
}

function calculateThresholds(listings: PropertyListing[]): RevenueThresholds {
  if (listings.length === 0) {
    return { high: 100000, low: 50000, average: 75000, topCount: 0, middleCount: 0, bottomCount: 0 };
  }
  
  const revenues = listings.map(l => l.revenue).sort((a, b) => a - b);
  const average = revenues.reduce((sum, r) => sum + r, 0) / revenues.length;
  
  const lowIndex = Math.floor(revenues.length * 0.33);
  const highIndex = Math.floor(revenues.length * 0.67);
  
  const lowThreshold = revenues[lowIndex] || average * 0.7;
  const highThreshold = revenues[highIndex] || average * 1.3;
  
  // Count properties in each tier
  const topCount = listings.filter(l => l.revenue >= highThreshold).length;
  const middleCount = listings.filter(l => l.revenue >= lowThreshold && l.revenue < highThreshold).length;
  const bottomCount = listings.filter(l => l.revenue < lowThreshold).length;
  
  return {
    low: lowThreshold,
    high: highThreshold,
    average: Math.round(average),
    topCount,
    middleCount,
    bottomCount,
  };
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} ft`;
  } else if (miles < 1) {
    return `${(miles).toFixed(2)} mi`;
  } else {
    return `${(miles).toFixed(1)} mi`;
  }
}

function getMarkerColor(revenue: number, thresholds: RevenueThresholds, customThreshold: number | null): string {
  if (customThreshold !== null) {
    return revenue >= customThreshold ? '#16a34a' : '#9ca3af';
  }
  
  if (revenue >= thresholds.high) return '#16a34a';
  if (revenue >= thresholds.low) return '#f59e0b';
  return '#ef4444';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${Math.round(amount / 1000)}K`;
  }
  return `$${amount}`;
}

function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function createMarkerElement(color: string, revenue: number): HTMLDivElement {
  const markerElement = document.createElement('div');
  markerElement.innerHTML = `
    <div style="
      position: relative;
      cursor: pointer;
      transition: transform 0.2s ease;
    " class="property-marker">
      <div style="
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, ${color} 0%, ${adjustColor(color, -20)} 100%);
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          color: white;
          font-size: 10px;
          font-weight: 700;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        ">${formatCompactCurrency(revenue)}</span>
      </div>
      <div style="
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid white;
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));
      "></div>
    </div>
  `;
  
  const marker = markerElement.querySelector('.property-marker') as HTMLElement;
  if (marker) {
    marker.addEventListener('mouseenter', () => {
      marker.style.transform = 'scale(1.15)';
    });
    marker.addEventListener('mouseleave', () => {
      marker.style.transform = 'scale(1)';
    });
  }
  
  return markerElement;
}

function createMyPropertyMarker(): HTMLDivElement {
  const markerElement = document.createElement('div');
  markerElement.innerHTML = `
    <div style="
      position: relative;
      cursor: pointer;
      animation: pulse 2s infinite;
    " class="my-property-marker">
      <div style="
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        border: 4px solid white;
        border-radius: 50%;
        box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5), 0 4px 8px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </div>
      <div style="
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 10px solid white;
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));
      "></div>
      <div style="
        position: absolute;
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        background: #3b82f6;
        color: white;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 10px;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      ">MY PROPERTY</div>
    </div>
    <style>
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    </style>
  `;
  
  return markerElement;
}

export function MapViewContent({ embedded = false, className = '' }: MapViewContentProps) {
  console.log('[MapViewContent] Component rendering');
  
  // Property context for property-centric workflow
  const { myProperty, hasProperty, bedroomFilter: contextBedroomFilter, enforceApplesToApples } = useProperty();
  
  console.log('[MapViewContent] Property context:', { hasProperty, myProperty: myProperty ? { address: myProperty.address, zipCode: myProperty.zipCode } : null });
  
  const [locationSelection, setLocationSelection] = useState<LocationSelection | null>(null);
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useCustomThreshold, setUseCustomThreshold] = useState(false);
  const [customThreshold, setCustomThreshold] = useState<number>(50000);
  const [selectedProperty, setSelectedProperty] = useState<PropertyListing | null>(null);
  const [bedroomFilter, setBedroomFilter] = useState<string>('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('revenue-desc');
  const [distanceFilter, setDistanceFilter] = useState<string>('all');
  const [apiBedroomFilter, setApiBedroomFilter] = useState<number | null>(null); // API-level bedroom filter (1, 2, 3, etc.)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 25;
  
  // Custom comp set - track which listings are excluded from the view
  const [excludedListingIds, setExcludedListingIds] = useState<Set<string>>(new Set());
  const [showCompSetMode, setShowCompSetMode] = useState(false);
  
  const [myPropertyAddress, setMyPropertyAddress] = useState<string>('');
  const [myPropertyLocation, setMyPropertyLocation] = useState<MyPropertyLocation | null>(null);
  const [isGeocodingMyProperty, setIsGeocodingMyProperty] = useState(false);
  const [myPropertyError, setMyPropertyError] = useState<string | null>(null);
  
  // Track if we've auto-populated from context
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false);
  const [lastPropertyId, setLastPropertyId] = useState<string | null>(null);
  
  // Track when marker library is ready
  const [markerLibraryReady, setMarkerLibraryReady] = useState(false);
  
  // Fullscreen map state
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  
  // Location quality data
  const locationQualityQuery = trpc.rental.getLocationQuality.useQuery(
    { lat: myPropertyLocation?.lat || 0, lng: myPropertyLocation?.lng || 0 },
    { enabled: !!myPropertyLocation }
  );
  
  // Reset auto-populated state when property changes
  useEffect(() => {
    const currentPropertyId = myProperty?.address || null;
    console.log('[MapView] Property check:', { currentPropertyId, lastPropertyId, hasAutoPopulated });
    if (currentPropertyId !== lastPropertyId) {
      console.log('[MapView] Property changed, resetting hasAutoPopulated');
      setHasAutoPopulated(false);
      setLastPropertyId(currentPropertyId);
    }
  }, [myProperty?.address, lastPropertyId, hasAutoPopulated]);
  
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const myPropertyMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  
  const filteredListings = useMemo(() => {
    // Apply bedroom filter
    let filtered = bedroomFilter === 'all' ? listings : listings.filter(l => l.bedrooms === parseInt(bedroomFilter));
    
    // Apply property type filter
    if (propertyTypeFilter !== 'all') {
      filtered = filtered.filter(l => l.propertyType === propertyTypeFilter);
    }
    
    // Apply custom comp set exclusions
    if (excludedListingIds.size > 0) {
      filtered = filtered.filter(l => !excludedListingIds.has(l.id));
    }
    
    // Calculate distance if my property is set
    if (myPropertyLocation) {
      filtered = filtered.map(l => ({
        ...l,
        distanceToMyProperty: calculateDistance(
          myPropertyLocation.lat,
          myPropertyLocation.lng,
          l.latitude,
          l.longitude
        )
      }));
      
      // Apply distance filter (only when my property is set)
      if (distanceFilter !== 'all') {
        const maxDistance = parseFloat(distanceFilter);
        filtered = filtered.filter(l => (l.distanceToMyProperty || Infinity) <= maxDistance);
      }
    }
    
    // Apply sorting
    const [sortField, sortDirection] = sortBy.split('-');
    filtered = [...filtered].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case 'revenue':
          aVal = a.revenue;
          bVal = b.revenue;
          break;
        case 'occupancy':
          aVal = a.occupancy;
          bVal = b.occupancy;
          break;
        case 'rating':
          aVal = a.rating || 0;
          bVal = b.rating || 0;
          break;
        case 'distance':
          aVal = a.distanceToMyProperty || Infinity;
          bVal = b.distanceToMyProperty || Infinity;
          break;
        case 'adr':
          aVal = a.adr;
          bVal = b.adr;
          break;
        default:
          aVal = a.revenue;
          bVal = b.revenue;
      }
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });
    
    return filtered;
  }, [listings, bedroomFilter, propertyTypeFilter, myPropertyLocation, sortBy, distanceFilter, excludedListingIds]);
  
  const thresholds = useMemo(() => calculateThresholds(filteredListings), [filteredListings]);
  
  // Paginated listings for table display
  const totalPages = Math.ceil(filteredListings.length / ITEMS_PER_PAGE);
  const paginatedListings = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredListings.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredListings, currentPage]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [bedroomFilter, propertyTypeFilter, distanceFilter, sortBy]);
  
  const geocodeMyProperty = useCallback(async () => {
    if (!myPropertyAddress.trim()) {
      setMyPropertyError('Please enter an address');
      return;
    }
    
    if (!geocoderRef.current && window.google) {
      geocoderRef.current = new google.maps.Geocoder();
    }
    
    if (!geocoderRef.current) {
      setMyPropertyError('Geocoder not available. Please try again.');
      return;
    }
    
    setIsGeocodingMyProperty(true);
    setMyPropertyError(null);
    
    try {
      const result = await geocoderRef.current.geocode({ address: myPropertyAddress });
      
      if (result.results && result.results.length > 0) {
        const location = result.results[0].geometry.location;
        const newLocation = {
          address: result.results[0].formatted_address,
          lat: location.lat(),
          lng: location.lng()
        };
        setMyPropertyLocation(newLocation);
        setMyPropertyAddress(result.results[0].formatted_address);
        
        if (mapRef.current) {
          mapRef.current.panTo({ lat: newLocation.lat, lng: newLocation.lng });
        }
      } else {
        setMyPropertyError('Address not found. Please try a different address.');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setMyPropertyError('Failed to geocode address. Please try again.');
    } finally {
      setIsGeocodingMyProperty(false);
    }
  }, [myPropertyAddress]);
  
  const clearMyProperty = useCallback(() => {
    setMyPropertyLocation(null);
    setMyPropertyAddress('');
    setMyPropertyError(null);
    
    if (myPropertyMarkerRef.current) {
      myPropertyMarkerRef.current.map = null;
      myPropertyMarkerRef.current = null;
    }
  }, []);
  
  const performSearch = useCallback(async (selection: LocationSelection) => {
    setIsLoading(true);
    setError(null);
    setListings([]);
    
    console.log('[MapView] performSearch called with selection:', JSON.stringify(selection, null, 2));
    
    try {
      let marketId: string | null = null;
      
      if (selection.submarket) {
        marketId = selection.submarket.id;
        console.log('[MapView] Using submarket ID:', marketId, 'name:', selection.submarket.name);
      } else if (selection.market) {
        marketId = selection.market.id;
        console.log('[MapView] Using market ID:', marketId, 'name:', selection.market.name);
      }
      
      if (!marketId) {
        setError('Please select a city/metro or neighborhood to view listings.');
        setIsLoading(false);
        return;
      }
      
      // Fetching listings for market
      
      // Determine if this is a market-level or submarket-level search
      // IMPORTANT: If the selected market has isSubmarketAsMarket flag, it's actually a submarket
      // (e.g., Glendale, AZ is a submarket under Phoenix/Scottsdale)
      const isSubmarketAsMarket = selection.market && (selection.market as any).isSubmarketAsMarket;
      const isMarketLevel = selection.level === 'market' && !isSubmarketAsMarket;
      // Search level determined
      
      // Build the API request with optional bedroom filter
      // Use getAllListings to fetch all available listings (bypasses 25 per page API limit)
      const apiParams: any = { submarketId: marketId, isMarketLevel, maxListings: 5000 };
      if (apiBedroomFilter) {
        apiParams.bedrooms = apiBedroomFilter;
      }
      const response = await fetch(`/api/trpc/compData.getAllListings?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: apiParams } }))}`);
      console.log('[MapView] Fetching ALL listings (up to 200) for', marketId);
      const data = await response.json();
      
      if (data?.[0]?.result?.data?.json?.listings) {
        const fetchedListings = data[0].result.data.json.listings;
        console.log('[MapView] Received', fetchedListings.length, 'listings');
        
        const listingsWithCoords = fetchedListings
          .filter((l: any) => l.latitude && l.longitude)
          .map((l: any) => ({
            id: l.id,
            title: l.title,
            revenue: l.annual_revenue || l.revenue || 0,
            occupancy: l.occupancy || 0,
            adr: l.adr || 0,
            bedrooms: l.bedrooms || 0,
            bathrooms: l.bathrooms || 0,
            accommodates: l.accommodates || 0,
            rating: l.rating,
            reviews: l.reviews || 0,
            latitude: l.latitude,
            longitude: l.longitude,
            propertyType: l.property_type || l.propertyType || 'Unknown',
            airbnbUrl: l.airbnb_url || l.airbnbUrl || '#',
            thumbnailUrl: l.image_url || l.thumbnail_url || l.thumbnailUrl || null,
          }));
        
        console.log('[MapView] Listings with coordinates:', listingsWithCoords.length);
        setListings(listingsWithCoords);
        
        if (listingsWithCoords.length > 0 && mapRef.current) {
          const bounds = new google.maps.LatLngBounds();
          listingsWithCoords.forEach((l: PropertyListing) => {
            bounds.extend({ lat: l.latitude, lng: l.longitude });
          });
          mapRef.current.fitBounds(bounds);
        }
      } else {
        console.log('[MapView] No listings in response');
        setError('No listings with coordinates found for this location. Try a different area.');
      }
    } catch (err) {
      console.error('Error fetching listings:', err);
      setError('Failed to fetch listings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [apiBedroomFilter]);
  
  const handleSearch = useCallback(() => {
    // handleSearch called
    if (locationSelection) {
      performSearch(locationSelection);
    } else {
      console.warn('[MapView] No locationSelection set!');
    }
  }, [locationSelection, performSearch]);
  
  // Center map when location selection changes
  useEffect(() => {
    if (!locationSelection || !mapRef.current) return;
    
    // If we have coordinates in the selection, use them
    if (locationSelection.coordinates) {
      console.log('[MapView] Centering map on selection coordinates:', locationSelection.coordinates);
      mapRef.current.panTo(locationSelection.coordinates);
      mapRef.current.setZoom(12);
      return;
    }
    
    // Otherwise, geocode the location name
    const locationName = locationSelection.zipcode 
      || locationSelection.submarket?.name 
      || locationSelection.market?.name;
    const stateName = locationSelection.state?.name;
    
    if (locationName && window.google) {
      const searchQuery = stateName ? `${locationName}, ${stateName}` : locationName;
      console.log('[MapView] Geocoding location for map centering:', searchQuery);
      
      if (!geocoderRef.current) {
        geocoderRef.current = new google.maps.Geocoder();
      }
      
      geocoderRef.current.geocode({ address: searchQuery })
        .then((result) => {
          if (result.results && result.results.length > 0) {
            const location = result.results[0].geometry.location;
            console.log('[MapView] Geocoded location:', location.lat(), location.lng());
            if (mapRef.current) {
              mapRef.current.panTo({ lat: location.lat(), lng: location.lng() });
              // Set zoom based on selection level
              const zoomLevel = locationSelection.zipcode ? 13 
                : locationSelection.submarket ? 12 
                : 11;
              mapRef.current.setZoom(zoomLevel);
            }
          }
        })
        .catch((err) => {
          console.error('[MapView] Geocoding error for map centering:', err);
        });
    }
  }, [locationSelection]);
  
  // Auto-populate from property context when available
  useEffect(() => {
    console.log('[MapView] Auto-populate check:', { 
      hasProperty, 
      myProperty: myProperty ? { address: myProperty.address, zipCode: myProperty.zipCode } : null,
      hasAutoPopulated 
    });
    
    if (hasProperty && myProperty && !hasAutoPopulated) {
      console.log('[MapView] Triggering auto-populate...');
      // Set the address for "My Property" marker
      if (myProperty.address) {
        setMyPropertyAddress(myProperty.address);
      }
      
      // Apply apples-to-apples bedroom filter if enabled
      if (enforceApplesToApples && contextBedroomFilter !== null) {
        setBedroomFilter(String(contextBedroomFilter));
      }
      
      // Auto-search by zip code if available
      if (myProperty.zipCode) {
        // Trigger zip code search
        const zipCode = myProperty.zipCode;
        console.log('[MapView] Auto-searching by zip code:', zipCode);
        
        // Fetch listings for this zip code
        fetch(`/api/trpc/compData.getListingsByZipcode?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { zipcode: zipCode, pageSize: 50 } } }))}`)
          .then(response => response.json())
          .then(data => {
            if (data?.[0]?.result?.data?.json?.listings) {
              const fetchedListings = data[0].result.data.json.listings;
              console.log('[MapView] Auto-search received', fetchedListings.length, 'listings for zip', zipCode);
              
              const listingsWithCoords = fetchedListings
                .filter((l: any) => l.latitude && l.longitude)
                .map((l: any) => ({
                  id: l.id,
                  title: l.title,
                  revenue: l.annual_revenue || l.revenue || 0,
                  occupancy: l.occupancy || 0,
                  adr: l.adr || 0,
                  bedrooms: l.bedrooms || 0,
                  bathrooms: l.bathrooms || 0,
                  accommodates: l.accommodates || 0,
                  rating: l.rating,
                  reviews: l.reviews || 0,
                  latitude: l.latitude,
                  longitude: l.longitude,
                  propertyType: l.property_type || l.propertyType || 'Unknown',
                  airbnbUrl: l.airbnb_url || l.airbnbUrl || '#',
                  thumbnailUrl: l.image_url || l.thumbnail_url || l.thumbnailUrl || null,
                }));
              
              setListings(listingsWithCoords);
              
              // Fit map to listings bounds
              if (listingsWithCoords.length > 0 && mapRef.current) {
                const bounds = new google.maps.LatLngBounds();
                listingsWithCoords.forEach((l: PropertyListing) => {
                  bounds.extend({ lat: l.latitude, lng: l.longitude });
                });
                mapRef.current.fitBounds(bounds);
              }
            }
          })
          .catch(err => {
            console.error('[MapView] Auto-search error:', err);
          });
      }
      
      setHasAutoPopulated(true);
    }
  }, [hasProperty, myProperty, hasAutoPopulated, enforceApplesToApples, contextBedroomFilter]);
  
  // Auto-geocode property address when map is ready and property is set
  useEffect(() => {
    // Trigger geocoding if we have a property from context but no location yet
    const addressToGeocode = myPropertyAddress || myProperty?.address;
    if (hasProperty && addressToGeocode && !myPropertyLocation && mapRef.current && window.google) {
      console.log('[MapView] Auto-geocoding property:', addressToGeocode);
      // Initialize geocoder if needed
      if (!geocoderRef.current) {
        geocoderRef.current = new google.maps.Geocoder();
      }
      
      // Auto-geocode the property
      geocoderRef.current.geocode({ address: addressToGeocode })
        .then((result) => {
          if (result.results && result.results.length > 0) {
            const location = result.results[0].geometry.location;
            const newLocation = {
              address: result.results[0].formatted_address,
              lat: location.lat(),
              lng: location.lng()
            };
            setMyPropertyLocation(newLocation);
            
            // Pan map to the property location
            if (mapRef.current) {
              mapRef.current.panTo({ lat: newLocation.lat, lng: newLocation.lng });
              mapRef.current.setZoom(13);
            }
          }
        })
        .catch((err) => {
          console.error('[MapView] Auto-geocode error:', err);
        });
    }
  }, [hasProperty, myProperty?.address, myPropertyAddress, myPropertyLocation, markerLibraryReady]);
  
  // Update bedroom filter when context changes
  useEffect(() => {
    if (enforceApplesToApples && contextBedroomFilter !== null) {
      setBedroomFilter(String(contextBedroomFilter));
    }
  }, [enforceApplesToApples, contextBedroomFilter]);
  
  useEffect(() => {
    if (!mapRef.current || !markerLibraryReady || !window.google?.maps?.marker?.AdvancedMarkerElement) return;
    
    if (myPropertyMarkerRef.current) {
      myPropertyMarkerRef.current.map = null;
      myPropertyMarkerRef.current = null;
    }
    
    if (myPropertyLocation) {
      const markerElement = createMyPropertyMarker();
      
      myPropertyMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: myPropertyLocation.lat, lng: myPropertyLocation.lng },
        title: 'My Property',
        content: markerElement,
        zIndex: 1000,
      });
      
      myPropertyMarkerRef.current.addListener('click', () => {
        if (!infoWindowRef.current) {
          infoWindowRef.current = new google.maps.InfoWindow();
        }
        
        const content = `
          <div style="max-width: 250px; font-family: system-ui, sans-serif; padding: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1d4ed8;">My Property</h3>
            </div>
            <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.4;">${myPropertyLocation.address}</p>
          </div>
        `;
        
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(mapRef.current, myPropertyMarkerRef.current);
      });
    }
  }, [myPropertyLocation, markerLibraryReady]);
  
  useEffect(() => {
    if (!mapRef.current || !markerLibraryReady || !window.google?.maps?.marker?.AdvancedMarkerElement) {
      console.log('[MapView] Waiting for map and marker library to be ready...', { mapReady: !!mapRef.current, markerLibraryReady });
      return;
    }
    
    markersRef.current.forEach(marker => {
      marker.map = null;
    });
    markersRef.current = [];
    
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }
    
    console.log('[MapView] Creating', filteredListings.length, 'markers (filtered from', listings.length, 'total)');
    
    filteredListings.forEach(listing => {
      const color = getMarkerColor(
        listing.revenue,
        thresholds,
        useCustomThreshold ? customThreshold : null
      );
      
      const markerElement = createMarkerElement(color, listing.revenue);
      
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: listing.latitude, lng: listing.longitude },
        title: listing.title,
        content: markerElement,
      });
      
      marker.addListener('click', () => {
        setSelectedProperty(listing);
        
        const distanceHtml = listing.distanceToMyProperty !== undefined ? `
          <div style="margin-top: 8px; padding: 8px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 6px; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
            </svg>
            <span style="font-size: 11px; color: #1d4ed8; font-weight: 600;">
              ${formatDistance(listing.distanceToMyProperty)} from your property
            </span>
          </div>
        ` : '';
        
        const content = `
          <div style="max-width: 300px; font-family: system-ui, sans-serif;">
            ${listing.thumbnailUrl ? `<img src="${listing.thumbnailUrl}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 8px 8px 0 0;" />` : ''}
            <div style="padding: 14px;">
              <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; line-height: 1.4; color: #1f2937;">${listing.title}</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
                <div style="background: #f0fdf4; padding: 8px; border-radius: 6px;">
                  <div style="color: #166534; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Annual Revenue</div>
                  <div style="font-weight: 700; color: #16a34a; font-size: 14px;">${formatCurrency(listing.revenue)}</div>
                </div>
                <div style="background: #fefce8; padding: 8px; border-radius: 6px;">
                  <div style="color: #854d0e; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Occupancy</div>
                  <div style="font-weight: 700; color: #ca8a04; font-size: 14px;">${listing.occupancy > 1 ? Math.round(listing.occupancy) : Math.round(listing.occupancy * 100)}%</div>
                </div>
                <div style="background: #f8fafc; padding: 8px; border-radius: 6px;">
                  <div style="color: #475569; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Nightly Rate</div>
                  <div style="font-weight: 700; color: #334155; font-size: 14px;">${formatCurrency(listing.adr)}</div>
                </div>
                <div style="background: #faf5ff; padding: 8px; border-radius: 6px;">
                  <div style="color: #7c3aed; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Rating</div>
                  <div style="font-weight: 700; color: #7c3aed; font-size: 14px;">${listing.rating ? `${listing.rating}/5` : 'N/A'}</div>
                </div>
              </div>
              <div style="margin-top: 10px; font-size: 11px; color: #64748b; display: flex; gap: 8px; flex-wrap: wrap;">
                <span style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px;">${listing.bedrooms} BR</span>
                <span style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px;">${listing.bathrooms} BA</span>
                <span style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px;">${listing.accommodates} guests</span>
              </div>
              ${distanceHtml}
              <a href="${listing.airbnbUrl}" target="_blank" rel="noopener noreferrer" 
                 style="display: block; margin-top: 12px; padding: 10px 14px; background: linear-gradient(135deg, #C9A962 0%, #b8984f 100%); color: white; text-align: center; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; box-shadow: 0 2px 4px rgba(201, 169, 98, 0.3);">
                View on Airbnb
              </a>
            </div>
          </div>
        `;
        
        infoWindowRef.current?.setContent(content);
        infoWindowRef.current?.open(mapRef.current, marker);
      });
      
      markersRef.current.push(marker);
    });
  }, [filteredListings, listings.length, thresholds, useCustomThreshold, customThreshold, markerLibraryReady]);
  
  const getLocationName = () => {
    if (locationSelection?.zipcode) return locationSelection.zipcode;
    if (locationSelection?.submarket) return locationSelection.submarket.name;
    if (locationSelection?.market) return locationSelection.market.name;
    return 'Select a location';
  };
  
  return (
    <>
      {/* Fullscreen Map Modal */}
      {isMapFullscreen && (
        <div className="fixed inset-0 z-50 bg-black">
          {/* Close Button */}
          <button
            onClick={() => setIsMapFullscreen(false)}
            className="absolute top-4 right-4 z-50 bg-white/90 hover:bg-white p-3 rounded-lg shadow-lg border border-slate-200 transition-all duration-200 hover:scale-105 flex items-center gap-2"
          >
            <Minimize2 className="w-5 h-5 text-slate-700" />
            <span className="text-sm font-medium text-slate-700">Exit Fullscreen</span>
          </button>
          
          {/* Legend Overlay */}
          <div className="absolute top-4 left-4 z-50 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4 max-w-xs">
            <h3 className="font-semibold text-slate-900 mb-3 text-sm">Revenue Tiers</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-slate-700">Top 33%: ≥ {formatCurrency(thresholds.high)}</span>
                </div>
                <span className="font-bold text-green-600">{thresholds.topCount || 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-slate-700">Middle 33%</span>
                </div>
                <span className="font-bold text-amber-600">{thresholds.middleCount || 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-slate-700">Bottom 33%</span>
                </div>
                <span className="font-bold text-red-600">{thresholds.bottomCount || 0}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200">
              <div className="text-xs text-slate-500">Total: <span className="font-semibold text-slate-700">{filteredListings.length} properties</span></div>
            </div>
          </div>
          
          {/* Fullscreen Map */}
          <MapView
            className="w-full h-full"
            initialCenter={mapRef.current?.getCenter()?.toJSON() || { lat: 36.1627, lng: -86.7816 }}
            initialZoom={mapRef.current?.getZoom() || 11}
            onMapReady={(map) => {
              // Copy markers to fullscreen map
              if (window.google?.maps?.marker?.AdvancedMarkerElement) {
                filteredListings.forEach(listing => {
                  const color = getMarkerColor(
                    listing.revenue,
                    thresholds,
                    useCustomThreshold ? customThreshold : null
                  );
                  const markerElement = createMarkerElement(color, listing.revenue);
                  new google.maps.marker.AdvancedMarkerElement({
                    map: map,
                    position: { lat: listing.latitude, lng: listing.longitude },
                    title: listing.title,
                    content: markerElement,
                  });
                });
                
                // Add my property marker if exists
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
                  new google.maps.marker.AdvancedMarkerElement({
                    map: map,
                    position: { lat: myPropertyLocation.lat, lng: myPropertyLocation.lng },
                    title: 'My Property',
                    content: myPropertyElement,
                  });
                }
              }
            }}
          />
        </div>
      )}
      
      <div className={`${embedded ? '' : 'min-h-screen bg-gradient-to-b from-white to-stone-50'} ${className}`}>
      {/* Header - only show if not embedded */}
      {!embedded && (
        <div className="bg-white border-b border-slate-200 py-8">
          <div className="container">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Map className="w-5 h-5 text-blue-500" />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">See the Map</h1>
            </div>
            <p className="text-slate-500 max-w-2xl">
              Visualize property performance across any market. See which neighborhoods have the highest-earning rentals at a glance.
            </p>
          </div>
        </div>
      )}
      
      <div className={embedded ? '' : 'container py-8'}>
        {/* Location Selection */}
        <Card className="mb-6 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-amber-500" />
              </div>
              Select Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HierarchicalLocationSelector
              key={myProperty?.zipCode || 'no-property'}
              onSelectionChange={setLocationSelection}
              onSearch={(selection) => {
                setLocationSelection(selection);
                performSearch(selection);
              }}
              initialZipCode={(() => {
                const zip = hasProperty && myProperty?.zipCode ? myProperty.zipCode : undefined;
                console.log('[MapViewContent] Passing initialZipCode to HierarchicalLocationSelector:', zip, 'hasProperty:', hasProperty, 'myProperty?.zipCode:', myProperty?.zipCode);
                return zip;
              })()}
              autoSearch={hasProperty && !!myProperty?.zipCode}
            />
            {/* API-Level Bedroom Filter */}
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="w-40">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  <BedDouble className="w-3 h-3 inline mr-1" />
                  Search by Bedrooms
                </Label>
                <Select 
                  value={apiBedroomFilter?.toString() || 'all'} 
                  onValueChange={(val) => setApiBedroomFilter(val === 'all' ? null : parseInt(val))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Sizes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sizes</SelectItem>
                    <SelectItem value="1">1 Bedroom</SelectItem>
                    <SelectItem value="2">2 Bedrooms</SelectItem>
                    <SelectItem value="3">3 Bedrooms</SelectItem>
                    <SelectItem value="4">4 Bedrooms</SelectItem>
                    <SelectItem value="5">5 Bedrooms</SelectItem>
                    <SelectItem value="6">6+ Bedrooms</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleSearch}
                disabled={!locationSelection || isLoading}
                className="bg-[#C9A962] hover:bg-[#b8984f] text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Map className="w-4 h-4 mr-2" />
                    Show on Map
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        
        {/* Map and Controls */}
        <div className="flex flex-col xl:flex-row gap-6 overflow-visible">
          {/* Map - Show AFTER controls on all screen sizes */}
          <div className="order-2 xl:order-2 xl:flex-1">
            <Card className="overflow-hidden relative">
              <MapView
                className="h-[400px] md:h-[500px] xl:h-[600px]"
                initialCenter={{ lat: 36.1627, lng: -86.7816 }}
                initialZoom={11}
                onMapReady={(map) => {
                  mapRef.current = map;
                  if (window.google) {
                    geocoderRef.current = new google.maps.Geocoder();
                    
                    // Check if marker library is ready, poll if not
                    const checkMarkerLibrary = () => {
                      if (window.google?.maps?.marker?.AdvancedMarkerElement) {
                        console.log('[MapView] Marker library is ready');
                        setMarkerLibraryReady(true);
                      } else {
                        console.log('[MapView] Waiting for marker library...');
                        setTimeout(checkMarkerLibrary, 100);
                      }
                    };
                    checkMarkerLibrary();
                  }
                }}
              />
              
              {/* Fullscreen Toggle Button */}
              <button
                onClick={() => setIsMapFullscreen(true)}
                className="absolute top-3 right-3 z-10 bg-white/90 hover:bg-white p-2 rounded-lg shadow-md border border-slate-200 transition-all duration-200 hover:scale-105"
                title="Expand to fullscreen"
              >
                <Maximize2 className="w-5 h-5 text-slate-700" />
              </button>
              
              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                  <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-[#C9A962] animate-spin" />
                    <div className="text-center">
                      <p className="font-semibold text-gray-800">Loading Properties</p>
                      <p className="text-sm text-muted-foreground">Fetching comparable listings...</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
            
            {listings.length === 0 && !isLoading && (
              <div className="mt-4 text-center text-muted-foreground">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Select a location and click "Show on Map" to see property markers</p>
              </div>
            )}
          </div>
          
          {/* Legend and Controls - Show BEFORE map on all screen sizes */}
          <div className="order-1 xl:order-1 xl:w-80 xl:flex-shrink-0 space-y-4 overflow-visible">
            {/* My Property Section - Compact view when property is set from context */}
            {hasProperty && myProperty ? (
              <Card className="border-blue-200 bg-white">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <Home className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-500 font-medium">Your Property</div>
                      <div className="text-sm font-semibold text-slate-900 truncate">{myProperty.address}</div>
                      <div className="text-xs text-slate-500">
                        {myProperty.bedrooms}BR / {myProperty.bathrooms}BA
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200 bg-white overflow-visible">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Home className="w-4 h-4 text-blue-500" />
                    </div>
                    My Property
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 overflow-visible">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-xs text-slate-500 cursor-help underline decoration-dotted">
                          Enter your property address or paste a Zillow/Redfin URL to see competitors nearby.
                        </p>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold">How to use this feature:</p>
                        <ul className="text-xs mt-1 space-y-1">
                          <li>• Type your property address and select from suggestions</li>
                          <li>• Or paste a Zillow/Redfin listing URL</li>
                          <li>• We'll show all competitors within the area with distance from your property</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                        setMyPropertyError(null);
                      } else {
                        // Fallback to geocoding if no lat/lng in details
                        geocodeMyProperty();
                      }
                    }}
                    placeholder="Enter your address..."
                    inputClassName="text-sm"
                    variant="light"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button
                      onClick={geocodeMyProperty}
                      disabled={isGeocodingMyProperty || !myPropertyAddress.trim() || !!myPropertyLocation}
                      size="sm"
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      {isGeocodingMyProperty ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Navigation className="w-3 h-3 mr-1" />
                      )}
                      {myPropertyLocation ? 'Location Set' : 'Set Location'}
                    </Button>
                    {myPropertyLocation && (
                      <Button
                        onClick={clearMyProperty}
                        size="sm"
                        variant="outline"
                        className="text-red-500 border-red-200 hover:bg-red-50"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  {myPropertyError && (
                    <p className="text-xs text-red-600">{myPropertyError}</p>
                  )}
                  {myPropertyLocation && (
                    <div className="p-3 bg-blue-50 rounded-xl text-xs border border-blue-100">
                      <div className="font-semibold text-blue-700 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Location Set
                      </div>
                      <div className="truncate text-blue-600 mt-1">{myPropertyLocation.address}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Threshold Controls */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                  </div>
                  Revenue Thresholds
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-4 h-4 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold">What are revenue thresholds?</p>
                        <p className="text-xs mt-1">We color-code properties on the map based on their annual revenue. Green = top performers, Amber = middle tier, Red = lower performers. This helps you quickly identify high-earning areas.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="custom-mode" className="text-sm">Custom Threshold</Label>
                  <Switch
                    id="custom-mode"
                    checked={useCustomThreshold}
                    onCheckedChange={setUseCustomThreshold}
                  />
                </div>
                
                {useCustomThreshold ? (
                  <div>
                    <Label className="text-xs text-muted-foreground">Minimum Revenue</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm">$</span>
                      <Input
                        type="number"
                        value={customThreshold}
                        onChange={(e) => setCustomThreshold(Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
                        <div className="w-4 h-4 rounded-full bg-green-500" />
                        <span className="text-slate-700">≥ {formatCurrency(customThreshold)}</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="w-4 h-4 rounded-full bg-slate-400" />
                        <span className="text-slate-700">&lt; {formatCurrency(customThreshold)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="text-xs text-slate-500 font-medium mb-1">Market Average</div>
                      <div className="text-xl font-bold text-emerald-600">
                        {listings.length > 0 ? formatCurrency(thresholds.average) : '—'}
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-green-500" />
                          <span className="text-slate-700">Top 33%: ≥ {listings.length > 0 ? formatCurrency(thresholds.high) : '—'}</span>
                        </div>
                        <span className="font-bold text-green-600">{thresholds.topCount || 0} properties</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-amber-500" />
                          <span className="text-slate-700">Middle 33%: {listings.length > 0 ? `${formatCurrency(thresholds.low)} - ${formatCurrency(thresholds.high)}` : '—'}</span>
                        </div>
                        <span className="font-bold text-amber-600">{thresholds.middleCount || 0} properties</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-red-500" />
                          <span className="text-slate-700">Bottom 33%: &lt; {listings.length > 0 ? formatCurrency(thresholds.low) : '—'}</span>
                        </div>
                        <span className="font-bold text-red-600">{thresholds.bottomCount || 0} properties</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Filters & Sorting */}
            {listings.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <BedDouble className="w-4 h-4 text-purple-500" />
                    </div>
                    Filters & Sorting
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Bedroom Filter */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                      Bedrooms
                    </Label>
                    <Select 
                      value={bedroomFilter} 
                      onValueChange={setBedroomFilter}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Bedrooms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Bedrooms ({listings.length})</SelectItem>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(br => {
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
                  
                  {/* Property Type Filter */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Property Type</Label>
                    <Select value={propertyTypeFilter} onValueChange={setPropertyTypeFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types ({listings.length})</SelectItem>
                        {Array.from(new Set(listings.map(l => l.propertyType))).filter(Boolean).sort().map(type => {
                          const count = listings.filter(l => l.propertyType === type).length;
                          return (
                            <SelectItem key={type} value={type}>
                              {type} ({count})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Distance Filter - only show when my property is set */}
                  {myPropertyLocation && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">
                        <Navigation className="w-3 h-3 inline mr-1" />
                        Max Distance from My Property
                      </Label>
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
                          <SelectItem value="10">Within 10 miles</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Sort By */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Sort By</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Sort by..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue-desc">Revenue (High to Low)</SelectItem>
                        <SelectItem value="revenue-asc">Revenue (Low to High)</SelectItem>
                        <SelectItem value="occupancy-desc">Occupancy (High to Low)</SelectItem>
                        <SelectItem value="occupancy-asc">Occupancy (Low to High)</SelectItem>
                        <SelectItem value="rating-desc">Rating (High to Low)</SelectItem>
                        <SelectItem value="rating-asc">Rating (Low to High)</SelectItem>
                        <SelectItem value="adr-desc">Nightly Rate (High to Low)</SelectItem>
                        <SelectItem value="adr-asc">Nightly Rate (Low to High)</SelectItem>
                        {myPropertyLocation && (
                          <>
                            <SelectItem value="distance-asc">Distance (Closest First)</SelectItem>
                            <SelectItem value="distance-desc">Distance (Farthest First)</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Active Filters Summary */}
                  {(bedroomFilter !== 'all' || propertyTypeFilter !== 'all' || distanceFilter !== 'all' || excludedListingIds.size > 0) && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Showing {filteredListings.length} of {listings.length} properties
                        {distanceFilter !== 'all' && ` within ${distanceFilter} mi`}
                        {excludedListingIds.size > 0 && ` (${excludedListingIds.size} excluded)`}
                      </p>
                    </div>
                  )}
                  
                  {/* Custom Comp Set Controls */}
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="comp-set-mode" className="text-sm font-medium">Custom Comp Set</Label>
                      <Switch
                        id="comp-set-mode"
                        checked={showCompSetMode}
                        onCheckedChange={setShowCompSetMode}
                      />
                    </div>
                    {showCompSetMode && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Click the X on any property in the table below to exclude it from your comp set.
                        </p>
                        {excludedListingIds.size > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExcludedListingIds(new Set())}
                            className="w-full text-xs"
                          >
                            Reset ({excludedListingIds.size} excluded)
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Stats */}
            {filteredListings.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Info className="w-4 h-4 text-blue-500" />
                    </div>
                    {getLocationName()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-slate-500 text-xs font-medium mb-1">Properties</p>
                      <p className="text-xl font-bold text-slate-900">{filteredListings.length}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                      <p className="text-slate-500 text-xs font-medium mb-1">Avg Revenue</p>
                      <p className="text-xl font-bold text-emerald-600">{formatCurrency(thresholds.average)}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg border border-green-100">
                      <span className="text-slate-600">Top Performer</span>
                      <span className="font-bold text-green-600">
                        {filteredListings.length > 0 ? formatCurrency(Math.max(...filteredListings.map(l => l.revenue))) : '—'}
                      </span>
                    </div>
                    {myPropertyLocation && (
                      <>
                        <div className="flex justify-between items-center p-2 bg-blue-50 rounded-lg border border-blue-100">
                          <span className="text-slate-600">Closest Competitor</span>
                          <span className="font-bold text-blue-600">
                            {filteredListings.length > 0 && filteredListings[0].distanceToMyProperty !== undefined
                              ? formatDistance(Math.min(...filteredListings.map(l => l.distanceToMyProperty || Infinity)))
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                          <span className="text-slate-600">Avg Distance</span>
                          <span className="font-bold text-slate-700">
                            {filteredListings.length > 0 && filteredListings[0].distanceToMyProperty !== undefined
                              ? formatDistance(filteredListings.reduce((sum, l) => sum + (l.distanceToMyProperty || 0), 0) / filteredListings.length)
                              : '—'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Location Quality Score */}
            {myPropertyLocation && locationQualityQuery.data?.success && locationQualityQuery.data.data && (
              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Star className="w-4 h-4 text-purple-500" />
                      </div>
                      Location Score
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className={`px-3 py-1 rounded-full text-lg font-bold ${
                            locationQualityQuery.data.data.overallScore >= 80 ? 'bg-green-100 text-green-700' :
                            locationQualityQuery.data.data.overallScore >= 60 ? 'bg-blue-100 text-blue-700' :
                            locationQualityQuery.data.data.overallScore >= 40 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {locationQualityQuery.data.data.overallGrade}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold">{locationQualityQuery.data.data.overallLabel}</p>
                          <p className="text-xs mt-1">Based on walkability, transit access, nearby attractions, and amenities.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Guest Appeal Summary */}
                  <div className="p-3 bg-white rounded-lg border border-purple-100">
                    <p className="text-sm text-slate-700 leading-relaxed">
                      <span className="font-semibold text-purple-700">Why guests would stay here:</span>{' '}
                      {locationQualityQuery.data.data.guestAppeal}
                    </p>
                  </div>
                  
                  {/* Score Breakdown */}
                  <div className="grid grid-cols-2 gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-2 bg-white rounded-lg border border-slate-100 cursor-help">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">Walk Score</span>
                              <span className={`text-sm font-bold ${
                                locationQualityQuery.data.data.walkScore.score >= 70 ? 'text-green-600' :
                                locationQualityQuery.data.data.walkScore.score >= 50 ? 'text-blue-600' :
                                'text-amber-600'
                              }`}>{locationQualityQuery.data.data.walkScore.grade}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{locationQualityQuery.data.data.walkScore.label}</p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold">Walk Score: {locationQualityQuery.data.data.walkScore.score}/100</p>
                          <p className="text-xs mt-1">{locationQualityQuery.data.data.walkScore.nearbyPlaces} restaurants, cafes, and shops within walking distance.</p>
                          {locationQualityQuery.data.data.walkScore.highlights.length > 0 && (
                            <p className="text-xs mt-1">Highlights: {locationQualityQuery.data.data.walkScore.highlights.join(', ')}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-2 bg-white rounded-lg border border-slate-100 cursor-help">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">Transit</span>
                              <span className={`text-sm font-bold ${
                                locationQualityQuery.data.data.transitScore.score >= 70 ? 'text-green-600' :
                                locationQualityQuery.data.data.transitScore.score >= 50 ? 'text-blue-600' :
                                'text-amber-600'
                              }`}>{locationQualityQuery.data.data.transitScore.grade}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{locationQualityQuery.data.data.transitScore.label}</p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold">Transit Score: {locationQualityQuery.data.data.transitScore.score}/100</p>
                          <p className="text-xs mt-1">{locationQualityQuery.data.data.transitScore.nearbyStops} transit stops within 1 mile.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-2 bg-white rounded-lg border border-slate-100 cursor-help">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">Attractions</span>
                              <span className={`text-sm font-bold ${
                                locationQualityQuery.data.data.attractionScore.score >= 70 ? 'text-green-600' :
                                locationQualityQuery.data.data.attractionScore.score >= 50 ? 'text-blue-600' :
                                'text-amber-600'
                              }`}>{locationQualityQuery.data.data.attractionScore.grade}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{locationQualityQuery.data.data.attractionScore.label}</p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold">Attraction Score: {locationQualityQuery.data.data.attractionScore.score}/100</p>
                          <p className="text-xs mt-1">{locationQualityQuery.data.data.attractionScore.nearbyAttractions} attractions within 2 miles.</p>
                          {locationQualityQuery.data.data.attractionScore.highlights.length > 0 && (
                            <p className="text-xs mt-1">Highlights: {locationQualityQuery.data.data.attractionScore.highlights.join(', ')}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-2 bg-white rounded-lg border border-slate-100 cursor-help">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">Amenities</span>
                              <span className={`text-sm font-bold ${
                                locationQualityQuery.data.data.amenityScore.score >= 70 ? 'text-green-600' :
                                locationQualityQuery.data.data.amenityScore.score >= 50 ? 'text-blue-600' :
                                'text-amber-600'
                              }`}>{locationQualityQuery.data.data.amenityScore.grade}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{locationQualityQuery.data.data.amenityScore.label}</p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold">Amenity Score: {locationQualityQuery.data.data.amenityScore.score}/100</p>
                          <p className="text-xs mt-1">{locationQualityQuery.data.data.amenityScore.nearbyAmenities} parks, gyms, and essential services within 1 mile.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Location Quality Loading */}
            {myPropertyLocation && locationQualityQuery.isLoading && (
              <Card className="border-purple-200">
                <CardContent className="py-6">
                  <div className="flex items-center justify-center gap-2 text-purple-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analyzing location quality...</span>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Location Privacy Disclaimer */}
            {listings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Note:</strong> Property locations are approximate (~1 km offset) for privacy reasons. Use this map for neighborhood exploration, not exact addresses.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Comps Table */}
        {filteredListings.length > 0 && (
          <Card className="mt-6 border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Table2 className="w-4 h-4 text-amber-500" />
                  </div>
                  Comparable Properties
                  <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-full">
                    {filteredListings.length}
                  </span>
                </CardTitle>
                <ExportListings
                  listings={filteredListings}
                  locationName={locationSelection?.submarket?.name || locationSelection?.market?.name || locationSelection?.zipcode || 'listings'}
                  filters={{
                    bedrooms: bedroomFilter,
                    propertyType: propertyTypeFilter,
                  }}
                />
              </div>
              <p className="text-sm text-slate-500">
                All properties shown on the map, sorted by {sortBy.replace('-desc', ' (High to Low)').replace('-asc', ' (Low to High)')}
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left p-3 font-semibold text-slate-700">Property</th>
                      <th className="text-center p-3 font-semibold text-slate-700">BR/BA</th>
                      <th className="text-right p-3 font-semibold text-slate-700">
                        <button 
                          onClick={() => setSortBy(sortBy === 'revenue-desc' ? 'revenue-asc' : 'revenue-desc')}
                          className="inline-flex items-center gap-1 hover:text-emerald-600 transition-colors"
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
                          className="inline-flex items-center gap-1 hover:text-amber-600 transition-colors"
                        >
                          Occupancy
                          {sortBy.startsWith('occupancy') && (
                            sortBy === 'occupancy-desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                          )}
                        </button>
                      </th>
                      <th className="text-right p-3 font-semibold text-slate-700">
                        <button 
                          onClick={() => setSortBy(sortBy === 'adr-desc' ? 'adr-asc' : 'adr-desc')}
                          className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          ADR
                          {sortBy.startsWith('adr') && (
                            sortBy === 'adr-desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                          )}
                        </button>
                      </th>
                      <th className="text-center p-3 font-semibold text-slate-700">
                        <button 
                          onClick={() => setSortBy(sortBy === 'rating-desc' ? 'rating-asc' : 'rating-desc')}
                          className="inline-flex items-center gap-1 hover:text-purple-600 transition-colors"
                        >
                          Rating
                          {sortBy.startsWith('rating') && (
                            sortBy === 'rating-desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                          )}
                        </button>
                      </th>
                      {myPropertyLocation && (
                        <th className="text-right p-3 font-semibold text-slate-700">
                          <button 
                            onClick={() => setSortBy(sortBy === 'distance-asc' ? 'distance-desc' : 'distance-asc')}
                            className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors"
                          >
                            Distance
                            {sortBy.startsWith('distance') && (
                              sortBy === 'distance-asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </th>
                      )}
                      <th className="text-center p-3 font-medium">Link</th>
                      {showCompSetMode && <th className="text-center p-3 font-medium w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedListings.map((listing, index) => {
                      const markerColor = getMarkerColor(listing.revenue, thresholds, useCustomThreshold ? customThreshold : null);
                      const occupancyDisplay = listing.occupancy > 1 ? Math.round(listing.occupancy) : Math.round(listing.occupancy * 100);
                      
                      return (
                        <tr 
                          key={listing.id} 
                          className={`border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${selectedProperty?.id === listing.id ? 'bg-blue-50/50' : ''}`}
                          onClick={() => {
                            setSelectedProperty(listing);
                            // Pan map to this property
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
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
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
                            <span 
                              className="font-semibold"
                              style={{ color: markerColor }}
                            >
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
                                <span className="text-xs text-slate-500">({listing.reviews})</span>
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
                              className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition-colors border border-blue-500/20"
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
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
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
              
              {/* Table Summary */}
              <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap gap-3">
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
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredListings.length)} of {filteredListings.length} properties
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`h-8 w-8 p-0 ${currentPage === pageNum ? 'bg-[#C9A962] hover:bg-[#b8984f]' : ''}`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-2"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </>
  );
}

export default MapViewContent;
