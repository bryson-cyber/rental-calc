import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Building2, 
  MapPin, 
  X, 
  Plus,
  Loader2,
  Trophy,
  Star,
  ArrowRight,
  Home
} from 'lucide-react';
import { Link } from 'wouter';

interface SelectedMarket {
  id: string;
  name: string;
}

export default function MarketComparisonPage() {
  const [selectedMarkets, setSelectedMarkets] = useState<SelectedMarket[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Search for markets
  const searchQuery = trpc.rental.searchMarkets.useQuery(
    { searchTerm, limit: 10 },
    { enabled: searchTerm.length >= 2 && isSearching }
  );

  // Compare markets query
  const comparisonQuery = trpc.marketComparison.compare.useQuery(
    { marketIds: selectedMarkets.map(m => m.id) },
    { enabled: selectedMarkets.length >= 2 }
  );

  const handleAddMarket = (market: { id: string; name: string }) => {
    if (selectedMarkets.length >= 5) return;
    if (selectedMarkets.find(m => m.id === market.id)) return;
    
    setSelectedMarkets([...selectedMarkets, { id: market.id, name: market.name }]);
    setSearchTerm('');
    setIsSearching(false);
  };

  const handleRemoveMarket = (marketId: string) => {
    setSelectedMarkets(selectedMarkets.filter(m => m.id !== marketId));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="container py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="w-4 h-4" />
                Home
              </Button>
            </Link>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">Market Comparison</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Market Comparison</h1>
              <p className="text-slate-600">Compare up to 5 markets side-by-side</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Market Selection */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-600" />
              Select Markets to Compare
            </CardTitle>
            <CardDescription>
              Add 2-5 markets to see a detailed comparison of revenue, occupancy, and other key metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Selected Markets */}
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedMarkets.map((market) => (
                <Badge 
                  key={market.id} 
                  variant="secondary" 
                  className="px-3 py-1.5 text-sm flex items-center gap-2"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  {market.name}
                  <button 
                    onClick={() => handleRemoveMarket(market.id)}
                    className="ml-1 hover:text-red-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </Badge>
              ))}
              {selectedMarkets.length === 0 && (
                <p className="text-slate-500 text-sm">No markets selected yet</p>
              )}
            </div>

            {/* Search Input */}
            {selectedMarkets.length < 5 && (
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Search for a city or market..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsSearching(e.target.value.length >= 2);
                      }}
                      className="pr-10"
                    />
                    {searchQuery.isLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon"
                    disabled={selectedMarkets.length >= 5}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Search Results Dropdown */}
                {isSearching && searchQuery.data?.success && searchQuery.data.data.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {searchQuery.data.data.map((market: { id: string; name: string; state?: string; market_type?: string }) => (
                      <button
                        key={market.id}
                        onClick={() => handleAddMarket({ id: market.id, name: market.name })}
                        disabled={selectedMarkets.find(m => m.id === market.id) !== undefined}
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between border-b last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{market.name}</span>
                          {market.state && (
                            <span className="text-slate-500">, {market.state}</span>
                          )}
                        </div>
                        {market.market_type && (
                          <Badge variant="outline" className="text-xs">
                            {market.market_type}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Compare Button */}
            {selectedMarkets.length >= 2 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-slate-600">
                  {selectedMarkets.length} markets selected • Ready to compare
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comparison Results */}
        {comparisonQuery.isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-4" />
              <p className="text-slate-600">Fetching market data...</p>
            </div>
          </div>
        )}

        {comparisonQuery.data?.success && comparisonQuery.data.data && (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <Trophy className="w-5 h-5" />
                    <span className="text-sm font-medium">Highest Revenue</span>
                  </div>
                  <p className="text-xl font-bold text-green-800">
                    {comparisonQuery.data.data.comparison_summary.highest_revenue?.market_name || 'N/A'}
                  </p>
                  <p className="text-sm text-green-600">
                    {formatCurrency(comparisonQuery.data.data.comparison_summary.highest_revenue?.value || 0)}/year
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-blue-700 mb-2">
                    <Percent className="w-5 h-5" />
                    <span className="text-sm font-medium">Highest Occupancy</span>
                  </div>
                  <p className="text-xl font-bold text-blue-800">
                    {comparisonQuery.data.data.comparison_summary.highest_occupancy?.market_name || 'N/A'}
                  </p>
                  <p className="text-sm text-blue-600">
                    {formatPercent(comparisonQuery.data.data.comparison_summary.highest_occupancy?.value || 0)}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-purple-700 mb-2">
                    <DollarSign className="w-5 h-5" />
                    <span className="text-sm font-medium">Highest ADR</span>
                  </div>
                  <p className="text-xl font-bold text-purple-800">
                    {comparisonQuery.data.data.comparison_summary.highest_adr?.market_name || 'N/A'}
                  </p>
                  <p className="text-sm text-purple-600">
                    {formatCurrency(comparisonQuery.data.data.comparison_summary.highest_adr?.value || 0)}/night
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-amber-700 mb-2">
                    <Star className="w-5 h-5" />
                    <span className="text-sm font-medium">Best Market Score</span>
                  </div>
                  <p className="text-xl font-bold text-amber-800">
                    {comparisonQuery.data.data.comparison_summary.best_market_score?.market_name || 'N/A'}
                  </p>
                  <p className="text-sm text-amber-600">
                    Score: {comparisonQuery.data.data.comparison_summary.best_market_score?.value || 'N/A'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                  Detailed Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Metric</th>
                        {comparisonQuery.data.data.markets.map((market: { market_id: string; market_name: string }) => (
                          <th key={market.market_id} className="text-center py-3 px-4 font-medium text-slate-900">
                            {market.market_name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-600">Annual Revenue</td>
                        {comparisonQuery.data.data.markets.map((market: { market_id: string; metrics: { revenue: number } }) => (
                          <td key={market.market_id} className="text-center py-3 px-4 font-medium">
                            {formatCurrency(market.metrics.revenue)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-600">Occupancy Rate</td>
                        {comparisonQuery.data.data.markets.map((market: { market_id: string; metrics: { occupancy: number } }) => (
                          <td key={market.market_id} className="text-center py-3 px-4 font-medium">
                            {formatPercent(market.metrics.occupancy)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-600">Average Daily Rate</td>
                        {comparisonQuery.data.data.markets.map((market: { market_id: string; metrics: { adr: number } }) => (
                          <td key={market.market_id} className="text-center py-3 px-4 font-medium">
                            {formatCurrency(market.metrics.adr)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-600">RevPAR</td>
                        {comparisonQuery.data.data.markets.map((market: { market_id: string; metrics: { revpar: number } }) => (
                          <td key={market.market_id} className="text-center py-3 px-4 font-medium">
                            {formatCurrency(market.metrics.revpar)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-600">Market Score</td>
                        {comparisonQuery.data.data.markets.map((market: { market_id: string; metrics: { market_score?: number } }) => (
                          <td key={market.market_id} className="text-center py-3 px-4">
                            {market.metrics.market_score ? (
                              <Badge variant={market.metrics.market_score >= 70 ? 'default' : 'secondary'}>
                                {market.metrics.market_score}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-600">Listing Count</td>
                        {comparisonQuery.data.data.markets.map((market: { market_id: string; listing_count: number }) => (
                          <td key={market.market_id} className="text-center py-3 px-4 font-medium">
                            {market.listing_count.toLocaleString()}
                          </td>
                        ))}
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-600">Market Type</td>
                        {comparisonQuery.data.data.markets.map((market: { market_id: string; market_type: string }) => (
                          <td key={market.market_id} className="text-center py-3 px-4">
                            <Badge variant="outline" className="capitalize">
                              {market.market_type}
                            </Badge>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Top Submarkets */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-amber-600" />
                  Top Neighborhoods by Market
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {comparisonQuery.data.data.markets.map((market: { 
                    market_id: string; 
                    market_name: string; 
                    top_submarkets?: Array<{ id: string; name: string; listing_count: number; revenue: number }> 
                  }) => (
                    <div key={market.market_id} className="space-y-3">
                      <h4 className="font-semibold text-slate-900 border-b pb-2">
                        {market.market_name}
                      </h4>
                      {market.top_submarkets && market.top_submarkets.length > 0 ? (
                        market.top_submarkets.map((sub, idx) => (
                          <div key={sub.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-medium">
                                {idx + 1}
                              </span>
                              <span className="text-slate-700">{sub.name}</span>
                            </div>
                            <span className="text-slate-500">{sub.listing_count} listings</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No submarket data available</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {comparisonQuery.data?.success === false && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">{comparisonQuery.data.error}</p>
            </CardContent>
          </Card>
        )}

        {selectedMarkets.length < 2 && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">
                Select at least 2 markets to compare
              </h3>
              <p className="text-slate-500 max-w-md mx-auto">
                Use the search above to find and add markets. You can compare up to 5 markets at once.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
