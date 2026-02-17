/**
 * Translation Router
 * 
 * Provides tRPC endpoints for translating text content using Claude AI.
 * Supports single text, batch, report translation, and server-side cache.
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  translateText,
  translateBatch,
  translateReport,
  getSupportedLanguages,
  SUPPORTED_LANGUAGES,
} from "../translation-service";
import {
  bulkGetCachedTranslations,
  setCachedTranslation,
  getAllCachedTranslations,
  getCacheStats,
} from "../translation-cache-db";

export const translationRouter = router({
  /**
   * Get list of supported languages
   */
  getSupportedLanguages: publicProcedure.query(() => {
    return getSupportedLanguages();
  }),

  /**
   * Bulk lookup translations from the server-side persistent cache.
   * The frontend sends an array of source texts and gets back a map
   * of sourceText → translatedText for all cache hits.
   * Cache misses are not included in the response — the frontend
   * should fall back to the translateBatch mutation for those.
   */
  bulkCacheLookup: publicProcedure
    .input(
      z.object({
        texts: z.array(z.string()).max(1000),
        targetLang: z.string().min(2).max(5),
      })
    )
    .mutation(async ({ input }) => {
      if (!SUPPORTED_LANGUAGES[input.targetLang]) {
        return { translations: {} as Record<string, string>, hitCount: 0, missCount: input.texts.length };
      }
      const cacheMap = await bulkGetCachedTranslations(input.texts, input.targetLang);
      const translations: Record<string, string> = {};
      Array.from(cacheMap.entries()).forEach(([key, val]) => {
        translations[key] = val;
      });
      return {
        translations,
        hitCount: cacheMap.size,
        missCount: input.texts.length - cacheMap.size,
      };
    }),

  /**
   * Get ALL cached translations for a language in one shot.
   * Used to pre-load the entire cache on the frontend when a user
   * selects a language. Returns a flat object of sourceText → translatedText.
   */
  getFullCache: publicProcedure
    .input(
      z.object({
        targetLang: z.string().min(2).max(5),
      })
    )
    .query(async ({ input }) => {
      if (!SUPPORTED_LANGUAGES[input.targetLang]) {
        return { translations: {} as Record<string, string>, count: 0 };
      }
      const cacheMap = await getAllCachedTranslations(input.targetLang);
      const translations: Record<string, string> = {};
      Array.from(cacheMap.entries()).forEach(([key, val]) => {
        translations[key] = val;
      });
      return { translations, count: cacheMap.size };
    }),

  /**
   * Get cache statistics (for admin dashboard)
   */
  getCacheStats: publicProcedure.query(async () => {
    return getCacheStats();
  }),

  /**
   * Translate a single text string
   */
  translateText: publicProcedure
    .input(
      z.object({
        text: z.string().min(1).max(10000),
        targetLang: z.string().min(2).max(5),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!SUPPORTED_LANGUAGES[input.targetLang]) {
        return { translation: input.text, error: "Unsupported language" };
      }
      const translation = await translateText(
        input.text,
        input.targetLang,
        input.context
      );
      // Also persist to DB cache for future use
      if (translation !== input.text) {
        setCachedTranslation(input.text, input.targetLang, translation, input.context).catch(() => {});
      }
      return { translation };
    }),

  /**
   * Translate multiple text strings in a single call (batch)
   */
  translateBatch: publicProcedure
    .input(
      z.object({
        texts: z.record(z.string(), z.string()),
        targetLang: z.string().min(2).max(5),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!SUPPORTED_LANGUAGES[input.targetLang]) {
        return { translations: input.texts, error: "Unsupported language" };
      }
      // Limit batch size to 50 items
      const keys = Object.keys(input.texts);
      if (keys.length > 50) {
        return {
          translations: input.texts,
          error: "Batch size exceeds maximum of 50 items",
        };
      }
      const translations = await translateBatch(
        input.texts,
        input.targetLang,
        input.context
      );
      // Persist all new translations to DB cache
      for (const [key, text] of Object.entries(input.texts)) {
        if (translations[key] && translations[key] !== text) {
          setCachedTranslation(text, input.targetLang, translations[key], input.context).catch(() => {});
        }
      }
      return { translations };
    }),

  /**
   * Translate a long-form report/document
   */
  translateReport: publicProcedure
    .input(
      z.object({
        content: z.string().min(1).max(100000),
        targetLang: z.string().min(2).max(5),
      })
    )
    .mutation(async ({ input }) => {
      if (!SUPPORTED_LANGUAGES[input.targetLang]) {
        return { translation: input.content, error: "Unsupported language" };
      }
      const translation = await translateReport(
        input.content,
        input.targetLang
      );
      return { translation };
    }),
});
