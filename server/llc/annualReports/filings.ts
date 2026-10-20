/**
 * App glue: what the annual report service needs to know about one LLC filing, read from this app's own
 * llc_registrations / llc_founders rows (ported from Her First Order, 2026-10-20).
 *
 * Eligible: a real filing (never test or demo), completed, filed through the provider with a company id, in the
 * provider environment this server talks to (a company made in the other environment does not exist here and would
 * 404 forever; same fence as refreshDoolaRegistrationStatus).
 *
 * Addresses: this app's wizard has one company address plus "use the registered agent". With the agent, the filing
 * went in under the agent's address for both business and mail, so nothing is prefilled and she types what the state
 * asks; with her own address, it fills both. The recipient for reminders is the account email, like every LLC email
 * in this app (clientEmails.ts).
 */
import { eq } from "drizzle-orm";
import { llcRegistrations, users } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { isTestRegistration } from "../demoMarker";
import { getDoolaEnvironment, normalizePhoneForDoola, toIso3Country } from "../doola";
import { findLlcRegistrationOwner, getLlcRegistrationById } from "../store";
import type { AnnualReportAddressValue } from "../../../shared/llcAnnualReports";

export type FilingFacts = {
  registrationId: number;
  userId: number;
  eligible: boolean;
  companyId: string | null;
  state: string | null;
  companyName: string;
  /** Her business address when she gave her own (not the registered agent's). */
  businessAddress: AnnualReportAddressValue | null;
  mailingAddress: AnnualReportAddressValue | null;
  phone: string | null;
  founderEmail: string | null;
  founderFirstName: string | null;
  founderPhone: string | null;
};

export type FilingSource = {
  load(registrationId: number): Promise<FilingFacts | null>;
  findByCompanyId(companyId: string): Promise<FilingFacts | null>;
};

function environmentMatches(doolaEnv: string | null): boolean {
  if (!doolaEnv) return true;
  try {
    return doolaEnv === getDoolaEnvironment();
  } catch {
    return false;
  }
}

async function loadFacts(registrationId: number): Promise<FilingFacts | null> {
  const owner = await findLlcRegistrationOwner(registrationId);
  if (!owner) return null;
  const bundle = await getLlcRegistrationById(owner.userId, registrationId);
  if (!bundle) return null;
  const { registration, founders } = bundle;
  const primary = founders.find((founder) => founder.isPrimary) ?? founders[0] ?? null;
  const eligible =
    registration.status === "completed" &&
    registration.provider === "doola" &&
    Boolean(registration.doolaCompanyId) &&
    !isTestRegistration(registration) &&
    environmentMatches(registration.doolaEnv ?? null);

  let country = "USA";
  try {
    country = toIso3Country(registration.companyAddressCountry);
  } catch {
    // An address outside the mapped countries is left for her to type.
  }
  const own: AnnualReportAddressValue | null =
    !registration.useRegisteredAgent && registration.companyAddressLine1 && registration.companyAddressCity
      ? {
          line1: registration.companyAddressLine1,
          ...(registration.companyAddressLine2 ? { line2: registration.companyAddressLine2 } : {}),
          city: registration.companyAddressCity,
          state: registration.companyAddressState ?? "",
          postalCode: registration.companyAddressPostalCode ?? "",
          country,
        }
      : null;
  return {
    registrationId,
    userId: owner.userId,
    eligible,
    companyId: registration.doolaCompanyId ?? null,
    state: registration.formationState ?? null,
    companyName: [registration.legalName, registration.entitySuffix].filter(Boolean).join(" ").trim(),
    businessAddress: own,
    // This app's filing sent her one company address as BOTH the business and the mailing address (doola.ts
    // mapRegistrationToDoolaCompany), so this is her own mailing address of record, not a stand-in for it.
    mailingAddress: own,
    phone: normalizePhoneForDoola(registration.businessPhone) ?? normalizePhoneForDoola(primary?.phone) ?? null,
    founderEmail: primary?.email ?? null,
    founderFirstName: primary?.firstName ?? null,
    founderPhone: primary?.phone ?? null,
  };
}

export const sqlFilingSource: FilingSource = {
  load: loadFacts,
  async findByCompanyId(companyId) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select({ id: llcRegistrations.id })
      .from(llcRegistrations)
      .where(eq(llcRegistrations.doolaCompanyId, companyId))
      .limit(1);
    return rows[0] ? loadFacts(rows[0].id) : null;
  },
};

/** The reminder recipient: the account email that owns the filing (as every LLC email here), first name from the founder. */
export async function loadReminderRecipient(registrationId: number): Promise<{ email: string; firstName: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const owner = await findLlcRegistrationOwner(registrationId);
  if (!owner) return null;
  const [user] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, owner.userId)).limit(1);
  const email = user?.email?.trim();
  if (!email) return null;
  const bundle = await getLlcRegistrationById(owner.userId, registrationId);
  const primary = bundle?.founders.find((founder) => founder.isPrimary) ?? bundle?.founders[0] ?? null;
  const firstName = (primary?.firstName ?? user?.name?.split(/\s+/)[0] ?? "").trim().slice(0, 60);
  return { email, firstName };
}
