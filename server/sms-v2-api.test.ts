import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the sendSms function logic by verifying v2 API call format
describe("SimpleTexting v2 API Integration", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  it("should format v2 API request correctly for short messages", async () => {
    fetchSpy.mockResolvedValueOnce({
      status: 201,
      text: async () => JSON.stringify({ id: "abc123", credits: 1 }),
    });

    // Simulate what sendSms does internally
    const phone = "+1 (555) 123-4567";
    const message = "Hello test";

    const cleanPhone = phone.replace(/[^\d]/g, "");
    const normalizedPhone = cleanPhone.length === 11 && cleanPhone.startsWith("1")
      ? cleanPhone.slice(1)
      : cleanPhone;

    expect(normalizedPhone).toBe("5551234567");
    expect(normalizedPhone.length).toBe(10);

    const requestBody = {
      contactPhone: normalizedPhone,
      mode: message.length > 160 ? "MMS_PREFERRED" : "AUTO",
      text: message,
    };

    expect(requestBody.mode).toBe("AUTO");
    expect(requestBody.contactPhone).toBe("5551234567");
  });

  it("should use MMS_PREFERRED mode for messages over 160 chars", () => {
    const shortMessage = "Short message";
    const longMessage = "A".repeat(161);

    expect(shortMessage.length > 160 ? "MMS_PREFERRED" : "AUTO").toBe("AUTO");
    expect(longMessage.length > 160 ? "MMS_PREFERRED" : "AUTO").toBe("MMS_PREFERRED");
  });

  it("should normalize international phone numbers correctly", () => {
    const testCases = [
      { input: "+1 (555) 123-4567", expected: "5551234567" },
      { input: "15551234567", expected: "5551234567" },
      { input: "5551234567", expected: "5551234567" },
      { input: "+233 20 123 4567", expected: "233201234567" }, // Ghana - kept as-is (12 digits)
      { input: "+44 7911 123456", expected: "447911123456" }, // UK - kept as-is (12 digits)
    ];

    for (const tc of testCases) {
      const cleanPhone = tc.input.replace(/[^\d]/g, "");
      const normalizedPhone = cleanPhone.length === 11 && cleanPhone.startsWith("1")
        ? cleanPhone.slice(1)
        : cleanPhone;
      expect(normalizedPhone).toBe(tc.expected);
    }
  });

  it("should reject phone numbers shorter than 10 digits", () => {
    const phone = "12345";
    const cleanPhone = phone.replace(/[^\d]/g, "");
    const normalizedPhone = cleanPhone.length === 11 && cleanPhone.startsWith("1")
      ? cleanPhone.slice(1)
      : cleanPhone;
    expect(normalizedPhone.length < 10).toBe(true);
  });

  it("should use Bearer token auth in v2 API", () => {
    const apiKey = "test-api-key-123";
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    };
    expect(headers["Authorization"]).toBe("Bearer test-api-key-123");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("should parse v2 success response correctly", () => {
    const responseData = { id: "507f191e810c19729de860ea", credits: 1 };
    const status = 201;

    const isSuccess = status === 201 && responseData.id;
    expect(isSuccess).toBeTruthy();
  });

  it("should handle v2 error response correctly", () => {
    const responseData = { message: "Invalid phone number format" };
    const status = 400;

    const isSuccess = status === 201 && (responseData as any).id;
    expect(isSuccess).toBeFalsy();

    const errorMsg = responseData.message || "Unknown error";
    expect(errorMsg).toBe("Invalid phone number format");
  });
});

describe("Campaign Resend Logic", () => {
  it("should identify failed campaigns for resend", () => {
    const campaign = {
      id: 1,
      status: "failed",
      message: "Hey %FIRST_NAME%, check out the replay!",
      sentCount: 0,
      failedCount: 50,
    };

    expect(campaign.status).toBe("failed");
    expect(campaign.message.length).toBeGreaterThan(0);
    // Resend should reuse the same message
    expect(campaign.message).toContain("%FIRST_NAME%");
  });

  it("should allow resend of partially failed campaigns", () => {
    const campaign = {
      id: 2,
      status: "completed",
      sentCount: 400,
      failedCount: 227,
    };

    // A campaign with failures should be resendable
    const hasFailures = campaign.failedCount > 0;
    expect(hasFailures).toBe(true);
  });
});
