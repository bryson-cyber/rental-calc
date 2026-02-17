/**
 * Deep Analysis API Tests
 * 
 * Tests the deep analysis endpoints for:
 * - Starting deep analysis for a report
 * - Getting deep analysis status and results
 * - Error handling for invalid report IDs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('../db', () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }),
}));

// Mock the ENV
vi.mock('../_core/env', () => ({
  ENV: {
    anthropicApiKey: 'test-anthropic-key',
  },
}));

describe('Deep Analysis Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startDeepAnalysis', () => {
    it('should create a new deep analysis record when none exists', async () => {
      const { getDb } = await import('../db');
      const mockDb = await getDb();
      
      // Mock: report exists, no existing deep analysis
      (mockDb!.limit as any).mockResolvedValueOnce([{ id: 1, address: '123 Test St' }]); // Report exists
      (mockDb!.limit as any).mockResolvedValueOnce([]); // No existing deep analysis
      
      const { startDeepAnalysis } = await import('../deep-analysis');
      const result = await startDeepAnalysis(1);
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status');
    });

    it('should return existing deep analysis if already started', async () => {
      const { getDb } = await import('../db');
      const mockDb = await getDb();
      
      // Mock: report exists, deep analysis already exists
      (mockDb!.limit as any).mockResolvedValueOnce([{ id: 1, address: '123 Test St' }]); // Report exists
      (mockDb!.limit as any).mockResolvedValueOnce([{ id: 5, reportId: 1, status: 'processing' }]); // Existing deep analysis
      
      const { startDeepAnalysis } = await import('../deep-analysis');
      const result = await startDeepAnalysis(1);
      
      expect(result.id).toBe(5);
      expect(result.status).toBe('processing');
    });

    it('should throw error if report does not exist', async () => {
      const { getDb } = await import('../db');
      const mockDb = await getDb();
      
      // Mock: report does not exist
      (mockDb!.limit as any).mockResolvedValueOnce([]); // No report
      
      const { startDeepAnalysis } = await import('../deep-analysis');
      
      await expect(startDeepAnalysis(999)).rejects.toThrow('Report 999 not found');
    });
  });

  describe('getDeepAnalysis', () => {
    it('should return not_started status when no analysis exists', async () => {
      const { getDb } = await import('../db');
      const mockDb = await getDb();
      
      // Mock: no deep analysis exists
      (mockDb!.limit as any).mockResolvedValueOnce([]);
      
      const { getDeepAnalysis } = await import('../deep-analysis');
      const result = await getDeepAnalysis(1);
      
      expect(result.status).toBe('not_started');
      expect(result.result).toBeNull();
    });

    it('should return completed status with results when analysis is done', async () => {
      const { getDb } = await import('../db');
      const mockDb = await getDb();
      
      const mockResult = {
        id: 1,
        reportId: 1,
        status: 'completed',
        historicalContext: { summary: 'Test summary' },
        investmentThesis: { summary: 'Test thesis' },
        riskNarrative: { overallRisk: 'low' },
        pricingStrategy: { baseRate: 150 },
        competitorPhotoAnalysis: null,
        executiveSummaryEnhanced: 'Enhanced summary',
        marketNarrative: 'Market narrative',
        actionPlan: { phases: [] },
        processingTimeMs: 5000,
        errorMessage: null,
      };
      
      // Mock: deep analysis exists and is completed
      (mockDb!.limit as any).mockResolvedValueOnce([mockResult]);
      
      const { getDeepAnalysis } = await import('../deep-analysis');
      const result = await getDeepAnalysis(1);
      
      expect(result.status).toBe('completed');
      expect(result.result).not.toBeNull();
      expect(result.result?.historicalContext).toEqual({ summary: 'Test summary' });
      expect(result.processingTimeMs).toBe(5000);
    });

    it('should return processing status when analysis is in progress', async () => {
      const { getDb } = await import('../db');
      const mockDb = await getDb();
      
      // Mock: deep analysis is processing
      (mockDb!.limit as any).mockResolvedValueOnce([{
        id: 1,
        reportId: 1,
        status: 'processing',
        errorMessage: null,
        processingTimeMs: null,
      }]);
      
      const { getDeepAnalysis } = await import('../deep-analysis');
      const result = await getDeepAnalysis(1);
      
      expect(result.status).toBe('processing');
      expect(result.result).toBeNull();
    });

    it('should return failed status with error message', async () => {
      const { getDb } = await import('../db');
      const mockDb = await getDb();
      
      // Mock: deep analysis failed
      (mockDb!.limit as any).mockResolvedValueOnce([{
        id: 1,
        reportId: 1,
        status: 'failed',
        errorMessage: 'AI provider timeout',
        processingTimeMs: 30000,
      }]);
      
      const { getDeepAnalysis } = await import('../deep-analysis');
      const result = await getDeepAnalysis(1);
      
      expect(result.status).toBe('failed');
      expect(result.error).toBe('AI provider timeout');
    });
  });
});

describe('Deep Analysis Types', () => {
  it('should export correct type definitions', async () => {
    const types = await import('../deep-analysis');
    
    // Verify exported functions exist
    expect(typeof types.startDeepAnalysis).toBe('function');
    expect(typeof types.getDeepAnalysis).toBe('function');
  });
});
