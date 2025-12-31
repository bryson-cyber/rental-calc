import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  TrendingUp,
  DollarSign,
  Percent,
  Trophy,
  ChevronRight,
  Loader2,
  ArrowUpRight,
  Star,
  Target,
  BarChart3,
  Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';

interface SubmarketExplorerProps {
  marketId: string;
  marketName: string;
  onSubmarketSelect?: (submarketId: string, submarketName: string) => void;
}

type SortOption = 'overall' | 'revenue' | 'occupancy' | 'revpar';

export function SubmarketExplorer({ marketId, marketName, onSubmarketSelect }: SubmarketExplorerProps) {
  const [, setLocation] = useLocation();
  const [sortBy, setSortBy] = useState<SortOption>('overall');
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = trpc.rental.exploreSubmarkets.useQuery(
    { marketId, sortBy, limit: 15 },
    { enabled: !!marketId, refetchOnWindowFocus: false }
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const pct = value > 1 ? value : value * 100;
    return `${Math.round(pct)}%`;
  };

  const handleSubmarketClick = (submarketId: string, submarketName: string) => {
    if (onSubmarketSelect) {
      onSubmarketSelect(submarketId, submarketName);
    } else {
      // Navigate to submarket comparison
      setLocation(`/compare?submarket=${encodeURIComponent(submarketId)}`);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-[#0F172A]/10">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#C9A962]" />
            <p className="text-sm text-muted-foreground">Analyzing submarkets in {marketName}...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.success) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-6">
          <p className="text-red-600 text-sm">
            Unable to load submarket data. {error?.message || data?.error}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { market, submarkets, topRecommendation } = data.data!;

  if (submarkets.length === 0) {
    return (
      <Card className="border-[#0F172A]/10">
        <CardContent className="py-6 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No submarkets found for {marketName}</p>
        </CardContent>
      </Card>
    );
  }

  const displayedSubmarkets = expanded ? submarkets : submarkets.slice(0, 5);

  return (
    <Card className="border-[#0F172A]/10 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] text-white pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <Target className="h-5 w-5 text-[#C9A962]" />
              Where to Invest in {marketName}
            </CardTitle>
            <p className="text-white/60 text-sm mt-1">
              Ranked neighborhoods & zip codes by performance
            </p>
          </div>
          <Badge variant="secondary" className="bg-[#C9A962]/20 text-[#C9A962] border-[#C9A962]/30">
            {submarkets.length} Areas
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Sort Options */}
        <div className="flex items-center gap-2 p-4 border-b border-[#0F172A]/10 bg-[#f8f7f4]">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <div className="flex gap-1">
            {[
              { value: 'overall', label: 'Best Overall' },
              { value: 'revenue', label: 'Revenue' },
              { value: 'occupancy', label: 'Occupancy' },
              { value: 'revpar', label: 'RevPAR' },
            ].map((option) => (
              <Button
                key={option.value}
                variant={sortBy === option.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSortBy(option.value as SortOption)}
                className={sortBy === option.value ? 'bg-[#0F172A] text-white' : ''}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Top Recommendation */}
        {topRecommendation && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gradient-to-r from-[#C9A962]/10 to-transparent border-b border-[#C9A962]/20"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#C9A962] flex items-center justify-center flex-shrink-0">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-[#0F172A]">{topRecommendation.name}</h4>
                  <Badge className="bg-[#C9A962] text-white">Top Pick</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {topRecommendation.recommendation || 'Best overall performance across all metrics'}
                </p>
                <div className="flex gap-4 mt-2">
                  <span className="text-sm">
                    <DollarSign className="h-3 w-3 inline text-green-600" />
                    {formatCurrency(topRecommendation.metrics.revenue)}/yr
                  </span>
                  <span className="text-sm">
                    <Percent className="h-3 w-3 inline text-blue-600" />
                    {formatPercent(topRecommendation.metrics.occupancy)} occ
                  </span>
                  <span className="text-sm">
                    <BarChart3 className="h-3 w-3 inline text-purple-600" />
                    {formatCurrency(topRecommendation.metrics.revpar)} RevPAR
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleSubmarketClick(topRecommendation.id, topRecommendation.name)}
                className="bg-[#0F172A] hover:bg-[#0F172A]/90"
              >
                Explore <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Submarket List */}
        <div className="divide-y divide-[#0F172A]/10">
          <AnimatePresence>
            {displayedSubmarkets.map((submarket, index) => (
              <motion.div
                key={submarket.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-[#f8f7f4] transition-colors cursor-pointer group"
                onClick={() => handleSubmarketClick(submarket.id, submarket.name)}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? 'bg-[#C9A962] text-white' :
                    index === 1 ? 'bg-gray-300 text-gray-700' :
                    index === 2 ? 'bg-amber-600 text-white' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-[#0F172A] truncate">{submarket.name}</h4>
                      {submarket.recommendation && index > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {submarket.ranking.revenue_rank === 1 ? 'Top Revenue' :
                           submarket.ranking.occupancy_rank === 1 ? 'Top Occupancy' :
                           submarket.ranking.revpar_rank === 1 ? 'Top RevPAR' : ''}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Building2 className="h-3 w-3" />
                      {submarket.listing_count.toLocaleString()} listings
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="hidden sm:flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#0F172A]">
                        {formatCurrency(submarket.metrics.revenue)}
                      </p>
                      <p className="text-xs text-muted-foreground">Revenue/yr</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#0F172A]">
                        {formatPercent(submarket.metrics.occupancy)}
                      </p>
                      <p className="text-xs text-muted-foreground">Occupancy</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#0F172A]">
                        {formatCurrency(submarket.metrics.adr)}
                      </p>
                      <p className="text-xs text-muted-foreground">ADR</p>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      submarket.ranking.overall_score >= 80 ? 'bg-green-100 text-green-700' :
                      submarket.ranking.overall_score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {submarket.ranking.overall_score}/100
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[#C9A962] transition-colors" />
                  </div>
                </div>

                {/* Mobile metrics */}
                <div className="flex sm:hidden items-center gap-4 mt-2 ml-12 text-xs text-muted-foreground">
                  <span>{formatCurrency(submarket.metrics.revenue)}/yr</span>
                  <span>{formatPercent(submarket.metrics.occupancy)} occ</span>
                  <span>{formatCurrency(submarket.metrics.adr)} ADR</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Show More Button */}
        {submarkets.length > 5 && (
          <div className="p-4 border-t border-[#0F172A]/10 bg-[#f8f7f4]">
            <Button
              variant="ghost"
              className="w-full text-[#0F172A]"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show Less' : `Show ${submarkets.length - 5} More Areas`}
              <ArrowUpRight className={`h-4 w-4 ml-1 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
