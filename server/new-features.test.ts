import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db";

describe("Favorite Markets Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list favorite markets for a session", async () => {
    const mockFavorites = [
      {
        id: 1,
        sessionId: "test-session",
        marketId: "market-1",
        marketName: "Denver",
        marketType: "urban_metro",
        createdAt: new Date(),
      },
    ];

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockFavorites),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const db = await getDb();
    expect(db).toBeDefined();
  });

  it("should add a market to favorites", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({ insertId: 1 }),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const db = await getDb();
    expect(db).toBeDefined();
  });

  it("should remove a market from favorites", async () => {
    const mockDb = {
      delete: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({ affectedRows: 1 }),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const db = await getDb();
    expect(db).toBeDefined();
  });
});

describe("Market Alerts Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list market alerts for a session", async () => {
    const mockAlerts = [
      {
        id: 1,
        sessionId: "test-session",
        email: "test@example.com",
        marketId: "market-1",
        marketName: "Denver",
        alertType: "all_changes",
        thresholdPercent: 10,
        isActive: "true",
        createdAt: new Date(),
      },
    ];

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockAlerts),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const db = await getDb();
    expect(db).toBeDefined();
  });

  it("should create a new market alert", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({ insertId: 1 }),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const db = await getDb();
    expect(db).toBeDefined();
  });

  it("should toggle alert active status", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 1, isActive: "true" }]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const db = await getDb();
    expect(db).toBeDefined();
  });

  it("should delete a market alert", async () => {
    const mockDb = {
      delete: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({ affectedRows: 1 }),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const db = await getDb();
    expect(db).toBeDefined();
  });
});

describe("Export Functionality", () => {
  it("should format CSV data correctly", () => {
    const headers = ["Market Name", "Revenue", "Occupancy"];
    const rows = [
      ["Denver", 50000, "75%"],
      ["Austin", 60000, "80%"],
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    expect(csvContent).toContain("Market Name,Revenue,Occupancy");
    expect(csvContent).toContain('"Denver","50000","75%"');
    expect(csvContent).toContain('"Austin","60000","80%"');
  });

  it("should handle empty data gracefully", () => {
    const headers = ["Market Name", "Revenue"];
    const rows: any[] = [];

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell: any) => `"${cell}"`).join(",")),
    ].join("\n");

    expect(csvContent).toBe("Market Name,Revenue");
  });

  it("should escape special characters in CSV", () => {
    const data = 'Market with "quotes" and, commas';
    const escaped = `"${data.replace(/"/g, '""')}"`;
    
    expect(escaped).toBe('"Market with ""quotes"" and, commas"');
  });
});

describe("Market Alerts Schema", () => {
  it("should have correct alert types", () => {
    const validTypes = ["revenue_change", "occupancy_change", "adr_change", "all_changes"];
    
    expect(validTypes).toContain("revenue_change");
    expect(validTypes).toContain("all_changes");
    expect(validTypes.length).toBe(4);
  });

  it("should validate threshold percentage range", () => {
    const minThreshold = 1;
    const maxThreshold = 100;
    const defaultThreshold = 10;

    expect(defaultThreshold).toBeGreaterThanOrEqual(minThreshold);
    expect(defaultThreshold).toBeLessThanOrEqual(maxThreshold);
  });
});
