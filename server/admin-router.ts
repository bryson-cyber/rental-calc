import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { users, activityLogs, userSessions, analysisReports, leads } from "../drizzle/schema";
import { eq, desc, gte, lte, and, count, sql } from "drizzle-orm";
import { getActivityLogs, getActivityStats, getRecentSessions } from "./activity";

/**
 * Admin-only procedure that checks if the user has admin role
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have admin access",
    });
  }
  return next({ ctx });
});

export const adminRouter = router({
  // Get dashboard overview stats
  getDashboardStats: adminProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      // Get time ranges
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get user counts
      const [totalUsersResult] = await db.select({ count: count() }).from(users);
      const [newUsersThisWeek] = await db
        .select({ count: count() })
        .from(users)
        .where(gte(users.createdAt, weekAgo));

      // Get activity stats
      const activityStatsToday = await getActivityStats({ startDate: today });
      const activityStatsWeek = await getActivityStats({ startDate: weekAgo });
      const activityStatsMonth = await getActivityStats({ startDate: monthAgo });

      // Get report counts
      const [totalReportsResult] = await db.select({ count: count() }).from(analysisReports);
      const [reportsThisWeek] = await db
        .select({ count: count() })
        .from(analysisReports)
        .where(gte(analysisReports.createdAt, weekAgo));

      // Get lead counts
      const [totalLeadsResult] = await db.select({ count: count() }).from(leads);
      const [leadsThisWeek] = await db
        .select({ count: count() })
        .from(leads)
        .where(gte(leads.createdAt, weekAgo));

      return {
        users: {
          total: totalUsersResult.count,
          newThisWeek: newUsersThisWeek.count,
        },
        activity: {
          today: activityStatsToday,
          thisWeek: activityStatsWeek,
          thisMonth: activityStatsMonth,
        },
        reports: {
          total: totalReportsResult.count,
          thisWeek: reportsThisWeek.count,
        },
        leads: {
          total: totalLeadsResult.count,
          thisWeek: leadsThisWeek.count,
        },
      };
    } catch (error) {
      console.error("[Admin] Error getting dashboard stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get dashboard stats",
      });
    }
  }),

  // Get all users with activity summary
  getUsers: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const userList = await db
          .select()
          .from(users)
          .orderBy(desc(users.lastSignedIn))
          .limit(input.limit)
          .offset(input.offset);

        const [totalResult] = await db.select({ count: count() }).from(users);

        return {
          users: userList,
          total: totalResult.count,
          limit: input.limit,
          offset: input.offset,
        };
      } catch (error) {
        console.error("[Admin] Error getting users:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get users",
        });
      }
    }),

  // Get activity logs with filtering
  getActivityLogs: adminProcedure
    .input(
      z.object({
        userId: z.number().int().optional(),
        actionCategory: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      try {
        const logs = await getActivityLogs({
          userId: input.userId,
          actionCategory: input.actionCategory as any,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          limit: input.limit,
          offset: input.offset,
        });

        return {
          logs,
          limit: input.limit,
          offset: input.offset,
        };
      } catch (error) {
        console.error("[Admin] Error getting activity logs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get activity logs",
        });
      }
    }),

  // Get recent sessions
  getRecentSessions: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      try {
        const sessions = await getRecentSessions({
          limit: input.limit,
          offset: input.offset,
        });

        return {
          sessions,
          limit: input.limit,
          offset: input.offset,
        };
      } catch (error) {
        console.error("[Admin] Error getting sessions:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get sessions",
        });
      }
    }),

  // Get all analysis reports
  getReports: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const conditions = [];
        if (input.startDate) {
          conditions.push(gte(analysisReports.createdAt, new Date(input.startDate)));
        }
        if (input.endDate) {
          conditions.push(lte(analysisReports.createdAt, new Date(input.endDate)));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const reports = await db
          .select({
            id: analysisReports.id,
            address: analysisReports.address,
            city: analysisReports.city,
            state: analysisReports.state,
            bedrooms: analysisReports.bedrooms,
            monthlyRent: analysisReports.monthlyRent,
            annualRevenueRealistic: analysisReports.annualRevenueRealistic,
            verdict: analysisReports.verdict,
            createdAt: analysisReports.createdAt,
            // Lead capture fields
            leadName: analysisReports.leadName,
            leadEmail: analysisReports.leadEmail,
            leadPhone: analysisReports.leadPhone,
          })
          .from(analysisReports)
          .where(whereClause)
          .orderBy(desc(analysisReports.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        const [totalResult] = await db
          .select({ count: count() })
          .from(analysisReports)
          .where(whereClause);

        return {
          reports,
          total: totalResult.count,
          limit: input.limit,
          offset: input.offset,
        };
      } catch (error) {
        console.error("[Admin] Error getting reports:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get reports",
        });
      }
    }),

  // Get all leads
  getLeads: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        status: z.enum(["new", "contacted", "qualified", "converted", "closed"]).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const conditions = [];
        if (input.status) {
          conditions.push(eq(leads.status, input.status));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const leadList = await db
          .select()
          .from(leads)
          .where(whereClause)
          .orderBy(desc(leads.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        const [totalResult] = await db
          .select({ count: count() })
          .from(leads)
          .where(whereClause);

        return {
          leads: leadList,
          total: totalResult.count,
          limit: input.limit,
          offset: input.offset,
        };
      } catch (error) {
        console.error("[Admin] Error getting leads:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get leads",
        });
      }
    }),

  // Update lead status
  updateLeadStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(["new", "contacted", "qualified", "converted", "closed"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const updates: Record<string, unknown> = { status: input.status };
        if (input.notes !== undefined) {
          updates.notes = input.notes;
        }

        await db.update(leads).set(updates).where(eq(leads.id, input.id));

        return { success: true };
      } catch (error) {
        console.error("[Admin] Error updating lead:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update lead",
        });
      }
    }),

  // Update user role
  updateUserRole: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        role: z.enum(["user", "admin"]),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        await db.update(users).set({ role: input.role }).where(eq(users.id, input.id));

        return { success: true };
      } catch (error) {
        console.error("[Admin] Error updating user role:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update user role",
        });
      }
    }),
});
