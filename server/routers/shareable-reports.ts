import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { notifications, universalShareableReports } from "../../drizzle/schema";
import { createAndNotifyShareableReport, createShareableReport, getNotificationAnalytics, getShareableReport, sendShareableReportNotifications, type ShareableReportType } from "../shareable-reports";
import { eq } from "drizzle-orm";
import { getDb } from "../db";

export const shareableReportsRouter = router({
    // Create a shareable report for any tool type
    create: publicProcedure
      .input(z.object({
        reportType: z.enum(['revenue', 'validator', 'market', 'ai_advisor', 'listings', 'comparison', 'map', 'regulation']),
        // Property information
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        monthlyRent: z.number().optional(),
        // Market information
        marketId: z.string().optional(),
        marketName: z.string().optional(),
        // Report data
        reportData: z.any(),
        title: z.string().optional(),
        summary: z.string().optional(),
        // Key metrics
        annualRevenue: z.number().optional(),
        occupancyRate: z.number().optional(),
        averageDailyRate: z.number().optional(),
        profitMargin: z.number().optional(),
        verdict: z.string().optional(),
        // Admin revenue override
        revenueOverride: z.number().nullable().optional(),
        // Creator info
        creatorEmail: z.string().optional(),
        creatorPhone: z.string().optional(),
        creatorName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await createShareableReport({
          ...input,
          creatorUserId: ctx.user?.id,
          creatorName: input.creatorName || ctx.user?.name || undefined,
          creatorEmail: input.creatorEmail || ctx.user?.email || undefined,
        });
        return result;
      }),

    // Get a shareable report by share code
    get: publicProcedure
      .input(z.object({
        shareCode: z.string().min(1),
      }))
      .query(async ({ input }) => {
        const report = await getShareableReport(input.shareCode);
        if (!report) {
          return { success: false, error: 'Report not found' };
        }
        return { success: true, data: report };
      }),

    // Send notifications for an existing shareable report
    sendNotifications: publicProcedure
      .input(z.object({
        shareCode: z.string().min(1),
        reportType: z.enum(['revenue', 'validator', 'market', 'ai_advisor', 'listings', 'comparison', 'map', 'regulation']),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        name: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        address: z.string().optional(),
        title: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await sendShareableReportNotifications(
          input.shareCode,
          input.reportType as ShareableReportType,
          { phone: input.phone, email: input.email, name: input.name },
          { city: input.city, state: input.state, address: input.address, title: input.title }
        );
        return { success: true, notifications: result };
      }),

    // Create shareable report and send notifications in one call (for auto-notification)
    createAndNotify: publicProcedure
      .input(z.object({
        reportType: z.enum(['revenue', 'validator', 'market', 'ai_advisor', 'listings', 'comparison', 'map', 'regulation']),
        // Property information
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        monthlyRent: z.number().optional(),
        // Market information
        marketId: z.string().optional(),
        marketName: z.string().optional(),
        // Report data
        reportData: z.any(),
        title: z.string().optional(),
        summary: z.string().optional(),
        // Key metrics
        annualRevenue: z.number().optional(),
        occupancyRate: z.number().optional(),
        averageDailyRate: z.number().optional(),
        profitMargin: z.number().optional(),
        verdict: z.string().optional(),
        // Contact info for notification
        userEmail: z.string().email().optional(),
        userPhone: z.string().optional(),
        userName: z.string().optional(),
        // Options
        triggeredBy: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await createAndNotifyShareableReport(
          {
            reportType: input.reportType as ShareableReportType,
            address: input.address,
            city: input.city,
            state: input.state,
            zipCode: input.zipCode,
            latitude: input.latitude,
            longitude: input.longitude,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            monthlyRent: input.monthlyRent,
            marketId: input.marketId,
            marketName: input.marketName,
            reportData: input.reportData,
            title: input.title,
            summary: input.summary,
            annualRevenue: input.annualRevenue,
            occupancyRate: input.occupancyRate,
            averageDailyRate: input.averageDailyRate,
            profitMargin: input.profitMargin,
            verdict: input.verdict,
            creatorEmail: input.userEmail || ctx.user?.email || undefined,
            creatorPhone: input.userPhone,
            creatorName: input.userName || ctx.user?.name || undefined,
            creatorUserId: ctx.user?.id,
          },
          {
            phone: input.userPhone,
            email: input.userEmail,
            name: input.userName,
          },
          {
            isAutoNotification: true,
            triggeredBy: input.triggeredBy || input.reportType,
          }
        );
        return result;
      }),

    // Owner-only: Update revenue override for a shared report
    updateRevenueOverride: protectedProcedure
      .input(z.object({
        shareCode: z.string().min(1),
        revenueOverride: z.number().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.openId !== ENV.ownerOpenId) {
          throw new Error('Owner access required');
        }
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        
        await db.update(universalShareableReports)
          .set({ revenueOverride: input.revenueOverride })
          .where(eq(universalShareableReports.shareCode, input.shareCode));
        
        return { success: true, revenueOverride: input.revenueOverride };
      }),

    // Get notification analytics (admin only)
    getAnalytics: protectedProcedure
      .input(z.object({
        reportType: z.enum(['regulation', 'revenue', 'validator', 'market', 'ai_advisor', 'listings', 'comparison', 'map']).optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        const analytics = await getNotificationAnalytics({ reportType: input.reportType as any });
        return analytics;
      }),
});
