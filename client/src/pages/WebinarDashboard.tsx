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
  Upload,
  Trash2,
  Search,
  UserX,
  ShieldAlert,
  UserCheck,
  Ban,
} from 'lucide-react';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------------------------------------------------------------------------
// MAIN DASHBOARD
// ---------------------------------------------------------------------------

export function WebinarDashboardTab() {
  const [view, setView] = useState<'overview' | 'schedule' | 'conversations' | 'templates' | 'suppression'>('overview');
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
          onViewSuppression={() => setView('suppression')}
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

      {view === 'suppression' && (
        <SuppressionPanel />
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
  onViewSuppression,
}: {
  onViewSchedule: (id: number) => void;
  onViewConversations: () => void;
  onViewTemplates: () => void;
  onViewSuppression: () => void;
}) {
  const { data: stats, isLoading, refetch } = trpc.webinar.getDashboardStats.useQuery();
  const { data: schedules, isLoading: schedulesLoading, refetch: refetchSchedules } = trpc.webinar.listSchedules.useQuery();

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // ALL hooks must be declared before any early return
  const [editingLiveUrl, setEditingLiveUrl] = useState(false);
  const [liveUrlDraft, setLiveUrlDraft] = useState('');
  const updateScheduleMut = trpc.webinar.updateSchedule.useMutation({
    onSuccess: () => {
      toast.success('Live room URL updated');
      setEditingLiveUrl(false);
      refetchSchedules();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [showCustomBlast, setShowCustomBlast] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const customBlastMut = trpc.webinar.sendCustomBlast.useMutation({
    onSuccess: (result: any) => {
      toast.success(`Custom blast sent: ${result.sent} delivered, ${result.failed} failed`);
      setShowCustomBlast(false);
      setCustomMessage('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const activeSchedule = schedules?.find(s => s.isActive);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Phone className="w-5 h-5 text-green-600" />}
          label="Active Textable"
          value={stats?.activeTextable ?? 0}
          sublabel={`${stats?.totalRegistrants ?? 0} total registered`}
        />
        <StatCard
          icon={<Send className="w-5 h-5 text-blue-600" />}
          label="SMS Sent"
          value={stats?.totalSmsSent ?? 0}
          sublabel={`${stats?.totalConversations ?? 0} conversations`}
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-amber-600" />}
          label="Attended"
          value={stats?.totalAttended ?? 0}
          sublabel={stats?.totalRegistrants ? `${Math.round((stats.totalAttended / stats.totalRegistrants) * 100)}% rate` : '0% rate'}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          label="No-Shows"
          value={stats?.totalNoShows ?? 0}
          sublabel={stats?.totalRegistrants ? `${Math.round((stats.totalNoShows / stats.totalRegistrants) * 100)}% rate` : '0% rate'}
        />
      </div>

      {/* ============================================================= */}
      {/* SECTION 1: LIVE ROOM URL + QUICK ACTIONS (most important)      */}
      {/* ============================================================= */}
      <Card className="border-2 border-blue-500/30 bg-blue-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            This Week's Live Room Link
          </CardTitle>
          <CardDescription>Paste the WebinarJam link here each week — all reminder texts will include it</CardDescription>
        </CardHeader>
        <CardContent>
          {editingLiveUrl ? (
            <div className="flex gap-2">
              <Input
                value={liveUrlDraft}
                onChange={(e) => setLiveUrlDraft(e.target.value)}
                placeholder="https://event.webinarjam.com/..."
                className="flex-1 text-sm"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => {
                  if (activeSchedule) {
                    updateScheduleMut.mutate({ id: activeSchedule.id, liveRoomUrl: liveUrlDraft.trim() });
                  }
                }}
                disabled={updateScheduleMut.isPending || !activeSchedule}
              >
                {updateScheduleMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingLiveUrl(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {(activeSchedule as any)?.liveRoomUrl ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <a
                    href={(activeSchedule as any).liveRoomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate flex-1"
                  >
                    {(activeSchedule as any).liveRoomUrl}
                    <ExternalLink className="w-3 h-3 inline ml-1" />
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setLiveUrlDraft((activeSchedule as any).liveRoomUrl || '');
                      setEditingLiveUrl(true);
                    }}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Change Link
                  </Button>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-sm text-amber-600 flex-1">No link set — reminder texts won't include a join link</span>
                  <Button
                    size="sm"
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
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowCustomBlast(!showCustomBlast)}
        >
          <Send className="w-4 h-4 mr-1" />
          Send Custom Blast
        </Button>
        <Button onClick={() => setShowCreateDialog(true)} size="sm" variant="outline">
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
        <Button variant="outline" size="sm" onClick={onViewSuppression}>
          <ShieldCheck className="w-4 h-4 mr-1" />
          Suppression List
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { refetch(); refetchSchedules(); }}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Custom Blast Composer */}
      {showCustomBlast && activeSchedule && (
        <Card className="border-2 border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Send Custom Blast
            </CardTitle>
            <CardDescription>
              Send a one-off message to all {stats?.activeTextable ?? 0} active registrants for "{activeSchedule.name}"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={'Type your message here...\n\nPlaceholders: {{firstName}}, {{liveRoomUrl}}, {{webinarName}}, {{startTime}}'}
                rows={3}
                className="text-sm"
              />
              <div className="flex items-center justify-between">
                <span className={`text-xs ${customMessage.length > 160 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                  {customMessage.length}/160 characters {customMessage.length > 160 && '(will be truncated)'}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setShowCustomBlast(false); setCustomMessage(''); }}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (confirm(`Send this message to ${stats?.activeTextable ?? 0} people?\n\n"${customMessage}"`)) {
                        customBlastMut.mutate({ scheduleId: activeSchedule.id, message: customMessage });
                      }
                    }}
                    disabled={customBlastMut.isPending || !customMessage.trim()}
                  >
                    {customBlastMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                    Send to {stats?.activeTextable ?? 0} People
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================= */}
      {/* SECTION 2: LIVE DELIVERY TRACKER                               */}
      {/* ============================================================= */}
      <BlastDeliveryTracker />

      {/* ============================================================= */}
      {/* SECTION 3: AUTOMATED SCHEDULE + CONTROLS                      */}
      {/* ============================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CronStatusCard scheduleId={activeSchedule?.id} />
        <AiToggleCard />
      </div>

      {/* ============================================================= */}
      {/* SECTION 4: SCHEDULES + REGISTRANT NUMBERS                     */}
      {/* ============================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Webinar Schedules</CardTitle>
          <CardDescription>Click a schedule to view registrants, sync attendance, and manage details</CardDescription>
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
                      <p className="text-sm font-medium">{(schedule as any).registrantCount ?? '\u2014'} registrants</p>
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

      {/* ============================================================= */}
      {/* SECTION 5: INTEGRATIONS + HISTORY (less frequent)              */}
      {/* ============================================================= */}
      <WebhookStatusCard />

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

function CronStatusCard({ scheduleId }: { scheduleId?: number }) {
  const { data: cronStatus, isLoading } = trpc.webinar.getCronStatus.useQuery();
  const { data: templates, refetch: refetchTemplates } = trpc.webinar.getMessageTemplates.useQuery(
    { scheduleId: scheduleId! },
    { enabled: !!scheduleId }
  );
  const { data: blastStats } = trpc.webinar.getBlastTypeStats.useQuery(
    { scheduleId },
    { refetchInterval: 15000 }
  );
  const updateTemplate = trpc.webinar.updateMessageTemplate.useMutation({
    onSuccess: () => {
      toast.success('Message template updated');
      setEditingKey(null);
      refetchTemplates();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const testSend = trpc.webinar.testSendBlast.useMutation({
    onSuccess: (data) => {
      toast.success(`Test sent! Message: "${data.message}"`);
      setTestingKey(null);
    },
    onError: (err: any) => {
      toast.error(`Test send failed: ${err.message}`);
      setTestingKey(null);
    },
  });

  if (isLoading) return null;

  const blasts = [
    { label: 'Noon Engagement', key: 'noonEngagement', time: '12:00 PM', dbType: 'engagement' },
    { label: '2-Hour Reminder', key: 'twoHourReminder', time: '2:00 PM', dbType: 'reminder_2hr' },
    { label: '1-Hour Reminder', key: 'oneHourReminder', time: '3:00 PM', dbType: 'reminder_1hr' },
    { label: '15-Min Reminder', key: 'fifteenMinReminder', time: '3:45 PM', dbType: 'reminder_15min' },
    { label: 'LIVE NOW', key: 'liveNow', time: '4:00 PM', dbType: 'live_now' },
    { label: 'No-Show Blast', key: 'noShowBlast', time: '4:10 PM', dbType: 'no_show_blast' },
    { label: 'Attendee CTA', key: 'attendeeCta', time: 'Manual', dbType: 'attendee_cta', attendeesOnly: true },
  ];

  // Map blast keys to messageType counts
  const getDeliveryCount = (dbType: string): number => {
    if (!blastStats) return 0;
    return (blastStats as Record<string, number>)[dbType] ?? 0;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Automated Schedule
        </CardTitle>
        <CardDescription>Click any message to edit it. Changes take effect on the next blast.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {blasts.map((blast) => {
            const status = cronStatus?.[blast.key as keyof typeof cronStatus] as { time: string; firedToday: boolean } | undefined;
            const template = templates?.find(t => t.key === blast.key);
            const deliveryCount = getDeliveryCount(blast.dbType);
            const isEditing = editingKey === blast.key;

            return (
              <div key={blast.key} className="rounded-lg border overflow-hidden">
                {/* Header row */}
                <div className="flex items-center justify-between p-3 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status?.firedToday ? 'bg-green-500' : cronStatus?.active ? 'bg-amber-400' : 'bg-red-500'}`} />
                    <div>
                      <p className="text-sm font-medium">{blast.label}</p>
                      <p className="text-xs text-muted-foreground">{blast.time} Pacific</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {deliveryCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {deliveryCount} sent
                      </Badge>
                    )}
                    {status?.firedToday && (
                      <Badge variant="default" className="text-xs bg-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Delivered
                      </Badge>
                    )}
                    {!status?.firedToday && cronStatus?.active && (
                      <Badge variant="outline" className="text-xs">
                        Pending
                      </Badge>
                    )}
                    {scheduleId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={testSend.isPending && testingKey === blast.key}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Send a test of "${blast.label}" to 7025218792?`)) {
                            setTestingKey(blast.key);
                            testSend.mutate({ scheduleId: scheduleId!, blastKey: blast.key, phone: '7025218792' });
                          }
                        }}
                      >
                        {testSend.isPending && testingKey === blast.key ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <><Send className="w-3 h-3 mr-1" />Test</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Message body — clickable to edit */}
                {isEditing ? (
                  <div className="p-3 space-y-2 bg-muted/10">
                    <Textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      className="text-sm"
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${editDraft.length > 160 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                        {editDraft.length}/160 characters
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>Cancel</Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (scheduleId) {
                              updateTemplate.mutate({ scheduleId, key: blast.key, message: editDraft });
                            }
                          }}
                          disabled={updateTemplate.isPending || !editDraft.trim()}
                        >
                          {updateTemplate.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-3 cursor-pointer hover:bg-muted/20 transition-colors group"
                    onClick={() => {
                      if (scheduleId) {
                        setEditDraft(template?.message || '');
                        setEditingKey(blast.key);
                      }
                    }}
                  >
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {template?.message || '(default message)'}
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit className="w-3 h-3 inline mr-1" />
                      Click to edit
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Placeholders: {'{{firstName}}'}, {'{{liveRoomUrl}}'}, {'{{webinarName}}'}, {'{{startTime}}'}. No-show blast targets people not in the room. Attendee CTA only targets people who attended.
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

// ---------------------------------------------------------------------------
// SUPPRESSION LIST PANEL
// ---------------------------------------------------------------------------

const TAG_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  buyer: {
    label: 'Buyer',
    color: 'bg-red-100 text-red-700',
    icon: <Ban className="w-4 h-4" />,
    description: 'Program buyers — NEVER receive any texts',
  },
  past_attendee: {
    label: 'Past Attendee',
    color: 'bg-green-100 text-green-700',
    icon: <UserCheck className="w-4 h-4" />,
    description: 'Attended a webinar — skip weekly reminders, still get CTA',
  },
  past_noshow: {
    label: 'Past No-Show',
    color: 'bg-amber-100 text-amber-700',
    icon: <UserX className="w-4 h-4" />,
    description: 'Missed a webinar — keep re-inviting every week',
  },
  dnc: {
    label: 'Do Not Contact',
    color: 'bg-gray-100 text-gray-700',
    icon: <ShieldAlert className="w-4 h-4" />,
    description: 'Manual suppression — NEVER receive any texts',
  },
};

function SuppressionPanel() {
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const { data: statsData, refetch: refetchStats } = trpc.webinar.getSuppressionStats.useQuery();
  const { data: contactsData, isLoading, refetch: refetchContacts } = trpc.webinar.getSuppressionContacts.useQuery({
    tag: activeTag as any,
    search: searchQuery || undefined,
    page,
    pageSize: 25,
  });

  const removeMut = trpc.webinar.removeSuppressionContact.useMutation({
    onSuccess: () => {
      toast.success('Contact removed from suppression list');
      refetchContacts();
      refetchStats();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const clearTagMut = trpc.webinar.clearSuppressionByTag.useMutation({
    onSuccess: (result: any) => {
      toast.success(`Removed ${result.deleted} contacts`);
      refetchContacts();
      refetchStats();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const totalPages = contactsData ? Math.ceil(contactsData.total / contactsData.pageSize) : 1;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card
          className={`cursor-pointer transition-colors ${!activeTag ? 'border-primary border-2' : 'hover:border-primary/50'}`}
          onClick={() => { setActiveTag(undefined); setPage(1); }}
        >
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{statsData?.total ?? 0}</p>
          </CardContent>
        </Card>
        {Object.entries(TAG_LABELS).map(([tag, info]) => (
          <Card
            key={tag}
            className={`cursor-pointer transition-colors ${activeTag === tag ? 'border-primary border-2' : 'hover:border-primary/50'}`}
            onClick={() => { setActiveTag(activeTag === tag ? undefined : tag); setPage(1); }}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                {info.icon}
                <span className="text-xs font-medium text-muted-foreground">{info.label}</span>
              </div>
              <p className="text-2xl font-bold">{(statsData as any)?.[tag] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Suppression Rules Explanation */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4 pb-3 px-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            How Suppression Works
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <Ban className="w-3 h-3 mt-0.5 text-red-500 flex-shrink-0" />
              <span><strong>Buyers</strong> and <strong>DNC</strong> contacts are permanently blocked from ALL texts</span>
            </div>
            <div className="flex items-start gap-2">
              <UserCheck className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" />
              <span><strong>Past Attendees</strong> skip weekly reminders but still receive the post-webinar CTA</span>
            </div>
            <div className="flex items-start gap-2">
              <UserX className="w-3 h-3 mt-0.5 text-amber-500 flex-shrink-0" />
              <span><strong>Past No-Shows</strong> keep getting invited every week until they attend</span>
            </div>
            <div className="flex items-start gap-2">
              <RefreshCw className="w-3 h-3 mt-0.5 text-blue-500 flex-shrink-0" />
              <span>Attendees and no-shows are <strong>auto-tagged</strong> after each webinar (5 PM CTA blast)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search by phone, email, or name..."
            className="pl-9 text-sm"
          />
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add Contact
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowImportDialog(true)}>
          <Upload className="w-4 h-4 mr-1" />
          Import CSV
        </Button>
        {activeTag && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (confirm(`Remove ALL ${TAG_LABELS[activeTag]?.label} contacts (${(statsData as any)?.[activeTag] ?? 0} total)? This cannot be undone.`)) {
                clearTagMut.mutate({ tag: activeTag as any });
              }
            }}
            disabled={clearTagMut.isPending}
          >
            {clearTagMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
            Clear All {TAG_LABELS[activeTag]?.label}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => { refetchContacts(); refetchStats(); }}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Contacts Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !contactsData?.contacts.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No suppressed contacts{activeTag ? ` with tag "${TAG_LABELS[activeTag]?.label}"` : ''}</p>
              {searchQuery && <p className="text-sm mt-1">Try a different search term</p>}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contactsData.contacts.map((contact: any) => (
                    <TableRow key={contact.id}>
                      <TableCell className="text-sm">
                        {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {contact.phone ? formatPhone(contact.phone) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {contact.email || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${TAG_LABELS[contact.tag]?.color ?? ''}`}>
                          {TAG_LABELS[contact.tag]?.label ?? contact.tag}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {contact.source?.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(contact.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => {
                            if (confirm(`Remove ${contact.firstName || contact.phone} from the suppression list?`)) {
                              removeMut.mutate({ id: contact.id });
                            }
                          }}
                          disabled={removeMut.isPending}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} ({contactsData.total} total)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Contact Dialog */}
      <AddSuppressionContactDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdded={() => { refetchContacts(); refetchStats(); }}
      />

      {/* Import CSV Dialog */}
      <ImportSuppressionCsvDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImported={() => { refetchContacts(); refetchStats(); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADD SUPPRESSION CONTACT DIALOG
// ---------------------------------------------------------------------------

function AddSuppressionContactDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tag, setTag] = useState<string>('buyer');

  const addMut = trpc.webinar.addSuppressionContact.useMutation({
    onSuccess: () => {
      toast.success('Contact added to suppression list');
      onOpenChange(false);
      onAdded();
      setPhone(''); setEmail(''); setFirstName(''); setLastName('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Suppressed Contact</DialogTitle>
          <DialogDescription>
            Add a contact to the suppression list. They will be excluded from SMS blasts based on their tag.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">First Name</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Last Name</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Phone Number</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Suppression Tag</label>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TAG_LABELS).map(([value, info]) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex items-center gap-2">
                      {info.icon}
                      {info.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {TAG_LABELS[tag]?.description}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => addMut.mutate({ phone, email, firstName, lastName, tag: tag as any })}
            disabled={addMut.isPending || (!phone && !email)}
          >
            {addMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
            Add to List
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// IMPORT CSV DIALOG
// ---------------------------------------------------------------------------

function ImportSuppressionCsvDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [csvData, setCsvData] = useState<Array<{ phone?: string; email?: string; firstName?: string; lastName?: string }>>([]);
  const [tag, setTag] = useState<string>('buyer');
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);

  const importMut = trpc.webinar.importSuppressionContacts.useMutation({
    onSuccess: (result: any) => {
      toast.success(`Imported ${result.imported} contacts (${result.skipped} skipped)`);
      onOpenChange(false);
      onImported();
      setCsvData([]); setFileName('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          toast.error('CSV file appears to be empty');
          setParsing(false);
          return;
        }

        // Parse header
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h === 'mobile');
        const emailIdx = headers.findIndex(h => h.includes('email'));
        const firstNameIdx = headers.findIndex(h => h.includes('first') || h === 'firstname');
        const lastNameIdx = headers.findIndex(h => h.includes('last') || h === 'lastname');

        if (phoneIdx === -1 && emailIdx === -1) {
          toast.error('CSV must have a "phone" or "email" column');
          setParsing(false);
          return;
        }

        // Parse rows
        const parsed: typeof csvData = [];
        for (let i = 1; i < lines.length; i++) {
          // Simple CSV parsing (handles quoted fields)
          const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(f => f.replace(/^"|"$/g, '').trim()) || lines[i].split(',').map(f => f.trim());
          
          const entry: typeof csvData[0] = {};
          if (phoneIdx >= 0 && row[phoneIdx]) entry.phone = row[phoneIdx];
          if (emailIdx >= 0 && row[emailIdx]) entry.email = row[emailIdx];
          if (firstNameIdx >= 0 && row[firstNameIdx]) entry.firstName = row[firstNameIdx];
          if (lastNameIdx >= 0 && row[lastNameIdx]) entry.lastName = row[lastNameIdx];

          if (entry.phone || entry.email) {
            parsed.push(entry);
          }
        }

        setCsvData(parsed);
        toast.success(`Parsed ${parsed.length} contacts from CSV`);
      } catch (err) {
        toast.error('Failed to parse CSV file');
      }
      setParsing(false);
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with phone numbers and/or emails. Contacts will be added to the suppression list with the selected tag.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-1 block">CSV File</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors text-sm">
                <Upload className="w-4 h-4" />
                {fileName || 'Choose file...'}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {parsing && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              CSV should have columns: phone, email, first name, last name (phone or email required)
            </p>
          </div>

          {csvData.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-sm font-medium">{csvData.length} contacts ready to import</p>
              <p className="text-xs text-muted-foreground mt-1">
                {csvData.filter(c => c.phone).length} with phone, {csvData.filter(c => c.email).length} with email
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Suppression Tag</label>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TAG_LABELS).map(([value, info]) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex items-center gap-2">
                      {info.icon}
                      {info.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false); setCsvData([]); setFileName(''); }}>
            Cancel
          </Button>
          <Button
            onClick={() => importMut.mutate({ contacts: csvData, tag: tag as any, source: 'csv_upload' as any })}
            disabled={importMut.isPending || csvData.length === 0}
          >
            {importMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
            Import {csvData.length} Contacts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
