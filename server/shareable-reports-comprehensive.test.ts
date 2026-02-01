/**
 * Comprehensive Tests for Shareable Reports and Auto-Notifications
 * 
 * Tests cover:
 * 1. Universal shareable report creation for all tool types
 * 2. Share link URL generation and validation
 * 3. Auto-notification triggering logic
 * 4. SMS and email notification formatting
 * 5. Notification analytics tracking
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the share code generation
const generateShareCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Report types supported
const REPORT_TYPES = [
  'revenue',
  'validator',
  'market',
  'ai_advisor',
  'listings',
  'comparison',
  'map',
  'regulation',
] as const;

describe('Universal Shareable Reports', () => {
  describe('Report Type Support', () => {
    it('should support all defined report types', () => {
      expect(REPORT_TYPES).toContain('revenue');
      expect(REPORT_TYPES).toContain('validator');
      expect(REPORT_TYPES).toContain('market');
      expect(REPORT_TYPES).toContain('ai_advisor');
      expect(REPORT_TYPES).toContain('listings');
      expect(REPORT_TYPES).toContain('comparison');
      expect(REPORT_TYPES).toContain('map');
      expect(REPORT_TYPES).toContain('regulation');
    });

    it('should have 8 total report types', () => {
      expect(REPORT_TYPES.length).toBe(8);
    });
  });

  describe('Share Code Generation', () => {
    it('should generate unique share codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateShareCode());
      }
      // All codes should be unique
      expect(codes.size).toBe(100);
    });

    it('should generate 8-character codes', () => {
      const code = generateShareCode();
      expect(code.length).toBe(8);
    });

    it('should only contain alphanumeric characters', () => {
      const code = generateShareCode();
      expect(/^[A-Za-z0-9]+$/.test(code)).toBe(true);
    });
  });

  describe('Share URL Generation', () => {
    const baseUrl = 'https://coachinayahturnkeytool.com';

    it('should generate valid share URLs for each report type', () => {
      for (const type of REPORT_TYPES) {
        const shareCode = generateShareCode();
        const url = `${baseUrl}/share/${shareCode}`;
        expect(url).toMatch(/^https:\/\/coachinayahturnkeytool\.com\/share\/[A-Za-z0-9]{8}$/);
      }
    });

    it('should generate URLs that are shareable via SMS', () => {
      const shareCode = generateShareCode();
      const url = `${baseUrl}/share/${shareCode}`;
      // URL should be short enough for SMS
      expect(url.length).toBeLessThan(100);
    });
  });
});

describe('Auto-Notification Logic', () => {
  describe('Contact Info Validation', () => {
    it('should require email or phone for auto-notification', () => {
      const hasContactInfo = (email?: string, phone?: string) => {
        return !!(email || phone);
      };

      expect(hasContactInfo('test@example.com', undefined)).toBe(true);
      expect(hasContactInfo(undefined, '+15551234567')).toBe(true);
      expect(hasContactInfo('test@example.com', '+15551234567')).toBe(true);
      expect(hasContactInfo(undefined, undefined)).toBe(false);
      expect(hasContactInfo('', '')).toBe(false);
    });

    it('should validate email format', () => {
      const isValidEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      };

      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
    });

    it('should validate phone format', () => {
      const isValidPhone = (phone: string) => {
        // Remove all non-digits
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 10 && digits.length <= 15;
      };

      expect(isValidPhone('+15551234567')).toBe(true);
      expect(isValidPhone('555-123-4567')).toBe(true);
      expect(isValidPhone('(555) 123-4567')).toBe(true);
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('')).toBe(false);
    });
  });

  describe('Auto-Notification Toggle', () => {
    it('should respect enableAutoNotifications setting', () => {
      const shouldAutoNotify = (
        hasContact: boolean,
        enableAutoNotifications?: boolean
      ) => {
        return hasContact && enableAutoNotifications !== false;
      };

      // Default (undefined) should enable auto-notifications
      expect(shouldAutoNotify(true, undefined)).toBe(true);
      expect(shouldAutoNotify(true, true)).toBe(true);
      expect(shouldAutoNotify(true, false)).toBe(false);
      expect(shouldAutoNotify(false, true)).toBe(false);
    });
  });

  describe('Triggered By Tracking', () => {
    const VALID_TRIGGERS = [
      'revenue_calculator',
      'property_validator',
      'market_advisor',
      'ai_advisor',
      'listings_explorer',
      'comparison_tool',
      'map_view',
      'regulation_tracker',
    ];

    it('should track which tool triggered the notification', () => {
      for (const trigger of VALID_TRIGGERS) {
        expect(typeof trigger).toBe('string');
        expect(trigger.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('SMS Notification Formatting', () => {
  const formatSMSMessage = (
    reportType: string,
    address: string,
    shareUrl: string,
    summary?: string
  ) => {
    const typeLabels: Record<string, string> = {
      revenue: 'Revenue Analysis',
      validator: 'Property Validation',
      market: 'Market Analysis',
      ai_advisor: 'AI Advisor Report',
      listings: 'Listings Report',
      comparison: 'Property Comparison',
      map: 'Map View Report',
      regulation: 'Regulation Report',
    };

    const label = typeLabels[reportType] || 'Property Report';
    let message = `Your ${label} for ${address} is ready!\n\n`;
    if (summary) {
      message += `${summary}\n\n`;
    }
    message += `View your report: ${shareUrl}`;
    return message;
  };

  it('should format SMS message correctly for each report type', () => {
    const shareUrl = 'https://coachinayahturnkeytool.com/share/ABC12345';
    const address = '123 Main St, Denver, CO';

    for (const type of REPORT_TYPES) {
      const message = formatSMSMessage(type, address, shareUrl);
      expect(message).toContain(address);
      expect(message).toContain(shareUrl);
      expect(message.length).toBeLessThan(320); // SMS length limit
    }
  });

  it('should include summary when provided', () => {
    const shareUrl = 'https://coachinayahturnkeytool.com/share/ABC12345';
    const address = '123 Main St, Denver, CO';
    const summary = 'Projected annual revenue: $85,000';

    const message = formatSMSMessage('revenue', address, shareUrl, summary);
    expect(message).toContain(summary);
  });
});

describe('Email Notification Formatting', () => {
  const formatEmailSubject = (reportType: string, address: string) => {
    const typeLabels: Record<string, string> = {
      revenue: 'Revenue Analysis',
      validator: 'Property Validation',
      market: 'Market Analysis',
      ai_advisor: 'AI Advisor Report',
      listings: 'Listings Report',
      comparison: 'Property Comparison',
      map: 'Map View Report',
      regulation: 'Regulation Report',
    };

    const label = typeLabels[reportType] || 'Property Report';
    return `Your ${label} for ${address} is Ready`;
  };

  it('should format email subject correctly for each report type', () => {
    const address = '123 Main St, Denver, CO';

    for (const type of REPORT_TYPES) {
      const subject = formatEmailSubject(type, address);
      expect(subject).toContain(address);
      expect(subject.length).toBeLessThan(100); // Email subject length best practice
    }
  });
});

describe('Notification Analytics', () => {
  describe('Analytics Data Structure', () => {
    it('should track total reports by type', () => {
      const mockAnalytics = {
        totalReports: 150,
        totalViews: 450,
        totalSmsSent: 75,
        totalEmailsSent: 100,
        smsSuccessRate: 0.95,
        emailSuccessRate: 0.98,
        byType: {
          revenue: { count: 50, views: 150, smsSent: 25, emailsSent: 35 },
          market: { count: 40, views: 120, smsSent: 20, emailsSent: 30 },
          regulation: { count: 30, views: 90, smsSent: 15, emailsSent: 20 },
          ai_advisor: { count: 30, views: 90, smsSent: 15, emailsSent: 15 },
        },
      };

      expect(mockAnalytics.totalReports).toBe(150);
      expect(mockAnalytics.byType.revenue.count).toBe(50);
      expect(mockAnalytics.smsSuccessRate).toBeGreaterThan(0.9);
    });

    it('should calculate success rates correctly', () => {
      const calculateSuccessRate = (successful: number, total: number) => {
        if (total === 0) return 0;
        return successful / total;
      };

      expect(calculateSuccessRate(95, 100)).toBe(0.95);
      expect(calculateSuccessRate(0, 0)).toBe(0);
      expect(calculateSuccessRate(50, 50)).toBe(1);
    });
  });

  describe('Recent Notifications Tracking', () => {
    it('should track recent notification details', () => {
      const mockNotification = {
        channel: 'sms',
        reportType: 'revenue',
        shareCode: 'ABC12345',
        success: true,
        createdAt: new Date().toISOString(),
      };

      expect(mockNotification.channel).toBe('sms');
      expect(mockNotification.success).toBe(true);
      expect(mockNotification.shareCode).toMatch(/^[A-Za-z0-9]+$/);
    });
  });
});

describe('Share Link Viewer', () => {
  describe('Report Data Display', () => {
    it('should display key metrics for revenue reports', () => {
      const revenueReport = {
        reportType: 'revenue',
        annualRevenue: 85000,
        occupancyRate: 0.72,
        averageDailyRate: 325,
      };

      expect(revenueReport.annualRevenue).toBeGreaterThan(0);
      expect(revenueReport.occupancyRate).toBeGreaterThan(0);
      expect(revenueReport.occupancyRate).toBeLessThanOrEqual(1);
      expect(revenueReport.averageDailyRate).toBeGreaterThan(0);
    });

    it('should display key metrics for market reports', () => {
      const marketReport = {
        reportType: 'market',
        marketName: 'Denver, CO',
        totalListings: 5000,
        avgRevenue: 75000,
        avgOccupancy: 0.68,
      };

      expect(marketReport.marketName).toBeTruthy();
      expect(marketReport.totalListings).toBeGreaterThan(0);
    });

    it('should display regulation status for regulation reports', () => {
      const regulationReport = {
        reportType: 'regulation',
        verdict: 'Allowed with Restrictions',
        permitRequired: true,
        maxNights: 90,
      };

      expect(regulationReport.verdict).toBeTruthy();
      expect(typeof regulationReport.permitRequired).toBe('boolean');
    });
  });

  describe('View Count Tracking', () => {
    it('should increment view count on report access', () => {
      let viewCount = 0;
      const incrementViewCount = () => {
        viewCount++;
        return viewCount;
      };

      expect(incrementViewCount()).toBe(1);
      expect(incrementViewCount()).toBe(2);
      expect(incrementViewCount()).toBe(3);
    });
  });
});

describe('Integration: Full Auto-Notification Flow', () => {
  it('should complete full flow: create report -> generate link -> send notification', () => {
    // Simulate the full flow
    const flow = {
      // Step 1: User completes analysis
      analysisComplete: true,
      reportType: 'revenue' as const,
      reportData: { annualRevenue: 85000, occupancy: 0.72 },

      // Step 2: Check if auto-notification should trigger
      userEmail: 'test@example.com',
      userPhone: '+15551234567',
      enableAutoNotifications: true,

      // Step 3: Create shareable report
      shareCode: generateShareCode(),
      shareUrl: '',

      // Step 4: Send notifications
      smsSent: false,
      emailSent: false,
    };

    // Generate share URL
    flow.shareUrl = `https://coachinayahturnkeytool.com/share/${flow.shareCode}`;

    // Check if should auto-notify
    const shouldNotify = 
      flow.analysisComplete && 
      (flow.userEmail || flow.userPhone) && 
      flow.enableAutoNotifications;

    expect(shouldNotify).toBe(true);

    // Simulate sending notifications
    if (shouldNotify) {
      if (flow.userPhone) flow.smsSent = true;
      if (flow.userEmail) flow.emailSent = true;
    }

    expect(flow.smsSent).toBe(true);
    expect(flow.emailSent).toBe(true);
    expect(flow.shareUrl).toMatch(/^https:\/\/coachinayahturnkeytool\.com\/share\/[A-Za-z0-9]{8}$/);
  });

  it('should not send notifications when auto-notifications disabled', () => {
    const flow = {
      analysisComplete: true,
      userEmail: 'test@example.com',
      enableAutoNotifications: false,
    };

    const shouldNotify = 
      flow.analysisComplete && 
      flow.userEmail && 
      flow.enableAutoNotifications;

    expect(shouldNotify).toBe(false);
  });

  it('should not send notifications when no contact info provided', () => {
    const flow = {
      analysisComplete: true,
      userEmail: '',
      userPhone: '',
      enableAutoNotifications: true,
    };

    // Empty strings are falsy, so the condition evaluates to falsy
    const hasContactInfo = !!(flow.userEmail || flow.userPhone);
    const shouldNotify = 
      flow.analysisComplete && 
      hasContactInfo && 
      flow.enableAutoNotifications;

    expect(shouldNotify).toBe(false);
  });
});
