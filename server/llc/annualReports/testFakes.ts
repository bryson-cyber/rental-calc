/**
 * Test fakes for the annual report service: an in-memory store with the same guarded-update semantics as the SQL one,
 * a scriptable provider, one filing, and recorders for alerts and the vault mirror. Test-only; never imported by app
 * code.
 */
import { vi } from "vitest";
import type { AnnualReportProvider, AnnualReportRequirements, AnnualReportSubmission, ComplianceCalendarEvent, ProviderAnnualReport } from "./provider";
import type { AnnualReportDeps } from "./service";
import type { AnnualReportRow, AnnualReportStore, ComplianceRow, ReportGuard, ReportPatch } from "./store";
import type { FilingFacts } from "./filings";

export function memoryStore() {
  const compliance = new Map<number, ComplianceRow>();
  const reports: AnnualReportRow[] = [];
  let nextId = 1;
  const blank = (key: { registrationId: number; userId: number; fiscalYear: number }): AnnualReportRow => ({
    id: nextId++,
    ...key,
    dueDate: null,
    annualReportId: null,
    status: null,
    priceInCents: null,
    answers: null,
    checkoutSessionId: null,
    checkoutUrl: null,
    checkoutPlanId: null,
    checkoutQuoteHash: null,
    checkoutPriceCents: null,
    checkoutExpiresAt: null,
    paymentReference: null,
    paidCents: null,
    paidAt: null,
    submittedAt: null,
    confirmedAt: null,
    completedAt: null,
    filedDocumentId: null,
    lastError: null,
    lastErrorAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const apply = (row: AnnualReportRow, patch: ReportPatch) => {
    for (const [key, value] of Object.entries(patch)) if (value !== undefined) (row as Record<string, unknown>)[key] = value;
  };
  const meets = (row: AnnualReportRow, guard: ReportGuard) =>
    !(guard.paidAtIsNull && row.paidAt) &&
    !(guard.paidAtIsNotNull && !row.paidAt) &&
    !(guard.confirmedAtIsNull && row.confirmedAt) &&
    !(guard.completedAtIsNull && row.completedAt) &&
    !(guard.checkoutPlanId !== undefined && row.checkoutPlanId !== guard.checkoutPlanId);
  const store: AnnualReportStore = {
    async getCompliance(registrationId) {
      const row = compliance.get(registrationId);
      return row ? { ...row } : null;
    },
    async upsertCompliance(row) {
      compliance.set(row.registrationId, { ...row });
    },
    async listReports(registrationId) {
      return reports.filter((row) => row.registrationId === registrationId).sort((a, b) => b.fiscalYear - a.fiscalYear).map((row) => ({ ...row }));
    },
    async getReport(id) {
      const row = reports.find((candidate) => candidate.id === id);
      return row ? { ...row } : null;
    },
    async upsertReport(key, patch, guard: ReportGuard = {}) {
      let row = reports.find((candidate) => candidate.registrationId === key.registrationId && candidate.fiscalYear === key.fiscalYear);
      if (!row) {
        row = blank(key);
        reports.push(row);
      }
      if (meets(row, guard)) apply(row, patch);
      return { ...row };
    },
    async updateReport(id, patch, guard: ReportGuard = {}) {
      const row = reports.find((candidate) => candidate.id === id);
      if (!row || !meets(row, guard)) return false;
      apply(row, patch);
      return true;
    },
    async listPaidUnconfirmed() {
      return reports
        .filter((row) => !row.confirmedAt && (row.paidAt || (row.priceInCents === 0 && row.status === "FILLED" && row.annualReportId)))
        .map((row) => ({ ...row }));
    },
    async listAwaitingPayment() {
      return reports.filter((row) => row.checkoutPlanId && !row.paidAt && !row.confirmedAt && row.status === "FILLED").map((row) => ({ ...row }));
    },
    async listDueSoon(lastDate) {
      return Array.from(compliance.values()).filter(
        (row) => row.nextDueDate && row.nextDueDate <= lastDate && row.filingRequired !== false && (row.status === "UPCOMING" || row.status === "OVERDUE"),
      );
    },
    async listStaleFilings(staleBefore) {
      return Array.from(compliance.values())
        .filter((row) => !row.syncedAt || row.syncedAt < staleBefore)
        .map((row) => ({ registrationId: row.registrationId, userId: row.userId }));
    },
  };
  return { store, compliance, reports };
}

export const QUESTION_FIELDS = [
  { fieldId: "hasAssets", label: "Does the LLC hold assets in the state?", type: "BOOLEAN", group: "QUESTION", required: true, affectsFee: true, options: [], dependsOn: null },
  { fieldId: "assetValue", label: "Value of assets in the state", type: "AMOUNT", group: "QUESTION", required: true, affectsFee: true, options: [], dependsOn: { fieldId: "hasAssets", answer: "true" } },
  { fieldId: "companyName", label: "Company name", type: "TEXT", group: "COMPANY_DETAIL", required: true, affectsFee: false, options: [], dependsOn: null },
  { fieldId: "mailingAddress", label: "Mailing address", type: "ADDRESS", group: "COMPANY_DETAIL", required: true, affectsFee: false, options: [], dependsOn: null },
  { fieldId: "phoneNumber", label: "Phone", type: "TEXT", group: "COMPANY_DETAIL", required: false, affectsFee: false, options: [], dependsOn: null },
] as const;

export function requirements(overrides: Partial<AnnualReportRequirements> = {}): AnnualReportRequirements {
  return {
    state: "WY",
    entityType: "LLC",
    fiscalYear: 2027,
    isFilingRequired: true,
    dueDate: "2027-03-01",
    fields: QUESTION_FIELDS.map((field) => ({ ...field, options: [...field.options], dependsOn: field.dependsOn ? { ...field.dependsOn } : null })),
    ...overrides,
  };
}

export function providerReport(overrides: Partial<ProviderAnnualReport> = {}): ProviderAnnualReport {
  return {
    annualReportId: "ar_1",
    fiscalYear: 2027,
    state: "WY",
    entityType: "LLC",
    status: "FILLED",
    priceInCents: 6000,
    submittedAt: "2026-12-10T10:00:00Z",
    createdAt: null,
    updatedAt: null,
    answers: [],
    ...overrides,
  };
}

export function fakeProvider(calendar: ComplianceCalendarEvent | null = { state: "WY", nextDueDate: "2027-03-01", lastFiledDate: null, status: "UPCOMING" }) {
  const reports: ProviderAnnualReport[] = [];
  const provider = {
    getRequirements: vi.fn(async () => requirements()),
    getStateFee: vi.fn(async () => ({ state: "WY", entityType: "LLC", priceInCents: 6000, isFilingRequired: true, isMinimum: true })),
    submit: vi.fn(async (_companyId: string, _body: AnnualReportSubmission, _options?: { attempt?: string }) => {
      const report = providerReport();
      const index = reports.findIndex((existing) => existing.fiscalYear === report.fiscalYear);
      if (index >= 0) reports.splice(index, 1);
      reports.push(report);
      return { report, isReplaced: index >= 0 };
    }),
    confirm: vi.fn(async (_companyId: string, annualReportId: string) => {
      const report = reports.find((candidate) => candidate.annualReportId === annualReportId) ?? providerReport({ annualReportId });
      report.status = "IN_PROGRESS";
      return { ...report };
    }),
    list: vi.fn(async () => reports.map((report) => ({ ...report }))),
    get: vi.fn(async (_companyId: string, annualReportId: string) => {
      const report = reports.find((candidate) => candidate.annualReportId === annualReportId);
      return report ? { ...report } : null;
    }),
    calendar: vi.fn(async () => calendar),
  } satisfies AnnualReportProvider;
  return { provider, reports };
}

export function filing(overrides: Partial<FilingFacts> = {}): FilingFacts {
  return {
    registrationId: 42,
    userId: 7,
    eligible: true,
    companyId: "dc_test123",
    state: "WY",
    companyName: "Amina Studio LLC",
    businessAddress: { line1: "1 Main St", city: "Cheyenne", state: "WY", postalCode: "82001", country: "USA" },
    mailingAddress: { line1: "1 Main St", city: "Cheyenne", state: "WY", postalCode: "82001", country: "USA" },
    phone: "+13075550100",
    founderEmail: "amina@example.com",
    founderFirstName: "Amina",
    founderPhone: "3075550100",
    ...overrides,
  };
}

export function makeDeps(options: { facts?: FilingFacts; calendar?: ComplianceCalendarEvent | null; now?: Date } = {}) {
  const memory = memoryStore();
  const fake = fakeProvider(options.calendar === undefined ? undefined : options.calendar);
  const facts = options.facts ?? filing();
  const alerts = { once: vi.fn(async () => "sent") };
  const documents = { mirror: vi.fn(async () => ({ mirrored: 0 })) };
  // Fifty days before the 2027-03-01 due date, in 2027: inside the filing window, the fiscal year confirmed (2027).
  let now = options.now ?? new Date("2027-01-10T18:00:00Z");
  const deps: AnnualReportDeps = {
    provider: fake.provider,
    store: memory.store,
    filings: {
      load: vi.fn(async (registrationId: number) => (registrationId === facts.registrationId ? facts : null)),
      findByCompanyId: vi.fn(async (companyId: string) => (companyId === facts.companyId ? facts : null)),
    },
    alerts,
    documents,
    now: () => now,
  };
  return {
    deps,
    memory,
    provider: fake.provider,
    providerReports: fake.reports,
    facts,
    alerts,
    documents,
    setNow(next: Date) {
      now = next;
    },
  };
}
