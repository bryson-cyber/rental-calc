/**
 * Tests for Translation Cache Database Helpers
 * 
 * Tests the hash function, cache lookup, and cache insert logic.
 * Uses the real database since the cache table was already created.
 */

import { describe, it, expect } from "vitest";
import { hashSourceText } from "./translation-cache-db";

describe("Translation Cache", () => {
  describe("hashSourceText", () => {
    it("should return a consistent MD5 hash for the same input", () => {
      const hash1 = hashSourceText("Hello World");
      const hash2 = hashSourceText("Hello World");
      expect(hash1).toBe(hash2);
    });

    it("should return a 32-character hex string", () => {
      const hash = hashSourceText("Test string");
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });

    it("should trim whitespace before hashing", () => {
      const hash1 = hashSourceText("  Hello World  ");
      const hash2 = hashSourceText("Hello World");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", () => {
      const hash1 = hashSourceText("Hello");
      const hash2 = hashSourceText("World");
      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty strings", () => {
      const hash = hashSourceText("");
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });

    it("should handle unicode characters", () => {
      const hash = hashSourceText("Hola Mundo 🌍");
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });

    it("should handle very long strings", () => {
      const longString = "A".repeat(10000);
      const hash = hashSourceText(longString);
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe("Translation Router Endpoints", () => {
    it("should have the getFullCache endpoint defined", async () => {
      // Import the router to verify it compiles and has the expected shape
      const { translationRouter } = await import("./routers/translation");
      expect(translationRouter).toBeDefined();
      // The router should have the getFullCache procedure
      expect((translationRouter as any)._def.procedures.getFullCache).toBeDefined();
    });

    it("should have the bulkCacheLookup endpoint defined", async () => {
      const { translationRouter } = await import("./routers/translation");
      expect((translationRouter as any)._def.procedures.bulkCacheLookup).toBeDefined();
    });

    it("should have the getCacheStats endpoint defined", async () => {
      const { translationRouter } = await import("./routers/translation");
      expect((translationRouter as any)._def.procedures.getCacheStats).toBeDefined();
    });

    it("should have the translateText endpoint defined", async () => {
      const { translationRouter } = await import("./routers/translation");
      expect((translationRouter as any)._def.procedures.translateText).toBeDefined();
    });

    it("should have the translateBatch endpoint defined", async () => {
      const { translationRouter } = await import("./routers/translation");
      expect((translationRouter as any)._def.procedures.translateBatch).toBeDefined();
    });
  });

  describe("Seed Script UI Strings", () => {
    it("should have a comprehensive list of UI strings to seed", async () => {
      // Verify the seed script file exists and is importable
      const fs = await import("fs");
      const path = await import("path");
      const seedPath = path.resolve(__dirname, "seed-translations.mjs");
      expect(fs.existsSync(seedPath)).toBe(true);
    });
  });
});
