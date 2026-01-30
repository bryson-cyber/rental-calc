import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapView } from '@/components/Map';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Map, MapPin, Home, Navigation, TrendingUp, List, ArrowUpDown, ExternalLink, Info, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProperty } from '@/contexts/PropertyContext';
import { SmartAddressInput, PropertyDetails as SmartPropertyDetails } from '@/components/SmartAddressInput';
import { SharePageButton } from '@/components/SharePageButton';
import { toast } from 'sonner';
import { useSearch } from 'wouter';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

function getMarkerColor(revenue: number, thresholds: RevenueThresholds): string {
  if (revenue >= thresholds.high) return '#22c55e';
  if (revenue >= thresholds.low) return '#C9A962';
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

function createMarkerElement(color: string, revenue: number, distance?: number): HTMLDivElement {
  const markerElement = document.createElement('div');
  const distanceLabel = distance !== undefined ? `<div style="font-size: 9px; opacity: 0.8; margin-top: 2px;">${formatDistance(distance)}</div>` : '';
  markerElement.innerHTML = `
    <div style="position: relative; cursor: pointer; transition: transform 0.2s ease;" class="property-marker">
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
        text-align: center;
      ">
        ${formatCompactCurrency(revenue)}
        ${distanceLabel}
      </div>
    </div>
  `;
  
  const marker = markerElement.querySelector('.property-marker') as HTMLElement;
  if (marker) {
    marker.addEventListener('mouseenter', () => { marker.style.transform = 'scale(1.15)'; });
    marker.addEventListener('mouseleave', () => { marker.style.transform = 'scale(1)'; });
  }
  
  return markerElement;
}

function createMyPropertyMarker(): HTMLDivElement {
  const markerElement = document.createElement('div');
  markerElement.innerHTML = `
    <div style="position: relative; cursor: pointer; animation: pulse 2s infinite;" class="my-property-marker">
      <div style="
        width: 48px; height: 48px;
        background: linear-gradient(135deg, #C9A962 0%, #a08840 100%);
        border: 4px solid white;
        border-radius: 50%;
        box-shadow: 0 6px 20px rgba(201, 169, 98, 0.5), 0 4px 8px rgba(0,0,0,0.2);
        display: flex; align-items: center; justify-content: center;
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </div>
      <div style="position: absolute; top: -8px; left: 50%; transform: translateX(-50%); background: #C9A962; color: white; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">YOUR PROPERTY</div>
    </div>
    <style>@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }</style>
  `;
  return markerElement;
}

type SortField = 'revenue' | 'distance' | 'occupancy' | 'adr';
type SortDirection = 'asc' | 'desc';

export default function MapViewPage() {
  const { myProperty, hasProperty } = useProperty();
  
  
  // State
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myPropertyLocation, setMyPropertyLocation] = useState<MyPropertyLocation | null>(null);
  const [distanceFilter, setDistanceFilter] = useState<string>('all');
  const [bedroomFilter, setBedroomFilter] = useState<string>('all');
  const [showTable, setShowTable] = useState(false);
  const [sortField, setSortField] = useState<SortField>('distance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [manualAddress, setManualAddress] = useState('');
  const [isGeocodingManual, setIsGeocodingManual] = useState(false);
  const [detectedProperty, setDetectedProperty] = useState<SmartPropertyDetails | null>(null);
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const myPropertyMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  
  // Filter and sort listings
  const filteredListings = useMemo(() => {
    let filtered = listings;
    
    // Add distance to each listing
    if (myPropertyLocation) {
      filtered = filtered.map(l => ({
        ...l,
        distanceToMyProperty: calculateDistance(myPropertyLocation.lat, myPropertyLocation.lng, l.latitude, l.longitude)
      }));
    }
    
    // Filter by bedrooms
    if (bedroomFilter !== 'all') {
      filtered = filtered.filter(l => l.bedrooms === parseInt(bedroomFilter));
    }
    
    // Filter by distance
    if (distanceFilter !== 'all' && myPropertyLocation) {
      const maxDistance = parseFloat(distanceFilter);
      filtered = filtered.filter(l => (l.distanceToMyProperty || 0) <= maxDistance);
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case 'revenue': aVal = a.revenue; bVal = b.revenue; break;
        case 'distance': aVal = a.distanceToMyProperty || 999; bVal = b.distanceToMyProperty || 999; break;
        case 'occupancy': aVal = a.occupancy; bVal = b.occupancy; break;
        case 'adr': aVal = a.adr; bVal = b.adr; break;
        default: aVal = 0; bVal = 0;
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return filtered;
  }, [listings, bedroomFilter, distanceFilter, myPropertyLocation, sortField, sortDirection]);
  
  const thresholds = useMemo(() => calculateThresholds(filteredListings), [filteredListings]);
  
  // Fetch listings based on location
  const fetchListingsForLocation = useCallback(async (lat: number, lng: number, city?: string, state?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Build search term from city (AirDNA works better with just city name)
      const searchTerm = city || state || '';
      
      if (!searchTerm) {
        setError('Could not determine location. Please try a different address.');
        setIsLoading(false);
        return;
      }
      
      // Search for markets using the rental.searchMarkets endpoint
      const marketsResponse = await fetch(`/api/trpc/rental.searchMarkets?input=${encodeURIComponent(JSON.stringify({ json: { searchTerm, limit: 10 } }))}`);
      const marketsData = await marketsResponse.json();
      
      const markets = marketsData.result?.data?.json?.data || [];
      
      if (markets.length === 0) {
        setError('No market data available for this location. Try a larger city nearby.');
        setIsLoading(false);
        return;
      }
      
      // Use the first matching market
      const matchedMarket = markets[0];
      const marketId = matchedMarket.id || matchedMarket.market_id;
      const isMarketLevel = matchedMarket.type === 'market' || matchedMarket.type === 'city';
      
      if (!marketId) {
        setError('Could not identify market. Please try again.');
        setIsLoading(false);
        return;
      }
      
      // Fetch listings for this market using compData.getAllListings for more results
      const listingsResponse = await fetch(`/api/trpc/compData.getAllListings?input=${encodeURIComponent(JSON.stringify({ json: { submarketId: marketId, isMarketLevel, maxListings: 100 } }))}`);
      const listingsData = await listingsResponse.json();
      
      if (listingsData.result?.data?.json?.listings) {
        const fetchedListings = listingsData.result.data.json.listings
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
            thumbnailUrl: l.thumbnail_url || l.thumbnailUrl || null,
          }));
        
        setListings(fetchedListings);
        
        // Center map on property location
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng });
          mapRef.current.setZoom(13);
        }
      } else {
        setError('No properties found in this area.');
      }
    } catch (err) {
      console.error('Error fetching listings:', err);
      setError('Failed to load properties. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Geocode address and fetch listings
  const geocodeAndSearch = useCallback(async (address: string) => {
    if (!geocoderRef.current && window.google) {
      geocoderRef.current = new google.maps.Geocoder();
    }
    
    if (!geocoderRef.current) {
      setError('Map not ready. Please wait and try again.');
      return;
    }
    
    setIsGeocodingManual(true);
    
    try {
      const result = await geocoderRef.current.geocode({ address });
      
      if (result.results && result.results.length > 0) {
        const location = result.results[0].geometry.location;
        const formattedAddress = result.results[0].formatted_address;
        
        // Extract city and state from address components
        let city = '', state = '';
        for (const component of result.results[0].address_components) {
          if (component.types.includes('locality')) city = component.long_name;
          if (component.types.includes('administrative_area_level_1')) state = component.short_name;
        }
        
        const newLocation = {
          address: formattedAddress,
          lat: location.lat(),
          lng: location.lng()
        };
        
        setMyPropertyLocation(newLocation);
        await fetchListingsForLocation(newLocation.lat, newLocation.lng, city, state);
      } else {
        setError('Address not found. Please try a different address.');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setError('Failed to find address. Please try again.');
    } finally {
      setIsGeocodingManual(false);
    }
  }, [fetchListingsForLocation]);
  
  // Auto-load from PropertyContext when component mounts
  useEffect(() => {
    if (hasProperty && myProperty && !hasAutoLoaded && mapRef.current && window.google) {
      setHasAutoLoaded(true);
      
      // If we have coordinates, use them directly
      if (myProperty.latitude && myProperty.longitude) {
        const location = {
          address: myProperty.formattedAddress || myProperty.address,
          lat: myProperty.latitude,
          lng: myProperty.longitude
        };
        setMyPropertyLocation(location);
        fetchListingsForLocation(location.lat, location.lng, myProperty.city, myProperty.state);
      } else {
        // Geocode the address
        geocodeAndSearch(myProperty.address);
      }
    }
  }, [hasProperty, myProperty, hasAutoLoaded, fetchListingsForLocation, geocodeAndSearch]);
  
  // Update markers when listings change
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    
    // Clear existing markers
    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];
    
    // Create info window if needed
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }
    
    // Add markers for each listing
    filteredListings.forEach(listing => {
      const color = getMarkerColor(listing.revenue, thresholds);
      const markerElement = createMarkerElement(color, listing.revenue, listing.distanceToMyProperty);
      
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current!,
        position: { lat: listing.latitude, lng: listing.longitude },
        title: listing.title,
        content: markerElement,
      });
      
      marker.addListener('click', () => {
        const distanceInfo = listing.distanceToMyProperty !== undefined 
          ? `<div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
              <span style="color: #666;">Distance from you:</span>
              <span style="font-weight: 600; color: #C9A962;">${formatDistance(listing.distanceToMyProperty)}</span>
            </div>`
          : '';
        
        const content = `
          <div style="max-width: 300px; font-family: system-ui, sans-serif; padding: 12px;">
            <div style="display: flex; gap: 12px; margin-bottom: 12px;">
              ${listing.thumbnailUrl 
                ? `<img src="${listing.thumbnailUrl}" alt="${listing.title}" style="width: 80px; height: 60px; object-fit: cover; border-radius: 8px;" />`
                : `<div style="width: 80px; height: 60px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                  </div>`
              }
              <div>
                <h3 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #0F172A;">${listing.title}</h3>
                <p style="margin: 0; font-size: 12px; color: #666;">${listing.bedrooms} BR / ${listing.bathrooms} BA</p>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
              <div style="background: #f8f7f4; padding: 8px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Revenue</div>
                <div style="font-size: 14px; font-weight: 700; color: ${color};">${formatCurrency(listing.revenue)}</div>
              </div>
              <div style="background: #f8f7f4; padding: 8px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Occupancy</div>
                <div style="font-size: 14px; font-weight: 600; color: #0F172A;">${Math.round(listing.occupancy > 1 ? listing.occupancy : listing.occupancy * 100)}%</div>
              </div>
              <div style="background: #f8f7f4; padding: 8px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Nightly Rate</div>
                <div style="font-size: 14px; font-weight: 600; color: #0F172A;">${formatCurrency(listing.adr)}</div>
              </div>
            </div>
            ${distanceInfo}
            <a href="${listing.airbnbUrl}" target="_blank" rel="noopener noreferrer" 
               style="display: block; text-align: center; margin-top: 12px; padding: 8px; background: #0F172A; color: white; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 500;">
              View on Airbnb
            </a>
          </div>
        `;
        
        infoWindowRef.current?.setContent(content);
        infoWindowRef.current?.open(mapRef.current, marker);
      });
      
      markersRef.current.push(marker);
    });
  }, [filteredListings, thresholds]);
  
  // Update my property marker
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    
    if (myPropertyMarkerRef.current) {
      myPropertyMarkerRef.current.map = null;
      myPropertyMarkerRef.current = null;
    }
    
    if (myPropertyLocation) {
      const markerElement = createMyPropertyMarker();
      myPropertyMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: myPropertyLocation.lat, lng: myPropertyLocation.lng },
        title: 'Your Property',
        content: markerElement,
        zIndex: 1000,
      });
    }
  }, [myPropertyLocation]);
  
  // Parse URL parameters for sharing
  const searchString = useSearch();
  
  useEffect(() => {
    const params = new URLSearchParams(searchString || window.location.search);
    const address = params.get('address');
    const lat = params.get('lat');
    const lng = params.get('lng');
    if (address && lat && lng) {
      setMyPropertyLocation({
        address: decodeURIComponent(address),
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      });
    }
  }, [searchString]);
  
  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'distance' ? 'asc' : 'desc');
    }
  };
  
  // Stats
  const avgOccupancy = filteredListings.length > 0 
    ? Math.round(filteredListings.reduce((sum, l) => sum + (l.occupancy > 1 ? l.occupancy : l.occupancy * 100), 0) / filteredListings.length)
    : 0;
  const avgAdr = filteredListings.length > 0 
    ? filteredListings.reduce((sum, l) => sum + l.adr, 0) / filteredListings.length
    : 0;
  const closestDistance = filteredListings.length > 0 && myPropertyLocation
    ? Math.min(...filteredListings.map(l => l.distanceToMyProperty || 999))
    : null;
  
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-white">
        {/* Premium Header */}
        <div className="bg-gradient-to-r from-[#0F172A] via-[#0F172A] to-[#1e293b] text-white py-8 px-6">
          <div className="container">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#C9A962]/20 flex items-center justify-center border border-[#C9A962]/30">
                  <Map className="w-7 h-7 text-[#C9A962]" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-serif font-semibold text-white">See the Map</h1>
                  <p className="text-white/60 text-sm font-sans">
                    How does your property compare to nearby competition?
                  </p>
                </div>
              </div>
              <SharePageButton
                pagePath="/map"
                params={{
                  address: myPropertyLocation?.address,
                  lat: myPropertyLocation?.lat,
                  lng: myPropertyLocation?.lng,
                }}
                shareDescription={myPropertyLocation ? `map view for ${myPropertyLocation.address}` : 'Map View'}
                variant="outline"
                size="default"
                className="bg-transparent border-white/20 text-white hover:bg-white/10"
              />
            </div>
          </div>
        </div>
        
        <div className="container py-6">
          {/* Property Input - Only show if no property is set */}
          {!myPropertyLocation && (
            <Card className="mb-6 border-[#C9A962]/30 bg-[#C9A962]/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#C9A962]/20 flex items-center justify-center border border-[#C9A962]/30 flex-shrink-0">
                    <Home className="w-6 h-6 text-[#C9A962]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#0F172A] mb-1">Enter Your Property Address</h3>
                    <p className="text-sm text-[#0F172A]/60 mb-4">
                      We'll show you all the competing rentals nearby so you can see how your property stacks up.
                    </p>
                    <div className="space-y-3">
                      <SmartAddressInput
                        value={manualAddress}
                        onChange={setManualAddress}
                        onPropertyDetected={(property) => {
                          setDetectedProperty(property);
                          // Auto-search when property is detected from Zillow/Redfin
                          if (property.address) {
                            geocodeAndSearch(property.address);
                          }
                        }}
                        onAddressSelect={(address, placeId, details) => {
                          setManualAddress(address);
                          if (details?.lat && details?.lng) {
                            const location = { address, lat: details.lat, lng: details.lng };
                            setMyPropertyLocation(location);
                            fetchListingsForLocation(details.lat, details.lng, details.city, details.state);
                          } else {
                            geocodeAndSearch(address);
                          }
                        }}
                        placeholder="Enter address or paste Zillow/Redfin URL..."
                        showPropertyCard={true}
                      />
                      {manualAddress && !detectedProperty && (
                        <Button
                          onClick={() => geocodeAndSearch(manualAddress)}
                          disabled={!manualAddress.trim() || isGeocodingManual || isLoading}
                          className="bg-[#C9A962] hover:bg-[#b8984f] text-white px-6 w-full sm:w-auto"
                        >
                          {isGeocodingManual || isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Navigation className="w-4 h-4 mr-2" />
                              Find Competitors
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
              <Info className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              {/* Your Property Card */}
              {myPropertyLocation && (
                <Card className="border-[#C9A962]/30 bg-[#C9A962]/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Home className="w-5 h-5 text-[#C9A962]" />
                      <span className="text-[#0F172A]">Your Property</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-[#0F172A]/70 truncate">{myPropertyLocation.address}</p>
                    <Button
                      onClick={() => { setMyPropertyLocation(null); setListings([]); setHasAutoLoaded(false); }}
                      variant="link"
                      className="text-xs text-[#C9A962] p-0 h-auto mt-2"
                    >
                      Change property
                    </Button>
                  </CardContent>
                </Card>
              )}
              
              {/* Filters */}
              {listings.length > 0 && (
                <>
                  <Card className="border-[#0F172A]/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Filters</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Distance Filter */}
                      <div>
                        <label className="text-sm font-medium text-[#0F172A]/70 mb-2 block">
                          Distance from You
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3 h-3 inline ml-1 text-[#0F172A]/40" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-48">Filter to see only properties within a certain distance of your property.</p>
                            </TooltipContent>
                          </Tooltip>
                        </label>
                        <Select value={distanceFilter} onValueChange={setDistanceFilter}>
                          <SelectTrigger className="border-[#0F172A]/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Distances</SelectItem>
                            <SelectItem value="0.5">Within 0.5 mi</SelectItem>
                            <SelectItem value="1">Within 1 mi</SelectItem>
                            <SelectItem value="2">Within 2 mi</SelectItem>
                            <SelectItem value="5">Within 5 mi</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Bedroom Filter */}
                      <div>
                        <label className="text-sm font-medium text-[#0F172A]/70 mb-2 block">Bedrooms</label>
                        <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
                          <SelectTrigger className="border-[#0F172A]/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All ({listings.length})</SelectItem>
                            {[1, 2, 3, 4, 5].map(n => {
                              const count = listings.filter(l => l.bedrooms === n).length;
                              if (count === 0) return null;
                              return <SelectItem key={n} value={String(n)}>{n} BR ({count})</SelectItem>;
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Revenue Legend */}
                  <Card className="border-[#0F172A]/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Revenue Tiers</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span className="text-sm text-[#0F172A]/70">Top Performers</span>
                        </div>
                        <span className="text-sm font-medium text-green-600">{formatCurrency(thresholds.high)}+</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#C9A962]" />
                          <span className="text-sm text-[#0F172A]/70">Average</span>
                        </div>
                        <span className="text-sm font-medium text-[#C9A962]">{formatCurrency(thresholds.low)} - {formatCurrency(thresholds.high)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <span className="text-sm text-[#0F172A]/70">Below Average</span>
                        </div>
                        <span className="text-sm font-medium text-red-500">Under {formatCurrency(thresholds.low)}</span>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Stats */}
                  <Card className="border-[#0F172A]/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[#C9A962]" />
                        Market Stats
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-[#0F172A]/60">Properties</span>
                        <span className="font-semibold">{filteredListings.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-[#0F172A]/60">Avg Revenue</span>
                        <span className="font-semibold text-[#C9A962]">{formatCurrency(thresholds.average)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-[#0F172A]/60">Avg Occupancy</span>
                        <span className="font-semibold">{avgOccupancy}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-[#0F172A]/60">Avg Nightly Rate</span>
                        <span className="font-semibold">{formatCurrency(avgAdr)}</span>
                      </div>
                      {closestDistance !== null && (
                        <div className="flex justify-between border-t border-[#0F172A]/10 pt-3 mt-3">
                          <span className="text-sm text-[#0F172A]/60">Closest Competitor</span>
                          <span className="font-semibold text-[#C9A962]">{formatDistance(closestDistance)}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
            
            {/* Map */}
            <div className="lg:col-span-3 space-y-4">
              <Card className="overflow-hidden border-[#0F172A]/10 shadow-sm">
                <MapView
                  className="h-[400px] sm:h-[500px] lg:h-[550px]"
                  initialCenter={myPropertyLocation ? { lat: myPropertyLocation.lat, lng: myPropertyLocation.lng } : { lat: 36.1627, lng: -86.7816 }}
                  initialZoom={myPropertyLocation ? 13 : 5}
                  onMapReady={(map) => {
                    mapRef.current = map;
                    if (window.google) {
                      geocoderRef.current = new google.maps.Geocoder();
                    }
                    // Trigger auto-load if property exists
                    if (hasProperty && myProperty && !hasAutoLoaded) {
                      setHasAutoLoaded(true);
                      if (myProperty.latitude && myProperty.longitude) {
                        const location = { address: myProperty.formattedAddress || myProperty.address, lat: myProperty.latitude, lng: myProperty.longitude };
                        setMyPropertyLocation(location);
                        fetchListingsForLocation(location.lat, location.lng, myProperty.city, myProperty.state);
                      } else {
                        geocodeAndSearch(myProperty.address);
                      }
                    }
                  }}
                />
              </Card>
              
              {/* Toggle Table View */}
              {listings.length > 0 && (
                <div className="flex justify-between items-center">
                  <p className="text-sm text-[#0F172A]/60">
                    Showing {filteredListings.length} of {listings.length} properties
                  </p>
                  <Button
                    onClick={() => setShowTable(!showTable)}
                    variant="outline"
                    size="sm"
                    className="border-[#0F172A]/20"
                  >
                    <List className="w-4 h-4 mr-2" />
                    {showTable ? 'Hide Table' : 'Show Table'}
                  </Button>
                </div>
              )}
              
              {/* Property Table */}
              {showTable && filteredListings.length > 0 && (
                <Card className="border-[#0F172A]/10">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[250px]">Property</TableHead>
                          <TableHead className="cursor-pointer hover:bg-[#f8f7f4]" onClick={() => handleSort('distance')}>
                            <div className="flex items-center gap-1">
                              Distance
                              <ArrowUpDown className="w-3 h-3" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-[#f8f7f4]" onClick={() => handleSort('revenue')}>
                            <div className="flex items-center gap-1">
                              Revenue
                              <ArrowUpDown className="w-3 h-3" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-[#f8f7f4]" onClick={() => handleSort('occupancy')}>
                            <div className="flex items-center gap-1">
                              Occupancy
                              <ArrowUpDown className="w-3 h-3" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-[#f8f7f4]" onClick={() => handleSort('adr')}>
                            <div className="flex items-center gap-1">
                              Nightly Rate
                              <ArrowUpDown className="w-3 h-3" />
                            </div>
                          </TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredListings.slice(0, 20).map((listing) => (
                          <TableRow key={listing.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {listing.thumbnailUrl ? (
                                  <img src={listing.thumbnailUrl} alt="" className="w-12 h-9 rounded object-cover" />
                                ) : (
                                  <div className="w-12 h-9 rounded bg-[#f0f0f0] flex items-center justify-center">
                                    <Home className="w-4 h-4 text-[#999]" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-sm text-[#0F172A] truncate max-w-[180px]">{listing.title}</p>
                                  <p className="text-xs text-[#0F172A]/50">{listing.bedrooms} BR / {listing.bathrooms} BA</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium text-[#C9A962]">
                                {listing.distanceToMyProperty !== undefined ? formatDistance(listing.distanceToMyProperty) : '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`text-sm font-semibold ${listing.revenue >= thresholds.high ? 'text-green-600' : listing.revenue >= thresholds.low ? 'text-[#C9A962]' : 'text-red-500'}`}>
                                {formatCurrency(listing.revenue)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{Math.round(listing.occupancy > 1 ? listing.occupancy : listing.occupancy * 100)}%</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{formatCurrency(listing.adr)}</span>
                            </TableCell>
                            <TableCell>
                              <a href={listing.airbnbUrl} target="_blank" rel="noopener noreferrer" className="text-[#0F172A]/50 hover:text-[#0F172A]">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {filteredListings.length > 20 && (
                    <div className="p-4 text-center text-sm text-[#0F172A]/50 border-t border-[#0F172A]/10">
                      Showing top 20 of {filteredListings.length} properties
                    </div>
                  )}
                </Card>
              )}
              
              {/* Empty State */}
              {!myPropertyLocation && !isLoading && (
                <div className="p-8 bg-[#f8f7f4] rounded-xl border border-[#0F172A]/10 text-center">
                  <div className="w-16 h-16 rounded-xl bg-[#C9A962]/10 flex items-center justify-center mx-auto mb-4">
                    <Map className="w-8 h-8 text-[#C9A962]" />
                  </div>
                  <h3 className="font-semibold text-[#0F172A] mb-2">Enter Your Property to Get Started</h3>
                  <p className="text-sm text-[#0F172A]/60 max-w-md mx-auto">
                    Once you enter your property address, we'll show you all the competing short-term rentals nearby with their revenue, occupancy, and distance from you.
                  </p>
                </div>
              )}
              
              {isLoading && (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#C9A962] mx-auto mb-4" />
                  <p className="text-sm text-[#0F172A]/60">Loading nearby properties...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
