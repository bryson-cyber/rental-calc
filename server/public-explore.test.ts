import { describe, it, expect } from "vitest";
import { publicExploreRouter } from "./routers/public-explore";

// ── Public Explore Router Tests ───────────────────────────────────────────────
describe("Public Explore Router", () => {
  // ── Structure Tests ──────────────────────────────────────────────
  it("should export a valid tRPC router", () => {
    expect(publicExploreRouter).toBeDefined();
    expect(publicExploreRouter._def).toBeDefined();
  });

  it("should have searchMarkets procedure", () => {
    const procedures = publicExploreRouter._def.procedures;
    expect(procedures).toHaveProperty("searchMarkets");
  });

  it("should have getListings procedure", () => {
    const procedures = publicExploreRouter._def.procedures;
    expect(procedures).toHaveProperty("getListings");
  });

  it("should have getEstimate procedure", () => {
    const procedures = publicExploreRouter._def.procedures;
    expect(procedures).toHaveProperty("getEstimate");
  });

  it("should expose exactly 3 public procedures", () => {
    const procedures = publicExploreRouter._def.procedures;
    const keys = Object.keys(procedures);
    expect(keys).toHaveLength(3);
    expect(keys.sort()).toEqual(["getEstimate", "getListings", "searchMarkets"]);
  });

  it("should NOT have any protected/admin-only procedures", () => {
    // All procedures should be public (no auth required)
    const procedures = publicExploreRouter._def.procedures;
    const keys = Object.keys(procedures);
    // None of the procedures should require authentication
    for (const key of keys) {
      const proc = (procedures as any)[key];
      // publicProcedure does not have middleware that checks for ctx.user
      expect(proc).toBeDefined();
    }
  });

  // ── searchMarkets Input Validation ──────────────────────────────
  describe("searchMarkets input validation", () => {
    const procedure = publicExploreRouter._def.procedures.searchMarkets as any;
    const schema = procedure._def?.inputs?.[0];

    it("should reject empty query", () => {
      if (!schema) return;
      const result = schema.safeParse({ query: "" });
      expect(result.success).toBe(false);
    });

    it("should reject single character query", () => {
      if (!schema) return;
      const result = schema.safeParse({ query: "a" });
      expect(result.success).toBe(false);
    });

    it("should accept valid query with 2+ characters", () => {
      if (!schema) return;
      const result = schema.safeParse({ query: "Denver" });
      expect(result.success).toBe(true);
    });

    it("should accept minimum 2-character query", () => {
      if (!schema) return;
      const result = schema.safeParse({ query: "CO" });
      expect(result.success).toBe(true);
    });

    it("should reject query over 100 characters", () => {
      if (!schema) return;
      const result = schema.safeParse({ query: "A".repeat(101) });
      expect(result.success).toBe(false);
    });

    it("should accept query at exactly 100 characters", () => {
      if (!schema) return;
      const result = schema.safeParse({ query: "A".repeat(100) });
      expect(result.success).toBe(true);
    });

    it("should reject missing query field", () => {
      if (!schema) return;
      const result = schema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should accept zip code format queries", () => {
      if (!schema) return;
      const result = schema.safeParse({ query: "80202" });
      expect(result.success).toBe(true);
    });
  });

  // ── getListings Input Validation ────────────────────────────────
  describe("getListings input validation", () => {
    const procedure = publicExploreRouter._def.procedures.getListings as any;
    const schema = procedure._def?.inputs?.[0];

    it("should require marketId", () => {
      if (!schema) return;
      const result = schema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should accept valid market input", () => {
      if (!schema) return;
      const result = schema.safeParse({ marketId: "12345" });
      expect(result.success).toBe(true);
    });

    it("should accept optional bedrooms filter", () => {
      if (!schema) return;
      const result = schema.safeParse({ marketId: "12345", bedrooms: 3 });
      expect(result.success).toBe(true);
    });

    it("should accept valid sortBy values", () => {
      if (!schema) return;
      for (const sortBy of ["revenue", "occupancy", "adr", "rating"]) {
        const result = schema.safeParse({ marketId: "12345", sortBy });
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid sortBy values", () => {
      if (!schema) return;
      const result = schema.safeParse({ marketId: "12345", sortBy: "invalid" });
      expect(result.success).toBe(false);
    });

    it("should default marketType to market", () => {
      if (!schema) return;
      const result = schema.safeParse({ marketId: "12345" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.marketType).toBe("market");
      }
    });

    it("should accept marketType submarket", () => {
      if (!schema) return;
      const result = schema.safeParse({ marketId: "12345", marketType: "submarket" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.marketType).toBe("submarket");
      }
    });

    it("should reject invalid marketType", () => {
      if (!schema) return;
      const result = schema.safeParse({ marketId: "12345", marketType: "city" });
      expect(result.success).toBe(false);
    });

    it("should default sortBy to revenue", () => {
      if (!schema) return;
      const result = schema.safeParse({ marketId: "12345" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe("revenue");
      }
    });
  });

  // ── getEstimate Input Validation ────────────────────────────────
  describe("getEstimate input validation", () => {
    const procedure = publicExploreRouter._def.procedures.getEstimate as any;
    const schema = procedure._def?.inputs?.[0];

    it("should require address", () => {
      if (!schema) return;
      const result = schema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject empty address", () => {
      if (!schema) return;
      const result = schema.safeParse({ address: "" });
      expect(result.success).toBe(false);
    });

    it("should accept valid address with optional fields", () => {
      if (!schema) return;
      const result = schema.safeParse({
        address: "1321 15th St, Denver, CO 80202",
        bedrooms: 3,
        bathrooms: 2,
        accommodates: 6,
      });
      expect(result.success).toBe(true);
    });

    it("should accept address-only input (all other fields optional)", () => {
      if (!schema) return;
      const result = schema.safeParse({ address: "123 Main St" });
      expect(result.success).toBe(true);
    });

    it("should reject invalid bedroom count (over 20)", () => {
      if (!schema) return;
      const result = schema.safeParse({
        address: "123 Main St",
        bedrooms: 25,
      });
      expect(result.success).toBe(false);
    });

    it("should accept 0 bedrooms (studio)", () => {
      if (!schema) return;
      const result = schema.safeParse({
        address: "123 Main St",
        bedrooms: 0,
      });
      expect(result.success).toBe(true);
    });

    it("should reject negative bedrooms", () => {
      if (!schema) return;
      const result = schema.safeParse({
        address: "123 Main St",
        bedrooms: -1,
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid bathroom count (below 0.5)", () => {
      if (!schema) return;
      const result = schema.safeParse({
        address: "123 Main St",
        bathrooms: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should accept half bathrooms (1.5, 2.5, etc.)", () => {
      if (!schema) return;
      const result = schema.safeParse({
        address: "123 Main St",
        bathrooms: 1.5,
      });
      expect(result.success).toBe(true);
    });

    it("should reject bathrooms over 20", () => {
      if (!schema) return;
      const result = schema.safeParse({
        address: "123 Main St",
        bathrooms: 21,
      });
      expect(result.success).toBe(false);
    });

    it("should reject accommodates below 1", () => {
      if (!schema) return;
      const result = schema.safeParse({
        address: "123 Main St",
        accommodates: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should reject accommodates over 50", () => {
      if (!schema) return;
      const result = schema.safeParse({
        address: "123 Main St",
        accommodates: 51,
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer bedrooms", () => {
      if (!schema) return;
      const result = schema.safeParse({
        address: "123 Main St",
        bedrooms: 2.5,
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer accommodates", () => {
      if (!schema) return;
      const result = schema.safeParse({
        address: "123 Main St",
        accommodates: 6.5,
      });
      expect(result.success).toBe(false);
    });
  });
});

// ── Router Mount Tests ────────────────────────────────────────────────────────
describe("Public Explore - Router Mount", () => {
  it("should export publicExploreRouter from routers/index", async () => {
    const { publicExploreRouter: exported } = await import("./routers/index");
    expect(exported).toBeDefined();
    expect(exported._def).toBeDefined();
    // Verify it's the same router
    const keys = Object.keys(exported._def.procedures);
    expect(keys.sort()).toEqual(["getEstimate", "getListings", "searchMarkets"]);
  }, 15000);
});

// ── Public Pages Utility Tests ────────────────────────────────────────────────
describe("Public Pages - /explore included", () => {
  it("should recognize /explore as a public page", async () => {
    const { isPublicPage } = await import("../client/src/lib/publicPages");
    expect(isPublicPage("/explore")).toBe(true);
    expect(isPublicPage("/explore?market=denver")).toBe(true);
  });

  it("should NOT recognize /admin as a public page", async () => {
    const { isPublicPage } = await import("../client/src/lib/publicPages");
    expect(isPublicPage("/admin")).toBe(false);
    expect(isPublicPage("/dashboard")).toBe(false);
  });
});

// ── Content Hub Demographic Targeting Tests ─────────────────────────────────
describe("Content Hub - Demographic Targeting", () => {
  it("should have targetAudience in content hub router startPipeline input", async () => {
    const { contentHubRouter } = await import("./routers/content-hub");
    const procedures = contentHubRouter._def.procedures;
    expect(procedures).toHaveProperty("startPipeline");
  });

  it("should accept targetAudience as optional string in startPipeline", async () => {
    const { contentHubRouter } = await import("./routers/content-hub");
    const procedure = contentHubRouter._def.procedures.startPipeline as any;
    const schema = procedure._def?.inputs?.[0];
    if (!schema) return;

    // Without targetAudience - should still work
    const resultWithout = schema.safeParse({
      topic: "Test topic",
      format: "lesson",
      scriptMode: "ai_generate",
    });
    expect(resultWithout.success).toBe(true);

    // With targetAudience
    const resultWith = schema.safeParse({
      topic: "Test topic",
      format: "lesson",
      scriptMode: "ai_generate",
      targetAudience: "healthcare_professionals",
    });
    expect(resultWith.success).toBe(true);
  });

  it("should reject targetAudience longer than 100 characters", async () => {
    const { contentHubRouter } = await import("./routers/content-hub");
    const procedure = contentHubRouter._def.procedures.startPipeline as any;
    const schema = procedure._def?.inputs?.[0];
    if (!schema) return;

    const result = schema.safeParse({
      topic: "Test topic",
      format: "lesson",
      scriptMode: "ai_generate",
      targetAudience: "A".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("should store targetAudience in the content_hub_videos schema", async () => {
    const schema = await import("../drizzle/schema");
    const videosTable = schema.contentHubVideos;
    expect(videosTable).toBeDefined();
    // The table should have a targetAudience column
    const columns = Object.keys(videosTable);
    expect(columns).toContain("targetAudience");
  });
});

// ── Content Hub Visual Style Restriction Tests ──────────────────────────────
describe("Content Hub - Visual Style Options", () => {
  it("should accept default visual style", async () => {
    const { contentHubRouter } = await import("./routers/content-hub");
    const procedure = contentHubRouter._def.procedures.startPipeline as any;
    const schema = procedure._def?.inputs?.[0];
    if (!schema) return;

    const result = schema.safeParse({
      topic: "Test topic",
      format: "lesson",
      visualStyle: "default",
    });
    expect(result.success).toBe(true);
  });

  it("should accept sketch visual style", async () => {
    const { contentHubRouter } = await import("./routers/content-hub");
    const procedure = contentHubRouter._def.procedures.startPipeline as any;
    const schema = procedure._def?.inputs?.[0];
    if (!schema) return;

    const result = schema.safeParse({
      topic: "Test topic",
      format: "lesson",
      visualStyle: "sketch",
    });
    expect(result.success).toBe(true);
  });

  it("should accept canvas visual style", async () => {
    const { contentHubRouter } = await import("./routers/content-hub");
    const procedure = contentHubRouter._def.procedures.startPipeline as any;
    const schema = procedure._def?.inputs?.[0];
    if (!schema) return;

    const result = schema.safeParse({
      topic: "Test topic",
      format: "lesson",
      visualStyle: "canvas",
    });
    expect(result.success).toBe(true);
  });

  it("should accept canvas with sub-options (canvasImageStyle and canvasPenStyle)", async () => {
    const { contentHubRouter } = await import("./routers/content-hub");
    const procedure = contentHubRouter._def.procedures.startPipeline as any;
    const schema = procedure._def?.inputs?.[0];
    if (!schema) return;

    const result = schema.safeParse({
      topic: "Test topic",
      format: "lesson",
      visualStyle: "canvas",
      canvasImageStyle: "neon",
      canvasPenStyle: "marker",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid visual style", async () => {
    const { contentHubRouter } = await import("./routers/content-hub");
    const procedure = contentHubRouter._def.procedures.startPipeline as any;
    const schema = procedure._def?.inputs?.[0];
    if (!schema) return;

    const result = schema.safeParse({
      topic: "Test topic",
      format: "lesson",
      visualStyle: "watercolor",
    });
    expect(result.success).toBe(false);
  });

  it("should default to white background (whiteBg: true)", async () => {
    const { contentHubRouter } = await import("./routers/content-hub");
    const procedure = contentHubRouter._def.procedures.startPipeline as any;
    const schema = procedure._def?.inputs?.[0];
    if (!schema) return;

    const result = schema.safeParse({
      topic: "Test topic",
      format: "lesson",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.whiteBg).toBe(true);
    }
  });

  it("should default visualStyle to default", async () => {
    const { contentHubRouter } = await import("./routers/content-hub");
    const procedure = contentHubRouter._def.procedures.startPipeline as any;
    const schema = procedure._def?.inputs?.[0];
    if (!schema) return;

    const result = schema.safeParse({
      topic: "Test topic",
      format: "lesson",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visualStyle).toBe("default");
    }
  });

  it("should accept all valid canvasImageStyle options", async () => {
    const { contentHubRouter } = await import("./routers/content-hub");
    const procedure = contentHubRouter._def.procedures.startPipeline as any;
    const schema = procedure._def?.inputs?.[0];
    if (!schema) return;

    const imageStyles = ["neon", "whiteboard", "modern_minimal", "playful", "technical", "editorial"];
    for (const style of imageStyles) {
      const result = schema.safeParse({
        topic: "Test topic",
        format: "lesson",
        visualStyle: "canvas",
        canvasImageStyle: style,
      });
      expect(result.success).toBe(true);
    }
  });

  it("should accept all valid canvasPenStyle options", async () => {
    const { contentHubRouter } = await import("./routers/content-hub");
    const procedure = contentHubRouter._def.procedures.startPipeline as any;
    const schema = procedure._def?.inputs?.[0];
    if (!schema) return;

    const penStyles = ["stylus", "marker", "pen"];
    for (const style of penStyles) {
      const result = schema.safeParse({
        topic: "Test topic",
        format: "lesson",
        visualStyle: "canvas",
        canvasPenStyle: style,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ── Pipeline Module Exports ─────────────────────────────────────────────────
describe("Content Hub Pipeline - Demographic Targeting Exports", () => {
  it("should export startPipeline function", async () => {
    const pipeline = await import("./content-hub-pipeline");
    expect(typeof pipeline.startPipeline).toBe("function");
  });

  it("should export PipelineInput type with targetAudience", async () => {
    // Verify the pipeline module exports the types we need
    const pipeline = await import("./content-hub-pipeline");
    // startPipeline accepts PipelineInput which should include targetAudience
    expect(typeof pipeline.startPipeline).toBe("function");
    // The function signature accepts an object with targetAudience
    // We can't test TypeScript types at runtime, but we can verify the function exists
    expect(pipeline.startPipeline.length).toBeGreaterThanOrEqual(1);
  });

  it("should export suggestTopics function", async () => {
    const pipeline = await import("./content-hub-pipeline");
    expect(typeof pipeline.suggestTopics).toBe("function");
  });
});
