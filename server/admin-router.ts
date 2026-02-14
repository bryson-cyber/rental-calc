import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { users, activityLogs, userSessions, analysisReports, leads } from "../drizzle/schema";
import { eq, desc, gte, lte, and, count, sql, like, or } from "drizzle-orm";
import { userUsage } from "../drizzle/schema";
import { getActivityLogs, getActivityStats, getRecentSessions } from "./activity";
import { getApiUsageStats, getRecentApiCalls, getTodayCallCount, checkDailyLimit } from "./api-logger";

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

  // ============================================
  // API USAGE MONITORING
  // ============================================

  // Get API usage statistics
  getApiUsage: adminProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        provider: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        // Default to last 30 days
        const endDate = input.endDate || new Date().toISOString().split('T')[0];
        const startDate = input.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const stats = await getApiUsageStats(startDate, endDate, input.provider);
        
        // Get current day status for AirDNA
        const airdnaLimit = await checkDailyLimit('airdna', 700);
        
        return {
          ...stats,
          airdnaStatus: airdnaLimit,
          monthlyLimit: 24000,
          dailyLimit: 700,
        };
      } catch (error) {
        console.error("[Admin] Error getting API usage:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get API usage stats",
        });
      }
    }),

  // Get recent API calls for debugging
  getRecentApiCalls: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(500).default(100),
        provider: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const calls = await getRecentApiCalls(input.limit, input.provider);
        return { calls };
      } catch (error) {
        console.error("[Admin] Error getting recent API calls:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get recent API calls",
        });
      }
    }),

  // ==================== USER MANAGEMENT ====================
  
  // Get all users with their usage stats
  getUsers: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        role: z.enum(['all', 'user', 'admin']).default('all'),
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

        // Build where conditions
        const conditions = [];
        
        if (input.search) {
          conditions.push(
            or(
              like(users.name, `%${input.search}%`),
              like(users.email, `%${input.search}%`)
            )
          );
        }
        
        if (input.role !== 'all') {
          conditions.push(eq(users.role, input.role));
        }

        // Get total count
        const [totalResult] = await db
          .select({ count: count() })
          .from(users)
          .where(conditions.length > 0 ? and(...conditions) : undefined);

        // Get users with usage stats
        const today = new Date().toISOString().split('T')[0];
        
        const userList = await db
          .select({
            id: users.id,
            openId: users.openId,
            name: users.name,
            email: users.email,
            phone: users.phone,
            role: users.role,
            createdAt: users.createdAt,
            lastSignedIn: users.lastSignedIn,
          })
          .from(users)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(users.lastSignedIn))
          .limit(input.limit)
          .offset(input.offset);

        // Get usage stats for each user
        const usersWithStats = await Promise.all(
          userList.map(async (user) => {
            const [usageToday] = await db
              .select({
                propertyAnalyses: userUsage.propertyAnalyses,
                marketResearches: userUsage.marketResearches,
                apiCalls: userUsage.apiCallsCount,
              })
              .from(userUsage)
              .where(
                and(
                  eq(userUsage.userId, user.id),
                  eq(userUsage.date, today)
                )
              );

            return {
              ...user,
              usageToday: usageToday || { propertyAnalyses: 0, marketResearches: 0, apiCalls: 0 },
            };
          })
        );

        return {
          users: usersWithStats,
          total: totalResult?.count || 0,
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

  // Toggle user admin status
  toggleUserAdmin: adminProcedure
    .input(
      z.object({
        userId: z.number().int(),
        makeAdmin: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        // Prevent removing own admin status
        if (input.userId === ctx.user.id && !input.makeAdmin) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot remove your own admin status",
          });
        }

        // Update user role
        await db
          .update(users)
          .set({ role: input.makeAdmin ? 'admin' : 'user' })
          .where(eq(users.id, input.userId));

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Admin] Error toggling user admin:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update user role",
        });
      }
    }),

  // Get single user details with full usage history
  getUserDetails: adminProcedure
    .input(
      z.object({
        userId: z.number().int(),
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

        // Get user
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, input.userId));

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        // Get usage history (last 30 days)
        const usageHistory = await db
          .select()
          .from(userUsage)
          .where(eq(userUsage.userId, input.userId))
          .orderBy(desc(userUsage.date))
          .limit(30);

        // Calculate totals
        const totalAnalyses = usageHistory.reduce((sum, u) => sum + (u.propertyAnalyses || 0), 0);
        const totalMarketResearches = usageHistory.reduce((sum, u) => sum + (u.marketResearches || 0), 0);
        const totalApiCalls = usageHistory.reduce((sum, u) => sum + (u.apiCallsCount || 0), 0);

        return {
          user,
          usageHistory,
          totals: {
            analyses: totalAnalyses,
            marketResearches: totalMarketResearches,
            apiCalls: totalApiCalls,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Admin] Error getting user details:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get user details",
        });
      }
    }),

  // Get activity feed with user name/email joined
  getActivityFeed: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        actionCategory: z.string().optional(),
        action: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
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

        const conditions = [];

        if (input.actionCategory) {
          conditions.push(eq(activityLogs.actionCategory, input.actionCategory));
        }
        if (input.action) {
          conditions.push(eq(activityLogs.action, input.action));
        }
        if (input.search) {
          conditions.push(
            or(
              like(users.name, `%${input.search}%`),
              like(users.email, `%${input.search}%`)
            )
          );
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const feed = await db
          .select({
            id: activityLogs.id,
            action: activityLogs.action,
            actionCategory: activityLogs.actionCategory,
            details: activityLogs.details,
            pagePath: activityLogs.pagePath,
            createdAt: activityLogs.createdAt,
            userId: activityLogs.userId,
            sessionId: activityLogs.sessionId,
            userName: users.name,
            userEmail: users.email,
          })
          .from(activityLogs)
          .leftJoin(users, eq(activityLogs.userId, users.id))
          .where(whereClause)
          .orderBy(desc(activityLogs.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        const [totalResult] = await db
          .select({ count: count() })
          .from(activityLogs)
          .leftJoin(users, eq(activityLogs.userId, users.id))
          .where(whereClause);

        // Get distinct action types for filter dropdown
        const actionTypes = await db
          .select({ action: activityLogs.action, count: count() })
          .from(activityLogs)
          .groupBy(activityLogs.action)
          .orderBy(desc(count()))
          .limit(30);

        return {
          feed,
          total: totalResult?.count || 0,
          actionTypes: actionTypes.map(a => ({ action: a.action, count: a.count })),
          limit: input.limit,
          offset: input.offset,
        };
      } catch (error) {
        console.error("[Admin] Error getting activity feed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get activity feed",
        });
      }
    }),

  // Get today's API call count
  getTodayApiCount: adminProcedure
    .input(
      z.object({
        provider: z.string().default('airdna'),
      })
    )
    .query(async ({ input }) => {
      try {
        const count = await getTodayCallCount(input.provider);
        const limitStatus = await checkDailyLimit(input.provider, 700);
        
        return {
          provider: input.provider,
          todayCount: count,
          ...limitStatus,
        };
      } catch (error) {
        console.error("[Admin] Error getting today's API count:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get today's API count",
        });
      }
    }),
});
