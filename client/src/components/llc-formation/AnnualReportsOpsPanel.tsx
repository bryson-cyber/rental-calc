import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { dateWords, feeWords } from "@shared/llcAnnualReports";
import { OPS_FEE_ACTION_LABELS } from "@shared/llcAnnualReportOps";
import { CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Ops: the order's annual reports on /admin/llc (2026-10-20), inside the expanded order row. The calendar (status,
 * due date, last filed), the fee quote, and each year's report with its status, fixed fee, payment, confirm and filed
 * stamps and last error. The server reads the provider when this opens (at most every 10 minutes) and the hourly
 * sweep keeps it fresh. "Confirm filing" shows only for a paid (or no-fee) report the hand-off missed, and still goes
 * through the server's verified-payment guard. A paid report whose fee changed gets the two fee buttons the ops alerts
 * name: refunded (she pays again, by email link) or absorbed (file it now at our cost).
 */
function when(value: number | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AnnualReportsOpsPanel({ registrationId }: { registrationId: number }) {
  const utils = trpc.useUtils();
  const query = trpc.llcOps.annualReports.useQuery({ id: registrationId }, { retry: 1, refetchOnWindowFocus: false, refetchInterval: 60_000 });
  const confirm = trpc.llcOps.confirmAnnualReport.useMutation({
    onSuccess: (result) => {
      utils.llcOps.annualReports.setData({ id: registrationId }, result.view);
      if (result.outcome === "confirmed" || result.outcome === "already_confirmed") toast.success(result.message);
      else toast.error(result.message);
    },
    onError: (error) => toast.error(error.message),
  });
  const feeAction = {
    onSuccess: (result: { outcome: string; message: string; view: NonNullable<typeof query.data> }) => {
      utils.llcOps.annualReports.setData({ id: registrationId }, result.view);
      if (result.outcome === "reset" || result.outcome === "confirmed" || result.outcome === "already_confirmed") toast.success(result.message);
      else toast.error(result.message);
    },
    onError: (error: { message: string }) => toast.error(error.message),
  };
  const resetPayment = trpc.llcOps.resetAnnualReportPayment.useMutation(feeAction);
  const absorbDifference = trpc.llcOps.absorbAnnualReportDifference.useMutation(feeAction);
  const busy = confirm.isPending || resetPayment.isPending || absorbDifference.isPending;

  if (query.isLoading) return <Skeleton className="mb-5 h-20 w-full rounded-xl" />;
  const view = query.data;
  if (!view || !view.eligible) return null;
  const c = view.compliance;

  return (
    <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4" aria-label="Annual reports" data-annual-reports-ops="">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
        Annual reports
      </p>
      {c ? (
        <p className="mt-1.5 text-xs text-slate-800">
          {c.status ? c.status.replaceAll("_", " ").toLowerCase() : "calendar not read yet"}
          {" · due "}
          {dateWords(c.nextDueDate) ?? "—"}
          {c.lastFiledDate ? ` · last filed ${dateWords(c.lastFiledDate)}` : ""}
          {c.filingRequired === false ? " · state requires none" : ""}
          {c.quotePriceCents !== null ? ` · fee ${feeWords(c.quotePriceCents)}${c.quoteIsMinimum ? " minimum" : ""}` : ""}
          <span className="text-slate-500">{` · read ${when(c.syncedAt)}`}</span>
          {c.lastError ? <span className="text-red-700">{` · last error ${c.lastError}`}</span> : null}
        </p>
      ) : null}
      {view.reports.length === 0 ? (
        <p className="mt-1.5 text-xs text-slate-500">No annual report started yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                {["Year", "Status", "Fee", "Paid", "Confirmed", "Filed", "Last error", ""].map((heading) => (
                  <th key={heading} className="py-1 pr-3 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.reports.map((report) => (
                <tr key={report.id} className="align-top text-slate-800">
                  <td className="py-1 pr-3 font-mono">{report.fiscalYear}</td>
                  <td className="py-1 pr-3">{report.status ?? "not submitted"}</td>
                  <td className="py-1 pr-3 tabular-nums">{report.priceInCents !== null ? feeWords(report.priceInCents) : "—"}</td>
                  <td className="py-1 pr-3">
                    {report.paidAt ? (
                      <span title={report.paymentReference ?? ""}>
                        {feeWords(report.paidCents ?? 0)} · {when(report.paidAt)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-1 pr-3">{when(report.confirmedAt)}</td>
                  <td className="py-1 pr-3">
                    {report.completedAt ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        {when(report.completedAt)}
                        {report.hasDocument ? " · in vault" : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[14rem] py-1 pr-3 text-slate-500">{report.lastError ?? "—"}</td>
                  <td className="space-y-1 py-1">
                    {report.canResetPayment ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg px-2 text-xs"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Refunded in the Whop dashboard? This clears the payment on the ${report.fiscalYear} report and emails her a link to pay ${report.priceInCents !== null ? feeWords(report.priceInCents) : "the fee"}.`)) {
                            resetPayment.mutate({ id: registrationId, reportId: report.id });
                          }
                        }}
                      >
                        {resetPayment.isPending && resetPayment.variables?.reportId === report.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                        <span className="ml-1">{OPS_FEE_ACTION_LABELS.refunded_pay_again}</span>
                      </Button>
                    ) : null}
                    {report.feeChanged ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg px-2 text-xs"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`She paid ${feeWords(report.paidCents ?? 0)}; the fee is ${report.priceInCents !== null ? feeWords(report.priceInCents) : "unknown"}. We cover the difference and hand the ${report.fiscalYear} report to the provider now?`)) {
                            absorbDifference.mutate({ id: registrationId, reportId: report.id });
                          }
                        }}
                      >
                        {absorbDifference.isPending && absorbDifference.variables?.reportId === report.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                        <span className="ml-1">{OPS_FEE_ACTION_LABELS.absorb_difference}</span>
                      </Button>
                    ) : null}
                    {report.canConfirm ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg px-2 text-xs"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Hand the ${report.fiscalYear} annual report to the provider to file now?`)) {
                            confirm.mutate({ id: registrationId, reportId: report.id });
                          }
                        }}
                      >
                        {confirm.isPending && confirm.variables?.reportId === report.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                        <span className="ml-1">Confirm filing</span>
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
