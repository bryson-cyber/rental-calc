/**
 * Unified Admin Dashboard
 * 
 * Consolidates all admin features into one place with Coach Inayah branding:
 * - Dark navy (#0F172A) background with gold (#C9A962) accents
 * - Overview: Dashboard stats (users, reports, leads, activity)
 * - Users: User management with admin toggle
 * - API Usage: Market data API monitoring and limits
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
  Home
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
    onError: (err) => toast.error(err.message)
  });
  
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
  // LOADING & AUTH STATES
  // ============================================
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#C9A962] mx-auto mb-4" />
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <div className="bg-[#1e293b] rounded-2xl border border-white/10 p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-[#C9A962] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Authentication Required</h2>
          <p className="text-white/60 mb-6">Please sign in to access the admin dashboard.</p>
          <Link href="/">
            <Button className="bg-[#C9A962] hover:bg-[#b8954f] text-[#0F172A] w-full">
              <Home className="w-4 h-4 mr-2" />
              Go to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <div className="bg-[#1e293b] rounded-2xl border border-white/10 p-8 max-w-md w-full text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-white/60 mb-6">You don't have permission to access the admin dashboard.</p>
          <Link href="/">
            <Button className="bg-[#C9A962] hover:bg-[#b8954f] text-[#0F172A] w-full">
              <Home className="w-4 h-4 mr-2" />
              Go to Home
            </Button>
          </Link>
        </div>
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
    if (percent >= 90) return 'text-red-400';
    if (percent >= 70) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const dailyUsagePercent = apiUsageData?.airdnaStatus?.currentCount 
    ? Math.min((apiUsageData.airdnaStatus.currentCount / (apiUsageData.dailyLimit || 700)) * 100, 100)
    : 0;
  
  const monthlyUsagePercent = apiUsageData?.totals?.totalCalls
    ? Math.min((apiUsageData.totals.totalCalls / (apiUsageData.monthlyLimit || 24000)) * 100, 100)
    : 0;

  const totalUserPages = Math.ceil((usersQuery.data?.total || 0) / userLimit);

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header */}
      <header className="bg-[#0F172A] border-b border-white/10 sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2 text-white/70 hover:text-white hover:bg-white/10">
                  <ArrowLeft className="w-4 h-4" />
                  Back to App
                </Button>
              </Link>
              <div className="h-6 w-px bg-white/20" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#C9A962]/20 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-[#C9A962]" />
                </div>
                <h1 className="text-xl font-semibold text-white">Admin Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-white/50">
                Logged in as <span className="font-medium text-[#C9A962]">{user?.name || user?.email}</span>
              </span>
              <Button 
                variant="outline" 
                size="sm"
                className="border-white/20 text-white/70 hover:text-white hover:bg-white/10"
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
          <TabsList className="bg-[#1e293b] border border-white/10 p-1 flex-wrap h-auto">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[#C9A962] data-[state=active]:text-[#0F172A] text-white/70">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-[#C9A962] data-[state=active]:text-[#0F172A] text-white/70">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="api-usage" className="data-[state=active]:bg-[#C9A962] data-[state=active]:text-[#0F172A] text-white/70">
              <Zap className="w-4 h-4 mr-2" />
              API Usage
            </TabsTrigger>
            <TabsTrigger value="hubspot" className="data-[state=active]:bg-[#C9A962] data-[state=active]:text-[#0F172A] text-white/70">
              <Link2 className="w-4 h-4 mr-2" />
              HubSpot
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-[#C9A962] data-[state=active]:text-[#0F172A] text-white/70">
              <MessageSquare className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="newsletter" className="data-[state=active]:bg-[#C9A962] data-[state=active]:text-[#0F172A] text-white/70">
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
                <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                    <p className="text-white/50 text-sm mb-2">Total Users</p>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold text-white">{statsData?.users?.total || 0}</span>
                      <div className="flex items-center text-emerald-400 text-sm">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        +{statsData?.users?.newThisWeek || 0} this week
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                    <p className="text-white/50 text-sm mb-2">Total Reports</p>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold text-white">{statsData?.reports?.total || 0}</span>
                      <div className="flex items-center text-emerald-400 text-sm">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        +{statsData?.reports?.thisWeek || 0} this week
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                    <p className="text-white/50 text-sm mb-2">Total Leads</p>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold text-white">{statsData?.leads?.total || 0}</span>
                      <div className="flex items-center text-emerald-400 text-sm">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        +{statsData?.leads?.thisWeek || 0} this week
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                    <p className="text-white/50 text-sm mb-2">Actions Today</p>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold text-white">{statsData?.activity?.today?.totalActions || 0}</span>
                      <div className="flex items-center text-[#C9A962] text-sm">
                        <Activity className="w-4 h-4 mr-1" />
                        {statsData?.activity?.today?.uniqueSessions || 0} sessions
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity by Category */}
                <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Activity This Week</h3>
                  <p className="text-white/50 text-sm mb-4">Breakdown of user actions by category</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {statsData?.activity?.thisWeek?.actionsByCategory?.map((cat: any) => (
                      <div key={cat.category} className="bg-[#0F172A] rounded-lg p-4 text-center border border-white/5">
                        <div className="text-2xl font-bold text-[#C9A962]">{cat.count}</div>
                        <div className="text-sm text-white/50 capitalize">{cat.category}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Actions */}
                <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Top Actions This Week</h3>
                  <div className="space-y-3">
                    {statsData?.activity?.thisWeek?.topActions?.map((action: any, idx: number) => (
                      <div key={action.action} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-white/30 text-sm w-6">#{idx + 1}</span>
                          <span className="text-white/80">{action.action.replace(/_/g, ' ')}</span>
                        </div>
                        <Badge className="bg-[#C9A962]/20 text-[#C9A962] border-0">
                          {action.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ============================================ */}
          {/* USERS TAB */}
          {/* ============================================ */}
          <TabsContent value="users" className="space-y-6">
            {/* Filters */}
            <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    placeholder="Search by name or email..."
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(0); }}
                    className="pl-10 bg-[#0F172A] border-white/10 text-white placeholder:text-white/40"
                  />
                </div>
                <Select value={roleFilter} onValueChange={(v: 'all' | 'user' | 'admin') => { setRoleFilter(v); setUserPage(0); }}>
                  <SelectTrigger className="w-[180px] bg-[#0F172A] border-white/10 text-white">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e293b] border-white/10">
                    <SelectItem value="all" className="text-white">All Users</SelectItem>
                    <SelectItem value="user" className="text-white">Regular Users</SelectItem>
                    <SelectItem value="admin" className="text-white">Admins Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-[#1e293b] rounded-xl border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">User Management</h3>
                <p className="text-white/50 text-sm">{usersQuery.data?.total || 0} total users</p>
              </div>
              
              {usersQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#C9A962]" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/50">User</TableHead>
                        <TableHead className="text-white/50">Email</TableHead>
                        <TableHead className="text-white/50">Role</TableHead>
                        <TableHead className="text-white/50">Today's Usage</TableHead>
                        <TableHead className="text-white/50">Last Active</TableHead>
                        <TableHead className="text-right text-white/50">Admin Toggle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersQuery.data?.users?.map((u: any) => (
                        <TableRow key={u.id} className="border-white/5 hover:bg-white/5">
                          <TableCell>
                            <p className="font-medium text-white">{u.name || 'Unnamed User'}</p>
                            <p className="text-xs text-white/40">ID: {u.id}</p>
                          </TableCell>
                          <TableCell className="text-white/60">{u.email || '—'}</TableCell>
                          <TableCell>
                            {u.role === 'admin' ? (
                              <Badge className="bg-[#C9A962]/20 text-[#C9A962] border-0">
                                <ShieldCheck className="w-3 h-3 mr-1" />Admin
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-white/10 text-white/60 border-0">
                                <Shield className="w-3 h-3 mr-1" />User
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-white/70">{u.usageToday?.propertyAnalyses || 0} analyses</p>
                            <p className="text-xs text-white/40">{u.usageToday?.marketResearches || 0} market searches</p>
                          </TableCell>
                          <TableCell className="text-sm text-white/50">{formatDate(u.lastSignedIn)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-white/40">Admin</span>
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
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
                  <p className="text-sm text-white/50">
                    Page {userPage + 1} of {totalUserPages}
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setUserPage(p => Math.max(0, p - 1))} 
                      disabled={userPage === 0}
                      className="border-white/20 text-white/70 hover:bg-white/10"
                    >
                      Previous
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setUserPage(p => Math.min(totalUserPages - 1, p + 1))} 
                      disabled={userPage >= totalUserPages - 1}
                      className="border-white/20 text-white/70 hover:bg-white/10"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ============================================ */}
          {/* API USAGE TAB */}
          {/* ============================================ */}
          <TabsContent value="api-usage" className="space-y-6">
            {apiUsageLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
              </div>
            ) : (
              <>
                {/* Alert Banner */}
                {dailyUsagePercent >= 80 && (
                  <div className={`p-4 rounded-xl border ${dailyUsagePercent >= 90 ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`w-5 h-5 ${dailyUsagePercent >= 90 ? 'text-red-400' : 'text-amber-400'}`} />
                      <div>
                        <p className={`font-medium ${dailyUsagePercent >= 90 ? 'text-red-400' : 'text-amber-400'}`}>
                          {dailyUsagePercent >= 90 ? 'Critical: Daily API limit almost reached!' : 'Warning: Approaching daily API limit'}
                        </p>
                        <p className="text-sm text-white/60">
                          {apiUsageData?.airdnaStatus?.currentCount || 0} of {apiUsageData?.dailyLimit || 700} calls used today.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Usage Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                    <div className="flex items-center gap-2 text-white/50 text-sm mb-3">
                      <Clock className="w-4 h-4" />Today's API Calls
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-3xl font-bold ${getUsageColor(dailyUsagePercent)}`}>
                          {apiUsageData?.airdnaStatus?.currentCount || 0}
                        </span>
                        <span className="text-white/40 text-sm">/ {apiUsageData?.dailyLimit || 700}</span>
                      </div>
                      <Progress value={dailyUsagePercent} className="h-2 bg-white/10" />
                      <p className="text-white/40 text-xs">{Math.round(dailyUsagePercent)}% of daily limit</p>
                    </div>
                  </div>

                  <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                    <div className="flex items-center gap-2 text-white/50 text-sm mb-3">
                      <Calendar className="w-4 h-4" />Monthly API Calls
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-3xl font-bold ${getUsageColor(monthlyUsagePercent)}`}>
                          {formatNumber(apiUsageData?.totals?.totalCalls || 0)}
                        </span>
                        <span className="text-white/40 text-sm">/ {formatNumber(apiUsageData?.monthlyLimit || 24000)}</span>
                      </div>
                      <Progress value={monthlyUsagePercent} className="h-2 bg-white/10" />
                      <p className="text-white/40 text-xs">{Math.round(monthlyUsagePercent)}% of monthly limit</p>
                    </div>
                  </div>

                  <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                    <div className="flex items-center gap-2 text-white/50 text-sm mb-3">
                      <Database className="w-4 h-4" />Cache Performance
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-emerald-400">
                          {apiUsageData?.totals?.totalCalls ? Math.round((apiUsageData.totals.cacheHits / apiUsageData.totals.totalCalls) * 100) : 0}%
                        </span>
                        <span className="text-white/40 text-sm">hit rate</span>
                      </div>
                      <div className="text-sm text-white/50">
                        {formatNumber(apiUsageData?.totals?.cacheHits || 0)} cache hits
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                    <div className="flex items-center gap-2 text-white/50 text-sm mb-3">
                      <DollarSign className="w-4 h-4" />Estimated Cost
                    </div>
                    <div className="space-y-3">
                      <span className="text-3xl font-bold text-white">
                        ${(apiUsageData?.totals?.estimatedCost || 0).toFixed(2)}
                      </span>
                      <p className="text-sm text-white/50">
                        @ $0.35/call overage
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent API Calls */}
                <div className="bg-[#1e293b] rounded-xl border border-white/10 overflow-hidden">
                  <div className="p-6 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">Recent API Calls</h3>
                    <p className="text-white/50 text-sm">Last 50 API requests</p>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="text-white/50">Time</TableHead>
                          <TableHead className="text-white/50">Endpoint</TableHead>
                          <TableHead className="text-white/50">Status</TableHead>
                          <TableHead className="text-white/50">Response Time</TableHead>
                          <TableHead className="text-white/50">Cached</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiCallsData?.calls?.map((call: any, idx: number) => (
                          <TableRow key={idx} className="border-white/5 hover:bg-white/5">
                            <TableCell className="text-sm text-white/50">
                              {new Date(call.createdAt).toLocaleTimeString()}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-white/70 max-w-[200px] truncate">
                              {call.endpoint}
                            </TableCell>
                            <TableCell>
                              {call.success ? (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-0">Success</Badge>
                              ) : (
                                <Badge className="bg-red-500/20 text-red-400 border-0">Failed</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-white/60">{call.responseTimeMs}ms</TableCell>
                            <TableCell>
                              {call.cacheHit ? (
                                <Badge variant="secondary" className="bg-white/10 text-white/60 border-0">Cached</Badge>
                              ) : (
                                <span className="text-white/30">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ============================================ */}
          {/* HUBSPOT TAB */}
          {/* ============================================ */}
          <TabsContent value="hubspot" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{hubspotSummary?.totalOptins || 0}</p>
                    <p className="text-sm text-white/50">Email Opt-ins</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{hubspotSummary?.totalLinks || 0}</p>
                    <p className="text-sm text-white/50">Links Created</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <MousePointer className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{hubspotSummary?.totalClicks || 0}</p>
                    <p className="text-sm text-white/50">Total Clicks</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Send className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{hubspotSummary?.totalPromotions || 0}</p>
                    <p className="text-sm text-white/50">Promotions</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#C9A962]/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-[#C9A962]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{hubspotSummary?.totalToolUsageEvents || 0}</p>
                    <p className="text-sm text-white/50">Tool Events</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Links & Opt-ins */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Recent Personalized Links</h3>
                <p className="text-white/50 text-sm mb-4">Latest links created for HubSpot contacts</p>
                {linksLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#C9A962] mx-auto" />
                ) : (
                  <div className="space-y-3">
                    {hubspotLinks?.slice(0, 5).map((link: any) => (
                      <div key={link.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <div>
                          <p className="font-medium text-sm text-white">{link.targetCity}, {link.targetState}</p>
                          <p className="text-xs text-white/40">{link.email || 'No email'}</p>
                        </div>
                        <Badge variant="secondary" className="bg-white/10 text-white/60 border-0">{link.clicks || 0} clicks</Badge>
                      </div>
                    ))}
                    {(!hubspotLinks || hubspotLinks.length === 0) && (
                      <p className="text-white/40 text-center py-4">No links created yet</p>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Recent Email Opt-ins</h3>
                <p className="text-white/50 text-sm mb-4">Latest email subscriptions</p>
                {optinsLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#C9A962] mx-auto" />
                ) : (
                  <div className="space-y-3">
                    {emailOptins?.slice(0, 5).map((optin: any) => (
                      <div key={optin.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <div>
                          <p className="font-medium text-sm text-white">{optin.email}</p>
                          <p className="text-xs text-white/40">{optin.source || 'Direct'}</p>
                        </div>
                        <div className="text-right text-xs text-white/40">
                          {formatDate(optin.createdAt)}
                        </div>
                      </div>
                    ))}
                    {(!emailOptins || emailOptins.length === 0) && (
                      <p className="text-white/40 text-center py-4">No opt-ins yet</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Link to full HubSpot portal */}
            <div className="text-center">
              <Link href="/admin/hubspot">
                <Button variant="outline" className="gap-2 border-white/20 text-white/70 hover:bg-white/10">
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
                <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                    <p className="text-white/50 text-sm mb-2">Total Reports</p>
                    <p className="text-3xl font-bold text-white mb-2">{formatNumber(notificationAnalytics?.totalReports || 0)}</p>
                    <div className="flex items-center gap-2 text-sm text-white/40">
                      <FileText className="w-4 h-4" />
                      <span>All shareable reports</span>
                    </div>
                  </div>

                  <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                    <p className="text-white/50 text-sm mb-2">Total Views</p>
                    <p className="text-3xl font-bold text-white mb-2">{formatNumber(notificationAnalytics?.totalViews || 0)}</p>
                    <div className="flex items-center gap-2 text-sm text-white/40">
                      <Eye className="w-4 h-4" />
                      <span>Report page views</span>
                    </div>
                  </div>

                  <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                    <p className="text-white/50 text-sm mb-2">SMS Sent</p>
                    <p className="text-3xl font-bold text-white mb-2">{formatNumber(notificationAnalytics?.totalSmsSent || 0)}</p>
                    <div className="flex items-center gap-2 text-sm text-white/40">
                      <MessageSquare className="w-4 h-4" />
                      <span>
                        {(notificationAnalytics?.smsSuccessRate || 0) > 0 
                          ? `${((notificationAnalytics?.smsSuccessRate || 0) * 100).toFixed(1)}% success`
                          : 'No SMS sent yet'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                    <p className="text-white/50 text-sm mb-2">Emails Sent</p>
                    <p className="text-3xl font-bold text-white mb-2">{formatNumber(notificationAnalytics?.totalEmailsSent || 0)}</p>
                    <div className="flex items-center gap-2 text-sm text-white/40">
                      <Mail className="w-4 h-4" />
                      <span>
                        {(notificationAnalytics?.emailSuccessRate || 0) > 0 
                          ? `${((notificationAnalytics?.emailSuccessRate || 0) * 100).toFixed(1)}% success`
                          : 'No emails sent yet'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Link to full notifications page */}
                <div className="text-center">
                  <Link href="/admin/notifications">
                    <Button variant="outline" className="gap-2 border-white/20 text-white/70 hover:bg-white/10">
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
              <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-3">
                  <Mail className="w-4 h-4" />Emails Sent (30d)
                </div>
                <div className="text-2xl font-bold text-white">{newsletterStats?.last30Days?.total || 0}</div>
                <p className="text-xs text-white/40">
                  {newsletterStats?.last30Days?.successful || 0} successful, {newsletterStats?.last30Days?.failed || 0} failed
                </p>
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-3">
                  <CheckCircle className="w-4 h-4" />Success Rate
                </div>
                <div className="text-2xl font-bold text-white">
                  {newsletterStats?.last30Days?.total 
                    ? Math.round((newsletterStats.last30Days.successful / newsletterStats.last30Days.total) * 100) 
                    : 0}%
                </div>
                <p className="text-xs text-white/40">Email delivery rate</p>
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-3">
                  <MapPin className="w-4 h-4" />Active Cities
                </div>
                <div className="text-2xl font-bold text-white">{newsletterStats?.totalCities || 0}</div>
                <p className="text-xs text-white/40">Cities with contacts</p>
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-3">
                  <Clock className="w-4 h-4" />Recent Jobs
                </div>
                <div className="text-2xl font-bold text-white">{newsletterStats?.recentJobs?.length || 0}</div>
                <p className="text-xs text-white/40">Jobs in last 7 days</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Quick Actions</h3>
                <p className="text-white/50 text-sm mb-4">Manually trigger newsletter jobs</p>
                <div className="space-y-4">
                  <Button 
                    className="w-full justify-start bg-[#C9A962] hover:bg-[#b8954f] text-[#0F172A]"
                    onClick={() => triggerWeekly.mutate()}
                    disabled={triggerWeekly.isPending}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Run Weekly Market Newsletter
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full justify-start border-white/20 text-white/70 hover:bg-white/10"
                    onClick={() => triggerDealAlert.mutate({})}
                    disabled={triggerDealAlert.isPending}
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Run Deal Alert Scan
                  </Button>
                </div>
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Recent Jobs</h3>
                <p className="text-white/50 text-sm mb-4">Latest newsletter job runs</p>
                <div className="space-y-3">
                  {newsletterStats?.recentJobs?.slice(0, 5).map((job: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={job.type === 'weekly_market' ? 'bg-[#C9A962]/20 text-[#C9A962] border-0' : 'bg-white/10 text-white/60 border-0'}>
                          {job.type === 'weekly_market' ? 'Weekly' : 'Deal Alert'}
                        </Badge>
                        <span className="text-sm text-white/40">
                          {new Date(job.startedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{job.emailsSent} sent</span>
                        {job.emailsFailed > 0 && (
                          <Badge className="bg-red-500/20 text-red-400 border-0">{job.emailsFailed} failed</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!newsletterStats?.recentJobs || newsletterStats.recentJobs.length === 0) && (
                    <p className="text-sm text-white/40">No recent jobs</p>
                  )}
                </div>
              </div>
            </div>

            {/* Link to full newsletter dashboard */}
            <div className="text-center">
              <Link href="/admin/newsletter">
                <Button variant="outline" className="gap-2 border-white/20 text-white/70 hover:bg-white/10">
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
