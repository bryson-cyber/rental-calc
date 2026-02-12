/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Store to control map from parent anytime, google map itself is in charge of the re-rendering, not react state.
 * </MapView>
 *
 * ======
 * Available Libraries and Core Features:
 * -------------------------------
 * 📍 MARKER (from `marker` library)
 * - Attaches to map using { map, position }
 * new google.maps.marker.AdvancedMarkerElement({
 *   map,
 *   position: { lat: 37.7749, lng: -122.4194 },
 *   title: "San Francisco",
 * });
 *
 * -------------------------------
 * 🏢 PLACES (from `places` library)
 * - Does not attach directly to map; use data with your map manually.
 * const place = new google.maps.places.Place({ id: PLACE_ID });
 * await place.fetchFields({ fields: ["displayName", "location"] });
 * map.setCenter(place.location);
 * new google.maps.marker.AdvancedMarkerElement({ map, position: place.location });
 *
 * -------------------------------
 * 🧭 GEOCODER (from `geocoding` library)
 * - Standalone service; manually apply results to map.
 * const geocoder = new google.maps.Geocoder();
 * geocoder.geocode({ address: "New York" }, (results, status) => {
 *   if (status === "OK" && results[0]) {
 *     map.setCenter(results[0].geometry.location);
 *     new google.maps.marker.AdvancedMarkerElement({
 *       map,
 *       position: results[0].geometry.location,
 *     });
 *   }
 * });
 *
 * -------------------------------
 * 📐 GEOMETRY (from `geometry` library)
 * - Pure utility functions; not attached to map.
 * const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
 *
 * -------------------------------
 * 🛣️ ROUTES (from `routes` library)
 * - Combines DirectionsService (standalone) + DirectionsRenderer (map-attached)
 * const directionsService = new google.maps.DirectionsService();
 * const directionsRenderer = new google.maps.DirectionsRenderer({ map });
 * directionsService.route(
 *   { origin, destination, travelMode: "DRIVING" },
 *   (res, status) => status === "OK" && directionsRenderer.setDirections(res)
 * );
 *
 * -------------------------------
 * 🌦️ MAP LAYERS (attach directly to map)
 * - new google.maps.TrafficLayer().setMap(map);
 * - new google.maps.TransitLayer().setMap(map);
 * - new google.maps.BicyclingLayer().setMap(map);
 *
 * -------------------------------
 * ✅ SUMMARY
 * - "map-attached" → AdvancedMarkerElement, DirectionsRenderer, Layers.
 * - "standalone" → Geocoder, DirectionsService, DistanceMatrixService, ElevationService.
 * - "data-only" → Place, Geometry utilities.
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef, useCallback } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
    __googleMapsLoading?: Promise<void>;
    __googleMapsLoaded?: boolean;
    __googleMapsInitCallback?: () => void;
  }
}

// Use the user's own Google Maps API key for full control
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
// User's custom Map ID for AdvancedMarkerElement styling (from Google Cloud Console)
const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID;

// Fallback to Manus proxy if user's key is not available
const FORGE_API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

// Determine which loading strategy to use
const useOwnKey = !!GOOGLE_MAPS_API_KEY;

// Libraries to load - included in the script URL for reliability
const LIBRARIES = "marker,places,geocoding,geometry,routes";

export async function loadMapScript(): Promise<void> {
  // If already loaded, return immediately
  if (window.__googleMapsLoaded && window.google?.maps) {
    return;
  }
  
  // If currently loading, return the existing promise
  if (window.__googleMapsLoading) {
    await window.__googleMapsLoading;
    return;
  }
  
  // Start loading
  window.__googleMapsLoading = new Promise<void>((resolve, reject) => {
    // Check if script already exists in DOM
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"], script[src*="maps/proxy/maps/api/js"]'
    );
    
    if (existingScript) {
      if (window.google?.maps) {
        window.__googleMapsLoaded = true;
        resolve();
        return;
      }
      existingScript.addEventListener('load', () => {
        window.__googleMapsLoaded = true;
        resolve();
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load Google Maps script'));
      });
      return;
    }

    // Set up the callback function that Google Maps will call when ready
    const callbackName = '__googleMapsInitCallback';
    (window as any)[callbackName] = () => {
      window.__googleMapsLoaded = true;
      console.log("[Map] Google Maps fully initialized via callback");
      resolve();
    };
    
    // Determine the script URL - include libraries inline (matching the working diagnostic pattern)
    let scriptSrc: string;
    
    if (useOwnKey) {
      scriptSrc = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&libraries=${LIBRARIES}&callback=${callbackName}`;
      console.log("[Map] Loading Google Maps with your own API key");
    } else {
      scriptSrc = `${MAPS_PROXY_URL}/maps/api/js?key=${FORGE_API_KEY}&v=weekly&libraries=${LIBRARIES}&callback=${callbackName}`;
      console.log("[Map] Loading Google Maps via Manus proxy (fallback)");
    }
    
    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.defer = true;
    // Do NOT set crossOrigin - it can cause CORS issues with Google's CDN
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
      delete (window as any)[callbackName];
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(script);
  });
  
  await window.__googleMapsLoading;
}

/**
 * Creates a custom "Recenter" control button for the map.
 * When clicked, it pans/zooms the map back to the provided center & zoom.
 */
function createRecenterControl(
  map: google.maps.Map,
  homeCenter: google.maps.LatLngLiteral,
  homeZoom: number,
  homeBounds?: google.maps.LatLngBounds | null
): HTMLElement {
  const controlDiv = document.createElement("div");
  controlDiv.style.cssText = `
    margin: 10px;
    cursor: pointer;
  `;

  const controlButton = document.createElement("button");
  controlButton.type = "button";
  controlButton.title = "Recenter map";
  controlButton.setAttribute("aria-label", "Recenter map");
  controlButton.style.cssText = `
    background: white;
    border: none;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #0F172A;
    transition: background 0.2s, box-shadow 0.2s;
    outline: none;
  `;
  controlButton.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A962" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
    <span>Recenter</span>
  `;

  controlButton.addEventListener("mouseenter", () => {
    controlButton.style.background = "#F8FAFC";
    controlButton.style.boxShadow = "0 3px 8px rgba(0,0,0,0.35)";
  });
  controlButton.addEventListener("mouseleave", () => {
    controlButton.style.background = "white";
    controlButton.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
  });

  controlButton.addEventListener("click", () => {
    if (homeBounds) {
      map.fitBounds(homeBounds, { top: 60, right: 60, bottom: 60, left: 60 });
    } else {
      map.panTo(homeCenter);
      map.setZoom(homeZoom);
    }
  });

  controlDiv.appendChild(controlButton);
  return controlDiv;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
  /** If true, show a recenter button. Defaults to true. */
  showRecenter?: boolean;
  /** Optional bounds to fit when recenter is clicked (overrides center+zoom) */
  recenterBounds?: google.maps.LatLngBounds | null;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
  showRecenter = true,
  recenterBounds,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const initialized = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const recenterBoundsRef = useRef(recenterBounds);

  // Keep bounds ref in sync for the recenter button
  recenterBoundsRef.current = recenterBounds;

  const init = usePersistFn(async () => {
    // Prevent double initialization
    if (initialized.current) return;
    initialized.current = true;
    
    try {
      await loadMapScript();
    } catch (error) {
      console.error("Failed to load map:", error);
      initialized.current = false;
      return;
    }
    
    if (!mapContainer.current) {
      console.error("Map container not found");
      initialized.current = false;
      return;
    }
    
    if (!window.google?.maps) {
      console.error("Google Maps not available");
      initialized.current = false;
      return;
    }
    
    // Detect mobile device
    const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
    
    // Build map options - use the real Map ID from Google Cloud Console
    const mapOptions: google.maps.MapOptions = {
      zoom: initialZoom,
      center: initialCenter,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: isMobile 
          ? google.maps.MapTypeControlStyle.DROPDOWN_MENU 
          : google.maps.MapTypeControlStyle.DEFAULT,
        position: google.maps.ControlPosition.TOP_RIGHT,
      },
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: google.maps.ControlPosition.RIGHT_TOP,
      },
      zoomControl: true,
      zoomControlOptions: {
        position: isMobile 
          ? google.maps.ControlPosition.RIGHT_BOTTOM 
          : google.maps.ControlPosition.RIGHT_CENTER,
      },
      streetViewControl: !isMobile,
      streetViewControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM,
      },
      gestureHandling: isMobile ? 'greedy' : 'auto',
      scrollwheel: !isMobile,
      // Map ID for vector maps and AdvancedMarkerElement
      ...(GOOGLE_MAP_ID ? { mapId: GOOGLE_MAP_ID } : {}),
      clickableIcons: !isMobile,
      disableDoubleClickZoom: false,
      keyboardShortcuts: !isMobile,
    };
    
    console.log("[Map] Creating map with mapId:", GOOGLE_MAP_ID || "(none)", "center:", initialCenter, "container size:", mapContainer.current.offsetWidth, "x", mapContainer.current.offsetHeight);
    
    const mapInstance = new window.google.maps.Map(mapContainer.current, mapOptions);
    map.current = mapInstance;
    
    // Add recenter button
    if (showRecenter) {
      const recenterControl = createRecenterControl(
        mapInstance,
        initialCenter,
        initialZoom,
        recenterBoundsRef.current
      );
      mapInstance.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(recenterControl);
    }
    
    // Track whether tiles have loaded successfully
    let tilesLoaded = false;
    
    const tilesLoadedListener = mapInstance.addListener('tilesloaded', () => {
      if (!tilesLoaded) {
        tilesLoaded = true;
        console.log("[Map] Tiles loaded successfully");
      }
    });
    
    // Periodic resize to handle maps in tabs/accordions/lazy containers
    let resizeCount = 0;
    const maxResizes = 40;
    
    const resizeInterval = setInterval(() => {
      resizeCount++;
      
      if (tilesLoaded || resizeCount >= maxResizes) {
        clearInterval(resizeInterval);
        return;
      }
      
      google.maps.event.trigger(mapInstance, 'resize');
      
      if (resizeCount <= 5) {
        const center = mapInstance.getCenter();
        if (center) {
          mapInstance.setCenter(center);
        }
      }
    }, 500);
    
    // Immediate resize after short delay
    const immediateTimer = setTimeout(() => {
      google.maps.event.trigger(mapInstance, 'resize');
      mapInstance.setCenter(initialCenter);
    }, 100);
    
    // Delayed resize for maps that become visible later
    const delayedTimer = setTimeout(() => {
      if (!tilesLoaded) {
        google.maps.event.trigger(mapInstance, 'resize');
        const center = mapInstance.getCenter();
        if (center) {
          mapInstance.setCenter(center);
        }
      }
    }, 1000);
    
    // IntersectionObserver: trigger resize when map container scrolls into view
    // This is the key fix for maps created off-screen (e.g., in tabs or below the fold)
    let visibilityObserver: IntersectionObserver | null = null;
    if (mapContainer.current) {
      visibilityObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !tilesLoaded) {
            console.log("[Map] Container became visible, triggering resize");
            google.maps.event.trigger(mapInstance, 'resize');
            mapInstance.setCenter(initialCenter);
            mapInstance.setZoom(initialZoom);
            // Try again after a short delay for good measure
            setTimeout(() => {
              if (!tilesLoaded) {
                google.maps.event.trigger(mapInstance, 'resize');
                mapInstance.setCenter(initialCenter);
              }
            }, 300);
          }
          if (tilesLoaded && visibilityObserver) {
            visibilityObserver.disconnect();
          }
        },
        { threshold: 0.1 } // Trigger when 10% visible
      );
      visibilityObserver.observe(mapContainer.current);
    }
    
    cleanupRef.current = () => {
      clearInterval(resizeInterval);
      clearTimeout(immediateTimer);
      clearTimeout(delayedTimer);
      google.maps.event.removeListener(tilesLoadedListener);
      if (visibilityObserver) visibilityObserver.disconnect();
    };
    
    if (onMapReady) {
      onMapReady(mapInstance);
    }
  });

  useEffect(() => {
    init();
    
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [init]);

  return (
    <div 
      ref={mapContainer} 
      className={cn(
        "w-full",
        "h-[350px] sm:h-[400px] md:h-[500px] lg:h-[600px]",
        "touch-manipulation",
        className
      )} 
    />
  );
}
