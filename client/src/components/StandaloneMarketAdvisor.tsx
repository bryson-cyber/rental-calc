import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  TrendingUp, 
  Loader2, 
  Search,
  MapPin,
  Building2,
  BarChart3,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  Clock,
  Home,
  DollarSign,
  Percent,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Streamdown } from 'streamdown';
import { trpc } from '@/lib/trpc';

interface MarketSearchResult {
  id: string;
  name: string;
  type: 'market' | 'submarket';
  listing_count: number;
  location_name: string;
  state?: string;
  country?: string;
}

interface StandaloneMarketAdvisorProps {
  onMarketSelect?: (marketId: string, marketName: string) => void;
  myProperty?: {
    address?: string;
    zipCode?: string;
    city?: string;
  };
}

export function StandaloneMarketAdvisor({ onMarketSelect, myProperty }: StandaloneMarketAdvisorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MarketSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<{ id: string; name: string; type: 'market' | 'submarket' | 'zipcode' } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [marketAdvice, setMarketAdvice] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    scores: true,
    metrics: true,
    seasonality: false,
    historical: false,
    topPerformers: false,
    cancellationPolicies: false,
    professionalStats: false,
    futurePricing: false,
  });
  const [bedroomFilter, setBedroomFilter] = useState<string>('all');

  const searchMarketsMutation = trpc.rental.searchMarkets.useQuery(
    { searchTerm: searchQuery, limit: 10 },
    { enabled: searchQuery.length >= 2 }
  );

  const standaloneMarketAdvisorMutation = trpc.advanced.standaloneMarketAdvisor.useMutation();

  // Auto-populate search with zip code from myProperty if available
  useEffect(() => {
    if (myProperty?.zipCode && !searchQuery && !selectedMarket) {
      setSearchQuery(myProperty.zipCode);
    }
  }, [myProperty?.zipCode]);

  // Update search results when query changes
  useEffect(() => {
    if (searchMarketsMutation.data?.success && searchMarketsMutation.data.data) {
      setSearchResults(searchMarketsMutation.data.data);
      setShowResults(true);
    }
  }, [searchMarketsMutation.data]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.length < 2) {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleMarketSelect = async (market: MarketSearchResult) => {
    setSelectedMarket({
      id: market.id,
      name: market.name,
      type: market.type,
    });
    setSearchQuery(market.name);
    setShowResults(false);
    
    if (onMarketSelect) {
      onMarketSelect(market.id, market.name);
    }
  };

  const handleGenerateAnalysis = async () => {
    if (!selectedMarket) return;
    
    try {
      const result = await standaloneMarketAdvisorMutation.mutateAsync({
        marketId: selectedMarket.id,
        marketType: selectedMarket.type,
      });
      
      if (result.success && result.data) {
        setMarketData(result.data);
        setMarketAdvice(result.data.advice);
      }
    } catch (error) {
      console.error('Error generating market analysis:', error);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${Math.round(value)}%`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-amber-600 bg-amber-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable' | 'growing' | 'declining') => {
    if (trend === 'up' || trend === 'growing') return <ArrowUpRight className="w-4 h-4 text-green-600" />;
    if (trend === 'down' || trend === 'declining') return <ArrowDownRight className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Market Advisor
          </CardTitle>
          <CardDescription>
            Search for any market, city, or zip code to get comprehensive AI-powered analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Market Search Input */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search for a market (e.g., Miami, Denver, 90210...)"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                className="pl-10 py-6 text-lg"
              />
            </div>
            
            {/* Search Results Dropdown */}
            <AnimatePresence>
              {showResults && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-lg border border-slate-200 max-h-80 overflow-y-auto"
                >
                  {searchResults.map((market) => (
                    <button
                      key={market.id}
                      onClick={() => handleMarketSelect(market)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center justify-between border-b border-slate-100 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="font-medium text-slate-900">{market.name}</div>
                          <div className="text-sm text-slate-500">{market.location_name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {market.type === 'submarket' ? 'Submarket' : 'Market'}
                        </Badge>
                        <span className="text-sm text-slate-500">
                          {market.listing_count?.toLocaleString()} listings
                        </span>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bedroom Filter */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700">Filter by Bedrooms:</label>
            <select
              value={bedroomFilter}
              onChange={(e) => setBedroomFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Bedrooms</option>
              <option value="1">1 Bedroom</option>
              <option value="2">2 Bedrooms</option>
              <option value="3">3 Bedrooms</option>
              <option value="4">4 Bedrooms</option>
              <option value="5">5+ Bedrooms</option>
            </select>
          </div>

          {/* Selected Market Display */}
          {selectedMarket && !marketAdvice && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-slate-900">{selectedMarket.name}</div>
                    <div className="text-sm text-slate-500">
                      {selectedMarket.type === 'submarket' ? 'Submarket' : selectedMarket.type === 'zipcode' ? 'Zip Code' : 'Market'}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                  Ready to Analyze
                </Badge>
              </div>
            </div>
          )}

          {/* Generate Button */}
          {selectedMarket && !marketAdvice && (
            <Button
              onClick={handleGenerateAnalysis}
              disabled={standaloneMarketAdvisorMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
            >
              {standaloneMarketAdvisorMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analyzing Market (this may take 30-60 seconds)...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Comprehensive Market Analysis
                </>
              )}
            </Button>
          )}

          {/* Error State */}
          {standaloneMarketAdvisorMutation.isError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-red-800">Analysis Failed</div>
                <div className="text-sm text-red-600">
                  Unable to generate market analysis. Please try again or select a different market.
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Market Data Display */}
      {marketData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Market Overview Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{marketData.market.name}</CardTitle>
                  <CardDescription>
                    {marketData.market.city}, {marketData.market.state}
                    {marketData.market.type !== 'market' && (
                      <Badge variant="outline" className="ml-2">
                        {marketData.market.type === 'submarket' ? 'Submarket' : 'Zip Code'}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-lg px-3 py-1 ${getScoreColor(marketData.scores.marketScore)}`}>
                    Score: {marketData.scores.marketScore}/100
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-600" />
                  <div className="text-2xl font-bold text-slate-900">
                    {formatCurrency(marketData.metrics.avgRevenue)}
                  </div>
                  <div className="text-xs text-slate-600">Avg Annual Revenue</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <Percent className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                  <div className="text-2xl font-bold text-slate-900">
                    {formatPercent(marketData.metrics.avgOccupancy)}
                  </div>
                  <div className="text-xs text-slate-600">Avg Occupancy</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <Calendar className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                  <div className="text-2xl font-bold text-slate-900">
                    {formatCurrency(marketData.metrics.avgAdr)}
                  </div>
                  <div className="text-xs text-slate-600">Avg Daily Rate</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <Building2 className="w-5 h-5 mx-auto mb-1 text-amber-600" />
                  <div className="text-2xl font-bold text-slate-900">
                    {marketData.metrics.totalListings.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-600">Total Listings</div>
                </div>
              </div>

              {/* YoY Trend */}
              <div className="flex items-center justify-center gap-4 p-3 bg-slate-100 rounded-lg">
                <span className="text-sm text-slate-600">Year-over-Year Revenue:</span>
                <div className={`flex items-center gap-1 font-medium ${
                  marketData.historicalData.yoyChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {getTrendIcon(marketData.historicalData.trend)}
                  {marketData.historicalData.yoyChange >= 0 ? '+' : ''}
                  {marketData.historicalData.yoyChange.toFixed(1)}%
                </div>
                <Badge variant="outline" className="capitalize">
                  {marketData.historicalData.trend}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Collapsible Sections */}
          
          {/* Market Scores */}
          <Card>
            <CardHeader 
              className="cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => toggleSection('scores')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Market Scores
                </CardTitle>
                {expandedSections.scores ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </CardHeader>
            {expandedSections.scores && (
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Market Score', value: marketData.scores.marketScore, description: 'Overall market health' },
                    { label: 'Investability', value: marketData.scores.investabilityScore, description: 'Investment potential' },
                    { label: 'Rental Demand', value: marketData.scores.rentalDemandScore, description: 'Guest demand level' },
                    { label: 'Revenue Growth', value: marketData.scores.revenueGrowthScore, description: 'Revenue trend' },
                    { label: 'Seasonality', value: marketData.scores.seasonalityScore, description: 'Revenue stability' },
                    { label: 'Regulation', value: marketData.scores.regulationScore, description: 'Regulatory environment' },
                  ].map((score) => {
                    // Handle decimal values - if value is less than 1, it's likely a decimal that should be a percentage
                    const displayValue = score.value < 1 && score.value > 0 ? Math.round(score.value * 100) : Math.round(score.value);
                    const barWidth = Math.min(100, Math.max(0, displayValue));
                    return (
                      <div key={score.label} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-700">{score.label}</span>
                          <Badge className={getScoreColor(displayValue)}>{displayValue}</Badge>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              displayValue >= 80 ? 'bg-green-500' :
                              displayValue >= 60 ? 'bg-amber-500' :
                              displayValue >= 40 ? 'bg-orange-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{score.description}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Revenue by Bedroom */}
          {marketData.revenueByBedroom && marketData.revenueByBedroom.length > 0 && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('metrics')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Home className="w-5 h-5 text-purple-600" />
                    Revenue by Property Size
                  </CardTitle>
                  {expandedSections.metrics ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.metrics && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Bedrooms</th>
                          <th className="text-right py-2 px-3">Avg Revenue</th>
                          <th className="text-right py-2 px-3">Occupancy</th>
                          <th className="text-right py-2 px-3">ADR</th>
                          <th className="text-right py-2 px-3">Listings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketData.revenueByBedroom
                          .filter((br: any) => {
                            if (bedroomFilter === 'all') return true;
                            if (bedroomFilter === '5') return br.bedrooms >= 5;
                            return br.bedrooms === parseInt(bedroomFilter);
                          })
                          .map((br: any) => (
                          <tr key={br.bedrooms} className="border-b hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium">{br.bedrooms} BR</td>
                            <td className="text-right py-2 px-3 text-green-600 font-medium">
                              {formatCurrency(br.avgRevenue)}
                            </td>
                            <td className="text-right py-2 px-3">{formatPercent(br.avgOccupancy)}</td>
                            <td className="text-right py-2 px-3">{formatCurrency(br.avgAdr)}</td>
                            <td className="text-right py-2 px-3 text-slate-500">
                              {br.listingCount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Historical Data - 5 Year Summary */}
          {marketData.historicalData?.yearlySummary && marketData.historicalData.yearlySummary.length > 0 && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('historical')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600" />
                    5-Year Historical Summary
                  </CardTitle>
                  {expandedSections.historical ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.historical && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Year</th>
                          <th className="text-right py-2 px-3">Avg Revenue</th>
                          <th className="text-right py-2 px-3">YoY Change</th>
                          <th className="text-right py-2 px-3">Occupancy</th>
                          <th className="text-right py-2 px-3">ADR</th>
                          <th className="text-right py-2 px-3">Listings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketData.historicalData.yearlySummary.map((year: any) => (
                          <tr key={year.year} className="border-b hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium">{year.year}</td>
                            <td className="text-right py-2 px-3 text-green-600 font-medium">
                              {formatCurrency(year.avgRevenue)}
                            </td>
                            <td className={`text-right py-2 px-3 font-medium ${
                              year.yoyRevenueChange === undefined ? 'text-slate-400' :
                              year.yoyRevenueChange >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {year.yoyRevenueChange !== undefined 
                                ? `${year.yoyRevenueChange >= 0 ? '+' : ''}${year.yoyRevenueChange.toFixed(1)}%`
                                : '-'
                              }
                            </td>
                            <td className="text-right py-2 px-3">{formatPercent(year.avgOccupancy)}</td>
                            <td className="text-right py-2 px-3">{formatCurrency(year.avgAdr)}</td>
                            <td className="text-right py-2 px-3 text-slate-500">
                              {year.avgListingCount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Booking Patterns & Supply Trend */}
          {(marketData.bookingPatterns || marketData.supplyTrend) && (
            <div className="grid md:grid-cols-2 gap-4">
              {marketData.bookingPatterns && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      Booking Patterns
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Avg Lead Time</span>
                      <span className="font-medium">{marketData.bookingPatterns.avgLeadTimeDays} days</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Last-Minute Bookings</span>
                      <span className="font-medium">{marketData.bookingPatterns.lastMinutePercent}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Avg Stay Length</span>
                      <span className="font-medium">{marketData.bookingPatterns.avgLengthOfStay} nights</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Weekend Stays</span>
                      <span className="font-medium">{marketData.bookingPatterns.weekendPercent}%</span>
                    </div>
                    {marketData.bookingPatterns.insights && marketData.bookingPatterns.insights.length > 0 && (
                      <div className="pt-2 border-t">
                        {marketData.bookingPatterns.insights.map((insight: string, i: number) => (
                          <p key={i} className="text-xs text-slate-500 mt-1">{insight}</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {marketData.supplyTrend && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      Supply Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Current Listings</span>
                      <span className="font-medium">{marketData.supplyTrend.currentListings.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">12 Months Ago</span>
                      <span className="font-medium">{marketData.supplyTrend.listings12MonthsAgo.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Net Change</span>
                      <span className={`font-medium ${marketData.supplyTrend.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {marketData.supplyTrend.netChange >= 0 ? '+' : ''}{marketData.supplyTrend.netChange.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Trend</span>
                      <Badge variant="outline" className="capitalize">
                        {getTrendIcon(marketData.supplyTrend.trend)}
                        <span className="ml-1">{marketData.supplyTrend.trend}</span>
                      </Badge>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-slate-500">{marketData.supplyTrend.insight}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Top Performers */}
          {marketData.topPerformers && marketData.topPerformers.length > 0 && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('topPerformers')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    Top Performers ({marketData.topPerformers.length})
                  </CardTitle>
                  {expandedSections.topPerformers ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.topPerformers && (
                <CardContent>
                  <div className="space-y-3">
                    {marketData.topPerformers
                      .filter((performer: any) => {
                        if (bedroomFilter === 'all') return true;
                        if (bedroomFilter === '5') return performer.bedrooms >= 5;
                        return performer.bedrooms === parseInt(bedroomFilter);
                      })
                      .slice(0, 10)
                      .map((performer: any, index: number) => (
                      <div key={index} className="p-3 border rounded-lg hover:bg-slate-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900 line-clamp-1">
                              {index + 1}. {performer.title}
                            </div>
                            <div className="text-sm text-slate-500 mt-1">
                              {performer.bedrooms} BR / {performer.bathrooms} BA
                              {performer.propertyType && ` • ${performer.propertyType}`}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              {performer.isSuperhost && (
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                  Superhost
                                </Badge>
                              )}
                              {performer.isProfessionallyManaged && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                  Pro Managed
                                </Badge>
                              )}
                              {performer.rating > 0 && (
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  {performer.rating.toFixed(1)} ({performer.reviews} reviews)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {formatCurrency(performer.revenue)}
                            </div>
                            <div className="text-xs text-slate-500">per year</div>
                            <div className="text-sm text-slate-600 mt-1">
                              {formatPercent(performer.occupancy)} occ • {formatCurrency(performer.adr)}/night
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Cancellation Policies */}
          {marketData.cancellationPolicies && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('cancellationPolicies')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Cancellation Policies
                  </CardTitle>
                  {expandedSections.cancellationPolicies ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.cancellationPolicies && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {marketData.cancellationPolicies.policies.slice(0, 5).map((policy: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium capitalize">{policy.policy.replace(/_/g, ' ')}</div>
                          <div className="text-sm text-slate-500">{policy.count} listings ({policy.percentage}%)</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-green-600">{formatCurrency(policy.avgRevenue)}/yr</div>
                          <div className="text-xs text-slate-500">{formatPercent(policy.avgOccupancy)} occ</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {marketData.cancellationPolicies.recommendation && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-800">{marketData.cancellationPolicies.recommendation}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* Professional Stats */}
          {marketData.professionalStats && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('professionalStats')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-500" />
                    Host Competition Analysis
                  </CardTitle>
                  {expandedSections.professionalStats ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.professionalStats && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-700">{marketData.professionalStats.professionalPercentage}%</div>
                      <div className="text-sm text-blue-600">Professionally Managed</div>
                      <div className="text-xs text-blue-500 mt-1">{marketData.professionalStats.professionalCount} listings</div>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-700">{marketData.professionalStats.superhostPercentage}%</div>
                      <div className="text-sm text-amber-600">Superhosts</div>
                      <div className="text-xs text-amber-500 mt-1">{marketData.professionalStats.superhostCount} listings</div>
                    </div>
                  </div>
                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Avg Revenue (Professional)</span>
                      <span className="font-medium text-green-600">{formatCurrency(marketData.professionalStats.avgRevenueProfessional)}/yr</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Avg Revenue (Individual)</span>
                      <span className="font-medium">{formatCurrency(marketData.professionalStats.avgRevenueIndividual)}/yr</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Professional Premium</span>
                      <Badge variant="outline" className={marketData.professionalStats.revenuePremiumPercent > 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                        {marketData.professionalStats.revenuePremiumPercent > 0 ? '+' : ''}{marketData.professionalStats.revenuePremiumPercent}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Future Pricing */}
          {marketData.futurePricing && marketData.futurePricing.length > 0 && (
            <Card>
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection('futurePricing')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                    Forward-Looking Pricing (Next 6 Months)
                  </CardTitle>
                  {expandedSections.futurePricing ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CardHeader>
              {expandedSections.futurePricing && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-slate-600">Month</th>
                          <th className="text-right py-2 font-medium text-slate-600">ADR</th>
                          <th className="text-right py-2 font-medium text-slate-600">ADR Range</th>
                          <th className="text-right py-2 font-medium text-slate-600">Occupancy</th>
                          <th className="text-right py-2 font-medium text-slate-600">Supply</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketData.futurePricing.slice(0, 30).filter((_: any, i: number) => i % 5 === 0).map((pricing: any, index: number) => (
                          <tr key={index} className="border-b last:border-b-0">
                            <td className="py-2 font-medium">
                              {new Date(pricing.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="py-2 text-right text-green-600 font-medium">
                              {formatCurrency(pricing.adr)}
                            </td>
                            <td className="py-2 text-right text-slate-500 text-xs">
                              {formatCurrency(pricing.adrPercentile25)} - {formatCurrency(pricing.adrPercentile75)}
                            </td>
                            <td className="py-2 text-right">
                              {formatPercent(pricing.occupancy * 100)}
                            </td>
                            <td className="py-2 text-right text-slate-500">
                              {pricing.supply.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* AI Analysis Result */}
          {marketAdvice && (
            <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
              <CardHeader>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">AI Analysis Complete</span>
                </div>
                <CardTitle className="flex items-center gap-2 text-xl mt-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Comprehensive Market Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-slate max-w-none">
                  <Streamdown>{marketAdvice}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate New Analysis Button */}
          {marketAdvice && (
            <Button
              onClick={() => {
                setMarketAdvice(null);
                setMarketData(null);
                setSelectedMarket(null);
                setSearchQuery('');
              }}
              variant="outline"
              className="w-full"
            >
              Analyze a Different Market
            </Button>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default StandaloneMarketAdvisor;
