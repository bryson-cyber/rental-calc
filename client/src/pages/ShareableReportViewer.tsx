/**
 * Universal Shareable Report Viewer
 *
 * Renders the EXACT same UI the user was looking at when they shared the link.
 * Each report type maps to its original component rendered in read-only mode:
 *
 *   validator / revenue  → FullPropertyReport (property analysis)
 *   ai_advisor           → SharedAIAdvisorDisplay (same amber card + markdown)
 *   market / regulation  → SharedRegulationDisplay (same glass morphism UI)
 *   map                  → SharedRegulationDisplay (fallback — map shares store regulation data)
 *
 * No login required. Admin-only features are hidden automatically.
 */

import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import { SEOHead, createWebPageSchema } from '@/components/SEOHead';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import FullPropertyReport from '@/components/FullPropertyReport';
import type { FullReportData } from '@/components/FullPropertyReport';
import { SharedRegulationDisplay } from '@/components/SharedRegulationDisplay';
import { SharedAIAdvisorDisplay } from '@/components/SharedAIAdvisorDisplay';
import {
  Loader2,
  ArrowLeft,
  Share2,
  Copy,
  MessageSquare,
  Mail,
  XCircle,
} from 'lucide-react';

// ─── Data Transformers ──────────────────────────────────────────────────

/**
 * Transform validator report data into the FullReportData shape.
 */
function transformValidatorToFullReportData(
  reportData: any,
  dbRecord: any
): FullReportData {
  const fullAddress = dbRecord.address || '';
  const addressParts = fullAddress.split(',').map((s: string) => s.trim());
  let city = dbRecord.city || '';
  let state = dbRecord.state || '';
  let zipCode = '';

  if (!city && addressParts.length >= 2) city = addressParts[1] || '';
  if (!state && addressParts.length >= 3) {
    const stateZip = addressParts[2] || '';
    const stateZipParts = stateZip.split(' ').filter(Boolean);
    state = stateZipParts[0] || '';
    zipCode = stateZipParts[1] || '';
  }

  const bedrooms = dbRecord.bedrooms || 2;
  const bathrooms = parseFloat(dbRecord.bathrooms) || 1;
  const monthlyRent = dbRecord.monthlyRent || 0;

  const revenue = reportData.revenue || {};
  const metrics = reportData.metrics || {};
  const projected = revenue.projected || 0;
  const occupancy = metrics.occupancy || 0;
  const adr = metrics.adr || 0;

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
    annual: projected,
    monthly: Math.round(projected / 12),
    nightly: adr,
    occupancy: occupancy > 1 ? occupancy / 100 : occupancy,
    range:
      revenue.low && revenue.high
        ? { low: revenue.low, high: revenue.high }
        : undefined,
  };

  const monthly_forecast = (reportData.forecast || []).map((f: any) => ({
    month: f.month,
    revenue: f.revenue,
    occupancy: f.occupancy > 1 ? f.occupancy : f.occupancy * 100,
    adr: f.adr,
  }));

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

  const bedroom_performance = (reportData.bedroomPerformance || []).map(
    (bp: any) => ({
      bedrooms: bp.bedrooms,
      occupancy: bp.occupancy,
      adr: bp.adr,
      revenue: bp.revenue,
      listing_count: bp.listing_count,
    })
  );

  const revenue_percentiles = reportData.revenuePercentiles || undefined;

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
        active_listings:
          raw.metrics?.active_listings || raw.listing_count || 0,
        market_score: raw.metrics?.market_score,
      },
      listing_count:
        raw.listing_count || raw.metrics?.active_listings || 0,
    };
  }

  let historical_data = undefined;
  if (reportData.historicalData) {
    historical_data = {
      summary: reportData.historicalData.summary || {},
      months: reportData.historicalData.months || [],
    };
  }

  let rental_arbitrage = undefined;
  if (monthlyRent > 0) {
    rental_arbitrage = { monthlyRent, startupCosts: 5000 };
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
    generated_at: dbRecord.createdAt
      ? new Date(dbRecord.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

/**
 * Transform revenue report data into the FullReportData shape.
 */
function transformRevenueToFullReportData(
  reportData: any,
  dbRecord: any
): FullReportData {
  const fullAddress = dbRecord.address || '';
  const addressParts = fullAddress.split(',').map((s: string) => s.trim());
  let city = dbRecord.city || '';
  let state = dbRecord.state || '';
  let zipCode = '';

  if (!city && addressParts.length >= 2) city = addressParts[1] || '';
  if (!state && addressParts.length >= 3) {
    const stateZip = addressParts[2] || '';
    const stateZipParts = stateZip.split(' ').filter(Boolean);
    state = stateZipParts[0] || '';
    zipCode = stateZipParts[1] || '';
  }

  const bedrooms = dbRecord.bedrooms || 2;
  const bathrooms = parseFloat(dbRecord.bathrooms) || 1;

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
    range:
      est.annual_revenue_low && est.annual_revenue_high
        ? { low: est.annual_revenue_low, high: est.annual_revenue_high }
        : undefined,
  };

  const monthly_forecast = (reportData.monthly_forecast || []).map(
    (f: any) => ({
      month: f.month,
      revenue: f.revenue,
      occupancy:
        f.occupancy != null
          ? f.occupancy > 1
            ? f.occupancy
            : f.occupancy * 100
          : undefined,
      adr: f.adr,
    })
  );

  const comps = (reportData.comps || []).map((c: any) => ({
    id: c.id || String(Math.random()),
    title: c.title || 'Comparable Property',
    airbnb_url: c.airbnb_url || c.airbnbUrl,
    image_url:
      c.image_url || c.imageUrl || (c.images && c.images[0]) || undefined,
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
        active_listings:
          mkt.metrics?.active_listings || mkt.listing_count || 0,
        market_score: mkt.metrics?.market_score,
      },
      listing_count:
        mkt.listing_count || mkt.metrics?.active_listings || 0,
    };
  }

  let historical_data = undefined;
  if (reportData.market?.historical) {
    historical_data = {
      summary: reportData.market.historical.summary || {},
      months: reportData.market.historical.months || [],
    };
  }

  const bedroom_performance = (
    reportData.market?.bedroom_performance || []
  ).map((bp: any) => ({
    bedrooms: bp.bedrooms,
    occupancy: bp.occupancy,
    adr: bp.adr,
    revenue: bp.revenue,
    listing_count: bp.listing_count,
  }));

  const revenue_percentiles =
    reportData.market?.revenue_percentiles || undefined;

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
    generated_at: dbRecord.createdAt
      ? new Date(dbRecord.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Detect if the stored reportData is actually regulation-shaped
 * (both 'market' and 'regulation' types store regulation data).
 */
function isRegulationData(reportData: any): boolean {
  return !!(reportData?.status && reportData?.city && reportData?.state);
}

// ─── Main Component ─────────────────────────────────────────────────────

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

  const sendNotificationsMutation =
    trpc.shareableReports.sendNotifications.useMutation();

  // ── Share actions ──
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
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
    } catch {
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
    } catch {
      toast.error('Failed to send email');
    }
    setIsSendingEmail(false);
  };

  // ── Loading state ──
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

  // ── Error state ──
  if (error || !data?.success || !data?.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Report Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            This report link may have expired or doesn't exist.
          </p>
          <Button
            onClick={() => setLocation('/')}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  const report = data.data;
  const reportData = report.reportData as any;
  const reportType = report.reportType;

  // Build location string for SEO
  const location =
    report.address ||
    (report.city && report.state
      ? `${report.city}, ${report.state}`
      : report.marketName || 'Unknown Location');

  // ── Floating share bar (reused across all report types) ──
  const ShareBar = () => (
    <>
      {/* Floating Share Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setShowShareOptions(!showShareOptions)}
          className="rounded-full w-14 h-14 shadow-xl bg-[#0F172A] hover:bg-[#1e293b] text-white"
        >
          <Share2 className="w-5 h-5" />
        </Button>
      </div>

      {/* Share Options Drawer */}
      {showShareOptions && (
        <div className="fixed bottom-24 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 w-80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Share Report</h3>
            <button
              onClick={() => setShowShareOptions(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-3">
            {/* Copy Link */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="w-full gap-2 justify-start"
            >
              <Copy className="w-4 h-4" />
              Copy Link
            </Button>

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
                {isSendingSMS ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
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
                {isSendingEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                Email
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATOR & REVENUE → FullPropertyReport (same as the owner sees)
  // ═══════════════════════════════════════════════════════════════════════
  if (
    (reportType === 'validator' || reportType === 'revenue') &&
    reportData
  ) {
    const fullReportData =
      reportType === 'validator'
        ? transformValidatorToFullReportData(reportData, report)
        : transformRevenueToFullReportData(reportData, report);

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
            url: `/share/${shareCode}`,
          })}
        />
        <FullPropertyReport
          data={fullReportData}
          onBack={() => setLocation('/')}
          isSharedView={true}
        />
        <ShareBar />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AI ADVISOR → Same amber card + LightMarkdown rendering
  // ═══════════════════════════════════════════════════════════════════════
  if (reportType === 'ai_advisor' && reportData?.advice) {
    const seoTitle = `AI Property Analysis - ${location}`;
    const seoDescription = `AI-powered investment analysis for ${location}. Shared via Coach Inayah Turnkey Tool.`;

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
            url: `/share/${shareCode}`,
          })}
        />
        <div className="min-h-screen bg-gradient-to-b from-[#FFFBF5] to-white">
          {/* Branded Header */}
          <header className="bg-[#0F172A] text-white">
            <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
              <button
                onClick={() => setLocation('/')}
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Coach Inayah</span>
              </button>
              <span className="text-[#C9A962] font-serif font-semibold hidden sm:block">
                Turnkey Tool
              </span>
            </div>
          </header>

          <main className="max-w-4xl mx-auto px-4 py-8">
            <SharedAIAdvisorDisplay
              data={reportData}
              address={report.address || undefined}
              bedrooms={report.bedrooms || undefined}
              bathrooms={report.bathrooms ? parseFloat(String(report.bathrooms)) : undefined}
            />

            {/* Footer */}
            <div className="text-center mt-12 py-6 border-t border-[#C9A962]/20">
              <p className="text-[#0F172A] font-serif font-semibold text-lg">
                Coach Inayah Turnkey Tool
              </p>
              <p className="text-[#C9A962] text-xs mt-3">
                Powered by Coach Inayah market data
              </p>
            </div>
          </main>
        </div>
        <ShareBar />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MARKET / REGULATION → Same glass morphism regulation display
  // (Both 'market' and 'regulation' types store regulation data)
  // ═══════════════════════════════════════════════════════════════════════
  if (
    (reportType === 'market' || reportType === 'regulation') &&
    reportData &&
    isRegulationData(reportData)
  ) {
    const seoTitle = `Regulation Check - ${reportData.city}, ${reportData.state}`;
    const seoDescription = `Short-term rental regulations for ${reportData.city}, ${reportData.state}. Shared via Coach Inayah Turnkey Tool.`;

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
            url: `/share/${shareCode}`,
          })}
        />
        <div className="min-h-screen bg-gradient-to-b from-[#FFFBF5] to-white">
          {/* Branded Header */}
          <header className="bg-[#0F172A] text-white">
            <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
              <button
                onClick={() => setLocation('/')}
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Coach Inayah</span>
              </button>
              <span className="text-[#C9A962] font-serif font-semibold hidden sm:block">
                Turnkey Tool
              </span>
            </div>
          </header>

          <main className="max-w-4xl mx-auto px-4 py-8">
            <SharedRegulationDisplay data={reportData} />

            {/* Footer */}
            <div className="text-center mt-12 py-6 border-t border-[#C9A962]/20">
              <p className="text-[#0F172A] font-serif font-semibold text-lg">
                Coach Inayah Turnkey Tool
              </p>
              <p className="text-[#C9A962] text-xs mt-3">
                Powered by Coach Inayah market data
              </p>
            </div>
          </main>
        </div>
        <ShareBar />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FALLBACK — for any unknown report type, show a clean summary
  // ═══════════════════════════════════════════════════════════════════════
  const seoTitle = `Report - ${location}`;
  const seoDescription = `Analysis for ${location}. Shared via Coach Inayah Turnkey Tool.`;

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
          url: `/share/${shareCode}`,
        })}
      />
      <div className="min-h-screen bg-gradient-to-b from-[#FFFBF5] to-white">
        {/* Branded Header */}
        <header className="bg-[#0F172A] text-white">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => setLocation('/')}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Coach Inayah</span>
            </button>
            <span className="text-[#C9A962] font-serif font-semibold hidden sm:block">
              Turnkey Tool
            </span>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] text-white p-8">
              <h1 className="text-3xl md:text-4xl font-serif font-bold mb-2">
                {report.title || location}
              </h1>
              {report.summary && (
                <p className="text-white/70 mt-4">{report.summary}</p>
              )}
            </div>
            {reportData && (
              <div className="p-6">
                <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
                  {JSON.stringify(reportData, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center mt-12 py-6 border-t border-[#C9A962]/20">
            <p className="text-[#0F172A] font-serif font-semibold text-lg">
              Coach Inayah Turnkey Tool
            </p>
            <p className="text-[#C9A962] text-xs mt-3">
              Powered by Coach Inayah market data
            </p>
          </div>
        </main>
      </div>
      <ShareBar />
    </>
  );
}
