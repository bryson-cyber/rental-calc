/**
 * Market Evaluation Page
 * 
 * One-click comprehensive market evaluation — the "Evaluate This Market" agent.
 * Chains: market discovery → revenue analysis → trends → comps → AI memo
 */

import { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearch } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Streamdown } from 'streamdown';
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
  { id: 'market_discovery', label: 'Discovering Market', icon: Search, description: 'Finding AirDNA market data' },
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
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
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
      // The mutation now returns immediately with just the evaluationId.
      // The evaluation runs in the background; we poll via getEvaluation.
      setEvaluationId(data.evaluationId);
      // Keep isRunning true — the polling query will show progress
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
        return 2000; // Poll every 2s while running
      },
    }
  );
  
  const evaluation = evaluationQuery.data;
  const currentStepIndex = getStepIndex(evaluation?.currentStep || null);
  const isComplete = evaluation?.status === 'completed';
  const isFailed = evaluation?.status === 'failed';
  
  // Auto-start if city/state provided via URL params
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
  
  // Input form
  if (!evaluationId && !isRunning) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1e293b] to-[#0F172A]">
        <div className="max-w-2xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-10">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-white/50 hover:text-white/80 text-sm mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Calculator
            </button>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#C9A962]/20 rounded-xl mb-6 backdrop-blur-sm border border-[#C9A962]/30">
              <Sparkles className="w-8 h-8 text-[#C9A962]" />
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-semibold text-white mb-3">
              One-Click Market Evaluation
            </h1>
            <p className="text-white/60 font-sans max-w-lg mx-auto">
              Enter a city and get a comprehensive STR market analysis — revenue potential, competition, 
              seasonality, top performers, and an AI-generated investment memo. All in one click.
            </p>
          </div>
          
          {/* Form */}
          <Card className="bg-white/95 backdrop-blur-md border-0 shadow-2xl">
            <CardContent className="p-8">
              <div className="space-y-6">
                {/* City & State */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 uppercase tracking-wider">
                      City
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9A962]" />
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g., Las Vegas"
                        className="pl-10 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 uppercase tracking-wider">
                      State
                    </label>
                    <Input
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      placeholder="NV"
                      maxLength={2}
                      className="py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] text-center uppercase"
                    />
                  </div>
                </div>
                
                {/* Bedrooms */}
                <div>
                  <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 uppercase tracking-wider">
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
                            ? 'bg-[#0F172A] text-white shadow-md'
                            : 'bg-[#0F172A]/5 text-[#0F172A]/60 hover:bg-[#0F172A]/10'
                        }`}
                      >
                        {br} BR
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Analysis Type */}
                <div>
                  <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 uppercase tracking-wider">
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
                            ? 'border-[#C9A962] bg-[#C9A962]/5'
                            : 'border-[#0F172A]/10 hover:border-[#0F172A]/20'
                        }`}
                      >
                        <div className="text-sm font-medium text-[#0F172A]">{opt.label}</div>
                        <div className="text-xs text-[#0F172A]/50 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Email (optional) */}
                <div>
                  <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 uppercase tracking-wider">
                    Email <span className="text-[#0F172A]/40 normal-case">(optional — get a copy)</span>
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962]"
                  />
                </div>
                
                {/* Submit */}
                <Button
                  onClick={handleStart}
                  disabled={!city || !state}
                  className="w-full bg-[#0F172A] hover:bg-[#1e293b] text-white py-6 rounded-xl text-lg font-semibold group"
                >
                  <Sparkles className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Evaluate This Market
                </Button>
                
                <p className="text-center text-[#0F172A]/40 text-xs">
                  Takes 30-60 seconds. Powered by AirDNA market data + AI analysis.
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
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => {
              setEvaluationId(null);
              setIsRunning(false);
            }}
            className="inline-flex items-center gap-1.5 text-[#0F172A]/50 hover:text-[#0F172A]/80 text-sm transition-colors"
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
          <h1 className="text-2xl md:text-3xl font-serif font-semibold text-[#0F172A]">
            {evaluation?.marketName || `${city}, ${state}`}
          </h1>
          <p className="text-[#0F172A]/50 text-sm mt-1">
            {bedrooms} Bedroom • {analysisType === 'both' ? 'Full Analysis' : analysisType === 'arbitrage' ? 'Rental Arbitrage' : 'Investment'}
          </p>
        </div>
        
        {/* Progress Steps */}
        {!isComplete && (
          <Card className="mb-8 border-[#0F172A]/10">
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
                        isActive ? 'bg-[#C9A962]/10 border border-[#C9A962]/20' :
                        isDone ? 'bg-green-50/50' : 'opacity-40'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isDone ? 'bg-green-100 text-green-600' :
                        isActive ? 'bg-[#C9A962]/20 text-[#C9A962]' :
                        'bg-[#0F172A]/5 text-[#0F172A]/30'
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
                          isActive ? 'text-[#0F172A]' : isDone ? 'text-green-700' : 'text-[#0F172A]/40'
                        }`}>
                          {step.label}
                        </div>
                        <div className="text-xs text-[#0F172A]/40">{step.description}</div>
                      </div>
                      {isDone && <span className="text-xs text-green-600 font-medium">Done</span>}
                      {isActive && <span className="text-xs text-[#C9A962] font-medium">Running...</span>}
                    </div>
                  );
                })}
              </div>
              
              {/* Progress bar */}
              <div className="mt-4 h-2 bg-[#0F172A]/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#C9A962] to-[#d4b96f] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${evaluation?.progress || 0}%` }}
                />
              </div>
              <p className="text-center text-xs text-[#0F172A]/40 mt-2">
                {evaluation?.progress || 0}% complete
              </p>
            </CardContent>
          </Card>
        )}
        
        {/* Results */}
        {isComplete && evaluation && (
          <div className="space-y-6">
            {/* Score Card */}
            <Card className="border-[#0F172A]/10 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-serif text-white/90">Market Score</h2>
                    <p className="text-white/50 text-sm mt-1">
                      Based on revenue, occupancy, ADR, competition, and seasonality
                    </p>
                  </div>
                  <ScoreGauge score={evaluation.marketScore || 0} />
                </div>
              </div>
              
              {/* Key Metrics */}
              <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-[#0F172A]/3 rounded-xl">
                    <DollarSign className="w-5 h-5 text-[#C9A962] mx-auto mb-1" />
                    <div className="text-xl font-bold text-[#0F172A] font-serif">
                      ${(evaluation.averageRevenue || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-[#0F172A]/50 mt-0.5">Avg Annual Revenue</div>
                  </div>
                  <div className="text-center p-4 bg-[#0F172A]/3 rounded-xl">
                    <BarChart3 className="w-5 h-5 text-[#C9A962] mx-auto mb-1" />
                    <div className="text-xl font-bold text-[#0F172A] font-serif">
                      {Math.round(parseFloat(evaluation.averageOccupancy || '0') * 100)}%
                    </div>
                    <div className="text-xs text-[#0F172A]/50 mt-0.5">Avg Occupancy</div>
                  </div>
                  <div className="text-center p-4 bg-[#0F172A]/3 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-[#C9A962] mx-auto mb-1" />
                    <div className="text-xl font-bold text-[#0F172A] font-serif">
                      ${evaluation.averageAdr || 0}
                    </div>
                    <div className="text-xs text-[#0F172A]/50 mt-0.5">Avg Nightly Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* AI Investment Memo */}
            <Card className="border-[#0F172A]/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif">
                  <Brain className="w-5 h-5 text-[#C9A962]" />
                  AI Investment Memo
                </CardTitle>
                <CardDescription>
                  Comprehensive analysis powered by AirDNA market data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none prose-headings:font-serif prose-headings:text-[#0F172A] prose-p:text-[#0F172A]/70 prose-li:text-[#0F172A]/70 prose-strong:text-[#0F172A]">
                  <Streamdown>{evaluation.aiMemo || ''}</Streamdown>
                </div>
              </CardContent>
            </Card>
            
            {/* Next Steps CTA */}
            <Card className="border-[#C9A962]/30 bg-[#C9A962]/5">
              <CardContent className="p-6">
                <h3 className="text-lg font-serif font-semibold text-[#0F172A] mb-4">
                  Ready to Take Action?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate(`/?tab=prove&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&autoAnalyze=true`)}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-[#0F172A]/10 hover:border-[#C9A962]/50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#0F172A]/5 flex items-center justify-center group-hover:bg-[#C9A962]/10 transition-colors">
                      <Search className="w-5 h-5 text-[#0F172A]/60" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#0F172A]">Research Properties</div>
                      <div className="text-xs text-[#0F172A]/50">Find specific deals in {city}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#0F172A]/30" />
                  </button>
                  
                  <button
                    onClick={() => navigate(`/deal-alerts?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&bedrooms=${bedrooms}`)}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-[#0F172A]/10 hover:border-[#C9A962]/50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#0F172A]/5 flex items-center justify-center group-hover:bg-[#C9A962]/10 transition-colors">
                      <Target className="w-5 h-5 text-[#0F172A]/60" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#0F172A]">Set Up Deal Alerts</div>
                      <div className="text-xs text-[#0F172A]/50">Get notified when deals match</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#0F172A]/30" />
                  </button>
                  
                  <button
                    onClick={() => navigate(`/?tab=advisor&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&autoAnalyze=true`)}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-[#0F172A]/10 hover:border-[#C9A962]/50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#0F172A]/5 flex items-center justify-center group-hover:bg-[#C9A962]/10 transition-colors">
                      <Brain className="w-5 h-5 text-[#0F172A]/60" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#0F172A]">Chat with AI Advisor</div>
                      <div className="text-xs text-[#0F172A]/50">Ask questions about {city}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#0F172A]/30" />
                  </button>
                  
                  <button
                    onClick={() => navigate(`/?tab=regulations&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&autoAnalyze=true`)}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-[#0F172A]/10 hover:border-[#C9A962]/50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#0F172A]/5 flex items-center justify-center group-hover:bg-[#C9A962]/10 transition-colors">
                      <AlertCircle className="w-5 h-5 text-[#0F172A]/60" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#0F172A]">Check Regulations</div>
                      <div className="text-xs text-[#0F172A]/50">STR rules in {city}, {state}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#0F172A]/30" />
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
