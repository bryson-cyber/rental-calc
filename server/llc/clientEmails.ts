import nodemailer from "nodemailer";
import { and, asc, desc, eq, gt, isNotNull, isNull, like, lt } from "drizzle-orm";
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
import { ensureStatusToken } from "./store";

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

/**
 * Branded status page for one registration — ALWAYS absolute. The old
 * version silently fell back to a bare path when APP_BASE_URL was unset,
 * which shipped a dead 'Track your filing any time: /llc/status/…' line in
 * the live payment-received email (operator screenshot, 2026-07-28). A
 * client email must never depend on an optional env var for its links.
 *
 * When a statusToken is provided the link carries it as ?t= so the client
 * can open their filing page from the email WITHOUT signing in (operator
 * complaint 2026-07-28: email links hit a login wall on phones/other
 * browsers). Mirrors the results-token pattern: the unguessable token IS
 * the credential. Token-less calls render the plain URL unchanged.
 */
function statusUrl(registrationId: number, statusToken?: string | null): string {
  const base = (process.env.APP_BASE_URL || process.env.VITE_APP_URL || "https://coachinayahturnkeytool.com")
    .trim()
    .replace(/\/+$/, "");
  const url = `${base}/llc/status/${registrationId}`;
  return statusToken ? `${url}?t=${statusToken}` : url;
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
    .map((paragraph) => {
      // A paragraph that is EXACTLY one linked URL becomes the gold CTA
      // button (house style from the webinar emails); prose links stay
      // inline. The plain-text version is untouched either way.
      const buttonMatch = paragraph.match(/^<a href="([^"]+)"[^>]*>[^<]+<\/a>$/);
      if (buttonMatch) {
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background-color:#C9A962;"><a href="${buttonMatch[1]}" style="display:inline-block;padding:14px 28px;font-weight:bold;font-size:15px;color:#0F172A;text-decoration:none;">Open your filing page</a></td></tr></table>`;
      }
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#1e293b;">${paragraph.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
  // Branded shell matching the webinar emails: centered brand mark, gold
  // accent rule, card body, quiet footer. Table-based for email clients.
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background-color:#f6f5f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f5f1;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td align="center" style="padding-bottom:20px;">
<span style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0F172A;">Coach Inayah</span>
<div style="width:44px;height:3px;background-color:#C9A962;border-radius:2px;margin:10px auto 0;"></div>
</td></tr>
<tr><td style="background-color:#ffffff;border:1px solid #e7e5df;border-radius:12px;padding:32px 28px;">${paragraphs}</td></tr>
<tr><td align="center" style="padding-top:20px;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#8a877f;">You're receiving this because you started an LLC filing with us.<br>Questions? Just reply to this email.</p>
</td></tr>
</table></td></tr></table></body></html>`;
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
  /** Tokenized status link (?t=) — omitted, the plain URL renders unchanged. */
  statusToken?: string | null;
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
    // Self-serve Stripe checkout (2026-07-28): payment happens right in the
    // flow — never promise that a link is coming later. This email's job is
    // rescuing the client who closed the tab before paying: their filing
    // page carries the payment button and everything else.
    lines.push(`Complete your payment from your filing page and your filing starts the moment it goes through:`);
  }
  lines.push(
    `${statusUrl(params.registrationId, params.statusToken)}`,
    ``,
    `Filing payments are final and non-refundable. Already paid? You're all set — a confirmation is on its way, and the link above is your filing hub from here on out: live status, and every document (Articles, EIN letter, operating agreement) lands there the moment it's ready.`,
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
  /** Tokenized status link (?t=) — omitted, the plain URL renders unchanged. */
  statusToken?: string | null;
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
    `This typically takes a few weeks and varies by state — we'll email you when your formation is complete.`,
    ``,
    `Track your filing any time: ${statusUrl(params.registrationId, params.statusToken)}`,
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
  /** Tokenized status link (?t=) — omitted, the plain URL renders unchanged. */
  statusToken?: string | null;
}): ClientEmailContent {
  const company = companyDisplayName(params);
  const lines = [
    `Congratulations — ${company} is officially formed!`,
    ``,
    `Your state approval is complete and your federal EIN has been secured. Your documents will appear in your account as our team delivers them.`,
    ``,
    `View your filing: ${statusUrl(params.registrationId, params.statusToken)}`,
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
  /** Tokenized status link (?t=) — omitted, the plain URL renders unchanged. */
  statusToken?: string | null;
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
    `View and download them any time: ${statusUrl(params.registrationId, params.statusToken)}`,
    ``,
    SIGN_OFF,
  );
  return finalize(`New documents for ${company}`, lines);
}

// ─── Transport (same SMTP relay + HubSpot fallback as ops alerts) ───

/**
 * From address for client emails: LLC_EMAIL_FROM when set, otherwise the
 * SMTP config's from (which already falls back HUBSPOT_SMTP_FROM → OPS_EMAIL).
 * Always wraps the address with the display name "Inayah" so recipients see
 * the sender as "Inayah" rather than the raw local-part (e.g. "support").
 */
function resolveFromAddress(smtpFrom: string): string {
  const addr = process.env.LLC_EMAIL_FROM?.trim() || smtpFrom;
  // If already formatted with a display name (contains < and >), return as-is
  if (addr.includes("<") && addr.includes(">")) return addr;
  return `"Inayah" <${addr}>`;
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

/**
 * Status token for a loaded registration row (2026-07-28 tokenized links).
 * Rows minted after the column carry it directly; a NULL cell (row predates
 * the boot backfill) falls back to ensureStatusToken, which persists one
 * first-write-wins. The strict null check leaves rows whose loader did not
 * select the column (e.g. token-less test fixtures) token-less rather than
 * minting tokens from inside an email render.
 */
async function resolveStatusToken(registration: {
  id: number;
  statusToken?: string | null;
}): Promise<string | null> {
  if (registration.statusToken === null) {
    return ensureStatusToken(registration.id);
  }
  return registration.statusToken ?? null;
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
/**
 * Payment-rescue sweep (operator 2026-07-28): the application-received
 * email is no longer sent at submission — with self-serve checkout most
 * clients pay within a minute and the instant email was noise arriving
 * seconds before the payment confirmation. Instead, this sweep (run from
 * the LLC status-poll heartbeat) emails ONLY genuine abandoners: unpaid,
 * still payment_required, 15 minutes to 7 days old, not samples. The
 * send-once claim in sendLifecycleEmail makes re-sweeps harmless.
 */
export async function sendPaymentRescueEmails(): Promise<{ sent: number }> {
  const db = await getDb();
  if (!db) return { sent: 0 };
  const now = Date.now();
  const oldest = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const newest = new Date(now - 15 * 60 * 1000);
  const rows = await db
    .select({
      id: llcRegistrations.id,
      userId: llcRegistrations.userId,
    })
    .from(llcRegistrations)
    .where(
      and(
        eq(llcRegistrations.status, "payment_required"),
        isNull(llcRegistrations.retailPaidAt),
        gt(llcRegistrations.createdAt, oldest),
        lt(llcRegistrations.createdAt, newest),
      ),
    )
    .limit(25);
  let sent = 0;
  for (const row of rows) {
    const result = await sendApplicationReceivedEmail({
      userId: row.userId,
      registrationId: row.id,
    }).catch(() => "failed" as const);
    if (result === "sent") sent += 1;
  }
  return { sent };
}

/**
 * Completion-email rescue sweep (live incident 2026-08-17): two completed
 * filings' clients (orders #270003 and #300001) learned their LLCs were done
 * only by logging in — the completion email fires exactly once at the status
 * transition, so a single relay hiccup at that moment silently lost the send
 * forever. This sweep runs from the same poll heartbeat as the payment
 * rescue: any completed, non-test registration with NO formation_complete
 * claim row gets the send retried. The claim-once insert inside
 * sendFormationCompleteEmail keeps re-sweeps harmless (a delivered email is
 * never repeated), and the sweep retroactively heals orders whose send
 * failed before this deploy.
 */
export async function sendCompletionRescueEmails(): Promise<{ sent: number }> {
  const db = await getDb();
  if (!db) return { sent: 0 };
  const rows = await db
    .select({
      id: llcRegistrations.id,
      userId: llcRegistrations.userId,
    })
    .from(llcRegistrations)
    .leftJoin(
      llcEmailLog,
      and(
        eq(llcEmailLog.registrationId, llcRegistrations.id),
        eq(llcEmailLog.emailType, "formation_complete"),
      ),
    )
    .where(
      and(
        eq(llcRegistrations.status, "completed"),
        eq(llcRegistrations.isTest, false),
        isNull(llcEmailLog.id),
      ),
    )
    .limit(10);
  let sent = 0;
  for (const row of rows) {
    // Test/demo rows are re-filtered inside the send (without burning a
    // claim), so a demo completion can sit in this query forever harmlessly.
    const result = await sendFormationCompleteEmail({
      userId: row.userId,
      registrationId: row.id,
    }).catch(() => "failed" as const);
    if (result === "sent") sent += 1;
  }
  return { sent };
}

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
      statusToken: await resolveStatusToken(registration),
    }),
  );
}

/** Trigger: ops marked the retail payment received. */
export async function sendPaymentConfirmedEmail(params: {
  userId: number;
  registrationId: number;
}): Promise<ClientEmailSendOutcome> {
  return sendLifecycleEmail("payment_confirmed", params, async (registration) =>
    renderPaymentConfirmedEmail({
      registrationId: registration.id,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
      formationState: registration.formationState,
      retailPriceCents: registration.retailPriceCents,
      statusToken: await resolveStatusToken(registration),
    }),
  );
}

/** Trigger: status transitioned to completed. */
export async function sendFormationCompleteEmail(params: {
  userId: number;
  registrationId: number;
}): Promise<ClientEmailSendOutcome> {
  return sendLifecycleEmail("formation_complete", params, async (registration) =>
    renderFormationCompleteEmail({
      registrationId: registration.id,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
      statusToken: await resolveStatusToken(registration),
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
      statusToken: await resolveStatusToken(context.registration),
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

  // Rehearsal emails carry the same tokenized status link a client would get,
  // so the presenter can demonstrate the no-login flow from a phone.
  const statusToken = await resolveStatusToken(registration);

  const emails: ClientEmailContent[] = [
    renderApplicationReceivedEmail({
      registrationId: registration.id,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
      formationState: registration.formationState,
      retailPriceCents: registration.retailPriceCents,
      paymentLinkUrl,
      statusToken,
    }),
    renderPaymentConfirmedEmail({
      registrationId: registration.id,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
      formationState: registration.formationState,
      retailPriceCents: registration.retailPriceCents,
      statusToken,
    }),
    renderFormationCompleteEmail({
      registrationId: registration.id,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
      statusToken,
    }),
    renderDocumentsReleasedEmail({
      registrationId: registration.id,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
      documents: documents.map(documentDisplayName),
      statusToken,
    }),
  ];

  let sent = 0;
  for (const email of emails) {
    // deliverClientEmail never throws; a failed email is simply not counted.
    if (await deliverClientEmail(params.to, email)) sent += 1;
  }
  return { sent };
}
