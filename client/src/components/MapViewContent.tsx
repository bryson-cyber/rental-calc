import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapView } from '@/components/Map';
import { trpc } from '@/lib/trpc';
import { HierarchicalLocationSelector, LocationSelection } from '@/components/HierarchicalLocationSelector';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/contexts/PropertyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Map, MapPin, DollarSign, Info, BedDouble, Home, Navigation, ArrowUpDown, Building2, ExternalLink, Star, ChevronUp, ChevronDown, Table2 } from 'lucide-react';
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
    return { high: 100000, low: 50000, average: 75000 };
  }
  
  const revenues = listings.map(l => l.revenue).sort((a, b) => a - b);
  const average = revenues.reduce((sum, r) => sum + r, 0) / revenues.length;
  
  const lowIndex = Math.floor(revenues.length * 0.33);
  const highIndex = Math.floor(revenues.length * 0.67);
  
  return {
    low: revenues[lowIndex] || average * 0.7,
    high: revenues[highIndex] || average * 1.3,
    average: Math.round(average),
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
        filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));
      "></div>
      <div style="
        position: absolute;
        top: -24px;
        left: 50%;
        transform: translateX(-50%);
        background: #1d4ed8;
        color: white;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
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
  
  const [myPropertyAddress, setMyPropertyAddress] = useState<string>('');
  const [myPropertyLocation, setMyPropertyLocation] = useState<MyPropertyLocation | null>(null);
  const [isGeocodingMyProperty, setIsGeocodingMyProperty] = useState(false);
  const [myPropertyError, setMyPropertyError] = useState<string | null>(null);
  
  // Track if we've auto-populated from context
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false);
  const [lastPropertyId, setLastPropertyId] = useState<string | null>(null);
  
  // tRPC utils for manual query calls
  const trpcUtils = trpc.useUtils();
  
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
  }, [listings, bedroomFilter, propertyTypeFilter, myPropertyLocation, sortBy]);
  
  const thresholds = useMemo(() => calculateThresholds(filteredListings), [filteredListings]);
  
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
  
  // Process listings data from API response
  const processListingsData = useCallback((fetchedListings: any[]) => {
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
    
    return listingsWithCoords;
  }, []);
  
  // Fit map to listings bounds
  const fitMapToBounds = useCallback((listingsWithCoords: PropertyListing[]) => {
    if (listingsWithCoords.length > 0 && mapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      listingsWithCoords.forEach((l: PropertyListing) => {
        bounds.extend({ lat: l.latitude, lng: l.longitude });
      });
      mapRef.current.fitBounds(bounds);
    }
  }, []);
  
  const performSearch = useCallback(async (selection: LocationSelection) => {
    setIsLoading(true);
    setError(null);
    setListings([]);
    
    try {
      let marketId: string | null = null;
      
      if (selection.submarket) {
        marketId = selection.submarket.id;
      } else if (selection.market) {
        marketId = selection.market.id;
      }
      
      if (!marketId) {
        setError('Please select a city/metro or neighborhood to view listings.');
        setIsLoading(false);
        return;
      }
      
      console.log('[MapView] Fetching listings for market:', marketId, 'selection:', JSON.stringify(selection));
      
      // Determine if this is a market-level or submarket-level search
      const isMarketLevel = selection.level === 'market';
      console.log('[MapView] Search level:', selection.level, 'isMarketLevel:', isMarketLevel);
      
      // Use tRPC client to fetch listings
      const result = await trpcUtils.client.compData.getListings.query({
        submarketId: marketId,
        isMarketLevel,
        pageSize: 50,
        orderBy: 'revenue',
        orderDirection: 'desc',
      });
      
      console.log('[MapView] tRPC response:', result);
      
      if (result.success && result.listings) {
        const listingsWithCoords = processListingsData(result.listings);
        console.log('[MapView] Listings with coordinates:', listingsWithCoords.length);
        setListings(listingsWithCoords);
        fitMapToBounds(listingsWithCoords);
      } else {
        console.log('[MapView] No listings in response');
        setError(result.error || 'No listings with coordinates found for this location. Try a different area.');
      }
    } catch (err) {
      console.error('Error fetching listings:', err);
      setError('Failed to fetch listings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [trpcUtils, processListingsData, fitMapToBounds]);
  
  const handleSearch = useCallback(() => {
    if (locationSelection) {
      performSearch(locationSelection);
    }
  }, [locationSelection, performSearch]);
  
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
        const zipCode = myProperty.zipCode;
        console.log('[MapView] Auto-searching by zip code:', zipCode);
        
        // Use tRPC client to fetch listings by zip code
        trpcUtils.client.compData.getListingsByZipcode.query({ zipcode: zipCode })
          .then((result: any) => {
            console.log('[MapView] Auto-search response:', result);
            
            if (result.success && result.listings && result.listings.length > 0) {
              console.log('[MapView] Auto-search received', result.listings.length, 'listings for zip', zipCode);
              
              const listingsWithCoords = processListingsData(result.listings);
              setListings(listingsWithCoords);
              fitMapToBounds(listingsWithCoords);
            } else {
              console.log('[MapView] No listings found for zip', zipCode, result.error);
            }
          })
          .catch((err: any) => {
            console.error('[MapView] Auto-search error:', err);
          });
      }
      
      setHasAutoPopulated(true);
    }
  }, [hasProperty, myProperty, hasAutoPopulated, enforceApplesToApples, contextBedroomFilter, trpcUtils, processListingsData, fitMapToBounds]);
  
  // Auto-geocode property address when map is ready and property is set
  useEffect(() => {
    if (hasProperty && myProperty?.address && myPropertyAddress && !myPropertyLocation && mapRef.current && window.google) {
      console.log('[MapView] Auto-geocoding property address:', myPropertyAddress);
      geocodeMyProperty();
    }
  }, [hasProperty, myProperty?.address, myPropertyAddress, myPropertyLocation, geocodeMyProperty]);
  
  const handleMapReady = useCallback((map: google.maps.Map) => {
    console.log('[MapView] Map ready');
    mapRef.current = map;
    
    // Initialize geocoder
    if (window.google) {
      geocoderRef.current = new google.maps.Geocoder();
    }
    
    // Create info window
    infoWindowRef.current = new google.maps.InfoWindow();
    
    // If we have a property address set but not geocoded yet, do it now
    if (myPropertyAddress && !myPropertyLocation) {
      geocodeMyProperty();
    }
  }, [myPropertyAddress, myPropertyLocation, geocodeMyProperty]);
  
  // Update markers when listings or thresholds change
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    
    // Check if AdvancedMarkerElement is available
    if (!window.google.maps.marker?.AdvancedMarkerElement) {
      console.warn('[MapView] AdvancedMarkerElement not yet available, waiting...');
      return;
    }
    
    // Clear existing markers
    markersRef.current.forEach(marker => {
      marker.map = null;
    });
    markersRef.current = [];
    
    // Create new markers
    filteredListings.forEach(listing => {
      const color = getMarkerColor(listing.revenue, thresholds, useCustomThreshold ? customThreshold : null);
      const markerElement = createMarkerElement(color, listing.revenue);
      
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: listing.latitude, lng: listing.longitude },
        content: markerElement,
        title: listing.title,
      });
      
      marker.addListener('click', () => {
        setSelectedProperty(listing);
        
        const distanceText = listing.distanceToMyProperty !== undefined 
          ? `<div style="color: #3b82f6; font-size: 12px; margin-top: 4px;">📍 ${formatDistance(listing.distanceToMyProperty)} from your property</div>`
          : '';
        
        const content = `
          <div style="max-width: 280px; font-family: system-ui, -apple-system, sans-serif;">
            ${listing.thumbnailUrl ? `<img src="${listing.thumbnailUrl}" alt="${listing.title}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px 8px 0 0;" />` : ''}
            <div style="padding: 12px;">
              <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1f2937;">${listing.title}</h3>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                <span style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${listing.bedrooms} BR</span>
                <span style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${listing.bathrooms} BA</span>
                <span style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${listing.accommodates} guests</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                <div style="background: #dcfce7; padding: 8px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #166534; text-transform: uppercase;">Revenue</div>
                  <div style="font-size: 14px; font-weight: 700; color: #166534;">${formatCurrency(listing.revenue)}</div>
                </div>
                <div style="background: #fef3c7; padding: 8px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #92400e; text-transform: uppercase;">Occupancy</div>
                  <div style="font-size: 14px; font-weight: 700; color: #92400e;">${Math.round(listing.occupancy)}%</div>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div style="background: #e0e7ff; padding: 8px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #3730a3; text-transform: uppercase;">Nightly Rate</div>
                  <div style="font-size: 14px; font-weight: 700; color: #3730a3;">${formatCurrency(listing.adr)}</div>
                </div>
                <div style="background: #fce7f3; padding: 8px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #9d174d; text-transform: uppercase;">Rating</div>
                  <div style="font-size: 14px; font-weight: 700; color: #9d174d;">${listing.rating ? `${listing.rating.toFixed(1)} ⭐` : 'N/A'}</div>
                </div>
              </div>
              ${distanceText}
              ${listing.airbnbUrl && listing.airbnbUrl !== '#' ? `
                <a href="${listing.airbnbUrl}" target="_blank" rel="noopener noreferrer" style="display: block; margin-top: 12px; text-align: center; background: #ef4444; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600;">
                  View on Airbnb →
                </a>
              ` : ''}
            </div>
          </div>
        `;
        
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(mapRef.current, marker);
        }
      });
      
      markersRef.current.push(marker);
    });
  }, [filteredListings, thresholds, useCustomThreshold, customThreshold]);
  
  // Update my property marker
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    
    // Check if AdvancedMarkerElement is available
    if (!window.google.maps.marker?.AdvancedMarkerElement) {
      console.warn('[MapView] AdvancedMarkerElement not yet available for my property marker');
      return;
    }
    
    // Remove existing my property marker
    if (myPropertyMarkerRef.current) {
      myPropertyMarkerRef.current.map = null;
      myPropertyMarkerRef.current = null;
    }
    
    // Create new marker if location is set
    if (myPropertyLocation) {
      const markerElement = createMyPropertyMarker();
      
      myPropertyMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: myPropertyLocation.lat, lng: myPropertyLocation.lng },
        content: markerElement,
        title: 'My Property',
        zIndex: 1000,
      });
      
      myPropertyMarkerRef.current.addListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(`
            <div style="padding: 12px; font-family: system-ui, -apple-system, sans-serif;">
              <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1d4ed8;">📍 My Property</h3>
              <p style="margin: 0; font-size: 13px; color: #4b5563;">${myPropertyLocation.address}</p>
            </div>
          `);
          infoWindowRef.current.open(mapRef.current, myPropertyMarkerRef.current);
        }
      });
    }
  }, [myPropertyLocation]);
  
  // Get unique property types for filter
  const propertyTypes = useMemo(() => {
    const types = new Set(listings.map(l => l.propertyType));
    return Array.from(types).sort();
  }, [listings]);
  
  // Get unique bedroom counts for filter
  const bedroomCounts = useMemo(() => {
    const counts = new Set(listings.map(l => l.bedrooms));
    return Array.from(counts).sort((a, b) => a - b);
  }, [listings]);
  
  // Stats calculations
  const stats = useMemo(() => {
    if (filteredListings.length === 0) return null;
    
    const totalRevenue = filteredListings.reduce((sum, l) => sum + l.revenue, 0);
    const avgRevenue = totalRevenue / filteredListings.length;
    const avgOccupancy = filteredListings.reduce((sum, l) => sum + l.occupancy, 0) / filteredListings.length;
    const avgAdr = filteredListings.reduce((sum, l) => sum + l.adr, 0) / filteredListings.length;
    
    let closestComp = null;
    let avgDistance = null;
    
    if (myPropertyLocation) {
      const withDistance = filteredListings.filter(l => l.distanceToMyProperty !== undefined);
      if (withDistance.length > 0) {
        closestComp = withDistance.reduce((closest, l) => 
          (l.distanceToMyProperty || Infinity) < (closest.distanceToMyProperty || Infinity) ? l : closest
        );
        avgDistance = withDistance.reduce((sum, l) => sum + (l.distanceToMyProperty || 0), 0) / withDistance.length;
      }
    }
    
    return {
      count: filteredListings.length,
      avgRevenue,
      avgOccupancy,
      avgAdr,
      closestComp,
      avgDistance,
    };
  }, [filteredListings, myPropertyLocation]);

  // Table state
  const [showTable, setShowTable] = useState(false);
  const [tableSortField, setTableSortField] = useState<string>('revenue');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleTableSort = (field: string) => {
    if (tableSortField === field) {
      setTableSortDirection(tableSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortField(field);
      setTableSortDirection('desc');
    }
  };

  const sortedTableListings = useMemo(() => {
    return [...filteredListings].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (tableSortField) {
        case 'revenue':
          aVal = a.revenue;
          bVal = b.revenue;
          break;
        case 'occupancy':
          aVal = a.occupancy;
          bVal = b.occupancy;
          break;
        case 'adr':
          aVal = a.adr;
          bVal = b.adr;
          break;
        case 'rating':
          aVal = a.rating || 0;
          bVal = b.rating || 0;
          break;
        case 'distance':
          aVal = a.distanceToMyProperty || Infinity;
          bVal = b.distanceToMyProperty || Infinity;
          break;
        default:
          aVal = a.revenue;
          bVal = b.revenue;
      }
      return tableSortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [filteredListings, tableSortField, tableSortDirection]);

  const SortIcon = ({ field }: { field: string }) => {
    if (tableSortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return tableSortDirection === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />;
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header - only show if not embedded */}
      {!embedded && (
        <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] text-white p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#C9A962]/20 rounded-lg flex items-center justify-center">
              <Map className="w-5 h-5 text-[#C9A962]" />
            </div>
            <h1 className="text-2xl font-serif font-semibold">Property Map View</h1>
          </div>
          <p className="text-white/70 text-sm">
            Explore comparable properties on the map. Set your property location to see distances.
          </p>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 bg-[#FAFAF8] overflow-auto">
        {/* Controls Panel - Shows FIRST on all screen sizes */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-4 order-1">
          {/* Location Selection */}
          <Card className="border-[#0F172A]/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#C9A962]" />
                Select Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <HierarchicalLocationSelector
                onSearch={(selection) => {
                  setLocationSelection(selection);
                  performSearch(selection);
                }}
                onSelectionChange={setLocationSelection}
              />
            </CardContent>
          </Card>
          
          {/* My Property Section */}
          <Card className="border-[#0F172A]/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                <Home className="w-4 h-4 text-[#3b82f6]" />
                My Property
                {hasProperty && myProperty && (
                  <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    From Step 1
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasProperty && myProperty ? (
                // Compact view when property is set from context
                <div className="space-y-2">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900 font-medium truncate">{myProperty.address}</p>
                    <p className="text-xs text-blue-700 mt-1">
                      {myProperty.bedrooms} BR • {myProperty.bathrooms} BA
                      {myProperty.zipCode && ` • ${myProperty.zipCode}`}
                    </p>
                  </div>
                  {myPropertyLocation && (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <Navigation className="w-3 h-3" />
                      <span>Location pinned on map</span>
                    </div>
                  )}
                  {!myPropertyLocation && myPropertyAddress && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={geocodeMyProperty}
                      disabled={isGeocodingMyProperty}
                      className="w-full text-xs"
                    >
                      {isGeocodingMyProperty ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Locating...
                        </>
                      ) : (
                        <>
                          <Navigation className="w-3 h-3 mr-1" />
                          Pin on Map
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                // Full input when no property context
                <>
                  <div className="space-y-2">
                    <Label htmlFor="myPropertyAddress" className="text-xs text-[#0F172A]/70">
                      Enter your property address
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="myPropertyAddress"
                        placeholder="123 Main St, City, State"
                        value={myPropertyAddress}
                        onChange={(e) => setMyPropertyAddress(e.target.value)}
                        className="text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && geocodeMyProperty()}
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={geocodeMyProperty}
                      disabled={isGeocodingMyProperty || !myPropertyAddress.trim()}
                      className="flex-1 bg-[#3b82f6] hover:bg-[#2563eb]"
                    >
                      {isGeocodingMyProperty ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Locating...
                        </>
                      ) : (
                        <>
                          <Navigation className="w-4 h-4 mr-2" />
                          Set Location
                        </>
                      )}
                    </Button>
                    {myPropertyLocation && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearMyProperty}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </>
              )}
              
              {myPropertyError && (
                <p className="text-xs text-red-500">{myPropertyError}</p>
              )}
              
              {myPropertyLocation && !hasProperty && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                  <p className="text-xs text-blue-700 font-medium">📍 Property location set</p>
                  <p className="text-xs text-blue-600 truncate">{myPropertyLocation.address}</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Filters */}
          <Card className="border-[#0F172A]/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-[#C9A962]" />
                Filters
                {filteredListings.length !== listings.length && (
                  <span className="ml-auto text-xs bg-[#C9A962]/20 text-[#C9A962] px-2 py-0.5 rounded-full">
                    {filteredListings.length} of {listings.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-[#0F172A]/70">Bedrooms</Label>
                <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All bedrooms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All bedrooms</SelectItem>
                    {bedroomCounts.map(count => (
                      <SelectItem key={count} value={String(count)}>
                        {count} bedroom{count !== 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs text-[#0F172A]/70">Property Type</Label>
                <Select value={propertyTypeFilter} onValueChange={setPropertyTypeFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {propertyTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs text-[#0F172A]/70">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue-desc">Revenue (High to Low)</SelectItem>
                    <SelectItem value="revenue-asc">Revenue (Low to High)</SelectItem>
                    <SelectItem value="occupancy-desc">Occupancy (High to Low)</SelectItem>
                    <SelectItem value="adr-desc">Nightly Rate (High to Low)</SelectItem>
                    <SelectItem value="rating-desc">Rating (High to Low)</SelectItem>
                    {myPropertyLocation && (
                      <SelectItem value="distance-asc">Distance (Closest)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          {/* Revenue Thresholds */}
          <Card className="border-[#0F172A]/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#C9A962]" />
                Revenue Thresholds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="customThreshold" className="text-xs text-[#0F172A]/70">
                  Use custom threshold
                </Label>
                <Switch
                  id="customThreshold"
                  checked={useCustomThreshold}
                  onCheckedChange={setUseCustomThreshold}
                />
              </div>
              
              {useCustomThreshold ? (
                <div className="space-y-2">
                  <Label className="text-xs text-[#0F172A]/70">
                    Minimum Revenue: {formatCurrency(customThreshold)}
                  </Label>
                  <input
                    type="range"
                    min="10000"
                    max="500000"
                    step="5000"
                    value={customThreshold}
                    onChange={(e) => setCustomThreshold(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-[#0F172A]/50">
                    <span>$10K</span>
                    <span>$500K</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-[#16a34a]" />
                    <span>Above threshold</span>
                    <div className="w-3 h-3 rounded-full bg-[#9ca3af] ml-2" />
                    <span>Below threshold</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-[#16a34a]" />
                      <span>High</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                      <span>Medium</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                      <span>Low</span>
                    </div>
                  </div>
                  {listings.length > 0 && (
                    <div className="text-xs text-[#0F172A]/50">
                      <p>High: ≥ {formatCurrency(thresholds.high)}</p>
                      <p>Medium: {formatCurrency(thresholds.low)} - {formatCurrency(thresholds.high)}</p>
                      <p>Low: &lt; {formatCurrency(thresholds.low)}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Stats Panel */}
          {stats && (
            <Card className="border-[#0F172A]/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#C9A962]" />
                  Market Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#0F172A]/5 rounded-lg p-2">
                    <p className="text-[#0F172A]/50">Properties</p>
                    <p className="font-semibold text-[#0F172A]">{stats.count}</p>
                  </div>
                  <div className="bg-[#0F172A]/5 rounded-lg p-2">
                    <p className="text-[#0F172A]/50">Avg Revenue</p>
                    <p className="font-semibold text-[#0F172A]">{formatCurrency(stats.avgRevenue)}</p>
                  </div>
                  <div className="bg-[#0F172A]/5 rounded-lg p-2">
                    <p className="text-[#0F172A]/50">Avg Occupancy</p>
                    <p className="font-semibold text-[#0F172A]">{Math.round(stats.avgOccupancy)}%</p>
                  </div>
                  <div className="bg-[#0F172A]/5 rounded-lg p-2">
                    <p className="text-[#0F172A]/50">Avg Nightly</p>
                    <p className="font-semibold text-[#0F172A]">{formatCurrency(stats.avgAdr)}</p>
                  </div>
                  {stats.closestComp && (
                    <>
                      <div className="col-span-2 bg-blue-50 rounded-lg p-2">
                        <p className="text-blue-600">Closest Comp</p>
                        <p className="font-semibold text-blue-800 truncate">{stats.closestComp.title}</p>
                        <p className="text-blue-600">{formatDistance(stats.closestComp.distanceToMyProperty || 0)}</p>
                      </div>
                      <div className="col-span-2 bg-[#0F172A]/5 rounded-lg p-2">
                        <p className="text-[#0F172A]/50">Avg Distance</p>
                        <p className="font-semibold text-[#0F172A]">{formatDistance(stats.avgDistance || 0)}</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Map Container - Shows SECOND on all screen sizes */}
        <div className="flex-1 flex flex-col gap-4 min-h-[400px] lg:min-h-0 order-2">
          <div className="flex-1 rounded-xl overflow-hidden border border-[#0F172A]/10 shadow-sm relative">
            {isLoading && (
              <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
                  <p className="text-sm text-[#0F172A]/70">Loading properties...</p>
                </div>
              </div>
            )}
            
            {error && (
              <div className="absolute top-4 left-4 right-4 z-10 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            
            <MapView
              onMapReady={handleMapReady}
              className="w-full h-full"
            />
            
            {listings.length === 0 && !isLoading && !error && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 text-center max-w-sm mx-4">
                  <Map className="w-12 h-12 text-[#C9A962] mx-auto mb-3" />
                  <h3 className="font-semibold text-[#0F172A] mb-2">Select a Location</h3>
                  <p className="text-sm text-[#0F172A]/70">
                    Use the location selector to search for properties in a specific area.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Comps Table Toggle */}
          {filteredListings.length > 0 && (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTable(!showTable)}
                className="w-full flex items-center justify-center gap-2"
              >
                <Table2 className="w-4 h-4" />
                {showTable ? 'Hide' : 'Show'} Comparable Properties Table ({filteredListings.length})
                {showTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
              
              {showTable && (
                <Card className="border-[#0F172A]/10">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[#0F172A]/5 border-b border-[#0F172A]/10">
                          <tr>
                            <th className="text-left p-3 font-medium text-[#0F172A]/70">Property</th>
                            <th 
                              className="text-right p-3 font-medium text-[#0F172A]/70 cursor-pointer hover:bg-[#0F172A]/10"
                              onClick={() => handleTableSort('revenue')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Revenue <SortIcon field="revenue" />
                              </div>
                            </th>
                            <th 
                              className="text-right p-3 font-medium text-[#0F172A]/70 cursor-pointer hover:bg-[#0F172A]/10"
                              onClick={() => handleTableSort('occupancy')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Occ <SortIcon field="occupancy" />
                              </div>
                            </th>
                            <th 
                              className="text-right p-3 font-medium text-[#0F172A]/70 cursor-pointer hover:bg-[#0F172A]/10"
                              onClick={() => handleTableSort('adr')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                ADR <SortIcon field="adr" />
                              </div>
                            </th>
                            <th 
                              className="text-right p-3 font-medium text-[#0F172A]/70 cursor-pointer hover:bg-[#0F172A]/10"
                              onClick={() => handleTableSort('rating')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Rating <SortIcon field="rating" />
                              </div>
                            </th>
                            {myPropertyLocation && (
                              <th 
                                className="text-right p-3 font-medium text-[#0F172A]/70 cursor-pointer hover:bg-[#0F172A]/10"
                                onClick={() => handleTableSort('distance')}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  Distance <SortIcon field="distance" />
                                </div>
                              </th>
                            )}
                            <th className="text-center p-3 font-medium text-[#0F172A]/70">Link</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedTableListings.map((listing, index) => (
                            <tr 
                              key={listing.id} 
                              className={`border-b border-[#0F172A]/5 hover:bg-[#0F172A]/5 ${index % 2 === 0 ? 'bg-white' : 'bg-[#0F172A]/[0.02]'}`}
                            >
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {listing.thumbnailUrl && (
                                    <img 
                                      src={listing.thumbnailUrl} 
                                      alt="" 
                                      className="w-10 h-10 rounded object-cover"
                                    />
                                  )}
                                  <div>
                                    <p className="font-medium text-[#0F172A] line-clamp-1">{listing.title}</p>
                                    <p className="text-xs text-[#0F172A]/50">
                                      {listing.bedrooms} BR • {listing.bathrooms} BA • {listing.propertyType}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right font-medium text-green-600">
                                {formatCurrency(listing.revenue)}
                              </td>
                              <td className="p-3 text-right">
                                {Math.round(listing.occupancy)}%
                              </td>
                              <td className="p-3 text-right">
                                {formatCurrency(listing.adr)}
                              </td>
                              <td className="p-3 text-right">
                                {listing.rating ? (
                                  <span className="flex items-center justify-end gap-1">
                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                    {listing.rating.toFixed(1)}
                                  </span>
                                ) : (
                                  <span className="text-[#0F172A]/30">-</span>
                                )}
                              </td>
                              {myPropertyLocation && (
                                <td className="p-3 text-right text-blue-600">
                                  {listing.distanceToMyProperty !== undefined 
                                    ? formatDistance(listing.distanceToMyProperty)
                                    : '-'
                                  }
                                </td>
                              )}
                              <td className="p-3 text-center">
                                {listing.airbnbUrl && listing.airbnbUrl !== '#' ? (
                                  <a 
                                    href={listing.airbnbUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                ) : (
                                  <span className="text-[#0F172A]/30">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MapViewContent;
