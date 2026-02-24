import { describe, it, expect } from 'vitest';

/**
 * Tests for rate limiting configuration and messaging.
 * These test the exported constants, types, and messaging patterns
 * without requiring a database connection.
 */

describe('Rate Limiting Configuration', () => {
  describe('Default Limits', () => {
    it('should have separate limits for Step 2 (property) and Step 5 (validate)', async () => {
      // Import the module to check its exports
      const usageLimits = await import('../usage-limits');
      
      // Verify the module exports the expected functions
      expect(usageLimits.canPerformAnalysis).toBeDefined();
      expect(usageLimits.canPerformValidation).toBeDefined();
      expect(usageLimits.recordAnalysisUsage).toBeDefined();
      expect(usageLimits.recordValidateUsage).toBeDefined();
      expect(usageLimits.getUsageStatus).toBeDefined();
      expect(usageLimits.canPerformMarketResearch).toBeDefined();
      expect(usageLimits.recordMarketResearchUsage).toBeDefined();
    });

    it('should export separate record functions for analysis and validation', async () => {
      const usageLimits = await import('../usage-limits');
      
      // recordAnalysisUsage and recordValidateUsage should be different functions
      expect(usageLimits.recordAnalysisUsage).not.toBe(usageLimits.recordValidateUsage);
    });
  });

  describe('No Turnkey Upgrade Messaging', () => {
    it('should not contain Turnkey upgrade messaging in usage-limits.ts', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, '../usage-limits.ts'),
        'utf-8'
      );
      
      // Should NOT contain any Turnkey upgrade messaging
      expect(content).not.toContain('Upgrade to the Turnkey');
      expect(content).not.toContain('Turnkey Program for unlimited');
      expect(content).not.toContain('Upgrade for unlimited');
      expect(content).not.toContain('Unlock unlimited');
      
      // Should contain the correct "resets at midnight" messaging
      expect(content).toContain('resets at midnight');
    });

    it('should not contain Turnkey upgrade messaging in rate-limiter.ts', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, '../rate-limiter.ts'),
        'utf-8'
      );
      
      // Should NOT contain any Turnkey upgrade messaging
      expect(content).not.toContain('Upgrade to the Turnkey');
      expect(content).not.toContain('Turnkey Program for unlimited');
      expect(content).not.toContain('Upgrade for unlimited');
      expect(content).not.toContain('Unlock unlimited');
      
      // Should contain the correct "resets at midnight" messaging
      expect(content).toContain('resets at midnight');
    });

    it('should not contain Turnkey upgrade messaging in UpgradeBanner.tsx', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../client/src/components/UpgradeBanner.tsx'),
        'utf-8'
      );
      
      expect(content).not.toContain('Upgrade to Unlimited');
      expect(content).not.toContain('masterclass.coachinayah.com/the-turnkey-program');
      expect(content).not.toContain('TURNKEY_URL');
      expect(content).not.toContain('Upgrade for unlimited');
      
      // Should contain the correct messaging (uses 'reset at midnight' without 's')
      expect(content).toContain('reset at midnight');
    });

    it('should not contain Turnkey upgrade messaging in UsageLimitBadge.tsx', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../client/src/components/UsageLimitBadge.tsx'),
        'utf-8'
      );
      
      expect(content).not.toContain('Upgrade for unlimited');
      expect(content).not.toContain('Unlock unlimited');
      expect(content).not.toContain('masterclass.coachinayah.com/the-turnkey-program');
      
      // Should contain the correct messaging
      expect(content).toContain('Resets daily at midnight');
    });
  });

  describe('Source Parameter in Property Report Schema', () => {
    it('should accept source parameter in propertyReportInputSchema', async () => {
      const { propertyReportInputSchema } = await import('../routers/rental');
      
      // Should accept 'calculator' source (default)
      const calcResult = propertyReportInputSchema.safeParse({
        address: '123 Main St',
        source: 'calculator',
      });
      expect(calcResult.success).toBe(true);
      
      // Should accept 'validate' source
      const validateResult = propertyReportInputSchema.safeParse({
        address: '123 Main St',
        source: 'validate',
      });
      expect(validateResult.success).toBe(true);
      
      // Should accept 'compare' source
      const compareResult = propertyReportInputSchema.safeParse({
        address: '123 Main St',
        source: 'compare',
      });
      expect(compareResult.success).toBe(true);
      
      // Should default to 'calculator' when not provided
      const defaultResult = propertyReportInputSchema.safeParse({
        address: '123 Main St',
      });
      expect(defaultResult.success).toBe(true);
      if (defaultResult.success) {
        expect(defaultResult.data.source).toBe('calculator');
      }
      
      // Should reject invalid source
      const invalidResult = propertyReportInputSchema.safeParse({
        address: '123 Main St',
        source: 'invalid',
      });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('Frontend Validate Tab Sends Correct Source', () => {
    it('should pass source=validate from the validate tab in LeadMagnet', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../client/src/pages/LeadMagnet.tsx'),
        'utf-8'
      );
      
      // The validate tab's analyzeProperty call should include source: 'validate'
      expect(content).toContain("source: 'validate' as const");
      
      // The bulk compare call should include source: 'compare'
      expect(content).toContain("source: 'compare' as const");
    });
  });

  describe('Batch Analyze Pre-Check', () => {
    it('should check remaining limit before starting batch analysis', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../client/src/pages/LeadMagnet.tsx'),
        'utf-8'
      );
      
      // The handleBulkAnalyze function should check usage status before starting
      expect(content).toContain('trpcUtils.usage.getStatus.fetch()');
      expect(content).toContain('remaining < validProperties.length');
      expect(content).toContain('Limits reset at midnight');
    });
  });

  describe('Schema Includes validateAnalyses Column', () => {
    it('should have validateAnalyses column in userUsage schema', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../drizzle/schema.ts'),
        'utf-8'
      );
      
      expect(content).toContain('validateAnalyses');
    });
  });
});
