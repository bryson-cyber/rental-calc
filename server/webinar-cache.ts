/**
 * Webinar Cache Service (Per-User Mode)
 * 
 * Manages "webinar mode" on a per-user basis for live masterclass presentations.
 * When webinar mode is ON for a specific user:
 * 1. Rate limiter is bypassed for THAT user's requests only
 * 2. In-memory cache serves expired entries for THAT user only
 * 3. DB cache serves expired entries for THAT user only
 * 4. Step 2 and Step 5 serve from cached data for THAT user only
 * 
 * The cache pool is GLOBAL — any property ever run by ANY user is available.
 * Other users are not affected when one user enables webinar mode.
 */

import { getDb } from './db';
import { webinarSettings, analysisReports, apiCache as apiCacheTable } from '../drizzle/schema';
import { eq, like, desc } from 'drizzle-orm';
import { getRequestContext } from './request-context';

// ============================================
// IN-MEMORY STATE (Per-User)
// ============================================

/** Set of user IDs currently in webinar mode */
const webinarModeUsers = new Set<number>();

// ============================================
// PUBLIC API
// ============================================

/**
 * Check if webinar mode is active for the CURRENT user (from request context).
 * Uses AsyncLocalStorage to determine who is making the request.
 * Returns false if no request context exists or user hasn't enabled webinar mode.
 * 
 * This function signature is unchanged from the global version —
 * all 6 existing call sites work without modification.
 */
export function isWebinarMode(): boolean {
  const ctx = getRequestContext();
  if (!ctx?.userId) return false;
  return webinarModeUsers.has(ctx.userId);
}

/**
 * Check if webinar mode is active for a specific user ID.
 * Use this when you have the user ID directly (e.g., in the router).
 */
export function isWebinarModeForUser(userId: number): boolean {
  return webinarModeUsers.has(userId);
}

/**
 * Toggle webinar mode on or off for a specific user.
 * Persists to DB and updates in-memory Set.
 */
export async function toggleWebinarMode(enabled: boolean, userId: number): Promise<boolean> {
  try {
    if (enabled) {
      webinarModeUsers.add(userId);
    } else {
      webinarModeUsers.delete(userId);
    }

    const db = await getDb();
    if (!db) {
      console.warn('[WebinarCache] DB unavailable, only setting in-memory flag');
      return enabled;
    }

    const existing = await db.select()
      .from(webinarSettings)
      .where(eq(webinarSettings.toggledBy, userId))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(webinarSettings)
        .set({ isActive: enabled ? 1 : 0, toggledAt: new Date() })
        .where(eq(webinarSettings.id, existing[0].id));
    } else {
      await db.insert(webinarSettings)
        .values({ isActive: enabled ? 1 : 0, toggledBy: userId });
    }

    console.log(`[WebinarCache] Webinar mode ${enabled ? 'ENABLED' : 'DISABLED'} for userId=${userId}`);
    return enabled;
  } catch (error) {
    console.error('[WebinarCache] Failed to toggle webinar mode:', error);
    return enabled;
  }
}

/**
 * Initialize webinar mode from DB on server startup.
 * Restores per-user state for all users who had it enabled.
 */
export async function initWebinarMode(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const activeRows = await db.select()
      .from(webinarSettings)
      .where(eq(webinarSettings.isActive, 1));

    webinarModeUsers.clear();
    for (const row of activeRows) {
      if (row.toggledBy) {
        webinarModeUsers.add(row.toggledBy);
      }
    }

    const activeCount = webinarModeUsers.size;
    if (activeCount > 0) {
      console.log(`[WebinarCache] Initialized: ${activeCount} user(s) in webinar mode (IDs: ${Array.from(webinarModeUsers).join(', ')})`);
    } else {
      console.log('[WebinarCache] Initialized: no users in webinar mode');
    }
  } catch (error) {
    console.error('[WebinarCache] Failed to initialize webinar mode:', error);
    webinarModeUsers.clear();
  }
}

/**
 * Get the set of user IDs currently in webinar mode.
 */
export function getWebinarModeUsers(): number[] {
  return Array.from(webinarModeUsers);
}

// ============================================
// ADDRESS NORMALIZATION
// ============================================

export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,]+$/, '')
    .trim();
}

// ============================================
// STEP 2 CACHE (Global pool)
// ============================================

export async function cacheStep2Data(address: string, data: unknown): Promise<void> {
  console.log(`[WebinarCache] Step 2 data cached for: ${address}`);
}

export async function getCachedStep2Data(address: string): Promise<unknown | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const normalized = normalizeAddress(address);
    
    const results = await db.select()
      .from(apiCacheTable)
      .where(like(apiCacheTable.cacheKey, `%${normalized}%`))
      .orderBy(desc(apiCacheTable.updatedAt))
      .limit(5);

    if (results.length === 0) {
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
// STEP 5 CACHE (Global pool)
// ============================================

export async function cacheStep5Data(address: string, data: unknown): Promise<void> {
  console.log(`[WebinarCache] Step 5 data noted for: ${address}`);
}

export async function getCachedStep5Data(address: string): Promise<unknown | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const normalized = normalizeAddress(address);
    
    const results = await db.select()
      .from(analysisReports)
      .where(like(analysisReports.address, `%${normalized}%`))
      .orderBy(desc(analysisReports.createdAt))
      .limit(1);

    if (results.length === 0) {
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

export async function getStep5FromHistory(address: string): Promise<unknown | null> {
  return getCachedStep5Data(address);
}

// ============================================
// ADMIN: LIST ALL CACHED PROPERTIES (Global pool)
// ============================================

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
