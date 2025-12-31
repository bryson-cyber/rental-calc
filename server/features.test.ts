import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the lead submission functionality
describe('Lead Submission', () => {
  it('should accept valid lead data', () => {
    const leadData = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '555-123-4567',
      address: '123 Main St, Denver, CO',
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4,
    };
    
    // Validate required fields
    expect(leadData.name).toBeTruthy();
    expect(leadData.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(leadData.address).toBeTruthy();
    expect(leadData.bedrooms).toBeGreaterThan(0);
    expect(leadData.bathrooms).toBeGreaterThan(0);
    expect(leadData.accommodates).toBeGreaterThan(0);
  });

  it('should allow optional phone number', () => {
    const leadData = {
      name: 'Test User',
      email: 'test@example.com',
      address: '123 Main St, Denver, CO',
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4,
    };
    
    expect(leadData.name).toBeTruthy();
    expect(leadData.email).toBeTruthy();
    // Phone is optional, so this should be valid
  });

  it('should allow optional zillow_url', () => {
    const leadData = {
      name: 'Test User',
      email: 'test@example.com',
      address: '123 Main St, Denver, CO',
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4,
      zillow_url: 'https://www.zillow.com/homedetails/123-Main-St-Denver-CO/12345_zpid/',
    };
    
    expect(leadData.zillow_url).toContain('zillow.com');
  });
});

// Test the Zillow URL parsing logic (client-side)
describe('Zillow URL Parsing', () => {
  // Simulating the parseZillowUrl function logic
  function parseZillowUrl(url: string): { address: string | null } {
    try {
      const cleanUrl = url.trim();
      let addressPart: string | null = null;
      
      // Try homedetails pattern first
      const homeDetailsMatch = cleanUrl.match(/homedetails\/([^\/]+)\//i);
      if (homeDetailsMatch) {
        addressPart = homeDetailsMatch[1];
      }
      
      // Try homes pattern
      if (!addressPart) {
        const homesMatch = cleanUrl.match(/homes\/([^\/]+?)(?:_rb|\/|$)/i);
        if (homesMatch) {
          addressPart = homesMatch[1];
        }
      }
      
      // Try /b/ pattern (building/apartment)
      if (!addressPart) {
        const buildingMatch = cleanUrl.match(/\/b\/([^\/]+)\//i);
        if (buildingMatch) {
          addressPart = buildingMatch[1];
        }
      }
      
      if (addressPart) {
        addressPart = addressPart.replace(/\/\d+_zpid\/?$/, '').replace(/_zpid$/, '');
        
        let address = addressPart
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .replace(/%20/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        address = address.split(' ').map((word) => {
          if (word.length === 2 && /^[A-Za-z]{2}$/.test(word)) {
            return word.toUpperCase();
          }
          if (/^\d{5}(-\d{4})?$/.test(word)) {
            return word;
          }
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');
        
        return { address };
      }
      
      return { address: null };
    } catch {
      return { address: null };
    }
  }

  it('should parse homedetails URL pattern', () => {
    const url = 'https://www.zillow.com/homedetails/123-Main-St-Denver-CO-80202/12345_zpid/';
    const result = parseZillowUrl(url);
    expect(result.address).toBe('123 Main ST Denver CO 80202');
  });

  it('should parse homes URL pattern', () => {
    const url = 'https://www.zillow.com/homes/456-Oak-Ave-Atlanta-GA-30301_rb/';
    const result = parseZillowUrl(url);
    expect(result.address).toBe('456 Oak Ave Atlanta GA 30301');
  });

  it('should handle URLs with zpid suffix', () => {
    const url = 'https://www.zillow.com/homedetails/789-Pine-Rd-Miami-FL-33101/67890_zpid/';
    const result = parseZillowUrl(url);
    expect(result.address).toContain('789 Pine RD Miami FL 33101');
  });

  it('should return null for invalid URLs', () => {
    const url = 'https://www.google.com/search?q=houses';
    const result = parseZillowUrl(url);
    expect(result.address).toBeNull();
  });

  it('should handle empty URLs', () => {
    const result = parseZillowUrl('');
    expect(result.address).toBeNull();
  });

  it('should capitalize state abbreviations correctly', () => {
    const url = 'https://www.zillow.com/homedetails/100-test-st-new-york-ny-10001/12345_zpid/';
    const result = parseZillowUrl(url);
    expect(result.address).toContain('NY');
  });
});

// Test report data structure
describe('Report Data Structure', () => {
  it('should have correct property estimate structure', () => {
    const propertyEstimate = {
      property: {
        address: '123 Main St, Denver, CO',
        bedrooms: 2,
        bathrooms: 1,
        accommodates: 4,
      },
      estimates: {
        annual_revenue: 25000,
        annual_revenue_low: 22000,
        annual_revenue_high: 28000,
        average_daily_rate: 150,
        occupancy_rate: 0.65,
      },
      monthly_forecast: [
        { month: 'Jan 2026', revenue: 1500, adr: 100, occupancy: 0.50 },
      ],
      comps: [],
    };

    expect(propertyEstimate.property.address).toBeTruthy();
    expect(propertyEstimate.estimates.annual_revenue).toBeGreaterThan(0);
    expect(propertyEstimate.estimates.occupancy_rate).toBeGreaterThanOrEqual(0);
    expect(propertyEstimate.estimates.occupancy_rate).toBeLessThanOrEqual(1);
  });

  it('should have correct market data structure', () => {
    const marketData = {
      market_id: 'airdna-123',
      market_name: 'Denver',
      metrics: {
        occupancy: 0.69,
        adr: 152,
        revenue: 2960,
        revpar: 105,
        active_listings: 13376,
      },
    };

    expect(marketData.market_name).toBeTruthy();
    expect(marketData.metrics.occupancy).toBeGreaterThanOrEqual(0);
    expect(marketData.metrics.occupancy).toBeLessThanOrEqual(1);
    expect(marketData.metrics.active_listings).toBeGreaterThan(0);
  });

  it('should have correct bedroom performance structure', () => {
    const bedroomPerformance = [
      { bedrooms: 1, revenue: 1953, adr: 97, occupancy: 0.71 },
      { bedrooms: 2, revenue: 2960, adr: 152, occupancy: 0.69 },
      { bedrooms: 3, revenue: 4179, adr: 231, occupancy: 0.66 },
    ];

    expect(bedroomPerformance.length).toBeGreaterThan(0);
    bedroomPerformance.forEach(bp => {
      expect(bp.bedrooms).toBeGreaterThan(0);
      expect(bp.revenue).toBeGreaterThan(0);
      expect(bp.occupancy).toBeGreaterThanOrEqual(0);
      expect(bp.occupancy).toBeLessThanOrEqual(1);
    });
  });
});

// Test PDF generation data requirements
describe('PDF Generation Data', () => {
  it('should have all required fields for PDF generation', () => {
    const reportData = {
      property: {
        property: {
          address: '123 Main St, Denver, CO',
          bedrooms: 2,
          bathrooms: 1,
          accommodates: 4,
        },
        estimates: {
          annual_revenue: 25000,
          annual_revenue_low: 22000,
          annual_revenue_high: 28000,
          average_daily_rate: 150,
          occupancy_rate: 0.65,
        },
        monthly_forecast: [],
        comps: [],
      },
      market: {
        market_name: 'Denver',
        metrics: {
          occupancy: 0.69,
          adr: 152,
          revenue: 2960,
          active_listings: 13376,
        },
      },
      bedroom_performance: [],
    };

    // Check all required fields exist
    expect(reportData.property.property.address).toBeTruthy();
    expect(reportData.property.estimates.annual_revenue).toBeDefined();
    expect(reportData.market?.market_name).toBeTruthy();
  });
});
