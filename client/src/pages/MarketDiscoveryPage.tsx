import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MapPin, 
  TrendingUp, 
  DollarSign, 
  Star, 
  Building2, 
  Filter,
  ChevronRight,
  Loader2,
  Mountain,
  Waves,
  TreePine,
  Home,
  Building
} from 'lucide-react';
import { Link } from 'wouter';

type MarketType = 'all' | 'coastal' | 'urban_metro' | 'mountains_lakes' | 'suburban' | 'rural' | 'mid_size_city';

const marketTypeIcons: Record<string, React.ReactNode> = {
  coastal: <Waves className="w-4 h-4" />,
  urban_metro: <Building className="w-4 h-4" />,
  mountains_lakes: <Mountain className="w-4 h-4" />,
  suburban: <Home className="w-4 h-4" />,
  rural: <TreePine className="w-4 h-4" />,
  mid_size_city: <Building2 className="w-4 h-4" />,
};

const marketTypeLabels: Record<string, string> = {
  coastal: 'Coastal',
  urban_metro: 'Urban Metro',
  mountains_lakes: 'Mountains & Lakes',
  suburban: 'Suburban',
  rural: 'Rural',
  mid_size_city: 'Mid-Size City',
};

export default function MarketDiscoveryPage() {
  const [filters, setFilters] = useState({
    marketType: 'all' as MarketType,
    minMarketScore: 0,
    minInvestability: 0,
    minRentalDemand: 0,
    limit: 50,
  });
  const [showFilters, setShowFilters] = useState(false);

  const marketsQuery = trpc.marketDiscovery.getCountryMarkets.useQuery({
    countryCode: 'us',
    marketType: filters.marketType,
    minMarketScore: filters.minMarketScore > 0 ? filters.minMarketScore : undefined,
    minInvestability: filters.minInvestability > 0 ? filters.minInvestability : undefined,
    minRentalDemand: filters.minRentalDemand > 0 ? filters.minRentalDemand : undefined,
    limit: filters.limit,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-amber-600 bg-amber-50';
    return 'text-slate-600 bg-slate-50';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  ← Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900">US Market Discovery</h1>
                <p className="text-sm text-slate-500">Explore {marketsQuery.data?.total || 0} short-term rental markets</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
              {(filters.minMarketScore > 0 || filters.minInvestability > 0 || filters.minRentalDemand > 0 || filters.marketType !== 'all') && (
                <Badge variant="secondary" className="ml-1">Active</Badge>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-slate-200 shadow-sm">
          <div className="container mx-auto px-4 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Market Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Market Type</label>
                <Select
                  value={filters.marketType}
                  onValueChange={(value) => setFilters({ ...filters, marketType: value as MarketType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="coastal">Coastal</SelectItem>
                    <SelectItem value="urban_metro">Urban Metro</SelectItem>
                    <SelectItem value="mountains_lakes">Mountains & Lakes</SelectItem>
                    <SelectItem value="suburban">Suburban</SelectItem>
                    <SelectItem value="rural">Rural</SelectItem>
                    <SelectItem value="mid_size_city">Mid-Size City</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Min Market Score */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Min Market Score: {filters.minMarketScore}
                </label>
                <Slider
                  value={[filters.minMarketScore]}
                  onValueChange={([value]) => setFilters({ ...filters, minMarketScore: value })}
                  max={100}
                  step={5}
                  className="mt-3"
                />
              </div>

              {/* Min Investability */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Min Investability: {filters.minInvestability}
                </label>
                <Slider
                  value={[filters.minInvestability]}
                  onValueChange={([value]) => setFilters({ ...filters, minInvestability: value })}
                  max={100}
                  step={5}
                  className="mt-3"
                />
              </div>

              {/* Min Rental Demand */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Min Rental Demand: {filters.minRentalDemand}
                </label>
                <Slider
                  value={[filters.minRentalDemand]}
                  onValueChange={([value]) => setFilters({ ...filters, minRentalDemand: value })}
                  max={100}
                  step={5}
                  className="mt-3"
                />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button
                variant="ghost"
                onClick={() => setFilters({
                  marketType: 'all',
                  minMarketScore: 0,
                  minInvestability: 0,
                  minRentalDemand: 0,
                  limit: 50,
                })}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {marketsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            <span className="ml-3 text-slate-600">Loading markets...</span>
          </div>
        ) : marketsQuery.isError ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">Failed to load markets. Please try again.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">Markets Found</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{marketsQuery.data?.data?.length || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Star className="w-4 h-4" />
                    <span className="text-sm">Avg Score</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {marketsQuery.data?.data && marketsQuery.data.data.length > 0
                      ? Math.round(
                          marketsQuery.data.data.reduce((sum, m) => sum + (m.scores?.market_score || 0), 0) /
                            marketsQuery.data.data.length
                        )
                      : 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Building2 className="w-4 h-4" />
                    <span className="text-sm">Total Listings</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {marketsQuery.data?.data
                      ? marketsQuery.data.data.reduce((sum, m) => sum + (m.listing_count || 0), 0).toLocaleString()
                      : 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Avg Revenue</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {marketsQuery.data?.data && marketsQuery.data.data.length > 0
                      ? formatCurrency(
                          marketsQuery.data.data.reduce((sum, m) => sum + (m.metrics?.revenue || 0), 0) /
                            marketsQuery.data.data.length
                        )
                      : '$0'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Markets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {marketsQuery.data?.data?.map((market) => (
                <Card key={market.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {market.market_type && marketTypeIcons[market.market_type]}
                        <CardTitle className="text-lg">{market.name}</CardTitle>
                      </div>
                      <Badge className={getScoreColor(market.scores?.market_score || 0)}>
                        {market.scores?.market_score || 0}
                      </Badge>
                    </div>
                    {market.market_type && (
                      <Badge variant="outline" className="w-fit text-xs">
                        {marketTypeLabels[market.market_type] || market.market_type}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Listings</span>
                        <span className="font-medium">{(market.listing_count || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Avg Revenue</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(market.metrics?.revenue || 0)}/yr
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Occupancy</span>
                        <span className="font-medium">{Math.round((market.metrics?.occupancy || 0) * 100)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">ADR</span>
                        <span className="font-medium">{formatCurrency(market.metrics?.adr || 0)}/night</span>
                      </div>

                      {/* Scores */}
                      <div className="pt-3 border-t border-slate-100">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-xs text-slate-500">Investability</p>
                            <p className="font-semibold text-sm">{market.scores?.investability || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Demand</p>
                            <p className="font-semibold text-sm">{market.scores?.rental_demand || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Growth</p>
                            <p className="font-semibold text-sm">{market.scores?.revenue_growth || 0}</p>
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      <Link href={`/market-advisor?marketId=${market.id}&marketName=${encodeURIComponent(market.name)}`}>
                        <Button variant="ghost" className="w-full mt-2 group-hover:bg-amber-50 group-hover:text-amber-700">
                          View Details
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Load More */}
            {marketsQuery.data?.data && marketsQuery.data.data.length >= filters.limit && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  onClick={() => setFilters({ ...filters, limit: filters.limit + 50 })}
                >
                  Load More Markets
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
