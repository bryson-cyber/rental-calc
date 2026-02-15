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
import ReactMarkdown from 'react-markdown';
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
  Award,
  Brain,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { TypeformOverlay } from '@/components/TypeformOverlay';
import { toast } from 'sonner';
import { FileText, FileSpreadsheet, Download, Loader2 as ExportLoader } from 'lucide-react';
import NarrativeSkeleton, { InlineNarrativeSkeleton } from '@/components/NarrativeSkeleton';
import { useReportMode } from '@/contexts/ReportModeContext';

// Export PDF Button Component with Progress Indicator
function ExportPDFButton({ address, monthlyRent, bedrooms, bathrooms, analysisData }: {
  address: string;
  monthlyRent: number;
  bedrooms: number;
  bathrooms: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // Tier 4: Enhanced competitor fields
    is_superhost?: boolean;
    is_professional?: boolean;
    property_type?: string;
    last_review_date?: string;
    amenities?: string[];
    similarity_score?: number;
    reviews?: number;
    adr?: number;
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
  
  // Tier 1: Major Data Sections
  market_saturation?: {
    total_listings: number;
    same_bedroom_count: number;
    bedroom_distribution: Array<{ bedrooms: number; count: number; percentage: number }>;
    revenue_percentiles: { p25: number; p50: number; p75: number; p90: number };
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    superhost_percentage: number;
    professional_percentage: number;
    market_concentration: 'low' | 'medium' | 'high';
  };
  
  market_insights?: {
    total_listings: number;
    professionally_managed_count: number;
    professionally_managed_pct: number;
    superhost_count: number;
    superhost_pct: number;
    avg_rating: number;
    avg_reviews: number;
    property_type_breakdown: Array<{ type: string; count: number; percentage: number }>;
    host_size_breakdown: Array<{ size: string; count: number; percentage: number }>;
    revenue_percentiles: { p25: number; p50: number; p75: number; p90: number };
  };
  
  qualifying_competitors?: {
    qualifying_count: number;
    total_same_bedroom: number;
    qualification_rate: number;
    revenue_threshold: number;
    avg_qualifying_revenue: number;
    avg_qualifying_occupancy: number;
    avg_qualifying_adr: number;
    superhost_percentage: number;
    professional_percentage: number;
    top_qualifiers: Array<{
      title: string;
      bedrooms: number;
      annual_revenue: number;
      adr: number;
      occupancy: number;
      rating: number;
      superhost: boolean;
      professionally_managed: boolean;
    }>;
  };
  
  radius_listings?: {
    total_count: number;
    radius_meters: number;
    listings_per_sqkm: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    superhost_percentage: number;
    professional_percentage: number;
    same_bedroom_count: number;
    top_nearby: Array<{
      title: string;
      bedrooms: number;
      annual_revenue: number;
      adr: number;
      occupancy: number;
      rating: number;
      distance_meters: number;
    }>;
  };
  
  property_type_analysis?: {
    entire_home: { count: number; avg_revenue: number; avg_occupancy: number };
    private_room: { count: number; avg_revenue: number; avg_occupancy: number };
    revenue_premium: number;
    recommended_type: string;
    recommendation_reason: string;
  };
  
  nearby_markets?: {
    current_market: { name: string; revenue: number; occupancy: number; adr: number };
    alternatives: Array<{ name: string; revenue: number; occupancy: number; adr: number; distance_km: number }>;
    best_alternative: string;
    recommendation: string;
  };
  
  airdna_feasibility?: {
    projections: {
      annual_revenue: number;
      annual_profit: number;
      monthly_profit: number;
      roi_percentage: number;
      break_even_occupancy: number;
    };
    risk_assessment: {
      overall_risk: 'low' | 'medium' | 'high';
      seasonality_risk: 'low' | 'medium' | 'high';
      regulation_risk: 'low' | 'medium' | 'high';
      market_saturation: 'low' | 'medium' | 'high';
      factors: string[];
    };
    recommendation: string;
    comparison: {
      our_annual_profit: number;
      airdna_annual_profit: number;
      profit_difference: number;
      profit_difference_pct: number;
      assessment_match: boolean;
    };
  };
  
  // Tier 2: Submarket Data
  submarket_deep_dive?: {
    submarket_name: string;
    listing_count: number;
    metrics: { revenue: number; occupancy: number; adr: number; revpar: number };
    bedroom_performance: Array<{ bedrooms: number; revenue: number; occupancy: number; adr: number }>;
    top_performers: Array<{ title: string; revenue: number; rating: number }>;
    insights: string[];
  };
  
  submarket_details?: {
    submarket_id: string;
    submarket_name: string;
    parent_market_name: string;
    parent_market_id: string;
    market_type: string;
    metrics: { revenue: number; occupancy: number; adr: number; revpar: number; listing_count: number };
  };
  
  submarket_exploration?: {
    market_name: string;
    market_metrics: { revenue: number; occupancy: number; adr: number };
    property_submarket_name: string;
    property_submarket_rank: number;
    property_submarket_overall_score: number;
    top_recommendation: string;
    submarkets: Array<{
      name: string;
      listing_count: number;
      metrics: { revenue: number; occupancy: number; adr: number; revpar: number };
      ranking: { revenue_rank: number; overall_rank: number };
      recommendation: string;
    }>;
  };
  
  all_submarkets?: {
    property_submarket_name: string;
    property_submarket_rank: number;
    total_submarkets: number;
    submarkets: Array<{
      name: string;
      listing_count: number;
      revenue: number;
      occupancy: number;
      adr: number;
      revpar: number;
    }>;
  };
  
  submarket_listings?: {
    submarket_name: string;
    total_listings: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    top_listings: Array<{
      name: string;
      bedrooms: number;
      annual_revenue: number;
      adr: number;
      occupancy: number;
      rating: number | null;
    }>;
  };
  
  submarket_analysis?: {
    name: string;
    metrics: { revenue: number; occupancy: number; adr: number };
    comparison_to_market: { revenue_diff: number; occupancy_diff: number; adr_diff: number };
  };
  
  // Tier 3: Competitor Intelligence
  top_performer_comps?: Array<{
    title: string;
    bedrooms: number;
    bathrooms: number;
    property_type: string;
    annual_revenue: number;
    adr: number;
    occupancy: number;
    rating: number;
    reviews: number;
    similarity_score: number;
    amenities: string[];
  }>;
  
  top_performer_pricing?: {
    avg_weekday_price: number;
    avg_weekend_price: number;
    price_range_low: number;
    price_range_high: number;
    weekend_premium_percent: number;
    days_of_data: number;
  };
  
  competitor_historical?: Array<{
    listing_id: string;
    title: string;
    monthly_data: Array<{ month: string; revenue: number; occupancy: number; adr: number }>;
  }>;
  
  daily_pricing?: Array<{
    date: string;
    avg_price: number;
    min_price: number;
    max_price: number;
    available_count: number;
  }>;
  
  competitor_imagery?: {
    total_competitors_analyzed: number;
    competitors_with_images: number;
    avg_image_count: number;
    max_image_count: number;
    min_image_count: number;
    top_competitors: Array<{ title: string; image_count: number; images: string[] }>;
    photo_quality_insights: string[];
  };
  
  rentalizer_comps?: {
    total_comps: number;
    superhost_count: number;
    superhost_percentage: number;
    professional_count: number;
    professional_percentage: number;
    avg_distance_meters: number;
    avg_revenue: number;
    avg_rating: number;
    avg_reviews: number;
    top_comps: Array<{
      title: string;
      bedrooms: number;
      annual_revenue: number;
      rating: number;
      reviews: number;
      distance_meters: number;
      superhost: boolean;
      professionally_managed: boolean;
    }>;
  };
  
  superhost_top_performers?: {
    total_superhosts_in_market: number;
    avg_superhost_revenue: number;
    avg_superhost_rating: number;
    avg_superhost_reviews: number;
    revenue_premium_vs_market: number;
    top_superhosts: Array<{
      title: string;
      annual_revenue: number;
      rating: number;
      reviews: number;
    }>;
  };
  
  same_bedroom_radius_listings?: {
    search_radius_meters: number;
    bedroom_filter: number;
    total_found: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    superhost_count: number;
    professional_count: number;
    top_performers: Array<{
      title: string;
      annual_revenue: number;
      adr: number;
      occupancy: number;
      rating: number;
      distance_meters: number;
    }>;
  };
  
  // Report ID for deep analysis
  reportId?: number | null;
}

export default function PropertyAnalyzer() {
  const { mode: reportMode } = useReportMode();
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
        reportMode: reportMode,
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
            name: data.submarket_details?.parent_market_name || data.submarket_exploration?.market_name || (data.property_estimate?.property as any)?.market_name || 'Your Market',
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
            distance_meters: c.distance_meters,
            // Tier 4: Enhanced competitor fields
            is_superhost: c.is_superhost || c.superhost || false,
            is_professional: c.is_professional || c.professionally_managed || false,
            property_type: c.property_type,
            last_review_date: c.last_review_date,
            amenities: c.amenities || [],
            similarity_score: c.similarity_score,
            reviews: c.reviews || c.num_reviews,
            adr: c.adr
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
          
          full_report: data.full_report || '',
          
          // Tier 1: Major Data Sections
          market_saturation: (data as any).market_saturation,
          market_insights: (data as any).market_insights,
          qualifying_competitors: (data as any).qualifying_competitors,
          radius_listings: (data as any).radius_listings,
          property_type_analysis: (data as any).property_type_analysis,
          nearby_markets: (data as any).nearby_markets,
          airdna_feasibility: (data as any).airdna_feasibility,
          
          // Tier 2: Submarket Data
          submarket_deep_dive: (data as any).submarket_deep_dive,
          submarket_details: (data as any).submarket_details,
          submarket_exploration: (data as any).submarket_exploration,
          all_submarkets: (data as any).all_submarkets,
          submarket_listings: (data as any).submarket_listings,
          submarket_analysis: (data as any).submarket_analysis,
          
          // Tier 3: Competitor Intelligence
          top_performer_comps: (data as any).top_performer_comps,
          top_performer_pricing: (data as any).top_performer_pricing,
          competitor_historical: (data as any).competitor_historical,
          daily_pricing: (data as any).daily_pricing,
          competitor_imagery: (data as any).competitor_imagery,
          rentalizer_comps: (data as any).rentalizer_comps,
          superhost_top_performers: (data as any).superhost_top_performers,
          same_bedroom_radius_listings: (data as any).same_bedroom_radius_listings,
          
          // Report ID for deep analysis
          reportId: (data as any).reportId || null
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
    } catch (err: unknown) {
      clearInterval(stepInterval);
      console.error('Analysis error:', err);
      
      // Detect timeout or network errors and show helpful message
      const errorMessage = err instanceof Error ? err.message : '';
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
  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '$0';
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

  // Safe toFixed helper to prevent undefined errors
  const safeFixed = (value: number | undefined | null, decimals: number = 0): string => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return value.toFixed(decimals);
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
          <div className={`rounded-2xl p-6 mt-8 ${error.includes('limit reached') ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
            <div className={`flex items-center gap-3 ${error.includes('limit reached') ? 'text-amber-600' : 'text-red-600'}`}>
              <AlertTriangle className="w-6 h-6" />
              <div>
                <span className="font-medium">{error}</span>
                {error.includes('limit reached') && (
                  <p className="text-sm text-amber-500 mt-1">Usage limits reset daily. Contact Coach Inayah for unlimited access.</p>
                )}
              </div>
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
                    <div className="text-[#0F172A]/80 leading-relaxed [&_p]:mb-3 [&_strong]:font-semibold [&_strong]:text-[#0F172A]"><ReactMarkdown>{result.narrative_report.executive_summary}</ReactMarkdown></div>
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
                      {(result.historical_analysis?.confidence_level || 'medium').toUpperCase()}
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
                      This market has {result.same_bedroom_radius_listings?.total_found || result.qualifying_competitors?.total_same_bedroom || result.market.active_listings} same-bedroom competitors that guests will compare when booking.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Competitors Section - Enhanced Thumbnail Pod Style with Tier 4 Fields */}
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
                        {/* Rating Badge with Reviews */}
                        {comp.rating && (
                          <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm flex items-center gap-1">
                            <Star className="w-3 h-3 fill-[#C9A962] text-[#C9A962]" />
                            <span className="text-xs font-semibold text-[#0F172A]">{safeFixed(comp.rating, 1)}</span>
                            {comp.reviews && <span className="text-xs text-[#0F172A]/50">({comp.reviews})</span>}
                          </div>
                        )}
                        {/* Superhost & Professional Badges */}
                        <div className="absolute bottom-2 left-2 flex gap-1">
                          {comp.is_superhost && (
                            <div className="bg-[#FF5A5F] text-white px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-0.5">
                              <Award className="w-2.5 h-2.5" />
                              Superhost
                            </div>
                          )}
                          {comp.is_professional && (
                            <div className="bg-[#008489] text-white px-1.5 py-0.5 rounded text-[10px] font-semibold">
                              Pro
                            </div>
                          )}
                        </div>
                        {/* Similarity Score Badge */}
                        {comp.similarity_score && comp.similarity_score > 0 && (
                          <div className="absolute bottom-2 right-2 bg-[#C9A962]/90 text-white px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            {Math.round(comp.similarity_score * 100)}% match
                          </div>
                        )}
                      </div>
                      {/* Property Info */}
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium text-[#0F172A] text-sm line-clamp-2 flex-1">{comp.name || `Competitor ${i + 1}`}</p>
                        </div>
                        {/* Property Type */}
                        {comp.property_type && (
                          <p className="text-[10px] text-[#0F172A]/50 mb-1">{comp.property_type}</p>
                        )}
                        {/* Stats Row */}
                        <div className="flex items-center gap-2 text-xs text-[#0F172A]/60 mb-1">
                          <span>{formatPercent(comp.occupancy)} occ</span>
                          {comp.adr && <span>• {formatCurrency(comp.adr)} ADR</span>}
                          {comp.distance_meters && (
                            <span className="text-[#C9A962]">
                              • {comp.distance_meters < 1000 
                                  ? `${Math.round(comp.distance_meters)}m` 
                                  : `${safeFixed((comp.distance_meters || 0) / 1000, 1)}km`}
                            </span>
                          )}
                        </div>
                        {/* Last Review Date */}
                        {comp.last_review_date && (
                          <p className="text-[10px] text-[#0F172A]/40 mb-1">
                            Last review: {new Date(comp.last_review_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </p>
                        )}
                        {/* Amenities */}
                        {comp.amenities && comp.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {comp.amenities.slice(0, 4).map((amenity, j) => (
                              <span key={j} className="text-[9px] bg-white px-1.5 py-0.5 rounded border border-[#C9A962]/20 text-[#0F172A]/60">
                                {amenity}
                              </span>
                            ))}
                            {comp.amenities.length > 4 && (
                              <span className="text-[9px] text-[#0F172A]/40">+{comp.amenities.length - 4} more</span>
                            )}
                          </div>
                        )}
                        {/* View Link */}
                        <div className="flex justify-end">
                          {comp.airbnb_url && (
                            <a 
                              href={comp.airbnb_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[#C9A962] hover:text-[#B8944D] flex items-center gap-1 text-xs"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Listing
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* ==================== TIER 1: MAJOR DATA SECTIONS ==================== */}
            
            {/* 5-Year Market Trends */}
            {result.five_year_summary && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">5-Year Market Trends</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Revenue Trend */}
                  <div className="bg-[#FDF8F3] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[#0F172A]/60">Revenue</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${result.five_year_summary.revenue.trend === 'increasing' ? 'bg-green-100 text-green-700' : result.five_year_summary.revenue.trend === 'decreasing' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                        {result.five_year_summary.revenue.trend === 'increasing' ? '↑' : result.five_year_summary.revenue.trend === 'decreasing' ? '↓' : '→'} {safeFixed(Math.abs(result.five_year_summary?.revenue?.percent_change || 0), 1)}%
                      </span>
                    </div>
                    <p className="text-xl font-bold text-[#0F172A]">{formatCurrency(result.five_year_summary.revenue.current_year_avg)}</p>
                    <p className="text-xs text-[#0F172A]/40">5-yr avg: {formatCurrency(result.five_year_summary.revenue.five_year_avg)}</p>
                  </div>
                  {/* Occupancy Trend */}
                  <div className="bg-[#FDF8F3] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[#0F172A]/60">Occupancy</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${result.five_year_summary.occupancy.trend === 'increasing' ? 'bg-green-100 text-green-700' : result.five_year_summary.occupancy.trend === 'decreasing' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                        {result.five_year_summary.occupancy.trend === 'increasing' ? '↑' : result.five_year_summary.occupancy.trend === 'decreasing' ? '↓' : '→'} {safeFixed(Math.abs(result.five_year_summary?.occupancy?.percent_change || 0), 1)}%
                      </span>
                    </div>
                    <p className="text-xl font-bold text-[#0F172A]">{formatPercent(result.five_year_summary.occupancy.current_year_avg)}</p>
                    <p className="text-xs text-[#0F172A]/40">5-yr avg: {formatPercent(result.five_year_summary.occupancy.five_year_avg)}</p>
                  </div>
                  {/* ADR Trend */}
                  <div className="bg-[#FDF8F3] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[#0F172A]/60">Avg Daily Rate</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${result.five_year_summary.adr.trend === 'increasing' ? 'bg-green-100 text-green-700' : result.five_year_summary.adr.trend === 'decreasing' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                        {result.five_year_summary.adr.trend === 'increasing' ? '↑' : result.five_year_summary.adr.trend === 'decreasing' ? '↓' : '→'} {safeFixed(Math.abs(result.five_year_summary?.adr?.percent_change || 0), 1)}%
                      </span>
                    </div>
                    <p className="text-xl font-bold text-[#0F172A]">{formatCurrency(result.five_year_summary.adr.current_year_avg)}</p>
                    <p className="text-xs text-[#0F172A]/40">5-yr avg: {formatCurrency(result.five_year_summary.adr.five_year_avg)}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Supply Trend */}
            {result.supply_trend && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Building className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Market Supply Trend</h4>
                </div>
                <div className="flex items-center gap-6">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${result.supply_trend.trend === 'growing' ? 'bg-yellow-50 text-yellow-700' : result.supply_trend.trend === 'declining' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'}`}>
                    {result.supply_trend.trend === 'growing' ? <TrendingUp className="w-5 h-5" /> : result.supply_trend.trend === 'declining' ? <TrendingDown className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                    <span className="font-semibold capitalize">{result.supply_trend.trend}</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#0F172A]">{result.supply_trend.current_listings.toLocaleString()}</p>
                    <p className="text-sm text-[#0F172A]/60">Current listings</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${result.supply_trend.net_change >= 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {result.supply_trend.net_change >= 0 ? '+' : ''}{result.supply_trend.net_change}
                    </p>
                    <p className="text-sm text-[#0F172A]/60">Net change ({safeFixed(result.supply_trend?.percent_change, 1)}%)</p>
                  </div>
                </div>
                {result.supply_trend.insight && (
                  <p className="mt-4 text-sm text-[#0F172A]/70 bg-[#FDF8F3] rounded-lg p-3">{result.supply_trend.insight}</p>
                )}
              </div>
            )}
            
            {/* Professional vs Amateur Hosts */}
            {result.professional_stats && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Professional vs Individual Hosts</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{safeFixed(result.professional_stats?.professional_percentage, 0)}%</p>
                    <p className="text-sm text-[#0F172A]/60">Professional Hosts</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#C9A962]">{safeFixed(result.professional_stats?.superhost_percentage, 0)}%</p>
                    <p className="text-sm text-[#0F172A]/60">Superhosts</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(result.professional_stats.avg_revenue_professional)}</p>
                    <p className="text-sm text-[#0F172A]/60">Pro Avg Revenue</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{formatCurrency(result.professional_stats.avg_revenue_individual)}</p>
                    <p className="text-sm text-[#0F172A]/60">Individual Avg Revenue</p>
                  </div>
                </div>
                {result.professional_stats.avg_revenue_professional > result.professional_stats.avg_revenue_individual && (
                  <p className="mt-4 text-sm text-green-700 bg-green-50 rounded-lg p-3">
                    💡 Professional hosts earn {safeFixed(((result.professional_stats?.avg_revenue_professional || 0) / (result.professional_stats?.avg_revenue_individual || 1) - 1) * 100, 0)}% more than individual hosts in this market.
                  </p>
                )}
              </div>
            )}
            
            {/* Booking Patterns */}
            {result.booking_patterns && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Booking Patterns</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{result.booking_patterns.avg_lead_time_days}</p>
                    <p className="text-sm text-[#0F172A]/60">Avg Lead Time (days)</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{safeFixed(result.booking_patterns?.avg_length_of_stay, 1)}</p>
                    <p className="text-sm text-[#0F172A]/60">Avg Stay (nights)</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">+{safeFixed(result.booking_patterns?.weekend_premium_percent, 0)}%</p>
                    <p className="text-sm text-[#0F172A]/60">Weekend Premium</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{safeFixed(result.booking_patterns?.last_minute_discount_percent, 0)}%</p>
                    <p className="text-sm text-[#0F172A]/60">Last-Minute Discount</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Market Saturation */}
            {result.market_saturation && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <PieChart className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Market Saturation Analysis</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{result.market_saturation.total_listings.toLocaleString()}</p>
                    <p className="text-sm text-[#0F172A]/60">Total Listings</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#C9A962]">{result.market_saturation.same_bedroom_count}</p>
                    <p className="text-sm text-[#0F172A]/60">Same Bedroom Count</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className={`text-2xl font-bold ${result.market_saturation.market_concentration === 'low' ? 'text-green-600' : result.market_saturation.market_concentration === 'high' ? 'text-red-600' : 'text-yellow-600'}`}>
                      {(result.market_saturation?.market_concentration || 'moderate').toUpperCase()}
                    </p>
                    <p className="text-sm text-[#0F172A]/60">Concentration</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{formatCurrency(result.market_saturation.avg_revenue)}</p>
                    <p className="text-sm text-[#0F172A]/60">Avg Revenue</p>
                  </div>
                </div>
                {/* Revenue Percentiles */}
                <div className="bg-[#FDF8F3] rounded-xl p-4">
                  <p className="text-sm font-medium text-[#0F172A] mb-2">Revenue Percentiles</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#0F172A]/60">25th: {formatCurrency(result.market_saturation.revenue_percentiles.p25)}</span>
                    <span className="text-[#0F172A]/60">50th: {formatCurrency(result.market_saturation.revenue_percentiles.p50)}</span>
                    <span className="text-[#0F172A]/60">75th: {formatCurrency(result.market_saturation.revenue_percentiles.p75)}</span>
                    <span className="text-[#C9A962] font-semibold">90th: {formatCurrency(result.market_saturation.revenue_percentiles.p90)}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Market Insights */}
            {result.market_insights && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Market Insights</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{safeFixed(result.market_insights?.avg_rating, 1)}</p>
                    <p className="text-sm text-[#0F172A]/60">Avg Rating</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{Math.round(result.market_insights.avg_reviews)}</p>
                    <p className="text-sm text-[#0F172A]/60">Avg Reviews</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#C9A962]">{safeFixed(result.market_insights?.superhost_pct, 0)}%</p>
                    <p className="text-sm text-[#0F172A]/60">Superhosts</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{safeFixed(result.market_insights?.professionally_managed_pct, 0)}%</p>
                    <p className="text-sm text-[#0F172A]/60">Pro Managed</p>
                  </div>
                </div>
                {/* Property Type Breakdown */}
                {result.market_insights.property_type_breakdown && result.market_insights.property_type_breakdown.length > 0 && (
                  <div className="bg-[#FDF8F3] rounded-xl p-4">
                    <p className="text-sm font-medium text-[#0F172A] mb-2">Property Types</p>
                    <div className="flex flex-wrap gap-2">
                      {result.market_insights.property_type_breakdown.slice(0, 5).map((pt, i) => (
                        <span key={i} className="text-xs bg-white px-3 py-1 rounded-full border border-[#C9A962]/20">
                          {pt.type}: {safeFixed(pt.percentage, 0)}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Qualifying Competitors */}
            {result.qualifying_competitors && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Qualifying Competitors</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{result.qualifying_competitors.qualifying_count}</p>
                    <p className="text-sm text-[#0F172A]/60">Qualifying</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{result.qualifying_competitors.total_same_bedroom}</p>
                    <p className="text-sm text-[#0F172A]/60">Same Bedroom Total</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#C9A962]">{safeFixed(result.qualifying_competitors?.qualification_rate, 0)}%</p>
                    <p className="text-sm text-[#0F172A]/60">Qualification Rate</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{formatCurrency(result.qualifying_competitors.revenue_threshold)}</p>
                    <p className="text-sm text-[#0F172A]/60">Revenue Threshold</p>
                  </div>
                </div>
                <p className="text-sm text-[#0F172A]/70 bg-[#FDF8F3] rounded-lg p-3">
                  💡 {result.qualifying_competitors.qualifying_count} out of {result.qualifying_competitors.total_same_bedroom} same-bedroom properties meet the revenue threshold of {formatCurrency(result.qualifying_competitors.revenue_threshold)}.
                </p>
              </div>
            )}
            
            {/* Radius Listings / Nearby Density */}
            {result.radius_listings && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Nearby Listings ({safeFixed((result.radius_listings?.radius_meters || 0) / 1000, 1)}km radius)</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{result.radius_listings.total_count}</p>
                    <p className="text-sm text-[#0F172A]/60">Total Nearby</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#C9A962]">{safeFixed(result.radius_listings?.listings_per_sqkm, 1)}</p>
                    <p className="text-sm text-[#0F172A]/60">Per sq km</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{formatCurrency(result.radius_listings.avg_revenue)}</p>
                    <p className="text-sm text-[#0F172A]/60">Avg Revenue</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{result.radius_listings.same_bedroom_count}</p>
                    <p className="text-sm text-[#0F172A]/60">Same Bedrooms</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Property Type Analysis - Only show if we have actual data */}
            {result.property_type_analysis && 
             (result.property_type_analysis.entire_home.count > 0 || result.property_type_analysis.private_room.count > 0) && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Home className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Property Type Analysis</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4">
                    <p className="font-medium text-[#0F172A] mb-2">Entire Home</p>
                    <p className="text-lg font-bold text-[#0F172A]">{formatCurrency(result.property_type_analysis.entire_home.avg_revenue)}</p>
                    <p className="text-sm text-[#0F172A]/60">{result.property_type_analysis.entire_home.count} listings • {formatPercent(result.property_type_analysis.entire_home.avg_occupancy)} occ</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4">
                    <p className="font-medium text-[#0F172A] mb-2">Private Room</p>
                    <p className="text-lg font-bold text-[#0F172A]">{formatCurrency(result.property_type_analysis.private_room.avg_revenue)}</p>
                    <p className="text-sm text-[#0F172A]/60">{result.property_type_analysis.private_room.count} listings • {formatPercent(result.property_type_analysis.private_room.avg_occupancy)} occ</p>
                  </div>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="font-medium text-green-700">Recommendation: {result.property_type_analysis.recommended_type}</p>
                  <p className="text-sm text-green-600 mt-1">{result.property_type_analysis.recommendation_reason}</p>
                  {result.property_type_analysis.revenue_premium > 0 && (
                    <p className="text-sm text-green-700 mt-2">💰 Entire homes earn {safeFixed(result.property_type_analysis?.revenue_premium, 0)}% more than private rooms</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Nearby Markets */}
            {result.nearby_markets && result.nearby_markets.alternatives && result.nearby_markets.alternatives.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Nearby Market Alternatives</h4>
                </div>
                <div className="space-y-3">
                  {/* Current Market */}
                  <div className="bg-[#C9A962]/10 rounded-xl p-4 border border-[#C9A962]/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[#0F172A]">{result.nearby_markets.current_market.name} (Current)</p>
                        <p className="text-sm text-[#0F172A]/60">{formatCurrency(result.nearby_markets.current_market.revenue)} avg revenue</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-[#0F172A]/60">{formatPercent(result.nearby_markets.current_market.occupancy)} occ</p>
                        <p className="text-sm text-[#0F172A]/60">{formatCurrency(result.nearby_markets.current_market.adr)} ADR</p>
                      </div>
                    </div>
                  </div>
                  {/* Alternatives */}
                  {result.nearby_markets.alternatives.slice(0, 3).map((alt, i) => (
                    <div key={i} className="bg-[#FDF8F3] rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[#0F172A]">{alt.name}</p>
                          <p className="text-sm text-[#0F172A]/60">{formatCurrency(alt.revenue)} avg revenue • {safeFixed(alt.distance_km, 0)}km away</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-[#0F172A]/60">{formatPercent(alt.occupancy)} occ</p>
                          <p className="text-sm text-[#0F172A]/60">{formatCurrency(alt.adr)} ADR</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {result.nearby_markets.recommendation && (
                  <p className="mt-4 text-sm text-[#0F172A]/70 bg-[#FDF8F3] rounded-lg p-3">{result.nearby_markets.recommendation}</p>
                )}
              </div>
            )}
            
            {/* Feasibility Assessment */}
            {result.airdna_feasibility && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Feasibility Assessment</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{formatCurrency(result.airdna_feasibility.projections.annual_revenue)}</p>
                    <p className="text-sm text-[#0F172A]/60">Projected Revenue</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{safeFixed(result.airdna_feasibility.projections.break_even_occupancy, 0)}%</p>
                    <p className="text-sm text-[#0F172A]/60">Break-Even Occupancy</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className={`text-2xl font-bold ${result.airdna_feasibility?.risk_assessment?.overall_risk === 'low' ? 'text-green-600' : result.airdna_feasibility?.risk_assessment?.overall_risk === 'high' ? 'text-red-600' : 'text-yellow-600'}`}>
                      {(result.airdna_feasibility?.risk_assessment?.overall_risk || 'medium').toUpperCase()}
                    </p>
                    <p className="text-sm text-[#0F172A]/60">Risk Level</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{result.airdna_feasibility.comparison.profit_difference_pct > 0 ? '+' : ''}{safeFixed(result.airdna_feasibility?.comparison?.profit_difference_pct, 0)}%</p>
                    <p className="text-sm text-[#0F172A]/60">vs Our Estimate</p>
                  </div>
                </div>
                {result.airdna_feasibility.recommendation && (
                  <p className="text-sm text-[#0F172A]/70 bg-[#FDF8F3] rounded-lg p-3">{result.airdna_feasibility.recommendation}</p>
                )}
              </div>
            )}
            
            {/* ==================== TIER 2: SUBMARKET DATA ==================== */}
            
            {/* Submarket Exploration */}
            {result.submarket_exploration && result.submarket_exploration.submarkets && result.submarket_exploration.submarkets.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Submarket Analysis</h4>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-[#0F172A]/60">Your property is in:</p>
                  <p className="text-lg font-semibold text-[#0F172A]">{result.submarket_exploration.property_submarket_name}</p>
                  <p className="text-sm text-[#C9A962]">Rank #{result.submarket_exploration.property_submarket_rank} of {result.submarket_exploration.submarkets.length} submarkets</p>
                </div>
                <div className="space-y-2">
                  {result.submarket_exploration.submarkets.slice(0, 5).map((sm, i) => (
                    <div key={i} className={`rounded-xl p-3 ${sm.name === result.submarket_exploration?.property_submarket_name ? 'bg-[#C9A962]/10 border border-[#C9A962]/30' : 'bg-[#FDF8F3]'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[#0F172A]">
                            #{i + 1} {sm.name}
                            {sm.name === result.submarket_exploration?.property_submarket_name && <span className="ml-2 text-xs text-[#C9A962]">(Your Area)</span>}
                          </p>
                          <p className="text-sm text-[#0F172A]/60">{sm.listing_count} listings</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-[#0F172A]">{formatCurrency(sm.metrics.revenue)}</p>
                          <p className="text-xs text-[#0F172A]/60">{formatPercent(sm.metrics.occupancy)} occ • {formatCurrency(sm.metrics.adr)} ADR</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {result.submarket_exploration.top_recommendation && (
                  <p className="mt-4 text-sm text-[#0F172A]/70 bg-[#FDF8F3] rounded-lg p-3">💡 {result.submarket_exploration.top_recommendation}</p>
                )}
              </div>
            )}
            
            {/* Submarket Listings */}
            {result.submarket_listings && result.submarket_listings.top_listings && result.submarket_listings.top_listings.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Building className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Top Performers in {result.submarket_listings.submarket_name}</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#0F172A]">{result.submarket_listings.total_listings}</p>
                    <p className="text-xs text-[#0F172A]/60">Total Listings</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#0F172A]">{formatCurrency(result.submarket_listings.avg_revenue)}</p>
                    <p className="text-xs text-[#0F172A]/60">Avg Revenue</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#0F172A]">{formatCurrency(result.submarket_listings.avg_adr)}</p>
                    <p className="text-xs text-[#0F172A]/60">Avg ADR</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#0F172A]">{formatPercent(result.submarket_listings.avg_occupancy)}</p>
                    <p className="text-xs text-[#0F172A]/60">Avg Occupancy</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {result.submarket_listings.top_listings.slice(0, 5).map((listing, i) => (
                    <div key={i} className="bg-[#FDF8F3] rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[#0F172A] text-sm">{listing.name}</p>
                        <p className="text-xs text-[#0F172A]/60">{listing.bedrooms} bed • {listing.rating ? `${safeFixed(listing.rating, 1)}★` : 'No rating'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[#0F172A]">{formatCurrency(listing.annual_revenue)}</p>
                        <p className="text-xs text-[#0F172A]/60">{formatPercent(listing.occupancy)} occ</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* ==================== TIER 3: COMPETITOR INTELLIGENCE ==================== */}
            
            {/* Top Performer Pricing Strategy */}
            {result.top_performer_pricing && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Top Performer Pricing Strategy</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{formatCurrency(result.top_performer_pricing.avg_weekday_price)}</p>
                    <p className="text-sm text-[#0F172A]/60">Weekday Price</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(result.top_performer_pricing.avg_weekend_price)}</p>
                    <p className="text-sm text-[#0F172A]/60">Weekend Price</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#C9A962]">+{safeFixed(result.top_performer_pricing?.weekend_premium_percent, 0)}%</p>
                    <p className="text-sm text-[#0F172A]/60">Weekend Premium</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-lg font-bold text-[#0F172A]">{formatCurrency(result.top_performer_pricing.price_range_low)} - {formatCurrency(result.top_performer_pricing.price_range_high)}</p>
                    <p className="text-sm text-[#0F172A]/60">Price Range</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-[#0F172A]/70 bg-[#FDF8F3] rounded-lg p-3">
                  💡 Based on {result.top_performer_pricing.days_of_data} days of pricing data from top performers.
                </p>
              </div>
            )}
            
            {/* Rentalizer Comps Summary */}
            {result.rentalizer_comps && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Comparable Properties Analysis</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{result.rentalizer_comps.total_comps}</p>
                    <p className="text-sm text-[#0F172A]/60">Total Comps</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#C9A962]">{safeFixed(result.rentalizer_comps?.superhost_percentage, 0)}%</p>
                    <p className="text-sm text-[#0F172A]/60">Superhosts</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{formatCurrency(result.rentalizer_comps.avg_revenue)}</p>
                    <p className="text-sm text-[#0F172A]/60">Avg Revenue</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{safeFixed((result.rentalizer_comps?.avg_distance_meters || 0) / 1000, 1)}km</p>
                    <p className="text-sm text-[#0F172A]/60">Avg Distance</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Superhost Top Performers */}
            {result.superhost_top_performers && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Superhost Performance</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{result.superhost_top_performers.total_superhosts_in_market}</p>
                    <p className="text-sm text-[#0F172A]/60">Superhosts in Market</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(result.superhost_top_performers.avg_superhost_revenue)}</p>
                    <p className="text-sm text-[#0F172A]/60">Avg Superhost Revenue</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#C9A962]">{safeFixed(result.superhost_top_performers?.avg_superhost_rating, 1)}★</p>
                    <p className="text-sm text-[#0F172A]/60">Avg Rating</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">+{safeFixed(result.superhost_top_performers?.revenue_premium_vs_market, 0)}%</p>
                    <p className="text-sm text-[#0F172A]/60">Revenue Premium</p>
                  </div>
                </div>
                <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
                  💡 Superhosts earn {safeFixed(result.superhost_top_performers?.revenue_premium_vs_market, 0)}% more than the market average. Achieving Superhost status could significantly boost your revenue.
                </p>
              </div>
            )}
            
            {/* Competitor Imagery Insights */}
            {result.competitor_imagery && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Competitor Photo Analysis</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{result.competitor_imagery.total_competitors_analyzed}</p>
                    <p className="text-sm text-[#0F172A]/60">Analyzed</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{safeFixed(result.competitor_imagery?.avg_image_count, 0)}</p>
                    <p className="text-sm text-[#0F172A]/60">Avg Photos</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{result.competitor_imagery.max_image_count}</p>
                    <p className="text-sm text-[#0F172A]/60">Max Photos</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{result.competitor_imagery.min_image_count}</p>
                    <p className="text-sm text-[#0F172A]/60">Min Photos</p>
                  </div>
                </div>
                {result.competitor_imagery.photo_quality_insights && result.competitor_imagery.photo_quality_insights.length > 0 && (
                  <div className="bg-[#FDF8F3] rounded-xl p-4">
                    <p className="text-sm font-medium text-[#0F172A] mb-2">Photo Quality Insights</p>
                    <ul className="text-sm text-[#0F172A]/70 space-y-1">
                      {result.competitor_imagery.photo_quality_insights.slice(0, 3).map((insight, i) => (
                        <li key={i}>• {insight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {/* ==================== REMAINING TIER 2: SUBMARKET DATA ==================== */}
            
            {/* Submarket Deep Dive */}
            {result.submarket_deep_dive && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Submarket Deep Dive: {result.submarket_deep_dive.submarket_name}</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{result.submarket_deep_dive.listing_count}</p>
                    <p className="text-sm text-[#0F172A]/60">Listings</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(result.submarket_deep_dive.metrics.revenue)}</p>
                    <p className="text-sm text-[#0F172A]/60">Avg Revenue</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{formatPercent(result.submarket_deep_dive.metrics.occupancy)}</p>
                    <p className="text-sm text-[#0F172A]/60">Occupancy</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#C9A962]">{formatCurrency(result.submarket_deep_dive.metrics.revpar)}</p>
                    <p className="text-sm text-[#0F172A]/60">RevPAR</p>
                  </div>
                </div>
                {/* Bedroom Performance */}
                {result.submarket_deep_dive.bedroom_performance && result.submarket_deep_dive.bedroom_performance.length > 0 && (
                  <div className="bg-[#FDF8F3] rounded-xl p-4 mb-4">
                    <p className="text-sm font-medium text-[#0F172A] mb-2">Performance by Bedroom Count</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {result.submarket_deep_dive.bedroom_performance.slice(0, 4).map((bp, i) => (
                        <div key={i} className="bg-white rounded-lg p-2 text-center">
                          <p className="text-xs text-[#0F172A]/60">{bp.bedrooms} BR</p>
                          <p className="font-semibold text-[#0F172A]">{formatCurrency(bp.revenue)}</p>
                          <p className="text-xs text-[#0F172A]/40">{formatPercent(bp.occupancy)} occ</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Insights */}
                {result.submarket_deep_dive.insights && result.submarket_deep_dive.insights.length > 0 && (
                  <div className="bg-[#FDF8F3] rounded-xl p-4">
                    <p className="text-sm font-medium text-[#0F172A] mb-2">Key Insights</p>
                    <ul className="text-sm text-[#0F172A]/70 space-y-1">
                      {result.submarket_deep_dive.insights.slice(0, 3).map((insight, i) => (
                        <li key={i}>• {insight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {/* Submarket Details */}
            {result.submarket_details && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Submarket Details</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4">
                    <p className="text-sm text-[#0F172A]/60 mb-1">Submarket</p>
                    <p className="font-semibold text-[#0F172A]">{result.submarket_details.submarket_name}</p>
                    <p className="text-xs text-[#0F172A]/40">Type: {result.submarket_details.market_type}</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4">
                    <p className="text-sm text-[#0F172A]/60 mb-1">Parent Market</p>
                    <p className="font-semibold text-[#0F172A]">{result.submarket_details.parent_market_name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#0F172A]">{formatCurrency(result.submarket_details.metrics.revenue)}</p>
                    <p className="text-xs text-[#0F172A]/60">Revenue</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#0F172A]">{formatPercent(result.submarket_details.metrics.occupancy)}</p>
                    <p className="text-xs text-[#0F172A]/60">Occupancy</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#0F172A]">{formatCurrency(result.submarket_details.metrics.adr)}</p>
                    <p className="text-xs text-[#0F172A]/60">ADR</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#0F172A]">{result.submarket_details.metrics.listing_count}</p>
                    <p className="text-xs text-[#0F172A]/60">Listings</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* All Submarkets Comparison */}
            {result.all_submarkets && result.all_submarkets.submarkets && result.all_submarkets.submarkets.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">All Submarkets Comparison</h4>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-[#0F172A]/60">Your property is in:</p>
                  <p className="text-lg font-semibold text-[#0F172A]">{result.all_submarkets.property_submarket_name}</p>
                  <p className="text-sm text-[#C9A962]">Rank #{result.all_submarkets.property_submarket_rank} of {result.all_submarkets.total_submarkets} submarkets</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#C9A962]/20">
                        <th className="text-left py-2 text-[#0F172A]/60">Submarket</th>
                        <th className="text-right py-2 text-[#0F172A]/60">Listings</th>
                        <th className="text-right py-2 text-[#0F172A]/60">Revenue</th>
                        <th className="text-right py-2 text-[#0F172A]/60">Occupancy</th>
                        <th className="text-right py-2 text-[#0F172A]/60">ADR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.all_submarkets.submarkets.slice(0, 8).map((sm, i) => (
                        <tr key={i} className={`border-b border-[#C9A962]/10 ${sm.name === result.all_submarkets?.property_submarket_name ? 'bg-[#C9A962]/10' : ''}`}>
                          <td className="py-2 font-medium text-[#0F172A]">
                            {sm.name}
                            {sm.name === result.all_submarkets?.property_submarket_name && <span className="ml-2 text-xs text-[#C9A962]">★</span>}
                          </td>
                          <td className="text-right py-2 text-[#0F172A]/70">{sm.listing_count}</td>
                          <td className="text-right py-2 font-semibold text-[#0F172A]">{formatCurrency(sm.revenue)}</td>
                          <td className="text-right py-2 text-[#0F172A]/70">{formatPercent(sm.occupancy)}</td>
                          <td className="text-right py-2 text-[#0F172A]/70">{formatCurrency(sm.adr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* ==================== REMAINING TIER 3: COMPETITOR INTELLIGENCE ==================== */}
            
            {/* Top Performer Comps - Detailed */}
            {result.top_performer_comps && result.top_performer_comps.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Top Performer Details</h4>
                </div>
                <div className="space-y-3">
                  {result.top_performer_comps.slice(0, 5).map((comp, i) => (
                    <div key={i} className="bg-[#FDF8F3] rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-[#0F172A]">{comp.title}</p>
                          <p className="text-sm text-[#0F172A]/60">{comp.bedrooms} bed • {comp.bathrooms} bath • {comp.property_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{formatCurrency(comp.annual_revenue)}/yr</p>
                          {comp.similarity_score && (
                            <p className="text-xs text-[#C9A962]">{safeFixed((comp.similarity_score || 0) * 100, 0)}% similar</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{formatCurrency(comp.adr)}</p>
                          <p className="text-xs text-[#0F172A]/40">ADR</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{formatPercent(comp.occupancy)}</p>
                          <p className="text-xs text-[#0F172A]/40">Occupancy</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{comp.rating?.toFixed(1) || 'N/A'}★</p>
                          <p className="text-xs text-[#0F172A]/40">Rating</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{comp.reviews || 0}</p>
                          <p className="text-xs text-[#0F172A]/40">Reviews</p>
                        </div>
                      </div>
                      {comp.amenities && comp.amenities.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {comp.amenities.slice(0, 5).map((amenity, j) => (
                            <span key={j} className="text-xs bg-white px-2 py-0.5 rounded-full border border-[#C9A962]/20">{amenity}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Same Bedroom Radius Listings */}
            {result.same_bedroom_radius_listings && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BedDouble className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Same-Bedroom Competitors ({result.same_bedroom_radius_listings.bedroom_filter} BR within {safeFixed((result.same_bedroom_radius_listings?.search_radius_meters || 0) / 1000, 1)}km)</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{result.same_bedroom_radius_listings.total_found}</p>
                    <p className="text-sm text-[#0F172A]/60">Total Found</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(result.same_bedroom_radius_listings.avg_revenue)}</p>
                    <p className="text-sm text-[#0F172A]/60">Avg Revenue</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#C9A962]">{result.same_bedroom_radius_listings.superhost_count}</p>
                    <p className="text-sm text-[#0F172A]/60">Superhosts</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">{result.same_bedroom_radius_listings.professional_count}</p>
                    <p className="text-sm text-[#0F172A]/60">Professionals</p>
                  </div>
                </div>
                {result.same_bedroom_radius_listings.top_performers && result.same_bedroom_radius_listings.top_performers.length > 0 && (
                  <div className="space-y-2">
                    {result.same_bedroom_radius_listings.top_performers.slice(0, 5).map((perf, i) => (
                      <div key={i} className="bg-[#FDF8F3] rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[#0F172A] text-sm">{perf.title}</p>
                          <p className="text-xs text-[#0F172A]/60">
                            {safeFixed(perf.rating, 1) || 'N/A'}★ {perf.distance_meters ? `• ${perf.distance_meters < 1000 ? `${Math.round(perf.distance_meters)}m` : `${safeFixed(perf.distance_meters / 1000, 1)}km`} away` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-[#0F172A]">{formatCurrency(perf.annual_revenue)}</p>
                          <p className="text-xs text-[#0F172A]/60">{formatPercent(perf.occupancy)} occ</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Daily Pricing Calendar */}
            {result.daily_pricing && result.daily_pricing.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Daily Pricing Intelligence</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">
                      {formatCurrency(result.daily_pricing.reduce((sum, d) => sum + d.avg_price, 0) / result.daily_pricing.length)}
                    </p>
                    <p className="text-sm text-[#0F172A]/60">Avg Daily Price</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(Math.max(...result.daily_pricing.map(d => d.max_price)))}
                    </p>
                    <p className="text-sm text-[#0F172A]/60">Peak Price</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#0F172A]">
                      {formatCurrency(Math.min(...result.daily_pricing.map(d => d.min_price)))}
                    </p>
                    <p className="text-sm text-[#0F172A]/60">Low Price</p>
                  </div>
                  <div className="bg-[#FDF8F3] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#C9A962]">{result.daily_pricing.length}</p>
                    <p className="text-sm text-[#0F172A]/60">Days Analyzed</p>
                  </div>
                </div>
                <div className="bg-[#FDF8F3] rounded-xl p-4">
                  <p className="text-sm font-medium text-[#0F172A] mb-2">Price Range by Day</p>
                  <div className="flex flex-wrap gap-1">
                    {result.daily_pricing.slice(0, 14).map((day, i) => (
                      <div key={i} className="text-xs bg-white px-2 py-1 rounded border border-[#C9A962]/20">
                        <span className="text-[#0F172A]/60">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <span className="ml-1 font-semibold text-[#0F172A]">{formatCurrency(day.avg_price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Competitor Historical Performance */}
            {result.competitor_historical && result.competitor_historical.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#C9A962]/20 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-[#C9A962]" />
                  <h4 className="font-semibold text-[#0F172A] font-serif">Competitor Historical Performance</h4>
                </div>
                <div className="space-y-4">
                  {result.competitor_historical.slice(0, 3).map((comp, i) => (
                    <div key={i} className="bg-[#FDF8F3] rounded-xl p-4">
                      <p className="font-medium text-[#0F172A] mb-2">{comp.title}</p>
                      {comp.monthly_data && comp.monthly_data.length > 0 && (
                        <div className="grid grid-cols-6 gap-1">
                          {comp.monthly_data.slice(-6).map((month, j) => (
                            <div key={j} className="text-center">
                              <p className="text-xs text-[#0F172A]/40">{new Date(month.month).toLocaleDateString('en-US', { month: 'short' })}</p>
                              <p className="text-sm font-semibold text-[#0F172A]">{formatCurrency(month.revenue / 1000)}K</p>
                              <p className="text-xs text-[#0F172A]/60">{formatPercent(month.occupancy)}</p>
                            </div>
                          ))}
                        </div>
                      )}
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
            
            {/* Deep AI Analysis CTA */}
            {result.reportId && (
              <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-2xl border border-purple-500/20 p-8 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Brain className="w-6 h-6 text-purple-500" />
                  <h3 className="text-2xl font-bold text-[#0F172A] font-serif">
                    Want Deeper Insights?
                  </h3>
                </div>
                <p className="text-[#0F172A]/70 mb-6 max-w-xl mx-auto">
                  Our AI can generate an in-depth analysis including investment thesis, 
                  historical market context, risk assessment, and a detailed action plan.
                </p>
                <Button
                  className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white border-0 shadow-lg"
                  onClick={() => {
                    window.location.href = `/deep-analysis/${result.reportId}`;
                  }}
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Get Deep AI Analysis
                </Button>
                <p className="text-[#0F172A]/50 text-sm mt-4">
                  Takes 2-3 minutes to generate comprehensive insights.
                </p>
              </div>
            )}
            
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
