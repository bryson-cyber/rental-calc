/**
 * Translation Router
 * 
 * Provides tRPC endpoints for translating text content using Gemini API.
 * Supports single text, batch, and report translation.
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

export const translationRouter = router({
  /**
   * Get list of supported languages
   */
  getSupportedLanguages: publicProcedure.query(() => {
    return getSupportedLanguages();
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
