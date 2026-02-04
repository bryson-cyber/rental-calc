import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { 
  Activity, 
  TrendingUp,
  TrendingDown,
  Clock,
  BarChart3,
  RefreshCw,
  Shield,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Database,
  Zap,
  DollarSign,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";

export default function ApiUsageDashboard() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [selectedProvider] = useState<string | undefined>(undefined);
  
  // Fetch API usage stats
  const { data: usageData, isLoading: usageLoading, refetch: refetchUsage } = trpc.admin.getApiUsage.useQuery(
    { provider: selectedProvider },
    { 
      enabled: isAuthenticated && user?.role === "admin",
      refetchInterval: 30000 // Auto-refresh every 30 seconds
    }
  );
  
  // Fetch recent API calls
  const { data: callsData, isLoading: callsLoading } = trpc.admin.getRecentApiCalls.useQuery(
    { limit: 100, provider: selectedProvider },
    { 
      enabled: isAuthenticated && user?.role === "admin",
      refetchInterval: 30000
    }
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
              Please log in to access the API usage dashboard.
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
              You don't have permission to access the API usage dashboard.
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

  const usage = usageData;
  const calls = callsData?.calls || [];
  
  // Calculate usage percentages
  const dailyUsagePercent = usage?.airdnaStatus?.currentCount 
    ? Math.min((usage.airdnaStatus.currentCount / usage.dailyLimit) * 100, 100)
    : 0;
  
  const totalCalls = usage?.totals?.totalCalls || 0;
  const monthlyUsagePercent = totalCalls
    ? Math.min((totalCalls / (usage?.monthlyLimit || 24000)) * 100, 100)
    : 0;
  
  const cacheHits = usage?.totals?.cacheHits || 0;
  const cacheMisses = totalCalls - cacheHits;
  const cacheHitRate = totalCalls > 0 ? (cacheHits / totalCalls) * 100 : 0;
  const estimatedCost = usage?.totals?.estimatedCost || 0;

  // Get status color based on usage
  const getStatusColor = (percent: number) => {
    if (percent >= 90) return "text-red-400";
    if (percent >= 70) return "text-yellow-400";
    return "text-green-400";
  };

  const getStatusBg = (percent: number) => {
    if (percent >= 90) return "bg-red-400";
    if (percent >= 70) return "bg-yellow-400";
    return "bg-green-400";
  };

  // Format date for display
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header */}
      <header className="bg-[#1e293b] border-b border-[#334155] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" className="text-white/60 hover:text-white">
                ← Back to Admin
              </Button>
            </Link>
            <div className="h-6 w-px bg-[#334155]" />
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#C9A962]" />
              API Usage Monitor
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Badge 
              variant="outline" 
              className={`${usage?.airdnaStatus?.isOverLimit ? 'border-red-400 text-red-400' : 'border-green-400 text-green-400'}`}
            >
              {usage?.airdnaStatus?.isOverLimit ? (
                <><AlertTriangle className="w-3 h-3 mr-1" /> Daily Limit Reached</>
              ) : (
                <><CheckCircle className="w-3 h-3 mr-1" /> Within Limits</>
              )}
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetchUsage()}
              className="border-[#334155] text-white/60 hover:text-white hover:bg-[#334155]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {usageLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
          </div>
        ) : (
          <>
            {/* Alert Banner if near limit */}
            {dailyUsagePercent >= 80 && (
              <div className={`p-4 rounded-lg border ${dailyUsagePercent >= 90 ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`w-5 h-5 ${dailyUsagePercent >= 90 ? 'text-red-400' : 'text-yellow-400'}`} />
                  <div>
                    <p className={`font-medium ${dailyUsagePercent >= 90 ? 'text-red-400' : 'text-yellow-400'}`}>
                      {dailyUsagePercent >= 90 ? 'Critical: Daily API limit almost reached!' : 'Warning: Approaching daily API limit'}
                    </p>
                    <p className="text-white/60 text-sm">
                      {usage?.airdnaStatus?.currentCount || 0} of {usage?.dailyLimit || 700} calls used today. 
                      {dailyUsagePercent >= 90 ? ' New API calls may be blocked.' : ' Consider reducing API usage.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Today's Usage */}
              <Card className="bg-[#1e293b] border-[#334155]">
                <CardHeader className="pb-2">
                  <CardDescription className="text-white/60 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Today's API Calls
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-3xl font-bold ${getStatusColor(dailyUsagePercent)}`}>
                        {usage?.airdnaStatus?.currentCount || 0}
                      </span>
                      <span className="text-white/40 text-sm">/ {usage?.dailyLimit || 700}</span>
                    </div>
                    <Progress 
                      value={dailyUsagePercent} 
                      className="h-2 bg-[#334155]"
                    />
                    <p className="text-white/40 text-xs">
                      {Math.round(dailyUsagePercent)}% of daily limit used
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Monthly Usage */}
              <Card className="bg-[#1e293b] border-[#334155]">
                <CardHeader className="pb-2">
                  <CardDescription className="text-white/60 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Monthly API Calls
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-3xl font-bold ${getStatusColor(monthlyUsagePercent)}`}>
                        {totalCalls.toLocaleString()}
                      </span>
                      <span className="text-white/40 text-sm">/ {(usage?.monthlyLimit || 24000).toLocaleString()}</span>
                    </div>
                    <Progress 
                      value={monthlyUsagePercent} 
                      className="h-2 bg-[#334155]"
                    />
                    <p className="text-white/40 text-xs">
                      {Math.round(monthlyUsagePercent)}% of monthly limit used
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Cache Stats */}
              <Card className="bg-[#1e293b] border-[#334155]">
                <CardHeader className="pb-2">
                  <CardDescription className="text-white/60 flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Cache Performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold text-green-400">
                        {Math.round(cacheHitRate)}%
                      </span>
                      <Badge variant="outline" className="border-green-400/30 text-green-400">
                        Hit Rate
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <span>{cacheHits.toLocaleString()} hits</span>
                      <span className="text-white/30">•</span>
                      <span>{cacheMisses.toLocaleString()} misses</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Estimated Cost */}
              <Card className="bg-[#1e293b] border-[#334155]">
                <CardHeader className="pb-2">
                  <CardDescription className="text-white/60 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Estimated Overage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-3xl font-bold ${totalCalls > (usage?.monthlyLimit || 24000) ? 'text-red-400' : 'text-green-400'}`}>
                        ${estimatedCost.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-white/40 text-xs">
                      {totalCalls > (usage?.monthlyLimit || 24000) 
                        ? `${(totalCalls - (usage?.monthlyLimit || 24000)).toLocaleString()} calls over limit`
                        : `${((usage?.monthlyLimit || 24000) - totalCalls).toLocaleString()} calls remaining`
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Daily Breakdown */}
            {usage?.daily && usage.daily.length > 0 && (
              <Card className="bg-[#1e293b] border-[#334155]">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#C9A962]" />
                    Daily Usage (Last 30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {usage.daily.slice(0, 14).map((day: { date: string; totalCalls: number }, index: number) => {
                      const dayPercent = (day.totalCalls / (usage?.dailyLimit || 700)) * 100;
                      return (
                        <div key={index} className="flex items-center gap-3">
                          <span className="text-white/60 text-sm w-16">{formatDate(day.date)}</span>
                          <div className="flex-1 h-6 bg-[#334155] rounded overflow-hidden">
                            <div 
                              className={`h-full ${getStatusBg(dayPercent)} transition-all`}
                              style={{ width: `${Math.min(dayPercent, 100)}%` }}
                            />
                          </div>
                          <span className={`text-sm w-20 text-right ${getStatusColor(dayPercent)}`}>
                            {day.totalCalls.toLocaleString()} calls
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent API Calls */}
            <Card className="bg-[#1e293b] border-[#334155]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#C9A962]" />
                    Recent API Calls
                  </CardTitle>
                  <Badge variant="outline" className="border-[#334155] text-white/60">
                    Last 100 calls
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {callsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[#C9A962]" />
                  </div>
                ) : calls.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    No API calls recorded yet
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {calls.map((call: {
                      id: number;
                      endpoint: string;
                      success: number;
                      responseTimeMs: number | null;
                      cacheHit: number;
                      createdAt: Date;
                    }, index: number) => (
                      <div 
                        key={call.id || index}
                        className="flex items-center gap-3 p-3 bg-[#0F172A] rounded-lg"
                      >
                        <div className={`w-2 h-2 rounded-full ${call.success === 1 ? 'bg-green-400' : 'bg-red-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-mono truncate">
                            {call.endpoint}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-white/40 text-xs">
                              {formatTime(call.createdAt instanceof Date ? call.createdAt.toISOString() : String(call.createdAt))}
                            </span>
                            {call.cacheHit === 1 && (
                              <Badge variant="outline" className="border-blue-400/30 text-blue-400 text-xs py-0">
                                Cached
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm ${(call.responseTimeMs || 0) > 2000 ? 'text-yellow-400' : 'text-white/60'}`}>
                            {call.responseTimeMs || 0}ms
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>


          </>
        )}
      </main>
    </div>
  );
}
