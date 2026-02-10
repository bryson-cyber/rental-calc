import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Building2, 
  Loader2, 
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  ServerCrash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Streamdown } from 'streamdown';
import { trpc } from '@/lib/trpc';
import { useProperty } from '@/contexts/PropertyContext';
import { toast } from 'sonner';
import { UniversalShareButton } from '@/components/UniversalShareButton';

interface AIAdvisorStepProps {
  // Mode (rent or purchase)
  mode?: 'rent' | 'purchase';
  // Purchase data (only for purchase mode)
  purchaseData?: {
    purchasePrice: number;
    loanType: 'conventional' | 'dscr' | 'fha' | 'cash';
    downPaymentPercent: number;
    downPayment: number;
    loanAmount: number;
    interestRate: number;
    monthlyMortgage: number;
    closingCosts: number;
    totalCashNeeded: number;
  };
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
  // Supply Trend Data
  supplyTrend?: {
    currentListings: number;
    listings12MonthsAgo: number;
    netChange: number;
    percentChange: number;
    trend: 'growing' | 'declining' | 'stable';
    insight: string;
    monthlyData?: Array<{
      month: string;
      activeListings: number;
      changeFromPrevious: number;
    }>;
  };
  // Submarket/Neighborhood Data
  submarkets?: Array<{
    id: string;
    name: string;
    listingCount: number;
    metrics?: {
      occupancy: number;
      adr: number;
      revenue: number;
      revpar: number;
      marketScore?: number;
    };
  }>;
}

export function AIAdvisorStep(props: AIAdvisorStepProps) {
  const [propertyAdvice, setPropertyAdvice] = useState<string | null>(null);
  const [hasAutoGenerated, setHasAutoGenerated] = useState(false);
  const [autoNotificationSent, setAutoNotificationSent] = useState(false);
  const { myProperty } = useProperty();
  const [propertyAnalysisState, setPropertyAnalysisState] = useState<{
    startTime: number | null;
    elapsedSeconds: number;
    isTakingLong: boolean;
  }>({ startTime: null, elapsedSeconds: 0, isTakingLong: false });

  const propertyAdvisorMutation = trpc.advanced.propertyAdvisorMax.useMutation();
  
  // Auto-notification mutation
  const createAndNotifyReport = trpc.shareableReports.createAndNotify.useMutation({
    onSuccess: (response) => {
      if (response.success && response.shareCode) {
        setAutoNotificationSent(true);
        const sentMethods: string[] = [];
        if (response.notificationsSent?.sms) sentMethods.push('SMS');
        if (response.notificationsSent?.email) sentMethods.push('email');
        
        if (sentMethods.length > 0) {
          toast.success(`AI Advisor report sent via ${sentMethods.join(' and ')}!`, {
            description: 'Check your inbox for the shareable link.',
            duration: 5000,
          });
        }
      }
    },
    onError: (error) => {
      console.error('[AIAdvisor AutoNotify] Error:', error);
    }
  });

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
        mode: props.mode,
        purchaseData: props.purchaseData,
        supplyTrend: props.supplyTrend,
        submarkets: props.submarkets,
      });
      
      clearInterval(elapsedInterval);
      setPropertyAnalysisState({ startTime: null, elapsedSeconds: 0, isTakingLong: false });
      
      if (result.success && result.data?.advice) {
        setPropertyAdvice(result.data.advice);
        
        // Auto-send notification if user has contact info and auto-notifications enabled
        const hasContactInfo = myProperty?.userEmail || myProperty?.userPhone;
        const autoNotifyEnabled = myProperty?.enableAutoNotifications !== false;
        
        if (hasContactInfo && autoNotifyEnabled && !autoNotificationSent) {
          console.log('[AIAdvisor] Auto-sending notification');
          createAndNotifyReport.mutate({
            reportType: 'ai_advisor',
            address: props.property.address,
            city: props.property.city,
            state: props.property.state,
            zipCode: props.property.zipCode,
            latitude: props.property.latitude,
            longitude: props.property.longitude,
            bedrooms: props.property.bedrooms,
            bathrooms: props.property.bathrooms,
            monthlyRent: props.property.monthlyRent,
            reportData: {
              advice: result.data.advice,
              revenue: props.revenue,
              cashFlow: props.cashFlow,
              marketInsights: props.marketInsights,
            },
            title: `AI Advisor Analysis: ${props.property.address}`,
            summary: `AI-powered investment analysis with $${props.revenue.projected.toLocaleString()}/yr projected revenue.`,
            annualRevenue: props.revenue.projected,
            occupancyRate: props.revenue.occupancy,
            averageDailyRate: props.revenue.adr,
            profitMargin: props.cashFlow?.profitMargin,
            userEmail: myProperty?.userEmail,
            userPhone: myProperty?.userPhone,
            userName: myProperty?.userEmail?.split('@')[0],
            triggeredBy: 'ai_advisor',
          });
        }
      }
    } catch (error) {
      clearInterval(elapsedInterval);
      setPropertyAnalysisState({ startTime: null, elapsedSeconds: 0, isTakingLong: false });
      console.error('Error generating property advice:', error);
    }
  };

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

          {/* Analysis Result - Pure Narrative Text */}
          {propertyAdvice && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Analysis Complete</span>
                </div>
                <UniversalShareButton
                  reportType="ai_advisor"
                  reportData={{ advice: propertyAdvice, property: props.property, revenue: props.revenue, cashFlow: props.cashFlow, comparables: props.comparables }}
                  address={props.property.address}
                  city={props.property.city}
                  state={props.property.state}
                  bedrooms={props.property.bedrooms}
                  bathrooms={props.property.bathrooms}
                  annualRevenue={props.revenue.projected}
                  occupancyRate={props.revenue.occupancy}
                  averageDailyRate={props.revenue.adr}
                  title={`AI Analysis - ${props.property.address}`}
                  summary={`AI-powered investment analysis for ${props.property.address}`}
                  size="sm"
                />
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

      {/* Note about Market Analysis - styled with brand colors */}
      <div className="p-4 rounded-xl border" style={{ backgroundColor: 'oklch(0.98 0.02 75)', borderColor: 'oklch(0.85 0.08 75)' }}>
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'oklch(0.50 0.12 75)' }} />
          <div>
            <div className="font-medium" style={{ color: 'oklch(0.35 0.08 75)' }}>Looking for Market Analysis?</div>
            <p className="text-sm mt-1" style={{ color: 'oklch(0.45 0.06 75)' }}>
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
