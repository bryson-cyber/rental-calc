/**
 * LLC formation status — /llc/status/:id
 *
 * Confirmed-progress tracker for a submitted registration. Adapted from the
 * standalone LLC-formation app into rental-calc's native design. Released
 * formation documents appear in the "Your documents" vault below (served
 * through the app's authenticated document routes).
 *
 * Token mode (2026-07-28): email links carry ?t=<statusToken> so clients can
 * open this page WITHOUT signing in (the login wall on phones/other browsers
 * was the operator complaint). With a token present the page reads
 * llc.track — a public procedure whose credential is the token itself —
 * instead of the session-only llc.get + llc.documents (which would 401), and
 * appends the token to every document URL so the storage proxy authorizes.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  FileCheck2,
  Eye,
  FileText,
  FlaskConical,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import {
  formatUsdFromCents,
  stateDisplayName,
  useStatePricing,
} from "@/components/llc-formation/useStatePricing";
import { getLoginUrl } from "@/const";
import { LlcPageShell } from "./LlcPageShell";

/** Join a query param onto a URL that may already carry a query string. */
function appendQueryParam(url: string, param: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${param}`;
}

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
  welcome_kit: "Welcome kit & next steps",
  signed_ss4: "Signed IRS Form SS-4",
  signed_form8821: "Signed IRS Form 8821",
  mail: "Company mail",
};

function documentDisplayName(document: { name: string; documentType: string | null }) {
  if (document.documentType && DOCUMENT_TYPE_LABELS[document.documentType]) {
    return DOCUMENT_TYPE_LABELS[document.documentType];
  }
  return document.name;
}

type VaultDocument = {
  name: string;
  documentType: string | null;
  url: string;
};

function StatusWorkspace({
  registrationId,
  statusToken,
}: {
  registrationId: number;
  statusToken: string | null;
}) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  // Tokenized email link: the token (not a session) is the credential, so
  // the session-only queries are skipped entirely — they'd 401.
  const tokenMode = statusToken !== null;
  const [viewerDocument, setViewerDocument] = useState<VaultDocument | null>(null);
  // Stripe sends the client back with ?payment=success|cancelled. The
  // webhook that flips the order to paid can land a few seconds AFTER the
  // redirect, so without this the payer briefly sees "payment required" —
  // exactly the moment a new customer panics. Read once at mount.
  const [paymentReturn] = useState<"success" | "cancelled" | null>(() => {
    const value = new URLSearchParams(window.location.search).get("payment");
    return value === "success" || value === "cancelled" ? value : null;
  });
  const registrationQuery = trpc.llc.get.useQuery(
    { id: registrationId },
    {
      enabled: !tokenMode,
      retry: 1,
      refetchOnWindowFocus: false,
      // Test rows live-update during a webinar so the presenter can advance
      // the stage from a second window or phone and the shared screen follows.
      // After a Stripe success return, poll until the webhook flips the row
      // past payment_required (then stop).
      refetchInterval: (query) => {
        if (query.state.data?.isTest) return 5000;
        if (paymentReturn === "success" && query.state.data?.status === "payment_required") return 3000;
        return false;
      },
    },
  );
  // Token mode data source: registration view + released documents in one
  // public query. Mirrors llc.get's polling rules (including the
  // payment-return settle poll) so banners keep working without a session.
  const trackQuery = trpc.llc.track.useQuery(
    { id: registrationId, token: statusToken ?? "" },
    {
      enabled: tokenMode,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchInterval: (query) => {
        if (query.state.data?.registration.isTest) return 5000;
        if (
          paymentReturn === "success" &&
          query.state.data?.registration.status === "payment_required"
        )
          return 3000;
        return false;
      },
    },
  );
  const isTestRow =
    (tokenMode ? trackQuery.data?.registration.isTest : registrationQuery.data?.isTest) ?? false;
  const documentsQuery = trpc.llc.documents.useQuery(
    { id: registrationId },
    {
      enabled: !tokenMode,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchInterval: !tokenMode && isTestRow ? 5000 : false,
    },
  );
  const advanceMutation = trpc.llcOps.advanceTestStage.useMutation({
    onSuccess: (result) => {
      utils.llc.get.setData({ id: registrationId }, result.registration);
      void utils.llc.documents.invalidate({ id: registrationId });
    },
    onError: (error) => toast.error(error.message),
  });
  const removeTestMutation = trpc.llcOps.deleteDemoFiling.useMutation({
    onSuccess: () => {
      toast.success("Test filing removed.");
      void utils.llc.list.invalidate();
      setLocation("/?tab=llc");
    },
    onError: (error) => toast.error(error.message),
  });
  const refreshMutation = trpc.llc.refreshStatus.useMutation({
    onSuccess: (result) => {
      utils.llc.get.setData({ id: registrationId }, result.registration);
      void utils.llc.documents.invalidate({ id: registrationId });
      toast.success(result.message);
    },
  });
  const checkoutMutation = trpc.llc.createCheckoutSession.useMutation({
    onSuccess: (result) => {
      toast.success("Redirecting to secure checkout...");
      const win = window.open(result.checkoutUrl, "_blank");
      if (!win) {
        // Popup blocked — fall back to same-tab redirect
        window.location.href = result.checkoutUrl;
      }
    },
    onError: (error) => toast.error(error.message),
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
        toast.success("Almost done — complete your payment to start the filing.");
      } else if (result.outcome === "failed") {
        toast.error(result.message);
      } else {
        toast.success(result.message);
      }
    },
  });

  const registration = tokenMode
    ? trackQuery.data?.registration
    : registrationQuery.data;
  // Token viewers get their documents from llc.track, with the token appended
  // to every URL so the document proxy authorizes without a session.
  const documents = useMemo(() => {
    const rows = tokenMode
      ? trackQuery.data?.documents ?? []
      : documentsQuery.data ?? [];
    if (!statusToken) return rows;
    return rows.map((document) => ({
      ...document,
      url: appendQueryParam(document.url, `t=${encodeURIComponent(statusToken)}`),
    }));
  }, [tokenMode, trackQuery.data?.documents, documentsQuery.data, statusToken]);
  const primaryFounder = useMemo(
    () => registration?.draft.founders.find((founder) => founder.isPrimary),
    [registration?.draft.founders],
  );
  // State pricing is a session-only procedure; token viewers fall back to the
  // retail price snapshotted on the registration itself.
  const statePricingQuery = useStatePricing(
    user ? registration?.draft.formationState : null,
  );
  const statePricing = statePricingQuery.data;

  if (tokenMode ? trackQuery.isLoading : registrationQuery.isLoading) {
    return <StatusSkeleton />;
  }

  if ((tokenMode ? trackQuery.isError : registrationQuery.isError) || !registration) {
    return (
      <div className="apple-card p-8 text-center">
        <AlertCircle className="mx-auto size-6 text-destructive" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          We couldn’t load your confirmed status.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          No registration data was changed. Try loading the secure record again.
        </p>
        <Button
          className="mt-5"
          onClick={() => (tokenMode ? trackQuery.refetch() : registrationQuery.refetch())}
        >
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
  const isBusy = refreshMutation.isPending || retryMutation.isPending || checkoutMutation.isPending;

  // Payment card: the registration has been submitted (beyond draft/ready)
  // but the retail payment has not been confirmed yet.
  const isSubmittedStatus = [
    "submitting",
    "payment_required",
    "processing",
    "completed",
    "action_required",
  ].includes(registration.status);
  const showPaymentCard = isSubmittedStatus && !registration.paid;
  // Prefer the price snapshotted at submit; fall back to the state's current
  // published price.
  const dueCents =
    registration.retailPriceCents ??
    (statePricing && statePricing.active ? statePricing.retailPriceCents : null);
  const paymentLinkUrl = statePricing?.paymentLinkUrl ?? null;
  const formationStateName = stateDisplayName(registration.draft.formationState);

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
        <div className="flex items-center gap-2">
          {registration.isSample ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              <FlaskConical className="size-3" aria-hidden="true" />
              {registration.isTest ? "Test filing" : "Demo filing"}
            </span>
          ) : null}
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">
            {registration.statusLabel}
          </span>
        </div>
      </div>

      {paymentReturn === "success" ? (
        <div className="apple-card border-emerald-600/25 bg-emerald-600/5 p-4" role="status">
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600/10">
              <FileCheck2 className="size-4 text-emerald-700" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Payment received — you're all set</h3>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                {registration.status === "payment_required"
                  ? "Confirming your payment now — this page updates itself in a few seconds. Your filing starts automatically; nothing else is needed from you."
                  : "Your filing is underway. This page is your hub: live status, and every document lands here the moment it's ready. We'll also email you at each step."}
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {paymentReturn === "cancelled" && registration.status === "payment_required" ? (
        <div className="apple-card border-amber-300 bg-amber-50/60 p-4" role="status">
          <p className="text-sm text-amber-900">
            Your payment wasn't completed — no charge was made. Your application is
            saved; use the payment button below whenever you're ready.
          </p>
        </div>
      ) : null}

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

      {isAdmin && registration.isSample ? (
        <div className="apple-card border-dashed border-amber-300 bg-amber-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <FlaskConical className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
              <p className="text-xs leading-5 text-muted-foreground">
                <span className="font-semibold text-foreground">Demo controls (admin only).</span>{" "}
                Advance the filing through its stages, then remove it when the
                presentation is over.
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {registration.isTest &&
              (registration.status === "payment_required" ||
                registration.status === "processing") ? (
                <Button
                  size="sm"
                  className="bg-amber-700 text-white hover:bg-amber-800"
                  disabled={advanceMutation.isPending}
                  onClick={() =>
                    advanceMutation.mutate({
                      id: registrationId,
                      fromStatus:
                        registration.status === "payment_required"
                          ? "payment_required"
                          : "processing",
                    })
                  }
                >
                  {advanceMutation.isPending ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                  ) : null}
                  {registration.status === "payment_required"
                    ? "Advance: confirm payment"
                    : "Advance: complete filing"}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={removeTestMutation.isPending}
                onClick={() => {
                  if (window.confirm("Remove this test filing and all of its data?")) {
                    removeTestMutation.mutate({ id: registrationId });
                  }
                }}
              >
                <Trash2 className="mr-1 size-3.5" aria-hidden="true" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showPaymentCard ? (
        <div className="apple-card border-primary/30 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10">
              <CreditCard className="size-4 text-primary" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-foreground">Complete your payment</h3>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                {dueCents !== null
                  ? `Total for ${formationStateName}: ${formatUsdFromCents(dueCents)}. `
                  : ""}
                Your filing moves forward once payment is received.
              </p>
              {registration.isTest ? (
                <Button className="mt-3" disabled>
                  Pay now
                  <ArrowUpRight className="ml-1.5 size-4" aria-hidden="true" />
                </Button>
              ) : !user ? (
                // Anonymous token viewer: checkout requires the account the
                // filing belongs to, so send them through sign-in and back to
                // this exact page (token preserved in the return URL).
                <>
                  <Button
                    className="mt-3"
                    onClick={() => {
                      window.location.href = getLoginUrl(
                        window.location.pathname + window.location.search,
                      );
                    }}
                  >
                    Sign in to pay
                    <ArrowUpRight className="ml-1.5 size-4" aria-hidden="true" />
                  </Button>
                  <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                    Filing payments are final and non-refundable.
                  </p>
                </>
              ) : (
                <>
                  <Button
                    className="mt-3"
                    disabled={checkoutMutation.isPending}
                    onClick={() =>
                      checkoutMutation.mutate({ id: registrationId })
                    }
                  >
                    {checkoutMutation.isPending ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    Pay now
                    <ArrowUpRight className="ml-1.5 size-4" aria-hidden="true" />
                  </Button>
                  <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                    Filing payments are final and non-refundable.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {registration.ein ? (
        <div className="apple-card border-primary/25 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10">
              <FileCheck2 className="size-4 text-primary" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Your Federal EIN</h3>
              <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-foreground">
                {registration.ein}
              </p>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                Issued by the IRS for your company. Use it with your exact legal
                name to open the business bank account and for all federal filings.
              </p>
            </div>
          </div>
        </div>
      ) : null}

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
        {documents.length > 0 ? (
          <ul className="mt-4 divide-y divide-border">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {documentDisplayName(document)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Delivered {formatDate(document.releasedAt ?? document.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setViewerDocument(document)}
                  >
                    <Eye className="mr-1.5 size-3.5" aria-hidden="true" />
                    View
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a href={appendQueryParam(document.url, "download=1")}>
                      <Download className="mr-1.5 size-3.5" aria-hidden="true" />
                      Download
                    </a>
                  </Button>
                </div>
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

      {/* Session-only actions: edit/retry/refresh call protected procedures,
          so anonymous token viewers never see buttons that would 401. */}
      <div className="flex flex-wrap gap-3">
        {user && registration.canEdit ? (
          <Button
            variant="outline"
            onClick={() => setLocation(`/llc/register/${registrationId}`)}
          >
            Review saved form
          </Button>
        ) : null}
        {user && registration.canRetry ? (
          <Button disabled={isBusy} onClick={() => retryMutation.mutate({ id: registrationId })}>
            {retryMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw className="mr-2 size-4" aria-hidden="true" />
            )}
            Retry safely
          </Button>
        ) : null}
        {user && (isProviderStatus || registration.status === "submitting") ? (
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
          end. You’ll hear from us whenever anything needs your attention.
        </p>
      </div>

      <Dialog
        open={viewerDocument !== null}
        onOpenChange={(open) => {
          if (!open) setViewerDocument(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {viewerDocument ? documentDisplayName(viewerDocument) : "Document"}
            </DialogTitle>
          </DialogHeader>
          {viewerDocument ? (
            <>
              <iframe
                src={viewerDocument.url}
                title={documentDisplayName(viewerDocument)}
                className="h-[70vh] w-full rounded-lg border border-border bg-white"
              />
              <div className="flex justify-end">
                <Button asChild variant="outline" size="sm">
                  <a href={appendQueryParam(viewerDocument.url, "download=1")}>
                    <Download className="mr-1.5 size-3.5" aria-hidden="true" />
                    Download
                  </a>
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FormationStatus() {
  const params = useParams<{ id: string }>();
  const registrationId = Number(params.id);
  const [, setLocation] = useLocation();
  // Tokenized email link (?t=…): read once at mount, same pattern as the
  // paymentReturn read above. Length bounds mirror the server's llc.track
  // input so an obviously-invalid token never switches the page into token
  // mode (a signed-in user with a mangled link still gets the session path).
  const [statusToken] = useState<string | null>(() => {
    const value = new URLSearchParams(window.location.search).get("t");
    return value && value.length >= 32 && value.length <= 64 ? value : null;
  });

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
      allowAnonymous={statusToken !== null}
    >
      <StatusWorkspace
        key={registrationId}
        registrationId={registrationId}
        statusToken={statusToken}
      />
    </LlcPageShell>
  );
}
