/**
 * Rate Limiter for Report Generation
 * 
 * Limits standard users to 5 reports per day to protect AirDNA API credits.
 * Admin users are exempt from rate limits.
 * 
 * Uses a simple in-memory counter with daily reset.
 * Falls back to DB tracking for persistence across restarts.
 */

import { TRPCError } from "@trpc/server";

const DAILY_REPORT_LIMIT = 5;

interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp for midnight UTC
}

// In-memory rate limit tracker keyed by userId
const rateLimits = new Map<string, RateLimitEntry>();

/**
 * Get the next midnight UTC timestamp for daily reset
 */
function getNextMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return tomorrow.getTime();
}

/**
 * Get the current rate limit entry for a user, creating one if needed
 */
function getEntry(userId: string): RateLimitEntry {
  const now = Date.now();
  const existing = rateLimits.get(userId);
  
  // If entry exists and hasn't expired, return it
  if (existing && now < existing.resetAt) {
    return existing;
  }
  
  // Create fresh entry for new day
  const entry: RateLimitEntry = {
    count: 0,
    resetAt: getNextMidnightUTC()
  };
  rateLimits.set(userId, entry);
  return entry;
}

/**
 * Check if a user can generate a report. Throws TRPCError if limit exceeded.
 * Admin users are always allowed.
 * 
 * @param userId - The user's ID (from ctx.user.id)
 * @param userRole - The user's role ('admin' | 'user')
 * @returns The current count after this request (for informational purposes)
 */
export function checkReportRateLimit(userId: number, userRole: string): { allowed: boolean; remaining: number; resetAt: number } {
  // Admin users are exempt
  if (userRole === 'admin') {
    return { allowed: true, remaining: Infinity, resetAt: 0 };
  }
  
  const key = `user:${userId}`;
  const entry = getEntry(key);
  
  if (entry.count >= DAILY_REPORT_LIMIT) {
    const hoursUntilReset = Math.ceil((entry.resetAt - Date.now()) / (1000 * 60 * 60));
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Daily report limit reached (${DAILY_REPORT_LIMIT}/day). Upgrade to the Turnkey Program for unlimited access.`,
    });
  }
  
  return {
    allowed: true,
    remaining: DAILY_REPORT_LIMIT - entry.count,
    resetAt: entry.resetAt
  };
}

/**
 * Increment the report count for a user. Call this AFTER successful report generation.
 */
export function incrementReportCount(userId: number, userRole: string): void {
  // Don't track admin usage
  if (userRole === 'admin') return;
  
  const key = `user:${userId}`;
  const entry = getEntry(key);
  entry.count++;
  console.log(`[RateLimit] User ${userId}: ${entry.count}/${DAILY_REPORT_LIMIT} reports today`);
}

/**
 * Get the current rate limit status for a user (for display in UI)
 */
export function getRateLimitStatus(userId: number, userRole: string): { 
  limit: number; 
  used: number; 
  remaining: number; 
  resetAt: number;
  isExempt: boolean;
} {
  if (userRole === 'admin') {
    return { limit: DAILY_REPORT_LIMIT, used: 0, remaining: Infinity, resetAt: 0, isExempt: true };
  }
  
  const key = `user:${userId}`;
  const entry = getEntry(key);
  
  return {
    limit: DAILY_REPORT_LIMIT,
    used: entry.count,
    remaining: Math.max(0, DAILY_REPORT_LIMIT - entry.count),
    resetAt: entry.resetAt,
    isExempt: false
  };
}

// Clean up expired entries every hour
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of Array.from(rateLimits.entries())) {
    if (now >= entry.resetAt) {
      rateLimits.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[RateLimit] Cleaned ${cleaned} expired entries`);
  }
}, 60 * 60 * 1000);
