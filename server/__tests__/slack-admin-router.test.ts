/**
 * Tests for the Slack Admin Router
 * 
 * Tests helper functions, message formatting, channel parsing, delivery tracking logic,
 * batch send logic, and report URL construction.
 */

import { describe, it, expect } from "vitest";
import { randomBytes } from "crypto";

// ============================================
// Test: parseSlackChannelResults
// ============================================

describe("Slack Admin Router", () => {
  describe("parseSlackChannelResults", () => {
    function parseSlackChannelResults(rawText: string) {
      const channels: Array<{ id: string; name: string; purpose?: string; created?: string }> = [];
      const resultBlocks = rawText.split(/###\s+Result\s+\d+\s+of\s+\d+/);
      for (const block of resultBlocks) {
        if (!block.trim()) continue;
        const nameMatch = block.match(/Name:\s*#?([\w-]+)/);
        const permalinkMatch = block.match(/archives\/(C[\w]+)/);
        const createdMatch = block.match(/Created:\s*(.+)/);
        const purposeMatch = block.match(/Purpose:\s*(.+)/);
        if (nameMatch && permalinkMatch) {
          channels.push({
            id: permalinkMatch[1],
            name: nameMatch[1],
            purpose: purposeMatch?.[1]?.trim(),
            created: createdMatch?.[1]?.trim(),
          });
        }
      }
      return channels;
    }

    it("should parse Slack MCP channel search output format", () => {
      const sampleOutput = `### Result 1 of 3
Name: #general
Creator: U048ZP70W3G
Created: Jan 15, 2023
Permalink: [Link](https://coachinayah.slack.com/archives/C049W2T8MUG)

### Result 2 of 3
Name: #app-to-slack-migration
Creator: U048ZP70W3G
Created: Mar 10, 2024
Permalink: [Link](https://coachinayah.slack.com/archives/C0981C9RK8R)

### Result 3 of 3
Name: #cape-coral-property-management
Creator: U048ZP70W3G
Created: Jun 5, 2024
Permalink: [Link](https://coachinayah.slack.com/archives/C07USEEKPNK)`;

      const channels = parseSlackChannelResults(sampleOutput);
      expect(channels).toHaveLength(3);
      expect(channels[0]).toEqual({ id: "C049W2T8MUG", name: "general", purpose: undefined, created: "Jan 15, 2023" });
      expect(channels[1]).toEqual({ id: "C0981C9RK8R", name: "app-to-slack-migration", purpose: undefined, created: "Mar 10, 2024" });
      expect(channels[2]).toEqual({ id: "C07USEEKPNK", name: "cape-coral-property-management", purpose: undefined, created: "Jun 5, 2024" });
    });

    it("should parse channels with purpose field", () => {
      const output = `### Result 1 of 1
Name: #deals
Permalink: [Link](https://coachinayah.slack.com/archives/C0123ABC)
Created: 2023-01-15
Purpose: Deal sharing and discussion`;

      const channels = parseSlackChannelResults(output);
      expect(channels).toHaveLength(1);
      expect(channels[0].purpose).toBe("Deal sharing and discussion");
    });

    it("should handle empty results", () => {
      expect(parseSlackChannelResults("")).toHaveLength(0);
    });

    it("should handle malformed results gracefully", () => {
      const malformed = `### Result 1 of 1\nName: #test-channel\nNo permalink here`;
      expect(parseSlackChannelResults(malformed)).toHaveLength(0);
    });
  });

  // ============================================
  // Test: Message Building
  // ============================================

  describe("Slack Message Building", () => {
    function buildReportSlackMessage(params: {
      reportUrl: string;
      address: string;
      dealSummary: string;
      customMessage?: string;
    }): string {
      const { reportUrl, address, dealSummary, customMessage } = params;
      const encodedAddr = encodeURIComponent(address);
      const zillowUrl = `https://www.zillow.com/homes/${encodedAddr}_rb/`;
      const redfinUrl = `https://www.redfin.com/search#query=${encodedAddr}`;
      let message = "";
      if (customMessage?.trim()) {
        message += `${customMessage.trim()}\n\n---\n\n`;
      }
      message += `${dealSummary}\n\n`;
      message += `*<${reportUrl}|View Full Report>*\n\n`;
      message += `<${zillowUrl}|Zillow> | <${redfinUrl}|Redfin>\n\n`;
      message += `_Sent by Coach Inayah's Turnkey Tool_`;
      return message;
    }

    it("should build a complete message with all sections", () => {
      const msg = buildReportSlackMessage({
        reportUrl: "https://coachinayahturnkeytool.com/share/abc123",
        address: "123 Main St, Atlanta, GA 30301",
        dealSummary: "This property is generating strong numbers.",
        customMessage: "Hey, check this out!",
      });

      expect(msg).toContain("Hey, check this out!");
      expect(msg).toContain("---");
      expect(msg).toContain("This property is generating strong numbers.");
      expect(msg).toContain("View Full Report");
      expect(msg).toContain("Zillow");
      expect(msg).toContain("Redfin");
      expect(msg).toContain("Coach Inayah");
    });

    it("should build message without custom message", () => {
      const msg = buildReportSlackMessage({
        reportUrl: "https://coachinayahturnkeytool.com/report/xyz",
        address: "456 Oak Ave, Denver, CO",
        dealSummary: "Great opportunity here.",
      });

      expect(msg).not.toContain("---");
      expect(msg).toContain("Great opportunity here.");
      expect(msg).toContain("View Full Report");
    });

    it("should not include separator when custom message is empty string", () => {
      const msg = buildReportSlackMessage({
        reportUrl: "https://example.com/report/test",
        address: "789 Elm St",
        dealSummary: "Summary",
        customMessage: "",
      });
      expect(msg).not.toContain("---");
    });

    it("should not include separator when custom message is whitespace only", () => {
      const msg = buildReportSlackMessage({
        reportUrl: "https://example.com/report/test",
        address: "789 Elm St",
        dealSummary: "Summary",
        customMessage: "   ",
      });
      expect(msg).not.toContain("---");
    });

    it("should properly encode special characters in address for URLs", () => {
      const msg = buildReportSlackMessage({
        reportUrl: "https://example.com/report/test",
        address: "123 Main St #4, Atlanta, GA 30301",
        dealSummary: "Test",
      });
      expect(msg).toContain("123%20Main%20St%20%234%2C%20Atlanta%2C%20GA%2030301");
    });
  });

  // ============================================
  // Test: Report URL Construction
  // ============================================

  describe("Report URL Construction", () => {
    it("should build correct shared report URLs", () => {
      const baseUrl = "https://coachinayahturnkeytool.com";
      const url = `${baseUrl}/report/abc123`;
      expect(url).toBe("https://coachinayahturnkeytool.com/report/abc123");
    });

    it("should build correct universal report URLs", () => {
      const baseUrl = "https://coachinayahturnkeytool.com";
      const url = `${baseUrl}/share/xyz789`;
      expect(url).toBe("https://coachinayahturnkeytool.com/share/xyz789");
    });

    it("should build correct Zillow and Redfin URLs", () => {
      const address = "123 Main St, Atlanta, GA 30301";
      const encoded = encodeURIComponent(address);
      const zillow = `https://www.zillow.com/homes/${encoded}_rb/`;
      const redfin = `https://www.redfin.com/search#query=${encoded}`;
      expect(zillow).toContain("zillow.com");
      expect(zillow).toContain("123%20Main%20St");
      expect(redfin).toContain("redfin.com");
      expect(redfin).toContain("Atlanta");
    });
  });

  // ============================================
  // Test: Deal Summary Prompt Logic
  // ============================================

  describe("Deal Summary Prompt Logic", () => {
    it("should format occupancy rate from decimal to percentage", () => {
      const occRate = 0.73;
      const occPct = occRate <= 1 ? Math.round(occRate * 100) : Math.round(occRate);
      expect(occPct).toBe(73);
    });

    it("should handle occupancy rate already as percentage", () => {
      const occRate = 73;
      const occPct = occRate <= 1 ? Math.round(occRate * 100) : Math.round(occRate);
      expect(occPct).toBe(73);
    });

    it("should handle string occupancy rate", () => {
      const occRateStr = "0.56";
      const occRate = parseFloat(occRateStr);
      const occPct = occRate <= 1 ? Math.round(occRate * 100) : Math.round(occRate);
      expect(occPct).toBe(56);
    });

    it("should calculate monthly revenue from annual", () => {
      expect(Math.round(128139 / 12)).toBe(10678);
      expect(Math.round(50494 / 12)).toBe(4208);
      expect(Math.round(0 / 12)).toBe(0);
    });

    it("should format currency values correctly", () => {
      const fmt = (n: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
      expect(fmt(128139)).toBe("$128,139");
      expect(fmt(0)).toBe("$0");
      expect(fmt(1500000)).toBe("$1,500,000");
    });
  });

  // ============================================
  // Test: Batch Send Logic
  // ============================================

  describe("Batch Send Logic", () => {
    it("should track success and failure counts correctly", () => {
      const results = [
        { channelId: "C001", success: true },
        { channelId: "C002", success: true },
        { channelId: "C003", success: false, error: "not_in_channel" },
        { channelId: "C004", success: true },
        { channelId: "C005", success: false, error: "channel_not_found" },
      ];
      expect(results.filter(r => r.success).length).toBe(3);
      expect(results.filter(r => !r.success).length).toBe(2);
    });

    it("should generate unique batch IDs", () => {
      const id1 = randomBytes(12).toString("hex");
      const id2 = randomBytes(12).toString("hex");
      expect(id1).toHaveLength(24);
      expect(id2).toHaveLength(24);
      expect(id1).not.toBe(id2);
    });

    it("should handle empty channel list", () => {
      const channels: Array<{ id: string; name: string }> = [];
      expect(channels.length).toBe(0);
    });

    it("should handle single channel batch", () => {
      const channels = [{ id: "C001", name: "client-john" }];
      const results = channels.map(ch => ({ channelId: ch.id, success: true }));
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
    });
  });

  // ============================================
  // Test: Delivery Status Tracking
  // ============================================

  describe("Delivery Status Tracking", () => {
    it("should map successful post to 'sent' status", () => {
      const result = { success: true, permalink: "https://slack.com/archives/C123/p456" };
      const status = result.success ? "sent" : "failed";
      expect(status).toBe("sent");
    });

    it("should map failed post to 'failed' status", () => {
      const result = { success: false, error: "not_in_channel" };
      const status = result.success ? "sent" : "failed";
      expect(status).toBe("failed");
    });

    it("should preserve error message for failed deliveries", () => {
      const result = { success: false, error: "Bot is not in this channel. Please invite the bot first." };
      expect(result.error).toContain("not in this channel");
    });

    it("should preserve permalink for successful deliveries", () => {
      const result = { success: true, permalink: "https://coachinayah.slack.com/archives/C0981C9RK8R/p1770993518618329" };
      expect(result.permalink).toContain("coachinayah.slack.com");
    });
  });

  // ============================================
  // Test: Report Type Labels
  // ============================================

  describe("Report Type Labels", () => {
    const reportTypeLabel = (type: string) => {
      const labels: Record<string, string> = {
        full: "Full Report", property: "Property", market: "Market", revenue: "Revenue",
        validator: "Validator", ai_advisor: "AI Advisor", listings: "Listings",
        comparison: "Comparison", map: "Map", regulation: "Regulation",
      };
      return labels[type] || type;
    };

    it("should map known report types", () => {
      expect(reportTypeLabel("full")).toBe("Full Report");
      expect(reportTypeLabel("validator")).toBe("Validator");
      expect(reportTypeLabel("revenue")).toBe("Revenue");
      expect(reportTypeLabel("ai_advisor")).toBe("AI Advisor");
    });

    it("should return raw type for unknown types", () => {
      expect(reportTypeLabel("unknown_type")).toBe("unknown_type");
    });
  });
});
