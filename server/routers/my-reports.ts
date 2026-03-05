import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { analysisReports, sharedReports, universalShareableReports } from "../../drizzle/schema";
import { eq, desc, sql, or, and, isNotNull } from "drizzle-orm";
import { z } from "zod";

/**
 * My Reports Router
 * 
 * Aggregates reports from three sources:
 * 1. shared_reports - Reports shared via ShareReportButton (/report/:shareId)
 * 2. universal_shareable_reports - Reports shared via UniversalShareButton (/share/:shareCode)
 * 3. analysis_reports - All analysis runs (revenue calculations)
 * 
 * Admin users see ALL analysis_reports (since they're the primary users running analyses)
 * Regular users see their own shared/universal reports + analysis_reports matched by email
 */
export const myReportsRouter = router({
  /**
   * List all reports - unified view across all report sources
   */
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      type: z.enum(['all', 'revenue', 'validator', 'ai_advisor', 'market', 'regulation', 'property', 'full']).default('all'),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const typeFilter = input?.type ?? 'all';
      const userId = ctx.user.id;
      const isAdmin = ctx.user.role === 'admin';
      const userEmail = ctx.user.email;

      // Build unified report list from all sources
      const reports: Array<{
        id: string;
        source: 'shared' | 'universal' | 'analysis';
        reportType: string;
        address: string | null;
        city: string | null;
        state: string | null;
        bedrooms: number | null;
        bathrooms: string | null;
        annualRevenue: number | null;
        occupancyRate: string | null;
        averageDailyRate: number | null;
        verdict: string | null;
        title: string | null;
        shareUrl: string | null;
        viewCount: number;
        createdAt: Date | string;
        creatorName: string | null;
      }> = [];

      // 1. Query shared_reports (property, market, full types)
      try {
        const sharedConditions = [];
        sharedConditions.push(eq(sharedReports.createdByUserId, userId));
        if (typeFilter !== 'all' && ['property', 'market', 'full'].includes(typeFilter)) {
          sharedConditions.push(eq(sharedReports.reportType, typeFilter as any));
        }

        if (typeFilter === 'all' || ['property', 'market', 'full'].includes(typeFilter)) {
          const sharedRows = await db
            .select({
              id: sharedReports.id,
              shareId: sharedReports.shareId,
              reportType: sharedReports.reportType,
              address: sharedReports.address,
              bedrooms: sharedReports.bedrooms,
              bathrooms: sharedReports.bathrooms,
              marketName: sharedReports.marketName,
              viewCount: sharedReports.viewCount,
              createdAt: sharedReports.createdAt,
              createdByName: sharedReports.createdByName,
            })
            .from(sharedReports)
            .where(sharedConditions.length > 0 ? and(...sharedConditions) : undefined)
            .orderBy(desc(sharedReports.createdAt))
            .limit(limit);

          for (const row of sharedRows) {
            reports.push({
              id: `shared-${row.id}`,
              source: 'shared',
              reportType: row.reportType,
              address: row.address,
              city: null,
              state: null,
              bedrooms: row.bedrooms,
              bathrooms: row.bathrooms,
              annualRevenue: null,
              occupancyRate: null,
              averageDailyRate: null,
              verdict: null,
              title: row.marketName
                ? `Market Report: ${row.marketName}`
                : row.address
                  ? `${row.reportType === 'full' ? 'Full Report' : 'Property Report'}: ${row.address}`
                  : `${row.reportType} Report`,
              shareUrl: `/report/${row.shareId}`,
              viewCount: row.viewCount,
              createdAt: row.createdAt,
              creatorName: row.createdByName,
            });
          }
        }
      } catch (e) {
        console.error('[MyReports] Error querying shared_reports:', e);
      }

      // 2. Query universal_shareable_reports (revenue, validator, ai_advisor, market, regulation)
      try {
        const universalConditions = [];
        universalConditions.push(eq(universalShareableReports.creatorUserId, userId));
        if (typeFilter !== 'all' && ['revenue', 'validator', 'ai_advisor', 'market', 'regulation'].includes(typeFilter)) {
          universalConditions.push(eq(universalShareableReports.reportType, typeFilter as any));
        }

        if (typeFilter === 'all' || ['revenue', 'validator', 'ai_advisor', 'market', 'regulation'].includes(typeFilter)) {
          const universalRows = await db
            .select({
              id: universalShareableReports.id,
              shareCode: universalShareableReports.shareCode,
              reportType: universalShareableReports.reportType,
              address: universalShareableReports.address,
              city: universalShareableReports.city,
              state: universalShareableReports.state,
              annualRevenue: universalShareableReports.annualRevenue,
              occupancyRate: universalShareableReports.occupancyRate,
              averageDailyRate: universalShareableReports.averageDailyRate,
              verdict: universalShareableReports.verdict,
              title: universalShareableReports.title,
              viewCount: universalShareableReports.viewCount,
              createdAt: universalShareableReports.createdAt,
              creatorName: universalShareableReports.creatorName,
            })
            .from(universalShareableReports)
            .where(universalConditions.length > 0 ? and(...universalConditions) : undefined)
            .orderBy(desc(universalShareableReports.createdAt))
            .limit(limit);

          for (const row of universalRows) {
            reports.push({
              id: `universal-${row.id}`,
              source: 'universal',
              reportType: row.reportType,
              address: row.address,
              city: row.city,
              state: row.state,
              bedrooms: null,
              bathrooms: null,
              annualRevenue: row.annualRevenue,
              occupancyRate: row.occupancyRate,
              averageDailyRate: row.averageDailyRate,
              verdict: row.verdict,
              title: row.title,
              shareUrl: `/share/${row.shareCode}`,
              viewCount: row.viewCount,
              createdAt: row.createdAt,
              creatorName: row.creatorName,
            });
          }
        }
      } catch (e) {
        console.error('[MyReports] Error querying universal_shareable_reports:', e);
      }

      // 3. Query analysis_reports
      // Admin sees ALL analysis reports (they're the primary user running analyses)
      // Regular users see reports matched by their email
      if (typeFilter === 'all' || typeFilter === 'revenue') {
        try {
          const analysisConditions = [];
          
          // Always require that the report has actual revenue data
          analysisConditions.push(isNotNull(analysisReports.annualRevenueRealistic));
          
          // For non-admin users, filter by email match
          if (!isAdmin && userEmail) {
            analysisConditions.push(eq(analysisReports.leadEmail, userEmail));
          }
          // Admin users: no email filter, see all reports

          const analysisRows = await db
            .select({
              id: analysisReports.id,
              address: analysisReports.address,
              city: analysisReports.city,
              state: analysisReports.state,
              bedrooms: analysisReports.bedrooms,
              bathrooms: analysisReports.bathrooms,
              annualRevenue: analysisReports.annualRevenueRealistic,
              occupancyRate: analysisReports.occupancyRate,
              averageDailyRate: analysisReports.averageDailyRate,
              verdict: analysisReports.verdict,
              leadName: analysisReports.leadName,
              leadEmail: analysisReports.leadEmail,
              createdAt: analysisReports.createdAt,
            })
            .from(analysisReports)
            .where(analysisConditions.length > 0 ? and(...analysisConditions) : undefined)
            .orderBy(desc(analysisReports.createdAt))
            .limit(limit);

          for (const row of analysisRows) {
            reports.push({
              id: `analysis-${row.id}`,
              source: 'analysis',
              reportType: 'revenue',
              address: row.address,
              city: row.city,
              state: row.state,
              bedrooms: row.bedrooms,
              bathrooms: row.bathrooms ? String(row.bathrooms) : null,
              annualRevenue: row.annualRevenue,
              occupancyRate: row.occupancyRate,
              averageDailyRate: row.averageDailyRate,
              verdict: row.verdict,
              title: `Revenue Analysis: ${row.address}`,
              shareUrl: null,
              viewCount: 0,
              createdAt: row.createdAt,
              creatorName: row.leadName || row.leadEmail,
            });
          }
        } catch (e) {
          console.error('[MyReports] Error querying analysis_reports:', e);
        }
      }

      // Sort all reports by createdAt descending
      reports.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      // Apply pagination
      const paginated = reports.slice(offset, offset + limit);
      const total = reports.length;

      return {
        reports: paginated,
        total,
        hasMore: offset + limit < total,
      };
    }),

  /**
   * Get report counts by type for the filter tabs
   */
  counts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const userId = ctx.user.id;
    const isAdmin = ctx.user.role === 'admin';
    const userEmail = ctx.user.email;

    const counts: Record<string, number> = {
      all: 0,
      revenue: 0,
      validator: 0,
      ai_advisor: 0,
      market: 0,
      regulation: 0,
      property: 0,
      full: 0,
    };

    try {
      // Count shared_reports (always filtered to current user)
      const sharedCondition = eq(sharedReports.createdByUserId, userId);

      const sharedCountRows = await db
        .select({
          reportType: sharedReports.reportType,
          count: sql<number>`COUNT(*)`,
        })
        .from(sharedReports)
        .where(sharedCondition)
        .groupBy(sharedReports.reportType);

      for (const row of sharedCountRows) {
        counts[row.reportType] = (counts[row.reportType] || 0) + Number(row.count);
      }

      // Count universal_shareable_reports (always filtered to current user)
      const universalCondition = eq(universalShareableReports.creatorUserId, userId);
      const universalCountRows = await db
        .select({
          reportType: universalShareableReports.reportType,
          count: sql<number>`COUNT(*)`,
        })
        .from(universalShareableReports)
        .where(universalCondition)
        .groupBy(universalShareableReports.reportType);

      for (const row of universalCountRows) {
        counts[row.reportType] = (counts[row.reportType] || 0) + Number(row.count);
      }

      // Count analysis_reports
      // Admin sees all, regular users see only their email-matched reports
      const analysisConditions = [];
      analysisConditions.push(isNotNull(analysisReports.annualRevenueRealistic));
      if (!isAdmin && userEmail) {
        analysisConditions.push(eq(analysisReports.leadEmail, userEmail));
      }

      const [analysisCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(analysisReports)
        .where(analysisConditions.length > 0 ? and(...analysisConditions) : undefined);
      counts.revenue += Number(analysisCount?.count || 0);

      // Calculate total
      counts.all = Object.entries(counts)
        .filter(([key]) => key !== 'all')
        .reduce((sum, [, val]) => sum + val, 0);
    } catch (e) {
      console.error('[MyReports] Error getting counts:', e);
    }

    return counts;
  }),
});
