// @ts-nocheck -- Market-level page disabled (AirDNA removed)
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  Bell, 
  BellOff,
  Mail,
  Trash2,
  Plus,
  Loader2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Percent,
  Building2
} from 'lucide-react';
import { SharePageButton } from '@/components/SharePageButton';
import { Link } from 'wouter';
import { toast } from 'sonner';

export default function MarketAlertsPage() {
  const [sessionId] = useState(() => {
    let id = localStorage.getItem('favoriteSessionId');
    if (!id) {
      id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('favoriteSessionId', id);
    }
    return id;
  });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAlert, setNewAlert] = useState({
    email: '',
    marketId: '',
    marketName: '',
    alertType: 'all_changes' as 'revenue_change' | 'occupancy_change' | 'adr_change' | 'all_changes',
    thresholdPercent: 10,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const utils = trpc.useUtils();
  const alertsQuery = trpc.marketAlerts.list.useQuery({ sessionId });
  const favoritesQuery = trpc.favoriteMarkets.list.useQuery({ sessionId });

  // Search for markets
  const searchQuery = trpc.rental.searchMarkets.useQuery(
    { searchTerm, limit: 10 },
    { enabled: searchTerm.length >= 2 && isSearching }
  );

  const createAlertMutation = trpc.marketAlerts.create.useMutation({
    onSuccess: () => {
      utils.marketAlerts.list.invalidate();
      setShowCreateForm(false);
      setNewAlert({
        email: '',
        marketId: '',
        marketName: '',
        alertType: 'all_changes',
        thresholdPercent: 10,
      });
      toast.success('Alert created successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to create alert: ${error.message}`);
    },
  });

  const deleteAlertMutation = trpc.marketAlerts.delete.useMutation({
    onSuccess: () => {
      utils.marketAlerts.list.invalidate();
      toast.success('Alert deleted');
    },
  });

  const toggleAlertMutation = trpc.marketAlerts.toggle.useMutation({
    onSuccess: (data) => {
      utils.marketAlerts.list.invalidate();
      toast.success(`Alert ${data.isActive === 'true' ? 'enabled' : 'paused'}`);
    },
  });

  const handleCreateAlert = () => {
    if (!newAlert.email || !newAlert.marketId) {
      toast.error('Please fill in all required fields');
      return;
    }
    createAlertMutation.mutate({
      sessionId,
      email: newAlert.email,
      marketId: newAlert.marketId,
      marketName: newAlert.marketName,
      alertType: newAlert.alertType,
      thresholdPercent: newAlert.thresholdPercent,
    });
  };

  const handleSelectMarket = (market: { id: string; name: string }) => {
    setNewAlert({ ...newAlert, marketId: market.id, marketName: market.name });
    setSearchTerm('');
    setIsSearching(false);
  };

  const alertTypeLabels: Record<string, string> = {
    revenue_change: 'Revenue Changes',
    occupancy_change: 'Occupancy Changes',
    adr_change: 'ADR Changes',
    all_changes: 'All Metric Changes',
  };

  const alertTypeIcons: Record<string, React.ReactNode> = {
    revenue_change: <DollarSign className="w-4 h-4" />,
    occupancy_change: <Percent className="w-4 h-4" />,
    adr_change: <TrendingUp className="w-4 h-4" />,
    all_changes: <Bell className="w-4 h-4" />,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  ← Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-600" />
                  Market Alerts
                </h1>
                <p className="text-sm text-slate-500">
                  Get notified when market metrics change significantly
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SharePageButton
                pagePath="/market-alerts"
                params={{}}
                shareDescription="market alerts"
                variant="outline"
                size="sm"
              />
              <Button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="gap-2 bg-amber-600 hover:bg-amber-700"
              >
                <Plus className="w-4 h-4" />
                New Alert
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Create Alert Form */}
        {showCreateForm && (
          <Card className="mb-8 border-amber-200 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-600" />
                Create New Alert
              </CardTitle>
              <CardDescription>
                Set up email notifications for when market metrics change
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={newAlert.email}
                    onChange={(e) => setNewAlert({ ...newAlert, email: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Market Selection */}
              <div className="space-y-2">
                <Label>Select Market *</Label>
                {newAlert.marketId ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="px-3 py-1.5">
                      <Building2 className="w-3.5 h-3.5 mr-2" />
                      {newAlert.marketName}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewAlert({ ...newAlert, marketId: '', marketName: '' })}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Search for a market..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsSearching(e.target.value.length >= 2);
                      }}
                    />
                    {isSearching && searchQuery.data?.success && searchQuery.data.data.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {searchQuery.data.data.map((market: { id: string; name: string }) => (
                          <button
                            key={market.id}
                            onClick={() => handleSelectMarket(market)}
                            className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Building2 className="w-4 h-4 text-slate-400" />
                            {market.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick select from favorites */}
                {!newAlert.marketId && favoritesQuery.data && favoritesQuery.data.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-500 mb-2">Or select from your favorites:</p>
                    <div className="flex flex-wrap gap-2">
                      {favoritesQuery.data.slice(0, 5).map((fav) => (
                        <Button
                          key={fav.id}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectMarket({ id: fav.marketId, name: fav.marketName })}
                        >
                          {fav.marketName}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Alert Type */}
              <div className="space-y-2">
                <Label>Alert Type</Label>
                <Select
                  value={newAlert.alertType}
                  onValueChange={(value) => setNewAlert({ ...newAlert, alertType: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_changes">All Metric Changes</SelectItem>
                    <SelectItem value="revenue_change">Revenue Changes Only</SelectItem>
                    <SelectItem value="occupancy_change">Occupancy Changes Only</SelectItem>
                    <SelectItem value="adr_change">ADR Changes Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Threshold */}
              <div className="space-y-2">
                <Label>Minimum Change Threshold: {newAlert.thresholdPercent}%</Label>
                <Slider
                  value={[newAlert.thresholdPercent]}
                  onValueChange={([value]) => setNewAlert({ ...newAlert, thresholdPercent: value })}
                  min={5}
                  max={50}
                  step={5}
                  className="mt-2"
                />
                <p className="text-xs text-slate-500">
                  You'll be notified when metrics change by at least {newAlert.thresholdPercent}%
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCreateAlert}
                  disabled={createAlertMutation.isPending || !newAlert.email || !newAlert.marketId}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {createAlertMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Create Alert
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerts List */}
        {alertsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            <span className="ml-3 text-slate-600">Loading alerts...</span>
          </div>
        ) : alertsQuery.isError ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">Failed to load alerts. Please try again.</p>
            </CardContent>
          </Card>
        ) : (alertsQuery.data?.length || 0) === 0 ? (
          <Card className="border-dashed border-2 border-slate-300">
            <CardContent className="pt-12 pb-12 text-center">
              <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No Alerts Yet</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Create an alert to get notified when market metrics change significantly.
              </p>
              <Button
                onClick={() => setShowCreateForm(true)}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Alert
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Your Alerts ({alertsQuery.data?.length || 0})
            </h2>
            <div className="grid gap-4">
              {(alertsQuery.data || []).map((alert) => (
                <Card key={alert.id} className={`transition-opacity ${alert.isActive === 'false' ? 'opacity-60' : ''}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          alert.isActive === 'true' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {alert.isActive === 'true' ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{alert.marketName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {alertTypeIcons[alert.alertType]}
                              <span className="ml-1">{alertTypeLabels[alert.alertType]}</span>
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              ≥{alert.thresholdPercent}% change
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {alert.email}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Created {new Date(alert.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {alert.isActive === 'true' ? 'Active' : 'Paused'}
                          </span>
                          <Switch
                            checked={alert.isActive === 'true'}
                            onCheckedChange={() => toggleAlertMutation.mutate({ id: alert.id })}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteAlertMutation.mutate({ id: alert.id })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Info Card */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">How Alerts Work</h4>
                <p className="text-sm text-blue-700 mt-1">
                  We check market metrics daily and send you an email when changes exceed your threshold.
                  Alerts are based on Coach Inayah market data and compare current metrics to your baseline.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
