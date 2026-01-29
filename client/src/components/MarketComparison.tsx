/**
 * MarketComparison Component
 * 
 * DESIGN: Coach Inayah Brand - Premium Property Investment Aesthetic
 * - Gold (#D4A84B) accents on light backgrounds
 * - Side-by-side comparison of up to 3 markets
 * - Key metrics: Revenue, ADR, Occupancy, Market Score
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown,
  Minus,
  X,
  Plus,
  BarChart3,
  DollarSign,
  Percent,
  Home,
  Star,
  Trophy,
  Target,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface MarketComparisonData {
  id: string;
  name: string;
  city: string;
  state: string;
  metrics: {
    avgRevenue: number;
    avgAdr: number;
    avgOccupancy: number;
    totalListings: number;
    marketScore?: number;
    investabilityScore?: number;
    seasonalityVariance?: number;
  };
  grade?: {
    grade: string;
    score: number;
    description: string;
  };
  topPerformer?: {
    title: string;
    revenue: number;
    occupancy: number;
    adr: number;
  };
}

interface MarketComparisonProps {
  markets: MarketComparisonData[];
  onRemoveMarket: (marketId: string) => void;
  onClearAll: () => void;
  maxMarkets?: number;
}

export function MarketComparison({ 
  markets, 
  onRemoveMarket, 
  onClearAll,
  maxMarkets = 3 
}: MarketComparisonProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    revenue: true,
    performance: true,
    topPerformers: false,
  });

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

  // Find best/worst for each metric
  const getBestWorst = (metric: keyof MarketComparisonData['metrics']) => {
    const values = markets.map(m => m.metrics[metric] as number).filter(v => v !== undefined);
    if (values.length === 0) return { best: null, worst: null };
    return {
      best: Math.max(...values),
      worst: Math.min(...values),
    };
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'A-':
      case 'B+':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'B':
      case 'B-':
        return 'bg-lime-100 text-lime-700 border-lime-200';
      case 'C+':
      case 'C':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'C-':
      case 'D+':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const revenueBestWorst = getBestWorst('avgRevenue');
  const adrBestWorst = getBestWorst('avgAdr');
  const occupancyBestWorst = getBestWorst('avgOccupancy');

  if (markets.length === 0) {
    return null;
  }

  return (
    <Card className="apple-card border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl text-foreground">
              <BarChart3 className="w-5 h-5 text-primary" />
              Market Comparison
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Comparing {markets.length} market{markets.length > 1 ? 's' : ''} side-by-side
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            className="text-muted-foreground hover:text-destructive hover:border-destructive"
          >
            <X className="w-4 h-4 mr-1" />
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Market Headers */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${markets.length}, 1fr)` }}>
          {markets.map((market, index) => (
            <motion.div
              key={market.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                <button
                  onClick={() => onRemoveMarket(market.id)}
                  className="absolute -top-2 -right-2 p-1 bg-white rounded-full shadow-md hover:bg-red-50 transition-colors border border-border"
                >
                  <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </button>
                <div className="text-center">
                  <h3 className="font-bold text-lg text-foreground truncate">{market.name}</h3>
                  <p className="text-sm text-muted-foreground">{market.city}, {market.state}</p>
                  {market.grade && (
                    <Badge className={cn("mt-2", getGradeColor(market.grade.grade))}>
                      Grade: {market.grade.grade}
                    </Badge>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Revenue Metrics Section */}
        <div className="space-y-3">
          <button
            onClick={() => toggleSection('revenue')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Revenue & Pricing</span>
            </div>
            {expandedSections.revenue ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
          
          <AnimatePresence>
            {expandedSections.revenue && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${markets.length}, 1fr)` }}>
                  {markets.map((market) => (
                    <div key={market.id} className="space-y-3">
                      {/* Annual Revenue */}
                      <div className={cn(
                        "p-3 rounded-lg border",
                        market.metrics.avgRevenue === revenueBestWorst.best 
                          ? "bg-emerald-50 border-emerald-200" 
                          : market.metrics.avgRevenue === revenueBestWorst.worst && markets.length > 1
                            ? "bg-red-50 border-red-200"
                            : "bg-muted/30 border-border"
                      )}>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Revenue</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-foreground">
                            {formatCurrency(market.metrics.avgRevenue)}
                          </span>
                          {market.metrics.avgRevenue === revenueBestWorst.best && markets.length > 1 && (
                            <Trophy className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">per year</div>
                      </div>

                      {/* ADR */}
                      <div className={cn(
                        "p-3 rounded-lg border",
                        market.metrics.avgAdr === adrBestWorst.best 
                          ? "bg-emerald-50 border-emerald-200" 
                          : market.metrics.avgAdr === adrBestWorst.worst && markets.length > 1
                            ? "bg-red-50 border-red-200"
                            : "bg-muted/30 border-border"
                      )}>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Daily Rate</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-foreground">
                            {formatCurrency(market.metrics.avgAdr)}
                          </span>
                          {market.metrics.avgAdr === adrBestWorst.best && markets.length > 1 && (
                            <Trophy className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">per night</div>
                      </div>

                      {/* Occupancy */}
                      <div className={cn(
                        "p-3 rounded-lg border",
                        market.metrics.avgOccupancy === occupancyBestWorst.best 
                          ? "bg-emerald-50 border-emerald-200" 
                          : market.metrics.avgOccupancy === occupancyBestWorst.worst && markets.length > 1
                            ? "bg-red-50 border-red-200"
                            : "bg-muted/30 border-border"
                      )}>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Occupancy</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-foreground">
                            {formatPercent(market.metrics.avgOccupancy)}
                          </span>
                          {market.metrics.avgOccupancy === occupancyBestWorst.best && markets.length > 1 && (
                            <Trophy className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">average</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Performance Metrics Section */}
        <div className="space-y-3">
          <button
            onClick={() => toggleSection('performance')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Market Performance</span>
            </div>
            {expandedSections.performance ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
          
          <AnimatePresence>
            {expandedSections.performance && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${markets.length}, 1fr)` }}>
                  {markets.map((market) => (
                    <div key={market.id} className="space-y-3">
                      {/* Total Listings */}
                      <div className="p-3 rounded-lg border bg-muted/30 border-border">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Listings</div>
                        <div className="text-xl font-bold text-foreground">
                          {market.metrics.totalListings?.toLocaleString() || 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground">active properties</div>
                      </div>

                      {/* Market Score */}
                      {market.metrics.marketScore !== undefined && (
                        <div className="p-3 rounded-lg border bg-muted/30 border-border">
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Market Score</div>
                          <div className="text-xl font-bold text-foreground">
                            {market.metrics.marketScore}/100
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 mt-2">
                            <div 
                              className="bg-primary rounded-full h-2 transition-all"
                              style={{ width: `${market.metrics.marketScore}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Seasonality */}
                      {market.metrics.seasonalityVariance !== undefined && (
                        <div className="p-3 rounded-lg border bg-muted/30 border-border">
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Seasonality</div>
                          <div className="text-xl font-bold text-foreground">
                            {formatPercent(market.metrics.seasonalityVariance)}
                          </div>
                          <div className="text-xs text-muted-foreground">revenue variance</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Top Performers Section */}
        {markets.some(m => m.topPerformer) && (
          <div className="space-y-3">
            <button
              onClick={() => toggleSection('topPerformers')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">Top Performer in Each Market</span>
              </div>
              {expandedSections.topPerformers ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
            
            <AnimatePresence>
              {expandedSections.topPerformers && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${markets.length}, 1fr)` }}>
                    {markets.map((market) => (
                      <div key={market.id}>
                        {market.topPerformer ? (
                          <div className="p-4 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                            <div className="flex items-center gap-2 mb-2">
                              <Trophy className="w-4 h-4 text-primary" />
                              <span className="text-sm font-medium text-foreground truncate">
                                {market.topPerformer.title}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Revenue:</span>
                                <span className="font-semibold text-foreground">{formatCurrency(market.topPerformer.revenue)}/yr</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">ADR:</span>
                                <span className="font-semibold text-foreground">{formatCurrency(market.topPerformer.adr)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Occupancy:</span>
                                <span className="font-semibold text-foreground">{formatPercent(market.topPerformer.occupancy)}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg border border-dashed border-muted-foreground/30 text-center text-muted-foreground text-sm">
                            No top performer data
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Quick Summary */}
        {markets.length >= 2 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Quick Summary</span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {revenueBestWorst.best && (
                <p>
                  <span className="text-foreground font-medium">
                    {markets.find(m => m.metrics.avgRevenue === revenueBestWorst.best)?.name}
                  </span>
                  {' '}has the highest average revenue at{' '}
                  <span className="text-primary font-semibold">{formatCurrency(revenueBestWorst.best)}/year</span>
                </p>
              )}
              {occupancyBestWorst.best && (
                <p>
                  <span className="text-foreground font-medium">
                    {markets.find(m => m.metrics.avgOccupancy === occupancyBestWorst.best)?.name}
                  </span>
                  {' '}has the highest occupancy at{' '}
                  <span className="text-primary font-semibold">{formatPercent(occupancyBestWorst.best)}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Floating comparison bar component
interface ComparisonBarProps {
  markets: MarketComparisonData[];
  onRemoveMarket: (marketId: string) => void;
  onCompare: () => void;
  maxMarkets?: number;
}

export function ComparisonBar({ markets, onRemoveMarket, onCompare, maxMarkets = 3 }: ComparisonBarProps) {
  if (markets.length === 0) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-primary/20 p-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <span className="font-medium text-foreground">Compare Markets</span>
        </div>
        
        <div className="flex items-center gap-2">
          {markets.map((market) => (
            <div
              key={market.id}
              className="flex items-center gap-1 bg-primary/10 rounded-full px-3 py-1"
            >
              <span className="text-sm font-medium text-foreground truncate max-w-[100px]">
                {market.name}
              </span>
              <button
                onClick={() => onRemoveMarket(market.id)}
                className="p-0.5 hover:bg-primary/20 rounded-full transition-colors"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ))}
          
          {markets.length < maxMarkets && (
            <div className="flex items-center gap-1 border border-dashed border-muted-foreground/30 rounded-full px-3 py-1 text-muted-foreground text-sm">
              <Plus className="w-3 h-3" />
              Add market
            </div>
          )}
        </div>

        <Button
          onClick={onCompare}
          disabled={markets.length < 2}
          className="btn-gold"
        >
          Compare {markets.length} Markets
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
}
