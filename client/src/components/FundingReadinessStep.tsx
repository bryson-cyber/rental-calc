/**
 * Funding Readiness Step — soft credit pull + funding readiness snapshot.
 *
 * rental-calc is a partner platform of the funding system
 * (0percentfunded.com). This module submits the member's intake to the
 * funding system through our server, polls the soft-pull job, and renders
 * the curated funding report in-platform. All partner-API calls (and the
 * member's credit data) stay server-side — the browser only ever sees the
 * curated report payload.
 */

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { validFico } from "@/lib/fico";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleCheck,
  Clock,
  Compass,
  Download,
  ExternalLink,
  FileText,
  ListChecks,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";

const TIMELINE_OPTIONS = [
  { value: "30_days", label: "Next 30 days", description: "I'm ready to use funding now", icon: Zap },
  { value: "60_90_days", label: "60–90 days", description: "Building toward my first property", icon: CalendarClock },
  { value: "just_exploring", label: "Just exploring", description: "Seeing what's possible first", icon: Compass },
] as const;

type TimelineValue = (typeof TIMELINE_OPTIONS)[number]["value"];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);

// Mirrors the analysis steps shown on the 0percentfunded form. The server
// reports coarse progress (15 → 55 → 99); steps before the active one
// render as complete.
const PENDING_STEPS = [
  { label: "Initiating secure connection", at: 5 },
  { label: "Pulling credit report (soft inquiry)", at: 15 },
  { label: "AI analyzing your credit profile", at: 55 },
  { label: "Generating your funding report", at: 99 },
];

const SLOW_NOTICE_AFTER_SECONDS = 180;

function PendingAnalysis({ progress, message, onStartOver }: { progress: number; message?: string; onStartOver?: () => void }) {
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = String(elapsed % 60).padStart(2, "0");
  const activeIndex = PENDING_STEPS.reduce((acc, step, i) => (progress >= step.at ? i : acc), 0);

  return (
    <Card className="p-6 sm:p-8">
      <div className="text-center mb-6">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full border-4 border-primary/30">
          <span className="text-lg font-semibold tabular-nums text-primary">{progress}%</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Analyzing Your Credit Profile</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          This usually takes 2 to 3 minutes. Please keep this window open while we complete your analysis.
        </p>
        {message && <p className="text-sm font-medium text-primary mt-2">{message}</p>}
      </div>

      <Progress value={progress} className="mb-6" />

      <div className="space-y-2.5 mb-6">
        {PENDING_STEPS.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <div
              key={step.label}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                done
                  ? "border-emerald-200 bg-emerald-50/60"
                  : active
                    ? "border-primary/25 bg-primary/5"
                    : "border-border bg-muted/30"
              }`}
            >
              {done ? (
                <CircleCheck className="size-5 text-emerald-600 shrink-0" aria-hidden />
              ) : active ? (
                <Loader2 className="size-5 animate-spin text-primary shrink-0" aria-hidden />
              ) : (
                <div className="size-5 rounded-full border-2 border-muted-foreground/30 shrink-0" aria-hidden />
              )}
              <span className={`text-sm ${done ? "text-emerald-800" : active ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {elapsed > SLOW_NOTICE_AFTER_SECONDS && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3.5 mb-6 flex gap-2.5">
          <TriangleAlert className="size-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">Taking longer than usual</p>
            <p className="text-sm text-amber-800/90">
              Credit bureaus are responding slowly, but your request is still processing. Thank you for your patience.
            </p>
            {onStartOver && (
              <button
                type="button"
                onClick={onStartOver}
                className="mt-2 text-sm font-medium text-amber-900 underline underline-offset-2"
              >
                Start over with new details
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" aria-hidden />
          {minutes}:{seconds}
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden />
          Secure &amp; encrypted
        </span>
      </div>
    </Card>
  );
}

/** Simple good/warn/bad coloring for the credit snapshot values. */
function factorTone(kind: "utilization" | "inquiries" | "derogatory", value: number | null): string {
  if (value == null) return "text-foreground";
  if (kind === "utilization") {
    if (value < 30) return "text-emerald-700";
    if (value <= 50) return "text-amber-700";
    return "text-destructive";
  }
  if (kind === "inquiries") {
    if (value <= 2) return "text-emerald-700";
    if (value <= 5) return "text-amber-700";
    return "text-destructive";
  }
  return value === 0 ? "text-emerald-700" : "text-destructive";
}

function ReportPdfCard({ available }: { available: boolean }) {
  const [showPreview, setShowPreview] = useState(false);

  if (!available) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="size-4 text-primary" aria-hidden />
          <h4 className="text-sm font-semibold text-foreground">Your Credit Report (PDF)</h4>
        </div>
        <p className="text-sm text-muted-foreground">
          Your report document is still being prepared — it will appear here automatically once it's ready.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="size-4 text-primary" aria-hidden />
        <h4 className="text-sm font-semibold text-foreground">Your Credit Report (PDF)</h4>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        The exact report document from your soft pull — the same one our funding team sees. View it here or save a copy.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button className="flex-1" variant={showPreview ? "secondary" : "default"} onClick={() => setShowPreview((s) => !s)}>
          <FileText className="size-4 mr-2" aria-hidden />
          {showPreview ? "Hide Preview" : "View My Report"}
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <a href="/api/funding/report-pdf" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4 mr-2" aria-hidden />
            Open in New Tab
          </a>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <a href="/api/funding/report-pdf?download=1">
            <Download className="size-4 mr-2" aria-hidden />
            Download
          </a>
        </Button>
      </div>
      {showPreview && (
        <iframe
          src="/api/funding/report-pdf"
          title="Your credit report PDF"
          className="mt-4 w-full h-[70vh] rounded-lg border bg-muted/30"
        />
      )}
    </Card>
  );
}

function FundingReportSection() {
  const reportQuery = trpc.funding.report.useQuery(undefined, { staleTime: 60_000, retry: 1 });

  if (reportQuery.isLoading) {
    return (
      <Card className="p-6 text-center">
        <Loader2 className="size-5 mx-auto animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground mt-2">Loading your funding report...</p>
      </Card>
    );
  }

  const data = reportQuery.data;
  if (!data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground text-center">
          Your full report is temporarily unavailable — it lives in the funding system and will reappear when it reconnects.
        </p>
      </Card>
    );
  }

  const { report } = data;
  const snapshot = [
    { label: "Credit Score", value: validFico(report.creditFactors.ficoScore) ?? "—", tone: "text-foreground" },
    {
      label: "Utilization",
      value: report.creditFactors.utilization != null ? `${report.creditFactors.utilization.toFixed(1)}%` : "—",
      tone: factorTone("utilization", report.creditFactors.utilization),
      hint: "target: under 30%",
    },
    {
      label: "Hard Inquiries",
      value: report.creditFactors.hardInquiries ?? "—",
      tone: factorTone("inquiries", report.creditFactors.hardInquiries),
    },
    {
      label: "Late Payments",
      value: report.creditFactors.latePayments ?? "—",
      tone: factorTone("derogatory", report.creditFactors.latePayments),
    },
    {
      label: "Collections",
      value: report.creditFactors.collections ?? "—",
      tone: factorTone("derogatory", report.creditFactors.collections),
    },
    { label: "Avg. Credit Age", value: report.creditFactors.averageCreditAge ?? "—", tone: "text-foreground" },
  ];

  return (
    <div className="space-y-4">
      {/* Funding potential */}
      {report.fundingRange && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="size-4 text-primary" aria-hidden />
            <h4 className="text-sm font-semibold text-foreground">Your Funding Potential</h4>
            {report.readiness.rating && (
              <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Readiness: {report.readiness.rating}
              </span>
            )}
          </div>
          <p className="text-3xl font-semibold tabular-nums text-foreground">
            {formatCurrency(report.fundingRange.mid)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Estimated range {formatCurrency(report.fundingRange.low)} – {formatCurrency(report.fundingRange.high)}
            {report.readiness.primaryReason && <> · {report.readiness.primaryReason}</>}
          </p>
        </Card>
      )}

      {/* Where you stand — anonymous aggregate of similar analyzed profiles */}
      {report.similarProfiles && report.similarProfiles.similarCount >= 2 && (
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-4 flex gap-3">
          <Users className="size-5 text-primary shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-foreground leading-relaxed">
            {report.similarProfiles.totalAnalyzed != null && report.similarProfiles.totalAnalyzed > 0 ? (
              <>Based on the {report.similarProfiles.totalAnalyzed.toLocaleString()} profiles we've analyzed, investors</>
            ) : (
              <>Investors</>
            )}{" "}
            with credit like yours secured an average of{" "}
            <span className="font-semibold">{formatCurrency(report.similarProfiles.avgFunding)}</span>
            {report.similarProfiles.minFunding < report.similarProfiles.maxFunding && (
              <>
                {" "}— typically between {formatCurrency(report.similarProfiles.minFunding)} and{" "}
                {formatCurrency(report.similarProfiles.maxFunding)}
              </>
            )}
            .
          </p>
        </div>
      )}

      {/* Bank pre-qualifications */}
      <Card className="p-6">
        <h4 className="text-sm font-semibold text-foreground mb-4">Bank Pre-Qualifications</h4>
        <div className="space-y-3">
          {report.banks.map((bank) => (
            <div key={bank.name} className="flex items-start gap-3">
              {bank.eligible ? (
                <CircleCheck className="size-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
              ) : (
                <div className="size-5 rounded-full border-2 border-muted-foreground/30 shrink-0 mt-0.5" aria-hidden />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{bank.name}</p>
                  {bank.estimatedAmount != null && bank.estimatedAmount > 0 && (
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      ~{formatCurrency(bank.estimatedAmount)}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {bank.eligible ? (
                    <>
                      <span className="font-medium text-emerald-700">Pre-qualified</span>
                      {bank.eligibleWithCaveats && (
                        <span className="text-amber-700"> · one thing to watch</span>
                      )}
                    </>
                  ) : (
                    <span className="font-medium">Within reach — your profile highlights below show the fastest path</span>
                  )}
                  {bank.summary && <> — {bank.summary}</>}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Credit snapshot */}
      <Card className="p-6">
        <h4 className="text-sm font-semibold text-foreground mb-4">Credit Snapshot</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {snapshot.map((item) => (
            <div key={item.label} className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`text-lg font-semibold tabular-nums ${item.tone}`}>{item.value}</p>
              {"hint" in item && item.hint && <p className="text-[10px] text-muted-foreground">{item.hint}</p>}
            </div>
          ))}
        </div>
      </Card>

      {/* Profile highlights — observations only; the team guides next steps */}
      {(report.workingForYou.length > 0 || report.holdingYouBack.length > 0) && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="size-4 text-primary" aria-hidden />
            <h4 className="text-sm font-semibold text-foreground">Your Profile Highlights</h4>
          </div>

          {report.workingForYou.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-emerald-700 mb-1.5">Working for you</p>
              <ul className="space-y-1">
                {report.workingForYou.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-foreground">
                    <CircleCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.holdingYouBack.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-amber-700 mb-1.5">Where you can unlock more</p>
              <ul className="space-y-1">
                {report.holdingYouBack.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-foreground">
                    <TrendingUp className="size-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg bg-primary/5 border border-primary/15 p-4 flex gap-3">
            <Users className="size-5 text-primary shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground mb-0.5">What happens next</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our funding team reviews your results and walks you through your options in the
                right order, step by step — so you know exactly how much capital you can put
                toward your first rental property.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* The original report document, streamed through this platform */}
      <ReportPdfCard available={data.pdfAvailable} />
    </div>
  );
}

export function FundingReadinessStep() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [fundingTimeline, setFundingTimeline] = useState<TimelineValue | "">("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  // While a check is pending, the New Analysis side shows its progress;
  // "start over" forces the intake form instead.
  const [startOver, setStartOver] = useState(false);

  const utils = trpc.useUtils();

  // Prefill from the signed-in member's profile — only into untouched fields
  useEffect(() => {
    if (!user) return;
    setFormData((prev) => {
      const [first = "", ...rest] = (user.name ?? "").trim().split(/\s+/);
      return {
        firstName: prev.firstName || first,
        lastName: prev.lastName || rest.join(" "),
        email: prev.email || (user.email ?? ""),
        phone: prev.phone || (user.phone ?? ""),
      };
    });
  }, [user]);

  const statusQuery = trpc.funding.intakeStatus.useQuery(undefined, {
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 2500 : false,
  });
  const submitMutation = trpc.funding.intakeSubmit.useMutation();

  const state = statusQuery.data;
  const status = state?.status ?? "none";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (formData.phone.trim().length < 10) {
      toast.error("A valid phone number is required.");
      return;
    }
    if (!fundingTimeline) {
      toast.error("Please choose when you plan to use funding.");
      return;
    }
    if (!consentAccepted) {
      toast.error("Please authorize the soft credit inquiry first.");
      return;
    }

    try {
      const result = await submitMutation.mutateAsync({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        fundingTimeline,
        consentAccepted: true,
      });
      // Land on the progress view for a running check; otherwise show results
      setShowForm(result.status === "pending");
      setStartOver(false);
      utils.funding.intakeStatus.setData(undefined, result);
      if (result.status === "connected") {
        toast.success("You're connected — your funding profile is ready.");
      } else if (result.status === "pending") {
        toast.success("Soft credit check started — this usually takes 2 to 3 minutes.");
      }
    } catch (error) {
      // tRPC surfaces zod failures as stringified issue JSON — not member-facing
      const raw = error instanceof Error ? error.message : "";
      const message = raw && !raw.trimStart().startsWith("[") ? raw : "Something went wrong. Please check your details and try again.";
      toast.error(message);
    }
  };

  const setField = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((p) => ({ ...p, [field]: e.target.value }));

  const renderForm = () => (
    <div className="space-y-4">
      {/* Trust strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: ShieldCheck, label: "Soft inquiry only" },
          { icon: Clock, label: "Takes 2–3 minutes" },
          { icon: Sparkles, label: "Results stay in here" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-lg border bg-card px-2 py-2.5 text-center">
            <Icon className="size-4 text-emerald-600 shrink-0" aria-hidden />
            <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
          </div>
        ))}
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* About you */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              About you
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="funding-firstName">First Name *</Label>
                <Input id="funding-firstName" autoComplete="given-name" placeholder="First name" value={formData.firstName} onChange={setField("firstName")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="funding-lastName">Last Name *</Label>
                <Input id="funding-lastName" autoComplete="family-name" placeholder="Last name" value={formData.lastName} onChange={setField("lastName")} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="funding-email">Email *</Label>
              <Input id="funding-email" type="email" autoComplete="email" placeholder="you@example.com" value={formData.email} onChange={setField("email")} required />
              <p className="text-xs text-muted-foreground">
                Use the same email everywhere — it's how your funding profile stays linked to your account.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="funding-phone">Phone *</Label>
              <Input id="funding-phone" type="tel" autoComplete="tel" placeholder="(555) 123-4567" value={formData.phone} onChange={setField("phone")} required />
            </div>
          </fieldset>

          {/* Timeline */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              When do you plan to use funding? *
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Funding timeline">
              {TIMELINE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                const selected = fundingTimeline === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setFundingTimeline(value)}
                    className={`rounded-xl border-2 p-4 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-muted-foreground/40"
                    }`}
                  >
                    <Icon className={`size-5 mb-2 ${selected ? "text-primary" : "text-muted-foreground"}`} aria-hidden />
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Soft-pull consent — same copy as the 0percentfunded intake form.
              Styled state-aware so the required checkbox is unmissable. */}
          <div
            className={`rounded-xl border-2 p-4 transition-colors ${
              consentAccepted ? "border-emerald-300 bg-emerald-50/60" : "border-primary/60 bg-primary/5"
            }`}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                id="funding-consent"
                checked={consentAccepted}
                onCheckedChange={(v) => setConsentAccepted(v === true)}
                className="mt-0.5 size-5 border-2 border-primary bg-white"
                aria-required="true"
              />
              <div className="flex-1">
                <Label htmlFor="funding-consent" className="text-sm font-normal leading-snug cursor-pointer text-foreground">
                  I authorize a soft credit inquiry that will not affect my credit score, and agree to receive my
                  funding analysis results. Soft pull only — never impacts your score.
                </Label>
                {!consentAccepted && (
                  <p className="text-xs font-medium text-primary mt-1.5">
                    Check this box to authorize your soft credit check
                  </p>
                )}
              </div>
              <span className="text-destructive text-sm" aria-hidden>*</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={submitMutation.isPending || !consentAccepted}>
              {submitMutation.isPending ? (
                <><Loader2 className="size-5 mr-2 animate-spin" />Submitting...</>
              ) : (
                <><ShieldCheck className="size-5 mr-2" aria-hidden />Run My Soft Credit Check</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {consentAccepted
                ? "No impact to your credit score · results appear right on this page"
                : "Check the authorization box above to enable your soft credit check"}
            </p>
          </div>
        </form>
      </Card>

      {/* What you'll get */}
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          What you'll see in your results
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Sparkles, label: "Your credit score" },
            { icon: Banknote, label: "Funding potential" },
            { icon: CircleCheck, label: "Bank pre-qualifications" },
            { icon: ListChecks, label: "Personal action plan" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="size-4 text-primary" aria-hidden />
              </div>
              <span className="text-sm text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  // Safe escape hatch: resubmitting while the job is genuinely still running
  // just returns the "still running" pending state (server-side guard).
  const renderPending = () => (
    <PendingAnalysis
      progress={state?.progress ?? 10}
      message={state?.progressMessage}
      onStartOver={() => {
        setStartOver(true);
        setShowForm(true);
      }}
    />
  );

  const renderConnected = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <CheckCircle2 className="size-6 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
          <div>
            <h3 className="text-lg font-semibold text-foreground">You're connected</h3>
            <p className="text-sm text-muted-foreground">
              Linked to the funding system as <span className="font-medium text-foreground">{state?.email}</span>
              {state?.analyzedAt && (
                <> · analyzed {new Date(state.analyzedAt).toLocaleDateString()}</>
              )}
            </p>
          </div>
        </div>

        {state?.summary ? (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-lg bg-muted/60 p-4">
              <p className="text-xs text-muted-foreground mb-1">Credit Score</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {validFico(state.summary.ficoScore) ?? "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/60 p-4">
              <p className="text-xs text-muted-foreground mb-1">Funding Potential</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {state.summary.fundingAmount > 0 ? formatCurrency(state.summary.fundingAmount) : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/60 p-4 col-span-2">
              <p className="text-xs text-muted-foreground mb-1.5">Bank pre-qualifications</p>
              {state.summary.eligibleBanks.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {state.summary.eligibleBanks.map((bank) => (
                    <span key={bank} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                      <Sparkles className="size-3" aria-hidden />{bank}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground">None yet — your full report shows what to improve first.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-5">
            Your funding summary is temporarily unavailable — it lives in the funding system and will reappear when it reconnects.
          </p>
        )}

      </Card>

      <FundingReportSection />

      <p className="text-xs text-muted-foreground text-center">
        Report shown live from the funding system — your credit details are never stored on this platform.
      </p>
    </motion.div>
  );

  const renderGated = () => (
    <Card className="p-8 text-center">
      <Banknote className="size-8 mx-auto mb-4 text-muted-foreground" aria-hidden />
      <h3 className="text-lg font-semibold text-foreground mb-1">No rush — come back when you're ready</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
        You marked that you're just exploring, so we held off on the credit check.
        When you're ready to look at funding seriously, resubmit with your real timeline.
      </p>
      <Button onClick={() => setShowForm(true)}>I'm Ready Now</Button>
    </Card>
  );

  // Previous results view while a fresh check runs (or after a failed
  // retry) — the report itself is fetched live from the funding system by
  // email, so the member's last completed analysis stays reachable.
  const renderPreviousResults = () => (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/15 bg-primary/5 p-3.5 flex gap-2.5 items-start">
        {status === "pending" ? (
          <Loader2 className="size-4 animate-spin text-primary shrink-0 mt-0.5" aria-hidden />
        ) : (
          <TriangleAlert className="size-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
        )}
        <p className="text-sm text-foreground leading-snug">
          {status === "pending"
            ? "A fresh analysis is running — here are your previous results in the meantime."
            : "Your latest check didn't go through — here are your previous results. Switch to New Analysis to try again."}
        </p>
      </div>
      <FundingReportSection />
      <p className="text-xs text-muted-foreground text-center">
        Report shown live from the funding system — your credit details are never stored on this platform.
      </p>
    </div>
  );

  const renderBody = () => {
    if (statusQuery.isLoading) {
      return (
        <Card className="p-8 text-center">
          <Loader2 className="size-6 mx-auto animate-spin text-muted-foreground" aria-hidden />
        </Card>
      );
    }
    if (status === "none") return renderForm();

    // "New Analysis" side of the toggle: a running check shows its
    // progress (unless the member chose to start over); anything else
    // shows the intake form.
    if (showForm) return status === "pending" && !startOver ? renderPending() : renderForm();

    // "Previous Analysis" side: connected shows the full results; a
    // pending or failed check falls back to the last completed report.
    if (status === "connected") return renderConnected();
    if (status === "pending" || status === "failed") return renderPreviousResults();
    return renderGated();
  };

  // Once an analysis exists (or a fresh one is running), the member can
  // swap between the new-intake side and their previous results.
  const hasPrevious =
    !statusQuery.isLoading &&
    (status === "connected" || status === "gated" || status === "failed" || status === "pending");

  const renderViewToggle = () => (
    <div className="flex justify-center">
      <div
        className="inline-flex rounded-xl border border-border bg-card p-1 gap-1"
        role="tablist"
        aria-label="Funding analysis view"
      >
        {[
          { label: "New Analysis", form: true, icon: RefreshCcw },
          { label: "Previous Analysis", form: false, icon: FileText },
        ].map(({ label, form, icon: Icon }) => {
          const active = showForm === form;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setShowForm(form)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-foreground mb-2">Business Funding Readiness</h2>
        <p className="text-[oklch(0.50_0_0)] leading-relaxed max-w-lg mx-auto">
          A soft credit check through our funding system shows the startup capital you can
          actually access for your first rental property — before you spend a dollar.
        </p>
      </div>
      {hasPrevious && renderViewToggle()}
      {renderBody()}
    </div>
  );
}

export default FundingReadinessStep;
