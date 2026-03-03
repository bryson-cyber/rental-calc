import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Webinar Cache Service', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isWebinarMode', () => {
    it('should default to false when not initialized', async () => {
      const { isWebinarMode } = await import('./webinar-cache');
      expect(isWebinarMode()).toBe(false);
    });
  });

  describe('normalizeAddress', () => {
    it('should normalize addresses by lowercasing and trimming', async () => {
      const { normalizeAddress } = await import('./webinar-cache');
      const addr1 = normalizeAddress('  123 Main St, Denver, CO 80202  ');
      const addr2 = normalizeAddress('123 main st, denver, co 80202');
      expect(addr1).toBe(addr2);
    });

    it('should collapse multiple spaces', async () => {
      const { normalizeAddress } = await import('./webinar-cache');
      const addr = normalizeAddress('123   Main   St,  Denver,  CO  80202');
      expect(addr).toBe('123 main st, denver, co 80202');
    });

    it('should strip trailing punctuation', async () => {
      const { normalizeAddress } = await import('./webinar-cache');
      const addr = normalizeAddress('123 Main St, Denver, CO 80202.,');
      expect(addr).toBe('123 main st, denver, co 80202');
    });

    it('should produce consistent keys for matching', async () => {
      const { normalizeAddress } = await import('./webinar-cache');
      const a = normalizeAddress('4427 Bond St, San Diego, CA 92109, USA');
      const b = normalizeAddress('4427 bond st, san diego, ca 92109, usa');
      expect(a).toBe(b);
    });

    it('should handle empty string', async () => {
      const { normalizeAddress } = await import('./webinar-cache');
      expect(normalizeAddress('')).toBe('');
    });

    it('should handle already-normalized address', async () => {
      const { normalizeAddress } = await import('./webinar-cache');
      expect(normalizeAddress('123 main st')).toBe('123 main st');
    });
  });

  describe('module exports', () => {
    it('should export all expected functions', async () => {
      const mod = await import('./webinar-cache');
      expect(typeof mod.isWebinarMode).toBe('function');
      expect(typeof mod.toggleWebinarMode).toBe('function');
      expect(typeof mod.initWebinarMode).toBe('function');
      expect(typeof mod.normalizeAddress).toBe('function');
      expect(typeof mod.getStep5FromHistory).toBe('function');
      expect(typeof mod.cacheStep2Data).toBe('function');
      expect(typeof mod.cacheStep5Data).toBe('function');
      expect(typeof mod.getCachedStep2Data).toBe('function');
      expect(typeof mod.getCachedStep5Data).toBe('function');
      expect(typeof mod.getAllCachedProperties).toBe('function');
      expect(typeof mod.deleteCachedProperty).toBe('function');
    });
  });

  describe('rate limiter integration', () => {
    it('should have isWebinarMode accessible for rate limiter bypass', async () => {
      const { isWebinarMode } = await import('./webinar-cache');
      const result = isWebinarMode();
      expect(typeof result).toBe('boolean');
    });
  });
});

/**
 * tRPC Router Integration Tests for webinarEnv
 * These test the admin router endpoints via the appRouter caller.
 */
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createNonAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe('webinarEnv router: getStatus', () => {
  it('returns isActive boolean for admin users', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarEnv.getStatus();
    expect(result).toHaveProperty('isActive');
    expect(typeof result.isActive).toBe('boolean');
  });

  it('rejects non-admin users', async () => {
    const ctx = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.webinarEnv.getStatus()).rejects.toThrow(/FORBIDDEN|Admin/);
  });
});

describe('webinarEnv router: toggle', () => {
  it('enables webinar mode for admin users', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarEnv.toggle({ enabled: true });
    expect(result.isActive).toBe(true);
    expect(result.toggledBy).toBeTruthy();
  });

  it('disables webinar mode for admin users', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarEnv.toggle({ enabled: false });
    expect(result.isActive).toBe(false);
  });

  it('rejects non-admin users', async () => {
    const ctx = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.webinarEnv.toggle({ enabled: true })).rejects.toThrow(/FORBIDDEN|Admin/);
  });
});

describe('webinarEnv router: listCachedProperties', () => {
  it('returns an array of properties for admin users', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarEnv.listCachedProperties();
    expect(result).toHaveProperty('properties');
    expect(Array.isArray(result.properties)).toBe(true);
  });

  it('rejects non-admin users', async () => {
    const ctx = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.webinarEnv.listCachedProperties()).rejects.toThrow(/FORBIDDEN|Admin/);
  });
});
