/**
 * Investment Calculator Page
 * 
 * Purchase-focused analysis tool for property investors who buy properties.
 * Same data and analysis flow as the rental arbitrage tools, but focused on:
 * - Property purchase (not rental arbitrage)
 * - Multiple loan types (Conventional, DSCR, FHA, Cash)
 * - Investment metrics (Cap Rate, Cash-on-Cash, DSCR, Break-even)
 * 
 * Supports Zillow/Redfin URL import for quick property data entry.
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { SmartAddressInput, type PropertyDetails } from '@/components/SmartAddressInput';
import LoanCalculator, { type LoanCalculations } from '@/components/LoanCalculator';
// Note: CompDataTable and HistoricalCharts require market/submarket IDs
// For now we'll show a simple comparables list
import { ShareReportButton } from '@/components/ShareReportButton';
import { InfoTooltip, MetricLabel } from '@/components/InfoTooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useProperty } from '@/contexts/PropertyContext';
import { useAuth } from '@/_core/hooks/useAuth';

import {
  MapPin,
  DollarSign,
  Home,
  Building,
  Calculator,
  TrendingUp,
  TrendingDown,
  Bed,
  Bath,
  Users,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Star,
  BarChart3,
  Percent,
  PiggyBank,
  Wallet,
  Landmark,
  Info,
  ArrowLeft,
  Link2
} from 'lucide-react';

// Types
interface AnalysisResult {
  revenue: {
    projected: number;
    low: number;
    high: number;
  };
  metrics: {
    adr: number;
    occupancy: number;
  };
  forecast: Array<{
    month: string;
    revenue: number;
    adr: number;
    occupancy: number;
  }>;
  comparables: Array<{
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
    images?: string[];
    airbnbUrl?: string;
    distanceMeters?: number;
  }>;
  historicalData?: {
    summary: {
      monthly_pct_change: number;
      yearly_pct_change: number;
      trend: 'up' | 'down' | 'stable';
    };
    months: Array<{
      date: string;
      revenue: number;
      occupancy: number;
      adr: number;
    }>;
  };
  marketInsights?: {
    professionallyManagedPct: number;
    superhostPct: number;
    avgRating?: number;
    totalListings?: number;
    marketScore?: number;
  };
  marketId?: string | number;
}

// Utility functions
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function InvestmentCalculator() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { setMyProperty } = useProperty();

  // Form state
  const [address, setAddress] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [bedrooms, setBedrooms] = useState<number>(3);
  const [bathrooms, setBathrooms] = useState<number>(2);
  const [accommodates, setAccommodates] = useState<number>(6);
  
  // Property detection from Zillow/Redfin
  const [detectedProperty, setDetectedProperty] = useState<PropertyDetails | null>(null);
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loanCalculations, setLoanCalculations] = useState<LoanCalculations | null>(null);
  
  // UI state
  const [showComps, setShowComps] = useState(true);
  const [showHistorical, setShowHistorical] = useState(true);

  // tRPC mutation for rental estimate
  const rentalizerMutation = trpc.rental.getEstimate.useMutation();

  // Handle property detection from Zillow/Redfin URL
  const handlePropertyDetected = useCallback((property: PropertyDetails) => {
    setDetectedProperty(property);
    setAddress(property.address);
    
    if (property.bedrooms) setBedrooms(property.bedrooms);
    if (property.bathrooms) setBathrooms(property.bathrooms);
    if (property.bedrooms) setAccommodates(property.bedrooms * 2);
    
    // Set purchase price if available
    if (property.price && property.priceType === 'sale') {
      setPurchasePrice(property.price);
    }
    
    toast.success(`Property detected: ${property.address}`, {
      description: property.source === 'zillow' ? 'From Zillow' : 'From Redfin'
    });
  }, []);

  // Handle address selection from Google Places
  const handleAddressSelect = useCallback((selectedAddress: string, placeId: string, details?: { zipCode?: string; city?: string; state?: string }) => {
    setAddress(selectedAddress);
    setDetectedProperty(null);
  }, []);

  // Run analysis
  const handleAnalyze = async () => {
    if (!address) {
      toast.error('Please enter a property address');
      return;
    }
    
    if (!purchasePrice || purchasePrice <= 0) {
      toast.error('Please enter a valid purchase price');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const result = await rentalizerMutation.mutateAsync({
        address,
        bedrooms,
        bathrooms,
        accommodates,
      });

      if (result.success && result.data) {
        const data = result.data;
        
        // Map RentalizerResponse to our AnalysisResult format
        setAnalysisResult({
          revenue: {
            projected: data.estimates.annual_revenue,
            low: data.estimates.annual_revenue_low,
            high: data.estimates.annual_revenue_high,
          },
          metrics: {
            adr: data.estimates.average_daily_rate,
            occupancy: data.estimates.occupancy_rate,
          },
          forecast: data.monthly_forecast || [],
          comparables: (data.comps || []).map((comp: any) => ({
            id: comp.airbnb_listing_id || String(Math.random()),
            title: comp.title || 'Comparable Property',
            bedrooms: comp.bedrooms || bedrooms,
            bathrooms: comp.bathrooms || bathrooms,
            accommodates: comp.accommodates || accommodates,
            revenue: comp.annual_revenue || 0,
            adr: comp.adr || 0,
            occupancy: comp.occupancy || 0,
            rating: comp.rating || 0,
            reviews: comp.reviews || 0,
            imageUrl: comp.image_url,
            airbnbUrl: comp.airbnb_url,
            distanceMeters: comp.distance_meters,
          })),
          historicalData: data.historical ? {
            summary: {
              monthly_pct_change: data.historical.summary.monthly_pct_change,
              yearly_pct_change: data.historical.summary.yearly_pct_change,
              trend: data.historical.summary.yearly_pct_change > 0 ? 'up' : data.historical.summary.yearly_pct_change < 0 ? 'down' : 'stable',
            },
            months: data.historical.metrics.map((m: any) => ({
              date: m.date,
              revenue: m.revenue_valuation,
              occupancy: 0,
              adr: 0,
            })),
          } : undefined,
          marketId: data.property.market_id,
        });

        // Store in property context for other tools
        setMyProperty({
          address,
          bedrooms,
          bathrooms,
          accommodates,
          monthlyRent: 0, // Not applicable for purchase
          // purchasePrice not stored in PropertyContext (it's for purchase analysis only)
        });

        toast.success('Analysis complete!');
      } else {
        toast.error(result.error || 'Failed to analyze property');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze property. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1e293b] to-[#0F172A]">
      {/* Header */}
      <header className="bg-[#0F172A]/80 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setLocation('/')}
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to Tools</span>
              </button>
              <div className="h-6 w-px bg-white/20" />
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A962] to-[#B8956A] flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">Investment Calculator</h1>
                  <p className="text-xs text-white/60">For Property Buyers</p>
                </div>
              </div>
            </div>
            
            {/* User info */}
            {isAuthenticated && user && (
              <div className="flex items-center gap-2 text-white/70">
                <span className="text-sm">{user.name}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Property Input Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#C9A962]/10 flex items-center justify-center">
              <Home className="w-6 h-6 text-[#C9A962]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#0F172A]">Property Details</h2>
              <p className="text-sm text-gray-500">Paste a Zillow or Redfin link, or enter address manually</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Smart Address Input */}
            <div>
              <SmartAddressInput
                value={address}
                onChange={setAddress}
                onPropertyDetected={handlePropertyDetected}
                onAddressSelect={handleAddressSelect}
                placeholder="Paste Zillow/Redfin URL or enter address..."
                label="Property Address"
                showPropertyCard={true}
              />
            </div>

            {/* Property Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Purchase Price */}
              <div className="col-span-2">
                <Label className="text-sm text-gray-600 mb-2 block">
                  Purchase Price <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C9A962]" />
                  <Input
                    type="number"
                    value={purchasePrice || ''}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    placeholder="Enter purchase price"
                    className="pl-10 h-12 text-lg border-2 border-gray-200 focus:border-[#C9A962] rounded-xl"
                  />
                </div>
                {detectedProperty?.price && detectedProperty.priceType === 'sale' && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Auto-filled from {detectedProperty.source}
                  </p>
                )}
              </div>

              {/* Bedrooms */}
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">Bedrooms</Label>
                <div className="relative">
                  <Bed className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={bedrooms}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBedrooms(val);
                      setAccommodates(val * 2);
                    }}
                    className="w-full pl-10 pr-4 h-12 border-2 border-gray-200 focus:border-[#C9A962] rounded-xl appearance-none cursor-pointer bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>{n} BR</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bathrooms */}
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">Bathrooms</Label>
                <div className="relative">
                  <Bath className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={bathrooms}
                    onChange={(e) => setBathrooms(Number(e.target.value))}
                    className="w-full pl-10 pr-4 h-12 border-2 border-gray-200 focus:border-[#C9A962] rounded-xl appearance-none cursor-pointer bg-white"
                  >
                    {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(n => (
                      <option key={n} value={n}>{n} BA</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Analyze Button */}
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !address || !purchasePrice}
              className="w-full h-14 bg-gradient-to-r from-[#C9A962] to-[#B8956A] hover:from-[#B8956A] hover:to-[#A78559] text-white font-semibold text-lg rounded-xl shadow-lg transition-all duration-300"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analyzing Property...
                </>
              ) : (
                <>
                  <Calculator className="w-5 h-5 mr-2" />
                  Analyze Investment
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Results Section */}
        {analysisResult && (
          <div className="space-y-8">
            {/* Revenue Projection Summary */}
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-[#0F172A]">Revenue Projection</h2>
                    <p className="text-sm text-gray-500">Based on {analysisResult.comparables.length} comparable properties</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                  <div className="text-sm text-green-700 mb-1">Annual Revenue</div>
                  <div className="text-2xl font-bold text-green-800">
                    {formatCurrency(analysisResult.revenue.projected)}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Range: {formatCurrency(analysisResult.revenue.low)} - {formatCurrency(analysisResult.revenue.high)}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">Monthly Revenue</div>
                  <div className="text-2xl font-bold text-gray-800">
                    {formatCurrency(analysisResult.revenue.projected / 12)}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">Avg Daily Rate</div>
                  <div className="text-2xl font-bold text-gray-800">
                    {formatCurrency(analysisResult.metrics.adr)}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">Occupancy Rate</div>
                  <div className="text-2xl font-bold text-gray-800">
                    {Math.round(analysisResult.metrics.occupancy * 100)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Loan Calculator */}
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#C9A962]/10 flex items-center justify-center">
                  <Landmark className="w-6 h-6 text-[#C9A962]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[#0F172A]">Financing & Investment Analysis</h2>
                  <p className="text-sm text-gray-500">Compare loan options and see your returns</p>
                </div>
              </div>

              <LoanCalculator
                purchasePrice={purchasePrice}
                projectedAnnualRevenue={analysisResult.revenue.projected}
                projectedOccupancy={analysisResult.metrics.occupancy}
                projectedADR={analysisResult.metrics.adr}
                onCalculationsChange={setLoanCalculations}
              />
            </div>

            {/* Comparable Properties */}
            {analysisResult.comparables.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <button
                  onClick={() => setShowComps(!showComps)}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Building className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-xl font-semibold text-[#0F172A]">Comparable Properties</h2>
                      <p className="text-sm text-gray-500">{analysisResult.comparables.length} similar properties in the area</p>
                    </div>
                  </div>
                  {showComps ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {showComps && (
                  <div className="p-6 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {analysisResult.comparables.slice(0, 9).map((comp) => (
                        <div key={comp.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          {comp.imageUrl && (
                            <img 
                              src={comp.imageUrl} 
                              alt={comp.title}
                              className="w-full h-32 object-cover rounded-lg mb-3"
                            />
                          )}
                          <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{comp.title}</h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                            <span>{comp.bedrooms} BR</span>
                            <span>•</span>
                            <span>{comp.bathrooms} BA</span>
                            {comp.rating > 0 && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                  {comp.rating.toFixed(1)}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-green-600 font-semibold">{formatCurrency(comp.revenue)}/yr</span>
                            {comp.airbnbUrl && (
                              <a 
                                href={comp.airbnbUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Historical Data */}
            {analysisResult.historicalData && analysisResult.historicalData.months.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <button
                  onClick={() => setShowHistorical(!showHistorical)}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-xl font-semibold text-[#0F172A]">Historical Performance</h2>
                      <p className="text-sm text-gray-500">12-month revenue and occupancy trends</p>
                    </div>
                  </div>
                  {showHistorical ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {showHistorical && (
                  <div className="p-6 pt-0">
                    <div className="space-y-4">
                      {/* Trend Summary */}
                      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                        <div className={`flex items-center gap-2 ${analysisResult.historicalData.summary.trend === 'up' ? 'text-green-600' : analysisResult.historicalData.summary.trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                          {analysisResult.historicalData.summary.trend === 'up' ? (
                            <TrendingUp className="w-5 h-5" />
                          ) : analysisResult.historicalData.summary.trend === 'down' ? (
                            <TrendingDown className="w-5 h-5" />
                          ) : (
                            <BarChart3 className="w-5 h-5" />
                          )}
                          <span className="font-medium">
                            {analysisResult.historicalData.summary.trend === 'up' ? 'Growing Market' : 
                             analysisResult.historicalData.summary.trend === 'down' ? 'Declining Market' : 'Stable Market'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {analysisResult.historicalData.summary.yearly_pct_change > 0 ? '+' : ''}
                          {analysisResult.historicalData.summary.yearly_pct_change.toFixed(1)}% YoY
                        </div>
                      </div>
                      
                      {/* Monthly Data Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 text-gray-500 font-medium">Month</th>
                              <th className="text-right py-2 px-3 text-gray-500 font-medium">Revenue</th>
                              <th className="text-right py-2 px-3 text-gray-500 font-medium">ADR</th>
                              <th className="text-right py-2 px-3 text-gray-500 font-medium">Occupancy</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysisResult.historicalData.months.slice(-6).map((month, idx) => (
                              <tr key={idx} className="border-b border-gray-100">
                                <td className="py-2 px-3 text-gray-900">{month.date}</td>
                                <td className="py-2 px-3 text-right text-green-600 font-medium">{formatCurrency(month.revenue)}</td>
                                <td className="py-2 px-3 text-right text-gray-700">{formatCurrency(month.adr)}</td>
                                <td className="py-2 px-3 text-right text-gray-700">{Math.round(month.occupancy * 100)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Investment Summary Card */}
            {loanCalculations && (
              <div className="bg-gradient-to-br from-[#0F172A] to-[#1e293b] rounded-2xl shadow-xl p-6 md:p-8 text-white">
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Star className="w-5 h-5 text-[#C9A962]" />
                  Investment Summary
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-sm text-white/60 mb-1">Total Investment</div>
                    <div className="text-2xl font-bold text-[#C9A962]">
                      {formatCurrency(loanCalculations.totalCashNeeded)}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      Down payment + closing costs
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-white/60 mb-1">Annual Cash Flow</div>
                    <div className={`text-2xl font-bold ${loanCalculations.annualCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {loanCalculations.annualCashFlow >= 0 ? '+' : ''}{formatCurrency(loanCalculations.annualCashFlow)}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      After all expenses & debt
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-white/60 mb-1">Cash-on-Cash Return</div>
                    <div className={`text-2xl font-bold ${loanCalculations.cashOnCash >= 8 ? 'text-green-400' : loanCalculations.cashOnCash >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {loanCalculations.cashOnCash.toFixed(1)}%
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      {loanCalculations.cashOnCash >= 8 ? 'Excellent' : loanCalculations.cashOnCash >= 5 ? 'Good' : 'Below target'}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-white/60 mb-1">Years to Recoup</div>
                    <div className="text-2xl font-bold text-white">
                      {loanCalculations.annualCashFlow > 0 
                        ? (loanCalculations.totalCashNeeded / loanCalculations.annualCashFlow).toFixed(1)
                        : '∞'
                      }
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      To recover initial investment
                    </div>
                  </div>
                </div>

                {/* Quick verdict */}
                <div className="mt-6 pt-6 border-t border-white/10">
                  <div className="flex items-center gap-3">
                    {loanCalculations.cashOnCash >= 8 && loanCalculations.dscr >= 1.25 ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-green-400" />
                        <span className="text-green-400 font-medium">
                          Strong investment potential with {loanCalculations.cashOnCash.toFixed(1)}% cash-on-cash return
                        </span>
                      </>
                    ) : loanCalculations.cashOnCash >= 5 && loanCalculations.dscr >= 1.0 ? (
                      <>
                        <AlertCircle className="w-6 h-6 text-yellow-400" />
                        <span className="text-yellow-400 font-medium">
                          Moderate returns - consider negotiating price or exploring different financing
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-6 h-6 text-red-400" />
                        <span className="text-red-400 font-medium">
                          Returns below target - may need lower purchase price or better terms
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!analysisResult && !isAnalyzing && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#C9A962]/20 flex items-center justify-center mx-auto mb-6">
              <Calculator className="w-10 h-10 text-[#C9A962]" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Ready to Analyze</h3>
            <p className="text-white/60 max-w-md mx-auto">
              Enter a property address and purchase price above to see revenue projections, 
              financing options, and investment metrics.
            </p>
            <div className="mt-6 flex items-center justify-center gap-4 text-sm text-white/40">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                <span>Paste Zillow/Redfin links</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-white/20" />
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4" />
                <span>Compare loan types</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-white/20" />
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>See ROI metrics</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#0F172A]/80 backdrop-blur-sm border-t border-white/10 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-white/40 text-sm">
          <p>Investment Calculator by Coach Inayah • Data powered by AirDNA</p>
        </div>
      </footer>
    </div>
  );
}
