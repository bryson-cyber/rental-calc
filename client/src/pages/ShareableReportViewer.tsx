/**
 * Universal Shareable Report Viewer
 * 
 * For "validator" reports, renders the EXACT same FullPropertyReport component
 * that authenticated users see. For other report types, renders a simplified view.
 */

import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import { SEOHead, createWebPageSchema } from '@/components/SEOHead';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import FullPropertyReport from '@/components/FullPropertyReport';
import type { FullReportData } from '@/components/FullPropertyReport';
import {
  Loader2,
  ArrowLeft,
  Share2,
  Copy,
  MessageSquare,
  Mail,
  XCircle,
  DollarSign,
  Percent,
  Home,
  TrendingUp,
  Building,
  MapPin,
  Star,
  Calendar,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  FileText,
  BedDouble,
  Users,
  Eye,
} from 'lucide-react';

/**
 * Transform validator report data (from universal_shareable_reports) into
 * the FullReportData shape that FullPropertyReport expects.
 */
function transformValidatorToFullReportData(
  reportData: any,
  dbRecord: any
): FullReportData {
  // Parse address into components
  const fullAddress = dbRecord.address || '';
  const addressParts = fullAddress.split(',').map((s: string) => s.trim());
  const streetAddress = addressParts[0] || fullAddress;
  let city = dbRecord.city || '';
  let state = dbRecord.state || '';
  let zipCode = '';

  // Try to parse city/state/zip from address if not in DB
  if (!city && addressParts.length >= 2) {
    city = addressParts[1] || '';
  }
  if (!state && addressParts.length >= 3) {
    const stateZip = addressParts[2] || '';
    const stateZipParts = stateZip.split(' ').filter(Boolean);
    state = stateZipParts[0] || '';
    zipCode = stateZipParts[1] || '';
  }

  const bedrooms = dbRecord.bedrooms || 2;
  const bathrooms = parseFloat(dbRecord.bathrooms) || 1;
  const monthlyRent = dbRecord.monthlyRent || 0;

  // Revenue mapping
  const revenue = reportData.revenue || {};
  const metrics = reportData.metrics || {};
  const projected = revenue.projected || 0;
  const occupancy = metrics.occupancy || 0;
  const adr = metrics.adr || 0;

  // Build property info
  const property = {
    address: fullAddress,
    city,
    state,
    zipCode,
    bedrooms,
    bathrooms,
    accommodates: bedrooms * 2, // estimate
    latitude: dbRecord.latitude ? parseFloat(dbRecord.latitude) : undefined,
    longitude: dbRecord.longitude ? parseFloat(dbRecord.longitude) : undefined,
  };

  // Build revenue estimate
  const revenue_estimate = {
    annual: projected,
    monthly: Math.round(projected / 12),
    nightly: adr,
    occupancy: occupancy > 1 ? occupancy / 100 : occupancy,
    range: revenue.low && revenue.high ? { low: revenue.low, high: revenue.high } : undefined,
  };

  // Build monthly forecast
  const monthly_forecast = (reportData.forecast || []).map((f: any) => ({
    month: f.month,
    revenue: f.revenue,
    occupancy: f.occupancy > 1 ? f.occupancy : f.occupancy * 100,
    adr: f.adr,
  }));

  // Build comps - transform from validator format to FullPropertyReport format
  const comps = (reportData.comparables || []).map((c: any) => ({
    id: c.id || String(Math.random()),
    title: c.title || 'Comparable Property',
    airbnb_url: c.airbnbUrl,
    image_url: c.imageUrl || (c.images && c.images[0]) || undefined,
    bedrooms: c.bedrooms || bedrooms,
    bathrooms: c.bathrooms || bathrooms,
    accommodates: c.accommodates,
    rating: c.rating ?? null,
    reviews: c.reviews || 0,
    annual_revenue: c.revenue || 0,
    adr: c.adr || 0,
    occupancy: c.occupancy || 0,
    latitude: c.latitude,
    longitude: c.longitude,
    airbnb_listing_id: c.id,
  }));

  // Build bedroom performance
  const bedroom_performance = (reportData.bedroomPerformance || []).map((bp: any) => ({
    bedrooms: bp.bedrooms,
    occupancy: bp.occupancy,
    adr: bp.adr,
    revenue: bp.revenue,
    listing_count: bp.listing_count,
  }));

  // Build revenue percentiles
  const revenue_percentiles = reportData.revenuePercentiles || undefined;

  // Build market data from rawMarketData or marketInsights
  let market_data = undefined;
  if (reportData.rawMarketData) {
    const raw = reportData.rawMarketData;
    market_data = {
      name: raw.name || 'Local Market',
      metrics: {
        occupancy: raw.metrics?.occupancy || 0,
        adr: raw.metrics?.adr || 0,
        revenue: raw.metrics?.revenue || 0,
        revpar: raw.metrics?.revpar,
        active_listings: raw.metrics?.active_listings || raw.listing_count || 0,
        market_score: raw.metrics?.market_score,
      },
      listing_count: raw.listing_count || raw.metrics?.active_listings || 0,
    };
  }

  // Build historical data
  let historical_data = undefined;
  if (reportData.historicalData) {
    historical_data = {
      summary: reportData.historicalData.summary || {},
      months: reportData.historicalData.months || [],
    };
  }

  // Build rental arbitrage scenario
  let rental_arbitrage = undefined;
  if (monthlyRent > 0) {
    rental_arbitrage = {
      monthlyRent,
      startupCosts: 5000, // reasonable default
    };
  }

  return {
    property,
    revenue_estimate,
    monthly_forecast,
    comps,
    same_bedroom_comps: comps.filter((c: any) => c.bedrooms === bedrooms),
    market_data,
    bedroom_performance,
    revenue_percentiles,
    rental_arbitrage,
    historical_data,
    generated_at: dbRecord.createdAt ? new Date(dbRecord.createdAt).toISOString() : new Date().toISOString(),
  };
}

/**
 * Transform revenue report data (from universal_shareable_reports) into
 * the FullReportData shape that FullPropertyReport expects.
 * Revenue reports use: estimates, comps, market, monthly_forecast
 */
function transformRevenueToFullReportData(
  reportData: any,
  dbRecord: any
): FullReportData {
  // Parse address into components
  const fullAddress = dbRecord.address || '';
  const addressParts = fullAddress.split(',').map((s: string) => s.trim());
  let city = dbRecord.city || '';
  let state = dbRecord.state || '';
  let zipCode = '';

  if (!city && addressParts.length >= 2) {
    city = addressParts[1] || '';
  }
  if (!state && addressParts.length >= 3) {
    const stateZip = addressParts[2] || '';
    const stateZipParts = stateZip.split(' ').filter(Boolean);
    state = stateZipParts[0] || '';
    zipCode = stateZipParts[1] || '';
  }

  const bedrooms = dbRecord.bedrooms || 2;
  const bathrooms = parseFloat(dbRecord.bathrooms) || 1;

  // Revenue estimates mapping
  const est = reportData.estimates || {};
  const annualRevenue = est.annual_revenue || 0;
  const adr = est.average_daily_rate || 0;
  const occupancy = est.occupancy_rate || 0;

  const property = {
    address: fullAddress,
    city,
    state,
    zipCode,
    bedrooms,
    bathrooms,
    accommodates: bedrooms * 2,
    latitude: dbRecord.latitude ? parseFloat(dbRecord.latitude) : undefined,
    longitude: dbRecord.longitude ? parseFloat(dbRecord.longitude) : undefined,
  };

  const revenue_estimate = {
    annual: annualRevenue,
    monthly: Math.round(annualRevenue / 12),
    nightly: adr,
    occupancy: occupancy > 1 ? occupancy / 100 : occupancy,
    range: est.annual_revenue_low && est.annual_revenue_high
      ? { low: est.annual_revenue_low, high: est.annual_revenue_high }
      : undefined,
  };

  // Monthly forecast
  const monthly_forecast = (reportData.monthly_forecast || []).map((f: any) => ({
    month: f.month,
    revenue: f.revenue,
    occupancy: f.occupancy != null ? (f.occupancy > 1 ? f.occupancy : f.occupancy * 100) : undefined,
    adr: f.adr,
  }));

  // Comps - revenue reports already use the FullPropertyReport field names
  const comps = (reportData.comps || []).map((c: any) => ({
    id: c.id || String(Math.random()),
    title: c.title || 'Comparable Property',
    airbnb_url: c.airbnb_url || c.airbnbUrl,
    image_url: c.image_url || c.imageUrl || (c.images && c.images[0]) || undefined,
    bedrooms: c.bedrooms || bedrooms,
    bathrooms: c.bathrooms || bathrooms,
    accommodates: c.accommodates,
    property_type: c.property_type,
    rating: c.rating ?? null,
    reviews: c.reviews || 0,
    annual_revenue: c.annual_revenue || c.revenue || 0,
    adr: c.adr || 0,
    occupancy: c.occupancy || 0,
    superhost: c.superhost,
    distance_meters: c.distance_meters,
    latitude: c.latitude,
    longitude: c.longitude,
    airbnb_listing_id: c.airbnb_listing_id || c.id,
  }));

  // Market data
  let market_data = undefined;
  if (reportData.market) {
    const mkt = reportData.market;
    market_data = {
      name: mkt.name || 'Local Market',
      metrics: {
        occupancy: mkt.metrics?.occupancy || 0,
        adr: mkt.metrics?.adr || 0,
        revenue: mkt.metrics?.revenue || 0,
        revpar: mkt.metrics?.revpar,
        active_listings: mkt.metrics?.active_listings || mkt.listing_count || 0,
        market_score: mkt.metrics?.market_score,
      },
      listing_count: mkt.listing_count || mkt.metrics?.active_listings || 0,
    };
  }

  // Historical data from market
  let historical_data = undefined;
  if (reportData.market?.historical) {
    historical_data = {
      summary: reportData.market.historical.summary || {},
      months: reportData.market.historical.months || [],
    };
  }

  // Bedroom performance from market
  const bedroom_performance = (reportData.market?.bedroom_performance || []).map((bp: any) => ({
    bedrooms: bp.bedrooms,
    occupancy: bp.occupancy,
    adr: bp.adr,
    revenue: bp.revenue,
    listing_count: bp.listing_count,
  }));

  // Revenue percentiles from market
  const revenue_percentiles = reportData.market?.revenue_percentiles || undefined;

  return {
    property,
    revenue_estimate,
    monthly_forecast,
    comps,
    same_bedroom_comps: comps.filter((c: any) => c.bedrooms === bedrooms),
    market_data,
    bedroom_performance,
    revenue_percentiles,
    historical_data,
    generated_at: dbRecord.createdAt ? new Date(dbRecord.createdAt).toISOString() : new Date().toISOString(),
  };
}

// Report type configurations for non-validator types
const reportTypeConfig = {
  revenue: {
    title: 'Revenue Analysis',
    icon: DollarSign,
    color: 'text-[#C9A962]',
    bg: 'bg-[#C9A962]/10',
    gradient: 'from-[#0F172A] to-[#1e293b]',
  },
  validator: {
    title: 'Property Validation',
    icon: CheckCircle2,
    color: 'text-[#C9A962]',
    bg: 'bg-[#C9A962]/10',
    gradient: 'from-[#0F172A] to-[#1e293b]',
  },
  market: {
    title: 'Market Analysis',
    icon: BarChart3,
    color: 'text-[#C9A962]',
    bg: 'bg-[#C9A962]/10',
    gradient: 'from-[#0F172A] to-[#1e293b]',
  },
  ai_advisor: {
    title: 'AI Advisor Report',
    icon: Star,
    color: 'text-[#C9A962]',
    bg: 'bg-[#C9A962]/10',
    gradient: 'from-[#0F172A] to-[#1e293b]',
  },
  listings: {
    title: 'Listings Report',
    icon: Building,
    color: 'text-[#C9A962]',
    bg: 'bg-[#C9A962]/10',
    gradient: 'from-[#0F172A] to-[#1e293b]',
  },
  comparison: {
    title: 'Property Comparison',
    icon: TrendingUp,
    color: 'text-[#C9A962]',
    bg: 'bg-[#C9A962]/10',
    gradient: 'from-[#0F172A] to-[#1e293b]',
  },
  map: {
    title: 'Map View Report',
    icon: MapPin,
    color: 'text-[#C9A962]',
    bg: 'bg-[#C9A962]/10',
    gradient: 'from-[#0F172A] to-[#1e293b]',
  },
  regulation: {
    title: 'Regulation Check',
    icon: FileText,
    color: 'text-[#C9A962]',
    bg: 'bg-[#C9A962]/10',
    gradient: 'from-[#0F172A] to-[#1e293b]',
  },
};

export default function ShareableReportViewer() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [, setLocation] = useLocation();
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const { data, isLoading, error } = trpc.shareableReports.get.useQuery(
    { shareCode: shareCode || '' },
    { enabled: !!shareCode }
  );

  const sendNotificationsMutation = trpc.shareableReports.sendNotifications.useMutation();

  const handleCopyLink = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  const handleSendSMS = async () => {
    if (!phoneNumber || !shareCode || !data?.data) return;
    setIsSendingSMS(true);
    try {
      const result = await sendNotificationsMutation.mutateAsync({
        shareCode,
        reportType: data.data.reportType as any,
        phone: phoneNumber,
        city: data.data.city || undefined,
        state: data.data.state || undefined,
        address: data.data.address || undefined,
        title: data.data.title || undefined,
      });
      if (result.success && result.notifications?.sms?.success) {
        toast.success('SMS sent successfully!');
        setPhoneNumber('');
      } else {
        toast.error('Failed to send SMS');
      }
    } catch (err) {
      toast.error('Failed to send SMS');
    }
    setIsSendingSMS(false);
  };

  const handleSendEmail = async () => {
    if (!email || !shareCode || !data?.data) return;
    setIsSendingEmail(true);
    try {
      const result = await sendNotificationsMutation.mutateAsync({
        shareCode,
        reportType: data.data.reportType as any,
        email,
        city: data.data.city || undefined,
        state: data.data.state || undefined,
        address: data.data.address || undefined,
        title: data.data.title || undefined,
      });
      if (result.success && result.notifications?.email?.success) {
        toast.success('Email sent successfully!');
        setEmail('');
      } else {
        toast.error('Failed to send email');
      }
    } catch (err) {
      toast.error('Failed to send email');
    }
    setIsSendingEmail(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.success || !data?.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Not Found</h1>
          <p className="text-gray-600 mb-6">
            This report link may have expired or doesn't exist.
          </p>
          <Button onClick={() => setLocation('/')} className="bg-amber-600 hover:bg-amber-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  const report = data.data;
  const reportData = report.reportData as any;

  // =====================================================
  // VALIDATOR & REVENUE REPORTS: Render the EXACT same
  // FullPropertyReport component that authenticated users see
  // =====================================================
  if ((report.reportType === 'validator' || report.reportType === 'revenue') && reportData) {
    const fullReportData = report.reportType === 'validator'
      ? transformValidatorToFullReportData(reportData, report)
      : transformRevenueToFullReportData(reportData, report);

    const location = report.address ||
      (report.city && report.state ? `${report.city}, ${report.state}` : report.marketName || 'Unknown Location');
    const seoTitle = `Property Analysis - ${location}`;
    const seoDescription = `Full property investment analysis for ${location}. Shared via Coach Inayah Turnkey Tool.`;

    return (
      <>
        <SEOHead
          title={seoTitle}
          description={seoDescription}
          canonicalPath={`/share/${shareCode}`}
          noIndex={true}
          structuredData={createWebPageSchema({
            name: seoTitle,
            description: seoDescription,
            url: `/share/${shareCode}`
          })}
        />
        <FullPropertyReport
          data={fullReportData}
          onBack={() => setLocation('/')}
          isSharedView={true}
        />
      </>
    );
  }

  // =====================================================
  // NON-VALIDATOR REPORTS: Simplified viewer (legacy)
  // =====================================================
  const config = reportTypeConfig[report.reportType as keyof typeof reportTypeConfig] || reportTypeConfig.revenue;
  const ReportIcon = config.icon;

  // Format currency
  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value: number | string | null | undefined) => {
    if (!value) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num > 1) return `${num.toFixed(0)}%`;
    return `${(num * 100).toFixed(0)}%`;
  };

  // Get location string
  const location = report.address || 
    (report.city && report.state ? `${report.city}, ${report.state}` : report.marketName || 'Unknown Location');

  // Dynamic SEO based on report data
  const seoTitle = `${config.title} - ${location}`;
  const seoDescription = `View the ${config.title.toLowerCase()} for ${location}. Shared via Coach Inayah Turnkey Tool.`;

  return (
    <>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonicalPath={`/share/${shareCode}`}
        noIndex={true}
        structuredData={createWebPageSchema({
          name: seoTitle,
          description: seoDescription,
          url: `/share/${shareCode}`
        })}
      />
      <div className="min-h-screen bg-gradient-to-b from-[#FFFBF5] to-white">
      {/* Header - Coach Inayah Branding */}
      <header className="bg-[#0F172A] text-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setLocation('/')}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Tools</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#C9A962] font-serif font-semibold hidden sm:block">Coach Inayah</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowShareOptions(!showShareOptions)}
              className="gap-2 border-[#C9A962]/50 text-[#C9A962] hover:bg-[#C9A962]/10 hover:text-[#C9A962]"
            >
              <Share2 className="w-4 h-4" />
              Share Report
            </Button>
          </div>
        </div>
      </header>

      {/* Share Options Panel */}
      {showShareOptions && (
        <div className="bg-[#0F172A]/5 border-b border-[#C9A962]/20 py-4">
          <div className="max-w-4xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Copy Link */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyLink} className="flex-1 gap-2">
                  <Copy className="w-4 h-4" />
                  Copy Link
                </Button>
              </div>
              
              {/* Send SMS */}
              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSendSMS}
                  disabled={!phoneNumber || isSendingSMS}
                  className="gap-1"
                >
                  {isSendingSMS ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  SMS
                </Button>
              </div>
              
              {/* Send Email */}
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSendEmail}
                  disabled={!email || isSendingEmail}
                  className="gap-1"
                >
                  {isSendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Email
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
          {/* Status Header */}
          <div className={`bg-gradient-to-r ${config.gradient} text-white p-8`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-[#C9A962]/20 rounded-xl flex items-center justify-center">
                <ReportIcon className="w-6 h-6 text-[#C9A962]" />
              </div>
              <span className="text-[#C9A962] font-medium">{config.title}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold mb-2">
              {report.title || location}
            </h1>
            {report.title && (
              <p className="text-white/70 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {location}
              </p>
            )}
            {report.verdict && (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mt-4 border ${
                report.verdict === 'GO' ? 'bg-[#C9A962]/20 text-[#C9A962] border-[#C9A962]/30' :
                report.verdict === 'CAUTION' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                'bg-red-500/20 text-red-300 border-red-500/30'
              }`}>
                {report.verdict === 'GO' ? <CheckCircle2 className="w-5 h-5" /> :
                 report.verdict === 'CAUTION' ? <AlertTriangle className="w-5 h-5" /> :
                 <XCircle className="w-5 h-5" />}
                <span className="font-semibold">{report.verdict}</span>
              </div>
            )}
          </div>

          {/* Summary */}
          {(() => {
            const dbSummary = report.summary;
            const isPlaceholder = !dbSummary || dbSummary.includes('$0/year') || dbSummary.includes('0% occupancy');
            if (isPlaceholder && reportData?.revenue?.projected) {
              const rev = formatCurrency(reportData.revenue.projected);
              const occ = reportData.metrics?.occupancy ? `${Math.round(reportData.metrics.occupancy)}%` : 'N/A';
              const adrVal = reportData.metrics?.adr ? formatCurrency(reportData.metrics.adr) : 'N/A';
              const generatedSummary = `Projected annual revenue of ${rev} with ${occ} occupancy and ${adrVal} average daily rate.`;
              return (
                <div className="p-6 border-b border-[#C9A962]/20">
                  <h2 className="text-lg font-serif font-semibold text-[#0F172A] mb-3">Summary</h2>
                  <p className="text-[#0F172A]/80 leading-relaxed">{generatedSummary}</p>
                </div>
              );
            }
            if (dbSummary && !isPlaceholder) {
              return (
                <div className="p-6 border-b border-[#C9A962]/20">
                  <h2 className="text-lg font-serif font-semibold text-[#0F172A] mb-3">Summary</h2>
                  <p className="text-[#0F172A]/80 leading-relaxed">{dbSummary}</p>
                </div>
              );
            }
            return null;
          })()}

          {/* Key Metrics */}
          {(() => {
            const annualRev = report.annualRevenue || reportData?.revenue?.projected;
            const occRate = report.occupancyRate || (reportData?.metrics?.occupancy ? reportData.metrics.occupancy / 100 : null);
            const adr = report.averageDailyRate || reportData?.metrics?.adr;
            const cashFlow = reportData?.cashFlow;
            return (
              <div className="p-6">
                <h2 className="text-lg font-serif font-semibold text-[#0F172A] mb-4">Key Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {annualRev && (
                    <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10">
                      <DollarSign className="w-5 h-5 text-[#C9A962] mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(annualRev)}</p>
                      <p className="text-sm text-gray-500">Projected Annual Revenue</p>
                    </div>
                  )}
                  {occRate && (
                    <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10">
                      <Calendar className="w-5 h-5 text-[#C9A962] mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{formatPercent(occRate)}</p>
                      <p className="text-sm text-gray-500">Occupancy Rate</p>
                    </div>
                  )}
                  {adr && (
                    <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10">
                      <TrendingUp className="w-5 h-5 text-[#C9A962] mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(adr)}</p>
                      <p className="text-sm text-gray-500">Avg Daily Rate</p>
                    </div>
                  )}
                  {report.bedrooms && (
                    <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10">
                      <Home className="w-5 h-5 text-[#C9A962] mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{report.bedrooms} BR / {report.bathrooms || '?'} BA</p>
                      <p className="text-sm text-gray-500">Property Size</p>
                    </div>
                  )}
                  {report.monthlyRent && (
                    <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10">
                      <Building className="w-5 h-5 text-[#C9A962] mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(report.monthlyRent)}</p>
                      <p className="text-sm text-gray-500">Monthly Rent</p>
                    </div>
                  )}
                  {cashFlow?.monthlyProfit != null && (
                    <div className={`rounded-xl p-4 border ${cashFlow.monthlyProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                      <TrendingUp className={`w-5 h-5 mb-2 ${cashFlow.monthlyProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`} />
                      <p className={`text-2xl font-bold ${cashFlow.monthlyProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {formatCurrency(cashFlow.monthlyProfit)}/mo
                      </p>
                      <p className="text-sm text-gray-500">Cash Flow (STR − Rent)</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Full Report Data */}
          {reportData && (
            <div className="p-6 border-t border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Detailed Analysis</h2>
              
              {/* Revenue Report Data */}
              {report.reportType === 'revenue' && reportData.estimates && (
                <div className="space-y-6">
                  {reportData.monthly_forecast && (
                    <div>
                      <h3 className="font-medium text-gray-800 mb-3">Monthly Revenue Forecast</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {reportData.monthly_forecast.slice(0, 8).map((month: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm text-gray-500">{month.month}</p>
                            <p className="font-semibold text-gray-900">{formatCurrency(month.revenue)}</p>
                            <p className="text-xs text-gray-400">{formatPercent(month.occupancy)} occ</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {reportData.comps && reportData.comps.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-800 mb-3">Comparable Properties</h3>
                      <div className="space-y-3">
                        {reportData.comps.slice(0, 5).map((comp: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
                            <div>
                              <p className="font-medium text-gray-900">{comp.title || `Comp ${idx + 1}`}</p>
                              <p className="text-sm text-gray-500">
                                {comp.bedrooms} BR • {comp.bathrooms} BA • {comp.rating ? `★ ${comp.rating}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">{formatCurrency(comp.annual_revenue)}/yr</p>
                              <p className="text-sm text-gray-500">{formatCurrency(comp.adr)}/night</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Market Report Data */}
              {report.reportType === 'market' && (
                <div className="space-y-6">
                  {reportData.marketMetrics && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(reportData.marketMetrics).map(([key, value]: [string, any]) => (
                        <div key={key} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm text-gray-500 capitalize">{key.replace(/_/g, ' ')}</p>
                          <p className="font-semibold text-gray-900">
                            {typeof value === 'number' ? 
                              (key.includes('rate') || key.includes('occupancy') ? formatPercent(value) : 
                               key.includes('revenue') || key.includes('adr') || key.includes('price') ? formatCurrency(value) : 
                               value.toLocaleString()) 
                              : String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AI Advisor Report Data */}
              {report.reportType === 'ai_advisor' && reportData.advice && (
                <div className="prose prose-gray max-w-none">
                  <div className="whitespace-pre-wrap text-gray-700">{reportData.advice}</div>
                </div>
              )}

              {/* Generic fallback for other types */}
              {!['revenue', 'market', 'ai_advisor', 'validator'].includes(report.reportType) && (
                <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
                  <pre className="text-xs text-gray-600">
                    {JSON.stringify(reportData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 py-6 border-t border-[#C9A962]/20">
          <p className="text-[#0F172A] font-serif font-semibold text-lg">Coach Inayah Turnkey Tool</p>
          <p className="text-[#0F172A]/60 text-sm mt-1">
            Views: {report.viewCount} • Created: {new Date(report.createdAt).toLocaleDateString()}
          </p>
          <p className="text-[#C9A962] text-xs mt-3">Powered by Coach Inayah market data</p>
        </div>
      </main>
    </div>
    </>
  );
}
