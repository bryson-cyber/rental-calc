import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Webinar Cache Service (Per-User Mode)', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isWebinarMode (request-context based)', () => {
    it('should default to false when no request context exists', async () => {
      const { isWebinarMode } = await import('./webinar-cache');
      expect(isWebinarMode()).toBe(false);
    });
  });

  describe('isWebinarModeForUser (direct user ID check)', () => {
    it('should return false for a user who has not enabled webinar mode', async () => {
      const { isWebinarModeForUser } = await import('./webinar-cache');
      expect(isWebinarModeForUser(123)).toBe(false);
    });

    it('should return true after enabling for a specific user', async () => {
      const { toggleWebinarMode, isWebinarModeForUser } = await import('./webinar-cache');
      await toggleWebinarMode(true, 123);
      expect(isWebinarModeForUser(123)).toBe(true);
      await toggleWebinarMode(false, 123);
    });
  });

  describe('Per-user isolation', () => {
    it('enabling for Admin 1 does NOT affect Admin 2', async () => {
      const { toggleWebinarMode, isWebinarModeForUser } = await import('./webinar-cache');
      
      await toggleWebinarMode(true, 10);
      expect(isWebinarModeForUser(10)).toBe(true);
      expect(isWebinarModeForUser(20)).toBe(false);
      
      await toggleWebinarMode(false, 10);
    });

    it('multiple users can independently toggle webinar mode', async () => {
      const { toggleWebinarMode, isWebinarModeForUser } = await import('./webinar-cache');
      
      await toggleWebinarMode(true, 10);
      await toggleWebinarMode(true, 20);
      
      expect(isWebinarModeForUser(10)).toBe(true);
      expect(isWebinarModeForUser(20)).toBe(true);
      
      await toggleWebinarMode(false, 10);
      
      expect(isWebinarModeForUser(10)).toBe(false);
      expect(isWebinarModeForUser(20)).toBe(true);
      
      await toggleWebinarMode(false, 20);
    });
  });

  describe('getWebinarModeUsers', () => {
    it('returns empty array when no users have webinar mode enabled', async () => {
      const { getWebinarModeUsers } = await import('./webinar-cache');
      expect(getWebinarModeUsers()).toEqual([]);
    });

    it('returns array of user IDs with webinar mode enabled', async () => {
      const { toggleWebinarMode, getWebinarModeUsers } = await import('./webinar-cache');
      
      await toggleWebinarMode(true, 10);
      await toggleWebinarMode(true, 20);
      
      const users = getWebinarModeUsers();
      expect(users).toContain(10);
      expect(users).toContain(20);
      expect(users.length).toBe(2);
      
      await toggleWebinarMode(false, 10);
      await toggleWebinarMode(false, 20);
    });
  });

  describe('toggleWebinarMode', () => {
    it('returns the enabled state', async () => {
      const { toggleWebinarMode } = await import('./webinar-cache');
      
      const result = await toggleWebinarMode(true, 42);
      expect(result).toBe(true);
      
      const result2 = await toggleWebinarMode(false, 42);
      expect(result2).toBe(false);
    });

    it('adds user to the Set when enabling', async () => {
      const { toggleWebinarMode, isWebinarModeForUser } = await import('./webinar-cache');
      
      await toggleWebinarMode(true, 55);
      expect(isWebinarModeForUser(55)).toBe(true);
      
      await toggleWebinarMode(false, 55);
    });

    it('removes user from the Set when disabling', async () => {
      const { toggleWebinarMode, isWebinarModeForUser } = await import('./webinar-cache');
      
      await toggleWebinarMode(true, 55);
      expect(isWebinarModeForUser(55)).toBe(true);
      
      await toggleWebinarMode(false, 55);
      expect(isWebinarModeForUser(55)).toBe(false);
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
  });

  describe('module exports', () => {
    it('should export all expected functions including per-user additions', async () => {
      const mod = await import('./webinar-cache');
      expect(typeof mod.isWebinarMode).toBe('function');
      expect(typeof mod.isWebinarModeForUser).toBe('function');
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
      expect(typeof mod.getWebinarModeUsers).toBe('function');
    });
  });
});

/**
 * tRPC Router Integration Tests for webinarEnv (Per-User)
 */
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(id: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id,
    openId: `admin-user-${id}`,
    email: `admin${id}@example.com`,
    name: `Admin User ${id}`,
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

describe('webinarEnv router: getStatus (per-user)', () => {
  it('returns isActive boolean and userId for admin users', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarEnv.getStatus();
    expect(result).toHaveProperty('isActive');
    expect(result).toHaveProperty('userId');
    expect(typeof result.isActive).toBe('boolean');
  });

  it('rejects non-admin users', async () => {
    const ctx = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.webinarEnv.getStatus()).rejects.toThrow(/FORBIDDEN|Admin/);
  });
});

describe('webinarEnv router: toggle (per-user)', () => {
  it('enables webinar mode for admin users', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarEnv.toggle({ enabled: true });
    expect(result.isActive).toBe(true);
    expect(result.toggledBy).toBeTruthy();
    
    await caller.webinarEnv.toggle({ enabled: false });
  });

  it('disables webinar mode for admin users', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await caller.webinarEnv.toggle({ enabled: true });
    const result = await caller.webinarEnv.toggle({ enabled: false });
    expect(result.isActive).toBe(false);
  });

  it('rejects non-admin users', async () => {
    const ctx = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.webinarEnv.toggle({ enabled: true })).rejects.toThrow(/FORBIDDEN|Admin/);
  });
});

describe('webinarEnv router: per-user isolation', () => {
  it('toggling for Admin 1 does not affect Admin 2 status', async () => {
    const ctx1 = createAdminContext(10);
    const ctx2 = createAdminContext(20);
    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);
    
    await caller1.webinarEnv.toggle({ enabled: true });
    
    const status1 = await caller1.webinarEnv.getStatus();
    expect(status1.isActive).toBe(true);
    
    const status2 = await caller2.webinarEnv.getStatus();
    expect(status2.isActive).toBe(false);
    
    await caller1.webinarEnv.toggle({ enabled: false });
  });
});

describe('webinarEnv router: listCachedProperties', () => {
  it('returns an array of properties for admin users (global pool)', async () => {
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
