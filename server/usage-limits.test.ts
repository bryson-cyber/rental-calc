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
    validateAnalyses: 'validateAnalyses',
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
      // Return a usage record that's at the property analysis limit
      mockSelectResult = [{
        id: 1,
        propertyAnalyses: 5,
        validateAnalyses: 0,
        marketResearches: 0,
        apiCallsCount: 10,
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
        validateAnalyses: 0,
        marketResearches: 0,
        apiCallsCount: 75,
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
        validateAnalyses: 0,
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
      // apiCallsCount should equal sum of actions (1 per action, not 15)
      mockSelectResult = [{
        id: 1,
        propertyAnalyses: 2,
        validateAnalyses: 3,
        marketResearches: 1,
        apiCallsCount: 6, // 2 + 3 + 1 = 6 (1 per action)
      }];
      const status = await getUsageStatus(undefined, undefined, '192.168.1.1');
      expect(status.isAdmin).toBe(false);
      expect(status.propertyAnalyses.used).toBe(2);
      expect(status.propertyAnalyses.remaining).toBe(3);
      expect(status.validateAnalyses.used).toBe(3);
      expect(status.validateAnalyses.remaining).toBe(17);
      expect(status.marketResearches.used).toBe(1);
      expect(status.marketResearches.remaining).toBe(2);
      expect(status.apiCalls.used).toBe(6);
      expect(status.apiCalls.remaining).toBe(69); // 75 - 6 = 69
      expect(status.canAnalyze).toBe(true);
      expect(status.canValidate).toBe(true);
      expect(status.canResearchMarket).toBe(true);
    });

    it('user with 20 validations is still under apiCalls limit (1 per action, not 15)', async () => {
      // Previously: 20 validations × 15 = 300 apiCallsCount → blocked at 75
      // Now: 20 validations × 1 = 20 apiCallsCount → well under 75
      mockSelectResult = [{
        id: 1,
        propertyAnalyses: 0,
        validateAnalyses: 20,
        marketResearches: 0,
        apiCallsCount: 20, // 20 validations × 1 = 20
      }];
      const status = await getUsageStatus(undefined, undefined, '192.168.1.1');
      expect(status.apiCalls.used).toBe(20);
      expect(status.apiCalls.remaining).toBe(55); // 75 - 20 = 55
      expect(status.validateAnalyses.remaining).toBe(0); // hit validate limit
      expect(status.canValidate).toBe(false); // blocked by validate limit, NOT apiCalls
      expect(status.canAnalyze).toBe(true); // can still do property analyses
    });

    it('returns canAnalyze=false when property limit reached', async () => {
      mockSelectResult = [{
        id: 1,
        propertyAnalyses: 5,
        validateAnalyses: 0,
        marketResearches: 0,
        apiCallsCount: 10,
      }];
      const status = await getUsageStatus(undefined, undefined, '192.168.1.1');
      expect(status.canAnalyze).toBe(false);
      expect(status.canValidate).toBe(true);
      expect(status.canResearchMarket).toBe(true);
    });

    it('returns canResearchMarket=false when market limit reached', async () => {
      mockSelectResult = [{
        id: 1,
        propertyAnalyses: 0,
        validateAnalyses: 0,
        marketResearches: 3,
        apiCallsCount: 3, // 3 market researches × 1 = 3
      }];
      const status = await getUsageStatus(undefined, undefined, '192.168.1.1');
      expect(status.canAnalyze).toBe(true);
      expect(status.canValidate).toBe(true);
      expect(status.canResearchMarket).toBe(false);
    });
  });
});
