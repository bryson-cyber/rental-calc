/**
 * Tests for webhook-auto-config.ts
 * 
 * Tests the SimpleTexting webhook auto-configuration and
 * WebinarJam registrant polling logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../simpletexting-client', () => ({
  listWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
}));

vi.mock('../db', () => ({
  getDb: vi.fn(),
}));

vi.mock('../webinar-engine', () => ({
  syncRegistrants: vi.fn(),
}));

vi.mock('../_core/env', () => ({
  ENV: {
    simpletextingApiKey: 'test-st-key',
    webinarjamApiKey: 'test-wj-key',
  },
}));

import {
  ensureSimpleTextingWebhook,
  pollWebinarJamRegistrants,
  startWebinarJamPolling,
  stopWebinarJamPolling,
  isPollingActive,
} from '../webhook-auto-config';

import { listWebhooks, createWebhook, deleteWebhook } from '../simpletexting-client';
import { getDb } from '../db';
import { syncRegistrants } from '../webinar-engine';

const mockListWebhooks = vi.mocked(listWebhooks);
const mockCreateWebhook = vi.mocked(createWebhook);
const mockDeleteWebhook = vi.mocked(deleteWebhook);
const mockGetDb = vi.mocked(getDb);
const mockSyncRegistrants = vi.mocked(syncRegistrants);

describe('webhook-auto-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopWebinarJamPolling();
  });

  // =========================================================================
  // ensureSimpleTextingWebhook
  // =========================================================================

  describe('ensureSimpleTextingWebhook', () => {
    it('should return already_configured when webhook exists', async () => {
      mockListWebhooks.mockResolvedValue([
        {
          id: 'wh-123',
          url: 'https://coachinayahturnkeytool.com/api/webhooks/simpletexting',
          triggers: ['INCOMING_MESSAGE', 'UNSUBSCRIBE_REPORT'],
        },
      ] as any);

      const result = await ensureSimpleTextingWebhook();

      expect(result.status).toBe('already_configured');
      expect(result.webhookId).toBe('wh-123');
      expect(mockCreateWebhook).not.toHaveBeenCalled();
    });

    it('should create webhook when none exists', async () => {
      mockListWebhooks.mockResolvedValue([]);
      mockCreateWebhook.mockResolvedValue({ id: 'wh-new-456' } as any);

      const result = await ensureSimpleTextingWebhook();

      expect(result.status).toBe('created');
      expect(result.webhookId).toBe('wh-new-456');
      expect(mockCreateWebhook).toHaveBeenCalledWith({
        url: 'https://coachinayahturnkeytool.com/api/webhooks/simpletexting',
        triggers: ['INCOMING_MESSAGE', 'UNSUBSCRIBE_REPORT'],
        requestPerSecLimit: 15,
      });
    });

    it('should remove stale webhooks pointing to our domain with wrong URL', async () => {
      mockListWebhooks.mockResolvedValue([
        {
          id: 'wh-stale',
          url: 'https://coachinayahturnkeytool.com/api/old-webhook',
          triggers: ['INCOMING_MESSAGE'],
        },
      ] as any);
      mockDeleteWebhook.mockResolvedValue(undefined as any);
      mockCreateWebhook.mockResolvedValue({ id: 'wh-new' } as any);

      const result = await ensureSimpleTextingWebhook();

      expect(mockDeleteWebhook).toHaveBeenCalledWith('wh-stale');
      expect(result.status).toBe('created');
    });

    it('should handle API errors gracefully', async () => {
      mockListWebhooks.mockRejectedValue(new Error('API rate limit'));

      const result = await ensureSimpleTextingWebhook();

      expect(result.status).toBe('error');
      expect(result.error).toContain('API rate limit');
    });

    it('should not match webhook without INCOMING_MESSAGE trigger', async () => {
      mockListWebhooks.mockResolvedValue([
        {
          id: 'wh-wrong',
          url: 'https://coachinayahturnkeytool.com/api/webhooks/simpletexting',
          triggers: ['DELIVERY_REPORT'],
        },
      ] as any);
      mockCreateWebhook.mockResolvedValue({ id: 'wh-new' } as any);

      const result = await ensureSimpleTextingWebhook();

      expect(result.status).toBe('created');
    });
  });

  // =========================================================================
  // pollWebinarJamRegistrants
  // =========================================================================

  describe('pollWebinarJamRegistrants', () => {
    it('should return zeros when database is not available', async () => {
      mockGetDb.mockResolvedValue(null as any);

      const result = await pollWebinarJamRegistrants();

      expect(result).toEqual({ schedulesPolled: 0, newRegistrants: 0, errors: 0 });
    });

    it('should skip schedules without WebinarJam IDs', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 1, name: 'Test', isActive: 1, webinarjamWebinarId: null, webinarjamScheduleId: null },
        ]),
      };
      mockGetDb.mockResolvedValue(mockDb as any);

      const result = await pollWebinarJamRegistrants();

      expect(result.schedulesPolled).toBe(0);
      expect(mockSyncRegistrants).not.toHaveBeenCalled();
    });

    it('should poll schedules with WebinarJam IDs', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 1, name: 'Sunday Masterclass', isActive: 1, webinarjamWebinarId: 'wj-1', webinarjamScheduleId: 'ws-1' },
          { id: 2, name: 'Tuesday Webinar', isActive: 1, webinarjamWebinarId: 'wj-2', webinarjamScheduleId: 'ws-2' },
        ]),
      };
      mockGetDb.mockResolvedValue(mockDb as any);
      mockSyncRegistrants
        .mockResolvedValueOnce({ synced: 5, newRegistrants: 3, updated: 2, errors: 0 } as any)
        .mockResolvedValueOnce({ synced: 2, newRegistrants: 1, updated: 1, errors: 0 } as any);

      const result = await pollWebinarJamRegistrants();

      expect(result.schedulesPolled).toBe(2);
      expect(result.newRegistrants).toBe(4); // 3 + 1
      expect(result.errors).toBe(0);
      expect(mockSyncRegistrants).toHaveBeenCalledTimes(2);
    });

    it('should count errors when sync fails for a schedule', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 1, name: 'Failing', isActive: 1, webinarjamWebinarId: 'wj-1', webinarjamScheduleId: 'ws-1' },
        ]),
      };
      mockGetDb.mockResolvedValue(mockDb as any);
      mockSyncRegistrants.mockRejectedValue(new Error('WJ API down'));

      const result = await pollWebinarJamRegistrants();

      expect(result.schedulesPolled).toBe(1);
      expect(result.errors).toBe(1);
      expect(result.newRegistrants).toBe(0);
    });
  });

  // =========================================================================
  // Polling lifecycle
  // =========================================================================

  describe('polling lifecycle', () => {
    it('should track polling state correctly', () => {
      expect(isPollingActive()).toBe(false);

      // Mock the poll function to prevent actual API calls
      mockGetDb.mockResolvedValue(null as any);

      startWebinarJamPolling(60000); // 60s interval for test
      expect(isPollingActive()).toBe(true);

      stopWebinarJamPolling();
      expect(isPollingActive()).toBe(false);
    });

    it('should not double-start polling', () => {
      mockGetDb.mockResolvedValue(null as any);

      startWebinarJamPolling(60000);
      startWebinarJamPolling(60000); // Should be a no-op

      expect(isPollingActive()).toBe(true);

      stopWebinarJamPolling();
      expect(isPollingActive()).toBe(false);
    });
  });
});
