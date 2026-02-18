/**
 * Usage Limit Enforcement Tests
 * 
 * Verifies that canPerformAnalysis / canPerformMarketResearch checks
 * are present in all key procedures that consume API credits.
 * 
 * These are structural tests — they verify the source code contains
 * the limit checks, ensuring no procedure can bypass rate limiting.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SERVER_DIR = path.resolve(__dirname, '..');
const ROUTERS_DIR = path.resolve(SERVER_DIR, 'routers');

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

describe('Usage Limit Enforcement', () => {
  describe('opportunity-finder.ts', () => {
    const src = readFile(path.join(SERVER_DIR, 'opportunity-finder.ts'));

    it('should import canPerformAnalysis', () => {
      expect(src).toContain('canPerformAnalysis');
    });

    it('should enforce limits on searchZillowRentals', () => {
      // Find the searchZillowRentals procedure and verify it has canPerformAnalysis
      const searchRentalsIdx = src.indexOf('searchZillowRentals:');
      expect(searchRentalsIdx).toBeGreaterThan(-1);
      
      // Find the next procedure after searchZillowRentals
      const nextProcIdx = src.indexOf('searchZillowForSale:', searchRentalsIdx);
      const section = src.substring(searchRentalsIdx, nextProcIdx);
      
      expect(section).toContain('canPerformAnalysis');
      expect(section).toContain('TOO_MANY_REQUESTS');
    });

    it('should enforce limits on searchZillowForSale', () => {
      const searchForSaleIdx = src.indexOf('searchZillowForSale:');
      expect(searchForSaleIdx).toBeGreaterThan(-1);
      
      const nextProcIdx = src.indexOf('validateProperty:', searchForSaleIdx);
      const section = src.substring(searchForSaleIdx, nextProcIdx);
      
      expect(section).toContain('canPerformAnalysis');
      expect(section).toContain('TOO_MANY_REQUESTS');
    });

    it('should enforce limits on validateProperty', () => {
      const validateIdx = src.indexOf('validateProperty:');
      expect(validateIdx).toBeGreaterThan(-1);
      
      const nextProcIdx = src.indexOf('batchValidateProperties:', validateIdx);
      const section = src.substring(validateIdx, nextProcIdx);
      
      expect(section).toContain('canPerformAnalysis');
      expect(section).toContain('limitReached');
    });

    it('should enforce limits on batchValidateProperties', () => {
      const batchIdx = src.indexOf('batchValidateProperties:');
      expect(batchIdx).toBeGreaterThan(-1);
      
      // Get the section from batchValidateProperties to end of file (it's the last procedure)
      const section = src.substring(batchIdx, batchIdx + 2000);
      
      expect(section).toContain('canPerformAnalysis');
      expect(section).toContain('TOO_MANY_REQUESTS');
    });

    it('should record usage after successful operations', () => {
      expect(src).toContain('recordAnalysisUsage');
    });
  });

  describe('market-research-simple.ts', () => {
    const src = readFile(path.join(SERVER_DIR, 'market-research-simple.ts'));

    it('should import canPerformMarketResearch', () => {
      expect(src).toContain('canPerformMarketResearch');
    });

    it('should enforce limits on getMarketReport', () => {
      const reportIdx = src.indexOf('getMarketReport:');
      expect(reportIdx).toBeGreaterThan(-1);
      
      const nextProcIdx = src.indexOf('getMarketReportByLocation:', reportIdx);
      const section = src.substring(reportIdx, nextProcIdx);
      
      expect(section).toContain('canPerformMarketResearch');
      expect(section).toContain('TOO_MANY_REQUESTS');
    });

    it('should enforce limits on getMarketReportByLocation', () => {
      const reportByLocIdx = src.indexOf('getMarketReportByLocation:');
      expect(reportByLocIdx).toBeGreaterThan(-1);
      
      const nextProcIdx = src.indexOf('getSubmarketReport:', reportByLocIdx);
      const section = src.substring(reportByLocIdx, nextProcIdx);
      
      expect(section).toContain('canPerformMarketResearch');
      expect(section).toContain('TOO_MANY_REQUESTS');
    });

    it('should enforce limits on getSubmarketReport', () => {
      const subIdx = src.indexOf('getSubmarketReport:');
      expect(subIdx).toBeGreaterThan(-1);
      
      const nextProcIdx = src.indexOf('getSubmarkets:', subIdx);
      const section = src.substring(subIdx, nextProcIdx);
      
      expect(section).toContain('canPerformMarketResearch');
      expect(section).toContain('TOO_MANY_REQUESTS');
    });

    it('should record usage after successful operations', () => {
      expect(src).toContain('recordMarketResearchUsage');
    });
  });

  describe('routers/deep-analysis.ts', () => {
    const src = readFile(path.join(ROUTERS_DIR, 'deep-analysis.ts'));

    it('should import canPerformAnalysis', () => {
      expect(src).toContain('canPerformAnalysis');
    });

    it('should enforce limits on start procedure', () => {
      const startIdx = src.indexOf('start:');
      expect(startIdx).toBeGreaterThan(-1);
      
      const section = src.substring(startIdx, startIdx + 2000);
      
      expect(section).toContain('canPerformAnalysis');
      expect(section).toContain('limitReached');
    });

    it('should record usage after successful deep analysis', () => {
      expect(src).toContain('recordAnalysisUsage');
    });
  });

  describe('routers/rental.ts', () => {
    const src = readFile(path.join(ROUTERS_DIR, 'rental.ts'));

    it('should import canPerformAnalysis and canPerformMarketResearch', () => {
      expect(src).toContain('canPerformAnalysis');
      expect(src).toContain('canPerformMarketResearch');
    });

    it('should enforce limits on getPropertyReport', () => {
      const reportIdx = src.indexOf('getPropertyReport:');
      expect(reportIdx).toBeGreaterThan(-1);
      
      // Find the section up to the next procedure
      const section = src.substring(reportIdx, reportIdx + 3000);
      
      expect(section).toContain('canPerformAnalysis');
    });
  });

  describe('routers/advanced.ts', () => {
    const src = readFile(path.join(ROUTERS_DIR, 'advanced.ts'));

    it('should import canPerformAnalysis', () => {
      expect(src).toContain('canPerformAnalysis');
    });

    it('should enforce limits on analyzeProperty', () => {
      const analyzeIdx = src.indexOf('analyzeProperty:');
      expect(analyzeIdx).toBeGreaterThan(-1);
      
      const section = src.substring(analyzeIdx, analyzeIdx + 3000);
      
      expect(section).toContain('canPerformAnalysis');
    });
  });

  describe('routers/shared-reports.ts', () => {
    const src = readFile(path.join(ROUTERS_DIR, 'shared-reports.ts'));

    it('should import canPerformAnalysis', () => {
      expect(src).toContain('canPerformAnalysis');
    });

    it('should enforce limits on generateFromAddress', () => {
      const genIdx = src.indexOf('generateFromAddress:');
      expect(genIdx).toBeGreaterThan(-1);
      
      const section = src.substring(genIdx, genIdx + 3000);
      
      expect(section).toContain('canPerformAnalysis');
    });
  });

  describe('usage-limits.ts core functions', () => {
    it('should export canPerformAnalysis', async () => {
      const mod = await import('../usage-limits');
      expect(typeof mod.canPerformAnalysis).toBe('function');
    });

    it('should export canPerformMarketResearch', async () => {
      const mod = await import('../usage-limits');
      expect(typeof mod.canPerformMarketResearch).toBe('function');
    });

    it('should export recordAnalysisUsage', async () => {
      const mod = await import('../usage-limits');
      expect(typeof mod.recordAnalysisUsage).toBe('function');
    });

    it('should export recordMarketResearchUsage', async () => {
      const mod = await import('../usage-limits');
      expect(typeof mod.recordMarketResearchUsage).toBe('function');
    });

    it('should have correct default limits', async () => {
      // The default limits are 5 analyses/day, 3 market researches/day, 50 API calls/day
      const src = readFile(path.join(SERVER_DIR, 'usage-limits.ts'));
      expect(src).toContain('propertyAnalyses: 5');
      expect(src).toContain('marketResearches: 3');
      expect(src).toContain('apiCalls: 50');
    });

    it('should bypass limits for admin users', async () => {
      const src = readFile(path.join(SERVER_DIR, 'usage-limits.ts'));
      expect(src).toContain("isAdmin: true");
      expect(src).toContain("canAnalyze: true");
      expect(src).toContain("canResearchMarket: true");
    });
  });

  describe('comprehensive coverage check', () => {
    it('every file with recordAnalysisUsage should also have canPerformAnalysis', () => {
      const files = [
        path.join(SERVER_DIR, 'opportunity-finder.ts'),
        path.join(ROUTERS_DIR, 'rental.ts'),
        path.join(ROUTERS_DIR, 'advanced.ts'),
        path.join(ROUTERS_DIR, 'shared-reports.ts'),
        path.join(ROUTERS_DIR, 'deep-analysis.ts'),
      ];

      for (const file of files) {
        const src = readFile(file);
        if (src.includes('recordAnalysisUsage')) {
          expect(src).toContain('canPerformAnalysis');
        }
      }
    });

    it('every file with recordMarketResearchUsage should also have canPerformMarketResearch', () => {
      const files = [
        path.join(SERVER_DIR, 'market-research-simple.ts'),
        path.join(ROUTERS_DIR, 'rental.ts'),
      ];

      for (const file of files) {
        const src = readFile(file);
        if (src.includes('recordMarketResearchUsage')) {
          expect(src).toContain('canPerformMarketResearch');
        }
      }
    });
  });
});
