import { and, asc, eq, isNull, or } from "drizzle-orm";
import {
  llcRegistrations,
  llcRequiredActions,
  type LlcRequiredActionRecord,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  getDoolaRequiredAction,
  createDoolaSignatureSession,
  DoolaApiError,
  listDoolaRequiredActionsForCompany,
  listOpenDoolaRequiredActions,
  resolveDoolaNameOptionsRequiredAction,
  type DoolaCompany,
  type DoolaRequiredAction,
} from "./doola";
import { transitionLlcStatus } from "./store";

export const DOOLA_NAME_OPTIONS_ACTION = "FORMATION_NAME_OPTIONS_EXHAUSTED";
export const DOOLA_SS4_RESET_ACTION = "FORMATION_SIGNATURE_SS4_RESET";
export const LEGACY_SS4_PENDING_ACTION = "FORMATION_SIGNATURE_SS4_PENDING";

type ActionSource = "webhook" | "reconciliation" | "company_snapshot";

type RegistrationRef = {
  id: number;
  userId: number;
  status: string;
  legalName: string | null;
  entitySuffix: string;
  doolaCompanyId: string | null;
};

function providerDate(value: string | undefined): Date | null {
  if (!value) return null;
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clean(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.replace(/[\r\n\t]+/g, " ").trim().slice(0, max)
    : "";
}

function normalizeAction(action: DoolaRequiredAction): DoolaRequiredAction {
  return {
    requiredActionId: clean(action.requiredActionId, 160),
    doolaCompanyId: clean(action.doolaCompanyId, 64),
    actionCode: clean(action.actionCode, 96),
    actionName: clean(action.actionName, 200) || "Filing action needed",
    status: clean(action.status, 32) || "created",
    reason:
      clean(action.reason, 2000) ||
      "We need one more item from you before your filing can continue.",
    open: Boolean(action.open),
    updatedAt: action.updatedAt,
    history: Array.isArray(action.history) ? action.history.slice(0, 50) : undefined,
  };
}

async function findRegistrationByCompanyId(
  doolaCompanyId: string,
): Promise<RegistrationRef | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: llcRegistrations.id,
      userId: llcRegistrations.userId,
      status: llcRegistrations.status,
      legalName: llcRegistrations.legalName,
      entitySuffix: llcRegistrations.entitySuffix,
      doolaCompanyId: llcRegistrations.doolaCompanyId,
    })
    .from(llcRegistrations)
    .where(eq(llcRegistrations.doolaCompanyId, doolaCompanyId))
    .limit(1);
  return rows[0] ?? null;
}

async function transitionRegistrationToActionRequired(
  registration: RegistrationRef,
  action: DoolaRequiredAction,
): Promise<void> {
  if (registration.status === "completed" || registration.status === "failed") return;
  await transitionLlcStatus({
    userId: registration.userId,
    registrationId: registration.id,
    toStatus: "action_required",
    source: "system",
    note: `Required filing action: ${clean(action.actionName, 180)}`,
    expectedStatuses: ["payment_required", "submitting", "processing", "action_required"],
    updates: {
      lastErrorType: `required_action_${clean(action.actionCode, 80).toLowerCase()}`,
      lastErrorMessage: clean(action.reason, 500),
      retryable: false,
    },
  }).catch(() => {});
}

async function notifyRequiredAction(
  row: LlcRequiredActionRecord,
  registration: RegistrationRef,
): Promise<void> {
  const db = await getDb();
  if (!db || !row.open) return;

  if (!row.opsNotifiedAt) {
    const { requiredActionAlert, sendOpsAlert } = await import("../ops/notify");
    const delivered = await sendOpsAlert(
      requiredActionAlert({
        registrationId: registration.id,
        legalName: `${registration.legalName ?? "Unknown"} ${registration.entitySuffix}`,
        actionName: row.actionName,
        actionCode: row.actionCode,
        reason: row.reason,
      }),
    ).catch(() => false);
    if (delivered) {
      await db
        .update(llcRequiredActions)
        .set({ opsNotifiedAt: new Date() })
        .where(eq(llcRequiredActions.id, row.id));
    }
  }

  if (!row.clientNotifiedAt) {
    const { sendRequiredActionEmail } = await import("./clientEmails");
    const outcome = await sendRequiredActionEmail({
      userId: registration.userId,
      registrationId: registration.id,
      actionId: row.id,
    }).catch(() => "failed" as const);
    if (outcome === "sent" || outcome === "skipped_duplicate") {
      await db
        .update(llcRequiredActions)
        .set({ clientNotifiedAt: new Date() })
        .where(eq(llcRequiredActions.id, row.id));
    } else if (outcome === "failed" || outcome === "skipped_no_email") {
      const { clientEmailProblemAlert, sendOpsAlert } = await import("../ops/notify");
      await sendOpsAlert(
        clientEmailProblemAlert({
          registrationId: registration.id,
          legalName: `${registration.legalName ?? "Unknown"} ${registration.entitySuffix}`,
          emailType: "required_action",
          outcome,
        }),
      ).catch(() => false);
    }
  }
}

export async function upsertDoolaRequiredAction(params: {
  action: DoolaRequiredAction;
  source: ActionSource;
  registration?: RegistrationRef | null;
}): Promise<{ row: LlcRequiredActionRecord | null; opened: boolean }> {
  const db = await getDb();
  if (!db) return { row: null, opened: false };
  const action = normalizeAction(params.action);
  if (!action.requiredActionId || !action.doolaCompanyId || !action.actionCode) {
    return { row: null, opened: false };
  }
  const registration =
    params.registration ?? (await findRegistrationByCompanyId(action.doolaCompanyId));
  if (!registration) {
    console.warn("[DoolaRequiredActions] no local registration for company", {
      doolaCompanyId: action.doolaCompanyId,
      actionCode: action.actionCode,
    });
    return { row: null, opened: false };
  }

  const existingRows = await db
    .select()
    .from(llcRequiredActions)
    .where(eq(llcRequiredActions.requiredActionId, action.requiredActionId))
    .limit(1);
  const existing = existingRows[0] ?? null;
  const opened = action.open && (!existing || !existing.open);
  const submittedPayload =
    action.history
      ?.slice()
      .reverse()
      .find((item) => item?.status === "submitted")?.submittedPayload ?? null;
  const values = {
    registrationId: registration.id,
    doolaCompanyId: action.doolaCompanyId,
    actionCode: action.actionCode,
    actionName: action.actionName,
    reason: action.reason,
    status: String(action.status),
    open: action.open,
    source: params.source,
    providerUpdatedAt: providerDate(action.updatedAt),
    history: action.history ?? null,
    submittedPayload,
    resolvedAt: action.open ? null : existing?.resolvedAt ?? new Date(),
  };
  if (existing) {
    await db
      .update(llcRequiredActions)
      .set(values)
      .where(eq(llcRequiredActions.id, existing.id));
  } else {
    await db.insert(llcRequiredActions).values({
      requiredActionId: action.requiredActionId,
      ...values,
    });
  }
  const freshRows = await db
    .select()
    .from(llcRequiredActions)
    .where(eq(llcRequiredActions.requiredActionId, action.requiredActionId))
    .limit(1);
  const row = freshRows[0] ?? null;
  if (action.open) await transitionRegistrationToActionRequired(registration, action);
  if (row && opened) await notifyRequiredAction(row, registration);
  return { row, opened };
}

export async function listRequiredActionsForRegistration(
  registrationId: number,
): Promise<LlcRequiredActionRecord[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(llcRequiredActions)
    .where(eq(llcRequiredActions.registrationId, registrationId))
    .orderBy(asc(llcRequiredActions.createdAt), asc(llcRequiredActions.id));
}

async function requireActionContext(params: {
  userId: number;
  registrationId: number;
  actionId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db
    .select({ action: llcRequiredActions, registration: llcRegistrations })
    .from(llcRequiredActions)
    .innerJoin(
      llcRegistrations,
      and(
        eq(llcRegistrations.id, llcRequiredActions.registrationId),
        eq(llcRegistrations.userId, params.userId),
      ),
    )
    .where(
      and(
        eq(llcRequiredActions.id, params.actionId),
        eq(llcRequiredActions.registrationId, params.registrationId),
      ),
    )
    .limit(1);
  if (!rows[0]) throw new Error("Required action not found");
  return rows[0];
}

export async function createSs4SigningSessionForAction(params: {
  userId: number;
  registrationId: number;
  actionId: number;
}): Promise<{ url: string; expiresAt: string | null }> {
  const context = await requireActionContext(params);
  if (!context.action.open) throw new Error("This required action is already closed");
  if (
    context.action.actionCode !== DOOLA_SS4_RESET_ACTION &&
    context.action.actionCode !== LEGACY_SS4_PENDING_ACTION
  ) {
    throw new Error("This required action does not use a signing session");
  }
  const session = await createDoolaSignatureSession(
    context.registration.doolaCompanyId as string,
    "SS4",
  );
  if (!session.url) throw new Error("The signing link could not be created");
  return { url: session.url, expiresAt: session.expiresAt };
}

export async function submitNameOptionsForAction(params: {
  userId: number;
  registrationId: number;
  actionId: number;
  names: string[];
}): Promise<LlcRequiredActionRecord> {
  const context = await requireActionContext(params);
  if (!context.action.open) throw new Error("This required action is already closed");
  if (context.action.actionCode !== DOOLA_NAME_OPTIONS_ACTION) {
    throw new Error("This required action does not accept company names");
  }
  const names = params.names
    .map((name) => clean(name, 160))
    .filter(Boolean)
    .slice(0, 3);
  if (names.length < 1) throw new Error("Enter at least one replacement company name");
  const unique = new Set(names.map((name) => name.toLowerCase()));
  if (unique.size !== names.length) throw new Error("Company name options must be different");
  const ending = context.registration.entitySuffix;

  let providerAction: DoolaRequiredAction;
  try {
    providerAction = await resolveDoolaNameOptionsRequiredAction({
      doolaCompanyId: context.action.doolaCompanyId,
      requiredActionId: context.action.requiredActionId,
      nameOptions: names.map((name, index) => ({
        name,
        entityTypeEnding: ending,
        position: index + 1,
      })),
    });
  } catch (error) {
    // Doola's resolution endpoint has no idempotency key. A timeout is never
    // blindly retried; read back the action and accept an observed submission.
    if (!(error instanceof DoolaApiError) || !error.retryable) throw error;
    const current = await getDoolaRequiredAction(
      context.action.doolaCompanyId,
      context.action.requiredActionId,
    );
    if (current.status !== "submitted") throw error;
    providerAction = current;
  }
  const upserted = await upsertDoolaRequiredAction({
    action: providerAction,
    source: "reconciliation",
    registration: {
      id: context.registration.id,
      userId: context.registration.userId,
      status: context.registration.status,
      legalName: context.registration.legalName,
      entitySuffix: context.registration.entitySuffix,
      doolaCompanyId: context.registration.doolaCompanyId,
    },
  });
  if (!upserted.row) throw new Error("The required action could not be updated");
  return upserted.row;
}

export async function syncDoolaRequiredActionsForCompany(params: {
  registration: RegistrationRef;
  actions?: DoolaRequiredAction[];
}): Promise<{ synced: number }> {
  if (!params.registration.doolaCompanyId) return { synced: 0 };
  const actions =
    params.actions ??
    (await listDoolaRequiredActionsForCompany(params.registration.doolaCompanyId));
  let synced = 0;
  for (const action of actions) {
    const result = await upsertDoolaRequiredAction({
      action,
      source: "reconciliation",
      registration: params.registration,
    });
    if (result.row) synced += 1;
  }
  return { synced };
}

export async function syncSignatureRequirementFallback(params: {
  registration: RegistrationRef;
  company: DoolaCompany;
}): Promise<void> {
  const companyId = params.registration.doolaCompanyId;
  if (!companyId) return;
  const pendingSs4 = (params.company.signatureRequirements ?? []).some(
    (requirement) =>
      (requirement.documentType ?? "").toUpperCase() === "SS4" &&
      (requirement.status ?? "").toUpperCase() === "PENDING",
  );
  const syntheticId = `legacy:${companyId}:SS4`;
  const db = await getDb();
  if (!db) return;
  const [realResetRows, syntheticRows] = await Promise.all([
    db
      .select({ id: llcRequiredActions.id })
      .from(llcRequiredActions)
      .where(
        and(
          eq(llcRequiredActions.registrationId, params.registration.id),
          eq(llcRequiredActions.actionCode, DOOLA_SS4_RESET_ACTION),
          eq(llcRequiredActions.open, true),
        ),
      )
      .limit(1),
    db
      .select()
      .from(llcRequiredActions)
      .where(eq(llcRequiredActions.requiredActionId, syntheticId))
      .limit(1),
  ]);
  if (pendingSs4 && realResetRows.length > 0) {
    if (syntheticRows[0]?.open) {
      await db
        .update(llcRequiredActions)
        .set({ open: false, status: "resolved", resolvedAt: new Date() })
        .where(eq(llcRequiredActions.id, syntheticRows[0].id));
    }
    return;
  }
  if (!pendingSs4 && !syntheticRows[0]) return;
  await upsertDoolaRequiredAction({
    source: "company_snapshot",
    registration: params.registration,
    action: {
      requiredActionId: syntheticId,
      doolaCompanyId: companyId,
      actionCode: LEGACY_SS4_PENDING_ACTION,
      actionName: "SS-4 signature needed",
      status: pendingSs4 ? "delivered" : "resolved",
      reason: pendingSs4
        ? "Please sign your updated IRS Form SS-4 so we can continue your EIN application."
        : "The SS-4 signature requirement has been completed.",
      open: pendingSs4,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function rescueRequiredActionNotifications(): Promise<{
  checked: number;
}> {
  const db = await getDb();
  if (!db) return { checked: 0 };
  const rows = await db
    .select({
      action: llcRequiredActions,
      registration: {
        id: llcRegistrations.id,
        userId: llcRegistrations.userId,
        status: llcRegistrations.status,
        legalName: llcRegistrations.legalName,
        entitySuffix: llcRegistrations.entitySuffix,
        doolaCompanyId: llcRegistrations.doolaCompanyId,
      },
    })
    .from(llcRequiredActions)
    .innerJoin(
      llcRegistrations,
      eq(llcRegistrations.id, llcRequiredActions.registrationId),
    )
    .where(
      and(
        eq(llcRequiredActions.open, true),
        or(
          isNull(llcRequiredActions.clientNotifiedAt),
          isNull(llcRequiredActions.opsNotifiedAt),
        ),
      ),
    )
    .limit(25);
  for (const row of rows) {
    await notifyRequiredAction(row.action, row.registration).catch(() => {});
  }
  return { checked: rows.length };
}

export async function reconcileDoolaRequiredActions(): Promise<{
  providerOpen: number;
  synced: number;
  failed: number;
}> {
  const seen = new Set<string>();
  let page = 0;
  let totalPages = 1;
  let providerOpen = 0;
  let synced = 0;
  let failed = 0;
  do {
    const result = await listOpenDoolaRequiredActions(page, 100);
    totalPages = Math.max(1, result.totalPages || 1);
    providerOpen = result.total;
    for (const action of result.content ?? []) {
      seen.add(action.requiredActionId);
      try {
        const upserted = await upsertDoolaRequiredAction({
          action,
          source: "reconciliation",
        });
        if (upserted.row) synced += 1;
      } catch (error) {
        failed += 1;
        console.warn("[DoolaRequiredActions] open-action sync failed", {
          actionCode: action.actionCode,
          error: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }
    page += 1;
  } while (page < totalPages);

  const db = await getDb();
  if (db) {
    const localOpen = await db
      .select()
      .from(llcRequiredActions)
      .where(eq(llcRequiredActions.open, true));
    for (const row of localOpen) {
      if (row.source === "company_snapshot" || seen.has(row.requiredActionId)) continue;
      try {
        const current = await getDoolaRequiredAction(
          row.doolaCompanyId,
          row.requiredActionId,
        );
        await upsertDoolaRequiredAction({ action: current, source: "reconciliation" });
      } catch (error) {
        failed += 1;
        console.warn("[DoolaRequiredActions] action refresh failed", {
          registrationId: row.registrationId,
          actionCode: row.actionCode,
          error: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }
  }
  return { providerOpen, synced, failed };
}

export async function ingestDoolaRequiredActionWebhook(params: {
  eventName: "company_name_options_required" | "signature_ss4_reset";
  eventPayload: {
    doolaCompanyId?: string;
    requiredActionId?: string;
    actionCode?: string;
    actionName?: string;
    reason?: string;
  };
}): Promise<{ row: LlcRequiredActionRecord | null; opened: boolean }> {
  const companyId = clean(params.eventPayload.doolaCompanyId, 64);
  const requiredActionId = clean(params.eventPayload.requiredActionId, 160);
  const actionCode = clean(params.eventPayload.actionCode, 96);
  if (!companyId || !requiredActionId || !actionCode) {
    return { row: null, opened: false };
  }
  return upsertDoolaRequiredAction({
    source: "webhook",
    action: {
      requiredActionId,
      doolaCompanyId: companyId,
      actionCode,
      actionName:
        clean(params.eventPayload.actionName, 200) ||
        (params.eventName === "company_name_options_required"
          ? "New company names needed"
          : "SS-4 signature needed again"),
      status: "delivered",
      reason:
        clean(params.eventPayload.reason, 2000) ||
        "We need one more item from you before your filing can continue.",
      open: true,
      updatedAt: new Date().toISOString(),
    },
  });
}
