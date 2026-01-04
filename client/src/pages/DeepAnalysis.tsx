import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Brain, 
  TrendingUp, 
  Shield, 
  DollarSign, 
  Camera, 
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Target,
  BarChart3,
  Lightbulb
} from 'lucide-react';

interface DeepAnalysisData {
  historicalContext: {
    summary: string;
    yearOverYear: Array<{
      year: number;
      occupancy: number;
      adr: number;
      revenue: number;
      yoyChange: number;
    }>;
    marketMaturity: string;
    trajectory: string;
    keyFindings: string[];
    investmentImplications: string[];
  } | null;
  investmentThesis: {
    summary: string;
    bullCase: string;
    bearCase: string;
    baseCase: string;
    keyAssumptions: string[];
    catalysts: string[];
    risks: string[];
    confidenceLevel: string;
    recommendation: string;
  } | null;
  riskNarrative: {
    overallRisk: string;
    riskScore: number;
    marketRisks: Array<{ risk: string; severity: string; mitigation: string }>;
    financialRisks: Array<{ risk: string; severity: string; mitigation: string }>;
    operationalRisks: Array<{ risk: string; severity: string; mitigation: string }>;
    regulatoryRisks: Array<{ risk: string; severity: string; mitigation: string }>;
    summary: string;
  } | null;
  pricingStrategy: {
    baseRate: number;
    peakSeasonPremium: number;
    offSeasonDiscount: number;
    weekendPremium: number;
    minimumStay: { weekday: number; weekend: number; peak: number };
    dynamicPricingRecommendation: string;
    competitorPricing: { low: number; median: number; high: number };
    suggestedRange: { min: number; max: number };
    strategy: string;
  } | null;
  executiveSummaryEnhanced: string | null;
  marketNarrative: string | null;
  actionPlan: {
    phases: Array<{
      phase: number;
      name: string;
      duration: string;
      tasks: Array<{ task: string; priority: string; estimatedCost?: string }>;
      milestones: string[];
    }>;
    totalTimeline: string;
    totalBudget: string;
    criticalPath: string[];
  } | null;
}

export default function DeepAnalysis() {
  const { reportId } = useParams<{ reportId: string }>();
  const [, setLocation] = useLocation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    executive: true,
    thesis: true,
    historical: false,
    risk: false,
    pricing: false,
    action: false,
    market: false,
  });

  const numericReportId = parseInt(reportId || '0', 10);

  // Start deep analysis mutation
  const startMutation = trpc.deepAnalysis.start.useMutation();

  // Poll for deep analysis status
  const { data: analysisData, refetch, isLoading } = trpc.deepAnalysis.get.useQuery(
    { reportId: numericReportId },
    { 
      enabled: numericReportId > 0,
      refetchInterval: 3000, // Poll every 3 seconds
    }
  );

  // Start analysis on mount if not started
  useEffect(() => {
    if (analysisData?.data?.status === 'not_started' && numericReportId > 0) {
      startMutation.mutate({ reportId: numericReportId });
    }
  }, [analysisData?.data?.status, numericReportId]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const status = analysisData?.data?.status || 'loading';
  const result = analysisData?.data?.result as DeepAnalysisData | null;
  const processingTimeMs = analysisData?.data?.processingTimeMs;

  // Calculate progress based on status
  const getProgress = () => {
    if (status === 'completed') return 100;
    if (status === 'processing') return 60;
    if (status === 'pending') return 20;
    return 0;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'low': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  if (!numericReportId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Report ID</h2>
            <p className="text-muted-foreground mb-4">
              Please go back and run an analysis first.
            </p>
            <Button onClick={() => setLocation('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setLocation(`/results/${reportId}`)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Report
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <span className="font-semibold">Deep AI Analysis</span>
              </div>
            </div>
            {status === 'completed' && processingTimeMs && (
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" />
                Generated in {(processingTimeMs / 1000).toFixed(1)}s
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Loading State */}
        {(status === 'pending' || status === 'processing' || isLoading) && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-8 pb-8">
              <div className="text-center mb-6">
                <div className="relative inline-block">
                  <Brain className="w-16 h-16 text-primary animate-pulse" />
                  <Sparkles className="w-6 h-6 text-yellow-500 absolute -top-1 -right-1 animate-bounce" />
                </div>
                <h2 className="text-2xl font-bold mt-4 mb-2">AI Analysis in Progress</h2>
                <p className="text-muted-foreground">
                  Our AI is generating deep insights about your property...
                </p>
              </div>

              <Progress value={getProgress()} className="h-2 mb-4" />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Historical Context</span>
                </div>
                <div className="flex items-center gap-2">
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Investment Thesis</span>
                </div>
                <div className="flex items-center gap-2">
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Risk Assessment</span>
                </div>
                <div className="flex items-center gap-2">
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Pricing Strategy</span>
                </div>
              </div>

              <p className="text-center text-xs text-muted-foreground mt-6">
                This typically takes 2-3 minutes. You can leave this page and come back.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {status === 'failed' && (
          <Card className="max-w-2xl mx-auto border-red-500/20">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Analysis Failed</h2>
              <p className="text-muted-foreground mb-4">
                {analysisData?.data?.error || 'Something went wrong during the analysis.'}
              </p>
              <Button onClick={() => startMutation.mutate({ reportId: numericReportId })}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {status === 'completed' && result && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Enhanced Executive Summary */}
            {result.executiveSummaryEnhanced && (
              <Card>
                <CardHeader 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleSection('executive')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Enhanced Executive Summary</CardTitle>
                        <CardDescription>AI-generated comprehensive overview</CardDescription>
                      </div>
                    </div>
                    {expandedSections.executive ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </CardHeader>
                {expandedSections.executive && (
                  <CardContent>
                    <div 
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ 
                        __html: result.executiveSummaryEnhanced
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br />') 
                      }}
                    />
                  </CardContent>
                )}
              </Card>
            )}

            {/* Investment Thesis */}
            {result.investmentThesis && (
              <Card>
                <CardHeader 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleSection('thesis')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <Target className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Market Scenarios</CardTitle>
                        <CardDescription>Bull, bear, and base case analysis</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        result.investmentThesis.confidenceLevel === 'high' ? 'default' :
                        result.investmentThesis.confidenceLevel === 'medium' ? 'secondary' : 'outline'
                      }>
                        {result.investmentThesis.confidenceLevel} confidence
                      </Badge>
                      {expandedSections.thesis ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </CardHeader>
                {expandedSections.thesis && (
                  <CardContent className="space-y-6">
                    <p className="text-muted-foreground">{result.investmentThesis.summary}</p>
                    
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
                        <h4 className="font-semibold text-green-600 mb-2">🐂 Bull Case</h4>
                        <p className="text-sm">{result.investmentThesis.bullCase}</p>
                      </div>
                      <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                        <h4 className="font-semibold text-blue-600 mb-2">📊 Base Case</h4>
                        <p className="text-sm">{result.investmentThesis.baseCase}</p>
                      </div>
                      <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                        <h4 className="font-semibold text-red-600 mb-2">🐻 Bear Case</h4>
                        <p className="text-sm">{result.investmentThesis.bearCase}</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-yellow-500" />
                          Key Assumptions
                        </h4>
                        <ul className="space-y-1">
                          {result.investmentThesis.keyAssumptions.map((item, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-primary">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                          Catalysts
                        </h4>
                        <ul className="space-y-1">
                          {result.investmentThesis.catalysts.map((item, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-green-500">↑</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-semibold mb-2">Summary</h4>
                      <p>{result.investmentThesis.recommendation}</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Historical Context */}
            {result.historicalContext && (
              <Card>
                <CardHeader 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleSection('historical')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <BarChart3 className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Historical Market Context</CardTitle>
                        <CardDescription>5-year trends and market trajectory</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{result.historicalContext.marketMaturity}</Badge>
                      {expandedSections.historical ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </CardHeader>
                {expandedSections.historical && (
                  <CardContent className="space-y-6">
                    <p className="text-muted-foreground">{result.historicalContext.summary}</p>
                    
                    {result.historicalContext.yearOverYear.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Year</th>
                              <th className="text-right py-2">Occupancy</th>
                              <th className="text-right py-2">ADR</th>
                              <th className="text-right py-2">Revenue</th>
                              <th className="text-right py-2">YoY Change</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.historicalContext.yearOverYear.map((row, i) => (
                              <tr key={i} className="border-b border-muted">
                                <td className="py-2 font-medium">{row.year}</td>
                                <td className="text-right py-2">{row.occupancy}%</td>
                                <td className="text-right py-2">${row.adr}</td>
                                <td className="text-right py-2">${row.revenue.toLocaleString()}</td>
                                <td className={`text-right py-2 ${row.yoyChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  {row.yoyChange >= 0 ? '+' : ''}{row.yoyChange}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-semibold mb-2">Market Trajectory</h4>
                      <p className="text-sm">{result.historicalContext.trajectory}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Key Findings</h4>
                        <ul className="space-y-1">
                          {result.historicalContext.keyFindings.map((item, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Investment Implications</h4>
                        <ul className="space-y-1">
                          {result.historicalContext.investmentImplications.map((item, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <Lightbulb className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Risk Assessment */}
            {result.riskNarrative && (
              <Card>
                <CardHeader 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleSection('risk')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <Shield className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Risk Assessment</CardTitle>
                        <CardDescription>Comprehensive risk analysis with mitigations</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getSeverityColor(result.riskNarrative.overallRisk)}>
                        {result.riskNarrative.overallRisk} risk ({result.riskNarrative.riskScore}/10)
                      </Badge>
                      {expandedSections.risk ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </CardHeader>
                {expandedSections.risk && (
                  <CardContent className="space-y-6">
                    <p className="text-muted-foreground">{result.riskNarrative.summary}</p>

                    {[
                      { title: 'Market Risks', risks: result.riskNarrative.marketRisks, icon: '📊' },
                      { title: 'Financial Risks', risks: result.riskNarrative.financialRisks, icon: '💰' },
                      { title: 'Operational Risks', risks: result.riskNarrative.operationalRisks, icon: '⚙️' },
                      { title: 'Regulatory Risks', risks: result.riskNarrative.regulatoryRisks, icon: '📜' },
                    ].map((category, i) => (
                      category.risks.length > 0 && (
                        <div key={i}>
                          <h4 className="font-semibold mb-3">{category.icon} {category.title}</h4>
                          <div className="space-y-2">
                            {category.risks.map((risk, j) => (
                              <div key={j} className="p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge className={getSeverityColor(risk.severity)} variant="outline">
                                        {risk.severity}
                                      </Badge>
                                      <span className="font-medium text-sm">{risk.risk}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-medium">Mitigation:</span> {risk.mitigation}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                  </CardContent>
                )}
              </Card>
            )}

            {/* Pricing Strategy */}
            {result.pricingStrategy && (
              <Card>
                <CardHeader 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleSection('pricing')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-yellow-500/10 rounded-lg">
                        <DollarSign className="w-5 h-5 text-yellow-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Market Pricing Data</CardTitle>
                        <CardDescription>Competitor pricing and market rates</CardDescription>
                      </div>
                    </div>
                    {expandedSections.pricing ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </CardHeader>
                {expandedSections.pricing && (
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <p className="text-2xl font-bold text-primary">${result.pricingStrategy.baseRate}</p>
                        <p className="text-xs text-muted-foreground">Base Rate/Night</p>
                      </div>
                      <div className="p-4 bg-green-500/10 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-500">+{result.pricingStrategy.peakSeasonPremium}%</p>
                        <p className="text-xs text-muted-foreground">Peak Season</p>
                      </div>
                      <div className="p-4 bg-red-500/10 rounded-lg text-center">
                        <p className="text-2xl font-bold text-red-500">-{result.pricingStrategy.offSeasonDiscount}%</p>
                        <p className="text-xs text-muted-foreground">Off Season</p>
                      </div>
                      <div className="p-4 bg-blue-500/10 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-500">+{result.pricingStrategy.weekendPremium}%</p>
                        <p className="text-xs text-muted-foreground">Weekend</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3">Minimum Stay Requirements</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Weekday</span>
                            <span className="font-medium">{result.pricingStrategy.minimumStay.weekday} nights</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Weekend</span>
                            <span className="font-medium">{result.pricingStrategy.minimumStay.weekend} nights</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Peak Season</span>
                            <span className="font-medium">{result.pricingStrategy.minimumStay.peak} nights</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3">Competitor Pricing</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Low</span>
                            <span className="font-medium">${result.pricingStrategy.competitorPricing.low}/night</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Median</span>
                            <span className="font-medium">${result.pricingStrategy.competitorPricing.median}/night</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>High</span>
                            <span className="font-medium">${result.pricingStrategy.competitorPricing.high}/night</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <h4 className="font-semibold mb-2">Suggested Price Range</h4>
                      <p className="text-2xl font-bold">
                        ${result.pricingStrategy.suggestedRange.min} - ${result.pricingStrategy.suggestedRange.max}
                        <span className="text-sm font-normal text-muted-foreground">/night</span>
                      </p>
                    </div>

                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-semibold mb-2">Dynamic Pricing Insights</h4>
                      <p className="text-sm">{result.pricingStrategy.dynamicPricingRecommendation}</p>
                    </div>

                    <p className="text-sm text-muted-foreground">{result.pricingStrategy.strategy}</p>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Market Narrative */}
            {result.marketNarrative && (
              <Card>
                <CardHeader 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleSection('market')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/10 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-indigo-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Market Deep Dive</CardTitle>
                        <CardDescription>Comprehensive market analysis narrative</CardDescription>
                      </div>
                    </div>
                    {expandedSections.market ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </CardHeader>
                {expandedSections.market && (
                  <CardContent>
                    <div 
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ 
                        __html: result.marketNarrative
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br />') 
                      }}
                    />
                  </CardContent>
                )}
              </Card>
            )}

            {/* CTA */}
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-2">Ready to Get Started?</h3>
                  <p className="text-muted-foreground mb-4">
                    Let our team handle the setup so you can start earning passive income.
                  </p>
                  <Button size="lg" onClick={() => window.open('https://coachinayah.com/contact', '_blank')}>
                    Schedule a Free Consultation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
