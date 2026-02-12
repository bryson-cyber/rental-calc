/**
 * Universal Shareable Report Viewer
 * Displays any type of shareable report based on the report type
 */

import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useState, useEffect } from 'react';
import { SEOHead, createWebPageSchema } from '@/components/SEOHead';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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

// Coach Inayah Brand Colors
// Primary: Deep Navy #0F172A
// Accent: Warm Gold #C9A962
// Background: Warm off-white

// Report type configurations - all use consistent Coach Inayah branding
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
  const config = reportTypeConfig[report.reportType as keyof typeof reportTypeConfig] || reportTypeConfig.revenue;
  const ReportIcon = config.icon;
  const reportData = report.reportData as any;

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
        noIndex={true} // Shared reports should not be indexed
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
          {/* Status Header - Coach Inayah Navy/Gold */}
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
          {report.summary && (
            <div className="p-6 border-b border-[#C9A962]/20">
              <h2 className="text-lg font-serif font-semibold text-[#0F172A] mb-3">Summary</h2>
              <p className="text-[#0F172A]/80 leading-relaxed">{report.summary}</p>
            </div>
          )}

          {/* Key Metrics — pull from reportData when DB-level fields are null */}
          {(() => {
            const annualRev = report.annualRevenue || reportData?.revenue?.projected;
            const occRate = report.occupancyRate || (reportData?.metrics?.occupancy ? reportData.metrics.occupancy / 100 : null);
            const adr = report.averageDailyRate || reportData?.metrics?.adr;
            const profit = report.profitMargin;
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
                  {/* Monthly Forecast */}
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

                  {/* Comparable Properties */}
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

              {/* Validator Report Data */}
              {report.reportType === 'validator' && reportData && (
                <div className="space-y-8">
                  {/* Revenue Range */}
                  {reportData.revenue && (
                    <div>
                      <h3 className="font-serif font-semibold text-[#0F172A] mb-4 text-lg">Revenue Projections</h3>
                      <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] rounded-xl p-6 text-white">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-white/60 text-sm mb-1">Conservative</p>
                            <p className="text-2xl font-bold text-red-300">{formatCurrency(reportData.revenue.low)}</p>
                          </div>
                          <div className="border-x border-white/20">
                            <p className="text-[#C9A962] text-sm mb-1 font-medium">Projected</p>
                            <p className="text-3xl font-bold text-[#C9A962]">{formatCurrency(reportData.revenue.projected)}</p>
                          </div>
                          <div>
                            <p className="text-white/60 text-sm mb-1">Optimistic</p>
                            <p className="text-2xl font-bold text-emerald-300">{formatCurrency(reportData.revenue.high)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Revenue Percentiles */}
                  {reportData.revenuePercentiles && (
                    <div>
                      <h3 className="font-serif font-semibold text-[#0F172A] mb-4 text-lg">Market Revenue Distribution</h3>
                      <div className="bg-[#0F172A]/5 rounded-xl p-5 border border-[#C9A962]/10">
                        <div className="flex items-center justify-between gap-2">
                          {[{label: '10th', value: reportData.revenuePercentiles.p10},
                            {label: '25th', value: reportData.revenuePercentiles.p25},
                            {label: '50th', value: reportData.revenuePercentiles.p50},
                            {label: '75th', value: reportData.revenuePercentiles.p75},
                            {label: '90th', value: reportData.revenuePercentiles.p90}].map((p, i) => (
                            <div key={i} className="text-center flex-1">
                              <div className={`h-${Math.max(8, 8 + i * 4)} bg-gradient-to-t from-[#C9A962]/30 to-[#C9A962]/60 rounded-t-md mb-2 flex items-end justify-center pb-1`}
                                   style={{height: `${20 + i * 12}px`}}>
                              </div>
                              <p className="text-xs text-[#0F172A]/60">{p.label}%ile</p>
                              <p className="text-sm font-semibold text-[#0F172A]">{formatCurrency(p.value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Monthly Forecast */}
                  {reportData.forecast && reportData.forecast.length > 0 && (
                    <div>
                      <h3 className="font-serif font-semibold text-[#0F172A] mb-4 text-lg">12-Month Revenue Forecast</h3>
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {reportData.forecast.map((month: any, idx: number) => {
                          const monthDate = new Date(month.month + '-01');
                          const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                          return (
                            <div key={idx} className="bg-white rounded-xl p-3 border border-[#C9A962]/10 shadow-sm text-center">
                              <p className="text-xs text-[#0F172A]/50 font-medium uppercase">{monthName}</p>
                              <p className="text-lg font-bold text-[#0F172A] mt-1">{formatCurrency(month.revenue)}</p>
                              <div className="flex justify-between mt-2 text-xs text-[#0F172A]/60">
                                <span>{formatPercent(month.occupancy / 100)} occ</span>
                                <span>${Math.round(month.adr)}/nt</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Bedroom Performance */}
                  {reportData.bedroomPerformance && reportData.bedroomPerformance.length > 0 && (
                    <div>
                      <h3 className="font-serif font-semibold text-[#0F172A] mb-4 text-lg">Performance by Bedroom Count</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-[#C9A962]/30">
                              <th className="text-left py-3 px-4 text-[#0F172A]/60 font-medium">Bedrooms</th>
                              <th className="text-right py-3 px-4 text-[#0F172A]/60 font-medium">Avg Revenue</th>
                              <th className="text-right py-3 px-4 text-[#0F172A]/60 font-medium">ADR</th>
                              <th className="text-right py-3 px-4 text-[#0F172A]/60 font-medium">Occupancy</th>
                              <th className="text-right py-3 px-4 text-[#0F172A]/60 font-medium">Listings</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.bedroomPerformance.map((bp: any, idx: number) => {
                              const isMatch = bp.bedrooms === report.bedrooms;
                              return (
                                <tr key={idx} className={`border-b border-gray-100 ${isMatch ? 'bg-[#C9A962]/10 font-semibold' : ''}`}>
                                  <td className="py-3 px-4">
                                    <span className="flex items-center gap-2">
                                      <BedDouble className="w-4 h-4 text-[#C9A962]" />
                                      {bp.bedrooms} BR
                                      {isMatch && <span className="text-xs bg-[#C9A962] text-white px-2 py-0.5 rounded-full">Your Property</span>}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right">{formatCurrency(bp.revenue)}</td>
                                  <td className="py-3 px-4 text-right">{formatCurrency(bp.adr)}</td>
                                  <td className="py-3 px-4 text-right">{bp.occupancy}%</td>
                                  <td className="py-3 px-4 text-right text-[#0F172A]/60">{bp.listing_count}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Top Comparable Properties */}
                  {reportData.comparables && reportData.comparables.length > 0 && (
                    <div>
                      <h3 className="font-serif font-semibold text-[#0F172A] mb-4 text-lg">Top Comparable Properties</h3>
                      <div className="space-y-3">
                        {reportData.comparables.slice(0, 6).map((comp: any, idx: number) => (
                          <div key={idx} className="bg-white rounded-xl border border-[#C9A962]/10 shadow-sm overflow-hidden">
                            <div className="flex">
                              {/* Comp image */}
                              {comp.images && comp.images[0] && (
                                <div className="w-24 h-24 md:w-32 md:h-28 flex-shrink-0">
                                  <img src={comp.images[0]} alt={comp.title} className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div className="flex-1 p-4 flex justify-between items-center">
                                <div>
                                  <p className="font-medium text-[#0F172A] text-sm md:text-base">{comp.title || `Comparable ${idx + 1}`}</p>
                                  <p className="text-xs md:text-sm text-[#0F172A]/60 mt-1">
                                    {comp.bedrooms} BR • {comp.bathrooms} BA
                                    {comp.rating ? ` • ★ ${comp.rating}` : ''}
                                    {comp.reviews ? ` (${comp.reviews} reviews)` : ''}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-[#0F172A] text-lg">{formatCurrency(comp.revenue)}</p>
                                  <p className="text-xs text-[#0F172A]/60">{formatCurrency(comp.adr)}/night • {comp.occupancy}% occ</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {reportData.comparables.length > 6 && (
                        <p className="text-center text-sm text-[#0F172A]/50 mt-3">
                          + {reportData.comparables.length - 6} more comparable properties in the full analysis
                        </p>
                      )}
                    </div>
                  )}

                  {/* Market Insights */}
                  {reportData.marketInsights && (
                    <div>
                      <h3 className="font-serif font-semibold text-[#0F172A] mb-4 text-lg">Market Overview</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {reportData.marketInsights.totalListings && (
                          <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10 text-center">
                            <Building className="w-5 h-5 text-[#C9A962] mx-auto mb-2" />
                            <p className="text-xl font-bold text-[#0F172A]">{reportData.marketInsights.totalListings.toLocaleString()}</p>
                            <p className="text-xs text-[#0F172A]/60">Active Listings</p>
                          </div>
                        )}
                        {reportData.marketInsights.avgRating && (
                          <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10 text-center">
                            <Star className="w-5 h-5 text-[#C9A962] mx-auto mb-2" />
                            <p className="text-xl font-bold text-[#0F172A]">{reportData.marketInsights.avgRating}</p>
                            <p className="text-xs text-[#0F172A]/60">Avg Rating</p>
                          </div>
                        )}
                        {reportData.marketInsights.superhostPct != null && (
                          <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10 text-center">
                            <CheckCircle2 className="w-5 h-5 text-[#C9A962] mx-auto mb-2" />
                            <p className="text-xl font-bold text-[#0F172A]">{reportData.marketInsights.superhostPct}%</p>
                            <p className="text-xs text-[#0F172A]/60">Superhosts</p>
                          </div>
                        )}
                        {reportData.marketInsights.professionallyManagedPct != null && (
                          <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10 text-center">
                            <Users className="w-5 h-5 text-[#C9A962] mx-auto mb-2" />
                            <p className="text-xl font-bold text-[#0F172A]">{reportData.marketInsights.professionallyManagedPct}%</p>
                            <p className="text-xs text-[#0F172A]/60">Professionally Managed</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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

        {/* Footer - Coach Inayah Branding */}
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
