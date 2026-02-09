/**
 * Full Narrative Generation Stress Test
 * Tests the complete AI narrative pipeline with mocked AirDNA data.
 * The app runs on the live AirDNA API in production.
 */

import { describe, it, expect, vi } from 'vitest';
import { MOCK_DENVER_ESTIMATE, MOCK_MIAMI_ESTIMATE } from './fixtures/mock-rentalizer-data';

// Mock AirDNA to avoid burning API calls
vi.mock('../airdna', () => ({
  getRentalizerEstimate: vi.fn().mockImplementation(async (params: any) => {
    if (params.address?.includes('Miami')) return MOCK_MIAMI_ESTIMATE;
    return MOCK_DENVER_ESTIMATE;
  }),
}));

import { generateFullArbitrageAnalysis } from '../sop-reports';

// Increase timeout for AI narrative generation
vi.setConfig({ testTimeout: 300000 });

interface NarrativeQualityIssue {
  section: string;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
}

function analyzeNarrativeQuality(report: any): NarrativeQualityIssue[] {
  const issues: NarrativeQualityIssue[] = [];
  
  // Check executive summary
  if (!report.enhanced_narrative?.executive_summary) {
    issues.push({ section: 'executive_summary', issue: 'MISSING', severity: 'critical' });
  } else {
    const summary = report.enhanced_narrative.executive_summary;
    
    // Check for placeholder text
    if (/\[.*?\]|undefined|null|NaN/i.test(summary)) {
      issues.push({ section: 'executive_summary', issue: 'CONTAINS_PLACEHOLDERS', severity: 'critical' });
    }
    
    // Check length
    const wordCount = summary.split(/\s+/).length;
    if (wordCount < 100) {
      issues.push({ section: 'executive_summary', issue: `TOO_SHORT (${wordCount} words)`, severity: 'warning' });
    } else if (wordCount > 300) {
      issues.push({ section: 'executive_summary', issue: `TOO_LONG (${wordCount} words)`, severity: 'info' });
    }
  }
  
  // Check key metrics
  const metrics = report.enhanced_narrative?.key_metrics;
  if (!metrics) {
    issues.push({ section: 'key_metrics', issue: 'MISSING', severity: 'critical' });
  } else {
    if (!metrics.projected_annual_revenue || metrics.projected_annual_revenue <= 0) {
      issues.push({ section: 'key_metrics', issue: 'INVALID_REVENUE', severity: 'critical' });
    }
  }
  
  // Check competitors
  if (!report.competitors || report.competitors.length === 0) {
    issues.push({ section: 'competitors', issue: 'NO_COMPETITORS', severity: 'warning' });
  }
  
  // Check profitability
  if (!report.profitability) {
    issues.push({ section: 'profitability', issue: 'MISSING', severity: 'critical' });
  }
  
  return issues;
}

describe('Full Narrative Generation Stress Test', () => {
  it('should generate quality narrative for Denver property', async () => {
    console.log('\n=== Testing Denver ===');
    
    const report = await generateFullArbitrageAnalysis(
      '1321 15th St, Denver, CO 80202',
      2500,
      3,
      2
    );
    
    const issues = analyzeNarrativeQuality(report);
    
    console.log(`Revenue: $${report.profitability?.scenarios.realistic.projected_revenue?.toLocaleString() || 'N/A'}/yr`);
    console.log(`Competitors: ${report.competitors?.length || 0}`);
    console.log(`Issues found: ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.severity}] ${i.section}: ${i.issue}`));
    
    // Should have executive summary
    expect(report.enhanced_narrative?.executive_summary).toBeDefined();
    
    // Should not have critical issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    expect(criticalIssues.length).toBe(0);
  }, 300000);

  it('should generate quality narrative for Miami Beach property', async () => {
    console.log('\n=== Testing Miami Beach ===');
    
    const report = await generateFullArbitrageAnalysis(
      '456 Ocean Dr, Miami Beach, FL 33139',
      3500,
      2,
      2
    );
    
    const issues = analyzeNarrativeQuality(report);
    
    console.log(`Revenue: $${report.profitability?.scenarios.realistic.projected_revenue?.toLocaleString() || 'N/A'}/yr`);
    console.log(`Competitors: ${report.competitors?.length || 0}`);
    console.log(`Issues found: ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.severity}] ${i.section}: ${i.issue}`));
    
    expect(report.enhanced_narrative?.executive_summary).toBeDefined();
    
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    expect(criticalIssues.length).toBe(0);
  }, 300000);
});
