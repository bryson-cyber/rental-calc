/**
 * DESIGN: Coach Inayah Brand - Premium Property Investment Aesthetic
 * - Gold/Mustard (#D4A84B) + Teal (#4ECDC4) + Blush (#FDF5F5) palette
 * - Playfair Display serif headlines + DM Sans body
 * - Warm blush backgrounds with subtle texture
 * - Sophisticated animations with 300-400ms transitions
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Home, 
  TrendingUp, 
  MapPin, 
  Star, 
  ChevronRight, 
  Loader2, 
  Building, 
  Calendar,
  Users,
  BedDouble,
  Bath,
  AlertCircle,
  Download,
  DollarSign,
  BarChart3,
  Target,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Percent,
  Clock,
  TrendingDown,
  Lightbulb,
  Award,
  Heart
} from 'lucide-react';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { SmartAddressInput, type PropertyDetails } from '@/components/SmartAddressInput';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { generateRentalReportPdf } from '@/lib/generatePdf';
import ChapterPropertyReport from '@/components/ChapterPropertyReport';
import AnalysisProgress from '@/components/AnalysisProgress';
import EnhancedInsights, { type EnhancedNarrativeReport } from '@/components/EnhancedInsights';
import { useAnalysisProgress } from '@/hooks/useAnalysisProgress';
import { SEOHead, calculatorSchema, organizationSchema } from '@/components/SEOHead';
import { UsageLimitBadge } from '@/components/UsageLimitBadge';
import { useReportMode } from '@/contexts/ReportModeContext';

// Type definitions based on API response
interface MonthlyForecast {
  month: string;
  revenue: number;
  adr: number;
  occupancy: number;
}

interface Comp {
  title: string;
  bedrooms: number;
  bathrooms: number;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  distance_meters: number;
  airbnb_url?: string;
  image_url?: string;
  property_type?: string;
}

interface PropertyEstimate {
  property: {
    address: string;
    address_lookup?: string;
    zipcode?: string;
    bedrooms: number;
    bathrooms: number;
    accommodates: number;
    latitude?: number;
    longitude?: number;
  };
  estimates: {
    annual_revenue: number;
    annual_revenue_low: number;
    annual_revenue_high: number;
    average_daily_rate: number;
    occupancy_rate: number;
    currency?: string;
    currency_symbol?: string;
  };
  monthly_forecast: MonthlyForecast[];
  comps: Comp[];
}

interface HistoricalDataPoint {
  date: string;
  value: number;
}

interface MarketData {
  id: string;
  name: string;
  listing_count: number;
  metrics: {
    occupancy: number;
    adr: number;
    revenue: number;
    revpar: number;
    active_listings: number;
    market_score?: number;
  };
  historical?: {
    occupancy: HistoricalDataPoint[];
    adr: HistoricalDataPoint[];
    revenue: HistoricalDataPoint[];
    revpar: HistoricalDataPoint[];
    active_listings: HistoricalDataPoint[];
  };
}

interface SubmarketData {
  id: string;
  name: string;
  listing_count: number;
}

interface ListingData {
  id: string;
  title: string;
  airbnb_url?: string;
  image_url?: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  property_type: string;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  superhost?: boolean;
  distance_meters?: number;
}

interface BedroomPerformance {
  bedrooms: number;
  occupancy: number;
  adr: number;
  revenue: number;
  listing_count: number;
}

interface ComprehensiveReportData {
  property: PropertyEstimate;
  market: MarketData | null;
  submarkets: SubmarketData[];
  same_bedroom_comps: ListingData[];
  bedroom_performance: BedroomPerformance[];
  generated_at: string;
  enhanced_narrative_report?: EnhancedNarrativeReport;
}

// Animated counter component
function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(value || 0);
  const animationRef = useRef<number | null>(null);
  const prevValueRef = useRef(value);
  
  useEffect(() => {
    // If value hasn't changed or is 0, don't animate
    if (value === prevValueRef.current || value === 0) {
      setDisplayValue(value);
      return;
    }
    
    const duration = 1500;
    const startTime = Date.now();
    const startValue = prevValueRef.current || 0;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(startValue + (value - startValue) * easeOutQuart);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = value;
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value]);
  
  // If value is provided and displayValue is still 0, show value immediately
  const showValue = displayValue === 0 && value > 0 ? value : displayValue;
  
  return (
    <span>
      {prefix}{showValue.toLocaleString()}{suffix}
    </span>
  );
}

// Helper to parse Zillow URL
function parseZillowUrl(url: string): { address: string | null; bedrooms?: number; bathrooms?: number } {
  try {
    // Clean the URL
    const cleanUrl = url.trim();
    
    // Extract address from Zillow URL patterns
    // Pattern 1: https://www.zillow.com/homedetails/123-Main-St-Denver-CO-80202/12345_zpid/
    // Pattern 2: https://www.zillow.com/homes/123-Main-St-Denver-CO-80202_rb/
    // Pattern 3: https://www.zillow.com/b/123-main-st-denver-co/
    
    let addressPart: string | null = null;
    
    // Try homedetails pattern first
    const homeDetailsMatch = cleanUrl.match(/homedetails\/([^\/]+)\//i);
    if (homeDetailsMatch) {
      addressPart = homeDetailsMatch[1];
    }
    
    // Try homes pattern
    if (!addressPart) {
      const homesMatch = cleanUrl.match(/homes\/([^\/]+?)(?:_rb|\/|$)/i);
      if (homesMatch) {
        addressPart = homesMatch[1];
      }
    }
    
    // Try /b/ pattern (building/apartment)
    if (!addressPart) {
      const buildingMatch = cleanUrl.match(/\/b\/([^\/]+)\//i);
      if (buildingMatch) {
        addressPart = buildingMatch[1];
      }
    }
    
    if (addressPart) {
      // Remove zpid suffix if present
      addressPart = addressPart.replace(/\/\d+_zpid\/?$/, '').replace(/_zpid$/, '');
      
      // Convert URL-encoded address to readable format
      let address = addressPart
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/%20/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Capitalize words properly
      address = address.split(' ').map((word, index) => {
        // Keep state abbreviations uppercase
        if (word.length === 2 && /^[A-Za-z]{2}$/.test(word)) {
          return word.toUpperCase();
        }
        // Keep zip codes as-is
        if (/^\d{5}(-\d{4})?$/.test(word)) {
          return word;
        }
        // Capitalize first letter of other words
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }).join(' ');
      
      return { address };
    }
    
    return { address: null };
  } catch {
    return { address: null };
  }
}

export default function RentalEstimator() {
  const { mode: reportMode } = useReportMode();
  const [step, setStep] = useState<'search' | 'lead' | 'loading' | 'results'>('search');
  const [error, setError] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'address' | 'zillow'>('address');
  const [zillowUrl, setZillowUrl] = useState('');
  
  // Parse URL parameters for pre-filling from Opportunity Finder
  const getInitialFormData = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const address = params.get('address');
      const bedrooms = params.get('bedrooms');
      const bathrooms = params.get('bathrooms');
      const rent = params.get('rent');
      
      if (address) {
        const beds = bedrooms ? parseInt(bedrooms) : 2;
        return {
          address: address,
          bedrooms: beds,
          bathrooms: bathrooms ? parseFloat(bathrooms) : 1,
          accommodates: beds * 2,
          monthlyRent: rent ? parseInt(rent) : 0,
          propertyType: 'House'
        };
      }
    }
    return {
      address: '',
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4,
      monthlyRent: 0,
      propertyType: 'House'
    };
  };
  
  const [formData, setFormData] = useState(getInitialFormData);

  // Auto-calculate guests as 2 per bedroom when bedrooms change
  const updateBedrooms = (bedrooms: number) => {
    setFormData(prev => ({
      ...prev,
      bedrooms,
      accommodates: bedrooms * 2 // 2 guests per bedroom
    }));
  };
  const [leadData, setLeadData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [reportData, setReportData] = useState<ComprehensiveReportData | null>(null);

  // SEO is now handled by SEOHead component in the return statement

  // Progress tracking for real-time updates
  const { sessionId, progress, startTracking, stopTracking } = useAnalysisProgress();

  // tRPC mutations - use analyzeProperty for full analysis with progress tracking
  const analyzePropertyMutation = trpc.advanced.analyzeProperty.useMutation();
  const submitLeadMutation = trpc.rental.submitLead.useMutation();

  const handleZillowParse = () => {
    if (!zillowUrl) return;
    const parsed = parseZillowUrl(zillowUrl);
    if (parsed.address) {
      setFormData({ ...formData, address: parsed.address });
      setInputType('address');
    } else {
      setError('Could not parse address from Zillow URL. Please enter the address manually.');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.address) {
      setError('Please enter a property address');
      return;
    }
    if (!formData.monthlyRent || formData.monthlyRent <= 0) {
      setError('Please enter the monthly rent for this property');
      return;
    }
    setError(null);
    setStep('lead');
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadData.email || !leadData.name) {
      setError('Please enter your name and email');
      return;
    }
    
    setError(null);
    setStep('loading');
    
    // Start progress tracking and get session ID
    const trackingSessionId = startTracking();
    
    try {
      // Submit lead first
      await submitLeadMutation.mutateAsync({
        name: leadData.name,
        email: leadData.email,
        phone: leadData.phone || undefined,
        address: formData.address,
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
        accommodates: formData.accommodates,
        zillow_url: zillowUrl || undefined,
      });

      // Run comprehensive analysis with progress tracking
      const result = await analyzePropertyMutation.mutateAsync({
        address: formData.address,
        monthly_rent: formData.monthlyRent,
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
        sessionId: trackingSessionId, // Enable real-time progress updates
        reportMode: reportMode,
      });

      // Stop progress tracking
      stopTracking();

      if (result.success && result.data) {
        // Transform the analysis result to match ComprehensiveReportData
        const analysisData = result.data as any;
        const propEst = analysisData.property_estimate as any;
        const percentiles = analysisData.percentiles as any;
        const competitors = analysisData.competitors as any[] || [];
        
        const reportData: ComprehensiveReportData = {
          property: propEst || {
            property: {
              address: formData.address,
              bedrooms: formData.bedrooms,
              bathrooms: formData.bathrooms,
              accommodates: formData.bedrooms * 2,
            },
            estimates: {
              annual_revenue: percentiles?.p50 || 0,
              annual_revenue_low: percentiles?.p25 || 0,
              annual_revenue_high: percentiles?.p75 || 0,
              average_daily_rate: propEst?.estimates?.average_daily_rate || 0,
              occupancy_rate: propEst?.estimates?.occupancy_rate || 0,
            },
            monthly_forecast: propEst?.monthly_forecast || [],
            comps: competitors.map((c: any) => ({
              title: c.name,
              bedrooms: c.bedrooms,
              bathrooms: c.bathrooms,
              rating: c.rating,
              reviews: c.reviews,
              annual_revenue: c.annual_revenue,
              adr: c.adr,
              occupancy: c.occupancy,
              distance_meters: 0,
              airbnb_url: c.airbnb_url,
              image_url: c.image_url,
              property_type: c.property_type,
            })),
          },
          market: null,
          submarkets: [],
          same_bedroom_comps: competitors.map((c: any) => ({
            id: c.id || '',
            title: c.name,
            airbnb_url: c.airbnb_url,
            image_url: c.image_url,
            bedrooms: c.bedrooms,
            bathrooms: c.bathrooms,
            accommodates: c.accommodates || 0,
            property_type: c.property_type || 'house',
            rating: c.rating,
            reviews: c.reviews,
            annual_revenue: c.annual_revenue,
            adr: c.adr,
            occupancy: c.occupancy,
          })),
          bedroom_performance: [],
          generated_at: new Date().toISOString(),
          enhanced_narrative_report: analysisData.enhanced_narrative_report as EnhancedNarrativeReport | undefined,
        };
        setReportData(reportData);
        setStep('results');
      } else {
        setError(result.error || 'Failed to generate report. Please try again.');
        setStep('lead');
      }
    } catch (err) {
      console.error('Error getting report:', err);
      stopTracking();
      setError('An error occurred while generating your report. Please try again.');
      setStep('lead');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    // Handle both decimal (0.77) and whole number (77) formats
    const percent = value > 1 ? value : value * 100;
    return `${Math.round(percent)}%`;
  };

  const formatMonth = (dateStr: string) => {
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  const formatFullMonth = (dateStr: string) => {
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5
      }
    }
  };

  // Search Form
  if (step === 'search') {
    return (
      <>
        <SEOHead
          title="Free Airbnb Calculator"
          description="Discover how much your property could earn on Airbnb & VRBO. Free rental revenue calculator with market data, comparable properties, and investment analysis."
          canonicalPath="/"
          keywords={['Airbnb calculator', 'rental arbitrage', 'short-term rental revenue', 'vacation rental profit', 'STR analysis', 'rental income estimator']}
          structuredData={[calculatorSchema, organizationSchema]}
        />
        <div className="min-h-screen relative overflow-hidden">
        {/* Background Image with Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/hero-property.jpg)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A1A]/90 via-[#1A1A1A]/80 to-[#2D2D2D]/70" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-12">
          <motion.div 
            className="w-full max-w-2xl"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {/* Header */}
            <motion.div className="text-center mb-10" variants={itemVariants}>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#D4A84B]/20 rounded-xl mb-6 backdrop-blur-sm border border-[#D4A84B]/30">
                <Home className="w-8 h-8 text-[#D4A84B]" />
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-semibold text-white mb-4 tracking-tight">
                Rental Revenue Calculator
              </h1>
              <p className="text-lg text-white/70 font-sans max-w-lg mx-auto">
                See what your property could earn as a short-term rental
              </p>
              <div className="mt-4">
                <UsageLimitBadge type="property" />
              </div>
            </motion.div>
            
            {/* Form Card */}
            <motion.form 
              onSubmit={handleSearch} 
              className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 md:p-10"
              variants={itemVariants}
            >
              {/* Input Type Toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => setInputType('address')}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 font-sans text-sm ${
                    inputType === 'address'
                      ? 'bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] text-white'
                      : 'bg-[#0F172A]/5 text-[#0F172A]/60 hover:bg-[#0F172A]/10'
                  }`}
                >
                  Enter Address
                </button>
                <button
                  type="button"
                  onClick={() => setInputType('zillow')}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 font-sans text-sm ${
                    inputType === 'zillow'
                      ? 'bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] text-white'
                      : 'bg-[#0F172A]/5 text-[#0F172A]/60 hover:bg-[#0F172A]/10'
                  }`}
                >
                  Paste Zillow Link
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${error.includes('limit reached') ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
                  <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${error.includes('limit reached') ? 'text-amber-500' : 'text-red-500'}`} />
                  <div>
                    <p className={`text-sm font-sans ${error.includes('limit reached') ? 'text-amber-700' : 'text-red-700'}`}>{error}</p>
                    {error.includes('limit reached') && (
                      <p className="text-xs text-amber-600 mt-1 font-sans">Usage limits reset daily. Contact Coach Inayah for unlimited access.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Zillow URL Input */}
              {inputType === 'zillow' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans uppercase tracking-wider">
                    Zillow Property Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={zillowUrl}
                      onChange={(e) => setZillowUrl(e.target.value)}
                      placeholder="https://www.zillow.com/homedetails/..."
                      className="flex-1 px-4 py-3 border-2 border-[#0F172A]/10 rounded-xl text-base focus:ring-2 focus:ring-[#D4A84B]/50 focus:border-[#D4A84B] outline-none transition-all duration-300 font-sans bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleZillowParse}
                      className="px-4 py-3 bg-[#0F172A]/10 hover:bg-[#0F172A]/20 rounded-xl transition-colors"
                    >
                      <ArrowRight className="w-5 h-5 text-[#0F172A]" />
                    </button>
                  </div>
                  <p className="text-xs text-[#0F172A]/50 mt-2 font-sans">
                    Paste a Zillow listing URL and we'll extract the address
                  </p>
                </div>
              )}

              {/* Address Input - Smart Input accepts Zillow URLs */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans uppercase tracking-wider">
                  Property Address or Zillow/Redfin URL
                </label>
                <SmartAddressInput
                  value={formData.address}
                  onChange={(value) => setFormData({ ...formData, address: value })}
                  onPropertyDetected={(details: PropertyDetails) => {
                    // Auto-fill property details from Zillow
                    const updates: Partial<typeof formData> = { address: details.address };
                    if (details.bedrooms !== null) updates.bedrooms = details.bedrooms;
                    if (details.bathrooms !== null) updates.bathrooms = details.bathrooms;
                    if (details.price !== null && details.priceType === 'rent') {
                      updates.monthlyRent = details.price;
                    }
                    setFormData(prev => ({ ...prev, ...updates }));
                    toast.success(`Property details loaded from Zillow!`);
                  }}
                  placeholder="Enter address or paste Zillow/Redfin URL..."
                  showPropertyCard={true}
                />
              </div>
              
              {/* Monthly Rent Input - Critical for Arbitrage Analysis */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans uppercase tracking-wider">
                  Monthly Rent (Required for Profit Analysis)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F172A]/40" />
                  <input
                    type="number"
                    min="0"
                    value={formData.monthlyRent || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Prevent negative values
                      const numVal = parseInt(val) || 0;
                      if (val === '' || numVal >= 0) {
                        setFormData({ ...formData, monthlyRent: Math.max(0, numVal) });
                      }
                    }}
                    placeholder="e.g., 2500"
                    className="w-full pl-10 pr-4 py-3 border-2 border-[#0F172A]/10 rounded-xl text-lg focus:ring-2 focus:ring-[#D4A84B]/50 focus:border-[#D4A84B] outline-none transition-all duration-300 font-sans bg-white placeholder:text-slate-500"
                  />
                </div>
                <p className="text-xs text-[#0F172A]/50 mt-2 font-sans">
                  Enter the monthly rent you would pay to lease this property
                </p>
              </div>

              {/* Property Details Grid */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans uppercase tracking-wider">
                    Bedrooms
                  </label>
                  <div className="relative">
                    <BedDouble className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F172A]/40" />
                    <select
                      value={formData.bedrooms}
                      onChange={(e) => updateBedrooms(parseInt(e.target.value))}
                      className="w-full pl-10 pr-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#D4A84B]/50 focus:border-[#D4A84B] outline-none transition-all duration-300 font-sans bg-white appearance-none cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                        <option key={n} value={n}>{n} BR</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans uppercase tracking-wider">
                    Bathrooms
                  </label>
                  <div className="relative">
                    <Bath className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F172A]/40" />
                    <select
                      value={formData.bathrooms}
                      onChange={(e) => setFormData({ ...formData, bathrooms: parseFloat(e.target.value) })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#D4A84B]/50 focus:border-[#D4A84B] outline-none transition-all duration-300 font-sans bg-white appearance-none cursor-pointer"
                    >
                      {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(n => (
                        <option key={n} value={n}>{n} BA</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans uppercase tracking-wider">
                    Guests
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F172A]/40" />
                    <select
                      value={formData.accommodates}
                      onChange={(e) => setFormData({ ...formData, accommodates: parseInt(e.target.value) })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#D4A84B]/50 focus:border-[#D4A84B] outline-none transition-all duration-300 font-sans bg-white appearance-none cursor-pointer"
                    >
                      {[2, 4, 6, 8, 10, 12, 14, 16].map(n => (
                        <option key={n} value={n}>{n} Guests</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] text-white py-4 rounded-xl font-semibold hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2 font-sans shadow-lg hover:shadow-xl"
              >
                <Search className="w-5 h-5" />
                Get Free Estimate
              </button>
              
              {/* Trust Indicators */}
              <div className="mt-6 flex items-center justify-center gap-4 text-sm text-[#0F172A]/50 font-sans">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] rounded-full" />
                  Powered by Coach Inayah | Data from Airbnb & Vrbo
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] rounded-full" />
                  Trusted by 100,000+ hosts
                </span>
              </div>
              
              {/* Market Research Link */}
              <div className="mt-6 pt-6 border-t border-[#0F172A]/10 text-center space-y-3">
                <p className="text-sm text-[#0F172A]/60 font-sans mb-2">
                  Don't have a specific property yet?
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-6">
                  <a 
                    href="/market"
                    className="inline-flex items-center gap-2 text-[#D4A84B] hover:text-[#b89a52] font-medium text-sm transition-colors"
                  >
                    <Building className="w-4 h-4" />
                    Explore Markets
                    <ChevronRight className="w-4 h-4" />
                  </a>
                  <span className="hidden sm:inline text-[#0F172A]/30">|</span>
                  <a 
                    href="/compare-properties"
                    className="inline-flex items-center gap-2 text-[#D4A84B] hover:text-[#b89a52] font-medium text-sm transition-colors"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Compare Properties
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>

                {/* Advanced Tools Grid */}
                <div className="border-t border-[#0F172A]/10 pt-6">
                  <p className="text-xs text-[#0F172A]/50 uppercase tracking-wider mb-4 text-center font-sans">Advanced Tools</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <a href="/scorecard" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0F172A]/5 hover:bg-[#D4A84B]/10 transition-colors group">
                      <Award className="w-5 h-5 text-[#0F172A]/60 group-hover:text-[#D4A84B]" />
                      <span className="text-xs font-medium text-[#0F172A]/70 text-center">Market Scorecard</span>
                    </a>
                    <a href="/map" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0F172A]/5 hover:bg-[#D4A84B]/10 transition-colors group">
                      <MapPin className="w-5 h-5 text-[#0F172A]/60 group-hover:text-[#D4A84B]" />
                      <span className="text-xs font-medium text-[#0F172A]/70 text-center">Market Map</span>
                    </a>
                    <a href="/radius" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0F172A]/5 hover:bg-[#D4A84B]/10 transition-colors group">
                      <Target className="w-5 h-5 text-[#0F172A]/60 group-hover:text-[#D4A84B]" />
                      <span className="text-xs font-medium text-[#0F172A]/70 text-center">Radius Search</span>
                    </a>
                    <a href="/seasonality" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0F172A]/5 hover:bg-[#D4A84B]/10 transition-colors group">
                      <Calendar className="w-5 h-5 text-[#0F172A]/60 group-hover:text-[#D4A84B]" />
                      <span className="text-xs font-medium text-[#0F172A]/70 text-center">Seasonality</span>
                    </a>
                    <a href="/advisor" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0F172A]/5 hover:bg-[#D4A84B]/10 transition-colors group">
                      <Lightbulb className="w-5 h-5 text-[#0F172A]/60 group-hover:text-[#D4A84B]" />
                      <span className="text-xs font-medium text-[#0F172A]/70 text-center">AI Advisor</span>
                    </a>

                    <a href="/top-performers" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0F172A]/5 hover:bg-[#D4A84B]/10 transition-colors group">
                      <TrendingUp className="w-5 h-5 text-[#0F172A]/60 group-hover:text-[#D4A84B]" />
                      <span className="text-xs font-medium text-[#0F172A]/70 text-center">Top Performers</span>
                    </a>
                    <a href="/saved" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0F172A]/5 hover:bg-[#D4A84B]/10 transition-colors group">
                      <Star className="w-5 h-5 text-[#0F172A]/60 group-hover:text-[#D4A84B]" />
                      <span className="text-xs font-medium text-[#0F172A]/70 text-center">Saved Searches</span>
                    </a>
                    <a href="/compare-markets" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0F172A]/5 hover:bg-[#D4A84B]/10 transition-colors group">
                      <BarChart3 className="w-5 h-5 text-[#0F172A]/60 group-hover:text-[#D4A84B]" />
                      <span className="text-xs font-medium text-[#0F172A]/70 text-center">Compare Markets</span>
                    </a>
                    <a href="/discover-markets" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0F172A]/5 hover:bg-[#D4A84B]/10 transition-colors group">
                      <Building className="w-5 h-5 text-[#0F172A]/60 group-hover:text-[#D4A84B]" />
                      <span className="text-xs font-medium text-[#0F172A]/70 text-center">Discover Markets</span>
                    </a>
                    <a href="/my-favorites" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0F172A]/5 hover:bg-[#D4A84B]/10 transition-colors group">
                      <Heart className="w-5 h-5 text-[#0F172A]/60 group-hover:text-[#D4A84B]" />
                      <span className="text-xs font-medium text-[#0F172A]/70 text-center">My Favorites</span>
                    </a>
                    <a href="/market-alerts" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#0F172A]/5 hover:bg-[#D4A84B]/10 transition-colors group">
                      <AlertCircle className="w-5 h-5 text-[#0F172A]/60 group-hover:text-[#D4A84B]" />
                      <span className="text-xs font-medium text-[#0F172A]/70 text-center">Market Alerts</span>
                    </a>
                  </div>
                </div>
              </div>
            </motion.form>
          </motion.div>
        </div>
      </div>
      </>
    );
  }

  // Lead Capture Form
  if (step === 'lead') {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/hero-property.jpg)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A1A]/90 via-[#1A1A1A]/80 to-[#2D2D2D]/70" />
        </div>
        
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-12">
          <motion.div 
            className="w-full max-w-lg"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <motion.div className="text-center mb-8" variants={itemVariants}>
              <div className="inline-flex items-center justify-center w-14 h-14 bg-[#D4A84B]/20 rounded-xl mb-5 backdrop-blur-sm border border-[#D4A84B]/30">
                <TrendingUp className="w-7 h-7 text-[#D4A84B]" />
              </div>
              <h2 className="text-3xl font-serif font-semibold text-white mb-3">
                Your Estimate is Ready
              </h2>
              <p className="text-white/70 font-sans">
                Enter your details to view your personalized rental analysis
              </p>
            </motion.div>
            
            {/* Property Summary */}
            <motion.div 
              className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-6 border border-white/20"
              variants={itemVariants}
            >
              <div className="flex items-center gap-3 text-white">
                <MapPin className="w-4 h-4 text-[#D4A84B]" />
                <span className="font-sans text-sm truncate">{formData.address}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-white/60 text-sm font-sans">
                <span>{formData.bedrooms} BR</span>
                <span>•</span>
                <span>{formData.bathrooms} BA</span>
                <span>•</span>
                <span>{formData.accommodates} Guests</span>
              </div>
            </motion.div>
            
            <motion.form 
              onSubmit={handleLeadSubmit}
              className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8"
              variants={itemVariants}
            >
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm font-sans">{error}</p>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={leadData.name}
                    onChange={(e) => setLeadData({ ...leadData, name: e.target.value })}
                    placeholder="John Smith"
                    required
                    className="w-full px-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#D4A84B]/50 focus:border-[#D4A84B] outline-none transition-all duration-300 font-sans placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={leadData.email}
                    onChange={(e) => setLeadData({ ...leadData, email: e.target.value })}
                    placeholder="john@example.com"
                    required
                    className="w-full px-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#D4A84B]/50 focus:border-[#D4A84B] outline-none transition-all duration-300 font-sans placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans">
                    Phone Number <span className="text-[#0F172A]/40">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={leadData.phone}
                    onChange={(e) => setLeadData({ ...leadData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#D4A84B]/50 focus:border-[#D4A84B] outline-none transition-all duration-300 font-sans placeholder:text-slate-500"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full mt-8 bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] text-white py-4 rounded-xl font-semibold hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2 font-sans shadow-lg"
              >
                View My Estimate
                <ChevronRight className="w-5 h-5" />
              </button>
              
              <button
                type="button"
                onClick={() => setStep('search')}
                className="w-full mt-4 text-[#0F172A]/50 hover:text-[#0F172A] font-sans text-sm transition-colors"
              >
                ← Back to search
              </button>
            </motion.form>
          </motion.div>
        </div>
      </div>
    );
  }

  // Loading State - Real-time progress tracking
  if (step === 'loading') {
    return (
      <AnalysisProgress
        progress={progress}
        address={formData.address}
        monthlyRent={formData.monthlyRent}
      />
    );
  }

  // Results View - Using Chapter-based Property Report
  if (step === 'results' && reportData) {
    const { property, market, bedroom_performance, same_bedroom_comps } = reportData;
    const { property: propertyInfo, estimates, monthly_forecast, comps } = property;

    // Transform data for ChapterPropertyReport component
    // Extract city from market name or address
    const extractCity = () => {
      if (market?.name && market.name !== 'Unknown') {
        return market.name.split(',')[0].trim();
      }
      // Fallback: extract from address (format: "123 Main St, City, ST 12345")
      const addressParts = propertyInfo.address.split(',');
      if (addressParts.length >= 2) {
        return addressParts[1].trim();
      }
      return 'Local Area';
    };
    
    const chapterReportData = {
      property: {
        address: propertyInfo.address,
        city: extractCity(),
        state: propertyInfo.address.split(',').slice(-1)[0]?.trim().split(' ')[0] || '',
        zipCode: propertyInfo.address.match(/\d{5}/)?.[0] || '',
        bedrooms: propertyInfo.bedrooms,
        bathrooms: propertyInfo.bathrooms,
        accommodates: propertyInfo.accommodates,
        propertyType: 'Residential',
        monthlyRent: formData.monthlyRent
      },
      revenue_estimate: {
        annual: estimates.annual_revenue,
        monthly: Math.round(estimates.annual_revenue / 12),
        nightly: estimates.average_daily_rate,
        occupancy: estimates.occupancy_rate,
        range: {
          low: estimates.annual_revenue_low,
          high: estimates.annual_revenue_high
        }
      },
      monthly_forecast: monthly_forecast,
      comps: comps as any,
      same_bedroom_comps: same_bedroom_comps as any,
      market_data: {
        name: market?.name || 'Your Market',
        metrics: market?.metrics || {
          occupancy: estimates.occupancy_rate,
          adr: estimates.average_daily_rate,
          revenue: estimates.annual_revenue,
          revpar: estimates.average_daily_rate * estimates.occupancy_rate,
          active_listings: market?.listing_count || 0
        },
        listing_count: market?.listing_count || 0
      },
      bedroom_performance: (bedroom_performance || []) as any,
      revenue_percentiles: (market as any)?.revenue_percentiles
    };

    return (
      <ChapterPropertyReport
        data={chapterReportData}
        onBack={() => {
          setStep('search');
          setReportData(null);
          setFormData({ ...formData, address: '' });
          setZillowUrl('');
        }}
        clientName={leadData?.name}
        marketId={market?.id ? parseInt(market.id) : undefined}
      />
    );
  }

  return null;
}
