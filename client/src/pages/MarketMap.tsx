import { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { MapView } from '@/components/Map';
import { 
  ArrowLeft, 
  MapPin, 
  Layers,
  Filter,
  Loader2,
  Search,
  X,
  Building2,
  Mountain,
  Waves,
  Trees,
  Home,
  Building,
  TrendingUp,
  DollarSign,
  Users,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

type MarketType = "coastal" | "urban_metro" | "mountains_lakes" | "suburban" | "rural" | "mid_size_city";

const marketTypeColors: Record<MarketType, string> = {
  coastal: '#3B82F6', // blue
  urban_metro: '#8B5CF6', // purple
  mountains_lakes: '#10B981', // green
  suburban: '#F59E0B', // amber
  rural: '#84CC16', // lime
  mid_size_city: '#EC4899', // pink
};

const marketTypeLabels: Record<MarketType, string> = {
  coastal: "Coastal",
  urban_metro: "Urban Metro",
  mountains_lakes: "Mountains & Lakes",
  suburban: "Suburban",
  rural: "Rural",
  mid_size_city: "Mid-Size City",
};

const marketTypeIcons: Record<MarketType, React.ReactNode> = {
  coastal: <Waves className="w-4 h-4" />,
  urban_metro: <Building2 className="w-4 h-4" />,
  mountains_lakes: <Mountain className="w-4 h-4" />,
  suburban: <Home className="w-4 h-4" />,
  rural: <Trees className="w-4 h-4" />,
  mid_size_city: <Building className="w-4 h-4" />,
};

interface MarketData {
  id: string;
  name: string;
  market_type: string;
  listing_count: number;
  location: {
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  scores: {
    market_score: number;
    investability: number;
    rental_demand: number;
    revenue_growth: number;
    seasonality: number;
    regulation: number;
  };
  metrics: {
    occupancy: number;
    adr: number;
    revenue: number;
    revpar: number;
  };
}

function MarketInfoCard({ market, onClose }: { market: MarketData; onClose: () => void }) {
  const marketType = market.market_type as MarketType;
  
  return (
    <Card className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-10 shadow-xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg text-[#0F172A]">{market.name}</h3>
            <div className="flex items-center gap-2 text-sm text-[#0F172A]/60">
              <MapPin className="w-3 h-3" />
              {market.location.state}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#0F172A]/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-[#0F172A]/60" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Badge 
            style={{ backgroundColor: marketTypeColors[marketType] || '#6B7280' }}
            className="text-white flex items-center gap-1"
          >
            {marketTypeIcons[marketType]}
            {marketTypeLabels[marketType] || market.market_type}
          </Badge>
          <Badge variant="outline">{market.listing_count.toLocaleString()} listings</Badge>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 text-center p-2 bg-[#C9A962]/10 rounded-lg">
            <div className="text-xl font-bold text-[#C9A962]">{market.scores.market_score}</div>
            <div className="text-xs text-[#0F172A]/60">Market Score</div>
          </div>
          <div className="flex-1 text-center p-2 bg-[#0F172A]/5 rounded-lg">
            <div className="text-xl font-bold text-[#0F172A]">${Math.round(market.metrics.revenue / 1000)}K</div>
            <div className="text-xs text-[#0F172A]/60">Avg Revenue</div>
          </div>
          <div className="flex-1 text-center p-2 bg-[#0F172A]/5 rounded-lg">
            <div className="text-xl font-bold text-[#0F172A]">{Math.round(market.metrics.occupancy)}%</div>
            <div className="text-xs text-[#0F172A]/60">Occupancy</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-[#0F172A]/60">Investability:</span>
            <span className="font-medium">{market.scores.investability}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-[#0F172A]/60">Demand:</span>
            <span className="font-medium">{market.scores.rental_demand}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#C9A962]" />
            <span className="text-[#0F172A]/60">ADR:</span>
            <span className="font-medium">${Math.round(market.metrics.adr)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-purple-500" />
            <span className="text-[#0F172A]/60">RevPAR:</span>
            <span className="font-medium">${Math.round(market.metrics.revpar)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/market/${market.id}`} className="flex-1">
            <Button className="w-full bg-[#0F172A] hover:bg-[#1e293b]">
              View Full Report
            </Button>
          </Link>
          <Link href={`/top-performers?market=${market.id}`}>
            <Button variant="outline">
              Top Listings
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketMap() {
  const [selectedMarket, setSelectedMarket] = useState<MarketData | null>(null);
  const [marketType, setMarketType] = useState<MarketType | 'all'>('all');
  const [minScore, setMinScore] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const { data, isLoading } = trpc.advanced.getCountryMarkets.useQuery({
    countryCode: 'us',
    limit: 100,
    market_type: marketType === 'all' ? undefined : marketType,
    min_market_score: minScore > 0 ? minScore : undefined,
    sort_by: 'market_score',
    sort_direction: 'desc',
  });

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    
    // Set initial view to US
    map.setCenter({ lat: 39.8283, lng: -98.5795 });
    map.setZoom(4);
  }, []);

  // Update markers when data changes
  useEffect(() => {
    if (!mapRef.current || !data?.data?.markets) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      marker.map = null;
    });
    markersRef.current = [];

    // Filter markets by search term
    let markets = data.data.markets;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      markets = markets.filter(m => 
        m.name.toLowerCase().includes(term) ||
        m.location.state?.toLowerCase().includes(term)
      );
    }

    // Create markers for each market
    markets.forEach(market => {
      if (!market.location.latitude || !market.location.longitude) return;

      const marketType = market.market_type as MarketType;
      const color = marketTypeColors[marketType] || '#6B7280';
      
      // Create custom marker element
      const markerElement = document.createElement('div');
      markerElement.className = 'market-marker';
      markerElement.style.cssText = `
        width: 32px;
        height: 32px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        color: white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transition: transform 0.2s;
      `;
      markerElement.textContent = market.scores.market_score.toString();
      
      markerElement.addEventListener('mouseenter', () => {
        markerElement.style.transform = 'scale(1.2)';
      });
      markerElement.addEventListener('mouseleave', () => {
        markerElement.style.transform = 'scale(1)';
      });

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: market.location.latitude, lng: market.location.longitude },
        content: markerElement,
        title: market.name,
      });

      marker.addListener('click', () => {
        setSelectedMarket(market);
        mapRef.current?.panTo({ lat: market.location.latitude!, lng: market.location.longitude! });
        mapRef.current?.setZoom(8);
      });

      markersRef.current.push(marker);
    });
  }, [data?.data?.markets, searchTerm]);

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
      {/* Header */}
      <div className="bg-[#0F172A] text-white py-4 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
              <div className="h-6 w-px bg-white/20" />
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#C9A962]" />
                <h1 className="text-xl font-serif font-semibold">Interactive Market Map</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="bg-transparent border-white/30 text-white hover:bg-white/10"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-transparent border-white/30 text-white hover:bg-white/10"
              >
                <Layers className="w-4 h-4 mr-2" />
                Legend
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-[#0F172A]/10 py-4 px-4">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F172A]/40" />
              <Input
                placeholder="Search markets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Market Type */}
            <Select value={marketType} onValueChange={(v) => setMarketType(v as MarketType | 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Market type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(marketTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: marketTypeColors[value as MarketType] }}
                      />
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Min Score */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#0F172A]/60">Min Score:</span>
              <div className="w-32">
                <Slider
                  value={[minScore]}
                  onValueChange={([v]) => setMinScore(v)}
                  max={100}
                  step={5}
                />
              </div>
              <span className="text-sm font-medium w-8">{minScore}</span>
            </div>

            {/* Results count */}
            <div className="text-sm text-[#0F172A]/60">
              {data?.data?.markets.length || 0} markets
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white border-b border-[#0F172A]/10 py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4 overflow-x-auto">
          <span className="text-sm text-[#0F172A]/60 whitespace-nowrap">Market Types:</span>
          {Object.entries(marketTypeLabels).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5 whitespace-nowrap">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: marketTypeColors[type as MarketType] }}
              />
              <span className="text-sm text-[#0F172A]/70">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
            <span className="ml-3 text-[#0F172A]/60">Loading markets...</span>
          </div>
        )}
        
        <MapView onMapReady={handleMapReady} className="w-full h-full min-h-[600px]" />
        
        {/* Selected Market Info Card */}
        {selectedMarket && (
          <MarketInfoCard 
            market={selectedMarket} 
            onClose={() => setSelectedMarket(null)} 
          />
        )}
      </div>
    </div>
  );
}
