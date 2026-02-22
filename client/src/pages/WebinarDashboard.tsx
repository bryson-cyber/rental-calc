/**
 * Webinar Show-Up Machine — Admin Dashboard
 * 
 * Owner-only dashboard for managing webinar SMS reminders, no-show blasts,
 * and AI conversation engine. Embedded as a tab in the Unified Admin.
 */

import { useState, useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  MessageSquare,
  Users,
  Calendar,
  Send,
  Zap,
  RefreshCw,
  Loader2,
  Phone,
  Clock,
  AlertTriangle,

  Plus,
  ChevronRight,
  ArrowLeft,
  Bot,
  Bell,
  Radio,
  UserPlus,
  Eye,
  Edit,
  Power,
  ShieldCheck,
  Download,
  Activity,
  CheckCircle,
  XCircle,
  MessageCircle,
  Link2,
  Save,
  ExternalLink,
} from 'lucide-react';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------------------------------------------------------------------------
// MAIN DASHBOARD
// ---------------------------------------------------------------------------

export function WebinarDashboardTab() {
  const [view, setView] = useState<'overview' | 'schedule' | 'conversations' | 'templates'>('overview');
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Navigation breadcrumb */}
      {view !== 'overview' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setView('overview');
            setSelectedScheduleId(null);
            setSelectedPhone(null);
          }}
          className="mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Overview
        </Button>
      )}

      {view === 'overview' && (
        <OverviewPanel
          onViewSchedule={(id) => { setSelectedScheduleId(id); setView('schedule'); }}
          onViewConversations={() => setView('conversations')}
          onViewTemplates={() => setView('templates')}
        />
      )}

      {view === 'schedule' && selectedScheduleId && (
        <ScheduleDetailPanel
          scheduleId={selectedScheduleId}
          onBack={() => { setView('overview'); setSelectedScheduleId(null); }}
        />
      )}

      {view === 'conversations' && (
        <ConversationsPanel
          selectedPhone={selectedPhone}
          onSelectPhone={setSelectedPhone}
        />
      )}

      {view === 'templates' && (
        <TemplatesPanel />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OVERVIEW PANEL
// ---------------------------------------------------------------------------

function OverviewPanel({
  onViewSchedule,
  onViewConversations,
  onViewTemplates,
}: {
  onViewSchedule: (id: number) => void;
  onViewConversations: () => void;
  onViewTemplates: () => void;
}) {
  const { data: stats, isLoading, refetch } = trpc.webinar.getDashboardStats.useQuery();
  const { data: schedules, isLoading: schedulesLoading, refetch: refetchSchedules } = trpc.webinar.listSchedules.useQuery();

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Calendar className="w-5 h-5 text-amber-600" />}
          label="Active Schedules"
          value={stats?.activeSchedules ?? 0}
          sublabel={`${stats?.totalSchedules ?? 0} total`}
        />
        <StatCard
          icon={<Phone className="w-5 h-5 text-blue-600" />}
          label="Active Textable"
          value={stats?.activeTextable ?? 0}
          sublabel={`${stats?.totalRegistrants ?? 0} total registered`}
        />
        <StatCard
          icon={<Send className="w-5 h-5 text-green-600" />}
          label="SMS Sent"
          value={stats?.totalSmsSent ?? 0}
          sublabel={`${stats?.totalConversations ?? 0} conversations`}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          label="No-Shows"
          value={stats?.totalNoShows ?? 0}
          sublabel={stats?.totalRegistrants ? `${Math.round((stats.totalNoShows / stats.totalRegistrants) * 100)}% rate` : '0% rate'}
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setShowCreateDialog(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          New Schedule
        </Button>
        <Button variant="outline" size="sm" onClick={onViewConversations}>
          <MessageSquare className="w-4 h-4 mr-1" />
          View Conversations
        </Button>
        <Button variant="outline" size="sm" onClick={onViewTemplates}>
          <Edit className="w-4 h-4 mr-1" />
          Edit Templates
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { refetch(); refetchSchedules(); }}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Active Numbers Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            Active Numbers Breakdown
          </CardTitle>
          <CardDescription>Live count of textable phone numbers for today's blasts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-2xl font-bold text-green-600">{stats?.activeTextable ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Active Textable</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="text-2xl font-bold text-blue-600">{stats?.totalRegistrants ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Registered</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-2xl font-bold text-red-600">{stats?.optedOut ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Opted Out</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="text-2xl font-bold text-amber-600">{stats?.totalAttended ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Attended</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="text-2xl font-bold text-purple-600">{stats?.totalNoShows ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">No-Shows</div>
            </div>
          </div>
          {stats?.noPhone ? (
            <p className="text-xs text-muted-foreground mt-3">{stats.noPhone} registrant{stats.noPhone > 1 ? 's' : ''} without a phone number on file</p>
          ) : null}
        </CardContent>
      </Card>

      {/* SMS Blast Delivery Tracker */}
      <BlastDeliveryTracker />

      {/* AI Toggle & Sync Attendance */}
      <AiToggleCard />

      {/* Cron Scheduler Status */}
      <CronStatusCard />

      {/* Webhook & Polling Status */}
      <WebhookStatusCard />

      {/* Schedules List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Webinar Schedules</CardTitle>
          <CardDescription>Manage your webinar schedules and send reminders</CardDescription>
        </CardHeader>
        <CardContent>
          {schedulesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !schedules?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No webinar schedules yet.</p>
              <p className="text-sm mt-1">Create your first schedule to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onViewSchedule(schedule.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${schedule.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div>
                      <p className="font-medium">{schedule.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {DAYS_OF_WEEK[schedule.dayOfWeek]}s at {schedule.startTime} {schedule.timezone?.replace('America/', '')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium">{(schedule as any).registrantCount ?? '—'} registrants</p>
                      {schedule.webinarjamWebinarId && (
                        <p className="text-xs text-muted-foreground">WebinarJam synced</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Blasts */}
      {stats?.recentBlasts && stats.recentBlasts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent No-Show Blasts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>No-Shows</TableHead>
                  <TableHead>SMS Sent</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentBlasts.map((blast: any) => (
                  <TableRow key={blast.id}>
                    <TableCell className="text-sm">
                      {new Date(blast.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell>{blast.noShowCount}</TableCell>
                    <TableCell>{blast.smsSentCount}</TableCell>
                    <TableCell>{blast.smsFailedCount}</TableCell>
                    <TableCell>
                      <Badge variant={blast.status === 'completed' ? 'default' : blast.status === 'failed' ? 'destructive' : 'secondary'}>
                        {blast.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create Schedule Dialog */}
      <CreateScheduleDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={() => { refetchSchedules(); refetch(); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SCHEDULE DETAIL PANEL
// ---------------------------------------------------------------------------

function ScheduleDetailPanel({
  scheduleId,
  onBack,
}: {
  scheduleId: number;
  onBack: () => void;
}) {
  const { data, isLoading, refetch } = trpc.webinar.getSchedule.useQuery({ id: scheduleId });
  const blastMut = trpc.webinar.blastNoShows.useMutation({
    onSuccess: (result) => {
      toast.success(`No-show blast complete: ${result.smsSent} SMS sent to ${result.noShowCount} no-shows`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const syncMut = trpc.webinar.syncRegistrants.useMutation({
    onSuccess: (result) => {
      toast.success(`Synced ${result.synced} registrants (${result.newRegistrants} new, ${result.updated} updated)`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const noonEngagementMut = trpc.webinar.triggerNoonEngagement.useMutation({
    onSuccess: (result) => {
      toast.success(`Noon engagement sent: ${result.sent} sent, ${result.failed} failed`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [showAddRegistrant, setShowAddRegistrant] = useState(false);
  // Transcript is permanent — no need for upload dialog

  // Live Room URL editing
  const [editingLiveUrl, setEditingLiveUrl] = useState(false);
  const [liveUrlDraft, setLiveUrlDraft] = useState('');
  const updateScheduleMut = trpc.webinar.updateSchedule.useMutation({
    onSuccess: () => {
      toast.success('Live room URL updated');
      setEditingLiveUrl(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // AI Teasers
  const { data: teasers, isLoading: teasersLoading, refetch: refetchTeasers } = trpc.webinar.getTeasers.useQuery(
    { scheduleId },
    { enabled: !!scheduleId }
  );
  const regenerateMut = trpc.webinar.regenerateTeasers.useMutation({
    onSuccess: (result) => {
      toast.success(`Generated ${result.teasers.length} new teasers from transcript`);
      refetchTeasers();
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const { schedule, registrants, stats } = data;

  return (
    <div className="space-y-6">
      {/* Schedule Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{schedule.name}</CardTitle>
              <CardDescription>
                {DAYS_OF_WEEK[schedule.dayOfWeek]}s at {schedule.startTime} PST
                {schedule.webinarjamWebinarId && ' • WebinarJam connected'}
              </CardDescription>
            </div>
            <Badge variant={schedule.isActive ? 'default' : 'secondary'}>
              {schedule.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Registered</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
              <p className="text-2xl font-bold text-green-600">{stats.attended}</p>
              <p className="text-xs text-muted-foreground">Attended</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
              <p className="text-2xl font-bold text-red-600">{stats.noShows}</p>
              <p className="text-xs text-muted-foreground">No-Shows</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
              <p className="text-2xl font-bold text-amber-600">{stats.welcomeSent || 0}</p>
              <p className="text-xs text-muted-foreground">SMS Sent</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-950/20">
              <p className="text-2xl font-bold text-gray-600">{stats.optedOut}</p>
              <p className="text-xs text-muted-foreground">Opted Out</p>
            </div>
          </div>

          {/* Automated Actions */}
          <div className="bg-muted/30 rounded-lg p-4 mb-4 border">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Automated Actions (Sunday Webinar Day)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
                <div>
                  <p className="text-sm font-medium">Noon Engagement</p>
                  <p className="text-xs text-muted-foreground">12:00 PM EST — "What are you excited to learn?"</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm('Send the noon engagement text to all registrants now? (This is normally automated at noon on webinar day)')) {
                      noonEngagementMut.mutate({ scheduleId });
                    }
                  }}
                  disabled={noonEngagementMut.isPending}
                >
                  {noonEngagementMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                  Test Now
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
                <div>
                  <p className="text-sm font-medium">No-Show Blast</p>
                  <p className="text-xs text-muted-foreground">4:10 PM EST — AI teaser to pull no-shows in</p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Send the no-show blast now? This will text all registrants who haven\'t attended.')) {
                      blastMut.mutate({ scheduleId });
                    }
                  }}
                  disabled={blastMut.isPending}
                >
                  {blastMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                  Test Now
                </Button>
              </div>
            </div>
          </div>

          {/* Live Room URL */}
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 mb-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Live Room URL</span>
              <span className="text-xs text-muted-foreground">(used in all reminder texts)</span>
            </div>
            {editingLiveUrl ? (
              <div className="flex gap-2">
                <Input
                  value={liveUrlDraft}
                  onChange={(e) => setLiveUrlDraft(e.target.value)}
                  placeholder="https://event.webinarjam.com/..."
                  className="flex-1 text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    updateScheduleMut.mutate({ id: scheduleId, liveRoomUrl: liveUrlDraft.trim() });
                  }}
                  disabled={updateScheduleMut.isPending}
                >
                  {updateScheduleMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingLiveUrl(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {schedule.liveRoomUrl ? (
                  <>
                    <a
                      href={schedule.liveRoomUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate max-w-md"
                    >
                      {schedule.liveRoomUrl}
                      <ExternalLink className="w-3 h-3 inline ml-1" />
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setLiveUrlDraft(schedule.liveRoomUrl || '');
                        setEditingLiveUrl(true);
                      }}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-amber-600">No link set — reminders won't include a join link</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLiveUrlDraft('');
                        setEditingLiveUrl(true);
                      }}
                    >
                      <Link2 className="w-3 h-3 mr-1" />
                      Set Link
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Manual Actions */}
          <div className="flex flex-wrap gap-3">
            {/* Sync Attendance from WebinarJam */}
            {schedule.webinarjamWebinarId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMut.mutate({ scheduleId })}
                disabled={syncMut.isPending}
              >
                {syncMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
                Sync Attendance
              </Button>
            )}

            {/* Add Registrant */}
            <Button size="sm" variant="outline" onClick={() => setShowAddRegistrant(true)}>
              <UserPlus className="w-4 h-4 mr-1" />
              Add Registrant
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI-Generated Teasers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                AI-Generated No-Show Teasers
              </CardTitle>
              <CardDescription>
                {'Generated from the permanent webinar transcript. Each no-show blast picks a random teaser for variety.'}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => regenerateMut.mutate({ scheduleId })}
              disabled={regenerateMut.isPending}
            >
              {regenerateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Regenerate Teasers
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {teasersLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : teasers && teasers.length > 0 ? (
            <div className="space-y-2">
              {teasers.map((teaser, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-primary">{i + 1}</span>
                  </div>
                  <p className="text-sm">{teaser}</p>
                  {i === 0 && (
                    <Badge variant="default" className="text-xs flex-shrink-0">Primary</Badge>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-2">
                The primary teaser is used as the default. During no-show blasts, a random teaser is picked for each message to add variety.
              </p>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No teasers generated yet.</p>
              <p className="text-xs mt-1">Click "Regenerate Teasers" to generate AI-powered teasers from the webinar transcript.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript is permanent — no upload dialog needed */}

      {/* Registrants Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registrants ({registrants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {registrants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No registrants yet.</p>
              <p className="text-sm mt-1">
                {schedule.webinarjamWebinarId
                  ? 'Click "Sync WebinarJam" to pull registrants.'
                  : 'Add registrants manually or connect WebinarJam.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                      <TableHead>Engaged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrants.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell className="font-medium">
                        {reg.firstName} {reg.lastName || ''}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {formatPhone(reg.phone)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {reg.email || '\u2014'}
                      </TableCell>
                      <TableCell>
                        <AttendanceBadge status={reg.attendanceStatus} optedOut={reg.optedOut === 1} />
                      </TableCell>
                      <TableCell>
                        {reg.lastReminderStage > 0 ? (
                          <Badge variant="default" className="text-xs bg-green-600">Texted</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Registrant Dialog */}
      <AddRegistrantDialog
        open={showAddRegistrant}
        onOpenChange={setShowAddRegistrant}
        scheduleId={scheduleId}
        onAdded={() => refetch()}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CONVERSATIONS PANEL
// ---------------------------------------------------------------------------

function ConversationsPanel({
  selectedPhone,
  onSelectPhone,
}: {
  selectedPhone: string | null;
  onSelectPhone: (phone: string | null) => void;
}) {
  const { data: recentConvos, isLoading } = trpc.webinar.getRecentConversations.useQuery({ limit: 30 });
  const { data: messages, isLoading: messagesLoading } = trpc.webinar.getConversation.useQuery(
    { phone: selectedPhone!, limit: 100 },
    { enabled: !!selectedPhone }
  );

  const [manualMessage, setManualMessage] = useState('');
  const sendManualMut = trpc.webinar.sendManualSms.useMutation({
    onSuccess: () => {
      toast.success('Message sent');
      setManualMessage('');
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Conversation List */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">Conversations</CardTitle>
          <CardDescription>{recentConvos?.length || 0} recent threads</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            {!recentConvos?.length ? (
              <div className="text-center py-8 text-muted-foreground px-4">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              recentConvos.map((convo) => (
                <div
                  key={convo.phone}
                  className={`flex items-center gap-3 p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedPhone === convo.phone ? 'bg-muted' : ''
                  }`}
                  onClick={() => onSelectPhone(convo.phone)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    convo.direction === 'inbound' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                  }`}>
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{formatPhone(convo.phone)}</p>
                    <p className="text-xs text-muted-foreground truncate">{convo.messageText}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatRelativeTime(convo.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Message Thread */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedPhone ? formatPhone(selectedPhone) : 'Select a conversation'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedPhone ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Select a conversation from the list to view messages</p>
            </div>
          ) : messagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Messages */}
              <div className="max-h-[400px] overflow-y-auto space-y-3 p-2">
                {messages?.slice().reverse().map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.direction === 'outbound'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{msg.messageText}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs opacity-70">
                          {new Date(msg.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        {msg.aiProvider && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            <Bot className="w-3 h-3 mr-0.5" />
                            {msg.aiProvider}
                          </Badge>
                        )}
                        {msg.messageType && msg.messageType !== 'manual' && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {msg.messageType.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Manual Send */}
              <div className="flex gap-2 pt-3 border-t">
                <Input
                  placeholder="Type a message..."
                  value={manualMessage}
                  onChange={(e) => setManualMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualMessage.trim() && selectedPhone) {
                      sendManualMut.mutate({ phone: selectedPhone, message: manualMessage.trim() });
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (manualMessage.trim() && selectedPhone) {
                      sendManualMut.mutate({ phone: selectedPhone, message: manualMessage.trim() });
                    }
                  }}
                  disabled={sendManualMut.isPending || !manualMessage.trim()}
                >
                  {sendManualMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TEMPLATES PANEL
// ---------------------------------------------------------------------------

function TemplatesPanel() {
  const { data: templates, isLoading, refetch } = trpc.webinar.getTemplates.useQuery();
  const updateMut = trpc.webinar.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success('Template updated');
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editTemplate, setEditTemplate] = useState('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const stageLabels: Record<number, string> = {
    1: '24 Hours Before',
    2: 'Morning Of',
    3: '1 Hour Before',
    4: 'At Start Time',
    5: 'No-Show Blast',
  };

  const stageIcons: Record<number, React.ReactNode> = {
    1: <Clock className="w-4 h-4 text-blue-500" />,
    2: <Radio className="w-4 h-4 text-amber-500" />,
    3: <Bell className="w-4 h-4 text-orange-500" />,
    4: <Zap className="w-4 h-4 text-red-500" />,
    5: <AlertTriangle className="w-4 h-4 text-red-600" />,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">SMS Reminder Templates</CardTitle>
          <CardDescription>
            AI-generated from the webinar transcript. You can still customize if needed. Placeholders:
            {' '}<code className="text-xs bg-muted px-1 rounded">{'{{firstName}}'}</code>,
            {' '}<code className="text-xs bg-muted px-1 rounded">{'{{webinarName}}'}</code>,
            {' '}<code className="text-xs bg-muted px-1 rounded">{'{{liveRoomUrl}}'}</code>,
            {' '}<code className="text-xs bg-muted px-1 rounded">{'{{startTime}}'}</code>,
            {' '}<code className="text-xs bg-muted px-1 rounded">{'{{noShowTeaser}}'}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates?.map((t) => (
            <div key={t.stage} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {stageIcons[t.stage]}
                  <span className="font-medium text-sm">{stageLabels[t.stage] || t.name}</span>
                  <Badge variant="outline" className="text-xs">Stage {t.stage}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (editingStage === t.stage) {
                      setEditingStage(null);
                    } else {
                      setEditingStage(t.stage);
                      setEditName(t.name);
                      setEditTemplate(t.messageTemplate);
                    }
                  }}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>

              {editingStage === t.stage ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Template name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <Textarea
                    placeholder="Message template..."
                    value={editTemplate}
                    onChange={(e) => setEditTemplate(e.target.value)}
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        updateMut.mutate({
                          stage: t.stage,
                          name: editName,
                          messageTemplate: editTemplate,
                        });
                        setEditingStage(null);
                      }}
                      disabled={updateMut.isPending}
                    >
                      {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingStage(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.messageTemplate}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DIALOGS
// ---------------------------------------------------------------------------

function CreateScheduleDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [webinarId, setWebinarId] = useState('');

  const createFromWJ = trpc.webinar.createFromWebinarJam.useMutation({
    onSuccess: (result) => {
      toast.success(
        `"${result.webinarName}" created \u2014 ${result.registrantsSynced} registrants synced!`
      );
      onOpenChange(false);
      onCreated();
      setWebinarId('');
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Webinar</DialogTitle>
          <DialogDescription>
            Enter your WebinarJam Webinar ID. Everything else is pulled automatically \u2014 name, schedule, date/time, and all registrants.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">WebinarJam Webinar ID *</label>
            <Input
              placeholder="e.g., 370"
              value={webinarId}
              onChange={(e) => setWebinarId(e.target.value)}
              className="text-lg font-mono"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Find this in your WebinarJam dashboard under the webinar settings.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">What happens automatically:</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>\u2022 Webinar name, date, and time pulled from WebinarJam</li>
              <li>\u2022 All existing registrants synced with phone numbers</li>
              <li>\u2022 AI generates no-show teasers from the webinar transcript</li>
              <li>\u2022 Noon engagement + 4:10 PM no-show blast auto-scheduled</li>
              <li>\u2022 New registrants auto-synced every 5 minutes</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (!webinarId.trim()) {
                toast.error('Webinar ID is required');
                return;
              }
              createFromWJ.mutate({ webinarId: webinarId.trim() });
            }}
            disabled={createFromWJ.isPending || !webinarId.trim()}
          >
            {createFromWJ.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Pulling from WebinarJam...</>
            ) : (
              <><Plus className="w-4 h-4 mr-1" /> Add Webinar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRegistrantDialog({
  open,
  onOpenChange,
  scheduleId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: number;
  onAdded: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [liveRoomUrl, setLiveRoomUrl] = useState('');

  const addMut = trpc.webinar.addRegistrant.useMutation({
    onSuccess: (result) => {
      toast.success('Registrant added');
      onOpenChange(false);
      onAdded();
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setLiveRoomUrl('');
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Registrant</DialogTitle>
          <DialogDescription>
            Manually add a registrant and send them a welcome SMS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">First Name *</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Last Name</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Phone *</label>
            <Input placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Live Room URL</label>
            <Input placeholder="Personal live room link" value={liveRoomUrl} onChange={(e) => setLiveRoomUrl(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (!firstName.trim() || !phone.trim()) {
                toast.error('First name and phone are required');
                return;
              }
              addMut.mutate({
                scheduleId,
                firstName: firstName.trim(),
                lastName: lastName.trim() || undefined,
                email: email.trim() || undefined,
                phone: phone.trim(),
                liveRoomUrl: liveRoomUrl.trim() || undefined,
              });
            }}
            disabled={addMut.isPending || !firstName.trim() || !phone.trim()}
          >
            {addMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
            Add Registrant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// UTILITY COMPONENTS
// ---------------------------------------------------------------------------

function BlastDeliveryTracker() {
  const { data, isLoading, refetch } = trpc.webinar.getBlastDeliveryStats.useQuery(undefined, {
    refetchInterval: 10_000, // auto-refresh every 10 seconds
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  if (isLoading) return null;

  const blasts = data?.blasts ?? [];
  const totalSent = blasts.reduce((sum, b) => sum + b.sent, 0);
  const totalActive = data?.totalActiveRegistrants ?? 0;

  const typeLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    engagement: { label: 'Noon Engagement', color: 'text-blue-600', icon: <Send className="w-4 h-4 text-blue-600" /> },
    reminder: { label: 'Reminder', color: 'text-green-600', icon: <Bell className="w-4 h-4 text-green-600" /> },
    noshow: { label: 'No-Show Blast', color: 'text-amber-600', icon: <AlertTriangle className="w-4 h-4 text-amber-600" /> },
    manual: { label: 'Manual', color: 'text-purple-600', icon: <MessageSquare className="w-4 h-4 text-purple-600" /> },
    ai_reply: { label: 'AI Reply', color: 'text-cyan-600', icon: <Bot className="w-4 h-4 text-cyan-600" /> },
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch { return dateStr; }
  };

  const maskPhone = (phone: string) => {
    if (phone.length >= 4) return '***' + phone.slice(-4);
    return phone;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              SMS Blast Tracker
              <Badge variant="outline" className="text-xs font-normal ml-1">
                Live
              </Badge>
            </CardTitle>
            <CardDescription>Real-time delivery stats for today's SMS blasts (auto-refreshes every 10s)</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg bg-primary/5 border">
            <div className="text-2xl font-bold">{totalSent}</div>
            <div className="text-xs text-muted-foreground">Total Sent Today</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="text-2xl font-bold text-green-600">{data?.inboundReplies ?? 0}</div>
            <div className="text-xs text-muted-foreground">Replies Received</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="text-2xl font-bold text-blue-600">{totalActive}</div>
            <div className="text-xs text-muted-foreground">Active Numbers</div>
          </div>
        </div>

        {/* Per-Blast Breakdown */}
        {blasts.length > 0 ? (
          <div className="space-y-3 mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Blast Breakdown</p>
            {blasts.map((blast) => {
              const info = typeLabels[blast.type] ?? { label: blast.type, color: 'text-gray-600', icon: <Send className="w-4 h-4" /> };
              const progress = totalActive > 0 ? Math.min((blast.sent / totalActive) * 100, 100) : 0;
              return (
                <div key={blast.type} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {info.icon}
                      <span className="text-sm font-medium">{info.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${info.color}`}>{blast.sent}</span>
                      <span className="text-xs text-muted-foreground">/ {totalActive}</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-muted rounded-full h-2 mb-1.5">
                    <div
                      className="h-2 rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{Math.round(progress)}% delivered</span>
                    <span>
                      {blast.firstSent && formatTime(blast.firstSent)}
                      {blast.lastSent && blast.firstSent !== blast.lastSent && ` — ${formatTime(blast.lastSent)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Send className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No blasts sent in the last 24 hours</p>
          </div>
        )}

        {/* Recent Messages Sample */}
        {data?.recentMessages && data.recentMessages.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Latest Messages</p>
            <div className="space-y-1.5">
              {data.recentMessages.map((msg, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50">
                  <MessageCircle className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground font-mono">{maskPhone(msg.phone)}</span>
                  <span className="truncate flex-1">{msg.messageText?.slice(0, 80)}...</span>
                  <span className="text-muted-foreground flex-shrink-0">{formatTime(String(msg.createdAt))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AiToggleCard() {
  const { data: aiStatus, isLoading } = trpc.webinar.getAiStatus.useQuery();
  const utils = trpc.useUtils();
  const toggleMut = trpc.webinar.setAiEnabled.useMutation({
    onSuccess: (result) => {
      utils.webinar.getAiStatus.invalidate();
      toast.success(result.enabled ? 'AI auto-replies ENABLED' : 'AI auto-replies DISABLED');
    },
    onError: (err) => toast.error(err.message),
  });

  // Sync attendance across all schedules
  const { data: schedules } = trpc.webinar.listSchedules.useQuery();
  const syncMut = trpc.webinar.syncRegistrants.useMutation({
    onSuccess: (result) => {
      toast.success(`Synced ${result.synced} registrants (${result.newRegistrants} new, ${result.updated} updated)`);
    },
    onError: (err) => toast.error(err.message),
  });
  const [syncingAll, setSyncingAll] = useState(false);

  const handleSyncAll = useCallback(async () => {
    if (!schedules?.length) {
      toast.error('No schedules to sync');
      return;
    }
    const wjSchedules = schedules.filter(s => (s as any).webinarjamWebinarId);
    if (!wjSchedules.length) {
      toast.error('No schedules with WebinarJam connected');
      return;
    }
    setSyncingAll(true);
    let totalSynced = 0;
    let totalUpdated = 0;
    try {
      for (const schedule of wjSchedules) {
        try {
          const result = await syncMut.mutateAsync({ scheduleId: schedule.id });
          totalSynced += result.synced;
          totalUpdated += result.updated;
        } catch (err) {
          console.error(`Failed to sync schedule ${schedule.id}:`, err);
        }
      }
      toast.success(`Attendance sync complete: ${totalSynced} registrants checked, ${totalUpdated} updated`);
    } finally {
      setSyncingAll(false);
    }
  }, [schedules, syncMut]);

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          AI & Attendance Controls
        </CardTitle>
        <CardDescription>Manage AI auto-replies and sync attendance data from WebinarJam</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* AI Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${aiStatus?.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
              <div>
                <p className="text-sm font-medium">AI Auto-Replies</p>
                <p className="text-xs text-muted-foreground">
                  {aiStatus?.enabled
                    ? 'AI is responding to incoming SMS'
                    : 'AI is OFF \u2014 incoming SMS are logged but not replied to'}
                </p>
              </div>
            </div>
            <Switch
              checked={aiStatus?.enabled ?? false}
              onCheckedChange={(checked) => toggleMut.mutate({ enabled: checked })}
              disabled={toggleMut.isPending}
            />
          </div>

          {/* Sync Attendance */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <div>
                <p className="text-sm font-medium">Sync Attendance</p>
                <p className="text-xs text-muted-foreground">
                  Pull fresh attendance data from WebinarJam for all schedules
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSyncAll}
              disabled={syncingAll}
            >
              {syncingAll ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
              {syncingAll ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          <ShieldCheck className="w-3 h-3 inline mr-1" />
          No-show blasts always verify attendance with WebinarJam before sending. If the API is unreachable, the blast is aborted to protect attendees.
        </p>
      </CardContent>
    </Card>
  );
}

function CronStatusCard() {
  const { data: cronStatus, isLoading } = trpc.webinar.getCronStatus.useQuery();

  if (isLoading) return null;

  const blasts = [
    { label: 'Noon Engagement', key: 'noonEngagement' as const, desc: '"What are you excited about?"' },
    { label: '2-Hour Reminder', key: 'twoHourReminder' as const, desc: '"We are 2 HOURS AWAY!" + link' },
    { label: '1-Hour Reminder', key: 'oneHourReminder' as const, desc: '"1 hour warning!!!" + link' },
    { label: '15-Min Reminder', key: 'fifteenMinReminder' as const, desc: '"Get your water..." + link' },
    { label: 'LIVE NOW', key: 'liveNow' as const, desc: '"we are live !!! LETSGOOOOO!" + link' },
    { label: 'No-Show Blast', key: 'noShowBlast' as const, desc: 'FOMO teaser to no-shows only' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Automated Schedule
        </CardTitle>
        <CardDescription>6 automated SMS blasts fire on webinar day (all times Pacific)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {blasts.map((blast) => {
            const status = cronStatus?.[blast.key];
            return (
              <div key={blast.key} className="flex items-start gap-3 p-3 rounded-lg border">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${status?.firedToday ? 'bg-green-500' : cronStatus?.active ? 'bg-amber-400' : 'bg-red-500'}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{blast.label}</p>
                    {status?.firedToday && <span className="text-xs text-green-600 font-medium">Sent</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{status?.time}</p>
                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{blast.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Reminder blasts include each registrant's personal WebinarJam link. No-show blast only targets people not in the room.
        </p>
      </CardContent>
    </Card>
  );
}

function WebhookStatusCard() {
  const { data: status, isLoading, refetch } = trpc.webinar.getWebhookStatus.useQuery();
  const configureWebhooks = trpc.webinar.configureWebhooks.useMutation({
    onSuccess: () => {
      toast.success('Webhooks configured successfully');
      refetch();
    },
    onError: (err) => toast.error(`Configuration failed: ${err.message}`),
  });
  const pollRegistrants = trpc.webinar.pollRegistrants.useMutation({
    onSuccess: (data) => {
      toast.success(`Polled ${data.schedulesPolled} schedules, found ${data.newRegistrants} new registrants`);
    },
    onError: (err) => toast.error(`Poll failed: ${err.message}`),
  });

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-600" />
          Integrations
        </CardTitle>
        <CardDescription>SimpleTexting webhook and WebinarJam registrant sync</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SimpleTexting */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${status?.simpleTexting.configured ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <p className="text-sm font-medium">SimpleTexting Webhook</p>
                <p className="text-xs text-muted-foreground">
                  {status?.simpleTexting.configured
                    ? 'Receiving incoming SMS'
                    : 'Not configured — incoming SMS won\'t be received'}
                </p>
              </div>
            </div>
            {!status?.simpleTexting.configured && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => configureWebhooks.mutate()}
                disabled={configureWebhooks.isPending}
              >
                {configureWebhooks.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Configure'}
              </Button>
            )}
          </div>

          {/* WebinarJam */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${status?.webinarJam.pollingActive ? 'bg-green-500' : status?.webinarJam.apiKeySet ? 'bg-yellow-500' : 'bg-red-500'}`} />
              <div>
                <p className="text-sm font-medium">WebinarJam Sync</p>
                <p className="text-xs text-muted-foreground">
                  {status?.webinarJam.pollingActive
                    ? 'Polling every 5 min for new registrants'
                    : status?.webinarJam.apiKeySet
                    ? 'API key set but polling inactive'
                    : 'API key not configured'}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => pollRegistrants.mutate()}
              disabled={pollRegistrants.isPending}
            >
              {pollRegistrants.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sync Now'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sublabel?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

function AttendanceBadge({ status, optedOut }: { status: string; optedOut: boolean }) {
  if (optedOut) {
    return <Badge variant="outline" className="text-xs text-gray-500">Opted Out</Badge>;
  }
  switch (status) {
    case 'attended':
      return <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">Attended</Badge>;
    case 'no_show':
      return <Badge className="text-xs bg-red-100 text-red-700 hover:bg-red-100">No-Show</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">Registered</Badge>;
  }
}

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11 && clean.startsWith('1')) {
    return `+1 (${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
