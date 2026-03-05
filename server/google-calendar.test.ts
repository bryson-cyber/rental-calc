import { describe, expect, it, vi, beforeEach } from "vitest";
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
    req: { headers: { cookie: "" } } as any,
    res: { clearCookie: () => {} } as any,
  };
}

function createUserContext(): TrpcContext {
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
    req: { headers: { cookie: "" } } as any,
    res: { clearCookie: () => {} } as any,
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { headers: { cookie: "" } } as any,
    res: { clearCookie: () => {} } as any,
  };
}

const caller = appRouter.createCaller;

describe("Google Calendar Integration", () => {
  describe("access control", () => {
    it("should reject unauthenticated users from calendarStatus", async () => {
      const ctx = createUnauthContext();
      const trpc = caller(ctx);
      await expect(trpc.webinarSms.calendarStatus()).rejects.toThrow();
    });

    it("should reject non-admin users from calendarStatus", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      await expect(trpc.webinarSms.calendarStatus()).rejects.toThrow();
    });

    it("should reject unauthenticated users from testCalendarConnection", async () => {
      const ctx = createUnauthContext();
      const trpc = caller(ctx);
      await expect(trpc.webinarSms.testCalendarConnection()).rejects.toThrow();
    });

    it("should reject non-admin users from testCalendarConnection", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      await expect(trpc.webinarSms.testCalendarConnection()).rejects.toThrow();
    });

    it("should reject unauthenticated users from sendBulkCalendarInvites", async () => {
      const ctx = createUnauthContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.sendBulkCalendarInvites({ webinarId: "test-123", onlyUnsent: true })
      ).rejects.toThrow();
    });

    it("should reject non-admin users from sendBulkCalendarInvites", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.sendBulkCalendarInvites({ webinarId: "test-123", onlyUnsent: true })
      ).rejects.toThrow();
    });

    it("should reject unauthenticated users from calendarInviteStats", async () => {
      const ctx = createUnauthContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.calendarInviteStats({ webinarId: "test-123" })
      ).rejects.toThrow();
    });

    it("should reject non-admin users from calendarInviteStats", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.calendarInviteStats({ webinarId: "test-123" })
      ).rejects.toThrow();
    });

    it("should reject unauthenticated users from sendCalendarInviteToRegistrant", async () => {
      const ctx = createUnauthContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.sendCalendarInviteToRegistrant({ registrantId: 1, webinarId: "test-123" })
      ).rejects.toThrow();
    });

    it("should reject non-admin users from sendCalendarInviteToRegistrant", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.sendCalendarInviteToRegistrant({ registrantId: 1, webinarId: "test-123" })
      ).rejects.toThrow();
    });
  });

  describe("calendarStatus (admin)", () => {
    it("should return calendar health status for admin users", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      const result = await trpc.webinarSms.calendarStatus();

      // Should return the health check structure
      expect(result).toHaveProperty("configured");
      expect(result).toHaveProperty("authenticated");
      expect(result).toHaveProperty("impersonateEmail");
      expect(typeof result.configured).toBe("boolean");
      expect(typeof result.authenticated).toBe("boolean");
      expect(typeof result.impersonateEmail).toBe("string");
    });
  });

  describe("testCalendarConnection (admin)", () => {
    it("should return success/failure object for admin users", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      const result = await trpc.webinarSms.testCalendarConnection();

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("message");
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.message).toBe("string");
    });
  });

  describe("getApiStatus includes googleCalendar", () => {
    it("should include googleCalendar in API status response", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      const result = await trpc.webinarSms.getApiStatus();

      expect(result).toHaveProperty("googleCalendar");
      expect(result.googleCalendar).toHaveProperty("configured");
      expect(result.googleCalendar).toHaveProperty("impersonateEmail");
      expect(typeof result.googleCalendar.configured).toBe("boolean");
      expect(typeof result.googleCalendar.impersonateEmail).toBe("string");
    });
  });

  describe("calendarInviteStats (admin)", () => {
    it("should return stats for a webinar", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      const result = await trpc.webinarSms.calendarInviteStats({ webinarId: "nonexistent-webinar-999" });

      // For a nonexistent webinar, should return zeros
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("withEmail");
      expect(result).toHaveProperty("inviteSent");
      expect(result).toHaveProperty("invitePending");
      expect(result.total).toBe(0);
      expect(result.withEmail).toBe(0);
      expect(result.inviteSent).toBe(0);
      expect(result.invitePending).toBe(0);
    });
  });

  describe("input validation", () => {
    it("should reject sendCalendarInviteToRegistrant with missing webinarId", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.sendCalendarInviteToRegistrant({ registrantId: 1, webinarId: "" } as any)
      ).rejects.toThrow();
    });

    it("should reject sendBulkCalendarInvites with missing webinarId", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.sendBulkCalendarInvites({ webinarId: "", onlyUnsent: true } as any)
      ).rejects.toThrow();
    });
  });

  describe("saveCalendarSettings", () => {
    it("should reject unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.saveCalendarSettings({ calendarAutoSend: true })
      ).rejects.toThrow();
    });

    it("should reject non-admin users", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.saveCalendarSettings({ calendarAutoSend: true })
      ).rejects.toThrow();
    });

    it("should save calendar settings for admin users", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      const result = await trpc.webinarSms.saveCalendarSettings({
        calendarAutoSend: true,
        calendarEventName: "Test Webinar Event",
        calendarEventDescription: "Join us for an amazing webinar",
        calendarEventLocation: "https://example.com/join",
      });
      expect(result).toEqual({ success: true });
    });

    it("should persist calendar settings in getSettings", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);

      // Save settings first
      await trpc.webinarSms.saveCalendarSettings({
        calendarAutoSend: true,
        calendarEventName: "My Custom Event",
        calendarEventDescription: "Custom description",
        calendarEventLocation: "https://join.example.com",
      });

      // Read them back via getSettings
      const settings = await trpc.webinarSms.getSettings();
      expect(settings.calendarAutoSend).toBe(true);
      expect(settings.calendarEventName).toBe("My Custom Event");
      expect(settings.calendarEventDescription).toBe("Custom description");
      expect(settings.calendarEventLocation).toBe("https://join.example.com");
    });

    it("should toggle auto-send off", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);

      await trpc.webinarSms.saveCalendarSettings({ calendarAutoSend: false });
      const settings = await trpc.webinarSms.getSettings();
      expect(settings.calendarAutoSend).toBe(false);
    });
  });
});
