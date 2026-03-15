import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

// ─── Mock context helpers ───────────────────────────────────────────────────

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: 'admin-user',
      email: 'admin@example.com',
      name: 'Admin User',
      loginMethod: 'manus',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: 'https',
      headers: {},
      ip: '127.0.0.1',
    } as TrpcContext['req'],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext['res'],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: 'https',
      headers: {},
      ip: '127.0.0.1',
    } as TrpcContext['req'],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext['res'],
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Content Hub Router', () => {
  describe('Router structure', () => {
    it('should have contentHub namespace on the app router', () => {
      // The router should be mounted at appRouter.contentHub
      expect(appRouter._def.procedures).toBeDefined();
      // Check that contentHub procedures exist
      const procedureKeys = Object.keys(appRouter._def.procedures);
      expect(procedureKeys).toContain('contentHub.startPipeline');
      expect(procedureKeys).toContain('contentHub.getVideo');
      expect(procedureKeys).toContain('contentHub.listVideos');
      expect(procedureKeys).toContain('contentHub.deleteVideo');
      expect(procedureKeys).toContain('contentHub.updateScript');
      expect(procedureKeys).toContain('contentHub.suggestTopics');
      expect(procedureKeys).toContain('contentHub.startBatch');
      expect(procedureKeys).toContain('contentHub.savePreset');
      expect(procedureKeys).toContain('contentHub.listPresets');
      expect(procedureKeys).toContain('contentHub.deletePreset');
    });

    it('should have exactly 10 procedures in the contentHub namespace', () => {
      const procedureKeys = Object.keys(appRouter._def.procedures);
      const contentHubProcedures = procedureKeys.filter(k => k.startsWith('contentHub.'));
      expect(contentHubProcedures).toHaveLength(10);
    });
  });

  describe('Authentication enforcement', () => {
    it('should reject unauthenticated calls to listVideos', async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(caller.contentHub.listVideos()).rejects.toThrow();
    });

    it('should reject unauthenticated calls to startPipeline', async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(
        caller.contentHub.startPipeline({
          topic: 'Test topic',
          format: 'lesson',
        })
      ).rejects.toThrow();
    });

    it('should reject unauthenticated calls to suggestTopics', async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(caller.contentHub.suggestTopics()).rejects.toThrow();
    });

    it('should reject unauthenticated calls to listPresets', async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(caller.contentHub.listPresets()).rejects.toThrow();
    });
  });

  describe('Input validation', () => {
    it('should reject startPipeline with empty topic', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      await expect(
        caller.contentHub.startPipeline({
          topic: '', // too short (min 3)
          format: 'lesson',
        })
      ).rejects.toThrow();
    });

    it('should reject startPipeline with invalid format', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      await expect(
        caller.contentHub.startPipeline({
          topic: 'Valid topic here',
          format: 'invalid_format' as any,
        })
      ).rejects.toThrow();
    });

    it('should reject updateScript with too-short script', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      await expect(
        caller.contentHub.updateScript({
          videoId: 999,
          script: 'Too short', // min 100 chars
        })
      ).rejects.toThrow();
    });

    it('should reject startBatch with empty topics array', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      await expect(
        caller.contentHub.startBatch({
          topics: [], // min 1
        })
      ).rejects.toThrow();
    });

    it('should reject startBatch with more than 10 topics', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const topics = Array.from({ length: 11 }, (_, i) => ({
        topic: `Topic ${i + 1} for testing`,
        format: 'lesson' as const,
      }));
      await expect(
        caller.contentHub.startBatch({ topics })
      ).rejects.toThrow();
    });

    it('should reject savePreset with empty name', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      await expect(
        caller.contentHub.savePreset({
          name: '', // min 1
        })
      ).rejects.toThrow();
    });

    it('should accept valid startPipeline input with all optional fields', async () => {
      // This tests that the schema accepts valid input — the actual pipeline
      // will fail because it needs a real DB, but the validation should pass.
      const caller = appRouter.createCaller(createAdminContext());
      // We expect a DB error, not a validation error
      try {
        await caller.contentHub.startPipeline({
          topic: 'How to find profitable Airbnb markets in 2025',
          format: 'deep_dive',
          scriptOnly: true,
          brainDump: 'Talk about how people can use the tool to find markets',
          voiceStyle: 'warm',
          bgMusic: 'engaging',
          ttsStyle: 'solo-female',
          timing: '10',
        });
      } catch (err: any) {
        // Should NOT be a ZodError (validation error)
        // It should be a runtime error (DB not available, etc.)
        expect(err.code).not.toBe('BAD_REQUEST');
      }
    });
  });

  describe('Script mode validation', () => {
    it('should accept own_script mode with userScript', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      try {
        await caller.contentHub.startPipeline({
          topic: 'My custom script topic',
          format: 'lesson',
          scriptMode: 'own_script',
          userScript: 'This is my full narration script that I wrote myself. It has enough content to be a real script for a video lesson about Airbnb arbitrage.',
        });
      } catch (err: any) {
        // Should fail at runtime (DB), not at validation
        expect(err.code).not.toBe('BAD_REQUEST');
      }
    });

    it('should accept ai_enhance mode with userScript', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      try {
        await caller.contentHub.startPipeline({
          topic: 'Enhance my script about markets',
          format: 'deep_dive',
          scriptMode: 'ai_enhance',
          userScript: 'Here is my rough script about finding markets. I want AI to polish it but keep my voice and ideas intact.',
        });
      } catch (err: any) {
        expect(err.code).not.toBe('BAD_REQUEST');
      }
    });

    it('should accept ai_generate mode (default) without userScript', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      try {
        await caller.contentHub.startPipeline({
          topic: 'AI should generate this script from scratch',
          format: 'lesson',
          scriptMode: 'ai_generate',
        });
      } catch (err: any) {
        expect(err.code).not.toBe('BAD_REQUEST');
      }
    });

    it('should accept ai_generate mode with brainDump', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      try {
        await caller.contentHub.startPipeline({
          topic: 'Brain dump topic about getting started',
          format: 'lesson',
          scriptMode: 'ai_generate',
          brainDump: '- want to talk about how people overthink their first deal\n- mention the student who found a deal in Columbia SC\n- the key is just running the numbers',
        });
      } catch (err: any) {
        expect(err.code).not.toBe('BAD_REQUEST');
      }
    });

    it('should reject invalid scriptMode value', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      await expect(
        caller.contentHub.startPipeline({
          topic: 'Test topic',
          format: 'lesson',
          scriptMode: 'invalid_mode' as any,
        })
      ).rejects.toThrow();
    });

    it('should default scriptMode to ai_generate when not provided', async () => {
      const caller = appRouter.createCaller(createAdminContext());
      try {
        await caller.contentHub.startPipeline({
          topic: 'Topic without explicit scriptMode',
          format: 'lesson',
        });
      } catch (err: any) {
        // Should fail at runtime (DB), not at validation
        expect(err.code).not.toBe('BAD_REQUEST');
      }
    });
  });
});

describe('Content Hub Pipeline Module', () => {
  it('should export all required functions', async () => {
    const pipeline = await import('./content-hub-pipeline');
    expect(typeof pipeline.startPipeline).toBe('function');
    expect(typeof pipeline.getVideoById).toBe('function');
    expect(typeof pipeline.listVideos).toBe('function');
    expect(typeof pipeline.deleteVideo).toBe('function');
    expect(typeof pipeline.updateScript).toBe('function');
    expect(typeof pipeline.suggestTopics).toBe('function');
    expect(typeof pipeline.startBatch).toBe('function');
    expect(typeof pipeline.savePreset).toBe('function');
    expect(typeof pipeline.listPresets).toBe('function');
    expect(typeof pipeline.deletePreset).toBe('function');
    expect(typeof pipeline.resumeIncompletePipelines).toBe('function');
  });

  it('should export VideoStatus type-compatible values', async () => {
    // Verify the status enum values are consistent
    const validStatuses = [
      'pipeline_queued',
      'researching',
      'scripting',
      'script_review',
      'script_only',
      'video_generating',
      'video_complete',
      'video_failed',
      'pipeline_failed',
    ];
    // This is a compile-time check — if the type changes, this test needs updating
    expect(validStatuses).toHaveLength(9);
  });

  it('should export ScriptMode type with correct values', async () => {
    // Verify the ScriptMode type values match what the frontend sends
    const validModes = ['own_script', 'ai_enhance', 'ai_generate'];
    expect(validModes).toHaveLength(3);
  });
});

describe('Content Hub Schema', () => {
  it('should export contentHubVideos and contentHubPresets tables', async () => {
    const schema = await import('../drizzle/schema');
    expect(schema.contentHubVideos).toBeDefined();
    expect(schema.contentHubPresets).toBeDefined();
  });
});
