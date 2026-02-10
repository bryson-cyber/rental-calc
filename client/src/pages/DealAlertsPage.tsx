/**
 * Deal Alerts Page
 * 
 * "Claude Code for STR" - The autonomous deal scanning agent UI.
 * Users set criteria, the agent scans for matching deals while they sleep.
 */

import { useState, useMemo, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import CityAutocomplete from '@/components/CityAutocomplete';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  BellOff,
  Mail,
  Trash2,
  Plus,
  Loader2,
  Search,
  Zap,
  Target,
  TrendingUp,
  DollarSign,
  Home,
  BedDouble,
  Bath,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Bookmark,
  X,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Star,
  BarChart3,
  Shield,
} from 'lucide-react';
import { Link, useSearch } from 'wouter';
import { toast } from 'sonner';

// US States for dropdown
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
];

export default function DealAlertsPage() {
  const searchString = useSearch();
  const urlParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  
  const [sessionId] = useState(() => {
    let id = localStorage.getItem('favoriteSessionId');
    if (!id) {
      id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('favoriteSessionId', id);
    }
    return id;
  });

  // If city/state provided via URL, start on create tab
  const [activeTab, setActiveTab] = useState<'alerts' | 'matches' | 'create'>(
    urlParams.get('city') && urlParams.get('state') ? 'create' : 'alerts'
  );
  const [selectedCriteriaId, setSelectedCriteriaId] = useState<number | null>(null);
  const [expandedCriteria, setExpandedCriteria] = useState<number | null>(null);
  
  // Form state for creating new alert
  const [form, setForm] = useState({
    email: localStorage.getItem('userEmail') || '',
    firstName: localStorage.getItem('userName') || '',
    phone: '',
    city: urlParams.get('city') || '',
    state: urlParams.get('state') || '',
    zipCode: '',
    analysisType: 'arbitrage' as 'arbitrage' | 'investment' | 'both',
    minBedrooms: 1,
    maxBedrooms: 5,
    maxRent: undefined as number | undefined,
    maxPurchasePrice: undefined as number | undefined,
    minMonthlyProfit: 500,
    minDealScore: 50,
    frequency: 'daily' as 'instant' | 'daily' | 'weekly',
    notifyEmail: true,
    notifySms: false,
  });

  // Queries
  const alertsQuery = trpc.dealAlerts.list.useQuery(
    { sessionId, email: form.email || undefined },
    { enabled: !!sessionId }
  );

  const matchesQuery = trpc.dealAlerts.getMatches.useQuery(
    { criteriaId: selectedCriteriaId! },
    { enabled: !!selectedCriteriaId }
  );

  // Mutations
  const createMutation = trpc.dealAlerts.create.useMutation({
    onSuccess: (data) => {
      toast.success('Deal alert created! The agent will start scanning for you.');
      alertsQuery.refetch();
      setActiveTab('alerts');
      // Save email for future use
      if (form.email) localStorage.setItem('userEmail', form.email);
      if (form.firstName) localStorage.setItem('userName', form.firstName);
    },
    onError: (err) => toast.error(`Failed to create alert: ${err.message}`),
  });

  const toggleMutation = trpc.dealAlerts.toggle.useMutation({
    onSuccess: () => {
      alertsQuery.refetch();
      toast.success('Alert updated');
    },
  });

  const deleteMutation = trpc.dealAlerts.delete.useMutation({
    onSuccess: () => {
      alertsQuery.refetch();
      toast.success('Alert deleted');
    },
  });

  const scanMutation = trpc.dealAlerts.scan.useMutation({
    onSuccess: (result) => {
      alertsQuery.refetch();
      if (selectedCriteriaId) matchesQuery.refetch();
      toast.success(`Scan complete! Found ${result.matchesFound} matches.`);
    },
    onError: (err) => toast.error(`Scan failed: ${err.message}`),
  });

  const updateMatchMutation = trpc.dealAlerts.updateMatchStatus.useMutation({
    onSuccess: () => matchesQuery.refetch(),
  });

  const handleCreate = () => {
    if (!form.email || !form.city || !form.state) {
      toast.error('Please fill in email, city, and state');
      return;
    }
    createMutation.mutate({
      ...form,
      sessionId,
      maxRent: form.maxRent || undefined,
      maxPurchasePrice: form.maxPurchasePrice || undefined,
    });
  };

  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  const formatPercent = (n: number) => `${Math.round(n * 100)}%`;

  const alerts = alertsQuery.data || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Calculator
          </Link>
          
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-serif font-semibold text-foreground">Deal Alert Agent</h1>
              <p className="text-muted-foreground text-sm">Your autonomous STR deal scanner — finds deals while you sleep</p>
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'alerts' 
                  ? 'bg-primary/10 text-primary border border-primary/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Bell className="w-4 h-4 inline mr-2" />
              My Alerts ({alerts.length})
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'create' 
                  ? 'bg-primary/10 text-primary border border-primary/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-2" />
              New Alert
            </button>
            {selectedCriteriaId && (
              <button
                onClick={() => setActiveTab('matches')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'matches' 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Target className="w-4 h-4 inline mr-2" />
                Matches
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Create Alert Form */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Set Your Deal Criteria
                </CardTitle>
                <CardDescription>
                  Tell the agent what you're looking for. It will scan for matching properties and alert you when deals are found.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email *</Label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">First Name</Label>
                    <Input
                      placeholder="Your name"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Target Market
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <CityAutocomplete
                        initialCity={form.city}
                        initialState={form.state}
                        onCitySelect={(c, s, zip) => setForm({ ...form, city: c, state: s, ...(zip ? { zipCode: zip } : {}) })}
                        placeholder="Search for a city (e.g., Denver, CO)"
                        label="City *"
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Zip Code</Label>
                      <Input
                        placeholder="Optional"
                        value={form.zipCode}
                        onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Analysis Type */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Home className="w-4 h-4 text-primary" />
                    Strategy
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'arbitrage', label: 'Rental Arbitrage', desc: 'Rent & sublet on Airbnb' },
                      { value: 'investment', label: 'Investment', desc: 'Buy & list as STR' },
                      { value: 'both', label: 'Both', desc: 'Scan for all deals' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setForm({ ...form, analysisType: opt.value as any })}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          form.analysisType === opt.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="text-sm font-medium">{opt.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Property Criteria */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <BedDouble className="w-4 h-4 text-primary" />
                    Property Criteria
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Bedrooms: {form.minBedrooms} - {form.maxBedrooms}
                      </Label>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-muted-foreground">Min</span>
                        <Slider
                          value={[form.minBedrooms]}
                          onValueChange={([v]) => setForm({ ...form, minBedrooms: v })}
                          min={1}
                          max={8}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground">Max</span>
                        <Slider
                          value={[form.maxBedrooms]}
                          onValueChange={([v]) => setForm({ ...form, maxBedrooms: v })}
                          min={1}
                          max={8}
                          step={1}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    {(form.analysisType === 'arbitrage' || form.analysisType === 'both') && (
                      <div>
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Max Monthly Rent</Label>
                        <div className="relative mt-1">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="number"
                            placeholder="e.g., 2500"
                            value={form.maxRent || ''}
                            onChange={(e) => setForm({ ...form, maxRent: e.target.value ? parseInt(e.target.value) : undefined })}
                            className="pl-9"
                          />
                        </div>
                      </div>
                    )}
                    {(form.analysisType === 'investment' || form.analysisType === 'both') && (
                      <div>
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Max Purchase Price</Label>
                        <div className="relative mt-1">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="number"
                            placeholder="e.g., 350000"
                            value={form.maxPurchasePrice || ''}
                            onChange={(e) => setForm({ ...form, maxPurchasePrice: e.target.value ? parseInt(e.target.value) : undefined })}
                            className="pl-9"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Profitability Thresholds */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Minimum Profitability
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Min Monthly Profit: {formatCurrency(form.minMonthlyProfit)}
                      </Label>
                      <Slider
                        value={[form.minMonthlyProfit]}
                        onValueChange={([v]) => setForm({ ...form, minMonthlyProfit: v })}
                        min={0}
                        max={5000}
                        step={100}
                        className="mt-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>$0</span>
                        <span>$5,000</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Min Deal Score: {form.minDealScore}/100
                      </Label>
                      <Slider
                        value={[form.minDealScore]}
                        onValueChange={([v]) => setForm({ ...form, minDealScore: v })}
                        min={0}
                        max={100}
                        step={5}
                        className="mt-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Any deal</span>
                        <span>Top deals only</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notification Preferences */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    Notification Preferences
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Scan Frequency</Label>
                      <Select value={form.frequency} onValueChange={(v: any) => setForm({ ...form, frequency: v })}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="instant">Instant (scan on demand)</SelectItem>
                          <SelectItem value="daily">Daily digest</SelectItem>
                          <SelectItem value="weekly">Weekly summary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3 mt-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Email notifications</Label>
                        <Switch
                          checked={form.notifyEmail}
                          onCheckedChange={(v) => setForm({ ...form, notifyEmail: v })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">SMS notifications</Label>
                        <Switch
                          checked={form.notifySms}
                          onCheckedChange={(v) => setForm({ ...form, notifySms: v })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !form.email || !form.city || !form.state}
                  className="w-full bg-foreground hover:bg-foreground/90 text-white py-6 text-lg font-semibold"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Zap className="w-5 h-5 mr-2" />
                  )}
                  Activate Deal Agent
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  The agent will scan for properties matching your criteria and send you alerts. You can pause or delete alerts anytime.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alerts List */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {alertsQuery.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : alerts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-serif font-semibold mb-2">No Deal Alerts Yet</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                    Set up your first deal alert and let the agent find profitable STR opportunities for you automatically.
                  </p>
                  <Button onClick={() => setActiveTab('create')} className="bg-foreground">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Alert
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-serif font-semibold">Active Alerts</h2>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('create')}>
                    <Plus className="w-4 h-4 mr-1" />
                    New Alert
                  </Button>
                </div>
                
                {alerts.map((alert) => (
                  <Card 
                    key={alert.id} 
                    className={`transition-all hover:shadow-md ${
                      alert.isActive === 1 ? 'border-primary/20' : 'opacity-60 border-muted'
                    }`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            alert.isActive === 1 ? 'bg-primary/10' : 'bg-muted'
                          }`}>
                            {alert.isActive === 1 ? (
                              <Bell className="w-5 h-5 text-primary" />
                            ) : (
                              <BellOff className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold flex items-center gap-2">
                              {alert.city}, {alert.state}
                              <Badge variant={alert.isActive === 1 ? 'default' : 'secondary'} className="text-xs">
                                {alert.isActive === 1 ? 'Active' : 'Paused'}
                              </Badge>
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {alert.analysisType === 'arbitrage' ? 'Arbitrage' : alert.analysisType === 'investment' ? 'Investment' : 'Both'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {alert.minBedrooms}-{alert.maxBedrooms} BR
                              </Badge>
                              {alert.minMonthlyProfit && (
                                <Badge variant="outline" className="text-xs">
                                  Min ${alert.minMonthlyProfit}/mo profit
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs capitalize">
                                {alert.frequency}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCriteriaId(alert.id);
                              setActiveTab('matches');
                            }}
                            title="View matches"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => scanMutation.mutate({ criteriaId: alert.id })}
                            disabled={scanMutation.isPending}
                            title="Scan now"
                          >
                            {scanMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMutation.mutate({ criteriaId: alert.id })}
                            title={alert.isActive === 1 ? 'Pause' : 'Resume'}
                          >
                            {alert.isActive === 1 ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Delete this alert and all its matches?')) {
                                deleteMutation.mutate({ criteriaId: alert.id });
                              }
                            }}
                            className="text-destructive hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Stats row */}
                      <div className="flex gap-6 mt-4 pt-3 border-t text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5" />
                          <span>{alert.totalMatchesFound} matches found</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          <span>{alert.totalAlertsSent} alerts sent</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {alert.lastScannedAt 
                              ? `Last scan: ${new Date(alert.lastScannedAt).toLocaleDateString()}`
                              : 'Not scanned yet'
                            }
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}

        {/* Matches View */}
        {activeTab === 'matches' && selectedCriteriaId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('alerts')}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <h2 className="text-lg font-serif font-semibold">Deal Matches</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => scanMutation.mutate({ criteriaId: selectedCriteriaId })}
                disabled={scanMutation.isPending}
              >
                {scanMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                Scan Now
              </Button>
            </div>

            {matchesQuery.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !matchesQuery.data?.length ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-serif font-semibold mb-2">No Matches Yet</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                    The agent hasn't found any deals matching your criteria yet. Click "Scan Now" to run an immediate scan, or wait for the next scheduled scan.
                  </p>
                  <Button
                    onClick={() => scanMutation.mutate({ criteriaId: selectedCriteriaId })}
                    disabled={scanMutation.isPending}
                    className="bg-foreground"
                  >
                    {scanMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Run First Scan
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {matchesQuery.data.map((match) => (
                  <Card 
                    key={match.id} 
                    className={`transition-all hover:shadow-md ${
                      match.status === 'new' ? 'border-primary/30 bg-primary/[0.02]' : ''
                    }`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {match.status === 'new' && (
                              <Badge className="bg-primary text-white text-xs">New</Badge>
                            )}
                            {match.dealGrade && (
                              <Badge variant={
                                match.dealGrade === 'A' ? 'default' : 
                                match.dealGrade === 'B' ? 'secondary' : 'outline'
                              } className="text-xs">
                                Grade {match.dealGrade}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              Score: {match.dealScore}/100
                            </span>
                          </div>
                          
                          <h3 className="font-semibold">
                            {match.city}, {match.state}
                            {match.zipCode ? ` ${match.zipCode}` : ''}
                          </h3>
                          
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span>{match.bedrooms} BR / {match.bathrooms} BA</span>
                            {match.propertyType && <span className="capitalize">{match.propertyType}</span>}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateMatchMutation.mutate({ matchId: match.id, status: 'saved' })}
                            title="Save"
                          >
                            <Bookmark className={`w-4 h-4 ${match.status === 'saved' ? 'fill-primary text-primary' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateMatchMutation.mutate({ matchId: match.id, status: 'dismissed' })}
                            title="Dismiss"
                            className="text-muted-foreground"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Financial details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t">
                        {match.monthlyRent && (
                          <div>
                            <div className="text-xs text-muted-foreground">Monthly Rent</div>
                            <div className="font-semibold">{formatCurrency(match.monthlyRent)}</div>
                          </div>
                        )}
                        {match.projectedRevenue && (
                          <div>
                            <div className="text-xs text-muted-foreground">Projected Revenue</div>
                            <div className="font-semibold text-green-700">{formatCurrency(Math.round(match.projectedRevenue / 12))}/mo</div>
                          </div>
                        )}
                        {match.projectedMonthlyProfit && (
                          <div>
                            <div className="text-xs text-muted-foreground">Monthly Profit</div>
                            <div className={`font-semibold ${match.projectedMonthlyProfit > 0 ? 'text-green-700' : 'text-red-600'}`}>
                              {formatCurrency(match.projectedMonthlyProfit)}
                            </div>
                          </div>
                        )}
                        {match.projectedOccupancy && (
                          <div>
                            <div className="text-xs text-muted-foreground">Occupancy</div>
                            <div className="font-semibold">{formatPercent(parseFloat(match.projectedOccupancy))}</div>
                          </div>
                        )}
                      </div>
                      
                      {/* CTAs */}
                      <div className="mt-3 pt-3 border-t flex flex-wrap gap-3">
                        <Link 
                          href={`/?tab=opportunity&city=${encodeURIComponent(match.city)}&state=${encodeURIComponent(match.state)}${match.zipCode ? `&zip=${encodeURIComponent(match.zipCode)}` : ''}&bedrooms=${match.bedrooms}`}
                          className="text-sm text-primary hover:underline font-medium inline-flex items-center gap-1"
                        >
                          <Search className="w-3.5 h-3.5" />
                          Find properties in {match.city} →
                        </Link>
                        <Link 
                          href={`/?tab=prove&address=${encodeURIComponent(match.address)}&bedrooms=${match.bedrooms}&bathrooms=${match.bathrooms}&rent=${match.monthlyRent || ''}`}
                          className="text-sm text-muted-foreground hover:text-foreground hover:underline font-medium inline-flex items-center gap-1"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          See revenue estimate
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
