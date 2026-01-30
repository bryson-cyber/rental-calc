/**
 * StandaloneMarketAdvisor Component
 * 
 * DESIGN: Coach Inayah Brand - Premium Property Investment Aesthetic
 * - Gold (#D4A84B) accents on light backgrounds
 * - Near-white backgrounds (oklch(0.99 0 0))
 * - Subtle shadows and refined borders
 * - No green backgrounds - use gold/amber for success states
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  TrendingUp, 
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Streamdown } from 'streamdown';
import { trpc } from '@/lib/trpc';
import { useMarketAdvisorFilters } from '@/contexts/PropertyContext';

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
  // Use context for bedroom filter to persist across component remounts
  const {
    filters,
    setBedroomFilter,
  } = useMarketAdvisorFilters();
  
  const bedroomFilter = filters.bedroomFilter || 'all';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MarketSearchResult[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<{ id: string; name: string; type: 'market' | 'submarket' | 'zipcode' } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [marketAdvice, setMarketAdvice] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<any>(null);
  const [showTopPerformers, setShowTopPerformers] = useState(true);
  
  const [analysisProgress, setAnalysisProgress] = useState<{
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
  const [justSelected, setJustSelected] = useState(false);

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
      if (!justSelected) {
        setShowResults(true);
      }
    }
  }, [searchMarketsMutation.data, justSelected]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setJustSelected(false);
    setSearchQuery(value);
    if (value.length < 2) {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleMarketSelect = async (market: MarketSearchResult) => {
    setJustSelected(true);
    setSelectedMarket({
      id: market.id,
      name: market.name,
      type: market.type,
    });
    setSearchQuery(market.name);
    setShowResults(false);
    setSearchResults([]);
    
    if (onMarketSelect) {
      onMarketSelect(market.id, market.name);
    }
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

  // Handle re-analyze with current filters
  const handleReanalyze = () => {
    setMarketAdvice(null);
    setMarketData(null);
    // Automatically trigger new analysis
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

  return (
    <div className="space-y-6">
      {/* Search Section - Brand styled */}
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
                className="pl-10 py-6 text-lg input-apple"
              />
              
              {/* Search Results Dropdown */}
              <AnimatePresence>
                {showResults && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-50 w-full mt-2 bg-card rounded-lg shadow-lg border border-border max-h-80 overflow-y-auto"
                  >
                    {searchResults.map((market) => (
                      <button
                        key={market.id}
                        onClick={() => handleMarketSelect(market)}
                        className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center justify-between border-b border-border last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-primary" />
                          <div>
                            <div className="font-medium text-foreground">{market.name}</div>
                            <div className="text-sm text-muted-foreground">{market.location_name}</div>
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {market.listing_count?.toLocaleString()} rentals
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Re-analyze button next to search - only show when we have results */}
            {marketData && (
              <Button
                onClick={handleReanalyze}
                disabled={standaloneMarketAdvisorMutation.isPending}
                className="btn-gold px-6 whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-analyze
              </Button>
            )}
          </div>

          {/* Bedroom Filter */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground">Property Size:</label>
              <select
                value={bedroomFilter}
                onChange={(e) => setBedroomFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg bg-card text-sm focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
              >
                <option value="all">All Sizes</option>
                <option value="0">Studio</option>
                <option value="1">1 Bedroom</option>
                <option value="2">2 Bedrooms</option>
                <option value="3">3 Bedrooms</option>
                <option value="4">4 Bedrooms</option>
                <option value="5">5+ Bedrooms</option>
              </select>
            </div>

            {bedroomFilter !== 'all' && (
              <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                Filtering: {bedroomFilter === '0' ? 'Studios' : `${bedroomFilter} BR`}
              </Badge>
            )}
          </div>

          {/* Selected Market Display */}
          {selectedMarket && !marketAdvice && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <div>
                    <div className="font-medium text-foreground">{selectedMarket.name}</div>
                    <div className="text-sm text-muted-foreground">Ready to analyze</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generate Button */}
          {selectedMarket && !marketAdvice && (
            <div className="space-y-4">
              <Button
                data-market-button
                onClick={handleGenerateAnalysis}
                disabled={standaloneMarketAdvisorMutation.isPending}
                className="w-full btn-gold py-6 text-lg"
              >
                {standaloneMarketAdvisorMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {analysisProgress.message}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Tell Me About This Market
                  </>
                )}
              </Button>
              
              {/* Progress Steps */}
              {standaloneMarketAdvisorMutation.isPending && (
                <div className="rounded-lg p-4 border bg-muted/50 border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Analyzing Market...</span>
                    <span className="text-xs ml-auto font-mono text-muted-foreground">
                      {analysisProgress.elapsedSeconds > 0 ? `${analysisProgress.elapsedSeconds}s` : '~30-60 seconds'}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {analysisProgress.steps.map((step, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          index < analysisProgress.step
                            ? 'bg-primary'
                            : index === analysisProgress.step
                            ? 'bg-primary'
                            : 'bg-muted'
                        }`}>
                          {index < analysisProgress.step ? (
                            <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                          ) : index === analysisProgress.step ? (
                            <Loader2 className="w-3 h-3 text-primary-foreground animate-spin" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                          )}
                        </div>
                        <span className={`text-sm ${
                          index < analysisProgress.step
                            ? 'text-primary line-through'
                            : index === analysisProgress.step
                            ? 'text-foreground font-medium'
                            : 'text-muted-foreground'
                        }`}>
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
          {/* Data Credibility Badge - Brand styled with gold */}
          <div className="bg-gradient-to-r from-primary via-primary to-primary/90 rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Left: Verified Badge */}
              <div className="flex items-center gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                  <Shield className="w-10 h-10 text-primary-foreground" />
                </div>
                <div className="text-primary-foreground">
                  <div className="text-2xl font-bold tracking-tight">Verified Market Analysis</div>
                  <div className="text-primary-foreground/80 text-sm">Data you can trust for your investment decisions</div>
                </div>
              </div>
              
              {/* Right: Stats */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-2 text-primary-foreground">
                    <Database className="w-5 h-5" />
                    <span className="text-3xl font-bold">{marketData.metrics.totalListings?.toLocaleString() || marketData.topPerformers?.length || '100+'}</span>
                  </div>
                  <div className="text-primary-foreground/80 text-sm font-medium">Verified Properties</div>
                </div>
                <div className="w-px h-12 bg-primary-foreground/30" />
                <div className="text-center">
                  <div className="flex items-center gap-2 text-primary-foreground">
                    <Clock className="w-5 h-5" />
                    <span className="text-3xl font-bold">5</span>
                  </div>
                  <div className="text-primary-foreground/80 text-sm font-medium">Years of Data</div>
                </div>
                <div className="w-px h-12 bg-primary-foreground/30" />
                <div className="text-center">
                  <div className="flex items-center gap-2 text-primary-foreground">
                    <Shield className="w-5 h-5" />
                    <span className="text-3xl font-bold">Verified</span>
                  </div>
                  <div className="text-primary-foreground/80 text-sm font-medium">Real Market Data</div>
                </div>
              </div>
            </div>
            
            {/* Bedroom filter indicator */}
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
            <h2 className="text-3xl font-bold text-foreground">{marketData.market.name}</h2>
            <p className="text-muted-foreground mt-1">{marketData.market.city}, {marketData.market.state}</p>
          </div>

          {/* AI ANALYSIS - PRIMARY CONTENT - Brand styled */}
          {marketAdvice && (
            <Card className="apple-card border-2 border-primary/20">
              <CardContent className="pt-6">
                <div className="prose prose-slate max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground">
                  <Streamdown>{marketAdvice}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TOP PERFORMERS - The only data section we keep */}
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
                      These are the highest-earning properties in this market. Click to see what success looks like!
                    </CardDescription>
                  </div>
                  {showTopPerformers ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </div>
              </CardHeader>
              {showTopPerformers && (
                <CardContent>
                  <div className="space-y-4">
                    {marketData.topPerformers
                      .filter((performer: any) => {
                        if (bedroomFilter === 'all') return true;
                        if (bedroomFilter === '5') return performer.bedrooms >= 5;
                        return performer.bedrooms === parseInt(bedroomFilter);
                      })
                      .slice(0, 10)
                      .map((performer: any, index: number) => (
                      <div key={index} className="p-4 border border-border rounded-xl hover:bg-muted/30 transition-colors hover:shadow-md">
                        <div className="flex gap-4">
                          {/* Listing Photo */}
                          {performer.imageUrl ? (
                            <a 
                              href={performer.airbnbUrl || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex-shrink-0"
                              onClick={(e) => !performer.airbnbUrl && e.preventDefault()}
                            >
                              <img 
                                src={performer.imageUrl} 
                                alt={performer.title}
                                className="w-28 h-28 object-cover rounded-lg shadow-sm hover:shadow-md transition-shadow"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </a>
                          ) : (
                            <div className="w-28 h-28 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                              <Home className="w-10 h-10 text-muted-foreground/50" />
                            </div>
                          )}
                          
                          {/* Listing Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-foreground text-lg">
                                  <span className="text-primary mr-2">#{index + 1}</span>
                                  {performer.airbnbUrl ? (
                                    <a 
                                      href={performer.airbnbUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-primary hover:text-primary/80 hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {performer.title}
                                      <ArrowUpRight className="w-4 h-4 inline ml-1" />
                                    </a>
                                  ) : (
                                    <span className="line-clamp-1">{performer.title}</span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {performer.bedrooms === 0 ? 'Studio' : `${performer.bedrooms} Bedroom${performer.bedrooms > 1 ? 's' : ''}`} • {performer.bathrooms} Bath{performer.bathrooms > 1 ? 's' : ''}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-xl font-bold text-primary">
                                  {formatCurrency(performer.revenue)}
                                </div>
                                <div className="text-sm text-muted-foreground">per year</div>
                              </div>
                            </div>
                            
                            {/* Badges */}
                            <div className="flex items-center flex-wrap gap-2 mt-3">
                              {performer.isSuperhost && (
                                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                  Superhost
                                </Badge>
                              )}
                              {performer.rating > 0 && (
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Star className="w-4 h-4 fill-primary text-primary" />
                                  {performer.rating.toFixed(1)} ({performer.reviews} reviews)
                                </span>
                              )}
                              <span className="text-sm text-muted-foreground">
                                {formatPercent(performer.occupancy)} booked • {formatCurrency(performer.adr)}/night
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm text-foreground">
                      <strong>Why this matters:</strong> These top performers show you what's possible in this market. 
                      Study their listings - look at their photos, amenities, and pricing - to understand what guests are willing to pay for.
                    </p>
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

export default StandaloneMarketAdvisor;
