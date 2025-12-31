/*
 * DESIGN: Luxe Real Estate - Premium Property Investment Aesthetic
 * - Deep navy (#0F172A) + warm gold (#C9A962) palette
 * - Playfair Display serif headlines + DM Sans body
 * - Warm off-white backgrounds with subtle texture
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
  Award
} from 'lucide-react';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { motion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { generateRentalReportPdf } from '@/lib/generatePdf';
import ChapterPropertyReport from '@/components/ChapterPropertyReport';

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
  const [step, setStep] = useState<'search' | 'lead' | 'loading' | 'results'>('search');
  const [error, setError] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'address' | 'zillow'>('address');
  const [zillowUrl, setZillowUrl] = useState('');
  const [formData, setFormData] = useState({
    address: '',
    bedrooms: 2,
    bathrooms: 1,
    accommodates: 4, // Auto-calculated as 2 per bedroom
    monthlyRent: 0,
    propertyType: 'House'
  });

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

  // tRPC mutations
  const getReportMutation = trpc.rental.getPropertyReport.useMutation();
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

      // Then get the comprehensive report
      const result = await getReportMutation.mutateAsync({
        address: formData.address,
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
        accommodates: formData.accommodates,

      });

      if (result.success && result.data) {
        // The API returns { success, data: { property, market, ... } }
        setReportData(result.data as ComprehensiveReportData);
        setStep('results');
      } else {
        setError(result.error || 'Failed to generate report. Please try again.');
        setStep('lead');
      }
    } catch (err) {
      console.error('Error getting report:', err);
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
      <div className="min-h-screen relative overflow-hidden">
        {/* Background Image with Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/hero-property.jpg)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A]/90 via-[#0F172A]/80 to-[#1e293b]/70" />
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
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#C9A962]/20 rounded-xl mb-6 backdrop-blur-sm border border-[#C9A962]/30">
                <Home className="w-8 h-8 text-[#C9A962]" />
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-semibold text-white mb-4 tracking-tight">
                Rental Revenue Calculator
              </h1>
              <p className="text-lg text-white/70 font-sans max-w-lg mx-auto">
                See what your property could earn as a short-term rental
              </p>
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
                      ? 'bg-[#0F172A] text-white'
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
                      ? 'bg-[#0F172A] text-white'
                      : 'bg-[#0F172A]/5 text-[#0F172A]/60 hover:bg-[#0F172A]/10'
                  }`}
                >
                  Paste Zillow Link
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm font-sans">{error}</p>
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
                      className="flex-1 px-4 py-3 border-2 border-[#0F172A]/10 rounded-xl text-base focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans bg-white"
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

              {/* Address Input with Autocomplete */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans uppercase tracking-wider">
                  Property Address
                </label>
                <AddressAutocomplete
                  value={formData.address}
                  onChange={(value) => setFormData({ ...formData, address: value })}
                  onSelect={(address) => setFormData({ ...formData, address })}
                  placeholder="Enter your property address..."
                  inputClassName="border-2 border-[#0F172A]/10 rounded-xl text-lg focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans bg-white"
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
                    value={formData.monthlyRent || ''}
                    onChange={(e) => setFormData({ ...formData, monthlyRent: parseInt(e.target.value) || 0 })}
                    placeholder="e.g., 2500"
                    className="w-full pl-10 pr-4 py-3 border-2 border-[#0F172A]/10 rounded-xl text-lg focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans bg-white"
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
                      className="w-full pl-10 pr-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans bg-white appearance-none cursor-pointer"
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
                      className="w-full pl-10 pr-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans bg-white appearance-none cursor-pointer"
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
                      className="w-full pl-10 pr-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans bg-white appearance-none cursor-pointer"
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
                className="w-full bg-[#0F172A] text-white py-4 rounded-xl font-semibold hover:bg-[#1e293b] transition-all duration-300 flex items-center justify-center gap-2 font-sans shadow-lg hover:shadow-xl"
              >
                <Search className="w-5 h-5" />
                Get Free Estimate
              </button>
              
              {/* Trust Indicators */}
              <div className="mt-6 flex items-center justify-center gap-4 text-sm text-[#0F172A]/50 font-sans">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#C9A962] rounded-full" />
                  Powered by Coach Inayah market data
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#C9A962] rounded-full" />
                  Trusted by 100,000+ hosts
                </span>
              </div>
              
              {/* Market Research Link */}
              <div className="mt-6 pt-6 border-t border-[#0F172A]/10 text-center space-y-3">
                <p className="text-sm text-[#0F172A]/60 font-sans mb-2">
                  Don't have a specific property yet?
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a 
                    href="/market"
                    className="inline-flex items-center gap-2 text-[#C9A962] hover:text-[#b89a52] font-medium text-sm transition-colors"
                  >
                    <Building className="w-4 h-4" />
                    Explore Markets
                    <ChevronRight className="w-4 h-4" />
                  </a>
                  <span className="hidden sm:inline text-[#0F172A]/30">|</span>
                  <a 
                    href="/compare-properties"
                    className="inline-flex items-center gap-2 text-[#C9A962] hover:text-[#b89a52] font-medium text-sm transition-colors"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Compare Properties
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </motion.form>
          </motion.div>
        </div>
      </div>
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
          <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A]/90 via-[#0F172A]/80 to-[#1e293b]/70" />
        </div>
        
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-12">
          <motion.div 
            className="w-full max-w-lg"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <motion.div className="text-center mb-8" variants={itemVariants}>
              <div className="inline-flex items-center justify-center w-14 h-14 bg-[#C9A962]/20 rounded-xl mb-5 backdrop-blur-sm border border-[#C9A962]/30">
                <TrendingUp className="w-7 h-7 text-[#C9A962]" />
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
                <MapPin className="w-4 h-4 text-[#C9A962]" />
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
                    className="w-full px-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans"
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
                    className="w-full px-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans"
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
                    className="w-full px-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full mt-8 bg-[#C9A962] text-[#0F172A] py-4 rounded-xl font-semibold hover:bg-[#d4b876] transition-all duration-300 flex items-center justify-center gap-2 font-sans shadow-lg"
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

  // Loading State - Polished step-by-step animation
  if (step === 'loading') {
    const loadingSteps = [
      { text: 'Analyzing property details', delay: 0 },
      { text: 'Pulling proprietary market data', delay: 1.5 },
      { text: 'Finding same-bedroom comparables', delay: 3 },
      { text: 'Calculating revenue projections', delay: 4.5 },
      { text: 'Running AI profitability analysis', delay: 6 },
      { text: 'Generating your personalized report', delay: 7.5 },
    ];

    return (
      <div className="min-h-screen relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/hero-property.jpg)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A]/95 via-[#0F172A]/90 to-[#1e293b]/85" />
        </div>
        
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <motion.div 
            className="text-center max-w-lg"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Animated Icon */}
            <div className="relative inline-flex items-center justify-center w-24 h-24 mb-8">
              <motion.div
                className="absolute inset-0 bg-[#C9A962]/20 rounded-2xl backdrop-blur-sm border border-[#C9A962]/30"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <Loader2 className="w-12 h-12 text-[#C9A962] animate-spin" />
            </div>

            {/* Title */}
            <h2 className="text-3xl font-serif font-semibold text-white mb-3">
              Building Your Analysis
            </h2>
            <p className="text-white/60 font-sans mb-2">
              {formData.address}
            </p>
            <p className="text-[#C9A962] font-sans text-sm mb-8">
              Monthly Rent: ${formData.monthlyRent.toLocaleString()}
            </p>
            
            {/* Progress Steps */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="space-y-4">
                {loadingSteps.map((step, idx) => (
                  <motion.div
                    key={idx}
                    className="flex items-center gap-3"
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: step.delay, duration: 0.5 }}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: step.delay + 0.2, type: 'spring' }}
                    >
                      <CheckCircle2 className="w-5 h-5 text-[#C9A962]" />
                    </motion.div>
                    <span className="text-white/80 text-sm font-sans text-left">{step.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Reassurance */}
            <p className="mt-6 text-white/40 text-xs font-sans">
              This usually takes 15-30 seconds. Please don't refresh the page.
            </p>
          </motion.div>
        </div>
      </div>
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
        name: market?.name || 'Local Market',
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
      />
    );
  }

  return null;
}
