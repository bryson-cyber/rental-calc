/**
 * Premium Property Report - Sales Qualified Lead Tool
 * 
 * Shows ALL Rentalizer data upfront - no email gate
 * Designed to demonstrate value and warm up leads for Turnkey Program
 * 
 * Data displayed (all from /rentalizer/estimate):
 * - Revenue estimate with confidence range (low/high)
 * - Cash flow breakdown (revenue - rent = profit)
 * - Average Daily Rate (ADR)
 * - Occupancy rate
 * - 12-month seasonality forecast
 * - 6 comparable properties with Airbnb links
 */

import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { 
  MapPin,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Bed,
  Bath,
  Star,
  Users,
  Home,
  ExternalLink,
  BarChart3,
  Target,
  Sparkles,
  ArrowUpRight,
  Clock,
  Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { toast } from 'sonner';

interface MonthlyForecast {
  month: string;
  revenue: number;
  adr: number;
  occupancy: number;
}

interface Comparable {
  id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  revenue: number;
  adr: number;
  occupancy: number;
  rating: number;
  reviews: number;
  imageUrl?: string;
  airbnbUrl?: string;
  distanceMeters?: number;
}

interface AnalysisResult {
  // Revenue data
  revenue: number;
  revenueLow: number;
  revenueHigh: number;
  // Rates
  adr: number;
  occupancy: number;
  // Cash flow
  rent: number;
  profit: number;
  profitLow: number;
  profitHigh: number;
  // Property details
  address: string;
  bedrooms: number;
  bathrooms: number;
  // Forecast & comps
  monthlyForecast: MonthlyForecast[];
  comparables: Comparable[];
}

// Format currency
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Format month name
const formatMonth = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short' });
};

// Get month abbreviation
const getMonthAbbr = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short' }).substring(0, 3);
};

export default function LeadMagnet() {
  // Form state
  const [address, setAddress] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [bedrooms, setBedrooms] = useState('2');
  const [bathrooms, setBathrooms] = useState('1');
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  
  const resultsRef = useRef<HTMLDivElement>(null);
  
  // tRPC mutation
  const analysisMutation = trpc.rental.getEstimate.useMutation();
  
  // Loading steps
  const loadingSteps = [
    'Finding your property...',
    'Analyzing market data...',
    'Calculating revenue potential...',
    'Finding comparable properties...',
    'Building your report...'
  ];
  
  useEffect(() => {
    if (isAnalyzing) {
      setLoadingStep(0);
      const interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % loadingSteps.length);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isAnalyzing]);
  
  const runAnalysis = async () => {
    if (!address.trim()) {
      toast.error('Please enter a property address');
      return;
    }
    if (!monthlyRent || parseFloat(monthlyRent) <= 0) {
      toast.error('Please enter the monthly rent');
      return;
    }
    
    setIsAnalyzing(true);
    setResult(null);
    
    try {
      const response = await analysisMutation.mutateAsync({
        address: address.trim(),
        bedrooms: parseInt(bedrooms) || 2,
        bathrooms: parseFloat(bathrooms) || 1,
      });
      
      if (response.success && response.data) {
        const data = response.data;
        const annualRent = parseFloat(monthlyRent) * 12;
        
        // Extract revenue data with range
        const annualRevenue = data.estimates?.annual_revenue || 0;
        const revenueLow = data.estimates?.annual_revenue_low || annualRevenue * 0.85;
        const revenueHigh = data.estimates?.annual_revenue_high || annualRevenue * 1.15;
        
        // Calculate profits
        const profit = annualRevenue - annualRent;
        const profitLow = revenueLow - annualRent;
        const profitHigh = revenueHigh - annualRent;
        
        // Extract monthly forecast
        const monthlyForecast: MonthlyForecast[] = (data.monthly_forecast || []).map((m: any) => ({
          month: m.month,
          revenue: m.revenue,
          adr: m.adr,
          occupancy: m.occupancy > 1 ? m.occupancy : m.occupancy * 100, // Normalize to percentage
        }));
        
        // Extract comparables
        const comparables: Comparable[] = (data.comps || []).slice(0, 6).map((comp: any, index: number) => {
          let occupancy = comp.occupancy || comp.occupancy_rate || 0;
          if (occupancy > 0 && occupancy <= 1) {
            occupancy = occupancy * 100;
          }
          
          const airbnbListingId = comp.airbnb_listing_id || comp.listing_id || null;
          const airbnbUrl = comp.airbnb_url || (airbnbListingId ? `https://www.airbnb.com/rooms/${airbnbListingId}` : null);
          
          return {
            id: comp.id || `comp-${index}`,
            title: comp.title || `${comp.bedrooms || 2}BR Rental`,
            bedrooms: comp.bedrooms || 2,
            bathrooms: comp.bathrooms || 1,
            accommodates: comp.accommodates || (comp.bedrooms || 2) * 2,
            revenue: comp.revenue || comp.annual_revenue || 0,
            adr: comp.adr || comp.average_daily_rate || 0,
            occupancy: occupancy,
            rating: comp.rating || 4.5,
            reviews: comp.reviews || comp.review_count || 0,
            imageUrl: comp.image_url || comp.thumbnail_url || null,
            airbnbUrl: airbnbUrl,
            distanceMeters: comp.distance_meters,
          };
        });
        
        setResult({
          revenue: annualRevenue,
          revenueLow: revenueLow,
          revenueHigh: revenueHigh,
          adr: data.estimates?.average_daily_rate || 0,
          occupancy: data.estimates?.occupancy_rate || 0,
          rent: annualRent,
          profit: profit,
          profitLow: profitLow,
          profitHigh: profitHigh,
          address: data.property?.address || address,
          bedrooms: data.property?.bedrooms || parseInt(bedrooms),
          bathrooms: data.property?.bathrooms || parseFloat(bathrooms),
          monthlyForecast: monthlyForecast,
          comparables: comparables,
        });
        
        // Scroll to results
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        toast.error('Could not analyze this property. Please try a different address.');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Calculate max revenue for chart scaling
  const maxMonthlyRevenue = result?.monthlyForecast.length 
    ? Math.max(...result.monthlyForecast.map(m => m.revenue))
    : 0;
  
  // Determine if profitable
  const isProfitable = result ? result.profit > 0 : false;
  const profitRatio = result ? result.revenue / result.rent : 0;
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#D4A84B]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#4ECDC4]/10 rounded-full blur-3xl" />
        </div>
        
        <div className="container relative z-10 max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4A84B]/10 border border-[#D4A84B]/20 rounded-full text-[#D4A84B] text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Free Property Analysis
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
              Will This Property
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4]">
                Make Money on Airbnb?
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
              Get instant revenue projections, monthly forecasts, and see what similar properties are earning.
            </p>
          </div>
          
          {/* Search Form */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-2xl">
            <div className="grid gap-6">
              {/* Address Input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Property Address
                </label>
                <AddressAutocomplete
                  value={address}
                  onChange={setAddress}
                  placeholder="Enter the full property address..."
                  className="h-12 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              
              {/* Rent + Beds/Baths Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Monthly Rent
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <Input
                      type="number"
                      value={monthlyRent}
                      onChange={(e) => setMonthlyRent(e.target.value)}
                      placeholder="2,000"
                      className="h-12 pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Bedrooms
                  </label>
                  <select
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                    className="w-full h-12 px-4 bg-slate-900/50 border border-slate-600 rounded-md text-white"
                  >
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <option key={num} value={num}>{num} {num === 1 ? 'Bedroom' : 'Bedrooms'}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Bathrooms
                  </label>
                  <select
                    value={bathrooms}
                    onChange={(e) => setBathrooms(e.target.value)}
                    className="w-full h-12 px-4 bg-slate-900/50 border border-slate-600 rounded-md text-white"
                  >
                    {[1, 1.5, 2, 2.5, 3, 3.5, 4].map(num => (
                      <option key={num} value={num}>{num} {num === 1 ? 'Bathroom' : 'Bathrooms'}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Submit Button */}
              <Button
                onClick={runAnalysis}
                disabled={isAnalyzing}
                size="lg"
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] hover:from-[#C9A43E] hover:to-[#45B8B0] text-white shadow-lg shadow-[#D4A84B]/25"
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {loadingSteps[loadingStep]}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Analyze This Property
                    <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Results Section */}
      {result && (
        <section ref={resultsRef} className="py-12 md:py-16">
          <div className="container max-w-6xl mx-auto px-4">
            
            {/* Property Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 text-slate-400 mb-2">
                <MapPin className="w-4 h-4" />
                <span>{result.address}</span>
              </div>
              <div className="flex items-center justify-center gap-4 text-slate-500 text-sm">
                <span className="flex items-center gap-1">
                  <Bed className="w-4 h-4" />
                  {result.bedrooms} bed
                </span>
                <span className="flex items-center gap-1">
                  <Bath className="w-4 h-4" />
                  {result.bathrooms} bath
                </span>
              </div>
            </div>
            
            {/* Main Verdict Card */}
            <div className={`relative overflow-hidden rounded-3xl p-8 md:p-12 mb-8 ${
              isProfitable 
                ? 'bg-gradient-to-br from-emerald-900/50 to-emerald-950/50 border border-emerald-500/30' 
                : 'bg-gradient-to-br from-amber-900/50 to-amber-950/50 border border-amber-500/30'
            }`}>
              {/* Background glow */}
              <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20 ${
                isProfitable ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />
              
              <div className="relative z-10">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  {/* Left: Verdict */}
                  <div>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-4 ${
                      isProfitable 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {isProfitable ? <CheckCircle2 className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                      {profitRatio >= 2 ? 'Strong Opportunity' : profitRatio >= 1.5 ? 'Looks Profitable' : profitRatio >= 1 ? 'Worth Exploring' : 'Needs Work'}
                    </div>
                    
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                      {isProfitable ? 'This Property Can Make Money' : 'This Property Needs Negotiation'}
                    </h2>
                    
                    <p className="text-slate-400 text-lg">
                      {isProfitable 
                        ? `At ${profitRatio.toFixed(1)}x your rent, you're in a strong position. Similar properties nearby are proving this works.`
                        : `At ${profitRatio.toFixed(1)}x your rent, you'll need to negotiate lower rent or optimize aggressively to make this work.`
                      }
                    </p>
                  </div>
                  
                  {/* Right: Key Numbers */}
                  <div className="space-y-4">
                    {/* Revenue Range */}
                    <div className="bg-slate-900/50 rounded-xl p-4">
                      <div className="text-sm text-slate-400 mb-1">Projected Annual Revenue</div>
                      <div className="text-3xl font-bold text-white">{formatCurrency(result.revenue)}</div>
                      <div className="text-sm text-slate-500 mt-1">
                        Range: {formatCurrency(result.revenueLow)} – {formatCurrency(result.revenueHigh)}
                      </div>
                    </div>
                    
                    {/* Profit */}
                    <div className={`rounded-xl p-4 ${isProfitable ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                      <div className="text-sm text-slate-400 mb-1">Estimated Annual Profit</div>
                      <div className={`text-3xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {result.profit >= 0 ? '+' : ''}{formatCurrency(result.profit)}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        {formatCurrency(result.profit / 12)}/month after rent
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Cash Flow Breakdown */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="text-sm text-slate-400">Airbnb Income</div>
                </div>
                <div className="text-2xl font-bold text-white">{formatCurrency(result.revenue)}</div>
                <div className="text-sm text-slate-500">{formatCurrency(result.revenue / 12)}/month</div>
              </div>
              
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="text-sm text-slate-400">Annual Rent</div>
                </div>
                <div className="text-2xl font-bold text-white">-{formatCurrency(result.rent)}</div>
                <div className="text-sm text-slate-500">-{formatCurrency(result.rent / 12)}/month</div>
              </div>
              
              <div className={`rounded-xl p-6 ${isProfitable ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isProfitable ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                    <DollarSign className={`w-5 h-5 ${isProfitable ? 'text-emerald-400' : 'text-amber-400'}`} />
                  </div>
                  <div className="text-sm text-slate-400">Net Profit</div>
                </div>
                <div className={`text-2xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {result.profit >= 0 ? '+' : ''}{formatCurrency(result.profit)}
                </div>
                <div className="text-sm text-slate-500">
                  {result.profit >= 0 ? '+' : ''}{formatCurrency(result.profit / 12)}/month
                </div>
              </div>
            </div>
            
            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                <div className="text-sm text-slate-400 mb-1">Avg Nightly Rate</div>
                <div className="text-xl font-bold text-white">{formatCurrency(result.adr)}</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                <div className="text-sm text-slate-400 mb-1">Occupancy Rate</div>
                <div className="text-xl font-bold text-white">
                  {result.occupancy > 1 ? result.occupancy.toFixed(0) : (result.occupancy * 100).toFixed(0)}%
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                <div className="text-sm text-slate-400 mb-1">Revenue-to-Rent</div>
                <div className="text-xl font-bold text-white">{profitRatio.toFixed(1)}x</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                <div className="text-sm text-slate-400 mb-1">Nearby Comps</div>
                <div className="text-xl font-bold text-white">{result.comparables.length}</div>
              </div>
            </div>
            
            {/* Monthly Forecast Chart */}
            {result.monthlyForecast.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 md:p-8 mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Monthly Revenue Forecast</h3>
                    <p className="text-sm text-slate-400">See which months earn the most</p>
                  </div>
                </div>
                
                {/* Bar Chart */}
                <div className="flex items-end justify-between gap-1 md:gap-2 h-56 mb-4">
                  {result.monthlyForecast.map((month, index) => {
                    const heightPercent = maxMonthlyRevenue > 0 ? (month.revenue / maxMonthlyRevenue) * 100 : 0;
                    const isHighMonth = month.revenue >= maxMonthlyRevenue * 0.9;
                    const barHeight = Math.max(heightPercent * 1.6, 20); // Scale up and set minimum
                    
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center justify-end h-full">
                        <div className="text-[10px] md:text-xs text-slate-400 font-medium mb-1 whitespace-nowrap">
                          {formatCurrency(month.revenue)}
                        </div>
                        <div 
                          className={`w-full rounded-t-lg transition-all ${
                            isHighMonth 
                              ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' 
                              : 'bg-gradient-to-t from-slate-600 to-slate-500'
                          }`}
                          style={{ height: `${barHeight}px`, minHeight: '20px' }}
                        />
                        <div className="text-[10px] md:text-xs text-slate-500 font-medium mt-1">
                          {getMonthAbbr(month.month)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Peak Season Callout */}
                <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-900/50 rounded-lg px-4 py-3">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>
                    <strong className="text-emerald-400">Peak months</strong> are highlighted — plan your launch accordingly
                  </span>
                </div>
              </div>
            )}
            
            {/* Comparable Properties */}
            {result.comparables.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Home className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Nearby Properties Making Money</h3>
                    <p className="text-sm text-slate-400">Real data from similar Airbnb listings in your area</p>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.comparables.map((comp) => {
                    const compProfit = comp.revenue - result.rent;
                    const compProfitable = compProfit > 0;
                    
                    return (
                      <a
                        key={comp.id}
                        href={comp.airbnbUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`group relative bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600 transition-all ${
                          comp.airbnbUrl ? 'cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        {/* Image or Placeholder */}
                        <div className="relative h-32 bg-slate-900">
                          {comp.imageUrl ? (
                            <img 
                              src={comp.imageUrl} 
                              alt={comp.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                              <Home className="w-8 h-8 text-slate-600" />
                            </div>
                          )}
                          
                          {/* Profit Badge */}
                          <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium ${
                            compProfitable ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'
                          }`}>
                            {compProfitable ? `+${formatCurrency(compProfit)}/yr` : 'Below threshold'}
                          </div>
                          
                          {/* Airbnb Link Icon */}
                          {comp.airbnbUrl && (
                            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <ExternalLink className="w-4 h-4 text-[#FF5A5F]" />
                            </div>
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="p-4">
                          <h4 className="font-semibold text-white mb-2 line-clamp-1">{comp.title}</h4>
                          
                          {/* Specs */}
                          <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                            <span className="flex items-center gap-1">
                              <Bed className="w-3 h-3" />
                              {comp.bedrooms}
                            </span>
                            <span className="flex items-center gap-1">
                              <Bath className="w-3 h-3" />
                              {comp.bathrooms}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {comp.accommodates}
                            </span>
                            {comp.rating > 0 && (
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                {comp.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                          
                          {/* Revenue & Metrics */}
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-slate-900/50 rounded-lg py-2">
                              <div className="text-xs text-slate-500">Revenue</div>
                              <div className="text-sm font-semibold text-white">{formatCurrency(comp.revenue)}</div>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg py-2">
                              <div className="text-xs text-slate-500">ADR</div>
                              <div className="text-sm font-semibold text-white">{formatCurrency(comp.adr)}</div>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg py-2">
                              <div className="text-xs text-slate-500">Occupancy</div>
                              <div className="text-sm font-semibold text-white">{comp.occupancy.toFixed(0)}%</div>
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
                
                {/* Market Insight */}
                <div className="mt-6 bg-slate-900/50 rounded-xl p-4 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-purple-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-white mb-1">Market Insight</div>
                    <div className="text-sm text-slate-400">
                      {result.comparables.filter(c => (c.revenue - result.rent) > 0).length} out of {result.comparables.length} similar properties 
                      are earning more than your rent cost. This market has proven demand.
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Turnkey CTA */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900/50 via-emerald-900/30 to-cyan-900/50 border border-emerald-500/30 p-8 md:p-12">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl" />
              
              <div className="relative z-10 max-w-3xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-medium mb-6">
                  <Sparkles className="w-4 h-4" />
                  Done-For-You Setup
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Ready to Turn This Into Reality?
                </h2>
                
                <p className="text-lg text-slate-300 mb-8">
                  The numbers look good — but execution is everything. Our Turnkey Program handles the entire setup 
                  so you can start earning without the headaches.
                </p>
                
                {/* What's Included */}
                <div className="grid sm:grid-cols-2 gap-4 mb-8 text-left">
                  <div className="flex items-start gap-3 bg-slate-900/30 rounded-xl p-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Property Sourcing</div>
                      <div className="text-sm text-slate-400">We find and negotiate the best deals</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-slate-900/30 rounded-xl p-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Full Furnishing</div>
                      <div className="text-sm text-slate-400">Professional design & setup</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-slate-900/30 rounded-xl p-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Listing Launch</div>
                      <div className="text-sm text-slate-400">Professional photos & listing optimization</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-slate-900/30 rounded-xl p-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Ongoing Coaching</div>
                      <div className="text-sm text-slate-400">12 months of hands-on support</div>
                    </div>
                  </div>
                </div>
                
                <Button
                  asChild
                  size="lg"
                  className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/25"
                >
                  <a href="https://coachinayahturnkey.com" target="_blank" rel="noopener noreferrer">
                    Learn About the Turnkey Program
                    <ArrowUpRight className="w-5 h-5 ml-2" />
                  </a>
                </Button>
                
                <p className="mt-4 text-sm text-slate-500">
                  Up to $125K in funding available • 12 months of coaching included
                </p>
              </div>
            </div>
            
            {/* Data Source Attribution */}
            <div className="mt-12 pt-8 border-t border-slate-700/50">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span>
                  Data powered by <a href="https://www.airdna.co" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">AirDNA</a> — 
                  aggregated from Airbnb, Vrbo, and other major booking platforms
                </span>
              </div>
            </div>
            
          </div>
        </section>
      )}
    </div>
  );
}
