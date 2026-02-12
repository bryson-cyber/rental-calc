/**
 * Centralized AirDNA API Rate Limiter
 * 
 * ALL AirDNA API calls MUST go through this module.
 * Enforces:
 * - Daily limit: 600 calls/day (conservative buffer under 700 plan limit)
 * - Per-minute limit: 15 calls/min (prevents burst usage)
 * - Blocks requests when limits are hit (returns error, does NOT silently continue)
 * - Logs all calls for monitoring
 */

import { ENV } from "./_core/env";
import { logApiCall, checkDailyLimit } from './api-logger';
import { notifyOwner } from './_core/notification';

const AIRDNA_API_BASE = "https://api.airdna.co/api/enterprise/v2";

// ============================================
// RATE LIMIT CONFIGURATION
// ============================================

/** Hard daily limit - requests are BLOCKED beyond this */
const DAILY_HARD_LIMIT = 600;

/** Warning threshold - notifications sent beyond this */
const DAILY_WARN_THRESHOLD = 500;

/** Per-minute limit - prevents burst usage */
const PER_MINUTE_LIMIT = 15;

/** Track per-minute calls in memory */
const minuteCallLog: number[] = [];

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
let lastNotifyDate = '';

function resetDailyNotifyIfNewDay(): void {
  const today = new Date().toISOString().split('T')[0];
  if (today !== lastNotifyDate) {
    dailyLimitNotified = false;
    lastNotifyDate = today;
  }
}

/**
 * Make a rate-limited AirDNA API request.
 * 
 * This is the ONLY function that should make HTTP requests to AirDNA.
 * All other modules must use this function.
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
  }
): Promise<T> {
  const retries = options?.retries ?? 3;
  const source = options?.source;
  const url = `${AIRDNA_API_BASE}${endpoint}`;
  const startTime = Date.now();

  // ── Rate limit checks (unless bypassed) ──
  if (!options?.bypassRateLimit) {
    // 1. Check per-minute limit
    const callsThisMinute = getCallsInLastMinute();
    if (callsThisMinute >= PER_MINUTE_LIMIT) {
      console.warn(`[AirDNA-RateLimit] Per-minute limit hit: ${callsThisMinute}/${PER_MINUTE_LIMIT}`);
      
      logApiCall({
        provider: 'airdna',
        endpoint,
        params: body,
        statusCode: 429,
        success: false,
        errorMessage: `Per-minute rate limit: ${callsThisMinute}/${PER_MINUTE_LIMIT}`,
        responseTimeMs: 0,
        cacheHit: false,
        source: source || 'rate_limited',
      });

      throw new AirDNARateLimitError('per_minute', callsThisMinute, PER_MINUTE_LIMIT);
    }

    // 2. Check daily limit
    try {
      const limitStatus = await checkDailyLimit('airdna', DAILY_HARD_LIMIT);
      
      if (limitStatus.isOverLimit) {
        console.error(`[AirDNA-RateLimit] DAILY LIMIT EXCEEDED: ${limitStatus.currentCount}/${DAILY_HARD_LIMIT} - BLOCKING REQUEST`);
        
        // Notify owner once per day
        resetDailyNotifyIfNewDay();
        if (!dailyLimitNotified) {
          dailyLimitNotified = true;
          notifyOwner({
            title: '🚨 AirDNA Daily Limit REACHED - Requests Blocked',
            content: `AirDNA API has hit the hard limit of ${DAILY_HARD_LIMIT} calls today (actual: ${limitStatus.currentCount}). New API requests are being blocked. Cached data is still being served. The limit resets at midnight UTC.`,
          }).catch(() => {});
        }

        logApiCall({
          provider: 'airdna',
          endpoint,
          params: body,
          statusCode: 429,
          success: false,
          errorMessage: `Daily rate limit: ${limitStatus.currentCount}/${DAILY_HARD_LIMIT}`,
          responseTimeMs: 0,
          cacheHit: false,
          source: source || 'rate_limited',
        });

        throw new AirDNARateLimitError('daily', limitStatus.currentCount, DAILY_HARD_LIMIT);
      }

      // Warn when approaching limit
      if (limitStatus.currentCount >= DAILY_WARN_THRESHOLD) {
        console.warn(`[AirDNA-RateLimit] WARNING: ${limitStatus.currentCount}/${DAILY_HARD_LIMIT} calls today (${limitStatus.percentUsed.toFixed(1)}% used)`);
        
        // Notify owner once when hitting warning threshold
        resetDailyNotifyIfNewDay();
        if (!dailyLimitNotified && limitStatus.currentCount >= DAILY_WARN_THRESHOLD) {
          dailyLimitNotified = true;
          notifyOwner({
            title: '⚠️ AirDNA API Usage Warning',
            content: `AirDNA API is at ${limitStatus.currentCount}/${DAILY_HARD_LIMIT} calls today (${limitStatus.percentUsed.toFixed(1)}%). Requests will be blocked at ${DAILY_HARD_LIMIT}. Consider if all current API calls are necessary.`,
          }).catch(() => {});
        }
      }
    } catch (error) {
      if (error instanceof AirDNARateLimitError) throw error;
      // Rate limit check itself failed - log but continue (fail open for DB errors)
      console.warn('[AirDNA-RateLimit] Rate limit check failed, continuing:', error);
    }
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

      // Log successful call
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
  };
}

export { AIRDNA_API_BASE, DAILY_HARD_LIMIT, PER_MINUTE_LIMIT };
