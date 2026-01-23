import { useState, useRef, useEffect } from "react";
import { MapView } from "./Map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Home, Star, Expand, Minimize, ExternalLink } from "lucide-react";

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

function getMarkerColor(revenue: number | undefined): string {
  if (!revenue) return "#6B7280";
  if (revenue >= 80000) return "#22C55E";
  if (revenue >= 50000) return "#3B82F6";
  return "#6B7280";
}

function formatCurrency(value: number | undefined): string {
  if (!value) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatDistance(meters: number | undefined): string {
  if (!meters) return "N/A";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

export function CompsMapView({ comps, subjectProperty, className }: CompsMapViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedComp, setSelectedComp] = useState<Comp | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const compsWithCoords = comps.filter((c) => c.latitude && c.longitude && !isNaN(c.latitude) && !isNaN(c.longitude));

  const handleMapReady = (map: google.maps.Map) => {
    mapRef.current = map;
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];
    infoWindowRef.current = new google.maps.InfoWindow();

    // Add subject property marker (amber/gold)
    if (subjectProperty.latitude && subjectProperty.longitude) {
      const el = document.createElement("div");
      el.innerHTML = `<div style="background:#F59E0B;border:3px solid #B45309;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: subjectProperty.latitude, lng: subjectProperty.longitude },
        title: "Subject Property",
        content: el,
        zIndex: 1000
      });
      marker.addListener("click", () => {
        infoWindowRef.current?.setContent(`<div style="padding:8px;max-width:200px;"><b style="color:#B45309;">Subject Property</b><p style="font-size:12px;color:#666;">${subjectProperty.address}</p>${subjectProperty.bedrooms ? `<p style="font-size:12px;">${subjectProperty.bedrooms} BR / ${subjectProperty.bathrooms || "?"} BA</p>` : ""}</div>`);
        infoWindowRef.current?.open(map, marker);
      });
      markersRef.current.push(marker);
    }

    // Add comp markers
    compsWithCoords.forEach((comp, i) => {
      const color = getMarkerColor(comp.annual_revenue);
      const el = document.createElement("div");
      el.innerHTML = `<div style="background:${color};border:2px solid white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.3);font-size:12px;font-weight:bold;color:white;">${i + 1}</div>`;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: comp.latitude!, lng: comp.longitude! },
        title: comp.title || `Comp #${i + 1}`,
        content: el
      });
      marker.addListener("click", () => {
        setSelectedComp(comp);
        const airbnbLink = comp.airbnb_listing_id ? `<a href="https://www.airbnb.com/rooms/${comp.airbnb_listing_id}" target="_blank" style="color:#3B82F6;text-decoration:underline;font-size:11px;">View on Airbnb</a>` : "";
        infoWindowRef.current?.setContent(`<div style="padding:8px;max-width:250px;"><b>${comp.title || `Comp #${i + 1}`}</b><div style="font-size:12px;color:#666;margin-bottom:4px;">${comp.bedrooms || "?"} BR / ${comp.bathrooms || "?"} BA ${comp.rating ? `• ⭐ ${comp.rating.toFixed(1)}` : ""}</div><div style="font-size:13px;font-weight:600;color:#059669;margin-bottom:4px;">${formatCurrency(comp.annual_revenue)}/yr</div><div style="font-size:12px;color:#666;">ADR: ${formatCurrency(comp.adr)} • Occ: ${comp.occupancy ? `${Math.round(comp.occupancy * 100)}%` : "N/A"}</div><div style="font-size:11px;color:#999;margin-top:4px;">${formatDistance(comp.distance_meters)} away</div>${airbnbLink ? `<div style="margin-top:6px;">${airbnbLink}</div>` : ""}</div>`);
        infoWindowRef.current?.open(map, marker);
      });
      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (markersRef.current.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      if (subjectProperty.latitude && subjectProperty.longitude) {
        bounds.extend({ lat: subjectProperty.latitude, lng: subjectProperty.longitude });
      }
      compsWithCoords.forEach((c) => bounds.extend({ lat: c.latitude!, lng: c.longitude! }));
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  };

  useEffect(() => {
    if (mapRef.current) handleMapReady(mapRef.current);
  }, [comps, subjectProperty]);

  if (compsWithCoords.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Comparable Properties Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No comparable properties with location data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Comparable Properties Map
            <Badge variant="secondary" className="ml-2">{compsWithCoords.length} comps</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <Minimize className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className={isExpanded ? "h-[500px]" : "h-[300px]"}>
          <MapView
            initialCenter={{ lat: subjectProperty.latitude, lng: subjectProperty.longitude }}
            initialZoom={14}
            onMapReady={handleMapReady}
            className="h-full rounded-b-lg"
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
              <div className="w-4 h-4 rounded-full bg-green-500 border border-white" />
              <span>$80k+/yr</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-blue-500 border border-white" />
              <span>$50-80k/yr</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-gray-500 border border-white" />
              <span>&lt;$50k/yr</span>
            </div>
          </div>
        </div>

        {/* Selected comp details */}
        {selectedComp && (
          <div className="p-3 border-t bg-muted/50">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-sm">{selectedComp.title || "Comparable Property"}</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span>{selectedComp.bedrooms} BR / {selectedComp.bathrooms} BA</span>
                  {selectedComp.rating && (
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      {selectedComp.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-green-600 text-sm">{formatCurrency(selectedComp.annual_revenue)}/yr</div>
                <div className="text-xs text-muted-foreground">ADR: {formatCurrency(selectedComp.adr)}</div>
              </div>
            </div>
            {selectedComp.airbnb_listing_id && (
              <a
                href={`https://www.airbnb.com/rooms/${selectedComp.airbnb_listing_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
              >
                <ExternalLink className="w-3 h-3" />
                View on Airbnb
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CompsMapView;
