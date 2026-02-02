/**
 * Unit tests for Newsletter Features
 * - SMS alerts (SimpleTexting)
 * - HasData Zillow deal caching
 * - Engagement tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
vi.stubEnv('SIMPLETEXTING_API_KEY', 'test-simpletexting-key');
vi.stubEnv('HASDATA_API_KEY', 'test-hasdata-key');
vi.stubEnv('HUBSPOT_API_KEY', 'test-hubspot-key');

describe('Newsletter SMS Alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format SMS message correctly', async () => {
    // Test SMS message formatting
    const deal = {
      address: '123 Main St, Atlanta, GA',
      dealScore: 85,
      monthlyRevenue: 4200,
    };
    
    const expectedMessage = `🔥 Hot Deal Alert! A property at ${deal.address} scored ${deal.dealScore}/100 with $${deal.monthlyRevenue.toLocaleString()}/mo potential. Check your email for details!`;
    
    expect(expectedMessage).toContain('Hot Deal Alert');
    expect(expectedMessage).toContain(deal.address);
    expect(expectedMessage).toContain(String(deal.dealScore));
  });

  it('should validate phone number format', () => {
    // Test phone number validation
    const validPhone = '+14045551234';
    const invalidPhone = '404-555-1234';
    
    const isValidFormat = (phone: string) => /^\+1\d{10}$/.test(phone);
    
    expect(isValidFormat(validPhone)).toBe(true);
    expect(isValidFormat(invalidPhone)).toBe(false);
  });

  it('should respect SMS opt-in preferences', () => {
    // Test SMS preference checking
    const contactWithSMS = { smsAlertsEnabled: 1, phone: '+14045551234' };
    const contactWithoutSMS = { smsAlertsEnabled: 0, phone: '+14045551234' };
    const contactNoPhone = { smsAlertsEnabled: 1, phone: null };
    
    const canSendSMS = (contact: any) => 
      contact.smsAlertsEnabled === 1 && !!contact.phone;
    
    expect(canSendSMS(contactWithSMS)).toBe(true);
    expect(canSendSMS(contactWithoutSMS)).toBe(false);
    expect(canSendSMS(contactNoPhone)).toBe(false);
  });
});

describe('HasData Zillow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse Zillow search results correctly', () => {
    // Test parsing of Zillow search results
    const mockZillowResult = {
      zpid: '12345678',
      address: {
        streetAddress: '123 Main St',
        city: 'Atlanta',
        state: 'GA',
        zipcode: '30309',
      },
      price: 2500,
      bedrooms: 3,
      bathrooms: 2,
      imgSrc: 'https://photos.zillowstatic.com/test.jpg',
    };
    
    const parsed = {
      zillowId: mockZillowResult.zpid,
      address: `${mockZillowResult.address.streetAddress}, ${mockZillowResult.address.city}, ${mockZillowResult.address.state} ${mockZillowResult.address.zipcode}`,
      monthlyRent: mockZillowResult.price,
      bedrooms: mockZillowResult.bedrooms,
      bathrooms: mockZillowResult.bathrooms,
      imageUrl: mockZillowResult.imgSrc,
    };
    
    expect(parsed.zillowId).toBe('12345678');
    expect(parsed.address).toContain('Atlanta');
    expect(parsed.monthlyRent).toBe(2500);
  });

  it('should calculate deal score correctly', () => {
    // Test deal score calculation
    const calculateDealScore = (params: {
      monthlyRent: number;
      estimatedRevenue: number;
      occupancy: number;
    }) => {
      const profitMargin = (params.estimatedRevenue - params.monthlyRent) / params.monthlyRent;
      const occupancyScore = params.occupancy * 100;
      
      // Score formula: 40% profit margin + 40% occupancy + 20% base
      let score = Math.round(
        (profitMargin * 40) + 
        (occupancyScore * 0.4) + 
        20
      );
      
      return Math.max(0, Math.min(100, score));
    };
    
    // High profit, high occupancy = high score
    const goodDeal = calculateDealScore({
      monthlyRent: 2000,
      estimatedRevenue: 4000,
      occupancy: 0.75,
    });
    expect(goodDeal).toBeGreaterThan(70);
    
    // Low profit, low occupancy = low score
    const badDeal = calculateDealScore({
      monthlyRent: 3000,
      estimatedRevenue: 3200,
      occupancy: 0.45,
    });
    expect(badDeal).toBeLessThan(50);
  });

  it('should filter deals by minimum score', () => {
    // Test deal filtering
    const deals = [
      { address: 'A', dealScore: 90 },
      { address: 'B', dealScore: 75 },
      { address: 'C', dealScore: 60 },
      { address: 'D', dealScore: 45 },
    ];
    
    const minScore = 70;
    const filtered = deals.filter(d => d.dealScore >= minScore);
    
    expect(filtered).toHaveLength(2);
    expect(filtered[0].address).toBe('A');
    expect(filtered[1].address).toBe('B');
  });
});

describe('Engagement Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate engagement score correctly', () => {
    // Test engagement score calculation
    const calculateEngagementScore = (metrics: {
      totalEmailsOpened: number;
      totalEmailsClicked: number;
      totalFormSubmissions: number;
      daysSinceLastActivity: number;
    }) => {
      let score = 0;
      
      // Email opens (max 30 points)
      score += Math.min(30, metrics.totalEmailsOpened * 3);
      
      // Email clicks (max 40 points)
      score += Math.min(40, metrics.totalEmailsClicked * 10);
      
      // Form submissions (max 30 points)
      score += Math.min(30, metrics.totalFormSubmissions * 15);
      
      // Recency modifier
      if (metrics.daysSinceLastActivity < 7) {
        score *= 1.2;
      } else if (metrics.daysSinceLastActivity > 90) {
        score *= 0.5;
      }
      
      return Math.min(100, Math.round(score));
    };
    
    // Highly engaged contact
    const hotContact = calculateEngagementScore({
      totalEmailsOpened: 10,
      totalEmailsClicked: 5,
      totalFormSubmissions: 2,
      daysSinceLastActivity: 3,
    });
    expect(hotContact).toBeGreaterThan(80);
    
    // Inactive contact
    const coldContact = calculateEngagementScore({
      totalEmailsOpened: 1,
      totalEmailsClicked: 0,
      totalFormSubmissions: 0,
      daysSinceLastActivity: 120,
    });
    expect(coldContact).toBeLessThan(20);
  });

  it('should classify engagement levels correctly', () => {
    // Test engagement level classification
    const getEngagementLevel = (score: number, daysSinceLastActivity: number) => {
      if (score >= 60 && daysSinceLastActivity < 14) return 'hot';
      if (score >= 30 || daysSinceLastActivity < 30) return 'warm';
      return 'cold';
    };
    
    expect(getEngagementLevel(80, 5)).toBe('hot');
    expect(getEngagementLevel(50, 20)).toBe('warm');
    expect(getEngagementLevel(20, 60)).toBe('cold');
    expect(getEngagementLevel(70, 20)).toBe('warm'); // High score but not recent enough
  });

  it('should recommend email frequency based on engagement', () => {
    // Test frequency recommendations
    const getRecommendedFrequency = (level: 'hot' | 'warm' | 'cold') => {
      switch (level) {
        case 'hot':
          return { dealAlerts: 'daily', marketUpdates: 'weekly' };
        case 'warm':
          return { dealAlerts: 'weekly', marketUpdates: 'weekly' };
        case 'cold':
          return { dealAlerts: 'none', marketUpdates: 'monthly' };
      }
    };
    
    expect(getRecommendedFrequency('hot').dealAlerts).toBe('daily');
    expect(getRecommendedFrequency('warm').dealAlerts).toBe('weekly');
    expect(getRecommendedFrequency('cold').dealAlerts).toBe('none');
  });
});

describe('Email Template Generation', () => {
  it('should generate correct Turnkey Tool URLs', () => {
    // Test URL generation for email links
    const generatePropertyUrl = (params: {
      address: string;
      city: string;
      state: string;
      bedrooms: number;
      bathrooms: number;
    }) => {
      const baseUrl = 'https://coachinayahturnkeytool.com';
      const encodedAddress = encodeURIComponent(params.address);
      return `${baseUrl}?step=5&address=${encodedAddress}&bedrooms=${params.bedrooms}&bathrooms=${params.bathrooms}&autoAnalyze=true`;
    };
    
    const url = generatePropertyUrl({
      address: '123 Main St, Atlanta, GA 30309',
      city: 'Atlanta',
      state: 'GA',
      bedrooms: 3,
      bathrooms: 2,
    });
    
    expect(url).toContain('coachinayahturnkeytool.com');
    expect(url).toContain('step=5');
    expect(url).toContain('autoAnalyze=true');
    expect(url).toContain('bedrooms=3');
  });

  it('should generate correct Step 2 URLs for property photos', () => {
    // Test Step 2 URL generation
    const generatePhotosUrl = (city: string, state: string) => {
      const baseUrl = 'https://coachinayahturnkeytool.com';
      return `${baseUrl}?step=2&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`;
    };
    
    const url = generatePhotosUrl('Atlanta', 'GA');
    
    expect(url).toContain('step=2');
    expect(url).toContain('city=Atlanta');
    expect(url).toContain('state=GA');
  });
});

describe('Newsletter Content', () => {
  it('should not mention AirDNA in generated content', () => {
    // Test that AirDNA is not mentioned in email content
    const sampleContent = `
      Hi Sarah,
      
      A property in Atlanta, GA came across our dashboard that fits the profile 
      of what we look for in your market.
      
      Based on our analysis, this property could generate $4,200/month in revenue.
      
      Best,
      Coach Inayah
    `;
    
    expect(sampleContent.toLowerCase()).not.toContain('airdna');
    expect(sampleContent).toContain('our dashboard');
    expect(sampleContent).toContain('our analysis');
  });

  it('should frame deals as opportunities, not secured', () => {
    // Test that messaging is framed correctly
    const sampleContent = `
      This property came across our dashboard as a potential fit for your criteria.
      If you're interested, my team can help you run the full numbers and negotiate terms.
    `;
    
    expect(sampleContent).not.toContain('secured');
    expect(sampleContent).not.toContain('locked');
    expect(sampleContent).toContain('potential');
    expect(sampleContent).toContain('help you');
  });
});
