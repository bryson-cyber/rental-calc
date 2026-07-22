import { and, asc, desc, eq, inArray, isNull, notLike, or, sql } from "drizzle-orm";
import {
  llcFounders,
  llcRegistrations,
  llcStatusHistory,
  llcSubmissionAttempts,
  users,
} from "../../drizzle/schema";
import type { LlcDraft, LlcStatus } from "../../shared/llc";
import { normalizeSsn } from "../../shared/llc";
import { getDb } from "../db";
import { encryptPii } from "./pii";

function requireDb<T>(db: T | null): T {
  if (!db) throw new Error("Database is not available");
  return db;
}

async function findRegistrationById(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  registrationId: number,
) {
  const rows = await db
    .select()
    .from(llcRegistrations)
    .where(
      and(
        eq(llcRegistrations.id, registrationId),
        eq(llcRegistrations.userId, userId),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function createLlcRegistration(
  userId: number,
  options?: { isTest?: boolean },
) {
  const db = requireDb(await getDb());

  const result = await db
    .insert(llcRegistrations)
    .values({
      userId,
      status: "draft",
      currentStep: 1,
      // The test marker is only ever written here — no edit path can set or
      // clear it afterwards, which is what makes it safe to trust at submit.
      isTest: options?.isTest ?? false,
    });
  const registrationId = Number(result[0].insertId);
  if (!registrationId) throw new Error("Unable to create LLC registration");

  await db.insert(llcStatusHistory).values({
    registrationId,
    fromStatus: null,
    toStatus: "draft",
    source: "system",
    note: options?.isTest
      ? "[TEST] Registration draft created for an admin test run"
      : "Registration draft created",
  });

  const registration = await findRegistrationById(db, userId, registrationId);
  if (!registration) throw new Error("Unable to reload created LLC registration");
  return registration;
}

export async function listLlcRegistrationsForUser(userId: number) {
  const db = requireDb(await getDb());
  return db
    .select()
    .from(llcRegistrations)
    .where(eq(llcRegistrations.userId, userId))
    .orderBy(desc(llcRegistrations.updatedAt), desc(llcRegistrations.id));
}

export async function getLlcRegistrationById(
  userId: number,
  registrationId: number,
) {
  const db = requireDb(await getDb());
  const registration = await findRegistrationById(db, userId, registrationId);
  if (!registration) return null;

  const [founders, history] = await Promise.all([
    db
      .select()
      .from(llcFounders)
      .where(eq(llcFounders.registrationId, registration.id))
      .orderBy(asc(llcFounders.sortOrder), asc(llcFounders.id)),
    db
      .select()
      .from(llcStatusHistory)
      .where(eq(llcStatusHistory.registrationId, registration.id))
      .orderBy(desc(llcStatusHistory.createdAt), desc(llcStatusHistory.id)),
  ]);

  return { registration, founders, history };
}

/** Every registration across all users, newest first, for the ops dashboard. */
export async function listAllLlcRegistrations() {
  const db = requireDb(await getDb());
  return db
    .select({
      registration: llcRegistrations,
      clientName: users.name,
      clientEmail: users.email,
    })
    .from(llcRegistrations)
    .leftJoin(users, eq(llcRegistrations.userId, users.id))
    .orderBy(desc(llcRegistrations.updatedAt), desc(llcRegistrations.id));
}

/** Owning user for a registration, for admin actions that span users. */
export async function findLlcRegistrationOwner(registrationId: number) {
  const db = requireDb(await getDb());
  const rows = await db
    .select({ userId: llcRegistrations.userId })
    .from(llcRegistrations)
    .where(eq(llcRegistrations.id, registrationId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Registrations across all users that the status poller should refresh.
 * action_required is included so provider-side resolutions (a founder signing,
 * Whop support fixing an issue, an uncertain outcome materializing) are picked
 * up automatically instead of stalling until a manual ops sync.
 */
export async function listRegistrationsForStatusPolling() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: llcRegistrations.id,
      userId: llcRegistrations.userId,
      status: llcRegistrations.status,
      whopAccountId: llcRegistrations.whopAccountId,
    })
    .from(llcRegistrations)
    .where(
      and(
        inArray(llcRegistrations.status, [
          "submitting",
          "payment_required",
          "processing",
          "action_required",
        ]),
        // Test rows are provably outside the sweep, independent of the
        // whopAccountId-null guard in the poller loop.
        eq(llcRegistrations.isTest, false),
      ),
    )
    .orderBy(asc(llcRegistrations.id));
}

const EDITABLE_STATUSES = ["draft", "ready", "failed", "action_required"] as const;
export const UNCERTAIN_ERROR_PREFIX = "uncertain_";

/**
 * A registration stops being client-editable the moment provider-side
 * artifacts may exist: once a checkout was issued, or once a provider mutation
 * ended with an uncertain outcome. Editing such a row would rotate the
 * submission (idempotency) key and could produce a duplicate paid filing, so
 * those rows are ops-only until resolved.
 */
export function isRegistrationEditable(registration: {
  status: string;
  checkoutSessionId: string | null;
  lastErrorType: string | null;
}): boolean {
  if (!(EDITABLE_STATUSES as readonly string[]).includes(registration.status)) {
    return false;
  }
  if (registration.checkoutSessionId) return false;
  if (registration.lastErrorType?.startsWith(UNCERTAIN_ERROR_PREFIX)) return false;
  return true;
}

export async function saveLlcDraft(
  userId: number,
  registrationId: number,
  draft: LlcDraft,
) {
  const db = requireDb(await getDb());
  const registration = await findRegistrationById(db, userId, registrationId);
  if (!registration) throw new Error("LLC registration was not found");

  if (!isRegistrationEditable(registration)) {
    throw new Error("This registration can no longer be edited");
  }

  await db.transaction(async (tx) => {
    // The editability predicates are repeated in the WHERE clause so a save
    // racing a concurrent submit (which flips status to "submitting") cannot
    // clobber the single-flight lock or null the submission key mid-flight.
    const updateResult = await tx
      .update(llcRegistrations)
      .set({
        status: "draft",
        currentStep: draft.currentStep,
        legalName: draft.legalName || null,
        entitySuffix: draft.entitySuffix,
        formationState: draft.formationState || null,
        businessType: draft.businessType || null,
        industryGroup: draft.industryGroup || null,
        industryType: draft.industryType || null,
        businessPhone: draft.businessPhone || null,
        website: draft.website || null,
        useRegisteredAgent: draft.useRegisteredAgent,
        companyAddressLine1: draft.companyAddress.line1 || null,
        companyAddressLine2: draft.companyAddress.line2 || null,
        companyAddressCity: draft.companyAddress.city || null,
        companyAddressState: draft.companyAddress.state || null,
        companyAddressPostalCode: draft.companyAddress.postalCode || null,
        companyAddressCountry: draft.companyAddress.country || "US",
        expediteEin: draft.expediteEin,
        accuracyAttested: draft.accuracyAttested,
        lastErrorType: null,
        lastErrorMessage: null,
        retryable: false,
        // A fresh submission key is generated for the next submit so an edited
        // payload is never replayed against a stale provider idempotency key.
        submissionKey: null,
      })
      .where(
        and(
          eq(llcRegistrations.id, registration.id),
          eq(llcRegistrations.userId, userId),
          inArray(llcRegistrations.status, [...EDITABLE_STATUSES]),
          isNull(llcRegistrations.checkoutSessionId),
          or(
            isNull(llcRegistrations.lastErrorType),
            notLike(llcRegistrations.lastErrorType, `${UNCERTAIN_ERROR_PREFIX}%`),
          ),
        ),
      );

    if (Number(updateResult[0].affectedRows ?? 0) !== 1) {
      throw new Error("This registration can no longer be edited");
    }

    await tx.delete(llcFounders).where(eq(llcFounders.registrationId, registration.id));
    if (draft.founders.length > 0) {
      await tx.insert(llcFounders).values(
        draft.founders.map((founder, index) => ({
          registrationId: registration.id,
          sortOrder: index,
          isPrimary: founder.isPrimary,
          firstName: founder.firstName || null,
          lastName: founder.lastName || null,
          email: founder.email || null,
          phone: founder.phone || null,
          // Fail-closed: encryptPii throws when PII_ENCRYPTION_KEY is unset,
          // so an SSN can never be persisted in plaintext.
          ssnEncrypted: founder.ssn?.trim()
            ? encryptPii(normalizeSsn(founder.ssn))
            : null,
          ownershipBasisPoints:
            founder.ownershipPercentage === undefined
              ? null
              : Math.round(founder.ownershipPercentage * 100),
          addressLine1: founder.address.line1 || null,
          addressLine2: founder.address.line2 || null,
          addressCity: founder.address.city || null,
          addressState: founder.address.state || null,
          addressPostalCode: founder.address.postalCode || null,
          addressCountry: founder.address.country || "US",
        })),
      );
    }
  });

  return getLlcRegistrationById(userId, registrationId);
}

export async function transitionLlcStatus(params: {
  userId: number;
  registrationId: number;
  toStatus: LlcStatus;
  source: "user" | "system" | "whop";
  note?: string;
  expectedStatuses?: LlcStatus[];
  updates?: Partial<typeof llcRegistrations.$inferInsert>;
}) {
  const db = requireDb(await getDb());
  const registration = await findRegistrationById(
    db,
    params.userId,
    params.registrationId,
  );
  if (!registration) throw new Error("LLC registration not found");

  if (
    params.expectedStatuses &&
    !params.expectedStatuses.includes(registration.status as LlcStatus)
  ) {
    return { changed: false as const, registration };
  }

  const result = await db.transaction(async (tx) => {
    const updateResult = await tx
      .update(llcRegistrations)
      .set({ ...params.updates, status: params.toStatus })
      .where(
        and(
          eq(llcRegistrations.id, registration.id),
          eq(llcRegistrations.userId, params.userId),
          eq(llcRegistrations.status, registration.status),
        ),
      );

    const affectedRows = Number(updateResult[0].affectedRows ?? 0);
    const freshRows = await tx
      .select()
      .from(llcRegistrations)
      .where(eq(llcRegistrations.id, registration.id))
      .limit(1);
    const fresh = freshRows[0];
    if (affectedRows !== 1 || !fresh || fresh.status !== params.toStatus) {
      return { changed: false as const, registration: fresh ?? registration };
    }

    await tx.insert(llcStatusHistory).values({
      registrationId: registration.id,
      fromStatus: registration.status,
      toStatus: params.toStatus,
      source: params.source,
      note: params.note?.slice(0, 500),
    });

    return { changed: true as const, registration: fresh };
  });

  return result;
}

export async function countSubmissionAttempts(registrationId: number) {
  const db = requireDb(await getDb());
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(llcSubmissionAttempts)
    .where(eq(llcSubmissionAttempts.registrationId, registrationId));
  return Number(rows[0]?.count ?? 0);
}

export async function createSubmissionAttempt(params: {
  registrationId: number;
  attemptNumber: number;
  submissionKey: string;
  phase: "account_creation" | "llc_registration" | "status_refresh";
}) {
  const db = requireDb(await getDb());
  let attemptNumber = params.attemptNumber;

  // The (registrationId, attemptNumber, phase) unique index can collide when
  // the poller and a user/ops refresh race the count-then-insert; renumber
  // from the persisted maximum and retry instead of failing the caller.
  for (let attempt = 0; ; attempt += 1) {
    try {
      const result = await db.insert(llcSubmissionAttempts).values({
        ...params,
        attemptNumber,
        outcome: "started",
      });
      return Number(result[0].insertId);
    } catch (error) {
      const isDuplicate =
        error instanceof Error && /duplicate|ER_DUP/i.test(error.message);
      if (!isDuplicate || attempt >= 4) throw error;
      const rows = await db
        .select({ max: sql<number>`max(${llcSubmissionAttempts.attemptNumber})` })
        .from(llcSubmissionAttempts)
        .where(eq(llcSubmissionAttempts.registrationId, params.registrationId));
      attemptNumber = Number(rows[0]?.max ?? 0) + 1;
    }
  }
}

export async function finishSubmissionAttempt(params: {
  attemptId: number;
  outcome:
    | "succeeded"
    | "retryable_failure"
    | "action_required"
    | "uncertain";
  httpStatus?: number;
  whopRequestId?: string;
  providerObjectId?: string;
  errorType?: string;
  safeMessage?: string;
  retryable?: boolean;
}) {
  const db = requireDb(await getDb());
  await db
    .update(llcSubmissionAttempts)
    .set({
      outcome: params.outcome,
      httpStatus: params.httpStatus,
      whopRequestId: params.whopRequestId?.slice(0, 128),
      providerObjectId: params.providerObjectId?.slice(0, 128),
      errorType: params.errorType?.slice(0, 128),
      safeMessage: params.safeMessage?.slice(0, 500),
      retryable: params.retryable ?? false,
      finishedAt: new Date(),
    })
    .where(eq(llcSubmissionAttempts.id, params.attemptId));
}

export async function updateLlcRegistrationProviderFields(
  userId: number,
  registrationId: number,
  updates: Partial<typeof llcRegistrations.$inferInsert>,
) {
  const db = requireDb(await getDb());
  await db
    .update(llcRegistrations)
    .set(updates)
    .where(
      and(
        eq(llcRegistrations.id, registrationId),
        eq(llcRegistrations.userId, userId),
      ),
    );
  return getLlcRegistrationById(userId, registrationId);
}
