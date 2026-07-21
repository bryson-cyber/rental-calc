/**
 * LLC formation wizard — /llc/register/:id
 *
 * Six-step guided registration with autosave. Adapted from the standalone
 * LLC-formation app into rental-calc's native design (Coach Inayah light
 * theme, gold accents, apple-card surfaces).
 */
import {
  ActivityStep,
  AddressAgentStep,
  BusinessStep,
  FoundersStep,
  PreferencesStep,
  ReviewStep,
} from "@/components/llc-formation/WizardSteps";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { LLC_WIZARD_STEPS, type LlcDraft } from "@shared/llc";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { LlcPageShell } from "./LlcPageShell";

const EMPTY_DRAFT: LlcDraft = {
  currentStep: 1,
  legalName: "",
  entitySuffix: "LLC",
  formationState: "",
  businessType: "",
  industryGroup: "",
  industryType: "",
  businessPhone: "",
  website: "",
  useRegisteredAgent: false,
  companyAddress: {
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  },
  expediteEin: false,
  accuracyAttested: false,
  founders: [],
};

function WizardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-full rounded-lg" />
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

/** Compact step strip: numbered pills with the active step highlighted. */
function StepProgress({
  activeStep,
  furthestStep,
  onSelect,
}: {
  activeStep: number;
  furthestStep: number;
  onSelect: (step: number) => void;
}) {
  const step = LLC_WIZARD_STEPS[activeStep - 1];
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Step {activeStep} of {LLC_WIZARD_STEPS.length} · {step?.title}
        </p>
        <div className="flex gap-1.5" role="tablist" aria-label="Registration steps">
          {LLC_WIZARD_STEPS.map((item) => {
            const isAvailable = item.id <= furthestStep;
            const isActive = item.id === activeStep;
            const isComplete = item.id < furthestStep && !isActive;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Step ${item.id}: ${item.title}`}
                disabled={!isAvailable}
                onClick={() => onSelect(item.id)}
                className={`grid size-7 place-items-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors disabled:cursor-default ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isComplete
                      ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 hover:border-emerald-600/50"
                      : isAvailable
                        ? "border-border bg-card text-muted-foreground hover:border-primary/40"
                        : "border-border/60 bg-transparent text-muted-foreground/40"
                }`}
              >
                {isComplete ? <Check className="size-3" aria-hidden="true" /> : item.id}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ included, addon, children }: { included?: boolean; addon?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-3">
      <span className="flex min-w-0 items-start gap-2">
        {included ? (
          <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-600/10">
            <Check className="size-2.5 text-emerald-600" strokeWidth={3.5} aria-hidden="true" />
          </span>
        ) : (
          <span className="mt-1.5 ml-1 mr-0.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />
        )}
        <span className="text-xs leading-5 text-foreground">{children}</span>
      </span>
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {addon ? (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">Add-on</span>
        ) : included ? (
          "Included"
        ) : (
          "Yours"
        )}
      </span>
    </li>
  );
}

function RegistrationWorkspace({ registrationId }: { registrationId: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const registrationQuery = trpc.llc.get.useQuery(
    { id: registrationId },
    { retry: 1, refetchOnWindowFocus: false },
  );
  const [draft, setDraft] = useState<LlcDraft>(EMPTY_DRAFT);
  const [activeStep, setActiveStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const lastSavedRef = useRef("");

  const saveMutation = trpc.llc.saveDraft.useMutation({
    onSuccess: (registration) => {
      utils.llc.get.setData({ id: registrationId }, registration);
      lastSavedRef.current = JSON.stringify(registration.draft);
    },
  });
  const advanceMutation = trpc.llc.advanceStep.useMutation();
  const validateMutation = trpc.llc.validateForSubmission.useMutation();
  const submitMutation = trpc.llc.submit.useMutation();

  useEffect(() => {
    if (!registrationQuery.data || hydrated) return;
    const initialDraft = registrationQuery.data.draft;
    setDraft(initialDraft);
    setActiveStep(initialDraft.currentStep);
    lastSavedRef.current = JSON.stringify(initialDraft);
    setHydrated(true);
  }, [registrationQuery.data, hydrated]);

  // A registration that is no longer editable lives on its status page.
  useEffect(() => {
    if (!hydrated || registrationQuery.data?.canEdit !== false) return;
    setLocation(`/llc/status/${registrationId}`);
  }, [hydrated, registrationQuery.data?.canEdit, registrationId, setLocation]);

  useEffect(() => {
    if (!hydrated || !registrationQuery.data?.canEdit) return;
    // Autosave pauses during submission so a straggling debounced save can
    // never race the submit flow server-side.
    if (submitMutation.isPending || validateMutation.isPending) return;
    const serialized = JSON.stringify(draft);
    if (serialized === lastSavedRef.current) return;

    const timeout = window.setTimeout(() => {
      saveMutation.mutate({ id: registrationId, draft });
    }, 750);
    return () => window.clearTimeout(timeout);
  }, [draft, hydrated, registrationQuery.data?.canEdit, registrationId, saveMutation, submitMutation.isPending, validateMutation.isPending]);

  const saveState = useMemo(() => {
    if (saveMutation.isPending) return "Saving…";
    if (saveMutation.isError) return "Save interrupted";
    return "Saved securely";
  }, [saveMutation.isPending, saveMutation.isError]);

  if (registrationQuery.isLoading || !hydrated) return <WizardSkeleton />;
  if (registrationQuery.isError || !registrationQuery.data) {
    return (
      <div className="apple-card p-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace unavailable
        </p>
        <h2 className="mt-3 text-xl font-semibold text-foreground">
          Your registration could not be loaded.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          No form data was changed. Try loading the secure workspace again.
        </p>
        <Button className="mt-5" onClick={() => registrationQuery.refetch()}>
          <RefreshCw className="mr-2 size-4" aria-hidden="true" />
          Try again
        </Button>
      </div>
    );
  }

  if (!registrationQuery.data.canEdit) return <WizardSkeleton />;

  const updateDraft = (next: LlcDraft) => {
    setDraft(next);
    if (Object.keys(errors).length > 0) setErrors({});
  };

  const handleNext = async () => {
    const result = await advanceMutation.mutateAsync({
      id: registrationId,
      step: activeStep,
      draft,
    });
    if (!result.advanced) {
      setErrors(result.fieldErrors);
      const firstError = document.querySelector<HTMLElement>("[aria-invalid='true']");
      window.setTimeout(() => firstError?.focus(), 0);
      return;
    }

    setDraft(result.registration.draft);
    setErrors({});
    utils.llc.get.setData({ id: registrationId }, result.registration);
    lastSavedRef.current = JSON.stringify(result.registration.draft);
    setActiveStep(Math.min(6, activeStep + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    try {
      if (JSON.stringify(draft) !== lastSavedRef.current) {
        const saved = await saveMutation.mutateAsync({ id: registrationId, draft });
        setDraft(saved.draft);
        utils.llc.get.setData({ id: registrationId }, saved);
        lastSavedRef.current = JSON.stringify(saved.draft);
      }

      const validation = await validateMutation.mutateAsync({ id: registrationId });
      if (!validation.valid) {
        setErrors(validation.fieldErrors);
        toast.error("Review the highlighted fields before submitting.");
        const firstError = document.querySelector<HTMLElement>("[aria-invalid='true']");
        window.setTimeout(() => firstError?.focus(), 0);
        return;
      }
      utils.llc.get.setData({ id: registrationId }, validation.registration);

      const submission = await submitMutation.mutateAsync({ id: registrationId });
      if (submission.outcome === "validation_error") {
        setErrors(submission.fieldErrors);
        toast.error(submission.message);
        return;
      }

      utils.llc.get.setData({ id: registrationId }, submission.registration);
      if (submission.outcome === "checkout_ready") {
        toast.success("Your registration was submitted. We’re preparing your filing.");
      } else if (submission.outcome === "failed") {
        toast.error(submission.message);
      }
      setLocation(`/llc/status/${registrationId}?submitted=1`);
    } catch {
      toast.error("Submission was interrupted. Your saved draft is still available.");
    }
  };

  const stepContent = (() => {
    const props = { draft, errors, onChange: updateDraft };
    switch (activeStep) {
      case 1:
        return <BusinessStep {...props} />;
      case 2:
        return <ActivityStep {...props} />;
      case 3:
        return <AddressAgentStep {...props} />;
      case 4:
        return <FoundersStep {...props} />;
      case 5:
        return <PreferencesStep {...props} />;
      case 6:
        return <ReviewStep {...props} onEdit={setActiveStep} />;
      default:
        return <BusinessStep {...props} />;
    }
  })();

  return (
    <div>
      <StepProgress
        activeStep={activeStep}
        furthestStep={draft.currentStep}
        onSelect={setActiveStep}
      />

      <div className="apple-card p-6">{stepContent}</div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveStep((step) => Math.max(1, step - 1))}
          disabled={
            activeStep === 1 ||
            advanceMutation.isPending ||
            validateMutation.isPending ||
            submitMutation.isPending
          }
        >
          <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
          Back
        </Button>

        {activeStep < 6 ? (
          <Button
            type="button"
            className="h-10 px-6 font-semibold"
            onClick={() => void handleNext()}
            disabled={advanceMutation.isPending}
          >
            {advanceMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Continue
            {!advanceMutation.isPending ? (
              <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            ) : null}
          </Button>
        ) : (
          <Button
            type="button"
            className="h-10 px-6 font-semibold"
            onClick={() => void handleSubmit()}
            disabled={
              validateMutation.isPending ||
              submitMutation.isPending ||
              saveMutation.isPending
            }
          >
            {validateMutation.isPending || submitMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LockKeyhole className="mr-2 size-4" aria-hidden="true" />
            )}
            {submitMutation.isPending
              ? "Submitting your application…"
              : validateMutation.isPending
                ? "Checking your details…"
                : "Submit my registration"}
          </Button>
        )}
      </div>

      {submitMutation.isPending ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground"
        >
          Keep this page open while we submit your application to our filing team.
          Duplicate clicks are disabled.
        </div>
      ) : null}

      {advanceMutation.isError || validateMutation.isError || submitMutation.isError ? (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          We couldn’t complete that action. Your saved draft is still here; please try again.
        </p>
      ) : null}

      <div className="apple-card mt-6 p-5">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-foreground">Your order</h3>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Cloud className="size-3.5 shrink-0" aria-hidden="true" />
            {saveState}
            {saveMutation.isError ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => saveMutation.mutate({ id: registrationId, draft })}
              >
                Retry save
              </Button>
            ) : null}
          </span>
        </div>
        <dl className="mt-4 grid gap-x-8 gap-y-2 border-b border-border pb-4 sm:grid-cols-3">
          <div className="flex items-baseline justify-between gap-3 sm:block">
            <dt className="text-xs text-muted-foreground">Company</dt>
            <dd className="truncate text-xs font-semibold text-foreground sm:mt-1">
              {draft.legalName ? `${draft.legalName} ${draft.entitySuffix}` : "—"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 sm:block">
            <dt className="text-xs text-muted-foreground">Formation state</dt>
            <dd className="text-xs font-semibold text-foreground sm:mt-1">
              {draft.formationState || "—"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 sm:block">
            <dt className="text-xs text-muted-foreground">Owners</dt>
            <dd className="text-xs font-semibold tabular-nums text-foreground sm:mt-1">
              {draft.founders.length || "—"}
            </dd>
          </div>
        </dl>
        <ul className="mt-4 space-y-2.5">
          <SummaryItem included>State filing &amp; Articles of Organization</SummaryItem>
          <SummaryItem included={draft.useRegisteredAgent}>
            {draft.useRegisteredAgent
              ? "Professional registered agent"
              : "Your own registered-agent address"}
          </SummaryItem>
          <SummaryItem included>Federal EIN (Tax ID)</SummaryItem>
          {draft.expediteEin ? <SummaryItem addon>Expedited EIN</SummaryItem> : null}
        </ul>
        <div className="mt-4 flex items-start gap-2.5 border-t border-border pt-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs leading-5 text-muted-foreground">
            Card details are never collected here, and SSNs are optional and stored
            encrypted. After you submit, our team files with the state and your status
            page tracks every step.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FormationWizard() {
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
      title="Form Your LLC"
      description="Answer a few steps and our team files your LLC with the state, retrieves your EIN, and tracks every stage for you."
    >
      <RegistrationWorkspace key={registrationId} registrationId={registrationId} />
    </LlcPageShell>
  );
}
