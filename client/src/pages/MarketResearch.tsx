/**
 * Market Research - AI-Powered Market Analysis
 * 
 * Uses Browser Use Cloud API to automatically:
 * 1. Navigate to coachinayah.com/market-charts
 * 2. Execute the 8-step Market Research Master Prompt
 * 3. Generate comprehensive market research reports
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { 
  Search,
  MapPin,
  TrendingUp,
  Home,
  BarChart3,
  Target,
  Calendar,
  Star,
  ExternalLink,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronRight,
  Building2,
  DollarSign,
  Percent,
  Users,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface MarketResearchProgress {
  step: number;
  totalSteps: number;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  data?: any;
  error?: string;
}

interface BedroomAnalysis {
  bedroomSize: string;
  avgRevenue: number;
  avgOccupancy: number;
  avgADR: number;
  listingCount: number;
  topPerformerRevenue: number;
}

interface TopPerformer {
  title: string;
  airbnbUrl: string;
  revenue: number;
  occupancy: number;
  adr: number;
  rating: number;
  reviewCount: number;
  designStyle: string;
  competitiveEdge: string;
  qualityRating: number;
}

interface MarketResearchResult {
  market: string;
  executiveSummary: {
    analysisDate: string;
    optimalBedroomSize: string;
    targetNeighborhoods: string[];
    keyFinding: string;
  };
  marketOverview: {
    totalListings: number;
    avgMonthlyListings: number;
    listingsPercentChange: number;
    avgOccupancy: number;
    avgADR: number;
    avgAnnualRevenue: number;
    marketHealthAssessment: string;
  };
  bedroomAnalysis: BedroomAnalysis[];
  geographicAnalysis: {
    primaryNeighborhood: { name: string; greenPinCount: number; notableFeatures: string[]; whyTarget: string };
    secondaryNeighborhood: { name: string; greenPinCount: number; notableFeatures: string[]; whyTarget: string };
    tertiaryNeighborhood: { name: string; greenPinCount: number; notableFeatures: string[]; whyTarget: string };
  };
  topPerformers: TopPerformer[];
  seasonalityInsights: {
    peakSeason: string[];
    lowSeason: string[];
    revenueVariance: string;
    yoyTrend: string;
  };
  recommendations: {
    propertyHuntingFocus: string;
    pricingStrategy: string;
    designInvestment: string[];
    revenueExpectations: {
      conservative: number;
      target: number;
      stretch: number;
    };
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// ============================================
// PROGRESS STEPS
// ============================================

const RESEARCH_STEPS = [
  { id: 1, name: 'Data Collection', description: 'Extracting market metrics, submarkets, and top performers' },
  { id: 2, name: 'Geographic & Seasonality', description: 'Analyzing map hotspots and seasonal trends' },
  { id: 3, name: 'Airbnb Deep Dive', description: 'Visiting top listings and compiling recommendations' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function MarketResearch() {
  const [marketName, setMarketName] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<MarketResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // tRPC mutation for market research
  const researchMutation = trpc.marketResearch.start.useMutation({
    onSuccess: (data: { researchId: string; message: string }) => {
      // Research started - progress will be polled via researchId
      console.log('Research started:', data.message);
    },
    onError: (err: { message: string }) => {
      setError(err.message);
      setIsResearching(false);
      toast.error('Research failed: ' + err.message);
    },
  });

  // Poll for progress updates
  const progressQuery = trpc.marketResearch.getProgress.useQuery(
    { researchId: researchMutation.data?.researchId || '' },
    {
      enabled: isResearching && !!researchMutation.data?.researchId,
      refetchInterval: 2000,
    }
  );

  // Handle progress updates
  const progressData = progressQuery.data as { step?: number; status?: string; result?: MarketResearchResult; error?: string } | undefined;
  if (progressData?.step && progressData.step !== currentStep) {
    setCurrentStep(progressData.step);
  }
  if (progressData?.status === 'completed' && progressData?.result) {
    if (!result) {
      setResult(progressData.result);
      setIsResearching(false);
    }
  }
  if (progressData?.status === 'error' && progressData?.error) {
    if (!error) {
      setError(progressData.error);
      setIsResearching(false);
    }
  }

  const startResearch = async () => {
    if (!marketName.trim()) {
      toast.error('Please enter a city or market name');
      return;
    }

    setIsResearching(true);
    setCurrentStep(0);
    setResult(null);
    setError(null);

    researchMutation.mutate({ market: marketName.trim() });
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4A84B] to-[#4ECDC4] flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Market Research</h1>
                <p className="text-xs text-slate-400">AI-Powered Analysis</p>
              </div>
            </div>
            <a 
              href="/"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              ← Back to Calculator
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-4xl mx-auto px-4 py-12">
        
        {/* Search Section */}
        {!result && !isResearching && (
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D4A84B]/10 border border-[#D4A84B]/30 text-[#D4A84B] text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              AI-Powered Market Intelligence
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Find the Best Markets for<br />
              <span className="bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] bg-clip-text text-transparent">
                Airbnb Arbitrage
              </span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-8">
              Enter a city name and our AI agent will analyze the market, identify top-performing properties, 
              and give you a complete research report in minutes.
            </p>

            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 max-w-xl mx-auto">
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Enter city name (e.g., Atlanta, Nashville, Austin)"
                    value={marketName}
                    onChange={(e) => setMarketName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && startResearch()}
                    className="pl-12 h-14 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 text-lg"
                  />
                </div>
                <Button
                  onClick={startResearch}
                  disabled={!marketName.trim()}
                  className="h-14 bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] hover:opacity-90 text-white font-semibold text-lg"
                >
                  <Search className="w-5 h-5 mr-2" />
                  Start Market Research
                </Button>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-700/50">
                <p className="text-slate-500 text-sm">
                  This analysis typically takes 5-10 minutes. Our AI will browse real market data, 
                  analyze competitors, and compile a detailed report.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Section */}
        {isResearching && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4ECDC4]/10 border border-[#4ECDC4]/30 text-[#4ECDC4] text-sm font-medium mb-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Researching {marketName}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                AI Agent Working...
              </h2>
              <p className="text-slate-400">
                Our agent is browsing market data and analyzing properties
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
              <div className="space-y-4">
                {RESEARCH_STEPS.map((step, index) => {
                  const isCompleted = currentStep > step.id;
                  const isCurrent = currentStep === step.id;
                  const isPending = currentStep < step.id;

                  return (
                    <div 
                      key={step.id}
                      className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                        isCurrent 
                          ? 'bg-[#4ECDC4]/10 border border-[#4ECDC4]/30' 
                          : isCompleted 
                            ? 'bg-green-500/10 border border-green-500/30'
                            : 'bg-slate-700/30 border border-slate-700/50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted 
                          ? 'bg-green-500 text-white' 
                          : isCurrent 
                            ? 'bg-[#4ECDC4] text-white'
                            : 'bg-slate-700 text-slate-400'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : isCurrent ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <span className="text-sm font-medium">{step.id}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-medium ${
                          isPending ? 'text-slate-500' : 'text-white'
                        }`}>
                          {step.name}
                        </h3>
                        <p className={`text-sm ${
                          isPending ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          {step.description}
                        </p>
                      </div>
                      {isCurrent && (
                        <div className="text-[#4ECDC4] text-sm font-medium">
                          In Progress
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="mt-6 pt-6 border-t border-slate-700/50">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-400">Overall Progress</span>
                  <span className="text-white font-medium">
                    {Math.round((currentStep / RESEARCH_STEPS.length) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] transition-all duration-500"
                    style={{ width: `${(currentStep / RESEARCH_STEPS.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="max-w-xl mx-auto">
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Research Failed</h3>
              <p className="text-slate-400 mb-6">{error}</p>
              <Button
                onClick={() => {
                  setError(null);
                  setIsResearching(false);
                }}
                className="bg-slate-700 hover:bg-slate-600 text-white"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-8">
            {/* Executive Summary */}
            <div className="bg-gradient-to-br from-[#D4A84B]/20 to-[#4ECDC4]/20 border border-[#D4A84B]/30 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4A84B] to-[#4ECDC4] flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{result.market}</h2>
                  <p className="text-slate-400">Market Research Report • {result.executiveSummary.analysisDate}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-slate-400 text-sm mb-1">Optimal Bedroom Size</div>
                  <div className="text-2xl font-bold text-white">{result.executiveSummary.optimalBedroomSize}</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-slate-400 text-sm mb-1">Market Health</div>
                  <div className={`text-2xl font-bold ${
                    result.marketOverview.marketHealthAssessment === 'Growing' ? 'text-green-400' :
                    result.marketOverview.marketHealthAssessment === 'Stable' ? 'text-[#4ECDC4]' :
                    'text-yellow-400'
                  }`}>
                    {result.marketOverview.marketHealthAssessment}
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-slate-400 text-sm mb-1">Target Neighborhoods</div>
                  <div className="text-lg font-bold text-white">
                    {result.executiveSummary.targetNeighborhoods.length} Areas
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4">
                <div className="text-slate-400 text-sm mb-2">Key Finding</div>
                <p className="text-white">{result.executiveSummary.keyFinding}</p>
              </div>
            </div>

            {/* Market Overview */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#4ECDC4]" />
                Market Overview
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-slate-700/50 rounded-xl p-4">
                  <div className="text-slate-400 text-sm mb-1">Total Listings</div>
                  <div className="text-2xl font-bold text-white">{result.marketOverview.totalListings.toLocaleString()}</div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4">
                  <div className="text-slate-400 text-sm mb-1">Avg Occupancy</div>
                  <div className="text-2xl font-bold text-white">{result.marketOverview.avgOccupancy}%</div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4">
                  <div className="text-slate-400 text-sm mb-1">Avg Daily Rate</div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(result.marketOverview.avgADR)}</div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4">
                  <div className="text-slate-400 text-sm mb-1">Avg Annual Revenue</div>
                  <div className="text-2xl font-bold text-[#4ECDC4]">{formatCurrency(result.marketOverview.avgAnnualRevenue)}</div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4">
                  <div className="text-slate-400 text-sm mb-1">Listings Change (YoY)</div>
                  <div className={`text-2xl font-bold ${result.marketOverview.listingsPercentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {result.marketOverview.listingsPercentChange >= 0 ? '+' : ''}{result.marketOverview.listingsPercentChange}%
                  </div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4">
                  <div className="text-slate-400 text-sm mb-1">Monthly Listings</div>
                  <div className="text-2xl font-bold text-white">{result.marketOverview.avgMonthlyListings}</div>
                </div>
              </div>
            </div>

            {/* Bedroom Analysis */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Home className="w-5 h-5 text-[#D4A84B]" />
                Bedroom Size Performance
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Size</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">Avg Revenue</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">Occupancy</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">ADR</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">Listings</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">Top Performer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.bedroomAnalysis.map((bedroom, index) => (
                      <tr 
                        key={bedroom.bedroomSize}
                        className={`border-b border-slate-700/50 ${
                          bedroom.bedroomSize === result.executiveSummary.optimalBedroomSize 
                            ? 'bg-[#4ECDC4]/10' 
                            : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{bedroom.bedroomSize}</span>
                            {bedroom.bedroomSize === result.executiveSummary.optimalBedroomSize && (
                              <span className="px-2 py-0.5 rounded-full bg-[#4ECDC4]/20 text-[#4ECDC4] text-xs font-medium">
                                Best
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-white font-medium">
                          {formatCurrency(bedroom.avgRevenue)}
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {bedroom.avgOccupancy}%
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {formatCurrency(bedroom.avgADR)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400">
                          {bedroom.listingCount}
                        </td>
                        <td className="py-3 px-4 text-right text-[#D4A84B] font-medium">
                          {formatCurrency(bedroom.topPerformerRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Target Neighborhoods */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#4ECDC4]" />
                Target Neighborhoods
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { label: 'Primary', data: result.geographicAnalysis.primaryNeighborhood },
                  { label: 'Secondary', data: result.geographicAnalysis.secondaryNeighborhood },
                  { label: 'Tertiary', data: result.geographicAnalysis.tertiaryNeighborhood },
                ].map((neighborhood, index) => (
                  <div 
                    key={index}
                    className={`rounded-xl p-5 ${
                      index === 0 
                        ? 'bg-gradient-to-br from-[#D4A84B]/20 to-transparent border border-[#D4A84B]/30' 
                        : 'bg-slate-700/50'
                    }`}
                  >
                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">{neighborhood.label}</div>
                    <h4 className="text-lg font-bold text-white mb-2">{neighborhood.data.name || 'N/A'}</h4>
                    <div className="text-sm text-slate-400 mb-3">
                      {neighborhood.data.greenPinCount} top performers in area
                    </div>
                    <p className="text-sm text-slate-300">{neighborhood.data.whyTarget}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Performers */}
            {result.topPerformers.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Star className="w-5 h-5 text-[#D4A84B]" />
                  Top Performing Properties
                </h3>
                <div className="space-y-4">
                  {result.topPerformers.map((performer, index) => (
                    <div 
                      key={index}
                      className="bg-slate-700/50 rounded-xl p-5 hover:bg-slate-700/70 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="w-8 h-8 rounded-full bg-[#D4A84B]/20 text-[#D4A84B] flex items-center justify-center text-sm font-bold">
                              #{index + 1}
                            </span>
                            <h4 className="text-white font-medium">{performer.title}</h4>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                            <div>
                              <div className="text-slate-500 text-xs">Revenue</div>
                              <div className="text-[#4ECDC4] font-bold">{formatCurrency(performer.revenue)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs">Occupancy</div>
                              <div className="text-white font-medium">{performer.occupancy}%</div>
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs">Rating</div>
                              <div className="text-white font-medium flex items-center gap-1">
                                <Star className="w-3 h-3 text-[#D4A84B] fill-[#D4A84B]" />
                                {performer.rating}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs">Quality Score</div>
                              <div className="text-white font-medium">{performer.qualityRating}/10</div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <span className="px-2 py-1 rounded-md bg-slate-600/50 text-slate-300 text-xs">
                              {performer.designStyle}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400">{performer.competitiveEdge}</p>
                        </div>
                        {performer.airbnbUrl && (
                          <a
                            href={performer.airbnbUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[#4ECDC4] hover:underline text-sm whitespace-nowrap"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seasonality */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#4ECDC4]" />
                Seasonality Insights
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
                  <div className="text-green-400 text-sm font-medium mb-2">Peak Season</div>
                  <div className="text-white text-lg font-bold">
                    {result.seasonalityInsights.peakSeason.join(', ') || 'N/A'}
                  </div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
                  <div className="text-blue-400 text-sm font-medium mb-2">Low Season</div>
                  <div className="text-white text-lg font-bold">
                    {result.seasonalityInsights.lowSeason.join(', ') || 'N/A'}
                  </div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-5">
                  <div className="text-slate-400 text-sm font-medium mb-2">Revenue Variance</div>
                  <div className="text-white text-lg font-bold">
                    {result.seasonalityInsights.revenueVariance}
                  </div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-5">
                  <div className="text-slate-400 text-sm font-medium mb-2">Year-over-Year Trend</div>
                  <div className={`text-lg font-bold ${
                    result.seasonalityInsights.yoyTrend === 'growing' ? 'text-green-400' :
                    result.seasonalityInsights.yoyTrend === 'stable' ? 'text-[#4ECDC4]' :
                    'text-yellow-400'
                  }`}>
                    {result.seasonalityInsights.yoyTrend.charAt(0).toUpperCase() + result.seasonalityInsights.yoyTrend.slice(1)}
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-gradient-to-br from-[#D4A84B]/20 to-[#4ECDC4]/20 border border-[#D4A84B]/30 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#D4A84B]" />
                Recommendations
              </h3>
              
              <div className="space-y-6">
                <div className="bg-slate-800/50 rounded-xl p-5">
                  <h4 className="text-white font-medium mb-2">Property Hunting Focus</h4>
                  <p className="text-slate-300">{result.recommendations.propertyHuntingFocus}</p>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-5">
                  <h4 className="text-white font-medium mb-2">Pricing Strategy</h4>
                  <p className="text-slate-300">{result.recommendations.pricingStrategy}</p>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-5">
                  <h4 className="text-white font-medium mb-3">Design Investment Priorities</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.recommendations.designInvestment.map((item, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1.5 rounded-lg bg-[#4ECDC4]/20 text-[#4ECDC4] text-sm"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-5">
                  <h4 className="text-white font-medium mb-4">Revenue Expectations</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-slate-400 text-sm mb-1">Conservative</div>
                      <div className="text-xl font-bold text-white">
                        {formatCurrency(result.recommendations.revenueExpectations.conservative)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[#4ECDC4] text-sm mb-1">Target</div>
                      <div className="text-2xl font-bold text-[#4ECDC4]">
                        {formatCurrency(result.recommendations.revenueExpectations.target)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400 text-sm mb-1">Stretch</div>
                      <div className="text-xl font-bold text-white">
                        {formatCurrency(result.recommendations.revenueExpectations.stretch)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center py-8">
              <Button
                onClick={() => {
                  setResult(null);
                  setMarketName('');
                }}
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-700 mr-4"
              >
                Research Another Market
              </Button>
              <a
                href="https://masterclass.coachinayah.com/the-turnkey-program-2"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] hover:opacity-90 text-white font-semibold rounded-xl transition-all"
              >
                Get Expert Guidance
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 py-8 mt-12">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            Powered by <span className="text-[#D4A84B]">Coach Inayah</span> • AI-Powered Market Intelligence
          </p>
        </div>
      </footer>
    </div>
  );
}
