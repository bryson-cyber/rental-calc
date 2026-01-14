import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the activity module exports and types
describe('Admin Portal - Activity Tracking', () => {
  describe('ActionCategory enum', () => {
    it('should have correct category values', async () => {
      const { ActionCategory } = await import('../../server/activity');
      expect(ActionCategory.SEARCH).toBe('search');
      expect(ActionCategory.ANALYSIS).toBe('analysis');
      expect(ActionCategory.LEAD).toBe('lead');
      expect(ActionCategory.NAVIGATION).toBe('navigation');
      expect(ActionCategory.AUTH).toBe('auth');
      expect(ActionCategory.TOOL).toBe('tool');
    });
  });

  describe('ActionType enum', () => {
    it('should have correct action type values', async () => {
      const { ActionType } = await import('../../server/activity');
      expect(ActionType.PAGE_VIEW).toBe('page_view');
      expect(ActionType.MARKET_SEARCH).toBe('market_search');
      expect(ActionType.PROPERTY_ANALYSIS).toBe('property_analysis');
      expect(ActionType.LEAD_SUBMITTED).toBe('lead_submitted');
      expect(ActionType.REPORT_GENERATED).toBe('report_generated');
      expect(ActionType.LOGIN).toBe('login');
      expect(ActionType.LOGOUT).toBe('logout');
      expect(ActionType.DEEP_ANALYSIS_STARTED).toBe('deep_analysis_started');
      expect(ActionType.BULK_PROPERTY_COMPARE).toBe('bulk_property_compare');
    });
  });

  describe('Activity module exports', () => {
    it('should export logActivity function', async () => {
      const activity = await import('../../server/activity');
      expect(typeof activity.logActivity).toBe('function');
    });

    it('should export getActivityLogs function', async () => {
      const activity = await import('../../server/activity');
      expect(typeof activity.getActivityLogs).toBe('function');
    });

    it('should export getActivityStats function', async () => {
      const activity = await import('../../server/activity');
      expect(typeof activity.getActivityStats).toBe('function');
    });

    it('should export getRecentSessions function', async () => {
      const activity = await import('../../server/activity');
      expect(typeof activity.getRecentSessions).toBe('function');
    });

    it('should export getOrCreateSession function', async () => {
      const activity = await import('../../server/activity');
      expect(typeof activity.getOrCreateSession).toBe('function');
    });
  });

  describe('Admin router exports', () => {
    it('should export adminRouter', async () => {
      const adminRouterModule = await import('../../server/admin-router');
      expect(adminRouterModule.adminRouter).toBeDefined();
    });
  });
});
