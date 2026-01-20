import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapView } from '@/components/Map';
import { HierarchicalLocationSelector, LocationSelection } from '@/components/HierarchicalLocationSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Map, MapPin, DollarSign, Info, BedDouble, Home, Navigation, ArrowUpDown, Building2 } from 'lucide-react';
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
      
      console.log('[MapView] Fetching listings for market:', marketId);
      
      const response = await fetch(`/api/trpc/compData.getListings?input=${encodeURIComponent(JSON.stringify({ json: { submarketId: marketId } }))}`);
      const data = await response.json();
      
      if (data.result?.data?.json?.listings) {
        const fetchedListings = data.result.data.json.listings;
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
  }, []);
  
  const handleSearch = useCallback(() => {
    if (locationSelection) {
      performSearch(locationSelection);
    }
  }, [locationSelection, performSearch]);
  
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
  }, [myPropertyLocation]);
  
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    
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
                  <div style="font-weight: 700; color: #7c3aed; font-size: 14px;">${listing.rating ? `${listing.rating} ⭐` : 'N/A'}</div>
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
  }, [filteredListings, listings.length, thresholds, useCustomThreshold, customThreshold]);
  
  const getLocationName = () => {
    if (locationSelection?.zipcode) return locationSelection.zipcode;
    if (locationSelection?.submarket) return locationSelection.submarket.name;
    if (locationSelection?.market) return locationSelection.market.name;
    return 'Select a location';
  };
  
  return (
    <div className={`${embedded ? '' : 'min-h-screen bg-gradient-to-b from-white to-stone-50'} ${className}`}>
      {/* Header - only show if not embedded */}
      {!embedded && (
        <div className="bg-[#0F172A] text-white py-8">
          <div className="container">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-[#C9A962]/20 flex items-center justify-center">
                <Map className="w-5 h-5 text-[#C9A962]" />
              </div>
              <h1 className="text-2xl md:text-3xl font-serif font-semibold">See the Map</h1>
            </div>
            <p className="text-white/70 max-w-2xl">
              Visualize property performance across any market. See which neighborhoods have the highest-earning rentals at a glance.
            </p>
          </div>
        </div>
      )}
      
      <div className={embedded ? '' : 'container py-8'}>
        {/* Location Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="w-5 h-5 text-[#C9A962]" />
              Select Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HierarchicalLocationSelector
              onSelectionChange={setLocationSelection}
              onSearch={(selection) => {
                setLocationSelection(selection);
                performSearch(selection);
              }}
            />
            <div className="mt-4 flex gap-3">
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Legend and Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* My Property Section */}
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Home className="w-4 h-4 text-blue-600" />
                  My Property
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Enter your property address to see how far competitors are from your location.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter your address..."
                    value={myPropertyAddress}
                    onChange={(e) => setMyPropertyAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && geocodeMyProperty()}
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={geocodeMyProperty}
                    disabled={isGeocodingMyProperty || !myPropertyAddress.trim()}
                    size="sm"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isGeocodingMyProperty ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Navigation className="w-3 h-3 mr-1" />
                    )}
                    Set Location
                  </Button>
                  {myPropertyLocation && (
                    <Button
                      onClick={clearMyProperty}
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {myPropertyError && (
                  <p className="text-xs text-red-600">{myPropertyError}</p>
                )}
                {myPropertyLocation && (
                  <div className="p-2 bg-blue-100 rounded-lg text-xs text-blue-800">
                    <div className="font-medium">📍 Location Set</div>
                    <div className="truncate">{myPropertyLocation.address}</div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Threshold Controls */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#C9A962]" />
                  Revenue Thresholds
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
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-600" />
                        <span>≥ {formatCurrency(customThreshold)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-gray-400" />
                        <span>&lt; {formatCurrency(customThreshold)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-stone-50 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Market Average</div>
                      <div className="text-lg font-semibold text-[#C9A962]">
                        {listings.length > 0 ? formatCurrency(thresholds.average) : '—'}
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-600" />
                        <span>Top 33%: ≥ {listings.length > 0 ? formatCurrency(thresholds.high) : '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-amber-500" />
                        <span>Middle 33%: {listings.length > 0 ? `${formatCurrency(thresholds.low)} - ${formatCurrency(thresholds.high)}` : '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-red-500" />
                        <span>Bottom 33%: &lt; {listings.length > 0 ? formatCurrency(thresholds.low) : '—'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Filters & Sorting */}
            {listings.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BedDouble className="w-4 h-4 text-[#C9A962]" />
                    Filters & Sorting
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Bedroom Filter */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Bedrooms</Label>
                    <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Bedrooms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Bedrooms ({listings.length})</SelectItem>
                        {Array.from(new Set(listings.map(l => l.bedrooms))).sort((a, b) => a - b).map(br => {
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
                  {(bedroomFilter !== 'all' || propertyTypeFilter !== 'all') && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Showing {filteredListings.length} of {listings.length} properties
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2 mt-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setBedroomFilter('all');
                          setPropertyTypeFilter('all');
                        }}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Stats */}
            {filteredListings.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-4 h-4 text-[#C9A962]" />
                    {getLocationName()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Properties Shown</span>
                      <span className="font-medium">{filteredListings.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Revenue</span>
                      <span className="font-medium">{formatCurrency(thresholds.average)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Top Performer</span>
                      <span className="font-medium text-green-600">
                        {filteredListings.length > 0 ? formatCurrency(Math.max(...filteredListings.map(l => l.revenue))) : '—'}
                      </span>
                    </div>
                    {myPropertyLocation && (
                      <>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Closest Competitor</span>
                            <span className="font-medium text-blue-600">
                              {filteredListings.length > 0 && filteredListings[0].distanceToMyProperty !== undefined
                                ? formatDistance(Math.min(...filteredListings.map(l => l.distanceToMyProperty || Infinity)))
                                : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Avg Distance</span>
                            <span className="font-medium text-blue-600">
                              {filteredListings.length > 0 && filteredListings[0].distanceToMyProperty !== undefined
                                ? formatDistance(filteredListings.reduce((sum, l) => sum + (l.distanceToMyProperty || 0), 0) / filteredListings.length)
                                : '—'}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Map */}
          <div className="lg:col-span-3">
            <Card className="overflow-hidden">
              <MapView
                className={embedded ? "h-[500px]" : "h-[600px]"}
                initialCenter={{ lat: 36.1627, lng: -86.7816 }}
                initialZoom={11}
                onMapReady={(map) => {
                  mapRef.current = map;
                  if (window.google) {
                    geocoderRef.current = new google.maps.Geocoder();
                  }
                }}
              />
            </Card>
            
            {listings.length === 0 && !isLoading && (
              <div className="mt-4 text-center text-muted-foreground">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Select a location and click "Show on Map" to see property markers</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapViewContent;
