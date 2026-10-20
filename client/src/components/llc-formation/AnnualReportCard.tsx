import { Button } from "@/components/ui/button";
import { AddressFields, FieldBlock, NativeSelect, TextField } from "@/components/llc-formation/FormControls";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ANNUAL_REPORT_MINIMUM_FEE_NOTE,
  feeWords,
  validateAnnualReportAnswers,
  visibleFields,
  type AnnualReportAddressValue,
  type AnnualReportAnswers,
  type AnnualReportValue,
  type MemberAnnualReportField,
} from "@shared/llcAnnualReports";
import { ArrowUpRight, CalendarClock, CheckCircle2, CreditCard, FileText, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * Annual report (the owner, 2026-10-20), on her LLC page once the LLC is official: the due date in words, the state
 * of this year's report in plain words, and the filing itself: the state's questions (shown and hidden as she
 * answers), a review, the submit (the fee is fixed then), the state fee through the same secure hosted checkout as
 * her formation payment, and the hand-off to the state. Filing opens 90 days before the due date (or once overdue);
 * before that the card says the day it opens. No provider or processor names anywhere on this card.
 */

type Stage = "closed" | "form" | "review" | "pay";

const PENDING_WORDS = "Your payment is still being confirmed. This page keeps checking; you will not be charged twice.";

function displayValue(field: MemberAnnualReportField, value: AnnualReportValue | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Not answered";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return [value.line1, value.line2, value.city, `${value.state} ${value.postalCode}`.trim()].filter(Boolean).join(", ");
  if (field.type === "AMOUNT") return feeWords(Math.round(Number(value) * 100));
  const option = field.options.find((candidate) => candidate.value === String(value));
  return option?.label ?? String(value);
}

function QuestionInput({
  field,
  value,
  error,
  onChange,
}: {
  field: MemberAnnualReportField;
  value: AnnualReportValue | null | undefined;
  error?: string;
  onChange: (value: AnnualReportValue | null) => void;
}) {
  const id = `annual-report-${field.fieldId}`;
  const optional = !field.required;
  if (field.type === "ADDRESS") {
    const address = (value && typeof value === "object" ? value : { line1: "", city: "", state: "", postalCode: "", country: "USA" }) as AnnualReportAddressValue;
    return (
      <FieldBlock label={field.label} htmlFor={`${id}-line1`} error={error} optional={optional}>
        {/* An optional company detail left as is isn't sent, so the state keeps what it has on file. */}
        {optional && field.group === "COMPANY_DETAIL" ? (
          <p className="mb-2 text-xs leading-5 text-muted-foreground">Leave this as is to keep what's on file with the state.</p>
        ) : null}
        <AddressFields
          idPrefix={id}
          value={{ ...address, country: "US" }}
          onChange={(next) => onChange({ line1: next.line1 ?? "", line2: next.line2, city: next.city ?? "", state: next.state ?? "", postalCode: next.postalCode ?? "", country: address.country || "USA" })}
          errors={{}}
        />
      </FieldBlock>
    );
  }
  if (field.type === "SELECT") {
    return (
      <NativeSelect
        id={id}
        label={field.label}
        optional={optional}
        error={error}
        options={field.options}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value || null)}
        placeholder="Pick an answer"
      />
    );
  }
  if (field.type === "RADIO" || field.type === "BOOLEAN") {
    const options = field.type === "BOOLEAN" ? [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] : field.options;
    const current = typeof value === "boolean" ? String(value) : typeof value === "string" ? value : "";
    return (
      <FieldBlock label={field.label} htmlFor={`${id}-0`} error={error} optional={optional}>
        <div role="radiogroup" aria-label={field.label} className="flex flex-wrap gap-2">
          {options.map((option, index) => {
            const selected = current === option.value;
            return (
              <button
                key={option.value}
                id={`${id}-${index}`}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(field.type === "BOOLEAN" ? option.value === "true" : option.value)}
                className={cn(
                  "min-h-11 rounded-lg border px-4 text-sm font-medium transition-colors",
                  selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:border-primary/40",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </FieldBlock>
    );
  }
  const isNumber = field.type === "NUMBER" || field.type === "AMOUNT";
  return (
    <TextField
      id={id}
      label={field.type === "AMOUNT" ? `${field.label} (in dollars)` : field.label}
      optional={optional}
      error={error}
      type={field.type === "DATE" ? "date" : "text"}
      inputMode={isNumber ? "decimal" : undefined}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-11"
    />
  );
}

/** The state fee step: one button to the secure hosted checkout, which brings her back to this page. */
function AnnualReportPayment({ registrationId, reportId, priceCents }: { registrationId: number; reportId: number; priceCents: number }) {
  const checkout = trpc.llc.createAnnualReportCheckout.useMutation({
    onSuccess: (result) => {
      toast.success("Opening secure checkout...");
      const win = window.open(result.checkoutUrl, "_blank");
      if (!win) window.location.href = result.checkoutUrl;
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <div className="mt-4 rounded-xl border border-primary/20 bg-background p-4" data-annual-report-payment="">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CreditCard className="size-4 text-primary" aria-hidden="true" />
          State fee
        </p>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{feeWords(priceCents)}</p>
      </div>
      <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
        This is the state's own fee, with nothing added by us. As soon as your payment confirms, we send your report to the state.
      </p>
      <Button className="mt-3 min-h-11" disabled={checkout.isPending} onClick={() => checkout.mutate({ id: registrationId, reportId })}>
        {checkout.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : null}
        Pay the {feeWords(priceCents)} state fee
        <ArrowUpRight className="ml-1.5 size-4" aria-hidden="true" />
      </Button>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">State fees are paid to the state and are non-refundable.</p>
    </div>
  );
}

/** Back from the hosted checkout (?annual_report=paid&payment_id=…): read once at mount. */
function readCheckoutReturn(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("annual_report") !== "paid") return null;
  const value = params.get("payment_id") ?? params.get("receipt_id");
  return value && /^pay_[A-Za-z0-9]+$/.test(value) ? value : null;
}

export function AnnualReportCard({ registrationId }: { registrationId: number }) {
  const utils = trpc.useUtils();
  const viewQuery = trpc.llc.annualReport.useQuery({ id: registrationId }, { retry: 1, refetchOnWindowFocus: false });
  const view = viewQuery.data;
  const [stage, setStage] = useState<Stage>("closed");
  const [answers, setAnswers] = useState<AnnualReportAnswers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const [priceNotice, setPriceNotice] = useState("");
  const [payment, setPayment] = useState<{ reportId: number; priceCents: number } | null>(null);
  const [doneMessage, setDoneMessage] = useState("");
  const [returnedPaymentId] = useState(readCheckoutReturn);
  const [returnNotice, setReturnNotice] = useState(returnedPaymentId ? "Confirming your payment…" : "");

  const formQuery = trpc.llc.annualReportForm.useQuery({ id: registrationId }, { enabled: stage === "form" || stage === "review", retry: 1, refetchOnWindowFocus: false });
  const form = formQuery.data;
  const submit = trpc.llc.submitAnnualReport.useMutation();
  const confirmReturn = trpc.llc.confirmAnnualReportPayment.useMutation();

  const refresh = () => {
    void utils.llc.annualReport.invalidate({ id: registrationId });
    void utils.llc.documents.invalidate({ id: registrationId });
  };

  // Her saved answers (or her company details) fill the form once per load.
  useEffect(() => {
    if (form && loadedFor !== form.fiscalYear) {
      setAnswers(form.answers);
      setLoadedFor(form.fiscalYear);
    }
  }, [form, loadedFor]);

  // The reminder link (?file=annual-report) opens the filing straight away, once filing is open; a saved report
  // waiting for its fee (the pay-again email) opens the payment.
  useEffect(() => {
    if (!view?.canFile || typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("file") !== "annual-report") return;
    const waiting = view.current?.needsPayment && view.current.priceCents !== null ? { reportId: view.current.id, priceCents: view.current.priceCents } : null;
    if (waiting) setPayment((current) => current ?? waiting);
    setStage((current) => (current === "closed" ? (waiting ? "pay" : "form") : current));
  }, [view?.canFile, view?.current?.needsPayment, view?.current?.id, view?.current?.priceCents]);

  // Back from the hosted checkout: the server re-reads the payment and verifies it against her own report.
  useEffect(() => {
    if (!returnedPaymentId) return;
    let stopped = false;
    let timer: number | undefined;
    const attempt = (tries: number) => {
      confirmReturn.mutate(
        { id: registrationId, paymentId: returnedPaymentId },
        {
          onSuccess: (result) => {
            if (stopped) return;
            if (result.state === "confirmed") {
              setReturnNotice("");
              setDoneMessage(result.message);
              refresh();
              return;
            }
            setReturnNotice(PENDING_WORDS);
            if (tries < 10) timer = window.setTimeout(() => attempt(tries + 1), 3_000);
          },
          onError: () => {
            if (!stopped) setReturnNotice("Your payment is still being confirmed. Our team will make sure your report is filed.");
          },
        },
      );
    };
    attempt(1);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
    // Runs once for the payment the page came back with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => (form ? visibleFields(form.fields, answers) : []), [form, answers]);

  if (viewQuery.isLoading || !view) return null;

  const current = view.current;
  const feeNote = view.quote
    ? view.quote.priceCents === 0
      ? "There's no state fee for this report."
      : view.quote.isMinimum
        ? `The state fee starts at ${feeWords(view.quote.priceCents)}. ${ANNUAL_REPORT_MINIMUM_FEE_NOTE}`
        : `The state fee is ${feeWords(view.quote.priceCents)}, with nothing added by us.`
    : null;
  const done = view.cardState === "filed" || view.cardState === "not_required";
  const toReview = () => {
    if (!form) return;
    const result = validateAnnualReportAnswers(form.fields, answers);
    setErrors(result.errors);
    if (result.ok) setStage("review");
    else toast.error("A few answers need a look.");
  };
  const send = () => {
    if (!form || submit.isPending) return;
    submit.mutate(
      { id: registrationId, answers: answers as Record<string, string | number | boolean | AnnualReportAddressValue | null> },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setErrors(result.fieldErrors);
            setStage("form");
            toast.error(result.message);
            return;
          }
          // No fee: only a confirmed hand-off says it's on its way; otherwise the card shows what's saved.
          if (result.confirmOutcome === "confirmed" || result.confirmOutcome === "already_confirmed") {
            setStage("closed");
            setDoneMessage("There's no state fee, so we're sending your report to the state now.");
            refresh();
            return;
          }
          if (result.confirmOutcome || result.priceCents === null || result.priceCents <= 0) {
            setStage("closed");
            setPayment(null);
            toast.success("Your answers are saved.");
            refresh();
            return;
          }
          setPriceNotice(
            result.priceChanged && result.previousPriceCents !== null
              ? `With your answers, the state fee is ${feeWords(result.priceCents)} (it was ${feeWords(result.previousPriceCents)} before).`
              : "",
          );
          setPayment({ reportId: result.reportId, priceCents: result.priceCents });
          setStage("pay");
          refresh();
        },
        onError: (error) => {
          // A refusal (say, her payment landed meanwhile): the card re-reads and shows where it stands.
          toast.error(error.message);
          setStage("closed");
          refresh();
        },
      },
    );
  };

  return (
    <div id="annual-report" className={cn("apple-card p-5", done ? "" : "border-primary/25 bg-primary/5")} data-annual-report-state={view.cardState}>
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10">
          {view.cardState === "filed" ? (
            <CheckCircle2 className="size-4 text-emerald-700" aria-hidden="true" />
          ) : (
            <CalendarClock className="size-4 text-primary" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Annual report</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">{view.headline}</h3>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{view.body}</p>
          {view.dueDateWords && view.cardState !== "not_required" ? (
            <p className="mt-2 text-[13px] font-medium text-foreground">Due {view.dueDateWords}</p>
          ) : null}
          {view.opensOnWords && !view.canFile ? (
            <p className="mt-1 text-[13px] font-medium text-primary" data-annual-report-opens="">
              Opens on {view.opensOnWords}
            </p>
          ) : null}
          {doneMessage ? (
            <p role="status" className="mt-3 flex items-center gap-2 text-[13px] font-medium text-emerald-700">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {doneMessage}
            </p>
          ) : null}
          {returnNotice ? <p role="status" className="mt-3 text-[13px] font-medium text-primary">{returnNotice}</p> : null}

          {stage === "closed" && view.canFile && !doneMessage ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {current?.needsPayment && current.priceCents !== null ? (
                <Button className="min-h-11 px-5" onClick={() => { setPayment({ reportId: current.id, priceCents: current.priceCents ?? 0 }); setStage("pay"); }}>
                  Pay the {feeWords(current.priceCents)} state fee
                </Button>
              ) : (
                <Button className="min-h-11 px-5" onClick={() => setStage("form")}>
                  File my annual report
                </Button>
              )}
              {current?.needsPayment && current.canEdit ? (
                <button type="button" className="min-h-11 text-[13px] font-medium text-primary hover:underline" onClick={() => setStage("form")}>
                  Change my answers
                </button>
              ) : null}
            </div>
          ) : null}
          {stage === "closed" && view.canFile && feeNote && !current?.needsPayment ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{feeNote}</p> : null}

          {stage === "form" || stage === "review" ? (
            <div className="mt-5 border-t border-border pt-5" data-annual-report-flow={stage}>
              {formQuery.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Loading the state's questions…
                </p>
              ) : formQuery.isError || !form ? (
                <p role="alert" className="text-sm text-muted-foreground">{formQuery.error?.message ?? "The state's questions couldn't be loaded. Please try again in a few minutes."}</p>
              ) : stage === "form" ? (
                <div className="space-y-5">
                  <p className="text-[13px] leading-5 text-muted-foreground">
                    Your {form.fiscalYear} report for {view.stateName}. We filled in what we already know about your company; check it and answer the rest.
                  </p>
                  {shown.map((field) => (
                    <QuestionInput
                      key={field.fieldId}
                      field={field}
                      value={answers[field.fieldId]}
                      error={errors[field.fieldId]}
                      onChange={(value) => {
                        setAnswers((previous) => ({ ...previous, [field.fieldId]: value }));
                        setErrors((previous) => {
                          const { [field.fieldId]: _cleared, ...rest } = previous;
                          return rest;
                        });
                      }}
                    />
                  ))}
                  {feeNote ? <p className="text-xs leading-5 text-muted-foreground">{feeNote}</p> : null}
                  <div className="flex flex-wrap gap-3">
                    <Button className="min-h-11 px-5" onClick={toReview}>Review my answers</Button>
                    <Button variant="ghost" className="min-h-11" onClick={() => setStage("closed")}>Not now</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="size-4 text-primary" aria-hidden="true" />
                    Review your answers
                  </p>
                  <dl className="divide-y divide-border rounded-lg border border-border">
                    {shown.map((field) => (
                      <div key={field.fieldId} className="grid gap-1 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
                        <dt className="text-[12px] text-muted-foreground">{field.label}</dt>
                        <dd className="text-[13px] font-medium text-foreground">{displayValue(field, answers[field.fieldId])}</dd>
                      </div>
                    ))}
                  </dl>
                  {feeNote ? <p className="text-xs leading-5 text-muted-foreground">{feeNote}</p> : null}
                  <div className="flex flex-wrap gap-3">
                    <Button className="min-h-11 px-5" disabled={submit.isPending} onClick={send}>
                      {submit.isPending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
                      Submit my answers
                    </Button>
                    <Button variant="ghost" className="min-h-11" onClick={() => setStage("form")}>Change an answer</Button>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">Submitting sets your state fee. Nothing is filed until the fee is paid.</p>
                </div>
              )}
            </div>
          ) : null}

          {stage === "pay" && payment ? (
            <div className="mt-2">
              {priceNotice ? <p role="status" className="mt-3 rounded-lg bg-primary/10 p-3 text-[13px] font-medium text-foreground">{priceNotice}</p> : null}
              <AnnualReportPayment registrationId={registrationId} reportId={payment.reportId} priceCents={payment.priceCents} />
              {current?.canEdit ? (
                <button type="button" className="mt-2 min-h-11 text-[13px] font-medium text-primary hover:underline" onClick={() => setStage("form")}>
                  Change my answers
                </button>
              ) : null}
            </div>
          ) : null}

          {view.history.length > 0 ? (
            <ul className="mt-4 space-y-1 border-t border-border pt-3 text-[12px] text-muted-foreground">
              {view.history.map((item) => (
                <li key={item.fiscalYear}>
                  {item.fiscalYear}: {item.filedOnWords ? `Filed on ${item.filedOnWords}` : item.statusWords}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
