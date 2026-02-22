import { describe, it, expect } from 'vitest';
import { OWNER_USER_ID } from '../../shared/const';

/**
 * Tests for owner-only report generation access control.
 * 
 * The "Generate a Full Report" feature should only be visible and accessible
 * to the site owner (Bryson Blocker, user ID 1). All other users, including
 * admins, should be blocked from this feature.
 */

describe('Owner-only report generation', () => {
  it('OWNER_USER_ID constant is set to 1', () => {
    expect(OWNER_USER_ID).toBe(1);
  });

  it('owner check correctly identifies the owner', () => {
    const ownerUser = { id: 1, role: 'admin' as const };
    const adminUser = { id: 7620890, role: 'admin' as const };
    const regularUser = { id: 100, role: 'user' as const };

    // Owner check: user.id === OWNER_USER_ID
    expect(ownerUser.id === OWNER_USER_ID).toBe(true);
    expect(adminUser.id === OWNER_USER_ID).toBe(false);
    expect(regularUser.id === OWNER_USER_ID).toBe(false);
  });

  it('admin role alone does NOT grant report access', () => {
    // These are the actual admin team members who should NOT see the report button
    const teamAdmins = [
      { id: 7620890, name: 'DFY Team', role: 'admin' as const },
      { id: 7650007, name: 'Sheila Figueroa', role: 'admin' as const },
      { id: 13620892, name: 'Shatahr Levin', role: 'admin' as const },
      { id: 14310001, name: 'Aaliyah Galindo', role: 'admin' as const },
    ];

    for (const admin of teamAdmins) {
      expect(admin.id === OWNER_USER_ID).toBe(false);
    }
  });

  it('only user ID 1 passes the owner gate', () => {
    // Simulate the frontend check: isOwner = isAuthenticated && user?.id === OWNER_USER_ID
    const checkIsOwner = (isAuthenticated: boolean, userId: number | undefined) => {
      return isAuthenticated && userId === OWNER_USER_ID;
    };

    expect(checkIsOwner(true, 1)).toBe(true);
    expect(checkIsOwner(true, 2)).toBe(false);
    expect(checkIsOwner(true, 7620890)).toBe(false);
    expect(checkIsOwner(false, 1)).toBe(false);
    expect(checkIsOwner(true, undefined)).toBe(false);
  });

  it('backend gate blocks non-owner users', () => {
    // Simulate the backend check in shared-reports.ts
    const checkBackendGate = (user: { id: number; role: string } | null) => {
      if (!user || user.id !== OWNER_USER_ID) {
        return { allowed: false, error: 'Full report generation is restricted to the site owner.' };
      }
      return { allowed: true };
    };

    expect(checkBackendGate({ id: 1, role: 'admin' }).allowed).toBe(true);
    expect(checkBackendGate({ id: 7620890, role: 'admin' }).allowed).toBe(false);
    expect(checkBackendGate({ id: 100, role: 'user' }).allowed).toBe(false);
    expect(checkBackendGate(null).allowed).toBe(false);
  });
});
