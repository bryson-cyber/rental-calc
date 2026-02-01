/**
 * Shareable Regulation Report Page
 * Displays a regulation report that can be shared via unique URL
 */

import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  Home, 
  DollarSign, 
  Percent, 
  ExternalLink,
  Share2,
  Copy,
  MessageSquare,
  Mail,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

export default function ShareableReport() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [, setLocation] = useLocation();
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const { data, isLoading, error } = trpc.regulationTracker.getShareableReport.useQuery(
    { shareCode: shareCode || '' },
    { enabled: !!shareCode }
  );

  const sendSMSMutation = trpc.regulationTracker.sendReportSMS.useMutation();
  const sendEmailMutation = trpc.regulationTracker.sendReportEmail.useMutation();

  const handleCopyLink = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  const handleSendSMS = async () => {
    if (!phoneNumber || !shareCode) return;
    setIsSendingSMS(true);
    try {
      const result = await sendSMSMutation.mutateAsync({
        shareCode,
        phoneNumber,
      });
      if (result.success) {
        toast.success('SMS sent successfully!');
        setPhoneNumber('');
      } else {
        toast.error(result.error || 'Failed to send SMS');
      }
    } catch (err) {
      toast.error('Failed to send SMS');
    }
    setIsSendingSMS(false);
  };

  const handleSendEmail = async () => {
    if (!email || !shareCode) return;
    setIsSendingEmail(true);
    try {
      const result = await sendEmailMutation.mutateAsync({
        shareCode,
        email,
      });
      if (result.success) {
        toast.success('Email sent successfully!');
        setEmail('');
      } else {
        toast.error(result.error || 'Failed to send email');
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

  const report = data.data as {
    id: number;
    shareCode: string;
    city: string;
    state: string;
    status: string;
    summary: string | null;
    permitRequired: boolean;
    primaryResidenceOnly: boolean;
    maxNightsPerYear: number | null;
    registrationFee: string | null;
    occupancyTax: string | null;
    confidence: string | null;
    fullRegulationData: any;
    keyRequirements: any[] | null;
    sources: any[] | null;
    viewCount: number;
    createdAt: Date;
  };
  const statusConfig = {
    allowed: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', label: 'Allowed' },
    allowed_with_permit: { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Allowed with Permit' },
    restricted: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Restricted' },
    banned: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Banned' },
  };
  const status = statusConfig[report.status as keyof typeof statusConfig] || statusConfig.allowed;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-amber-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => setLocation('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Tools</span>
          </button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowShareOptions(!showShareOptions)}
            className="gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share Report
          </Button>
        </div>
      </header>

      {/* Share Options Panel */}
      {showShareOptions && (
        <div className="bg-white border-b border-gray-200 py-4">
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
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-8 h-8 text-teal-400" />
              <span className="text-teal-400 font-medium">STR Regulation Report</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {report.city}, {report.state}
            </h1>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${status.bg} ${status.color} mt-4`}>
              <StatusIcon className="w-5 h-5" />
              <span className="font-semibold">{status.label}</span>
            </div>
          </div>

          {/* Summary */}
          {report.summary && (
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Summary</h2>
              <p className="text-gray-700 leading-relaxed">{String(report.summary)}</p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Permit Required */}
              <div className="bg-gray-50 rounded-xl p-4">
                <FileText className="w-5 h-5 text-gray-400 mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {report.permitRequired ? 'Yes' : 'No'}
                </p>
                <p className="text-sm text-gray-500">Permit Required</p>
              </div>

              {/* Primary Only */}
              <div className="bg-gray-50 rounded-xl p-4">
                <Home className="w-5 h-5 text-gray-400 mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {report.primaryResidenceOnly ? 'Yes' : 'No'}
                </p>
                <p className="text-sm text-gray-500">Primary Only</p>
              </div>

              {/* Registration Fee */}
              <div className="bg-gray-50 rounded-xl p-4">
                <DollarSign className="w-5 h-5 text-gray-400 mb-2" />
                <p className="text-2xl font-bold text-gray-900 truncate" title={report.registrationFee || 'N/A'}>
                  {report.registrationFee || 'N/A'}
                </p>
                <p className="text-sm text-gray-500">Registration</p>
              </div>

              {/* Tax Rate */}
              <div className="bg-gray-50 rounded-xl p-4">
                <Percent className="w-5 h-5 text-gray-400 mb-2" />
                <p className="text-2xl font-bold text-gray-900 truncate" title={report.occupancyTax || 'N/A'}>
                  {report.occupancyTax || 'N/A'}
                </p>
                <p className="text-sm text-gray-500">Tax Rate</p>
              </div>
            </div>
          </div>

          {/* Key Requirements */}
          {report.keyRequirements && Array.isArray(report.keyRequirements) && report.keyRequirements.length > 0 && (
            <div className="p-6 border-t border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Requirements</h2>
              <ul className="space-y-3">
                {(report.keyRequirements as any[]).map((req: any, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{String(typeof req === 'string' ? req : req.text || req.requirement || '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sources */}
          {report.sources && Array.isArray(report.sources) && report.sources.length > 0 && (
            <div className="p-6 border-t border-gray-100 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Official Sources</h2>
              <div className="space-y-2">
                {(report.sources as any[]).map((source: any, i: number) => (
                  <a
                    key={i}
                    href={String(source.url || '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-amber-600 hover:text-amber-700 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{String(source.title || source.url || '')}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-3">Ready to Start Your STR Journey?</h2>
          <p className="text-amber-100 mb-6 max-w-lg mx-auto">
            Get access to all our free research tools - revenue estimates, market analysis, and more.
          </p>
          <Button 
            onClick={() => setLocation('/')}
            className="bg-white text-amber-600 hover:bg-amber-50 font-semibold px-8 py-3"
          >
            Explore All Tools
          </Button>
        </div>

        {/* View Count */}
        <p className="text-center text-gray-400 text-sm mt-8">
          This report has been viewed {report.viewCount} time{report.viewCount !== 1 ? 's' : ''}
        </p>
      </main>
    </div>
  );
}
