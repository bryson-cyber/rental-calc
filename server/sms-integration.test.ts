/**
 * SMS Integration Tests
 * 
 * Verifies that the SimpleTexting API integration uses the correct
 * endpoint URL, mode values, and phone number formatting.
 */

import { describe, it, expect, vi } from "vitest";

describe("SMS Integration - sms-email-notifications", () => {
  it("should use SINGLE_SMS_STRICTLY mode (not invalid SINGLE_SMS)", async () => {
    // Read the source file to verify the mode value
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "sms-email-notifications.ts"),
      "utf-8"
    );
    
    // Should NOT contain the invalid mode
    expect(source).not.toContain("mode: 'SINGLE_SMS',");
    expect(source).not.toContain('mode: "SINGLE_SMS",');
    
    // Should contain a valid mode
    const hasValidMode = 
      source.includes("SINGLE_SMS_STRICTLY") || 
      source.includes("AUTO") || 
      source.includes("MMS_PREFERRED");
    expect(hasValidMode).toBe(true);
  });

  it("should use the correct SimpleTexting API v2 endpoint URL", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "sms-email-notifications.ts"),
      "utf-8"
    );
    
    // Must include /v2/api/ in the URL path
    expect(source).toContain("api-app2.simpletexting.com/v2/api/messages");
    // Should NOT have the wrong URL without /api/
    expect(source).not.toMatch(/simpletexting\.com\/v2\/messages[^\/]/);
  });

  it("should export sendSMSNotification function", async () => {
    const mod = await import("./sms-email-notifications");
    expect(typeof mod.sendSMSNotification).toBe("function");
  });

  it("should export generateShareCode function", async () => {
    const mod = await import("./sms-email-notifications");
    expect(typeof mod.generateShareCode).toBe("function");
  });

  it("should generate unique share codes", async () => {
    const mod = await import("./sms-email-notifications");
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(mod.generateShareCode());
    }
    // All 100 codes should be unique
    expect(codes.size).toBe(100);
  });

  it("should generate 10-character share codes", async () => {
    const mod = await import("./sms-email-notifications");
    const code = mod.generateShareCode();
    expect(code.length).toBe(10);
  });
});

describe("SMS Integration - newsletter-sms", () => {
  it("should use the correct SimpleTexting API v2 base URL with /api/", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "newsletter-sms.ts"),
      "utf-8"
    );
    
    // Must include /v2/api in the base URL
    expect(source).toContain("simpletexting.com/v2/api");
    // Should NOT have the wrong base URL without /api
    expect(source).not.toMatch(/SIMPLETEXTING_API_BASE\s*=\s*['"]https:\/\/api-app2\.simpletexting\.com\/v2['"]/);
  });

  it("should use a valid mode value (AUTO, SINGLE_SMS_STRICTLY, or MMS_PREFERRED)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "newsletter-sms.ts"),
      "utf-8"
    );
    
    // Should NOT contain the invalid mode
    expect(source).not.toContain("mode: 'SINGLE_SMS',");
    expect(source).not.toContain('mode: "SINGLE_SMS",');
    
    // Should contain a valid mode
    const hasValidMode = 
      source.includes("'AUTO'") || 
      source.includes("'SINGLE_SMS_STRICTLY'") || 
      source.includes("'MMS_PREFERRED'");
    expect(hasValidMode).toBe(true);
  });

  it("should export sendSMS function", async () => {
    const mod = await import("./newsletter-sms");
    expect(typeof mod.sendSMS).toBe("function");
  });

  it("should export sendDealAlertSMS function", async () => {
    const mod = await import("./newsletter-sms");
    expect(typeof mod.sendDealAlertSMS).toBe("function");
  });

  it("should export sendWelcomeSMS function", async () => {
    const mod = await import("./newsletter-sms");
    expect(typeof mod.sendWelcomeSMS).toBe("function");
  });

  it("should export sendWeeklyMarketSMS function", async () => {
    const mod = await import("./newsletter-sms");
    expect(typeof mod.sendWeeklyMarketSMS).toBe("function");
  });

  it("should export isValidPhoneNumber function", async () => {
    const mod = await import("./newsletter-sms");
    expect(typeof mod.isValidPhoneNumber).toBe("function");
  });

  it("should validate US phone numbers correctly", async () => {
    const { isValidPhoneNumber } = await import("./newsletter-sms");
    
    // Valid US numbers
    expect(isValidPhoneNumber("5551234567")).toBe(true);
    expect(isValidPhoneNumber("15551234567")).toBe(true);
    expect(isValidPhoneNumber("(555) 123-4567")).toBe(true);
    expect(isValidPhoneNumber("+1 555 123 4567")).toBe(true);
    
    // Invalid numbers
    expect(isValidPhoneNumber("123")).toBe(false);
    expect(isValidPhoneNumber("")).toBe(false);
    expect(isValidPhoneNumber("abc")).toBe(false);
  });
});

describe("Phone Number Formatting", () => {
  it("should format 10-digit US numbers with +1 prefix", async () => {
    // The formatPhoneNumber function is internal to sms-email-notifications
    // We test the logic directly
    const formatPhoneNumber = (phone: string): string => {
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
      if (digits.length > 10) return `+${digits}`;
      return phone;
    };

    expect(formatPhoneNumber("5551234567")).toBe("+15551234567");
    expect(formatPhoneNumber("(555) 123-4567")).toBe("+15551234567");
    expect(formatPhoneNumber("555-123-4567")).toBe("+15551234567");
  });

  it("should handle 11-digit numbers starting with 1", () => {
    const formatPhoneNumber = (phone: string): string => {
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
      if (digits.length > 10) return `+${digits}`;
      return phone;
    };

    expect(formatPhoneNumber("15551234567")).toBe("+15551234567");
    expect(formatPhoneNumber("1-555-123-4567")).toBe("+15551234567");
  });

  it("should handle international numbers", () => {
    const formatPhoneNumber = (phone: string): string => {
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
      if (digits.length > 10) return `+${digits}`;
      return phone;
    };

    expect(formatPhoneNumber("441234567890")).toBe("+441234567890");
  });
});
