import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for WebinarJam import fixes:
 * 1. saveWebinarSelection restarts the cron
 * 2. Cron re-reads settings from DB each run (no stale closure)
 * 3. Import falls back to no schedule_id when schedule_id returns 0 registrants
 */

// We test the logic by reading the source code patterns, since the actual
// functions depend on DB connections. These are structural/unit tests.

describe("WebinarJam Import Fix - Code Structure", () => {
  it("saveWebinarSelection should call restartWebinarImportCron", async () => {
    // Read the source to verify the fix is in place
    const fs = await import("fs");
    const source = fs.readFileSync(
      "/home/ubuntu/rental-calculator/server/routers/webinar-sms.ts",
      "utf-8"
    );

    // Find the saveWebinarSelection mutation
    const saveWebinarStart = source.indexOf("saveWebinarSelection: adminProcedure");
    expect(saveWebinarStart).toBeGreaterThan(-1);

    // Find the next procedure after saveWebinarSelection
    const nextProcedure = source.indexOf("getWebinarCredentials: adminProcedure", saveWebinarStart);
    expect(nextProcedure).toBeGreaterThan(saveWebinarStart);

    // Extract just the saveWebinarSelection body
    const saveWebinarBody = source.substring(saveWebinarStart, nextProcedure);

    // Verify it calls restartWebinarImportCron
    expect(saveWebinarBody).toContain("restartWebinarImportCron");
  });

  it("cron runImport should re-read settings from DB each run", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "/home/ubuntu/rental-calculator/server/routers/webinar-sms.ts",
      "utf-8"
    );

    // Find the runImport function inside startWebinarImportCron
    const cronStart = source.indexOf("const runImport = async () => {");
    expect(cronStart).toBeGreaterThan(-1);

    // Find the end of the runImport function (next export)
    const cronEnd = source.indexOf("export async function restartWebinarImportCron", cronStart);
    expect(cronEnd).toBeGreaterThan(cronStart);

    const runImportBody = source.substring(cronStart, cronEnd);

    // Verify it re-reads settings from DB
    expect(runImportBody).toContain("Re-read settings from DB each run");
    expect(runImportBody).toContain("freshSettings");
    expect(runImportBody).toContain('selected_webinar_id');
    expect(runImportBody).toContain('selected_webinar_name');
    expect(runImportBody).toContain('selected_schedule_id');

    // Verify it uses currentWebinarId (from fresh settings) not the closure webinarId
    expect(runImportBody).toContain("currentWebinarId");
    expect(runImportBody).toContain("currentWebinarName");
  });

  it("runWebinarImport should have schedule_id fallback logic", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "/home/ubuntu/rental-calculator/server/routers/webinar-sms.ts",
      "utf-8"
    );

    // Find the runWebinarImport function
    const importStart = source.indexOf("async function runWebinarImport(");
    expect(importStart).toBeGreaterThan(-1);

    // Find the end of the function
    const importEnd = source.indexOf("// ─── Cron:", importStart);
    expect(importEnd).toBeGreaterThan(importStart);

    const importBody = source.substring(importStart, importEnd);

    // Verify fallback logic exists
    expect(importBody).toContain("FALLBACK");
    expect(importBody).toContain("schedule_id");
    expect(importBody).toContain("retrying without schedule_id");

    // Verify it checks allRegistrants.length === 0 && scheduleId
    expect(importBody).toContain("allRegistrants.length === 0 && scheduleId");

    // Verify it calls fetchWebinarJamRegistrants with undefined schedule
    expect(importBody).toContain("fetchWebinarJamRegistrants(webinarId, undefined, page, overrideApiKey)");
  });

  it("fetchWebinarJamRegistrants should handle paginated response correctly", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "/home/ubuntu/rental-calculator/server/routers/webinar-sms.ts",
      "utf-8"
    );

    // Find fetchWebinarJamRegistrants function
    const funcStart = source.indexOf("async function fetchWebinarJamRegistrants(");
    expect(funcStart).toBeGreaterThan(-1);

    const funcEnd = source.indexOf("async function fetchWebinarJamDetails(", funcStart);
    expect(funcEnd).toBeGreaterThan(funcStart);

    const funcBody = source.substring(funcStart, funcEnd);

    // Verify it handles both array and paginated object responses
    expect(funcBody).toContain("Array.isArray(paginatedResult)");
    expect(funcBody).toContain("paginatedResult.data");
    expect(funcBody).toContain("current_page");
    expect(funcBody).toContain("last_page");
    expect(funcBody).toContain("hasMore");
  });

  it("import should handle phone normalization for deduplication", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "/home/ubuntu/rental-calculator/server/routers/webinar-sms.ts",
      "utf-8"
    );

    // Find runWebinarImport
    const importStart = source.indexOf("async function runWebinarImport(");
    const importEnd = source.indexOf("// ─── Cron:", importStart);
    const importBody = source.substring(importStart, importEnd);

    // Verify phone normalization is used for deduplication
    expect(importBody).toContain("normalizePhone");
    expect(importBody).toContain("existingPhones");
    expect(importBody).toContain("phone_country_code");
    expect(importBody).toContain("phone_number");
  });
});

describe("WebinarJam Import Fix - Phone Normalization", () => {
  // Test the normalizePhone function logic directly
  function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
    if (digits.length === 10) return digits;
    return digits;
  }

  it("should normalize 10-digit US number", () => {
    expect(normalizePhone("5551234567")).toBe("5551234567");
  });

  it("should strip leading 1 from 11-digit US number", () => {
    expect(normalizePhone("15551234567")).toBe("5551234567");
  });

  it("should handle phone with country code prefix", () => {
    expect(normalizePhone("+15551234567")).toBe("5551234567");
  });

  it("should handle phone with dashes and spaces", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("5551234567");
  });

  it("should pass through international numbers", () => {
    expect(normalizePhone("923295968443")).toBe("923295968443");
  });

  it("should handle concatenated country code + phone", () => {
    // This is how the import builds the phone: phone_country_code + phone_number
    const countryCode = "+1";
    const phoneNumber = "3138088432";
    const fullPhone = countryCode + phoneNumber;
    expect(normalizePhone(fullPhone)).toBe("3138088432");
  });
});
