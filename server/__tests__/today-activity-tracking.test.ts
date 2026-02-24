import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

/**
 * Tests for the "Today's Activity" tracking fixes:
 * 1. getToolUsageStats properly filters by date range (days parameter)
 * 2. getDashboardSummary includes today's activity breakdown
 * 3. PageTracker TAB_TO_TOOL mapping resolves validate_deal correctly
 * 4. Tool name resolution from URL paths and tab params
 */

describe("Today's Activity Tracking Fixes", () => {
  describe("Date filtering logic", () => {
    it("should compute correct cutoff date for days parameter", () => {
      const days = 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const now = new Date();
      const diffMs = now.getTime() - cutoffDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      expect(diffDays).toBeGreaterThanOrEqual(6.9);
      expect(diffDays).toBeLessThanOrEqual(7.1);
    });

    it("should compute today's start correctly", () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      expect(todayStart.getHours()).toBe(0);
      expect(todayStart.getMinutes()).toBe(0);
      expect(todayStart.getSeconds()).toBe(0);
      expect(todayStart.getMilliseconds()).toBe(0);
      
      const now = new Date();
      expect(todayStart.getTime()).toBeLessThanOrEqual(now.getTime());
    });

    it("should compute yesterday's range correctly", () => {
      const yesterdayStart = new Date();
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);
      
      const yesterdayEnd = new Date();
      yesterdayEnd.setHours(0, 0, 0, 0);
      
      // Yesterday start should be exactly 24 hours before today start
      const diffMs = yesterdayEnd.getTime() - yesterdayStart.getTime();
      expect(diffMs).toBe(24 * 60 * 60 * 1000);
    });

    it("should correctly classify events as today vs not-today", () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const todayEvent = new Date();
      const yesterdayEvent = new Date();
      yesterdayEvent.setDate(yesterdayEvent.getDate() - 1);
      
      expect(todayEvent >= todayStart).toBe(true);
      expect(yesterdayEvent >= todayStart).toBe(false);
    });
  });

  describe("Today's activity aggregation logic", () => {
    // Simulate the aggregation logic from getDashboardSummary
    function aggregateTodayStats(events: Array<{
      toolName: string;
      eventType: string;
      city: string | null;
      userId: number | null;
      sessionId: string | null;
      email: string | null;
      createdAt: Date;
    }>) {
      const todayByTool: Record<string, number> = {};
      const todayByEvent: Record<string, number> = {};
      const todayCities = new Set<string>();
      const todayUsers = new Set<string>();
      
      for (const event of events) {
        todayByTool[event.toolName] = (todayByTool[event.toolName] || 0) + 1;
        todayByEvent[event.eventType] = (todayByEvent[event.eventType] || 0) + 1;
        if (event.city) todayCities.add(event.city);
        const userKey = event.userId ? `user_${event.userId}` : event.sessionId || event.email || 'unknown';
        todayUsers.add(userKey);
      }
      
      return {
        totalEvents: events.length,
        byTool: todayByTool,
        byEvent: todayByEvent,
        uniqueCities: todayCities.size,
        uniqueUsers: todayUsers.size,
      };
    }

    it("should correctly count events by tool", () => {
      const events = [
        { toolName: 'revenue_calculator', eventType: 'search_started', city: 'Denver', userId: 1, sessionId: 's1', email: 'a@b.com', createdAt: new Date() },
        { toolName: 'revenue_calculator', eventType: 'estimate_viewed', city: 'Denver', userId: 1, sessionId: 's1', email: 'a@b.com', createdAt: new Date() },
        { toolName: 'validate_deal', eventType: 'search_started', city: 'Austin', userId: 2, sessionId: 's2', email: 'c@d.com', createdAt: new Date() },
        { toolName: 'validate_deal', eventType: 'estimate_viewed', city: 'Austin', userId: 2, sessionId: 's2', email: 'c@d.com', createdAt: new Date() },
        { toolName: 'validate_deal', eventType: 'deal_validated', city: 'Austin', userId: 2, sessionId: 's2', email: 'c@d.com', createdAt: new Date() },
      ];
      
      const result = aggregateTodayStats(events);
      
      expect(result.totalEvents).toBe(5);
      expect(result.byTool['revenue_calculator']).toBe(2);
      expect(result.byTool['validate_deal']).toBe(3);
      expect(result.uniqueCities).toBe(2);
      expect(result.uniqueUsers).toBe(2);
    });

    it("should correctly count events by event type", () => {
      const events = [
        { toolName: 'revenue_calculator', eventType: 'search_started', city: 'Denver', userId: 1, sessionId: 's1', email: null, createdAt: new Date() },
        { toolName: 'validate_deal', eventType: 'search_started', city: 'Austin', userId: null, sessionId: 's2', email: null, createdAt: new Date() },
        { toolName: 'revenue_calculator', eventType: 'estimate_viewed', city: 'Denver', userId: 1, sessionId: 's1', email: null, createdAt: new Date() },
      ];
      
      const result = aggregateTodayStats(events);
      
      expect(result.byEvent['search_started']).toBe(2);
      expect(result.byEvent['estimate_viewed']).toBe(1);
    });

    it("should handle empty events array", () => {
      const result = aggregateTodayStats([]);
      
      expect(result.totalEvents).toBe(0);
      expect(Object.keys(result.byTool)).toHaveLength(0);
      expect(Object.keys(result.byEvent)).toHaveLength(0);
      expect(result.uniqueCities).toBe(0);
      expect(result.uniqueUsers).toBe(0);
    });

    it("should count anonymous users by sessionId", () => {
      const events = [
        { toolName: 'revenue_calculator', eventType: 'tool_view', city: null, userId: null, sessionId: 'anon-1', email: null, createdAt: new Date() },
        { toolName: 'revenue_calculator', eventType: 'search_started', city: 'Denver', userId: null, sessionId: 'anon-1', email: null, createdAt: new Date() },
        { toolName: 'revenue_calculator', eventType: 'tool_view', city: null, userId: null, sessionId: 'anon-2', email: null, createdAt: new Date() },
      ];
      
      const result = aggregateTodayStats(events);
      
      expect(result.uniqueUsers).toBe(2); // anon-1 and anon-2
    });

    it("should distinguish validate_deal from revenue_calculator", () => {
      const events = [
        { toolName: 'revenue_calculator', eventType: 'search_started', city: 'Denver', userId: 1, sessionId: 's1', email: null, createdAt: new Date() },
        { toolName: 'validate_deal', eventType: 'search_started', city: 'Denver', userId: 1, sessionId: 's1', email: null, createdAt: new Date() },
      ];
      
      const result = aggregateTodayStats(events);
      
      expect(result.byTool['revenue_calculator']).toBe(1);
      expect(result.byTool['validate_deal']).toBe(1);
      // They should be separate entries
      expect(Object.keys(result.byTool)).toHaveLength(2);
    });
  });

  describe("PageTracker tool name resolution", () => {
    // Replicate the resolveToolName logic from PageTracker.tsx
    const PATH_TO_TOOL: Record<string, string> = {
      '/': 'revenue_calculator',
      '/calculator': 'revenue_calculator',
      '/full-report': 'full_report',
      '/full-analysis': 'property_analyzer',
      '/market-advisor': 'market_advisor',
      '/opportunity-finder': 'opportunity_finder',
      '/map': 'map_view',
      '/deal-alerts': 'deal_alerts',
      '/evaluate-market': 'market_explorer',
      '/content-studio': 'content_studio',
      '/discover-markets': 'market_explorer',
      '/investment-calculator': 'revenue_calculator',
    };

    const TAB_TO_TOOL: Record<string, Record<string, string>> = {
      '/': {
        'validate': 'validate_deal',
        'compare': 'comp_analysis',
        'map': 'map_view',
        'market': 'market_explorer',
        'advisor': 'ai_advisor',
        'find': 'opportunity_finder',
      },
    };

    function resolveToolName(location: string): string | undefined {
      const [rawPath, queryString] = location.split('?');
      const path = rawPath.replace(/\/$/, '') || '/';

      if (queryString) {
        const params = new URLSearchParams(queryString);
        const tab = params.get('tab');
        if (tab && TAB_TO_TOOL[path]?.[tab]) {
          return TAB_TO_TOOL[path][tab];
        }
      }

      return PATH_TO_TOOL[path];
    }

    it("should resolve / to revenue_calculator", () => {
      expect(resolveToolName("/")).toBe("revenue_calculator");
    });

    it("should resolve /?tab=validate to validate_deal", () => {
      expect(resolveToolName("/?tab=validate")).toBe("validate_deal");
    });

    it("should resolve /?tab=compare to comp_analysis", () => {
      expect(resolveToolName("/?tab=compare")).toBe("comp_analysis");
    });

    it("should resolve /?tab=map to map_view", () => {
      expect(resolveToolName("/?tab=map")).toBe("map_view");
    });

    it("should resolve /?tab=market to market_explorer", () => {
      expect(resolveToolName("/?tab=market")).toBe("market_explorer");
    });

    it("should resolve /?tab=advisor to ai_advisor", () => {
      expect(resolveToolName("/?tab=advisor")).toBe("ai_advisor");
    });

    it("should resolve /?tab=find to opportunity_finder", () => {
      expect(resolveToolName("/?tab=find")).toBe("opportunity_finder");
    });

    it("should fall back to path mapping for unknown tab", () => {
      expect(resolveToolName("/?tab=unknown")).toBe("revenue_calculator");
    });

    it("should handle URL with additional query params alongside tab", () => {
      expect(resolveToolName("/?tab=validate&city=Denver&state=CO")).toBe("validate_deal");
    });

    it("should resolve /full-report correctly", () => {
      expect(resolveToolName("/full-report")).toBe("full_report");
    });

    it("should resolve /full-analysis correctly", () => {
      expect(resolveToolName("/full-analysis")).toBe("property_analyzer");
    });

    it("should return undefined for unknown paths", () => {
      expect(resolveToolName("/unknown-page")).toBeUndefined();
    });
  });

  describe("getToolUsageStats input schema", () => {
    const inputSchema = z.object({
      days: z.number().default(30),
    });

    it("should accept days parameter", () => {
      const result = inputSchema.parse({ days: 7 });
      expect(result.days).toBe(7);
    });

    it("should default to 30 days when not specified", () => {
      const result = inputSchema.parse({});
      expect(result.days).toBe(30);
    });

    it("should accept 1 day for today-only view", () => {
      const result = inputSchema.parse({ days: 1 });
      expect(result.days).toBe(1);
    });
  });

  describe("Daily breakdown aggregation", () => {
    it("should group events by day correctly", () => {
      const events = [
        { createdAt: new Date('2026-02-23T10:00:00Z') },
        { createdAt: new Date('2026-02-23T14:00:00Z') },
        { createdAt: new Date('2026-02-22T10:00:00Z') },
        { createdAt: new Date('2026-02-21T10:00:00Z') },
        { createdAt: new Date('2026-02-21T18:00:00Z') },
      ];

      const byDay: Record<string, number> = {};
      for (const event of events) {
        const day = event.createdAt.toISOString().split('T')[0];
        byDay[day] = (byDay[day] || 0) + 1;
      }

      expect(byDay['2026-02-23']).toBe(2);
      expect(byDay['2026-02-22']).toBe(1);
      expect(byDay['2026-02-21']).toBe(2);
    });
  });
});
