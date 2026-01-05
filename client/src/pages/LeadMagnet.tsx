/**
 * Lead Magnet - Ultra Simple Rental Calculator
 * 
 * Flow:
 * 1. Enter address + rent → Get instant verdict
 * 2. See 3 key numbers: Revenue, Rent, Profit
 * 3. See comparable properties in the area
 * 4. Email gate for full report
 */

import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { 
  MapPin,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Mail,
  Phone,
  Sparkles,
  TrendingUp,
  Building2,
  Calendar,
  Bed,
  Bath,
  Star,
  Users,
  Home,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { toast } from 'sonner';

// Verdict thresholds
const GREAT_RATIO = 3.0; // 3x rent = great deal
const GOOD_RATIO = 2.0;  // 2x rent = good deal
const RISKY_RATIO = 1.5; // 1.5x rent = risky

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
  airbnbListingId?: string;
}

interface AnalysisResult {
  revenue: number;
  rent: number;
  profit: number;
  ratio: number;
  verdict: 'great' | 'good' | 'risky' | 'bad';
  marketName: string;
  occupancy: number;
  competitorCount: number;
  aiSummary: string;
  comparables: Comparable[];
}

export default function LeadMagnet() {
  // Form state
  const [address, setAddress] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [bedrooms, setBedrooms] = useState('2');
  const [bathrooms, setBathrooms] = useState('1');
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Email gate state
  const [email, setEmail] = useState('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [hasUnlockedReport, setHasUnlockedReport] = useState(false);
  
  const resultsRef = useRef<HTMLDivElement>(null);
  
  // tRPC mutations
  const analysisMutation = trpc.rental.getEstimate.useMutation();
  const leadMutation = trpc.rental.submitLead.useMutation();
  
  // Loading messages
  const loadingMessages = [
    'Finding your property...',
    'Analyzing the market...',
    'Checking competitor data...',
    'Calculating revenue potential...',
    'Generating your verdict...'
  ];
  
  useEffect(() => {
    if (isAnalyzing) {
      let index = 0;
      setLoadingMessage(loadingMessages[0]);
      const interval = setInterval(() => {
        index = (index + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[index]);
      }, 2000);
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
    setHasUnlockedReport(false);
    
    try {
      const response = await analysisMutation.mutateAsync({
        address: address.trim(),
        bedrooms: parseInt(bedrooms) || 2,
        bathrooms: parseFloat(bathrooms) || 1,
      });
      
      if (response.success && response.data) {
        const data = response.data;
        const annualRent = parseFloat(monthlyRent) * 12;
        const annualRevenue = data.estimates?.annual_revenue || 0;
        const profit = annualRevenue - annualRent;
        const ratio = annualRevenue / annualRent;
        
        // Determine verdict
        let verdict: 'great' | 'good' | 'risky' | 'bad';
        if (ratio >= GREAT_RATIO) {
          verdict = 'great';
        } else if (ratio >= GOOD_RATIO) {
          verdict = 'good';
        } else if (ratio >= RISKY_RATIO) {
          verdict = 'risky';
        } else {
          verdict = 'bad';
        }
        
        // Generate AI summary based on verdict
        let aiSummary = '';
        if (verdict === 'great') {
          aiSummary = `This property could earn ${ratio.toFixed(1)}x your rent — that's exceptional! Properties like this are rare finds. The market data shows strong demand with ${data.estimates?.occupancy_rate || 65}% average occupancy.`;
        } else if (verdict === 'good') {
          aiSummary = `This property shows solid potential at ${ratio.toFixed(1)}x your rent. Most successful Airbnb arbitrage investors target 2x or higher, and you're there. With good execution, this could be profitable.`;
        } else if (verdict === 'risky') {
          aiSummary = `At ${ratio.toFixed(1)}x rent, this property is on the edge. You'll need excellent reviews and smart pricing to make it work. Consider negotiating lower rent or finding a similar property in a better location.`;
        } else {
          aiSummary = `The numbers don't look great here. At ${ratio.toFixed(1)}x rent, you'd be working hard for thin margins. Most experts recommend at least 2x rent to account for unexpected costs and vacancies.`;
        }
        
        // Extract comparables from API response
        const comparables: Comparable[] = (data.comps || []).slice(0, 6).map((comp: any, index: number) => {
          // Fix occupancy - API returns as decimal (0.65) or percentage (65)
          let occupancy = comp.occupancy || comp.occupancy_rate || 0;
          if (occupancy > 0 && occupancy <= 1) {
            occupancy = occupancy * 100; // Convert decimal to percentage
          }
          
          // Build Airbnb URL from listing ID if available
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
            airbnbListingId: airbnbListingId
          };
        });
        
        setResult({
          revenue: annualRevenue,
          rent: annualRent,
          profit: profit,
          ratio: ratio,
          verdict: verdict,
          marketName: (data.property as any)?.market_name || 'Local Market',
          occupancy: data.estimates?.occupancy_rate || 65,
          competitorCount: data.comps?.length || 0,
          aiSummary: aiSummary,
          comparables: comparables
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
  
  const handleEmailSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setIsSubmittingEmail(true);
    
    try {
      // Save lead to database
      await leadMutation.mutateAsync({
        name: email.split('@')[0], // Use email prefix as name
        email: email.trim(),
        address: address,
        bedrooms: parseInt(bedrooms) || 2,
        bathrooms: parseFloat(bathrooms) || 1,
      });
      
      setHasUnlockedReport(true);
      toast.success('Report unlocked! Check your email for the full analysis.');
    } catch (error) {
      console.error('Lead submission error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmittingEmail(false);
    }
  };
  
  const getVerdictConfig = (verdict: string) => {
    switch (verdict) {
      case 'great':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-500',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          label: 'Great Opportunity',
          emoji: '🎯'
        };
      case 'good':
        return {
          icon: CheckCircle2,
          color: 'text-green-500',
          bg: 'bg-green-500/10',
          border: 'border-green-500/30',
          label: 'Looks Profitable',
          emoji: '✅'
        };
      case 'risky':
        return {
          icon: AlertTriangle,
          color: 'text-amber-500',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          label: 'Proceed with Caution',
          emoji: '⚠️'
        };
      default:
        return {
          icon: XCircle,
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          label: 'Not Recommended',
          emoji: '❌'
        };
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
  
  const getCompProfitability = (comp: Comparable, monthlyRentNum: number) => {
    const annualRent = monthlyRentNum * 12;
    const ratio = comp.revenue / annualRent;
    if (ratio >= GOOD_RATIO) return { label: 'Profitable', color: 'text-emerald-600', bg: 'bg-emerald-100' };
    if (ratio >= RISKY_RATIO) return { label: 'Marginal', color: 'text-amber-600', bg: 'bg-amber-100' };
    return { label: 'Low Margin', color: 'text-red-600', bg: 'bg-red-100' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#0f0f18] to-[#0a0a0f]">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Subtle gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-[#C9A962]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-[#C9A962]/5 rounded-full blur-3xl" />
        
        <div className="container max-w-4xl mx-auto px-4 relative z-10">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#C9A962]/10 border border-[#C9A962]/20 mb-6">
              <Sparkles className="w-4 h-4 text-[#C9A962]" />
              <span className="text-sm text-[#C9A962] font-medium">Free Rental Analysis</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Will This Property<br />
              <span className="text-[#C9A962]">Make Money</span> on Airbnb?
            </h1>
            
            <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto">
              Enter any address and find out in 30 seconds if it's worth pursuing.
            </p>
          </div>
          
          {/* Input Form */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 md:p-8">
            <div className="space-y-6">
              {/* Address Input */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  <MapPin className="w-4 h-4 inline mr-2" />
                  Property Address
                </label>
                <AddressAutocomplete
                  value={address}
                  onChange={setAddress}
                  placeholder="Enter the full property address..."
                  className="w-full bg-white/10 border-white/20 text-white placeholder:text-white/40 h-14 text-lg rounded-xl"
                />
              </div>
              
              {/* Rent + Bedrooms Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    Monthly Rent
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-lg">$</span>
                    <Input
                      type="number"
                      value={monthlyRent}
                      onChange={(e) => setMonthlyRent(e.target.value)}
                      placeholder="2,000"
                      className="pl-8 bg-white/10 border-white/20 text-white placeholder:text-white/40 h-14 text-lg rounded-xl"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    <Building2 className="w-4 h-4 inline mr-2" />
                    Bedrooms
                  </label>
                  <select
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 text-white h-14 text-lg rounded-xl px-4 appearance-none cursor-pointer"
                  >
                    <option value="1" className="bg-[#0f0f18]">1 Bedroom</option>
                    <option value="2" className="bg-[#0f0f18]">2 Bedrooms</option>
                    <option value="3" className="bg-[#0f0f18]">3 Bedrooms</option>
                    <option value="4" className="bg-[#0f0f18]">4 Bedrooms</option>
                    <option value="5" className="bg-[#0f0f18]">5+ Bedrooms</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Bathrooms
                  </label>
                  <select
                    value={bathrooms}
                    onChange={(e) => setBathrooms(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 text-white h-14 text-lg rounded-xl px-4 appearance-none cursor-pointer"
                  >
                    <option value="1" className="bg-[#0f0f18]">1 Bath</option>
                    <option value="1.5" className="bg-[#0f0f18]">1.5 Baths</option>
                    <option value="2" className="bg-[#0f0f18]">2 Baths</option>
                    <option value="2.5" className="bg-[#0f0f18]">2.5 Baths</option>
                    <option value="3" className="bg-[#0f0f18]">3+ Baths</option>
                  </select>
                </div>
              </div>
              
              {/* Submit Button */}
              <Button
                onClick={runAnalysis}
                disabled={isAnalyzing}
                className="w-full h-16 text-lg font-semibold bg-gradient-to-r from-[#C9A962] to-[#B8944F] hover:from-[#D4B06D] hover:to-[#C9A962] text-[#0a0a0f] rounded-xl transition-all duration-300 shadow-lg shadow-[#C9A962]/20"
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {loadingMessage}
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
          
          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-6 mt-8 text-white/40 text-sm">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C9A962]" />
              Free forever
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C9A962]" />
              No credit card required
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C9A962]" />
              Results in 30 seconds
            </span>
          </div>
        </div>
      </section>
      
      {/* Results Section */}
      {result && (
        <section ref={resultsRef} className="py-16 bg-white">
          <div className="container max-w-4xl mx-auto px-4">
            {/* Verdict Card */}
            {(() => {
              const config = getVerdictConfig(result.verdict);
              const VerdictIcon = config.icon;
              
              return (
                <div className={`rounded-2xl border-2 ${config.border} ${config.bg} p-8 mb-8`}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`w-16 h-16 rounded-full ${config.bg} flex items-center justify-center`}>
                      <VerdictIcon className={`w-8 h-8 ${config.color}`} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 uppercase tracking-wide">Our Verdict</p>
                      <h2 className={`text-2xl md:text-3xl font-bold ${config.color}`}>
                        {config.emoji} {config.label}
                      </h2>
                    </div>
                  </div>
                  
                  {/* Key Numbers */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-white rounded-xl">
                      <p className="text-sm text-gray-500 mb-1">Projected Revenue</p>
                      <p className="text-2xl md:text-3xl font-bold text-gray-900">
                        {formatCurrency(result.revenue)}
                      </p>
                      <p className="text-xs text-gray-400">per year</p>
                    </div>
                    <div className="text-center p-4 bg-white rounded-xl">
                      <p className="text-sm text-gray-500 mb-1">Your Rent Cost</p>
                      <p className="text-2xl md:text-3xl font-bold text-gray-900">
                        {formatCurrency(result.rent)}
                      </p>
                      <p className="text-xs text-gray-400">per year</p>
                    </div>
                    <div className="text-center p-4 bg-white rounded-xl">
                      <p className="text-sm text-gray-500 mb-1">Estimated Profit</p>
                      <p className={`text-2xl md:text-3xl font-bold ${result.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(result.profit)}
                      </p>
                      <p className="text-xs text-gray-400">per year</p>
                    </div>
                  </div>
                  
                  {/* Ratio Badge */}
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <span className="text-gray-600">Revenue-to-Rent Ratio:</span>
                    <span className={`px-3 py-1 rounded-full font-bold ${config.bg} ${config.color}`}>
                      {result.ratio.toFixed(1)}x
                    </span>
                    <span className="text-gray-400 text-sm">(2x+ is ideal)</span>
                  </div>
                  
                  {/* AI Summary */}
                  <div className="bg-white rounded-xl p-6 border border-gray-100">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-[#C9A962] flex-shrink-0 mt-1" />
                      <p className="text-gray-700 leading-relaxed">
                        {result.aiSummary}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Comparable Properties Section */}
            {result.comparables && result.comparables.length > 0 && (
              <div className="bg-gray-50 rounded-2xl p-6 md:p-8 mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#C9A962]/10 flex items-center justify-center">
                    <Home className="w-5 h-5 text-[#C9A962]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Nearby Competitors</h3>
                    <p className="text-sm text-gray-500">See what similar properties are earning in this area</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.comparables.map((comp, index) => {
                    const profitability = getCompProfitability(comp, parseFloat(monthlyRent) || 2000);
                    
                    const CardWrapper = comp.airbnbUrl ? 'a' : 'div';
                    const cardProps = comp.airbnbUrl ? {
                      href: comp.airbnbUrl,
                      target: '_blank',
                      rel: 'noopener noreferrer'
                    } : {};
                    
                    return (
                      <CardWrapper 
                        key={comp.id}
                        {...cardProps}
                        className={`bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all block ${comp.airbnbUrl ? 'cursor-pointer hover:border-[#FF5A5F] group' : ''}`}
                      >
                        {/* Property Image or Placeholder */}
                        <div className="h-32 bg-gradient-to-br from-gray-200 to-gray-300 relative">
                          {comp.imageUrl ? (
                            <img 
                              src={comp.imageUrl} 
                              alt={comp.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#FF5A5F]/10 to-[#FF5A5F]/5">
                              <div className="text-center">
                                <Home className="w-8 h-8 text-[#FF5A5F]/40 mx-auto mb-1" />
                                <span className="text-xs text-gray-400">View on Airbnb</span>
                              </div>
                            </div>
                          )}
                          {/* Profitability Badge */}
                          <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold ${profitability.bg} ${profitability.color}`}>
                            {profitability.label}
                          </div>
                          {/* External Link Indicator */}
                          {comp.airbnbUrl && (
                            <div className="absolute top-2 left-2 p-1.5 rounded-full bg-white/90 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                              <ExternalLink className="w-3 h-3 text-[#FF5A5F]" />
                            </div>
                          )}
                        </div>
                        
                        {/* Property Details */}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900 truncate flex-1 group-hover:text-[#FF5A5F] transition-colors">
                              {comp.title || `${comp.bedrooms}BR Rental #${index + 1}`}
                            </h4>
                            {comp.airbnbUrl && (
                              <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 group-hover:text-[#FF5A5F] transition-colors" />
                            )}
                          </div>
                          
                          {/* Property Specs */}
                          <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                            <span className="flex items-center gap-1">
                              <Bed className="w-3 h-3" />
                              {comp.bedrooms} bed
                            </span>
                            <span className="flex items-center gap-1">
                              <Bath className="w-3 h-3" />
                              {comp.bathrooms} bath
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {comp.accommodates} guests
                            </span>
                          </div>
                          
                          {/* Revenue & Metrics */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500">Annual Revenue</span>
                              <span className="font-bold text-gray-900">{formatCurrency(comp.revenue)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500">Avg. Nightly Rate</span>
                              <span className="font-medium text-gray-700">{formatCurrency(comp.adr)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500">Occupancy</span>
                              <span className="font-medium text-gray-700">{Math.round(comp.occupancy)}%</span>
                            </div>
                          </div>
                          
                          {/* Rating */}
                          {comp.rating > 0 && (
                            <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
                              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                              <span className="font-medium text-gray-900">{comp.rating.toFixed(1)}</span>
                              {comp.reviews > 0 && (
                                <span className="text-gray-400 text-sm">({comp.reviews} reviews)</span>
                              )}
                            </div>
                          )}
                        </div>
                      </CardWrapper>
                    );
                  })}
                </div>
                
                {/* Summary */}
                <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-[#C9A962] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900 mb-1">Market Insight</p>
                      <p className="text-sm text-gray-600">
                        {result.comparables.length} similar properties found nearby. 
                        The average revenue is {formatCurrency(
                          result.comparables.reduce((sum, c) => sum + c.revenue, 0) / result.comparables.length
                        )}/year with {Math.round(
                          result.comparables.reduce((sum, c) => sum + c.occupancy, 0) / result.comparables.length
                        )}% average occupancy.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Email Gate or Unlocked Content */}
            {!hasUnlockedReport ? (
              <div className="bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2f] rounded-2xl p-8 text-center">
                <h3 className="text-2xl font-bold text-white mb-4">
                  Want the Full Breakdown?
                </h3>
                <p className="text-white/60 mb-6 max-w-lg mx-auto">
                  Get the complete analysis including detailed competitor data, seasonality insights, and a personalized action plan.
                </p>
                
                {/* What's included */}
                <div className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto text-left">
                  <div className="flex items-center gap-2 text-white/80">
                    <CheckCircle2 className="w-4 h-4 text-[#C9A962]" />
                    <span className="text-sm">Full competitor analysis</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <CheckCircle2 className="w-4 h-4 text-[#C9A962]" />
                    <span className="text-sm">Monthly seasonality</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <CheckCircle2 className="w-4 h-4 text-[#C9A962]" />
                    <span className="text-sm">Startup costs</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <CheckCircle2 className="w-4 h-4 text-[#C9A962]" />
                    <span className="text-sm">Risk assessment</span>
                  </div>
                </div>
                
                {/* Email Form */}
                <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="flex-1 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl"
                  />
                  <Button
                    onClick={handleEmailSubmit}
                    disabled={isSubmittingEmail}
                    className="h-12 px-6 bg-[#C9A962] hover:bg-[#D4B06D] text-[#0a0a0f] font-semibold rounded-xl"
                  >
                    {isSubmittingEmail ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Get Free Report
                      </>
                    )}
                  </Button>
                </div>
                
                <p className="text-white/40 text-xs mt-4">
                  We'll also send you tips on maximizing your Airbnb income.
                </p>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Report Sent!
                </h3>
                <p className="text-gray-600 mb-6">
                  Check your inbox for the full analysis. Want to discuss your investment strategy?
                </p>
                <Button
                  onClick={() => window.open('https://calendly.com', '_blank')}
                  className="bg-[#C9A962] hover:bg-[#D4B06D] text-[#0a0a0f] font-semibold"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Schedule a Free Call
                </Button>
              </div>
            )}
          </div>
        </section>
      )}
      
      {/* Footer */}
      <footer className="py-8 border-t border-white/10">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <p className="text-white/40 text-sm">
            Powered by Coach Inayah • Data from AirDNA
          </p>
        </div>
      </footer>
    </div>
  );
}
