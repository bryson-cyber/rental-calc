import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests to verify role-based access gating:
 * - AirDNA-heavy procedures use adminProcedure
 * - Lightweight procedures remain publicProcedure
 * - Frontend tab filtering based on admin role
 * - Batch analyze gated to admin only
 * - type="url" bug fix
 */

// Helper to read a file
function readFile(filePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', filePath), 'utf-8');
}

describe('Role-Based Access: Server-Side Gating', () => {
  it('rental.ts: heavy AirDNA procedures use adminProcedure', () => {
    const content = readFile('server/routers/rental.ts');
    
    // These should all be adminProcedure
    const adminProcedures = [
      'getPropertyReport',
      'getAIPropertyReport',
      'getMarketReport',
      'getSubmarketReport',
      'getBookingPatterns',
      'getSupplyTrend',
      'getForwardDemand',
    ];
    
    for (const proc of adminProcedures) {
      // Match the pattern: procedureName: adminProcedure
      const regex = new RegExp(`${proc}:\\s*adminProcedure`);
      expect(content).toMatch(regex);
    }
  });

  it('rental.ts: getEstimate stays as publicProcedure', () => {
    const content = readFile('server/routers/rental.ts');
    expect(content).toMatch(/getEstimate:\s*publicProcedure/);
  });

  it('advanced.ts uses adminProcedure', () => {
    const content = readFile('server/routers/advanced.ts');
    expect(content).toContain('adminProcedure');
    expect(content).not.toMatch(/:\s*publicProcedure/);
  });

  it('comp-data.ts uses adminProcedure', () => {
    const content = readFile('server/routers/comp-data.ts');
    expect(content).toContain('adminProcedure');
    expect(content).not.toMatch(/:\s*publicProcedure/);
  });

  it('bulk-summary.ts uses adminProcedure', () => {
    const content = readFile('server/routers/bulk-summary.ts');
    expect(content).toContain('adminProcedure');
    expect(content).not.toMatch(/:\s*publicProcedure/);
  });

  it('market-explorer.ts uses adminProcedure', () => {
    const content = readFile('server/routers/market-explorer.ts');
    expect(content).toContain('adminProcedure');
    expect(content).not.toMatch(/:\s*publicProcedure/);
  });

  it('market-comparison.ts uses adminProcedure', () => {
    const content = readFile('server/routers/market-comparison.ts');
    expect(content).toContain('adminProcedure');
    expect(content).not.toMatch(/:\s*publicProcedure/);
  });

  it('market-discovery.ts uses adminProcedure', () => {
    const content = readFile('server/routers/market-discovery.ts');
    expect(content).toContain('adminProcedure');
    expect(content).not.toMatch(/:\s*publicProcedure/);
  });

  it('listings-by-area.ts uses adminProcedure', () => {
    const content = readFile('server/routers/listings-by-area.ts');
    expect(content).toContain('adminProcedure');
    expect(content).not.toMatch(/:\s*publicProcedure/);
  });

  it('deal-alerts.ts uses adminProcedure for create/list/updateMatchStatus/getMatches', () => {
    const content = readFile('server/routers/deal-alerts.ts');
    expect(content).toContain('adminProcedure');
    // create, list, updateMatchStatus, getMatches should be admin
    expect(content).toMatch(/create:\s*adminProcedure/);
    expect(content).toMatch(/list:\s*adminProcedure/);
    expect(content).toMatch(/getMatches:\s*adminProcedure/);
  });

  it('shared-reports.ts: create/regenerate/generateFromAddress use adminProcedure', () => {
    const content = readFile('server/routers/shared-reports.ts');
    expect(content).toMatch(/create:\s*adminProcedure/);
    expect(content).toMatch(/regenerate:\s*adminProcedure/);
    expect(content).toMatch(/generateFromAddress:\s*adminProcedure/);
  });

  it('shared-reports.ts: get and list stay as publicProcedure', () => {
    const content = readFile('server/routers/shared-reports.ts');
    expect(content).toMatch(/get:\s*publicProcedure/);
    expect(content).toMatch(/list:\s*publicProcedure/);
  });
});

describe('Role-Based Access: Frontend Tab Filtering', () => {
  it('LeadMagnet.tsx defines ADMIN_ONLY_TABS for prove, find, market, advisor', () => {
    const content = readFile('client/src/pages/LeadMagnet.tsx');
    expect(content).toContain('ADMIN_ONLY_TABS');
    // Should include the AirDNA-heavy tabs
    expect(content).toMatch(/ADMIN_ONLY_TABS.*=.*\[/);
    expect(content).toContain("'prove'");
    expect(content).toContain("'find'");
    expect(content).toContain("'market'");
    expect(content).toContain("'advisor'");
  });

  it('LeadMagnet.tsx filters TAB_ORDER based on isAdmin', () => {
    const content = readFile('client/src/pages/LeadMagnet.tsx');
    // TAB_ORDER should be filtered based on isAdmin
    expect(content).toMatch(/TAB_ORDER.*=.*isAdmin.*\?.*ALL_TABS.*:.*ALL_TABS\.filter/);
  });

  it('LeadMagnet.tsx uses simplified handler for non-admin validate', () => {
    const content = readFile('client/src/pages/LeadMagnet.tsx');
    // Should have handleSimplifiedAnalyze function
    expect(content).toContain('handleSimplifiedAnalyze');
    // Should conditionally call simplified vs full handler
    expect(content).toMatch(/isAdmin\s*\?\s*handleAnalyze\s*:\s*handleSimplifiedAnalyze/);
  });
});

describe('Role-Based Access: Step 2 Bulk Gating', () => {
  it('OpportunityFinderStep accepts isAdmin prop', () => {
    const content = readFile('client/src/components/OpportunityFinderStep.tsx');
    expect(content).toContain('isAdmin');
    expect(content).toMatch(/isAdmin.*=.*false/); // default false
  });

  it('Batch Analyze All button is gated to admin only', () => {
    const content = readFile('client/src/components/OpportunityFinderStep.tsx');
    expect(content).toContain('Batch Analyze All Button - Admin Only');
    expect(content).toMatch(/isAdmin\s*&&\s*displayedProperties\.length\s*>\s*0/);
  });

  it('Load More & Auto-Analyze button is gated to admin only', () => {
    const content = readFile('client/src/components/OpportunityFinderStep.tsx');
    // The auto-analyze button should be wrapped in isAdmin check
    expect(content).toMatch(/\{isAdmin\s*&&\s*\(\s*\n?\s*<Button/);
  });

  it('LeadMagnet passes isAdmin to OpportunityFinderStep', () => {
    const content = readFile('client/src/pages/LeadMagnet.tsx');
    expect(content).toMatch(/<OpportunityFinderStep[\s\S]*?isAdmin=\{isAdmin\}/);
  });
});

describe('Bug Fix: type="url" on Zillow input', () => {
  it('Home.tsx Zillow input uses type="text" not type="url"', () => {
    const content = readFile('client/src/pages/Home.tsx');
    // Should NOT have type="url" for the Zillow input
    expect(content).not.toMatch(/type="url"/);
    // The Zillow section should use type="text"
    const zillowSection = content.substring(
      content.indexOf('Zillow Property Link'),
      content.indexOf('Zillow Property Link') + 500
    );
    expect(zillowSection).toContain('type="text"');
  });
});
