/**
 * The annual report checkout's metadata (2026-10-20): a leaf module with no app imports, so the Whop webhook
 * (whopRetailWebhook.ts) can tell an annual report payment apart from a formation payment without loading the
 * annual report service. The metadata only routes; payments.ts re-reads the payment from Whop and verifies it.
 *
 * Formation payments carry rc_checkout_kind "llc_filing" (whopRetailCheckout.readLlcPaymentMetadata), so neither
 * reader ever accepts the other's payment.
 */
export const ANNUAL_REPORT_CHECKOUT_METADATA_VERSION = "rc_llc_annual_report_v1";
export const ANNUAL_REPORT_CHECKOUT_KIND = "llc_annual_report";

export function readAnnualReportPaymentMetadata(payment: { metadata?: Record<string, unknown> | null } | null | undefined): {
  reportId: number;
  registrationId: number;
  quoteHash: string;
} | null {
  const metadata = payment?.metadata;
  if (!metadata || metadata.rc_metadata_version !== ANNUAL_REPORT_CHECKOUT_METADATA_VERSION || metadata.rc_checkout_kind !== ANNUAL_REPORT_CHECKOUT_KIND) {
    return null;
  }
  const reportId = Number(metadata.rc_llc_annual_report_id);
  const registrationId = Number(metadata.rc_llc_registration_id);
  const quoteHash = String(metadata.rc_llc_annual_report_quote_hash || "");
  if (!Number.isSafeInteger(reportId) || reportId <= 0 || !Number.isSafeInteger(registrationId) || registrationId <= 0 || !/^[a-f0-9]{64}$/.test(quoteHash)) {
    return null;
  }
  return { reportId, registrationId, quoteHash };
}

// The webhook body is untyped JSON; only the routing fields are read here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isAnnualReportPaymentPayload(payload: any): boolean {
  return Boolean(payload?.type === "payment.succeeded" && payload?.data?.id && readAnnualReportPaymentMetadata(payload.data));
}
