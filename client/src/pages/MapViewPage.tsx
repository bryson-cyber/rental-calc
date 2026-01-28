import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapView } from '@/components/Map';
import { HierarchicalLocationSelector, LocationSelection } from '@/components/HierarchicalLocationSelector';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Map, MapPin, DollarSign, Info, BedDouble, Home, Navigation, Waves, Thermometer, PawPrint, Car, UtensilsCrossed, WashingMachine, Check, Filter, TrendingUp, Calendar, Building, Star, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  distanceToMyProperty?: number; // Distance in miles
}

interface RevenueThresholds {
  high: number;  // Top 33%
  low: number;   // Bottom 33%
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
  
  // Calculate percentiles
  const lowIndex = Math.floor(revenues.length * 0.33);
  const highIndex = Math.floor(revenues.length * 0.67);
  
  return {
    low: revenues[lowIndex] || average * 0.7,
    high: revenues[highIndex] || average * 1.3,
    average: Math.round(average),
  };
}

// Calculate distance between two points in miles using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
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
    return revenue >= customThreshold ? '#22c55e' : '#9ca3af'; // Green or gray
  }
  
  if (revenue >= thresholds.high) return '#22c55e'; // Green - top performers
  if (revenue >= thresholds.low) return '#C9A962';  // Gold - average
  return '#ef4444'; // Red - below average
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Create improved marker element with premium styling
function createMarkerElement(color: string, revenue: number): HTMLDivElement {
  const markerElement = document.createElement('div');
  markerElement.innerHTML = `
    <div style="
      position: relative;
      cursor: pointer;
      transition: transform 0.2s ease;
    " class="property-marker">
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
      ">${formatCompactCurrency(revenue)}</div>
    </div>
  `;
  
  // Add hover effect
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

// Create "My Property" marker with premium gold styling
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
        background: linear-gradient(135deg, #C9A962 0%, #a08840 100%);
        border: 4px solid white;
        border-radius: 50%;
        box-shadow: 0 6px 20px rgba(201, 169, 98, 0.5), 0 4px 8px rgba(0,0,0,0.2);
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
        background: #C9A962;
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

// Adjust color brightness
function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Format currency in compact form for markers
function formatCompactCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${Math.round(amount / 1000)}K`;
  }
  return `$${amount}`;
}

export default function MapViewPage() {
  const [locationSelection, setLocationSelection] = useState<LocationSelection | null>(null);
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useCustomThreshold, setUseCustomThreshold] = useState(false);
  const [customThreshold, setCustomThreshold] = useState<number>(50000);
  const [selectedProperty, setSelectedProperty] = useState<PropertyListing | null>(null);
  const [bedroomFilter, setBedroomFilter] = useState<string>('all');
  const [showAmenitiesFilter, setShowAmenitiesFilter] = useState(false);
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
  
  // My Property state
  const [myPropertyAddress, setMyPropertyAddress] = useState<string>('');
  const [myPropertyLocation, setMyPropertyLocation] = useState<MyPropertyLocation | null>(null);
  const [isGeocodingMyProperty, setIsGeocodingMyProperty] = useState(false);
  const [myPropertyError, setMyPropertyError] = useState<string | null>(null);
  
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const myPropertyMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  
  // Filter listings by bedroom count and add distance to my property
  const filteredListings = useMemo(() => {
    let filtered = bedroomFilter === 'all' ? listings : listings.filter(l => l.bedrooms === parseInt(bedroomFilter));
    
    // Add distance to my property if set
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
    
    return filtered;
  }, [listings, bedroomFilter, myPropertyLocation]);
  
  // Calculate thresholds based on filtered listings
  const thresholds = useMemo(() => calculateThresholds(filteredListings), [filteredListings]);
  
  // Geocode my property address
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
        
        // Center map on my property
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
  
  // Clear my property
  const clearMyProperty = useCallback(() => {
    setMyPropertyLocation(null);
    setMyPropertyAddress('');
    setMyPropertyError(null);
    
    // Remove my property marker
    if (myPropertyMarkerRef.current) {
      myPropertyMarkerRef.current.map = null;
      myPropertyMarkerRef.current = null;
    }
  }, []);
  
  // Handle location search - accepts selection directly to avoid state timing issues
  const performSearch = useCallback(async (selection: LocationSelection) => {
    setIsLoading(true);
    setError(null);
    setListings([]);
    
    try {
      // Determine which ID to use for fetching listings
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
      
      // Fetch listings using tRPC - use GET request format for queries
      const response = await fetch(`/api/trpc/compData.getListings?input=${encodeURIComponent(JSON.stringify({ json: { submarketId: marketId } }))}`);
      const data = await response.json();
      
      if (data.result?.data?.json?.listings) {
        const fetchedListings = data.result.data.json.listings;
        console.log('[MapView] Received', fetchedListings.length, 'listings');
        
        // Filter listings with valid coordinates
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
            thumbnailUrl: l.thumbnail_url || l.thumbnailUrl || null,
          }));
        
        console.log('[MapView] Listings with coordinates:', listingsWithCoords.length);
        setListings(listingsWithCoords);
        
        // Center map on first listing
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
  
  // Handle manual search button click
  const handleSearch = useCallback(() => {
    if (locationSelection) {
      performSearch(locationSelection);
    }
  }, [locationSelection, performSearch]);
  
  // Update my property marker
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    
    // Remove existing my property marker
    if (myPropertyMarkerRef.current) {
      myPropertyMarkerRef.current.map = null;
      myPropertyMarkerRef.current = null;
    }
    
    // Create new my property marker if location is set
    if (myPropertyLocation) {
      const markerElement = createMyPropertyMarker();
      
      myPropertyMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: myPropertyLocation.lat, lng: myPropertyLocation.lng },
        title: 'My Property',
        content: markerElement,
        zIndex: 1000, // Ensure it's on top
      });
      
      // Add click listener
      myPropertyMarkerRef.current.addListener('click', () => {
        if (!infoWindowRef.current) {
          infoWindowRef.current = new google.maps.InfoWindow();
        }
        
        const content = `
          <div style="max-width: 250px; font-family: system-ui, sans-serif; padding: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #C9A962 0%, #a08840 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #C9A962;">My Property</h3>
            </div>
            <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.4;">${myPropertyLocation.address}</p>
          </div>
        `;
        
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(mapRef.current, myPropertyMarkerRef.current);
      });
    }
  }, [myPropertyLocation]);
  
  // Update markers when listings or thresholds change
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    
    // Clear existing markers
    markersRef.current.forEach(marker => {
      marker.map = null;
    });
    markersRef.current = [];
    
    // Create info window if not exists
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }
    
    // Add markers for each listing
    filteredListings.forEach(listing => {
      const color = getMarkerColor(
        listing.revenue,
        thresholds,
        useCustomThreshold ? customThreshold : null
      );
      
      const markerElement = createMarkerElement(color, listing.revenue);
      
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current!,
        position: { lat: listing.latitude, lng: listing.longitude },
        title: listing.title,
        content: markerElement,
      });
      
      // Add click listener
      marker.addListener('click', () => {
        setSelectedProperty(listing);
        
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
                <div style="font-size: 14px; font-weight: 600; color: #0F172A;">${Math.round(listing.occupancy * 100)}%</div>
              </div>
              <div style="background: #f8f7f4; padding: 8px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: #666; margin-bottom: 2px;">ADR</div>
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
  }, [filteredListings, listings.length, thresholds, useCustomThreshold, customThreshold]);
  
  const getLocationName = () => {
    if (locationSelection?.zipcode) return locationSelection.zipcode;
    if (locationSelection?.submarket) return locationSelection.submarket.name;
    if (locationSelection?.market) return locationSelection.market.name;
    return 'Select a location';
  };
  
  // Calculate average occupancy
  const avgOccupancy = filteredListings.length > 0 
    ? Math.round(filteredListings.reduce((sum, l) => sum + l.occupancy * 100, 0) / filteredListings.length)
    : 0;
  
  // Calculate average ADR
  const avgAdr = filteredListings.length > 0 
    ? filteredListings.reduce((sum, l) => sum + l.adr, 0) / filteredListings.length
    : 0;
  
  return (
    <div className="min-h-screen bg-white">
      {/* Premium Header - Deep Navy with Gold Accents */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#0F172A] to-[#1e293b] text-white py-8 px-6">
        <div className="container">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-xl bg-[#C9A962]/20 flex items-center justify-center border border-[#C9A962]/30">
              <Map className="w-7 h-7 text-[#C9A962]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-serif font-semibold text-white">See the Map</h1>
              <p className="text-white/60 text-sm font-sans">
                Visualize property performance across any market
              </p>
            </div>
          </div>
          <p className="text-white/50 max-w-2xl text-sm mt-2">
            See which neighborhoods have the highest-earning rentals at a glance. Compare properties, analyze revenue tiers, and find the best opportunities.
          </p>
        </div>
      </div>
      
      <div className="container py-8">
        {/* Location Selection - Premium Card */}
        <Card className="mb-6 border-[#0F172A]/10 shadow-sm">
          <CardHeader className="border-b border-[#0F172A]/5 bg-[#f8f7f4]">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="w-10 h-10 rounded-xl bg-[#C9A962]/10 flex items-center justify-center border border-[#C9A962]/20">
                <MapPin className="w-5 h-5 text-[#C9A962]" />
              </div>
              <span className="text-[#0F172A] font-semibold">Select Location</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <HierarchicalLocationSelector
              onSelectionChange={setLocationSelection}
              onSearch={(selection) => {
                // Update state and immediately trigger search with the selection
                setLocationSelection(selection);
                performSearch(selection);
              }}
            />
            <div className="mt-4 flex gap-3">
              <Button
                onClick={handleSearch}
                disabled={!locationSelection || isLoading}
                className="bg-[#0F172A] hover:bg-[#1e293b] text-white px-6 h-11"
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <Info className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-sm">{error}</p>
          </div>
        )}
        
        {/* Map and Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Legend and Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* My Property Section - Premium styling */}
            <Card className="border-[#0F172A]/10 bg-white shadow-sm">
              <CardHeader className="pb-3 border-b border-[#0F172A]/5">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#C9A962]/10 flex items-center justify-center border border-[#C9A962]/20">
                    <Home className="w-4 h-4 text-[#C9A962]" />
                  </div>
                  <span className="text-[#0F172A] font-semibold">My Property</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <p className="text-xs text-[#0F172A]/50">
                  Enter your property address to see how far competitors are from your location.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter your address..."
                    value={myPropertyAddress}
                    onChange={(e) => setMyPropertyAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && geocodeMyProperty()}
                    className="text-sm border-[#0F172A]/10"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={geocodeMyProperty}
                    disabled={isGeocodingMyProperty || !myPropertyAddress.trim()}
                    size="sm"
                    className="flex-1 bg-[#C9A962] hover:bg-[#b8984f] text-white"
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
                  <div className="p-3 bg-[#C9A962]/10 rounded-lg text-xs text-[#0F172A] border border-[#C9A962]/20">
                    <div className="font-semibold text-[#C9A962] mb-1">Location Set</div>
                    <div className="truncate text-[#0F172A]/70">{myPropertyLocation.address}</div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Threshold Controls - Premium styling */}
            <Card className="border-[#0F172A]/10 bg-white shadow-sm">
              <CardHeader className="pb-3 border-b border-[#0F172A]/5">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20">
                    <DollarSign className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-[#0F172A] font-semibold">Revenue Thresholds</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-3.5 h-3.5 text-[#0F172A]/40" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-[#0F172A] text-white border-0 max-w-xs">
                        <p>Properties are color-coded by annual revenue. Green = top performers, Gold = average, Red = below average.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Toggle */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="custom-mode" className="text-sm text-[#0F172A]/70">Custom Threshold</Label>
                  <Switch
                    id="custom-mode"
                    checked={useCustomThreshold}
                    onCheckedChange={setUseCustomThreshold}
                  />
                </div>
                
                {useCustomThreshold ? (
                  <div>
                    <Label className="text-xs text-[#0F172A]/50">Minimum Revenue</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-[#0F172A]/70">$</span>
                      <Input
                        type="number"
                        value={customThreshold}
                        onChange={(e) => setCustomThreshold(Number(e.target.value))}
                        className="h-9 border-[#0F172A]/10"
                      />
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-500" />
                        <span className="text-[#0F172A]/70">Above {formatCurrency(customThreshold)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-gray-400" />
                        <span className="text-[#0F172A]/70">Below {formatCurrency(customThreshold)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-gradient-to-br from-[#C9A962]/10 to-[#C9A962]/5 rounded-xl border border-[#C9A962]/20">
                      <div className="text-xs text-[#0F172A]/50 mb-1">Market Average</div>
                      <div className="text-xl font-bold text-[#C9A962]">
                        {listings.length > 0 ? formatCurrency(thresholds.average) : '—'}
                      </div>
                      <div className="text-xs text-[#0F172A]/40 mt-1">per year</div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-500" />
                        <span className="text-[#0F172A]/70">Top 33%: Above {listings.length > 0 ? formatCurrency(thresholds.high) : '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-[#C9A962]" />
                        <span className="text-[#0F172A]/70">Middle 33%: {listings.length > 0 ? `${formatCurrency(thresholds.low)} - ${formatCurrency(thresholds.high)}` : '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-red-500" />
                        <span className="text-[#0F172A]/70">Bottom 33%: Below {listings.length > 0 ? formatCurrency(thresholds.low) : '—'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Bedroom Filter */}
            {listings.length > 0 && (
              <Card className="border-[#0F172A]/10 bg-white shadow-sm">
                <CardHeader className="pb-3 border-b border-[#0F172A]/5">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                      <BedDouble className="w-4 h-4 text-purple-500" />
                    </div>
                    <span className="text-[#0F172A] font-semibold">Filter by Bedrooms</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
                    <SelectTrigger className="border-[#0F172A]/10">
                      <SelectValue placeholder="All Bedrooms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Bedrooms ({listings.length})</SelectItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(br => {
                        const count = listings.filter(l => l.bedrooms === br).length;
                        return (
                          <SelectItem key={br} value={String(br)}>
                            {br} Bedroom{br !== 1 ? 's' : ''} ({count})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {bedroomFilter !== 'all' && (
                    <p className="mt-2 text-xs text-[#0F172A]/50">
                      Showing {filteredListings.length} of {listings.length} properties
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Stats - Premium styling */}
            {filteredListings.length > 0 && (
              <Card className="border-[#0F172A]/10 bg-white shadow-sm">
                <CardHeader className="pb-3 border-b border-[#0F172A]/5">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-[#0F172A] font-semibold">{getLocationName()}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#0F172A]/50">Properties Shown</span>
                      <span className="font-semibold text-[#0F172A]">{filteredListings.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#0F172A]/50">Avg Revenue</span>
                      <span className="font-semibold text-[#C9A962]">{formatCurrency(thresholds.average)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#0F172A]/50">Avg Occupancy</span>
                      <span className="font-semibold text-[#0F172A]">{avgOccupancy}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#0F172A]/50">Avg Nightly Rate</span>
                      <span className="font-semibold text-[#0F172A]">{formatCurrency(avgAdr)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#0F172A]/50">Top Performer</span>
                      <span className="font-semibold text-green-600">
                        {filteredListings.length > 0 ? formatCurrency(Math.max(...filteredListings.map(l => l.revenue))) : '—'}
                      </span>
                    </div>
                    {myPropertyLocation && (
                      <div className="border-t border-[#0F172A]/10 pt-3 mt-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-[#0F172A]/50">Closest Competitor</span>
                          <span className="font-semibold text-[#C9A962]">
                            {filteredListings.length > 0 && filteredListings[0].distanceToMyProperty !== undefined
                              ? formatDistance(Math.min(...filteredListings.map(l => l.distanceToMyProperty || Infinity)))
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-[#0F172A]/50">Avg Distance</span>
                          <span className="font-semibold text-[#C9A962]">
                            {filteredListings.length > 0 && filteredListings[0].distanceToMyProperty !== undefined
                              ? formatDistance(filteredListings.reduce((sum, l) => sum + (l.distanceToMyProperty || 0), 0) / filteredListings.length)
                              : '—'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Map */}
          <div className="lg:col-span-3">
            <Card className="overflow-hidden border-[#0F172A]/10 shadow-sm">
              <MapView
                className="h-[400px] sm:h-[500px] lg:h-[600px]"
                initialCenter={{ lat: 36.1627, lng: -86.7816 }} // Nashville default
                initialZoom={11}
                onMapReady={(map) => {
                  mapRef.current = map;
                  // Initialize geocoder
                  if (window.google) {
                    geocoderRef.current = new google.maps.Geocoder();
                  }
                }}
              />
            </Card>
            
            {listings.length === 0 && !isLoading && (
              <div className="mt-4 p-6 bg-[#f8f7f4] rounded-xl border border-[#0F172A]/10">
                <div className="flex items-center justify-center gap-4 text-[#0F172A]/60">
                  <div className="w-12 h-12 rounded-xl bg-[#C9A962]/10 flex items-center justify-center">
                    <Map className="w-6 h-6 text-[#C9A962]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0F172A]">Search for a location</p>
                    <p className="text-sm text-[#0F172A]/50">
                      Enter a city, zip code, or market name above to see property performance data
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
