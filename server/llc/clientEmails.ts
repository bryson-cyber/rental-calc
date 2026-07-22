import nodemailer from "nodemailer";
import { and, asc, desc, eq, gt, isNotNull, like } from "drizzle-orm";
import {
  llcDocuments,
  llcEmailLog,
  llcRegistrations,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { getOpsConfig } from "../ops/config";
import { LLC_STATE_NAMES } from "../../shared/llc";
import { getStatePricing } from "./pricing";
import { isDemoSubmissionKey } from "./demoMarker";

/**
 * Client-facing transactional emails for the LLC filing lifecycle.
 *
 * STRICT white-label: nothing rendered here may ever name the wholesale
 * provider or carry a wholesale number — templates are built exclusively from
 * client-facing fields (legal name, state, snapshotted retail price, the
 * owner's hosted payment link, and the branded status page URL).
 *
 * Reliability mirrors the ops-alert design: delivery is best-effort and never
 * throws, and every calling seam fires these with `void …().catch(() => {})`
 * so an email failure can never affect a filing or an ops action. Send-once
 * for the lifecycle emails is enforced by claiming the unique
 * (registrationId, emailType) row in llc_email_log BEFORE sending; the claim
 * is deleted when the send fails so a retrigger can retry.
 */

export type LlcLifecycleEmailType =
  | "application_received"
  | "payment_confirmed"
  | "formation_complete";

/**
 * documents_released rows store a unique suffix after this prefix so every
 * batch send keeps its own row under the unique (registrationId, emailType)
 * key; the latest sentAt drives the batching window.
 */
export const DOCUMENTS_EMAIL_TYPE = "documents_released";
export const DOCUMENTS_BATCH_WINDOW_MS = 10 * 60 * 1000;

export type ClientEmailContent = {
  subject: string;
  text: string;
  html: string;
};

export type ClientEmailSendOutcome =
  | "sent"
  | "skipped_no_email"
  | "skipped_duplicate"
  | "skipped_batched"
  | "skipped_no_documents"
  | "skipped_unavailable"
  | "skipped_test"
  | "failed";

const SIGN_OFF = "— The Coach Inayah team";

/**
 * Client-controlled values (legal names, document labels) are flattened to a
 * single line and capped before interpolation — same defence as ops alerts.
 */
function clean(value: string | null | undefined, maxLength = 200): string {
  return (value ?? "").replace(/[\r\n\t]+/g, " ").slice(0, maxLength).trim();
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function stateDisplayName(state: string | null | undefined): string {
  if (!state) return "your state";
  return (
    (LLC_STATE_NAMES as Record<string, string>)[state.toUpperCase()] ?? state
  );
}

function companyDisplayName(params: {
  legalName: string | null;
  entitySuffix: string;
}): string {
  const legal = clean(params.legalName, 180);
  return legal ? `${legal} ${params.entitySuffix}` : "Your LLC";
}

/** Branded status page for one registration; absolute when APP_BASE_URL is set. */
function statusUrl(registrationId: number): string {
  const base = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  const path = `/llc/status/${registrationId}`;
  return base ? `${base}${path}` : path;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Split-capture: odd-indexed tokens are URLs (detected in the raw text so
// escaping can never leak entities into an href).
const URL_TOKEN = /(https?:\/\/[^\s<>"')\]]+)/g;

/**
 * Minimal personal-style HTML (escaped paragraphs, bare URLs linked) —
 * deliberately no heavy branded wrapper, matching this app's transactional
 * email style so messages land in the primary inbox.
 */
function textToHtml(text: string): string {
  const linked = text
    .split(URL_TOKEN)
    .map((token, index) => {
      if (index % 2 === 1) {
        const url = token.replace(/[.,!?;:]+$/, "");
        const trailing = token.slice(url.length);
        return `<a href="${escapeHtml(url)}" style="color:#1a56db;">${escapeHtml(url)}</a>${escapeHtml(trailing)}`;
      }
      return escapeHtml(token);
    })
    .join("");
  const paragraphs = linked
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1e293b;">${paragraph.replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${paragraphs}</body></html>`;
}

function finalize(subject: string, lines: string[]): ClientEmailContent {
  const text = lines.join("\n");
  return { subject, text, html: textToHtml(text) };
}

// ─── Templates (pure renderers, exported for tests) ───

export function renderApplicationReceivedEmail(params: {
  registrationId: number;
  legalName: string | null;
  entitySuffix: string;
  formationState: string | null;
  retailPriceCents: number | null;
  paymentLinkUrl: string | null;
}): ClientEmailContent {
  const company = companyDisplayName(params);
  const state = stateDisplayName(params.formationState);
  const lines = [
    `We've received your application to form ${company} in ${state}.`,
    ``,
  ];
  if (params.retailPriceCents !== null) {
    lines.push(`Total: ${formatUsd(params.retailPriceCents)}`);
  }
  if (params.paymentLinkUrl) {
    lines.push(`Complete your payment here: ${params.paymentLinkUrl}`);
  } else {
    lines.push(`We'll send your payment link shortly.`);
  }
  lines.push(
    `Your filing begins as soon as payment is received.`,
    ``,
    `Track your filing any time: ${statusUrl(params.registrationId)}`,
    ``,
    SIGN_OFF,
  );
  return finalize("Your LLC application is in — one step left", lines);
}

export function renderPaymentConfirmedEmail(params: {
  registrationId: number;
  legalName: string | null;
  entitySuffix: string;
  formationState: string | null;
  retailPriceCents: number | null;
}): ClientEmailContent {
  const company = companyDisplayName(params);
  const state = stateDisplayName(params.formationState);
  const amount =
    params.retailPriceCents !== null
      ? ` of ${formatUsd(params.retailPriceCents)}`
      : "";
  const lines = [
    `We've received your payment${amount} for ${company}. Your ${state} filing is now underway.`,
    ``,
    `What happens next:`,
    `1. We file your LLC with the state`,
    `2. The state approves your formation`,
    `3. We secure your federal EIN`,
    ``,
    `This typically takes a few weeks and varies by state — we'll email you at each milestone.`,
    ``,
    `Track your filing any time: ${statusUrl(params.registrationId)}`,
    ``,
    SIGN_OFF,
  ];
  return finalize(
    `Payment received — your ${state} filing is underway`,
    lines,
  );
}

export function renderFormationCompleteEmail(params: {
  registrationId: number;
  legalName: string | null;
  entitySuffix: string;
}): ClientEmailContent {
  const company = companyDisplayName(params);
  const lines = [
    `Congratulations — ${company} is officially formed!`,
    ``,
    `Your state approval is complete and your federal EIN has been secured. Your documents will appear in your account as our team delivers them.`,
    ``,
    `View your filing: ${statusUrl(params.registrationId)}`,
    ``,
    `Your LLC is ready to hold your first rental property — explore the tools anytime.`,
    ``,
    SIGN_OFF,
  ];
  return finalize(`${company} is officially formed`, lines);
}

export function renderDocumentsReleasedEmail(params: {
  registrationId: number;
  legalName: string | null;
  entitySuffix: string;
  /** Display names of the documents in this batch (already client-facing). */
  documents: string[];
}): ClientEmailContent {
  const company = companyDisplayName(params);
  const lines = [`New documents for ${company} are in your account:`, ``];
  if (params.documents.length > 0) {
    for (const name of params.documents) {
      lines.push(`- ${clean(name, 200) || "Document"}`);
    }
  } else {
    lines.push(`- Your latest formation documents`);
  }
  lines.push(
    ``,
    `View and download them any time: ${statusUrl(params.registrationId)}`,
    ``,
    SIGN_OFF,
  );
  return finalize(`New documents for ${company}`, lines);
}

// ─── Transport (same SMTP relay + HubSpot fallback as ops alerts) ───

/**
 * From address for client emails: LLC_EMAIL_FROM when set, otherwise the
 * SMTP config's from (which already falls back HUBSPOT_SMTP_FROM → OPS_EMAIL).
 */
function resolveFromAddress(smtpFrom: string): string {
  return process.env.LLC_EMAIL_FROM?.trim() || smtpFrom;
}

/** Best-effort delivery; returns false (never throws) on any failure. */
async function deliverClientEmail(
  to: string,
  content: ClientEmailContent,
): Promise<boolean> {
  let config: ReturnType<typeof getOpsConfig>;
  try {
    config = getOpsConfig();
  } catch {
    console.warn("[LLC ClientEmail] Ops configuration missing; email not sent", {
      subject: content.subject,
    });
    return false;
  }
  if (!config.smtp) {
    console.warn("[LLC ClientEmail] SMTP relay not configured; email not sent", {
      subject: content.subject,
    });
    return false;
  }

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
      from: resolveFromAddress(config.smtp.from),
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return true;
  } catch (error) {
    console.warn("[LLC ClientEmail] SMTP send errored", {
      subject: content.subject,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}

// ─── Send log (claims + batching window) ───

const DUPLICATE_PATTERN = /duplicate|ER_DUP/i;

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Claim-by-unique-insert: false means the email already went out. */
async function claimSendOnce(
  db: Db,
  registrationId: number,
  emailType: string,
): Promise<boolean> {
  try {
    await db.insert(llcEmailLog).values({ registrationId, emailType });
    return true;
  } catch (error) {
    if (error instanceof Error && DUPLICATE_PATTERN.test(error.message)) {
      return false;
    }
    throw error;
  }
}

/** Delete a claim after a failed send so a retrigger can retry. */
async function releaseClaim(
  db: Db,
  registrationId: number,
  emailType: string,
): Promise<void> {
  await db
    .delete(llcEmailLog)
    .where(
      and(
        eq(llcEmailLog.registrationId, registrationId),
        eq(llcEmailLog.emailType, emailType),
      ),
    );
}

/** Most recent documents email for a registration (any suffixed row). */
async function lastDocumentsEmailAt(
  db: Db,
  registrationId: number,
): Promise<Date | null> {
  const rows = await db
    .select()
    .from(llcEmailLog)
    .where(
      and(
        eq(llcEmailLog.registrationId, registrationId),
        like(llcEmailLog.emailType, `${DOCUMENTS_EMAIL_TYPE}%`),
      ),
    )
    .orderBy(desc(llcEmailLog.sentAt), desc(llcEmailLog.id))
    .limit(1);
  return rows[0]?.sentAt ?? null;
}

// ─── Data access ───

async function loadRecipientContext(userId: number, registrationId: number) {
  const db = await getDb();
  if (!db) return null;

  const registrationRows = await db
    .select()
    .from(llcRegistrations)
    .where(
      and(
        eq(llcRegistrations.id, registrationId),
        eq(llcRegistrations.userId, userId),
      ),
    )
    .limit(1);
  const registration = registrationRows[0];
  if (!registration) return null;

  const userRows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const email = userRows[0]?.email?.trim() || null;

  return { db, registration, email };
}

async function listReleasedDocumentsSince(
  db: Db,
  registrationId: number,
  since: Date | null,
) {
  const conditions = [
    eq(llcDocuments.registrationId, registrationId),
    isNotNull(llcDocuments.releasedAt),
  ];
  if (since) conditions.push(gt(llcDocuments.releasedAt, since));
  return db
    .select()
    .from(llcDocuments)
    .where(and(...conditions))
    .orderBy(asc(llcDocuments.releasedAt), asc(llcDocuments.id));
}

function documentDisplayName(row: {
  label: string | null;
  name: string | null;
  documentType: string | null;
}): string {
  return row.label ?? row.name ?? row.documentType ?? "Document";
}

/** Best-effort read of the state's client-facing payment link. */
async function bestEffortPaymentLink(
  formationState: string | null,
): Promise<string | null> {
  if (!formationState) return null;
  try {
    return (await getStatePricing(formationState)).paymentLinkUrl;
  } catch {
    return null;
  }
}

// ─── Lifecycle sends (claim → send → release-on-failure; never throw) ───

async function sendLifecycleEmail(
  emailType: LlcLifecycleEmailType,
  params: { userId: number; registrationId: number },
  render: (
    registration: typeof llcRegistrations.$inferSelect,
  ) => Promise<ClientEmailContent> | ClientEmailContent,
): Promise<ClientEmailSendOutcome> {
  try {
    const context = await loadRecipientContext(
      params.userId,
      params.registrationId,
    );
    if (!context) return "skipped_unavailable";
    // Test/demo rows never email real recipients — the admin previews these
    // templates explicitly through sendDemoLifecycleEmails instead. Skipped
    // BEFORE the claim so nothing is burned.
    if (context.registration.isTest || isDemoSubmissionKey(context.registration.submissionKey)) {
      return "skipped_test";
    }
    // Recipient is the registration owner's account email; skip silently
    // (without burning the claim) when it is missing.
    if (!context.email) return "skipped_no_email";

    const claimed = await claimSendOnce(
      context.db,
      params.registrationId,
      emailType,
    );
    if (!claimed) return "skipped_duplicate";

    try {
      const content = await render(context.registration);
      const delivered = await deliverClientEmail(context.email, content);
      if (!delivered) {
        await releaseClaim(context.db, params.registrationId, emailType).catch(
          () => {},
        );
        return "failed";
      }
      return "sent";
    } catch (error) {
      await releaseClaim(context.db, params.registrationId, emailType).catch(
        () => {},
      );
      throw error;
    }
  } catch (error) {
    console.warn(`[LLC ClientEmail] ${emailType} errored`, {
      registrationId: params.registrationId,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return "failed";
  }
}

/** Trigger: submit succeeded (checkout_ready). */
export async function sendApplicationReceivedEmail(params: {
  userId: number;
  registrationId: number;
}): Promise<ClientEmailSendOutcome> {
  return sendLifecycleEmail("application_received", params, async (registration) =>
    renderApplicationReceivedEmail({
      registrationId: registration.id,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
      formationState: registration.formationState,
      retailPriceCents: registration.retailPriceCents,
      paymentLinkUrl: await bestEffortPaymentLink(registration.formationState),
    }),
  );
}

/** Trigger: ops marked the retail payment received. */
export async function sendPaymentConfirmedEmail(params: {
  userId: number;
  registrationId: number;
}): Promise<ClientEmailSendOutcome> {
  return sendLifecycleEmail("payment_confirmed", params, (registration) =>
    renderPaymentConfirmedEmail({
      registrationId: registration.id,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
      formationState: registration.formationState,
      retailPriceCents: registration.retailPriceCents,
    }),
  );
}

/** Trigger: status transitioned to completed. */
export async function sendFormationCompleteEmail(params: {
  userId: number;
  registrationId: number;
}): Promise<ClientEmailSendOutcome> {
  return sendLifecycleEmail("formation_complete", params, (registration) =>
    renderFormationCompleteEmail({
      registrationId: registration.id,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
    }),
  );
}

/**
 * Trigger: ops released a document. Batched: skipped when a documents email
 * went out within the window; otherwise lists every document released since
 * the previous documents email (so batched-over releases are never lost).
 */
export async function sendDocumentsReleasedEmail(params: {
  userId: number;
  registrationId: number;
}): Promise<ClientEmailSendOutcome> {
  try {
    const context = await loadRecipientContext(
      params.userId,
      params.registrationId,
    );
    if (!context) return "skipped_unavailable";
    if (context.registration.isTest || isDemoSubmissionKey(context.registration.submissionKey)) {
      return "skipped_test";
    }
    if (!context.email) return "skipped_no_email";

    const last = await lastDocumentsEmailAt(context.db, params.registrationId);
    if (last && Date.now() - last.getTime() < DOCUMENTS_BATCH_WINDOW_MS) {
      return "skipped_batched";
    }

    const documents = await listReleasedDocumentsSince(
      context.db,
      params.registrationId,
      last,
    );
    if (documents.length === 0) return "skipped_no_documents";

    // Unique-suffixed type: each batch send keeps its own row under the
    // unique key, and the newest row re-arms the batching window.
    const claimType = `${DOCUMENTS_EMAIL_TYPE}@${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const claimed = await claimSendOnce(
      context.db,
      params.registrationId,
      claimType,
    );
    if (!claimed) return "skipped_duplicate";

    const content = renderDocumentsReleasedEmail({
      registrationId: context.registration.id,
      legalName: context.registration.legalName,
      entitySuffix: context.registration.entitySuffix,
      documents: documents.map(documentDisplayName),
    });
    const delivered = await deliverClientEmail(context.email, content);
    if (!delivered) {
      await releaseClaim(context.db, params.registrationId, claimType).catch(
        () => {},
      );
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.warn("[LLC ClientEmail] documents_released errored", {
      registrationId: params.registrationId,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return "failed";
  }
}

// ─── Demo rehearsal sends (webinar demonstrations) ───

/**
 * Render all four lifecycle emails from a demo registration's real data and
 * send them to the calling admin. Bypasses the llc_email_log claims entirely
 * (re-sendable across rehearsals); each email is isolated so one failure
 * never blocks the rest. The caller enforces the demo-filing guard.
 */
export async function sendDemoLifecycleEmails(params: {
  userId: number;
  registrationId: number;
  to: string;
}): Promise<{ sent: number }> {
  const context = await loadRecipientContext(
    params.userId,
    params.registrationId,
  );
  if (!context) return { sent: 0 };
  const { db, registration } = context;

  // Placeholder keeps the payment-link variant demonstrable when the state
  // has no hosted link configured.
  const paymentLinkUrl =
    (await bestEffortPaymentLink(registration.formationState)) ??
    "https://example.com/your-payment-link";

  const documents = await listReleasedDocumentsSince(db, registration.id, null);

  const emails: ClientEmailContent[] = [
    renderApplicationReceivedEmail({
      registrationId: registration.id,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
      formationState: registration.formationState,
      retailPriceCents: registration.retailPriceCents,
      paymentLinkUrl,
    }),
    renderPaymentConfirmedEmail({
      registrationId: registration.id,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
      formationState: registration.formationState,
      retailPriceCents: registration.retailPriceCents,
    }),
    renderFormationCompleteEmail({
      registrationId: registration.id,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
    }),
    renderDocumentsReleasedEmail({
      registrationId: registration.id,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
      documents: documents.map(documentDisplayName),
    }),
  ];

  let sent = 0;
  for (const email of emails) {
    // deliverClientEmail never throws; a failed email is simply not counted.
    if (await deliverClientEmail(params.to, email)) sent += 1;
  }
  return { sent };
}
