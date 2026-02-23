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
} from "lucide-react";
import { Link } from "wouter";

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
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
      toast.success("Webinar selected");
      settings.refetch();
      onWebinarChange();
    },
  });

  const [showSelector, setShowSelector] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState("");
  const [webinarApiKey, setWebinarApiKey] = useState("");
  const [webinarHash, setWebinarHash] = useState("");

  // Pre-fill from saved settings when dialog opens
  useEffect(() => {
    if (showSelector && settings.data) {
      setWebinarApiKey(settings.data.webinarApiKey || "");
      setWebinarHash(settings.data.webinarHash || "");
      if (selectedWebinarId) setSelectedId(selectedWebinarId);
    }
  }, [showSelector, settings.data]);

  const selectedWebinar = webinars.data?.webinars?.find((w: any) => w.id === selectedId) as any;

  return (
    <div className="space-y-4">
      {/* Top bar: API status indicators */}
      <div className="flex items-center gap-4 text-sm">
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Webinar</DialogTitle>
            <DialogDescription>Choose the webinar you want to manage SMS campaigns for.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedId} onValueChange={setSelectedId}>
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

            {/* Per-webinar API credentials */}
            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-medium text-foreground mb-1">Webinar API Credentials</p>
              <p className="text-xs text-muted-foreground mb-3">
                Found in WebinarJam → Configuration → Advanced Integration → API custom integration
              </p>
              <div className="space-y-3">
                <div>
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
                saveSelection.mutate({
                  webinarId: selectedId,
                  webinarName: webinar.name,
                  scheduleId: selectedSchedule && selectedSchedule !== "none" ? selectedSchedule : undefined,
                  webinarApiKey: webinarApiKey || undefined,
                  webinarHash: webinarHash || undefined,
                });
                setShowSelector(false);
              }}
            >
              {saveSelection.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Select
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

function AttendanceDashboard({ webinarId }: { webinarId: string }) {
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <UserX className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{summary.data?.noShow ?? "—"}</p>
                <p className="text-xs text-muted-foreground">No-Shows</p>
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
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => triggerImport.mutate()}
          disabled={triggerImport.isPending}
        >
          {triggerImport.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
          Import Registrants
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
                    {r.email && <Mail className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />}
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
                <UserX className="w-5 h-5 text-amber-600" />
                <CardTitle className="text-base">No-Shows</CardTitle>
                <Badge variant="secondary" className="ml-1">{noShows.data?.total ?? 0}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {noShows.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : noShows.data?.registrants?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No no-shows recorded yet.</p>
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
                    {r.email && <Mail className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: Quick Send — One-Click Audience Texting
// ═══════════════════════════════════════════════════════════════════════════

function QuickSend({ webinarId }: { webinarId: string }) {
  const [audience, setAudience] = useState<"all" | "attended" | "not_attended">("all");
  const [message, setMessage] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const summary = trpc.webinarSms.getAttendanceSummary.useQuery({ webinarId });
  const templates = trpc.webinarSms.listTemplates.useQuery();
  const sendCampaign = trpc.webinarSms.sendCampaign.useMutation({
    onSuccess: (data) => {
      toast.success(`Campaign sent! ${data.sent} delivered, ${data.failed} failed.`);
      setMessage("");
      setCampaignName("");
      setShowConfirm(false);
    },
    onError: (err) => toast.error(err.message),
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
        webinarId,
        attended: audience === "attended" ? 1 : audience === "not_attended" ? 0 : undefined,
      },
    });
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

        {/* Message composer */}
        <div className="space-y-2">
          <Textarea
            placeholder="Type your message... Use %FIRST_NAME% for personalization"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={320}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Variables: %FIRST_NAME%, %FULL_NAME%, %EMAIL%</span>
            <span>{message.length}/320</span>
          </div>
        </div>

        {/* Send button */}
        <Button
          className="w-full"
          size="lg"
          disabled={!message.trim() || !campaignName.trim() || recipientCount === 0 || sendCampaign.isPending}
          onClick={() => setShowConfirm(true)}
        >
          {sendCampaign.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Send to {recipientCount} {audience === "attended" ? "Attendees" : audience === "not_attended" ? "No-Shows" : "Registrants"}
        </Button>

        {/* Confirmation dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Send</DialogTitle>
              <DialogDescription>
                You're about to send an SMS to <strong>{recipientCount}</strong> {audience === "attended" ? "attendees" : audience === "not_attended" ? "no-shows" : "registrants"}.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap">{message}</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button onClick={handleSend} disabled={sendCampaign.isPending}>
                {sendCampaign.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
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

  const [showGenerate, setShowGenerate] = useState(false);
  const [webinarDate, setWebinarDate] = useState("");
  const [webinarLink, setWebinarLink] = useState("");
  const [replayLink, setReplayLink] = useState("");

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
                : "Set up a pre-built 9-message sequence for your webinar"}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowGenerate(true)}>
            <Zap className="w-4 h-4 mr-2" />
            {messages.length > 0 ? "Regenerate" : "Generate Sequence"}
          </Button>
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
                  <p className="text-xs text-muted-foreground mb-1 line-clamp-2">{msg.messageBody}</p>
                  <p className="text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatDate(msg.scheduledAt)}
                    {msg.sentCount > 0 && (
                      <span className="ml-2">
                        • {msg.sentCount} sent {msg.failedCount > 0 && `• ${msg.failedCount} failed`}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
              <Button
                disabled={!webinarDate || generateSeq.isPending}
                onClick={() => {
                  generateSeq.mutate({
                    webinarId,
                    webinarDate: new Date(webinarDate).toISOString(),
                    webinarLink: webinarLink || undefined,
                    replayLink: replayLink || undefined,
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
  const campaigns = trpc.webinarSms.listCampaigns.useQuery({ page, pageSize: 10 });
  const campaignDetails = trpc.webinarSms.getCampaignDetails.useQuery(
    { id: selectedCampaignId! },
    { enabled: !!selectedCampaignId }
  );

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
              <button
                key={c.id}
                onClick={() => setSelectedCampaignId(c.id === selectedCampaignId ? null : c.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  c.id === selectedCampaignId ? "border-amber-300 bg-amber-50/30" : "border-border hover:border-amber-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{c.name}</p>
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

                {/* Expanded delivery details */}
                {c.id === selectedCampaignId && campaignDetails.data && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium mb-2">Delivery Details</p>
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      {campaignDetails.data.deliveries?.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between text-xs py-1">
                          <span className="text-muted-foreground">{formatPhone(d.phone)}</span>
                          <span className={d.deliveryStatus === "sent" ? "text-emerald-600" : d.deliveryStatus === "failed" ? "text-red-600" : "text-muted-foreground"}>
                            {d.deliveryStatus === "sent" ? "✓ Delivered" : d.deliveryStatus === "failed" ? "✗ Failed" : d.deliveryStatus}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </button>
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
// SECTION 6: Settings Panel
// ═══════════════════════════════════════════════════════════════════════════

function SettingsPanel() {
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
    </div>
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
            <TabsList className="grid grid-cols-4 w-full max-w-lg">
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
              <TabsTrigger value="settings" className="flex items-center gap-1.5">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-6">
              <AttendanceDashboard webinarId={selectedWebinarId} />
            </TabsContent>

            <TabsContent value="send" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <QuickSend webinarId={selectedWebinarId} />
                <CampaignHistory />
              </div>
            </TabsContent>

            <TabsContent value="sequence" className="mt-6">
              <SequenceBuilder webinarId={selectedWebinarId} />
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <SettingsPanel />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
