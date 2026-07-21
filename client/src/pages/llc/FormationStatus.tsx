/**
 * LLC formation status — /llc/status/:id
 *
 * Confirmed-progress tracker for a submitted registration. Adapted from the
 * standalone LLC-formation app into rental-calc's native design. Released
 * formation documents appear in the "Your documents" vault below (served
 * through the authenticated /manus-storage proxy).
 */
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { LlcPageShell } from "./LlcPageShell";

function formatDate(value: number | null) {
  if (!value) return "Not yet recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

const STATUS_COPY = {
  draft: {
    eyebrow: "Draft saved",
    title: "Your registration is waiting for you.",
    body: "Continue where you left off. Your information remains in your account.",
  },
  ready: {
    eyebrow: "Ready to submit",
    title: "Your details are complete.",
    body: "Return to the review step to submit your registration to our filing team.",
  },
  submitting: {
    eyebrow: "Secure submission",
    title: "We’re submitting your application.",
    body: "The request is in progress. Refresh the confirmed status before attempting another action.",
  },
  payment_required: {
    eyebrow: "Order received",
    title: "Your filing is being prepared.",
    body: "We received your registration details and our team is preparing your state filing. You don’t need to do anything else right now — this page will update as your formation progresses.",
  },
  processing: {
    eyebrow: "Filing in progress",
    title: "Your formation is being processed.",
    body: "Your filing is moving through the state and IRS steps. Check back here for the latest confirmed progress.",
  },
  completed: {
    eyebrow: "Formation completed",
    title: "Your LLC formation is complete.",
    body: "Congratulations — your company is official. Your formation documents appear below as our team delivers them, and your saved details are always available here.",
  },
  action_required: {
    eyebrow: "In review",
    title: "Our team is reviewing a detail on your filing.",
    body: "Nothing is lost — your saved registration details are intact. We’ll reach out if we need anything from you.",
  },
  failed: {
    eyebrow: "Submission interrupted",
    title: "Your submission did not go through.",
    body: "Your draft is still intact. Retry is available only when doing so cannot create a duplicate registration.",
  },
} as const;

/** Friendly labels for well-known document types (fallback: stored name). */
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  articles_of_organization: "Articles of Organization",
  ein_letter: "EIN confirmation letter",
  ein_confirmation: "EIN confirmation letter",
  operating_agreement: "Operating agreement",
};

function documentDisplayName(document: { name: string; documentType: string | null }) {
  if (document.documentType && DOCUMENT_TYPE_LABELS[document.documentType]) {
    return DOCUMENT_TYPE_LABELS[document.documentType];
  }
  return document.name;
}

function StatusWorkspace({ registrationId }: { registrationId: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const registrationQuery = trpc.llc.get.useQuery(
    { id: registrationId },
    { retry: 1, refetchOnWindowFocus: false },
  );
  const documentsQuery = trpc.llc.documents.useQuery(
    { id: registrationId },
    { retry: 1, refetchOnWindowFocus: false },
  );
  const refreshMutation = trpc.llc.refreshStatus.useMutation({
    onSuccess: (result) => {
      utils.llc.get.setData({ id: registrationId }, result.registration);
      void utils.llc.documents.invalidate({ id: registrationId });
      toast.success(result.message);
    },
  });
  const retryMutation = trpc.llc.submit.useMutation({
    onSuccess: (result) => {
      if (result.outcome === "validation_error") {
        toast.error(result.message);
        setLocation(`/llc/register/${registrationId}`);
        return;
      }
      utils.llc.get.setData({ id: registrationId }, result.registration);
      if (result.outcome === "checkout_ready") {
        toast.success("Your registration was submitted. We’re preparing your filing.");
      } else if (result.outcome === "failed") {
        toast.error(result.message);
      } else {
        toast.success(result.message);
      }
    },
  });

  const registration = registrationQuery.data;
  const primaryFounder = useMemo(
    () => registration?.draft.founders.find((founder) => founder.isPrimary),
    [registration?.draft.founders],
  );

  if (registrationQuery.isLoading) return <StatusSkeleton />;

  if (registrationQuery.isError || !registration) {
    return (
      <div className="apple-card p-8 text-center">
        <AlertCircle className="mx-auto size-6 text-destructive" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          We couldn’t load your confirmed status.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          No registration data was changed. Try loading the secure record again.
        </p>
        <Button className="mt-5" onClick={() => registrationQuery.refetch()}>
          <RefreshCw className="mr-2 size-4" aria-hidden="true" />
          Try again
        </Button>
      </div>
    );
  }

  const copy = STATUS_COPY[registration.status];
  const isProviderStatus = ["payment_required", "processing", "completed"].includes(
    registration.status,
  );
  const isBusy = refreshMutation.isPending || retryMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <a
          href="/?tab=llc"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to LLC formation
        </a>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">
          {registration.statusLabel}
        </span>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {copy.eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {copy.title}
        </h2>
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {copy.body}
        </p>
      </div>

      {registration.status === "completed" ? (
        <div className="apple-card border-emerald-600/25 bg-emerald-600/5 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600/10">
              <Trophy className="size-4 text-emerald-700" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Your business is official</h3>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                Your LLC and federal EIN are ready — the foundation for a business bank
                account, leases in your company’s name, and your rental business.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {(registration.status === "failed" || registration.status === "action_required") &&
      registration.safeErrorMessage ? (
        <div role="alert" className="apple-card border-destructive/25 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Confirmed issue</h3>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                {registration.safeErrorMessage}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="apple-card p-6">
        <div className="flex items-center gap-2.5">
          <FileText className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">Your documents</h3>
        </div>
        <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
          Stored securely in your account — download them any time for your bank,
          leases, and registrations.
        </p>
        {(documentsQuery.data ?? []).length > 0 ? (
          <ul className="mt-4 divide-y divide-border">
            {(documentsQuery.data ?? []).map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {documentDisplayName(document)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Delivered {formatDate(document.releasedAt ?? document.createdAt)}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <a href={document.url} target="_blank" rel="noreferrer">
                    <Download className="mr-1.5 size-3.5" aria-hidden="true" />
                    Download
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg bg-muted/60 px-4 py-3 text-[13px] leading-5 text-muted-foreground">
            Your formation documents will appear here as our team delivers them.
          </p>
        )}
      </div>

      <div className="apple-card p-6">
        <div className="flex items-center gap-2.5">
          <FileCheck2 className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">
            {isProviderStatus || registration.status === "submitting"
              ? "Submitted details"
              : "Saved details"}
          </h3>
        </div>
        <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Company</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {registration.draft.legalName || "Not provided"} {registration.draft.entitySuffix}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Formation state</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {registration.draft.formationState || "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Primary founder</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {primaryFounder
                ? `${primaryFounder.firstName} ${primaryFounder.lastName}`
                : "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Founders</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {registration.draft.founders.length}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Registered agent</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {registration.draft.useRegisteredAgent
                ? "Professional registered-agent service"
                : "Company-provided address"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">EIN preference</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {registration.draft.expediteEin ? "Expedited" : "Standard"}
            </dd>
          </div>
        </dl>
        <dl className="mt-5 grid gap-x-8 gap-y-5 border-t border-border pt-5 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order reference</dt>
            <dd className="mt-1 font-mono text-xs text-foreground">{registration.orderRef}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Submitted</dt>
            <dd className="mt-1 text-xs font-medium text-foreground">
              {formatDate(registration.submittedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last updated</dt>
            <dd className="mt-1 text-xs font-medium text-foreground">
              {formatDate(registration.updatedAt)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap gap-3">
        {registration.canEdit ? (
          <Button
            variant="outline"
            onClick={() => setLocation(`/llc/register/${registrationId}`)}
          >
            Review saved form
          </Button>
        ) : null}
        {registration.canRetry ? (
          <Button disabled={isBusy} onClick={() => retryMutation.mutate({ id: registrationId })}>
            {retryMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw className="mr-2 size-4" aria-hidden="true" />
            )}
            Retry safely
          </Button>
        ) : null}
        {isProviderStatus || registration.status === "submitting" ? (
          <Button
            variant="outline"
            disabled={isBusy}
            onClick={() => refreshMutation.mutate({ id: registrationId })}
          >
            {refreshMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="mr-2 size-4" aria-hidden="true" />
            )}
            Check for updates
          </Button>
        ) : null}
      </div>
      {refreshMutation.isError || retryMutation.isError ? (
        <p role="alert" className="text-xs font-medium leading-5 text-destructive">
          That action was interrupted. Your last confirmed status and saved details have not changed.
        </p>
      ) : null}

      <div className="apple-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Clock3 className="size-4 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Confirmed activity</h3>
          </div>
          {registration.status === "completed" ? (
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
          ) : null}
        </div>
        <ol className="mt-5 space-y-0">
          {registration.history.map((item, index) => (
            <li key={item.id} className="relative grid grid-cols-[1.75rem_1fr] gap-3 pb-5 last:pb-0">
              {index < registration.history.length - 1 ? (
                <span
                  className="absolute left-[0.8rem] top-6 h-[calc(100%-0.5rem)] w-px bg-border"
                  aria-hidden="true"
                />
              ) : null}
              <span className="relative z-10 mt-0.5 grid size-6 place-items-center rounded-full bg-emerald-600/10">
                <Check className="size-3 text-emerald-700" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <time
                  className="mt-0.5 block text-[11px] text-muted-foreground"
                  dateTime={new Date(item.createdAt).toISOString()}
                >
                  {formatDate(item.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex items-start gap-2.5 px-1">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs leading-5 text-muted-foreground">
          Our team manages the state filing, registered agent, and EIN retrieval end to
          end. You’ll hear from us the moment anything needs your attention.
        </p>
      </div>
    </div>
  );
}

export default function FormationStatus() {
  const params = useParams<{ id: string }>();
  const registrationId = Number(params.id);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!Number.isInteger(registrationId) || registrationId <= 0) {
      setLocation("/?tab=llc");
    }
  }, [registrationId, setLocation]);

  if (!Number.isInteger(registrationId) || registrationId <= 0) return null;

  return (
    <LlcPageShell
      title="Your LLC Filing"
      description="Track every confirmed step of your formation — from submission to completion."
    >
      <StatusWorkspace key={registrationId} registrationId={registrationId} />
    </LlcPageShell>
  );
}
