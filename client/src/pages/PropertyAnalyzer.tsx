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
import { TypeformOverlay } from '@/components/TypeformOverlay';
import { toast } from 'sonner';
import { FileText, FileSpreadsheet, Download, Loader2 as ExportLoader } from 'lucide-react';
import NarrativeSkeleton, { InlineNarrativeSkeleton } from '@/components/NarrativeSkeleton';

// Export PDF Button Component with Progress Indicator
function ExportPDFButton({ address, monthlyRent, bedrooms, bathrooms, analysisData }: {
  address: string;
  monthlyRent: number;
  bedrooms: number;
  bathrooms: number;
  analysisData?: any;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  // Use pdfFromData if we have existing analysis data, otherwise fall back to pdf
  const exportFromDataMutation = trpc.export.pdfFromData.useMutation();
  const exportMutation = trpc.export.pdf.useMutation();
  const abortRef = useRef(false);

  const handleExport = async () => {
    abortRef.current = false;
    setIsExporting(true);
    setProgress(0);
    setStatusMessage('Preparing report data...');
    
    // If we have existing analysis data, use fast path (no re-analysis)
    const hasExistingData = !!analysisData;
    
    // Progress stages - much faster if using existing data
    const progressStages = hasExistingData ? [
      { progress: 30, message: 'Preparing report...', delay: 200 },
      { progress: 60, message: 'Generating PDF layout...', delay: 500 },
      { progress: 90, message: 'Finalizing document...', delay: 1000 },
    ] : [
      { progress: 15, message: 'Gathering market data...', delay: 800 },
      { progress: 30, message: 'Analyzing competitors...', delay: 1500 },
      { progress: 45, message: 'Calculating projections...', delay: 2000 },
      { progress: 60, message: 'Building report sections...', delay: 3000 },
      { progress: 75, message: 'Generating PDF layout...', delay: 4500 },
      { progress: 90, message: 'Finalizing document...', delay: 6000 },
    ];
    
    // Start progress animation using ref to avoid stale closure
    progressStages.forEach(({ progress: p, message, delay }) => {
      setTimeout(() => {
        if (!abortRef.current) {
          setProgress(p);
          setStatusMessage(message);
        }
      }, delay);
    });
    
    try {
      // Use existing data if available (fast path), otherwise re-run analysis
      const result = hasExistingData 
        ? await exportFromDataMutation.mutateAsync({ analysisData })
        : await exportMutation.mutateAsync({
            address,
            monthly_rent: monthlyRent,
            bedrooms,
            bathrooms,
          });
      
      setProgress(100);
      setStatusMessage('Download ready!');
      
      // Create download link
      const link = document.createElement('a');
      link.href = `data:${result.data!.mimeType};base64,${result.data!.base64}`;
      link.download = result.data!.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('PDF report downloaded successfully!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      abortRef.current = true;
      setTimeout(() => {
        setIsExporting(false);
        setProgress(0);
        setStatusMessage('');
      }, 1000);
    }
  };

  return (
    <div className="relative">
      <Button
        onClick={handleExport}
        disabled={isExporting}
        variant="outline"
        className="border-[#C9A962] text-[#C9A962] hover:bg-[#C9A962]/10"
      >
        {isExporting ? (
          <>
            <ExportLoader className="w-4 h-4 mr-2 animate-spin" />
            {progress}%
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Download PDF
          </>
        )}
      </Button>
      
      {/* Progress tooltip */}
      {isExporting && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg p-3 min-w-[200px] z-10 border border-[#0F172A]/10">
          <div className="h-2 bg-[#0F172A]/10 rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-gradient-to-r from-[#C9A962] to-[#D4A84B] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-[#0F172A]/70">{statusMessage}</p>
        </div>
      )}
    </div>
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
      
      // Create download link
      const link = document.createElement('a');
      link.href = `data:${result.data!.mimeType};base64,${result.data!.base64}`;
      link.download = result.data!.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Excel spreadsheet downloaded successfully!');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Failed to generate Excel file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting}
      variant="outline"
      className="border-[#0F172A]/20 text-[#0F172A] hover:bg-[#0F172A]/5"
    >
      {isExporting ? (
        <>
          <ExportLoader className="w-4 h-4 mr-2 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Download Excel
        </>
      )}
    </Button>
  );
}

// Analysis steps for progress indicator
const ANALYSIS_STEPS = [
  { id: 1, label: 'Analyzing property details', icon: Home },
  { id: 2, label: 'Researching market data', icon: BarChart3 },
  { id: 3, label: 'Studying competition', icon: Users },
  { id: 4, label: 'Calculating seasonality', icon: Calendar },
  { id: 5, label: 'Projecting profitability', icon: DollarSign },
  { id: 6, label: 'AI generating insights', icon: Zap },
];

// Types for the analysis result
interface AnalysisResult {
  address: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  
  revenue: {
    low: number;
    mid: number;
    high: number;
  };
  
  executive_summary: {
    summary: string;
    key_points: string[];
  };
  
  market: {
    name: string;
    occupancy: number;
    adr: number;
    active_listings: number;
  };
  
  competitors: Array<{
    name: string;
    annual_revenue: number;
    occupancy: number;
    rating: number;
    airbnb_url?: string;
    image_url?: string;
    distance_meters?: number;
  }>;
  
  seasonality: Array<{
    month: string;
    revenue: number;
    occupancy: number;
  }>;
  
  profitability: {
    conservative: number;
    realistic: number;
    optimistic: number;
  };
  
  startup: {
    total_low: number;
    total_high: number;
  };
  
  break_even: {
    months_conservative: number;
    months_realistic: number;
    months_optimistic: number;
  };
  
  supply_trend?: {
    current_listings: number;
    net_change: number;
    percent_change: number;
    trend: 'growing' | 'declining' | 'stable';
    insight: string;
  };
  
  professional_stats?: {
    professional_percentage: number;
    superhost_percentage: number;
    avg_revenue_professional: number;
    avg_revenue_individual: number;
  };
  
  booking_patterns?: {
    avg_lead_time_days: number;
    avg_length_of_stay: number;
    weekend_premium_percent: number;
    last_minute_discount_percent: number;
  };
  
  cancellation_policies?: {
    policies: Array<{
      policy: string;
      percentage: number;
      avg_revenue: number;
    }>;
    recommendation: string;
  };
  
  amenity_analysis?: {
    top_amenities: Array<{
      amenity: string;
      percentage: number;
      revenue_impact: number;
    }>;
    missing_opportunities: string[];
  };
  
  historical_trends?: {
    occupancy?: Array<{ date: string; value: number }>;
    adr?: Array<{ date: string; value: number }>;
    revenue?: Array<{ date: string; value: number }>;
  };
  
  five_year_summary?: {
    occupancy: {
      current_year_avg: number;
      five_year_avg: number;
      percent_change: number;
      trend: 'increasing' | 'decreasing' | 'stable';
      yearly_data: Array<{ year: number; avg: number }>;
    };
    adr: {
      current_year_avg: number;
      five_year_avg: number;
      percent_change: number;
      trend: 'increasing' | 'decreasing' | 'stable';
      yearly_data: Array<{ year: number; avg: number }>;
    };
    revenue: {
      current_year_avg: number;
      five_year_avg: number;
      percent_change: number;
      trend: 'increasing' | 'decreasing' | 'stable';
      yearly_data: Array<{ year: number; avg: number }>;
    };
  };
  
  historical_analysis?: {
    executive_summary: string;
    market_trajectory: string;
    key_findings: string[];
    risks: string[];
    opportunities: string[];
    confidence_level: 'high' | 'medium' | 'low';
  };
  
  pricing_forecast?: Array<{
    month: string;
    predicted_adr: number;
    predicted_occupancy: number;
    confidence: number;
  }>;
  
  narrative_report?: {
    executive_summary: string;
    market_overview: string;
    revenue_analysis: string;
    competitive_landscape: string;
    seasonal_strategy: string;
    historical_context?: string;
    risk_assessment: string;
    financial_outlook: string;
    conclusion: string;
    key_metrics: {
      projected_annual_revenue: number;
      projected_monthly_profit: number;
      market_occupancy: number;
      break_even_months: number | string;
    };
    quick_facts: string[];
  };
  
  full_report?: string;
}

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
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isNarrativeLoading, setIsNarrativeLoading] = useState(false);
  
  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['market_overview', 'revenue_analysis', 'competitive', 'seasonal', 'risks', 'financial', 'conclusion']));
  const resultsRef = useRef<HTMLDivElement>(null);
  
  // Typeform gate state
  const [showTypeformGate, setShowTypeformGate] = useState(false);
  const [hasCompletedTypeform, setHasCompletedTypeform] = useState(() => {
    // Check if user has already completed the form (stored in localStorage)
    return localStorage.getItem('typeform_completed') === 'true';
  });
  
  // Timer for elapsed time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);
  
  // tRPC mutation for analysis
  const analysisMutation = trpc.advanced.analyzeProperty.useMutation();
  
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
  
  const runAnalysis = async () => {
    // Validation
    if (!address.trim()) {
      toast.error('Please enter a property address');
      return;
    }
    if (!monthlyRent || parseFloat(monthlyRent) <= 0) {
      toast.error('Please enter a valid monthly rent');
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
    setCurrentStep(1);
    setError(null);
    setResult(null);
    setIsNarrativeLoading(false);
    
    // Simulate step progression
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < ANALYSIS_STEPS.length) {
          return prev + 1;
        }
        return prev;
      });
    }, 15000); // Move to next step every 15 seconds
    
    try {
      const response = await analysisMutation.mutateAsync({
        address: address.trim(),
        monthly_rent: parseFloat(monthlyRent),
        bedrooms: parseInt(bedrooms),
        bathrooms: parseFloat(bathrooms),
      });
      
      clearInterval(stepInterval);
      setCurrentStep(ANALYSIS_STEPS.length);
      
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
            summary: data.ai_analysis?.executive_summary || 'Analysis complete. Review the market data and projections below to make an informed decision.',
            key_points: (data.ai_analysis as any)?.key_points || []
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
            image_url: c.image_url,
            distance_meters: c.distance_meters
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
            avg_revenue_individual: data.professional_host_stats.avg_revenue_individual
          } : undefined,
          
          booking_patterns: data.booking_patterns ? {
            avg_lead_time_days: (data.booking_patterns as any).avg_lead_time_days || (data.booking_patterns as any).lead_time || 0,
            avg_length_of_stay: (data.booking_patterns as any).avg_length_of_stay || (data.booking_patterns as any).length_of_stay || 0,
            weekend_premium_percent: (data.booking_patterns as any).weekend_premium_percent || 0,
            last_minute_discount_percent: (data.booking_patterns as any).last_minute_discount_percent || 0
          } : undefined,
          
          cancellation_policies: data.cancellation_policies ? {
            policies: data.cancellation_policies.policies,
            recommendation: data.cancellation_policies.recommendation
          } : undefined,
          
          amenity_analysis: data.amenity_analysis ? {
            top_amenities: (data.amenity_analysis as any).top_amenities || [],
            missing_opportunities: (data.amenity_analysis as any).missing_opportunities || []
          } : undefined,
          
          historical_trends: data.historical_trends ? {
            occupancy: data.historical_trends.occupancy,
            adr: data.historical_trends.adr,
            revenue: data.historical_trends.revenue
          } : undefined,
          
          five_year_summary: data.five_year_summary,
          
          historical_analysis: data.historical_analysis as any,
          
          pricing_forecast: (data as any).pricing_forecast,
          
          narrative_report: data.enhanced_narrative_report || data.narrative_report,
          
          full_report: data.full_report || ''
        };
        
        // If no narrative report yet, show skeleton and set flag
        if (!analysisResult.narrative_report) {
          setIsNarrativeLoading(true);
        } else {
          setIsNarrativeLoading(false);
        }
        
        setResult(analysisResult);
        
        // Typeform gate removed - users see results immediately
        // if (!hasCompletedTypeform) {
        //   setShowTypeformGate(true);
        // }
        
        // Scroll to results
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        setError(response.error || 'Analysis failed. Please try again.');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error('Analysis error:', err);
      
      // Detect timeout or network errors and show helpful message
      const errorMessage = err.message || '';
      if (errorMessage.includes('timeout') || errorMessage.includes('aborted') || errorMessage.includes('network')) {
        setError('The analysis is taking longer than expected. This can happen during peak times. Please try again in a few moments.');
      } else if (errorMessage.includes('HTML') || errorMessage.includes('not valid JSON')) {
        setError('Our AI service is temporarily busy. Please try again in a minute.');
      } else {
        setError(errorMessage || 'An error occurred during analysis. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Helper functions
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };
  
  const formatPercent = (value: number) => {
    // Handle null/undefined/NaN
    if (!value || isNaN(value)) return '0%';
    
    // If value is greater than 1 but less than 2, it's likely a decimal like 0.8 that was stored incorrectly
    // Values like 0.008 (0.8%) should become 0.8%, not 1%
    // Values like 0.8 (80%) should become 80%
    // Values like 80 should stay 80%
    
    if (value > 100) {
      // Clearly a percentage already, but too high - cap at 100
      return '100%';
    } else if (value > 1) {
      // Already a percentage (e.g., 80 means 80%)
      return `${Math.round(value)}%`;
    } else if (value > 0.01) {
      // Decimal that needs conversion (e.g., 0.80 means 80%)
      return `${Math.round(value * 100)}%`;
    } else {
      // Very small decimal - likely data error, show as-is with one decimal
      return `${(value * 100).toFixed(1)}%`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDF8F3] via-[#FFF9F5] to-[#FDF5F0]">
      {/* Header */}
      <header className="border-b border-[#C9A962]/20 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A962] to-[#D4A84B] flex items-center justify-center">
                <Home className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#0F172A]">Rental Revenue Calculator</h1>
                <p className="text-xs text-[#0F172A]/50">Powered by Coach Inayah</p>
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
            <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] mb-4 font-serif italic">
              Should You Sign That Lease?
            </h2>
            <p className="text-lg text-[#0F172A]/60 max-w-2xl mx-auto">
              Enter a property below and get a comprehensive Airbnb arbitrage analysis in seconds. 
              We'll tell you exactly what you can expect to earn.
            </p>
          </div>
        )}
        
        {/* Input Form */}
        <div className={`bg-white rounded-2xl border border-[#C9A962]/20 shadow-lg p-6 md:p-8 ${result ? 'mb-8' : ''}`}>
          <div className="grid gap-6">
            {/* Address Input with Autocomplete */}
            <div>
              <label className="block text-sm font-medium text-[#0F172A]/70 mb-2">
                <MapPin className="w-4 h-4 inline mr-2 text-[#C9A962]" />
                Property Address
              </label>
              <AddressAutocomplete
                value={address}
                onChange={(value) => setAddress(value)}
                onSelect={(selectedAddress) => setAddress(selectedAddress)}
                placeholder="Start typing an address..."
                disabled={isAnalyzing}
                inputClassName="bg-[#FDF8F3] border-[#C9A962]/30 text-[#0F172A] placeholder:text-[#0F172A]/30 h-12 text-lg focus:border-[#C9A962] focus:ring-[#C9A962]/20"
              />
            </div>
            
            {/* Three Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Monthly Rent */}
              <div>
                <label className="block text-sm font-medium text-[#0F172A]/70 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-2 text-[#C9A962]" />
                  Monthly Rent
                </label>
                <Input
                  type="number"
                  placeholder="2,000"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  className="bg-[#FDF8F3] border-[#C9A962]/30 text-[#0F172A] placeholder:text-[#0F172A]/30 h-12 focus:border-[#C9A962] focus:ring-[#C9A962]/20"
                  disabled={isAnalyzing}
                />
              </div>
              
              {/* Bedrooms */}
              <div>
                <label className="block text-sm font-medium text-[#0F172A]/70 mb-2">
                  <BedDouble className="w-4 h-4 inline mr-2 text-[#C9A962]" />
                  Bedrooms
                </label>
                <Input
                  type="number"
                  placeholder="2"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="bg-[#FDF8F3] border-[#C9A962]/30 text-[#0F172A] placeholder:text-[#0F172A]/30 h-12 focus:border-[#C9A962] focus:ring-[#C9A962]/20"
                  disabled={isAnalyzing}
                />
              </div>
              
              {/* Bathrooms */}
              <div>
                <label className="block text-sm font-medium text-[#0F172A]/70 mb-2">
                  <Bath className="w-4 h-4 inline mr-2 text-[#C9A962]" />
                  Bathrooms
                </label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="1"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="bg-[#FDF8F3] border-[#C9A962]/30 text-[#0F172A] placeholder:text-[#0F172A]/30 h-12 focus:border-[#C9A962] focus:ring-[#C9A962]/20"
                  disabled={isAnalyzing}
                />
              </div>
            </div>
            
            {/* Analyze Button */}
            <Button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-[#C9A962] to-[#D4A84B] hover:from-[#B8944D] hover:to-[#C9A962] text-white border-0 shadow-lg"
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
          <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-lg p-8 mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-[#0F172A]">
                Running Deep Analysis...
              </h3>
              <div className="flex items-center gap-2 bg-[#C9A962]/10 px-4 py-2 rounded-full">
                <Clock className="w-4 h-4 text-[#C9A962]" />
                <span className="text-[#0F172A] font-mono text-lg">
                  {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-[#0F172A]/60">Progress</span>
                <span className="text-sm font-medium text-[#C9A962]">
                  {Math.min(Math.round((currentStep / ANALYSIS_STEPS.length) * 100), 100)}%
                </span>
              </div>
              <div className="h-3 bg-[#0F172A]/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#C9A962] to-[#D4A84B] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min((currentStep / ANALYSIS_STEPS.length) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-[#0F172A]/60">Step {currentStep} of {ANALYSIS_STEPS.length}</span>
                <span className="text-sm text-[#0F172A]/60">
                  {currentStep < ANALYSIS_STEPS.length 
                    ? `~${Math.max(Math.ceil((ANALYSIS_STEPS.length - currentStep) * 30), 10)}s remaining`
                    : 'Finishing up...'}
                </span>
              </div>
            </div>
            
            <p className="text-center text-[#0F172A]/60 mb-6">
              {currentStep <= 2 ? 'Analyzing market data and competitors...' :
               currentStep <= 4 ? 'Calculating revenue projections...' :
               'AI generating insights...'}
            </p>
            
            <p className="text-center text-sm text-[#0F172A]/40 mb-6">
              This analysis typically takes 2-3 minutes for best results.
            </p>
            
            {/* Step Indicators */}
            <div className="space-y-3">
              {ANALYSIS_STEPS.map((step, index) => {
                const isComplete = index < currentStep;
                const isCurrent = index === currentStep - 1;
                const StepIcon = step.icon;
                
                return (
                  <div 
                    key={step.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      isComplete ? 'bg-green-50 border border-green-200' :
                      isCurrent ? 'bg-[#C9A962]/10 border border-[#C9A962]/30' :
                      'bg-[#0F172A]/5 border border-transparent'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isComplete ? 'bg-green-500' :
                      isCurrent ? 'bg-[#C9A962]' :
                      'bg-[#0F172A]/20'
                    }`}>
                      {isComplete ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : isCurrent ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <StepIcon className="w-4 h-4 text-[#0F172A]/40" />
                      )}
                    </div>
                    <span className={`font-medium ${
                      isComplete ? 'text-green-700' :
                      isCurrent ? 'text-[#C9A962]' :
                      'text-[#0F172A]/40'
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
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mt-8">
            <div className="flex items-center gap-3 text-red-600">
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
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                    <p className="text-xs text-green-600 uppercase tracking-wide font-medium">Projected Revenue</p>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(result.narrative_report.key_metrics.projected_annual_revenue)}</p>
                    <p className="text-xs text-[#0F172A]/40">per year</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#FDF8F3] to-[#FFF5E6] rounded-xl p-4 border border-[#C9A962]/30">
                    <p className="text-xs text-[#C9A962] uppercase tracking-wide font-medium">Monthly Profit</p>
                    <p className="text-2xl font-bold text-[#B8944D]">{formatCurrency(result.narrative_report.key_metrics.projected_monthly_profit)}</p>
                    <p className="text-xs text-[#0F172A]/40">after expenses</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-medium">Market Occupancy</p>
                    <p className="text-2xl font-bold text-blue-700">{formatPercent(result.narrative_report.key_metrics.market_occupancy)}</p>
                    <p className="text-xs text-[#0F172A]/40">average</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                    <p className="text-xs text-purple-600 uppercase tracking-wide font-medium">Break Even</p>
                    <p className="text-2xl font-bold text-purple-700">{typeof result.narrative_report.key_metrics.break_even_months === 'number' ? result.narrative_report.key_metrics.break_even_months.toFixed(1) : result.narrative_report.key_metrics.break_even_months} mo</p>
                    <p className="text-xs text-[#0F172A]/40">estimated</p>
                  </div>
                </div>
                
                {/* Quick Facts */}
                {result.narrative_report.quick_facts && result.narrative_report.quick_facts.length > 0 && (
                  <div className="bg-white rounded-xl p-4 border border-[#C9A962]/20 shadow-sm">
                    <div className="flex flex-wrap gap-2">
                      {result.narrative_report.quick_facts
                        .filter(fact => !fact.includes('N/A') && !fact.includes('#N/A') && !fact.includes('$0/year below') && !fact.includes('+0%') && !fact.includes('+undefined%') && !fact.toLowerCase().includes('verdict') && !fact.toLowerCase().includes('go') && !fact.toLowerCase().includes('caution') && !fact.toLowerCase().includes('pass'))
                        .map((fact, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FDF8F3] rounded-full text-sm text-[#0F172A]/80 border border-[#C9A962]/20">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          {fact}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Executive Summary */}
                <div className="bg-gradient-to-r from-[#FDF8F3] to-[#FFF5E6] rounded-2xl border border-[#C9A962]/30 p-6">
                  <h3 className="text-xl font-semibold text-[#0F172A] mb-4 flex items-center gap-2 font-serif">
                    <Award className="w-5 h-5 text-[#C9A962]" />
                    Executive Summary
                  </h3>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-[#0F172A]/80 leading-relaxed whitespace-pre-line">{result.narrative_report.executive_summary}</p>
                  </div>
                </div>
                
                {/* Market Overview */}
                <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                  <button
                    onClick={() => toggleSection('market_overview')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-xl font-semibold text-[#0F172A] flex items-center gap-2 font-serif">
                      <MapPin className="w-5 h-5 text-emerald-500" />
                      Market Overview
                    </h3>
                    {expandedSections.has('market_overview') ? (
                      <ChevronUp className="w-5 h-5 text-[#0F172A]/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#0F172A]/50" />
                    )}
                  </button>
                  {expandedSections.has('market_overview') && (
                    <div className="mt-4 prose prose-sm max-w-none">
                      <p className="text-[#0F172A]/70 leading-relaxed whitespace-pre-line">{result.narrative_report.market_overview}</p>
                    </div>
                  )}
                </div>
                
                {/* Revenue Analysis */}
                <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                  <button
                    onClick={() => toggleSection('revenue_analysis')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-xl font-semibold text-[#0F172A] flex items-center gap-2 font-serif">
                      <DollarSign className="w-5 h-5 text-green-500" />
                      Revenue Analysis
                    </h3>
                    {expandedSections.has('revenue_analysis') ? (
                      <ChevronUp className="w-5 h-5 text-[#0F172A]/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#0F172A]/50" />
                    )}
                  </button>
                  {expandedSections.has('revenue_analysis') && (
                    <div className="mt-4 prose prose-sm max-w-none">
                      <p className="text-[#0F172A]/70 leading-relaxed whitespace-pre-line">{result.narrative_report.revenue_analysis}</p>
                    </div>
                  )}
                </div>
                
                {/* Competitive Landscape */}
                <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                  <button
                    onClick={() => toggleSection('competitive')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-xl font-semibold text-[#0F172A] flex items-center gap-2 font-serif">
                      <Users className="w-5 h-5 text-orange-500" />
                      Competitive Landscape
                    </h3>
                    {expandedSections.has('competitive') ? (
                      <ChevronUp className="w-5 h-5 text-[#0F172A]/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#0F172A]/50" />
                    )}
                  </button>
                  {expandedSections.has('competitive') && (
                    <div className="mt-4 prose prose-sm max-w-none">
                      <p className="text-[#0F172A]/70 leading-relaxed whitespace-pre-line">{result.narrative_report.competitive_landscape}</p>
                    </div>
                  )}
                </div>
                
                {/* Seasonal Strategy */}
                <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                  <button
                    onClick={() => toggleSection('seasonal')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-xl font-semibold text-[#0F172A] flex items-center gap-2 font-serif">
                      <Calendar className="w-5 h-5 text-cyan-500" />
                      Seasonal Strategy
                    </h3>
                    {expandedSections.has('seasonal') ? (
                      <ChevronUp className="w-5 h-5 text-[#0F172A]/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#0F172A]/50" />
                    )}
                  </button>
                  {expandedSections.has('seasonal') && (
                    <div className="mt-4 prose prose-sm max-w-none">
                      <p className="text-[#0F172A]/70 leading-relaxed whitespace-pre-line">{result.narrative_report.seasonal_strategy}</p>
                    </div>
                  )}
                </div>
                
                {/* Historical Context */}
                {result.narrative_report.historical_context && (
                  <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                    <button
                      onClick={() => toggleSection('historical')}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h3 className="text-xl font-semibold text-[#0F172A] flex items-center gap-2 font-serif">
                        <TrendingUp className="w-5 h-5 text-indigo-500" />
                        Historical Context
                      </h3>
                      {expandedSections.has('historical') ? (
                        <ChevronUp className="w-5 h-5 text-[#0F172A]/50" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[#0F172A]/50" />
                      )}
                    </button>
                    {expandedSections.has('historical') && (
                      <div className="mt-4 prose prose-sm max-w-none">
                        <p className="text-[#0F172A]/70 leading-relaxed whitespace-pre-line">{result.narrative_report.historical_context}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Risk Assessment */}
                <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                  <button
                    onClick={() => toggleSection('risks')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-xl font-semibold text-[#0F172A] flex items-center gap-2 font-serif">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      Risk Assessment
                    </h3>
                    {expandedSections.has('risks') ? (
                      <ChevronUp className="w-5 h-5 text-[#0F172A]/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#0F172A]/50" />
                    )}
                  </button>
                  {expandedSections.has('risks') && (
                    <div className="mt-4 prose prose-sm max-w-none">
                      <p className="text-[#0F172A]/70 leading-relaxed whitespace-pre-line">{result.narrative_report.risk_assessment}</p>
                    </div>
                  )}
                </div>
                
                {/* Financial Outlook */}
                <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                  <button
                    onClick={() => toggleSection('financial')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-xl font-semibold text-[#0F172A] flex items-center gap-2 font-serif">
                      <Target className="w-5 h-5 text-violet-500" />
                      Financial Outlook
                    </h3>
                    {expandedSections.has('financial') ? (
                      <ChevronUp className="w-5 h-5 text-[#0F172A]/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#0F172A]/50" />
                    )}
                  </button>
                  {expandedSections.has('financial') && (
                    <div className="mt-4 prose prose-sm max-w-none">
                      <p className="text-[#0F172A]/70 leading-relaxed whitespace-pre-line">{result.narrative_report.financial_outlook}</p>
                    </div>
                  )}
                </div>
                
                {/* Conclusion */}
                <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                  <button
                    onClick={() => toggleSection('conclusion')}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-xl font-semibold text-[#0F172A] flex items-center gap-2 font-serif">
                      <CheckCircle2 className="w-5 h-5 text-[#C9A962]" />
                      Conclusion
                    </h3>
                    {expandedSections.has('conclusion') ? (
                      <ChevronUp className="w-5 h-5 text-[#0F172A]/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#0F172A]/50" />
                    )}
                  </button>
                  {expandedSections.has('conclusion') && (
                    <div className="mt-4 prose prose-sm max-w-none">
                      <p className="text-[#0F172A]/70 leading-relaxed whitespace-pre-line">{result.narrative_report.conclusion}</p>
                    </div>
                  )}
                </div>
                
                {/* Confidence Level */}
                {result.historical_analysis?.confidence_level && (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <span className="text-sm text-[#0F172A]/60">Confidence Level:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      result.historical_analysis.confidence_level === 'high' ? 'bg-green-100 text-green-700' :
                      result.historical_analysis.confidence_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {result.historical_analysis.confidence_level.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            ) : isNarrativeLoading ? (
              /* Show skeleton while AI narrative is generating */
              <NarrativeSkeleton />
            ) : (
              /* Fallback to structured display if no narrative report */
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <h3 className="text-xl font-semibold text-[#0F172A] mb-4 font-serif">Analysis Results</h3>
                <p className="text-[#0F172A]/70">{result.executive_summary.summary}</p>
              </div>
            )}
            
            {/* Revenue Projections Card */}
            <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
              <h4 className="font-semibold text-[#0F172A] mb-4 font-serif">Revenue Projections</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-[#FDF8F3] rounded-xl">
                  <p className="text-sm text-[#0F172A]/60 mb-1">Conservative</p>
                  <p className="text-xl font-bold text-[#0F172A]">{formatCurrency(result.revenue.low)}</p>
                  <p className="text-xs text-[#0F172A]/40">per year</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-[#C9A962]/10 to-[#D4A84B]/10 rounded-xl border border-[#C9A962]/30">
                  <p className="text-sm text-[#C9A962] mb-1">Realistic Target</p>
                  <p className="text-xl font-bold text-[#B8944D]">{formatCurrency(result.revenue.mid)}</p>
                  <p className="text-xs text-[#0F172A]/40">per year</p>
                </div>
                <div className="text-center p-4 bg-[#FDF8F3] rounded-xl">
                  <p className="text-sm text-[#0F172A]/60 mb-1">Optimistic</p>
                  <p className="text-xl font-bold text-[#0F172A]">{formatCurrency(result.revenue.high)}</p>
                  <p className="text-xs text-[#0F172A]/40">per year</p>
                </div>
              </div>
            </div>
            
            {/* Profitability Card */}
            <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
              <h4 className="font-semibold text-[#0F172A] mb-4 font-serif">Annual Profit (After Rent & Expenses)</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-[#0F172A]/60 mb-1">Conservative</p>
                  <p className={`text-xl font-bold ${result.profitability.conservative >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(result.profitability.conservative)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-[#0F172A]/60 mb-1">Realistic</p>
                  <p className={`text-xl font-bold ${result.profitability.realistic >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(result.profitability.realistic)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-[#0F172A]/60 mb-1">Optimistic</p>
                  <p className={`text-xl font-bold ${result.profitability.optimistic >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(result.profitability.optimistic)}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Startup Costs & Break-Even */}
            <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
              <h4 className="font-semibold text-[#0F172A] mb-4 font-serif">Startup Costs & Break-Even</h4>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-[#0F172A]/60 mb-2">Estimated Startup Costs</p>
                  <p className="text-lg font-bold text-[#0F172A]">
                    {formatCurrency(result.startup.total_low)} - {formatCurrency(result.startup.total_high)}
                  </p>
                  <p className="text-xs text-[#0F172A]/40 mt-1">Furniture, supplies, setup</p>
                </div>
                <div>
                  <p className="text-sm text-[#0F172A]/60 mb-2">Break-Even Timeline</p>
                  <p className="text-lg font-bold text-[#0F172A]">
                    {result.break_even.months_realistic} months
                  </p>
                  <p className="text-xs text-[#0F172A]/40 mt-1">
                    Range: {result.break_even.months_optimistic}-{result.break_even.months_conservative} months
                  </p>
                </div>
              </div>
            </div>
            
            {/* Market Intelligence */}
            <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-[#0F172A] font-serif">Market Intelligence Report</h4>
                <span className="text-xs text-[#0F172A]/40">Analyzing Market</span>
              </div>
              
              {/* Market Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#FDF8F3] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Percent className="w-4 h-4 text-blue-500" />
                    <p className="text-sm text-[#0F172A]/50">Avg Occupancy</p>
                  </div>
                  <p className="text-2xl font-bold text-[#0F172A]">{formatPercent(result.market.occupancy)}</p>
                  {(() => {
                    const occPct = result.market.occupancy > 1 ? result.market.occupancy : result.market.occupancy * 100;
                    return (
                      <p className="text-xs text-[#0F172A]/40 mt-1">
                        {occPct >= 70 ? 'Above national avg (65%)' :
                         occPct >= 55 ? 'Near national avg (65%)' :
                         'Below national avg (65%)'}
                      </p>
                    );
                  })()}
                </div>
                <div className="bg-[#FDF8F3] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Banknote className="w-4 h-4 text-green-500" />
                    <p className="text-sm text-[#0F172A]/50">Avg Daily Rate</p>
                  </div>
                  <p className="text-2xl font-bold text-[#0F172A]">{formatCurrency(result.market.adr)}</p>
                  <p className="text-xs text-[#0F172A]/40 mt-1">
                    {result.market.adr >= 200 ? 'Premium pricing market' :
                     result.market.adr >= 120 ? 'Mid-range pricing' :
                     'Budget-friendly market'}
                  </p>
                </div>
                <div className="bg-[#FDF8F3] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="w-4 h-4 text-purple-500" />
                    <p className="text-sm text-[#0F172A]/50">Direct Competitors</p>
                  </div>
                  <p className="text-2xl font-bold text-[#0F172A]">{result.market.active_listings.toLocaleString()}</p>
                  <p className="text-xs text-[#0F172A]/40 mt-1">
                    Nearby similar properties
                  </p>
                </div>
                <div className="bg-[#FDF8F3] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-[#C9A962]" />
                    <p className="text-sm text-[#0F172A]/50">Est. RevPAR</p>
                  </div>
                  <p className="text-2xl font-bold text-[#0F172A]">
                    {formatCurrency(Math.round(result.market.adr * (result.market.occupancy > 1 ? result.market.occupancy / 100 : result.market.occupancy)))}
                  </p>
                  <p className="text-xs text-[#0F172A]/40 mt-1">Revenue per available night</p>
                </div>
              </div>
              
              {/* Market Health Badge */}
              <div className="bg-gradient-to-r from-[#FDF8F3] to-[#FFF5E6] rounded-xl p-4 border border-[#C9A962]/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#C9A962]/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-[#C9A962]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#0F172A]">{result.market.name}</p>
                    <p className="text-sm text-[#0F172A]/60">
                      This market has {result.market.active_listings} direct competitors (nearby {result.bedrooms || 'similar'}-bedroom properties) that guests will compare when booking.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Competitors Section - Thumbnail Pod Style */}
            {result.competitors && result.competitors.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <h4 className="font-semibold text-[#0F172A] mb-4 font-serif">Your Competition ({result.competitors.length} similar properties)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.competitors.slice(0, 5).map((comp, i) => (
                    <div key={i} className="bg-[#FDF8F3] rounded-xl overflow-hidden border border-[#C9A962]/10 hover:shadow-md transition-shadow">
                      {/* Property Thumbnail */}
                      <div className="relative h-32 bg-gradient-to-br from-[#C9A962]/20 to-[#D4A84B]/10">
                        {comp.image_url ? (
                          <img 
                            src={comp.image_url} 
                            alt={comp.name || 'Competitor property'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`absolute inset-0 flex items-center justify-center ${comp.image_url ? 'hidden' : ''}`}>
                          <Home className="w-12 h-12 text-[#C9A962]/40" />
                        </div>
                        {/* Revenue Badge */}
                        <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm">
                          <p className="font-bold text-[#0F172A] text-sm">{formatCurrency(comp.annual_revenue)}/yr</p>
                        </div>
                        {/* Rating Badge */}
                        {comp.rating && (
                          <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm flex items-center gap-1">
                            <Star className="w-3 h-3 fill-[#C9A962] text-[#C9A962]" />
                            <span className="text-xs font-semibold text-[#0F172A]">{comp.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      {/* Property Info */}
                      <div className="p-3">
                        <p className="font-medium text-[#0F172A] text-sm line-clamp-2 mb-1">{comp.name || `Competitor ${i + 1}`}</p>
                        <div className="flex items-center justify-between text-xs text-[#0F172A]/60">
                          <div className="flex items-center gap-2">
                            <span>{formatPercent(comp.occupancy)} occupancy</span>
                            {comp.distance_meters && (
                              <span className="text-[#C9A962]">
                                • {comp.distance_meters < 1000 
                                    ? `${Math.round(comp.distance_meters)}m away` 
                                    : `${(comp.distance_meters / 1000).toFixed(1)}km away`}
                              </span>
                            )}
                          </div>
                          {comp.airbnb_url && (
                            <a 
                              href={comp.airbnb_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[#C9A962] hover:text-[#B8944D] flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Export Section */}
            <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
              <h4 className="font-semibold text-[#0F172A] mb-2 font-serif">Export Report</h4>
              <p className="text-sm text-[#0F172A]/60 mb-4">
                Download this analysis as a professional PDF report or Excel spreadsheet for your records.
              </p>
              <div className="flex gap-3">
                <ExportPDFButton
                  address={result.address}
                  monthlyRent={result.monthly_rent}
                  bedrooms={result.bedrooms}
                  bathrooms={result.bathrooms}
                  analysisData={result}
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
            <div className="bg-gradient-to-r from-[#C9A962]/20 to-[#D4A84B]/20 rounded-2xl border border-[#C9A962]/30 p-8 text-center">
              <h3 className="text-2xl font-bold text-[#0F172A] mb-3 font-serif">
                Want Expert Help With This Property?
              </h3>
              <p className="text-[#0F172A]/70 mb-6 max-w-xl mx-auto">
                Our team can help you set up this property for maximum revenue. 
                We handle everything from furnishing to listing optimization.
              </p>
              <Button
                className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-[#C9A962] to-[#D4A84B] hover:from-[#B8944D] hover:to-[#C9A962] text-white border-0 shadow-lg"
                onClick={() => {
                  // Open Calendly or booking link
                  window.open('https://calendly.com', '_blank');
                }}
              >
                <Phone className="w-5 h-5 mr-2" />
                Book a Free Strategy Call
              </Button>
              <p className="text-[#0F172A]/50 text-sm mt-4">
                No obligation. Just a conversation about your goals.
              </p>
            </div>
            
            {/* Analyze Another */}
            <div className="text-center">
              <Button
                variant="outline"
                className="border-[#C9A962]/30 text-[#0F172A] hover:bg-[#C9A962]/10"
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
      <footer className="border-t border-[#C9A962]/20 bg-white/50 mt-16">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-[#0F172A]/40 text-sm">
            Powered by Coach Inayah
          </p>
        </div>
      </footer>
      
      {/* Typeform Gate Overlay */}
      <TypeformOverlay
        isOpen={showTypeformGate}
        onComplete={() => {
          setShowTypeformGate(false);
          setHasCompletedTypeform(true);
          localStorage.setItem('typeform_completed', 'true');
          toast.success('Thank you! Your full report is now unlocked.');
        }}
      />
    </div>
  );
}
