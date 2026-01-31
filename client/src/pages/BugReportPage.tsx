/**
 * Bug Report Page
 * 
 * Displays a bug report by its share code.
 * Allows users to view the status and details of their reported bugs.
 */

import { useParams, Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { 
  Bug, 
  ArrowLeft, 
  Clock, 
  MapPin, 
  Monitor, 
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
  Wrench,
  XCircle,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const statusConfig = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
  investigating: { label: 'Investigating', color: 'bg-yellow-100 text-yellow-800', icon: Search },
  in_progress: { label: 'In Progress', color: 'bg-purple-100 text-purple-800', icon: Wrench },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  wont_fix: { label: "Won't Fix", color: 'bg-gray-100 text-gray-800', icon: XCircle },
  duplicate: { label: 'Duplicate', color: 'bg-orange-100 text-orange-800', icon: Copy },
};

const priorityConfig = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700' },
};

export default function BugReportPage() {
  const params = useParams();
  const shareCode = params.shareCode as string;

  const { data: bugReport, isLoading, error } = trpc.bugReports.getByShareCode.useQuery(
    { shareCode },
    { enabled: !!shareCode }
  );

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#C9A962] mx-auto mb-4" />
          <p className="text-gray-600">Loading bug report...</p>
        </div>
      </div>
    );
  }

  if (error || !bugReport) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Bug className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Bug Report Not Found</h2>
            <p className="text-gray-600 mb-6">
              The bug report you're looking for doesn't exist or has been removed.
            </p>
            <Link href="/">
              <Button className="bg-[#0F172A] hover:bg-[#1e293b]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Calculator
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[bugReport.status as keyof typeof statusConfig] || statusConfig.new;
  const priority = priorityConfig[bugReport.priority as keyof typeof priorityConfig] || priorityConfig.medium;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Calculator
            </Button>
          </Link>
          <Button variant="outline" onClick={copyShareLink}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Link
          </Button>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C9A962]/20 flex items-center justify-center flex-shrink-0">
                  <Bug className="w-5 h-5 text-[#C9A962]" />
                </div>
                <div>
                  <CardTitle className="text-xl">{bugReport.title}</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Report ID: {bugReport.shareCode}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge className={priority.color}>{priority.label}</Badge>
                <Badge className={`${status.color} flex items-center gap-1`}>
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Description */}
            {bugReport.description && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{bugReport.description}</p>
              </div>
            )}

            {/* Steps to Reproduce */}
            {bugReport.stepsToReproduce && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Steps to Reproduce</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{bugReport.stepsToReproduce}</p>
              </div>
            )}

            {/* Expected vs Actual */}
            {(bugReport.expectedBehavior || bugReport.actualBehavior) && (
              <div className="grid md:grid-cols-2 gap-4">
                {bugReport.expectedBehavior && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">Expected Behavior</h4>
                    <p className="text-green-700 text-sm">{bugReport.expectedBehavior}</p>
                  </div>
                )}
                {bugReport.actualBehavior && (
                  <div className="p-4 bg-red-50 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">Actual Behavior</h4>
                    <p className="text-red-700 text-sm">{bugReport.actualBehavior}</p>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {bugReport.errorMessage && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Error Message
                </h3>
                <code className="text-sm text-red-700 font-mono">{bugReport.errorMessage}</code>
              </div>
            )}

            {/* Context Info */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Tool/Page Info */}
              {(bugReport.toolName || bugReport.pagePath) && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    Tool/Page
                  </h4>
                  {bugReport.toolName && (
                    <p className="text-sm text-gray-600">Tool: {bugReport.toolName}</p>
                  )}
                  {bugReport.pagePath && (
                    <p className="text-sm text-gray-600">Page: {bugReport.pagePath}</p>
                  )}
                </div>
              )}

              {/* Location Info */}
              {(bugReport.city || bugReport.propertyAddress) && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location Context
                  </h4>
                  {bugReport.propertyAddress && (
                    <p className="text-sm text-gray-600">{bugReport.propertyAddress}</p>
                  )}
                  {bugReport.city && bugReport.state && (
                    <p className="text-sm text-gray-600">{bugReport.city}, {bugReport.state}</p>
                  )}
                </div>
              )}
            </div>

            {/* Resolution */}
            {bugReport.resolution && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Resolution
                </h3>
                <p className="text-green-700">{bugReport.resolution}</p>
              </div>
            )}

            {/* Timestamps */}
            <div className="flex items-center gap-4 text-sm text-gray-500 pt-4 border-t">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Reported: {new Date(bugReport.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              {bugReport.resolvedAt && (
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Resolved: {new Date(bugReport.resolvedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Questions about this bug report? Contact{' '}
          <a href="mailto:support@coachinayah.com" className="text-[#C9A962] hover:underline">
            support@coachinayah.com
          </a>
        </p>
      </div>
    </div>
  );
}
