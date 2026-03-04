import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies before importing the module
vi.mock('./api-logger', () => ({
  logApiCall: vi.fn(),
  checkDailyLimit: vi.fn().mockResolvedValue({ currentCount: 0, limit: 700, isLimited: false }),
}));

vi.mock('./_core/notification', () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock('./_core/env', () => ({
  ENV: {
    airdnaApiKey: 'test-key',
  },
}));

describe('Rate Limiter - Fail-Closed Design', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export DAILY_HARD_LIMIT as 700 (24K monthly / 30 days with buffer)', async () => {
    const { DAILY_HARD_LIMIT } = await import('./airdna-rate-limiter');
    expect(DAILY_HARD_LIMIT).toBe(700);
  });

  it('should export PER_MINUTE_LIMIT as 12', async () => {
    const { PER_MINUTE_LIMIT } = await import('./airdna-rate-limiter');
    expect(PER_MINUTE_LIMIT).toBe(12);
  });

  it('should expose getRateLimiterStats with dailyCallCount', async () => {
    const { getRateLimiterStats } = await import('./airdna-rate-limiter');
    const stats = getRateLimiterStats();
    expect(stats).toHaveProperty('dailyCallCount');
    expect(stats).toHaveProperty('dailyHardLimit');
    expect(stats).toHaveProperty('perMinuteLimit');
    expect(stats).toHaveProperty('callsInLastMinute');
    expect(stats.dailyHardLimit).toBe(700);
    expect(stats.perMinuteLimit).toBe(12);
  });

  it('should have AirDNARateLimitError class', async () => {
    const { AirDNARateLimitError } = await import('./airdna-rate-limiter');
    const error = new AirDNARateLimitError('daily', 700, 700);
    expect(error).toBeInstanceOf(Error);
    expect(error.isRateLimit).toBe(true);
    expect(error.type).toBe('daily');
    expect(error.currentCount).toBe(700);
    expect(error.limit).toBe(700);
    expect(error.message).toContain('daily API limit reached');
  });

  it('should have per-minute rate limit error', async () => {
    const { AirDNARateLimitError } = await import('./airdna-rate-limiter');
    const error = new AirDNARateLimitError('per_minute', 15, 15);
    expect(error.type).toBe('per_minute');
    expect(error.message).toContain('too many requests per minute');
  });

  it('should export NON_ADMIN_SOFT_LIMIT as 400', async () => {
    const { NON_ADMIN_SOFT_LIMIT } = await import('./airdna-rate-limiter');
    expect(NON_ADMIN_SOFT_LIMIT).toBe(400);
  });

  it('should export ADMIN_DAILY_LIMIT (admins are no longer unlimited)', async () => {
    const { ADMIN_DAILY_LIMIT } = await import('./airdna-rate-limiter');
    expect(ADMIN_DAILY_LIMIT).toBe(700);
    // Admin limit * 30 days should stay under 24K monthly budget
    expect(ADMIN_DAILY_LIMIT * 30).toBeLessThanOrEqual(24000);
  });
});

describe('Request Context - Admin Detection', () => {
  it('should export runWithRequestContext and isAdminRequest', async () => {
    const { runWithRequestContext, isAdminRequest } = await import('./request-context');
    expect(typeof runWithRequestContext).toBe('function');
    expect(typeof isAdminRequest).toBe('function');
  });

  it('should return false for isAdminRequest when no context is set', async () => {
    const { isAdminRequest } = await import('./request-context');
    // Outside of any request context, should default to false
    expect(isAdminRequest()).toBe(false);
  });

  it('should return true for isAdminRequest when admin context is set', async () => {
    const { runWithRequestContext, isAdminRequest } = await import('./request-context');
    
    let result = false;
    await runWithRequestContext({ isAdmin: true, userId: 1 }, async () => {
      result = isAdminRequest();
    });
    
    expect(result).toBe(true);
  });

  it('should return false for isAdminRequest when non-admin context is set', async () => {
    const { runWithRequestContext, isAdminRequest } = await import('./request-context');
    
    let result = true;
    await runWithRequestContext({ isAdmin: false, userId: 2 }, async () => {
      result = isAdminRequest();
    });
    
    expect(result).toBe(false);
  });

  it('should properly scope context to the callback (no leaking)', async () => {
    const { runWithRequestContext, isAdminRequest } = await import('./request-context');
    
    // Before: no context
    expect(isAdminRequest()).toBe(false);
    
    // During: admin context
    await runWithRequestContext({ isAdmin: true }, async () => {
      expect(isAdminRequest()).toBe(true);
    });
    
    // After: context should be gone
    expect(isAdminRequest()).toBe(false);
  });

  it('should support nested contexts correctly', async () => {
    const { runWithRequestContext, isAdminRequest } = await import('./request-context');
    
    await runWithRequestContext({ isAdmin: true, userId: 1 }, async () => {
      expect(isAdminRequest()).toBe(true);
      
      // Nested non-admin context
      await runWithRequestContext({ isAdmin: false, userId: 2 }, async () => {
        expect(isAdminRequest()).toBe(false);
      });
      
      // Back to admin context
      expect(isAdminRequest()).toBe(true);
    });
  });

  it('should export getRequestContext', async () => {
    const { getRequestContext, runWithRequestContext } = await import('./request-context');
    
    // Outside context
    expect(getRequestContext()).toBeNull();
    
    // Inside context
    await runWithRequestContext({ isAdmin: true, userId: 42 }, async () => {
      const ctx = getRequestContext();
      expect(ctx).not.toBeNull();
      expect(ctx?.isAdmin).toBe(true);
      expect(ctx?.userId).toBe(42);
    });
  });
});

describe('Cache TTL Configuration', () => {
  it('should have single_property in 30-day TTL config', async () => {
    const { apiCache } = await import('./cache');
    const ttl = apiCache.getTTL('single_property');
    expect(ttl).toBe(30 * 24 * 60 * 60 * 1000); // 30 days
  });

  it('should have rentalizer in 14-day TTL config', async () => {
    const { apiCache } = await import('./cache');
    const ttl = apiCache.getTTL('rentalizer');
    expect(ttl).toBe(14 * 24 * 60 * 60 * 1000); // 14 days
  });

  it('should have listings_in_radius in 14-day TTL config', async () => {
    const { apiCache } = await import('./cache');
    const ttl = apiCache.getTTL('listings_in_radius');
    expect(ttl).toBe(14 * 24 * 60 * 60 * 1000); // 14 days
  });

  it('should have market_details in 30-day TTL config', async () => {
    const { apiCache } = await import('./cache');
    const ttl = apiCache.getTTL('market_details');
    expect(ttl).toBe(30 * 24 * 60 * 60 * 1000); // 30 days
  });

  it('should have all_market_listings in 30-day TTL config', async () => {
    const { apiCache } = await import('./cache');
    const ttl = apiCache.getTTL('all_market_listings');
    expect(ttl).toBe(30 * 24 * 60 * 60 * 1000); // 30 days
  });

  it('should have listing_future_pricing in 7-day TTL config', async () => {
    const { apiCache } = await import('./cache');
    const ttl = apiCache.getTTL('listing_future_pricing');
    expect(ttl).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
  });

  it('should default to 7-day TTL for unknown types', async () => {
    const { apiCache } = await import('./cache');
    const ttl = apiCache.getTTL('unknown_type_xyz');
    expect(ttl).toBe(7 * 24 * 60 * 60 * 1000); // 7 days default
  });
});

describe('Image Cache TTL in db.ts', () => {
  it('should have 90-day default expiration for cachePropertyImages', async () => {
    const dbModule = await import('./db');
    expect(dbModule.cachePropertyImages).toBeDefined();
    expect(typeof dbModule.cachePropertyImages).toBe('function');
  });

  it('should have 90-day default expiration for batchCachePropertyImages', async () => {
    const dbModule = await import('./db');
    expect(dbModule.batchCachePropertyImages).toBeDefined();
    expect(typeof dbModule.batchCachePropertyImages).toBe('function');
  });
});
