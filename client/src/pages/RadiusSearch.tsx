import { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { MapView } from '@/components/Map';
import { 
  ArrowLeft, 
  MapPin, 
  Search,
  Loader2,
  DollarSign,
  Star,
  Users,
  Home,
  ExternalLink,
  Filter,
  SlidersHorizontal,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface ListingData {
  id: string;
  title: string;
  airbnb_url?: string;
  image_url?: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  property_type: string;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  superhost?: boolean;
  professionally_managed?: boolean;
  latitude?: number;
  longitude?: number;
  distance_meters?: number;
}

function ListingCard({ listing }: { listing: ListingData }) {
  const distanceKm = listing.distance_meters ? (listing.distance_meters / 1000).toFixed(1) : null;
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-0">
        {/* Image placeholder */}
        <div className="h-32 bg-gradient-to-br from-[#0F172A]/10 to-[#0F172A]/20 relative">
          {listing.image_url ? (
            <img 
              src={listing.image_url} 
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Home className="w-8 h-8 text-[#0F172A]/30" />
            </div>
          )}
          {distanceKm && (
            <Badge className="absolute top-2 left-2 bg-[#0F172A]/80 text-white">
              <Target className="w-3 h-3 mr-1" />
              {distanceKm} km
            </Badge>
          )}
          {listing.superhost && (
            <Badge className="absolute top-2 right-2 bg-[#C9A962] text-white">
              Superhost
            </Badge>
          )}
        </div>

        <div className="p-3">
          <h3 className="font-medium text-[#0F172A] text-sm line-clamp-1 mb-1">
            {listing.title}
          </h3>
          
          <div className="flex items-center gap-2 text-xs text-[#0F172A]/60 mb-2">
            <span>{listing.bedrooms} BR</span>
            <span>•</span>
            <span>{listing.bathrooms} BA</span>
            <span>•</span>
            <span>{listing.accommodates} guests</span>
          </div>

          {listing.rating && (
            <div className="flex items-center gap-1 text-xs mb-2">
              <Star className="w-3 h-3 text-[#C9A962] fill-[#C9A962]" />
              <span className="font-medium">{listing.rating.toFixed(2)}</span>
              <span className="text-[#0F172A]/60">({listing.reviews} reviews)</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1 mb-3">
            <div className="text-center p-1.5 bg-[#0F172A]/5 rounded">
              <div className="text-sm font-semibold text-[#0F172A]">
                ${Math.round(listing.annual_revenue / 1000)}K
              </div>
              <div className="text-[10px] text-[#0F172A]/60">Revenue</div>
            </div>
            <div className="text-center p-1.5 bg-[#0F172A]/5 rounded">
              <div className="text-sm font-semibold text-[#0F172A]">
                ${Math.round(listing.adr)}
              </div>
              <div className="text-[10px] text-[#0F172A]/60">ADR</div>
            </div>
            <div className="text-center p-1.5 bg-[#0F172A]/5 rounded">
              <div className="text-sm font-semibold text-[#0F172A]">
                {Math.round(listing.occupancy * 100)}%
              </div>
              <div className="text-[10px] text-[#0F172A]/60">Occ</div>
            </div>
          </div>

          {listing.airbnb_url && (
            <a 
              href={listing.airbnb_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 text-xs text-[#C9A962] hover:underline"
            >
              View on Airbnb
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RadiusSearch() {
  const [address, setAddress] = useState('');
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [radius, setRadius] = useState(2000); // meters
  const [bedrooms, setBedrooms] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'revenue' | 'adr' | 'occupancy' | 'rating' | 'distance'>('revenue');
  const [isSearching, setIsSearching] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading, refetch } = trpc.advanced.getListingsInRadius.useQuery(
    {
      latitude: searchLocation?.lat || 0,
      longitude: searchLocation?.lng || 0,
      radiusMeters: radius,
      bedrooms,
      sort_by: sortBy,
      sort_direction: sortBy === 'distance' ? 'asc' : 'desc',
      limit: 25,
    },
    {
      enabled: !!searchLocation,
    }
  );

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    geocoderRef.current = new google.maps.Geocoder();
    
    // Set initial view to US
    map.setCenter({ lat: 39.8283, lng: -98.5795 });
    map.setZoom(4);

    // Setup autocomplete after map is ready
    if (inputRef.current) {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          setSearchLocation({ lat, lng, address: place.formatted_address });
          setAddress(place.formatted_address || '');
          map.setCenter({ lat, lng });
          map.setZoom(14);
        }
      });
    }

    // Allow clicking on map to set location
    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        
        // Reverse geocode to get address
        geocoderRef.current?.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            setAddress(results[0].formatted_address);
            setSearchLocation({ lat, lng, address: results[0].formatted_address });
          } else {
            setSearchLocation({ lat, lng });
          }
        });
        
        map.setCenter({ lat, lng });
        map.setZoom(14);
      }
    });
  }, []);

  // Update circle and markers when search location or radius changes
  useEffect(() => {
    if (!mapRef.current || !searchLocation) return;

    // Update or create circle
    if (circleRef.current) {
      circleRef.current.setCenter({ lat: searchLocation.lat, lng: searchLocation.lng });
      circleRef.current.setRadius(radius);
    } else {
      circleRef.current = new google.maps.Circle({
        map: mapRef.current,
        center: { lat: searchLocation.lat, lng: searchLocation.lng },
        radius: radius,
        fillColor: '#C9A962',
        fillOpacity: 0.15,
        strokeColor: '#C9A962',
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });
    }
  }, [searchLocation, radius]);

  // Update listing markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      marker.map = null;
    });
    markersRef.current = [];

    if (!data?.data?.listings) return;

    // Create markers for each listing
    data.data.listings.forEach((listing, index) => {
      if (!listing.latitude || !listing.longitude) return;

      const markerElement = document.createElement('div');
      markerElement.className = 'listing-marker';
      markerElement.style.cssText = `
        width: 28px;
        height: 28px;
        background-color: ${listing.superhost ? '#C9A962' : '#0F172A'};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
        color: white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transition: transform 0.2s;
      `;
      markerElement.textContent = (index + 1).toString();
      
      markerElement.addEventListener('mouseenter', () => {
        markerElement.style.transform = 'scale(1.2)';
      });
      markerElement.addEventListener('mouseleave', () => {
        markerElement.style.transform = 'scale(1)';
      });

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: listing.latitude, lng: listing.longitude },
        content: markerElement,
        title: listing.title,
      });

      marker.addListener('click', () => {
        // Could open info window or scroll to listing
        if (listing.airbnb_url) {
          window.open(listing.airbnb_url, '_blank');
        }
      });

      markersRef.current.push(marker);
    });
  }, [data?.data?.listings]);

  const handleSearch = async () => {
    if (!address || !geocoderRef.current) return;
    
    setIsSearching(true);
    
    geocoderRef.current.geocode({ address }, (results, status) => {
      setIsSearching(false);
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const lat = results[0].geometry.location.lat();
        const lng = results[0].geometry.location.lng();
        setSearchLocation({ lat, lng, address: results[0].formatted_address });
        mapRef.current?.setCenter({ lat, lng });
        mapRef.current?.setZoom(14);
      }
    });
  };

  const radiusOptions = [
    { value: 500, label: '500m' },
    { value: 1000, label: '1 km' },
    { value: 2000, label: '2 km' },
    { value: 5000, label: '5 km' },
    { value: 10000, label: '10 km' },
    { value: 20000, label: '20 km' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Header */}
      <div className="bg-[#0F172A] text-white py-4 px-4">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#C9A962]/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-[#C9A962]" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-semibold">Radius-Based Opportunity Finder</h1>
              <p className="text-white/60 text-sm">Find all listings within a custom radius of any address</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Controls */}
      <div className="bg-white border-b border-[#0F172A]/10 py-4 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-end gap-4">
            {/* Address Input */}
            <div className="flex-1 min-w-[300px]">
              <label className="block text-sm font-medium text-[#0F172A]/70 mb-1">
                Search Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F172A]/40" />
                <Input
                  ref={inputRef}
                  placeholder="Enter an address or click on the map..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Radius */}
            <div className="w-40">
              <label className="block text-sm font-medium text-[#0F172A]/70 mb-1">
                Radius
              </label>
              <Select value={radius.toString()} onValueChange={(v) => setRadius(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {radiusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bedrooms */}
            <div className="w-40">
              <label className="block text-sm font-medium text-[#0F172A]/70 mb-1">
                Bedrooms
              </label>
              <Select 
                value={bedrooms?.toString() || 'all'} 
                onValueChange={(v) => setBedrooms(v === 'all' ? undefined : parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n} BR</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="w-40">
              <label className="block text-sm font-medium text-[#0F172A]/70 mb-1">
                Sort By
              </label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="adr">ADR</SelectItem>
                  <SelectItem value="occupancy">Occupancy</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="distance">Distance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Button */}
            <Button 
              onClick={handleSearch}
              disabled={!address || isSearching}
              className="bg-[#C9A962] hover:bg-[#b89a55] text-[#0F172A]"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Search
            </Button>
          </div>

          {searchLocation && (
            <div className="mt-3 text-sm text-[#0F172A]/60">
              Searching within {radius >= 1000 ? `${radius / 1000} km` : `${radius}m`} of{' '}
              <span className="font-medium text-[#0F172A]">{searchLocation.address || `${searchLocation.lat.toFixed(4)}, ${searchLocation.lng.toFixed(4)}`}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Map */}
          <div className="order-2 lg:order-1">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="h-[500px]">
                <MapView onMapReady={handleMapReady} className="w-full h-full" />
              </div>
            </div>
            <p className="text-xs text-[#0F172A]/50 mt-2 text-center">
              Click anywhere on the map to search that location
            </p>
          </div>

          {/* Results */}
          <div className="order-1 lg:order-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#0F172A]">
                {searchLocation ? (
                  isLoading ? 'Searching...' : `${data?.data?.total_count || 0} Listings Found`
                ) : (
                  'Enter an address to search'
                )}
              </h2>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
              </div>
            ) : !searchLocation ? (
              <div className="text-center py-20 text-[#0F172A]/60">
                <Target className="w-12 h-12 mx-auto mb-4 text-[#0F172A]/30" />
                <p>Enter an address above or click on the map to find nearby listings</p>
              </div>
            ) : data?.data?.listings.length === 0 ? (
              <div className="text-center py-20 text-[#0F172A]/60">
                <p>No listings found in this area. Try increasing the radius.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                {data?.data?.listings.map((listing, index) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
