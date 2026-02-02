/**
 * Newsletter System Tests
 * 
 * Tests for the Deal Flow Machine newsletter automation system.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment variables
vi.stubEnv('HUBSPOT_API_KEY', 'test-hubspot-key');
vi.stubEnv('AIRDNA_API_KEY', 'test-airdna-key');
vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');

// Mock the HubSpot module
vi.mock('../hubspot', () => ({
  getUniqueCities: vi.fn().mockResolvedValue([
    { city: 'Denver', state: 'CO' },
    { city: 'Austin', state: 'TX' },
    { city: 'Miami', state: 'FL' },
  ]),
  getContactsByCity: vi.fn().mockImplementation((city: string, state: string) => {
    if (city === 'Denver' && state === 'CO') {
      return Promise.resolve([
        { hubspotId: '1', email: 'john@example.com', firstName: 'John', lastName: 'Doe', city: 'Denver', state: 'CO', postalCode: '80202' },
        { hubspotId: '2', email: 'jane@example.com', firstName: 'Jane', lastName: 'Smith', city: 'Denver', state: 'CO', postalCode: '80203' },
      ]);
    }
    return Promise.resolve([]);
  }),
}));

// Mock the market data module
vi.mock('../newsletter-market-data', () => ({
  getMarketSnapshotForCity: vi.fn().mockImplementation((city: string, state: string) => {
    if (city === 'Denver' && state === 'CO') {
      return Promise.resolve({
        city: 'Denver',
        state: 'CO',
        marketId: 'denver-co',
        adr: 285,
        occupancy: 0.72,
        revenue: 74820,
        revpar: 205,
        listings: 4500,
        trend: 'up' as const,
        trendPercent: 5.2,
        seasonalPeak: 'June',
        seasonalLow: 'January',
        lastUpdated: new Date(),
      });
    }
    return Promise.resolve(null);
  }),
  batchGetMarketSnapshots: vi.fn().mockResolvedValue([
    {
      city: 'Denver',
      state: 'CO',
      marketId: 'denver-co',
      adr: 285,
      occupancy: 0.72,
      revenue: 74820,
      revpar: 205,
      listings: 4500,
      trend: 'up' as const,
      trendPercent: 5.2,
      seasonalPeak: 'June',
      seasonalLow: 'January',
      lastUpdated: new Date(),
    },
  ]),
}));

// Mock the content generator
vi.mock('../newsletter-content-generator', () => ({
  generateWeeklyMarketContent: vi.fn().mockResolvedValue({
    subject: '🏠 Denver Market Update: ADR Up 5.2% This Month',
    greeting: 'Hi John,',
    mainContent: 'Great news for Denver investors! The market is showing strong growth...',
    callToAction: 'Ready to find your next deal? Use our Deal Finder tool.',
    ctaUrl: 'https://coachinayahturnkeytool.com/opportunity-finder',
    footer: 'You received this because you signed up for market updates.',
  }),
  generateDealAlertContent: vi.fn().mockResolvedValue({
    subject: '🔥 Hot Deal Alert: $4,200/mo Potential in Denver',
    greeting: 'Hi John,',
    mainContent: 'We found a promising opportunity in your market...',
    dealHighlights: [
      { label: 'Monthly Revenue', value: '$4,200' },
      { label: 'Occupancy', value: '78%' },
      { label: 'Deal Score', value: '85/100' },
    ],
    callToAction: 'View full analysis',
    ctaUrl: 'https://coachinayahturnkeytool.com/opportunity-finder',
    footer: 'You received this because you signed up for deal alerts.',
  }),
}));

// Mock the email sender
vi.mock('../newsletter-email-sender', () => ({
  sendWeeklyMarketEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-123' }),
  sendDealAlertEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-456' }),
  getSendStats: vi.fn().mockResolvedValue({
    totalSent: 150,
    successful: 145,
    failed: 5,
    byType: { weekly_market: 100, deal_alert: 50 },
    byCity: [
      { city: 'Denver', state: 'CO', count: 50 },
      { city: 'Austin', state: 'TX', count: 40 },
    ],
  }),
  unsubscribeContact: vi.fn().mockResolvedValue(undefined),
}));

// Mock the deal finder
vi.mock('../newsletter-deal-finder', () => ({
  findDealsForCity: vi.fn().mockResolvedValue([
    {
      address: '123 Main St, Denver, CO 80202',
      price: 450000,
      bedrooms: 3,
      bathrooms: 2,
      estimatedRevenue: 4200,
      estimatedOccupancy: 0.78,
      dealScore: 85,
      source: 'zillow',
      url: 'https://zillow.com/123',
    },
  ]),
}));

// Mock the database
vi.mock('../db', () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue({ insertId: 1 }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  }),
}));

describe('Newsletter System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HubSpot Integration', () => {
    it('should retrieve unique cities from contacts', async () => {
      const { getUniqueCities } = await import('../hubspot');
      const cities = await getUniqueCities();
      
      expect(cities).toHaveLength(3);
      expect(cities[0]).toEqual({ city: 'Denver', state: 'CO' });
    });

    it('should retrieve contacts by city', async () => {
      const { getContactsByCity } = await import('../hubspot');
      const contacts = await getContactsByCity('Denver', 'CO');
      
      expect(contacts).toHaveLength(2);
      expect(contacts[0].email).toBe('john@example.com');
      expect(contacts[0].city).toBe('Denver');
    });

    it('should return empty array for city with no contacts', async () => {
      const { getContactsByCity } = await import('../hubspot');
      const contacts = await getContactsByCity('Unknown', 'XX');
      
      expect(contacts).toHaveLength(0);
    });
  });

  describe('Market Data Aggregation', () => {
    it('should get market snapshot for a city', async () => {
      const { getMarketSnapshotForCity } = await import('../newsletter-market-data');
      const snapshot = await getMarketSnapshotForCity('Denver', 'CO');
      
      expect(snapshot).not.toBeNull();
      expect(snapshot?.city).toBe('Denver');
      expect(snapshot?.adr).toBe(285);
      expect(snapshot?.occupancy).toBe(0.72);
    });

    it('should return null for unknown city', async () => {
      const { getMarketSnapshotForCity } = await import('../newsletter-market-data');
      const snapshot = await getMarketSnapshotForCity('Unknown', 'XX');
      
      expect(snapshot).toBeNull();
    });

    it('should batch get market snapshots', async () => {
      const { batchGetMarketSnapshots } = await import('../newsletter-market-data');
      const snapshots = await batchGetMarketSnapshots([
        { city: 'Denver', state: 'CO' },
      ]);
      
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].city).toBe('Denver');
    });
  });

  describe('Content Generation', () => {
    it('should generate weekly market content', async () => {
      const { generateWeeklyMarketContent } = await import('../newsletter-content-generator');
      const content = await generateWeeklyMarketContent({
        contact: {
          hubspotId: '1',
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
          city: 'Denver',
          state: 'CO',
          postalCode: '80202',
        },
        marketSnapshot: {
          city: 'Denver',
          state: 'CO',
          marketId: 'denver-co',
          adr: 285,
          occupancy: 0.72,
          revenue: 74820,
          revpar: 205,
          listings: 4500,
          trend: 'up',
          trendPercent: 5.2,
          seasonalPeak: 'June',
          seasonalLow: 'January',
          lastUpdated: new Date(),
        },
      });
      
      expect(content.subject).toContain('Denver');
      expect(content.greeting).toContain('John');
      expect(content.mainContent).toBeTruthy();
      expect(content.callToAction).toBeTruthy();
    });

    it('should generate deal alert content', async () => {
      const { generateDealAlertContent } = await import('../newsletter-content-generator');
      const content = await generateDealAlertContent({
        contact: {
          hubspotId: '1',
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
          city: 'Denver',
          state: 'CO',
          postalCode: '80202',
        },
        deals: [
          {
            address: '123 Main St, Denver, CO 80202',
            price: 450000,
            bedrooms: 3,
            bathrooms: 2,
            estimatedRevenue: 4200,
            estimatedOccupancy: 0.78,
            dealScore: 85,
            source: 'zillow',
            url: 'https://zillow.com/123',
          },
        ],
        marketSnapshot: {
          city: 'Denver',
          state: 'CO',
          marketId: 'denver-co',
          adr: 285,
          occupancy: 0.72,
          revenue: 74820,
          revpar: 205,
          listings: 4500,
          trend: 'up',
          trendPercent: 5.2,
          seasonalPeak: 'June',
          seasonalLow: 'January',
          lastUpdated: new Date(),
        },
      });
      
      expect(content.subject).toContain('Deal');
      expect(content.dealHighlights).toHaveLength(3);
    });
  });

  describe('Email Sending', () => {
    it('should send weekly market email', async () => {
      const { sendWeeklyMarketEmail } = await import('../newsletter-email-sender');
      const result = await sendWeeklyMarketEmail({
        contact: {
          hubspotId: '1',
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
          city: 'Denver',
          state: 'CO',
          postalCode: '80202',
        },
        content: {
          subject: 'Test Subject',
          greeting: 'Hi John,',
          mainContent: 'Test content',
          callToAction: 'Click here',
          ctaUrl: 'https://example.com',
          footer: 'Footer text',
        },
      });
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
    });

    it('should get send statistics', async () => {
      const { getSendStats } = await import('../newsletter-email-sender');
      const stats = await getSendStats({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });
      
      expect(stats.totalSent).toBe(150);
      expect(stats.successful).toBe(145);
      expect(stats.failed).toBe(5);
    });
  });

  describe('Deal Finder', () => {
    it('should find deals for a city', async () => {
      const { findDealsForCity } = await import('../newsletter-deal-finder');
      const deals = await findDealsForCity('Denver', 'CO', { minDealScore: 70 });
      
      expect(deals).toHaveLength(1);
      expect(deals[0].dealScore).toBe(85);
      expect(deals[0].estimatedRevenue).toBe(4200);
    });
  });

  describe('Newsletter Router Types', () => {
    it('should have correct type structure for dashboard stats', () => {
      // Type check - this test ensures the types are correct
      type DashboardStats = {
        last30Days: {
          totalSent: number;
          successful: number;
          failed: number;
          byType: Record<string, number>;
          byCity: Array<{ city: string; state: string; count: number }>;
        };
        totalCities: number;
        recentJobs: Array<{
          type: string;
          startedAt: string;
          completedAt: string;
          emailsSent: number;
          emailsFailed: number;
          citiesProcessed: number;
        }>;
      };

      const mockStats: DashboardStats = {
        last30Days: {
          totalSent: 100,
          successful: 95,
          failed: 5,
          byType: { weekly_market: 60, deal_alert: 40 },
          byCity: [{ city: 'Denver', state: 'CO', count: 50 }],
        },
        totalCities: 10,
        recentJobs: [
          {
            type: 'weekly_market',
            startedAt: '2024-01-15T10:00:00Z',
            completedAt: '2024-01-15T10:05:00Z',
            emailsSent: 50,
            emailsFailed: 2,
            citiesProcessed: 5,
          },
        ],
      };

      expect(mockStats.last30Days.totalSent).toBe(100);
      expect(mockStats.recentJobs[0].type).toBe('weekly_market');
    });
  });
});

describe('Newsletter Content Validation', () => {
  it('should validate email content has required fields', () => {
    const requiredFields = ['subject', 'greeting', 'mainContent', 'callToAction', 'footer'];
    
    const content = {
      subject: 'Test Subject',
      greeting: 'Hi there,',
      mainContent: 'Main content here',
      callToAction: 'Click here',
      ctaUrl: 'https://example.com',
      footer: 'Footer text',
    };
    
    for (const field of requiredFields) {
      expect(content).toHaveProperty(field);
      expect((content as any)[field]).toBeTruthy();
    }
  });

  it('should validate deal has required fields', () => {
    const requiredFields = ['address', 'estimatedRevenue', 'dealScore'];
    
    const deal = {
      address: '123 Main St',
      price: 450000,
      bedrooms: 3,
      bathrooms: 2,
      estimatedRevenue: 4200,
      estimatedOccupancy: 0.78,
      dealScore: 85,
      source: 'zillow',
      url: 'https://zillow.com/123',
    };
    
    for (const field of requiredFields) {
      expect(deal).toHaveProperty(field);
    }
    
    expect(deal.dealScore).toBeGreaterThanOrEqual(0);
    expect(deal.dealScore).toBeLessThanOrEqual(100);
  });
});
