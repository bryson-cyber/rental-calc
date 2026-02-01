/**
 * Notification Analytics Dashboard
 * 
 * Admin-only page to track notification performance:
 * - Total reports created by type
 * - SMS/Email delivery rates
 * - View counts and engagement
 * - Conversion tracking
 */

import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Mail,
  MessageSquare,
  Eye,
  TrendingUp,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  DollarSign,
  Home,
  MapPin,
  Sparkles,
  Building,
  Scale,
} from 'lucide-react';

// Report type configurations
const reportTypeConfig = {
  regulation: {
    label: 'Regulation Reports',
    icon: Scale,
    color: 'text-purple-600',
    bg: 'bg-purple-100',
  },
  revenue: {
    label: 'Revenue Analysis',
    icon: DollarSign,
    color: 'text-green-600',
    bg: 'bg-green-100',
  },
  validator: {
    label: 'Property Validation',
    icon: CheckCircle2,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
  market: {
    label: 'Market Analysis',
    icon: BarChart3,
    color: 'text-amber-600',
    bg: 'bg-amber-100',
  },
  ai_advisor: {
    label: 'AI Advisor',
    icon: Sparkles,
    color: 'text-rose-600',
    bg: 'bg-rose-100',
  },
  listings: {
    label: 'Listings Reports',
    icon: Building,
    color: 'text-teal-600',
    bg: 'bg-teal-100',
  },
  comparison: {
    label: 'Property Comparison',
    icon: TrendingUp,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100',
  },
  map: {
    label: 'Map View Reports',
    icon: MapPin,
    color: 'text-cyan-600',
    bg: 'bg-cyan-100',
  },
};

export default function NotificationAnalytics() {
  const { user, loading: authLoading } = useAuth();
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  
  const { data: analytics, isLoading, refetch } = trpc.shareableReports.getAnalytics.useQuery(
    { reportType: selectedType as any },
    { enabled: user?.role === 'admin' }
  );

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <XCircle className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You need admin access to view this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  const formatNumber = (num: number) => num.toLocaleString();
  const formatPercent = (num: number) => `${(num * 100).toFixed(1)}%`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notification Analytics</h1>
            <p className="text-gray-600 mt-1">Track shareable report performance and engagement</p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filter by Report Type */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedType === undefined ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedType(undefined)}
            className={selectedType === undefined ? 'bg-amber-600 hover:bg-amber-700' : ''}
          >
            All Types
          </Button>
          {Object.entries(reportTypeConfig).map(([type, config]) => {
            const Icon = config.icon;
            return (
              <Button
                key={type}
                variant={selectedType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(type)}
                className={`gap-1 ${selectedType === type ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
              >
                <Icon className="w-4 h-4" />
                {config.label}
              </Button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          </div>
        ) : analytics ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Reports</CardDescription>
                  <CardTitle className="text-3xl">{formatNumber(analytics.totalReports)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FileText className="w-4 h-4" />
                    <span>All shareable reports created</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Views</CardDescription>
                  <CardTitle className="text-3xl">{formatNumber(analytics.totalViews)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Eye className="w-4 h-4" />
                    <span>Report page views</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>SMS Sent</CardDescription>
                  <CardTitle className="text-3xl">{formatNumber(analytics.totalSmsSent)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MessageSquare className="w-4 h-4" />
                    <span>
                      {analytics.smsSuccessRate > 0 
                        ? `${formatPercent(analytics.smsSuccessRate)} success rate`
                        : 'No SMS sent yet'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Emails Sent</CardDescription>
                  <CardTitle className="text-3xl">{formatNumber(analytics.totalEmailsSent)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Mail className="w-4 h-4" />
                    <span>
                      {analytics.emailSuccessRate > 0 
                        ? `${formatPercent(analytics.emailSuccessRate)} success rate`
                        : 'No emails sent yet'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Reports by Type */}
            <Card>
              <CardHeader>
                <CardTitle>Reports by Type</CardTitle>
                <CardDescription>Breakdown of shareable reports by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {analytics.byType && Object.entries(analytics.byType).map(([type, data]: [string, any]) => {
                    const config = reportTypeConfig[type as keyof typeof reportTypeConfig];
                    if (!config) return null;
                    const Icon = config.icon;
                    
                    return (
                      <div
                        key={type}
                        className={`p-4 rounded-xl ${config.bg} border border-gray-200`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Icon className={`w-5 h-5 ${config.color}`} />
                          <span className="font-medium text-gray-900">{config.label}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Reports</span>
                            <span className="font-semibold">{formatNumber(data.count)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Views</span>
                            <span className="font-semibold">{formatNumber(data.views)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">SMS Sent</span>
                            <span className="font-semibold">{formatNumber(data.smsSent)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Emails Sent</span>
                            <span className="font-semibold">{formatNumber(data.emailsSent)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Notifications */}
            {analytics.recentNotifications && analytics.recentNotifications.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Notifications</CardTitle>
                  <CardDescription>Last 20 notifications sent</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Type</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Report</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Channel</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Sent At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.recentNotifications.map((notification: any, idx: number) => {
                          const config = reportTypeConfig[notification.reportType as keyof typeof reportTypeConfig];
                          const Icon = config?.icon || FileText;
                          
                          return (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Icon className={`w-4 h-4 ${config?.color || 'text-gray-500'}`} />
                                  <span>{config?.label || notification.reportType}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-gray-900">{notification.shareCode}</span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1">
                                  {notification.channel === 'sms' ? (
                                    <MessageSquare className="w-4 h-4 text-blue-500" />
                                  ) : (
                                    <Mail className="w-4 h-4 text-purple-500" />
                                  )}
                                  <span className="capitalize">{notification.channel}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                {notification.success ? (
                                  <span className="inline-flex items-center gap-1 text-green-600">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Sent
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-600">
                                    <XCircle className="w-4 h-4" />
                                    Failed
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-gray-500">
                                {new Date(notification.createdAt).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No analytics data available yet.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
