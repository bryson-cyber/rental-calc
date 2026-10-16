/**
 * Address choices on an order (owner fix, 2026-10-14; see shared/llcAddress.ts
 * and docs/LLC_ADDRESS_CHOICES_2026-10-14.md).
 *
 * Server side of the split: the boot-time columns, how an order on file is
 * read (old orders through the old single switch), the filing gate's rule
 * check, and the evidence written at submission and at filing. Nothing here
 * ever logs or returns address text; evidence holds modes, wording versions
 * and times only.
 */
import type { llcRegistrations } from "../../drizzle/schema";
import {
  llcAddressPlanIssuesForFiling,
  type LlcAddressPlanIssue,
} from "../../shared/llc";
import {
  resolveAddressModes,
  type LlcAddressMode,
  type ResolvedAddressModes,
} from "../../shared/llcAddress";

type RegistrationRow = typeof llcRegistrations.$inferSelect;

/**
 * Boot-time idempotent guard (server/llc/ensure-tables.ts runs one ADD COLUMN
 * per entry through ensureAddressColumns below: a duplicate-column error is
 * the quiet "already applied", any other failure is logged by column name).
 * Every column is NULL-able, so rows from before 2026-10-14 need no backfill.
 */
export const LLC_ADDRESS_COLUMN_SETS: ReadonlyArray<{
  table: string;
  columns: ReadonlyArray<readonly [string, string]>;
}> = [
  {
    table: "llc_registrations",
    columns: [
      ["businessAddressMode", "varchar(24) NULL"],
      ["mailingAddressMode", "varchar(24) NULL"],
      ["businessAgentAckAt", "timestamp NULL"],
      ["businessAgentAckVersion", "varchar(64) NULL"],
      ["mailingAgentAckAt", "timestamp NULL"],
      ["mailingAgentAckVersion", "varchar(64) NULL"],
      ["addressChoiceEvidence", "json NULL"],
    ],
  },
];

/** The ALTER statements the boot guard runs, one per column (each fails harmlessly once applied). */
export function llcAddressColumnStatements(): string[] {
  return LLC_ADDRESS_COLUMN_SETS.flatMap(({ table, columns }) =>
    columns.map(([name, definition]) => `ALTER TABLE \`${table}\` ADD \`${name}\` ${definition}`),
  );
}

/**
 * MySQL/TiDB "Duplicate column name" (errno 1060): the column is already
 * there, which is the normal answer on every boot after the first.
 */
export function isDuplicateColumnError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const { code, errno, message, cause } = current as {
      code?: unknown;
      errno?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (code === "ER_DUP_FIELDNAME" || errno === 1060) return true;
    if (typeof message === "string" && /duplicate column/i.test(message)) return true;
    current = cause;
  }
  return false;
}

/**
 * The boot guard for the new columns (called by ensureLlcTables). A
 * duplicate-column error is silent. Anything else (no ALTER privilege, a DDL
 * timeout, the table missing) is logged by column name, because every LLC
 * read selects these columns: a guard that failed quietly would leave every
 * order page failing with "Unknown column" while the boot log still said the
 * schema was ensured. One failing column never stops the others. Returns the
 * columns that could not be added. Logs the column and the error code only,
 * never a statement's values or an error message.
 */
export async function ensureAddressColumns(
  execute: (statement: string) => Promise<unknown>,
): Promise<string[]> {
  const failed: string[] = [];
  for (const { table, columns } of LLC_ADDRESS_COLUMN_SETS) {
    for (const [name, definition] of columns) {
      try {
        await execute(`ALTER TABLE \`${table}\` ADD \`${name}\` ${definition}`);
      } catch (error) {
        if (isDuplicateColumnError(error)) continue;
        failed.push(`${table}.${name}`);
        const code =
          typeof (error as { code?: unknown } | null)?.code === "string"
            ? (error as { code: string }).code
            : error instanceof Error
              ? error.name
              : "UnknownError";
        console.error("[LLC] Address choice column could not be added:", `${table}.${name}`, code);
      }
    }
  }
  return failed;
}

/** The address columns of a row, tolerant of rows read before the guard ran (undefined = NULL). */
type AddressColumns = Pick<
  RegistrationRow,
  | "formationState"
  | "useRegisteredAgent"
  | "businessPhone"
  | "companyAddressLine1"
  | "companyAddressLine2"
  | "companyAddressCity"
  | "companyAddressState"
  | "companyAddressPostalCode"
  | "companyAddressCountry"
> &
  Partial<
    Pick<
      RegistrationRow,
      | "businessAddressMode"
      | "mailingAddressMode"
      | "businessAgentAckAt"
      | "businessAgentAckVersion"
      | "mailingAgentAckAt"
      | "mailingAgentAckVersion"
    >
  >;

export type OrderAddressPlan = ResolvedAddressModes & {
  businessAgentAckVersion: string | null;
  mailingAgentAckVersion: string | null;
  issues: LlcAddressPlanIssue[];
};

/**
 * What this order would send to filing, and every reason it may not. Old
 * orders are read through the old switch (legacy fallback), so an order that
 * had the switch on and never acknowledged anything comes back with
 * business_agent_ack_missing and mailing_agent_ack_missing: it is refused
 * instead of silently filing the agent's office as the principal place of
 * business (the case of 2026-10-14).
 */
export function addressPlanForRow(row: AddressColumns): OrderAddressPlan {
  const modes = resolveAddressModes(row, { legacyFallback: true });
  const businessAgentAckVersion = row.businessAgentAckVersion ?? null;
  const mailingAgentAckVersion = row.mailingAgentAckVersion ?? null;
  const issues = llcAddressPlanIssuesForFiling({
    formationState: row.formationState,
    businessAddressMode: modes.business,
    mailingAddressMode: modes.mailing,
    businessAgentAckVersion,
    mailingAgentAckVersion,
    companyAddress: {
      line1: row.companyAddressLine1 ?? "",
      line2: row.companyAddressLine2 ?? "",
      city: row.companyAddressCity ?? "",
      state: row.companyAddressState ?? "",
      postalCode: row.companyAddressPostalCode ?? "",
      country: row.companyAddressCountry || "US",
    },
    businessPhone: row.businessPhone,
  });
  return { ...modes, businessAgentAckVersion, mailingAgentAckVersion, issues };
}

/** Issue codes only (never messages with values), for ops alerts and internal notes. */
export function addressPlanIssueCodes(plan: Pick<OrderAddressPlan, "issues">): string {
  return Array.from(new Set(plan.issues.map((issue) => issue.code))).join(", ");
}

const CONFIRMABLE_STATUSES = ["payment_required", "failed", "action_required"] as const;
/** store.UNCERTAIN_ERROR_PREFIX, repeated so this module stays free of the database import. */
const UNCERTAIN_ERROR_PREFIX = "uncertain_";

/**
 * A submitted order that has not reached the filing service yet and whose
 * address choices cannot be filed (in practice: an order placed before
 * 2026-10-14 with the old switch on). The client fixes it from the status
 * page; nothing else about the order can change there.
 */
export function addressChoiceNeeded(
  row: AddressColumns &
    Pick<RegistrationRow, "status" | "provider" | "doolaCompanyId" | "lastErrorType" | "isTest">,
): boolean {
  if (row.isTest) return false;
  if (row.provider !== "doola" || row.doolaCompanyId) return false;
  if (!(CONFIRMABLE_STATUSES as readonly string[]).includes(row.status)) return false;
  if (row.lastErrorType?.startsWith(UNCERTAIN_ERROR_PREFIX)) return false;
  return addressPlanForRow(row).issues.length > 0;
}

/**
 * Whether saving the address choices on a held order starts the filing right
 * away: the payment is in and the order is waiting to file. The confirm route
 * and the status card's promise use this one rule, so the card never says
 * "starts as soon as you save" before payment.
 */
export function filingStartsOnAddressConfirm(row: Pick<RegistrationRow, "retailPaidAt" | "status">): boolean {
  return Boolean(row.retailPaidAt) && (row.status === "payment_required" || row.status === "failed");
}

export type AddressChoiceSnapshot = {
  at: string;
  formationState: string | null;
  business: LlcAddressMode;
  mailing: LlcAddressMode;
  modesSource: ResolvedAddressModes["source"];
  businessAgentAckVersion: string | null;
  businessAgentAckAt: string | null;
  mailingAgentAckVersion: string | null;
  mailingAgentAckAt: string | null;
};

export type AddressChoiceEvidence = {
  submitted?: AddressChoiceSnapshot;
  sent?: AddressChoiceSnapshot;
  confirmed?: AddressChoiceSnapshot;
};

/** Modes, wording versions and times. Deliberately no address text. */
export function addressChoiceSnapshot(row: AddressColumns, at: Date): AddressChoiceSnapshot {
  const plan = addressPlanForRow(row);
  const businessAgent = plan.business === "registered_agent";
  const mailingAgent = plan.mailing === "registered_agent";
  return {
    at: at.toISOString(),
    formationState: row.formationState ?? null,
    business: plan.business,
    mailing: plan.mailing,
    modesSource: plan.source,
    businessAgentAckVersion: businessAgent ? plan.businessAgentAckVersion : null,
    businessAgentAckAt: businessAgent ? (row.businessAgentAckAt?.toISOString() ?? null) : null,
    mailingAgentAckVersion: mailingAgent ? plan.mailingAgentAckVersion : null,
    mailingAgentAckAt: mailingAgent ? (row.mailingAgentAckAt?.toISOString() ?? null) : null,
  };
}

export function withAddressChoiceEvidence(
  row: AddressColumns & Partial<Pick<RegistrationRow, "addressChoiceEvidence">>,
  stage: keyof AddressChoiceEvidence,
  at: Date = new Date(),
): AddressChoiceEvidence {
  const previous =
    row.addressChoiceEvidence && typeof row.addressChoiceEvidence === "object"
      ? (row.addressChoiceEvidence as AddressChoiceEvidence)
      : {};
  return { ...previous, [stage]: addressChoiceSnapshot(row, at) };
}

/** One plain internal line for the status history (ops-only; no address text). */
export function addressChoiceNote(plan: Pick<OrderAddressPlan, "business" | "mailing">): string {
  const business =
    plan.business === "registered_agent" ? "registered agent's address (opted in)" : "the client's own street address";
  const mailing =
    plan.mailing === "registered_agent"
      ? "registered agent, scanned to the client's account (opted in)"
      : "the client's own address";
  return `Address choices: business address = ${business}; mail and EIN letter = ${mailing}.`;
}

/** Ops-only wording of an order's address modes (no address text), for the admin page. */
export function addressModesForOps(row: AddressColumns): {
  business: LlcAddressMode;
  mailing: LlcAddressMode;
  source: ResolvedAddressModes["source"];
} {
  const plan = addressPlanForRow(row);
  return { business: plan.business, mailing: plan.mailing, source: plan.source };
}

export const UNSAVED_LEGACY_ADDRESS_CHOICE_MESSAGE =
  "We now ask for your business address and where mail goes separately. Please choose both in Step 3, then continue.";

/**
 * Final validation for an editable draft from before 2026-10-14 whose old
 * switch was on and whose Step 3 was never saved since. The wizard opens it on
 * the new defaults (the client's own address), but the row still says the
 * agent for both, and the row is what the submit evidence and the filing
 * gate read. Submitting it as-is would record the agent for both as
 * "submitted" although the review showed the client's own address, then hold
 * the paid order; from the status page's retry button the client would never
 * see the choice at all. So Step 3 is saved first, and the row agrees with
 * what the client confirmed. Non-editable orders are read through the old
 * switch already.
 */
export function unsavedLegacyAddressChoiceErrors(
  row: Pick<RegistrationRow, "useRegisteredAgent"> &
    Partial<Pick<RegistrationRow, "businessAddressMode" | "mailingAddressMode">>,
  editable: boolean,
): Record<string, string> {
  if (!editable || !row.useRegisteredAgent) return {};
  if (resolveAddressModes(row, { legacyFallback: false }).source === "stored") return {};
  return { businessAddressMode: UNSAVED_LEGACY_ADDRESS_CHOICE_MESSAGE };
}
