import { useState, useMemo } from 'react';
import { Link, useSearch } from 'wouter';
import { trpc } from '@/lib/trpc';
import { 
  ArrowLeft, 
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Percent,
  Sun,
  Cloud,
  Snowflake,
  Loader2,
  Search,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SeasonalityData {
  month: string;
  month_name: string;
  occupancy: number;
  adr: number;
  revenue: number;
  season_type: 'peak' | 'shoulder' | 'off';
  pricing_recommendation?: string;
}

const seasonColors = {
  peak: { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-100' },
  shoulder: { bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-100' },
  off: { bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-100' },
};

const seasonIcons = {
  peak: <Sun className="w-4 h-4" />,
  shoulder: <Cloud className="w-4 h-4" />,
  off: <Snowflake className="w-4 h-4" />,
};

const seasonLabels = {
  peak: 'Peak Season',
  shoulder: 'Shoulder Season',
  off: 'Off Season',
};

function HeatmapCell({ data, maxRevenue }: { data: SeasonalityData; maxRevenue: number }) {
  const intensity = data.revenue / maxRevenue;
  const colors = seasonColors[data.season_type];
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`relative p-3 rounded-lg cursor-pointer transition-all hover:scale-105 ${colors.light}`}
            style={{ 
              opacity: 0.4 + (intensity * 0.6),
            }}
          >
            <div className="text-center">
              <div className="text-xs font-medium text-[#0F172A]/60 mb-1">
                {data.month_name.slice(0, 3)}
              </div>
              <div className="text-lg font-bold text-[#0F172A]">
                ${Math.round(data.revenue / 1000)}K
              </div>
              <div className={`text-xs ${colors.text} flex items-center justify-center gap-1 mt-1`}>
                {seasonIcons[data.season_type]}
                {data.occupancy.toFixed(0)}%
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold">{data.month_name}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-[#0F172A]/60">Revenue:</span>
              <span className="font-medium">${data.revenue.toLocaleString()}</span>
              <span className="text-[#0F172A]/60">Occupancy:</span>
              <span className="font-medium">{data.occupancy.toFixed(1)}%</span>
              <span className="text-[#0F172A]/60">ADR:</span>
              <span className="font-medium">${data.adr.toFixed(0)}</span>
            </div>
            <Badge className={`${colors.bg} text-white`}>
              {seasonLabels[data.season_type]}
            </Badge>
            {data.pricing_recommendation && (
              <p className="text-xs text-[#0F172A]/70 border-t pt-2">
                {data.pricing_recommendation}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MonthDetailCard({ data }: { data: SeasonalityData }) {
  const colors = seasonColors[data.season_type];
  
  return (
    <Card className={`overflow-hidden border-l-4 ${data.season_type === 'peak' ? 'border-l-green-500' : data.season_type === 'shoulder' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`${colors.text}`}>{seasonIcons[data.season_type]}</span>
            <h3 className="font-semibold text-[#0F172A]">{data.month_name}</h3>
          </div>
          <Badge className={`${colors.bg} text-white`}>
            {seasonLabels[data.season_type]}
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center p-2 bg-[#0F172A]/5 rounded-lg">
            <DollarSign className="w-4 h-4 mx-auto mb-1 text-[#C9A962]" />
            <div className="text-lg font-bold text-[#0F172A]">${Math.round(data.revenue / 1000)}K</div>
            <div className="text-xs text-[#0F172A]/60">Revenue</div>
          </div>
          <div className="text-center p-2 bg-[#0F172A]/5 rounded-lg">
            <Percent className="w-4 h-4 mx-auto mb-1 text-green-500" />
            <div className="text-lg font-bold text-[#0F172A]">{data.occupancy.toFixed(0)}%</div>
            <div className="text-xs text-[#0F172A]/60">Occupancy</div>
          </div>
          <div className="text-center p-2 bg-[#0F172A]/5 rounded-lg">
            <DollarSign className="w-4 h-4 mx-auto mb-1 text-blue-500" />
            <div className="text-lg font-bold text-[#0F172A]">${data.adr.toFixed(0)}</div>
            <div className="text-xs text-[#0F172A]/60">ADR</div>
          </div>
        </div>
        
        {data.pricing_recommendation && (
          <div className="flex items-start gap-2 p-2 bg-[#0F172A]/5 rounded-lg">
            <Info className="w-4 h-4 text-[#C9A962] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-[#0F172A]/70">{data.pricing_recommendation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SeasonalityCalendar() {
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);
  const initialMarketId = params.get('market') || '';
  
  const [marketSearch, setMarketSearch] = useState('');
  const [selectedMarketId, setSelectedMarketId] = useState(initialMarketId);
  const [selectedMarketName, setSelectedMarketName] = useState('');

  // Search for markets
  const { data: searchResults, isLoading: isSearching } = trpc.rental.searchMarkets.useQuery(
    { searchTerm: marketSearch, limit: 10 },
    { enabled: marketSearch.length >= 2 }
  );

  // Get seasonality data
  const { data: seasonalityData, isLoading: isLoadingSeasonality } = trpc.advanced.getMarketSeasonality.useQuery(
    { marketId: selectedMarketId },
    { enabled: !!selectedMarketId }
  );

  const handleSelectMarket = (market: { id: string; name: string }) => {
    setSelectedMarketId(market.id);
    setSelectedMarketName(market.name);
    setMarketSearch('');
  };

  const stats = useMemo(() => {
    if (!seasonalityData?.data || seasonalityData.data.length === 0) return null;
    
    const data = seasonalityData.data;
    const maxRevenue = Math.max(...data.map(d => d.revenue));
    const minRevenue = Math.min(...data.map(d => d.revenue));
    const avgRevenue = data.reduce((sum, d) => sum + d.revenue, 0) / data.length;
    const peakMonths = data.filter(d => d.season_type === 'peak');
    const offMonths = data.filter(d => d.season_type === 'off');
    
    return {
      maxRevenue,
      minRevenue,
      avgRevenue,
      peakMonths,
      offMonths,
      variance: ((maxRevenue - minRevenue) / maxRevenue * 100).toFixed(0),
    };
  }, [seasonalityData?.data]);

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Header */}
      <div className="bg-[#0F172A] text-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#C9A962]/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#C9A962]" />
            </div>
            <span className="text-[#C9A962] text-sm font-medium uppercase tracking-wider">Seasonality Analysis</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-serif font-semibold mb-2">
            Market Seasonality Calendar
          </h1>
          <p className="text-white/70 max-w-2xl">
            Understand peak, shoulder, and off-season patterns to optimize your pricing strategy throughout the year.
          </p>
        </div>
      </div>

      {/* Market Search */}
      <div className="bg-white border-b border-[#0F172A]/10 py-4 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F172A]/40" />
              <Input
                placeholder="Search for a market (e.g., Austin, Miami, Nashville)..."
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                className="pl-10"
              />
              
              {/* Search Results Dropdown */}
              {marketSearch.length >= 2 && searchResults?.data && searchResults.data.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#0F172A]/10 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {searchResults.data.map((market) => (
                    <button
                      key={market.id}
                      onClick={() => handleSelectMarket(market)}
                      className="w-full px-4 py-2 text-left hover:bg-[#0F172A]/5 flex items-center justify-between"
                    >
                      <span className="font-medium text-[#0F172A]">{market.name}</span>
                      <span className="text-sm text-[#0F172A]/60">{market.listing_count.toLocaleString()} listings</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {selectedMarketName && (
              <div className="flex items-center gap-2">
                <span className="text-[#0F172A]/60">Selected:</span>
                <Badge variant="secondary" className="text-base py-1 px-3">
                  {selectedMarketName}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {!selectedMarketId ? (
          <div className="text-center py-20">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-[#0F172A]/20" />
            <h2 className="text-xl font-semibold text-[#0F172A] mb-2">Select a Market</h2>
            <p className="text-[#0F172A]/60">Search for a market above to view its seasonality patterns</p>
          </div>
        ) : isLoadingSeasonality ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
            <span className="ml-3 text-[#0F172A]/60">Loading seasonality data...</span>
          </div>
        ) : !seasonalityData?.data || seasonalityData.data.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#0F172A]/60">No seasonality data available for this market.</p>
          </div>
        ) : (
          <>
            {/* Stats Summary */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold text-[#0F172A]">${Math.round(stats.maxRevenue / 1000)}K</div>
                    <div className="text-sm text-[#0F172A]/60">Peak Month Revenue</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingDown className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                    <div className="text-2xl font-bold text-[#0F172A]">${Math.round(stats.minRevenue / 1000)}K</div>
                    <div className="text-sm text-[#0F172A]/60">Off-Season Revenue</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Minus className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                    <div className="text-2xl font-bold text-[#0F172A]">${Math.round(stats.avgRevenue / 1000)}K</div>
                    <div className="text-sm text-[#0F172A]/60">Average Monthly</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Calendar className="w-6 h-6 mx-auto mb-2 text-[#C9A962]" />
                    <div className="text-2xl font-bold text-[#0F172A]">{stats.variance}%</div>
                    <div className="text-sm text-[#0F172A]/60">Seasonal Variance</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Heatmap */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#C9A962]" />
                  Revenue Heatmap
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                  {seasonalityData.data.map((month) => (
                    <HeatmapCell 
                      key={month.month} 
                      data={month} 
                      maxRevenue={stats?.maxRevenue || 1}
                    />
                  ))}
                </div>
                
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-[#0F172A]/10">
                  {Object.entries(seasonLabels).map(([type, label]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded ${seasonColors[type as keyof typeof seasonColors].bg}`} />
                      <span className="text-sm text-[#0F172A]/70">{label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Details */}
            <h2 className="text-xl font-semibold text-[#0F172A] mb-4">Monthly Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {seasonalityData.data.map((month) => (
                <MonthDetailCard key={month.month} data={month} />
              ))}
            </div>

            {/* Pricing Strategy Tips */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#C9A962]" />
                  Pricing Strategy Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Sun className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold text-green-800">Peak Season</h3>
                    </div>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Set rates 15-25% above base</li>
                      <li>• Increase minimum stay to 3-4 nights</li>
                      <li>• Book out 2-3 months in advance</li>
                      <li>• Consider premium add-ons</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Cloud className="w-5 h-5 text-amber-600" />
                      <h3 className="font-semibold text-amber-800">Shoulder Season</h3>
                    </div>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>• Maintain base rates</li>
                      <li>• Offer flexible cancellation</li>
                      <li>• Target business travelers</li>
                      <li>• Weekend premium pricing</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Snowflake className="w-5 h-5 text-blue-600" />
                      <h3 className="font-semibold text-blue-800">Off Season</h3>
                    </div>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Reduce rates 10-20%</li>
                      <li>• Offer weekly/monthly discounts</li>
                      <li>• Lower minimum stay to 1-2 nights</li>
                      <li>• Run promotions & deals</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
