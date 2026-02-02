/**
 * Newsletter Dashboard - Admin page for managing the Deal Flow Machine
 * 
 * Features:
 * - View newsletter send statistics
 * - Trigger manual newsletter jobs
 * - Preview newsletter content
 * - View job history
 * - Manage cities and contacts
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Mail, 
  Send, 
  BarChart3, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  MapPin, 
  Users,
  Play,
  Eye,
  Settings,
  RefreshCw,
  TrendingUp,
  Building
} from 'lucide-react';

export default function NewsletterDashboard() {
  // Using sonner toast
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testFirstName, setTestFirstName] = useState('');
  const [testType, setTestType] = useState<'weekly_market' | 'deal_alert'>('weekly_market');
  
  // Queries
  const dashboardStats = trpc.newsletter.getDashboardStats.useQuery();
  const cities = trpc.newsletter.getCities.useQuery();
  const jobHistory = trpc.newsletter.getJobHistory.useQuery({ limit: 20 });
  const config = trpc.newsletter.getConfig.useQuery();
  
  // Mutations
  const triggerWeekly = trpc.newsletter.triggerWeeklyJob.useMutation({
    onSuccess: () => {
      toast.success('Weekly Newsletter Job Started', {
        description: 'The job is running in the background. Check job history for results.',
      });
    },
    onError: (error) => {
      toast.error('Error', {
        description: error.message,
      });
    },
  });
  
  const triggerDealAlert = trpc.newsletter.triggerDealAlertJob.useMutation({
    onSuccess: () => {
      toast.success('Deal Alert Job Started', {
        description: 'The job is running in the background. Check job history for results.',
      });
    },
    onError: (error) => {
      toast.error('Error', {
        description: error.message,
      });
    },
  });
  
  const sendTest = trpc.newsletter.sendTestEmail.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Test Email Generated', {
          description: `Subject: ${data.content?.subject}`,
        });
      } else {
        toast.error(data.error || 'An error occurred');
      }
    },
    onError: (error) => {
      toast.error('Error', {
        description: error.message,
      });
    },
  });
  
  const previewContent = trpc.newsletter.previewContent.useQuery(
    { city: selectedCity, state: selectedState, type: testType },
    { enabled: !!selectedCity && !!selectedState }
  );
  
  const stats = dashboardStats.data?.last30Days;
  
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deal Flow Machine</h1>
          <p className="text-muted-foreground">
            Autonomous newsletter system for market intelligence and deal alerts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              dashboardStats.refetch();
              cities.refetch();
              jobHistory.refetch();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent (30d)</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.successful || 0} successful, {stats?.failed || 0} failed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total ? Math.round((stats.successful / stats.total) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Email delivery rate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cities</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.data?.totalCities || 0}</div>
            <p className="text-xs text-muted-foreground">
              Cities with contacts
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Jobs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.data?.recentJobs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Jobs in last 7 days
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cities">Cities</TabsTrigger>
          <TabsTrigger value="jobs">Job History</TabsTrigger>
          <TabsTrigger value="test">Test & Preview</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Manually trigger newsletter jobs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
            
            {/* Recent Jobs */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Jobs</CardTitle>
                <CardDescription>
                  Latest newsletter job runs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardStats.data?.recentJobs?.slice(0, 5).map((job, i) => (
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
                        <span className="text-sm font-medium">{job.emailsSent} sent</span>
                        {job.emailsFailed > 0 && (
                          <Badge variant="destructive">{job.emailsFailed} failed</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!dashboardStats.data?.recentJobs || dashboardStats.data.recentJobs.length === 0) && (
                    <p className="text-sm text-muted-foreground">No recent jobs</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

        </TabsContent>
        
        {/* Cities Tab */}
        <TabsContent value="cities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cities with Contacts</CardTitle>
              <CardDescription>
                HubSpot contacts grouped by Data Perfection city field
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cities.isLoading ? (
                <p className="text-muted-foreground">Loading cities...</p>
              ) : cities.data && cities.data.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {cities.data.map((city, i) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        setSelectedCity(city.city);
                        setSelectedState(city.state);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{city.city}, {city.state}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{city.contactCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No cities found. Make sure HubSpot is configured and contacts have Data Perfection fields.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Job History Tab */}
        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job History</CardTitle>
              <CardDescription>
                Complete history of newsletter job runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobHistory.isLoading ? (
                <p className="text-muted-foreground">Loading job history...</p>
              ) : jobHistory.data && jobHistory.data.length > 0 ? (
                <div className="space-y-4">
                  {jobHistory.data.map((job, i) => (
                    <div key={i} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={job.type === 'weekly_market' ? 'default' : 'secondary'}>
                            {job.type === 'weekly_market' ? 'Weekly Market' : 'Deal Alert'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(job.startedAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {job.emailsFailed === 0 ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Cities:</span>
                          <span className="ml-2 font-medium">{job.citiesProcessed}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Contacts:</span>
                          <span className="ml-2 font-medium">{job.contactsProcessed}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sent:</span>
                          <span className="ml-2 font-medium text-green-600">{job.emailsSent}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Failed:</span>
                          <span className="ml-2 font-medium text-red-600">{job.emailsFailed}</span>
                        </div>
                      </div>
                      {job.errors && job.errors.length > 0 && (
                        <div className="mt-2 p-2 rounded bg-red-50 text-red-700 text-sm">
                          {job.errors.slice(0, 3).map((err, j) => (
                            <div key={j}>{err}</div>
                          ))}
                          {job.errors.length > 3 && (
                            <div>...and {job.errors.length - 3} more errors</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No job history yet. Run a newsletter job to see results here.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Test & Preview Tab */}
        <TabsContent value="test" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Test Email Form */}
            <Card>
              <CardHeader>
                <CardTitle>Send Test Email</CardTitle>
                <CardDescription>
                  Send a test newsletter to a specific email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="testEmail">Email Address</Label>
                  <Input
                    id="testEmail"
                    type="email"
                    placeholder="test@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="testFirstName">First Name</Label>
                  <Input
                    id="testFirstName"
                    placeholder="John"
                    value={testFirstName}
                    onChange={(e) => setTestFirstName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="testCity">City</Label>
                    <Input
                      id="testCity"
                      placeholder="Denver"
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="testState">State</Label>
                    <Input
                      id="testState"
                      placeholder="CO"
                      value={selectedState}
                      onChange={(e) => setSelectedState(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Newsletter Type</Label>
                  <Select value={testType} onValueChange={(v) => setTestType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly_market">Weekly Market Intelligence</SelectItem>
                      <SelectItem value="deal_alert">Deal Alert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => sendTest.mutate({
                    email: testEmail,
                    firstName: testFirstName,
                    city: selectedCity,
                    state: selectedState,
                    type: testType
                  })}
                  disabled={!testEmail || !testFirstName || !selectedCity || !selectedState || sendTest.isPending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Generate Test Email
                </Button>
              </CardContent>
            </Card>
            
            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Content Preview</CardTitle>
                <CardDescription>
                  Preview newsletter content for selected city
                </CardDescription>
              </CardHeader>
              <CardContent>
                {previewContent.isLoading ? (
                  <p className="text-muted-foreground">Loading preview...</p>
                ) : previewContent.data?.content ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Subject</Label>
                      <p className="font-medium">{previewContent.data.content.subject}</p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-muted-foreground">Greeting</Label>
                      <p>{previewContent.data.content.greeting}</p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-muted-foreground">Main Content</Label>
                      <div className="mt-2 p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                        {previewContent.data.content.mainContent}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-muted-foreground">Call to Action</Label>
                      <p>{previewContent.data.content.callToAction}</p>
                    </div>
                  </div>
                ) : selectedCity && selectedState ? (
                  <p className="text-muted-foreground">
                    {previewContent.data?.error || 'Unable to generate preview. Make sure the city has market data.'}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Enter a city and state to preview newsletter content
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                Newsletter system configuration and API status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {config.isLoading ? (
                <p className="text-muted-foreground">Loading configuration...</p>
              ) : config.data ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">HubSpot API</span>
                        {config.data.hubspotConfigured ? (
                          <Badge variant="default" className="bg-green-500">Connected</Badge>
                        ) : (
                          <Badge variant="destructive">Not Configured</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Required for sending emails and fetching contacts
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">AirDNA API</span>
                        {config.data.airdnaConfigured ? (
                          <Badge variant="default" className="bg-green-500">Connected</Badge>
                        ) : (
                          <Badge variant="destructive">Not Configured</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Required for market data and deal analysis
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Gemini API</span>
                        {config.data.geminiConfigured ? (
                          <Badge variant="default" className="bg-green-500">Connected</Badge>
                        ) : (
                          <Badge variant="destructive">Not Configured</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Required for AI-generated newsletter content
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Email Templates</span>
                        {config.data.weeklyEmailTemplateId !== 'Not configured' ? (
                          <Badge variant="default" className="bg-green-500">Configured</Badge>
                        ) : (
                          <Badge variant="outline">Not Set</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        HubSpot email template IDs for newsletters
                      </p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="font-medium mb-2">Environment Variables</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <code className="text-muted-foreground">HUBSPOT_WEEKLY_EMAIL_ID</code>
                        <span>{config.data.weeklyEmailTemplateId}</span>
                      </div>
                      <div className="flex justify-between">
                        <code className="text-muted-foreground">HUBSPOT_DEAL_ALERT_EMAIL_ID</code>
                        <span>{config.data.dealAlertEmailTemplateId}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h4 className="font-medium mb-2">Setup Instructions</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>Create email templates in HubSpot Marketing Hub</li>
                      <li>Note the template IDs from the URL (e.g., /email/123456)</li>
                      <li>Set HUBSPOT_WEEKLY_EMAIL_ID and HUBSPOT_DEAL_ALERT_EMAIL_ID in Settings → Secrets</li>
                      <li>Use HubL tokens in templates: {"{{ custom.subject }}"}, {"{{ custom.mainContent }}"}, etc.</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Unable to load configuration</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
