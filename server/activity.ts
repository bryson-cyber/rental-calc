import { getDb } from "./db";
import { activityLogs, userSessions } from "../drizzle/schema";
import { eq, and, desc, gte, lte, sql, count } from "drizzle-orm";

/**
 * Activity action categories for consistent categorization
 */
export const ActionCategory = {
  AUTH: "auth",
  SEARCH: "search",
  ANALYSIS: "analysis",
  NAVIGATION: "navigation",
  LEAD: "lead",
  TOOL: "tool",
} as const;

export type ActionCategoryType = (typeof ActionCategory)[keyof typeof ActionCategory];

/**
 * Predefined action types for consistent logging
 */
export const ActionType = {
  // Auth actions
  LOGIN: "login",
  LOGOUT: "logout",
  
  // Search actions
  MARKET_SEARCH: "market_search",
  PROPERTY_SEARCH: "property_search",
  ZIPCODE_SEARCH: "zipcode_search",
  
  // Analysis actions
  PROPERTY_ANALYSIS: "property_analysis",
  MARKET_ANALYSIS: "market_analysis",
  REPORT_GENERATED: "report_generated",
  DEEP_ANALYSIS_STARTED: "deep_analysis_started",
  
  // Navigation actions
  PAGE_VIEW: "page_view",
  
  // Lead magnet tool actions
  BULK_PROPERTY_COMPARE: "bulk_property_compare",
  EXPENSE_CALCULATOR: "expense_calculator",
  MARKET_EXPLORER: "market_explorer",
  
  // Lead actions
  LEAD_SUBMITTED: "lead_submitted",
} as const;

export type ActionTypeType = (typeof ActionType)[keyof typeof ActionType];

/**
 * Log a user activity
 */
export async function logActivity(params: {
  userId?: number | null;
  sessionId?: string | null;
  action: string;
  actionCategory: ActionCategoryType;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  pagePath?: string | null;
}) {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[Activity Log] Database not available");
      return;
    }
    
    await db.insert(activityLogs).values({
      userId: params.userId ?? null,
      sessionId: params.sessionId ?? null,
      action: params.action,
      actionCategory: params.actionCategory,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      referrer: params.referrer ?? null,
      pagePath: params.pagePath ?? null,
    });
  } catch (error) {
    console.error("[Activity Log] Failed to log activity:", error);
    // Don't throw - activity logging should not break the main flow
  }
}

/**
 * Get or create a user session
 */
export async function getOrCreateSession(params: {
  sessionId: string;
  userId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[Activity Log] Database not available");
      return null;
    }
    
    // Check if session exists
    const existing = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionId, params.sessionId))
      .limit(1);

    if (existing.length > 0) {
      // Update last activity
      await db
        .update(userSessions)
        .set({
          lastActivityAt: new Date(),
          actionsCount: sql`${userSessions.actionsCount} + 1`,
          userId: params.userId ?? existing[0].userId,
        })
        .where(eq(userSessions.sessionId, params.sessionId));
      
      return existing[0];
    }

    // Create new session
    await db.insert(userSessions).values({
      sessionId: params.sessionId,
      userId: params.userId ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      pageViews: 1,
      actionsCount: 1,
    });

    const newSession = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionId, params.sessionId))
      .limit(1);

    return newSession[0];
  } catch (error) {
    console.error("[Activity Log] Failed to get/create session:", error);
    return null;
  }
}

/**
 * Increment page views for a session
 */
export async function incrementPageViews(sessionId: string) {
  try {
    const db = await getDb();
    if (!db) return;
    
    await db
      .update(userSessions)
      .set({
        pageViews: sql`${userSessions.pageViews} + 1`,
        lastActivityAt: new Date(),
      })
      .where(eq(userSessions.sessionId, sessionId));
  } catch (error) {
    console.error("[Activity Log] Failed to increment page views:", error);
  }
}

/**
 * Get activity logs with filtering and pagination
 */
export async function getActivityLogs(params: {
  userId?: number;
  actionCategory?: ActionCategoryType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];

  if (params.userId) {
    conditions.push(eq(activityLogs.userId, params.userId));
  }
  if (params.actionCategory) {
    conditions.push(eq(activityLogs.actionCategory, params.actionCategory));
  }
  if (params.startDate) {
    conditions.push(gte(activityLogs.createdAt, params.startDate));
  }
  if (params.endDate) {
    conditions.push(lte(activityLogs.createdAt, params.endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const logs = await db
    .select()
    .from(activityLogs)
    .where(whereClause)
    .orderBy(desc(activityLogs.createdAt))
    .limit(params.limit ?? 100)
    .offset(params.offset ?? 0);

  return logs;
}

/**
 * Get activity summary statistics
 */
export async function getActivityStats(params: {
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) {
    return {
      totalActions: 0,
      uniqueUsers: 0,
      uniqueSessions: 0,
      actionsByCategory: [],
      topActions: [],
    };
  }
  
  const conditions = [];

  if (params.startDate) {
    conditions.push(gte(activityLogs.createdAt, params.startDate));
  }
  if (params.endDate) {
    conditions.push(lte(activityLogs.createdAt, params.endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total actions count
  const totalActionsResult = await db
    .select({ count: count() })
    .from(activityLogs)
    .where(whereClause);

  // Get unique users count
  const uniqueUsersResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${activityLogs.userId})` })
    .from(activityLogs)
    .where(whereClause);

  // Get unique sessions count
  const uniqueSessionsResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${activityLogs.sessionId})` })
    .from(activityLogs)
    .where(whereClause);

  // Get actions by category
  const actionsByCategory = await db
    .select({
      category: activityLogs.actionCategory,
      count: count(),
    })
    .from(activityLogs)
    .where(whereClause)
    .groupBy(activityLogs.actionCategory);

  // Get top actions
  const topActions = await db
    .select({
      action: activityLogs.action,
      count: count(),
    })
    .from(activityLogs)
    .where(whereClause)
    .groupBy(activityLogs.action)
    .orderBy(desc(count()))
    .limit(10);

  return {
    totalActions: totalActionsResult[0]?.count ?? 0,
    uniqueUsers: uniqueUsersResult[0]?.count ?? 0,
    uniqueSessions: uniqueSessionsResult[0]?.count ?? 0,
    actionsByCategory,
    topActions,
  };
}

/**
 * Get recent sessions with activity summary
 */
export async function getRecentSessions(params: {
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const sessions = await db
    .select()
    .from(userSessions)
    .orderBy(desc(userSessions.lastActivityAt))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);

  return sessions;
}
