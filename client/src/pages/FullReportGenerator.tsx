/**
 * FullReportGenerator Page
 * 
 * Standalone entry point for generating a comprehensive Full Property Report
 * directly from an address + property details, without going through Steps 1-4.
 * 
 * Features:
 * - SmartAddressInput with Google Places autocomplete + Zillow/Redfin URL support
 * - Step-by-step progress indicator during generation
 * - URL parameter pre-fill from main page (address, bedrooms, bathrooms, etc.)
 * 
 * Uses the sharedReports.generateFromAddress tRPC endpoint which:
 * 1. Fetches comprehensive AirDNA data
 * 2. Builds the full report data structure
 * 3. Generates AI executive summary
 * 4. Saves to database and returns a shareable URL
 */
import { useState, useRef, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  FileText,
  Loader2,
  MapPin,
  BedDouble,
  Bath,
  Users,
  DollarSign,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Home,
  TrendingUp,
  BarChart3,
  Target,
  Shield,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { SmartAddressInput } from '@/components/SmartAddressInput';

// Progress steps for the generation process
const PROGRESS_STEPS = [
  { id: 'property', label: 'Fetching property data', duration: 4000 },
  { id: 'comps', label: 'Analyzing comparable properties', duration: 6000 },
  { id: 'revenue', label: 'Calculating revenue projections', duration: 5000 },
  { id: 'market', label: 'Evaluating market conditions', duration: 6000 },
  { id: 'ai', label: 'Generating AI executive summary', duration: 8000 },
  { id: 'report', label: 'Building your report', duration: 4000 },
];

export default function FullReportGenerator() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  
  // Form state
  const [address, setAddress] = useState('');
  const [bedrooms, setBedrooms] = useState('3');
  const [bathrooms, setBathrooms] = useState('2');
  const [accommodates, setAccommodates] = useState('6');
  const [showFinancials, setShowFinancials] = useState(false);
  const [monthlyRent, setMonthlyRent] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [downPayment, setDownPayment] = useState('20');
  const [interestRate, setInterestRate] = useState('7');
  const [loanType, setLoanType] = useState('conventional');
  const [preparedFor, setPreparedFor] = useState('');
  
  // Generation state
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  const generateMutation = trpc.sharedReports.generateFromAddress.useMutation();
  
  // Pre-fill from URL parameters (from main page)
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const urlAddress = params.get('address');
    const urlBedrooms = params.get('bedrooms');
    const urlBathrooms = params.get('bathrooms');
    const urlAccommodates = params.get('accommodates') || params.get('guests');
    const urlRent = params.get('rent') || params.get('monthlyRent');
    const urlPrice = params.get('price') || params.get('purchasePrice');
    const urlPreparedFor = params.get('preparedFor') || params.get('name');
    
    if (urlAddress) setAddress(decodeURIComponent(urlAddress));
    if (urlBedrooms) setBedrooms(urlBedrooms);
    if (urlBathrooms) setBathrooms(urlBathrooms);
    if (urlAccommodates) setAccommodates(urlAccommodates);
    if (urlRent) {
      setMonthlyRent(urlRent);
      setShowFinancials(true);
    }
    if (urlPrice) {
      setPurchasePrice(urlPrice);
      setShowFinancials(true);
    }
    if (urlPreparedFor) setPreparedFor(decodeURIComponent(urlPreparedFor));
  }, [searchString]);
  
  // Progress animation during generation
  useEffect(() => {
    if (!generating) {
      setCurrentStep(0);
      return;
    }
    
    let stepIdx = 0;
    setCurrentStep(0);
    
    const advanceStep = () => {
      stepIdx++;
      if (stepIdx < PROGRESS_STEPS.length) {
        setCurrentStep(stepIdx);
      }
    };
    
    // Set up timers for each step
    const timers: NodeJS.Timeout[] = [];
    let cumulativeDelay = 0;
    
    for (let i = 0; i < PROGRESS_STEPS.length - 1; i++) {
      cumulativeDelay += PROGRESS_STEPS[i].duration;
      const timer = setTimeout(advanceStep, cumulativeDelay);
      timers.push(timer);
    }
    
    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, [generating]);
  
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    
    if (!address.trim()) {
      toast.error('Please enter a property address');
      return;
    }
    
    setGenerating(true);
    
    try {
      const result = await generateMutation.mutateAsync({
        address: address.trim(),
        bedrooms: parseInt(bedrooms),
        bathrooms: parseFloat(bathrooms),
        accommodates: parseInt(accommodates),
        monthlyRent: monthlyRent ? parseFloat(monthlyRent) : undefined,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
        downPaymentPercent: downPayment ? parseFloat(downPayment) : undefined,
        interestRate: interestRate ? parseFloat(interestRate) : undefined,
        loanType: loanType || undefined,
        preparedFor: preparedFor || undefined,
      });
      
      if (result.success && result.shareId) {
        toast.success('Report generated successfully!');
        navigate(`/report/${result.shareId}`);
      } else {
        toast.error(result.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Report generation failed:', error);
      toast.error('Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };
  
  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <div className="border-b border-[#E8E4DC] bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-[#6B7280] hover:text-[#0F172A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-sans">Back</span>
          </button>
          <div className="h-5 w-px bg-[#E8E4DC]" />
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#C9A962]" />
            <h1 className="text-lg font-serif font-semibold text-[#0F172A]">Full Property Report</h1>
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#C9A962]/10 rounded-2xl mb-6 border border-[#C9A962]/20">
            <FileText className="w-8 h-8 text-[#C9A962]" />
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#0F172A] mb-3 tracking-tight">
            Generate a Full Property Report
          </h2>
          <p className="text-lg text-[#6B7280] font-sans max-w-xl mx-auto">
            Enter any property address and get a comprehensive analysis with revenue projections, market data, comparable properties, and an AI executive summary.
          </p>
        </div>
        
        {/* What's Included */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10 max-w-2xl mx-auto">
          {[
            { icon: TrendingUp, label: 'Revenue Projections' },
            { icon: BarChart3, label: 'Market Analysis' },
            { icon: Target, label: 'Comparable Properties' },
            { icon: Home, label: 'Property Map & Street View' },
            { icon: Sparkles, label: 'AI Executive Summary' },
            { icon: Shield, label: 'Investment Analysis' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-[#E8E4DC]">
              <Icon className="w-4 h-4 text-[#C9A962] flex-shrink-0" />
              <span className="text-sm text-[#374151] font-sans">{label}</span>
            </div>
          ))}
        </div>
        
        {/* Generation Progress Overlay */}
        {generating && (
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-lg p-6 md:p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-[#C9A962]/10 rounded-full mb-3">
                  <Loader2 className="w-6 h-6 text-[#C9A962] animate-spin" />
                </div>
                <h3 className="text-lg font-serif font-semibold text-[#0F172A]">
                  Generating Your Report
                </h3>
                <p className="text-sm text-[#6B7280] mt-1">This typically takes 20-40 seconds</p>
              </div>
              
              <div className="space-y-3">
                {PROGRESS_STEPS.map((step, idx) => {
                  const isCompleted = idx < currentStep;
                  const isActive = idx === currentStep;
                  const isPending = idx > currentStep;
                  
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-500 ${
                        isActive
                          ? 'bg-[#C9A962]/10 border border-[#C9A962]/30'
                          : isCompleted
                          ? 'bg-green-50/50'
                          : 'opacity-40'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : isActive ? (
                        <Loader2 className="w-5 h-5 text-[#C9A962] animate-spin flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-[#D1D5DB] flex-shrink-0" />
                      )}
                      <span
                        className={`text-sm font-sans ${
                          isActive
                            ? 'text-[#0F172A] font-medium'
                            : isCompleted
                            ? 'text-green-700'
                            : 'text-[#9CA3AF]'
                        }`}
                      >
                        {step.label}
                        {isCompleted && <span className="ml-1 text-green-500">✓</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              {/* Progress bar */}
              <div className="mt-6 h-1.5 bg-[#E8E4DC] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#C9A962] to-[#b8963f] rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${((currentStep + 1) / PROGRESS_STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Form */}
        {!generating && (
          <form onSubmit={handleGenerate} className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6 md:p-8">
              {/* Address with SmartAddressInput */}
              <div className="mb-6">
                <Label className="block text-sm font-medium text-[#374151] mb-2 font-sans">
                  Property Address
                </Label>
                <SmartAddressInput
                  value={address}
                  onChange={setAddress}
                  onPropertyDetected={(details) => {
                    // Auto-fill property details from Zillow/Redfin URL
                    if (details.bedrooms !== null) {
                      setBedrooms(String(details.bedrooms));
                    }
                    if (details.bathrooms !== null) {
                      setBathrooms(String(details.bathrooms));
                    }
                    if (details.price !== null) {
                      if (details.priceType === 'rent') {
                        setMonthlyRent(String(details.price));
                        setShowFinancials(true);
                      } else if (details.priceType === 'sale') {
                        setPurchasePrice(String(details.price));
                        setShowFinancials(true);
                      }
                    }
                    toast.success(`Property details loaded from ${details.source || 'listing'}!`);
                  }}
                  onAddressSelect={(selectedAddress, placeId, details) => {
                    // Address selected from Google Places
                    setAddress(selectedAddress);
                  }}
                  placeholder="Enter address or paste Zillow/Redfin URL..."
                  showPropertyCard={true}
                  disabled={generating}
                />
              </div>
              
              {/* Property Details Grid */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <Label className="block text-sm font-medium text-[#374151] mb-2 font-sans">
                    Bedrooms
                  </Label>
                  <div className="relative">
                    <BedDouble className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <Select value={bedrooms} onValueChange={setBedrooms} disabled={generating}>
                      <SelectTrigger className="pl-10 h-11 border-[#E8E4DC] rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n} BR</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-[#374151] mb-2 font-sans">
                    Bathrooms
                  </Label>
                  <div className="relative">
                    <Bath className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <Select value={bathrooms} onValueChange={setBathrooms} disabled={generating}>
                      <SelectTrigger className="pl-10 h-11 border-[#E8E4DC] rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'].map(n => (
                          <SelectItem key={n} value={n}>{n} BA</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-[#374151] mb-2 font-sans">
                    Guests
                  </Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <Select value={accommodates} onValueChange={setAccommodates} disabled={generating}>
                      <SelectTrigger className="pl-10 h-11 border-[#E8E4DC] rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 4, 6, 8, 10, 12, 14, 16].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n} Guests</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              {/* Prepared For (optional) */}
              <div className="mb-6">
                <Label className="block text-sm font-medium text-[#374151] mb-2 font-sans">
                  Prepared For <span className="text-[#9CA3AF] font-normal">(optional)</span>
                </Label>
                <Input
                  type="text"
                  placeholder="Client name for the report header"
                  value={preparedFor}
                  onChange={(e) => setPreparedFor(e.target.value)}
                  className="h-11 border-[#E8E4DC] focus:border-[#C9A962] focus:ring-[#C9A962]/20 rounded-xl font-sans"
                  disabled={generating}
                />
              </div>
              
              {/* Financial Details Toggle */}
              <button
                type="button"
                onClick={() => setShowFinancials(!showFinancials)}
                className="flex items-center gap-2 text-sm text-[#C9A962] hover:text-[#b8963f] font-medium mb-4 transition-colors"
                disabled={generating}
              >
                <DollarSign className="w-4 h-4" />
                Add Financial Details (optional)
                {showFinancials ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {showFinancials && (
                <div className="bg-[#FAFAF8] rounded-xl border border-[#E8E4DC] p-5 mb-6 space-y-4">
                  {/* Rental Arbitrage */}
                  <div>
                    <Label className="block text-sm font-medium text-[#374151] mb-2 font-sans">
                      Monthly Rent <span className="text-[#9CA3AF] font-normal">(for rental arbitrage analysis)</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">$</span>
                      <Input
                        type="number"
                        placeholder="2,500"
                        value={monthlyRent}
                        onChange={(e) => setMonthlyRent(e.target.value)}
                        className="pl-7 h-11 border-[#E8E4DC] rounded-xl font-sans"
                        disabled={generating}
                      />
                    </div>
                  </div>
                  
                  <div className="h-px bg-[#E8E4DC]" />
                  
                  {/* Purchase */}
                  <div>
                    <Label className="block text-sm font-medium text-[#374151] mb-2 font-sans">
                      Purchase Price <span className="text-[#9CA3AF] font-normal">(for investment analysis)</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">$</span>
                      <Input
                        type="number"
                        placeholder="350,000"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                        className="pl-7 h-11 border-[#E8E4DC] rounded-xl font-sans"
                        disabled={generating}
                      />
                    </div>
                  </div>
                  
                  {purchasePrice && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="block text-xs text-[#6B7280] mb-1 font-sans">Down Payment %</Label>
                        <Input
                          type="number"
                          value={downPayment}
                          onChange={(e) => setDownPayment(e.target.value)}
                          className="h-10 border-[#E8E4DC] rounded-lg text-sm font-sans"
                          disabled={generating}
                        />
                      </div>
                      <div>
                        <Label className="block text-xs text-[#6B7280] mb-1 font-sans">Interest Rate %</Label>
                        <Input
                          type="number"
                          step="0.125"
                          value={interestRate}
                          onChange={(e) => setInterestRate(e.target.value)}
                          className="h-10 border-[#E8E4DC] rounded-lg text-sm font-sans"
                          disabled={generating}
                        />
                      </div>
                      <div>
                        <Label className="block text-xs text-[#6B7280] mb-1 font-sans">Loan Type</Label>
                        <Select value={loanType} onValueChange={setLoanType} disabled={generating}>
                          <SelectTrigger className="h-10 border-[#E8E4DC] rounded-lg text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conventional">Conventional</SelectItem>
                            <SelectItem value="dscr">DSCR</SelectItem>
                            <SelectItem value="fha">FHA</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Generate Button */}
              <Button
                type="submit"
                disabled={generating || !address.trim()}
                className="w-full h-14 bg-[#C9A962] hover:bg-[#b8963f] text-white font-semibold text-lg rounded-full transition-all duration-300 disabled:opacity-50 font-sans shadow-md hover:shadow-lg"
              >
                {!isAuthenticated ? (
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Sign In to Generate Report
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Generate Full Report
                  </div>
                )}
              </Button>
              
              {/* Disclaimer */}
              <p className="text-center text-xs text-[#9CA3AF] mt-4 font-sans">
                Report generation takes 20-40 seconds. Data powered by Coach Inayah market data.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
