/**
 * Webinar Show-Up Machine — Admin Dashboard
 * 
 * Owner-only dashboard for managing webinar SMS reminders, no-show blasts,
 * and AI conversation engine. Embedded as a tab in the Unified Admin.
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  CheckCircle,
  XCircle,
  Plus,
  ChevronRight,
  ArrowLeft,
  Bot,
  Bell,
  Radio,
  UserPlus,
  Eye,
  Edit,
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
          icon={<Users className="w-5 h-5 text-blue-600" />}
          label="Total Registrants"
          value={stats?.totalRegistrants ?? 0}
          sublabel={`${stats?.totalAttended ?? 0} attended`}
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
                  <div className="flex items-center gap-2">
                    {schedule.webinarjamWebinarId && (
                      <Badge variant="outline" className="text-xs">WebinarJam</Badge>
                    )}
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
  const sendRemindersMut = trpc.webinar.sendReminders.useMutation({
    onSuccess: (result) => {
      toast.success(`Reminders sent: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
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

  const [showAddRegistrant, setShowAddRegistrant] = useState(false);
  const [reminderStage, setReminderStage] = useState<number>(1);

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
              <p className="text-2xl font-bold text-amber-600">{stats.welcomeSent}</p>
              <p className="text-xs text-muted-foreground">Welcome Sent</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-950/20">
              <p className="text-2xl font-bold text-gray-600">{stats.optedOut}</p>
              <p className="text-xs text-muted-foreground">Opted Out</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {/* Send Reminders */}
            <div className="flex items-center gap-2">
              <Select value={String(reminderStage)} onValueChange={(v) => setReminderStage(Number(v))}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">24h Before</SelectItem>
                  <SelectItem value="2">Morning Of</SelectItem>
                  <SelectItem value="3">1 Hour Before</SelectItem>
                  <SelectItem value="4">At Start Time</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => sendRemindersMut.mutate({ scheduleId, stage: reminderStage })}
                disabled={sendRemindersMut.isPending}
              >
                {sendRemindersMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Bell className="w-4 h-4 mr-1" />}
                Send Reminders
              </Button>
            </div>

            {/* No-Show Blast */}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm('Are you sure you want to send the no-show blast? This will SMS all registered contacts who haven\'t attended.')) {
                  blastMut.mutate({ scheduleId });
                }
              }}
              disabled={blastMut.isPending}
            >
              {blastMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
              No-Show Blast
            </Button>

            {/* Sync from WebinarJam */}
            {schedule.webinarjamWebinarId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMut.mutate({ scheduleId })}
                disabled={syncMut.isPending}
              >
                {syncMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                Sync WebinarJam
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
                    <TableHead>Reminders</TableHead>
                    <TableHead>Welcome</TableHead>
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
                        {reg.email || '—'}
                      </TableCell>
                      <TableCell>
                        <AttendanceBadge status={reg.attendanceStatus} optedOut={reg.optedOut === 1} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          Stage {reg.lastReminderStage}/4
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {reg.welcomeSent ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300" />
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
            Customize the messages sent at each reminder stage. Use placeholders:
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
  const [name, setName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [startTime, setStartTime] = useState('18:00');
  const [liveRoomUrl, setLiveRoomUrl] = useState('');
  const [noShowTeaser, setNoShowTeaser] = useState('');
  const [wjWebinarId, setWjWebinarId] = useState('');
  const [wjScheduleId, setWjScheduleId] = useState('');

  const createMut = trpc.webinar.createSchedule.useMutation({
    onSuccess: () => {
      toast.success('Schedule created');
      onOpenChange(false);
      onCreated();
      // Reset form
      setName('');
      setDayOfWeek('0');
      setStartTime('18:00');
      setLiveRoomUrl('');
      setNoShowTeaser('');
      setWjWebinarId('');
      setWjScheduleId('');
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Webinar Schedule</DialogTitle>
          <DialogDescription>
            Set up a recurring webinar schedule with SMS reminders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name *</label>
            <Input
              placeholder="e.g., Sunday Masterclass"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Day of Week *</label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day, i) => (
                    <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Start Time (PST) *</label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Live Room URL</label>
            <Input
              placeholder="https://webinarjam.com/live/..."
              value={liveRoomUrl}
              onChange={(e) => setLiveRoomUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">No-Show Teaser</label>
            <Input
              placeholder="e.g., the 3-step strategy that changed everything"
              value={noShowTeaser}
              onChange={(e) => setNoShowTeaser(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Used in no-show blast messages to create urgency</p>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">WebinarJam Integration (Optional)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Webinar ID</label>
                <Input
                  placeholder="WJ Webinar ID"
                  value={wjWebinarId}
                  onChange={(e) => setWjWebinarId(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Schedule ID</label>
                <Input
                  placeholder="WJ Schedule ID"
                  value={wjScheduleId}
                  onChange={(e) => setWjScheduleId(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (!name.trim() || !startTime) {
                toast.error('Name and start time are required');
                return;
              }
              createMut.mutate({
                name: name.trim(),
                dayOfWeek: parseInt(dayOfWeek),
                startTime,
                liveRoomUrl: liveRoomUrl || undefined,
                noShowTeaser: noShowTeaser || undefined,
                webinarjamWebinarId: wjWebinarId || undefined,
                webinarjamScheduleId: wjScheduleId || undefined,
              });
            }}
            disabled={createMut.isPending || !name.trim()}
          >
            {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            Create Schedule
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
      toast.success(`Registrant added${result.welcomeSent ? ' (welcome SMS sent)' : ''}`);
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
            Add & Send Welcome
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// UTILITY COMPONENTS
// ---------------------------------------------------------------------------

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
