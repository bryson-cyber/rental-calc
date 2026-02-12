import { useState, useRef, useEffect, useCallback } from "react";
import { MapView } from "./Map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Home, Star, Expand, Minimize, ExternalLink, Navigation, Car, Route, Loader2 } from "lucide-react";

interface Comp {
  title?: string;
  bedrooms?: number;
  bathrooms?: number | null;
  rating?: number | null;
  reviews?: number;
  annual_revenue?: number;
  adr?: number;
  occupancy?: number;
  distance_meters?: number;
  latitude?: number;
  longitude?: number;
  airbnb_listing_id?: string;
  thumbnail_url?: string;
  image_url?: string;
}

interface SubjectProperty {
  address: string;
  latitude: number;
  longitude: number;
  bedrooms?: number;
  bathrooms?: number;
}

interface CompsMapViewProps {
  comps: Comp[];
  subjectProperty: SubjectProperty;
  className?: string;
}

interface DrivingDistance {
  text: string;
  duration: string;
  meters: number;
}

// Revenue tier colors - premium gradient palette
function getMarkerColors(revenue: number | undefined): { bg: string; gradient: string; glow: string; border: string; tier: string; textColor: string } {
  if (!revenue) return { bg: "#94A3B8", gradient: "linear-gradient(135deg, #CBD5E1, #94A3B8)", glow: "rgba(148,163,184,0.4)", border: "#64748B", tier: "N/A", textColor: "#475569" };
  if (revenue >= 100000) return { bg: "#059669", gradient: "linear-gradient(135deg, #10B981, #047857)", glow: "rgba(5,150,105,0.5)", border: "#065F46", tier: "$100k+", textColor: "#065F46" };
  if (revenue >= 80000) return { bg: "#16A34A", gradient: "linear-gradient(135deg, #22C55E, #15803D)", glow: "rgba(22,163,74,0.4)", border: "#166534", tier: "$80-100k", textColor: "#166534" };
  if (revenue >= 50000) return { bg: "#2563EB", gradient: "linear-gradient(135deg, #3B82F6, #1D4ED8)", glow: "rgba(37,99,235,0.4)", border: "#1E40AF", tier: "$50-80k", textColor: "#1E40AF" };
  return { bg: "#94A3B8", gradient: "linear-gradient(135deg, #CBD5E1, #94A3B8)", glow: "rgba(148,163,184,0.4)", border: "#64748B", tier: "<$50k", textColor: "#475569" };
}

function formatCurrency(value: number | undefined): string {
  if (!value) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatCompactRevenue(value: number | undefined): string {
  if (!value) return "N/A";
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return `$${value}`;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getStraightLineDistance(
  comp: Comp,
  subjectLat: number,
  subjectLng: number
): { meters: number; text: string } {
  let meters = comp.distance_meters;
  if (!meters && comp.latitude && comp.longitude) {
    meters = haversineDistance(subjectLat, subjectLng, comp.latitude, comp.longitude);
  }
  if (!meters || meters <= 0) return { meters: 0, text: "N/A" };
  if (meters < 1000) return { meters, text: `${Math.round(meters)}m` };
  const miles = meters / 1609.34;
  return { meters, text: `${miles.toFixed(1)} mi` };
}

function formatOccupancy(value: number | undefined): string {
  if (value === undefined || value === null) return "N/A";
  const pct = value > 1 ? value : value * 100;
  return `${Math.round(pct)}%`;
}

/** Get best available image URL for a comp */
function getCompImageUrl(comp: Comp): string | null {
  if (comp.thumbnail_url) return comp.thumbnail_url;
  if (comp.image_url) return comp.image_url;
  return null;
}

export function CompsMapView({ comps, subjectProperty, className }: CompsMapViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedComp, setSelectedComp] = useState<Comp | null>(null);
  const [selectedCompIndex, setSelectedCompIndex] = useState<number>(-1);
  const [selectedCompStraightDist, setSelectedCompStraightDist] = useState<string>("");
  const [selectedCompDrivingDist, setSelectedCompDrivingDist] = useState<DrivingDistance | null>(null);
  const [drivingDistances, setDrivingDistances] = useState<Map<string, DrivingDistance>>(new Map());
  const [distanceLoading, setDistanceLoading] = useState(false);
  
  // Use refs to avoid circular dependencies in useCallback/useEffect
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const hoverInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const distanceFetchedRef = useRef(false);
  const drivingDistancesRef = useRef<Map<string, DrivingDistance>>(new Map());
  const compsRef = useRef(comps);
  const subjectRef = useRef(subjectProperty);

  
  // Keep refs in sync
  compsRef.current = comps;
  subjectRef.current = subjectProperty;
  drivingDistancesRef.current = drivingDistances;


  const compsWithCoords = comps.filter((c) => c.latitude && c.longitude && !isNaN(c.latitude!) && !isNaN(c.longitude!));

  /**
   * Fetch driving distances - uses refs to avoid dependency issues.
   * Only called once when map is ready.
   */
  const fetchDrivingDistances = useCallback(async () => {
    if (distanceFetchedRef.current) return;
    
    const currentComps = compsRef.current.filter((c) => c.latitude && c.longitude && !isNaN(c.latitude!) && !isNaN(c.longitude!));
    const currentSubject = subjectRef.current;
    
    if (currentComps.length === 0) return;
    if (!window.google?.maps?.DistanceMatrixService) return;
    
    distanceFetchedRef.current = true;
    setDistanceLoading(true);

    try {
      const service = new google.maps.DistanceMatrixService();
      const origin = new google.maps.LatLng(currentSubject.latitude, currentSubject.longitude);
      const results = new Map<string, DrivingDistance>();
      
      const batchSize = 25;
      for (let i = 0; i < currentComps.length; i += batchSize) {
        const batch = currentComps.slice(i, i + batchSize);
        const destinations = batch.map(c => new google.maps.LatLng(c.latitude!, c.longitude!));

        try {
          const response = await new Promise<google.maps.DistanceMatrixResponse>((resolve, reject) => {
            service.getDistanceMatrix(
              {
                origins: [origin],
                destinations,
                travelMode: google.maps.TravelMode.DRIVING,
                unitSystem: google.maps.UnitSystem.IMPERIAL,
              },
              (result, status) => {
                if (status === google.maps.DistanceMatrixStatus.OK && result) {
                  resolve(result);
                } else {
                  reject(new Error(`Distance Matrix failed: ${status}`));
                }
              }
            );
          });

          const elements = response.rows[0]?.elements || [];
          elements.forEach((el, idx) => {
            const comp = batch[idx];
            const key = `${comp.latitude},${comp.longitude}`;
            if (el.status === "OK") {
              results.set(key, {
                text: el.distance.text,
                duration: el.duration.text,
                meters: el.distance.value,
              });
            }
          });
        } catch (err) {
          console.warn("[CompsMap] Distance Matrix batch error:", err);
        }
      }

      setDrivingDistances(results);
      drivingDistancesRef.current = results;
    } catch (err) {
      console.error("[CompsMap] Distance Matrix error:", err);
    } finally {
      setDistanceLoading(false);
    }
  }, []); // No dependencies - uses refs

  /**
   * Build the premium info window HTML for a comp marker
   */
  const buildInfoWindowContent = useCallback((comp: Comp, index: number, straightDist: string, driveDist: DrivingDistance | null): string => {
    const imgUrl = getCompImageUrl(comp);
    const colors = getMarkerColors(comp.annual_revenue);
    
    const thumbnailHtml = imgUrl
      ? `<div style="margin:-14px -14px 12px -14px;border-radius:12px 12px 0 0;overflow:hidden;position:relative;">
          <img src="${imgUrl}" alt="${comp.title || 'Property'}" style="width:100%;height:140px;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'" />
          <div style="position:absolute;bottom:0;left:0;right:0;height:50px;background:linear-gradient(transparent,rgba(0,0,0,0.7));"></div>
          <div style="position:absolute;top:8px;left:8px;">
            <span style="background:${colors.gradient};color:white;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.3);">#${index + 1}</span>
          </div>
          <div style="position:absolute;bottom:8px;left:8px;display:flex;gap:4px;flex-wrap:wrap;">
            ${comp.rating ? `<span style="background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);color:#FBBF24;font-size:11px;font-weight:600;padding:3px 7px;border-radius:5px;">★ ${comp.rating.toFixed(1)}${comp.reviews ? ` (${comp.reviews})` : ''}</span>` : ''}
            <span style="background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);color:white;font-size:11px;font-weight:600;padding:3px 7px;border-radius:5px;">${comp.bedrooms || '?'}BR / ${comp.bathrooms || '?'}BA</span>
          </div>
        </div>`
      : `<div style="margin-bottom:8px;display:flex;align-items:center;gap:6px;">
          <span style="background:${colors.gradient};color:white;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;">#${index + 1}</span>
          <span style="font-size:12px;color:#64748B;">${comp.bedrooms || '?'}BR / ${comp.bathrooms || '?'}BA${comp.rating ? ` · ★ ${comp.rating.toFixed(1)}` : ''}</span>
        </div>`;

    const airbnbLink = comp.airbnb_listing_id
      ? `<a href="https://www.airbnb.com/rooms/${comp.airbnb_listing_id}" target="_blank" rel="noopener noreferrer" style="color:#3B82F6;text-decoration:none;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:3px;padding:4px 8px;background:#EFF6FF;border-radius:5px;transition:background 0.2s;">View on Airbnb ↗</a>`
      : "";

    // Distance section
    let distanceHtml = "";
    if (straightDist && straightDist !== "N/A") {
      distanceHtml += `
        <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#FFFBEB;border-radius:8px;margin-bottom:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <span style="font-size:12px;color:#92400E;font-weight:600;">${straightDist}</span>
          <span style="font-size:11px;color:#B45309;">straight line</span>
        </div>`;
    }
    if (driveDist) {
      distanceHtml += `
        <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#EFF6FF;border-radius:8px;margin-bottom:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
          <span style="font-size:12px;color:#1E40AF;font-weight:600;">${driveDist.text}</span>
          <span style="font-size:11px;color:#3B82F6;">(${driveDist.duration} drive)</span>
        </div>`;
    }

    return `
      <div style="font-family:'DM Sans',system-ui,-apple-system,sans-serif;max-width:300px;padding:14px;">
        ${thumbnailHtml}
        <div style="font-weight:700;font-size:14px;color:#0F172A;margin-bottom:6px;line-height:1.3;">
          ${comp.title || `Comp #${index + 1}`}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
          <div style="background:#F0FDF4;padding:7px 8px;border-radius:8px;text-align:center;">
            <div style="font-size:9px;color:#166534;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Revenue</div>
            <div style="font-size:13px;font-weight:700;color:#166534;margin-top:2px;">${formatCurrency(comp.annual_revenue)}</div>
          </div>
          <div style="background:#EFF6FF;padding:7px 8px;border-radius:8px;text-align:center;">
            <div style="font-size:9px;color:#1E40AF;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">ADR</div>
            <div style="font-size:13px;font-weight:700;color:#1E40AF;margin-top:2px;">${formatCurrency(comp.adr)}</div>
          </div>
          <div style="background:#FFF7ED;padding:7px 8px;border-radius:8px;text-align:center;">
            <div style="font-size:9px;color:#9A3412;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Occupancy</div>
            <div style="font-size:13px;font-weight:700;color:#9A3412;margin-top:2px;">${formatOccupancy(comp.occupancy)}</div>
          </div>
        </div>
        ${distanceHtml ? `<div style="margin-bottom:8px;">${distanceHtml}</div>` : ''}
        <div style="display:flex;justify-content:flex-end;align-items:center;">
          ${airbnbLink}
        </div>
      </div>
    `;
  }, []);

  /**
   * Add markers to the map. Uses refs to read current data.
   */
  const addMarkersToMap = useCallback((map: google.maps.Map) => {
    const currentComps = compsRef.current.filter((c) => c.latitude && c.longitude && !isNaN(c.latitude!) && !isNaN(c.longitude!));
    const currentSubject = subjectRef.current;
    
    console.log("[CompsMap] Adding", currentComps.length, "comp markers to map");
    
    // Clean up existing markers
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];
    
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow({ maxWidth: 320 });
    }
    if (!hoverInfoWindowRef.current) {
      hoverInfoWindowRef.current = new google.maps.InfoWindow({ maxWidth: 200, disableAutoPan: true });
    }

    // Inject CSS animation for pulse effect
    if (!document.getElementById('comp-map-styles')) {
      const style = document.createElement('style');
      style.id = 'comp-map-styles';
      style.textContent = `
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 3px rgba(245,158,11,0.3), 0 4px 12px rgba(0,0,0,0.3); }
          50% { box-shadow: 0 0 0 6px rgba(245,158,11,0.15), 0 4px 12px rgba(0,0,0,0.3); }
        }
        @keyframes marker-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // Add comp markers FIRST (so subject marker renders on top)
    currentComps.forEach((comp, i) => {
      const colors = getMarkerColors(comp.annual_revenue);
      const revenueLabel = formatCompactRevenue(comp.annual_revenue);
      const el = document.createElement("div");
      el.style.cssText = "animation:marker-pop 0.4s ease-out forwards;animation-delay:" + (i * 30) + "ms;opacity:0;";
      el.innerHTML = `
        <div style="
          position:relative;
          cursor:pointer;
          transition:transform 0.2s ease, filter 0.2s ease;
          filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        " class="comp-marker-${i}"
          onmouseenter="this.style.transform='scale(1.2) translateY(-3px)';this.style.filter='drop-shadow(0 4px 8px rgba(0,0,0,0.3))'"
          onmouseleave="this.style.transform='scale(1)';this.style.filter='drop-shadow(0 2px 4px rgba(0,0,0,0.2))'">
          <!-- Revenue label above marker -->
          <div style="
            position:absolute;
            bottom:calc(100% + 4px);
            left:50%;
            transform:translateX(-50%);
            background:white;
            color:${colors.textColor};
            font-size:10px;
            font-weight:700;
            padding:2px 6px;
            border-radius:4px;
            white-space:nowrap;
            box-shadow:0 1px 4px rgba(0,0,0,0.15);
            border:1px solid ${colors.border}30;
            letter-spacing:0.3px;
          ">${revenueLabel}/yr</div>
          <!-- Main marker circle -->
          <div style="
            background:${colors.gradient};
            border:2.5px solid white;
            border-radius:50%;
            width:34px;
            height:34px;
            display:flex;
            align-items:center;
            justify-content:center;
            box-shadow:0 2px 8px ${colors.glow};
            font-size:12px;
            font-weight:700;
            color:white;
            text-shadow:0 1px 2px rgba(0,0,0,0.3);
          ">
            ${i + 1}
          </div>
          <!-- Pointer triangle -->
          <div style="
            width:0;
            height:0;
            border-left:6px solid transparent;
            border-right:6px solid transparent;
            border-top:6px solid ${colors.bg};
            margin:0 auto;
            margin-top:-1px;
          "></div>
        </div>
      `;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: comp.latitude!, lng: comp.longitude! },
        title: comp.title || `Comp #${i + 1}`,
        content: el
      });

      // Click handler - show full info window with distance
      marker.addListener("click", () => {
        hoverInfoWindowRef.current?.close();
        const straightDist = getStraightLineDistance(comp, currentSubject.latitude, currentSubject.longitude);
        const driveDist = drivingDistancesRef.current.get(`${comp.latitude},${comp.longitude}`) || null;
        setSelectedComp(comp);
        setSelectedCompIndex(i);
        setSelectedCompStraightDist(straightDist.text);
        setSelectedCompDrivingDist(driveDist);

        const content = buildInfoWindowContent(comp, i, straightDist.text, driveDist);
        infoWindowRef.current?.setContent(content);
        infoWindowRef.current?.open(map, marker);
      });

      // Hover handler - show mini preview with distance
      const markerEl = el.querySelector(`[class^="comp-marker"]`);
      if (markerEl) {
        markerEl.addEventListener("mouseenter", () => {
          // @ts-ignore - getMap exists at runtime but not in types
          if (infoWindowRef.current && (infoWindowRef.current as any).getMap?.()) return; // Don't show hover if click info is open
          const straightDist = getStraightLineDistance(comp, currentSubject.latitude, currentSubject.longitude);
          const driveDist = drivingDistancesRef.current.get(`${comp.latitude},${comp.longitude}`) || null;
          
          let distText = "";
          if (driveDist) {
            distText = `${driveDist.text} · ${driveDist.duration}`;
          } else if (straightDist.text !== "N/A") {
            distText = `~${straightDist.text} away`;
          }
          
          const hoverContent = `
            <div style="font-family:'DM Sans',system-ui,sans-serif;padding:8px 10px;min-width:160px;">
              <div style="font-weight:700;font-size:12px;color:#0F172A;margin-bottom:3px;line-height:1.3;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${comp.title || `Comp #${i + 1}`}
              </div>
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:${distText ? '4px' : '0'};">
                <span style="font-size:12px;font-weight:700;color:#166534;">${formatCurrency(comp.annual_revenue)}/yr</span>
                <span style="font-size:11px;color:#64748B;">${comp.bedrooms || '?'}BR</span>
                ${comp.rating ? `<span style="font-size:11px;color:#D97706;">★ ${comp.rating.toFixed(1)}</span>` : ''}
              </div>
              ${distText ? `<div style="font-size:11px;color:#3B82F6;font-weight:500;">🚗 ${distText}</div>` : ''}
            </div>
          `;
          hoverInfoWindowRef.current?.setContent(hoverContent);
          hoverInfoWindowRef.current?.open(map, marker);
        });
        markerEl.addEventListener("mouseleave", () => {
          // Small delay to prevent flicker
          setTimeout(() => {
            hoverInfoWindowRef.current?.close();
          }, 100);
        });
      }

      markersRef.current.push(marker);
    });

    // Add subject property marker (on top)
    const subjectEl = document.createElement("div");
    subjectEl.style.cssText = "animation:marker-pop 0.5s ease-out forwards;";
    subjectEl.innerHTML = `
      <div style="position:relative;cursor:pointer;">
        <div style="
          background:linear-gradient(135deg, #F59E0B, #D97706);
          border:3px solid white;
          border-radius:50%;
          width:42px;
          height:42px;
          display:flex;
          align-items:center;
          justify-content:center;
          box-shadow:0 0 0 3px rgba(245,158,11,0.3), 0 4px 12px rgba(0,0,0,0.3);
          animation:pulse-glow 2s ease-in-out infinite;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22" fill="rgba(255,255,255,0.3)"/>
          </svg>
        </div>
        <div style="
          position:absolute;
          top:-10px;
          left:50%;
          transform:translateX(-50%);
          background:#0F172A;
          color:white;
          font-size:9px;
          font-weight:700;
          padding:3px 8px;
          border-radius:5px;
          white-space:nowrap;
          letter-spacing:0.5px;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
        ">YOUR PROPERTY</div>
        <div style="
          width:0;
          height:0;
          border-left:7px solid transparent;
          border-right:7px solid transparent;
          border-top:7px solid #D97706;
          margin:0 auto;
          margin-top:-1px;
        "></div>
      </div>
    `;
    const subjectMarker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: currentSubject.latitude, lng: currentSubject.longitude },
      title: "Subject Property",
      content: subjectEl,
      zIndex: 1000,
    });
    markersRef.current.push(subjectMarker);

    // Fit bounds to show all markers
    if (currentComps.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: currentSubject.latitude, lng: currentSubject.longitude });
      currentComps.forEach((c) => {
        bounds.extend({ lat: c.latitude!, lng: c.longitude! });
      });
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
  }, [buildInfoWindowContent]); // buildInfoWindowContent is stable (no deps)

  /**
   * Called once when the MapView component reports the map is ready.
   */
  const handleMapReady = useCallback((map: google.maps.Map) => {
    console.log("[CompsMap] Map ready callback fired");
    mapRef.current = map;
    
    // Add markers
    addMarkersToMap(map);
    
    // Fetch driving distances (only once)
    fetchDrivingDistances();
  }, [addMarkersToMap, fetchDrivingDistances]);

  // Update driving distance for selected comp when distances load
  useEffect(() => {
    if (selectedComp && drivingDistances.size > 0) {
      const key = `${selectedComp.latitude},${selectedComp.longitude}`;
      const driveDist = drivingDistances.get(key) || null;
      setSelectedCompDrivingDist(driveDist);
    }
  }, [drivingDistances, selectedComp]);

  const selectedCompImg = getCompImageUrl(selectedComp || {} as Comp);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Comparable Properties Map
            {compsWithCoords.length > 0 ? (
              <Badge variant="secondary" className="ml-2">{compsWithCoords.length} comps</Badge>
            ) : (
              <Badge variant="outline" className="ml-2">Subject Property</Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <Minimize className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Map container */}
        <div className={`transition-all duration-300 ${isExpanded ? "h-[600px] sm:h-[650px] md:h-[700px]" : "h-[350px] sm:h-[400px] md:h-[450px]"}`}>
          <MapView
            initialCenter={{ lat: subjectProperty.latitude, lng: subjectProperty.longitude }}
            initialZoom={14}
            showRecenter={true}
            onMapReady={handleMapReady}
            className="h-full sm:h-full md:h-full lg:h-full rounded-b-lg"
          />
        </div>
        
        {/* Legend - Premium styled */}
        <div className="p-3 border-t bg-muted/30">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-white shadow-sm flex items-center justify-center">
                <Home className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="font-medium">Subject Property</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 border-2 border-white shadow-sm" />
              <span>$100k+/yr</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-green-600 border-2 border-white shadow-sm" />
              <span>$80-100k/yr</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white shadow-sm" />
              <span>$50-80k/yr</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 border-2 border-white shadow-sm" />
              <span>&lt;$50k/yr</span>
            </div>
            {distanceLoading && (
              <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
                <Car className="w-3.5 h-3.5 animate-pulse" />
                <span>Calculating driving distances...</span>
              </div>
            )}
          </div>
        </div>

        {/* Selected comp details panel */}
        {selectedComp && (
          <div className="p-4 border-t bg-gradient-to-r from-muted/50 to-muted/30">
            <div className="flex gap-4">
              {selectedCompImg ? (
                <div className="flex-shrink-0">
                  <img
                    src={selectedCompImg}
                    alt={selectedComp.title || "Comparable Property"}
                    className="w-28 h-22 rounded-lg object-cover border border-border shadow-sm"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div className="flex-shrink-0 w-28 h-22 rounded-lg bg-muted flex items-center justify-center border border-border">
                  <Home className="w-8 h-8 text-muted-foreground/40" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-bold">#{selectedCompIndex + 1}</Badge>
                      <h4 className="font-semibold text-sm truncate">{selectedComp.title || "Comparable Property"}</h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{selectedComp.bedrooms} BR / {selectedComp.bathrooms} BA</span>
                      {selectedComp.rating && (
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {selectedComp.rating.toFixed(1)}
                          {selectedComp.reviews ? <span className="text-muted-foreground">({selectedComp.reviews})</span> : null}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-green-600 text-sm">{formatCurrency(selectedComp.annual_revenue)}/yr</div>
                    <div className="text-xs text-muted-foreground">ADR: {formatCurrency(selectedComp.adr)} · Occ: {formatOccupancy(selectedComp.occupancy)}</div>
                  </div>
                </div>
                
                {(selectedCompStraightDist || selectedCompDrivingDist || distanceLoading) && (
                  <p className="text-[10px] text-muted-foreground mt-2 mb-1 font-medium uppercase tracking-wider">Distance from {subjectProperty.address.split(',')[0]}</p>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                  {selectedCompStraightDist && selectedCompStraightDist !== "N/A" && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/50">
                      <Navigation className="w-3 h-3" />
                      {selectedCompStraightDist} straight
                    </span>
                  )}
                  {selectedCompDrivingDist && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-700 font-medium bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200/50">
                      <Car className="w-3 h-3" />
                      {selectedCompDrivingDist.text} ({selectedCompDrivingDist.duration})
                    </span>
                  )}
                  {!selectedCompDrivingDist && distanceLoading && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Route className="w-3 h-3 animate-pulse" />
                      Calculating drive...
                    </span>
                  )}
                  {selectedComp.airbnb_listing_id && (
                    <a
                      href={`https://www.airbnb.com/rooms/${selectedComp.airbnb_listing_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View on Airbnb
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CompsMapView;
