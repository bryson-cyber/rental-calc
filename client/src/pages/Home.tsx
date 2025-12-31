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
    accommodates: 4
  });
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
        setReportData(result.data);
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
                      onChange={(e) => setFormData({ ...formData, bedrooms: parseInt(e.target.value) })}
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
                  Powered by AirDNA market data
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#C9A962] rounded-full" />
                  Trusted by 100,000+ hosts
                </span>
              </div>
              
              {/* Market Research Link */}
              <div className="mt-6 pt-6 border-t border-[#0F172A]/10 text-center">
                <p className="text-sm text-[#0F172A]/60 font-sans mb-2">
                  Don't have a specific property yet?
                </p>
                <a 
                  href="/market"
                  className="inline-flex items-center gap-2 text-[#C9A962] hover:text-[#b89a52] font-medium text-sm transition-colors"
                >
                  <Building className="w-4 h-4" />
                  Explore Markets by City or Zip Code
                  <ChevronRight className="w-4 h-4" />
                </a>
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

  // Loading State
  if (step === 'loading') {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/hero-property.jpg)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A]/90 via-[#0F172A]/80 to-[#1e293b]/70" />
        </div>
        
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#C9A962]/20 rounded-2xl mb-8 backdrop-blur-sm border border-[#C9A962]/30">
              <Loader2 className="w-10 h-10 text-[#C9A962] animate-spin" />
            </div>
            <h2 className="text-2xl font-serif font-semibold text-white mb-3">
              Analyzing Your Property
            </h2>
            <p className="text-white/60 font-sans max-w-md">
              We're pulling real market data and comparable properties to build your personalized report...
            </p>
            
            <div className="mt-8 space-y-3 max-w-xs mx-auto">
              {['Fetching property data', 'Analyzing market trends', 'Finding comparable properties'].map((text, idx) => (
                <motion.div
                  key={idx}
                  className="flex items-center gap-3 text-white/70 text-sm font-sans"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.5 }}
                >
                  <CheckCircle2 className="w-4 h-4 text-[#C9A962]" />
                  {text}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Results View
  if (step === 'results' && reportData) {
    const { property, market, bedroom_performance, submarkets, same_bedroom_comps } = reportData;
    const { property: propertyInfo, estimates, monthly_forecast, comps } = property;
    
    // Use same_bedroom_comps for apples-to-apples comparisons, fall back to general comps
    const displayComps = same_bedroom_comps && same_bedroom_comps.length > 0 ? same_bedroom_comps : comps;
    
    const maxRevenue = Math.max(...monthly_forecast.map(m => m.revenue));
    
    // Calculate monthly income potential
    const monthlyRevenue = Math.round(estimates.annual_revenue / 12);
    
    // Find best and worst months
    const sortedMonths = [...monthly_forecast].sort((a, b) => b.revenue - a.revenue);
    const bestMonth = sortedMonths[0];
    const worstMonth = sortedMonths[sortedMonths.length - 1];

    return (
      <div className="min-h-screen bg-[#f8f7f4]">
        {/* Header */}
        <div className="bg-[#0F172A] text-white">
          <div className="max-w-5xl mx-auto px-4 py-8">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2 text-[#C9A962] text-sm mb-2 font-sans">
                <MapPin className="w-4 h-4" />
                {propertyInfo.address}
              </div>
              <h1 className="text-3xl md:text-4xl font-serif font-semibold mb-2">
                Your Rental Analysis Report
              </h1>
              <p className="text-white/60 font-sans">
                {propertyInfo.bedrooms} Bedrooms • {propertyInfo.bathrooms} Bathrooms • Sleeps {propertyInfo.accommodates}
                {market && ` • ${market.name} Market`}
              </p>
            </motion.div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-5xl mx-auto px-4 py-8">
          
          {/* Section 1: The Big Picture */}
          <motion.section
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-[#166534] to-[#15803d] p-6 text-white">
                <h2 className="text-xl font-serif font-semibold flex items-center gap-3">
                  <DollarSign className="w-6 h-6" />
                  What This Property Could Earn
                </h2>
              </div>
              <div className="p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Annual Revenue */}
                  <div className="text-center p-6 bg-gradient-to-br from-[#166534]/5 to-[#166534]/10 rounded-xl">
                    <div className="text-sm text-[#0F172A]/60 mb-2 font-sans uppercase tracking-wider">Annual Revenue</div>
                    <div className="text-4xl md:text-5xl font-serif font-bold text-[#166534]">
                      <AnimatedNumber value={estimates.annual_revenue} prefix="$" />
                    </div>
                    <div className="text-sm text-[#0F172A]/50 mt-2 font-sans">
                      Range: {formatCurrency(estimates.annual_revenue_low)} - {formatCurrency(estimates.annual_revenue_high)}
                    </div>
                  </div>
                  
                  {/* Monthly Average */}
                  <div className="text-center p-6 bg-gradient-to-br from-[#0F172A]/5 to-[#0F172A]/10 rounded-xl">
                    <div className="text-sm text-[#0F172A]/60 mb-2 font-sans uppercase tracking-wider">Monthly Average</div>
                    <div className="text-4xl md:text-5xl font-serif font-bold text-[#0F172A]">
                      <AnimatedNumber value={monthlyRevenue} prefix="$" />
                    </div>
                    <div className="text-sm text-[#0F172A]/50 mt-2 font-sans">Per month</div>
                  </div>
                  
                  {/* Nightly Rate */}
                  <div className="text-center p-6 bg-gradient-to-br from-[#C9A962]/10 to-[#C9A962]/20 rounded-xl">
                    <div className="text-sm text-[#0F172A]/60 mb-2 font-sans uppercase tracking-wider">Avg. Nightly Rate</div>
                    <div className="text-4xl md:text-5xl font-serif font-bold text-[#C9A962]">
                      <AnimatedNumber value={estimates.average_daily_rate} prefix="$" />
                    </div>
                    <div className="text-sm text-[#0F172A]/50 mt-2 font-sans">
                      {formatPercent(estimates.occupancy_rate)} occupancy
                    </div>
                  </div>
                </div>
                
                {/* Simple Explanation */}
                <div className="mt-8 p-6 bg-[#f8f7f4] rounded-xl">
                  <h3 className="font-semibold text-[#0F172A] mb-3 font-sans">What This Means For You</h3>
                  <p className="text-[#0F172A]/70 font-sans leading-relaxed">
                    Based on real market data, this property could generate approximately <strong className="text-[#166534]">{formatCurrency(monthlyRevenue)}/month</strong> in rental income. 
                    At an average nightly rate of <strong>{formatCurrency(estimates.average_daily_rate)}</strong> and <strong>{formatPercent(estimates.occupancy_rate)}</strong> occupancy, 
                    you're looking at a solid income opportunity in this market.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Section 2: Monthly Breakdown */}
          {monthly_forecast.length > 0 && (
            <motion.section
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] p-6 text-white">
                  <h2 className="text-xl font-serif font-semibold flex items-center gap-3">
                    <Calendar className="w-6 h-6" />
                    Month-by-Month Forecast
                  </h2>
                </div>
                <div className="p-6 md:p-8">
                  {/* Peak/Low Season Highlight */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-[#166534]/10 rounded-xl border border-[#166534]/20">
                      <div className="flex items-center gap-2 text-[#166534] mb-2">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm font-medium font-sans">Best Month</span>
                      </div>
                      <div className="text-2xl font-serif font-bold text-[#166534]">
                        {formatCurrency(bestMonth.revenue)}
                      </div>
                      <div className="text-sm text-[#0F172A]/50 font-sans">
                        {formatFullMonth(bestMonth.month)}
                      </div>
                    </div>
                    <div className="p-4 bg-[#0F172A]/5 rounded-xl border border-[#0F172A]/10">
                      <div className="flex items-center gap-2 text-[#0F172A]/60 mb-2">
                        <TrendingDown className="w-4 h-4" />
                        <span className="text-sm font-medium font-sans">Slowest Month</span>
                      </div>
                      <div className="text-2xl font-serif font-bold text-[#0F172A]">
                        {formatCurrency(worstMonth.revenue)}
                      </div>
                      <div className="text-sm text-[#0F172A]/50 font-sans">
                        {formatFullMonth(worstMonth.month)}
                      </div>
                    </div>
                  </div>

                  {/* Monthly Chart */}
                  <div className="space-y-3">
                    {monthly_forecast.map((month, idx) => (
                      <motion.div 
                        key={idx} 
                        className="flex items-center gap-4"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 + idx * 0.03 }}
                      >
                        <div className="w-12 text-sm font-medium text-[#0F172A]/60 font-sans">{formatMonth(month.month)}</div>
                        <div className="flex-1">
                          <div className="h-8 bg-[#0F172A]/5 rounded-lg overflow-hidden">
                            <motion.div
                              className={`h-full rounded-lg flex items-center justify-end pr-3 ${
                                month === bestMonth 
                                  ? 'bg-gradient-to-r from-[#166534] to-[#15803d]' 
                                  : 'bg-gradient-to-r from-[#0F172A] to-[#1e293b]'
                              }`}
                              initial={{ width: 0 }}
                              animate={{ width: `${(month.revenue / maxRevenue) * 100}%` }}
                              transition={{ duration: 0.8, delay: 0.4 + idx * 0.03, ease: "easeOut" }}
                            >
                              <span className="text-white text-sm font-medium font-sans">{formatCurrency(month.revenue)}</span>
                            </motion.div>
                          </div>
                        </div>
                        <div className="w-14 text-right text-sm text-[#0F172A]/50 font-sans">{formatPercent(month.occupancy)}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* Section 3: Market Overview */}
          {market && market.metrics && (
            <motion.section
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-[#C9A962] to-[#d4b876] p-6 text-[#0F172A]">
                  <h2 className="text-xl font-serif font-semibold flex items-center gap-3">
                    <BarChart3 className="w-6 h-6" />
                    {market.name} Market Overview
                  </h2>
                </div>
                <div className="p-6 md:p-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-[#f8f7f4] rounded-xl text-center">
                      <div className="text-xs text-[#0F172A]/50 mb-1 font-sans uppercase tracking-wider">Avg. Occupancy</div>
                      <div className="text-2xl font-serif font-bold text-[#0F172A]">{formatPercent(market.metrics.occupancy)}</div>
                    </div>
                    <div className="p-4 bg-[#f8f7f4] rounded-xl text-center">
                      <div className="text-xs text-[#0F172A]/50 mb-1 font-sans uppercase tracking-wider">Avg. Daily Rate</div>
                      <div className="text-2xl font-serif font-bold text-[#0F172A]">{formatCurrency(market.metrics.adr)}</div>
                    </div>
                    <div className="p-4 bg-[#f8f7f4] rounded-xl text-center">
                      <div className="text-xs text-[#0F172A]/50 mb-1 font-sans uppercase tracking-wider">Avg. Revenue</div>
                      <div className="text-2xl font-serif font-bold text-[#0F172A]">{formatCurrency(market.metrics.revenue)}</div>
                    </div>
                    <div className="p-4 bg-[#f8f7f4] rounded-xl text-center">
                      <div className="text-xs text-[#0F172A]/50 mb-1 font-sans uppercase tracking-wider">Active Listings</div>
                      <div className="text-2xl font-serif font-bold text-[#0F172A]">{(market.metrics.active_listings || 0).toLocaleString()}</div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-[#0F172A]/5 rounded-xl mb-6">
                    <p className="text-[#0F172A]/70 font-sans text-sm leading-relaxed">
                      The {market.name} market has <strong>{(market.metrics.active_listings || 0).toLocaleString()}</strong> active short-term rentals 
                      with an average occupancy of <strong>{formatPercent(market.metrics.occupancy)}</strong>. 
                      Properties in this market earn an average of <strong>{formatCurrency(market.metrics.revenue)}</strong> annually.
                    </p>
                  </div>

                  {/* Historical Trends */}
                  {market.historical && market.historical.adr.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-serif font-semibold text-[#0F172A] mb-4">12-Month Market Trends</h3>
                      
                      {/* ADR Trend */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-[#0F172A]/60 font-sans">Average Daily Rate (ADR)</span>
                          <span className="text-sm font-medium text-[#C9A962] font-sans">
                            {(() => {
                              const data = market.historical.adr;
                              if (data.length < 2) return 'N/A';
                              const first = data[0]?.value || 0;
                              const last = data[data.length - 1]?.value || 0;
                              const change = first > 0 ? ((last - first) / first * 100) : 0;
                              return `${change >= 0 ? '+' : ''}${change.toFixed(1)}% YoY`;
                            })()}
                          </span>
                        </div>
                        <div className="flex items-end gap-1 h-16">
                          {market.historical.adr.map((point, idx) => {
                            const maxVal = Math.max(...(market.historical?.adr || []).map(p => p.value));
                            const height = maxVal > 0 ? (point.value / maxVal * 100) : 0;
                            return (
                              <div key={idx} className="flex-1 group relative">
                                <div 
                                  className="bg-gradient-to-t from-[#C9A962] to-[#d4b876] rounded-t transition-all hover:opacity-80"
                                  style={{ height: `${height}%`, minHeight: '4px' }}
                                />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0F172A] text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                  {formatCurrency(point.value)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-[#0F172A]/40 font-sans">{market.historical.adr[0]?.date?.substring(0, 7) || ''}</span>
                          <span className="text-xs text-[#0F172A]/40 font-sans">{market.historical.adr[market.historical.adr.length - 1]?.date?.substring(0, 7) || ''}</span>
                        </div>
                      </div>

                      {/* Occupancy Trend */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-[#0F172A]/60 font-sans">Occupancy Rate</span>
                          <span className="text-sm font-medium text-[#166534] font-sans">
                            {(() => {
                              const data = market.historical.occupancy;
                              if (data.length < 2) return 'N/A';
                              const first = data[0]?.value || 0;
                              const last = data[data.length - 1]?.value || 0;
                              const change = last - first;
                              return `${change >= 0 ? '+' : ''}${change.toFixed(1)}% pts YoY`;
                            })()}
                          </span>
                        </div>
                        <div className="flex items-end gap-1 h-16">
                          {market.historical.occupancy.map((point, idx) => {
                            const height = point.value; // Occupancy is already a percentage
                            return (
                              <div key={idx} className="flex-1 group relative">
                                <div 
                                  className="bg-gradient-to-t from-[#166534] to-[#15803d] rounded-t transition-all hover:opacity-80"
                                  style={{ height: `${height}%`, minHeight: '4px' }}
                                />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0F172A] text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                  {formatPercent(point.value)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-[#0F172A]/40 font-sans">{market.historical.occupancy[0]?.date?.substring(0, 7) || ''}</span>
                          <span className="text-xs text-[#0F172A]/40 font-sans">{market.historical.occupancy[market.historical.occupancy.length - 1]?.date?.substring(0, 7) || ''}</span>
                        </div>
                      </div>

                      {/* Supply Trend (Active Listings) */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-[#0F172A]/60 font-sans">Active Listings (Supply)</span>
                          <span className="text-sm font-medium text-[#0F172A] font-sans">
                            {(() => {
                              const data = market.historical.active_listings;
                              if (data.length < 2) return 'N/A';
                              const first = data[0]?.value || 0;
                              const last = data[data.length - 1]?.value || 0;
                              const change = first > 0 ? ((last - first) / first * 100) : 0;
                              return `${change >= 0 ? '+' : ''}${change.toFixed(1)}% YoY`;
                            })()}
                          </span>
                        </div>
                        <div className="flex items-end gap-1 h-16">
                          {market.historical.active_listings.map((point, idx) => {
                            const maxVal = Math.max(...(market.historical?.active_listings || []).map(p => p.value));
                            const height = maxVal > 0 ? (point.value / maxVal * 100) : 0;
                            return (
                              <div key={idx} className="flex-1 group relative">
                                <div 
                                  className="bg-gradient-to-t from-[#0F172A] to-[#334155] rounded-t transition-all hover:opacity-80"
                                  style={{ height: `${height}%`, minHeight: '4px' }}
                                />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0F172A] text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                  {(point.value || 0).toLocaleString()} listings
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-[#0F172A]/40 font-sans">{market.historical.active_listings[0]?.date?.substring(0, 7) || ''}</span>
                          <span className="text-xs text-[#0F172A]/40 font-sans">{market.historical.active_listings[market.historical.active_listings.length - 1]?.date?.substring(0, 7) || ''}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          )}

          {/* Section 4: Bedroom Performance */}
          {bedroom_performance && bedroom_performance.length > 0 && (
            <motion.section
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
            >
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] p-6 text-white">
                  <h2 className="text-xl font-serif font-semibold flex items-center gap-3">
                    <BedDouble className="w-6 h-6" />
                    Performance by Bedroom Count
                  </h2>
                </div>
                <div className="p-6 md:p-8">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#0F172A]/10">
                          <th className="text-left py-3 px-4 text-sm font-medium text-[#0F172A]/60 font-sans">Bedrooms</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-[#0F172A]/60 font-sans">Avg. Revenue</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-[#0F172A]/60 font-sans">Avg. ADR</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-[#0F172A]/60 font-sans">Occupancy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bedroom_performance.map((perf, idx) => (
                          <tr 
                            key={idx} 
                            className={`border-b border-[#0F172A]/5 ${perf.bedrooms === propertyInfo.bedrooms ? 'bg-[#C9A962]/10' : ''}`}
                          >
                            <td className="py-3 px-4 font-sans">
                              <span className={`font-medium ${perf.bedrooms === propertyInfo.bedrooms ? 'text-[#C9A962]' : 'text-[#0F172A]'}`}>
                                {perf.bedrooms} BR
                              </span>
                              {perf.bedrooms === propertyInfo.bedrooms && (
                                <span className="ml-2 text-xs bg-[#C9A962] text-white px-2 py-0.5 rounded-full">Your Property</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-sans font-medium text-[#166534]">{formatCurrency(perf.revenue)}</td>
                            <td className="py-3 px-4 text-right font-sans text-[#0F172A]">{formatCurrency(perf.adr)}</td>
                            <td className="py-3 px-4 text-right font-sans text-[#0F172A]">{formatPercent(perf.occupancy)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* Section 5: Best Neighborhoods */}
          {submarkets && submarkets.length > 0 && (
            <motion.section
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.38 }}
            >
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-[#166534] to-[#15803d] p-6 text-white">
                  <h2 className="text-xl font-serif font-semibold flex items-center gap-3">
                    <MapPin className="w-6 h-6" />
                    Neighborhoods in This Market
                  </h2>
                  <p className="text-white/70 text-sm mt-1 font-sans">
                    {submarkets.length} submarkets available for analysis
                  </p>
                </div>
                <div className="p-6 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {submarkets.slice(0, 12).map((submarket, idx) => (
                      <div 
                        key={idx}
                        className="p-4 border border-[#0F172A]/10 rounded-xl hover:border-[#166534]/30 hover:shadow-md transition-all duration-300"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-[#0F172A] font-sans text-sm line-clamp-1">{submarket.name}</h3>
                          <span className="text-xs text-[#0F172A]/50 font-sans bg-[#0F172A]/5 px-2 py-1 rounded-full">
                            {(submarket.listing_count || 0).toLocaleString()} listings
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {submarkets.length > 12 && (
                    <p className="text-sm text-[#0F172A]/50 mt-4 text-center font-sans">
                      + {submarkets.length - 12} more neighborhoods
                    </p>
                  )}
                </div>
              </div>
            </motion.section>
          )}

          {/* Section 6: Comparable Properties - Apples to Apples */}
          {displayComps.length > 0 && (
            <motion.section
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] p-6 text-white">
                  <h2 className="text-xl font-serif font-semibold flex items-center gap-3">
                    <Building className="w-6 h-6" />
                    {same_bedroom_comps && same_bedroom_comps.length > 0 
                      ? `Top ${propertyInfo.bedrooms}-Bedroom Properties Nearby`
                      : 'Top Performing Properties Nearby'
                    }
                  </h2>
                  <p className="text-white/60 text-sm mt-1 font-sans">
                    {same_bedroom_comps && same_bedroom_comps.length > 0 
                      ? `Apples-to-apples comparison: Only ${propertyInfo.bedrooms}-bedroom properties like yours`
                      : 'These are real listings in your area, sorted by revenue'
                    }
                  </p>
                </div>
                <div className="p-6 md:p-8">
                  <div className="space-y-4">
                    {displayComps.slice(0, 8).map((comp, idx) => (
                      <motion.div 
                        key={idx}
                        className="flex items-start gap-4 p-4 border border-[#0F172A]/10 rounded-xl hover:border-[#C9A962]/30 hover:shadow-md transition-all duration-300"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.5 + idx * 0.05 }}
                      >
                        <div className="w-8 h-8 rounded-full bg-[#0F172A]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-[#0F172A] font-sans">#{idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-semibold text-[#0F172A] font-sans line-clamp-1">{comp.title}</h3>
                              <div className="flex items-center gap-3 mt-1 text-sm text-[#0F172A]/50 font-sans">
                                <span>{comp.bedrooms} BR • {comp.bathrooms} BA</span>
                                {comp.rating && (
                                  <span className="flex items-center gap-1">
                                    <Star className="w-3.5 h-3.5 text-[#C9A962] fill-[#C9A962]" />
                                    {comp.rating} ({comp.reviews} reviews)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-lg font-bold text-[#166534] font-sans">{formatCurrency(comp.annual_revenue)}</div>
                              <div className="text-xs text-[#0F172A]/50 font-sans">annual revenue</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-3">
                            <div className="text-sm font-sans">
                              <span className="text-[#0F172A]/50">ADR:</span>{' '}
                              <span className="font-medium text-[#0F172A]">{formatCurrency(comp.adr)}</span>
                            </div>
                            <div className="text-sm font-sans">
                              <span className="text-[#0F172A]/50">Occupancy:</span>{' '}
                              <span className="font-medium text-[#0F172A]">{formatPercent(comp.occupancy)}</span>
                            </div>
                            {comp.airbnb_url && (
                              <a 
                                href={comp.airbnb_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-[#C9A962] hover:text-[#b8944f] font-sans flex items-center gap-1"
                              >
                                View Listing <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* Educational Section - What This Data Means */}
          <motion.section
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] p-6 text-white">
                <h2 className="text-xl font-serif font-semibold flex items-center gap-3">
                  <Lightbulb className="w-6 h-6" />
                  What This Data Means For You
                </h2>
                <p className="text-white/60 text-sm mt-1 font-sans">
                  Understanding the numbers behind successful short-term rentals
                </p>
              </div>
              <div className="p-6 md:p-8">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Revenue Insight */}
                  <div className="p-4 bg-[#166534]/5 rounded-xl border border-[#166534]/10">
                    <h3 className="font-semibold text-[#0F172A] mb-2 font-sans flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#166534]" />
                      Revenue Potential
                    </h3>
                    <p className="text-sm text-[#0F172A]/70 font-sans leading-relaxed">
                      Your estimated <strong>{formatCurrency(estimates.annual_revenue)}/year</strong> puts you 
                      {estimates.annual_revenue > (market?.metrics.revenue || 0) 
                        ? <span className="text-[#166534]"> above the market average</span>
                        : <span className="text-[#C9A962]"> near the market average</span>
                      }. Top performers in this area earn 2-3x the average through professional management, 
                      optimized pricing, and exceptional guest experiences.
                    </p>
                  </div>
                  
                  {/* Occupancy Insight */}
                  <div className="p-4 bg-[#C9A962]/5 rounded-xl border border-[#C9A962]/10">
                    <h3 className="font-semibold text-[#0F172A] mb-2 font-sans flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#C9A962]" />
                      Occupancy Rate
                    </h3>
                    <p className="text-sm text-[#0F172A]/70 font-sans leading-relaxed">
                      At <strong>{formatPercent(estimates.occupancy_rate)}</strong> projected occupancy, 
                      your property would be booked approximately <strong>{Math.round(estimates.occupancy_rate * 3.65)} nights/year</strong>. 
                      Professional hosts typically achieve 10-15% higher occupancy through dynamic pricing and marketing.
                    </p>
                  </div>
                  
                  {/* Competition Insight */}
                  <div className="p-4 bg-[#0F172A]/5 rounded-xl border border-[#0F172A]/10">
                    <h3 className="font-semibold text-[#0F172A] mb-2 font-sans flex items-center gap-2">
                      <Building className="w-4 h-4 text-[#0F172A]" />
                      Competition Level
                    </h3>
                    <p className="text-sm text-[#0F172A]/70 font-sans leading-relaxed">
                      With <strong>{(market?.metrics.active_listings || 0).toLocaleString()}</strong> active listings in {market?.name || 'this market'}, 
                      standing out requires professional photos, compelling descriptions, and 5-star service. 
                      {displayComps.length > 0 && ` The top ${propertyInfo.bedrooms}-bedroom properties nearby earn ${formatCurrency(displayComps[0]?.annual_revenue || 0)}/year.`}
                    </p>
                  </div>
                  
                  {/* Success Factor */}
                  <div className="p-4 bg-[#166534]/5 rounded-xl border border-[#166534]/10">
                    <h3 className="font-semibold text-[#0F172A] mb-2 font-sans flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#166534]" />
                      Success Factors
                    </h3>
                    <p className="text-sm text-[#0F172A]/70 font-sans leading-relaxed">
                      Top earners share common traits: <strong>professional photography</strong>, 
                      <strong>dynamic pricing</strong>, <strong>instant booking</strong>, and 
                      <strong>5-star reviews</strong>. Most successful hosts either dedicate 15+ hours/week 
                      or partner with professional management.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* CTA Section */}
          <motion.section
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="relative rounded-2xl shadow-xl overflow-hidden">
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: 'url(/images/success-property.jpg)' }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0F172A]/95 to-[#0F172A]/80" />
              <div className="relative z-10 p-8 md:p-12">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 bg-[#C9A962]/20 text-[#C9A962] px-4 py-2 rounded-full text-sm font-medium mb-4">
                    <Award className="w-4 h-4" />
                    Done-For-You Solution
                  </div>
                  <h2 className="text-2xl md:text-3xl font-serif font-semibold text-white mb-4">
                    Skip the Learning Curve. Start Earning.
                  </h2>
                  <p className="text-white/70 mb-6 font-sans leading-relaxed">
                    Most new hosts spend 6-12 months figuring out pricing, photography, guest communication, and operations. 
                    Our turnkey program handles everything — so you can start earning from day one while we manage the details.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4 mb-8">
                    <div className="flex items-center gap-3 text-white/80">
                      <CheckCircle2 className="w-5 h-5 text-[#C9A962]" />
                      <span className="text-sm font-sans">Professional setup</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/80">
                      <CheckCircle2 className="w-5 h-5 text-[#C9A962]" />
                      <span className="text-sm font-sans">Dynamic pricing</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/80">
                      <CheckCircle2 className="w-5 h-5 text-[#C9A962]" />
                      <span className="text-sm font-sans">24/7 guest support</span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button className="bg-[#C9A962] text-[#0F172A] px-8 py-4 rounded-xl font-semibold hover:bg-[#d4b876] transition-all duration-300 font-sans shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
                      Schedule a Free Consultation
                      <ArrowRight className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => reportData && generateRentalReportPdf(reportData)}
                      className="bg-white/10 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/20 transition-all duration-300 font-sans border border-white/20 flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      Download Report
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* New Search */}
          <div className="text-center pb-8">
            <button
              onClick={() => {
                setStep('search');
                setReportData(null);
                setError(null);
                setFormData({ address: '', bedrooms: 2, bathrooms: 1, accommodates: 4 });
                setLeadData({ name: '', email: '', phone: '' });
                setZillowUrl('');
              }}
              className="text-[#0F172A]/60 hover:text-[#C9A962] font-medium font-sans transition-colors inline-flex items-center gap-2"
            >
              ← Analyze Another Property
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
