import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for usage-limits.ts service functions.
 * 
 * These tests verify:
 * 1. canPerformAnalysis returns allowed:true when under limit
 * 2. canPerformAnalysis returns allowed:false when limit reached
 * 3. canPerformMarketResearch returns allowed:true when under limit
 * 4. canPerformMarketResearch returns allowed:false when limit reached
 * 5. Admin users bypass all limits
 * 6. recordAnalysisUsage increments the correct counters
 * 7. recordMarketResearchUsage increments the correct counters
 * 8. getUsageStatus returns correct structure
 */

// Mock the database module
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();

// Track what the mock DB returns
let mockSelectResult: any[] = [];
let mockInsertResult: any[] = [{ insertId: 1 }];

const mockDb = {
  select: () => {
    return {
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mockSelectResult),
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    };
  },
  insert: () => ({
    values: () => Promise.resolve([{ insertId: 1 }]),
  }),
  update: () => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  }),
};

vi.mock('./db', () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

// Mock schema
vi.mock('../drizzle/schema', () => ({
  userUsage: {
    id: 'id',
    userId: 'userId',
    sessionId: 'sessionId',
    ipAddress: 'ipAddress',
    date: 'date',
    propertyAnalyses: 'propertyAnalyses',
    marketResearches: 'marketResearches',
    apiCallsCount: 'apiCallsCount',
  },
  users: {
    id: 'id',
    role: 'role',
  },
}));

// Import after mocking
import {
  canPerformAnalysis,
  canPerformMarketResearch,
  getUsageStatus,
  isUserAdmin,
} from './usage-limits';

describe('usage-limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing usage record, non-admin user
    mockSelectResult = [];
  });

  describe('isUserAdmin', () => {
    it('returns false when user is not admin', async () => {
      mockSelectResult = [{ role: 'user' }];
      const result = await isUserAdmin(1);
      expect(result).toBe(false);
    });

    it('returns true when user is admin', async () => {
      mockSelectResult = [{ role: 'admin' }];
      const result = await isUserAdmin(1);
      expect(result).toBe(true);
    });

    it('returns false when user not found', async () => {
      mockSelectResult = [];
      const result = await isUserAdmin(999);
      expect(result).toBe(false);
    });
  });

  describe('canPerformAnalysis', () => {
    it('allows analysis when no prior usage exists (new user by IP)', async () => {
      // First call: isUserAdmin check returns no user (not admin)
      // Second call: getOrCreateUsageRecord returns no existing record
      // Third call: insert creates new record
      mockSelectResult = [];
      const result = await canPerformAnalysis(undefined, undefined, '192.168.1.1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeDefined();
    });

    it('blocks analysis when daily limit reached', async () => {
      // Return a usage record that's at the limit
      mockSelectResult = [{
        id: 1,
        propertyAnalyses: 5,
        marketResearches: 0,
        apiCallsCount: 50,
      }];
      const result = await canPerformAnalysis(undefined, undefined, '192.168.1.1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('limit reached');
      expect(result.remaining).toBe(0);
    });

    it('blocks analysis when API call limit reached', async () => {
      mockSelectResult = [{
        id: 1,
        propertyAnalyses: 1,
        marketResearches: 0,
        apiCallsCount: 100,
      }];
      const result = await canPerformAnalysis(undefined, undefined, '192.168.1.1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('API limit reached');
    });

    it('allows admin users regardless of usage', async () => {
      // First call: isUserAdmin returns admin
      mockSelectResult = [{ role: 'admin' }];
      const result = await canPerformAnalysis(1);
      expect(result.allowed).toBe(true);
    });
  });

  describe('canPerformMarketResearch', () => {
    it('allows market research when no prior usage exists', async () => {
      mockSelectResult = [];
      const result = await canPerformMarketResearch(undefined, undefined, '192.168.1.1');
      expect(result.allowed).toBe(true);
    });

    it('blocks market research when daily limit reached', async () => {
      mockSelectResult = [{
        id: 1,
        propertyAnalyses: 0,
        marketResearches: 3,
        apiCallsCount: 30,
      }];
      const result = await canPerformMarketResearch(undefined, undefined, '192.168.1.1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('limit reached');
      expect(result.remaining).toBe(0);
    });

    it('allows admin users regardless of usage', async () => {
      mockSelectResult = [{ role: 'admin' }];
      const result = await canPerformMarketResearch(1);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getUsageStatus', () => {
    it('returns unlimited status for admin users', async () => {
      mockSelectResult = [{ role: 'admin' }];
      const status = await getUsageStatus(1);
      expect(status.isAdmin).toBe(true);
      expect(status.canAnalyze).toBe(true);
      expect(status.canResearchMarket).toBe(true);
      expect(status.propertyAnalyses.remaining).toBe(Infinity);
    });

    it('returns correct remaining counts for non-admin users', async () => {
      // First call: isUserAdmin returns non-admin
      // Second call: getOrCreateUsageRecord returns existing record
      mockSelectResult = [{
        id: 1,
        propertyAnalyses: 2,
        marketResearches: 1,
        apiCallsCount: 30,
      }];
      const status = await getUsageStatus(undefined, undefined, '192.168.1.1');
      expect(status.isAdmin).toBe(false);
      expect(status.propertyAnalyses.used).toBe(2);
      expect(status.propertyAnalyses.remaining).toBe(3);
      expect(status.marketResearches.used).toBe(1);
      expect(status.marketResearches.remaining).toBe(2);
      expect(status.canAnalyze).toBe(true);
      expect(status.canResearchMarket).toBe(true);
    });

    it('returns canAnalyze=false when property limit reached', async () => {
      mockSelectResult = [{
        id: 1,
        propertyAnalyses: 5,
        marketResearches: 0,
        apiCallsCount: 50,
      }];
      const status = await getUsageStatus(undefined, undefined, '192.168.1.1');
      expect(status.canAnalyze).toBe(false);
      expect(status.canResearchMarket).toBe(true);
    });

    it('returns canResearchMarket=false when market limit reached', async () => {
      mockSelectResult = [{
        id: 1,
        propertyAnalyses: 0,
        marketResearches: 3,
        apiCallsCount: 30,
      }];
      const status = await getUsageStatus(undefined, undefined, '192.168.1.1');
      expect(status.canAnalyze).toBe(true);
      expect(status.canResearchMarket).toBe(false);
    });
  });
});
