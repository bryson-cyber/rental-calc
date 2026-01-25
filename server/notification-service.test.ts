import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('./_core/notification', () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue(null), // Return null to skip DB operations in tests
}));

import { 
  notifyOwnerPropertyReport, 
  notifyOwnerMarketReport,
  type PropertyReportNotification,
  type MarketReportNotification
} from './notification-service';
import { notifyOwner } from './_core/notification';

describe('Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notifyOwnerPropertyReport', () => {
    it('should send notification with property details', async () => {
      const mockData: PropertyReportNotification = {
        address: '123 Main St, Denver, CO 80202',
        city: 'Denver',
        state: 'CO',
        bedrooms: 3,
        bathrooms: 2,
        annualRevenue: 85000,
        occupancyRate: 0.72,
        verdict: 'GO',
      };

      const result = await notifyOwnerPropertyReport(mockData);

      expect(result).toBe(true);
      expect(notifyOwner).toHaveBeenCalledTimes(1);
      
      const call = vi.mocked(notifyOwner).mock.calls[0][0];
      expect(call.title).toContain('New Property Report');
      expect(call.title).toContain('123 Main St');
      expect(call.content).toContain('Denver, CO');
      expect(call.content).toContain('3 BR / 2 BA');
      expect(call.content).toContain('$85,000');
      expect(call.content).toContain('72%');
      expect(call.content).toContain('GO');
    });

    it('should handle missing optional fields', async () => {
      const mockData: PropertyReportNotification = {
        address: '456 Oak Ave',
      };

      const result = await notifyOwnerPropertyReport(mockData);

      expect(result).toBe(true);
      expect(notifyOwner).toHaveBeenCalledTimes(1);
      
      const call = vi.mocked(notifyOwner).mock.calls[0][0];
      expect(call.title).toContain('456 Oak Ave');
    });
  });

  describe('notifyOwnerMarketReport', () => {
    it('should send notification with market details', async () => {
      const mockData: MarketReportNotification = {
        marketName: 'Denver',
        state: 'CO',
        bedrooms: 2,
        averageRevenue: 65000,
        averageOccupancy: 0.68,
        listingCount: 1500,
      };

      const result = await notifyOwnerMarketReport(mockData);

      expect(result).toBe(true);
      expect(notifyOwner).toHaveBeenCalledTimes(1);
      
      const call = vi.mocked(notifyOwner).mock.calls[0][0];
      expect(call.title).toContain('New Market Report');
      expect(call.title).toContain('Denver');
      expect(call.content).toContain('Denver, CO');
      expect(call.content).toContain('$65,000');
      expect(call.content).toContain('68%');
      expect(call.content).toContain('1,500');
    });

    it('should handle market without state', async () => {
      const mockData: MarketReportNotification = {
        marketName: 'Austin',
      };

      const result = await notifyOwnerMarketReport(mockData);

      expect(result).toBe(true);
      expect(notifyOwner).toHaveBeenCalledTimes(1);
      
      const call = vi.mocked(notifyOwner).mock.calls[0][0];
      expect(call.title).toContain('Austin');
    });
  });
});
