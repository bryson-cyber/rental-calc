/**
 * Webinar Campaign Manager — Standalone Admin Page
 * 
 * A dedicated hub for managing webinar follow-up SMS campaigns.
 * Features:
 * 1. Webinar selection with auto-import
 * 2. Attendance dashboard (attended vs no-show split view)
 * 3. One-click audience texting with delivery tracking
 * 4. SMS sequence builder with scheduling
 * 5. Campaign history with delivery status
 * 6. API status indicators
 */

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Radio,
  Globe,
  Users,
  UserCheck,
  UserX,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Settings,
  Zap,
  MessageSquare,
  CalendarClock,
  BarChart3,
  Loader2,
  ChevronRight,
  Phone,
  Mail,
  Eye,
  Trash2,
  Plus,
  Play,
  Pause,
  Ban,
  Sparkles,
  MessageCircle,
  Inbox,
  Bell,
  Timer,
  Edit3,
  Check,
  X,
  Save,
  Calendar,
  CalendarCheck,
  AlertTriangle,
  UserPlus,
} from "lucide-react";
import { Link } from "wouter";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Types ──────────────────────────────────────────────────────────────────

type Registrant = {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  attended: number;
  optedOut: number;
  source: string;
  webinarName: string | null;
  webinarId: string;
  createdAt: string;
  calendarInviteSent?: number | null;
  calendarEventId?: string | null;
};

type ScheduledMessage = {
  id: number;
  webinarId: string;
  sequenceName: string;
  sequenceOrder: number;
  messageBody: string;
  scheduledAt: Date;
  status: string;
  audience: string;
  sentCount: number;
  failedCount: number;
};

// ─── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pending", variant: "secondary" },
    sending: { label: "Sending", variant: "default" },
    sent: { label: "Sent", variant: "default" },
    completed: { label: "Completed", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
    cancelled: { label: "Cancelled", variant: "outline" },
  };
  const c = config[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

// ─── Audience Badge ─────────────────────────────────────────────────────────

function AudienceBadge({ audience }: { audience: string }) {
  if (audience === "attended") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Attended</Badge>;
  if (audience === "not_attended") return <Badge className="bg-amber-100 text-amber-800 border-amber-200">No-Shows</Badge>;
  return <Badge variant="secondary">Everyone</Badge>;
}

// ─── Format helpers ─────────────────────────────────────────────────────────

function formatDate(dateStr: string | Date | null) {
  if (!dateStr) return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) + " ET";
}

function getRelativeTime(dateStr: string | Date | null): string | null {
  if (!dateStr) return null;
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);
  const isFuture = diffMs > 0;

  if (absDiffMs < 60_000) return isFuture ? "in < 1 min" : "just now";
  if (absDiffMs < 3_600_000) {
    const mins = Math.round(absDiffMs / 60_000);
    return isFuture ? `in ${mins} min` : `${mins} min ago`;
  }
  if (absDiffMs < 86_400_000) {
    const hrs = Math.floor(absDiffMs / 3_600_000);
    const mins = Math.round((absDiffMs % 3_600_000) / 60_000);
    const hPart = `${hrs}h`;
    const mPart = mins > 0 ? ` ${mins}m` : "";
    return isFuture ? `in ${hPart}${mPart}` : `${hPart}${mPart} ago`;
  }
  const days = Math.round(absDiffMs / 86_400_000);
  return isFuture ? `in ${days}d` : `${days}d ago`;
}

function formatPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: Webinar Selector & API Status Header
// ═══════════════════════════════════════════════════════════════════════════

function WebinarHeader({
  selectedWebinarId,
  selectedWebinarName,
  onWebinarChange,
}: {
  selectedWebinarId: string | null;
  selectedWebinarName: string | null;
  onWebinarChange: () => void;
}) {
  const apiStatus = trpc.webinarSms.getApiStatus.useQuery();
  const settings = trpc.webinarSms.getSettings.useQuery();
  const webinars = trpc.webinarSms.listWebinarsWithSchedules.useQuery();
  const saveSelection = trpc.webinarSms.saveWebinarSelection.useMutation({
    onSuccess: () => {
      toast.success("Webinar selected & credentials saved");
      settings.refetch();
      onWebinarChange();
    },
  });

  const [showSelector, setShowSelector] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState("");
  const [webinarApiKey, setWebinarApiKey] = useState("");
  const [webinarHash, setWebinarHash] = useState("");
  const [webinarMemberId, setWebinarMemberId] = useState("");
  const [webinarIntegrationId, setWebinarIntegrationId] = useState("");
  const [loadingCreds, setLoadingCreds] = useState(false);

  // Fetch saved credentials when a webinar is selected in the dropdown
  const savedCreds = trpc.webinarSms.getWebinarCredentials.useQuery(
    { webinarId: selectedId },
    { enabled: !!selectedId && showSelector }
  );

  // Pre-fill from saved settings when dialog opens
  useEffect(() => {
    if (showSelector) {
      if (selectedWebinarId) setSelectedId(selectedWebinarId);
    }
  }, [showSelector]);

  // When credentials load for the selected webinar, fill the fields
  useEffect(() => {
    if (savedCreds.data && selectedId) {
      setWebinarApiKey(savedCreds.data.apiKey || "");
      setWebinarHash(savedCreds.data.webinarHash || "");
      setWebinarMemberId(savedCreds.data.memberId || "");
      setWebinarIntegrationId(savedCreds.data.integrationWebinarId || "");
    } else if (selectedId && !savedCreds.data?.found) {
      // No saved creds for this webinar — clear fields
      setWebinarApiKey("");
      setWebinarHash("");
      setWebinarMemberId("");
      setWebinarIntegrationId("");
    }
  }, [savedCreds.data, selectedId]);

  const selectedWebinar = webinars.data?.webinars?.find((w: any) => w.id === selectedId) as any;

  return (
    <div className="space-y-4">
      {/* Top bar: API status indicators */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${apiStatus.data?.webinarjam?.configured ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className="text-muted-foreground">WebinarJam</span>
          {apiStatus.data?.webinarjam?.configured && (
            <span className="text-xs text-muted-foreground/60">{apiStatus.data.webinarjam.keyPreview}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${apiStatus.data?.simpletexting?.configured ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className="text-muted-foreground">SimpleTexting</span>
          {apiStatus.data?.simpletexting?.configured && (
            <span className="text-xs text-muted-foreground/60">{apiStatus.data.simpletexting.keyPreview}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${settings.data?.webinarApiKeyConfigured ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span className="text-muted-foreground">Webinar Key</span>
          {!settings.data?.webinarApiKeyConfigured && (
            <span className="text-xs text-amber-500">Not set</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${apiStatus.data?.googleCalendar?.configured ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className="text-muted-foreground">Calendar</span>
        </div>
        {settings.data?.cronEnabled && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Auto-import every {settings.data.cronIntervalMinutes}m</span>
          </div>
        )}
      </div>

      {/* Webinar selector */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          {selectedWebinarId ? (
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 text-amber-600" />
              <div>
                <h2 className="text-lg font-semibold font-display text-foreground">{selectedWebinarName}</h2>
                <p className="text-sm text-muted-foreground">Active webinar • ID: {selectedWebinarId}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <AlertCircle className="w-5 h-5" />
              <p>No webinar selected. Choose one to get started.</p>
            </div>
          )}
        </div>
        <Button variant="outline" onClick={() => setShowSelector(true)}>
          {selectedWebinarId ? "Change Webinar" : "Select Webinar"}
        </Button>
      </div>

      {/* Webinar selection dialog */}
      <Dialog open={showSelector} onOpenChange={setShowSelector}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Webinar</DialogTitle>
            <DialogDescription>Choose the webinar you want to manage SMS campaigns for. Credentials are saved per webinar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedId} onValueChange={(val) => {
              setSelectedId(val);
              // Reset fields — they'll be filled by the useEffect when savedCreds loads
              setWebinarApiKey("");
              setWebinarHash("");
              setWebinarMemberId("");
              setWebinarIntegrationId("");
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a webinar..." />
              </SelectTrigger>
              <SelectContent>
                {webinars.data?.webinars?.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedWebinar?.schedules?.length && selectedWebinar.schedules.length > 0 && (
              <Select value={selectedSchedule} onValueChange={setSelectedSchedule}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a schedule (optional)..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All schedules</SelectItem>
                  {selectedWebinar.schedules.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.date} {s.comment ? `— ${s.comment}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Per-webinar API credentials — all 4 fields */}
            <div className="border-t pt-4 mt-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-foreground">Webinar API Credentials</p>
                {savedCreds.isLoading && selectedId && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
                {savedCreds.data?.found && (
                  <Badge variant="secondary" className="text-xs">Saved</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Found in WebinarJam → Configuration → Advanced Integration → API custom integration
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">API Key</label>
                  <Input
                    type="password"
                    placeholder="Paste the per-webinar API key..."
                    value={webinarApiKey}
                    onChange={(e) => setWebinarApiKey(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Webinar Hash</label>
                  <Input
                    placeholder="e.g., 076vwc5z"
                    value={webinarHash}
                    onChange={(e) => setWebinarHash(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Member ID</label>
                  <Input
                    placeholder="e.g., 12345"
                    value={webinarMemberId}
                    onChange={(e) => setWebinarMemberId(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Webinar ID (from API integration)</label>
                  <Input
                    placeholder="e.g., 67890"
                    value={webinarIntegrationId}
                    onChange={(e) => setWebinarIntegrationId(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSelector(false)}>Cancel</Button>
            <Button
              disabled={!selectedId || saveSelection.isPending}
              onClick={() => {
                const webinar = webinars.data?.webinars?.find((w: any) => w.id === selectedId);
                if (!webinar) return;
                // Find the selected schedule's date
                const selectedSched = selectedSchedule && selectedSchedule !== "none"
                  ? webinar.schedules?.find((s: any) => String(s.id) === selectedSchedule)
                  : webinar.schedules?.[0]; // default to first schedule
                saveSelection.mutate({
                  webinarId: selectedId,
                  webinarName: webinar.name,
                  scheduleId: selectedSchedule && selectedSchedule !== "none" ? selectedSchedule : undefined,
                  webinarApiKey: webinarApiKey || undefined,
                  webinarHash: webinarHash || undefined,
                  webinarMemberId: webinarMemberId || undefined,
                  webinarIntegrationId: webinarIntegrationId || undefined,
                  scheduleDate: selectedSched?.date || undefined,
                });
                setShowSelector(false);
              }}
            >
              {saveSelection.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Select & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: Attendance Dashboard — Split View
// ═══════════════════════════════════════════════════════════════════════════

function AttendanceDashboard({ webinarId, scheduleDate }: { webinarId: string; scheduleDate: string | null }) {
  // Determine if the webinar has already happened
  // WebinarJam schedule dates are typically in format like "February 25, 2026 8:00 PM" or ISO
  const webinarHasEnded = useMemo(() => {
    if (!scheduleDate) return false; // If no date, we can't tell — assume not ended
    try {
      const scheduledTime = new Date(scheduleDate);
      if (isNaN(scheduledTime.getTime())) return false;
      // Add 2 hours buffer for webinar duration
      const endTime = new Date(scheduledTime.getTime() + 2 * 60 * 60 * 1000);
      return new Date() > endTime;
    } catch {
      return false;
    }
  }, [scheduleDate]);

  const summary = trpc.webinarSms.getAttendanceSummary.useQuery({ webinarId });
  const attended = trpc.webinarSms.listRegistrantsByAttendance.useQuery({ webinarId, attended: 1, pageSize: 100 });
  const noShows = trpc.webinarSms.listRegistrantsByAttendance.useQuery({ webinarId, attended: 0, pageSize: 100 });
  const refreshAttendance = trpc.webinarSms.refreshAttendance.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      summary.refetch();
      attended.refetch();
      noShows.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const triggerImport = trpc.webinarSms.triggerManualImport.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} registrants (${data.skipped} skipped)`);
      summary.refetch();
      attended.refetch();
      noShows.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.data?.total ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Total Registrants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{summary.data?.attended ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Attended</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${webinarHasEnded ? 'bg-amber-50' : 'bg-slate-50'}`}>
                {webinarHasEnded ? (
                  <UserX className="w-5 h-5 text-amber-600" />
                ) : (
                  <Clock className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div>
                {webinarHasEnded ? (
                  <>
                    <p className="text-2xl font-bold text-amber-700">{summary.data?.noShow ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">No-Shows</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-slate-400">—</p>
                    <p className="text-xs text-muted-foreground">No-Shows (pending)</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <Ban className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{summary.data?.optedOut ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Opted Out</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-700">{summary.data?.calendarInvitesSent ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Cal Invites</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => triggerImport.mutate()}
          disabled={triggerImport.isPending}
        >
          {triggerImport.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Sync Registrants
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshAttendance.mutate({ webinarId })}
          disabled={refreshAttendance.isPending}
        >
          {refreshAttendance.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh Attendance
        </Button>
      </div>

      {/* Split view: Attended vs No-Shows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attended column */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <CardTitle className="text-base">Attended</CardTitle>
                <Badge variant="secondary" className="ml-1">{attended.data?.total ?? 0}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {attended.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : attended.data?.registrants?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No attendees yet. Click "Refresh Attendance" after your webinar ends.</p>
              ) : (
                attended.data?.registrants?.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/30">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-medium text-sm">
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{formatPhone(r.phone)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {r.email && <Mail className="w-3.5 h-3.5 text-muted-foreground/50" />}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CalendarCheck className={`w-3.5 h-3.5 ${r.calendarInviteSent ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">{r.calendarInviteSent ? 'Calendar invite sent' : 'No calendar invite'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* No-Shows column */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {webinarHasEnded ? (
                  <UserX className="w-5 h-5 text-amber-600" />
                ) : (
                  <Clock className="w-5 h-5 text-slate-400" />
                )}
                <CardTitle className="text-base">No-Shows</CardTitle>
                {webinarHasEnded && <Badge variant="secondary" className="ml-1">{noShows.data?.total ?? 0}</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {!webinarHasEnded ? (
              <div className="text-center py-12">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">Webinar hasn't happened yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No-shows will be available after the webinar ends and you click "Refresh Attendance".
                </p>
                {scheduleDate && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Scheduled: {scheduleDate}
                  </p>
                )}
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {noShows.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : noShows.data?.registrants?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No no-shows recorded yet. Click "Refresh Attendance" to pull data.</p>
                ) : (
                  noShows.data?.registrants?.map((r: any) => (
                    <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-amber-100 bg-amber-50/30">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-medium text-sm">
                        {r.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{formatPhone(r.phone)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {r.email && <Mail className="w-3.5 h-3.5 text-muted-foreground/50" />}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CalendarCheck className={`w-3.5 h-3.5 ${r.calendarInviteSent ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">{r.calendarInviteSent ? 'Calendar invite sent' : 'No calendar invite'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: Quick Send — One-Click Audience Texting
// ═══════════════════════════════════════════════════════════════════════════

function QuickSend({ webinarId, webinarName }: { webinarId: string; webinarName?: string | null }) {
  const [scope, setScope] = useState<"this_webinar" | "all_webinars">("this_webinar");
  const [audience, setAudience] = useState<"all" | "attended" | "not_attended">("all");
  const [message, setMessage] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [showTestDialog, setShowTestDialog] = useState(false);
  const effectiveWebinarId = scope === "all_webinars" ? undefined : webinarId;
  const summary = trpc.webinarSms.getAttendanceSummary.useQuery(
    { webinarId: effectiveWebinarId }
  );
  const globalSummary = trpc.webinarSms.getAttendanceSummary.useQuery({});
  const templates = trpc.webinarSms.listTemplates.useQuery();
  const composeMessage = trpc.webinarSms.composeMessage.useMutation({
    onSuccess: (data) => {
      setMessage(data.message);
      setAiPrompt("");
      toast.success("AI message composed! Review and edit below before sending.");
    },
    onError: (err) => toast.error(`AI error: ${err.message}`),
  });
  const sendCampaign = trpc.webinarSms.sendCampaign.useMutation({
    onSuccess: (data) => {
      toast.success(`Campaign sent! ${data.sent} delivered, ${data.failed} failed.`);
      setMessage("");
      setCampaignName("");
      setShowConfirm(false);
    },
    onError: (err) => toast.error(err.message),
  });
  const sendTestSms = trpc.webinarSms.sendTestSms.useMutation({
    onSuccess: () => {
      toast.success("Test SMS sent! Check your phone.");
      setShowTestDialog(false);
    },
    onError: (err) => toast.error(`Test failed: ${err.message}`),
  });

  const recipientCount = audience === "attended"
    ? summary.data?.attended ?? 0
    : audience === "not_attended"
      ? summary.data?.noShow ?? 0
      : summary.data?.total ?? 0;

  const handleSend = () => {
    if (!message.trim() || !campaignName.trim()) {
      toast.error("Please enter a campaign name and message");
      return;
    }
    sendCampaign.mutate({
      name: campaignName,
      messageBody: message,
      filter: {
        webinarId: effectiveWebinarId,
        attended: audience === "attended" ? 1 : audience === "not_attended" ? 0 : undefined,
      },
    });
  };

  // Personalize message for test preview (replace variables with sample data)
  const getTestPreview = (msg: string) => {
    return msg
      .replace(/%FIRST_NAME%/g, "Bryson")
      .replace(/%FULL_NAME%/g, "Bryson Blocker")
      .replace(/%EMAIL%/g, "bryson@stayly.com");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5 text-amber-600" />
          Quick Send
        </CardTitle>
        <CardDescription>Send a one-time SMS to your webinar audience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scope selector — This Webinar vs All Webinars */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setScope("this_webinar")}
            className={`p-3 rounded-xl border-2 text-center transition-all ${
              scope === "this_webinar"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/30"
            }`}
          >
            <Radio className={`w-5 h-5 mx-auto mb-1 ${scope === "this_webinar" ? "text-primary" : "text-muted-foreground"}`} />
            <p className="text-sm font-medium">This Webinar</p>
            <p className="text-xs text-muted-foreground">{webinarName || "Selected"}</p>
          </button>
          <button
            onClick={() => setScope("all_webinars")}
            className={`p-3 rounded-xl border-2 text-center transition-all ${
              scope === "all_webinars"
                ? "border-purple-500 bg-purple-50 shadow-sm"
                : "border-border hover:border-purple-200"
            }`}
          >
            <Globe className={`w-5 h-5 mx-auto mb-1 ${scope === "all_webinars" ? "text-purple-600" : "text-muted-foreground"}`} />
            <p className="text-sm font-medium">All Webinars</p>
            <p className="text-xs text-muted-foreground">{globalSummary.data?.total ?? 0} total registrants</p>
          </button>
        </div>

        {scope === "all_webinars" && (
          <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Sending to registrants from <strong>all webinars</strong> — not just the currently selected one.</span>
          </div>
        )}

        {/* Audience selector — big buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setAudience("all")}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              audience === "all"
                ? "border-blue-500 bg-blue-50 shadow-sm"
                : "border-border hover:border-blue-200"
            }`}
          >
            <Users className={`w-6 h-6 mx-auto mb-1 ${audience === "all" ? "text-blue-600" : "text-muted-foreground"}`} />
            <p className="text-sm font-medium">Everyone</p>
            <p className="text-xs text-muted-foreground">{summary.data?.total ?? 0} people</p>
          </button>
          <button
            onClick={() => setAudience("attended")}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              audience === "attended"
                ? "border-emerald-500 bg-emerald-50 shadow-sm"
                : "border-border hover:border-emerald-200"
            }`}
          >
            <UserCheck className={`w-6 h-6 mx-auto mb-1 ${audience === "attended" ? "text-emerald-600" : "text-muted-foreground"}`} />
            <p className="text-sm font-medium">Attended</p>
            <p className="text-xs text-muted-foreground">{summary.data?.attended ?? 0} people</p>
          </button>
          <button
            onClick={() => setAudience("not_attended")}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              audience === "not_attended"
                ? "border-amber-500 bg-amber-50 shadow-sm"
                : "border-border hover:border-amber-200"
            }`}
          >
            <UserX className={`w-6 h-6 mx-auto mb-1 ${audience === "not_attended" ? "text-amber-600" : "text-muted-foreground"}`} />
            <p className="text-sm font-medium">No-Shows</p>
            <p className="text-xs text-muted-foreground">{summary.data?.noShow ?? 0} people</p>
          </button>
        </div>

        {/* Template quick-fill */}
        {templates.data?.templates && templates.data.templates.length > 0 && (
          <Select onValueChange={(val) => {
            const t = templates.data?.templates?.find((t: any) => String(t.id) === val);
            if (t) setMessage(t.body);
          }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Load from template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.data.templates.map((t: any) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Campaign name */}
        <Input
          placeholder="Campaign name (e.g., 'Post-webinar follow-up')"
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
        />

        {/* AI Message Composer — expanded */}
        <div className="border rounded-xl p-4 bg-gradient-to-r from-amber-50/50 to-purple-50/50 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold">AI Message Composer</span>
          </div>
          <p className="text-xs text-muted-foreground">Describe what you want to say in plain English. The AI will craft a professional SMS using your webinar content and add personalization variables automatically.</p>
          <Textarea
            placeholder="e.g., 'Tell the no-shows they missed an amazing class about rental arbitrage and that the replay is available for 48 hours. Create urgency and mention what they'll learn about getting their first Airbnb without owning property.'"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={4}
            className="bg-white/80 resize-y"
          />
          <Button
            size="sm"
            disabled={!aiPrompt.trim() || composeMessage.isPending}
            onClick={() => {
              composeMessage.mutate({
                prompt: aiPrompt,
                audience,
                webinarId: webinarId || undefined,
              });
            }}
            className="w-full"
          >
            {composeMessage.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Composing...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Compose with AI</>
            )}
          </Button>
        </div>

        {/* Message editor — full multi-line textarea */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Message</label>
          <Textarea
            placeholder="Type your message here or use AI to compose it above...\n\nUse %FIRST_NAME% for personalization.\n\nExample:\nHey %FIRST_NAME%! You missed an incredible class last night. We covered how to get your first Airbnb without owning property. The replay is live for 48 hours — don't miss it again!"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            className="resize-y text-sm leading-relaxed"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Variables: <code className="bg-muted px-1 rounded">%FIRST_NAME%</code> <code className="bg-muted px-1 rounded">%FULL_NAME%</code> <code className="bg-muted px-1 rounded">%EMAIL%</code></span>
            <span className={message.length > 300 ? "text-amber-600 font-medium" : ""}>{message.length} chars</span>
          </div>
        </div>

        {/* Action buttons row */}
        <div className="flex gap-3">
          {/* Test SMS button */}
          <Button
            variant="outline"
            size="lg"
            disabled={!message.trim()}
            onClick={() => setShowTestDialog(true)}
            className="flex-shrink-0"
          >
            <Phone className="w-4 h-4 mr-2" />
            Send Test
          </Button>

          {/* Send to all button */}
          <Button
            className="flex-1"
            size="lg"
            disabled={!message.trim() || !campaignName.trim() || recipientCount === 0 || sendCampaign.isPending}
            onClick={() => setShowConfirm(true)}
          >
            {sendCampaign.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send to {recipientCount} {audience === "attended" ? "Attendees" : audience === "not_attended" ? "No-Shows" : "Registrants"}{scope === "all_webinars" ? " (All Webinars)" : ""}
          </Button>
        </div>

        {/* Test SMS dialog */}
        <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Test SMS</DialogTitle>
              <DialogDescription>
                Send this message to your phone first to see how it looks before sending to everyone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Your Phone Number</label>
                <Input
                  placeholder="+1 (555) 123-4567"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Preview (with sample data)</label>
                <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
                  {getTestPreview(message) || <span className="text-muted-foreground italic">No message to preview</span>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTestDialog(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!testPhone.trim()) {
                    toast.error("Enter your phone number");
                    return;
                  }
                  sendTestSms.mutate({
                    phone: testPhone,
                    message: getTestPreview(message),
                  });
                }}
                disabled={sendTestSms.isPending || !testPhone.trim()}
              >
                {sendTestSms.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
                Send Test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Send</DialogTitle>
              <DialogDescription>
                You're about to send an SMS to <strong>{recipientCount}</strong> {audience === "attended" ? "attendees" : audience === "not_attended" ? "no-shows" : "registrants"}{scope === "all_webinars" ? " across ALL webinars" : ` from ${webinarName || "the selected webinar"}`}.
              </DialogDescription>
            </DialogHeader>
            <div>
              <label className="text-sm font-medium mb-1 block">Message Preview</label>
              <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">{message}</div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirm(false);
                  setShowTestDialog(true);
                }}
              >
                <Phone className="w-4 h-4 mr-2" />
                Send Test First
              </Button>
              <Button onClick={handleSend} disabled={sendCampaign.isPending}>
                {sendCampaign.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Send Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: SMS Sequence Builder
// ═══════════════════════════════════════════════════════════════════════════

function SequenceBuilder({ webinarId }: { webinarId: string }) {
  const scheduled = trpc.webinarSms.listScheduledMessages.useQuery({ webinarId });
  const generateSeq = trpc.webinarSms.generateSequence.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.count}-message sequence`);
      scheduled.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const cancelMsg = trpc.webinarSms.cancelScheduledMessage.useMutation({
    onSuccess: () => {
      toast.success("Message cancelled");
      scheduled.refetch();
    },
  });
  const deleteMsg = trpc.webinarSms.deleteScheduledMessage.useMutation({
    onSuccess: () => {
      toast.success("Message deleted");
      scheduled.refetch();
    },
  });
  const updateMsg = trpc.webinarSms.upsertScheduledMessage.useMutation({
    onSuccess: () => {
      toast.success("Message updated");
      scheduled.refetch();
      setEditingId(null);
      setEditText("");
    },
    onError: (err) => toast.error(err.message),
  });

  // Inline editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const startEditing = (msg: any) => {
    setEditingId(msg.id);
    setEditText(msg.messageBody);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = (msg: any) => {
    if (!editText.trim()) {
      toast.error("Message cannot be empty");
      return;
    }
    updateMsg.mutate({
      id: msg.id,
      webinarId: msg.webinarId,
      sequenceName: msg.sequenceName,
      sequenceOrder: msg.sequenceOrder,
      messageBody: editText.trim(),
      scheduledAt: new Date(msg.scheduledAt).toISOString(),
      audience: msg.audience,
    });
  };

  // Import No-Shows state
  const [showImportNoShows, setShowImportNoShows] = useState(false);
  const [sourceWebinarId, setSourceWebinarId] = useState("");
  const webinarList = trpc.webinarSms.listWebinarsWithSchedules.useQuery();
  const importNoShows = trpc.webinarSms.importNoShowsToWebinar.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowImportNoShows(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const [showGenerate, setShowGenerate] = useState(false);
  const [webinarDate, setWebinarDate] = useState("");
  const [webinarTimezone, setWebinarTimezone] = useState("America/New_York");
  const [webinarLink, setWebinarLink] = useState("");
  const [replayLink, setReplayLink] = useState("");
  const [showAdvancedTiming, setShowAdvancedTiming] = useState(false);
  const [timing, setTiming] = useState({
    registrationConfirm: -10080, // -7 days
    twoDaysBefore: -2880,        // -2 days
    dayBefore: -1440,             // -1 day
    morningOf: -240,              // -4 hours
    oneHourWarning: -60,          // -1 hour
    goingLiveNow: -5,             // -5 min
    noShowNudge: 10,              // +10 min
    thankYouAttended: 60,         // +1 hour
    missedYouNoShow: 120,         // +2 hours
    followUpCta: 1440,            // +1 day
  });

  const messages = scheduled.data?.messages ?? [];
  const pendingCount = messages.filter((m: any) => m.status === "pending").length;
  const sentCount = messages.filter((m: any) => m.status === "sent").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-amber-600" />
              SMS Sequence
            </CardTitle>
            <CardDescription>
              {messages.length > 0
                ? `${messages.length} messages • ${pendingCount} pending • ${sentCount} sent`
                : "Set up a pre-built 10-message sequence for your webinar"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImportNoShows(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Import No-Shows
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowGenerate(true)}>
              <Zap className="w-4 h-4 mr-2" />
              {messages.length > 0 ? "Regenerate" : "Generate Sequence"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No scheduled messages yet.</p>
            <p className="text-xs mt-1">Click "Generate Sequence" to create a proven 9-message follow-up sequence.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg: any) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  msg.status === "sent" ? "bg-emerald-50/30 border-emerald-100" :
                  msg.status === "sending" ? "bg-blue-50/30 border-blue-100" :
                  msg.status === "cancelled" ? "bg-muted/30 border-muted opacity-60" :
                  msg.status === "failed" ? "bg-red-50/30 border-red-100" :
                  "bg-background border-border"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground flex-shrink-0">
                  {msg.sequenceOrder}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium">{msg.sequenceName}</p>
                    <StatusBadge status={msg.status} />
                    <AudienceBadge audience={msg.audience} />
                  </div>
                  {editingId === msg.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="text-xs min-h-[60px] resize-y"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Escape") cancelEditing();
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(msg);
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => saveEdit(msg)}
                          disabled={updateMsg.isPending}
                        >
                          {updateMsg.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={cancelEditing}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                        <span className="text-[10px] text-muted-foreground ml-auto">Ctrl+Enter to save • Esc to cancel</span>
                      </div>
                    </div>
                  ) : (
                    <p
                      className={`text-xs text-muted-foreground mb-1 ${msg.status === "pending" ? "cursor-pointer hover:text-foreground transition-colors" : ""}`}
                      onClick={() => msg.status === "pending" && startEditing(msg)}
                      title={msg.status === "pending" ? "Click to edit" : undefined}
                    >
                      {msg.messageBody}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatDate(msg.scheduledAt)}
                    {msg.status === "pending" && getRelativeTime(msg.scheduledAt) && (
                      <span className={`ml-2 font-semibold ${
                        (() => {
                          const d = new Date(msg.scheduledAt);
                          const diffMs = d.getTime() - Date.now();
                          if (diffMs < 0) return "text-red-500";
                          if (diffMs < 3_600_000) return "text-amber-500";
                          return "text-emerald-600";
                        })()
                      }`}>
                        ({getRelativeTime(msg.scheduledAt)})
                      </span>
                    )}
                    {msg.status === "sending" && (
                      <span className="ml-2 text-blue-600 font-medium animate-pulse">
                        ⟳ Sending now...
                      </span>
                    )}
                    {msg.status === "sent" && (
                      <span className="ml-2 text-emerald-600 font-medium">
                        ✓ Fired{msg.sentAt ? ` at ${new Date(msg.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                        {msg.sentCount != null && ` — ${msg.sentCount} delivered`}
                        {(msg.failedCount ?? 0) > 0 && <span className="text-red-500 ml-1">({msg.failedCount} failed)</span>}
                      </span>
                    )}
                    {msg.status === "failed" && (
                      <span className="ml-2 text-red-500 font-medium">
                        ✗ Failed{msg.sentAt ? ` at ${new Date(msg.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                        {msg.sentCount != null && msg.sentCount > 0 && ` — ${msg.sentCount} partial`}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {msg.status === "sending" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={cancelMsg.isPending}
                      onClick={() => cancelMsg.mutate({ id: msg.id })}
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Stop
                    </Button>
                  )}
                  {msg.status === "pending" && editingId !== msg.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => startEditing(msg)}
                      title="Edit message"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {msg.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => cancelMsg.mutate({ id: msg.id })}
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {(msg.status === "cancelled" || msg.status === "sent" || msg.status === "failed") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteMsg.mutate({ id: msg.id })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generate sequence dialog */}
        {/* Import No-Shows Dialog */}
        <Dialog open={showImportNoShows} onOpenChange={setShowImportNoShows}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import No-Shows from Previous Webinar</DialogTitle>
              <DialogDescription>
                Copy registrants who didn't attend a previous webinar into this one. They'll receive the confirmation SMS and full sequence.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Source Webinar (pull no-shows from)</label>
                <Select value={sourceWebinarId} onValueChange={setSourceWebinarId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a previous webinar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {webinarList.data?.webinars?.map((w: any) => (
                      <SelectItem key={w.id} value={w.id} disabled={w.id === webinarId}>
                        {w.name} {w.id === webinarId ? "(current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Only registrants who did NOT attend and have NOT opted out will be imported. Duplicates (same phone number) are automatically skipped.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowImportNoShows(false)}>Cancel</Button>
              <Button
                disabled={!sourceWebinarId || importNoShows.isPending}
                onClick={() => {
                  importNoShows.mutate({
                    sourceWebinarId,
                    targetWebinarId: webinarId,
                  });
                }}
              >
                {importNoShows.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Import No-Shows
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate SMS Sequence</DialogTitle>
              <DialogDescription>
                Create a proven 9-message sequence: 6 pre-webinar reminders + 3 post-webinar follow-ups. {messages.length > 0 ? "This will replace the existing sequence." : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Webinar Date & Time *</label>
                <Input
                  type="datetime-local"
                  value={webinarDate}
                  onChange={(e) => setWebinarDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Timezone</label>
                <Select value={webinarTimezone} onValueChange={setWebinarTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    <SelectItem value="America/Phoenix">Arizona (no DST)</SelectItem>
                    <SelectItem value="Pacific/Honolulu">Hawaii (HT)</SelectItem>
                    <SelectItem value="America/Anchorage">Alaska (AKT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Webinar Join Link (optional)</label>
                <Input
                  placeholder="https://..."
                  value={webinarLink}
                  onChange={(e) => setWebinarLink(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Replay Link (optional)</label>
                <Input
                  placeholder="https://..."
                  value={replayLink}
                  onChange={(e) => setReplayLink(e.target.value)}
                />
              </div>

              {/* Customizable Timing */}
              <div className="border-t pt-4">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowAdvancedTiming(!showAdvancedTiming)}
                >
                  <Timer className="w-4 h-4" />
                  Customize Timing
                  <ChevronRight className={`w-4 h-4 transition-transform ${showAdvancedTiming ? "rotate-90" : ""}`} />
                </button>

                {showAdvancedTiming && (
                  <div className="mt-3 space-y-2 bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-2">Set when each message goes out relative to the webinar start time.</p>
                    {[
                      { key: "registrationConfirm" as const, label: "Registration Confirm", default: -10080 },
                      { key: "twoDaysBefore" as const, label: "2 Days Before", default: -2880 },
                      { key: "dayBefore" as const, label: "Day Before", default: -1440 },
                      { key: "morningOf" as const, label: "Morning Of", default: -240 },
                      { key: "oneHourWarning" as const, label: "1 Hour Warning", default: -60 },
{ key: "goingLiveNow" as const, label: "Starting NOW", default: -5 },
                       { key: "noShowNudge" as const, label: "No-Show Nudge", default: 10 },
                       { key: "thankYouAttended" as const, label: "Thank You (Attended)", default: 60 },
                      { key: "missedYouNoShow" as const, label: "Missed You (No-Show)", default: 120 },
                      { key: "followUpCta" as const, label: "Follow-Up CTA", default: 1440 },
                    ].map((item) => {
                      const val = timing[item.key];
                      const absMinutes = Math.abs(val);
                      let displayText = "";
                      if (absMinutes >= 1440) displayText = `${Math.round(absMinutes / 1440)}d ${val < 0 ? "before" : "after"}`;
                      else if (absMinutes >= 60) displayText = `${Math.round(absMinutes / 60)}h ${val < 0 ? "before" : "after"}`;
                      else displayText = `${absMinutes}min ${val < 0 ? "before" : "after"}`;

                      return (
                        <div key={item.key} className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium w-40 flex-shrink-0">{item.label}</span>
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              type="number"
                              className="h-8 text-xs w-24"
                              value={val}
                              onChange={(e) => setTiming(prev => ({ ...prev, [item.key]: parseInt(e.target.value) || 0 }))}
                            />
                            <span className="text-xs text-muted-foreground w-24">{displayText}</span>
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-muted-foreground mt-2">Values in minutes. Negative = before webinar, positive = after.</p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
              <Button
                disabled={!webinarDate || generateSeq.isPending}
                onClick={() => {
                  // Convert the datetime-local value to UTC using the selected timezone
                  // datetime-local gives us "2026-07-01T19:30" — interpret this in the selected tz
                  const targetOffset = new Date(new Date(webinarDate).toLocaleString("en-US", { timeZone: webinarTimezone })).getTime();
                  const utcOffset = new Date(new Date(webinarDate).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
                  const offsetMs = utcOffset - targetOffset;
                  const correctedDate = new Date(new Date(webinarDate).getTime() + offsetMs);
                  
                  generateSeq.mutate({
                    webinarId,
                    webinarDate: correctedDate.toISOString(),
                    timezone: webinarTimezone,
                    webinarLink: webinarLink || undefined,
                    replayLink: replayLink || undefined,
                    timing: showAdvancedTiming ? timing : undefined,
                  });
                  setShowGenerate(false);
                }}
              >
                {generateSeq.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                Generate 9 Messages
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: Campaign History with Delivery Tracking
// ═══════════════════════════════════════════════════════════════════════════

function CampaignHistory() {
  const [page, setPage] = useState(1);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const campaigns = trpc.webinarSms.listCampaigns.useQuery({ page, pageSize: 10 }, {
    refetchInterval: 5000, // Poll every 5s to catch background send progress
  });
  const campaignDetails = trpc.webinarSms.getCampaignDetails.useQuery(
    { id: selectedCampaignId! },
    { enabled: !!selectedCampaignId }
  );
  const cancelCampaign = trpc.webinarSms.cancelCampaign.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "Campaign stopped");
      campaigns.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const resendCampaign = trpc.webinarSms.resendCampaign.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || `Resending to ${data.totalRecipients} recipients`);
      campaigns.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber-600" />
          Campaign History
        </CardTitle>
        <CardDescription>
          {campaigns.data?.total ?? 0} campaigns sent
        </CardDescription>
      </CardHeader>
      <CardContent>
        {campaigns.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.data?.campaigns?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No campaigns sent yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.data?.campaigns?.map((c: any) => (
              <div
                key={c.id}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  c.id === selectedCampaignId ? "border-amber-300 bg-amber-50/30" : "border-border hover:border-amber-200"
                }`}
              >
                <button
                  className="w-full text-left"
                  onClick={() => setSelectedCampaignId(c.id === selectedCampaignId ? null : c.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{c.name}</p>
                      {/* Source badge to distinguish campaign origin */}
                      {c.name?.startsWith('[Sequence]') ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-300 text-purple-600 bg-purple-50">
                          <CalendarClock className="w-2.5 h-2.5 mr-0.5" /> Sequence
                        </Badge>
                      ) : c.name?.startsWith('[No-Show') ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600 bg-orange-50">
                          <Bell className="w-2.5 h-2.5 mr-0.5" /> Nudge
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600 bg-blue-50">
                          <Send className="w-2.5 h-2.5 mr-0.5" /> Quick Send
                        </Badge>
                      )}
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{formatDate(c.createdAt)}</span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      {c.sentCount ?? 0} sent
                    </span>
                    {(c.failedCount ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-red-500" />
                        {c.failedCount} failed
                      </span>
                    )}
                    <span>{c.totalRecipients ?? 0} recipients</span>
                  </div>

                  {/* Progress bar for sending campaigns */}
                  {c.status === "sending" && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round(((c.sentCount ?? 0) + (c.failedCount ?? 0)) / Math.max(c.totalRecipients ?? 1, 1) * 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground">
                          Sending... {(c.sentCount ?? 0) + (c.failedCount ?? 0)} / {c.totalRecipients ?? 0}
                        </p>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          disabled={cancelCampaign.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelCampaign.mutate({ campaignId: c.id });
                          }}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Stop
                        </Button>
                      </div>
                    </div>
                  )}
                </button>

                {/* Resend button for failed campaigns */}
                {(c.status === "failed" || (c.status === "completed" && (c.failedCount ?? 0) > 0)) && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                      disabled={resendCampaign.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        resendCampaign.mutate({ campaignId: c.id });
                      }}
                    >
                      {resendCampaign.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="w-3 h-3 mr-1" />
                      )}
                      Resend {c.failedCount ?? 0} Failed
                    </Button>
                  </div>
                )}

                {/* Expanded delivery details */}
                {c.id === selectedCampaignId && campaignDetails.data && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium mb-2">Delivery Details</p>
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      {campaignDetails.data.deliveries?.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between text-xs py-1">
                          <span className="text-muted-foreground">{formatPhone(d.phone)}</span>
                          <span className={d.deliveryStatus === "sent" ? "text-emerald-600" : d.deliveryStatus === "failed" ? "text-red-600" : "text-muted-foreground"}>
                            {d.deliveryStatus === "sent" ? "✓ Delivered" : d.deliveryStatus === "failed" ? `✗ ${d.error || 'Failed'}` : d.deliveryStatus}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            {(campaigns.data?.totalPages ?? 1) > 1 && (
              <div className="flex items-center justify-center gap-2 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {campaigns.data?.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= (campaigns.data?.totalPages ?? 1)}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5.5: Calendar Invite Panel
// ═══════════════════════════════════════════════════════════════════════════

function CalendarInvitePanel({ webinarId, scheduleDate }: { webinarId: string; scheduleDate: string | null }) {
  const calendarStatus = trpc.webinarSms.calendarStatus.useQuery();
  const calendarStats = trpc.webinarSms.calendarInviteStats.useQuery({ webinarId });
  const settings = trpc.webinarSms.getSettings.useQuery();
  const testConnection = trpc.webinarSms.testCalendarConnection.useMutation({
    onSuccess: (data) => toast[data.success ? "success" : "error"](data.message),
  });
  const sendBulk = trpc.webinarSms.sendBulkCalendarInvites.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      calendarStats.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const saveCalendarSettings = trpc.webinarSms.saveCalendarSettings.useMutation({
    onSuccess: () => {
      toast.success("Calendar settings saved");
      settings.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const sendReminder = trpc.webinarSms.sendCalendarReminder.useMutation({
    onSuccess: (data) => {
      toast[data.updated > 0 ? "success" : "error"](data.message);
    },
    onError: (err) => toast.error(err.message),
  });
  const icsFile = trpc.webinarSms.generateIcsFile.useQuery({ webinarId }, { enabled: !!webinarId });
  const gmailStatus = trpc.webinarSms.gmailStatus.useQuery();
  const sendGmailReminder = trpc.webinarSms.sendGmailReminder.useMutation({
    onSuccess: (data) => {
      toast[data.sent > 0 ? "success" : "error"](data.message);
      emailLog.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // Auto-reminder schedule
  const reminderSchedule = trpc.webinarSms.getReminderSchedule.useQuery(
    { webinarId },
    { enabled: !!webinarId }
  );
  const enableAutoReminders = trpc.webinarSms.enableAutoReminders.useMutation({
    onSuccess: (data) => {
      toast.success(data.enabled ? "Auto-reminders enabled" : "Auto-reminders disabled");
      reminderSchedule.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // Email send log
  const emailLog = trpc.webinarSms.getEmailLog.useQuery(
    { webinarId },
    { enabled: !!webinarId }
  );

  // Local state for settings form
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [inviteTime, setInviteTime] = useState(""); // HH:mm 24h format, empty = use WebinarJam default
  const [inviteTimezone, setInviteTimezone] = useState(""); // IANA timezone, empty = use WebinarJam default
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Sync settings from server when loaded
  useEffect(() => {
    if (settings.data && !settingsLoaded) {
      setEventName(settings.data.calendarEventName ?? "");
      setEventDescription(settings.data.calendarEventDescription ?? "");
      setInviteTime(settings.data.calendarInviteTime ?? "");
      setInviteTimezone(settings.data.calendarInviteTimezone ?? "");
      setSettingsLoaded(true);
    }
  }, [settings.data, settingsLoaded]);

  const handleSaveSettings = () => {
    saveCalendarSettings.mutate({
      calendarEventName: eventName,
      calendarEventDescription: eventDescription,
      calendarInviteTime: inviteTime,
      calendarInviteTimezone: inviteTimezone,
    });
  };

  const stats = calendarStats.data;
  const health = calendarStatus.data;
  const hasSettingsChanges = settingsLoaded && (
    eventName !== (settings.data?.calendarEventName ?? "") ||
    eventDescription !== (settings.data?.calendarEventDescription ?? "") ||
    inviteTime !== (settings.data?.calendarInviteTime ?? "") ||
    inviteTimezone !== (settings.data?.calendarInviteTimezone ?? "")
  );

  // Show "(Default)" label when using the system default values
  const isDefaultName = !eventName || eventName === settings.data?.calendarEventName;
  const isDefaultDesc = !eventDescription || eventDescription === settings.data?.calendarEventDescription;

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500" />
            Google Calendar Integration
          </CardTitle>
          <CardDescription>
            Automatically send Google Calendar invites when someone registers for your webinar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${health?.authenticated ? "bg-emerald-500" : health?.configured ? "bg-amber-500" : "bg-red-500"}`} />
              <div>
                <p className="text-sm font-medium">Google Calendar API</p>
                <p className="text-xs text-muted-foreground">
                  {health?.authenticated
                    ? `Connected as ${health.impersonateEmail}`
                    : health?.configured
                    ? `Configured but not authenticated: ${health.error || "Unknown error"}`
                    : "Service account not configured"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Send Settings */}
      {health?.authenticated && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Calendar Invite Settings
            </CardTitle>
            <CardDescription>
              Customize the calendar event name and description. Every registrant automatically gets an invite.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Auto-send always on indicator */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
              <div className="space-y-1">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Auto-send is always ON
                </p>
                <p className="text-xs text-muted-foreground">
                  Every new registrant with an email automatically gets a calendar invite when imported.
                </p>
              </div>
              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-700">
                Always On
              </Badge>
            </div>

            {/* Custom Event Name */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="calendar-event-name" className="text-sm font-medium">
                  Event Name
                </Label>
                {settingsLoaded && isDefaultName && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Default</span>
                )}
              </div>
              <Input
                id="calendar-event-name"
                placeholder="Enter a custom event name..."
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The name that appears on the registrant's calendar event. Clear to reset to default.
              </p>
            </div>

            {/* Custom Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="calendar-event-desc" className="text-sm font-medium">
                  Event Description
                </Label>
                {settingsLoaded && isDefaultDesc && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Default</span>
                )}
              </div>
              <Textarea
                id="calendar-event-desc"
                placeholder="Enter a custom event description..."
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Clear to reset to the default 5-Step System description.
              </p>
            </div>

            {/* Event Time Override */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="calendar-invite-time" className="text-sm font-medium">
                  Event Time
                </Label>
                {settingsLoaded && !inviteTime && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">From WebinarJam</span>
                )}
                {settingsLoaded && inviteTime && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-medium">Custom Override</span>
                )}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    id="calendar-invite-time"
                    type="time"
                    value={inviteTime}
                    onChange={(e) => setInviteTime(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="flex-[2]">
                  <select
                    value={inviteTimezone}
                    onChange={(e) => setInviteTimezone(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Use WebinarJam timezone</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="America/Anchorage">Alaska Time (AKT)</option>
                    <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Override the calendar invite time. Leave empty to use the time from your WebinarJam schedule.
                {inviteTime && inviteTimezone && (
                  <span className="block mt-1 text-amber-600 font-medium">
                    Calendar invites will show: {(() => {
                      const [h, m] = inviteTime.split(':').map(Number);
                      const ampm = h >= 12 ? 'PM' : 'AM';
                      const h12 = h % 12 || 12;
                      const tzLabel: Record<string, string> = {
                        'America/New_York': 'ET', 'America/Chicago': 'CT',
                        'America/Denver': 'MT', 'America/Los_Angeles': 'PT',
                        'America/Anchorage': 'AKT', 'Pacific/Honolulu': 'HT', 'UTC': 'UTC'
                      };
                      return `${h12}:${String(m).padStart(2, '0')} ${ampm} ${tzLabel[inviteTimezone] || inviteTimezone}`;
                    })()}
                  </span>
                )}
              </p>
            </div>

            {/* Join URL info */}
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Join URL:</span> Automatically pulled from your WebinarJam live room link. No configuration needed.
              </p>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSaveSettings}
                disabled={saveCalendarSettings.isPending || !hasSettingsChanges}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {saveCalendarSettings.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Calendar Settings</>
                )}
              </Button>

            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Stats & Actions */}
      {health?.authenticated && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calendar Invite Status</CardTitle>
            <CardDescription>
              Track and manually send calendar invites to registrants for this webinar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <p className="text-2xl font-bold">{stats?.total ?? "\u2014"}</p>
                <p className="text-xs text-muted-foreground">Total Registrants</p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <p className="text-2xl font-bold">{stats?.withEmail ?? "\u2014"}</p>
                <p className="text-xs text-muted-foreground">Have Email</p>
              </div>
              <div className="p-4 rounded-lg border bg-emerald-50 dark:bg-emerald-950/20">
                <p className="text-2xl font-bold text-emerald-600">{stats?.inviteSent ?? "\u2014"}</p>
                <p className="text-xs text-muted-foreground">Invites Sent</p>
              </div>
              <div className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-950/20">
                <p className="text-2xl font-bold text-amber-600">{stats?.invitePending ?? "\u2014"}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-950/20">
                <p className="text-2xl font-bold text-red-600">{stats?.inviteFailed ?? "\u2014"}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>

            {/* Send Bulk Button */}
            {(stats?.invitePending ?? 0) > 0 && (
              <div className="flex items-center justify-between p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                <div>
                  <p className="text-sm font-medium">
                    {stats!.invitePending} registrant{stats!.invitePending !== 1 ? "s" : ""} pending calendar invite
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Only registrants with email addresses will receive invites.
                  </p>
                </div>
                <Button
                  onClick={() => sendBulk.mutate({ webinarId, onlyUnsent: true })}
                  disabled={sendBulk.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {sendBulk.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending...</>
                  ) : (
                    <><Calendar className="w-4 h-4 mr-2" /> Send All Invites</>
                  )}
                </Button>
              </div>
            )}

            {(stats?.invitePending ?? 0) === 0 && (stats?.inviteSent ?? 0) > 0 && (
              <div className="flex items-center gap-3 p-4 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">All invites sent!</p>
                  <p className="text-xs text-muted-foreground">
                    All {stats!.inviteSent} registrants with email addresses have received calendar invites.
                  </p>
                </div>
              </div>
            )}

            {/* Failed Invites - Manual Follow-up Section */}
            {(stats?.inviteFailed ?? 0) > 0 && stats?.failedRegistrants && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      {stats.inviteFailed} invite{stats.inviteFailed !== 1 ? "s" : ""} failed — needs manual follow-up
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-100"
                    onClick={() => {
                      if (confirm(`Retry sending calendar invites to ${stats.inviteFailed} failed registrant${stats.inviteFailed !== 1 ? "s" : ""}?`)) {
                        sendBulk.mutate({ webinarId, onlyUnsent: false });
                      }
                    }}
                    disabled={sendBulk.isPending}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Retry Failed
                  </Button>
                </div>
                <div className="px-4 pb-4">
                  <div className="rounded border bg-white dark:bg-zinc-900 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-2 font-medium">Name</th>
                          <th className="text-left p-2 font-medium">Email</th>
                          <th className="text-left p-2 font-medium">Error</th>
                          <th className="text-left p-2 font-medium">Last Attempt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.failedRegistrants.map((r: any) => (
                          <tr key={r.id} className="border-b last:border-0">
                            <td className="p-2">{r.name}</td>
                            <td className="p-2 text-muted-foreground">{r.email}</td>
                            <td className="p-2 text-red-600 max-w-[200px] truncate" title={r.error}>{r.error}</td>
                            <td className="p-2 text-muted-foreground">
                              {r.lastAttempt ? new Date(r.lastAttempt).toLocaleString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Re-send all option */}
            {(stats?.inviteSent ?? 0) > 0 && (
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm(`This will re-send calendar invites to ALL ${stats!.withEmail} registrants with email, including those who already received one. Continue?`)) {
                      sendBulk.mutate({ webinarId, onlyUnsent: false });
                    }
                  }}
                  disabled={sendBulk.isPending}
                >
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Re-send All Invites
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* Show Rate Boosters */}
      {/* Auto-Reminder Schedule */}
      {health?.authenticated && scheduleDate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-500" />
              Automated Reminder Schedule
            </CardTitle>
            <CardDescription>
              Calendar updates + Gmail reminders fire automatically alongside your scheduled SMS messages. When "Day Before Reminder", "1 Hour Warning", or "Starting NOW" SMS fires, the matching calendar update and Gmail reminder fire too.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Multi-Channel Tracking</p>
                <p className="text-xs text-muted-foreground">
                  {scheduleDate ? `Webinar: ${new Date(scheduleDate).toLocaleString()}` : "No schedule date selected"}
                  {" "}&mdash; Tracks Calendar + Gmail delivery alongside SMS
                </p>
              </div>
              <Button
                variant={reminderSchedule.data?.enabled ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  enableAutoReminders.mutate({
                    webinarId,
                    webinarStartTime: scheduleDate!,
                    enabled: !reminderSchedule.data?.enabled,
                    webinarName: settings.data?.calendarEventName || undefined,
                    joinUrl: undefined,
                  });
                }}
                disabled={enableAutoReminders.isPending || !scheduleDate}
                className={reminderSchedule.data?.enabled ? "bg-violet-600 hover:bg-violet-700" : ""}
              >
                {enableAutoReminders.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : reminderSchedule.data?.enabled ? (
                  "Enabled \u2713"
                ) : (
                  "Enable"
                )}
              </Button>
            </div>

            {/* Schedule Status */}
            {reminderSchedule.data && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reminder Status</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["24h", "1h", "starting"] as const).map((type) => {
                    const statusKey = type === "24h" ? "reminder24h" : type === "1h" ? "reminder1h" : "reminderStarting";
                    const timeKey = type === "24h" ? "reminder24hAt" : type === "1h" ? "reminder1hAt" : "reminderStartingAt";
                    const resultKey = type === "24h" ? "reminder24hResult" : type === "1h" ? "reminder1hResult" : "reminderStartingResult";
                    const status = reminderSchedule.data?.[statusKey] || "pending";
                    const sentAt = reminderSchedule.data?.[timeKey];
                    const result = reminderSchedule.data?.[resultKey];
                    const label = type === "24h" ? "24 Hour" : type === "1h" ? "1 Hour" : "Live Now";

                    return (
                      <div key={type} className={`p-2 rounded-lg border text-center ${
                        status === "sent" ? "bg-green-50 border-green-200" :
                        status === "failed" ? "bg-red-50 border-red-200" :
                        "bg-gray-50 border-gray-200"
                      }`}>
                        <p className="text-xs font-medium">{label}</p>
                        <p className={`text-[10px] mt-1 ${
                          status === "sent" ? "text-green-600" :
                          status === "failed" ? "text-red-600" :
                          "text-gray-500"
                        }`}>
                          {status === "sent" ? "\u2713 Sent" : status === "failed" ? "\u2717 Failed" : "\u23f3 Pending"}
                        </p>
                        {sentAt && (
                          <p className="text-[9px] text-muted-foreground mt-0.5">
                            {new Date(sentAt).toLocaleTimeString()}
                          </p>
                        )}
                        {result && status === "failed" && (
                          <p className="text-[9px] text-red-500 mt-0.5 truncate" title={result}>{result}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Show Rate Boosters (Manual) */}
      {health?.authenticated && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              Show Rate Boosters (Manual)
            </CardTitle>
            <CardDescription>
              Manual overrides — use these if you need to send reminders outside the SMS schedule, or to test before the webinar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Calendar Reminder Updates */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Send Calendar Reminder Updates</p>
              <p className="text-xs text-muted-foreground">
                Updates the calendar event description and triggers Google to send a notification email to every attendee. 
                Use these before the webinar to remind people to show up.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("Send a 24-hour reminder update to all calendar events for this webinar? Google will email all attendees.")) {
                      sendReminder.mutate({ webinarId, reminderType: "24h" });
                    }
                  }}
                  disabled={sendReminder.isPending}
                  className="border-amber-300 hover:bg-amber-50"
                >
                  {sendReminder.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                  24h Reminder
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("Send a 1-hour reminder update to all calendar events? Google will email all attendees.")) {
                      sendReminder.mutate({ webinarId, reminderType: "1h" });
                    }
                  }}
                  disabled={sendReminder.isPending}
                  className="border-orange-300 hover:bg-orange-50"
                >
                  {sendReminder.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Timer className="w-3 h-3 mr-1" />}
                  1h Reminder
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("Send a 'LIVE NOW' update to all calendar events? Google will email all attendees.")) {
                      sendReminder.mutate({ webinarId, reminderType: "starting" });
                    }
                  }}
                  disabled={sendReminder.isPending}
                  className="border-emerald-300 hover:bg-emerald-50"
                >
                  {sendReminder.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                  Live Now!
                </Button>
              </div>
            </div>

            {/* ICS File Download */}
            <div className="pt-4 border-t space-y-3">
              <p className="text-sm font-medium">ICS Calendar File</p>
              <p className="text-xs text-muted-foreground">
                Download an .ics file for this webinar event. Share this link with registrants who don't use Google Calendar 
                (Apple Calendar, Outlook, etc.). The file includes built-in reminders at 24h, 1h, and 10 minutes before.
              </p>
              {icsFile.data ? (
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob([icsFile.data.icsContent], { type: "text/calendar" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = icsFile.data.filename;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success("ICS file downloaded!");
                    }}
                  >
                    <Download className="w-3 h-3 mr-1" /> Download .ics File
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {icsFile.data.eventName} • {new Date(icsFile.data.startTime).toLocaleDateString()}
                  </span>
                </div>
              ) : icsFile.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Generating ICS file...
                </div>
              ) : icsFile.error ? (
                <p className="text-xs text-red-500">Could not generate ICS file: {icsFile.error.message}</p>
              ) : null}
            </div>

            {/* Gmail Reminder Emails */}
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" />
                <p className="text-sm font-medium">Gmail Reminder Emails</p>
                {gmailStatus.data?.authorized ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Connected</span>
                ) : gmailStatus.data?.configured ? (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Not Authorized</span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Not Configured</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Send personalized reminder emails directly from {gmailStatus.data?.senderEmail || "support@coachinayah.com"} via Gmail API. 
                Higher deliverability than third-party email services because emails come from your real Google Workspace account.
              </p>
              {gmailStatus.data?.authorized ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Send a 24-hour reminder email to ALL registrants with email? This sends from your Gmail.")) {
                        sendGmailReminder.mutate({ webinarId, reminderType: "24h" });
                      }
                    }}
                    disabled={sendGmailReminder.isPending}
                    className="border-blue-300 hover:bg-blue-50"
                  >
                    {sendGmailReminder.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
                    Email: 24h Reminder
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Send a 1-hour reminder email to ALL registrants? This sends from your Gmail.")) {
                        sendGmailReminder.mutate({ webinarId, reminderType: "1h" });
                      }
                    }}
                    disabled={sendGmailReminder.isPending}
                    className="border-blue-300 hover:bg-blue-50"
                  >
                    {sendGmailReminder.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
                    Email: 1h Reminder
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Send a 'LIVE NOW' email to ALL registrants? This sends from your Gmail.")) {
                        sendGmailReminder.mutate({ webinarId, reminderType: "starting" });
                      }
                    }}
                    disabled={sendGmailReminder.isPending}
                    className="border-emerald-300 hover:bg-emerald-50"
                  >
                    {sendGmailReminder.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                    Email: Live Now!
                  </Button>
                </div>
              ) : gmailStatus.data?.error ? (
                <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
                  <p className="font-medium mb-1">Gmail API not authorized</p>
                  <p>Add the Gmail send scope to your service account's domain-wide delegation:</p>
                  <code className="block mt-1 text-[10px] bg-white p-1 rounded">https://www.googleapis.com/auth/gmail.send</code>
                  <p className="mt-1 text-[10px] text-amber-500">Error: {gmailStatus.data.error}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Checking Gmail status...</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Send Log */}
      {health?.authenticated && emailLog.data && emailLog.data.logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-500" />
              Email & Calendar Send Log
            </CardTitle>
            <CardDescription>
              History of all reminder emails and calendar updates sent for this webinar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <p className="text-lg font-bold text-blue-700">{emailLog.data.stats.total}</p>
                <p className="text-[10px] text-blue-600">Total Sent</p>
              </div>
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <p className="text-lg font-bold text-green-700">{emailLog.data.stats.sent}</p>
                <p className="text-[10px] text-green-600">Delivered</p>
              </div>
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <p className="text-lg font-bold text-red-700">{emailLog.data.stats.failed}</p>
                <p className="text-[10px] text-red-600">Failed</p>
              </div>
            </div>

            {/* Channel Breakdown */}
            {Object.keys(emailLog.data.stats.byChannel).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">By Channel</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(emailLog.data.stats.byChannel).map(([channel, counts]) => (
                    <div key={channel} className="text-xs px-2 py-1 rounded-full bg-gray-100">
                      <span className="font-medium">{channel === "gmail" ? "Gmail" : "Calendar"}</span>: {(counts as any).sent} sent, {(counts as any).failed} failed
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Type Breakdown */}
            {Object.keys(emailLog.data.stats.byType).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">By Reminder Type</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(emailLog.data.stats.byType).map(([type, counts]) => (
                    <div key={type} className="text-xs px-2 py-1 rounded-full bg-gray-100">
                      <span className="font-medium">{type.replace("reminder_", "").toUpperCase()}</span>: {(counts as any).sent} sent, {(counts as any).failed} failed
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Log Table */}
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left py-1 px-2">Recipient</th>
                    <th className="text-left py-1 px-2">Type</th>
                    <th className="text-left py-1 px-2">Channel</th>
                    <th className="text-left py-1 px-2">Status</th>
                    <th className="text-left py-1 px-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLog.data.logs.slice(0, 50).map((log) => (
                    <tr key={log.id} className="border-b border-dashed">
                      <td className="py-1 px-2">
                        <span className="font-medium">{log.recipientName || "—"}</span>
                        <br />
                        <span className="text-muted-foreground">{log.recipientEmail}</span>
                      </td>
                      <td className="py-1 px-2">{log.emailType.replace("reminder_", "")}</td>
                      <td className="py-1 px-2">
                        <span className={`px-1.5 py-0.5 rounded-full ${log.channel === "gmail" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                          {log.channel === "gmail" ? "Gmail" : "Calendar"}
                        </span>
                      </td>
                      <td className="py-1 px-2">
                        <span className={log.status === "sent" ? "text-green-600" : "text-red-600"}>
                          {log.status === "sent" ? "\u2713" : "\u2717"} {log.status}
                        </span>
                        {log.errorMessage && (
                          <p className="text-[9px] text-red-500 truncate max-w-[120px]" title={log.errorMessage}>{log.errorMessage}</p>
                        )}
                      </td>
                      <td className="py-1 px-2 text-muted-foreground">
                        {log.sentAt ? new Date(log.sentAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SECTION 6: Settings Panel
// ═══════════════════════════════════════════════════════════════════════════

function SettingsPanel({ webinarId }: { webinarId: string }) {
  const settings = trpc.webinarSms.getSettings.useQuery();
  const apiStatus = trpc.webinarSms.getApiStatus.useQuery();
  const testWJ = trpc.webinarSms.testWebinarJamConnection.useMutation({
    onSuccess: (data) => toast[data.success ? "success" : "error"](data.message),
  });
  const testST = trpc.webinarSms.testSimpleTextingConnection.useMutation({
    onSuccess: (data) => toast[data.success ? "success" : "error"](data.message),
  });
  const saveCron = trpc.webinarSms.saveCronConfig.useMutation({
    onSuccess: () => {
      toast.success("Cron settings saved");
      settings.refetch();
    },
  });

  const [cronEnabled, setCronEnabled] = useState(false);
  const [cronInterval, setCronInterval] = useState("30");

  useEffect(() => {
    if (settings.data) {
      setCronEnabled(settings.data.cronEnabled);
      setCronInterval(String(settings.data.cronIntervalMinutes));
    }
  }, [settings.data]);

  return (
    <div className="space-y-6">
      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Connections</CardTitle>
          <CardDescription>Both API keys are configured as environment variables and locked in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${apiStatus.data?.webinarjam?.configured ? "bg-emerald-500" : "bg-red-500"}`} />
              <div>
                <p className="text-sm font-medium">WebinarJam API</p>
                <p className="text-xs text-muted-foreground">
                  {apiStatus.data?.webinarjam?.configured ? `Key: ${apiStatus.data.webinarjam.keyPreview}` : "Not configured"}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => testWJ.mutate()} disabled={testWJ.isPending}>
              {testWJ.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test"}
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${apiStatus.data?.simpletexting?.configured ? "bg-emerald-500" : "bg-red-500"}`} />
              <div>
                <p className="text-sm font-medium">SimpleTexting API</p>
                <p className="text-xs text-muted-foreground">
                  {apiStatus.data?.simpletexting?.configured ? `Key: ${apiStatus.data.simpletexting.keyPreview}` : "Not configured"}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => testST.mutate()} disabled={testST.isPending}>
              {testST.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Import Cron */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto-Import Schedule</CardTitle>
          <CardDescription>Automatically pull new registrants from WebinarJam on a schedule.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Enable auto-import</label>
            <button
              onClick={() => setCronEnabled(!cronEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${cronEnabled ? "bg-amber-500" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${cronEnabled ? "translate-x-5" : ""}`} />
            </button>
          </div>
          {cronEnabled && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground">Import every</label>
              <Select value={cronInterval} onValueChange={setCronInterval}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="360">6 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => saveCron.mutate({ enabled: cronEnabled, intervalMinutes: parseInt(cronInterval) })}
            disabled={saveCron.isPending}
          >
            {saveCron.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
            Save Cron Settings
          </Button>
          {settings.data?.lastAutoImportAt && (
            <p className="text-xs text-muted-foreground">
              Last import: {formatDate(settings.data.lastAutoImportAt)}
              {settings.data.lastAutoImportResult && ` — ${settings.data.lastAutoImportResult}`}
            </p>
          )}
        </CardContent>
      </Card>
      {/* Transcript Upload */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Webinar Transcript
          </CardTitle>
          <CardDescription>Upload the transcript so the AI composer can reference actual webinar content</CardDescription>
        </CardHeader>
        <CardContent>
          <TranscriptUploader webinarId={webinarId} />
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: Transcript Uploader
// ═══════════════════════════════════════════════════════════════════════════

function TranscriptUploader({ webinarId }: { webinarId: string }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [transcript, setTranscript] = useState("");
  const [loaded, setLoaded] = useState(false);

  const existing = trpc.webinarSms.getTranscript.useQuery(
    { webinarId },
    { enabled: !!webinarId }
  );

  const save = trpc.webinarSms.saveTranscript.useMutation({
    onSuccess: () => {
      toast.success("Transcript saved");
      existing.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (existing.data && !loaded) {
      setTitle(existing.data.webinarTitle || "");
      setSummary(existing.data.keySummary || "");
      setTranscript(existing.data.transcript || "");
      setLoaded(true);
    }
  }, [existing.data, loaded]);

  // Reset when webinarId changes
  useEffect(() => {
    setLoaded(false);
    setTitle("");
    setSummary("");
    setTranscript("");
  }, [webinarId]);

  return (
    <div className="space-y-4">
      {existing.data && (
        <Badge variant="outline" className="text-green-600 border-green-600/30">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Transcript saved ({existing.data.transcript.length.toLocaleString()} chars)
        </Badge>
      )}
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-1 block">Webinar Title</label>
        <Input
          placeholder="e.g., 5 Steps to Get Your First Yes"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-1 block">Key Summary (optional — helps AI focus)</label>
        <Textarea
          placeholder="Brief summary of key topics covered..."
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-1 block">Full Transcript</label>
        <Textarea
          placeholder="Paste the full webinar transcript here..."
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={8}
          className="font-mono text-xs"
        />
      </div>
      <Button
        onClick={() => save.mutate({ webinarId, webinarTitle: title || undefined, keySummary: summary || undefined, transcript })}
        disabled={!transcript || save.isPending}
      >
        {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
        Save Transcript
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: Email No-Shows (HubSpot Integration)
// ═══════════════════════════════════════════════════════════════════════════

function EmailNoShows({ webinarId }: { webinarId: string }) {
  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [step, setStep] = useState<"compose" | "review" | "sending" | "done">("compose");
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const compose = trpc.webinarSms.composeEmail.useMutation({
    onSuccess: (data) => {
      setSubject(data.subject);
      setBody(data.body);
      setStep("review");
    },
    onError: (err) => toast.error(err.message),
  });

  const sendEmails = trpc.webinarSms.emailNoShows.useMutation({
    onSuccess: (data) => {
      setSendResult({ sent: data.sent, failed: data.failed, total: data.total ?? 0 });
      setStep("done");
      toast.success(`Sent ${data.sent} emails`);
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("review");
    },
  });

  const handleCompose = () => {
    if (!prompt.trim()) return;
    compose.mutate({ prompt, webinarId });
  };

  const handleSend = () => {
    if (!subject || !body) return;
    setStep("sending");
    sendEmails.mutate({ webinarId, subject, body });
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-500" />
            Email No-Shows via HubSpot
          </CardTitle>
          <CardDescription>
            Use AI to compose a follow-up email, then send it to all no-shows with one click via HubSpot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "compose" && (
            <>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">What do you want to say?</label>
                <Textarea
                  placeholder='e.g., "Hey, you missed the class but I have the replay ready for you. Let them know the key topics we covered and why they should watch it."'
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                />
              </div>
              <Button onClick={handleCompose} disabled={!prompt.trim() || compose.isPending}>
                {compose.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Compose Email with AI
              </Button>
            </>
          )}

          {step === "review" && (
            <>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Subject Line</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Email Body</label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">Variables: %FIRST_NAME%, %FULL_NAME%, %EMAIL%</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSend} disabled={sendEmails.isPending}>
                  <Send className="w-4 h-4 mr-2" />
                  Send to All No-Shows
                </Button>
                <Button variant="outline" onClick={() => setStep("compose")}>
                  Back to Compose
                </Button>
              </div>
            </>
          )}

          {step === "sending" && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span className="text-muted-foreground">Sending emails via HubSpot...</span>
            </div>
          )}

          {step === "done" && sendResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Emails sent successfully</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-green-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{sendResult.sent}</div>
                  <div className="text-xs text-muted-foreground">Sent</div>
                </div>
                <div className="text-center p-3 bg-red-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{sendResult.failed}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
                <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{sendResult.total}</div>
                  <div className="text-xs text-muted-foreground">Total No-Shows</div>
                </div>
              </div>
              <Button variant="outline" onClick={() => { setStep("compose"); setPrompt(""); setSubject(""); setBody(""); setSendResult(null); }}>
                Compose Another Email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: SMS Replies Inbox
// ═══════════════════════════════════════════════════════════════════════════

function RepliesInbox() {
  const [page, setPage] = useState(0);
  const replies = trpc.webinarSms.getIncomingReplies.useQuery(
    { page, pageSize: 20 },
    { refetchInterval: 15000 } // Poll every 15s for new replies
  );

  const replyList = replies.data?.replies ?? [];
  const totalPages = replies.data?.totalPages ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5 text-blue-600" />
              SMS Replies
            </CardTitle>
            <CardDescription>
              Incoming messages from your contacts
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => replies.refetch()}
            disabled={replies.isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${replies.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {replies.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : replyList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No incoming replies yet.</p>
            <p className="text-xs mt-1">Replies will appear here when contacts respond to your SMS campaigns.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {replyList.map((reply) => (
              <div
                key={reply.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium">
                      {reply.registrantName || formatPhoneDisplay(reply.phone)}
                    </p>
                    {reply.registrantName && (
                      <span className="text-xs text-muted-foreground">
                        {formatPhoneDisplay(reply.phone)}
                      </span>
                    )}
                    {reply.webinarName && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {reply.webinarName}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground">{reply.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(reply.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatPhoneDisplay(phone: string): string {
  const clean = phone.replace(/[^\d]/g, "");
  if (clean.length === 10) {
    return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  if (clean.length === 11 && clean.startsWith("1")) {
    return `(${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`;
  }
  return phone;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: Live No-Show Nudge
// ═══════════════════════════════════════════════════════════════════════════

function NoShowNudge({ webinarId, scheduleDate }: { webinarId: string; scheduleDate: string | null }) {
  const [showDialog, setShowDialog] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState(
    `Hey %FIRST_NAME%! We started without you \u2014 jump in now before you miss the good stuff! \ud83d\udd25 Join here: [WEBINAR_LINK]`
  );
  const sendNudge = trpc.webinarSms.sendNoShowNudge.useMutation({
    onSuccess: (data) => {
      toast.success(`Nudge sent to ${data.sent} registrants${data.failed > 0 ? ` (${data.failed} failed)` : ""}`);
      setShowDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });
  const summary = trpc.webinarSms.getAttendanceSummary.useQuery({ webinarId });

  // Live-updating clock so webinarIsLive re-evaluates every 30 seconds
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Determine if webinar has been live for 10+ minutes
  // scheduleDate may be "2026-03-01 19:00" (no timezone) — treat as UTC to be safe
  const webinarStart = scheduleDate
    ? new Date(scheduleDate.includes('T') || scheduleDate.includes('Z') ? scheduleDate : scheduleDate.replace(' ', 'T') + 'Z')
    : null;
  const webinarIsLive = webinarStart
    ? now.getTime() >= webinarStart.getTime() + 10 * 60 * 1000 // At least 10 min in (no upper bound)
    : false;

  const minutesIn = webinarStart
    ? Math.floor((now.getTime() - webinarStart.getTime()) / (60 * 1000))
    : 0;

  const noShowCount = (summary.data?.total ?? 0) - (summary.data?.attended ?? 0) - (summary.data?.optedOut ?? 0);

  return (
    <>
      <Card className={`border-2 ${webinarIsLive ? "border-red-200 bg-red-50/30" : "border-dashed border-muted"}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${webinarIsLive ? "bg-red-100" : "bg-muted"}`}>
                <Bell className={`w-5 h-5 ${webinarIsLive ? "text-red-600" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  No-Show Nudge
                  {webinarIsLive && (
                    <Badge className="bg-red-600 text-white text-[10px] animate-pulse">
                      LIVE \u2022 {minutesIn}min in
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {webinarIsLive
                    ? `${noShowCount} registrants haven't joined yet`
                    : scheduleDate
                      ? `Available once webinar is 10+ minutes in`
                      : "Set a webinar schedule date first"}
                </p>
              </div>
            </div>
            <Button
              variant={webinarIsLive ? "destructive" : "outline"}
              size="sm"
              disabled={!webinarIsLive || noShowCount === 0}
              onClick={() => setShowDialog(true)}
            >
              <Send className="w-4 h-4 mr-2" />
              Nudge No-Shows ({noShowCount})
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-red-600" />
              Send No-Show Nudge
            </DialogTitle>
            <DialogDescription>
              This will text {noShowCount} registrants who haven't attended yet. The webinar is {minutesIn} minutes in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nudge Message</label>
              <Textarea
                value={nudgeMessage}
                onChange={(e) => setNudgeMessage(e.target.value)}
                rows={4}
                placeholder="Hey %FIRST_NAME%! We started without you..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use %FIRST_NAME% for personalization. Replace [WEBINAR_LINK] with your actual link.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!nudgeMessage.trim() || sendNudge.isPending}
              onClick={() => sendNudge.mutate({ webinarId, message: nudgeMessage })}
            >
              {sendNudge.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send to {noShowCount} No-Shows
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function WebinarCampaignManager() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const settings = trpc.webinarSms.getSettings.useQuery(undefined, { enabled: isAuthenticated });
  const [activeTab, setActiveTab] = useState("dashboard");

  // Auth guard
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    window.location.href = getLoginUrl();
    return null;
  }

  // Admin check
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-sm text-muted-foreground">This page is only available to administrators.</p>
            <Link href="/">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedWebinarId = settings.data?.selectedWebinarId ?? null;
  const selectedWebinarName = settings.data?.selectedWebinarName ?? null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation bar */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Admin
              </Button>
            </Link>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-amber-600" />
              <h1 className="text-lg font-semibold font-display">Webinar Campaign Manager</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Webinar selector header */}
        <WebinarHeader
          selectedWebinarId={selectedWebinarId}
          selectedWebinarName={selectedWebinarName}
          onWebinarChange={() => settings.refetch()}
        />

        {!selectedWebinarId ? (
          <Card className="py-16">
            <CardContent className="text-center">
              <Radio className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Select a Webinar to Get Started</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Choose the webinar you want to manage. You'll be able to import registrants, track attendance, and send SMS follow-ups.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-8 w-full max-w-4xl">
              <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Audience</span>
              </TabsTrigger>
              <TabsTrigger value="send" className="flex items-center gap-1.5">
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </TabsTrigger>
              <TabsTrigger value="sequence" className="flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4" />
                <span className="hidden sm:inline">Sequence</span>
              </TabsTrigger>
              <TabsTrigger value="replies" className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Replies</span>
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-1.5">
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">Email</span>
              </TabsTrigger>
              <TabsTrigger value="live" className="flex items-center gap-1.5">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Live</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Calendar</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-1.5">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-6">
              <AttendanceDashboard webinarId={selectedWebinarId} scheduleDate={settings.data?.selectedScheduleDate || null} />
            </TabsContent>

            <TabsContent value="send" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <QuickSend webinarId={selectedWebinarId} webinarName={selectedWebinarName} />
                <CampaignHistory />
              </div>
            </TabsContent>

            <TabsContent value="sequence" className="mt-6">
              <SequenceBuilder webinarId={selectedWebinarId} />
            </TabsContent>

            <TabsContent value="replies" className="mt-6">
              <RepliesInbox />
            </TabsContent>

            <TabsContent value="email" className="mt-6">
              <EmailNoShows webinarId={selectedWebinarId} />
            </TabsContent>

            <TabsContent value="live" className="mt-6">
              <NoShowNudge webinarId={selectedWebinarId} scheduleDate={settings.data?.selectedScheduleDate || null} />
            </TabsContent>

            <TabsContent value="calendar" className="mt-6">
              <CalendarInvitePanel webinarId={selectedWebinarId} scheduleDate={settings.data?.selectedScheduleDate || null} />
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <SettingsPanel webinarId={selectedWebinarId} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
