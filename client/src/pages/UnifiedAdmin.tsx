/**
 * Unified Admin Dashboard
 * 
 * Consolidates all admin features into one place:
 * - Overview: Dashboard stats (users, reports, leads, activity)
 * - Users: User management with admin toggle
 * - API Usage: AirDNA API monitoring and limits
 * - HubSpot: Personalized links, email opt-ins, tool usage
 * - Notifications: Shareable report analytics
 * - Newsletter: Deal Flow Machine management
 */

import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  UserPlus, 
  TrendingUp,
  TrendingDown,
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
  DollarSign,
  Calendar,
  Mail,
  Link2,
  MousePointer,
  Send,
  MapPin,
  Plus,
  Copy,
  ExternalLink,
  Eye,
  MessageSquare,
  Play,
  Settings,
  Home,
  ArrowLeft
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
  const [userPage, setUserPage] = useState(0);
  const userLimit = 15;
  
  const usersQuery = trpc.admin.getUsers.useQuery(
    { search: userSearch || undefined, role: roleFilter, limit: userLimit, offset: userPage * userLimit },
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'users' }
  );
  
  const toggleAdminMutation = trpc.admin.toggleUserAdmin.useMutation({
    onSuccess: () => {
      toast.success('User permissions updated');
      usersQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  
  // ============================================
  // API USAGE TAB QUERIES
  // ============================================
  const { data: apiUsageData, isLoading: apiUsageLoading, refetch: refetchApiUsage } = trpc.admin.getApiUsage.useQuery(
    {},
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'api-usage', refetchInterval: 30000 }
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
    { limit: 10, activeOnly: true },
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
  // NEWSLETTER TAB QUERIES
  // ============================================
  const { data: newsletterStats, refetch: refetchNewsletter } = trpc.newsletter.getDashboardStats.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'newsletter' }
  );
  
  const { data: newsletterCities } = trpc.newsletter.getCities.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'newsletter' }
  );
  
  const triggerWeekly = trpc.newsletter.triggerWeeklyJob.useMutation({
    onSuccess: () => toast.success('Weekly Newsletter Job Started'),
    onError: (error) => toast.error(error.message),
  });
  
  const triggerDealAlert = trpc.newsletter.triggerDealAlertJob.useMutation({
    onSuccess: () => toast.success('Deal Alert Job Started'),
    onError: (error) => toast.error(error.message),
  });

  // ============================================
  // LOADING & AUTH STATES
  // ============================================
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 text-amber-600 mx-auto mb-4" />
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>Please log in to access the admin dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full bg-amber-600 hover:bg-amber-700">Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access the admin dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">Go to Home</Button>
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
    if (percent >= 90) return 'text-red-500';
    if (percent >= 70) return 'text-amber-500';
    return 'text-green-500';
  };

  const dailyUsagePercent = apiUsageData?.airdnaStatus?.currentCount 
    ? Math.min((apiUsageData.airdnaStatus.currentCount / (apiUsageData.dailyLimit || 700)) * 100, 100)
    : 0;
  
  const monthlyUsagePercent = apiUsageData?.totals?.totalCalls
    ? Math.min((apiUsageData.totals.totalCalls / (apiUsageData.monthlyLimit || 24000)) * 100, 100)
    : 0;

  const totalUserPages = Math.ceil((usersQuery.data?.total || 0) / userLimit);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to App
                </Button>
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-600" />
                <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">
                Logged in as <span className="font-medium text-amber-600">{user?.name || user?.email}</span>
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  refetchStats();
                  if (activeTab === 'api-usage') refetchApiUsage();
                  if (activeTab === 'notifications') refetchNotifications();
                  if (activeTab === 'newsletter') refetchNewsletter();
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
          <TabsList className="bg-white border border-slate-200 p-1 flex-wrap h-auto">
            <TabsTrigger value="overview" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="api-usage" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
              <Zap className="w-4 h-4 mr-2" />
              API Usage
            </TabsTrigger>
            <TabsTrigger value="hubspot" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
              <Link2 className="w-4 h-4 mr-2" />
              HubSpot
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
              <MessageSquare className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="newsletter" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
              <Mail className="w-4 h-4 mr-2" />
              Newsletter
            </TabsTrigger>
          </TabsList>

          {/* ============================================ */}
          {/* OVERVIEW TAB */}
          {/* ============================================ */}
          <TabsContent value="overview" className="space-y-6">
            {statsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Users</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold">{statsData?.users?.total || 0}</span>
                        <div className="flex items-center text-green-600 text-sm">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          +{statsData?.users?.newThisWeek || 0} this week
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Reports</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold">{statsData?.reports?.total || 0}</span>
                        <div className="flex items-center text-green-600 text-sm">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          +{statsData?.reports?.thisWeek || 0} this week
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Leads</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold">{statsData?.leads?.total || 0}</span>
                        <div className="flex items-center text-green-600 text-sm">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          +{statsData?.leads?.thisWeek || 0} this week
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Actions Today</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold">{statsData?.activity?.today?.totalActions || 0}</span>
                        <div className="flex items-center text-amber-600 text-sm">
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
                        <div key={cat.category} className="bg-slate-50 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-amber-600">{cat.count}</div>
                          <div className="text-sm text-slate-500 capitalize">{cat.category}</div>
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
                        <div key={action.action} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400 text-sm w-6">#{idx + 1}</span>
                            <span className="text-slate-700">{action.action.replace(/_/g, ' ')}</span>
                          </div>
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
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
          {/* USERS TAB */}
          {/* ============================================ */}
          <TabsContent value="users" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                </div>
              </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>{usersQuery.data?.total || 0} total users</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {usersQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                  </div>
                ) : (
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
                            <p className="font-medium">{u.name || 'Unnamed User'}</p>
                            <p className="text-xs text-slate-500">ID: {u.id}</p>
                          </TableCell>
                          <TableCell className="text-slate-600">{u.email || '—'}</TableCell>
                          <TableCell>
                            {u.role === 'admin' ? (
                              <Badge className="bg-amber-100 text-amber-800">
                                <ShieldCheck className="w-3 h-3 mr-1" />Admin
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <Shield className="w-3 h-3 mr-1" />User
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{u.usageToday?.propertyAnalyses || 0} analyses</p>
                            <p className="text-xs text-slate-400">{u.usageToday?.marketResearches || 0} market searches</p>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">{formatDate(u.lastSignedIn)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-slate-500">Admin</span>
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
                )}
              </CardContent>
              
              {/* Pagination */}
              {totalUserPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <p className="text-sm text-slate-500">
                    Page {userPage + 1} of {totalUserPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setUserPage(p => Math.max(0, p - 1))} disabled={userPage === 0}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setUserPage(p => Math.min(totalUserPages - 1, p + 1))} disabled={userPage >= totalUserPages - 1}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* ============================================ */}
          {/* API USAGE TAB */}
          {/* ============================================ */}
          <TabsContent value="api-usage" className="space-y-6">
            {apiUsageLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              </div>
            ) : (
              <>
                {/* Alert Banner */}
                {dailyUsagePercent >= 80 && (
                  <div className={`p-4 rounded-lg border ${dailyUsagePercent >= 90 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`w-5 h-5 ${dailyUsagePercent >= 90 ? 'text-red-500' : 'text-amber-500'}`} />
                      <div>
                        <p className={`font-medium ${dailyUsagePercent >= 90 ? 'text-red-700' : 'text-amber-700'}`}>
                          {dailyUsagePercent >= 90 ? 'Critical: Daily API limit almost reached!' : 'Warning: Approaching daily API limit'}
                        </p>
                        <p className="text-sm text-slate-600">
                          {apiUsageData?.airdnaStatus?.currentCount || 0} of {apiUsageData?.dailyLimit || 700} calls used today.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Usage Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />Today's API Calls
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-3xl font-bold ${getUsageColor(dailyUsagePercent)}`}>
                            {apiUsageData?.airdnaStatus?.currentCount || 0}
                          </span>
                          <span className="text-slate-400 text-sm">/ {apiUsageData?.dailyLimit || 700}</span>
                        </div>
                        <Progress value={dailyUsagePercent} className="h-2" />
                        <p className="text-slate-400 text-xs">{Math.round(dailyUsagePercent)}% of daily limit</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />Monthly API Calls
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-3xl font-bold ${getUsageColor(monthlyUsagePercent)}`}>
                            {formatNumber(apiUsageData?.totals?.totalCalls || 0)}
                          </span>
                          <span className="text-slate-400 text-sm">/ {formatNumber(apiUsageData?.monthlyLimit || 24000)}</span>
                        </div>
                        <Progress value={monthlyUsagePercent} className="h-2" />
                        <p className="text-slate-400 text-xs">{Math.round(monthlyUsagePercent)}% of monthly limit</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <Database className="w-4 h-4" />Cache Performance
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-3xl font-bold text-green-500">
                            {apiUsageData?.totals?.totalCalls ? Math.round((apiUsageData.totals.cacheHits / apiUsageData.totals.totalCalls) * 100) : 0}%
                          </span>
                          <span className="text-slate-400 text-sm">hit rate</span>
                        </div>
                        <div className="text-sm text-slate-500">
                          {formatNumber(apiUsageData?.totals?.cacheHits || 0)} cache hits
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />Estimated Cost
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <span className="text-3xl font-bold text-slate-700">
                          ${(apiUsageData?.totals?.estimatedCost || 0).toFixed(2)}
                        </span>
                        <p className="text-sm text-slate-500">
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
                              <TableCell className="text-sm text-slate-500">
                                {new Date(call.createdAt).toLocaleTimeString()}
                              </TableCell>
                              <TableCell className="font-mono text-xs max-w-[200px] truncate">
                                {call.endpoint}
                              </TableCell>
                              <TableCell>
                                {call.success ? (
                                  <Badge className="bg-green-100 text-green-700">Success</Badge>
                                ) : (
                                  <Badge variant="destructive">Failed</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">{call.responseTimeMs}ms</TableCell>
                              <TableCell>
                                {call.cacheHit ? (
                                  <Badge variant="secondary">Cached</Badge>
                                ) : (
                                  <span className="text-slate-400">—</span>
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
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{hubspotSummary?.totalOptins || 0}</p>
                      <p className="text-sm text-slate-600">Email Opt-ins</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Link2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{hubspotSummary?.totalLinks || 0}</p>
                      <p className="text-sm text-slate-600">Links Created</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <MousePointer className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{hubspotSummary?.totalClicks || 0}</p>
                      <p className="text-sm text-slate-600">Total Clicks</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Send className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{hubspotSummary?.totalPromotions || 0}</p>
                      <p className="text-sm text-slate-600">Promotions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{hubspotSummary?.totalToolUsageEvents || 0}</p>
                      <p className="text-sm text-slate-600">Tool Events</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Links & Opt-ins */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Personalized Links</CardTitle>
                  <CardDescription>Latest links created for HubSpot contacts</CardDescription>
                </CardHeader>
                <CardContent>
                  {linksLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-amber-600 mx-auto" />
                  ) : (
                    <div className="space-y-3">
                      {hubspotLinks?.slice(0, 5).map((link: any) => (
                        <div key={link.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium text-sm">{link.targetCity}, {link.targetState}</p>
                            <p className="text-xs text-slate-500">{link.email || 'No email'}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary">{link.clicks || 0} clicks</Badge>
                          </div>
                        </div>
                      ))}
                      {(!hubspotLinks || hubspotLinks.length === 0) && (
                        <p className="text-slate-500 text-center py-4">No links created yet</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Email Opt-ins</CardTitle>
                  <CardDescription>Latest email subscriptions</CardDescription>
                </CardHeader>
                <CardContent>
                  {optinsLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-amber-600 mx-auto" />
                  ) : (
                    <div className="space-y-3">
                      {emailOptins?.slice(0, 5).map((optin: any) => (
                        <div key={optin.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium text-sm">{optin.email}</p>
                            <p className="text-xs text-slate-500">{optin.source || 'Direct'}</p>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            {formatDate(optin.createdAt)}
                          </div>
                        </div>
                      ))}
                      {(!emailOptins || emailOptins.length === 0) && (
                        <p className="text-slate-500 text-center py-4">No opt-ins yet</p>
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
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Reports</CardDescription>
                      <CardTitle className="text-3xl">{formatNumber(notificationAnalytics?.totalReports || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <FileText className="w-4 h-4" />
                        <span>All shareable reports</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Views</CardDescription>
                      <CardTitle className="text-3xl">{formatNumber(notificationAnalytics?.totalViews || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Eye className="w-4 h-4" />
                        <span>Report page views</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>SMS Sent</CardDescription>
                      <CardTitle className="text-3xl">{formatNumber(notificationAnalytics?.totalSmsSent || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
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
                    <CardHeader className="pb-2">
                      <CardDescription>Emails Sent</CardDescription>
                      <CardTitle className="text-3xl">{formatNumber(notificationAnalytics?.totalEmailsSent || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
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
          {/* NEWSLETTER TAB */}
          {/* ============================================ */}
          <TabsContent value="newsletter" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />Emails Sent (30d)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{newsletterStats?.last30Days?.total || 0}</div>
                  <p className="text-xs text-slate-500">
                    {newsletterStats?.last30Days?.successful || 0} successful, {newsletterStats?.last30Days?.failed || 0} failed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />Success Rate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {newsletterStats?.last30Days?.total 
                      ? Math.round((newsletterStats.last30Days.successful / newsletterStats.last30Days.total) * 100) 
                      : 0}%
                  </div>
                  <p className="text-xs text-slate-500">Email delivery rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />Active Cities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{newsletterStats?.totalCities || 0}</div>
                  <p className="text-xs text-slate-500">Cities with contacts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />Recent Jobs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{newsletterStats?.recentJobs?.length || 0}</div>
                  <p className="text-xs text-slate-500">Jobs in last 7 days</p>
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
                <CardContent className="space-y-4">
                  <Button 
                    className="w-full justify-start bg-amber-600 hover:bg-amber-700"
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
                          <span className="text-sm text-slate-500">
                            {new Date(job.startedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{job.emailsSent} sent</span>
                          {job.emailsFailed > 0 && (
                            <Badge variant="destructive">{job.emailsFailed} failed</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!newsletterStats?.recentJobs || newsletterStats.recentJobs.length === 0) && (
                      <p className="text-sm text-slate-500">No recent jobs</p>
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
        </Tabs>
      </main>
    </div>
  );
}
