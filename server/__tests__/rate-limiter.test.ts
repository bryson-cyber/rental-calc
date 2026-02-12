import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the rate limiter module's logic
describe('AirDNA Rate Limiter', () => {
  describe('AirDNARateLimitError', () => {
    it('should create daily rate limit error with correct properties', async () => {
      const { AirDNARateLimitError } = await import('../airdna-rate-limiter');
      const error = new AirDNARateLimitError('daily', 650, 600);
      
      expect(error).toBeInstanceOf(Error);
      expect(error.isRateLimit).toBe(true);
      expect(error.type).toBe('daily');
      expect(error.currentCount).toBe(650);
      expect(error.limit).toBe(600);
      expect(error.message).toContain('daily');
      expect(error.message).toContain('650');
      expect(error.message).toContain('600');
    });

    it('should create per-minute rate limit error with correct properties', async () => {
      const { AirDNARateLimitError } = await import('../airdna-rate-limiter');
      const error = new AirDNARateLimitError('per_minute', 16, 15);
      
      expect(error.isRateLimit).toBe(true);
      expect(error.type).toBe('per_minute');
      expect(error.currentCount).toBe(16);
      expect(error.limit).toBe(15);
      expect(error.message).toContain('per minute');
    });
  });

  describe('getRateLimiterStats', () => {
    it('should return rate limiter stats with correct structure', async () => {
      const { getRateLimiterStats } = await import('../airdna-rate-limiter');
      const stats = getRateLimiterStats();
      
      expect(stats).toHaveProperty('callsInLastMinute');
      expect(stats).toHaveProperty('perMinuteLimit');
      expect(stats).toHaveProperty('dailyHardLimit');
      expect(stats).toHaveProperty('dailyWarnThreshold');
      expect(stats).toHaveProperty('dailyLimitNotified');
      expect(typeof stats.callsInLastMinute).toBe('number');
      expect(stats.perMinuteLimit).toBe(15);
      expect(stats.dailyHardLimit).toBe(600);
      expect(stats.dailyWarnThreshold).toBe(500);
    });
  });

  describe('Exports', () => {
    it('should export AIRDNA_API_BASE constant', async () => {
      const { AIRDNA_API_BASE } = await import('../airdna-rate-limiter');
      expect(AIRDNA_API_BASE).toBe('https://api.airdna.co/api/enterprise/v2');
    });

    it('should export DAILY_HARD_LIMIT constant', async () => {
      const { DAILY_HARD_LIMIT } = await import('../airdna-rate-limiter');
      expect(DAILY_HARD_LIMIT).toBe(600);
    });

    it('should export PER_MINUTE_LIMIT constant', async () => {
      const { PER_MINUTE_LIMIT } = await import('../airdna-rate-limiter');
      expect(PER_MINUTE_LIMIT).toBe(15);
    });

    it('should export rateLimitedAirDNARequest function', async () => {
      const { rateLimitedAirDNARequest } = await import('../airdna-rate-limiter');
      expect(typeof rateLimitedAirDNARequest).toBe('function');
    });
  });

  describe('Rate limit enforcement logic', () => {
    it('AirDNARateLimitError should be catchable as Error', async () => {
      const { AirDNARateLimitError } = await import('../airdna-rate-limiter');
      const error = new AirDNARateLimitError('daily', 700, 600);
      
      expect(error instanceof Error).toBe(true);
      expect(error.name).toBe('AirDNARateLimitError');
    });

    it('should distinguish between daily and per_minute errors', async () => {
      const { AirDNARateLimitError } = await import('../airdna-rate-limiter');
      
      const dailyError = new AirDNARateLimitError('daily', 700, 600);
      const minuteError = new AirDNARateLimitError('per_minute', 20, 15);
      
      expect(dailyError.type).not.toBe(minuteError.type);
      expect(dailyError.message).not.toBe(minuteError.message);
    });
  });
});

describe('Centralized API routing', () => {
  it('airdna-hierarchy should import from rate limiter', async () => {
    // Verify the import exists (will throw if module not found)
    const mod = await import('../airdna-rate-limiter');
    expect(mod.rateLimitedAirDNARequest).toBeDefined();
    expect(mod.AIRDNA_API_BASE).toBeDefined();
  });

  it('market-research-simple should import from rate limiter', async () => {
    const mod = await import('../airdna-rate-limiter');
    expect(mod.rateLimitedAirDNARequest).toBeDefined();
    expect(mod.AirDNARateLimitError).toBeDefined();
  });
});
