/**
 * Promo Campaign Manager — Standalone Admin Page
 *
 * Manages promo drip campaigns (email via HubSpot SMTP + SMS via
 * SimpleTexting) sent to a frozen snapshot of a HubSpot list, with
 * upcoming-webinar exclusions applied at snapshot AND before every send.
 *
 * Flow: create campaign (seeded content) → build audience snapshot →
 * review counts + test send → launch → monitor steps as the dispatcher
 * works through them day by day.
 */

import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Pencil,
  Play,
  RefreshCw,
  Send,
  Users,
  XCircle,
} from "lucide-react";

// ── Small display helpers ───────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700 border-slate-200" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Completed", className: "bg-blue-100 text-blue-700 border-blue-200" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
  pending: { label: "Pending", className: "bg-slate-100 text-slate-700 border-slate-200" },
  sending: { label: "Sending", className: "bg-amber-100 text-amber-700 border-amber-200" },
  sent: { label: "Sent", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700 border-red-200" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { label: status, className: "bg-slate-100 text-slate-700" };
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}

function fmtEt(dateish: string | Date | null | undefined): string {
  if (!dateish) return "—";
  const d = new Date(dateish);
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) + " ET";
}

// ── Step row ────────────────────────────────────────────────────────────────

interface StepRowProps {
  step: any;
  campaignStatus: string;
  onRefetch: () => void;
}

function StepRow({ step, campaignStatus, onRefetch }: StepRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [editSubject, setEditSubject] = useState(step.subject ?? "");
  const [editBody, setEditBody] = useState(step.body);
  const [testTarget, setTestTarget] = useState("");

  const updateMutation = trpc.promoCampaign.updateMessage.useMutation({
    onSuccess: () => {
      toast.success("Step updated");
      setEditOpen(false);
      onRefetch();
    },
    onError: (err) => toast.error("Update failed", { description: err.message }),
  });
  const testEmailMutation = trpc.promoCampaign.sendTestEmail.useMutation({
    onSuccess: () => {
      toast.success("Test email sent! Check your inbox.");
      setTestOpen(false);
    },
    onError: (err) => toast.error("Test email failed", { description: err.message }),
  });
  const testSmsMutation = trpc.promoCampaign.sendTestSms.useMutation({
    onSuccess: () => {
      toast.success("Test text sent! Check your phone.");
      setTestOpen(false);
    },
    onError: (err) => toast.error("Test SMS failed", { description: err.message }),
  });
  const retryMutation = trpc.promoCampaign.retryStep.useMutation({
    onSuccess: () => {
      toast.success("Step re-armed — it will send on the next dispatcher pass. Already-sent people are automatically skipped.");
      onRefetch();
    },
    onError: (err) => toast.error("Retry failed", { description: err.message }),
  });

  const editable = campaignStatus === "draft" || (campaignStatus === "active" && step.status === "pending");
  const isEmail = step.channel === "email";
  const rowTint =
    step.status === "sent"
      ? "bg-emerald-50/30 border-emerald-100"
      : step.status === "sending"
        ? "bg-amber-50/40 border-amber-100"
        : step.status === "failed"
          ? "bg-red-50/30 border-red-100"
          : step.status === "cancelled"
            ? "opacity-60"
            : "";

  return (
    <div className={`border rounded-lg p-4 space-y-2 ${rowTint}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
            {step.sequenceOrder}
          </div>
          {isEmail ? <Mail className="w-4 h-4 text-amber-600 shrink-0" /> : <MessageSquare className="w-4 h-4 text-amber-600 shrink-0" />}
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">
              {isEmail ? step.subject || step.stepKey : `Text — Day ${step.dayOffset}`}
            </div>
            <div className="text-xs text-muted-foreground">
              Day {step.dayOffset}
              {step.scheduledAt ? ` • ${fmtEt(step.scheduledAt)}` : ` • ${step.sendTimeEt} ET`}
              {step.status !== "pending" && (
                <> • {step.sentCount} sent{step.failedCount > 0 && `, ${step.failedCount} failed`}{step.skippedCount > 0 && `, ${step.skippedCount} skipped`}</>
              )}
              {step.engagement && (step.engagement.opens > 0 || step.engagement.uniqueClicks > 0) && (
                <span className="text-emerald-700 font-medium" title="Opens include email apps that auto-load images (Apple Mail); clicks can include a few security scanners. Directional, not exact.">
                  {isEmail && <> • ~{step.engagement.opens.toLocaleString()} opens</>}
                  <> • {step.engagement.uniqueClicks.toLocaleString()} clicks</>
                  {step.engagement.totalClicks > step.engagement.uniqueClicks && <> ({step.engagement.totalClicks.toLocaleString()} total)</>}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={step.status} />
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide" : "View"}
          </Button>
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditSubject(step.subject ?? "");
                setEditBody(step.body);
                setEditOpen(true);
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
            <Send className="w-3.5 h-3.5 mr-1" /> Test
          </Button>
          {(step.status === "failed" || step.status === "cancelled") && campaignStatus === "active" && (
            <Button variant="outline" size="sm" disabled={retryMutation.isPending} onClick={() => retryMutation.mutate({ messageId: step.id })}>
              {retryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />} Retry
            </Button>
          )}
        </div>
      </div>

      {step.error && <div className="text-xs text-red-600">{step.error}</div>}

      {expanded && (
        <pre className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-72 overflow-y-auto font-sans">{step.body}</pre>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {isEmail ? "email" : "text"} — Day {step.dayOffset}</DialogTitle>
            <DialogDescription>Changes apply to sends that haven't gone out yet.</DialogDescription>
          </DialogHeader>
          {isEmail && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Subject</label>
              <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium">Body</label>
            <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={14} />
            {!isEmail && <p className="text-xs text-muted-foreground">{editBody.length} characters</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() =>
                updateMutation.mutate({
                  messageId: step.id,
                  ...(isEmail ? { subject: editSubject } : {}),
                  body: editBody,
                })
              }
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test-send dialog */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send test {isEmail ? "email" : "text"}</DialogTitle>
            <DialogDescription>
              Sends this exact step to you only. {isEmail ? "Subject is prefixed with [TEST]." : "Uses your phone number."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <label className="text-sm font-medium">{isEmail ? "Your email" : "Your phone"}</label>
            <Input
              placeholder={isEmail ? "you@example.com" : "(555) 123-4567"}
              value={testTarget}
              onChange={(e) => setTestTarget(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>Cancel</Button>
            <Button
              disabled={!testTarget || testEmailMutation.isPending || testSmsMutation.isPending}
              onClick={() =>
                isEmail
                  ? testEmailMutation.mutate({ messageId: step.id, to: testTarget })
                  : testSmsMutation.mutate({ messageId: step.id, phone: testTarget })
              }
            >
              {(testEmailMutation.isPending || testSmsMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Campaign view ───────────────────────────────────────────────────────────

function CampaignView({ campaignId }: { campaignId: number }) {
  const [building, setBuilding] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const detail = trpc.promoCampaign.getCampaign.useQuery(
    { campaignId },
    { refetchInterval: (q) => (q.state.data?.campaign?.status === "active" ? 15000 : false) }
  );
  const progress = trpc.promoCampaign.getSnapshotProgress.useQuery(undefined, {
    enabled: building,
    refetchInterval: building ? 1000 : false,
  });

  const snapshotMutation = trpc.promoCampaign.buildSnapshot.useMutation({
    onMutate: () => setBuilding(true),
    onSuccess: (data) => {
      setBuilding(false);
      toast.success(
        `Audience ready: ${data.eligibleCount} people`,
        {
          description: `${data.snapshotTotal} pulled from HubSpot • ${data.excludedWebinarCount} held out (upcoming webinar) • ${data.smsEligibleCount} textable`,
        }
      );
      detail.refetch();
    },
    onError: (err) => {
      setBuilding(false);
      toast.error("Snapshot failed", { description: err.message });
    },
  });
  const launchMutation = trpc.promoCampaign.launchCampaign.useMutation({
    onSuccess: () => {
      setLaunchOpen(false);
      toast.success("Campaign launched! First email goes out in ~2 minutes, first text in ~5.");
      detail.refetch();
    },
    onError: (err) => toast.error("Launch failed", { description: err.message }),
  });
  const cancelMutation = trpc.promoCampaign.cancelCampaign.useMutation({
    onSuccess: (data) => {
      setCancelOpen(false);
      toast.success(`Campaign cancelled — ${data.stepsCancelled} remaining step(s) stopped.`);
      detail.refetch();
    },
    onError: (err) => toast.error("Cancel failed", { description: err.message }),
  });
  const tickMutation = trpc.promoCampaign.runDispatchNow.useMutation({
    onSuccess: (data) => {
      toast.success("Dispatcher pass complete", {
        description: `${data.processed} step(s) worked • ${data.sent} sent, ${data.failed} failed, ${data.skipped} skipped${data.deferred ? `, ${data.deferred} deferred` : ""}`,
      });
      detail.refetch();
    },
    onError: (err) => toast.error("Dispatch failed", { description: err.message }),
  });

  if (detail.isError) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">Couldn't load the campaign: {detail.error.message}</p>
          <Button variant="outline" onClick={() => detail.refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (detail.isLoading || !detail.data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
      </div>
    );
  }

  const { campaign, messages, recipientStats } = detail.data;
  const hasSnapshot = !!campaign.snapshotAt;
  const emailSteps = messages.filter((m: any) => m.channel === "email").length;
  const smsSteps = messages.filter((m: any) => m.channel === "sms").length;
  const pct = progress.data && progress.data.total > 0 ? Math.round((progress.data.processed / progress.data.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Campaign header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                {campaign.name} <StatusBadge status={campaign.status} />
              </CardTitle>
              <CardDescription>
                Audience: HubSpot list "{campaign.hubspotListName || campaign.hubspotListId}" • {emailSteps} emails + {smsSteps} texts over 18 days
                {campaign.launchedAt && <> • launched {fmtEt(campaign.launchedAt)}</>}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {campaign.status === "draft" && (
                <>
                  <Button variant="outline" disabled={building || snapshotMutation.isPending} onClick={() => snapshotMutation.mutate({ campaignId })}>
                    {building ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {progress.data?.stage === "hubspot-contacts" ? `${pct}%` : progress.data?.stage || "Building"}
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4 mr-2" /> {hasSnapshot ? "Rebuild Audience" : "Build Audience"}
                      </>
                    )}
                  </Button>
                  <Button
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    disabled={!hasSnapshot || (recipientStats.emailEligible === 0 && recipientStats.smsEligible === 0)}
                    onClick={() => setLaunchOpen(true)}
                  >
                    <Play className="w-4 h-4 mr-2" /> Launch
                  </Button>
                </>
              )}
              {campaign.status === "active" && (
                <>
                  <Button variant="outline" size="sm" disabled={tickMutation.isPending} onClick={() => tickMutation.mutate()}>
                    {tickMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Run Dispatcher Now
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                    <XCircle className="w-4 h-4 mr-2" /> Stop Campaign
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Audience stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">From HubSpot List</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hasSnapshot ? recipientStats.total.toLocaleString() : "—"}</div>
            <p className="text-xs text-muted-foreground">snapshot {hasSnapshot ? fmtEt(campaign.snapshotAt) : "not built yet"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Getting Emails</CardTitle>
            <Mail className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hasSnapshot ? recipientStats.emailEligible.toLocaleString() : "—"}</div>
            <p className="text-xs text-muted-foreground">{recipientStats.unsubscribed > 0 ? `${recipientStats.unsubscribed} unsubscribed so far` : "eligible after exclusions"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Getting Texts</CardTitle>
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hasSnapshot ? recipientStats.smsEligible.toLocaleString() : "—"}</div>
            <p className="text-xs text-muted-foreground">valid US/Canada phone on file</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Held Out</CardTitle>
            <CalendarClock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hasSnapshot ? recipientStats.excludedWebinar.toLocaleString() : "—"}</div>
            <p className="text-xs text-muted-foreground">registered for an upcoming webinar</p>
          </CardContent>
        </Card>
      </div>

      {/* Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Sequence</CardTitle>
          <CardDescription>
            {messages.length} steps • {messages.filter((m: any) => m.status === "sent").length} sent •{" "}
            {messages.filter((m: any) => m.status === "pending").length} pending
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {messages.map((step: any) => (
            <StepRow key={step.id} step={step} campaignStatus={campaign.status} onRefetch={() => detail.refetch()} />
          ))}
        </CardContent>
      </Card>

      {/* Launch confirm */}
      <Dialog open={launchOpen} onOpenChange={setLaunchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch this campaign?</DialogTitle>
            <DialogDescription>
              You're about to start the full {messages.length}-step sequence:{" "}
              <strong>{recipientStats.emailEligible.toLocaleString()}</strong> people get the emails and{" "}
              <strong>{recipientStats.smsEligible.toLocaleString()}</strong> get the texts, spread over 18 days.
              The first email goes out ~2 minutes after you confirm. Anyone who registers for a webinar mid-campaign
              is automatically held out of sends until their webinar has passed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLaunchOpen(false)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={launchMutation.isPending}
              onClick={() => launchMutation.mutate({ campaignId })}
            >
              {launchMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Launch — {recipientStats.emailEligible.toLocaleString()} emails / {recipientStats.smsEligible.toLocaleString()} texts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop this campaign?</DialogTitle>
            <DialogDescription>
              All remaining steps will be cancelled. Messages already sent can't be recalled. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep Running</Button>
            <Button variant="destructive" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate({ campaignId })}>
              {cancelMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Stop Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function PromoCampaignManager() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const campaigns = trpc.promoCampaign.listCampaigns.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const createMutation = trpc.promoCampaign.createAffiliateCampaign.useMutation({
    onSuccess: (data) => {
      toast.success(data.created ? "Campaign created with all 25 steps loaded" : "Opened your existing campaign");
      setSelectedId(data.campaignId);
      campaigns.refetch();
    },
    onError: (err) => toast.error("Couldn't create campaign", { description: err.message }),
  });

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

  const list = campaigns.data ?? [];
  const activeOrDraft = list.filter((c: any) => c.status === "draft" || c.status === "active");
  const currentId = selectedId ?? activeOrDraft[activeOrDraft.length - 1]?.id ?? list[list.length - 1]?.id ?? null;

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
              <Megaphone className="w-5 h-5 text-amber-600" />
              <h1 className="text-lg font-semibold font-display">Promo Campaign Manager</h1>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {list.length > 1 &&
              list.map((c: any) => (
                <Button
                  key={c.id}
                  variant={c.id === currentId ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedId(c.id)}
                >
                  #{c.id} <StatusBadge status={c.status} />
                </Button>
              ))}
            {list.length > 0 && activeOrDraft.length === 0 && (
              <Button size="sm" variant="outline" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Megaphone className="w-4 h-4 mr-1" />}
                New Campaign
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {campaigns.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          </div>
        ) : currentId == null ? (
          <Card>
            <CardContent className="pt-10 pb-10 text-center space-y-4">
              <Megaphone className="w-12 h-12 text-amber-600 mx-auto" />
              <div>
                <h2 className="text-lg font-semibold">No promo campaigns yet</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                  Create the Affiliate Arbitrage campaign — 12 emails + 13 texts promoting 0percentfunded.com to your
                  HubSpot "SQL" list, with webinar-registrant exclusions built in.
                </p>
              </div>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Set Up Affiliate Arbitrage Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <CampaignView campaignId={currentId} />
        )}
      </div>
    </div>
  );
}
