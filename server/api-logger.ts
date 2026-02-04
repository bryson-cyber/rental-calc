/**
 * API Call Logger Service
 * 
 * Tracks all external API calls (especially AirDNA) to:
 * 1. Monitor usage and prevent overages
 * 2. Provide visibility into API consumption
 * 3. Enable rate limiting and cost tracking
 */

import { getDb } from './db';
import { apiCallLogs, apiUsageSummary, apiCache as apiCacheTable } from '../drizzle/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

// Cost per call for different providers (in dollars)
// Cost per call for different providers (in dollars)
const COST_PER_CALL: Record<string, number> = {
  airdna: 0.35,  // $0.35 per call based on AirDNA email
  hubspot: 0,    // Free within limits
  simpletexting: 0.05,  // Approximate SMS cost
};

interface LogApiCallParams {
  provider: string;
  endpoint: string;
  params?: Record<string, unknown>;
  statusCode?: number;
  success: boolean;
  errorMessage?: string;
  responseTimeMs?: number;
  cacheHit?: boolean;
  source?: string;
  userId?: number;
  sessionId?: string;
  contactId?: string;
}

/**
 * Log an API call to the database
 */
export async function logApiCall(params: LogApiCallParams): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[API Logger] Database not available');
      return;
    }
    
    await db.insert(apiCallLogs).values({
      provider: params.provider,
      endpoint: params.endpoint,
      params: params.params ? JSON.stringify(params.params) : null,
      statusCode: params.statusCode,
      success: params.success ? 1 : 0,
      errorMessage: params.errorMessage,
      responseTimeMs: params.responseTimeMs,
      cacheHit: params.cacheHit ? 1 : 0,
      source: params.source,
      userId: params.userId,
      sessionId: params.sessionId,
      contactId: params.contactId,
    });
    
    // Update daily summary
    await updateDailySummary(params.provider, params.success, params.cacheHit || false);
    
    console.log(`[API Logger] ${params.provider}:${params.endpoint} - ${params.cacheHit ? 'CACHE HIT' : params.success ? 'SUCCESS' : 'FAILED'} (${params.responseTimeMs}ms)`);
  } catch (error) {
    // Don't let logging errors break the main flow
    console.error('[API Logger] Failed to log API call:', error);
  }
}

/**
 * Update the daily usage summary
 */
async function updateDailySummary(provider: string, success: boolean, cacheHit: boolean): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  try {
    const db = await getDb();
    if (!db) return;
    
    // Try to update existing record
    const result = await db.update(apiUsageSummary)
      .set({
        totalCalls: sql`${apiUsageSummary.totalCalls} + 1`,
        successfulCalls: success ? sql`${apiUsageSummary.successfulCalls} + 1` : sql`${apiUsageSummary.successfulCalls}`,
        failedCalls: !success ? sql`${apiUsageSummary.failedCalls} + 1` : sql`${apiUsageSummary.failedCalls}`,
        cacheHits: cacheHit ? sql`${apiUsageSummary.cacheHits} + 1` : sql`${apiUsageSummary.cacheHits}`,
        estimatedCost: !cacheHit ? sql`${apiUsageSummary.estimatedCost} + ${COST_PER_CALL[provider] || 0}` : sql`${apiUsageSummary.estimatedCost}`,
      })
      .where(and(
        eq(apiUsageSummary.date, today),
        eq(apiUsageSummary.provider, provider)
      ));
    
    // If no rows updated, insert new record
    if (result[0].affectedRows === 0) {
      await db.insert(apiUsageSummary).values({
        date: today,
        provider,
        totalCalls: 1,
        successfulCalls: success ? 1 : 0,
        failedCalls: success ? 0 : 1,
        cacheHits: cacheHit ? 1 : 0,
        estimatedCost: cacheHit ? '0' : String(COST_PER_CALL[provider] || 0),
      });
    }
  } catch (error) {
    console.error('[API Logger] Failed to update daily summary:', error);
  }
}

/**
 * Get API usage stats for a date range
 */
export async function getApiUsageStats(startDate: string, endDate: string, provider?: string) {
  try {
    const db = await getDb();
    if (!db) return null;
    
    let query = db.select()
      .from(apiUsageSummary)
      .where(
        and(
          gte(apiUsageSummary.date, startDate),
          sql`${apiUsageSummary.date} <= ${endDate}`
        )
      );
    
    // Note: Additional provider filtering would need to be added to the initial query
    // For now, we filter in JavaScript
    let results = await query;
    
    if (provider) {
      results = results.filter(r => r.provider === provider);
    }
    
    // Calculate totals
    const totals = results.reduce((acc: { totalCalls: number; successfulCalls: number; failedCalls: number; cacheHits: number; estimatedCost: number }, row: typeof results[0]) => {
      acc.totalCalls += row.totalCalls;
      acc.successfulCalls += row.successfulCalls;
      acc.failedCalls += row.failedCalls;
      acc.cacheHits += row.cacheHits;
      acc.estimatedCost += parseFloat(String(row.estimatedCost || 0));
      return acc;
    }, {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      cacheHits: 0,
      estimatedCost: 0,
    });
    
    return {
      daily: results,
      totals,
      cacheHitRate: totals.totalCalls > 0 
        ? ((totals.cacheHits / totals.totalCalls) * 100).toFixed(1) + '%'
        : '0%',
    };
  } catch (error) {
    console.error('[API Logger] Failed to get usage stats:', error);
    return null;
  }
}

/**
 * Get recent API calls for debugging
 */
export async function getRecentApiCalls(limit: number = 100, provider?: string) {
  try {
    const db = await getDb();
    if (!db) return [];
    
    let query = db.select()
      .from(apiCallLogs)
      .orderBy(sql`${apiCallLogs.createdAt} DESC`)
      .limit(limit);
    
    if (provider) {
      query = query.where(eq(apiCallLogs.provider, provider)) as typeof query;
    }
    
    return await query;
  } catch (error) {
    console.error('[API Logger] Failed to get recent calls:', error);
    return [];
  }
}

/**
 * Get today's API call count for a provider
 */
export async function getTodayCallCount(provider: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const db = await getDb();
    if (!db) return 0;
    
    const result = await db.select()
      .from(apiUsageSummary)
      .where(and(
        eq(apiUsageSummary.date, today),
        eq(apiUsageSummary.provider, provider)
      ));
    
    if (result.length > 0) {
      // Return actual API calls (total - cache hits)
      return result[0].totalCalls - result[0].cacheHits;
    }
    return 0;
  } catch (error) {
    console.error('[API Logger] Failed to get today call count:', error);
    return 0;
  }
}

/**
 * Check if we're approaching the daily limit
 */
export async function checkDailyLimit(provider: string, dailyLimit: number): Promise<{
  currentCount: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
}> {
  const currentCount = await getTodayCallCount(provider);
  const remaining = Math.max(0, dailyLimit - currentCount);
  const percentUsed = (currentCount / dailyLimit) * 100;
  
  return {
    currentCount,
    limit: dailyLimit,
    remaining,
    percentUsed,
    isNearLimit: percentUsed >= 80,
    isOverLimit: currentCount >= dailyLimit,
  };
}

// ============================================
// DATABASE-BACKED CACHE
// ============================================

/**
 * Get cached data from database
 */
export async function getDbCache<T>(cacheKey: string): Promise<T | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    
    const result = await db.select()
      .from(apiCacheTable)
      .where(eq(apiCacheTable.cacheKey, cacheKey))
      .limit(1);
    
    if (result.length === 0) {
      return null;
    }
    
    const entry = result[0];
    
    // Check if expired
    if (new Date(entry.expiresAt) < new Date()) {
      // Delete expired entry
      const dbForDelete = await getDb();
      if (dbForDelete) {
        await dbForDelete.delete(apiCacheTable).where(eq(apiCacheTable.cacheKey, cacheKey));
      }
      return null;
    }
    
    return entry.data as T;
  } catch (error) {
    console.error('[DB Cache] Failed to get cache:', error);
    return null;
  }
}

/**
 * Set cached data in database
 */
export async function setDbCache<T>(
  cacheKey: string, 
  cacheType: string, 
  data: T, 
  ttlMs: number
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    
    const expiresAt = new Date(Date.now() + ttlMs);
    
    // Upsert the cache entry
    await db.insert(apiCacheTable)
      .values({
        cacheKey,
        cacheType,
        data: JSON.stringify(data),
        expiresAt,
      })
      .onDuplicateKeyUpdate({
        set: {
          data: JSON.stringify(data),
          expiresAt,
        },
      });
  } catch (error) {
    console.error('[DB Cache] Failed to set cache:', error);
  }
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;
    
    const result = await db.delete(apiCacheTable)
      .where(sql`${apiCacheTable.expiresAt} < NOW()`);
    
    const deleted = result[0].affectedRows;
    if (deleted > 0) {
      console.log(`[DB Cache] Cleared ${deleted} expired entries`);
    }
    return deleted;
  } catch (error) {
    console.error('[DB Cache] Failed to clear expired cache:', error);
    return 0;
  }
}

// Run cache cleanup every hour
setInterval(() => {
  clearExpiredCache();
}, 60 * 60 * 1000);
