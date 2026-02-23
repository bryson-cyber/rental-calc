/**
 * Unified Admin Dashboard
 * 
 * Light theme matching the app's brand design system:
 * - Warm white backgrounds with subtle card layering
 * - Gold (#C9A962 / oklch(0.55 0.14 75)) accent for actions and highlights
 * - Clean typography with proper hierarchy
 * - Activity feed showing all user actions with name/email
 */

import { useState, useMemo, lazy, Suspense } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';

const ContentStudioTabLazy = lazy(() => import('./ContentStudioPage').then(m => ({ default: m.ContentStudioTab })));
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Link } from 'wouter';
import {
  Shield,
  ShieldCheck,
  Users, 
  Activity, 
  FileText, 
  TrendingUp,
  Clock,
  BarChart3,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Search,
  Loader2,
  Zap,
  Database,
  PenLine,
  DollarSign,
  Calendar,
  Mail,
  Link2,
  MousePointer,
  Send,
  MapPin,
  ExternalLink,
  Eye,
  MessageSquare,
  Play,
  ArrowLeft,
  Home,
  Building,
  ChevronLeft,
  ChevronRight,
  User,
  BookOpen
} from 'lucide-react';

export default function UnifiedAdmin() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  
  // ============================================
  // OVERVIEW TAB QUERIES
  // ============================================
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = trpc.admin.getDashboardStats.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === 'admin' }
  );
  
  // ============================================
  // USERS TAB STATE & QUERIES
  // ============================================
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [userSortBy, setUserSortBy] = useState<'lastActive' | 'usageToday'>('usageToday');
  const [userPage, setUserPage] = useState(0);
  const userLimit = 15;
  
  const usersQuery = trpc.admin.getUsers.useQuery(
    { search: userSearch || undefined, role: roleFilter, sortBy: userSortBy, limit: userLimit, offset: userPage * userLimit },
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'users' }
  );
  
  const toggleAdminMutation = trpc.admin.toggleUserAdmin.useMutation({
    onSuccess: () => {
      toast.success('User permissions updated');
      usersQuery.refetch();
    },
    onError: (err) => toast.error(err.message)
  });
  
  // ============================================
  // ACTIVITY TAB STATE & QUERIES
  // ============================================
  const [activitySearch, setActivitySearch] = useState('');
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<string>('all');
  const [activityActionFilter, setActivityActionFilter] = useState<string>('all');
  const [activityPage, setActivityPage] = useState(0);
  const activityLimit = 30;

  const activityFeedQuery = trpc.admin.getActivityFeed.useQuery(
    {
      search: activitySearch || undefined,
      actionCategory: activityCategoryFilter !== 'all' ? activityCategoryFilter : undefined,
      action: activityActionFilter !== 'all' ? activityActionFilter : undefined,
      limit: activityLimit,
      offset: activityPage * activityLimit,
    },
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'activity' }
  );

  const totalActivityPages = Math.ceil((activityFeedQuery.data?.total || 0) / activityLimit);

  // ============================================
  // API USAGE TAB QUERIES
  // ============================================
  const { data: apiUsageData, isLoading: apiUsageLoading, refetch: refetchApiUsage } = trpc.admin.getApiUsage.useQuery(
    {},
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'api-usage' }
  );
  
  const { data: apiCallsData } = trpc.admin.getRecentApiCalls.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'api-usage' }
  );
  
  // ============================================
  // HUBSPOT TAB QUERIES
  // ============================================
  const { data: hubspotSummary } = trpc.adminTracking.getDashboardSummary.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'hubspot' }
  );
  
  const { data: hubspotLinks, isLoading: linksLoading } = trpc.adminTracking.getLinks.useQuery(
    { limit: 10 },
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'hubspot' }
  );
  
  const { data: emailOptins, isLoading: optinsLoading } = trpc.emailOptin.list.useQuery(
    { limit: 10 },
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'hubspot' }
  );
  
  // ============================================
  // NOTIFICATIONS TAB QUERIES
  // ============================================
  const { data: notificationAnalytics, isLoading: notificationsLoading, refetch: refetchNotifications } = trpc.shareableReports.getAnalytics.useQuery(
    {},
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'notifications' }
  );
  
  // ============================================
  // PROPERTIES TAB STATE & QUERIES
  // ============================================
  const [reportPage, setReportPage] = useState(0);
  const reportLimit = 20;
  
  const reportsQuery = trpc.admin.getReports.useQuery(
    { limit: reportLimit, offset: reportPage * reportLimit },
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'properties' }
  );
  
  const totalReportPages = Math.ceil((reportsQuery.data?.total || 0) / reportLimit);

  // ============================================
  // NEWSLETTER TAB QUERIES & MUTATIONS
  // ============================================
  const { data: newsletterStats, refetch: refetchNewsletter } = trpc.newsletter.getDashboardStats.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'newsletter' }
  );
  
  const triggerWeekly = trpc.newsletter.triggerWeeklyJob.useMutation({
    onSuccess: () => {
      toast.success('Weekly newsletter job started');
      refetchNewsletter();
    },
    onError: (err: any) => toast.error(err.message)
  });
  
  const triggerDealAlert = trpc.newsletter.triggerDealAlertJob.useMutation({
    onSuccess: () => {
      toast.success('Deal alert scan started');
      refetchNewsletter();
    },
    onError: (err) => toast.error(err.message)
  });

  // ============================================
  // USER DRILL-DOWN STATE (must be before early returns)
  // ============================================
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [drillDownPage, setDrillDownPage] = useState(1);

  const userPropertiesQuery = trpc.admin.getUserProperties.useQuery(
    { userId: selectedUserId!, page: drillDownPage, pageSize: 20 },
    { enabled: !!selectedUserId && isAuthenticated && user?.role === 'admin' }
  );

  // ============================================
  // LOADING & AUTH STATES
  // ============================================
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Authentication Required</h2>
            <p className="text-muted-foreground mb-6">Please sign in to access the admin dashboard.</p>
            <Link href="/">
              <Button className="w-full">
                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">You don't have permission to access the admin dashboard.</p>
            <Link href="/">
              <Button className="w-full">
                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };
  
  const formatNumber = (num: number) => num?.toLocaleString() || '0';
  
  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'text-red-600';
    if (percent >= 70) return 'text-amber-600';
    return 'text-emerald-600';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('search') || action.includes('Search')) return <Search className="w-3.5 h-3.5" />;
    if (action.includes('analysis') || action.includes('report') || action.includes('Analysis')) return <FileText className="w-3.5 h-3.5" />;
    if (action.includes('login') || action.includes('logout')) return <User className="w-3.5 h-3.5" />;
    if (action.includes('page_view') || action.includes('navigation')) return <Eye className="w-3.5 h-3.5" />;
    if (action.includes('lead')) return <MousePointer className="w-3.5 h-3.5" />;
    return <Activity className="w-3.5 h-3.5" />;
  };

  const getCategoryBadgeStyle = (category: string) => {
    switch (category) {
      case 'analysis': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'search': return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'auth': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'navigation': return 'bg-slate-50 text-slate-600 border-slate-200';
      case 'lead': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'tool': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const formatActionLabel = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const extractDetailsString = (details: any) => {
    if (!details) return null;
    const parts: string[] = [];
    if (details.address) parts.push(details.address);
    else if (details.market) parts.push(details.market);
    else if (details.city) parts.push(`${details.city}${details.state ? ', ' + details.state : ''}`);
    else if (details.zipCode) parts.push(`ZIP: ${details.zipCode}`);
    else if (details.marketId) parts.push(`Market: ${details.marketId}`);
    if (details.bedrooms) parts.push(`${details.bedrooms} BR`);
    if (details.reportType) parts.push(details.reportType);
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  const dailyUsagePercent = apiUsageData?.airdnaStatus?.currentCount 
    ? Math.min((apiUsageData.airdnaStatus.currentCount / (apiUsageData.dailyLimit || 700)) * 100, 100)
    : 0;
  
  const monthlyUsagePercent = apiUsageData?.totals?.totalCalls
    ? Math.min((apiUsageData.totals.totalCalls / (apiUsageData.monthlyLimit || 24000)) * 100, 100)
    : 0;

  const totalUserPages = Math.ceil((usersQuery.data?.total || 0) / userLimit);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4" />
                  Back to App
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <h1 className="text-xl font-semibold text-foreground">Admin Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user?.name || user?.email}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  refetchStats();
                  if (activeTab === 'api-usage') refetchApiUsage();
                  if (activeTab === 'properties') reportsQuery.refetch();
                  if (activeTab === 'notifications') refetchNotifications();
                  if (activeTab === 'newsletter') refetchNewsletter();
                  if (activeTab === 'activity') activityFeedQuery.refetch();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-secondary border border-border p-1 flex-wrap h-auto">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="api-usage" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Zap className="w-4 h-4 mr-2" />
              API Usage
            </TabsTrigger>
            <TabsTrigger value="hubspot" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Link2 className="w-4 h-4 mr-2" />
              HubSpot
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <MessageSquare className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="properties" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Building className="w-4 h-4 mr-2" />
              Properties
            </TabsTrigger>
            <TabsTrigger value="newsletter" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Mail className="w-4 h-4 mr-2" />
              Newsletter
            </TabsTrigger>
            <TabsTrigger value="cache" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Database className="w-4 h-4 mr-2" />
              Cache
            </TabsTrigger>
            <TabsTrigger value="content-studio" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <PenLine className="w-4 h-4 mr-2" />
              Content Studio
            </TabsTrigger>
            <TabsTrigger value="data-policy" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="w-4 h-4 mr-2" />
              Data Policy
            </TabsTrigger>
          </TabsList>

          {/* ============================================ */}
          {/* OVERVIEW TAB */}
          {/* ============================================ */}
          <TabsContent value="overview" className="space-y-6">
            {statsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-sm mb-2">Total Users</p>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-foreground">{statsData?.users?.total || 0}</span>
                        <div className="flex items-center text-emerald-600 text-sm">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          +{statsData?.users?.newThisWeek || 0} this week
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-sm mb-2">Total Reports</p>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-foreground">{statsData?.reports?.total || 0}</span>
                        <div className="flex items-center text-emerald-600 text-sm">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          +{statsData?.reports?.thisWeek || 0} this week
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-sm mb-2">Total Leads</p>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-foreground">{statsData?.leads?.total || 0}</span>
                        <div className="flex items-center text-emerald-600 text-sm">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          +{statsData?.leads?.thisWeek || 0} this week
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-sm mb-2">Actions Today</p>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-foreground">{statsData?.activity?.today?.totalActions || 0}</span>
                        <div className="flex items-center text-primary text-sm">
                          <Activity className="w-4 h-4 mr-1" />
                          {statsData?.activity?.today?.uniqueSessions || 0} sessions
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Activity by Category */}
                <Card>
                  <CardHeader>
                    <CardTitle>Activity This Week</CardTitle>
                    <CardDescription>Breakdown of user actions by category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {statsData?.activity?.thisWeek?.actionsByCategory?.map((cat: any) => (
                        <div key={cat.category} className="bg-secondary rounded-lg p-4 text-center border border-border">
                          <div className="text-2xl font-bold text-primary">{cat.count}</div>
                          <div className="text-sm text-muted-foreground capitalize">{cat.category}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Actions This Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {statsData?.activity?.thisWeek?.topActions?.map((action: any, idx: number) => (
                        <div key={action.action} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground text-sm w-6">#{idx + 1}</span>
                            <span className="text-foreground">{action.action.replace(/_/g, ' ')}</span>
                          </div>
                          <Badge variant="secondary">
                            {action.count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ============================================ */}
          {/* ACTIVITY TAB */}
          {/* ============================================ */}
          <TabsContent value="activity" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by user name or email..."
                      value={activitySearch}
                      onChange={(e) => { setActivitySearch(e.target.value); setActivityPage(0); }}
                      className="pl-10"
                    />
                  </div>
                  <Select value={activityCategoryFilter} onValueChange={(v) => { setActivityCategoryFilter(v); setActivityPage(0); }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="analysis">Analysis</SelectItem>
                      <SelectItem value="search">Search</SelectItem>
                      <SelectItem value="auth">Auth</SelectItem>
                      <SelectItem value="navigation">Navigation</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="tool">Tool</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={activityActionFilter} onValueChange={(v) => { setActivityActionFilter(v); setActivityPage(0); }}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Action type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      {activityFeedQuery.data?.actionTypes?.map((at) => (
                        <SelectItem key={at.action} value={at.action}>
                          {formatActionLabel(at.action)} ({at.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Activity Feed */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      User Activity Feed
                    </CardTitle>
                    <CardDescription>
                      {activityFeedQuery.data?.total || 0} total actions
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {activityFeedQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activityFeedQuery.data?.feed?.map((entry: any) => {
                      const detailsStr = extractDetailsString(entry.details);
                      return (
                        <div key={entry.id} className="flex items-start gap-4 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                          {/* Icon */}
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5 text-muted-foreground">
                            {getActionIcon(entry.action)}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {entry.userId ? (
                                <button
                                  onClick={() => { setSelectedUserId(entry.userId!); setDrillDownPage(1); }}
                                  className="font-medium text-primary hover:text-primary/80 hover:underline text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                                >
                                  {entry.userName || 'Anonymous'}
                                </button>
                              ) : (
                                <span className="font-medium text-foreground text-sm">
                                  {entry.userName || 'Anonymous'}
                                </span>
                              )}
                              {entry.userEmail && (
                                <span className="text-muted-foreground text-xs">
                                  {entry.userEmail}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className={`text-xs ${getCategoryBadgeStyle(entry.actionCategory)}`}>
                                {entry.actionCategory}
                              </Badge>
                              <span className="text-sm text-foreground">
                                {formatActionLabel(entry.action)}
                              </span>
                            </div>
                            {detailsStr && (
                              <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                                {detailsStr}
                              </p>
                            )}
                          </div>

                          {/* Timestamp */}
                          <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                            {new Date(entry.createdAt).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {(!activityFeedQuery.data?.feed || activityFeedQuery.data.feed.length === 0) && (
                      <div className="text-center py-12 text-muted-foreground">
                        No activity found matching your filters
                      </div>
                    )}
                  </div>
                )}

                {/* Pagination */}
                {totalActivityPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Page {activityPage + 1} of {totalActivityPages}
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setActivityPage(p => Math.max(0, p - 1))} 
                        disabled={activityPage === 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setActivityPage(p => Math.min(totalActivityPages - 1, p + 1))} 
                        disabled={activityPage >= totalActivityPages - 1}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================ */}
          {/* USERS TAB */}
          {/* ============================================ */}
          <TabsContent value="users" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={userSearch}
                      onChange={(e) => { setUserSearch(e.target.value); setUserPage(0); }}
                      className="pl-10"
                    />
                  </div>
                  <Select value={roleFilter} onValueChange={(v: 'all' | 'user' | 'admin') => { setRoleFilter(v); setUserPage(0); }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="user">Regular Users</SelectItem>
                      <SelectItem value="admin">Admins Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={userSortBy} onValueChange={(v: 'lastActive' | 'usageToday') => { setUserSortBy(v); setUserPage(0); }}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usageToday">Most Active Today</SelectItem>
                      <SelectItem value="lastActive">Last Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>{usersQuery.data?.total || 0} total users</CardDescription>
              </CardHeader>
              <CardContent>
                {usersQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Today's Usage</TableHead>
                          <TableHead>Last Active</TableHead>
                          <TableHead className="text-right">Admin Toggle</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usersQuery.data?.users?.map((u: any) => (
                          <TableRow key={u.id}>
                            <TableCell>
                              <button
                                onClick={() => { setSelectedUserId(u.id); setDrillDownPage(1); }}
                                className="text-left hover:underline focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                              >
                                <p className="font-medium text-primary hover:text-primary/80 cursor-pointer">{u.name || 'Unnamed User'}</p>
                                <p className="text-xs text-muted-foreground">ID: {u.id}</p>
                              </button>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{u.email || '—'}</TableCell>
                            <TableCell>
                              {u.role === 'admin' ? (
                                <Badge className="bg-primary/10 text-primary border-primary/20">
                                  <ShieldCheck className="w-3 h-3 mr-1" />Admin
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <Shield className="w-3 h-3 mr-1" />User
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium text-foreground">{u.usageToday?.apiCalls || 0} API calls</p>
                                <p className="text-xs text-muted-foreground">{u.usageToday?.propertyAnalyses || 0} analyses · {u.usageToday?.marketResearches || 0} market</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(u.lastSignedIn)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-xs text-muted-foreground">Admin</span>
                                <Switch
                                  checked={u.role === 'admin'}
                                  onCheckedChange={() => toggleAdminMutation.mutate({ userId: u.id, makeAdmin: u.role !== 'admin' })}
                                  disabled={toggleAdminMutation.isPending}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                {/* Pagination */}
                {totalUserPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Page {userPage + 1} of {totalUserPages}
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setUserPage(p => Math.max(0, p - 1))} 
                        disabled={userPage === 0}
                      >
                        Previous
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setUserPage(p => Math.min(totalUserPages - 1, p + 1))} 
                        disabled={userPage >= totalUserPages - 1}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================ */}
          {/* API USAGE TAB */}
          {/* ============================================ */}
          <TabsContent value="api-usage" className="space-y-6">
            {apiUsageLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Alert Banner */}
                {dailyUsagePercent >= 80 && (
                  <div className={`p-4 rounded-xl border ${dailyUsagePercent >= 90 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`w-5 h-5 ${dailyUsagePercent >= 90 ? 'text-red-600' : 'text-amber-600'}`} />
                      <div>
                        <p className={`font-medium ${dailyUsagePercent >= 90 ? 'text-red-700' : 'text-amber-700'}`}>
                          {dailyUsagePercent >= 90 ? 'Critical: Daily API limit almost reached!' : 'Warning: Approaching daily API limit'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {apiUsageData?.airdnaStatus?.currentCount || 0} of {apiUsageData?.dailyLimit || 700} calls used today.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Usage Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                        <Clock className="w-4 h-4" />Today's API Calls
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-3xl font-bold ${getUsageColor(dailyUsagePercent)}`}>
                            {apiUsageData?.airdnaStatus?.currentCount || 0}
                          </span>
                          <span className="text-muted-foreground text-sm">/ {apiUsageData?.dailyLimit || 700}</span>
                        </div>
                        <Progress value={dailyUsagePercent} className="h-2" />
                        <p className="text-muted-foreground text-xs">{Math.round(dailyUsagePercent)}% of daily limit</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                        <Calendar className="w-4 h-4" />Monthly API Calls
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-3xl font-bold ${getUsageColor(monthlyUsagePercent)}`}>
                            {formatNumber(apiUsageData?.totals?.totalCalls || 0)}
                          </span>
                          <span className="text-muted-foreground text-sm">/ {formatNumber(apiUsageData?.monthlyLimit || 24000)}</span>
                        </div>
                        <Progress value={monthlyUsagePercent} className="h-2" />
                        <p className="text-muted-foreground text-xs">{Math.round(monthlyUsagePercent)}% of monthly limit</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                        <Database className="w-4 h-4" />Cache Performance
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-3xl font-bold text-emerald-600">
                            {apiUsageData?.totals?.totalCalls ? Math.round((apiUsageData.totals.cacheHits / apiUsageData.totals.totalCalls) * 100) : 0}%
                          </span>
                          <span className="text-muted-foreground text-sm">hit rate</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatNumber(apiUsageData?.totals?.cacheHits || 0)} cache hits
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                        <DollarSign className="w-4 h-4" />Estimated Cost
                      </div>
                      <div className="space-y-3">
                        <span className="text-3xl font-bold text-foreground">
                          ${(apiUsageData?.totals?.estimatedCost || 0).toFixed(2)}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          @ $0.35/call overage
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent API Calls */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent API Calls</CardTitle>
                    <CardDescription>Last 50 API requests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Endpoint</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Response Time</TableHead>
                            <TableHead>Cached</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {apiCallsData?.calls?.map((call: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(call.createdAt).toLocaleTimeString()}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-foreground max-w-[200px] truncate">
                                {call.endpoint}
                              </TableCell>
                              <TableCell>
                                {call.success ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Success</Badge>
                                ) : (
                                  <Badge className="bg-red-50 text-red-700 border-red-200">Failed</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{call.responseTimeMs}ms</TableCell>
                              <TableCell>
                                {call.cacheHit ? (
                                  <Badge variant="secondary">Cached</Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ============================================ */}
          {/* HUBSPOT TAB */}
          {/* ============================================ */}
          <TabsContent value="hubspot" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{hubspotSummary?.totalOptins || 0}</p>
                      <p className="text-sm text-muted-foreground">Email Opt-ins</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <Link2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{hubspotSummary?.totalLinks || 0}</p>
                      <p className="text-sm text-muted-foreground">Links Created</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
                      <MousePointer className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{hubspotSummary?.totalClicks || 0}</p>
                      <p className="text-sm text-muted-foreground">Total Clicks</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                      <Zap className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{hubspotSummary?.totalToolUsageEvents || 0}</p>
                      <p className="text-sm text-muted-foreground">Tool Events</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center">
                      <Send className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{hubspotSummary?.totalPromotions || 0}</p>
                      <p className="text-sm text-muted-foreground">Promotions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Links and Opt-ins */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Personalized Links</CardTitle>
                  <CardDescription>Latest generated links</CardDescription>
                </CardHeader>
                <CardContent>
                  {linksLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {hubspotLinks?.map((link: any) => (
                        <div key={link.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{link.email || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{link.targetCity}, {link.targetState}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="secondary">{link.clickCount || 0} clicks</Badge>
                          </div>
                        </div>
                      ))}
                      {(!hubspotLinks || hubspotLinks.length === 0) && (
                        <p className="text-muted-foreground text-center py-4">No links created yet</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Email Opt-ins</CardTitle>
                  <CardDescription>Latest email subscribers</CardDescription>
                </CardHeader>
                <CardContent>
                  {optinsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {emailOptins?.map((optin: any) => (
                        <div key={optin.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{optin.email}</p>
                            <p className="text-xs text-muted-foreground">{optin.source || 'Direct'}</p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            {formatDate(optin.createdAt)}
                          </div>
                        </div>
                      ))}
                      {(!emailOptins || emailOptins.length === 0) && (
                        <p className="text-muted-foreground text-center py-4">No opt-ins yet</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Link to full HubSpot portal */}
            <div className="text-center">
              <Link href="/admin/hubspot">
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Open Full HubSpot Portal
                </Button>
              </Link>
            </div>
          </TabsContent>

          {/* ============================================ */}
          {/* NOTIFICATIONS TAB */}
          {/* ============================================ */}
          <TabsContent value="notifications" className="space-y-6">
            {notificationsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-sm mb-2">Total Reports</p>
                      <p className="text-3xl font-bold text-foreground mb-2">{formatNumber(notificationAnalytics?.totalReports || 0)}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        <span>All shareable reports</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-sm mb-2">Total Views</p>
                      <p className="text-3xl font-bold text-foreground mb-2">{formatNumber(notificationAnalytics?.totalViews || 0)}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Eye className="w-4 h-4" />
                        <span>Report page views</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-sm mb-2">SMS Sent</p>
                      <p className="text-3xl font-bold text-foreground mb-2">{formatNumber(notificationAnalytics?.totalSmsSent || 0)}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MessageSquare className="w-4 h-4" />
                        <span>
                          {(notificationAnalytics?.smsSuccessRate || 0) > 0 
                            ? `${((notificationAnalytics?.smsSuccessRate || 0) * 100).toFixed(1)}% success`
                            : 'No SMS sent yet'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground text-sm mb-2">Emails Sent</p>
                      <p className="text-3xl font-bold text-foreground mb-2">{formatNumber(notificationAnalytics?.totalEmailsSent || 0)}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span>
                          {(notificationAnalytics?.emailSuccessRate || 0) > 0 
                            ? `${((notificationAnalytics?.emailSuccessRate || 0) * 100).toFixed(1)}% success`
                            : 'No emails sent yet'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Link to full notifications page */}
                <div className="text-center">
                  <Link href="/admin/notifications">
                    <Button variant="outline" className="gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Open Full Notifications Dashboard
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </TabsContent>

          {/* ============================================ */}
          {/* PROPERTIES TAB */}
          {/* ============================================ */}
          <TabsContent value="properties" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="w-5 h-5 text-primary" />
                      Analyzed Properties
                    </CardTitle>
                    <CardDescription>
                      All properties that have been analyzed through the tool ({reportsQuery.data?.total || 0} total)
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reportsQuery.refetch()}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {reportsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Address</TableHead>
                            <TableHead>City/State</TableHead>
                            <TableHead>BR</TableHead>
                            <TableHead>Rent</TableHead>
                            <TableHead>Est. Revenue</TableHead>
                            <TableHead>Verdict</TableHead>
                            <TableHead>Lead</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportsQuery.data?.reports?.map((report: any) => (
                            <TableRow key={report.id}>
                              <TableCell className="font-medium max-w-[200px] truncate">
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                  <span className="truncate">{report.address || 'N/A'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {[report.city, report.state].filter(Boolean).join(', ') || '—'}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{report.bedrooms || '—'}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {report.monthlyRent ? `$${report.monthlyRent.toLocaleString()}` : '—'}
                              </TableCell>
                              <TableCell className="font-medium">
                                {report.annualRevenueRealistic
                                  ? `$${report.annualRevenueRealistic.toLocaleString()}/yr`
                                  : '—'}
                              </TableCell>
                              <TableCell>
                                {report.verdict ? (
                                  <Badge className={
                                    report.verdict === 'GO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    report.verdict === 'CAUTION' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-red-50 text-red-700 border-red-200'
                                  }>
                                    {report.verdict}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {report.leadName || report.leadEmail ? (
                                  <div className="text-xs">
                                    {report.leadName && <div className="font-medium text-foreground">{report.leadName}</div>}
                                    {report.leadEmail && <div className="text-muted-foreground">{report.leadEmail}</div>}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                                {formatDate(report.createdAt)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!reportsQuery.data?.reports || reportsQuery.data.reports.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                No properties analyzed yet
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {totalReportPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                          Showing {reportPage * reportLimit + 1}–{Math.min((reportPage + 1) * reportLimit, reportsQuery.data?.total || 0)} of {reportsQuery.data?.total || 0}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={reportPage === 0}
                            onClick={() => setReportPage(p => Math.max(0, p - 1))}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {reportPage + 1} of {totalReportPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={reportPage >= totalReportPages - 1}
                            onClick={() => setReportPage(p => p + 1)}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================ */}
          {/* NEWSLETTER TAB */}
          {/* ============================================ */}
          <TabsContent value="newsletter" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                    <Mail className="w-4 h-4" />Emails Sent (30d)
                  </div>
                  <div className="text-2xl font-bold text-foreground">{newsletterStats?.last30Days?.total || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {newsletterStats?.last30Days?.successful || 0} successful, {newsletterStats?.last30Days?.failed || 0} failed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                    <CheckCircle className="w-4 h-4" />Success Rate
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {newsletterStats?.last30Days?.total 
                      ? Math.round((newsletterStats.last30Days.successful / newsletterStats.last30Days.total) * 100) 
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">Email delivery rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                    <MapPin className="w-4 h-4" />Active Cities
                  </div>
                  <div className="text-2xl font-bold text-foreground">{newsletterStats?.totalCities || 0}</div>
                  <p className="text-xs text-muted-foreground">Cities with contacts</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                    <Clock className="w-4 h-4" />Recent Jobs
                  </div>
                  <div className="text-2xl font-bold text-foreground">{newsletterStats?.recentJobs?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">Jobs in last 7 days</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Manually trigger newsletter jobs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button 
                      className="w-full justify-start"
                      onClick={() => triggerWeekly.mutate()}
                      disabled={triggerWeekly.isPending}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Run Weekly Market Newsletter
                    </Button>
                    <Button 
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => triggerDealAlert.mutate({})}
                      disabled={triggerDealAlert.isPending}
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Run Deal Alert Scan
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Jobs</CardTitle>
                  <CardDescription>Latest newsletter job runs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {newsletterStats?.recentJobs?.slice(0, 5).map((job: any, i: number) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={job.type === 'weekly_market' ? 'default' : 'secondary'}>
                            {job.type === 'weekly_market' ? 'Weekly' : 'Deal Alert'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(job.startedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{job.emailsSent} sent</span>
                          {job.emailsFailed > 0 && (
                            <Badge className="bg-red-50 text-red-700 border-red-200">{job.emailsFailed} failed</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!newsletterStats?.recentJobs || newsletterStats.recentJobs.length === 0) && (
                      <p className="text-sm text-muted-foreground">No recent jobs</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Link to full newsletter dashboard */}
            <div className="text-center">
              <Link href="/admin/newsletter">
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Open Full Newsletter Dashboard
                </Button>
              </Link>
            </div>
          </TabsContent>

          {/* ============================================ */}
          {/* CACHE TAB */}
          {/* ============================================ */}
          <TabsContent value="cache" className="space-y-6">
            <CacheTab />
          </TabsContent>

          {/* ============================================ */}
          {/* CONTENT STUDIO TAB */}
          {/* ============================================ */}
          <TabsContent value="content-studio" className="space-y-6">
            <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
              <ContentStudioTabLazy />
            </Suspense>
          </TabsContent>

          <TabsContent value="data-policy" className="space-y-6">
            <DataPolicyTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* ============================================ */}
      {/* USER PROPERTIES DRILL-DOWN PANEL */}
      {/* ============================================ */}
      {selectedUserId && (
        <div className="fixed inset-0 z-[60] flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setSelectedUserId(null)}
          />
          {/* Side Panel */}
          <div className="ml-auto relative w-full max-w-2xl bg-card border-l border-border shadow-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {userPropertiesQuery.data?.user?.name || 'Loading...'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {userPropertiesQuery.data?.user?.email || ''}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {userPropertiesQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Reports Section */}
                  {(userPropertiesQuery.data?.reports?.length ?? 0) > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        Property Reports ({userPropertiesQuery.data?.reports?.length})
                      </h3>
                      <div className="space-y-3">
                        {userPropertiesQuery.data?.reports?.map((report: any) => (
                          <Card key={report.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-foreground truncate">{report.address}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {report.city}{report.state ? `, ${report.state}` : ''}
                                    {report.marketName ? ` — ${report.marketName}` : ''}
                                  </p>
                                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                                    {report.bedrooms && (
                                      <span className="text-xs text-muted-foreground">{report.bedrooms} BR / {report.bathrooms} BA</span>
                                    )}
                                    {report.annualRevenueRealistic && (
                                      <Badge variant="secondary" className="text-xs">
                                        <DollarSign className="w-3 h-3 mr-0.5" />
                                        {Number(report.annualRevenueRealistic).toLocaleString()}/yr
                                      </Badge>
                                    )}
                                    {report.occupancyRate && (
                                      <Badge variant="secondary" className="text-xs">
                                        {Number(report.occupancyRate).toFixed(0)}% occ.
                                      </Badge>
                                    )}
                                    {report.verdict && (
                                      <Badge className={`text-xs ${
                                        report.verdict === 'GO' ? 'bg-green-100 text-green-700 border-green-200' :
                                        report.verdict === 'CAUTION' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                        'bg-red-100 text-red-700 border-red-200'
                                      }`}>
                                        {report.verdict}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDate(report.createdAt)}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Activity Timeline */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      Recent Activity ({userPropertiesQuery.data?.totalActivities || 0} total)
                    </h3>
                    {(userPropertiesQuery.data?.activities?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">No property-related activity found for this user.</p>
                    ) : (
                      <div className="space-y-2">
                        {userPropertiesQuery.data?.activities?.map((act: any) => {
                          const details = act.details as Record<string, any> | null;
                          const address = details?.address || details?.propertyAddress || details?.market || '';
                          return (
                            <div key={act.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                                {act.actionCategory === 'analysis' ? <BarChart3 className="w-3.5 h-3.5 text-primary" /> :
                                 act.actionCategory === 'search' ? <Search className="w-3.5 h-3.5 text-blue-500" /> :
                                 <FileText className="w-3.5 h-3.5 text-muted-foreground" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground">
                                  {act.action.replace(/_/g, ' ')}
                                </p>
                                {address && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    <MapPin className="w-3 h-3 inline mr-1" />{address}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDate(act.createdAt)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Pagination */}
                    {(userPropertiesQuery.data?.totalActivities ?? 0) > 20 && (
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          Page {drillDownPage} of {Math.ceil((userPropertiesQuery.data?.totalActivities || 0) / 20)}
                        </p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setDrillDownPage(p => Math.max(1, p - 1))} disabled={drillDownPage <= 1}>
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setDrillDownPage(p => p + 1)} disabled={drillDownPage >= Math.ceil((userPropertiesQuery.data?.totalActivities || 0) / 20)}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Empty state */}
                  {(userPropertiesQuery.data?.reports?.length ?? 0) === 0 && (userPropertiesQuery.data?.activities?.length ?? 0) === 0 && (
                    <div className="text-center py-12">
                      <Building className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No property activity found for this user yet.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// CACHE TAB COMPONENT
// ============================================
function CacheTab() {
  const [cacheTypeFilter, setCacheTypeFilter] = useState<string>('');
  const [showExpired, setShowExpired] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const { data: cacheStats, isLoading: statsLoading, refetch: refetchStats } = trpc.admin.getCacheStats.useQuery();
  const { data: cacheEntries, isLoading: entriesLoading, refetch: refetchEntries } = trpc.admin.getCacheEntries.useQuery({
    cacheType: cacheTypeFilter || undefined,
    showExpired,
    limit: pageSize,
    offset: page * pageSize,
    search: searchQuery || undefined,
  });

  const clearExpiredMutation = trpc.admin.clearExpiredCache.useMutation({
    onSuccess: (data) => {
      toast.success(`Cleared ${data.deletedCount} expired cache entries`);
      refetchStats();
      refetchEntries();
    },
    onError: () => toast.error('Failed to clear expired cache'),
  });

  const deleteEntryMutation = trpc.admin.deleteCacheEntry.useMutation({
    onSuccess: () => {
      toast.success('Cache entry deleted');
      refetchStats();
      refetchEntries();
    },
    onError: () => toast.error('Failed to delete cache entry'),
  });

  const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Cache Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Entries</CardDescription>
            <CardTitle className="text-3xl">
              {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (cacheStats?.totals.total ?? 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">All cached API responses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (cacheStats?.totals.active ?? 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Not yet expired</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expired</CardDescription>
            <CardTitle className="text-3xl text-orange-500">
              {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (cacheStats?.totals.expired ?? 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Ready to purge</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearExpiredMutation.mutate()}
                disabled={clearExpiredMutation.isPending || (cacheStats?.totals.expired ?? 0) === 0}
              >
                {clearExpiredMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cache Breakdown by Type */}
      {cacheStats && cacheStats.byType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cache Breakdown by Type</CardTitle>
            <CardDescription>Distribution of cached data across API endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cache Type</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Expired</TableHead>
                  <TableHead>Oldest</TableHead>
                  <TableHead>Newest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cacheStats.byType.map((t) => (
                  <TableRow key={t.cacheType} className="cursor-pointer hover:bg-muted/50" onClick={() => { setCacheTypeFilter(t.cacheType); setPage(0); }}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {t.cacheType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{t.total}</TableCell>
                    <TableCell className="text-right text-green-600">{t.active}</TableCell>
                    <TableCell className="text-right text-orange-500">{t.expired}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(t.oldestEntry)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(t.newestEntry)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Cache Entries Browser */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Cache Entries</CardTitle>
              <CardDescription>
                Browse and manage individual cache entries
                {cacheTypeFilter && (
                  <span className="ml-2">
                    — filtered by <Badge variant="secondary" className="font-mono text-xs ml-1">{cacheTypeFilter}</Badge>
                    <Button variant="ghost" size="sm" className="ml-1 h-5 px-1" onClick={() => { setCacheTypeFilter(''); setPage(0); }}>✕</Button>
                  </span>
                )}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => { refetchStats(); refetchEntries(); }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search cache keys..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showExpired} onCheckedChange={(v) => { setShowExpired(v); setPage(0); }} />
              <span className="text-sm text-muted-foreground">Show expired</span>
            </div>
          </div>

          {/* Entries Table */}
          {entriesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (cacheEntries?.entries?.length ?? 0) === 0 ? (
            <div className="text-center py-12">
              <Database className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No cache entries found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cache Key</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cacheEntries?.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="max-w-[300px]">
                        <p className="font-mono text-xs truncate" title={entry.cacheKey}>{entry.cacheKey}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">{entry.cacheType}</Badge>
                      </TableCell>
                      <TableCell>
                        {entry.isExpired ? (
                          <Badge variant="secondary" className="text-orange-600 bg-orange-50">Expired</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-green-600 bg-green-50">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(entry.expiresAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteEntryMutation.mutate({ id: entry.id })}
                          disabled={deleteEntryMutation.isPending}
                        >
                          ✕
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, cacheEntries?.total ?? 0)} of {cacheEntries?.total ?? 0}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * pageSize >= (cacheEntries?.total ?? 0)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


// ============================================
// DATA POLICY TAB
// How we calculate our numbers — explained simply
// ============================================
function DataPolicyTab() {
  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            How We Calculate Our Numbers
          </CardTitle>
          <CardDescription>
            A simple guide to explain to clients where our revenue estimates come from and why they can trust them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          
          {/* Section 1: Where the numbers come from */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Where Do the Numbers Come From?</h3>
            <div className="bg-muted/50 rounded-lg p-5 space-y-3 text-sm leading-relaxed">
              <p>
                We use real data from a company called <strong>AirDNA</strong>. They track every single Airbnb and VRBO listing in the country. 
                They know how much each property makes, how often it gets booked, and what it charges per night. This is not guesswork — 
                it is real performance data from real properties.
              </p>
              <p>
                When you put an address into our tool, we pull data on properties that are <strong>the same size</strong> as yours 
                (same number of bedrooms AND bathrooms) and that are <strong>near your location</strong>. These are your "comps" — 
                short for comparable properties.
              </p>
            </div>
          </div>

          {/* Section 2: How we calculate the headline number */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">How We Calculate the Revenue Estimate</h3>
            <div className="bg-muted/50 rounded-lg p-5 space-y-3 text-sm leading-relaxed">
              <p>
                Our headline revenue number is based on the <strong>median</strong> of what real properties like yours are actually earning right now. 
                "Median" just means the middle number. If there are 5 similar properties earning $30K, $35K, $38K, $42K, and $48K per year, 
                the median is <strong>$38K</strong> — the one right in the middle.
              </p>
              <p>
                We use the median instead of the average because it is more honest. The average can get pulled up by one super-successful 
                property or pulled down by one that is barely trying. The median tells you what a <strong>typical, normal operator</strong> is making.
              </p>
              <p>
                Think of it this way: if you set up your property properly and run it like a normal business, the median is what you 
                should realistically expect to earn. You are not the best, you are not the worst — you are right in the middle of the pack.
              </p>
            </div>
          </div>

          {/* Section 3: What "same size" means */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">What "Same Size" Means</h3>
            <div className="bg-muted/50 rounded-lg p-5 space-y-3 text-sm leading-relaxed">
              <p>
                When we say we compare your property to "same size" properties, we mean properties with the <strong>exact same number of 
                bedrooms AND bathrooms</strong>. A 2-bedroom, 1-bathroom property only gets compared to other 2-bedroom, 1-bathroom properties.
              </p>
              <p>
                This matters because an extra bathroom can add $30 to $50 per night to what a property can charge. If we compared a 
                2-bed/1-bath to a 2-bed/2-bath, the numbers would be misleading. We keep it apples to apples so the estimate is fair and accurate.
              </p>
              <p>
                We do allow a small wiggle room for half-baths. So a 1-bathroom property can be compared to a 1.5-bathroom property, 
                but not a 2-bathroom property. This keeps the comparison tight while still giving us enough data to work with.
              </p>
            </div>
          </div>

          {/* Section 4: The monthly forecast */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">The Monthly Forecast (Seasonality)</h3>
            <div className="bg-muted/50 rounded-lg p-5 space-y-3 text-sm leading-relaxed">
              <p>
                The monthly chart in the report shows how revenue changes throughout the year. Some months are busy (like summer or holidays) 
                and some months are slow. This pattern is called <strong>seasonality</strong>.
              </p>
              <p>
                We get the seasonal pattern from AirDNA's data — they know exactly which months are hot and which are not for your specific area. 
                Then we scale those monthly numbers so they add up to the comp-median annual total. This means the <strong>shape</strong> of the 
                chart (which months are high, which are low) is accurate to your market, and the <strong>dollar amounts</strong> match what 
                real operators are earning.
              </p>
            </div>
          </div>

          {/* Section 5: What the comparables section shows */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">The Comparable Properties Section</h3>
            <div className="bg-muted/50 rounded-lg p-5 space-y-3 text-sm leading-relaxed">
              <p>
                The report includes a list of real Airbnb properties near yours that have the same bedroom and bathroom count. 
                For each one, you can see their annual revenue, nightly rate, occupancy rate, and guest ratings.
              </p>
              <p>
                These are <strong>real, active listings</strong> — not made-up examples. You can even click through to see them on Airbnb. 
                This lets you (or your client) verify the numbers independently. The comps are sorted with the best matches at the top.
              </p>
            </div>
          </div>

          {/* Section 6: Quick reference for client conversations */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Quick Reference for Client Conversations</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-3 font-medium">If the client asks...</th>
                    <th className="text-left p-3 font-medium">You can say...</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="p-3 text-muted-foreground">"Where do these numbers come from?"</td>
                    <td className="p-3">"Real performance data from AirDNA, which tracks every Airbnb and VRBO in the country."</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-muted-foreground">"How accurate is the revenue estimate?"</td>
                    <td className="p-3">"It is the median of what properties with the same bedrooms and bathrooms near yours are actually earning right now. It is the middle of the pack — not the best case, not the worst."</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-muted-foreground">"Why is my number different from what I see on AirDNA?"</td>
                    <td className="p-3">"AirDNA's Rentalizer gives a conservative estimate for brand-new listings with no reviews. Our number reflects what established properties like yours are actually making today."</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-muted-foreground">"Can I really make this much?"</td>
                    <td className="p-3">"This is what the average operator is making with the same type of property in your area. With professional setup and management, you could match or beat this number."</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-muted-foreground">"What about the comps — are those real?"</td>
                    <td className="p-3">"Yes, those are real active Airbnb listings. You can click through and see them yourself. We only show properties with the same bedroom and bathroom count as yours."</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-muted-foreground">"Why do some months show more revenue?"</td>
                    <td className="p-3">"That is seasonality — some months are busier than others in your market. The chart shows the actual seasonal pattern for your area based on real booking data."</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 7: Important notes */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Important Notes</h3>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-5 space-y-3 text-sm leading-relaxed">
              <p>
                <strong>These are estimates, not guarantees.</strong> Actual results depend on how well the property is set up, 
                the quality of the listing photos, pricing strategy, guest reviews, and how the property is managed day to day.
              </p>
              <p>
                <strong>The data updates regularly.</strong> AirDNA refreshes their data frequently, so the numbers reflect current 
                market conditions — not outdated information from years ago.
              </p>
              <p>
                <strong>We never inflate numbers.</strong> Our estimates are based on what real properties are actually earning. 
                We do not add made-up multipliers or "best case" assumptions. What you see is what the data shows.
              </p>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
