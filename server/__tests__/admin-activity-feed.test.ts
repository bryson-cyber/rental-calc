import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

/**
 * Tests for the admin activity feed endpoint schema and data transformation.
 * The actual DB query is tested via integration; here we validate the input
 * schema, output shape expectations, and helper logic.
 */

// Input schema matching the getActivityFeed endpoint
const activityFeedInputSchema = z.object({
  search: z.string().optional(),
  actionCategory: z.string().optional(),
  action: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

describe("Admin Activity Feed", () => {
  describe("Input validation", () => {
    it("should accept valid input with all fields", () => {
      const input = {
        search: "john@example.com",
        actionCategory: "analysis",
        action: "property_analysis",
        limit: 30,
        offset: 0,
      };
      const result = activityFeedInputSchema.parse(input);
      expect(result.search).toBe("john@example.com");
      expect(result.actionCategory).toBe("analysis");
      expect(result.action).toBe("property_analysis");
      expect(result.limit).toBe(30);
      expect(result.offset).toBe(0);
    });

    it("should accept empty input with defaults", () => {
      const result = activityFeedInputSchema.parse({});
      expect(result.search).toBeUndefined();
      expect(result.actionCategory).toBeUndefined();
      expect(result.action).toBeUndefined();
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it("should reject limit > 200", () => {
      expect(() =>
        activityFeedInputSchema.parse({ limit: 201 })
      ).toThrow();
    });

    it("should reject limit < 1", () => {
      expect(() =>
        activityFeedInputSchema.parse({ limit: 0 })
      ).toThrow();
    });

    it("should reject negative offset", () => {
      expect(() =>
        activityFeedInputSchema.parse({ offset: -1 })
      ).toThrow();
    });

    it("should accept search-only input", () => {
      const result = activityFeedInputSchema.parse({ search: "coach" });
      expect(result.search).toBe("coach");
      expect(result.limit).toBe(50);
    });
  });

  describe("Activity detail extraction", () => {
    // Mirror the extractDetailsString helper from UnifiedAdmin.tsx
    function extractDetailsString(details: any): string | null {
      if (!details) return null;
      const parts: string[] = [];
      if (details.address) parts.push(details.address);
      else if (details.market) parts.push(details.market);
      else if (details.city)
        parts.push(
          `${details.city}${details.state ? ", " + details.state : ""}`
        );
      else if (details.zipCode) parts.push(`ZIP: ${details.zipCode}`);
      else if (details.marketId) parts.push(`Market: ${details.marketId}`);
      if (details.bedrooms) parts.push(`${details.bedrooms} BR`);
      if (details.reportType) parts.push(details.reportType);
      return parts.length > 0 ? parts.join(" · ") : null;
    }

    it("should extract address from details", () => {
      const result = extractDetailsString({
        address: "123 Main St, Denver, CO",
        bedrooms: 3,
      });
      expect(result).toBe("123 Main St, Denver, CO · 3 BR");
    });

    it("should extract city/state when no address", () => {
      const result = extractDetailsString({
        city: "Austin",
        state: "TX",
      });
      expect(result).toBe("Austin, TX");
    });

    it("should extract zip code when no address or city", () => {
      const result = extractDetailsString({ zipCode: "80202" });
      expect(result).toBe("ZIP: 80202");
    });

    it("should extract market name", () => {
      const result = extractDetailsString({ market: "Denver Metro" });
      expect(result).toBe("Denver Metro");
    });

    it("should extract report type", () => {
      const result = extractDetailsString({
        address: "456 Oak Ave",
        reportType: "full_analysis",
      });
      expect(result).toBe("456 Oak Ave · full_analysis");
    });

    it("should return null for empty details", () => {
      expect(extractDetailsString(null)).toBeNull();
      expect(extractDetailsString(undefined)).toBeNull();
      expect(extractDetailsString({})).toBeNull();
    });
  });

  describe("Action label formatting", () => {
    function formatActionLabel(action: string): string {
      return action
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
    }

    it("should format snake_case to Title Case", () => {
      expect(formatActionLabel("property_analysis")).toBe("Property Analysis");
      expect(formatActionLabel("market_search")).toBe("Market Search");
      expect(formatActionLabel("deep_analysis_started")).toBe(
        "Deep Analysis Started"
      );
    });

    it("should handle single word", () => {
      expect(formatActionLabel("login")).toBe("Login");
    });
  });

  describe("Category badge styling", () => {
    function getCategoryBadgeStyle(category: string): string {
      switch (category) {
        case "analysis":
          return "bg-blue-50 text-blue-700 border-blue-200";
        case "search":
          return "bg-violet-50 text-violet-700 border-violet-200";
        case "auth":
          return "bg-emerald-50 text-emerald-700 border-emerald-200";
        case "navigation":
          return "bg-slate-50 text-slate-600 border-slate-200";
        case "lead":
          return "bg-amber-50 text-amber-700 border-amber-200";
        case "tool":
          return "bg-cyan-50 text-cyan-700 border-cyan-200";
        default:
          return "bg-gray-50 text-gray-600 border-gray-200";
      }
    }

    it("should return correct styles for known categories", () => {
      expect(getCategoryBadgeStyle("analysis")).toContain("blue");
      expect(getCategoryBadgeStyle("search")).toContain("violet");
      expect(getCategoryBadgeStyle("auth")).toContain("emerald");
      expect(getCategoryBadgeStyle("lead")).toContain("amber");
    });

    it("should return gray for unknown category", () => {
      expect(getCategoryBadgeStyle("unknown")).toContain("gray");
    });
  });
});
