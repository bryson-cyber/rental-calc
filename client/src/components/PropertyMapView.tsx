/**
 * PropertyMapView - Simple map showing the property location
 * Uses Google Maps via the MapView component with geocoding
 * No dependency on AirDNA or market explorer data
 */
import { useState, useEffect, useCallback } from 'react';
import { useProperty } from '@/contexts/PropertyContext';
import { MapView } from '@/components/Map';
import { MapPin, Home, Loader2 } from 'lucide-react';

interface PropertyMapViewProps {
  embedded?: boolean;
  className?: string;
}

export function PropertyMapView({ embedded = false, className = '' }: PropertyMapViewProps) {
  const { myProperty } = useProperty();
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [geocodedLocation, setGeocodedLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = myProperty?.address || '';
  const lat = (myProperty as any)?.latitude;
  const lng = (myProperty as any)?.longitude;

  // Geocode address if we don't have coordinates
  useEffect(() => {
    if (!mapInstance || !address) return;
    
    // If we already have coordinates, use them directly
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      setGeocodedLocation({ lat, lng });
      return;
    }

    // Geocode the address
    setIsGeocoding(true);
    setError(null);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      setIsGeocoding(false);
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        setGeocodedLocation({ lat: location.lat(), lng: location.lng() });
      } else {
        setError('Could not find this address on the map. Please try a different address.');
      }
    });
  }, [mapInstance, address, lat, lng]);

  // Place marker when we have a location
  useEffect(() => {
    if (!mapInstance || !geocodedLocation) return;

    // Center map on the property
    mapInstance.setCenter(geocodedLocation);
    mapInstance.setZoom(15);

    // Create a marker for the property
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map: mapInstance,
      position: geocodedLocation,
      title: address,
      content: createMarkerContent(),
    });

    // Add info window
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 250px;">
          <p style="font-weight: 600; margin: 0 0 4px 0; font-size: 14px;">${address}</p>
          ${myProperty?.bedrooms ? `<p style="margin: 0; font-size: 12px; color: #666;">${myProperty.bedrooms} bed • ${myProperty.bathrooms || 1} bath</p>` : ''}
        </div>
      `,
    });

    marker.addListener('click', () => {
      infoWindow.open({ anchor: marker, map: mapInstance });
    });

    // Open info window by default
    infoWindow.open({ anchor: marker, map: mapInstance });

    return () => {
      marker.map = null;
      infoWindow.close();
    };
  }, [mapInstance, geocodedLocation, address]);

  function createMarkerContent() {
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="
        background: #0F172A;
        border: 3px solid #C9A962;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A962" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </div>
    `;
    return el.firstElementChild as HTMLElement;
  }

  const handleMapReady = useCallback((map: google.maps.Map) => {
    setMapInstance(map);
    setMapReady(true);
  }, []);

  if (!address) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 ${className}`}>
        <MapPin className="w-12 h-12 text-slate-300 mb-4" />
        <p className="text-slate-500 text-lg font-medium">No property selected</p>
        <p className="text-slate-400 text-sm mt-1">Analyze a property first to see it on the map</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Property Address Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center">
          <Home className="w-4 h-4 text-[#C9A962]" />
        </div>
        <div>
          <p className="font-medium text-sm text-slate-900 truncate max-w-[300px]">{address}</p>
          {myProperty?.bedrooms && (
            <p className="text-xs text-slate-500">{myProperty.bedrooms} bed • {myProperty.bathrooms || 1} bath</p>
          )}
        </div>
      </div>

      {/* Loading overlay */}
      {isGeocoding && (
        <div className="absolute inset-0 z-10 bg-white/80 flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Finding location...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 z-10 bg-white flex items-center justify-center p-4">
          <div className="text-center">
            <MapPin className="w-10 h-10 text-red-300 mx-auto mb-3" />
            <p className="text-slate-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Map */}
      <MapView
        className="h-[500px] w-full"
        initialCenter={geocodedLocation || { lat: 39.8283, lng: -98.5795 }}
        initialZoom={geocodedLocation ? 15 : 4}
        onMapReady={handleMapReady}
      />
    </div>
  );
}
