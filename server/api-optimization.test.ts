import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('API Optimization Fixes', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Fix 1: Dead /rentalizer/comps endpoint removed', () => {
    it('getRentalizerComps should be a no-op stub that returns null', async () => {
      const airdna = await import('./airdna');
      // Function exists but is deprecated stub
      expect(typeof airdna.getRentalizerComps).toBe('function');
      // Calling it should return null without making any API call
      const result = await airdna.getRentalizerComps('123 Main St');
      expect(result).toBeNull();
    });

    it('opportunity-finder should use exploreListingsInRadius instead of getRentalizerComps for comps', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/opportunity-finder.ts', 'utf-8');
      // Should use the working endpoint function
      expect(content).toContain('exploreListingsInRadius');
    });

    it('sop-reports should use exploreListingsInRadius instead of getRentalizerComps for comps', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/sop-reports.ts', 'utf-8');
      // Should use the working endpoint function
      expect(content).toContain('exploreListingsInRadius');
    });

    it('no file should make actual API calls to /rentalizer/comps endpoint', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const serverDir = './server';
      const files = fs.readdirSync(serverDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
      
      for (const file of files) {
        const content = fs.readFileSync(path.join(serverDir, file), 'utf-8');
        // The only reference to /rentalizer/comps should be in the deprecated stub warning
        const matches = content.match(/\/rentalizer\/comps/g) || [];
        const nonCommentMatches = matches.filter(() => {
          // Check if the reference is in a makeApiRequest call (actual API call)
          return content.includes('makeApiRequest("/rentalizer/comps"');
        });
        expect(nonCommentMatches.length).toBe(0);
      }
    });
  });

  describe('Fix 2: In-flight request deduplication', () => {
    it('should have deduplication map in rate limiter', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/airdna-rate-limiter.ts', 'utf-8');
      expect(content).toContain('inFlightRequests');
      expect(content).toContain('getDedupeKey');
    });

    it('should reuse in-flight requests for same endpoint+body', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/airdna-rate-limiter.ts', 'utf-8');
      // Verify the deduplication logic exists
      expect(content).toContain('DEDUPE: reusing in-flight request');
      expect(content).toContain('inFlightRequests.get(dedupeKey)');
      expect(content).toContain('inFlightRequests.set(dedupeKey');
      expect(content).toContain('inFlightRequests.delete(dedupeKey)');
    });
  });

  describe('Fix 3: getSubmarketsInMarket caching', () => {
    it('should have cache check at the top of getSubmarketsInMarket', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/airdna.ts', 'utf-8');
      
      // Find the function and verify cache check exists before the main logic
      const funcStart = content.indexOf('export async function getSubmarketsInMarket');
      expect(funcStart).toBeGreaterThan(-1);
      
      const afterFunc = content.substring(funcStart, funcStart + 500);
      expect(afterFunc).toContain('submarkets_in_market');
      expect(afterFunc).toContain('CACHE HIT');
    });

    it('should cache results at the end of getSubmarketsInMarket', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/airdna.ts', 'utf-8');
      
      // Find the cache write near the return
      const funcStart = content.indexOf('export async function getSubmarketsInMarket');
      const funcEnd = content.indexOf('\nexport', funcStart + 1);
      const funcBody = content.substring(funcStart, funcEnd);
      
      expect(funcBody).toContain("apiCache.set(cacheKey, validSubmarkets, 'market_details')");
    });

    it('should have cache check in exploreSubmarketsWithMetrics', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/airdna.ts', 'utf-8');
      
      const funcStart = content.indexOf('export async function exploreSubmarketsWithMetrics');
      expect(funcStart).toBeGreaterThan(-1);
      
      // The cache check may be further into the function body (after parameter handling)
      const funcEnd = content.indexOf('\nexport', funcStart + 1);
      const funcBody = content.substring(funcStart, funcEnd > 0 ? funcEnd : funcStart + 3000);
      expect(funcBody).toContain('explore_submarkets');
      // Should have cache retrieval logic
      expect(funcBody).toContain('apiCache.get');
    });

    it('should cache results at the end of exploreSubmarketsWithMetrics', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/airdna.ts', 'utf-8');
      
      const funcStart = content.indexOf('export async function exploreSubmarketsWithMetrics');
      const funcEnd = content.indexOf('\n// Helper to get market metrics', funcStart);
      const funcBody = content.substring(funcStart, funcEnd);
      
      expect(funcBody).toContain("apiCache.set(cacheKey, result, 'market_details')");
    });
  });

  describe('Fix 5: Tightened rate limits', () => {
    it('should have admin daily limit (was previously unlimited)', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/airdna-rate-limiter.ts', 'utf-8');
      expect(content).toContain('ADMIN_DAILY_LIMIT');
      expect(content).toContain('ADMIN DAILY LIMIT EXCEEDED');
    });

    it('should block admin requests at ADMIN_DAILY_LIMIT', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/airdna-rate-limiter.ts', 'utf-8');
      expect(content).toContain('isAdmin && dailyCallCount >= ADMIN_DAILY_LIMIT');
      expect(content).toContain("throw new AirDNARateLimitError('daily', dailyCallCount, ADMIN_DAILY_LIMIT)");
    });

    it('should have monthly budget constants', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/airdna-rate-limiter.ts', 'utf-8');
      expect(content).toContain('MONTHLY_BUDGET');
      expect(content).toContain('24_000');
    });

    it('should have reduced daily limits to fit 24K monthly budget', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/airdna-rate-limiter.ts', 'utf-8');
      
      // Extract DAILY_HARD_LIMIT value
      const hardLimitMatch = content.match(/const DAILY_HARD_LIMIT = (\d+)/);
      expect(hardLimitMatch).not.toBeNull();
      const hardLimit = parseInt(hardLimitMatch![1]);
      
      // Extract NON_ADMIN_SOFT_LIMIT value
      const softLimitMatch = content.match(/const NON_ADMIN_SOFT_LIMIT = (\d+)/);
      expect(softLimitMatch).not.toBeNull();
      const softLimit = parseInt(softLimitMatch![1]);
      
      // Hard limit * 30 days should be under 24K monthly budget
      expect(hardLimit * 30).toBeLessThanOrEqual(24000);
      
      // Soft limit should be lower than hard limit
      expect(softLimit).toBeLessThan(hardLimit);
      
      // Admin limit should exist and be <= hard limit
      const adminLimitMatch = content.match(/const ADMIN_DAILY_LIMIT = (\d+)/);
      expect(adminLimitMatch).not.toBeNull();
      const adminLimit = parseInt(adminLimitMatch![1]);
      expect(adminLimit).toBeLessThanOrEqual(hardLimit);
    });

    it('should NOT have admin bypass for per-minute limits', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/airdna-rate-limiter.ts', 'utf-8');
      // The old "Admin bypassing per-minute limit" message should be gone
      expect(content).not.toContain('Admin bypassing per-minute limit');
    });

    it('should export rate limiter stats with new fields', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('./server/airdna-rate-limiter.ts', 'utf-8');
      expect(content).toContain('adminDailyLimit: ADMIN_DAILY_LIMIT');
      expect(content).toContain('monthlyBudget: MONTHLY_BUDGET');
    });
  });
});
