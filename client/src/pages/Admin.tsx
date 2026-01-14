import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { 
  Users, 
  Activity, 
  FileText, 
  UserPlus, 
  TrendingUp,
  Clock,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Shield,
  AlertCircle,
  Search,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Fetch dashboard stats
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = trpc.admin.getDashboardStats.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );
  
  // Fetch users
  const { data: usersData, isLoading: usersLoading } = trpc.admin.getUsers.useQuery(
    { limit: 20, offset: 0 },
    { enabled: isAuthenticated && user?.role === "admin" && activeTab === "users" }
  );
  
  // Fetch activity logs
  const { data: logsData, isLoading: logsLoading } = trpc.admin.getActivityLogs.useQuery(
    { limit: 50, offset: 0 },
    { enabled: isAuthenticated && user?.role === "admin" && activeTab === "activity" }
  );
  
  // Fetch reports
  const { data: reportsData, isLoading: reportsLoading } = trpc.admin.getReports.useQuery(
    { limit: 20, offset: 0 },
    { enabled: isAuthenticated && user?.role === "admin" && activeTab === "reports" }
  );
  
  // Fetch leads
  const { data: leadsData, isLoading: leadsLoading } = trpc.admin.getLeads.useQuery(
    { limit: 20, offset: 0 },
    { enabled: isAuthenticated && user?.role === "admin" && activeTab === "leads" }
  );

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-[#1e293b] border-[#334155]">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 text-[#C9A962] mx-auto mb-4" />
            <CardTitle className="text-white">Admin Access Required</CardTitle>
            <CardDescription className="text-white/60">
              Please log in to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full bg-[#C9A962] text-[#0F172A] hover:bg-[#d4b876]">
                Go to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not admin
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-[#1e293b] border-[#334155]">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <CardTitle className="text-white">Access Denied</CardTitle>
            <CardDescription className="text-white/60">
              You don't have permission to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full bg-[#C9A962] text-[#0F172A] hover:bg-[#d4b876]">
                Go to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = statsData;

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header */}
      <header className="bg-[#1e293b] border-b border-[#334155] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" className="text-white/60 hover:text-white">
                ← Back to App
              </Button>
            </Link>
            <div className="h-6 w-px bg-[#334155]" />
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#C9A962]" />
              Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white/60 text-sm">
              Logged in as <span className="text-[#C9A962]">{user?.name || user?.email}</span>
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetchStats()}
              className="border-[#334155] text-white/60 hover:text-white hover:bg-[#334155]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-[#1e293b] border border-[#334155]">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[#C9A962] data-[state=active]:text-[#0F172A]">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-[#C9A962] data-[state=active]:text-[#0F172A]">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-[#C9A962] data-[state=active]:text-[#0F172A]">
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-[#C9A962] data-[state=active]:text-[#0F172A]">
              <FileText className="w-4 h-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="leads" className="data-[state=active]:bg-[#C9A962] data-[state=active]:text-[#0F172A]">
              <UserPlus className="w-4 h-4 mr-2" />
              Leads
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {statsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-[#1e293b] border-[#334155]">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-white/60">Total Users</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-white">{stats?.users.total || 0}</span>
                        <div className="flex items-center text-green-400 text-sm">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          +{stats?.users.newThisWeek || 0} this week
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1e293b] border-[#334155]">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-white/60">Total Reports</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-white">{stats?.reports.total || 0}</span>
                        <div className="flex items-center text-green-400 text-sm">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          +{stats?.reports.thisWeek || 0} this week
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1e293b] border-[#334155]">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-white/60">Total Leads</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-white">{stats?.leads.total || 0}</span>
                        <div className="flex items-center text-green-400 text-sm">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          +{stats?.leads.thisWeek || 0} this week
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1e293b] border-[#334155]">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-white/60">Actions Today</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-white">{stats?.activity.today.totalActions || 0}</span>
                        <div className="flex items-center text-[#C9A962] text-sm">
                          <Activity className="w-4 h-4 mr-1" />
                          {stats?.activity.today.uniqueSessions || 0} sessions
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Activity by Category */}
                <Card className="bg-[#1e293b] border-[#334155]">
                  <CardHeader>
                    <CardTitle className="text-white">Activity This Week</CardTitle>
                    <CardDescription className="text-white/60">
                      Breakdown of user actions by category
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {stats?.activity.thisWeek.actionsByCategory.map((cat) => (
                        <div key={cat.category} className="bg-[#0F172A] rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-[#C9A962]">{cat.count}</div>
                          <div className="text-sm text-white/60 capitalize">{cat.category}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Actions */}
                <Card className="bg-[#1e293b] border-[#334155]">
                  <CardHeader>
                    <CardTitle className="text-white">Top Actions This Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats?.activity.thisWeek.topActions.map((action, idx) => (
                        <div key={action.action} className="flex items-center justify-between py-2 border-b border-[#334155] last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="text-white/40 text-sm w-6">#{idx + 1}</span>
                            <span className="text-white">{action.action.replace(/_/g, ' ')}</span>
                          </div>
                          <Badge variant="secondary" className="bg-[#C9A962]/20 text-[#C9A962]">
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

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card className="bg-[#1e293b] border-[#334155]">
              <CardHeader>
                <CardTitle className="text-white">All Users</CardTitle>
                <CardDescription className="text-white/60">
                  {usersData?.total || 0} total users
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#334155]">
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Name</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Email</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Role</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Last Sign In</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersData?.users.map((u) => (
                          <tr key={u.id} className="border-b border-[#334155] hover:bg-[#0F172A]/50">
                            <td className="py-3 px-4 text-white">{u.name || "—"}</td>
                            <td className="py-3 px-4 text-white/80">{u.email || "—"}</td>
                            <td className="py-3 px-4">
                              <Badge 
                                variant={u.role === "admin" ? "default" : "secondary"}
                                className={u.role === "admin" ? "bg-[#C9A962] text-[#0F172A]" : "bg-[#334155] text-white/60"}
                              >
                                {u.role}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-white/60 text-sm">
                              {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString() : "—"}
                            </td>
                            <td className="py-3 px-4 text-white/60 text-sm">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <Card className="bg-[#1e293b] border-[#334155]">
              <CardHeader>
                <CardTitle className="text-white">Activity Log</CardTitle>
                <CardDescription className="text-white/60">
                  Recent user actions and events
                </CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logsData?.logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-4 py-3 border-b border-[#334155] last:border-0">
                        <div className="w-10 h-10 rounded-full bg-[#C9A962]/20 flex items-center justify-center flex-shrink-0">
                          <Activity className="w-5 h-5 text-[#C9A962]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium">{log.action.replace(/_/g, ' ')}</span>
                            <Badge variant="outline" className="border-[#334155] text-white/60 text-xs">
                              {log.actionCategory}
                            </Badge>
                          </div>
                          {log.pagePath && (
                            <div className="text-white/40 text-sm mt-1">{log.pagePath}</div>
                          )}
                          <div className="text-white/40 text-xs mt-1 flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {new Date(log.createdAt).toLocaleString()}
                            {log.userId && <span>• User #{log.userId}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {logsData?.logs.length === 0 && (
                      <div className="text-center py-8 text-white/40">
                        No activity logs yet
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card className="bg-[#1e293b] border-[#334155]">
              <CardHeader>
                <CardTitle className="text-white">Analysis Reports</CardTitle>
                <CardDescription className="text-white/60">
                  {reportsData?.total || 0} total reports generated
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#334155]">
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Address</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Beds</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Rent</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Revenue</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Verdict</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportsData?.reports.map((report) => (
                          <tr key={report.id} className="border-b border-[#334155] hover:bg-[#0F172A]/50">
                            <td className="py-3 px-4 text-white max-w-xs truncate">{report.address}</td>
                            <td className="py-3 px-4 text-white/80">{report.bedrooms || "—"}</td>
                            <td className="py-3 px-4 text-white/80">
                              {report.monthlyRent ? `$${report.monthlyRent.toLocaleString()}` : "—"}
                            </td>
                            <td className="py-3 px-4 text-green-400">
                              {report.annualRevenueRealistic ? `$${report.annualRevenueRealistic.toLocaleString()}` : "—"}
                            </td>
                            <td className="py-3 px-4">
                              <Badge 
                                className={
                                  report.verdict === "GO" ? "bg-green-500/20 text-green-400" :
                                  report.verdict === "CAUTION" ? "bg-yellow-500/20 text-yellow-400" :
                                  report.verdict === "NO-GO" ? "bg-red-500/20 text-red-400" :
                                  "bg-[#334155] text-white/60"
                                }
                              >
                                {report.verdict || "—"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-white/60 text-sm">
                              {new Date(report.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leads Tab */}
          <TabsContent value="leads" className="space-y-6">
            <Card className="bg-[#1e293b] border-[#334155]">
              <CardHeader>
                <CardTitle className="text-white">Lead Management</CardTitle>
                <CardDescription className="text-white/60">
                  {leadsData?.total || 0} total leads captured
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#334155]">
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Name</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Email</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Phone</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Property</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Status</th>
                          <th className="text-left py-3 px-4 text-white/60 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leadsData?.leads.map((lead) => (
                          <tr key={lead.id} className="border-b border-[#334155] hover:bg-[#0F172A]/50">
                            <td className="py-3 px-4 text-white">{lead.name}</td>
                            <td className="py-3 px-4 text-white/80">{lead.email}</td>
                            <td className="py-3 px-4 text-white/80">{lead.phone || "—"}</td>
                            <td className="py-3 px-4 text-white/80 max-w-xs truncate">{lead.address}</td>
                            <td className="py-3 px-4">
                              <Badge 
                                className={
                                  lead.status === "new" ? "bg-blue-500/20 text-blue-400" :
                                  lead.status === "contacted" ? "bg-yellow-500/20 text-yellow-400" :
                                  lead.status === "qualified" ? "bg-purple-500/20 text-purple-400" :
                                  lead.status === "converted" ? "bg-green-500/20 text-green-400" :
                                  "bg-[#334155] text-white/60"
                                }
                              >
                                {lead.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-white/60 text-sm">
                              {new Date(lead.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {leadsData?.leads.length === 0 && (
                      <div className="text-center py-8 text-white/40">
                        No leads captured yet
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
