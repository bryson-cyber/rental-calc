import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { MapView } from '@/components/Map';
import { HierarchicalLocationSelector, LocationSelection } from '@/components/HierarchicalLocationSelector';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Map, MapPin, DollarSign, Info } from 'lucide-react';

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
}

interface RevenueThresholds {
  high: number;  // Top 33%
  low: number;   // Bottom 33%
  average: number;
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

function getMarkerColor(revenue: number, thresholds: RevenueThresholds, customThreshold: number | null): string {
  if (customThreshold !== null) {
    return revenue >= customThreshold ? '#16a34a' : '#9ca3af'; // Green or gray
  }
  
  if (revenue >= thresholds.high) return '#16a34a'; // Green - top performers
  if (revenue >= thresholds.low) return '#f59e0b';  // Amber - average
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

export default function MapViewPage() {
  const [locationSelection, setLocationSelection] = useState<LocationSelection | null>(null);
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useCustomThreshold, setUseCustomThreshold] = useState(false);
  const [customThreshold, setCustomThreshold] = useState<number>(50000);
  const [selectedProperty, setSelectedProperty] = useState<PropertyListing | null>(null);
  
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  
  // Calculate thresholds based on current listings
  const thresholds = useMemo(() => calculateThresholds(listings), [listings]);
  
  // Handle location search - accepts selection directly to avoid state timing issues
  const performSearch = useCallback(async (selection: LocationSelection) => {
    if (!selection) return;
    
    setIsLoading(true);
    setError(null);
    setListings([]);
    
    try {
      let marketId: string | undefined;
      let isMarket = false;
      
      // Determine what to search based on selection
      // Priority: submarket > market (for zip codes, we need a parent market/submarket)
      if (selection.submarket) {
        // Search by submarket
        marketId = selection.submarket.id;
        isMarket = false;
      } else if (selection.market) {
        // Search by city/market
        marketId = selection.market.id;
        isMarket = !(selection.market as any).isSubmarketAsMarket;
      } else if (selection.zipcode) {
        // Zip code only - need to show error since we don't have a market
        setError('Please select a city/metro area first, then choose a zip code');
        setIsLoading(false);
        return;
      }
      
      if (!marketId) {
        setError('Please select a location to search');
        setIsLoading(false);
        return;
      }
      
      console.log('[MapView] Fetching listings for marketId:', marketId, 'isMarket:', isMarket);
      
      // Fetch listings (get more for map view)
      // Use fetch directly since we need to pass isMarket which isn't in the query schema
      const response = await fetch('/api/trpc/compData.getListings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            submarketId: marketId,
            page: 1,
            pageSize: 100,
            isMarket,
          }
        }),
        credentials: 'include',
      });
      const data = await response.json();
      console.log('[MapView] API response:', data);
      
      const result = data.result?.data?.json || data.result?.data || { listings: [], totalCount: 0 };
      
      console.log('[MapView] Listings count:', result.listings?.length || 0);
      
      // Transform to our format with coordinates
      const transformedListings: PropertyListing[] = (result.listings || [])
        .filter((l: any) => l.latitude && l.longitude) // Only include listings with coordinates
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
          propertyType: l.property_type || 'unknown',
          airbnbUrl: l.airbnb_url || '',
          thumbnailUrl: l.image_url || null,
        }));
      
      console.log('[MapView] Transformed listings with coordinates:', transformedListings.length);
      
      setListings(transformedListings);
      
      // Center map on listings
      if (transformedListings.length > 0 && mapRef.current) {
        const bounds = new google.maps.LatLngBounds();
        transformedListings.forEach(l => {
          bounds.extend({ lat: l.latitude, lng: l.longitude });
        });
        mapRef.current.fitBounds(bounds);
        console.log('[MapView] Map centered on bounds');
      } else if (transformedListings.length === 0) {
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
    
    console.log('[MapView] Creating', listings.length, 'markers');
    
    // Create new markers
    listings.forEach(listing => {
      const color = getMarkerColor(
        listing.revenue,
        thresholds,
        useCustomThreshold ? customThreshold : null
      );
      
      // Create custom marker element
      const markerElement = document.createElement('div');
      markerElement.innerHTML = `
        <div style="
          width: 24px;
          height: 24px;
          background-color: ${color};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
        "></div>
      `;
      
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: listing.latitude, lng: listing.longitude },
        title: listing.title,
        content: markerElement,
      });
      
      // Add click listener
      marker.addListener('click', () => {
        setSelectedProperty(listing);
        
        const content = `
          <div style="max-width: 280px; font-family: system-ui, sans-serif;">
            ${listing.thumbnailUrl ? `<img src="${listing.thumbnailUrl}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px 8px 0 0;" />` : ''}
            <div style="padding: 12px;">
              <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; line-height: 1.3;">${listing.title}</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                <div>
                  <div style="color: #666;">Annual Revenue</div>
                  <div style="font-weight: 600; color: #16a34a;">${formatCurrency(listing.revenue)}</div>
                </div>
                <div>
                  <div style="color: #666;">Occupancy</div>
                  <div style="font-weight: 600;">${Math.round(listing.occupancy * 100)}%</div>
                </div>
                <div>
                  <div style="color: #666;">Nightly Rate</div>
                  <div style="font-weight: 600;">${formatCurrency(listing.adr)}</div>
                </div>
                <div>
                  <div style="color: #666;">Rating</div>
                  <div style="font-weight: 600;">${listing.rating ? `${listing.rating} ⭐` : 'N/A'}</div>
                </div>
              </div>
              <div style="margin-top: 8px; font-size: 11px; color: #666;">
                ${listing.bedrooms} BR · ${listing.bathrooms} BA · ${listing.accommodates} guests
              </div>
              <a href="${listing.airbnbUrl}" target="_blank" rel="noopener noreferrer" 
                 style="display: block; margin-top: 12px; padding: 8px 12px; background: #C9A962; color: white; text-align: center; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500;">
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
  }, [listings, thresholds, useCustomThreshold, customThreshold]);
  
  const getLocationName = () => {
    if (locationSelection?.zipcode) return locationSelection.zipcode;
    if (locationSelection?.submarket) return locationSelection.submarket.name;
    if (locationSelection?.market) return locationSelection.market.name;
    return 'Select a location';
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-stone-50">
      {/* Header */}
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
      
      <div className="container py-8">
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
                // Update state and immediately trigger search with the selection
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
            {/* Threshold Controls */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#C9A962]" />
                  Revenue Thresholds
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Toggle */}
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
            
            {/* Stats */}
            {listings.length > 0 && (
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
                      <span className="font-medium">{listings.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Revenue</span>
                      <span className="font-medium">{formatCurrency(thresholds.average)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Top Performer</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(Math.max(...listings.map(l => l.revenue)))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Map */}
          <div className="lg:col-span-3">
            <Card className="overflow-hidden">
              <MapView
                className="h-[600px]"
                initialCenter={{ lat: 36.1627, lng: -86.7816 }} // Nashville default
                initialZoom={11}
                onMapReady={(map) => {
                  mapRef.current = map;
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
