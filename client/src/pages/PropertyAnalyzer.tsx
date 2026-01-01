/**
 * Property Analyzer - Lead Magnet One-Input Experience
 * 
 * Simple flow:
 * 1. User enters: Address + Rent + Beds + Baths
 * 2. System runs comprehensive analysis
 * 3. User sees amazing report
 * 4. CTA: Book a call with the team
 */

import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { 
  Search,
  Loader2,
  Home,
  DollarSign,
  BedDouble,
  Bath,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Clock,
  Target,
  Shield,
  Zap,
  Phone,
  ChevronDown,
  ChevronUp,
  MapPin,
  BarChart3,
  PieChart,
  Star,
  Building,
  Percent,
  CalendarDays,
  Banknote,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { toast } from 'sonner';

// Analysis result type
interface AnalysisResult {
  // Core data
  address: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  
  // Revenue estimates
  revenue: {
    low: number;
    mid: number;
    high: number;
  };
  
  // Lease Decision Verdict
  verdict: {
    rating: 'GO' | 'CAUTION' | 'PASS';
    confidence: number;
    summary: string;
    top_reasons: string[];
  };
  
  // Market data
  market: {
    name: string;
    occupancy: number;
    adr: number;
    active_listings: number;
  };
  
  // Competition
  competitors: Array<{
    name: string;
    annual_revenue: number;
    occupancy: number;
    rating: number | null;
    airbnb_url?: string;
    image_url?: string;
  }>;
  
  // Seasonality
  seasonality: Array<{
    month: string;
    revenue: number;
    season_type: 'Peak' | 'Shoulder' | 'Slow';
  }>;
  
  // Profitability
  profitability: {
    conservative: number;
    realistic: number;
    optimistic: number;
  };
  
  // Startup costs
  startup: {
    total_low: number;
    total_high: number;
  };
  
  // Break-even
  break_even: {
    months_conservative: number;
    months_realistic: number;
    months_optimistic: number;
  };
  
  // Supply trend
  supply_trend?: {
    current_listings: number;
    net_change: number;
    percent_change: number;
    trend: 'growing' | 'stable' | 'declining';
  };
  
  // Professional stats
  professional_stats?: {
    professional_percentage: number;
    superhost_percentage: number;
  };
  
  // Booking patterns
  booking_patterns?: {
    avg_lead_time_days: number;
    avg_length_of_stay: number;
  };
  
  // Amenity analysis
  amenities?: Array<{
    amenity: string;
    percentage_of_top_performers: number;
    recommendation: string;
  }>;
  
  // Risks
  risks?: Array<{
    category: string;
    description: string;
    severity: string;
    mitigation: string;
  }>;
  
  // Full report markdown
  full_report: string;
}

// Progress steps
const ANALYSIS_STEPS = [
  { id: 'property', label: 'Analyzing property details', icon: Home },
  { id: 'market', label: 'Researching market data', icon: BarChart3 },
  { id: 'competition', label: 'Studying competition', icon: Users },
  { id: 'seasonality', label: 'Calculating seasonality', icon: Calendar },
  { id: 'profitability', label: 'Projecting profitability', icon: DollarSign },
  { id: 'ai', label: 'AI generating insights', icon: Zap },
];

export default function PropertyAnalyzer() {
  // Form state
  const [address, setAddress] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['verdict', 'revenue', 'market']));
  
  // Results ref for scrolling
  const resultsRef = useRef<HTMLDivElement>(null);
  
  // Property Analysis mutation - uses dedicated structured endpoint
  const analyzePropertyMutation = trpc.advanced.analyzeProperty.useMutation();
  
  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };
  
  // Run analysis
  const runAnalysis = async () => {
    // Validate inputs
    if (!address.trim()) {
      toast.error('Please enter a property address');
      return;
    }
    if (!monthlyRent || parseFloat(monthlyRent) <= 0) {
      toast.error('Please enter the monthly rent');
      return;
    }
    if (!bedrooms || parseInt(bedrooms) <= 0) {
      toast.error('Please enter the number of bedrooms');
      return;
    }
    if (!bathrooms || parseFloat(bathrooms) <= 0) {
      toast.error('Please enter the number of bathrooms');
      return;
    }
    
    setIsAnalyzing(true);
    setCurrentStep(0);
    setError(null);
    setResult(null);
    
    // Simulate progress through steps
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < ANALYSIS_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 2500);
    
    try {
      // Call the dedicated property analysis endpoint
      const response = await analyzePropertyMutation.mutateAsync({
        address: address.trim(),
        monthly_rent: parseFloat(monthlyRent),
        bedrooms: parseInt(bedrooms),
        bathrooms: parseFloat(bathrooms)
      });
      
      clearInterval(stepInterval);
      setCurrentStep(ANALYSIS_STEPS.length);
      
      // Parse the response - now using structured data from analyzeProperty endpoint
      if (response.success && response.data) {
        const data = response.data;
        
        const analysisResult: AnalysisResult = {
          address: data.address,
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms,
          monthly_rent: data.monthly_rent,
          
          revenue: {
            low: data.percentiles?.median || (data.property_estimate?.estimates?.annual_revenue ?? 0) * 0.8 || 0,
            mid: data.percentiles?.top_25_percent || data.property_estimate?.estimates?.annual_revenue || 0,
            high: data.percentiles?.top_10_percent || (data.property_estimate?.estimates?.annual_revenue ?? 0) * 1.2 || 0,
          },
          
          verdict: data.ai_analysis?.verdict || {
            rating: 'CAUTION',
            confidence: 5,
            summary: 'Analysis complete. Review the details below.',
            top_reasons: []
          },
          
          market: {
            name: (data.property_estimate?.property as any)?.market_name || 'Local Market',
            occupancy: data.property_estimate?.estimates?.occupancy_rate || 65,
            adr: data.property_estimate?.estimates?.average_daily_rate || 150,
            active_listings: data.competitors?.length || 0
          },
          
          competitors: (data.competitors || []).slice(0, 10).map((c: any) => ({
            name: c.name || c.title,
            annual_revenue: c.annual_revenue,
            occupancy: c.occupancy,
            rating: c.rating,
            airbnb_url: c.airbnb_url,
            image_url: c.image_url
          })),
          
          seasonality: data.seasonality || [],
          
          profitability: {
            conservative: data.profitability?.scenarios?.conservative?.estimated_profit || 0,
            realistic: data.profitability?.scenarios?.realistic?.estimated_profit || 0,
            optimistic: data.profitability?.scenarios?.optimistic?.estimated_profit || 0
          },
          
          startup: {
            total_low: data.property_roi?.startup_costs?.total_low || data.bedrooms * 3000 + 2000,
            total_high: data.property_roi?.startup_costs?.total_high || data.bedrooms * 4500 + 3000
          },
          
          break_even: data.property_roi?.break_even || {
            months_conservative: 18,
            months_realistic: 12,
            months_optimistic: 8
          },
          
          supply_trend: data.supply_trend,
          professional_stats: data.professional_host_stats ? {
            professional_percentage: data.professional_host_stats.professional_percentage,
            superhost_percentage: data.professional_host_stats.superhost_percentage
          } : undefined,
          
          booking_patterns: data.booking_patterns ? {
            avg_lead_time_days: data.booking_patterns.booking_lead_time?.avg_days || 14,
            avg_length_of_stay: data.booking_patterns.length_of_stay?.avg_nights || 3
          } : undefined,
          
          amenities: data.amenity_analysis,
          risks: data.ai_analysis?.risk_assessment?.risks,
          
          full_report: data.full_report || ''
        };
        
        setResult(analysisResult);
        
        // Scroll to results
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        // Fallback if analysis failed
        setError(response.error || 'Analysis failed. Please try again.');
        toast.error(response.error || 'Analysis failed');
      }
      
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze property. Please try again.');
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Verdict color
  const getVerdictColor = (rating: string) => {
    switch (rating) {
      case 'GO': return 'text-green-500 bg-green-500/10 border-green-500/30';
      case 'CAUTION': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'PASS': return 'text-red-500 bg-red-500/10 border-red-500/30';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
  };
  
  // Verdict icon
  const getVerdictIcon = (rating: string) => {
    switch (rating) {
      case 'GO': return <ThumbsUp className="w-8 h-8" />;
      case 'CAUTION': return <AlertCircle className="w-8 h-8" />;
      case 'PASS': return <ThumbsDown className="w-8 h-8" />;
      default: return <HelpCircle className="w-8 h-8" />;
    }
  };
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Format month from date string (e.g., "2025-01" or "2025-01-01" -> "Jan")
  const formatMonth = (dateStr: string) => {
    if (!dateStr) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // Try to extract month from various formats
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const monthIndex = parseInt(parts[1], 10) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        return months[monthIndex];
      }
    }
    // Fallback: try to parse as date
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return months[date.getMonth()];
      }
    } catch {
      // Ignore parsing errors
    }
    return dateStr.slice(0, 3);
  };
  
  // Format percent - handles both decimal (0.65) and whole number (65) formats
  const formatPercent = (value: number) => {
    // If value is greater than 1, assume it's already a percentage
    if (value > 1) {
      return `${Math.round(value)}%`;
    }
    // Otherwise, it's a decimal that needs to be converted
    return `${Math.round(value * 100)}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/20 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Home className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Rental Revenue Calculator</h1>
                <p className="text-xs text-white/50">Powered by AirDNA + AI</p>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        {!result && !isAnalyzing && (
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Should You Sign That Lease?
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Enter a property below and get a comprehensive Airbnb arbitrage analysis in seconds. 
              We'll tell you exactly what you can expect to earn.
            </p>
          </div>
        )}
        
        {/* Input Form */}
        <div className={`bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 md:p-8 ${result ? 'mb-8' : ''}`}>
          <div className="grid gap-6">
            {/* Address Input with Autocomplete */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                <MapPin className="w-4 h-4 inline mr-2" />
                Property Address
              </label>
              <AddressAutocomplete
                value={address}
                onChange={(value) => setAddress(value)}
                onSelect={(selectedAddress) => setAddress(selectedAddress)}
                placeholder="Start typing an address..."
                disabled={isAnalyzing}
                inputClassName="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 text-lg"
              />
            </div>
            
            {/* Three Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Monthly Rent */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Monthly Rent
                </label>
                <Input
                  type="number"
                  placeholder="2,000"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12"
                  disabled={isAnalyzing}
                />
              </div>
              
              {/* Bedrooms */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  <BedDouble className="w-4 h-4 inline mr-2" />
                  Bedrooms
                </label>
                <Input
                  type="number"
                  placeholder="2"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12"
                  disabled={isAnalyzing}
                />
              </div>
              
              {/* Bathrooms */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  <Bath className="w-4 h-4 inline mr-2" />
                  Bathrooms
                </label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="1"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12"
                  disabled={isAnalyzing}
                />
              </div>
            </div>
            
            {/* Analyze Button */}
            <Button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Analyze This Property
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Loading State */}
        {isAnalyzing && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8 mt-8">
            <h3 className="text-xl font-semibold text-white mb-6 text-center">
              Running Deep Analysis...
            </h3>
            <div className="space-y-4">
              {ANALYSIS_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isComplete = index < currentStep;
                const isCurrent = index === currentStep;
                
                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                      isComplete ? 'bg-green-500/10' : isCurrent ? 'bg-amber-500/10' : 'bg-white/5'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isComplete ? 'bg-green-500' : isCurrent ? 'bg-amber-500' : 'bg-white/10'
                    }`}>
                      {isComplete ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : isCurrent ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <Icon className="w-5 h-5 text-white/50" />
                      )}
                    </div>
                    <span className={`font-medium ${
                      isComplete ? 'text-green-400' : isCurrent ? 'text-amber-400' : 'text-white/50'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mt-8">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}
        
        {/* Results */}
        {result && (
          <div ref={resultsRef} className="space-y-6 mt-8">
            {/* Verdict Card */}
            <div className={`rounded-2xl border-2 p-6 ${getVerdictColor(result.verdict.rating)}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  {getVerdictIcon(result.verdict.rating)}
                  <div>
                    <h3 className="text-2xl font-bold">{result.verdict.rating}</h3>
                    <p className="text-sm opacity-70">Confidence: {result.verdict.confidence}/10</p>
                  </div>
                </div>
              </div>
              <p className="text-lg">{result.verdict.summary}</p>
              {result.verdict.top_reasons && result.verdict.top_reasons.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {result.verdict.top_reasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            {/* Revenue Projections */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <button
                onClick={() => toggleSection('revenue')}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Revenue Projections</h3>
                </div>
                {expandedSections.has('revenue') ? (
                  <ChevronUp className="w-5 h-5 text-white/50" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-white/50" />
                )}
              </button>
              
              {expandedSections.has('revenue') && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <p className="text-sm text-white/50 mb-1">Conservative</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(result.revenue.low)}</p>
                    <p className="text-xs text-white/40">per year</p>
                  </div>
                  <div className="bg-amber-500/10 rounded-xl p-4 text-center border border-amber-500/30">
                    <p className="text-sm text-amber-400 mb-1">Realistic Target</p>
                    <p className="text-3xl font-bold text-amber-400">{formatCurrency(result.revenue.mid)}</p>
                    <p className="text-xs text-amber-400/60">per year</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <p className="text-sm text-white/50 mb-1">Optimistic</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(result.revenue.high)}</p>
                    <p className="text-xs text-white/40">per year</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Profitability */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <button
                onClick={() => toggleSection('profit')}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Annual Profit (After Rent & Expenses)</h3>
                </div>
                {expandedSections.has('profit') ? (
                  <ChevronUp className="w-5 h-5 text-white/50" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-white/50" />
                )}
              </button>
              
              {expandedSections.has('profit') && (
                <div className="mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <p className="text-sm text-white/50 mb-1">Conservative</p>
                      <p className={`text-2xl font-bold ${result.profitability.conservative >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(result.profitability.conservative)}
                      </p>
                    </div>
                    <div className="bg-emerald-500/10 rounded-xl p-4 text-center border border-emerald-500/30">
                      <p className="text-sm text-emerald-400 mb-1">Realistic</p>
                      <p className={`text-3xl font-bold ${result.profitability.realistic >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(result.profitability.realistic)}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <p className="text-sm text-white/50 mb-1">Optimistic</p>
                      <p className={`text-2xl font-bold ${result.profitability.optimistic >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(result.profitability.optimistic)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-sm text-white/70">
                      <strong className="text-white">What this means:</strong> After paying ${formatCurrency(result.monthly_rent)}/month rent 
                      and estimated expenses, you could profit {formatCurrency(result.profitability.realistic)} in your first year.
                      {result.profitability.realistic > 0 
                        ? ` That's ${formatCurrency(Math.round(result.profitability.realistic / 12))}/month in your pocket.`
                        : ' This property may not be profitable at this rent level.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Startup Costs & Break-Even */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <button
                onClick={() => toggleSection('startup')}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Startup Costs & Break-Even</h3>
                </div>
                {expandedSections.has('startup') ? (
                  <ChevronUp className="w-5 h-5 text-white/50" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-white/50" />
                )}
              </button>
              
              {expandedSections.has('startup') && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-white/70 mb-3">Estimated Startup Costs</h4>
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(result.startup.total_low)} - {formatCurrency(result.startup.total_high)}
                      </p>
                      <p className="text-sm text-white/50 mt-1">
                        Includes furniture, supplies, photos, and first month buffer
                      </p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white/70 mb-3">Break-Even Timeline</h4>
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-2xl font-bold text-white">
                        {result.break_even.months_realistic} months
                      </p>
                      <p className="text-sm text-white/50 mt-1">
                        Range: {result.break_even.months_optimistic}-{result.break_even.months_conservative} months
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Market Overview */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <button
                onClick={() => toggleSection('market')}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Market Overview</h3>
                </div>
                {expandedSections.has('market') ? (
                  <ChevronUp className="w-5 h-5 text-white/50" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-white/50" />
                )}
              </button>
              
              {expandedSections.has('market') && (
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <p className="text-sm text-white/50 mb-1">Market</p>
                    <p className="text-lg font-semibold text-white">{result.market.name}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <p className="text-sm text-white/50 mb-1">Avg Occupancy</p>
                    <p className="text-lg font-semibold text-white">{formatPercent(result.market.occupancy)}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <p className="text-sm text-white/50 mb-1">Avg Daily Rate</p>
                    <p className="text-lg font-semibold text-white">{formatCurrency(result.market.adr)}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <p className="text-sm text-white/50 mb-1">Active Listings</p>
                    <p className="text-lg font-semibold text-white">{result.market.active_listings.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Competition */}
            {result.competitors && result.competitors.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <button
                  onClick={() => toggleSection('competition')}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-orange-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">Your Competition ({result.competitors.length} similar properties)</h3>
                  </div>
                  {expandedSections.has('competition') ? (
                    <ChevronUp className="w-5 h-5 text-white/50" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  )}
                </button>
                
                {expandedSections.has('competition') && (
                  <div className="mt-6 space-y-3">
                    {result.competitors.slice(0, 5).map((comp, i) => (
                      <div key={i} className="bg-white/5 rounded-xl p-4 flex items-center gap-4">
                        {/* Listing Image */}
                        <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
                          {comp.image_url ? (
                            <img 
                              src={comp.image_url} 
                              alt={comp.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Home className="w-8 h-8 text-white/30" />
                            </div>
                          )}
                        </div>
                        
                        {/* Listing Details */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{comp.name}</p>
                          <p className="text-sm text-white/50">
                            {formatPercent(comp.occupancy)} occupancy
                            {comp.rating && ` • ${comp.rating} ★`}
                          </p>
                          {comp.airbnb_url && (
                            <a 
                              href={comp.airbnb_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 mt-1"
                            >
                              View on Airbnb <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        
                        {/* Revenue */}
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-green-400">{formatCurrency(comp.annual_revenue)}/yr</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Seasonality */}
            {result.seasonality && result.seasonality.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <button
                  onClick={() => toggleSection('seasonality')}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">Seasonality</h3>
                  </div>
                  {expandedSections.has('seasonality') ? (
                    <ChevronUp className="w-5 h-5 text-white/50" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  )}
                </button>
                
                {expandedSections.has('seasonality') && (
                  <div className="mt-6 grid grid-cols-3 md:grid-cols-6 gap-2">
                    {result.seasonality.slice(0, 12).map((month, i) => (
                      <div 
                        key={i} 
                        className={`rounded-lg p-3 text-center ${
                          month.season_type === 'Peak' ? 'bg-green-500/20 border border-green-500/30' :
                          month.season_type === 'Slow' ? 'bg-red-500/20 border border-red-500/30' :
                          'bg-white/5'
                        }`}
                      >
                        <p className="text-xs text-white/50">{formatMonth(month.month)}</p>
                        <p className={`text-sm font-semibold ${
                          month.season_type === 'Peak' ? 'text-green-400' :
                          month.season_type === 'Slow' ? 'text-red-400' :
                          'text-white'
                        }`}>
                          {formatCurrency(month.revenue)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Risks */}
            {result.risks && result.risks.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <button
                  onClick={() => toggleSection('risks')}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-red-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">Risks to Consider</h3>
                  </div>
                  {expandedSections.has('risks') ? (
                    <ChevronUp className="w-5 h-5 text-white/50" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  )}
                </button>
                
                {expandedSections.has('risks') && (
                  <div className="mt-6 space-y-4">
                    {result.risks.map((risk, i) => (
                      <div key={i} className="bg-white/5 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className={`w-5 h-5 ${
                            risk.severity === 'High' ? 'text-red-400' :
                            risk.severity === 'Medium' ? 'text-yellow-400' :
                            'text-blue-400'
                          }`} />
                          <span className="font-medium text-white">{risk.category}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            risk.severity === 'High' ? 'bg-red-500/20 text-red-400' :
                            risk.severity === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {risk.severity}
                          </span>
                        </div>
                        <p className="text-white/70 text-sm mb-2">{risk.description}</p>
                        <p className="text-white/50 text-sm">
                          <strong className="text-white/70">Mitigation:</strong> {risk.mitigation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* CTA Section */}
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-sm rounded-2xl border border-amber-500/30 p-8 text-center">
              <h3 className="text-2xl font-bold text-white mb-3">
                Want Expert Help With This Property?
              </h3>
              <p className="text-white/70 mb-6 max-w-xl mx-auto">
                Our team can help you set up this property for maximum revenue. 
                We handle everything from furnishing to listing optimization.
              </p>
              <Button
                className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0"
                onClick={() => {
                  // Open Calendly or booking link
                  window.open('https://calendly.com', '_blank');
                }}
              >
                <Phone className="w-5 h-5 mr-2" />
                Book a Free Strategy Call
              </Button>
              <p className="text-white/50 text-sm mt-4">
                No obligation. Just a conversation about your goals.
              </p>
            </div>
            
            {/* Analyze Another */}
            <div className="text-center">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={() => {
                  setResult(null);
                  setAddress('');
                  setMonthlyRent('');
                  setBedrooms('');
                  setBathrooms('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Analyze Another Property
              </Button>
            </div>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-white/5 bg-black/20 mt-16">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-white/40 text-sm">
            Data powered by AirDNA • Analysis powered by AI
          </p>
        </div>
      </footer>
    </div>
  );
}
