import nodemailer from "nodemailer";
import { notifyOwner } from "../_core/notification";
import { getOpsConfig } from "./config";
import type { WhopFormationSnapshot } from "../llc/whop";

/**
 * Operational alerts for the reseller workflow. Delivery is best-effort and
 * never throws: a failed alert must never fail or roll back a submission.
 * Channels, all attempted in parallel: HubSpot/any SMTP relay (SMTP_* env),
 * Resend (RESEND_API_KEY), and the Manus owner notification service.
 */
export type OpsAlert = {
  subject: string;
  lines: string[];
};

function formatCents(total: number | null | undefined): string {
  if (total === null || total === undefined) return "unknown";
  return `$${(total / 100).toFixed(2)}`;
}

/**
 * Client-controlled values (legal names, provider messages) are flattened to a
 * single line before interpolation so a crafted value cannot inject fake
 * lines (e.g. a spoofed "Pay here:" URL) into an ops alert.
 */
function clean(value: string | null | undefined, maxLength = 200): string {
  return (value ?? "").replace(/[\r\n\t]+/g, " ").slice(0, maxLength).trim();
}

async function sendViaResend(alert: OpsAlert): Promise<boolean> {
  let config;
  try {
    config = getOpsConfig();
  } catch {
    return false;
  }
  if (!config.resendApiKey) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.resendFrom,
        to: [config.opsEmail],
        subject: alert.subject,
        text: alert.lines.join("\n"),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.warn("[Ops] Resend alert failed", {
        httpStatus: response.status,
        subject: alert.subject,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Ops] Resend alert errored", {
      subject: alert.subject,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}

/** HubSpot (or any) SMTP relay — the owner's preferred channel. */
async function sendViaSmtp(alert: OpsAlert): Promise<boolean> {
  let config;
  try {
    config = getOpsConfig();
  } catch {
    return false;
  }
  if (!config.smtp) return false;

  try {
    const transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
    });
    await transport.sendMail({
      from: config.smtp.from,
      to: config.opsEmail,
      subject: alert.subject,
      text: alert.lines.join("\n"),
    });
    return true;
  } catch (error) {
    console.warn("[Ops] SMTP alert errored", {
      subject: alert.subject,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}

async function sendViaManus(alert: OpsAlert): Promise<boolean> {
  try {
    return await notifyOwner({
      title: alert.subject,
      content: alert.lines.join("\n"),
    });
  } catch {
    return false;
  }
}

/** Returns true when at least one channel accepted the alert. */
export async function sendOpsAlert(alert: OpsAlert): Promise<boolean> {
  const [smtpOk, resendOk, manusOk] = await Promise.all([
    sendViaSmtp(alert),
    sendViaResend(alert),
    sendViaManus(alert),
  ]);
  const delivered = smtpOk || resendOk || manusOk;
  if (!delivered) {
    console.error(
      "[Ops] ALERT NOT DELIVERED on any channel — check SMTP_* / RESEND_API_KEY / notification configuration",
      { subject: alert.subject },
    );
  }
  return delivered;
}

export function checkoutReadyAlert(params: {
  registrationId: number;
  legalName: string;
  formationState: string;
  checkoutUrl: string;
  checkoutTotal: number | null;
  retailPriceCents: number | null;
  accountEmailAlias: string;
  retailPaid: boolean;
}): OpsAlert {
  const margin =
    params.retailPriceCents !== null && params.checkoutTotal !== null
      ? formatCents(params.retailPriceCents - params.checkoutTotal)
      : "set a retail price to track";
  const legalName = clean(params.legalName, 180);
  return {
    subject: `ACTION: Pay Whop checkout — ${legalName} (order #${params.registrationId})`,
    lines: [
      `A new LLC filing is ready. Whop will submit it to the state as soon as the checkout below is paid with the company card.`,
      ``,
      `Company: ${legalName}`,
      `Formation state: ${clean(params.formationState, 20)}`,
      `Order: #${params.registrationId}`,
      `Whop account email alias: ${clean(params.accountEmailAlias, 320)}`,
      ``,
      `Wholesale total (COGS): ${formatCents(params.checkoutTotal)}`,
      `Margin: ${margin}`,
      `Retail collected at submit: ${params.retailPaid ? "yes" : "no"}`,
      ``,
      `Pay here: ${params.checkoutUrl}`,
    ],
  };
}

export function statusChangeAlert(params: {
  registrationId: number;
  legalName: string;
  fromStatus: string;
  toStatus: string;
  note: string;
  snapshot: WhopFormationSnapshot | null;
}): OpsAlert {
  const legalName = clean(params.legalName, 180);
  const lines = [
    `Order #${params.registrationId} — ${legalName}`,
    `Status: ${clean(params.fromStatus, 40)} → ${clean(params.toStatus, 40)}`,
    `Detail: ${clean(params.note, 500)}`,
  ];

  const documents = params.snapshot?.documents ?? [];
  if (documents.length > 0) {
    lines.push(``, `Documents available:`);
    for (const document of documents) {
      lines.push(
        `- ${document.name ?? document.document_type ?? "document"}: ${document.download_url ?? "no link"}`,
      );
    }
  }

  const signatures = (params.snapshot?.signatures ?? []).filter((signature) =>
    /pending|await|required/i.test(signature.status ?? ""),
  );
  if (signatures.length > 0) {
    lines.push(
      ``,
      `Founder signatures needed — relay these signing links to the client under your brand:`,
    );
    for (const signature of signatures) {
      lines.push(
        `- ${signature.url ?? "no link"}${signature.expires_at ? ` (expires ${signature.expires_at})` : ""}`,
      );
    }
  }

  if (params.snapshot?.ein_registered === true) {
    lines.push(``, `EIN: registered with the IRS.`);
  } else if (params.snapshot?.state_registered === true) {
    lines.push(``, `State filing: registered. EIN still in progress.`);
  }

  if (params.toStatus === "completed") {
    lines.push(
      ``,
      `This filing is complete — send the client their branded completion email and any documents above.`,
    );
  }

  return {
    subject: `${params.toStatus === "completed" ? "DONE" : params.toStatus === "action_required" ? "ATTENTION" : "Update"}: ${legalName} (order #${params.registrationId}) → ${clean(params.toStatus, 40)}`,
    lines,
  };
}

export function submissionProblemAlert(params: {
  registrationId: number;
  legalName: string;
  errorType: string;
  message: string;
  uncertain: boolean;
}): OpsAlert {
  const legalName = clean(params.legalName, 180);
  return {
    subject: `ATTENTION: Order #${params.registrationId} (${legalName}) needs review`,
    lines: [
      `The automatic Whop submission for order #${params.registrationId} did not complete.`,
      ``,
      `Company: ${legalName}`,
      `Error type: ${clean(params.errorType, 128)}`,
      `Detail: ${clean(params.message, 500)}`,
      params.uncertain
        ? `Outcome is UNCERTAIN — check the Whop dashboard before retrying so a duplicate is not created.`
        : `The client's draft is intact. Review the ops dashboard to correct and retry.`,
    ],
  };
}
