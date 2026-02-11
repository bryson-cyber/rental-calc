import { useState, useRef, useEffect, useCallback } from "react";
import { MapView } from "./Map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Home, Star, Expand, Minimize, ExternalLink, Navigation, Car, Route } from "lucide-react";

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
  text: string;      // e.g. "3.2 mi"
  duration: string;  // e.g. "8 min"
  meters: number;
}

// Revenue tier colors with gradient pairs for premium look
function getMarkerColors(revenue: number | undefined): { bg: string; gradient: string; glow: string; border: string } {
  if (!revenue) return { bg: "#6B7280", gradient: "linear-gradient(135deg, #9CA3AF, #6B7280)", glow: "rgba(107,114,128,0.4)", border: "#4B5563" };
  if (revenue >= 100000) return { bg: "#059669", gradient: "linear-gradient(135deg, #34D399, #059669)", glow: "rgba(5,150,105,0.5)", border: "#047857" };
  if (revenue >= 80000) return { bg: "#22C55E", gradient: "linear-gradient(135deg, #4ADE80, #22C55E)", glow: "rgba(34,197,94,0.4)", border: "#16A34A" };
  if (revenue >= 50000) return { bg: "#3B82F6", gradient: "linear-gradient(135deg, #60A5FA, #3B82F6)", glow: "rgba(59,130,246,0.4)", border: "#2563EB" };
  return { bg: "#6B7280", gradient: "linear-gradient(135deg, #9CA3AF, #6B7280)", glow: "rgba(107,114,128,0.4)", border: "#4B5563" };
}

function formatCurrency(value: number | undefined): string {
  if (!value) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

/**
 * Calculate distance between two lat/lng points using the Haversine formula.
 * Returns distance in meters.
 */
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

/**
 * Get straight-line distance in a human-readable format.
 */
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

/**
 * Format occupancy handling both decimal (0.77) and percentage (77) formats.
 */
function formatOccupancy(value: number | undefined): string {
  if (value === undefined || value === null) return "N/A";
  const pct = value > 1 ? value : value * 100;
  return `${Math.round(pct)}%`;
}

export function CompsMapView({ comps, subjectProperty, className }: CompsMapViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedComp, setSelectedComp] = useState<Comp | null>(null);
  const [selectedCompStraightDist, setSelectedCompStraightDist] = useState<string>("");
  const [selectedCompDrivingDist, setSelectedCompDrivingDist] = useState<DrivingDistance | null>(null);
  const [drivingDistances, setDrivingDistances] = useState<Map<string, DrivingDistance>>(new Map());
  const [distanceLoading, setDistanceLoading] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const distanceFetchedRef = useRef(false);

  const compsWithCoords = comps.filter((c) => c.latitude && c.longitude && !isNaN(c.latitude!) && !isNaN(c.longitude!));

  /**
   * Fetch driving distances for all comps using Google Distance Matrix Service.
   * Batches requests (max 25 destinations per call).
   */
  const fetchDrivingDistances = useCallback(async () => {
    if (distanceFetchedRef.current || compsWithCoords.length === 0) return;
    if (!window.google?.maps?.DistanceMatrixService) return;
    
    distanceFetchedRef.current = true;
    setDistanceLoading(true);

    try {
      const service = new google.maps.DistanceMatrixService();
      const origin = new google.maps.LatLng(subjectProperty.latitude, subjectProperty.longitude);
      const results = new Map<string, DrivingDistance>();
      
      // Batch in groups of 25 (API limit)
      const batchSize = 25;
      for (let i = 0; i < compsWithCoords.length; i += batchSize) {
        const batch = compsWithCoords.slice(i, i + batchSize);
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

          // Parse results
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
    } catch (err) {
      console.error("[CompsMap] Distance Matrix error:", err);
    } finally {
      setDistanceLoading(false);
    }
  }, [compsWithCoords, subjectProperty]);

  const getDrivingDist = useCallback((comp: Comp): DrivingDistance | null => {
    if (!comp.latitude || !comp.longitude) return null;
    const key = `${comp.latitude},${comp.longitude}`;
    return drivingDistances.get(key) || null;
  }, [drivingDistances]);

  const handleMapReady = (map: google.maps.Map) => {
    mapRef.current = map;
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];
    infoWindowRef.current = new google.maps.InfoWindow();

    // Fetch driving distances once map is ready
    fetchDrivingDistances();

    // Add comp markers FIRST (so subject marker renders on top)
    compsWithCoords.forEach((comp, i) => {
      const colors = getMarkerColors(comp.annual_revenue);
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="
          position:relative;
          cursor:pointer;
          transition:transform 0.2s ease;
        " onmouseenter="this.style.transform='scale(1.15)'" onmouseleave="this.style.transform='scale(1)'">
          <div style="
            background:${colors.gradient};
            border:2.5px solid white;
            border-radius:50%;
            width:32px;
            height:32px;
            display:flex;
            align-items:center;
            justify-content:center;
            box-shadow:0 2px 8px ${colors.glow}, 0 1px 3px rgba(0,0,0,0.3);
            font-size:12px;
            font-weight:700;
            color:white;
            text-shadow:0 1px 2px rgba(0,0,0,0.3);
          ">
            ${i + 1}
          </div>
        </div>
      `;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: comp.latitude!, lng: comp.longitude! },
        title: comp.title || `Comp #${i + 1}`,
        content: el
      });
      marker.addListener("click", () => {
        const straightDist = getStraightLineDistance(comp, subjectProperty.latitude, subjectProperty.longitude);
        const driveDist = getDrivingDist(comp);
        setSelectedComp(comp);
        setSelectedCompStraightDist(straightDist.text);
        setSelectedCompDrivingDist(driveDist);

        // Build premium info window
        const imgUrl = comp.thumbnail_url || comp.image_url;
        const thumbnailHtml = imgUrl
          ? `<div style="margin:-12px -12px 10px -12px;border-radius:10px 10px 0 0;overflow:hidden;position:relative;">
              <img src="${imgUrl}" alt="${comp.title || 'Property'}" style="width:100%;height:130px;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'" />
              <div style="position:absolute;bottom:0;left:0;right:0;height:40px;background:linear-gradient(transparent,rgba(0,0,0,0.6));"></div>
              <div style="position:absolute;bottom:6px;left:8px;display:flex;gap:4px;">
                ${comp.rating ? `<span style="background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);color:#FBBF24;font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;">⭐ ${comp.rating.toFixed(1)}${comp.reviews ? ` (${comp.reviews})` : ''}</span>` : ''}
              </div>
            </div>`
          : "";

        const airbnbLink = comp.airbnb_listing_id
          ? `<a href="https://www.airbnb.com/rooms/${comp.airbnb_listing_id}" target="_blank" rel="noopener noreferrer" style="color:#3B82F6;text-decoration:none;font-size:11px;display:inline-flex;align-items:center;gap:3px;font-weight:500;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>View on Airbnb</a>`
          : "";

        // Distance section with both straight-line and driving
        let distanceHtml = "";
        if (straightDist.text !== "N/A" || driveDist) {
          distanceHtml = `<div style="display:flex;gap:10px;margin-top:8px;padding:6px 8px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;">`;
          if (straightDist.text !== "N/A") {
            distanceHtml += `<div style="display:flex;align-items:center;gap:4px;font-size:11px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C9A962" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              <span style="color:#64748b;">Straight:</span>
              <span style="color:#B45309;font-weight:600;">${straightDist.text}</span>
            </div>`;
          }
          if (driveDist) {
            distanceHtml += `<div style="display:flex;align-items:center;gap:4px;font-size:11px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2" ry="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              <span style="color:#64748b;">Drive:</span>
              <span style="color:#1e40af;font-weight:600;">${driveDist.text}</span>
              <span style="color:#94a3b8;">(${driveDist.duration})</span>
            </div>`;
          }
          distanceHtml += `</div>`;
        }

        infoWindowRef.current?.setContent(
          `<div style="padding:12px;max-width:280px;font-family:system-ui,-apple-system,sans-serif;">` +
            thumbnailHtml +
            `<div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px;line-height:1.3;">${comp.title || `Comp #${i + 1}`}</div>` +
            `<div style="font-size:12px;color:#64748b;margin-bottom:8px;">${comp.bedrooms || "?"} BR / ${comp.bathrooms || "?"} BA</div>` +
            `<div style="display:flex;gap:1px;margin-bottom:2px;background:#f1f5f9;border-radius:8px;overflow:hidden;">` +
              `<div style="flex:1;padding:6px 8px;background:white;"><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:500;">Revenue</div><div style="font-size:15px;font-weight:700;color:#059669;">${formatCurrency(comp.annual_revenue)}<span style="font-size:10px;font-weight:400;color:#94a3b8;">/yr</span></div></div>` +
              `<div style="flex:1;padding:6px 8px;background:white;text-align:center;"><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:500;">ADR</div><div style="font-size:15px;font-weight:600;color:#0f172a;">${formatCurrency(comp.adr)}</div></div>` +
              `<div style="flex:1;padding:6px 8px;background:white;text-align:right;"><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:500;">Occ.</div><div style="font-size:15px;font-weight:600;color:#0f172a;">${formatOccupancy(comp.occupancy)}</div></div>` +
            `</div>` +
            distanceHtml +
            (airbnbLink ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;">${airbnbLink}</div>` : "") +
          `</div>`
        );
        infoWindowRef.current?.open(map, marker);
      });
      markersRef.current.push(marker);
    });

    // Add subject property marker LAST (amber/gold, larger, brighter, stronger shadow)
    if (subjectProperty.latitude && subjectProperty.longitude) {
      const el = document.createElement("div");
      el.innerHTML = `
        <style>
          @keyframes pulse-ring-strong {
            0%   { transform: scale(0.75); opacity: 0.95; }
            50%  { transform: scale(1.35); opacity: 0.45; }
            100% { transform: scale(0.75); opacity: 0.95; }
          }
        </style>
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;z-index:1000;">
          <div style="
            position:absolute;
            top:50%;
            left:50%;
            transform:translate(-50%,-50%);
            width:80px;
            height:80px;
            background:rgba(255,193,7,0.5);
            border-radius:50%;
            box-shadow:0 0 24px rgba(255,193,7,0.9), 0 0 48px rgba(255,193,7,0.6);
            animation:pulse-ring-strong 1.6s infinite;
          "></div>
          <div style="
            position:relative;
            background:linear-gradient(135deg,#FBBF24,#F59E0B,#D97706);
            border:4px solid #fff;
            border-radius:50%;
            width:56px;
            height:56px;
            display:flex;
            align-items:center;
            justify-content:center;
            box-shadow:
              0 10px 24px rgba(0,0,0,0.55),
              0 0 0 4px #B45309,
              0 0 20px rgba(255,193,7,0.9);
            z-index:10;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.75">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div style="
            margin-top:6px;
            background:linear-gradient(135deg,#B45309,#92400E);
            color:white;
            font-size:10px;
            font-weight:700;
            padding:3px 10px;
            border-radius:12px;
            white-space:nowrap;
            box-shadow:0 4px 10px rgba(0,0,0,0.35);
            letter-spacing:0.5px;
            text-transform:uppercase;
          ">
            Your Property
          </div>
        </div>
      `;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: subjectProperty.latitude, lng: subjectProperty.longitude },
        title: "Your Property",
        content: el,
        zIndex: 9999
      });
      marker.addListener("click", () => {
        infoWindowRef.current?.setContent(
          `<div style="padding:12px;max-width:220px;font-family:system-ui,-apple-system,sans-serif;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#FBBF24,#D97706);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <div>
                <div style="font-weight:700;font-size:13px;color:#B45309;">Subject Property</div>
                <div style="font-size:11px;color:#64748b;">${subjectProperty.address}</div>
              </div>
            </div>
            ${subjectProperty.bedrooms ? `<div style="font-size:12px;color:#0f172a;padding:4px 8px;background:#fef3c7;border-radius:4px;display:inline-block;">${subjectProperty.bedrooms} BR / ${subjectProperty.bathrooms || "?"} BA</div>` : ""}
          </div>`
        );
        infoWindowRef.current?.open(map, marker);
      });
      markersRef.current.push(marker);
    }

    // Fit bounds to show all markers
    if (markersRef.current.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      if (subjectProperty.latitude && subjectProperty.longitude) {
        bounds.extend({ lat: subjectProperty.latitude, lng: subjectProperty.longitude });
      }
      compsWithCoords.forEach((c) => {
        bounds.extend({ lat: c.latitude!, lng: c.longitude! });
      });
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  };

  // Update driving distance for selected comp when distances load
  useEffect(() => {
    if (selectedComp && drivingDistances.size > 0) {
      const driveDist = getDrivingDist(selectedComp);
      setSelectedCompDrivingDist(driveDist);
    }
  }, [drivingDistances, selectedComp, getDrivingDist]);

  useEffect(() => {
    if (mapRef.current) handleMapReady(mapRef.current);
  }, [comps, subjectProperty]);

  // Get the image URL for the selected comp
  const selectedCompImg = selectedComp?.thumbnail_url || selectedComp?.image_url;

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
        <div className={`overflow-hidden ${isExpanded ? "h-[600px] sm:h-[650px] md:h-[700px]" : "h-[350px] sm:h-[400px] md:h-[450px]"}`}>
          <MapView
            initialCenter={{ lat: subjectProperty.latitude, lng: subjectProperty.longitude }}
            initialZoom={14}
            onMapReady={handleMapReady}
            className="h-full sm:h-full md:h-full lg:h-full rounded-b-lg"
          />
        </div>
        
        {/* Legend */}
        <div className="p-3 border-t bg-muted/30">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-amber-700 flex items-center justify-center">
                <Home className="w-2.5 h-2.5 text-white" />
              </div>
              <span>Subject Property</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-emerald-600 border border-white" />
              <span>$100k+/yr</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-green-500 border border-white" />
              <span>$80-100k/yr</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-blue-500 border border-white" />
              <span>$50-80k/yr</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-gray-500 border border-white" />
              <span>&lt;$50k/yr</span>
            </div>
            {distanceLoading && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Car className="w-3.5 h-3.5 animate-pulse" />
                <span>Calculating driving distances...</span>
              </div>
            )}
          </div>
        </div>

        {/* Selected comp details panel (below map) */}
        {selectedComp && (
          <div className="p-4 border-t bg-gradient-to-r from-muted/50 to-muted/30">
            <div className="flex gap-4">
              {/* Thumbnail */}
              {selectedCompImg && (
                <div className="flex-shrink-0">
                  <img
                    src={selectedCompImg}
                    alt={selectedComp.title || "Comparable Property"}
                    className="w-24 h-20 rounded-lg object-cover border border-border shadow-sm"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
              
              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate">{selectedComp.title || "Comparable Property"}</h4>
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
                
                {/* Distance row with both straight-line and driving */}
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  {selectedCompStraightDist && selectedCompStraightDist !== "N/A" && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
                      <Navigation className="w-3 h-3" />
                      {selectedCompStraightDist} straight
                    </span>
                  )}
                  {selectedCompDrivingDist && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                      <Car className="w-3 h-3" />
                      {selectedCompDrivingDist.text} drive ({selectedCompDrivingDist.duration})
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
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
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
