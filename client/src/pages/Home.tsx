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
  DollarSign,
  Users,
  BedDouble,
  Bath
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock data for demo (in production, this comes from your API)
const mockEstimate = {
  property: {
    address: "1321 15th St, Denver, CO 80202",
    bedrooms: 3,
    bathrooms: 2,
    accommodates: 6
  },
  estimates: {
    annual_revenue: 128139,
    annual_revenue_low: 122655,
    annual_revenue_high: 133622,
    average_daily_rate: 480,
    occupancy_rate: 0.73,
    currency_symbol: "$"
  },
  monthly_forecast: [
    { month: "2024-05", revenue: 12330, adr: 439, occupancy: 0.91 },
    { month: "2024-06", revenue: 13549, adr: 512, occupancy: 0.88 },
    { month: "2024-07", revenue: 13266, adr: 555, occupancy: 0.77 },
    { month: "2024-08", revenue: 11519, adr: 491, occupancy: 0.76 },
    { month: "2024-09", revenue: 11185, adr: 422, occupancy: 0.88 },
    { month: "2024-10", revenue: 10213, adr: 475, occupancy: 0.69 },
    { month: "2024-11", revenue: 8044, adr: 406, occupancy: 0.66 },
    { month: "2024-12", revenue: 6826, adr: 439, occupancy: 0.50 },
  ],
  comps: [
    { title: "Downtown Luxury Loft", bedrooms: 3, bathrooms: 2.5, rating: 4.9, reviews: 148, annual_revenue: 116954, adr: 491, occupancy: 0.66, distance_meters: 885 },
    { title: "Modern City Townhome", bedrooms: 3, bathrooms: 3, rating: 5.0, reviews: 109, annual_revenue: 71676, adr: 278, occupancy: 0.71, distance_meters: 1140 },
    { title: "Spacious Urban Retreat", bedrooms: 3, bathrooms: 2.5, rating: 4.8, reviews: 60, annual_revenue: 61115, adr: 347, occupancy: 0.88, distance_meters: 930 },
  ]
};

// Animated counter component
function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef<number | null>(null);
  
  useEffect(() => {
    const duration = 1500;
    const startTime = Date.now();
    const startValue = 0;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(startValue + (value - startValue) * easeOutQuart);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value]);
  
  return (
    <span>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}

export default function RentalEstimator() {
  const [step, setStep] = useState<'search' | 'lead' | 'results'>('search');
  const [loading, setLoading] = useState(false);
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
  const [estimate, setEstimate] = useState<typeof mockEstimate | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.address) return;
    setStep('lead');
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadData.email || !leadData.name) return;
    
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setEstimate(mockEstimate);
      setLoading(false);
      setStep('results');
    }, 1500);
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
    return `${Math.round(value * 100)}%`;
  };

  const formatMonth = (dateStr: string) => {
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
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
                Discover how much your property could earn on Airbnb & VRBO
              </p>
            </motion.div>
            
            {/* Form Card */}
            <motion.form 
              onSubmit={handleSearch} 
              className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 md:p-10"
              variants={itemVariants}
            >
              {/* Address Input */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans uppercase tracking-wider">
                  Property Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C9A962]" />
                  <input
                    type="text"
                    placeholder="Enter your property address..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 border-2 border-[#0F172A]/10 rounded-xl text-lg focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans bg-white"
                  />
                </div>
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
                disabled={!formData.address}
                className="w-full bg-[#0F172A] text-white py-4 rounded-xl font-semibold text-lg hover:bg-[#1e293b] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 font-sans group"
              >
                <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Get Free Estimate
              </button>
              
              {/* Trust Badge */}
              <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-[#0F172A]/10">
                <div className="w-1 h-1 rounded-full bg-[#C9A962]" />
                <p className="text-center text-[#0F172A]/50 text-sm font-sans">
                  Powered by AirDNA market data
                </p>
                <div className="w-1 h-1 rounded-full bg-[#C9A962]" />
                <p className="text-center text-[#0F172A]/50 text-sm font-sans">
                  Trusted by 100,000+ hosts
                </p>
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
        {/* Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/results-bg.jpg)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A]/95 via-[#0F172A]/90 to-[#1e293b]/85" />
        </div>
        
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-12">
          <motion.div 
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-[#166534]/10 rounded-full mb-4">
                  <TrendingUp className="w-7 h-7 text-[#166534]" />
                </div>
                <h2 className="text-2xl md:text-3xl font-serif font-semibold text-[#0F172A] mb-2">
                  Your Estimate is Ready!
                </h2>
                <p className="text-[#0F172A]/60 font-sans">
                  Enter your details to see your rental income potential
                </p>
              </div>
              
              {/* Property Summary Card */}
              <div className="bg-[#0F172A]/5 rounded-xl p-4 mb-8 border border-[#0F172A]/10">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#C9A962]/20 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-[#C9A962]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#0F172A] font-sans">{formData.address}</p>
                    <p className="text-sm text-[#0F172A]/60 font-sans mt-1">
                      {formData.bedrooms} BR • {formData.bathrooms} BA • Sleeps {formData.accommodates}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Lead Form */}
              <form onSubmit={handleLeadSubmit}>
                <div className="space-y-5 mb-8">
                  <div>
                    <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans uppercase tracking-wider">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={leadData.name}
                      onChange={(e) => setLeadData({ ...leadData, name: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans uppercase tracking-wider">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={leadData.email}
                      onChange={(e) => setLeadData({ ...leadData, email: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#0F172A]/70 mb-2 font-sans uppercase tracking-wider">
                      Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      value={leadData.phone}
                      onChange={(e) => setLeadData({ ...leadData, phone: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-[#0F172A]/10 rounded-xl focus:ring-2 focus:ring-[#C9A962]/50 focus:border-[#C9A962] outline-none transition-all duration-300 font-sans"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
                
                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !leadData.email || !leadData.name}
                  className="w-full bg-[#166534] text-white py-4 rounded-xl font-semibold text-lg hover:bg-[#14532d] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 font-sans"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing Property...
                    </>
                  ) : (
                    <>
                      View My Estimate
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
              
              {/* Back Button */}
              <button
                onClick={() => setStep('search')}
                className="w-full text-[#0F172A]/50 text-sm mt-6 hover:text-[#0F172A] transition-colors font-sans flex items-center justify-center gap-1"
              >
                ← Back to search
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Results View
  if (step === 'results' && estimate) {
    const { property, estimates, monthly_forecast, comps } = estimate;
    const maxRevenue = Math.max(...monthly_forecast.map(m => m.revenue));
    
    return (
      <div 
        className="min-h-screen"
        style={{ 
          backgroundImage: 'url(/images/results-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        {/* Header */}
        <div className="bg-[#0F172A] text-white py-10 px-4">
          <motion.div 
            className="max-w-5xl mx-auto"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 text-[#C9A962] text-sm mb-3 font-sans">
              <MapPin className="w-4 h-4" />
              {property.address}
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-semibold mb-2">Your Rental Estimate</h1>
            <p className="text-white/60 font-sans">
              {property.bedrooms} Bedrooms • {property.bathrooms} Bathrooms • Sleeps {property.accommodates}
            </p>
          </motion.div>
        </div>
        
        {/* Main Content */}
        <div className="max-w-5xl mx-auto px-4 -mt-6 pb-12">
          {/* Main Stats Card */}
          <motion.div 
            className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Annual Revenue */}
              <div className="text-center p-6 bg-gradient-to-br from-[#166534]/5 to-[#166534]/10 rounded-xl border border-[#166534]/10">
                <div className="text-sm text-[#0F172A]/60 mb-2 font-sans uppercase tracking-wider">Annual Revenue</div>
                <div className="text-4xl md:text-5xl font-serif font-semibold text-[#166534]">
                  <AnimatedNumber value={estimates.annual_revenue} prefix="$" />
                </div>
                <div className="text-sm text-[#0F172A]/50 mt-2 font-sans">
                  Range: {formatCurrency(estimates.annual_revenue_low)} - {formatCurrency(estimates.annual_revenue_high)}
                </div>
              </div>
              
              {/* Average Daily Rate */}
              <div className="text-center p-6 bg-gradient-to-br from-[#0F172A]/5 to-[#0F172A]/10 rounded-xl border border-[#0F172A]/10">
                <div className="text-sm text-[#0F172A]/60 mb-2 font-sans uppercase tracking-wider">Average Daily Rate</div>
                <div className="text-4xl md:text-5xl font-serif font-semibold text-[#0F172A]">
                  <AnimatedNumber value={estimates.average_daily_rate} prefix="$" />
                </div>
                <div className="text-sm text-[#0F172A]/50 mt-2 font-sans">Per night</div>
              </div>
              
              {/* Occupancy Rate */}
              <div className="text-center p-6 bg-gradient-to-br from-[#C9A962]/5 to-[#C9A962]/15 rounded-xl border border-[#C9A962]/20">
                <div className="text-sm text-[#0F172A]/60 mb-2 font-sans uppercase tracking-wider">Occupancy Rate</div>
                <div className="text-4xl md:text-5xl font-serif font-semibold text-[#C9A962]">
                  {formatPercent(estimates.occupancy_rate)}
                </div>
                <div className="text-sm text-[#0F172A]/50 mt-2 font-sans">Annual average</div>
              </div>
            </div>
          </motion.div>
          
          {/* Monthly Forecast */}
          <motion.div 
            className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="text-xl md:text-2xl font-serif font-semibold text-[#0F172A] mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#0F172A]/5 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#C9A962]" />
              </div>
              Monthly Revenue Forecast
            </h2>
            <div className="space-y-4">
              {monthly_forecast.map((month, idx) => (
                <motion.div 
                  key={idx} 
                  className="flex items-center gap-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + idx * 0.05 }}
                >
                  <div className="w-12 text-sm font-medium text-[#0F172A]/60 font-sans">{formatMonth(month.month)}</div>
                  <div className="flex-1">
                    <div className="h-10 bg-[#0F172A]/5 rounded-lg overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-[#0F172A] to-[#1e293b] rounded-lg flex items-center justify-end pr-4"
                        initial={{ width: 0 }}
                        animate={{ width: `${(month.revenue / maxRevenue) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.5 + idx * 0.05, ease: "easeOut" }}
                      >
                        <span className="text-white text-sm font-medium font-sans">{formatCurrency(month.revenue)}</span>
                      </motion.div>
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm text-[#0F172A]/50 font-sans">{formatPercent(month.occupancy)}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
          
          {/* Comparable Properties */}
          <motion.div 
            className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2 className="text-xl md:text-2xl font-serif font-semibold text-[#0F172A] mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#0F172A]/5 flex items-center justify-center">
                <Building className="w-5 h-5 text-[#C9A962]" />
              </div>
              Comparable Properties ({comps.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {comps.map((comp, idx) => (
                <motion.div 
                  key={idx} 
                  className="border border-[#0F172A]/10 rounded-xl p-5 hover:shadow-lg hover:border-[#C9A962]/30 transition-all duration-300 group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + idx * 0.1 }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-[#0F172A] font-sans line-clamp-2 group-hover:text-[#C9A962] transition-colors">{comp.title}</h3>
                    {comp.rating && (
                      <div className="flex items-center gap-1 text-sm bg-[#C9A962]/10 px-2 py-1 rounded-full">
                        <Star className="w-3.5 h-3.5 text-[#C9A962] fill-[#C9A962]" />
                        <span className="font-medium text-[#0F172A] font-sans">{comp.rating}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-[#0F172A]/50 mb-4 font-sans">
                    {comp.bedrooms} BR • {comp.bathrooms} BA • {Math.round(comp.distance_meters)}m away
                  </div>
                  
                  {/* Gold divider */}
                  <div className="h-px bg-gradient-to-r from-transparent via-[#C9A962]/30 to-transparent mb-4" />
                  
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xs text-[#0F172A]/50 font-sans uppercase tracking-wider mb-1">Revenue</div>
                      <div className="font-semibold text-[#166534] text-sm font-sans">{formatCurrency(comp.annual_revenue)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#0F172A]/50 font-sans uppercase tracking-wider mb-1">ADR</div>
                      <div className="font-semibold text-[#0F172A] text-sm font-sans">{formatCurrency(comp.adr)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#0F172A]/50 font-sans uppercase tracking-wider mb-1">Occ.</div>
                      <div className="font-semibold text-[#C9A962] text-sm font-sans">{formatPercent(comp.occupancy)}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
          
          {/* CTA Section */}
          <motion.div 
            className="relative rounded-2xl shadow-xl overflow-hidden mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: 'url(/images/success-property.jpg)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0F172A]/95 to-[#0F172A]/80" />
            <div className="relative z-10 p-8 md:p-12 text-center text-white">
              <h2 className="text-2xl md:text-3xl font-serif font-semibold mb-3">Ready to Maximize Your Rental Income?</h2>
              <p className="text-white/70 mb-8 max-w-xl mx-auto font-sans">
                Our experts can help you optimize your property and increase your earnings by up to 40%.
              </p>
              <button className="bg-[#C9A962] text-[#0F172A] px-10 py-4 rounded-xl font-semibold hover:bg-[#d4b876] transition-all duration-300 font-sans shadow-lg hover:shadow-xl">
                Schedule a Free Consultation
              </button>
            </div>
          </motion.div>
          
          {/* New Search */}
          <div className="text-center">
            <button
              onClick={() => {
                setStep('search');
                setEstimate(null);
                setFormData({ address: '', bedrooms: 2, bathrooms: 1, accommodates: 4 });
              }}
              className="text-[#0F172A]/60 hover:text-[#C9A962] font-medium font-sans transition-colors inline-flex items-center gap-2"
            >
              ← Search Another Property
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
