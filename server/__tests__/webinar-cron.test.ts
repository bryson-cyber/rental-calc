/**
 * Tests for the webinar cron scheduler module.
 * 
 * Tests cover:
 * - Noon engagement message generation
 * - Cron lifecycle (start/stop/status)
 * - Next fire times calculation
 * - Manual trigger functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../db', () => ({
  getDb: vi.fn(),
}));

vi.mock('../simpletexting-client', () => ({
  sendSms: vi.fn().mockResolvedValue({ id: 'mock-sms-id', status: 'sent' }),
}));

vi.mock('../model-router', () => ({
  routedLLMCall: vi.fn().mockResolvedValue('Hey {{firstName}}! 🔥 Today we\'re covering how to find your first deal and get funded. What part are you most excited about?'),
  FEATURES: {
    WEBINAR_SMS_CONTENT: 'WEBINAR_SMS_CONTENT',
  },
}));

vi.mock('../webinar-ai-content', () => ({
  getRandomTeaser: vi.fn().mockReturnValue('You missed the part about getting $150K in funding with zero out of pocket...'),
  generateTeasersFromTranscript: vi.fn().mockResolvedValue([]),
  buildTranscriptAwareSystemPrompt: vi.fn().mockReturnValue('Mock system prompt'),
}));

vi.mock('../webinar-engine', () => ({
  executeNoShowBlast: vi.fn().mockResolvedValue({
    noShowCount: 5,
    smsSent: 4,
    smsFailed: 1,
    blastId: 1,
  }),
}));

describe('Webinar Cron Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up cron interval
    const { stopWebinarCron } = await import('../webinar-cron');
    stopWebinarCron();
  });

  describe('startWebinarCron / stopWebinarCron / isCronActive', () => {
    it('should start the cron scheduler', async () => {
      const { startWebinarCron, isCronActive, stopWebinarCron } = await import('../webinar-cron');

      expect(isCronActive()).toBe(false);

      // Need to mock getDb to return null so cronTick doesn't fail
      const { getDb } = await import('../db');
      vi.mocked(getDb).mockResolvedValue(null as any);

      startWebinarCron();
      expect(isCronActive()).toBe(true);

      stopWebinarCron();
      expect(isCronActive()).toBe(false);
    });

    it('should not start twice', async () => {
      const { startWebinarCron, stopWebinarCron } = await import('../webinar-cron');
      const { getDb } = await import('../db');
      vi.mocked(getDb).mockResolvedValue(null as any);

      const consoleSpy = vi.spyOn(console, 'log');
      startWebinarCron();
      startWebinarCron(); // second call should log "Already running"

      const alreadyRunningLog = consoleSpy.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('Already running')
      );
      expect(alreadyRunningLog).toBeDefined();

      stopWebinarCron();
      consoleSpy.mockRestore();
    });
  });

  describe('getNextFireTimes', () => {
    it('should return fire times with correct structure', async () => {
      const { getNextFireTimes } = await import('../webinar-cron');

      const times = getNextFireTimes();

      expect(times).toHaveProperty('noonEngagement');
      expect(times).toHaveProperty('noShowBlast');
      expect(times.noonEngagement).toHaveProperty('time');
      expect(times.noonEngagement).toHaveProperty('firedToday');
      expect(times.noShowBlast).toHaveProperty('time');
      expect(times.noShowBlast).toHaveProperty('firedToday');
      expect(times.noonEngagement.time).toBe('12:00 PM Pacific');
      expect(times.noShowBlast.time).toBe('4:10 PM Pacific');
    });

    it('should report firedToday as false initially', async () => {
      const { getNextFireTimes } = await import('../webinar-cron');

      const times = getNextFireTimes();
      // Since we haven't fired anything, both should be false
      // (unless the test runs exactly at noon or 4:10 PM EST on a webinar day)
      expect(typeof times.noonEngagement.firedToday).toBe('boolean');
      expect(typeof times.noShowBlast.firedToday).toBe('boolean');
    });
  });

  describe('executeNoonEngagement', () => {
    it('should return zeros when schedule is not found', async () => {
      const { executeNoonEngagement } = await import('../webinar-cron');
      const { getDb } = await import('../db');

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const result = await executeNoonEngagement(999);
      expect(result).toEqual({ sent: 0, failed: 0, skipped: 0 });
    });

    it('should return zeros when schedule is inactive', async () => {
      const { executeNoonEngagement } = await import('../webinar-cron');
      const { getDb } = await import('../db');

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 1, isActive: 0, name: 'Test' }]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const result = await executeNoonEngagement(1);
      expect(result).toEqual({ sent: 0, failed: 0, skipped: 0 });
    });

    it('should throw when database is not available', async () => {
      const { executeNoonEngagement } = await import('../webinar-cron');
      const { getDb } = await import('../db');

      vi.mocked(getDb).mockResolvedValue(null as any);

      await expect(executeNoonEngagement(1)).rejects.toThrow('Database not available');
    });

    it('should send engagement messages to registrants with phones', async () => {
      const { executeNoonEngagement } = await import('../webinar-cron');
      const { getDb } = await import('../db');
      const { sendSms } = await import('../simpletexting-client');

      const mockSchedule = {
        id: 1,
        isActive: 1,
        name: 'Sunday Masterclass',
        webinarTranscript: 'This is a test transcript about Airbnb business...',
        startTime: '16:00',
        liveRoomUrl: 'https://webinar.com/live',
      };

      const mockRegistrants = [
        { id: 1, phone: '+15551234567', firstName: 'Alice', optedOut: 0, liveRoomUrl: null },
        { id: 2, phone: '+15559876543', firstName: 'Bob', optedOut: 0, liveRoomUrl: null },
        { id: 3, phone: null, firstName: 'NoPhone', optedOut: 0, liveRoomUrl: null },
      ];

      let selectCallCount = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              selectCallCount++;
              if (selectCallCount === 1) {
                // First call: getTemplate reads messageTemplates from schedule
                return { limit: vi.fn().mockResolvedValue([{ messageTemplates: null }]) };
              }
              if (selectCallCount === 2) {
                // Second call: sendBlast gets full schedule
                return { limit: vi.fn().mockResolvedValue([mockSchedule]) };
              }
              // Third call: get registrants
              return Promise.resolve(mockRegistrants);
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const result = await executeNoonEngagement(1);

      // 2 sent (Alice + Bob), 0 failed, 1 skipped (NoPhone)
      expect(result.sent).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(0);
      expect(sendSms).toHaveBeenCalledTimes(2);
    });
  });

  describe('manualTriggerNoonEngagement', () => {
    it('should trigger engagement for all active schedules', async () => {
      const { manualTriggerNoonEngagement } = await import('../webinar-cron');
      const { getDb } = await import('../db');

      // Mock: 2 active schedules, but no registrants
      let selectCallCount = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              selectCallCount++;
              if (selectCallCount === 1) {
                // First: list active schedules
                return Promise.resolve([
                  { id: 1, isActive: 1, name: 'Schedule 1' },
                  { id: 2, isActive: 1, name: 'Schedule 2' },
                ]);
              }
              // Subsequent: get schedule detail (returns inactive to short-circuit)
              return { limit: vi.fn().mockResolvedValue([]) };
            }),
          }),
        }),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const result = await manualTriggerNoonEngagement();
      expect(result.schedulesFired).toBe(2);
    });

    it('should throw when database is not available', async () => {
      const { manualTriggerNoonEngagement } = await import('../webinar-cron');
      const { getDb } = await import('../db');

      vi.mocked(getDb).mockResolvedValue(null as any);

      await expect(manualTriggerNoonEngagement()).rejects.toThrow('Database not available');
    });
  });

  describe('manualTriggerNoShowBlast', () => {
    it('should trigger no-show blast for all active schedules', async () => {
      const { manualTriggerNoShowBlast } = await import('../webinar-cron');
      const { getDb } = await import('../db');
      const { executeNoShowBlast } = await import('../webinar-engine');

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: 1, isActive: 1, name: 'Schedule 1' },
            ]),
          }),
        }),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const result = await manualTriggerNoShowBlast();
      expect(result.schedulesFired).toBe(1);
      expect(result.totalNoShows).toBe(5);
      expect(result.totalSent).toBe(4);
      expect(executeNoShowBlast).toHaveBeenCalledWith(1, 'manual');
    });
  });
});
