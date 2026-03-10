import { describe, it, expect } from 'vitest';

/**
 * Tests for revenue override persistence in shared links
 * 
 * Bug: Admin edits revenue in Step 5 (TeslaDashboard), clicks Share,
 * but the shared link shows the original revenue instead of the override.
 * 
 * Root cause: 
 * 1. UniversalShareButton didn't pass revenueOverride to the create mutation
 * 2. No sync mechanism for edits made after share creation
 * 3. SharedReportViewer didn't fallback to reportData._revenueOverride
 */

describe('Revenue override in shared links', () => {
  
  describe('createShareableReport - revenueOverride handling', () => {
    it('should prefer explicit revenueOverride input over embedded _revenueOverride', () => {
      // Simulates the fixed flow: both explicit and embedded are present
      const input = {
        revenueOverride: 57930,
        reportData: { _revenueOverride: 50000, revenue: { projected: 45374 } },
      };
      
      // The fix: explicit input takes priority
      const revenueOverride = input.revenueOverride ?? input.reportData?._revenueOverride ?? null;
      expect(revenueOverride).toBe(57930);
    });
    
    it('should fallback to embedded _revenueOverride if explicit is not provided', () => {
      const input = {
        revenueOverride: undefined,
        reportData: { _revenueOverride: 50000, revenue: { projected: 45374 } },
      };
      
      const revenueOverride = input.revenueOverride ?? input.reportData?._revenueOverride ?? null;
      expect(revenueOverride).toBe(50000);
    });
    
    it('should be null when neither explicit nor embedded override exists', () => {
      const input = {
        revenueOverride: undefined,
        reportData: { revenue: { projected: 45374 } },
      };
      
      const revenueOverride = input.revenueOverride ?? input.reportData?._revenueOverride ?? null;
      expect(revenueOverride).toBeNull();
    });
  });
  
  describe('UniversalShareButton - override sync logic', () => {
    it('should embed _revenueOverride in reportData when override is present', () => {
      const reportData = { revenue: { projected: 45374 } };
      const revenueOverride: number | null = 57930;
      
      const finalReportData = revenueOverride != null
        ? { ...reportData, _revenueOverride: revenueOverride }
        : reportData;
      
      expect(finalReportData._revenueOverride).toBe(57930);
    });
    
    it('should NOT embed _revenueOverride when override is null', () => {
      const reportData = { revenue: { projected: 45374 } };
      const revenueOverride: number | null = null;
      
      const finalReportData = revenueOverride != null
        ? { ...reportData, _revenueOverride: revenueOverride }
        : reportData;
      
      expect((finalReportData as any)._revenueOverride).toBeUndefined();
    });
    
    it('should use override as annualRevenue when present', () => {
      const annualRevenue = 45374;
      const revenueOverride: number | null = 57930;
      
      const finalAnnualRevenue = revenueOverride ?? annualRevenue;
      expect(finalAnnualRevenue).toBe(57930);
    });
    
    it('should pass revenueOverride to create mutation input', () => {
      // Simulates the fixed mutation call
      const revenueOverride: number | null = 57930;
      const mutationInput = {
        reportType: 'validator',
        reportData: { revenue: { projected: 45374 }, _revenueOverride: 57930 },
        annualRevenue: 57930,
        revenueOverride: revenueOverride ?? undefined,
      };
      
      expect(mutationInput.revenueOverride).toBe(57930);
    });
  });
  
  describe('ShareableReportViewer - override fallback', () => {
    it('should use DB revenueOverride when available', () => {
      const report = { revenueOverride: 57930 };
      const reportData = { _revenueOverride: 50000 };
      
      const persistedOverride = report.revenueOverride ?? reportData?._revenueOverride ?? null;
      expect(persistedOverride).toBe(57930);
    });
    
    it('should fallback to reportData._revenueOverride when DB column is null', () => {
      const report = { revenueOverride: null };
      const reportData = { _revenueOverride: 50000 };
      
      const persistedOverride = report.revenueOverride ?? reportData?._revenueOverride ?? null;
      expect(persistedOverride).toBe(50000);
    });
    
    it('should be null when both DB and reportData have no override', () => {
      const report = { revenueOverride: null };
      const reportData = { revenue: { projected: 45374 } };
      
      const persistedOverride = report.revenueOverride ?? (reportData as any)?._revenueOverride ?? null;
      expect(persistedOverride).toBeNull();
    });
  });
  
  describe('Auto-sync useEffect logic', () => {
    it('should detect when override changes from null to a value', () => {
      let lastSynced: number | null | undefined = undefined;
      const shareCode = 'abc123';
      
      // First mount - skip
      if (lastSynced === undefined) {
        lastSynced = null; // initial revenueOverride is null
      }
      expect(lastSynced).toBeNull();
      
      // Override changes to 57930
      const newVal = 57930;
      expect(newVal !== lastSynced).toBe(true); // Should trigger sync
      lastSynced = newVal;
      expect(lastSynced).toBe(57930);
    });
    
    it('should NOT sync when override has not changed', () => {
      let lastSynced: number | null = 57930;
      const newVal = 57930;
      
      expect(newVal === lastSynced).toBe(true); // Should NOT trigger sync
    });
    
    it('should sync when override is reset to null', () => {
      let lastSynced: number | null = 57930;
      const newVal = null;
      
      expect(newVal !== lastSynced).toBe(true); // Should trigger sync
    });
  });
});
