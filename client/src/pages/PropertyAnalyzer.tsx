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
  ExternalLink,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { toast } from 'sonner';
import { FileText, FileSpreadsheet, Download, Loader2 as ExportLoader } from 'lucide-react';

// Export PDF Button Component
function ExportPDFButton({ address, monthlyRent, bedrooms, bathrooms }: {
  address: string;
  monthlyRent: number;
  bedrooms: number;
  bathrooms: number;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const exportMutation = trpc.export.pdf.useMutation();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportMutation.mutateAsync({
        address,
        monthly_rent: monthlyRent,
        bedrooms,
        bathrooms,
      });
      
      if (result.success && result.data) {
        // Convert base64 to blob and download
        const byteCharacters = atob(result.data.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.data.mimeType });
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('PDF report downloaded!');
      } else {
        toast.error(result.error || 'Failed to generate PDF');
      }
    } catch (error) {
      toast.error('Failed to generate PDF report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting}
      className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
    >
      {isExporting ? (
        <ExportLoader className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <FileText className="w-4 h-4 mr-2" />
      )}
      {isExporting ? 'Generating PDF...' : 'Download PDF'}
    </Button>
  );
}

// Export Excel Button Component
function ExportExcelButton({ address, monthlyRent, bedrooms, bathrooms }: {
  address: string;
  monthlyRent: number;
  bedrooms: number;
  bathrooms: number;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const exportMutation = trpc.export.excel.useMutation();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportMutation.mutateAsync({
        address,
        monthly_rent: monthlyRent,
        bedrooms,
        bathrooms,
      });
      
      if (result.success && result.data) {
        // Convert base64 to blob and download
        const byteCharacters = atob(result.data.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.data.mimeType });
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Excel report downloaded!');
      } else {
        toast.error(result.error || 'Failed to generate Excel');
      }
    } catch (error) {
      toast.error('Failed to generate Excel report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting}
      className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
    >
      {isExporting ? (
        <ExportLoader className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <FileSpreadsheet className="w-4 h-4 mr-2" />
      )}
      {isExporting ? 'Generating Excel...' : 'Download Excel'}
    </Button>
  );
}

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
  
  // Executive Summary (informational, not prescriptive)
  executive_summary: {
    summary: string;
    key_points: string[];
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
  
  // Seasonality (full data)
  seasonality: Array<{
    month: string;
    month_name?: string;
    revenue: number;
    occupancy: number;
    adr: number;
    season_type: 'peak' | 'shoulder' | 'off';
    pricing_recommendation?: string;
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
    insight?: string;
  };
  
  // Professional stats
  professional_stats?: {
    professional_percentage: number;
    superhost_percentage: number;
    avg_revenue_professional?: number;
    avg_revenue_individual?: number;
    revenue_premium_percent?: number;
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
  
  // Cancellation policies
  cancellation_policies?: {
    policies: Array<{
      policy: string;
      count: number;
      percentage: number;
      avg_revenue: number;
    }>;
    recommendation?: string;
  };
  
  // Future pricing forecasts
  future_pricing?: Array<{
    date: string;
    adr: number;
    occupancy: number;
    adr_percentile_25?: number;
    adr_percentile_75?: number;
  }>;
  
  // Historical trends
  historical_trends?: {
    occupancy: Array<{ date: string; value: number }>;
    adr: Array<{ date: string; value: number }>;
    revenue: Array<{ date: string; value: number }>;
  };
  
  // 5-Year Historical Summary
  five_year_summary?: {
    years_of_data: number;
    occupancy: {
      current_year_avg: number;
      five_year_avg: number;
      trend: 'increasing' | 'stable' | 'decreasing';
      percent_change: number;
      yearly_data: Array<{ year: number; avg: number }>;
    };
    adr: {
      current_year_avg: number;
      five_year_avg: number;
      trend: 'increasing' | 'stable' | 'decreasing';
      percent_change: number;
      yearly_data: Array<{ year: number; avg: number }>;
    };
    revenue: {
      current_year_avg: number;
      five_year_avg: number;
      trend: 'increasing' | 'stable' | 'decreasing';
      percent_change: number;
      yearly_data: Array<{ year: number; avg: number }>;
    };
    market_maturity: 'emerging' | 'growing' | 'mature' | 'saturated';
    insight: string;
  };
  
  // Gemini Historical Analysis
  historical_analysis?: {
    executive_summary: string;
    market_trajectory: 'accelerating_growth' | 'steady_growth' | 'maturing' | 'plateauing' | 'declining';
    key_findings: string[];
    investment_implications: string[];
    timing_recommendation: string;
    confidence_level: 'high' | 'medium' | 'low';
  };
  
  // Full report markdown
  full_report: string;
  
  // Comprehensive Narrative Report (Gemini-generated)
  narrative_report?: {
    executive_summary: string;
    market_overview: string;
    revenue_analysis: string;
    competitive_landscape: string;
    seasonal_strategy: string;
    historical_context: string;
    risk_assessment: string;
    financial_outlook: string;
    conclusion: string;
    key_metrics: {
      projected_annual_revenue: number;
      projected_monthly_profit: number;
      market_occupancy: number;
      market_adr: number;
      break_even_months: number;
      confidence_level: 'high' | 'medium' | 'low';
    };
    quick_facts: string[];
  };
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
  
  // Timer state for loading screen
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'revenue', 'market']));
  
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
    setElapsedTime(0);
    
    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
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
          
          executive_summary: {
            summary: data.ai_analysis?.verdict?.summary || 'Analysis complete. Review the market data and projections below to make an informed decision.',
            key_points: data.ai_analysis?.verdict?.top_reasons || []
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
          
          supply_trend: data.supply_trend ? {
            current_listings: data.supply_trend.current_listings,
            net_change: data.supply_trend.net_change,
            percent_change: data.supply_trend.percent_change,
            trend: data.supply_trend.trend,
            insight: data.supply_trend.insight
          } : undefined,
          
          professional_stats: data.professional_host_stats ? {
            professional_percentage: data.professional_host_stats.professional_percentage,
            superhost_percentage: data.professional_host_stats.superhost_percentage,
            avg_revenue_professional: data.professional_host_stats.avg_revenue_professional,
            avg_revenue_individual: data.professional_host_stats.avg_revenue_individual,
            revenue_premium_percent: data.professional_host_stats.revenue_premium_percent
          } : undefined,
          
          booking_patterns: data.booking_patterns ? {
            avg_lead_time_days: data.booking_patterns.booking_lead_time?.avg_days || 14,
            avg_length_of_stay: data.booking_patterns.length_of_stay?.avg_nights || 3
          } : undefined,
          
          amenities: data.amenity_analysis,
          risks: data.ai_analysis?.risk_assessment?.risks,
          
          cancellation_policies: data.cancellation_policies ? {
            policies: data.cancellation_policies.policies || [],
            recommendation: data.cancellation_policies.recommendation
          } : undefined,
          
          future_pricing: data.future_pricing,
          historical_trends: data.historical_trends,
          five_year_summary: data.five_year_summary,
          historical_analysis: data.historical_analysis,
          narrative_report: data.narrative_report,
          
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze property. Please try again.');
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">
                Running Deep Analysis...
              </h3>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-white font-mono text-lg">
                  {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-white/60">Progress</span>
                <span className="text-sm font-medium text-amber-400">
                  {Math.min(Math.round((currentStep / ANALYSIS_STEPS.length) * 100), 100)}%
                </span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min((currentStep / ANALYSIS_STEPS.length) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-white/40">Step {currentStep + 1} of {ANALYSIS_STEPS.length}</span>
                <span className="text-xs text-white/40">~{Math.max(0, Math.ceil((ANALYSIS_STEPS.length - currentStep) * 20))}s remaining</span>
              </div>
            </div>
            
            {elapsedTime > 30 && (
              <p className="text-white/60 text-sm text-center mb-4">
                {elapsedTime > 120 
                  ? "Almost there! The AI is generating your comprehensive insights..."
                  : elapsedTime > 60 
                    ? "Analyzing market data and competitors..."
                    : "This analysis typically takes 2-3 minutes for best results."}
              </p>
            )}
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
            
            {/* Narrative Report - Main Content */}
            {result.narrative_report ? (
              <div className="space-y-6">
                {/* Key Metrics Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl p-4 border border-green-500/20">
                    <p className="text-xs text-green-400/70 uppercase tracking-wide">Projected Revenue</p>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(result.narrative_report.key_metrics.projected_annual_revenue)}</p>
                    <p className="text-xs text-white/40">per year</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-xl p-4 border border-amber-500/20">
                    <p className="text-xs text-amber-400/70 uppercase tracking-wide">Monthly Profit</p>
                    <p className="text-2xl font-bold text-amber-400">{formatCurrency(result.narrative_report.key_metrics.projected_monthly_profit)}</p>
                    <p className="text-xs text-white/40">after expenses</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/10 rounded-xl p-4 border border-blue-500/20">
                    <p className="text-xs text-blue-400/70 uppercase tracking-wide">Market Occupancy</p>
                    <p className="text-2xl font-bold text-blue-400">{formatPercent(result.narrative_report.key_metrics.market_occupancy)}</p>
                    <p className="text-xs text-white/40">average</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/10 rounded-xl p-4 border border-purple-500/20">
                    <p className="text-xs text-purple-400/70 uppercase tracking-wide">Break Even</p>
                    <p className="text-2xl font-bold text-purple-400">{result.narrative_report.key_metrics.break_even_months} mo</p>
                    <p className="text-xs text-white/40">estimated</p>
                  </div>
                </div>
                
                {/* Quick Facts */}
                {result.narrative_report.quick_facts && result.narrative_report.quick_facts.length > 0 && (
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex flex-wrap gap-2">
                      {result.narrative_report.quick_facts.map((fact, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full text-sm text-white/80">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                          {fact}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Executive Summary */}
                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20 p-6">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-blue-400" />
                    Executive Summary
                  </h3>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <p className="text-white/90 leading-relaxed whitespace-pre-line">{result.narrative_report.executive_summary}</p>
                  </div>
                </div>
                
                {/* Market Overview */}
                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                  <button
                    onClick={() => toggleSection('market_overview')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-emerald-400" />
                      Market Overview
                    </h3>
                    {expandedSections.has('market_overview') ? (
                      <ChevronUp className="w-5 h-5 text-white/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-white/50" />
                    )}
                  </button>
                  {expandedSections.has('market_overview') && (
                    <div className="mt-4 prose prose-invert prose-sm max-w-none">
                      <p className="text-white/80 leading-relaxed whitespace-pre-line">{result.narrative_report.market_overview}</p>
                    </div>
                  )}
                </div>
                
                {/* Revenue Analysis */}
                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                  <button
                    onClick={() => toggleSection('revenue_analysis')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-400" />
                      Revenue Analysis
                    </h3>
                    {expandedSections.has('revenue_analysis') ? (
                      <ChevronUp className="w-5 h-5 text-white/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-white/50" />
                    )}
                  </button>
                  {expandedSections.has('revenue_analysis') && (
                    <div className="mt-4 prose prose-invert prose-sm max-w-none">
                      <p className="text-white/80 leading-relaxed whitespace-pre-line">{result.narrative_report.revenue_analysis}</p>
                    </div>
                  )}
                </div>
                
                {/* Competitive Landscape */}
                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                  <button
                    onClick={() => toggleSection('competitive')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-orange-400" />
                      Competitive Landscape
                    </h3>
                    {expandedSections.has('competitive') ? (
                      <ChevronUp className="w-5 h-5 text-white/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-white/50" />
                    )}
                  </button>
                  {expandedSections.has('competitive') && (
                    <div className="mt-4 prose prose-invert prose-sm max-w-none">
                      <p className="text-white/80 leading-relaxed whitespace-pre-line">{result.narrative_report.competitive_landscape}</p>
                    </div>
                  )}
                </div>
                
                {/* Seasonal Strategy */}
                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                  <button
                    onClick={() => toggleSection('seasonal')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-cyan-400" />
                      Seasonal Strategy
                    </h3>
                    {expandedSections.has('seasonal') ? (
                      <ChevronUp className="w-5 h-5 text-white/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-white/50" />
                    )}
                  </button>
                  {expandedSections.has('seasonal') && (
                    <div className="mt-4 prose prose-invert prose-sm max-w-none">
                      <p className="text-white/80 leading-relaxed whitespace-pre-line">{result.narrative_report.seasonal_strategy}</p>
                    </div>
                  )}
                </div>
                
                {/* Historical Context */}
                {result.narrative_report.historical_context && (
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                    <button
                      onClick={() => toggleSection('historical')}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                        Historical Context
                      </h3>
                      {expandedSections.has('historical') ? (
                        <ChevronUp className="w-5 h-5 text-white/50" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-white/50" />
                      )}
                    </button>
                    {expandedSections.has('historical') && (
                      <div className="mt-4 prose prose-invert prose-sm max-w-none">
                        <p className="text-white/80 leading-relaxed whitespace-pre-line">{result.narrative_report.historical_context}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Risk Assessment */}
                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                  <button
                    onClick={() => toggleSection('risks')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      Risk Assessment
                    </h3>
                    {expandedSections.has('risks') ? (
                      <ChevronUp className="w-5 h-5 text-white/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-white/50" />
                    )}
                  </button>
                  {expandedSections.has('risks') && (
                    <div className="mt-4 prose prose-invert prose-sm max-w-none">
                      <p className="text-white/80 leading-relaxed whitespace-pre-line">{result.narrative_report.risk_assessment}</p>
                    </div>
                  )}
                </div>
                
                {/* Financial Outlook */}
                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                  <button
                    onClick={() => toggleSection('financial')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                      <Banknote className="w-5 h-5 text-emerald-400" />
                      Financial Outlook
                    </h3>
                    {expandedSections.has('financial') ? (
                      <ChevronUp className="w-5 h-5 text-white/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-white/50" />
                    )}
                  </button>
                  {expandedSections.has('financial') && (
                    <div className="mt-4 prose prose-invert prose-sm max-w-none">
                      <p className="text-white/80 leading-relaxed whitespace-pre-line">{result.narrative_report.financial_outlook}</p>
                    </div>
                  )}
                </div>
                
                {/* Conclusion */}
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-500/20 p-6">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-400" />
                    Conclusion
                  </h3>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <p className="text-white/90 leading-relaxed whitespace-pre-line">{result.narrative_report.conclusion}</p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                    <span className="text-sm text-white/50">Confidence Level:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      result.narrative_report.key_metrics.confidence_level === 'high' 
                        ? 'bg-green-500/20 text-green-400' 
                        : result.narrative_report.key_metrics.confidence_level === 'medium'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {result.narrative_report.key_metrics.confidence_level.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Fallback to old Executive Summary Card if narrative report not available */
              <div className="rounded-2xl border-2 p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Analysis Summary</h3>
                </div>
                <p className="text-lg text-white/90 mb-4">{result.executive_summary.summary}</p>
                {result.executive_summary.key_points && result.executive_summary.key_points.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-white/60 font-medium">Key Points:</p>
                    <ul className="space-y-2">
                      {result.executive_summary.key_points.map((point: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-white/80">
                          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-400" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
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
            
            {/* Market Intelligence - Comprehensive Expert Analysis */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <button
                onClick={() => toggleSection('market')}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Market Intelligence Report</h3>
                </div>
                {expandedSections.has('market') ? (
                  <ChevronUp className="w-5 h-5 text-white/50" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-white/50" />
                )}
              </button>
              
              {expandedSections.has('market') && (
                <div className="mt-6 space-y-6">
                  {/* Market Header */}
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-5 border border-blue-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-white/50">Analyzing Market</p>
                        <h4 className="text-2xl font-bold text-white">{result.market.name}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-white/50">Market Health</p>
                        {(() => {
                          // Normalize occupancy to percentage (0-100 scale)
                          const occPct = result.market.occupancy > 1 ? result.market.occupancy : result.market.occupancy * 100;
                          return (
                            <div className={`text-lg font-bold ${
                              occPct >= 60 ? 'text-green-400' :
                              occPct >= 45 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {occPct >= 60 ? 'Strong' :
                               occPct >= 45 ? 'Moderate' : 'Weak'}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    {(() => {
                      const occPct = result.market.occupancy > 1 ? result.market.occupancy : result.market.occupancy * 100;
                      return (
                        <p className="text-white/70 text-sm">
                          This market has {result.market.active_listings.toLocaleString()} active short-term rental listings competing for guests. 
                          {occPct >= 60 
                            ? ' The high occupancy rate indicates strong demand, making this an attractive market for new listings.'
                            : occPct >= 45
                            ? ' Moderate occupancy suggests a balanced market with room for well-positioned listings.'
                            : ' Lower occupancy may indicate oversupply or seasonal factors - careful positioning is essential.'}
                        </p>
                      );
                    })()}
                  </div>
                  
                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Percent className="w-4 h-4 text-blue-400" />
                        <p className="text-sm text-white/50">Avg Occupancy</p>
                      </div>
                      <p className="text-2xl font-bold text-white">{formatPercent(result.market.occupancy)}</p>
                      {(() => {
                        const occPct = result.market.occupancy > 1 ? result.market.occupancy : result.market.occupancy * 100;
                        return (
                          <p className="text-xs text-white/40 mt-1">
                            {occPct >= 65 ? 'Above national avg (65%)' :
                             occPct >= 55 ? 'Near national avg (65%)' :
                             'Below national avg (65%)'}
                          </p>
                        );
                      })()}
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Banknote className="w-4 h-4 text-green-400" />
                        <p className="text-sm text-white/50">Avg Daily Rate</p>
                      </div>
                      <p className="text-2xl font-bold text-white">{formatCurrency(result.market.adr)}</p>
                      <p className="text-xs text-white/40 mt-1">
                        {result.market.adr >= 200 ? 'Premium pricing market' :
                         result.market.adr >= 120 ? 'Mid-range pricing' :
                         'Budget-friendly market'}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Building className="w-4 h-4 text-purple-400" />
                        <p className="text-sm text-white/50">Active Listings</p>
                      </div>
                      <p className="text-2xl font-bold text-white">{result.market.active_listings.toLocaleString()}</p>
                      <p className="text-xs text-white/40 mt-1">
                        {result.market.active_listings >= 500 ? 'Large, competitive market' :
                         result.market.active_listings >= 100 ? 'Medium-sized market' :
                         'Small, niche market'}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-amber-400" />
                        <p className="text-sm text-white/50">Est. RevPAR</p>
                      </div>
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(Math.round(result.market.adr * (result.market.occupancy > 1 ? result.market.occupancy / 100 : result.market.occupancy)))}
                      </p>
                      <p className="text-xs text-white/40 mt-1">Revenue per available night</p>
                    </div>
                  </div>
                  
                  {/* Supply Trend */}
                  {result.supply_trend && (
                    <div className="bg-white/5 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-semibold text-white flex items-center gap-2">
                          {result.supply_trend.trend === 'growing' ? (
                            <TrendingUp className="w-5 h-5 text-amber-400" />
                          ) : result.supply_trend.trend === 'declining' ? (
                            <TrendingDown className="w-5 h-5 text-green-400" />
                          ) : (
                            <BarChart3 className="w-5 h-5 text-blue-400" />
                          )}
                          Supply Trend (12 months)
                        </h5>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          result.supply_trend.trend === 'growing' ? 'bg-amber-500/20 text-amber-400' :
                          result.supply_trend.trend === 'declining' ? 'bg-green-500/20 text-green-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {result.supply_trend.trend === 'growing' ? `+${result.supply_trend.percent_change}% Growth` :
                           result.supply_trend.trend === 'declining' ? `${result.supply_trend.percent_change}% Decline` :
                           'Stable'}
                        </span>
                      </div>
                      <p className="text-white/70 text-sm">
                        {result.supply_trend.trend === 'growing' 
                          ? `The market has grown by ${result.supply_trend.net_change} listings (+${result.supply_trend.percent_change}%) over the past year. This indicates increasing competition - differentiation will be key to success.`
                          : result.supply_trend.trend === 'declining'
                          ? `The market has contracted by ${Math.abs(result.supply_trend.net_change)} listings (${result.supply_trend.percent_change}%) over the past year. This could indicate regulatory pressure or market correction, but also less competition for remaining hosts.`
                          : `The market has remained stable over the past year, indicating a mature market with balanced supply and demand.`}
                      </p>
                    </div>
                  )}
                  
                  {/* Professional Host Stats */}
                  {result.professional_stats && (
                    <div className="bg-white/5 rounded-xl p-5">
                      <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-400" />
                        Host Competition Analysis
                      </h5>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-white/50">Professional Hosts</p>
                          <p className="text-xl font-bold text-white">{result.professional_stats.professional_percentage}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-white/50">Superhosts</p>
                          <p className="text-xl font-bold text-white">{result.professional_stats.superhost_percentage}%</p>
                        </div>
                      </div>
                      <p className="text-white/70 text-sm">
                        {result.professional_stats.professional_percentage >= 50
                          ? `This is a professionally-dominated market (${result.professional_stats.professional_percentage}% professional hosts). You'll be competing against experienced operators who optimize pricing and guest experience. Professional management or strong execution is essential.`
                          : `This market is primarily individual hosts (${100 - result.professional_stats.professional_percentage}%). There's opportunity to outperform by operating with professional-level systems and service.`}
                      </p>
                    </div>
                  )}
                  
                  {/* Booking Patterns */}
                  {result.booking_patterns && (
                    <div className="bg-white/5 rounded-xl p-5">
                      <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-cyan-400" />
                        Guest Booking Behavior
                      </h5>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-white/50">Avg Booking Lead Time</p>
                          <p className="text-xl font-bold text-white">{result.booking_patterns.avg_lead_time_days} days</p>
                          <p className="text-xs text-white/40">
                            {result.booking_patterns.avg_lead_time_days <= 7 ? 'Last-minute market' :
                             result.booking_patterns.avg_lead_time_days <= 21 ? 'Short-term planners' :
                             'Advance planners'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-white/50">Avg Length of Stay</p>
                          <p className="text-xl font-bold text-white">{result.booking_patterns.avg_length_of_stay} nights</p>
                          <p className="text-xs text-white/40">
                            {result.booking_patterns.avg_length_of_stay <= 2 ? 'Weekend getaways' :
                             result.booking_patterns.avg_length_of_stay <= 5 ? 'Short vacations' :
                             'Extended stays'}
                          </p>
                        </div>
                      </div>
                      <p className="text-white/70 text-sm">
                        Guests in this market typically book {result.booking_patterns.avg_lead_time_days} days in advance for {result.booking_patterns.avg_length_of_stay}-night stays. 
                        {result.booking_patterns.avg_lead_time_days <= 14 
                          ? ' Consider dynamic pricing to capture last-minute bookings at premium rates.'
                          : ' Longer lead times allow for strategic pricing adjustments and promotional campaigns.'}
                      </p>
                    </div>
                  )}
                  
                  {/* Cancellation Policies */}
                  {result.cancellation_policies && result.cancellation_policies.policies && result.cancellation_policies.policies.length > 0 && (
                    <div className="bg-white/5 rounded-xl p-5">
                      <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-400" />
                        Cancellation Policy Analysis
                      </h5>
                      <div className="space-y-2 mb-3">
                        {result.cancellation_policies.policies.slice(0, 4).map((policy, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-white/70 capitalize">{policy.policy.replace(/_/g, ' ')}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-white/50 text-sm">{policy.percentage}% of listings</span>
                              <span className="text-white font-medium">{formatCurrency(policy.avg_revenue)}/yr avg</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {result.cancellation_policies.recommendation && (
                        <p className="text-white/70 text-sm border-t border-white/10 pt-3 mt-3">
                          <strong className="text-indigo-400">Recommendation:</strong> {result.cancellation_policies.recommendation}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Professional Host Revenue Premium */}
                  {result.professional_stats && result.professional_stats.avg_revenue_professional && result.professional_stats.avg_revenue_individual && (
                    <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-5 border border-purple-500/20">
                      <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <Award className="w-5 h-5 text-purple-400" />
                        Professional Management Premium
                      </h5>
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-white/50">Professional Avg Revenue</p>
                          <p className="text-xl font-bold text-purple-400">{formatCurrency(result.professional_stats.avg_revenue_professional)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-white/50">Individual Avg Revenue</p>
                          <p className="text-xl font-bold text-white">{formatCurrency(result.professional_stats.avg_revenue_individual)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-white/50">Revenue Premium</p>
                          <p className="text-xl font-bold text-green-400">+{result.professional_stats.revenue_premium_percent || Math.round((result.professional_stats.avg_revenue_professional / result.professional_stats.avg_revenue_individual - 1) * 100)}%</p>
                        </div>
                      </div>
                      <p className="text-white/70 text-sm">
                        Professional hosts in this market earn {result.professional_stats.revenue_premium_percent || Math.round((result.professional_stats.avg_revenue_professional / result.professional_stats.avg_revenue_individual - 1) * 100)}% more than individual hosts. 
                        Operating with professional-level systems (dynamic pricing, professional photos, automated messaging) can significantly boost your revenue.
                      </p>
                    </div>
                  )}
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
            
            {/* Seasonality - Comprehensive View */}
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
                    <h3 className="text-xl font-semibold text-white">Seasonality Analysis</h3>
                  </div>
                  {expandedSections.has('seasonality') ? (
                    <ChevronUp className="w-5 h-5 text-white/50" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  )}
                </button>
                
                {expandedSections.has('seasonality') && (
                  <div className="mt-6 space-y-6">
                    {/* Season Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                        <p className="text-xs text-green-400/70 mb-1">Peak Season</p>
                        <p className="text-lg font-bold text-green-400">
                          {result.seasonality.filter(m => m.season_type === 'peak').length} months
                        </p>
                        <p className="text-xs text-white/50 mt-1">
                          {result.seasonality.filter(m => m.season_type === 'peak').map(m => formatMonth(m.month)).join(', ')}
                        </p>
                      </div>
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
                        <p className="text-xs text-yellow-400/70 mb-1">Shoulder Season</p>
                        <p className="text-lg font-bold text-yellow-400">
                          {result.seasonality.filter(m => m.season_type === 'shoulder').length} months
                        </p>
                        <p className="text-xs text-white/50 mt-1">
                          {result.seasonality.filter(m => m.season_type === 'shoulder').map(m => formatMonth(m.month)).join(', ')}
                        </p>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                        <p className="text-xs text-red-400/70 mb-1">Slow Season</p>
                        <p className="text-lg font-bold text-red-400">
                          {result.seasonality.filter(m => m.season_type === 'off').length} months
                        </p>
                        <p className="text-xs text-white/50 mt-1">
                          {result.seasonality.filter(m => m.season_type === 'off').map(m => formatMonth(m.month)).join(', ')}
                        </p>
                      </div>
                    </div>
                    
                    {/* Monthly Breakdown Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-2 text-white/50 font-medium">Month</th>
                            <th className="text-right py-3 px-2 text-white/50 font-medium">Revenue</th>
                            <th className="text-right py-3 px-2 text-white/50 font-medium">Occupancy</th>
                            <th className="text-right py-3 px-2 text-white/50 font-medium">ADR</th>
                            <th className="text-center py-3 px-2 text-white/50 font-medium">Season</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.seasonality.slice(0, 12).map((month, i) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-3 px-2 text-white font-medium">{formatMonth(month.month)}</td>
                              <td className="py-3 px-2 text-right text-white">{formatCurrency(month.revenue)}</td>
                              <td className="py-3 px-2 text-right text-white">{formatPercent(month.occupancy)}</td>
                              <td className="py-3 px-2 text-right text-white">{formatCurrency(month.adr)}</td>
                              <td className="py-3 px-2 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  month.season_type === 'peak' ? 'bg-green-500/20 text-green-400' :
                                  month.season_type === 'off' ? 'bg-red-500/20 text-red-400' :
                                  'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                  {month.season_type}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-white/20">
                            <td className="py-3 px-2 text-white font-bold">Annual Total</td>
                            <td className="py-3 px-2 text-right text-green-400 font-bold">
                              {formatCurrency(result.seasonality.reduce((sum, m) => sum + m.revenue, 0))}
                            </td>
                            <td className="py-3 px-2 text-right text-white font-medium">
                              {formatPercent(result.seasonality.reduce((sum, m) => sum + m.occupancy, 0) / result.seasonality.length)}
                            </td>
                            <td className="py-3 px-2 text-right text-white font-medium">
                              {formatCurrency(result.seasonality.reduce((sum, m) => sum + m.adr, 0) / result.seasonality.length)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    
                    {/* Visual Revenue Chart */}
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-sm text-white/70 mb-3">Monthly Revenue Trend</p>
                      <div className="flex items-end gap-1" style={{ height: '128px' }}>
                        {result.seasonality.slice(0, 12).map((month, i) => {
                          const maxRevenue = Math.max(...result.seasonality.map(m => m.revenue));
                          const heightPx = maxRevenue > 0 ? Math.max((month.revenue / maxRevenue) * 100, 8) : 8;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                              <div 
                                className={`w-full rounded-t transition-all ${
                                  month.season_type === 'peak' ? 'bg-green-500' :
                                  month.season_type === 'off' ? 'bg-red-500' :
                                  'bg-yellow-500'
                                }`}
                                style={{ height: `${heightPx}px` }}
                              />
                              <span className="text-[10px] text-white/50 mt-1">{formatMonth(month.month).slice(0, 1)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Historical Trends - 12 Month Performance */}
            {result.historical_trends && (result.historical_trends.occupancy?.length > 0 || result.historical_trends.adr?.length > 0 || result.historical_trends.revenue?.length > 0) && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <button
                  onClick={() => toggleSection('historical')}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">12-Month Historical Performance</h3>
                  </div>
                  {expandedSections.has('historical') ? (
                    <ChevronUp className="w-5 h-5 text-white/50" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  )}
                </button>
                
                {expandedSections.has('historical') && (
                  <div className="mt-6 space-y-6">
                    {/* Occupancy Trend */}
                    {result.historical_trends.occupancy && result.historical_trends.occupancy.length > 0 && (
                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-sm text-white/70 mb-3 flex items-center gap-2">
                          <Percent className="w-4 h-4 text-blue-400" />
                          Occupancy Rate Trend (12 months)
                        </p>
                        <div className="flex items-end gap-1" style={{ height: '96px' }}>
                          {result.historical_trends.occupancy.slice(-12).map((point, i) => {
                            const maxVal = Math.max(...result.historical_trends!.occupancy!.map(p => p.value));
                            const heightPx = maxVal > 0 ? Math.max((point.value / maxVal) * 80, 8) : 8;
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                                <div 
                                  className="w-full rounded-t bg-blue-500 transition-all hover:bg-blue-400"
                                  style={{ height: `${heightPx}px` }}
                                  title={`${formatMonth(point.date)}: ${formatPercent(point.value)}`}
                                />
                                <span className="text-[10px] text-white/50 mt-1">{formatMonth(point.date).slice(0, 1)}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-white/50">
                          <span>Low: {formatPercent(Math.min(...result.historical_trends.occupancy.map(p => p.value)))}</span>
                          <span>High: {formatPercent(Math.max(...result.historical_trends.occupancy.map(p => p.value)))}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* ADR Trend */}
                    {result.historical_trends.adr && result.historical_trends.adr.length > 0 && (
                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-sm text-white/70 mb-3 flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-green-400" />
                          Average Daily Rate Trend (12 months)
                        </p>
                        <div className="flex items-end gap-1" style={{ height: '96px' }}>
                          {result.historical_trends.adr.slice(-12).map((point, i) => {
                            const maxVal = Math.max(...result.historical_trends!.adr!.map(p => p.value));
                            const heightPx = maxVal > 0 ? Math.max((point.value / maxVal) * 80, 8) : 8;
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                                <div 
                                  className="w-full rounded-t bg-green-500 transition-all hover:bg-green-400"
                                  style={{ height: `${heightPx}px` }}
                                  title={`${formatMonth(point.date)}: ${formatCurrency(point.value)}`}
                                />
                                <span className="text-[10px] text-white/50 mt-1">{formatMonth(point.date).slice(0, 1)}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-white/50">
                          <span>Low: {formatCurrency(Math.min(...result.historical_trends.adr.map(p => p.value)))}</span>
                          <span>High: {formatCurrency(Math.max(...result.historical_trends.adr.map(p => p.value)))}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Revenue Trend */}
                    {result.historical_trends.revenue && result.historical_trends.revenue.length > 0 && (
                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-sm text-white/70 mb-3 flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-amber-400" />
                          Monthly Revenue Trend (12 months)
                        </p>
                        <div className="flex items-end gap-1" style={{ height: '96px' }}>
                          {result.historical_trends.revenue.slice(-12).map((point, i) => {
                            const maxVal = Math.max(...result.historical_trends!.revenue!.map(p => p.value));
                            const heightPx = maxVal > 0 ? Math.max((point.value / maxVal) * 80, 8) : 8;
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                                <div 
                                  className="w-full rounded-t bg-amber-500 transition-all hover:bg-amber-400"
                                  style={{ height: `${heightPx}px` }}
                                  title={`${formatMonth(point.date)}: ${formatCurrency(point.value)}`}
                                />
                                <span className="text-[10px] text-white/50 mt-1">{formatMonth(point.date).slice(0, 1)}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-white/50">
                          <span>Low: {formatCurrency(Math.min(...result.historical_trends.revenue.map(p => p.value)))}</span>
                          <span>High: {formatCurrency(Math.max(...result.historical_trends.revenue.map(p => p.value)))}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Trend Summary */}
                    <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl p-4 border border-indigo-500/20">
                      <p className="text-white/70 text-sm">
                        <strong className="text-white">Trend Analysis:</strong> Historical data shows how this market has performed over the past year. 
                        {result.historical_trends.occupancy && result.historical_trends.occupancy.length > 1 && (() => {
                          const first = result.historical_trends!.occupancy![0].value;
                          const last = result.historical_trends!.occupancy![result.historical_trends!.occupancy!.length - 1].value;
                          const change = ((last - first) / first) * 100;
                          return change > 5 
                            ? ` Occupancy has increased by ${Math.abs(change).toFixed(1)}% - indicating growing demand.`
                            : change < -5
                            ? ` Occupancy has decreased by ${Math.abs(change).toFixed(1)}% - monitor market conditions.`
                            : ' Occupancy has remained relatively stable.';
                        })()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Future Pricing Forecasts */}
            {result.future_pricing && result.future_pricing.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <button
                  onClick={() => toggleSection('future')}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                      <CalendarDays className="w-5 h-5 text-teal-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">Future Pricing Forecast</h3>
                  </div>
                  {expandedSections.has('future') ? (
                    <ChevronUp className="w-5 h-5 text-white/50" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  )}
                </button>
                
                {expandedSections.has('future') && (
                  <div className="mt-6 space-y-6">
                    {/* Forecast Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white/5 rounded-xl p-4 text-center">
                        <p className="text-xs text-white/50 mb-1">Avg Forecasted ADR</p>
                        <p className="text-2xl font-bold text-white">
                          {formatCurrency(result.future_pricing.reduce((sum, d) => sum + d.adr, 0) / result.future_pricing.length)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4 text-center">
                        <p className="text-xs text-white/50 mb-1">Avg Forecasted Occupancy</p>
                        <p className="text-2xl font-bold text-white">
                          {formatPercent(result.future_pricing.reduce((sum, d) => sum + d.occupancy, 0) / result.future_pricing.length)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4 text-center">
                        <p className="text-xs text-white/50 mb-1">Forecast Period</p>
                        <p className="text-2xl font-bold text-white">{result.future_pricing.length} days</p>
                      </div>
                    </div>
                    
                    {/* ADR Forecast Chart */}
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-sm text-white/70 mb-3">Daily ADR Forecast</p>
                      <div className="flex items-end gap-px" style={{ height: '96px' }}>
                        {result.future_pricing.slice(0, 90).map((day, i) => {
                          const maxAdr = Math.max(...result.future_pricing!.slice(0, 90).map(d => d.adr));
                          const minAdr = Math.min(...result.future_pricing!.slice(0, 90).map(d => d.adr));
                          const range = maxAdr - minAdr;
                          const heightPx = range > 0 ? Math.max(((day.adr - minAdr) / range) * 70 + 16, 8) : 40;
                          return (
                            <div 
                              key={i} 
                              className="flex-1 bg-teal-500 hover:bg-teal-400 transition-all rounded-t"
                              style={{ height: `${heightPx}px` }}
                              title={`${day.date}: ${formatCurrency(day.adr)}`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-white/50">
                        <span>Next 90 days</span>
                        <span>Range: {formatCurrency(Math.min(...result.future_pricing.slice(0, 90).map(d => d.adr)))} - {formatCurrency(Math.max(...result.future_pricing.slice(0, 90).map(d => d.adr)))}</span>
                      </div>
                    </div>
                    
                    {/* Pricing Insight */}
                    <div className="bg-gradient-to-r from-teal-500/10 to-cyan-500/10 rounded-xl p-4 border border-teal-500/20">
                      <p className="text-white/70 text-sm">
                        <strong className="text-white">Pricing Strategy:</strong> Based on forecasted demand, 
                        {(() => {
                          const avgAdr = result.future_pricing!.reduce((sum, d) => sum + d.adr, 0) / result.future_pricing!.length;
                          const avgOcc = result.future_pricing!.reduce((sum, d) => sum + d.occupancy, 0) / result.future_pricing!.length;
                          const occPct = avgOcc > 1 ? avgOcc : avgOcc * 100;
                          return occPct >= 70
                            ? ` high demand is expected. Consider pricing at or above ${formatCurrency(avgAdr)} to maximize revenue.`
                            : occPct >= 50
                            ? ` moderate demand is expected. Price competitively around ${formatCurrency(avgAdr)} to capture bookings.`
                            : ` lower demand is forecasted. Consider promotional pricing below ${formatCurrency(avgAdr)} to drive bookings.`;
                        })()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* 5-Year Historical Summary */}
            {result.five_year_summary && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <button
                  onClick={() => toggleSection('fiveYear')}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">5-Year Market History</h3>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-violet-500/20 text-violet-400">
                      {result.five_year_summary.years_of_data} years of data
                    </span>
                  </div>
                  {expandedSections.has('fiveYear') ? (
                    <ChevronUp className="w-5 h-5 text-white/50" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  )}
                </button>
                
                {expandedSections.has('fiveYear') && (
                  <div className="mt-6 space-y-6">
                    {/* Market Maturity Badge */}
                    <div className="flex items-center gap-3">
                      <span className="text-white/70">Market Maturity:</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        result.five_year_summary.market_maturity === 'emerging' ? 'bg-green-500/20 text-green-400' :
                        result.five_year_summary.market_maturity === 'growing' ? 'bg-blue-500/20 text-blue-400' :
                        result.five_year_summary.market_maturity === 'mature' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {result.five_year_summary.market_maturity.charAt(0).toUpperCase() + result.five_year_summary.market_maturity.slice(1)}
                      </span>
                    </div>
                    
                    {/* Key Metrics Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      {/* Occupancy */}
                      <div className="bg-white/5 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Percent className="w-4 h-4 text-blue-400" />
                          <p className="text-sm text-white/70">Occupancy</p>
                        </div>
                        <p className="text-2xl font-bold text-white">{formatPercent(result.five_year_summary.occupancy.current_year_avg)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {result.five_year_summary.occupancy.trend === 'increasing' ? (
                            <TrendingUp className="w-4 h-4 text-green-400" />
                          ) : result.five_year_summary.occupancy.trend === 'decreasing' ? (
                            <TrendingDown className="w-4 h-4 text-red-400" />
                          ) : (
                            <span className="w-4 h-4 text-yellow-400">—</span>
                          )}
                          <span className={`text-sm ${
                            result.five_year_summary.occupancy.trend === 'increasing' ? 'text-green-400' :
                            result.five_year_summary.occupancy.trend === 'decreasing' ? 'text-red-400' :
                            'text-yellow-400'
                          }`}>
                            {result.five_year_summary.occupancy.percent_change > 0 ? '+' : ''}{result.five_year_summary.occupancy.percent_change}%
                          </span>
                        </div>
                        <p className="text-xs text-white/50 mt-1">5-yr avg: {formatPercent(result.five_year_summary.occupancy.five_year_avg)}</p>
                      </div>
                      
                      {/* ADR */}
                      <div className="bg-white/5 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-green-400" />
                          <p className="text-sm text-white/70">ADR</p>
                        </div>
                        <p className="text-2xl font-bold text-white">{formatCurrency(result.five_year_summary.adr.current_year_avg)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {result.five_year_summary.adr.trend === 'increasing' ? (
                            <TrendingUp className="w-4 h-4 text-green-400" />
                          ) : result.five_year_summary.adr.trend === 'decreasing' ? (
                            <TrendingDown className="w-4 h-4 text-red-400" />
                          ) : (
                            <span className="w-4 h-4 text-yellow-400">—</span>
                          )}
                          <span className={`text-sm ${
                            result.five_year_summary.adr.trend === 'increasing' ? 'text-green-400' :
                            result.five_year_summary.adr.trend === 'decreasing' ? 'text-red-400' :
                            'text-yellow-400'
                          }`}>
                            {result.five_year_summary.adr.percent_change > 0 ? '+' : ''}{result.five_year_summary.adr.percent_change}%
                          </span>
                        </div>
                        <p className="text-xs text-white/50 mt-1">5-yr avg: {formatCurrency(result.five_year_summary.adr.five_year_avg)}</p>
                      </div>
                      
                      {/* Revenue */}
                      <div className="bg-white/5 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Banknote className="w-4 h-4 text-amber-400" />
                          <p className="text-sm text-white/70">Monthly Revenue</p>
                        </div>
                        <p className="text-2xl font-bold text-white">{formatCurrency(result.five_year_summary.revenue.current_year_avg)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {result.five_year_summary.revenue.trend === 'increasing' ? (
                            <TrendingUp className="w-4 h-4 text-green-400" />
                          ) : result.five_year_summary.revenue.trend === 'decreasing' ? (
                            <TrendingDown className="w-4 h-4 text-red-400" />
                          ) : (
                            <span className="w-4 h-4 text-yellow-400">—</span>
                          )}
                          <span className={`text-sm ${
                            result.five_year_summary.revenue.trend === 'increasing' ? 'text-green-400' :
                            result.five_year_summary.revenue.trend === 'decreasing' ? 'text-red-400' :
                            'text-yellow-400'
                          }`}>
                            {result.five_year_summary.revenue.percent_change > 0 ? '+' : ''}{result.five_year_summary.revenue.percent_change}%
                          </span>
                        </div>
                        <p className="text-xs text-white/50 mt-1">5-yr avg: {formatCurrency(result.five_year_summary.revenue.five_year_avg)}</p>
                      </div>
                    </div>
                    
                    {/* Year-by-Year Chart */}
                    {result.five_year_summary.revenue.yearly_data.length > 1 && (
                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-sm text-white/70 mb-4">Year-over-Year Revenue Trend</p>
                        <div className="flex items-end gap-2" style={{ height: '128px' }}>
                          {result.five_year_summary.revenue.yearly_data.map((yearData, i) => {
                            const maxVal = Math.max(...result.five_year_summary!.revenue.yearly_data.map(y => y.avg));
                            const heightPx = maxVal > 0 ? Math.max((yearData.avg / maxVal) * 100, 12) : 12;
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                                <div 
                                  className="w-full rounded-t bg-gradient-to-t from-violet-600 to-violet-400 transition-all hover:from-violet-500 hover:to-violet-300"
                                  style={{ height: `${heightPx}px` }}
                                  title={`${yearData.year}: ${formatCurrency(yearData.avg)}/mo`}
                                />
                                <span className="text-xs text-white/70 mt-2">{yearData.year}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Gemini AI Analysis */}
                    {result.historical_analysis ? (
                      <div className="space-y-4">
                        {/* Executive Summary */}
                        <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl p-4 border border-violet-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-violet-400" />
                            <span className="text-sm font-medium text-violet-400">AI Market Analysis</span>
                            <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${
                              result.historical_analysis.confidence_level === 'high' ? 'bg-green-500/20 text-green-400' :
                              result.historical_analysis.confidence_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {result.historical_analysis.confidence_level} confidence
                            </span>
                          </div>
                          <p className="text-white/90 text-sm leading-relaxed">
                            {result.historical_analysis.executive_summary}
                          </p>
                        </div>
                        
                        {/* Market Trajectory */}
                        <div className="flex items-center gap-3">
                          <span className="text-white/70 text-sm">Market Trajectory:</span>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            result.historical_analysis.market_trajectory === 'accelerating_growth' ? 'bg-green-500/20 text-green-400' :
                            result.historical_analysis.market_trajectory === 'steady_growth' ? 'bg-emerald-500/20 text-emerald-400' :
                            result.historical_analysis.market_trajectory === 'maturing' ? 'bg-blue-500/20 text-blue-400' :
                            result.historical_analysis.market_trajectory === 'plateauing' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {result.historical_analysis.market_trajectory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                        
                        {/* Key Findings */}
                        {result.historical_analysis.key_findings.length > 0 && (
                          <div className="bg-white/5 rounded-xl p-4">
                            <p className="text-sm font-medium text-white mb-3">Key Findings</p>
                            <ul className="space-y-2">
                              {result.historical_analysis.key_findings.map((finding, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                                  <span className="text-violet-400 mt-1">•</span>
                                  {finding}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Investment Implications */}
                        {result.historical_analysis.investment_implications.length > 0 && (
                          <div className="bg-white/5 rounded-xl p-4">
                            <p className="text-sm font-medium text-white mb-3">Investment Implications</p>
                            <ul className="space-y-2">
                              {result.historical_analysis.investment_implications.map((implication, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                                  <span className="text-amber-400 mt-1">→</span>
                                  {implication}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Timing Recommendation */}
                        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-amber-400" />
                            <span className="text-sm font-medium text-amber-400">Timing Recommendation</span>
                          </div>
                          <p className="text-white/90 text-sm">
                            {result.historical_analysis.timing_recommendation}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl p-4 border border-violet-500/20">
                        <p className="text-white/70 text-sm">
                          <strong className="text-white">Historical Insight:</strong> {result.five_year_summary.insight}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Amenity Analysis */}
            {result.amenities && result.amenities.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <button
                  onClick={() => toggleSection('amenities')}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                      <Star className="w-5 h-5 text-pink-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">Amenity Analysis</h3>
                  </div>
                  {expandedSections.has('amenities') ? (
                    <ChevronUp className="w-5 h-5 text-white/50" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  )}
                </button>
                
                {expandedSections.has('amenities') && (
                  <div className="mt-6 space-y-4">
                    <p className="text-white/70 text-sm mb-4">
                      These amenities are most common among top-performing properties in your market:
                    </p>
                    {result.amenities.slice(0, 10).map((amenity, i) => (
                      <div key={i} className="bg-white/5 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-white capitalize">{amenity.amenity.replace(/_/g, ' ')}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            amenity.percentage_of_top_performers >= 80 ? 'bg-green-500/20 text-green-400' :
                            amenity.percentage_of_top_performers >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {amenity.percentage_of_top_performers}% of top performers
                          </span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                          <div 
                            className={`h-2 rounded-full ${
                              amenity.percentage_of_top_performers >= 80 ? 'bg-green-500' :
                              amenity.percentage_of_top_performers >= 50 ? 'bg-yellow-500' :
                              'bg-blue-500'
                            }`}
                            style={{ width: `${amenity.percentage_of_top_performers}%` }}
                          />
                        </div>
                        <p className="text-white/50 text-sm">{amenity.recommendation}</p>
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
            
            {/* Export Buttons */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Download className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Export Report</h3>
                </div>
              </div>
              <p className="text-white/60 text-sm mb-4">
                Download this analysis as a professional PDF report or Excel spreadsheet for your records.
              </p>
              <div className="flex flex-wrap gap-3">
                <ExportPDFButton 
                  address={result.address}
                  monthlyRent={result.monthly_rent}
                  bedrooms={result.bedrooms}
                  bathrooms={result.bathrooms}
                />
                <ExportExcelButton 
                  address={result.address}
                  monthlyRent={result.monthly_rent}
                  bedrooms={result.bedrooms}
                  bathrooms={result.bathrooms}
                />
              </div>
            </div>
            
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
