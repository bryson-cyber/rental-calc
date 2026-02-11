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

import { useEffect, useRef } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
    __googleMapsLoading?: Promise<void>;
    __googleMapsLoaded?: boolean;
    __googleMapsLibrariesLoaded?: boolean;
  }
}

const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

export async function loadMapScript(): Promise<void> {
  // If already loaded, return immediately
  if (window.__googleMapsLoaded && window.google?.maps) {
    // Ensure libraries are also loaded
    await loadLibraries();
    return;
  }
  
  // If currently loading, return the existing promise
  if (window.__googleMapsLoading) {
    await window.__googleMapsLoading;
    await loadLibraries();
    return;
  }
  
  // Start loading
  window.__googleMapsLoading = new Promise((resolve, reject) => {
    // Check if script already exists in DOM
    const existingScript = document.querySelector(
      `script[src*="${MAPS_PROXY_URL}/maps/api/js"]`
    );
    
    if (existingScript) {
      // Script exists, wait for it to load
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
    
    // Load base script without libraries - we'll use importLibrary instead
    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      window.__googleMapsLoaded = true;
      resolve();
    };
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(script);
  });
  
  await window.__googleMapsLoading;
  await loadLibraries();
}

// Load required libraries using the dynamic importLibrary API
async function loadLibraries(): Promise<void> {
  if (window.__googleMapsLibrariesLoaded) {
    return;
  }
  
  if (!window.google?.maps) {
    console.error("Google Maps not available for library loading");
    return;
  }
  
  try {
    // Load libraries in parallel using importLibrary
    // This is the recommended approach for Google Maps JS API v3
    const librariesToLoad = ["marker", "places", "geocoding", "geometry", "routes"];
    
    await Promise.all(
      librariesToLoad.map(async (lib) => {
        try {
          await google.maps.importLibrary(lib);
          console.log(`[Map] Loaded library: ${lib}`);
        } catch (err) {
          console.warn(`[Map] Failed to load library ${lib}:`, err);
        }
      })
    );
    
    window.__googleMapsLibrariesLoaded = true;
    console.log("[Map] All libraries loaded successfully");
  } catch (err) {
    console.error("[Map] Error loading libraries:", err);
  }
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const initialized = useRef(false);

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
    
    map.current = new window.google.maps.Map(mapContainer.current, {
      zoom: initialZoom,
      center: initialCenter,
      // Map type control - smaller on mobile
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: isMobile 
          ? google.maps.MapTypeControlStyle.DROPDOWN_MENU 
          : google.maps.MapTypeControlStyle.DEFAULT,
        position: google.maps.ControlPosition.TOP_RIGHT,
      },
      // Fullscreen control - essential for mobile
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: google.maps.ControlPosition.RIGHT_TOP,
      },
      // Zoom control - larger buttons on mobile
      zoomControl: true,
      zoomControlOptions: {
        position: isMobile 
          ? google.maps.ControlPosition.RIGHT_BOTTOM 
          : google.maps.ControlPosition.RIGHT_CENTER,
      },
      // Street view control
      streetViewControl: !isMobile, // Hide on mobile to reduce clutter
      streetViewControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM,
      },
      // Mobile-friendly gesture handling
      gestureHandling: isMobile ? 'greedy' : 'auto', // 'greedy' allows single-finger pan on mobile
      // Disable scroll zoom on mobile when embedded (prevents accidental zoom while scrolling page)
      scrollwheel: !isMobile,
      // Enable two-finger zoom on mobile
      // Map ID for advanced markers
      mapId: "DEMO_MAP_ID",
      // Additional mobile optimizations
      clickableIcons: !isMobile, // Disable POI clicks on mobile to prevent accidental taps
      disableDoubleClickZoom: false, // Keep double-tap zoom
      keyboardShortcuts: !isMobile, // Disable keyboard shortcuts on mobile
    });
    if (onMapReady) {
      onMapReady(map.current);
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div 
      ref={mapContainer} 
      className={cn(
        "w-full",
        // Responsive height: smaller on mobile, larger on desktop
        "h-[350px] sm:h-[400px] md:h-[500px] lg:h-[600px]",
        // Touch-friendly: ensure map is easily tappable
        "touch-manipulation",
        className
      )} 
    />
  );
}
