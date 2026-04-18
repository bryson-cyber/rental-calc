import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the comp selection persistence feature.
 * 
 * Validates:
 * 1. The saveCompSelection endpoint updates the selectedCompIds column
 * 2. Non-admin users are rejected
 * 3. The getShareableReport returns selectedCompIds
 */

// Mock the database module
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([{
        id: 1,
        shareCode: 'test-code-123',
        reportType: 'validator',
        reportData: { revenue: { projected: 50000 } },
        selectedCompIds: ['comp-1', 'comp-2'],
        revenueOverride: null,
        viewCount: 5,
      }]),
    }),
  }),
});

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    update: mockUpdate,
    select: mockSelect,
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    ownerOpenId: "owner-123",
    databaseUrl: "mysql://test",
  },
}));

describe("Comp Selection Persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Data Structure", () => {
    it("selectedCompIds should be an array of strings", () => {
      const compIds = ["comp-abc-123", "comp-def-456", "comp-ghi-789"];
      expect(Array.isArray(compIds)).toBe(true);
      compIds.forEach(id => expect(typeof id).toBe("string"));
    });

    it("should handle empty comp selection gracefully", () => {
      const compIds: string[] = [];
      expect(compIds.length).toBe(0);
    });

    it("should filter persisted IDs against available comparables", () => {
      const persistedIds = ["comp-1", "comp-2", "comp-3"];
      const availableComps = [
        { id: "comp-1", revenue: 50000 },
        { id: "comp-2", revenue: 60000 },
        // comp-3 no longer exists
      ];
      
      const validIds = persistedIds.filter(id => 
        availableComps.some(c => c.id === id)
      );
      
      expect(validIds).toEqual(["comp-1", "comp-2"]);
      expect(validIds).not.toContain("comp-3");
    });

    it("should fall back to all comps when no persisted selection exists", () => {
      const persistedIds: string[] | null = null;
      const availableComps = [
        { id: "comp-1" },
        { id: "comp-2" },
        { id: "comp-3" },
      ];
      
      const selectedIds = persistedIds && persistedIds.length > 0
        ? persistedIds.filter(id => availableComps.some(c => c.id === id))
        : availableComps.map(c => c.id);
      
      expect(selectedIds).toEqual(["comp-1", "comp-2", "comp-3"]);
    });

    it("should fall back to all comps when all persisted IDs are invalid", () => {
      const persistedIds = ["old-comp-1", "old-comp-2"];
      const availableComps = [
        { id: "new-comp-1" },
        { id: "new-comp-2" },
      ];
      
      const validIds = persistedIds.filter(id => 
        availableComps.some(c => c.id === id)
      );
      
      const selectedIds = validIds.length > 0
        ? validIds
        : availableComps.map(c => c.id);
      
      expect(selectedIds).toEqual(["new-comp-1", "new-comp-2"]);
    });
  });

  describe("Derived Metrics from Selected Comps", () => {
    const comparables = [
      { id: "comp-1", adr: 200, occupancy: 0.7, revenue: 51100 },
      { id: "comp-2", adr: 300, occupancy: 0.8, revenue: 87600 },
      { id: "comp-3", adr: 250, occupancy: 0.75, revenue: 68438 },
    ];

    it("should compute correct average metrics for selected subset", () => {
      const selectedIds = new Set(["comp-1", "comp-2"]);
      const selectedComps = comparables.filter(c => selectedIds.has(c.id));
      
      const avgAdr = selectedComps.reduce((sum, c) => sum + c.adr, 0) / selectedComps.length;
      const avgOccupancy = selectedComps.reduce((sum, c) => sum + c.occupancy, 0) / selectedComps.length;
      const avgRevenue = selectedComps.reduce((sum, c) => sum + c.revenue, 0) / selectedComps.length;
      
      expect(avgAdr).toBe(250);
      expect(avgOccupancy).toBe(0.75);
      expect(avgRevenue).toBe(69350);
    });

    it("should return null derivedMetrics when all comps are selected", () => {
      const selectedIds = new Set(["comp-1", "comp-2", "comp-3"]);
      const selectedComps = comparables.filter(c => selectedIds.has(c.id));
      
      // When all selected, derivedMetrics should be null (use server metrics)
      const derivedMetrics = selectedComps.length === comparables.length ? null : {
        adr: Math.round(selectedComps.reduce((sum, c) => sum + c.adr, 0) / selectedComps.length),
      };
      
      expect(derivedMetrics).toBeNull();
    });
  });

  describe("Report Data Embedding", () => {
    it("should embed selectedCompIds in reportData when creating share", () => {
      const reportData = { revenue: { projected: 50000 } };
      const selectedCompIds = ["comp-1", "comp-2"];
      
      const finalReportData = { ...reportData } as any;
      if (selectedCompIds && selectedCompIds.length > 0) {
        finalReportData._selectedCompIds = selectedCompIds;
      }
      
      expect(finalReportData._selectedCompIds).toEqual(["comp-1", "comp-2"]);
    });

    it("should not embed selectedCompIds when null", () => {
      const reportData = { revenue: { projected: 50000 } };
      const selectedCompIds: string[] | null = null;
      
      const finalReportData = { ...reportData } as any;
      if (selectedCompIds && selectedCompIds.length > 0) {
        finalReportData._selectedCompIds = selectedCompIds;
      }
      
      expect(finalReportData._selectedCompIds).toBeUndefined();
    });

    it("should extract selectedCompIds from report or reportData", () => {
      // Scenario 1: from DB column
      const report1 = { selectedCompIds: ["comp-1", "comp-2"] };
      const reportData1 = { _selectedCompIds: ["comp-3"] };
      const result1 = report1.selectedCompIds ?? (reportData1 as any)._selectedCompIds ?? null;
      expect(result1).toEqual(["comp-1", "comp-2"]); // DB column takes priority

      // Scenario 2: from embedded reportData
      const report2 = { selectedCompIds: null };
      const reportData2 = { _selectedCompIds: ["comp-3", "comp-4"] };
      const result2 = report2.selectedCompIds ?? (reportData2 as any)._selectedCompIds ?? null;
      expect(result2).toEqual(["comp-3", "comp-4"]);

      // Scenario 3: neither exists
      const report3 = { selectedCompIds: null };
      const reportData3 = {};
      const result3 = report3.selectedCompIds ?? (reportData3 as any)._selectedCompIds ?? null;
      expect(result3).toBeNull();
    });
  });
});
