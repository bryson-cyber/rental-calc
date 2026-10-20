/**
 * Annual report ops words shared by the server's ops alerts and the /admin/llc panel (2026-10-20 review), so an alert
 * names exactly the button ops press. Ops-only: never shown to a member (her words live in llcAnnualReports.ts).
 *
 * - refunded_pay_again: after ops refunded her payment in the payment processor, clear the payment and checkout from
 *   the unfiled report and email her a link to pay the fee on file.
 * - absorb_difference: we cover the gap; the payment on file counts as the fee on file and the report is handed over.
 */
export const OPS_FEE_ACTION_LABELS = {
  refunded_pay_again: "Fee changed: refunded — let her pay again",
  absorb_difference: "Difference absorbed — file it",
} as const;
