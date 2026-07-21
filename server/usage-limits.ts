/**
 * Usage Limits Service
 * 
 * Tracks and enforces daily usage limits to protect API costs.
 * Admins bypass all limits.
 * 
 * Default limits:
 * - Property analyses (Step 2): 10/day
 * - Validate analyses (Step 5): 10/day
 * - Market researches: 3/day
 * - API calls: 100/day (counts user actions, not internal sub-calls)
 */

import { getDb } from './db';
import { userUsage, users } from '../drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';

// Default limits (can be overridden via config)
const DEFAULT_LIMITS = {
  propertyAnalyses: 10,
  validateAnalyses: 10,
  marketResearches: 3,
  apiCalls: 100,
};

interface UsageStatus {
  propertyAnalyses: { used: number; limit: number; remaining: number };
  validateAnalyses: { used: number; limit: number; remaining: number };
  marketResearches: { used: number; limit: number; remaining: number };
  apiCalls: { used: number; limit: number; remaining: number };
  isAdmin: boolean;
  canAnalyze: boolean;
  canValidate: boolean;
  canResearchMarket: boolean;
}

/**
 * Get today's date string in YYYY-MM-DD format
 */
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if a user is an admin (bypasses all limits)
 */
export async function isUserAdmin(userId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    return user?.role === 'admin';
  } catch (error) {
    console.error('[UsageLimits] Error checking admin status:', error);
    return false;
  }
}

/**
 * Get or create today's usage record for a user/session
 */
async function getOrCreateUsageRecord(
  userId?: number,
  sessionId?: string,
  ipAddress?: string
): Promise<{ id: number; propertyAnalyses: number; validateAnalyses: number; marketResearches: number; apiCallsCount: number }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const today = getTodayString();
  
  // Try to find existing record
  let whereClause;
  if (userId) {
    whereClause = and(eq(userUsage.userId, userId), eq(userUsage.date, today));
  } else if (sessionId) {
    whereClause = and(eq(userUsage.sessionId, sessionId), eq(userUsage.date, today));
  } else if (ipAddress) {
    whereClause = and(eq(userUsage.ipAddress, ipAddress), eq(userUsage.date, today));
  } else {
    throw new Error('Must provide userId, sessionId, or ipAddress');
  }
  
  const [existing] = await db
    .select()
    .from(userUsage)
    .where(whereClause)
    .limit(1);
  
  if (existing) {
    return existing;
  }
  
  // Create new record
  const [result] = await db.insert(userUsage).values({
    userId: userId || null,
    sessionId: sessionId || null,
    ipAddress: ipAddress || null,
    date: today,
    propertyAnalyses: 0,
    validateAnalyses: 0,
    marketResearches: 0,
    apiCallsCount: 0,
  });
  
  return {
    id: result.insertId,
    propertyAnalyses: 0,
    validateAnalyses: 0,
    marketResearches: 0,
    apiCallsCount: 0,
  };
}

/**
 * Get current usage status for a user/session
 */
export async function getUsageStatus(
  userId?: number,
  sessionId?: string,
  ipAddress?: string
): Promise<UsageStatus> {
  // Check if admin
  const isAdmin = userId ? await isUserAdmin(userId) : false;
  
  if (isAdmin) {
    // Admins have unlimited access
    return {
      propertyAnalyses: { used: 0, limit: Infinity, remaining: Infinity },
      validateAnalyses: { used: 0, limit: Infinity, remaining: Infinity },
      marketResearches: { used: 0, limit: Infinity, remaining: Infinity },
      apiCalls: { used: 0, limit: Infinity, remaining: Infinity },
      isAdmin: true,
      canAnalyze: true,
      canValidate: true,
      canResearchMarket: true,
    };
  }
  
  const record = await getOrCreateUsageRecord(userId, sessionId, ipAddress);
  
  const propertyRemaining = Math.max(0, DEFAULT_LIMITS.propertyAnalyses - record.propertyAnalyses);
  const validateRemaining = Math.max(0, DEFAULT_LIMITS.validateAnalyses - record.validateAnalyses);
  const marketRemaining = Math.max(0, DEFAULT_LIMITS.marketResearches - record.marketResearches);
  const apiRemaining = Math.max(0, DEFAULT_LIMITS.apiCalls - record.apiCallsCount);
  
  return {
    propertyAnalyses: {
      used: record.propertyAnalyses,
      limit: DEFAULT_LIMITS.propertyAnalyses,
      remaining: propertyRemaining,
    },
    validateAnalyses: {
      used: record.validateAnalyses,
      limit: DEFAULT_LIMITS.validateAnalyses,
      remaining: validateRemaining,
    },
    marketResearches: {
      used: record.marketResearches,
      limit: DEFAULT_LIMITS.marketResearches,
      remaining: marketRemaining,
    },
    apiCalls: {
      used: record.apiCallsCount,
      limit: DEFAULT_LIMITS.apiCalls,
      remaining: apiRemaining,
    },
    isAdmin: false,
    canAnalyze: propertyRemaining > 0 && apiRemaining > 0,
    canValidate: validateRemaining > 0 && apiRemaining > 0,
    canResearchMarket: marketRemaining > 0 && apiRemaining > 0,
  };
}

/**
 * Check if user can perform a property analysis (Step 2 — Revenue Calculator)
 */
export async function canPerformAnalysis(
  userId?: number,
  sessionId?: string,
  ipAddress?: string
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const status = await getUsageStatus(userId, sessionId, ipAddress);
  
  if (status.isAdmin) {
    return { allowed: true };
  }
  
  if (status.apiCalls.remaining <= 0) {
    return { 
      allowed: false, 
      reason: 'Daily API limit reached. Your limit resets at midnight \u2014 come back tomorrow!',
      remaining: 0
    };
  }
  
  if (status.propertyAnalyses.remaining <= 0) {
    return { 
      allowed: false, 
      reason: `Daily analysis limit reached (${DEFAULT_LIMITS.propertyAnalyses}/day). Your limit resets at midnight \u2014 come back tomorrow!`,
      remaining: 0
    };
  }
  
  return { 
    allowed: true, 
    remaining: status.propertyAnalyses.remaining 
  };
}

/**
 * Check if user can perform a validate analysis (Step 5 — Validate the Deal)
 * Separate 20/day limit from property analyses
 */
export async function canPerformValidation(
  userId?: number,
  sessionId?: string,
  ipAddress?: string
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const status = await getUsageStatus(userId, sessionId, ipAddress);
  
  if (status.isAdmin) {
    return { allowed: true };
  }
  
  if (status.apiCalls.remaining <= 0) {
    return { 
      allowed: false, 
      reason: 'Daily API limit reached. Your limit resets at midnight \u2014 come back tomorrow!',
      remaining: 0
    };
  }
  
  if (status.validateAnalyses.remaining <= 0) {
    return { 
      allowed: false, 
      reason: `Daily validation limit reached (${DEFAULT_LIMITS.validateAnalyses}/day). Your limit resets at midnight \u2014 come back tomorrow!`,
      remaining: 0
    };
  }
  
  return { 
    allowed: true, 
    remaining: status.validateAnalyses.remaining 
  };
}

/**
 * Check if user can perform market research
 */
export async function canPerformMarketResearch(
  userId?: number,
  sessionId?: string,
  ipAddress?: string
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const status = await getUsageStatus(userId, sessionId, ipAddress);
  
  if (status.isAdmin) {
    return { allowed: true };
  }
  
  if (status.apiCalls.remaining <= 0) {
    return { 
      allowed: false, 
      reason: 'Daily API limit reached. Your limit resets at midnight \u2014 come back tomorrow!',
      remaining: 0
    };
  }
  
  if (status.marketResearches.remaining <= 0) {
    return { 
      allowed: false, 
      reason: `Daily market research limit reached (${DEFAULT_LIMITS.marketResearches}/day). Your limit resets at midnight \u2014 come back tomorrow!`,
      remaining: 0
    };
  }
  
  return { 
    allowed: true, 
    remaining: status.marketResearches.remaining 
  };
}

/**
 * Record a property analysis usage (Step 2)
 */
export async function recordAnalysisUsage(
  userId?: number,
  sessionId?: string,
  ipAddress?: string,
  apiCallsUsed: number = 1
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const record = await getOrCreateUsageRecord(userId, sessionId, ipAddress);
  
  await db
    .update(userUsage)
    .set({
      propertyAnalyses: sql`${userUsage.propertyAnalyses} + 1`,
      apiCallsCount: sql`${userUsage.apiCallsCount} + ${apiCallsUsed}`,
    })
    .where(eq(userUsage.id, record.id));
}

/**
 * Record a validate analysis usage (Step 5)
 */
export async function recordValidateUsage(
  userId?: number,
  sessionId?: string,
  ipAddress?: string,
  apiCallsUsed: number = 1
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const record = await getOrCreateUsageRecord(userId, sessionId, ipAddress);
  
  await db
    .update(userUsage)
    .set({
      validateAnalyses: sql`${userUsage.validateAnalyses} + 1`,
      apiCallsCount: sql`${userUsage.apiCallsCount} + ${apiCallsUsed}`,
    })
    .where(eq(userUsage.id, record.id));
}

/**
 * Record a market research usage
 */
export async function recordMarketResearchUsage(
  userId?: number,
  sessionId?: string,
  ipAddress?: string,
  apiCallsUsed: number = 1
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const record = await getOrCreateUsageRecord(userId, sessionId, ipAddress);
  
  await db
    .update(userUsage)
    .set({
      marketResearches: sql`${userUsage.marketResearches} + 1`,
      apiCallsCount: sql`${userUsage.apiCallsCount} + ${apiCallsUsed}`,
    })
    .where(eq(userUsage.id, record.id));
}

/**
 * Record API calls usage (without incrementing analysis/research counts)
 */
export async function recordApiCallsUsage(
  userId?: number,
  sessionId?: string,
  ipAddress?: string,
  apiCallsUsed: number = 1
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const record = await getOrCreateUsageRecord(userId, sessionId, ipAddress);
  
  await db
    .update(userUsage)
    .set({
      apiCallsCount: sql`${userUsage.apiCallsCount} + ${apiCallsUsed}`,
    })
    .where(eq(userUsage.id, record.id));
}

/**
 * Get usage summary for admin dashboard
 */
export async function getUsageSummary(): Promise<{
  today: { totalUsers: number; totalAnalyses: number; totalValidations: number; totalMarketResearches: number; totalApiCalls: number };
  topUsers: Array<{ userId: number | null; sessionId: string | null; analyses: number; validations: number; apiCalls: number }>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      today: { totalUsers: 0, totalAnalyses: 0, totalValidations: 0, totalMarketResearches: 0, totalApiCalls: 0 },
      topUsers: [],
    };
  }
  const today = getTodayString();
  
  // Get today's totals
  const [todayStats] = await db
    .select({
      totalUsers: sql<number>`COUNT(DISTINCT COALESCE(userId, sessionId, ipAddress))`,
      totalAnalyses: sql<number>`SUM(propertyAnalyses)`,
      totalValidations: sql<number>`SUM(validateAnalyses)`,
      totalMarketResearches: sql<number>`SUM(marketResearches)`,
      totalApiCalls: sql<number>`SUM(apiCallsCount)`,
    })
    .from(userUsage)
    .where(eq(userUsage.date, today));
  
  // Get top users by API calls today
  const topUsers = await db
    .select({
      userId: userUsage.userId,
      sessionId: userUsage.sessionId,
      analyses: userUsage.propertyAnalyses,
      validations: userUsage.validateAnalyses,
      apiCalls: userUsage.apiCallsCount,
    })
    .from(userUsage)
    .where(eq(userUsage.date, today))
    .orderBy(sql`${userUsage.apiCallsCount} DESC`)
    .limit(10);
  
  return {
    today: {
      totalUsers: todayStats?.totalUsers || 0,
      totalAnalyses: todayStats?.totalAnalyses || 0,
      totalValidations: todayStats?.totalValidations || 0,
      totalMarketResearches: todayStats?.totalMarketResearches || 0,
      totalApiCalls: todayStats?.totalApiCalls || 0,
    },
    topUsers,
  };
}
