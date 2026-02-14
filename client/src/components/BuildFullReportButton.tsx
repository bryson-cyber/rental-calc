/**
 * BuildFullReportButton Component
 * 
 * A button that collects all available analysis data from the current session
 * and creates a comprehensive shareable "Full Property Report" combining:
 * - Revenue projections
 * - Market analysis
 * - Comparable properties
 * - Rental arbitrage scenario (if monthly rent provided)
 * - Purchase investment scenario (if purchase price provided)
 * - AI executive summary
 * 
 * Supports both rental arbitrage (LeadMagnet) and purchase (InvestmentCalculator) flows.
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Loader2, Copy, Check, ExternalLink, DollarSign, Shield, Send } from 'lucide-react';
import type { FullReportData } from './FullPropertyReport';
import { lazy, Suspense } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';

const SendToSlackModal = lazy(() => import('./SendToSlackModal'));

interface BuildFullReportButtonProps {
  // Core property data
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  latitude?: number;
  longitude?: number;
  
  // Revenue data
  annualRevenue: number;
  monthlyRevenue: number;
  nightlyRate: number;
  occupancyRate: number; // 0-1 or 0-100
  revenueLow?: number;
  revenueHigh?: number;
  
  // Monthly forecast
  monthlyForecast?: Array<{
    month: string;
    revenue: number;
    occupancy: number;
    adr?: number;
  }>;
  
  // Comparables
  comps?: any[];
  sameBedComps?: any[];
  
  // Market data
  marketData?: {
    name: string;
    metrics: any;
    listing_count: number;
  };
  
  // Bedroom performance
  bedroomPerformance?: any[];
  
  // Revenue percentiles
  revenuePercentiles?: any;
  
  // Historical data
  historicalData?: any;
  
  // Rental arbitrage scenario
  monthlyRent?: number;
  
  // Purchase scenario
  purchasePrice?: number;
  downPaymentPercent?: number;
  interestRate?: number;
  loanTerm?: number;
  loanType?: string;
  
  // AI summary (if already generated)
  aiSummary?: string;
  
  // Styling
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function BuildFullReportButton({
  address,
  city,
  state,
  zipCode,
  bedrooms,
  bathrooms,
  accommodates,
  latitude,
  longitude,
  annualRevenue,
  monthlyRevenue,
  nightlyRate,
  occupancyRate,
  revenueLow,
  revenueHigh,
  monthlyForecast,
  comps,
  sameBedComps,
  marketData,
  bedroomPerformance,
  revenuePercentiles,
  historicalData,
  monthlyRent,
  purchasePrice,
  downPaymentPercent,
  interestRate,
  loanTerm,
  loanType,
  aiSummary,
  className,
  variant = 'default',
  size = 'default',
}: BuildFullReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSlackModal, setShowSlackModal] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';
  
  // Optional fields for the dialog
  const [clientName, setClientName] = useState('');
  const [includeRental, setIncludeRental] = useState(!!monthlyRent);
  const [includePurchase, setIncludePurchase] = useState(!!purchasePrice);
  const [dialogMonthlyRent, setDialogMonthlyRent] = useState(monthlyRent?.toString() || '');
  const [dialogPurchasePrice, setDialogPurchasePrice] = useState(purchasePrice?.toString() || '');
  
  const createReport = trpc.sharedReports.create.useMutation();
  
  // Rate limit status
  const { data: rateLimitData } = trpc.usage.reportLimit.useQuery(undefined, {
    enabled: open,
    staleTime: 30_000,
  });

  const handleGenerate = async () => {
    setGenerating(true);
    
    try {
      // Normalize occupancy to 0-1
      const occNorm = occupancyRate > 1 ? occupancyRate / 100 : occupancyRate;
      
      // Build the full report data
      const fullReportData: FullReportData = {
        property: {
          address,
          city: city || (() => {
            // Handle addresses like "123 Main St Richardson, TX 75082" (single comma)
            const parts = address.split(',');
            if (parts.length >= 3) return parts[1]?.trim();
            // Single comma: the state part is after comma, city is the last word before comma
            const beforeComma = parts[0]?.trim() || '';
            const words = beforeComma.split(/\s+/);
            // For "2680 Carnation Dr Richardson" -> "Richardson"
            return words.length > 2 ? words[words.length - 1] : 'Unknown';
          })(),
          state: state || (() => {
            const parts = address.split(',');
            const lastPart = parts[parts.length - 1]?.trim() || '';
            // Extract state abbreviation (2 uppercase letters)
            const stateMatch = lastPart.match(/\b([A-Z]{2})\b/);
            return stateMatch ? stateMatch[1] : lastPart.split(' ')[0] || '';
          })(),
          zipCode: zipCode || address.match(/\d{5}/)?.[0] || '',
          bedrooms,
          bathrooms,
          accommodates,
          latitude,
          longitude,
        },
        revenue_estimate: {
          annual: annualRevenue,
          monthly: monthlyRevenue || Math.round(annualRevenue / 12),
          nightly: nightlyRate,
          occupancy: occNorm,
          range: revenueLow && revenueHigh ? { low: revenueLow, high: revenueHigh } : undefined,
        },
        monthly_forecast: monthlyForecast || [],
        comps: (comps || []).map((c: any) => ({
          id: c.id || c.airbnb_listing_id || String(Math.random()),
          title: c.title || `${c.bedrooms || bedrooms}BR Property`,
          airbnb_url: c.airbnb_url || c.airbnbUrl,
          image_url: c.image_url || c.imageUrl,
          bedrooms: c.bedrooms || bedrooms,
          bathrooms: c.bathrooms || bathrooms,
          accommodates: c.accommodates,
          property_type: c.property_type,
          rating: c.rating,
          reviews: c.reviews || 0,
          annual_revenue: c.annual_revenue || c.revenue || 0,
          adr: c.adr || 0,
          occupancy: c.occupancy || 0,
          superhost: c.superhost,
          distance_meters: c.distance_meters || c.distanceMeters,
          latitude: c.latitude,
          longitude: c.longitude,
        })),
        same_bedroom_comps: sameBedComps ? sameBedComps.map((c: any) => ({
          id: c.id || c.airbnb_listing_id || String(Math.random()),
          title: c.title || `${c.bedrooms || bedrooms}BR Property`,
          airbnb_url: c.airbnb_url || c.airbnbUrl,
          image_url: c.image_url || c.imageUrl,
          bedrooms: c.bedrooms || bedrooms,
          bathrooms: c.bathrooms || bathrooms,
          accommodates: c.accommodates,
          property_type: c.property_type,
          rating: c.rating,
          reviews: c.reviews || 0,
          annual_revenue: c.annual_revenue || c.revenue || 0,
          adr: c.adr || 0,
          occupancy: c.occupancy || 0,
          superhost: c.superhost,
          distance_meters: c.distance_meters || c.distanceMeters,
          latitude: c.latitude,
          longitude: c.longitude,
        })) : undefined,
        market_data: marketData || {
          name: city || 'Local Market',
          metrics: {
            occupancy: occNorm,
            adr: nightlyRate,
            revenue: annualRevenue,
            revpar: nightlyRate * occNorm,
            active_listings: 0,
          },
          listing_count: 0,
        },
        bedroom_performance: bedroomPerformance || [],
        revenue_percentiles: revenuePercentiles,
        historical_data: historicalData,
        generated_at: new Date().toISOString(),
        prepared_for: clientName || undefined,
      };
      
      // Add rental arbitrage scenario if selected
      if (includeRental && dialogMonthlyRent) {
        fullReportData.rental_arbitrage = {
          monthlyRent: parseFloat(dialogMonthlyRent),
          startupCosts: 8000 + bedrooms * 4000,
        };
      }
      
      // Add purchase scenario if selected
      if (includePurchase && dialogPurchasePrice) {
        fullReportData.purchase = {
          purchasePrice: parseFloat(dialogPurchasePrice),
          downPaymentPercent: downPaymentPercent || 20,
          interestRate: interestRate || 7,
          loanTerm: loanTerm || 30,
          loanType: (loanType as any) || 'conventional',
        };
      }
      
      // Add AI summary if available
      if (aiSummary) {
        fullReportData.ai_summary = aiSummary;
      }
      
      // Create the shared report
      const result = await createReport.mutateAsync({
        reportType: 'full',
        address,
        latitude,
        longitude,
        bedrooms,
        bathrooms,
        accommodates,
        reportData: fullReportData,
        creatorName: clientName || undefined,
      });
      
      if (result.success && result.shareId) {
        const url = `${window.location.origin}/report/${result.shareId}`;
        setShareUrl(url);
        setShareId(result.shareId);
        toast.success('Full report created! Share the link with your client.');
      } else {
        toast.error('Failed to create report. Please try again.');
      }
    } catch (error) {
      console.error('Error creating full report:', error);
      toast.error('Failed to create report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setShareUrl(null); setCopied(false); } }}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={`gap-2 ${className || ''}`}>
          <FileText className="w-4 h-4" />
          Build Full Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        {!shareUrl ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-sans text-xl">Build Full Property Report</DialogTitle>
              <DialogDescription>
                Generate a comprehensive, shareable report combining all analysis data for <strong>{address}</strong>.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-5 py-4">
              {/* Client Name */}
              <div>
                <Label htmlFor="clientName" className="text-sm font-medium">
                  Client Name <span className="text-[#1A1A1A]/40">(optional)</span>
                </Label>
                <Input
                  id="clientName"
                  placeholder="e.g., John Smith"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="mt-1.5"
                />
                <p className="text-xs text-[#1A1A1A]/40 mt-1">Shown as "Prepared for" on the report</p>
              </div>
              
              {/* Investment Scenarios */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Investment Scenarios</Label>
                
                {/* Rental Arbitrage */}
                <div className={`rounded-xl border p-4 transition-colors ${includeRental ? 'border-[#C9A962] bg-[#C9A962]/5' : 'border-[#1A1A1A]/10'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeRental}
                      onChange={(e) => setIncludeRental(e.target.checked)}
                      className="w-4 h-4 rounded border-[#1A1A1A]/20 text-[#C9A962] focus:ring-[#C9A962]"
                    />
                    <div>
                      <p className="font-medium text-sm text-[#1A1A1A]">Rental Arbitrage</p>
                      <p className="text-xs text-[#1A1A1A]/50">Rent the property, sublet on Airbnb</p>
                    </div>
                  </label>
                  {includeRental && (
                    <div className="mt-3 ml-7">
                      <Label htmlFor="monthlyRent" className="text-xs text-[#1A1A1A]/60">Monthly Rent</Label>
                      <div className="relative mt-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A1A]/40" />
                        <Input
                          id="monthlyRent"
                          type="number"
                          placeholder="2,500"
                          value={dialogMonthlyRent}
                          onChange={(e) => setDialogMonthlyRent(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Purchase */}
                <div className={`rounded-xl border p-4 transition-colors ${includePurchase ? 'border-[#C9A962] bg-[#C9A962]/5' : 'border-[#1A1A1A]/10'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includePurchase}
                      onChange={(e) => setIncludePurchase(e.target.checked)}
                      className="w-4 h-4 rounded border-[#1A1A1A]/20 text-[#C9A962] focus:ring-[#C9A962]"
                    />
                    <div>
                      <p className="font-medium text-sm text-[#1A1A1A]">Purchase Investment</p>
                      <p className="text-xs text-[#1A1A1A]/50">Buy the property as an investment</p>
                    </div>
                  </label>
                  {includePurchase && (
                    <div className="mt-3 ml-7">
                      <Label htmlFor="purchasePrice" className="text-xs text-[#1A1A1A]/60">Purchase Price</Label>
                      <div className="relative mt-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A1A]/40" />
                        <Input
                          id="purchasePrice"
                          type="number"
                          placeholder="350,000"
                          value={dialogPurchasePrice}
                          onChange={(e) => setDialogPurchasePrice(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Summary of what's included */}
              <div className="bg-[#0F172A]/5 rounded-xl p-4">
                <p className="text-xs font-medium text-[#1A1A1A]/70 uppercase tracking-wider mb-2">Report will include:</p>
                <ul className="text-xs text-[#1A1A1A]/60 space-y-1">
                  <li>• Property overview with map & Street View</li>
                  <li>• Revenue projections & monthly forecast</li>
                  <li>• Market analysis & bedroom performance</li>
                  <li>• {(sameBedComps || comps || []).length} comparable properties with map</li>
                  {includeRental && <li>• Rental arbitrage break-even analysis</li>}
                  {includePurchase && <li>• Purchase investment analysis (cap rate, CoC, DSCR)</li>}
                  <li>• Executive summary</li>
                </ul>
              </div>
            </div>
            
            {/* Reports Remaining Badge */}
            {rateLimitData && !rateLimitData.isExempt && rateLimitData.loggedIn && (
              <div className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-sans ${
                rateLimitData.remaining === 0
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : rateLimitData.remaining <= 2
                    ? 'bg-amber-50 border border-amber-200 text-amber-700'
                    : 'bg-[#0F172A]/5 border border-[#E8E4DC] text-[#6B7280]'
              }`}>
                <div className="flex items-center gap-1">
                  {Array.from({ length: rateLimitData.limit }, (_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        i < rateLimitData.used
                          ? rateLimitData.remaining === 0 ? 'bg-red-400' : 'bg-[#C9A962]'
                          : 'bg-[#E8E4DC]'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium">
                  {rateLimitData.remaining === 0
                    ? 'Daily limit reached'
                    : `${rateLimitData.remaining}/${rateLimitData.limit} reports today`
                  }
                </span>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={handleGenerate}
                disabled={generating || (!includeRental && !includePurchase) || (rateLimitData?.loggedIn && rateLimitData?.remaining === 0)}
                className="gap-2 bg-[#C9A962] hover:bg-[#b8963f] text-white"
              >
                {rateLimitData?.loggedIn && rateLimitData?.remaining === 0 ? (
                  <>
                    <Shield className="w-4 h-4" />
                    Daily Limit Reached
                  </>
                ) : generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Generate Report
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-sans text-xl">Report Ready!</DialogTitle>
              <DialogDescription>
                Your full property report has been generated. Share this link with your client.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4 space-y-4">
              <div className="bg-[#0F172A]/5 rounded-xl p-4">
                <p className="text-xs text-[#1A1A1A]/50 mb-2">Shareable Link</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 bg-white border border-[#1A1A1A]/10 rounded-lg px-3 py-2 text-sm text-[#1A1A1A] font-mono"
                  />
                  <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 flex-shrink-0">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => window.open(shareUrl!, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                  Preview Report
                </Button>
                <Button
                  className="flex-1 gap-2 bg-[#C9A962] hover:bg-[#b8963f] text-white"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>
              
              {/* Send to Slack — admin only */}
              {isAdmin && shareId && (
                <Button
                  variant="outline"
                  className="w-full gap-2 mt-2 border-[#4A154B] text-[#4A154B] hover:bg-[#4A154B]/5"
                  onClick={() => setShowSlackModal(true)}
                >
                  <Send className="w-4 h-4" />
                  Send to Slack Channel
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    
    {/* Send to Slack Modal */}
    {isAdmin && shareId && (
      <Suspense fallback={null}>
        <SendToSlackModal
          open={showSlackModal}
          onOpenChange={setShowSlackModal}
          shareCode={shareId}
          reportSource="shared"
          address={address}
          reportData={{
            bedrooms,
            bathrooms,
            annualRevenue,
            occupancyRate,
            averageDailyRate: nightlyRate,
            reportType: 'property',
          }}
        />
      </Suspense>
    )}
    </>
  );
}
