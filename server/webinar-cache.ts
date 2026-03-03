/**
 * Webinar Cache Service
 * 
 * Manages "webinar mode" for live masterclass presentations.
 * When webinar mode is ON:
 * 1. Rate limiter is bypassed entirely
 * 2. In-memory cache serves expired entries
 * 3. DB cache serves expired entries
 * 4. Step 2 (property report) and Step 5 (full analysis) serve from cached data
 * 
 * This ensures seamless demo experiences during live presentations
 * without consuming API quota or hitting rate limits.
 */

import { getDb } from './db';
import { webinarSettings, analysisReports, apiCache as apiCacheTable } from '../drizzle/schema';
import { eq, like, desc, sql } from 'drizzle-orm';

// ============================================
// IN-MEMORY STATE
// ============================================

/** In-memory flag for fast checking (no DB round-trip on every request) */
let webinarModeActive = false;

// ============================================
// PUBLIC API
// ============================================

/**
 * Check if webinar mode is currently active.
 * Uses in-memory flag for zero-latency checks.
 */
export function isWebinarMode(): boolean {
  return webinarModeActive;
}

/**
 * Toggle webinar mode on or off.
 * Persists to DB and updates in-memory flag.
 */
export async function toggleWebinarMode(enabled: boolean, updatedBy?: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[WebinarCache] DB unavailable, only setting in-memory flag');
      webinarModeActive = enabled;
      return enabled;
    }

    // Check if a row exists
    const existing = await db.select().from(webinarSettings).limit(1);
    
    if (existing.length > 0) {
      // Update existing row
      await db.update(webinarSettings)
        .set({
          isActive: enabled ? 1 : 0,
          toggledBy: updatedBy || null,
          toggledAt: new Date(),
        })
        .where(eq(webinarSettings.id, existing[0].id));
    } else {
      // Insert new row
      await db.insert(webinarSettings)
        .values({
          isActive: enabled ? 1 : 0,
          toggledBy: updatedBy || null,
        });
    }

    webinarModeActive = enabled;
    console.log(`[WebinarCache] Webinar mode ${enabled ? 'ENABLED' : 'DISABLED'} by userId=${updatedBy || 'system'}`);
    return enabled;
  } catch (error) {
    console.error('[WebinarCache] Failed to toggle webinar mode:', error);
    // Still set in-memory flag as fallback
    webinarModeActive = enabled;
    return enabled;
  }
}

/**
 * Initialize webinar mode from DB on server startup.
 * Restores the last known state.
 */
export async function initWebinarMode(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const result = await db.select()
      .from(webinarSettings)
      .limit(1);

    if (result.length > 0) {
      webinarModeActive = result[0].isActive === 1;
      console.log(`[WebinarCache] Initialized webinar mode: ${webinarModeActive ? 'ON' : 'OFF'}`);
    } else {
      webinarModeActive = false;
      console.log('[WebinarCache] No webinar mode setting found, defaulting to OFF');
    }
  } catch (error) {
    console.error('[WebinarCache] Failed to initialize webinar mode:', error);
    webinarModeActive = false;
  }
}

// ============================================
// ADDRESS NORMALIZATION
// ============================================

/**
 * Normalize an address for consistent cache key matching.
 * Lowercases, trims, collapses spaces, strips trailing punctuation.
 */
export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')       // collapse multiple spaces
    .replace(/[.,]+$/, '')       // strip trailing punctuation
    .trim();
}

// ============================================
// STEP 2 CACHE (Property Report / Rentalizer)
// ============================================

/**
 * Cache Step 2 data (property report) for webinar use.
 * This is called automatically when a normal report is generated.
 * Data is stored in the existing api_cache table.
 */
export async function cacheStep2Data(address: string, data: unknown): Promise<void> {
  // Step 2 data is already cached by the normal cache layer.
  // This function exists for explicit caching if needed.
  console.log(`[WebinarCache] Step 2 data cached for: ${address}`);
}

/**
 * Get cached Step 2 data for a property address.
 * Searches api_cache for rentalizer/property data, ignoring expiry.
 */
export async function getCachedStep2Data(address: string): Promise<unknown | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const normalized = normalizeAddress(address);
    
    // Search api_cache for entries matching this address
    // Cache keys contain the address in various formats
    const results = await db.select()
      .from(apiCacheTable)
      .where(
        like(apiCacheTable.cacheKey, `%${normalized}%`)
      )
      .orderBy(desc(apiCacheTable.updatedAt))
      .limit(5);

    if (results.length === 0) {
      // Try partial match with just the street number and name
      const parts = normalized.split(',')[0]?.trim();
      if (parts) {
        const partialResults = await db.select()
          .from(apiCacheTable)
          .where(like(apiCacheTable.cacheKey, `%${parts}%`))
          .orderBy(desc(apiCacheTable.updatedAt))
          .limit(5);
        
        if (partialResults.length > 0) {
          let data = partialResults[0].data;
          if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch { /* keep as-is */ }
          }
          console.log(`[WebinarCache] Step 2 partial cache hit for: ${address} (key: ${partialResults[0].cacheKey.substring(0, 60)}...)`);
          return data;
        }
      }
      return null;
    }

    let data = results[0].data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { /* keep as-is */ }
    }
    console.log(`[WebinarCache] Step 2 cache hit for: ${address} (key: ${results[0].cacheKey.substring(0, 60)}...)`);
    return data;
  } catch (error) {
    console.error('[WebinarCache] Failed to get Step 2 cache:', error);
    return null;
  }
}

// ============================================
// STEP 5 CACHE (Full Analysis)
// ============================================

/**
 * Cache Step 5 data (full analysis) for webinar use.
 * Data is stored in the analysis_reports table.
 */
export async function cacheStep5Data(address: string, data: unknown): Promise<void> {
  // Step 5 data is already stored in analysis_reports by the normal flow.
  console.log(`[WebinarCache] Step 5 data noted for: ${address}`);
}

/**
 * Get cached Step 5 data from analysis_reports, ignoring age.
 * Returns the most recent full analysis for the given address.
 */
export async function getCachedStep5Data(address: string): Promise<unknown | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const normalized = normalizeAddress(address);
    
    // Search analysis_reports for this address
    const results = await db.select()
      .from(analysisReports)
      .where(like(analysisReports.address, `%${normalized}%`))
      .orderBy(desc(analysisReports.createdAt))
      .limit(1);

    if (results.length === 0) {
      // Try partial match
      const streetPart = normalized.split(',')[0]?.trim();
      if (streetPart) {
        const partialResults = await db.select()
          .from(analysisReports)
          .where(like(analysisReports.address, `%${streetPart}%`))
          .orderBy(desc(analysisReports.createdAt))
          .limit(1);
        
        if (partialResults.length > 0) {
          console.log(`[WebinarCache] Step 5 partial cache hit for: ${address}`);
          return partialResults[0];
        }
      }
      return null;
    }

    console.log(`[WebinarCache] Step 5 cache hit for: ${address}`);
    return results[0];
  } catch (error) {
    console.error('[WebinarCache] Failed to get Step 5 cache:', error);
    return null;
  }
}

/**
 * Get Step 5 data from analysis_reports history.
 * Alias for getCachedStep5Data for backward compatibility.
 */
export async function getStep5FromHistory(address: string): Promise<unknown | null> {
  return getCachedStep5Data(address);
}

// ============================================
// ADMIN: LIST ALL CACHED PROPERTIES
// ============================================

/**
 * Get all properties that have cached data available for webinar mode.
 * Returns addresses from analysis_reports with their last analysis date.
 */
export async function getAllCachedProperties(): Promise<Array<{
  id: number;
  address: string;
  city: string | null;
  state: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  annualRevenue: number | null;
  verdict: string | null;
  createdAt: Date;
}>> {
  try {
    const db = await getDb();
    if (!db) return [];

    const results = await db.select({
      id: analysisReports.id,
      address: analysisReports.address,
      city: analysisReports.city,
      state: analysisReports.state,
      bedrooms: analysisReports.bedrooms,
      bathrooms: analysisReports.bathrooms,
      annualRevenue: analysisReports.annualRevenueRealistic,
      verdict: analysisReports.verdict,
      createdAt: analysisReports.createdAt,
    })
      .from(analysisReports)
      .orderBy(desc(analysisReports.createdAt))
      .limit(50);

    return results;
  } catch (error) {
    console.error('[WebinarCache] Failed to list cached properties:', error);
    return [];
  }
}

/**
 * Delete a cached property from analysis_reports.
 */
export async function deleteCachedProperty(id: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    await db.delete(analysisReports).where(eq(analysisReports.id, id));
    console.log(`[WebinarCache] Deleted cached property ID: ${id}`);
    return true;
  } catch (error) {
    console.error('[WebinarCache] Failed to delete cached property:', error);
    return false;
  }
}
