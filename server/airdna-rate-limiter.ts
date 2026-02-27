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
const NON_ADMIN_SOFT_LIMIT = 550;

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

/** Track if we've already notified about daily limit today */
let dailyLimitNotified = false;
let warnNotified = false;

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
 * Sync in-memory counter with DB on startup and periodically.
 * 
 * IMPORTANT: Always reset the day first, then sync from DB.
 * The DB count for TODAY is the authoritative source.
 * If the in-memory counter is higher than the DB count for today,
 * it means the counter drifted (e.g., from a previous day's accumulation
 * that wasn't properly reset). In that case, trust the DB.
 */
async function syncCounterFromDb(): Promise<void> {
  try {
    // FIRST: reset if it's a new day (clears stale counter from previous day)
    resetIfNewDay();
    
    const limitStatus = await checkDailyLimit('airdna', DAILY_HARD_LIMIT);
    const dbCount = limitStatus.currentCount;
    
    // Trust the DB as authoritative for today's count.
    // The in-memory counter can drift higher than reality if:
    // - The server didn't restart between days
    // - A previous sync pulled in stale data
    // - Requests were counted in memory but failed before DB logging
    // So we use the HIGHER of memory vs DB to avoid under-counting,
    // but cap the difference to prevent runaway drift.
    const MAX_DRIFT = 50; // Allow up to 50 calls of drift between memory and DB
    if (dbCount > dailyCallCount) {
      console.log(`[AirDNA-RateLimit] Synced UP from DB: ${dailyCallCount} -> ${dbCount}`);
      dailyCallCount = dbCount;
    } else if (dailyCallCount > dbCount + MAX_DRIFT) {
      // Memory counter has drifted too far above DB — trust DB
      console.warn(`[AirDNA-RateLimit] Counter drift detected! Memory: ${dailyCallCount}, DB: ${dbCount}. Resetting to DB value.`);
      dailyCallCount = dbCount;
    } else if (dailyCallCount > dbCount) {
      console.log(`[AirDNA-RateLimit] Memory (${dailyCallCount}) slightly above DB (${dbCount}), keeping memory value (within drift tolerance)`);
    }
    
    dailyCountDate = getTodayString();
    console.log(`[AirDNA-RateLimit] Sync complete: dailyCallCount=${dailyCallCount}, date=${dailyCountDate}`);
  } catch (error) {
    console.warn('[AirDNA-RateLimit] Failed to sync from DB, using memory counter:', error);
    // On sync failure, still try to reset if new day to prevent stale counter
    resetIfNewDay();
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
    // Admins are COMPLETELY EXEMPT from per-minute limits
    // Non-admins: wait up to 60s for the per-minute window to clear instead of failing immediately
    let callsThisMinute = getCallsInLastMinute();
    if (callsThisMinute >= PER_MINUTE_LIMIT) {
      if (isAdmin) {
        console.log(`[AirDNA-RateLimit] Admin bypassing per-minute limit: ${callsThisMinute}/${PER_MINUTE_LIMIT}`);
      } else {
        // Wait for the per-minute window to clear (check every 5s, up to 60s)
        console.log(`[AirDNA-RateLimit] Per-minute limit hit (${callsThisMinute}/${PER_MINUTE_LIMIT}), waiting for window to clear...`);
        let waited = 0;
        const MAX_WAIT_MS = 60_000;
        const CHECK_INTERVAL_MS = 5_000;
        while (waited < MAX_WAIT_MS) {
          await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
          waited += CHECK_INTERVAL_MS;
          callsThisMinute = getCallsInLastMinute();
          if (callsThisMinute < PER_MINUTE_LIMIT) {
            console.log(`[AirDNA-RateLimit] Per-minute window cleared after ${waited}ms (${callsThisMinute}/${PER_MINUTE_LIMIT})`);
            break;
          }
          console.log(`[AirDNA-RateLimit] Still waiting... ${callsThisMinute}/${PER_MINUTE_LIMIT} (${waited}ms elapsed)`);
        }
        // If still over limit after waiting, throw
        if (callsThisMinute >= PER_MINUTE_LIMIT) {
          console.warn(`[AirDNA-RateLimit] Per-minute limit still exceeded after ${MAX_WAIT_MS}ms wait: ${callsThisMinute}/${PER_MINUTE_LIMIT}`);
          logApiCall({
            provider: 'airdna',
            endpoint,
            params: body,
            statusCode: 429,
            success: false,
            errorMessage: `Per-minute rate limit after ${MAX_WAIT_MS}ms wait: ${callsThisMinute}/${PER_MINUTE_LIMIT}`,
            responseTimeMs: Date.now() - startTime,
            cacheHit: false,
            source: source || 'rate_limited',
          });
          throw new AirDNARateLimitError('per_minute', callsThisMinute, PER_MINUTE_LIMIT);
        }
      }
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
            title: 'ALERT: Daily API Limit REACHED - Non-Admin Requests Blocked',
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
          title: 'API Usage Warning',
          content: `AirDNA API is at ${dailyCallCount}/${DAILY_HARD_LIMIT} calls today (${((dailyCallCount / DAILY_HARD_LIMIT) * 100).toFixed(1)}%). Non-admin requests will be paused at ${NON_ADMIN_SOFT_LIMIT}. Admin requests are never blocked.`,
        }).catch(() => {});
      }
    }

    // INCREMENT the counter BEFORE making the call (prevents race conditions)
    dailyCallCount++;
  }

  // ── Make the actual API request ──
  recordCall(); // Track for per-minute limiting

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    // Create a fresh AbortController per attempt with 30s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Authorization": `Bearer ${ENV.airdnaApiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    };

    if (body && method === "POST") {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

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
      clearTimeout(timeoutId);
      if (error instanceof AirDNARateLimitError) throw error;
      lastError = error as Error;
      const isAbort = (error as any)?.name === 'AbortError';
      console.error(`[AirDNA-RateLimit] Attempt ${attempt + 1}/${retries} failed for ${endpoint}: ${isAbort ? 'TIMEOUT (30s)' : (lastError?.message || error)} (elapsed: ${Date.now() - startTime}ms)`);
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
