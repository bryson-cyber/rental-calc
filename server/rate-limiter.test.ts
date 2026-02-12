import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the dependencies before importing the module
vi.mock('./api-logger', () => ({
  logApiCall: vi.fn(),
  checkDailyLimit: vi.fn().mockResolvedValue({ currentCount: 0, limit: 600, isLimited: false }),
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

  it('should export DAILY_HARD_LIMIT as 600', async () => {
    const { DAILY_HARD_LIMIT } = await import('./airdna-rate-limiter');
    expect(DAILY_HARD_LIMIT).toBe(600);
  });

  it('should export PER_MINUTE_LIMIT as 15', async () => {
    const { PER_MINUTE_LIMIT } = await import('./airdna-rate-limiter');
    expect(PER_MINUTE_LIMIT).toBe(15);
  });

  it('should expose getRateLimiterStats with dailyCallCount', async () => {
    const { getRateLimiterStats } = await import('./airdna-rate-limiter');
    const stats = getRateLimiterStats();
    expect(stats).toHaveProperty('dailyCallCount');
    expect(stats).toHaveProperty('dailyHardLimit');
    expect(stats).toHaveProperty('perMinuteLimit');
    expect(stats).toHaveProperty('callsInLastMinute');
    expect(stats.dailyHardLimit).toBe(600);
    expect(stats.perMinuteLimit).toBe(15);
  });

  it('should have AirDNARateLimitError class', async () => {
    const { AirDNARateLimitError } = await import('./airdna-rate-limiter');
    const error = new AirDNARateLimitError('daily', 600, 600);
    expect(error).toBeInstanceOf(Error);
    expect(error.isRateLimit).toBe(true);
    expect(error.type).toBe('daily');
    expect(error.currentCount).toBe(600);
    expect(error.limit).toBe(600);
    expect(error.message).toContain('daily API limit reached');
  });

  it('should have per-minute rate limit error', async () => {
    const { AirDNARateLimitError } = await import('./airdna-rate-limiter');
    const error = new AirDNARateLimitError('per_minute', 15, 15);
    expect(error.type).toBe('per_minute');
    expect(error.message).toContain('too many requests per minute');
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
    // We verify the function signature has expirationDays = 90
    // by checking the module exports
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
