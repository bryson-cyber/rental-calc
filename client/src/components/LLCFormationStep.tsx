/**
 * LLC Formation tab — the "Make it official" step of the tool hub.
 *
 * Public visitors see the offer and the app's standard sign-in call to action;
 * signed-in members can start a new registration (guided 6-step wizard at
 * /llc/register/:id) or resume/track existing ones.
 *
 * DESIGN: Matches Coach Inayah brand palette (light theme, gold accents).
 */
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { getLoginUrl } from '@/const';
import { trpc } from '@/lib/trpc';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FlaskConical,
  Landmark,
  Loader2,
  Lock,
  MailCheck,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

const INCLUDED = [
  {
    icon: Landmark,
    title: 'State filing & Articles of Organization',
    detail: 'We prepare and file your formation paperwork with your chosen state.',
  },
  {
    icon: MailCheck,
    title: 'Registered agent service',
    detail: 'A professional address receives state and legal mail — not your home.',
  },
  {
    icon: FileCheck2,
    title: 'Federal EIN (Tax ID)',
    detail: 'Retrieved from the IRS for you — required to open a business bank account.',
  },
] as const;

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700">
      {label}
    </span>
  );
}

export default function LLCFormationStep() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  const listQuery = trpc.llc.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const createMutation = trpc.llc.create.useMutation({
    onSuccess: (registration) => {
      setLocation(`/llc/register/${registration.id}`);
    },
    onError: () => {
      toast.error('We could not start your registration. Please try again.');
    },
  });

  const testRunMutation = trpc.llcOps.startTestRun.useMutation({
    onSuccess: (result) => {
      setLocation(`/llc/register/${result.id}`);
    },
    onError: () => {
      toast.error('The test filing could not be started. Please try again.');
    },
  });
  const createDemoMutation = trpc.llcOps.createDemoFiling.useMutation({
    onSuccess: (result) => {
      setLocation(`/llc/status/${result.id}`);
    },
    onError: () => {
      toast.error('The sample filing could not be created. Please try again.');
    },
  });

  const registrations = listQuery.data ?? [];
  // A finished demonstration row whose vault already holds the sample
  // deliverables — reused by "View sample documents" instead of piling up
  // a new demo filing per click.
  const completedSample = registrations.find(
    (registration) => registration.isSample && registration.status === 'completed',
  );
  const viewSampleDocuments = () => {
    if (completedSample) {
      setLocation(`/llc/status/${completedSample.id}`);
      return;
    }
    createDemoMutation.mutate();
  };

  return (
    <div className="space-y-8" data-tool-panel="llc">
      {/* Admin-only: live-journey test mode for webinar demos. Visibility is
          cosmetic — the procedure behind it is admin-gated server-side. */}
      {isAdmin ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
            <p className="text-xs leading-5 text-slate-600">
              <span className="font-semibold text-slate-900">Admin only.</span> Walk
              through the full application in test mode — nothing is filed and no
              emails go to clients.
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300"
              disabled={testRunMutation.isPending}
              onClick={() => testRunMutation.mutate()}
            >
              {testRunMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="mr-2 h-4 w-4" />
              )}
              Run a test filing
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300"
              disabled={createDemoMutation.isPending}
              onClick={viewSampleDocuments}
            >
              {createDemoMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileCheck2 className="mr-2 h-4 w-4" />
              )}
              View sample documents
            </Button>
          </div>
        </div>
      ) : null}

      {/* Offer */}
      <div className="grid gap-4 sm:grid-cols-3">
        {INCLUDED.map(({ icon: Icon, title, detail }) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Icon className="h-5 w-5 text-amber-700" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
            <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            'Guided 6-step application — about 10 minutes',
            'Autosaves as you go; finish any time',
            'Our team handles the state and IRS legwork',
            'Track every confirmed step on your status page',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm text-slate-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              {line}
            </li>
          ))}
        </ul>
      </div>

      {/* Action area */}
      {authLoading ? (
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
          <span className="text-slate-500">Checking your account…</span>
        </div>
      ) : !isAuthenticated || !user ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center sm:p-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[oklch(0.55_0.14_75)]">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <h4 className="text-lg font-semibold text-slate-900">
            Create a free account to start your LLC
          </h4>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
            Your application is saved to your account so you can pick up where you left
            off and track your filing from submission to completion.
          </p>
          <Button
            size="lg"
            className="mt-5"
            onClick={() => {
              window.location.href = getLoginUrl('/?tab=llc');
            }}
          >
            Sign in to get started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Existing registrations */}
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center gap-3 py-6">
              <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
              <span className="text-sm text-slate-500">Loading your registrations…</span>
            </div>
          ) : registrations.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4">
                <h4 className="text-sm font-semibold text-slate-900">Your registrations</h4>
              </div>
              <ul className="divide-y divide-slate-100">
                {registrations.map((registration) => (
                  <li key={registration.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setLocation(
                          registration.canEdit
                            ? `/llc/register/${registration.id}`
                            : `/llc/status/${registration.id}`,
                        )
                      }
                      className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {registration.legalName
                            ? `${registration.legalName} ${registration.entitySuffix}`
                            : `Registration ${registration.orderRef}`}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {registration.formationState
                            ? `${registration.formationState} · `
                            : ''}
                          {registration.canEdit
                            ? `Step ${Math.min(registration.currentStep, 6)} of 6`
                            : registration.orderRef}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-3">
                        {registration.isSample ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                            <FlaskConical className="h-3 w-3" />
                            {registration.isTest ? 'Test' : 'Demo'}
                          </span>
                        ) : null}
                        <StatusPill label={registration.statusLabel} />
                        <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="text-center">
            <Button
              size="lg"
              className="min-w-[220px]"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="mr-2 h-4 w-4" />
              )}
              {registrations.length > 0 ? 'Start another LLC' : 'Start my LLC'}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              You'll receive your total and payment link after you submit. No card details
              are entered here. SSNs are optional and stored encrypted.
            </p>
            {/* Contractual co-brand attribution (partner agreement §4.2) —
                do not remove or obscure. */}
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Formation services powered by doola
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
