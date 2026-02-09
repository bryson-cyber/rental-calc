import { describe, expect, it } from "vitest";

/**
 * Test to validate SimpleTexting API key by sending a test request
 * API endpoint: POST https://api-app2.simpletexting.com/v2/api/messages
 */
describe("SimpleTexting API", () => {
  it("validates API key by checking message endpoint", async () => {
    const apiKey = process.env.SIMPLETEXTING_API_KEY;
    
    if (!apiKey) {
      throw new Error("SIMPLETEXTING_API_KEY environment variable is not set");
    }

    // Test with an invalid phone number to verify API key works
    // This should return a validation error (not auth error) if key is valid
    const response = await fetch("https://api-app2.simpletexting.com/v2/api/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contactPhone: "invalid",
        text: "test",
        mode: "AUTO"
      }),
    });

    // Log response for debugging
    console.log("Response status:", response.status);
    const responseData = await response.json();
    console.log("Response body:", JSON.stringify(responseData));

    // If we get a 401/403, the API key is invalid
    if (response.status === 401 || response.status === 403) {
      throw new Error("Invalid SimpleTexting API key - authentication failed");
    }

    // A 400 with INVALID_INPUT_VALUE means the key is valid but input is bad (expected)
    // A 200 means the message was sent (unexpected with invalid phone)
    expect(response.status).toBeLessThan(500);
    
    // Verify we got a response that indicates the API is working
    expect(responseData).toBeDefined();
    console.log("SimpleTexting API key validated successfully");
  });
});
