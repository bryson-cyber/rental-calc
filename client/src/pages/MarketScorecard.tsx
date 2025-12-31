import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { 
  ArrowLeft, 
  TrendingUp, 
  MapPin, 
  Filter, 
  ChevronDown,
  ChevronUp,
  Star,
  Building2,
  Mountain,
  Waves,
  Trees,
  Home,
  Building,
  Loader2,
  Search,
  BarChart3,
  Target,
  Calendar,
  Shield,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type MarketType = "coastal" | "urban_metro" | "mountains_lakes" | "suburban" | "rural" | "mid_size_city";
type SortBy = "market_score" | "investability" | "rental_demand" | "revenue_growth" | "seasonality" | "regulation" | "listing_count" | "revenue";

const marketTypeIcons: Record<MarketType, React.ReactNode> = {
  coastal: <Waves className="w-4 h-4" />,
  urban_metro: <Building2 className="w-4 h-4" />,
  mountains_lakes: <Mountain className="w-4 h-4" />,
  suburban: <Home className="w-4 h-4" />,
  rural: <Trees className="w-4 h-4" />,
  mid_size_city: <Building className="w-4 h-4" />,
};

const marketTypeLabels: Record<MarketType, string> = {
  coastal: "Coastal",
  urban_metro: "Urban Metro",
  mountains_lakes: "Mountains & Lakes",
  suburban: "Suburban",
  rural: "Rural",
  mid_size_city: "Mid-Size City",
};

const sortByLabels: Record<SortBy, string> = {
  market_score: "Market Score",
  investability: "Investability",
  rental_demand: "Rental Demand",
  revenue_growth: "Revenue Growth",
  seasonality: "Seasonality (Stability)",
  regulation: "Regulation (Friendliness)",
  listing_count: "Market Size",
  revenue: "Avg Revenue",
};

function ScoreBar({ score, label, color = "gold" }: { score: number; label: string; color?: string }) {
  const colorClass = color === "gold" ? "bg-[#C9A962]" : color === "green" ? "bg-green-500" : "bg-blue-500";
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[#0F172A]/60">{label}</span>
        <span className="font-medium">{score}/100</span>
      </div>
      <div className="h-2 bg-[#0F172A]/10 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClass} rounded-full transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function MarketCard({ market, rank }: { 
  market: {
    id: string;
    name: string;
    market_type: string;
    listing_count: number;
    location: { state?: string; country?: string };
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
  };
  rank: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const marketType = market.market_type as MarketType;
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-0">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                rank <= 3 ? 'bg-[#C9A962] text-white' : 'bg-[#0F172A]/10 text-[#0F172A]'
              }`}>
                {rank}
              </div>
              <div>
                <h3 className="font-semibold text-[#0F172A]">{market.name}</h3>
                <div className="flex items-center gap-2 text-sm text-[#0F172A]/60">
                  <MapPin className="w-3 h-3" />
                  {market.location.state}, {market.location.country}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#C9A962]">{market.scores.market_score}</div>
              <div className="text-xs text-[#0F172A]/60">Market Score</div>
            </div>
          </div>

          {/* Market Type Badge */}
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary" className="flex items-center gap-1">
              {marketTypeIcons[marketType] || <Building className="w-3 h-3" />}
              {marketTypeLabels[marketType] || market.market_type}
            </Badge>
            <Badge variant="outline">{market.listing_count.toLocaleString()} listings</Badge>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="text-center p-2 bg-[#0F172A]/5 rounded-lg">
              <div className="text-lg font-semibold text-[#0F172A]">${Math.round(market.metrics.revenue / 1000)}K</div>
              <div className="text-xs text-[#0F172A]/60">Avg Revenue</div>
            </div>
            <div className="text-center p-2 bg-[#0F172A]/5 rounded-lg">
              <div className="text-lg font-semibold text-[#0F172A]">{Math.round(market.metrics.occupancy)}%</div>
              <div className="text-xs text-[#0F172A]/60">Occupancy</div>
            </div>
            <div className="text-center p-2 bg-[#0F172A]/5 rounded-lg">
              <div className="text-lg font-semibold text-[#0F172A]">${Math.round(market.metrics.adr)}</div>
              <div className="text-xs text-[#0F172A]/60">ADR</div>
            </div>
            <div className="text-center p-2 bg-[#0F172A]/5 rounded-lg">
              <div className="text-lg font-semibold text-[#0F172A]">${Math.round(market.metrics.revpar)}</div>
              <div className="text-xs text-[#0F172A]/60">RevPAR</div>
            </div>
          </div>

          {/* Expand/Collapse Button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1 text-sm text-[#0F172A]/60 hover:text-[#C9A962] transition-colors py-2"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                View All Scores
              </>
            )}
          </button>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="border-t border-[#0F172A]/10 p-4 bg-[#0F172A]/5 space-y-3">
            <ScoreBar score={market.scores.investability} label="Investability" color="gold" />
            <ScoreBar score={market.scores.rental_demand} label="Rental Demand" color="green" />
            <ScoreBar score={market.scores.revenue_growth} label="Revenue Growth" color="blue" />
            <ScoreBar score={market.scores.seasonality} label="Seasonality (Stability)" color="gold" />
            <ScoreBar score={market.scores.regulation} label="Regulation (Friendliness)" color="green" />
            
            <div className="pt-3 flex gap-2">
              <Link href={`/market/${market.id}`}>
                <Button variant="default" size="sm" className="bg-[#0F172A] hover:bg-[#1e293b]">
                  View Full Report
                </Button>
              </Link>
              <Link href={`/compare?markets=${market.id}`}>
                <Button variant="outline" size="sm">
                  Add to Compare
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MarketScorecard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [marketType, setMarketType] = useState<MarketType | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortBy>('market_score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [minMarketScore, setMinMarketScore] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error } = trpc.advanced.getCountryMarkets.useQuery({
    countryCode: 'us',
    limit: 25,
    market_type: marketType === 'all' ? undefined : marketType,
    min_market_score: minMarketScore > 0 ? minMarketScore : undefined,
    sort_by: sortBy,
    sort_direction: sortDirection,
  });

  const filteredMarkets = useMemo(() => {
    if (!data?.data?.markets) return [];
    
    let markets = [...data.data.markets];
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      markets = markets.filter(m => 
        m.name.toLowerCase().includes(term) ||
        m.location.state?.toLowerCase().includes(term)
      );
    }
    
    return markets;
  }, [data?.data?.markets, searchTerm]);

  const stats = useMemo(() => {
    if (!data?.data?.markets || data.data.markets.length === 0) return null;
    
    const markets = data.data.markets;
    const avgScore = Math.round(markets.reduce((sum, m) => sum + m.scores.market_score, 0) / markets.length);
    const avgRevenue = Math.round(markets.reduce((sum, m) => sum + m.metrics.revenue, 0) / markets.length);
    const topMarket = markets[0];
    
    return { avgScore, avgRevenue, topMarket, totalCount: data.data.total_count };
  }, [data?.data]);

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Header */}
      <div className="bg-[#0F172A] text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#C9A962]/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[#C9A962]" />
            </div>
            <span className="text-[#C9A962] text-sm font-medium uppercase tracking-wider">Market Scorecard</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-serif font-semibold mb-2">
            Find the Best Markets to Invest In
          </h1>
          <p className="text-white/70 max-w-2xl">
            Compare {stats?.totalCount || 500}+ US markets ranked by investability, rental demand, revenue growth, and more.
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="bg-white border-b border-[#0F172A]/10 py-4 px-4">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#C9A962]/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-[#C9A962]" />
              </div>
              <div>
                <div className="text-sm text-[#0F172A]/60">Top Market</div>
                <div className="font-semibold text-[#0F172A]">{stats.topMarket?.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Star className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-sm text-[#0F172A]/60">Top Score</div>
                <div className="font-semibold text-[#0F172A]">{stats.topMarket?.scores.market_score}/100</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-[#0F172A]/60">Avg Score</div>
                <div className="font-semibold text-[#0F172A]">{stats.avgScore}/100</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-sm text-[#0F172A]/60">Avg Revenue</div>
                <div className="font-semibold text-[#0F172A]">${Math.round(stats.avgRevenue / 1000)}K/yr</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border-b border-[#0F172A]/10 py-4 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-4">
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

            {/* Sort By */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sortByLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort Direction */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortDirection(d => d === 'desc' ? 'asc' : 'desc')}
              title={sortDirection === 'desc' ? 'Highest first' : 'Lowest first'}
            >
              {sortDirection === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>

            {/* Market Type */}
            <Select value={marketType} onValueChange={(v) => setMarketType(v as MarketType | 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Market type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(marketTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* More Filters Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Hide Filters' : 'More Filters'}
            </Button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 p-4 bg-[#0F172A]/5 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[#0F172A]/70 mb-2">
                    Minimum Market Score: {minMarketScore}
                  </label>
                  <Slider
                    value={[minMarketScore]}
                    onValueChange={([v]) => setMinMarketScore(v)}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
            <span className="ml-3 text-[#0F172A]/60">Loading markets...</span>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500">Failed to load markets. Please try again.</p>
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#0F172A]/60">No markets found matching your criteria.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-[#0F172A]/60">
                Showing {filteredMarkets.length} of {data?.data?.total_count || 0} markets
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMarkets.map((market, index) => (
                <MarketCard key={market.id} market={market} rank={index + 1} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* CTA Section */}
      <div className="bg-[#0F172A] text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-serif font-semibold mb-4">
            Found a Market You Like?
          </h2>
          <p className="text-white/70 mb-6">
            Our team can help you find the perfect property and set up your short-term rental business in any of these markets.
          </p>
          <Button size="lg" className="bg-[#C9A962] hover:bg-[#b89a55] text-[#0F172A]">
            Schedule Free Consultation
          </Button>
        </div>
      </div>
    </div>
  );
}
