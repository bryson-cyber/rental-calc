import { describe, expect, it } from "vitest";
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
    req: {
      headers: { cookie: "" },
    } as any,
    res: {
      clearCookie: () => {},
    } as any,
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
    req: {
      headers: { cookie: "" },
    } as any,
    res: {
      clearCookie: () => {},
    } as any,
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      headers: { cookie: "" },
    } as any,
    res: {
      clearCookie: () => {},
    } as any,
  };
}

const caller = appRouter.createCaller;

describe("webinarSms router", () => {
  describe("access control", () => {
    it("should reject unauthenticated users from getDashboardStats", async () => {
      const ctx = createUnauthContext();
      const trpc = caller(ctx);
      await expect(trpc.webinarSms.getDashboardStats()).rejects.toThrow();
    });

    it("should reject non-admin users from getDashboardStats", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      await expect(trpc.webinarSms.getDashboardStats()).rejects.toThrow();
    });

    it("should allow admin users to call getDashboardStats", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      const result = await trpc.webinarSms.getDashboardStats();
      expect(result).toBeDefined();
      expect(typeof result.totalRegistrants).toBe("number");
      expect(typeof result.totalCampaigns).toBe("number");
      expect(typeof result.totalTemplates).toBe("number");
      expect(typeof result.totalSmsSent).toBe("number");
      expect(typeof result.optedOutCount).toBe("number");
    });
  });

  describe("registrants", () => {
    it("should list registrants (empty initially)", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      const result = await trpc.webinarSms.listRegistrants({ page: 1, pageSize: 50 });
      expect(result).toBeDefined();
      expect(Array.isArray(result.registrants)).toBe(true);
      expect(typeof result.total).toBe("number");
      expect(typeof result.totalPages).toBe("number");
    });

    it("should add a registrant", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      const result = await trpc.webinarSms.addRegistrant({
        name: "Test User",
        phone: "5551234567",
        email: "test@example.com",
        webinarName: "Test Webinar",
      });
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it("should reject non-admin from adding registrant", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.addRegistrant({
          name: "Test",
          phone: "5551234567",
        })
      ).rejects.toThrow();
    });
  });

  describe("templates", () => {
    it("should list templates", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      const result = await trpc.webinarSms.listTemplates();
      expect(result).toBeDefined();
      expect(Array.isArray(result.templates)).toBe(true);
    });

    it("should create a template", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      const result = await trpc.webinarSms.createTemplate({
        name: "Test Template",
        body: "Hey {{name}}, join our webinar!",
        category: "reminder",
      });
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it("should reject non-admin from creating template", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.createTemplate({
          name: "Test",
          body: "Hello",
          category: "custom",
        })
      ).rejects.toThrow();
    });
  });

  describe("campaigns", () => {
    it("should list campaigns", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      const result = await trpc.webinarSms.listCampaigns({ page: 1, pageSize: 20 });
      expect(result).toBeDefined();
      expect(Array.isArray(result.campaigns)).toBe(true);
    });

    it("should reject non-admin from listing campaigns", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.listCampaigns({ page: 1, pageSize: 20 })
      ).rejects.toThrow();
    });
  });

  describe("input validation", () => {
    it("should reject empty phone number for addRegistrant", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.addRegistrant({
          name: "Test",
          phone: "",
        })
      ).rejects.toThrow();
    });

    it("should reject empty name for addRegistrant", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.addRegistrant({
          name: "",
          phone: "5551234567",
        })
      ).rejects.toThrow();
    });

    it("should reject empty template name", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.createTemplate({
          name: "",
          body: "Hello",
          category: "custom",
        })
      ).rejects.toThrow();
    });

    it("should reject empty template body", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      await expect(
        trpc.webinarSms.createTemplate({
          name: "Test",
          body: "",
          category: "custom",
        })
      ).rejects.toThrow();
    });
  });
});
