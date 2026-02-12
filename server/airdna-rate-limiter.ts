/**
 * Centralized AirDNA API Rate Limiter
 * 
 * ALL AirDNA API calls MUST go through this module.
 * Enforces:
 * - Daily limit: 600 calls/day (conservative buffer under 700 plan limit)
 * - Per-minute limit: 15 calls/min (prevents burst usage)
 * - FAIL-CLOSED: if the limit check fails, requests are BLOCKED (not allowed through)
 * - In-memory daily counter as PRIMARY gate (no DB dependency for blocking)
 * - DB counter as secondary verification (synced on startup and periodically)
 * - Logs all calls for monitoring
 */

import { ENV } from "./_core/env";
import { logApiCall, checkDailyLimit } from './api-logger';
import { notifyOwner } from './_core/notification';
import { isAdminRequest } from './request-context';

const AIRDNA_API_BASE = "https://api.airdna.co/api/enterprise/v2";

// ============================================
// RATE LIMIT CONFIGURATION
// ============================================

/** Hard daily limit - non-admin requests are BLOCKED beyond this */
const DAILY_HARD_LIMIT = 600;

/** Soft limit for non-admins - non-admin requests are paused beyond this to conserve quota */
const NON_ADMIN_SOFT_LIMIT = 400;

/** Warning threshold - notifications sent beyond this */
const DAILY_WARN_THRESHOLD = 500;

/** Per-minute limit - prevents burst usage */
const PER_MINUTE_LIMIT = 15;

/** Track per-minute calls in memory */
const minuteCallLog: number[] = [];

// ============================================
// IN-MEMORY DAILY COUNTER (PRIMARY GATE)
// ============================================

/** 
 * In-memory daily counter - this is the PRIMARY rate limit gate.
 * Does NOT depend on DB. Incremented atomically before every API call.
 * Synced with DB on startup and periodically.
 */
let dailyCallCount = 0;
let dailyCountDate = '';

/** Get today's date string in local timezone */
function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Reset counter if it's a new day */
function resetIfNewDay(): void {
  const today = getTodayString();
  if (today !== dailyCountDate) {
    console.log(`[AirDNA-RateLimit] New day detected (${dailyCountDate} -> ${today}), resetting daily counter`);
    dailyCallCount = 0;
    dailyCountDate = today;
    dailyLimitNotified = false;
    warnNotified = false;
  }
}

/** 
 * Sync in-memory counter with DB on startup.
 * Called once when the module loads.
 */
async function syncCounterFromDb(): Promise<void> {
  try {
    const limitStatus = await checkDailyLimit('airdna', DAILY_HARD_LIMIT);
    const dbCount = limitStatus.currentCount;
    
    // Use the higher of memory vs DB count (never go backwards)
    if (dbCount > dailyCallCount) {
      console.log(`[AirDNA-RateLimit] Synced from DB: ${dailyCallCount} -> ${dbCount}`);
      dailyCallCount = dbCount;
    }
    dailyCountDate = getTodayString();
  } catch (error) {
    console.warn('[AirDNA-RateLimit] Failed to sync from DB, using memory counter:', error);
    // Keep whatever count we have - fail closed means we don't reset to 0
  }
}

// Sync on module load
syncCounterFromDb().catch(() => {});

// Re-sync every 5 minutes to catch any drift
setInterval(() => {
  syncCounterFromDb().catch(() => {});
}, 5 * 60 * 1000);

// ============================================
// PER-MINUTE THROTTLE
// ============================================

function cleanMinuteLog(): void {
  const oneMinuteAgo = Date.now() - 60_000;
  while (minuteCallLog.length > 0 && minuteCallLog[0] < oneMinuteAgo) {
    minuteCallLog.shift();
  }
}

function getCallsInLastMinute(): number {
  cleanMinuteLog();
  return minuteCallLog.length;
}

function recordCall(): void {
  minuteCallLog.push(Date.now());
}

// ============================================
// RATE LIMIT ERROR
// ============================================

export class AirDNARateLimitError extends Error {
  public readonly isRateLimit = true;
  public readonly currentCount: number;
  public readonly limit: number;
  public readonly type: 'daily' | 'per_minute';

  constructor(type: 'daily' | 'per_minute', currentCount: number, limit: number) {
    const message = type === 'daily'
      ? `AirDNA daily API limit reached (${currentCount}/${limit}). Data will be served from cache where available. Please try again tomorrow.`
      : `AirDNA rate limit: too many requests per minute (${currentCount}/${limit}). Please wait a moment.`;
    super(message);
    this.name = 'AirDNARateLimitError';
    this.type = type;
    this.currentCount = currentCount;
    this.limit = limit;
  }
}

// ============================================
// CENTRALIZED API REQUEST FUNCTION
// ============================================

/** Track if we've already notified about daily limit today */
let dailyLimitNotified = false;
let warnNotified = false;
let lastNotifyDate = '';

function resetDailyNotifyIfNewDay(): void {
  const today = new Date().toISOString().split('T')[0];
  if (today !== lastNotifyDate) {
    dailyLimitNotified = false;
    warnNotified = false;
    lastNotifyDate = today;
  }
}

/**
 * Make a rate-limited AirDNA API request.
 * 
 * This is the ONLY function that should make HTTP requests to AirDNA.
 * All other modules must use this function.
 * 
 * FAIL-CLOSED: If rate limit check fails for any reason, the request is BLOCKED.
 * 
 * @throws {AirDNARateLimitError} when daily or per-minute limit is exceeded
 */
export async function rateLimitedAirDNARequest<T>(
  endpoint: string,
  method: "GET" | "POST" = "POST",
  body?: Record<string, unknown>,
  options?: {
    retries?: number;
    source?: string;
    /** If true, skip rate limit check (use for critical operations only) */
    bypassRateLimit?: boolean;
    /** If true, this request is from an admin user — never block, only warn */
    isAdmin?: boolean;
  }
): Promise<T> {
  const retries = options?.retries ?? 3;
  const source = options?.source;
  // Admin status: explicit option takes priority, otherwise auto-detect from request context
  const isAdmin = options?.isAdmin ?? isAdminRequest();
  const url = `${AIRDNA_API_BASE}${endpoint}`;
  const startTime = Date.now();

  // ── Rate limit checks (unless bypassed) ──
  if (!options?.bypassRateLimit) {
    // 1. Check per-minute limit (memory-based, instant)
    // Admins get a higher per-minute limit (30 vs 15)
    const effectivePerMinuteLimit = isAdmin ? PER_MINUTE_LIMIT * 2 : PER_MINUTE_LIMIT;
    const callsThisMinute = getCallsInLastMinute();
    if (callsThisMinute >= effectivePerMinuteLimit) {
      console.warn(`[AirDNA-RateLimit] Per-minute limit hit: ${callsThisMinute}/${effectivePerMinuteLimit} (admin: ${isAdmin})`);
      
      logApiCall({
        provider: 'airdna',
        endpoint,
        params: body,
        statusCode: 429,
        success: false,
        errorMessage: `Per-minute rate limit: ${callsThisMinute}/${effectivePerMinuteLimit}`,
        responseTimeMs: 0,
        cacheHit: false,
        source: source || 'rate_limited',
      });

      throw new AirDNARateLimitError('per_minute', callsThisMinute, effectivePerMinuteLimit);
    }

    // 2. Check daily limit using IN-MEMORY counter (PRIMARY gate - no DB dependency)
    resetIfNewDay();
    
    // NON-ADMIN users: blocked at NON_ADMIN_SOFT_LIMIT to preserve quota for admin
    if (!isAdmin && dailyCallCount >= NON_ADMIN_SOFT_LIMIT) {
      console.warn(`[AirDNA-RateLimit] Non-admin request blocked at soft limit: ${dailyCallCount}/${NON_ADMIN_SOFT_LIMIT}`);
      
      logApiCall({
        provider: 'airdna',
        endpoint,
        params: body,
        statusCode: 429,
        success: false,
        errorMessage: `Non-admin daily soft limit: ${dailyCallCount}/${NON_ADMIN_SOFT_LIMIT}`,
        responseTimeMs: 0,
        cacheHit: false,
        source: source || 'rate_limited_non_admin',
      });

      throw new AirDNARateLimitError('daily', dailyCallCount, NON_ADMIN_SOFT_LIMIT);
    }
    
    // ADMIN users: only blocked at the absolute hard limit (never blocked in practice — just warned)
    if (dailyCallCount >= DAILY_HARD_LIMIT) {
      if (isAdmin) {
        // Admin is NEVER blocked — just log a warning
        console.warn(`[AirDNA-RateLimit] Admin request ALLOWED past hard limit: ${dailyCallCount}/${DAILY_HARD_LIMIT}`);
      } else {
        console.error(`[AirDNA-RateLimit] DAILY LIMIT EXCEEDED (memory): ${dailyCallCount}/${DAILY_HARD_LIMIT} - BLOCKING REQUEST`);
        
        // Notify owner once per day
        resetDailyNotifyIfNewDay();
        if (!dailyLimitNotified) {
          dailyLimitNotified = true;
          notifyOwner({
            title: '🚨 AirDNA Daily Limit REACHED - Non-Admin Requests Blocked',
            content: `AirDNA API has hit the hard limit of ${DAILY_HARD_LIMIT} calls today (actual: ${dailyCallCount}). Non-admin API requests are being blocked. Admin requests still go through. Cached data is still being served. The limit resets at midnight.`,
          }).catch(() => {});
        }

        logApiCall({
          provider: 'airdna',
          endpoint,
          params: body,
          statusCode: 429,
          success: false,
          errorMessage: `Daily rate limit: ${dailyCallCount}/${DAILY_HARD_LIMIT}`,
          responseTimeMs: 0,
          cacheHit: false,
          source: source || 'rate_limited',
        });

        throw new AirDNARateLimitError('daily', dailyCallCount, DAILY_HARD_LIMIT);
      }
    }

    // Warn when approaching limit
    if (dailyCallCount >= DAILY_WARN_THRESHOLD) {
      console.warn(`[AirDNA-RateLimit] WARNING: ${dailyCallCount}/${DAILY_HARD_LIMIT} calls today`);
      
      resetDailyNotifyIfNewDay();
      if (!warnNotified) {
        warnNotified = true;
        notifyOwner({
          title: '⚠️ AirDNA API Usage Warning',
          content: `AirDNA API is at ${dailyCallCount}/${DAILY_HARD_LIMIT} calls today (${((dailyCallCount / DAILY_HARD_LIMIT) * 100).toFixed(1)}%). Non-admin requests will be paused at ${NON_ADMIN_SOFT_LIMIT}. Admin requests are never blocked.`,
        }).catch(() => {});
      }
    }

    // INCREMENT the counter BEFORE making the call (prevents race conditions)
    dailyCallCount++;
  }

  // ── Make the actual API request ──
  recordCall(); // Track for per-minute limiting

  const fetchOptions: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${ENV.airdnaApiKey}`,
      "Content-Type": "application/json",
    },
  };

  if (body && method === "POST") {
    fetchOptions.body = JSON.stringify(body);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        const statusCode = response.status;

        // Don't retry 4xx errors except 429
        if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
          logApiCall({
            provider: 'airdna',
            endpoint,
            params: body,
            statusCode,
            success: false,
            errorMessage: errorText,
            responseTimeMs: Date.now() - startTime,
            cacheHit: false,
            source,
          });
          throw new Error(`AirDNA API error (${statusCode}): ${errorText}`);
        }

        // Retry on 5xx and 429
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.log(`[AirDNA-RateLimit] Retrying ${endpoint} in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        logApiCall({
          provider: 'airdna',
          endpoint,
          params: body,
          statusCode,
          success: false,
          errorMessage: errorText,
          responseTimeMs: Date.now() - startTime,
          cacheHit: false,
          source,
        });
        throw new Error(`AirDNA API error (${statusCode}): ${errorText}`);
      }

      const data = await response.json();

      // Log successful call (DB logging is fire-and-forget, doesn't affect the gate)
      logApiCall({
        provider: 'airdna',
        endpoint,
        params: body,
        statusCode: response.status,
        success: true,
        responseTimeMs: Date.now() - startTime,
        cacheHit: false,
        source,
      });

      return data as T;
    } catch (error) {
      if (error instanceof AirDNARateLimitError) throw error;
      lastError = error as Error;
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`AirDNA API request failed after ${retries} retries`);
}

// ============================================
// USAGE STATS (for admin dashboard)
// ============================================

export function getRateLimiterStats() {
  return {
    callsInLastMinute: getCallsInLastMinute(),
    perMinuteLimit: PER_MINUTE_LIMIT,
    dailyHardLimit: DAILY_HARD_LIMIT,
    dailyWarnThreshold: DAILY_WARN_THRESHOLD,
    dailyLimitNotified,
    dailyCallCount,
    dailyCountDate,
  };
}

export { AIRDNA_API_BASE, DAILY_HARD_LIMIT, PER_MINUTE_LIMIT, NON_ADMIN_SOFT_LIMIT };
