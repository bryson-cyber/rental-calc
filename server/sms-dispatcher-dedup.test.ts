import { describe, it, expect } from "vitest";
import * as fs from "fs";

/**
 * Tests for SMS Dispatcher Duplicate Send Fix:
 * 1. Startup recovery is awaited (not fire-and-forget) before first dispatch
 * 2. processScheduledMessages has a mutex to prevent concurrent runs
 * 3. Mutex is released in all code paths (early return, catch, finally)
 */

describe("SMS Dispatcher Duplicate Send Fix - Code Structure", () => {
  const source = fs.readFileSync(
    "/home/ubuntu/rental-calculator/server/routers/webinar-sms.ts",
    "utf-8"
  );

  it("should have smsDispatcherRunning mutex variable", () => {
    expect(source).toContain("let smsDispatcherRunning = false;");
    expect(source).toContain("// Mutex to prevent concurrent dispatch runs");
  });

  it("startup recovery should NOT be fire-and-forget (no async IIFE)", () => {
    const funcStart = source.indexOf("export async function startSmsDispatcher()");
    const funcEnd = source.indexOf("// ─── END STARTUP RECOVERY", funcStart);
    const recoverySection = source.substring(funcStart, funcEnd);

    // Should NOT have the old fire-and-forget pattern: (async () => { ... })()
    expect(recoverySection).not.toContain("(async () =>");

    // Should use try/catch directly (awaited)
    expect(recoverySection).toContain("try {");
    expect(recoverySection).toContain("RECOVERY: Resetting stuck message");
  });

  it("processScheduledMessages should check mutex at the start", () => {
    const funcStart = source.indexOf("const processScheduledMessages = async () => {");
    expect(funcStart).toBeGreaterThan(-1);

    // Get first 500 chars of the function
    const funcHead = source.substring(funcStart, funcStart + 800);

    // Should check mutex
    expect(funcHead).toContain("if (smsDispatcherRunning)");
    expect(funcHead).toContain("Previous run still in progress");

    // Should set mutex
    expect(funcHead).toContain("smsDispatcherRunning = true");
  });

  it("mutex should be released on early return (no due messages)", () => {
    const funcStart = source.indexOf("const processScheduledMessages = async () => {");
    const funcEnd = source.indexOf("smsDispatcherInterval = setInterval", funcStart);
    const funcBody = source.substring(funcStart, funcEnd);

    // When dueMessages.length === 0, should release mutex before return
    expect(funcBody).toContain("if (dueMessages.length === 0) {\n        smsDispatcherRunning = false;\n        return;\n      }");
  });

  it("mutex should be released in finally block", () => {
    const funcStart = source.indexOf("const processScheduledMessages = async () => {");
    const funcEnd = source.indexOf("smsDispatcherInterval = setInterval", funcStart);
    const funcBody = source.substring(funcStart, funcEnd);

    expect(funcBody).toContain("} finally {\n      smsDispatcherRunning = false;\n    }");
  });

  it("mutex should be released when db is unavailable", () => {
    const funcStart = source.indexOf("const processScheduledMessages = async () => {");
    const funcHead = source.substring(funcStart, funcStart + 600);

    expect(funcHead).toContain("if (!db) {\n      smsDispatcherRunning = false;\n      return;\n    }");
  });

  it("startup recovery comment should explain WHY it must be awaited", () => {
    const funcStart = source.indexOf("export async function startSmsDispatcher()");
    const recoverySection = source.substring(funcStart, funcStart + 1500);

    expect(recoverySection).toContain("MUST complete before the first processScheduledMessages()");
    expect(recoverySection).toContain("race condition");
    expect(recoverySection).toContain("duplicate sends");
  });
});
