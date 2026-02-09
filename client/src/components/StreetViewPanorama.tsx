/**
 * StreetViewPanorama Component
 * 
 * Renders an interactive Google Street View 360° panorama for a given lat/lng.
 * Uses the Google Maps JavaScript API StreetViewPanorama directly (no map needed).
 * Falls back to a "Street View not available" message if no imagery exists.
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from 'react';
import { loadMapScript } from './Map';
import { Eye, AlertCircle } from 'lucide-react';

interface StreetViewPanoramaProps {
  lat: number;
  lng: number;
  className?: string;
  heading?: number;
  pitch?: number;
}

export function StreetViewPanorama({
  lat,
  lng,
  className = 'w-full h-full',
  heading = 0,
  pitch = 0,
}: StreetViewPanoramaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadMapScript();

        if (cancelled || !containerRef.current || !window.google?.maps) {
          if (!cancelled) setStatus('unavailable');
          return;
        }

        // First check if Street View imagery is available at this location
        const sv = new google.maps.StreetViewService();
        const position = { lat, lng };

        sv.getPanorama(
          { location: position, radius: 100, source: google.maps.StreetViewSource.OUTDOOR },
          (data, svStatus) => {
            if (cancelled || !containerRef.current) return;

            if (svStatus === google.maps.StreetViewStatus.OK && data?.location?.latLng) {
              // Street View is available — create the panorama
              panoramaRef.current = new google.maps.StreetViewPanorama(
                containerRef.current!,
                {
                  position: data.location.latLng,
                  pov: { heading, pitch },
                  zoom: 1,
                  addressControl: true,
                  addressControlOptions: {
                    position: google.maps.ControlPosition.BOTTOM_CENTER,
                  },
                  fullscreenControl: true,
                  fullscreenControlOptions: {
                    position: google.maps.ControlPosition.RIGHT_TOP,
                  },
                  zoomControl: true,
                  zoomControlOptions: {
                    position: google.maps.ControlPosition.RIGHT_CENTER,
                  },
                  panControl: true,
                  panControlOptions: {
                    position: google.maps.ControlPosition.RIGHT_CENTER,
                  },
                  linksControl: true,
                  motionTracking: false,
                  motionTrackingControl: false,
                  enableCloseButton: false,
                  showRoadLabels: true,
                }
              );
              setStatus('ready');
            } else {
              setStatus('unavailable');
            }
          }
        );
      } catch (err) {
        console.error('[StreetView] Failed to initialize:', err);
        if (!cancelled) setStatus('unavailable');
      }
    }

    init();

    return () => {
      cancelled = true;
      panoramaRef.current = null;
    };
  }, [lat, lng, heading, pitch]);

  return (
    <div className={`relative ${className}`}>
      {/* Panorama container */}
      <div
        ref={containerRef}
        className={`w-full h-full ${status !== 'ready' ? 'hidden' : ''}`}
      />

      {/* Loading state */}
      {status === 'loading' && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#f8fafc] gap-3">
          <div className="w-10 h-10 rounded-full bg-[#C9A962]/15 flex items-center justify-center animate-pulse">
            <Eye className="w-5 h-5 text-[#C9A962]" />
          </div>
          <p className="text-sm text-[#94a3b8]">Loading Street View...</p>
        </div>
      )}

      {/* Unavailable state */}
      {status === 'unavailable' && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#f8fafc] gap-3">
          <div className="w-10 h-10 rounded-full bg-[#e2e8f0] flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-[#94a3b8]" />
          </div>
          <p className="text-sm text-[#94a3b8] font-medium">Street View not available</p>
          <p className="text-xs text-[#94a3b8]/70 max-w-[200px] text-center">
            No street-level imagery exists for this location
          </p>
        </div>
      )}
    </div>
  );
}
