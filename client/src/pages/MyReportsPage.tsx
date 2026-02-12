/**
 * My Reports Page
 * 
 * Shows all reports the user has run, organized by type with filter tabs.
 * Each report card links directly to the share URL so users can view the full report.
 * Matches the Coach Inayah light theme with gold accents.
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { getLoginUrl } from '@/const';
import {
  FileText,
  TrendingUp,
  Shield,
  Brain,
  MapPin,
  Gavel,
  Eye,
  ExternalLink,
  ArrowLeft,
  Loader2,
  Search,
  Calendar,
  DollarSign,
  BarChart3,
  Filter,
  ChevronRight,
  Home,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

// Report type configuration for display
const REPORT_TYPE_CONFIG: Record<string, {
  label: string;
  icon: typeof FileText;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}> = {
  revenue: {
    label: 'Revenue Analysis',
    icon: DollarSign,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'Revenue estimates and market data',
  },
  validator: {
    label: 'Property Validation',
    icon: Shield,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Full property deal validation',
  },
  ai_advisor: {
    label: 'AI Advisor',
    icon: Brain,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'AI-powered investment advice',
  },
  market: {
    label: 'Market Research',
    icon: BarChart3,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Market analysis and trends',
  },
  regulation: {
    label: 'Regulation Check',
    icon: Gavel,
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    description: 'Short-term rental regulations',
  },
  property: {
    label: 'Property Report',
    icon: Home,
    color: 'text-sky-700',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    description: 'Detailed property analysis',
  },
  full: {
    label: 'Full Report',
    icon: FileText,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    description: 'Comprehensive property report',
  },
};

const FILTER_TABS = [
  { key: 'all', label: 'All Reports' },
  { key: 'full', label: 'Full Reports' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'validator', label: 'Validation' },
  { key: 'ai_advisor', label: 'AI Advisor' },
  { key: 'market', label: 'Market' },
  { key: 'regulation', label: 'Regulation' },
  { key: 'property', label: 'Property' },
] as const;

function formatDate(dateStr: string | Date) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function ReportCard({ report }: { report: any }) {
  const [copied, setCopied] = useState(false);
  const config = REPORT_TYPE_CONFIG[report.reportType] || REPORT_TYPE_CONFIG.revenue;
  const Icon = config.icon;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (report.shareUrl) {
      const fullUrl = `${window.location.origin}${report.shareUrl}`;
      navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const cardContent = (
    <div
      className={`group relative bg-white border ${config.borderColor} rounded-xl p-5 hover:shadow-md transition-all duration-200 cursor-pointer`}
    >
      {/* Type Badge */}
      <div className="flex items-start justify-between mb-3">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
          <Icon className="w-3.5 h-3.5" />
          {config.label}
        </div>
        <div className="flex items-center gap-2">
          {report.viewCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Eye className="w-3 h-3" />
              {report.viewCount}
            </span>
          )}
          {report.shareUrl && (
            <button
              onClick={handleCopyLink}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Copy share link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Address / Title */}
      <h3 className="text-sm font-semibold text-slate-900 mb-1 line-clamp-2 group-hover:text-[oklch(0.45_0.14_75)] transition-colors">
        {report.address || report.title || 'Untitled Report'}
      </h3>

      {/* Location */}
      {(report.city || report.state) && (
        <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {[report.city, report.state].filter(Boolean).join(', ')}
        </p>
      )}

      {/* Metrics Row */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
        {report.annualRevenue && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-sm font-semibold text-slate-900">
              {formatCurrency(report.annualRevenue)}
            </span>
            <span className="text-xs text-slate-400">/yr</span>
          </div>
        )}
        {report.occupancyRate && (
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-sm font-medium text-slate-700">
              {(() => {
                const val = parseFloat(report.occupancyRate);
                // Values > 1 are already percentages (e.g., 54.00), values <= 1 are decimals (e.g., 0.54)
                return Math.round(val > 1 ? val : val * 100);
              })()}%
            </span>
            <span className="text-xs text-slate-400">occ</span>
          </div>
        )}
        {report.averageDailyRate && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-sm font-medium text-slate-700">
              {formatCurrency(report.averageDailyRate)}
            </span>
            <span className="text-xs text-slate-400">ADR</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2">
        <span className="text-xs text-slate-400">
          {formatDate(report.createdAt)}
        </span>
        {report.creatorName && (
          <span className="text-xs text-slate-400 truncate max-w-[120px]">
            by {report.creatorName}
          </span>
        )}
      </div>

      {/* Hover arrow */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-5 h-5 text-slate-300" />
      </div>
    </div>
  );

  if (report.shareUrl) {
    return (
      <Link href={report.shareUrl}>
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

export default function MyReportsPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: reportsData, isLoading: reportsLoading } = trpc.myReports.list.useQuery(
    { type: activeFilter as any, limit: 100 },
    { enabled: isAuthenticated }
  );

  const { data: counts } = trpc.myReports.counts.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Filter reports by search query
  const filteredReports = useMemo(() => {
    if (!reportsData?.reports) return [];
    if (!searchQuery.trim()) return reportsData.reports;
    
    const query = searchQuery.toLowerCase();
    return reportsData.reports.filter((r: any) =>
      (r.address && r.address.toLowerCase().includes(query)) ||
      (r.title && r.title.toLowerCase().includes(query)) ||
      (r.city && r.city.toLowerCase().includes(query)) ||
      (r.state && r.state.toLowerCase().includes(query)) ||
      (r.creatorName && r.creatorName.toLowerCase().includes(query))
    );
  }, [reportsData?.reports, searchQuery]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[oklch(0.98_0_0)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[oklch(0.55_0.14_75)]" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[oklch(0.98_0_0)] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-[oklch(0.55_0.14_75)]" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-3">My Reports</h1>
          <p className="text-slate-500 mb-6">
            Log in to view all the reports you've run across the platform.
          </p>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="bg-[oklch(0.55_0.14_75)] hover:bg-[oklch(0.45_0.14_75)] text-white"
          >
            Log In to View Reports
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[oklch(0.98_0_0)]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/">
              <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">My Reports</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {counts?.all ?? 0} reports across all tools
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by address, city, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[oklch(0.55_0.14_75)]/30 focus:border-[oklch(0.55_0.14_75)] outline-none transition-all bg-white"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {FILTER_TABS.map((tab) => {
              const count = counts?.[tab.key] ?? 0;
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-[oklch(0.55_0.14_75)] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {reportsLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[oklch(0.55_0.14_75)] mb-3" />
            <p className="text-sm text-slate-500">Loading reports...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {searchQuery ? 'No matching reports' : 'No reports yet'}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              {searchQuery
                ? `No reports match "${searchQuery}". Try a different search term.`
                : 'Run an analysis from the homepage to see your reports here.'}
            </p>
            {!searchQuery && (
              <Link href="/">
                <Button className="bg-[oklch(0.55_0.14_75)] hover:bg-[oklch(0.45_0.14_75)] text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go to Tools
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report: any) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
