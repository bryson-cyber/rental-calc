/**
 * Translation Cache Database Helpers
 * 
 * Provides database-backed persistent translation cache.
 * Uses a hash of the source text + language for fast lookups.
 * Supports bulk lookups and bulk inserts for seeding.
 */

import { eq, and, inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import { translationCache } from "../drizzle/schema";
import crypto from "crypto";

/**
 * Create a deterministic hash for a source text string.
 * Uses MD5 for speed — this is not security-sensitive.
 */
export function hashSourceText(text: string): string {
  return crypto.createHash("md5").update(text.trim()).digest("hex");
}

/**
 * Look up a single translation from the database cache.
 */
export async function getCachedTranslation(
  sourceText: string,
  targetLang: string
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const hash = hashSourceText(sourceText);

  try {
    const rows = await db
      .select({ translatedText: translationCache.translatedText, id: translationCache.id })
      .from(translationCache)
      .where(
        and(
          eq(translationCache.sourceHash, hash),
          eq(translationCache.targetLang, targetLang)
        )
      )
      .limit(1);

    if (rows.length > 0) {
      // Increment hit count asynchronously (fire and forget)
      db.update(translationCache)
        .set({ hitCount: sql`${translationCache.hitCount} + 1` })
        .where(eq(translationCache.id, rows[0].id))
        .execute()
        .catch(() => {}); // ignore errors on hit count update
      return rows[0].translatedText;
    }
    return null;
  } catch (error) {
    console.error("[TranslationCache] Lookup error:", error);
    return null;
  }
}

/**
 * Bulk lookup translations from the database cache.
 * Returns a map of sourceText → translatedText for all found entries.
 * This is the key performance optimization — one DB query for many strings.
 */
export async function bulkGetCachedTranslations(
  sourceTexts: string[],
  targetLang: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const db = await getDb();
  if (!db || sourceTexts.length === 0) return result;

  // Create hash → originalText mapping
  const hashToText = new Map<string, string>();
  const hashes: string[] = [];
  for (const text of sourceTexts) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    const hash = hashSourceText(trimmed);
    hashToText.set(hash, trimmed);
    hashes.push(hash);
  }

  if (hashes.length === 0) return result;

  try {
    // Query in batches of 500 to avoid MySQL IN clause limits
    const BATCH_SIZE = 500;
    for (let i = 0; i < hashes.length; i += BATCH_SIZE) {
      const batchHashes = hashes.slice(i, i + BATCH_SIZE);
      
      const rows = await db
        .select({
          sourceHash: translationCache.sourceHash,
          translatedText: translationCache.translatedText,
          id: translationCache.id,
        })
        .from(translationCache)
        .where(
          and(
            inArray(translationCache.sourceHash, batchHashes),
            eq(translationCache.targetLang, targetLang)
          )
        );

      for (const row of rows) {
        const originalText = hashToText.get(row.sourceHash);
        if (originalText) {
          result.set(originalText, row.translatedText);
        }
      }

      // Bulk increment hit counts (fire and forget)
      if (rows.length > 0) {
        const ids = rows.map(r => r.id);
        db.update(translationCache)
          .set({ hitCount: sql`${translationCache.hitCount} + 1` })
          .where(inArray(translationCache.id, ids))
          .execute()
          .catch(() => {});
      }
    }
  } catch (error) {
    console.error("[TranslationCache] Bulk lookup error:", error);
  }

  return result;
}

/**
 * Store a single translation in the database cache.
 * Uses INSERT ... ON DUPLICATE KEY UPDATE for upsert behavior.
 */
export async function setCachedTranslation(
  sourceText: string,
  targetLang: string,
  translatedText: string,
  context?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const hash = hashSourceText(sourceText.trim());

  try {
    await db
      .insert(translationCache)
      .values({
        sourceHash: hash,
        sourceText: sourceText.trim(),
        targetLang,
        translatedText: translatedText.trim(),
        context: context || null,
        hitCount: 0,
      })
      .onDuplicateKeyUpdate({
        set: {
          translatedText: translatedText.trim(),
          context: context || null,
          updatedAt: sql`NOW()`,
        },
      });
  } catch (error) {
    console.error("[TranslationCache] Insert error:", error);
  }
}

/**
 * Bulk insert translations into the database cache.
 * Used for seeding pre-translated strings.
 */
export async function bulkSetCachedTranslations(
  entries: Array<{
    sourceText: string;
    targetLang: string;
    translatedText: string;
    context?: string;
  }>
): Promise<number> {
  const db = await getDb();
  if (!db || entries.length === 0) return 0;

  let inserted = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const values = batch.map(e => ({
      sourceHash: hashSourceText(e.sourceText.trim()),
      sourceText: e.sourceText.trim(),
      targetLang: e.targetLang,
      translatedText: e.translatedText.trim(),
      context: e.context || null,
      hitCount: 0,
    }));

    try {
      await db
        .insert(translationCache)
        .values(values)
        .onDuplicateKeyUpdate({
          set: {
            translatedText: sql`VALUES(translatedText)`,
            updatedAt: sql`NOW()`,
          },
        });
      inserted += batch.length;
    } catch (error) {
      console.error(`[TranslationCache] Bulk insert batch ${i} error:`, error);
    }
  }

  return inserted;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  byLanguage: Record<string, number>;
  totalHits: number;
}> {
  const db = await getDb();
  if (!db) return { totalEntries: 0, byLanguage: {}, totalHits: 0 };

  try {
    const stats = await db
      .select({
        targetLang: translationCache.targetLang,
        count: sql<number>`COUNT(*)`,
        hits: sql<number>`SUM(${translationCache.hitCount})`,
      })
      .from(translationCache)
      .groupBy(translationCache.targetLang);

    const byLanguage: Record<string, number> = {};
    let totalEntries = 0;
    let totalHits = 0;

    for (const row of stats) {
      byLanguage[row.targetLang] = Number(row.count);
      totalEntries += Number(row.count);
      totalHits += Number(row.hits || 0);
    }

    return { totalEntries, byLanguage, totalHits };
  } catch (error) {
    console.error("[TranslationCache] Stats error:", error);
    return { totalEntries: 0, byLanguage: {}, totalHits: 0 };
  }
}

/**
 * Get all cached translations for a specific language.
 * Used to pre-load the entire cache on the frontend.
 */
export async function getAllCachedTranslations(
  targetLang: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const db = await getDb();
  if (!db) return result;

  try {
    const rows = await db
      .select({
        sourceText: translationCache.sourceText,
        translatedText: translationCache.translatedText,
      })
      .from(translationCache)
      .where(eq(translationCache.targetLang, targetLang));

    for (const row of rows) {
      result.set(row.sourceText, row.translatedText);
    }
  } catch (error) {
    console.error("[TranslationCache] GetAll error:", error);
  }

  return result;
}
