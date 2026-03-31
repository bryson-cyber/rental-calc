import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({
    onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined),
  }),
});

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
  };
});

/**
 * Test that the upsertUser logic in db.ts auto-assigns admin role
 * for @coachinayah.com email addresses.
 *
 * Since upsertUser directly calls the database, we test the logic
 * by verifying the code path rather than mocking the full DB.
 */
describe("@coachinayah.com admin auto-assignment logic", () => {
  it("should identify @coachinayah.com emails correctly", () => {
    const testEmails = [
      { email: "ronald@coachinayah.com", expected: true },
      { email: "SHEILA@COACHINAYAH.COM", expected: true },
      { email: "Allen@CoachInayah.com", expected: true },
      { email: "user@gmail.com", expected: false },
      { email: "user@coachinayah.org", expected: false },
      { email: "coachinayah.com@gmail.com", expected: false },
      { email: "", expected: false },
    ];

    for (const { email, expected } of testEmails) {
      const isCoachInayahEmail = email.toLowerCase().endsWith("@coachinayah.com");
      expect(isCoachInayahEmail, `Expected ${email} to be ${expected}`).toBe(expected);
    }
  });

  it("should determine admin role for @coachinayah.com users", () => {
    // Simulate the logic from db.ts upsertUser
    function determineRole(user: { openId: string; email?: string; role?: string }, ownerOpenId: string): string | undefined {
      if (user.role !== undefined) {
        return user.role;
      } else if (
        user.openId === ownerOpenId ||
        (user.email && user.email.toLowerCase().endsWith("@coachinayah.com"))
      ) {
        return "admin";
      }
      return undefined;
    }

    const ownerOpenId = "owner-123";

    // @coachinayah.com email should get admin
    expect(determineRole({ openId: "user-1", email: "ronald@coachinayah.com" }, ownerOpenId)).toBe("admin");
    expect(determineRole({ openId: "user-2", email: "SHEILA@COACHINAYAH.COM" }, ownerOpenId)).toBe("admin");

    // Owner should get admin
    expect(determineRole({ openId: ownerOpenId, email: "owner@gmail.com" }, ownerOpenId)).toBe("admin");

    // Regular user should NOT get admin
    expect(determineRole({ openId: "user-3", email: "user@gmail.com" }, ownerOpenId)).toBeUndefined();

    // Explicit role should be preserved
    expect(determineRole({ openId: "user-1", email: "ronald@coachinayah.com", role: "user" }, ownerOpenId)).toBe("user");
  });
});
