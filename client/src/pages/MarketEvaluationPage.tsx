/**
 * Market Evaluation Page
 * 
 * One-click comprehensive market evaluation — the "Evaluate This Market" agent.
 * Chains: market discovery → revenue analysis → trends → comps → AI memo
 * 
 * UI aligned with the main app design system:
 * - White/off-white backgrounds with amber/gold accents
 * - oklch color tokens from index.css
 * - Coach Inayah branding ("Powered by Coach Inayah market data")
 * - Consistent typography (system fonts, serif for headlines)
 */

import { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearch } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CityAutocomplete from '@/components/CityAutocomplete';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LightMarkdown } from '@/components/LightMarkdown';
import {
  MapPin,
  Search,
  Loader2,
  CheckCircle2,
  Circle,
  TrendingUp,
  DollarSign,
  BarChart3,
  Brain,
  Target,
  Trophy,
  ArrowLeft,
  BedDouble,
  Sparkles,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

const EVALUATION_STEPS = [
  { id: 'market_discovery', label: 'Discovering Market', icon: Search, description: 'Analyzing market data' },
  { id: 'revenue_analysis', label: 'Revenue Analysis', icon: DollarSign, description: 'Estimating revenue for multiple property types' },
  { id: 'market_trends', label: 'Market Trends', icon: TrendingUp, description: 'Analyzing historical performance & seasonality' },
  { id: 'competitive_landscape', label: 'Competitive Landscape', icon: BarChart3, description: 'Reviewing top performers & listings' },
  { id: 'scoring', label: 'Scoring Market', icon: Target, description: 'Calculating comprehensive market score' },
  { id: 'ai_memo', label: 'AI Investment Memo', icon: Brain, description: 'Generating personalized evaluation' },
  { id: 'complete', label: 'Complete', icon: Trophy, description: 'Your evaluation is ready' },
];

function getStepIndex(step: string | null): number {
  if (!step) return -1;
  return EVALUATION_STEPS.findIndex(s => s.id === step);
}

function ScoreGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return '#16a34a';
    if (s >= 60) return '#C9A962';
    if (s >= 40) return '#f59e0b';
    return '#ef4444';
  };
  
  const getLabel = (s: number) => {
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Good';
    if (s >= 40) return 'Fair';
    return 'Below Average';
  };
  
  const color = getColor(score);
  const circumference = 2 * Math.PI * 45;
  const progress = (score / 100) * circumference;
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="oklch(0.92 0 0)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-serif" style={{ color }}>{score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>
      <span className="mt-2 text-sm font-medium" style={{ color }}>{getLabel(score)}</span>
    </div>
  );
}

export default function MarketEvaluationPage() {
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);
  
  const [city, setCity] = useState(params.get('city') || '');
  const [state, setState] = useState(params.get('state') || '');
  const [bedrooms, setBedrooms] = useState(parseInt(params.get('bedrooms') || '3'));
  const [analysisType, setAnalysisType] = useState<'arbitrage' | 'investment' | 'both'>(
    (params.get('type') as any) || 'both'
  );
  const [email, setEmail] = useState('');
  const [evaluationId, setEvaluationId] = useState<number | null>(
    params.get('id') ? parseInt(params.get('id')!) : null
  );
  const [isRunning, setIsRunning] = useState(false);
  
  const evaluateMutation = trpc.dealAlerts.evaluateMarket.useMutation({
    onSuccess: (data) => {
      setEvaluationId(data.evaluationId);
    },
    onError: () => {
      setIsRunning(false);
    },
  });
  
  const evaluationQuery = trpc.dealAlerts.getEvaluation.useQuery(
    { id: evaluationId! },
    { 
      enabled: !!evaluationId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data && (data.status === 'completed' || data.status === 'failed')) return false;
        return 2000;
      },
    }
  );
  
  const evaluation = evaluationQuery.data;
  const currentStepIndex = getStepIndex(evaluation?.currentStep || null);
  const isComplete = evaluation?.status === 'completed';
  const isFailed = evaluation?.status === 'failed';
  
  useEffect(() => {
    if (params.get('autoStart') === 'true' && city && state && !evaluationId && !isRunning) {
      handleStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleStart = () => {
    if (!city || !state) return;
    setIsRunning(true);
    evaluateMutation.mutate({
      city,
      state,
      bedrooms,
      analysisType,
      email: email || undefined,
    });
  };
  
  // Input form — aligned with main app design
  if (!evaluationId && !isRunning) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-10">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Calculator
            </button>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-xl mb-6 border border-primary/20">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-semibold text-foreground mb-3">
              One-Click Market Evaluation
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Enter a city and get a comprehensive STR market analysis — revenue potential, competition, 
              seasonality, top performers, and an AI-generated investment memo. All in one click.
            </p>
          </div>
          
          {/* Form */}
          <Card className="border border-border shadow-lg">
            <CardContent className="p-8">
              <div className="space-y-6">
                {/* City & State - Autocomplete */}
                <CityAutocomplete
                  initialCity={city}
                  initialState={state}
                  onCitySelect={(c, s) => { setCity(c); setState(s); }}
                  placeholder="Search for a city (e.g., Las Vegas, NV)"
                  label="City"
                />
                
                {/* Bedrooms */}
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-2 uppercase tracking-wider">
                    <BedDouble className="inline w-4 h-4 mr-1" />
                    Target Bedrooms
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(br => (
                      <button
                        key={br}
                        onClick={() => setBedrooms(br)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          bedrooms === br
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {br} BR
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Analysis Type */}
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-2 uppercase tracking-wider">
                    Analysis Focus
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'arbitrage', label: 'Rental Arbitrage', desc: 'Rent & sublet on Airbnb' },
                      { value: 'investment', label: 'Investment', desc: 'Buy & list as STR' },
                      { value: 'both', label: 'Both', desc: 'Full analysis' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setAnalysisType(opt.value as any)}
                        className={`p-3 rounded-lg text-left transition-all border-2 ${
                          analysisType === opt.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="text-sm font-medium text-foreground">{opt.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Email (optional) */}
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-2 uppercase tracking-wider">
                    Email <span className="text-muted-foreground normal-case">(optional — get a copy)</span>
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="py-3 rounded-xl"
                  />
                </div>
                
                {/* Submit */}
                <Button
                  onClick={handleStart}
                  disabled={!city || !state}
                  className="w-full py-6 rounded-xl text-lg font-semibold group"
                >
                  <Sparkles className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Evaluate This Market
                </Button>
                
                <p className="text-center text-muted-foreground text-xs">
                  Takes 30-60 seconds. Powered by Coach Inayah market data + AI analysis.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Running / Results view
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => {
              setEvaluationId(null);
              setIsRunning(false);
            }}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            New Evaluation
          </button>
          {isComplete && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Complete
            </Badge>
          )}
          {isFailed && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              <AlertCircle className="w-3.5 h-3.5 mr-1" />
              Failed
            </Badge>
          )}
        </div>
        
        {/* Market Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-serif font-semibold text-foreground">
            {evaluation?.marketName || `${city}, ${state}`}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {bedrooms} Bedroom • {analysisType === 'both' ? 'Full Analysis' : analysisType === 'arbitrage' ? 'Rental Arbitrage' : 'Investment'}
          </p>
        </div>
        
        {/* Progress Steps */}
        {!isComplete && (
          <Card className="mb-8 border-border">
            <CardContent className="p-6">
              <div className="space-y-3">
                {EVALUATION_STEPS.map((step, idx) => {
                  const isActive = idx === currentStepIndex;
                  const isDone = idx < currentStepIndex;
                  const isPending = idx > currentStepIndex;
                  const StepIcon = step.icon;
                  
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                        isActive ? 'bg-primary/10 border border-primary/20' :
                        isDone ? 'bg-green-50/50' : 'opacity-40'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isDone ? 'bg-green-100 text-green-600' :
                        isActive ? 'bg-primary/20 text-primary' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : isActive ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <StepIcon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${
                          isActive ? 'text-foreground' : isDone ? 'text-green-700' : 'text-muted-foreground'
                        }`}>
                          {step.label}
                        </div>
                        <div className="text-xs text-muted-foreground">{step.description}</div>
                      </div>
                      {isDone && <span className="text-xs text-green-600 font-medium">Done</span>}
                      {isActive && <span className="text-xs text-primary font-medium">Running...</span>}
                    </div>
                  );
                })}
              </div>
              
              {/* Progress bar */}
              <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-gold-light rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${evaluation?.progress || 0}%` }}
                />
              </div>
              <p className="text-center text-xs text-muted-foreground mt-2">
                {evaluation?.progress || 0}% complete
              </p>
            </CardContent>
          </Card>
        )}
        
        {/* Results */}
        {isComplete && evaluation && (
          <div className="space-y-6">
            {/* Score Card */}
            <Card className="border-border overflow-hidden">
              <div className="bg-gradient-to-r from-foreground to-foreground/80 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-serif text-background/90">Market Score</h2>
                    <p className="text-background/50 text-sm mt-1">
                      Based on revenue, occupancy, ADR, competition, and seasonality
                    </p>
                  </div>
                  <ScoreGauge score={evaluation.marketScore || 0} />
                </div>
              </div>
              
              {/* Key Metrics */}
              <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-xl">
                    <DollarSign className="w-5 h-5 text-primary mx-auto mb-1" />
                    <div className="text-xl font-bold text-foreground font-serif">
                      ${(evaluation.averageRevenue || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Avg Annual Revenue</div>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-xl">
                    <BarChart3 className="w-5 h-5 text-primary mx-auto mb-1" />
                    <div className="text-xl font-bold text-foreground font-serif">
                      {Math.round(parseFloat(evaluation.averageOccupancy || '0') * 100)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Avg Occupancy</div>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
                    <div className="text-xl font-bold text-foreground font-serif">
                      ${evaluation.averageAdr || 0}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Avg Nightly Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* AI Investment Memo */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif">
                  <Brain className="w-5 h-5 text-primary" />
                  AI Investment Memo
                </CardTitle>
                <CardDescription>
                  Comprehensive analysis powered by Coach Inayah market data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none prose-headings:font-serif prose-headings:text-foreground prose-p:text-foreground/70 prose-li:text-foreground/70 prose-strong:text-foreground">
                  <LightMarkdown>{evaluation.aiMemo || ''}</LightMarkdown>
                </div>
              </CardContent>
            </Card>
            
            {/* Next Steps CTA */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6">
                <h3 className="text-lg font-serif font-semibold text-foreground mb-4">
                  Ready to Take Action?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate(`/?tab=opportunity&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`)}
                    className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Search className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">Find Properties</div>
                      <div className="text-xs text-muted-foreground">Browse listings for sale/rent in {city}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  
                  <button
                    onClick={() => navigate(`/deal-alerts?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&bedrooms=${bedrooms}`)}
                    className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Target className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">Set Up Deal Alerts</div>
                      <div className="text-xs text-muted-foreground">Get notified when deals match</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  
                  <button
                    onClick={() => navigate(`/?tab=advisor&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&autoAnalyze=true`)}
                    className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Brain className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">Chat with AI Advisor</div>
                      <div className="text-xs text-muted-foreground">Ask questions about {city}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  
                  <button
                    onClick={() => navigate(`/?tab=regulations&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&autoAnalyze=true`)}
                    className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <AlertCircle className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">Check Regulations</div>
                      <div className="text-xs text-muted-foreground">STR rules in {city}, {state}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Error state */}
        {isFailed && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-red-700 mb-2">Evaluation Failed</h3>
              <p className="text-red-600/70 text-sm mb-4">
                {evaluation?.errorMessage || 'An unexpected error occurred during the evaluation.'}
              </p>
              <Button
                onClick={() => {
                  setEvaluationId(null);
                  setIsRunning(false);
                }}
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-100"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
