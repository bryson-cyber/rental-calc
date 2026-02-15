/**
 * Market Advisor Page
 * 
 * Standalone page for comprehensive market analysis.
 * Users can search for any market, city, or zip code and get
 * AI-powered analysis with 5 years of historical data.
 * Now includes market comparison feature!
 * 
 * DESIGN: Coach Inayah Brand - Premium Property Investment Aesthetic
 * - Gold (#D4A84B) accents on light backgrounds
 * - Near-white backgrounds (oklch(0.99 0 0))
 * - Subtle shadows and refined borders
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useSearch } from 'wouter';
import { 
  ArrowLeft,
  TrendingUp,
  BarChart3,
  Plus,
  X,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StandaloneMarketAdvisor } from '@/components/StandaloneMarketAdvisor';
import { MarketComparison, ComparisonBar, type MarketComparisonData } from '@/components/MarketComparison';
import { SharePageButton } from '@/components/SharePageButton';
import { AnimatePresence } from 'framer-motion';
import { useReportMode } from '@/contexts/ReportModeContext';

export default function MarketAdvisor() {
  const [comparisonMarkets, setComparisonMarkets] = useState<MarketComparisonData[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [currentMarket, setCurrentMarket] = useState<{ id: string; name: string } | null>(null);
  
  // Parse URL parameters for sharing
  const searchString = useSearch();
  const [initialMarket, setInitialMarket] = useState<string | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(searchString || window.location.search);
    const marketName = params.get('market');
    const marketId = params.get('marketId');
    if (marketName) {
      setInitialMarket(marketName);
    }
  }, [searchString]);

  const handleAddToCompare = (marketData: any) => {
    // Check if market already exists in comparison
    if (comparisonMarkets.some(m => m.id === marketData.market.id)) {
      return;
    }

    // Max 3 markets
    if (comparisonMarkets.length >= 3) {
      // Remove oldest and add new
      setComparisonMarkets(prev => [
        ...prev.slice(1),
        {
          id: marketData.market.id,
          name: marketData.market.name,
          city: marketData.market.city,
          state: marketData.market.state,
          metrics: {
            avgRevenue: marketData.metrics.avgRevenue || 0,
            avgAdr: marketData.metrics.avgAdr || 0,
            avgOccupancy: marketData.metrics.avgOccupancy || 0,
            totalListings: marketData.metrics.totalListings || 0,
            marketScore: marketData.metrics.marketScore,
            investabilityScore: marketData.metrics.investabilityScore,
            seasonalityVariance: marketData.metrics.seasonalityVariance,
          },
          grade: marketData.grade,
          topPerformer: marketData.topPerformers?.[0] ? {
            title: marketData.topPerformers[0].title,
            revenue: marketData.topPerformers[0].annual_revenue || marketData.topPerformers[0].revenue,
            occupancy: marketData.topPerformers[0].occupancy,
            adr: marketData.topPerformers[0].adr,
          } : undefined,
        }
      ]);
    } else {
      setComparisonMarkets(prev => [
        ...prev,
        {
          id: marketData.market.id,
          name: marketData.market.name,
          city: marketData.market.city,
          state: marketData.market.state,
          metrics: {
            avgRevenue: marketData.metrics.avgRevenue || 0,
            avgAdr: marketData.metrics.avgAdr || 0,
            avgOccupancy: marketData.metrics.avgOccupancy || 0,
            totalListings: marketData.metrics.totalListings || 0,
            marketScore: marketData.metrics.marketScore,
            investabilityScore: marketData.metrics.investabilityScore,
            seasonalityVariance: marketData.metrics.seasonalityVariance,
          },
          grade: marketData.grade,
          topPerformer: marketData.topPerformers?.[0] ? {
            title: marketData.topPerformers[0].title,
            revenue: marketData.topPerformers[0].annual_revenue || marketData.topPerformers[0].revenue,
            occupancy: marketData.topPerformers[0].occupancy,
            adr: marketData.topPerformers[0].adr,
          } : undefined,
        }
      ]);
    }
  };

  const handleRemoveFromCompare = (marketId: string) => {
    setComparisonMarkets(prev => prev.filter(m => m.id !== marketId));
    if (comparisonMarkets.length <= 1) {
      setShowComparison(false);
    }
  };

  const handleClearAll = () => {
    setComparisonMarkets([]);
    setShowComparison(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Light theme with gold accent */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Tools
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground">Market Advisor</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Share Button */}
              <SharePageButton
                pagePath="/market-advisor"
                params={{
                  market: currentMarket?.name,
                  marketId: currentMarket?.id,
                }}
                shareDescription={currentMarket ? `Market Advisor analysis for ${currentMarket.name}` : 'Market Advisor'}
                variant="outline"
                size="sm"
              />
              
              {/* Comparison Toggle */}
              {comparisonMarkets.length > 0 && (
                <Button
                  onClick={() => setShowComparison(!showComparison)}
                  variant={showComparison ? "default" : "outline"}
                  size="sm"
                  className={showComparison ? "btn-gold" : ""}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Compare ({comparisonMarkets.length})
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Market Comparison Section */}
            <AnimatePresence>
              {showComparison && comparisonMarkets.length > 0 && (
                <MarketComparison
                  markets={comparisonMarkets}
                  onRemoveMarket={handleRemoveFromCompare}
                  onClearAll={handleClearAll}
                />
              )}
            </AnimatePresence>

            {/* Market Advisor with Add to Compare callback */}
            <StandaloneMarketAdvisorWithCompare 
              onAddToCompare={handleAddToCompare}
              comparisonMarkets={comparisonMarkets}
              onMarketChange={useCallback((market: { id: string; name: string } | null) => setCurrentMarket(market), [])}
              initialMarketName={initialMarket}
            />
          </div>
        </div>
      </main>

      {/* Floating Comparison Bar */}
      <AnimatePresence>
        {comparisonMarkets.length > 0 && !showComparison && (
          <ComparisonBar
            markets={comparisonMarkets}
            onRemoveMarket={handleRemoveFromCompare}
            onCompare={() => setShowComparison(true)}
          />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="text-center text-sm text-muted-foreground">
            <p>Powered by verified market data</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Extended StandaloneMarketAdvisor with comparison support
import { useState as useStateLocal, useEffect as useEffectLocal } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Loader2, 
  Search,
  MapPin,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Home,
  Star,
  ArrowUpRight,
  RefreshCw,
  ServerCrash,
  Shield,
  Database,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LightMarkdown } from '@/components/LightMarkdown';
import { trpc } from '@/lib/trpc';
import { useMarketAdvisorFilters } from '@/contexts/PropertyContext';

interface StandaloneMarketAdvisorWithCompareProps {
  onAddToCompare: (marketData: any) => void;
  comparisonMarkets: MarketComparisonData[];
  onMarketChange?: (market: { id: string; name: string } | null) => void;
  initialMarketName?: string | null;
}

function StandaloneMarketAdvisorWithCompare({ onAddToCompare, comparisonMarkets, onMarketChange, initialMarketName }: StandaloneMarketAdvisorWithCompareProps) {
  const { mode: reportMode } = useReportMode();
  const {
    filters,
    setBedroomFilter,
  } = useMarketAdvisorFilters();
  
  const bedroomFilter = filters.bedroomFilter || 'all';
  
  const [searchQuery, setSearchQuery] = useStateLocal('');
  const [searchResults, setSearchResults] = useStateLocal<any[]>([]);
  const [selectedMarket, setSelectedMarket] = useStateLocal<{ id: string; name: string; type: 'market' | 'submarket' | 'zipcode' } | null>(null);
  const [showResults, setShowResults] = useStateLocal(false);
  const [marketAdvice, setMarketAdvice] = useStateLocal<string | null>(null);
  const [marketData, setMarketData] = useStateLocal<any>(null);
  const [showTopPerformers, setShowTopPerformers] = useStateLocal(true);
  
  const [analysisProgress, setAnalysisProgress] = useStateLocal<{
    step: number;
    message: string;
    steps: string[];
    startTime: number | null;
    elapsedSeconds: number;
  }>({
    step: 0,
    message: '',
    steps: [
      'Connecting to data sources...',
      'Analyzing 5 years of market history...',
      'Finding top performing properties...',
      'Generating your personalized report...',
      'Almost done...'
    ],
    startTime: null,
    elapsedSeconds: 0
  });
  const [justSelected, setJustSelected] = useStateLocal(false);

  const searchMarketsMutation = trpc.rental.searchMarkets.useQuery(
    { searchTerm: searchQuery, limit: 10 },
    { enabled: searchQuery.length >= 2 }
  );

  const standaloneMarketAdvisorMutation = trpc.advanced.standaloneMarketAdvisor.useMutation();

  useEffectLocal(() => {
    if (searchMarketsMutation.data?.success && searchMarketsMutation.data.data) {
      setSearchResults(searchMarketsMutation.data.data);
      if (!justSelected) {
        setShowResults(true);
      }
    }
  }, [searchMarketsMutation.data, justSelected]);
  
  // Notify parent when market changes
  useEffectLocal(() => {
    if (onMarketChange && selectedMarket) {
      onMarketChange({ id: selectedMarket.id, name: selectedMarket.name });
    }
  }, [selectedMarket, onMarketChange]);
  
  // Handle initial market from URL params
  useEffectLocal(() => {
    if (initialMarketName && !searchQuery) {
      setSearchQuery(initialMarketName);
    }
  }, [initialMarketName]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setJustSelected(false);
    setSearchQuery(value);
    if (value.length < 2) {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleMarketSelect = async (market: any) => {
    setJustSelected(true);
    setSelectedMarket({
      id: market.id,
      name: market.name,
      type: market.type,
    });
    setSearchQuery(market.name);
    setShowResults(false);
    setSearchResults([]);
  };

  const handleGenerateAnalysis = async () => {
    if (!selectedMarket) return;
    
    setShowResults(false);
    
    const startTime = Date.now();
    
    setAnalysisProgress(prev => ({ 
      ...prev, 
      step: 0, 
      message: prev.steps[0], 
      startTime, 
      elapsedSeconds: 0
    }));
    
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        const elapsed = Math.floor((Date.now() - (prev.startTime || startTime)) / 1000);
        const nextStep = Math.min(prev.step + 1, prev.steps.length - 1);
        return { 
          ...prev, 
          step: nextStep, 
          message: prev.steps[nextStep],
          elapsedSeconds: elapsed
        };
      });
    }, 8000);
    
    const elapsedInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (!prev.startTime) return prev;
        const elapsed = Math.floor((Date.now() - prev.startTime) / 1000);
        return { ...prev, elapsedSeconds: elapsed };
      });
    }, 1000);
    
    try {
      const result = await standaloneMarketAdvisorMutation.mutateAsync({
        marketId: selectedMarket.id,
        marketType: selectedMarket.type,
        bedrooms: bedroomFilter !== 'all' ? parseInt(bedroomFilter) : undefined,
        listingType: 'entire_home',
        reportMode,
      });
      
      clearInterval(progressInterval);
      clearInterval(elapsedInterval);
      setAnalysisProgress(prev => ({ ...prev, step: prev.steps.length - 1, message: 'Complete!', startTime: null, elapsedSeconds: 0 }));
      
      if (result.success && result.data) {
        setMarketData(result.data);
        setMarketAdvice(result.data.advice);
      }
    } catch (error) {
      clearInterval(progressInterval);
      clearInterval(elapsedInterval);
      setAnalysisProgress(prev => ({ ...prev, step: 0, message: '', startTime: null, elapsedSeconds: 0 }));
      console.error('Error generating market analysis:', error);
    }
  };

  const handleReanalyze = () => {
    setMarketAdvice(null);
    setMarketData(null);
    setTimeout(() => {
      handleGenerateAnalysis();
    }, 100);
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

  const isInComparison = marketData && comparisonMarkets.some(m => m.id === marketData.market?.id);

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card className="apple-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-foreground">
            <TrendingUp className="w-5 h-5 text-primary" />
            Market Advisor
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Type any city, neighborhood, or zip code to find out if it's a good place to invest
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Market Search Input with Re-analyze button */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Try: Miami, Denver, 90210, or any city..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                className="pl-10 input-apple"
              />
              
              {/* Search Results Dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                  {searchResults.map((market: any) => (
                    <button
                      key={market.id}
                      onClick={() => handleMarketSelect(market)}
                      className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 border-b border-border last:border-0"
                    >
                      <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{market.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {market.location_name} • {market.listing_count?.toLocaleString() || '0'} listings
                        </div>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0">
                        {market.type}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Re-analyze button - shows when we have results */}
            {marketData && (
              <Button
                onClick={handleReanalyze}
                variant="outline"
                className="btn-outline-light flex-shrink-0"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-analyze
              </Button>
            )}
          </div>

          {/* Bedroom Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filter by bedrooms:</span>
            {['all', '0', '1', '2', '3', '4', '5+'].map((option) => (
              <Button
                key={option}
                variant={bedroomFilter === option ? "default" : "outline"}
                size="sm"
                onClick={() => setBedroomFilter(option)}
                className={bedroomFilter === option ? "btn-gold" : "btn-outline-light"}
              >
                {option === 'all' ? 'All' : option === '0' ? 'Studio' : `${option} BR`}
              </Button>
            ))}
          </div>

          {/* Selected Market & Generate Button */}
          {selectedMarket && !marketData && (
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/20">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-medium text-foreground">{selectedMarket.name}</div>
                  <div className="text-sm text-muted-foreground">Ready to analyze</div>
                </div>
              </div>
              <Button
                onClick={handleGenerateAnalysis}
                disabled={standaloneMarketAdvisorMutation.isPending}
                className="btn-gold"
              >
                {standaloneMarketAdvisorMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Tell Me About This Market
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Loading State */}
          {standaloneMarketAdvisorMutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-primary/5 border border-primary/20 rounded-xl"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">{analysisProgress.message}</div>
                  <div className="text-sm text-muted-foreground">
                    {analysisProgress.elapsedSeconds > 0 && `${analysisProgress.elapsedSeconds}s elapsed`}
                  </div>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary rounded-full h-2 transition-all duration-500"
                  style={{ width: `${((analysisProgress.step + 1) / analysisProgress.steps.length) * 100}%` }}
                />
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {standaloneMarketAdvisorMutation.isError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-destructive/5 border border-destructive/20 rounded-xl"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <ServerCrash className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-destructive mb-1">Something went wrong</div>
                  <div className="text-sm text-destructive/80 mb-3">
                    We couldn't analyze this market right now. Please try again.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        standaloneMarketAdvisorMutation.reset();
                        handleGenerateAnalysis();
                      }}
                      size="sm"
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                    <Button
                      onClick={() => {
                        standaloneMarketAdvisorMutation.reset();
                        setSelectedMarket(null);
                        setSearchQuery('');
                      }}
                      size="sm"
                      variant="outline"
                      className="border-destructive/20 text-destructive hover:bg-destructive/5"
                    >
                      Try Different Market
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {marketData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Data Credibility Badge with Add to Compare */}
          <div className="bg-gradient-to-r from-primary via-primary to-primary/90 rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                  <Shield className="w-10 h-10 text-primary-foreground" />
                </div>
                <div className="text-primary-foreground">
                  <div className="text-2xl font-bold tracking-tight">Verified Market Analysis</div>
                  <div className="text-primary-foreground/80 text-sm">Data you can trust for your investment decisions</div>
                </div>
              </div>
              
              {/* Add to Compare Button */}
              <Button
                onClick={() => onAddToCompare(marketData)}
                disabled={isInComparison || comparisonMarkets.length >= 3}
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
              >
                {isInComparison ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Added to Compare
                  </>
                ) : comparisonMarkets.length >= 3 ? (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    Max 3 Markets
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Compare
                  </>
                )}
              </Button>
            </div>
            
            {/* Stats */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-primary-foreground/20">
              <div className="text-center">
                <div className="flex items-center gap-2 text-primary-foreground">
                  <Database className="w-5 h-5" />
                  <span className="text-2xl font-bold">{marketData.metrics?.totalListings?.toLocaleString() || '100+'}</span>
                </div>
                <div className="text-primary-foreground/80 text-sm font-medium">Verified Properties</div>
              </div>
              <div className="w-px h-10 bg-primary-foreground/30" />
              <div className="text-center">
                <div className="flex items-center gap-2 text-primary-foreground">
                  <Clock className="w-5 h-5" />
                  <span className="text-2xl font-bold">5</span>
                </div>
                <div className="text-primary-foreground/80 text-sm font-medium">Years of Data</div>
              </div>
            </div>
            
            {bedroomFilter !== 'all' && (
              <div className="mt-4 pt-4 border-t border-primary-foreground/20">
                <div className="flex items-center gap-2 text-primary-foreground">
                  <Home className="w-4 h-4" />
                  <span className="text-sm">
                    Filtered to show only <strong>{bedroomFilter === '0' ? 'Studios' : `${bedroomFilter} Bedroom`}</strong> properties
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Market Name Header */}
          <div className="text-center py-4">
            <h2 className="text-3xl font-bold text-foreground">{marketData.market?.name}</h2>
            <p className="text-muted-foreground mt-1">{marketData.market?.city}, {marketData.market?.state}</p>
          </div>

          {/* AI Analysis */}
          {marketAdvice && (
            <Card className="apple-card border-2 border-primary/20">
              <CardContent className="pt-6">
                <div className="prose prose-slate max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground">
                  <LightMarkdown>{marketAdvice}</LightMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Performers */}
          {marketData.topPerformers && marketData.topPerformers.length > 0 && (
            <Card className="apple-card">
              <CardHeader 
                className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl"
                onClick={() => setShowTopPerformers(!showTopPerformers)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl text-foreground">
                      <Star className="w-5 h-5 text-primary" />
                      See the Top Performers
                    </CardTitle>
                    <CardDescription className="mt-1 text-muted-foreground">
                      These are the highest-earning properties in this market
                    </CardDescription>
                  </div>
                  {showTopPerformers ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              {showTopPerformers && (
                <CardContent className="pt-0">
                  <div className="grid gap-4">
                    {marketData.topPerformers.slice(0, 10).map((performer: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 rounded-xl border border-border hover:border-primary/30 transition-colors bg-card"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary" className="bg-primary/10 text-primary">
                                #{index + 1}
                              </Badge>
                              <span className="font-semibold text-foreground truncate">
                                {performer.title || `Top Performer ${index + 1}`}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-muted-foreground">Revenue</div>
                                <div className="font-semibold text-foreground">
                                  {formatCurrency(performer.annual_revenue || performer.revenue)}/yr
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">ADR</div>
                                <div className="font-semibold text-foreground">
                                  {formatCurrency(performer.adr)}/night
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Occupancy</div>
                                <div className="font-semibold text-foreground">
                                  {formatPercent(performer.occupancy)}
                                </div>
                              </div>
                            </div>
                          </div>
                          {performer.listing_url && (
                            <a
                              href={performer.listing_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                            >
                              <ArrowUpRight className="w-4 h-4 text-primary" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* New Search Button */}
          <div className="flex justify-center">
            <Button
              onClick={() => {
                setMarketAdvice(null);
                setMarketData(null);
                setSelectedMarket(null);
                setSearchQuery('');
              }}
              variant="outline"
              className="btn-outline-light"
            >
              <Search className="w-4 h-4 mr-2" />
              Search a Different Market
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
