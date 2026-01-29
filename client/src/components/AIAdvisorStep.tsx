import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Building2, 
  TrendingUp, 
  Loader2, 
  ChevronDown,
  ChevronUp,
  FileText,
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  ServerCrash,
  DollarSign,
  PiggyBank,
  LineChart,
  Landmark,
  Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Streamdown } from 'streamdown';
import { trpc } from '@/lib/trpc';

interface AIAdvisorStepProps {
  // Property data
  property: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    bedrooms: number;
    bathrooms: number;
    accommodates: number;
    monthlyRent?: number;
    latitude?: number;
    longitude?: number;
  };
  // Revenue projections
  revenue: {
    projected: number;
    low: number;
    high: number;
    adr: number;
    occupancy: number;
    revpar: number;
  };
  // Cash flow analysis
  cashFlow?: {
    monthlyRevenue: number;
    monthlyRent: number;
    monthlyProfit: number;
    annualProfit: number;
    profitMargin: number;
    breakEvenOccupancy: number;
  };
  // All comparables
  comparables: Array<{
    title: string;
    bedrooms: number;
    bathrooms: number;
    accommodates: number;
    revenue: number;
    adr: number;
    occupancy: number;
    revpar: number;
    rating: number;
    reviews: number;
    distanceMeters?: number;
    isSuperhost?: boolean;
    isProfessionallyManaged?: boolean;
    propertyType?: string;
    amenities?: string[];
    lastReviewDate?: string;
    listingUrl?: string;
    photoCount?: number;
  }>;
  // Market insights
  marketInsights: {
    professionallyManagedPct: number;
    superhostPct: number;
    avgRating: number;
    totalListings: number;
    marketScore: number;
    investabilityScore?: number;
    rentalDemandScore?: number;
    revenueGrowthScore?: number;
    seasonalityScore?: number;
    regulationScore?: number;
  };
  // Historical data
  historicalData: {
    yoyChange: number;
    trend: 'up' | 'down' | 'stable';
    months: Array<{
      date: string;
      revenue: number;
      occupancy: number;
      adr: number;
      revpar: number;
      listingCount?: number;
    }>;
  };
  // Seasonality
  seasonality: Array<{
    month: string;
    revenue: number;
    adr: number;
    occupancy: number;
    revpar: number;
    yoyChange?: number;
  }>;
  // Market grade
  marketGrade: {
    grade: string;
    score: number;
    description: string;
    factors: Array<{
      name: string;
      score: number;
      weight: number;
    }>;
  };
  // Market position
  marketPosition: {
    percentile: number;
    rank: number;
    totalListings: number;
    vsAverage: number;
  };
  // Market data for market advisor (optional - used for context)
  marketData?: {
    name: string;
    city: string;
    state: string;
    country: string;
    scores: {
      marketScore: number;
      investabilityScore: number;
      rentalDemandScore: number;
      revenueGrowthScore: number;
      seasonalityScore: number;
      regulationScore: number;
    };
    metrics: {
      avgRevenue: number;
      avgOccupancy: number;
      avgAdr: number;
      avgRevpar: number;
      totalListings: number;
      professionallyManagedPct: number;
      superhostPct: number;
      avgRating: number;
    };
    revenueByBedroom: Array<{
      bedrooms: number;
      avgRevenue: number;
      avgOccupancy: number;
      avgAdr: number;
      listingCount: number;
    }>;
    topPerformers: Array<{
      title: string;
      bedrooms: number;
      bathrooms: number;
      revenue: number;
      occupancy: number;
      adr: number;
      rating: number;
      reviews: number;
      isSuperhost: boolean;
      isProfessionallyManaged: boolean;
    }>;
  };
}

// Investment comparison data
const INVESTMENT_BENCHMARKS = [
  { name: 'S&P 500 Index', annualReturn: 10, icon: LineChart, color: 'text-blue-600', bgColor: 'bg-blue-50', description: 'Historical average annual return of the stock market' },
  { name: 'Real Estate Appreciation', annualReturn: 4, icon: Building2, color: 'text-green-600', bgColor: 'bg-green-50', description: 'Average annual home value appreciation' },
  { name: 'High-Yield Savings', annualReturn: 5, icon: PiggyBank, color: 'text-purple-600', bgColor: 'bg-purple-50', description: 'Current high-yield savings account rates' },
  { name: 'Treasury Bonds', annualReturn: 4.5, icon: Landmark, color: 'text-slate-600', bgColor: 'bg-slate-50', description: '10-year Treasury bond yield' },
];

export function AIAdvisorStep(props: AIAdvisorStepProps) {
  const [propertyAdvice, setPropertyAdvice] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [hasAutoGenerated, setHasAutoGenerated] = useState(false);
  const [showInvestmentComparison, setShowInvestmentComparison] = useState(true);
  const [propertyAnalysisState, setPropertyAnalysisState] = useState<{
    startTime: number | null;
    elapsedSeconds: number;
    isTakingLong: boolean;
  }>({ startTime: null, elapsedSeconds: 0, isTakingLong: false });

  const propertyAdvisorMutation = trpc.advanced.propertyAdvisorMax.useMutation();

  // Auto-generate property analysis on mount (single-button flow)
  useEffect(() => {
    if (!hasAutoGenerated && !propertyAdvice && !propertyAdvisorMutation.isPending) {
      setHasAutoGenerated(true);
      handleGeneratePropertyAdvice();
    }
  }, [hasAutoGenerated, propertyAdvice, propertyAdvisorMutation.isPending]);

  const handleCancelPropertyAnalysis = () => {
    propertyAdvisorMutation.reset();
    setPropertyAnalysisState({ startTime: null, elapsedSeconds: 0, isTakingLong: false });
  };

  const handleGeneratePropertyAdvice = async () => {
    const startTime = Date.now();
    setPropertyAnalysisState({ startTime, elapsedSeconds: 0, isTakingLong: false });
    
    // Track elapsed time
    const elapsedInterval = setInterval(() => {
      setPropertyAnalysisState(prev => {
        if (!prev.startTime) return prev;
        const elapsed = Math.floor((Date.now() - prev.startTime) / 1000);
        const isTakingLong = elapsed >= 30; // Show warning after 30 seconds
        return { ...prev, elapsedSeconds: elapsed, isTakingLong };
      });
    }, 1000);
    
    try {
      const result = await propertyAdvisorMutation.mutateAsync({
        property: props.property,
        revenue: props.revenue,
        cashFlow: props.cashFlow,
        comparables: props.comparables,
        marketInsights: props.marketInsights,
        historicalData: props.historicalData,
        seasonality: props.seasonality,
        marketGrade: props.marketGrade,
        marketPosition: props.marketPosition,
      });
      
      clearInterval(elapsedInterval);
      setPropertyAnalysisState({ startTime: null, elapsedSeconds: 0, isTakingLong: false });
      
      if (result.success && result.data?.advice) {
        setPropertyAdvice(result.data.advice);
      }
    } catch (error) {
      clearInterval(elapsedInterval);
      setPropertyAnalysisState({ startTime: null, elapsedSeconds: 0, isTakingLong: false });
      console.error('Error generating property advice:', error);
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

  // Calculate investment comparison metrics
  const calculateInvestmentComparison = () => {
    const monthlyRent = props.property.monthlyRent || props.cashFlow?.monthlyRent || 0;
    const annualRent = monthlyRent * 12;
    const annualRevenue = props.revenue.projected;
    const annualProfit = props.cashFlow?.annualProfit || (annualRevenue - annualRent);
    
    // Calculate ROI based on initial investment (assume 3 months rent + $5000 setup)
    const initialInvestment = (monthlyRent * 3) + 5000;
    const strROI = initialInvestment > 0 ? (annualProfit / initialInvestment) * 100 : 0;
    
    // For comparison, calculate what each investment would return on the same capital
    const comparisons = INVESTMENT_BENCHMARKS.map(benchmark => ({
      ...benchmark,
      annualReturnAmount: initialInvestment * (benchmark.annualReturn / 100),
      strAdvantage: strROI - benchmark.annualReturn,
    }));
    
    return {
      initialInvestment,
      annualProfit,
      strROI,
      comparisons,
    };
  };

  const investmentData = calculateInvestmentComparison();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900">AI Property Advisor</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Get comprehensive, AI-powered analysis of your property investment.
          Our advisor synthesizes all available data into actionable insights.
        </p>
      </div>

      {/* Property Analysis Card */}
      <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Building2 className="w-5 h-5 text-amber-600" />
                Property Analysis
              </CardTitle>
              <CardDescription className="mt-1">
                Comprehensive analysis of {props.property.address}
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
              {props.property.bedrooms} BR / {props.property.bathrooms} BA
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Property Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-amber-100">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center cursor-help">
                    <div className="text-lg font-bold text-slate-900">
                      {formatCurrency(props.revenue.projected)}
                    </div>
                    <div className="text-xs text-slate-600 flex items-center justify-center gap-1">
                      Projected Revenue <Info className="w-3 h-3 text-slate-400" />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">Estimated annual income this property could generate based on comparable properties in your area. This is calculated from actual performance data of similar listings.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center border-x border-amber-100 cursor-help">
                    <div className="text-lg font-bold text-slate-900">
                      {(props.revenue.occupancy > 1 ? props.revenue.occupancy : props.revenue.occupancy * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-slate-600 flex items-center justify-center gap-1">
                      Occupancy <Info className="w-3 h-3 text-slate-400" />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">The percentage of nights your property is expected to be booked throughout the year. Higher occupancy means more consistent bookings but may require competitive pricing.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center cursor-help">
                    <div className="text-lg font-bold text-slate-900">
                      {formatCurrency(props.revenue.adr)}
                    </div>
                    <div className="text-xs text-slate-600 flex items-center justify-center gap-1">
                      Avg Daily Rate <Info className="w-3 h-3 text-slate-400" />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">The average nightly price guests pay to stay at similar properties. This is what you could charge per night based on market data.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Investment Comparison Section */}
          {props.cashFlow && investmentData.initialInvestment > 0 && (
            <div className="space-y-4">
              <button
                onClick={() => setShowInvestmentComparison(!showInvestmentComparison)}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 hover:border-emerald-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-emerald-900">Investment Comparison</div>
                    <div className="text-sm text-emerald-700">See how STR returns compare to other investments</div>
                  </div>
                </div>
                {showInvestmentComparison ? (
                  <ChevronUp className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-emerald-600" />
                )}
              </button>

              {showInvestmentComparison && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  {/* Your STR Investment */}
                  <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-300">
                    <div className="flex items-center gap-2 mb-4">
                      <DollarSign className="w-5 h-5 text-amber-600" />
                      <span className="font-bold text-amber-900">Your Short-Term Rental Investment</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-white/70 rounded-lg">
                        <div className="text-2xl font-bold text-amber-700">{formatCurrency(investmentData.initialInvestment)}</div>
                        <div className="text-xs text-amber-600">Initial Investment</div>
                        <div className="text-[10px] text-amber-500 mt-1">(3 months rent + setup)</div>
                      </div>
                      <div className="text-center p-3 bg-white/70 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(investmentData.annualProfit)}</div>
                        <div className="text-xs text-green-700">Annual Profit</div>
                        <div className="text-[10px] text-green-600 mt-1">(after rent & expenses)</div>
                      </div>
                      <div className="text-center p-3 bg-white/70 rounded-lg">
                        <div className="text-2xl font-bold text-emerald-600">{investmentData.strROI.toFixed(0)}%</div>
                        <div className="text-xs text-emerald-700">Return on Investment</div>
                        <div className="text-[10px] text-emerald-600 mt-1">(first year ROI)</div>
                      </div>
                    </div>
                  </div>

                  {/* Comparison Table */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                      <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-slate-600" />
                        How Does This Compare to Other Investments?
                      </h4>
                      <p className="text-sm text-slate-600 mt-1">
                        If you invested the same {formatCurrency(investmentData.initialInvestment)} in other vehicles:
                      </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {investmentData.comparisons.map((comparison, index) => {
                        const Icon = comparison.icon;
                        const isSTRBetter = comparison.strAdvantage > 0;
                        return (
                          <div key={index} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${comparison.bgColor}`}>
                                <Icon className={`w-4 h-4 ${comparison.color}`} />
                              </div>
                              <div>
                                <div className="font-medium text-slate-900">{comparison.name}</div>
                                <div className="text-xs text-slate-500">{comparison.description}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-4">
                                <div>
                                  <div className="text-sm font-medium text-slate-700">{comparison.annualReturn}% / year</div>
                                  <div className="text-xs text-slate-500">{formatCurrency(comparison.annualReturnAmount)} return</div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                                  isSTRBetter 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {isSTRBetter ? '+' : ''}{comparison.strAdvantage.toFixed(0)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* STR Row - Highlighted */}
                      <div className="p-4 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-amber-200">
                            <Building2 className="w-4 h-4 text-amber-700" />
                          </div>
                          <div>
                            <div className="font-bold text-amber-900">Short-Term Rental (This Property)</div>
                            <div className="text-xs text-amber-700">Active income with hands-on management</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-amber-700">{investmentData.strROI.toFixed(0)}% / year</div>
                          <div className="text-xs text-amber-600">{formatCurrency(investmentData.annualProfit)} return</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Key Insight */}
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-emerald-900">Key Insight</div>
                        <p className="text-sm text-emerald-700 mt-1">
                          {investmentData.strROI > 20 ? (
                            <>
                              This property's projected <strong>{investmentData.strROI.toFixed(0)}% ROI</strong> significantly outperforms 
                              traditional investments. While the S&P 500 averages 10% annually, your STR investment could generate 
                              <strong> {(investmentData.strROI / 10).toFixed(1)}x more returns</strong> on the same capital.
                            </>
                          ) : investmentData.strROI > 10 ? (
                            <>
                              This property's projected <strong>{investmentData.strROI.toFixed(0)}% ROI</strong> outperforms 
                              most traditional investments including the S&P 500's historical 10% average. This represents 
                              a solid opportunity for active income generation.
                            </>
                          ) : (
                            <>
                              This property's projected <strong>{investmentData.strROI.toFixed(0)}% ROI</strong> is competitive 
                              with traditional investments. Consider factors like appreciation potential and tax benefits 
                              that may improve overall returns.
                            </>
                          )}
                        </p>
                        <p className="text-xs text-emerald-600 mt-2">
                          Note: STR returns require active management. Traditional investments are passive but offer lower returns.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Generate Button */}
          {!propertyAdvice && (
            <div className="space-y-3">
              <Button
                onClick={handleGeneratePropertyAdvice}
                disabled={propertyAdvisorMutation.isPending}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-6 text-lg"
              >
                {propertyAdvisorMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing Property Data... {propertyAnalysisState.elapsedSeconds > 0 && `(${propertyAnalysisState.elapsedSeconds}s)`}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Property Analysis
                  </>
                )}
              </Button>
              
              {/* Timeout Warning */}
              {propertyAdvisorMutation.isPending && propertyAnalysisState.isTakingLong && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 bg-amber-50 rounded-lg border border-amber-200"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">This is taking longer than expected...</p>
                      <p className="text-xs text-amber-700 mt-1">The AI is processing property data. You can continue waiting or cancel and try again.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      onClick={handleCancelPropertyAnalysis}
                      size="sm"
                      variant="outline"
                      className="border-amber-300 text-amber-700 hover:bg-amber-100"
                    >
                      Cancel Analysis
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Error State with Retry */}
          {propertyAdvisorMutation.isError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ServerCrash className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-red-800 mb-1">Property Analysis Failed</div>
                  <div className="text-sm text-red-600 mb-3">
                    {propertyAdvisorMutation.error?.message?.includes('timeout') || propertyAdvisorMutation.error?.message?.includes('network')
                      ? 'Network connection issue. Please check your internet connection and try again.'
                      : propertyAdvisorMutation.error?.message?.includes('rate limit')
                      ? 'Too many requests. Please wait a moment and try again.'
                      : 'Unable to generate property analysis. This could be due to a temporary service issue.'}
                  </div>
                  <Button
                    onClick={() => {
                      propertyAdvisorMutation.reset();
                      handleGeneratePropertyAdvice();
                    }}
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-red-200">
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  If the problem persists, try refreshing the page or contact support.
                </p>
              </div>
            </motion.div>
          )}

          {/* Analysis Result */}
          {propertyAdvice && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Analysis Complete</span>
              </div>
              
              <div className="prose prose-slate max-w-none bg-white rounded-lg border border-slate-200 p-6">
                <Streamdown>{propertyAdvice}</Streamdown>
              </div>

              <Button
                onClick={() => setPropertyAdvice(null)}
                variant="outline"
                className="w-full"
              >
                Generate New Analysis
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Note about Market Analysis */}
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-blue-900">Looking for Market Analysis?</div>
            <p className="text-sm text-blue-700 mt-1">
              For comprehensive market-level analysis (not specific to a property), use <strong>Step 6: Market Advisor</strong>. 
              It provides deep insights into market trends, competition, and investment potential for any area.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIAdvisorStep;
