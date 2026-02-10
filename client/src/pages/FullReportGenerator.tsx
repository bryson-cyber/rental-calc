/**
 * FullReportGenerator Page
 * 
 * Standalone entry point for generating a comprehensive Full Property Report
 * directly from an address + property details, without going through Steps 1-4.
 * 
 * Uses the sharedReports.generateFromAddress tRPC endpoint which:
 * 1. Fetches comprehensive AirDNA data
 * 2. Builds the full report data structure
 * 3. Generates AI executive summary
 * 4. Saves to database and returns a shareable URL
 */
import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
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
} from 'lucide-react';

export default function FullReportGenerator() {
  const [, navigate] = useLocation();
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
  const [progress, setProgress] = useState('');
  
  const generateMutation = trpc.sharedReports.generateFromAddress.useMutation();
  
  // Progress animation
  useEffect(() => {
    if (!generating) return;
    const steps = [
      'Fetching property data from AirDNA...',
      'Analyzing comparable properties...',
      'Calculating revenue projections...',
      'Evaluating market conditions...',
      'Generating AI executive summary...',
      'Building your report...',
    ];
    let idx = 0;
    setProgress(steps[0]);
    const interval = setInterval(() => {
      idx = Math.min(idx + 1, steps.length - 1);
      setProgress(steps[idx]);
    }, 5000);
    return () => clearInterval(interval);
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
        
        {/* Form */}
        <form onSubmit={handleGenerate} className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6 md:p-8">
            {/* Address */}
            <div className="mb-6">
              <Label className="block text-sm font-medium text-[#374151] mb-2 font-sans">
                Property Address
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C9A962]" />
                <Input
                  type="text"
                  placeholder="Enter the full property address..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="pl-11 h-12 text-base border-[#E8E4DC] focus:border-[#C9A962] focus:ring-[#C9A962]/20 rounded-xl font-sans"
                  disabled={generating}
                  required
                />
              </div>
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
              {generating ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{progress}</span>
                </div>
              ) : !isAuthenticated ? (
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
              Report generation takes 20-40 seconds. Data powered by AirDNA market analytics.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
