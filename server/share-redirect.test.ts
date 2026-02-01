/**
 * Tests for ShareRedirect functionality
 * Verifies that share links properly redirect to tool pages with pre-loaded data
 */

import { describe, it, expect } from 'vitest';

// Report type to tab mapping (same as in ShareRedirect.tsx)
const reportTypeToTab: Record<string, { tab: string; step: string }> = {
  revenue: { tab: 'prove', step: '3' },
  validator: { tab: 'validate', step: '5' },
  market: { tab: 'market', step: '8' },
  ai_advisor: { tab: 'advisor', step: '9' },
  listings: { tab: 'find', step: '4' },
  comparison: { tab: 'compare', step: '6' },
  map: { tab: 'map', step: '7' },
  regulation: { tab: 'regulations', step: '1' },
};

// Helper to build redirect URL from report data
function buildRedirectUrl(reportData: {
  reportType: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  bedrooms?: number;
  bathrooms?: string;
  monthlyRent?: number;
  latitude?: string;
  longitude?: string;
  marketName?: string;
}, shareCode: string): string {
  const tabInfo = reportTypeToTab[reportData.reportType] || { tab: 'prove', step: '3' };
  
  const params = new URLSearchParams();
  params.set('tab', tabInfo.tab);
  params.set('shared', 'true');
  params.set('shareCode', shareCode);
  
  if (reportData.address) {
    params.set('address', reportData.address);
  }
  if (reportData.city) {
    params.set('city', reportData.city);
  }
  if (reportData.state) {
    params.set('state', reportData.state);
  }
  if (reportData.zipCode) {
    params.set('zip', reportData.zipCode);
  }
  if (reportData.bedrooms) {
    params.set('bedrooms', reportData.bedrooms.toString());
  }
  if (reportData.bathrooms) {
    params.set('bathrooms', reportData.bathrooms.toString());
  }
  if (reportData.monthlyRent) {
    params.set('rent', reportData.monthlyRent.toString());
  }
  if (reportData.latitude) {
    params.set('lat', reportData.latitude.toString());
  }
  if (reportData.longitude) {
    params.set('lng', reportData.longitude.toString());
  }
  
  const location = reportData.city && reportData.state 
    ? `${reportData.city}, ${reportData.state}` 
    : reportData.marketName || '';
  if (location) {
    params.set('location', location);
  }
  
  params.set('autoAnalyze', 'true');
  
  return `/?${params.toString()}`;
}

describe('ShareRedirect URL Building', () => {
  it('should map revenue report to prove tab', () => {
    const url = buildRedirectUrl({
      reportType: 'revenue',
      city: 'Denver',
      state: 'CO',
    }, 'ABC123');
    
    expect(url).toContain('tab=prove');
    expect(url).toContain('shared=true');
    expect(url).toContain('shareCode=ABC123');
  });
  
  it('should map validator report to validate tab', () => {
    const url = buildRedirectUrl({
      reportType: 'validator',
      address: '123 Main St',
      city: 'Austin',
      state: 'TX',
    }, 'XYZ789');
    
    expect(url).toContain('tab=validate');
    expect(url).toContain('address=123+Main+St');
    expect(url).toContain('city=Austin');
    expect(url).toContain('state=TX');
  });
  
  it('should map market report to market tab', () => {
    const url = buildRedirectUrl({
      reportType: 'market',
      city: 'San Diego',
      state: 'CA',
      marketName: 'San Diego Metro',
    }, 'MKT456');
    
    expect(url).toContain('tab=market');
    expect(url).toContain('location=San+Diego%2C+CA');
  });
  
  it('should map ai_advisor report to advisor tab', () => {
    const url = buildRedirectUrl({
      reportType: 'ai_advisor',
      city: 'Miami',
      state: 'FL',
    }, 'AI999');
    
    expect(url).toContain('tab=advisor');
  });
  
  it('should map listings report to find tab', () => {
    const url = buildRedirectUrl({
      reportType: 'listings',
      city: 'Nashville',
      state: 'TN',
    }, 'LST111');
    
    expect(url).toContain('tab=find');
  });
  
  it('should map comparison report to compare tab', () => {
    const url = buildRedirectUrl({
      reportType: 'comparison',
    }, 'CMP222');
    
    expect(url).toContain('tab=compare');
  });
  
  it('should map map report to map tab', () => {
    const url = buildRedirectUrl({
      reportType: 'map',
      latitude: '39.7392',
      longitude: '-104.9903',
    }, 'MAP333');
    
    expect(url).toContain('tab=map');
    expect(url).toContain('lat=39.7392');
    expect(url).toContain('lng=-104.9903');
  });
  
  it('should map regulation report to regulations tab', () => {
    const url = buildRedirectUrl({
      reportType: 'regulation',
      city: 'Los Angeles',
      state: 'CA',
    }, 'REG444');
    
    expect(url).toContain('tab=regulations');
  });
  
  it('should include all property details in URL', () => {
    const url = buildRedirectUrl({
      reportType: 'validator',
      address: '456 Oak Ave',
      city: 'Portland',
      state: 'OR',
      zipCode: '97201',
      bedrooms: 3,
      bathrooms: '2.5',
      monthlyRent: 2500,
    }, 'FULL555');
    
    expect(url).toContain('address=456+Oak+Ave');
    expect(url).toContain('city=Portland');
    expect(url).toContain('state=OR');
    expect(url).toContain('zip=97201');
    expect(url).toContain('bedrooms=3');
    expect(url).toContain('bathrooms=2.5');
    expect(url).toContain('rent=2500');
    expect(url).toContain('autoAnalyze=true');
  });
  
  it('should always include autoAnalyze=true', () => {
    const url = buildRedirectUrl({
      reportType: 'revenue',
    }, 'AUTO666');
    
    expect(url).toContain('autoAnalyze=true');
  });
  
  it('should build location from city and state', () => {
    const url = buildRedirectUrl({
      reportType: 'market',
      city: 'Seattle',
      state: 'WA',
    }, 'LOC777');
    
    expect(url).toContain('location=Seattle%2C+WA');
  });
  
  it('should use marketName as fallback for location', () => {
    const url = buildRedirectUrl({
      reportType: 'market',
      marketName: 'Greater Phoenix Area',
    }, 'MKT888');
    
    expect(url).toContain('location=Greater+Phoenix+Area');
  });
  
  it('should handle unknown report types with default tab', () => {
    const url = buildRedirectUrl({
      reportType: 'unknown_type',
    }, 'UNK999');
    
    // Should default to 'prove' tab
    expect(url).toContain('tab=prove');
  });
});

describe('Report Type to Tab Mapping', () => {
  it('should have correct mappings for all report types', () => {
    expect(reportTypeToTab.revenue).toEqual({ tab: 'prove', step: '3' });
    expect(reportTypeToTab.validator).toEqual({ tab: 'validate', step: '5' });
    expect(reportTypeToTab.market).toEqual({ tab: 'market', step: '8' });
    expect(reportTypeToTab.ai_advisor).toEqual({ tab: 'advisor', step: '9' });
    expect(reportTypeToTab.listings).toEqual({ tab: 'find', step: '4' });
    expect(reportTypeToTab.comparison).toEqual({ tab: 'compare', step: '6' });
    expect(reportTypeToTab.map).toEqual({ tab: 'map', step: '7' });
    expect(reportTypeToTab.regulation).toEqual({ tab: 'regulations', step: '1' });
  });
  
  it('should have 8 report type mappings', () => {
    expect(Object.keys(reportTypeToTab).length).toBe(8);
  });
});
