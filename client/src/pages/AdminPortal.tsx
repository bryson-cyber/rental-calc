import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Users, 
  Link2, 
  MousePointer, 
  Mail, 
  TrendingUp, 
  Plus,
  Copy,
  ExternalLink,
  Loader2,
  BarChart3,
  Send,
  Clock,
  MapPin
} from 'lucide-react';

export default function AdminPortal() {
  const { user, loading } = useAuth();
  const [newLinkForm, setNewLinkForm] = useState({
    email: '',
    hubspotContactId: '',
    targetCity: '',
    targetState: '',
    targetZip: '',
    targetTab: 'prove',
    campaignName: '',
  });

  // Fetch dashboard summary
  const { data: summary, isLoading: summaryLoading } = trpc.adminTracking.getDashboardSummary.useQuery(
    undefined,
    { enabled: user?.role === 'admin' }
  );

  // Fetch email opt-ins
  const { data: optins, isLoading: optinsLoading } = trpc.emailOptin.list.useQuery(
    { limit: 20, activeOnly: true },
    { enabled: user?.role === 'admin' }
  );

  // Fetch personalized links
  const { data: links, isLoading: linksLoading } = trpc.adminTracking.getLinks.useQuery(
    { limit: 20 },
    { enabled: user?.role === 'admin' }
  );

  // Fetch tool usage stats
  const { data: usageStats, isLoading: usageLoading } = trpc.adminTracking.getToolUsageStats.useQuery(
    { days: 30 },
    { enabled: user?.role === 'admin' }
  );

  // Create link mutation
  const createLink = trpc.adminTracking.createLink.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Personalized link created!');
        navigator.clipboard.writeText(data.linkUrl || '');
        toast.info('Link copied to clipboard');
        setNewLinkForm({
          email: '',
          hubspotContactId: '',
          targetCity: '',
          targetState: '',
          targetZip: '',
          targetTab: 'prove',
          campaignName: '',
        });
      }
    },
    onError: () => {
      toast.error('Failed to create link');
    },
  });

  const handleCreateLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkForm.targetCity || !newLinkForm.targetState) {
      toast.error('Please enter city and state');
      return;
    }
    createLink.mutate({
      email: newLinkForm.email || undefined,
      hubspotContactId: newLinkForm.hubspotContactId || undefined,
      targetCity: newLinkForm.targetCity,
      targetState: newLinkForm.targetState,
      targetZip: newLinkForm.targetZip || undefined,
      targetTab: newLinkForm.targetTab,
      campaignName: newLinkForm.campaignName || undefined,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
        </div>
      </DashboardLayout>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HubSpot Integration Portal</h1>
          <p className="text-gray-600 mt-1">Track personalized links, email opt-ins, and tool usage</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary?.totalOptins || 0}</p>
                  <p className="text-sm text-gray-600">Email Opt-ins</p>
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
                  <p className="text-2xl font-bold">{summary?.totalLinks || 0}</p>
                  <p className="text-sm text-gray-600">Links Created</p>
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
                  <p className="text-2xl font-bold">{summary?.totalClicks || 0}</p>
                  <p className="text-sm text-gray-600">Total Clicks</p>
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
                  <p className="text-2xl font-bold">{summary?.totalPromotions || 0}</p>
                  <p className="text-sm text-gray-600">Promotions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#C9A962]/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-[#C9A962]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary?.totalToolUsageEvents || 0}</p>
                  <p className="text-sm text-gray-600">Tool Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="links" className="space-y-4">
          <TabsList>
            <TabsTrigger value="links">Personalized Links</TabsTrigger>
            <TabsTrigger value="optins">Email Opt-ins</TabsTrigger>
            <TabsTrigger value="usage">Tool Usage</TabsTrigger>
            <TabsTrigger value="hubspot">HubSpot Templates</TabsTrigger>
          </TabsList>

          {/* Personalized Links Tab */}
          <TabsContent value="links" className="space-y-4">
            {/* Create New Link */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Personalized Link
                </CardTitle>
                <CardDescription>
                  Generate a personalized link for a HubSpot contact
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateLink} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Email (optional)</Label>
                      <Input
                        placeholder="contact@example.com"
                        value={newLinkForm.email}
                        onChange={(e) => setNewLinkForm({ ...newLinkForm, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>HubSpot Contact ID (optional)</Label>
                      <Input
                        placeholder="12345"
                        value={newLinkForm.hubspotContactId}
                        onChange={(e) => setNewLinkForm({ ...newLinkForm, hubspotContactId: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Campaign Name (optional)</Label>
                      <Input
                        placeholder="January 2026 Outreach"
                        value={newLinkForm.campaignName}
                        onChange={(e) => setNewLinkForm({ ...newLinkForm, campaignName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label>City *</Label>
                      <Input
                        placeholder="Loma Linda"
                        required
                        value={newLinkForm.targetCity}
                        onChange={(e) => setNewLinkForm({ ...newLinkForm, targetCity: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>State *</Label>
                      <Input
                        placeholder="CA"
                        required
                        value={newLinkForm.targetState}
                        onChange={(e) => setNewLinkForm({ ...newLinkForm, targetState: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>ZIP (optional)</Label>
                      <Input
                        placeholder="92354"
                        value={newLinkForm.targetZip}
                        onChange={(e) => setNewLinkForm({ ...newLinkForm, targetZip: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Target Tool</Label>
                      <select
                        className="w-full h-10 px-3 border rounded-md"
                        value={newLinkForm.targetTab}
                        onChange={(e) => setNewLinkForm({ ...newLinkForm, targetTab: e.target.value })}
                      >
                        <option value="prove">Revenue Calculator</option>
                        <option value="regulations">Regulation Tracker</option>
                        <option value="market">Market Advisor</option>
                        <option value="explore">Comps Explorer</option>
                        <option value="validate">Property Analyzer</option>
                        <option value="opportunity">Opportunity Finder</option>
                      </select>
                    </div>
                  </div>
                  <Button type="submit" disabled={createLink.isPending} className="bg-[#C9A962] hover:bg-[#b89952]">
                    {createLink.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Link
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Links List */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Links</CardTitle>
              </CardHeader>
              <CardContent>
                {linksLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : links && links.length > 0 ? (
                  <div className="space-y-3">
                    {links.map((link) => (
                      <div key={link.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{link.targetCity}, {link.targetState}</span>
                            {link.targetZip && <span className="text-gray-500">{link.targetZip}</span>}
                            <Badge variant="outline">{link.targetTab}</Badge>
                          </div>
                          <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
                            {link.email && <span>{link.email}</span>}
                            {link.campaignName && <span>Campaign: {link.campaignName}</span>}
                            <span className="flex items-center gap-1">
                              <MousePointer className="w-3 h-3" />
                              {link.clickCount || 0} clicks
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(link.linkUrl)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(link.linkUrl, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No links created yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Opt-ins Tab */}
          <TabsContent value="optins">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Email Subscribers
                </CardTitle>
                <CardDescription>
                  Users who opted in for personalized market updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                {optinsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : optins && optins.length > 0 ? (
                  <div className="space-y-3">
                    {optins.map((optin) => (
                      <div key={optin.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{optin.email}</span>
                            {optin.phone && <Badge variant="outline">SMS</Badge>}
                          </div>
                          <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
                            {optin.firstName && optin.lastName && (
                              <span>{optin.firstName} {optin.lastName}</span>
                            )}
                            {optin.city && optin.state && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {optin.city}, {optin.state}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(optin.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {optin.wantsMarketUpdates === 1 && <Badge className="bg-blue-100 text-blue-700">Market</Badge>}
                          {optin.wantsRegulationAlerts === 1 && <Badge className="bg-green-100 text-green-700">Regulations</Badge>}
                          {optin.wantsSmsAlerts === 1 && <Badge className="bg-purple-100 text-purple-700">SMS</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No opt-ins yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tool Usage Tab */}
          <TabsContent value="usage">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Usage by Tool</CardTitle>
                </CardHeader>
                <CardContent>
                  {usageLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : usageStats?.byTool ? (
                    <div className="space-y-2">
                      {Object.entries(usageStats.byTool).map(([tool, count]) => (
                        <div key={tool} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="font-medium capitalize">{tool.replace(/_/g, ' ')}</span>
                          <Badge>{count}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">No usage data yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Cities</CardTitle>
                </CardHeader>
                <CardContent>
                  {usageLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : usageStats?.byCity ? (
                    <div className="space-y-2">
                      {Object.entries(usageStats.byCity)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([city, count]) => (
                          <div key={city} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium">{city}</span>
                            <Badge>{count}</Badge>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">No city data yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* HubSpot Templates Tab */}
          <TabsContent value="hubspot">
            <Card>
              <CardHeader>
                <CardTitle>HubSpot Email Template Tokens</CardTitle>
                <CardDescription>
                  Copy these personalization tokens to use in your HubSpot email templates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* URL Encoding Warning */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    <span>⚠️</span> Important: URL Encoding for City Names
                  </h4>
                  <p className="text-sm text-amber-700 mb-2">
                    City names with spaces (e.g., "Las Vegas", "San Antonio", "New York") will <strong>break email links</strong> if not URL-encoded. 
                    The link will cut off at the space, showing a broken URL.
                  </p>
                  <p className="text-sm text-amber-700 mb-1">
                    <strong>Fix:</strong> In HubSpot marketing emails (HubL templates), use the <code className="bg-amber-100 px-1 rounded">|urlencode</code> filter:
                  </p>
                  <code className="text-xs text-amber-800 bg-amber-100 px-2 py-1 rounded block mb-2">
                    {`{{ contact.data_perfection__city|urlencode }}`}
                  </code>
                  <p className="text-sm text-amber-700">
                    <strong>For sales emails / sequences:</strong> HubL filters are not available. Use the "Generate Pre-Encoded Links" section below to create ready-to-paste links for specific cities.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Personalized Tool Links (Marketing Emails with HubL)</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Use these in HubSpot <strong>marketing email templates</strong> (supports HubL). The <code className="bg-gray-100 px-1 rounded">|urlencode</code> filter ensures city names with spaces work correctly.
                  </p>
                  <div className="space-y-3">
                    {[
                      { name: 'Revenue Calculator', tab: 'prove' },
                      { name: 'Regulation Tracker', tab: 'regulations' },
                      { name: 'Market Advisor', tab: 'market' },
                      { name: 'Comps Explorer', tab: 'explore' },
                      { name: 'Property Analyzer', tab: 'validate' },
                      { name: 'Opportunity Finder', tab: 'opportunity' },
                      { name: 'AI Advisor', tab: 'advisor' },
                    ].map((tool) => (
                      <div key={tool.tab} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{tool.name}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(
                              `https://coachinayahturnkeytool.com/?tab=${tool.tab}&city={{ contact.data_perfection__city|urlencode }}&state={{ contact.data_perfection__state|urlencode }}&zip={{ contact.data_perfection__postal_code|urlencode }}&autoAnalyze=true`
                            )}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <code className="text-xs text-gray-600 break-all">
                          {'https://coachinayahturnkeytool.com/?tab='}{tool.tab}{'&city={{ contact.data_perfection__city|urlencode }}&state={{ contact.data_perfection__state|urlencode }}&zip={{ contact.data_perfection__postal_code|urlencode }}&autoAnalyze=true'}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pre-Encoded Link Generator for Sales Emails */}
                <div>
                  <h3 className="font-semibold mb-3">Generate Pre-Encoded Links (for Sales Emails)</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    For sales emails and sequences where HubL filters aren't available, generate a properly encoded link for a specific city here.
                  </p>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">City</label>
                        <Input
                          placeholder="Las Vegas"
                          value={newLinkForm.targetCity}
                          onChange={(e) => setNewLinkForm({ ...newLinkForm, targetCity: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">State</label>
                        <Input
                          placeholder="NV"
                          value={newLinkForm.targetState}
                          onChange={(e) => setNewLinkForm({ ...newLinkForm, targetState: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Tool</label>
                        <select
                          className="w-full h-9 text-sm border rounded-md px-2 bg-white"
                          value={newLinkForm.targetTab}
                          onChange={(e) => setNewLinkForm({ ...newLinkForm, targetTab: e.target.value })}
                        >
                          <option value="prove">Revenue Calculator</option>
                          <option value="regulations">Regulation Tracker</option>
                          <option value="market">Market Advisor</option>
                          <option value="explore">Comps Explorer</option>
                          <option value="validate">Property Analyzer</option>
                          <option value="opportunity">Opportunity Finder</option>
                          <option value="advisor">AI Advisor</option>
                        </select>
                      </div>
                    </div>
                    {newLinkForm.targetCity && newLinkForm.targetState && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-600">Generated Link (safe for emails):</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const params = new URLSearchParams();
                              params.set('tab', newLinkForm.targetTab);
                              params.set('city', newLinkForm.targetCity);
                              params.set('state', newLinkForm.targetState);
                              if (newLinkForm.targetZip) params.set('zip', newLinkForm.targetZip);
                              params.set('autoAnalyze', 'true');
                              copyToClipboard(`https://coachinayahturnkeytool.com/?${params.toString()}`);
                            }}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <code className="text-xs text-blue-700 bg-blue-100 px-2 py-1.5 rounded block break-all">
                          {(() => {
                            const params = new URLSearchParams();
                            params.set('tab', newLinkForm.targetTab);
                            params.set('city', newLinkForm.targetCity);
                            params.set('state', newLinkForm.targetState);
                            if (newLinkForm.targetZip) params.set('zip', newLinkForm.targetZip);
                            params.set('autoAnalyze', 'true');
                            return `https://coachinayahturnkeytool.com/?${params.toString()}`;
                          })()}
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Verified HubSpot Property Names ✓</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    These are the correct internal property names from your HubSpot account (Data Perfection / LeadFi fields):
                  </p>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><strong>City:</strong> <code className="bg-white px-2 py-0.5 rounded">data_perfection__city</code></div>
                      <div><strong>State:</strong> <code className="bg-white px-2 py-0.5 rounded">data_perfection__state</code></div>
                      <div><strong>Postal Code:</strong> <code className="bg-white px-2 py-0.5 rounded">data_perfection__postal_code</code></div>
                      <div><strong>Address:</strong> <code className="bg-white px-2 py-0.5 rounded">data_perfection__address</code></div>
                      <div><strong>Phone:</strong> <code className="bg-white px-2 py-0.5 rounded">data_perfection__phones</code></div>
                      <div><strong>Age:</strong> <code className="bg-white px-2 py-0.5 rounded">data_perfection__age</code></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
