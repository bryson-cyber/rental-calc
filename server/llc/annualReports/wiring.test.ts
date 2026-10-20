import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ getDb: vi.fn() }));
const refresh = vi.hoisted(() => ({ refreshDoolaRegistrationStatus: vi.fn(async () => ({ refreshed: true, changed: false })) }));
const annual = vi.hoisted(() => ({ processAnnualReportEvent: vi.fn(async () => "synced") }));
const notify = vi.hoisted(() => ({ sendOpsAlert: vi.fn(async () => true) }));

vi.mock("../../db", () => ({ getDb: database.getDb }));
vi.mock("../doolaSubmission", () => ({
  refreshDoolaRegistrationStatus: refresh.refreshDoolaRegistrationStatus,
  autoReleaseFormationDocuments: vi.fn(async () => ({ released: 0 })),
}));
vi.mock("../../ops/notify", () => ({
  sendOpsAlert: notify.sendOpsAlert,
  submissionProblemAlert: vi.fn((params: unknown) => params),
  statusChangeAlert: vi.fn((params: unknown) => params),
}));
vi.mock("../requiredActions", () => ({ ingestDoolaRequiredActionWebhook: vi.fn(async () => ({ opened: true })) }));
vi.mock("./service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./service")>()),
  processAnnualReportEvent: annual.processAnnualReportEvent,
}));
vi.mock("./defaults", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./defaults")>()),
  defaultAnnualReportDeps: () => ({}),
}));

import { processDoolaEvent } from "../doolaWebhook";
import { handleWhopWebhookEvent } from "../whopRetailWebhook";
import { isAnnualReportDocumentType, mirrorFormationDocuments } from "../documents";
import { normalizeDoolaDocumentType } from "../doola";
import { annualReportDocumentName, isAnnualReportDocument, pairDocumentsWithReports } from "./documents";
import { ANNUAL_REPORT_CHECKOUT_KIND, ANNUAL_REPORT_CHECKOUT_METADATA_VERSION } from "./paymentMetadata";
import type { AnnualReportRow } from "./store";

const root = path.resolve(__dirname, "../../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

function fakeWebhookDb() {
  return {
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 42, userId: 7, status: "completed", legalName: "Amina Studio", entitySuffix: "LLC" }] }) }) })),
    insert: vi.fn(() => ({ values: async () => [{ insertId: 1 }] })),
  };
}

const annualMetadata = {
  rc_metadata_version: ANNUAL_REPORT_CHECKOUT_METADATA_VERSION,
  rc_checkout_kind: ANNUAL_REPORT_CHECKOUT_KIND,
  rc_llc_registration_id: "42",
  rc_llc_annual_report_id: "3",
  rc_llc_annual_report_quote_hash: "a".repeat(64),
};

describe("doola webhook routing (events relayed by Northform)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.getDb.mockResolvedValue(fakeWebhookDb());
  });

  it.each(["company_annual_report_submitted", "company_annual_report_completed", "document_annualreport_uploaded"])(
    "%s goes to the annual report handler, never the formation refresh",
    async (eventName) => {
      await processDoolaEvent({ eventId: `evt_${eventName}`, eventName, eventPayload: { doolaCompanyId: "dc_1", documentId: "doc_9" } });
      expect(annual.processAnnualReportEvent).toHaveBeenCalledWith({ eventName, doolaCompanyId: "dc_1", documentId: "doc_9" }, expect.anything());
      expect(refresh.refreshDoolaRegistrationStatus).not.toHaveBeenCalled();
    },
  );

  it("an unknown event stays harmless (the usual refresh, nothing annual)", async () => {
    await processDoolaEvent({ eventId: "evt_new", eventName: "company_something_new", eventPayload: { doolaCompanyId: "dc_1" } });
    expect(annual.processAnnualReportEvent).not.toHaveBeenCalled();
    expect(refresh.refreshDoolaRegistrationStatus).toHaveBeenCalledTimes(1);
  });
});

describe("Whop webhook routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("an annual report payment goes to its own verifier, never the formation one", async () => {
    const processPayment = vi.fn();
    const processAnnualReportPayment = vi.fn(async () => ({ outcome: "confirmed" }));
    const outcome = await handleWhopWebhookEvent(
      { type: "payment.succeeded", data: { id: "pay_1", metadata: annualMetadata } },
      { processPayment, processAnnualReportPayment },
    );
    expect(outcome).toBe("llc-annual-report-confirmed");
    expect(processAnnualReportPayment).toHaveBeenCalledWith({ paymentId: "pay_1" });
    expect(processPayment).not.toHaveBeenCalled();
  });

  it("a formation payment still goes to the formation verifier", async () => {
    const processPayment = vi.fn(async () => ({ outcome: "filed" as const, registrationId: 42, paymentId: "pay_2" }));
    const processAnnualReportPayment = vi.fn();
    const outcome = await handleWhopWebhookEvent(
      { type: "payment.succeeded", data: { id: "pay_2", metadata: { rc_metadata_version: "rc_llc_checkout_v1", rc_checkout_kind: "llc_filing", rc_llc_registration_id: "42", rc_llc_quote_hash: "b".repeat(64), rc_llc_quote_version: "rc-retail-2026-10-18" } } },
      { processPayment, processAnnualReportPayment },
    );
    expect(outcome).toBe("llc-filed");
    expect(processAnnualReportPayment).not.toHaveBeenCalled();
  });

  it("an annual report payment that matches nothing on file alerts ops", async () => {
    const { TRPCError } = await import("@trpc/server");
    const processAnnualReportPayment = vi.fn(async () => {
      throw new TRPCError({ code: "FORBIDDEN", message: "This payment does not belong to this annual report." });
    });
    const outcome = await handleWhopWebhookEvent({ type: "payment.succeeded", data: { id: "pay_3", metadata: annualMetadata } }, { processAnnualReportPayment });
    expect(outcome).toBe("llc-annual-report-rejected:FORBIDDEN");
    expect(notify.sendOpsAlert).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining("annual report payment needs review") }));
  });

  it("a refund or dispute of an annual report payment alerts ops", async () => {
    const fetchPayment = vi.fn(async () => ({ id: "pay_4", metadata: annualMetadata }));
    const outcome = await handleWhopWebhookEvent({ type: "dispute.created", data: { payment: { id: "pay_4" } } }, { fetchPayment });
    expect(outcome).toBe("alerted:dispute.created");
    expect(notify.sendOpsAlert).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining("annual report payment") }));
  });
});

describe("filed reports in the vault", () => {
  const row = (overrides: Partial<AnnualReportRow>): AnnualReportRow =>
    ({ id: 1, registrationId: 42, userId: 7, fiscalYear: 2026, status: "FILING_COMPLETED", confirmedAt: new Date(), filedDocumentId: null, ...overrides }) as AnnualReportRow;

  it("annual report documents are recognized in every spelling", () => {
    expect(normalizeDoolaDocumentType("AnnualReport")).toBe("annual_report");
    for (const type of ["annual_report", "ANNUAL_REPORT", "annualreport", "Annual Report"]) expect(isAnnualReportDocumentType(type)).toBe(true);
    expect(isAnnualReportDocumentType("articles_of_organization")).toBe(false);
    expect(isAnnualReportDocument({ documentType: "AnnualReport", name: "x.pdf" })).toBe(true);
    expect(annualReportDocumentName(2027)).toBe("Annual report 2027");
  });

  it("pairs each document with one report: by the year in its name, else the oldest waiting", () => {
    const reports = [row({ id: 1, fiscalYear: 2026 }), row({ id: 2, fiscalYear: 2027 }), row({ id: 3, fiscalYear: 2028, status: "FILLED", confirmedAt: null })];
    expect(pairDocumentsWithReports([{ id: "d27", name: "WY 2027 Annual Report.pdf" }, { id: "dx", name: "report.pdf" }], reports).map((pair) => [pair.documentId, pair.report.id])).toEqual([
      ["d27", 2],
      ["dx", 1],
    ]);
    // Already linked documents and reports are left alone; an unconfirmed report never gets one.
    expect(pairDocumentsWithReports([{ id: "d27", name: "x" }, { id: "d9", name: "y" }], [row({ id: 2, filedDocumentId: "d27" }), row({ id: 3, status: "FILLED", confirmedAt: null })])).toEqual([]);
  });

  it("the formation sweep never mirrors an annual report under the provider's name", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    database.getDb.mockResolvedValue({ select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) })), insert: vi.fn() });
    const result = await mirrorFormationDocuments({
      userId: 7,
      registrationId: 42,
      snapshot: { documents: [{ id: "doc_9", name: "provider annual report.pdf", document_type: "annual_report", download_url: "https://files.example/doc_9" }] } as never,
    });
    expect(result).toEqual({ mirrored: 0, skipped: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("wiring and white-label", () => {
  it("the tables are ensured at boot, right after llc_webhook_events", () => {
    const ensure = read("server/llc/ensure-tables.ts");
    expect(ensure).toContain("for (const statement of ANNUAL_REPORT_TABLES)");
    expect(ensure.indexOf("for (const statement of ANNUAL_REPORT_TABLES)")).toBeGreaterThan(ensure.indexOf("CREATE TABLE IF NOT EXISTS \\`llc_webhook_events\\`"));
    const tables = read("server/llc/annualReports/tables.ts");
    expect(tables.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(2);
    expect(tables).toContain("UNIQUE INDEX \\`llc_annual_reports_year_uq\\` (\\`registrationId\\`, \\`fiscalYear\\`)");
  });

  it("the hourly poller runs the sweep; the Whop webhook routes annual report fees before the formation branch", () => {
    expect(read("server/ops/poller.ts")).toContain('import("../llc/annualReports/sweep")');
    const whop = read("server/llc/whopRetailWebhook.ts");
    expect(whop.indexOf("isAnnualReportPaymentPayload(payload)")).toBeGreaterThan(-1);
    expect(whop.indexOf("isAnnualReportPaymentPayload(payload)")).toBeLessThan(whop.indexOf("isForeignPayment(payload.data)"));
  });

  it("the card sits on her LLC page and the ops section on /admin/llc", () => {
    const status = read("client/src/pages/llc/FormationStatus.tsx");
    expect(status).toContain("<AnnualReportCard registrationId={registrationId} />");
    expect(read("client/src/pages/admin/LlcOpsPage.tsx")).toContain("<AnnualReportsOpsPanel registrationId={order.id} />");
    const router = read("server/llc/router.ts");
    expect(router).toContain("...annualReportMemberProcedures");
    expect(router).toContain("...annualReportOpsProcedures");
  });

  it("member-facing files never name the providers and use no dashes in her words", () => {
    for (const file of ["client/src/components/llc-formation/AnnualReportCard.tsx", "shared/llcAnnualReports.ts", "server/llc/annualReports/copy.ts"]) {
      const source = read(file);
      expect(source, file).not.toMatch(/doola|whop/i);
      expect(source, file).not.toMatch(/[—–]/);
    }
  });
});
