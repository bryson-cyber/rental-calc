/**
 * LLC operations dashboard — /admin/llc (admin only).
 *
 * Internal white-label surface: filing orders with the wholesale checkout
 * (pay link), retail price + margin tracking, provider sync, and the
 * per-order client document vault (release / unrelease / upload / delete).
 * Clients never see this page or anything on it.
 *
 * DESIGN: Matches Coach Inayah light theme (white, slate, gold accents).
 */
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  Home,
  Loader2,
  Mail,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { Link } from 'wouter';
import { toast } from 'sonner';

function formatCents(value: number | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(value / 100);
}

function formatDate(value: number | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusBadgeClass(status: string) {
  if (status === 'payment_required') return 'bg-slate-900 text-white';
  if (status === 'action_required' || status === 'failed') return 'bg-red-100 text-red-700';
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
  return 'bg-amber-100 text-amber-700';
}

function RetailPriceCell({
  registrationId,
  retailPriceCents,
}: {
  registrationId: number;
  retailPriceCents: number | null;
}) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    retailPriceCents === null ? '' : (retailPriceCents / 100).toFixed(2),
  );
  const mutation = trpc.llcOps.setRetailPrice.useMutation({
    onSuccess: () => {
      void utils.llcOps.listAll.invalidate();
      setEditing(false);
      toast.success('Retail price saved.');
    },
    onError: (error) => toast.error(error.message),
  });

  if (!editing) {
    return (
      <button
        type="button"
        className="text-left text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
        onClick={() => setEditing(true)}
      >
        {retailPriceCents === null ? 'Set price' : formatCents(retailPriceCents)}
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = value.trim() === '' ? null : Math.round(Number(value) * 100);
        if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
          toast.error('Enter a valid dollar amount.');
          return;
        }
        mutation.mutate({ id: registrationId, retailPriceCents: parsed });
      }}
    >
      <Input
        autoFocus
        inputMode="decimal"
        className="h-8 w-24 text-sm"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="0.00"
      />
      <Button type="submit" size="sm" className="h-8 rounded-lg px-3 text-xs" disabled={mutation.isPending}>
        {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
      </Button>
    </form>
  );
}

function CreateDemoButton() {
  const utils = trpc.useUtils();
  const mutation = trpc.llcOps.createDemoFiling.useMutation({
    onSuccess: (result) => {
      void utils.llcOps.listAll.invalidate();
      toast.success('Demo filing created — opening its client status page.');
      window.open(`/llc/status/${result.id}`, '_blank', 'noopener');
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      title="Fabricates a completed sample filing (owned by you, no provider interaction) and opens the client status page it produces."
    >
      {mutation.isPending ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4 mr-2" />
      )}
      Demo filing
    </Button>
  );
}

function RemoveDemoButton({ registrationId }: { registrationId: number }) {
  const utils = trpc.useUtils();
  const mutation = trpc.llcOps.deleteDemoFiling.useMutation({
    onSuccess: () => {
      void utils.llcOps.listAll.invalidate();
      toast.success('Demo filing removed.');
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-8 rounded-lg px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
      disabled={mutation.isPending}
      onClick={() => {
        if (window.confirm('Remove this demo filing and its sample documents?')) {
          mutation.mutate({ id: registrationId });
        }
      }}
    >
      {mutation.isPending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Trash2 className="w-3 h-3" />
      )}
      <span className="ml-1">Remove</span>
    </Button>
  );
}

function SendDemoEmailsButton({ registrationId }: { registrationId: number }) {
  const mutation = trpc.llcOps.sendDemoEmails.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.sent > 0
          ? `Sent ${result.sent} demo email${result.sent === 1 ? '' : 's'} to your inbox.`
          : 'No demo emails could be sent — check the email relay configuration.',
      );
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-8 rounded-lg px-3 text-xs"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate({ id: registrationId })}
      title="Sends all four client lifecycle emails (application received, payment confirmed, formation complete, documents released) rendered from this demo filing to YOUR email — nothing goes to a client."
    >
      {mutation.isPending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Mail className="w-3 h-3" />
      )}
      <span className="ml-1">Send demo emails to me</span>
    </Button>
  );
}

function PaidCell({ order }: { order: { id: number; retailPaidAt: number | null } }) {
  const utils = trpc.useUtils();
  const invalidate = () => void utils.llcOps.listAll.invalidate();
  const markPaid = trpc.llcOps.markPaid.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success('Marked as paid.');
    },
    onError: (error) => toast.error(error.message),
  });
  const unmarkPaid = trpc.llcOps.unmarkPaid.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success('Marked as unpaid.');
    },
    onError: (error) => toast.error(error.message),
  });
  const busy = markPaid.isPending || unmarkPaid.isPending;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          order.retailPaidAt ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
        }`}
      >
        {order.retailPaidAt ? 'Paid' : 'Unpaid'}
      </span>
      {order.retailPaidAt ? (
        <span className="text-[10px] text-slate-500">{formatDate(order.retailPaidAt)}</span>
      ) : null}
      <button
        type="button"
        disabled={busy}
        className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:underline disabled:opacity-50"
        onClick={() =>
          order.retailPaidAt
            ? unmarkPaid.mutate({ id: order.id })
            : markPaid.mutate({ id: order.id })
        }
      >
        {busy ? 'Saving…' : order.retailPaidAt ? 'Mark unpaid' : 'Mark paid'}
      </button>
    </div>
  );
}

/**
 * Per-state retail pricing manager. State fees are editable reference data
 * (published SoS filing fees at seed time — not legal advice); the owner sets
 * retail. lastWholesaleCents = the highest provider checkout total seen for
 * that state, so pricing happens with real COGS in view. Ops-only.
 */
function StatePricingRow({
  row,
}: {
  row: {
    state: string;
    stateFeeCents: number;
    retailPriceCents: number | null;
    paymentLinkUrl: string | null;
    active: boolean;
    lastWholesaleCents: number | null;
    marginVsLastWholesaleCents: number | null;
  };
}) {
  const utils = trpc.useUtils();
  const [retailValue, setRetailValue] = useState(
    row.retailPriceCents === null ? '' : (row.retailPriceCents / 100).toFixed(2),
  );
  const [linkValue, setLinkValue] = useState(row.paymentLinkUrl ?? '');
  const mutation = trpc.llcOps.setStatePricing.useMutation({
    onSuccess: () => {
      void utils.llcOps.listStatePricing.invalidate();
      toast.success(`${row.state} pricing saved.`);
    },
    onError: (error) => toast.error(error.message),
  });

  const save = (overrides?: { active?: boolean }) => {
    const trimmed = retailValue.trim();
    const parsed = trimmed === '' ? null : Math.round(Number(trimmed) * 100);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      toast.error('Enter a valid dollar amount.');
      return;
    }
    const link = linkValue.trim();
    mutation.mutate({
      state: row.state as never,
      retailPriceCents: parsed,
      active: overrides?.active ?? row.active,
      paymentLinkUrl: link === '' ? null : link,
    });
  };

  return (
    <tr className={row.active ? '' : 'opacity-60'}>
      <td className="border-b border-slate-100 px-3 py-2.5 font-mono text-xs font-bold text-slate-900">
        {row.state}
      </td>
      <td className="border-b border-slate-100 px-3 py-2.5 text-sm tabular-nums text-slate-600">
        {formatCents(row.stateFeeCents)}
      </td>
      <td className="border-b border-slate-100 px-3 py-2.5">
        <Input
          inputMode="decimal"
          className="h-8 w-24 text-sm"
          value={retailValue}
          placeholder="Not set"
          onChange={(event) => setRetailValue(event.target.value)}
          onBlur={() => {
            const trimmed = retailValue.trim();
            const original =
              row.retailPriceCents === null ? '' : (row.retailPriceCents / 100).toFixed(2);
            if (trimmed !== original) save();
          }}
        />
      </td>
      <td className="border-b border-slate-100 px-3 py-2.5">
        <Input
          type="url"
          className="h-8 w-52 text-xs"
          value={linkValue}
          placeholder="https://pay.example.com/…"
          onChange={(event) => setLinkValue(event.target.value)}
          onBlur={() => {
            if (linkValue.trim() !== (row.paymentLinkUrl ?? '')) save();
          }}
        />
      </td>
      <td className="border-b border-slate-100 px-3 py-2.5 text-sm tabular-nums text-slate-600">
        {formatCents(row.lastWholesaleCents)}
      </td>
      <td
        className={`border-b border-slate-100 px-3 py-2.5 text-sm tabular-nums ${
          row.marginVsLastWholesaleCents !== null && row.marginVsLastWholesaleCents < 0
            ? 'font-semibold text-red-600'
            : 'text-slate-900'
        }`}
      >
        {formatCents(row.marginVsLastWholesaleCents)}
      </td>
      <td className="border-b border-slate-100 px-3 py-2.5">
        <button
          type="button"
          disabled={mutation.isPending}
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
            row.active
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
          }`}
          onClick={() => save({ active: !row.active })}
          title={row.active ? 'Clients can file in this state' : 'Filing disabled for this state'}
        >
          {mutation.isPending ? 'Saving…' : row.active ? 'Active' : 'Inactive'}
        </button>
      </td>
    </tr>
  );
}

function StatePricingSection() {
  const utils = trpc.useUtils();
  const pricingQuery = trpc.llcOps.listStatePricing.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const [markupValue, setMarkupValue] = useState('');
  const [bulkLinkValue, setBulkLinkValue] = useState('');
  const markupMutation = trpc.llcOps.applyStateMarkup.useMutation({
    onSuccess: (result) => {
      void utils.llcOps.listStatePricing.invalidate();
      toast.success(`Retail set to state fee + markup for ${result.updated} active states.`);
      setMarkupValue('');
    },
    onError: (error) => toast.error(error.message),
  });
  const syncFeesMutation = trpc.llcOps.syncStateFees.useMutation({
    onSuccess: (result) => {
      void utils.llcOps.listStatePricing.invalidate();
      toast.success(`State fees synced from the provider for ${result.updated} states.`);
    },
    onError: (error) => toast.error(error.message),
  });
  const linkMutation = trpc.llcOps.applyPaymentLink.useMutation({
    onSuccess: (result) => {
      void utils.llcOps.listStatePricing.invalidate();
      toast.success(`Payment link applied to ${result.updated} states.`);
      setBulkLinkValue('');
    },
    onError: (error) => toast.error(error.message),
  });
  const [expediteValue, setExpediteValue] = useState('');
  const expediteMutation = trpc.llcOps.setExpeditePriceForAllStates.useMutation({
    onSuccess: (result) => {
      void utils.llcOps.listStatePricing.invalidate();
      toast.success(`Expedited EIN price set for ${result.updated} states.`);
      setExpediteValue('');
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = pricingQuery.data ?? [];

  return (
    <section className="mt-10">
      <div>
        <h2 className="font-sans text-xl font-semibold tracking-tight text-slate-900">State pricing</h2>
        <p className="mt-1 max-w-2xl font-sans text-xs leading-5 text-slate-500">
          State fees are editable reference data (published filing fees at seed time —
          not legal advice). Clients see a price only when retail is set and the state
          is active. Wholesale figures on this table never reach clients.
        </p>
      </div>

      {/* Bulk actions grouped and labeled — these were four unlabeled forms
          floating against the section title, unreadable at a glance. */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bulk actions — all states at once</p>
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <p className="mb-1 font-sans text-xs font-medium text-slate-600">Provider fees</p>
          <Button
            size="sm"
            variant="outline"
            disabled={syncFeesMutation.isPending}
            onClick={() => syncFeesMutation.mutate()}
          >
            {syncFeesMutation.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="mr-1.5 size-3.5" aria-hidden="true" />
            )}
            Sync state fees
          </Button>
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = Math.round(Number(markupValue) * 100);
              if (!Number.isFinite(parsed) || parsed < 0 || markupValue.trim() === '') {
                toast.error('Enter a valid markup in dollars.');
                return;
              }
              if (
                window.confirm(
                  `Set retail = state fee + ${formatCents(parsed)} for ALL active states? This overwrites existing retail prices on active states.`,
                )
              ) {
                markupMutation.mutate({ markupCents: parsed });
              }
            }}
          >
            <div>
              <label htmlFor="bulk-markup" className="mb-1 block font-sans text-xs font-medium text-slate-600">
                Our fee ($) — added to each state's fee
              </label>
              <Input
                id="bulk-markup"
                inputMode="decimal"
                className="h-9 w-28 text-sm"
                value={markupValue}
                onChange={(event) => setMarkupValue(event.target.value)}
                placeholder="250"
              />
            </div>
            <Button type="submit" size="sm" className="h-9" disabled={markupMutation.isPending}>
              {markupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply markup'}
            </Button>
          </form>
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const link = bulkLinkValue.trim();
              if (link === '') {
                toast.error('Enter a payment link URL.');
                return;
              }
              if (window.confirm('Apply this payment link to ALL states?')) {
                linkMutation.mutate({ paymentLinkUrl: link });
              }
            }}
          >
            <div>
              <label htmlFor="bulk-link" className="mb-1 block font-sans text-xs font-medium text-slate-600">
                Payment link
              </label>
              <Input
                id="bulk-link"
                type="url"
                className="h-9 w-56 text-sm"
                value={bulkLinkValue}
                onChange={(event) => setBulkLinkValue(event.target.value)}
                placeholder="https://pay…"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-9"
              disabled={linkMutation.isPending}
            >
              {linkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply link'}
            </Button>
          </form>
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = expediteValue.trim();
              const parsed = Math.round(Number(trimmed) * 100);
              if (trimmed === '' || !Number.isFinite(parsed) || parsed < 0) {
                toast.error('Enter the expedited EIN add-on price in dollars (0 clears it).');
                return;
              }
              expediteMutation.mutate({
                expediteEinPriceCents: parsed === 0 ? null : parsed,
              });
            }}
          >
            <div>
              <label htmlFor="bulk-expedite" className="mb-1 block font-sans text-xs font-medium text-slate-600">
                Expedited EIN add-on ($)
              </label>
              <Input
                id="bulk-expedite"
                type="number"
                min="0"
                step="0.01"
                className="h-9 w-36 text-sm"
                value={expediteValue}
                onChange={(event) => setExpediteValue(event.target.value)}
                placeholder="249"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-9"
              disabled={expediteMutation.isPending}
            >
              {expediteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Set add-on price'
              )}
            </Button>
          </form>
        </div>
      </div>

      {pricingQuery.error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-sans text-sm font-medium text-red-800">Couldn't load state pricing.</p>
          <p className="mt-1 font-sans text-xs text-red-600">{pricingQuery.error.message}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void pricingQuery.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      ) : pricingQuery.isLoading ? (
        <div className="mt-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto apple-card p-2 sm:p-4">
          <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                {['State', 'State fee', 'Retail', 'Payment link', 'Last wholesale', 'Margin vs last', 'Active'].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="border-b border-slate-200 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                    No pricing rows yet — they are seeded automatically at boot.
                  </td>
                </tr>
              ) : (
                rows.map((row) => <StatePricingRow key={row.state} row={row} />)
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'articles_of_organization', label: 'Articles of Organization' },
  { value: 'ein_letter', label: 'EIN confirmation letter' },
  { value: 'operating_agreement', label: 'Operating agreement' },
  { value: 'other', label: 'Other' },
] as const;

const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const;
type AcceptedMime = (typeof ACCEPTED_MIME_TYPES)[number];

function DocumentsPanel({ registrationId }: { registrationId: number }) {
  const utils = trpc.useUtils();
  const documentsQuery = trpc.llcOps.documents.useQuery(
    { id: registrationId },
    { retry: 1, refetchOnWindowFocus: false },
  );
  const invalidate = () => void utils.llcOps.documents.invalidate({ id: registrationId });

  const releaseMutation = trpc.llcOps.releaseDocument.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success('Document released to the client vault.');
    },
    onError: (error) => toast.error(error.message),
  });
  const unreleaseMutation = trpc.llcOps.unreleaseDocument.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success('Document hidden from the client vault.');
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = trpc.llcOps.deleteDocument.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success('Document deleted.');
    },
    onError: (error) => toast.error(error.message),
  });
  const uploadMutation = trpc.llcOps.uploadDocument.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success('Document uploaded and released to the client vault.');
      setLabel('');
      setDocumentType('other');
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (error) => toast.error(error.message),
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [documentType, setDocumentType] = useState<string>('other');
  const [label, setLabel] = useState('');

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error('Choose a PDF, PNG, or JPG file first.');
      return;
    }
    if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Only PDF, PNG, or JPG documents can be uploaded.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 20MB.');
      return;
    }
    const arrayBuffer = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + chunkSize)),
      );
    }
    uploadMutation.mutate({
      registrationId,
      name: file.name.slice(0, 200),
      label: label.trim() || undefined,
      documentType,
      mimeType: file.type as AcceptedMime,
      dataBase64: btoa(binary),
    });
  };

  const documents = documentsQuery.data ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-amber-600" />
        <h4 className="text-sm font-semibold text-slate-900">Client document vault</h4>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Clients see only <span className="font-semibold">released</span> documents. Provider
        mirrors arrive unreleased; review, label, and release them — or upload directly.
      </p>

      {documentsQuery.isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
          Loading documents…
        </div>
      ) : documents.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">No documents for this order yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {documents.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {document.label ?? document.name ?? document.documentType ?? 'Document'}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {document.documentType ?? 'document'} ·{' '}
                  {document.source === 'ops_upload' ? 'ops upload' : 'provider mirror'} · added{' '}
                  {formatDate(document.createdAt)}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    document.releasedAt
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {document.releasedAt ? 'Released' : 'Hidden'}
                </span>
                <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-xs">
                  <a href={document.url} target="_blank" rel="noreferrer">
                    View
                  </a>
                </Button>
                {document.releasedAt ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    disabled={unreleaseMutation.isPending}
                    onClick={() => unreleaseMutation.mutate({ documentId: document.id })}
                  >
                    <EyeOff className="w-3.5 h-3.5 mr-1" />
                    Unrelease
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 px-2 text-xs"
                    disabled={releaseMutation.isPending}
                    onClick={() => releaseMutation.mutate({ documentId: document.id })}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    Release
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm('Delete this document from the vault?')) {
                      deleteMutation.mutate({ documentId: document.id });
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Upload a document (released immediately)
        </h5>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label htmlFor={`doc-type-${registrationId}`} className="mb-1 block text-xs font-medium text-slate-600">
              Document type
            </label>
            <select
              id={`doc-type-${registrationId}`}
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              {DOCUMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`doc-label-${registrationId}`} className="mb-1 block text-xs font-medium text-slate-600">
              Client-facing label (optional)
            </label>
            <Input
              id={`doc-label-${registrationId}`}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Articles of Organization"
              className="h-9 text-sm"
              maxLength={200}
            />
          </div>
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="block w-full max-w-[14rem] text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-amber-700 hover:file:bg-amber-200"
            />
            <Button
              type="button"
              size="sm"
              className="h-9"
              disabled={uploadMutation.isPending}
              onClick={() => void handleUpload()}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span className="ml-1.5">Upload</span>
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">PDF, PNG, or JPG · up to 20MB.</p>
      </div>
    </div>
  );
}

export default function LlcOpsPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = isAuthenticated && user?.role === 'admin';
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const listQuery = trpc.llcOps.listAll.useQuery(undefined, {
    enabled: isAdmin,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
  const refreshMutation = trpc.llcOps.refresh.useMutation({
    onSuccess: (result) => {
      void utils.llcOps.listAll.invalidate();
      toast.success(result.message);
    },
    onError: (error) => toast.error(error.message),
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-8 h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">
              You don't have permission to access the LLC operations dashboard.
            </p>
            <Link href="/">
              <Button className="w-full">
                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const orders = listQuery.data ?? [];
  // Demo/test rows park in payment_required by design and have no wholesale
  // checkout to pay — keep them out of the action banner.
  const needsPayment = orders.filter(
    (order) => order.status === 'payment_required' && !order.isDemo,
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="container max-w-[1400px] mx-auto px-4 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-wider text-slate-500">Operations</p>
            {/* font-sans: the global heading rule applies the marketing serif,
                which read as broken on this internal tooling surface. */}
            <h1 className="mt-1 font-sans text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">LLC filing orders</h1>
            <p className="mt-1 font-sans text-sm text-slate-500">Filings, pricing, and client documents — clients never see this page.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CreateDemoButton />
            <Link href="/admin/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Admin dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* At-a-glance numbers so the eye lands on state, not a spreadsheet. */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(() => {
            const real = orders.filter((order) => !order.isDemo);
            const collected = real
              .filter((order) => order.retailPaidAt && order.retailPriceCents !== null)
              .reduce((sum, order) => sum + (order.retailPriceCents ?? 0), 0);
            const margin = real
              .filter((order) => order.marginCents !== null)
              .reduce((sum, order) => sum + (order.marginCents ?? 0), 0);
            const tiles = [
              { label: 'Filing orders', value: String(real.length) },
              { label: 'Awaiting payment', value: String(needsPayment.length), alert: needsPayment.length > 0 },
              { label: 'Retail collected', value: formatCents(collected) },
              { label: 'Margin to date', value: formatCents(margin) },
            ];
            return tiles.map((tile) => (
              <div key={tile.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-slate-500">{tile.label}</p>
                <p className={`mt-1 font-sans text-2xl font-semibold tabular-nums tracking-tight ${tile.alert ? 'text-amber-600' : 'text-slate-900'}`}>
                  {tile.value}
                </p>
              </div>
            ));
          })()}
        </div>

        {needsPayment.length > 0 ? (
          <section role="alert" className="mt-6 rounded-2xl bg-slate-900 p-5 text-white">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <div>
                <h2 className="font-sans text-base font-semibold tracking-tight text-white">
                  {needsPayment.length} wholesale checkout{needsPayment.length === 1 ? '' : 's'} waiting for payment
                </h2>
                <p className="mt-1 text-sm text-white/70">
                  The provider submits each filing to the state only after its checkout is paid with the company card.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {listQuery.error ? (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="font-sans text-sm font-medium text-red-800">Couldn't load filing orders.</p>
            <p className="mt-1 font-sans text-xs text-red-600">{listQuery.error.message}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void listQuery.refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
            </Button>
          </section>
        ) : listQuery.isLoading ? (
          <div className="mt-8">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        ) : (
          <section className="mt-6 overflow-x-auto apple-card p-2 sm:p-4">
            <table className="w-full min-w-[64rem] border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  {[
                    { heading: 'Order' },
                    { heading: 'Client' },
                    { heading: 'Company' },
                    { heading: 'Status' },
                    { heading: 'Wholesale (COGS)', numeric: true },
                    { heading: 'Retail' },
                    { heading: 'Margin', numeric: true },
                    { heading: 'Actions' },
                  ].map(({ heading, numeric }) => (
                    <th
                      key={heading}
                      className={`border-b border-slate-200 px-4 py-3 font-sans text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${numeric ? 'text-right' : ''}`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <p className="font-sans text-sm font-medium text-slate-700">No filing orders yet</p>
                      <p className="mt-1 font-sans text-xs text-slate-500">New client submissions appear here automatically — or create a demo filing to see the flow.</p>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <Fragment key={order.id}>
                      <tr className="align-top">
                        <td className="border-b border-slate-100 px-4 py-3">
                          <p className="font-mono text-xs font-bold text-slate-900">{order.orderRef}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{order.formationState ?? '—'}</p>
                          {order.isDemo ? (
                            <span
                              className="mt-1 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700"
                              title="Sample filing for presentations — no provider interaction. The client status page shows no demo markers."
                            >
                              Demo
                            </span>
                          ) : null}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <p className="text-sm font-medium text-slate-900">{order.clientName ?? '—'}</p>
                          <p className="mt-1 break-all text-[11px] text-slate-500">{order.clientEmail ?? '—'}</p>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-900">
                          {order.legalName ? `${order.legalName} ${order.entitySuffix}` : 'Untitled draft'}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass(order.status)}`}
                          >
                            {order.status.replaceAll('_', ' ')}
                          </span>
                          {order.lastErrorMessage ? (
                            <p className="mt-2 max-w-[18rem] text-[11px] leading-4 text-slate-500">
                              {order.lastErrorMessage}
                            </p>
                          ) : null}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-right text-sm tabular-nums text-slate-900">
                          {formatCents(order.checkoutTotal)}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            <RetailPriceCell registrationId={order.id} retailPriceCents={order.retailPriceCents} />
                            <PaidCell order={order} />
                          </div>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-right text-sm tabular-nums text-slate-900">
                          {formatCents(order.marginCents)}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {order.status === 'payment_required' && order.checkoutUrl ? (
                              <Button asChild size="sm" className="h-8 rounded-lg px-3 text-xs font-bold">
                                <a href={order.checkoutUrl} target="_blank" rel="noopener noreferrer">
                                  Pay checkout
                                  <ArrowUpRight className="ml-1 w-3 h-3" />
                                </a>
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg px-3 text-xs"
                              disabled={refreshMutation.isPending}
                              onClick={() => refreshMutation.mutate({ id: order.id })}
                            >
                              {refreshMutation.isPending && refreshMutation.variables?.id === order.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3 h-3" />
                              )}
                              <span className="ml-1">Sync</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 rounded-lg px-3 text-xs"
                              onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                            >
                              <FileText className="w-3 h-3" />
                              <span className="ml-1">Documents</span>
                              {expandedId === order.id ? (
                                <ChevronUp className="ml-1 w-3 h-3" />
                              ) : (
                                <ChevronDown className="ml-1 w-3 h-3" />
                              )}
                            </Button>
                            {order.isDemo ? (
                              <>
                                <SendDemoEmailsButton registrationId={order.id} />
                                <RemoveDemoButton registrationId={order.id} />
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {expandedId === order.id ? (
                        <tr>
                          <td colSpan={8} className="border-b border-slate-100 px-4 pb-6 pt-1">
                            <p className="mb-2 font-sans text-[11px] text-slate-400">Last provider sync: {formatDate(order.lastProviderSyncAt)}</p>
                            <DocumentsPanel registrationId={order.id} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </section>
        )}

        <StatePricingSection />

        <p className="mt-6 max-w-3xl text-xs leading-5 text-slate-500">
          This dashboard is internal. Clients never see the provider, the wholesale checkout, or
          costs — their status pages show only branded progress updates, released documents, and
          the retail price you set here. Status also refreshes automatically in the background,
          and every change lands in the ops inbox.
        </p>
      </div>
    </div>
  );
}
