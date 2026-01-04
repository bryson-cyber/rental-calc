/**
 * Full Narrative Generation Stress Test
 * Tests the complete AI narrative pipeline with diverse properties
 */

import { describe, it, expect, vi } from 'vitest';
import { generateFullArbitrageAnalysis } from '../sop-reports';

// Increase timeout for full analysis
vi.setConfig({ testTimeout: 300000 }); // 5 minutes per test

interface TestProperty {
  address: string;
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;
  market: string;
}

// Test 5 diverse properties for full narrative generation
const TEST_PROPERTIES: TestProperty[] = [
  { address: '1321 15th St, Denver, CO 80202', bedrooms: 3, bathrooms: 2, monthlyRent: 2500, market: 'Denver' },
  { address: '456 Ocean Dr, Miami Beach, FL 33139', bedrooms: 2, bathrooms: 2, monthlyRent: 3500, market: 'Miami Beach' },
  { address: '100 Broadway, Nashville, TN 37203', bedrooms: 3, bathrooms: 2, monthlyRent: 2800, market: 'Nashville' },
  { address: '333 Beale St, Memphis, TN 38103', bedrooms: 3, bathrooms: 2, monthlyRent: 1500, market: 'Memphis' },
  { address: '666 Fremont St, Las Vegas, NV 89101', bedrooms: 4, bathrooms: 3, monthlyRent: 2000, market: 'Las Vegas' },
];

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
    
    // Check for investment advice (should NOT be present)
    if (/\b(GO|STRONG GO|NO GO|sign the lease|proceed|recommend)\b/i.test(summary)) {
      issues.push({ section: 'executive_summary', issue: 'CONTAINS_INVESTMENT_ADVICE', severity: 'warning' });
    }
    
    // Check for placeholder text
    if (/\[.*?\]|undefined|null|NaN/i.test(summary)) {
      issues.push({ section: 'executive_summary', issue: 'CONTAINS_PLACEHOLDERS', severity: 'critical' });
    }
    
    // Check length (should be 150-200 words)
    const wordCount = summary.split(/\s+/).length;
    if (wordCount < 100) {
      issues.push({ section: 'executive_summary', issue: `TOO_SHORT (${wordCount} words)`, severity: 'warning' });
    } else if (wordCount > 300) {
      issues.push({ section: 'executive_summary', issue: `TOO_LONG (${wordCount} words)`, severity: 'info' });
    }
    
    // Check for key metrics mentioned
    if (!/revenue/i.test(summary)) {
      issues.push({ section: 'executive_summary', issue: 'MISSING_REVENUE_MENTION', severity: 'warning' });
    }
    if (!/profit/i.test(summary)) {
      issues.push({ section: 'executive_summary', issue: 'MISSING_PROFIT_MENTION', severity: 'warning' });
    }
    if (!/occupancy/i.test(summary)) {
      issues.push({ section: 'executive_summary', issue: 'MISSING_OCCUPANCY_MENTION', severity: 'info' });
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
    if (!metrics.revenue_to_rent_ratio || metrics.revenue_to_rent_ratio <= 0) {
      issues.push({ section: 'key_metrics', issue: 'INVALID_RATIO', severity: 'critical' });
    }
    if (metrics.market_occupancy > 100) {
      issues.push({ section: 'key_metrics', issue: 'OCCUPANCY_OVER_100', severity: 'critical' });
    }
  }
  
  // Check competitors
  if (!report.competitors || report.competitors.length === 0) {
    issues.push({ section: 'competitors', issue: 'NO_COMPETITORS', severity: 'warning' });
  }
  
  // Check seasonality
  if (!report.market_seasonality || report.market_seasonality.length === 0) {
    issues.push({ section: 'seasonality', issue: 'NO_SEASONALITY_DATA', severity: 'info' });
  }
  
  // Check profitability
  if (!report.profitability) {
    issues.push({ section: 'profitability', issue: 'MISSING', severity: 'critical' });
  } else {
    if (report.profitability.annual_operating_costs <= 0) {
      issues.push({ section: 'profitability', issue: 'INVALID_COSTS', severity: 'warning' });
    }
  }
  
  return issues;
}

describe('Full Narrative Generation Stress Test', () => {
  // Test one property at a time to avoid overwhelming the API
  it('should generate quality narrative for Denver property', async () => {
    const property = TEST_PROPERTIES[0];
    console.log(`\n=== Testing ${property.market} ===`);
    
    const report = await generateFullArbitrageAnalysis(
      property.address,
      property.monthlyRent,
      property.bedrooms,
      property.bathrooms
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
    const property = TEST_PROPERTIES[1];
    console.log(`\n=== Testing ${property.market} ===`);
    
    const report = await generateFullArbitrageAnalysis(
      property.address,
      property.monthlyRent,
      property.bedrooms,
      property.bathrooms
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

  it('should generate quality narrative for Nashville property', async () => {
    const property = TEST_PROPERTIES[2];
    console.log(`\n=== Testing ${property.market} ===`);
    
    const report = await generateFullArbitrageAnalysis(
      property.address,
      property.monthlyRent,
      property.bedrooms,
      property.bathrooms
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

  it('should generate quality narrative for Memphis property (low rent)', async () => {
    const property = TEST_PROPERTIES[3];
    console.log(`\n=== Testing ${property.market} (LOW RENT) ===`);
    
    const report = await generateFullArbitrageAnalysis(
      property.address,
      property.monthlyRent,
      property.bedrooms,
      property.bathrooms
    );
    
    const issues = analyzeNarrativeQuality(report);
    
    console.log(`Revenue: $${report.profitability?.scenarios.realistic.projected_revenue?.toLocaleString() || 'N/A'}/yr`);
    console.log(`Ratio: ${report.enhanced_narrative?.key_metrics?.revenue_to_rent_ratio?.toFixed(2) || 'N/A'}x`);
    console.log(`Competitors: ${report.competitors?.length || 0}`);
    console.log(`Issues found: ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.severity}] ${i.section}: ${i.issue}`));
    
    expect(report.enhanced_narrative?.executive_summary).toBeDefined();
    
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    expect(criticalIssues.length).toBe(0);
  }, 300000);

  it('should generate quality narrative for Las Vegas property (4BR)', async () => {
    const property = TEST_PROPERTIES[4];
    console.log(`\n=== Testing ${property.market} (4BR) ===`);
    
    const report = await generateFullArbitrageAnalysis(
      property.address,
      property.monthlyRent,
      property.bedrooms,
      property.bathrooms
    );
    
    const issues = analyzeNarrativeQuality(report);
    
    console.log(`Revenue: $${report.profitability?.scenarios.realistic.projected_revenue?.toLocaleString() || 'N/A'}/yr`);
    console.log(`Ratio: ${report.enhanced_narrative?.key_metrics?.revenue_to_rent_ratio?.toFixed(2) || 'N/A'}x`);
    console.log(`Competitors: ${report.competitors?.length || 0}`);
    console.log(`Issues found: ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.severity}] ${i.section}: ${i.issue}`));
    
    expect(report.enhanced_narrative?.executive_summary).toBeDefined();
    
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    expect(criticalIssues.length).toBe(0);
  }, 300000);
});
