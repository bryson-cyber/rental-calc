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

          {/* Key Metrics */}
          <div className="p-6">
            <h2 className="text-lg font-serif font-semibold text-[#0F172A] mb-4">Key Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {report.annualRevenue && (
                <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10">
                  <DollarSign className="w-5 h-5 text-[#C9A962] mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(report.annualRevenue)}
                  </p>
                  <p className="text-sm text-gray-500">Annual Revenue</p>
                </div>
              )}

              {report.occupancyRate && (
                <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10">
                  <Calendar className="w-5 h-5 text-[#C9A962] mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPercent(report.occupancyRate)}
                  </p>
                  <p className="text-sm text-gray-500">Occupancy Rate</p>
                </div>
              )}

              {report.averageDailyRate && (
                <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10">
                  <TrendingUp className="w-5 h-5 text-[#C9A962] mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(report.averageDailyRate)}
                  </p>
                  <p className="text-sm text-gray-500">Avg Daily Rate</p>
                </div>
              )}

              {report.profitMargin && (
                <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10">
                  <Percent className="w-5 h-5 text-[#C9A962] mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPercent(report.profitMargin)}
                  </p>
                  <p className="text-sm text-gray-500">Profit Margin</p>
                </div>
              )}

              {report.bedrooms && (
                <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10">
                  <Home className="w-5 h-5 text-[#C9A962] mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {report.bedrooms} BR / {report.bathrooms || '?'} BA
                  </p>
                  <p className="text-sm text-gray-500">Property Size</p>
                </div>
              )}

              {report.monthlyRent && (
                <div className="bg-[#0F172A]/5 rounded-xl p-4 border border-[#C9A962]/10">
                  <Building className="w-5 h-5 text-[#C9A962] mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(report.monthlyRent)}
                  </p>
                  <p className="text-sm text-gray-500">Monthly Rent</p>
                </div>
              )}
            </div>
          </div>

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

              {/* Generic JSON display for other types */}
              {!['revenue', 'market', 'ai_advisor'].includes(report.reportType) && (
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
