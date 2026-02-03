/**
 * Newsletter Router
 * 
 * Admin endpoints for managing the Deal Flow Machine newsletter automation.
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { 
  runWeeklyMarketNewsletterJob, 
  runDealAlertJob,
  runMonthlyReportJob,
  getJobHistory,
  sendTestNewsletter,
  getNewsletterSchedule
} from "./newsletter-orchestrator";
import { getUniqueCities, getContactsByCity } from "./hubspot";
import { getMarketSnapshotForCity, batchGetMarketSnapshots } from "./newsletter-market-data";
import { getSendStats, unsubscribeContact, sendDealAlertWithTemplate, sendTestDealAlert as sendTestDealAlertTemplate, type DealAlertData } from './newsletter-email-sender';
import { sendTestDealAlert } from './test-deal-alert';

export const newsletterRouter = router({
  // Get dashboard stats
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    // Only allow admin users
    if (ctx.user.role !== 'admin') {
      throw new Error('Admin access required');
    }
    
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    // Get stats for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const stats = await getSendStats('month');
    
    // Get unique cities count
    let citiesCount = 0;
    try {
      const cities = await getUniqueCities();
      citiesCount = cities.length;
    } catch (e) {
      console.error('[Newsletter] Error getting cities:', e);
    }
    
    // Get recent job history
    const recentJobs = await getJobHistory(5);
    
    return {
      last30Days: stats,
      totalCities: citiesCount,
      recentJobs: recentJobs.map(job => ({
        type: job.jobType,
        startedAt: job.startedAt.toISOString(),
        completedAt: job.completedAt.toISOString(),
        emailsSent: job.emailsSent,
        emailsFailed: job.emailsFailed,
        citiesProcessed: job.citiesProcessed
      }))
    };
  }),
  
  // Get all cities with contact counts
  getCities: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== 'admin') {
      throw new Error('Admin access required');
    }
    
    try {
      const cities = await getUniqueCities();
      
      // Get contact counts for each city
      const citiesWithCounts = await Promise.all(
        cities.slice(0, 50).map(async ({ city, state }) => {
          const contacts = await getContactsByCity(city, state);
          return {
            city,
            state,
            contactCount: contacts.length
          };
        })
      );
      
      return citiesWithCounts.sort((a, b) => b.contactCount - a.contactCount);
    } catch (error) {
      console.error('[Newsletter] Error getting cities:', error);
      return [];
    }
  }),
  
  // Get market snapshot for a city
  getMarketSnapshot: protectedProcedure
    .input(z.object({
      city: z.string(),
      state: z.string()
    }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new Error('Admin access required');
      }
      
      const snapshot = await getMarketSnapshotForCity(input.city, input.state);
      return snapshot;
    }),
  
  // Get job history
  getJobHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20)
    }).optional())
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new Error('Admin access required');
      }
      
      const jobs = await getJobHistory(input?.limit || 20);
      return jobs.map(job => ({
        type: job.jobType,
        startedAt: job.startedAt.toISOString(),
        completedAt: job.completedAt.toISOString(),
        emailsSent: job.emailsSent,
        emailsFailed: job.emailsFailed,
        citiesProcessed: job.citiesProcessed,
        contactsProcessed: job.contactsProcessed,
        errors: job.errors
      }));
    }),
  
  // Manually trigger weekly newsletter job
  triggerWeeklyJob: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== 'admin') {
      throw new Error('Admin access required');
    }
    
    console.log('[Newsletter] Admin triggered weekly job');
    
    // Run in background
    runWeeklyMarketNewsletterJob().catch(err => {
      console.error('[Newsletter] Weekly job error:', err);
    });
    
    return { 
      success: true, 
      message: 'Weekly newsletter job started. Check job history for results.' 
    };
  }),
  
  // Manually trigger deal alert job
  triggerDealAlertJob: protectedProcedure
    .input(z.object({
      cities: z.array(z.object({
        city: z.string(),
        state: z.string()
      })).optional(),
      minDealScore: z.number().min(0).max(100).optional()
    }).optional())
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new Error('Admin access required');
      }
      
      console.log('[Newsletter] Admin triggered deal alert job');
      
      // Run in background
      runDealAlertJob({
        cities: input?.cities,
        minDealScore: input?.minDealScore
      }).catch(err => {
        console.error('[Newsletter] Deal alert job error:', err);
      });
      
      return { 
        success: true, 
        message: 'Deal alert job started. Check job history for results.' 
      };
    }),
  
  // Manually trigger monthly report job
  triggerMonthlyJob: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== 'admin') {
      throw new Error('Admin access required');
    }
    
    console.log('[Newsletter] Admin triggered monthly report job');
    
    // Run in background
    runMonthlyReportJob().catch(err => {
      console.error('[Newsletter] Monthly report job error:', err);
    });
    
    return { 
      success: true, 
      message: 'Monthly report job started. Check job history for results.' 
    };
  }),
  
  // Get newsletter schedule configuration
  getSchedule: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== 'admin') {
      throw new Error('Admin access required');
    }
    
    return getNewsletterSchedule();
  }),
  
  // Send test newsletter to a specific email
  sendTestEmail: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      firstName: z.string(),
      city: z.string(),
      state: z.string(),
      type: z.enum(['weekly_market', 'deal_alert'])
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new Error('Admin access required');
      }
      
      console.log(`[Newsletter] Sending test ${input.type} to ${input.email}`);
      
      const result = await sendTestNewsletter(input);
      
      return {
        success: result.success,
        content: result.content,
        error: result.error
      };
    }),
  
  // Get send history
  getSendHistory: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      city: z.string().optional(),
      type: z.enum(['weekly_market', 'deal_alert', 'monthly_report']).optional(),
      limit: z.number().min(1).max(500).default(100)
    }).optional())
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new Error('Admin access required');
      }
      
      const db = await getDb();
      if (!db) return [];
      
      const startDate = input?.startDate ? new Date(input.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = input?.endDate ? new Date(input.endDate) : new Date();
      
      const result = await db.execute(sql`
        SELECT * FROM newsletter_sends
        WHERE sent_at >= ${startDate}
        AND sent_at <= ${endDate}
        ${input?.city ? sql`AND city = ${input.city}` : sql``}
        ${input?.type ? sql`AND newsletter_type = ${input.type}` : sql``}
        ORDER BY sent_at DESC
        LIMIT ${input?.limit || 100}
      `);
      
      return ((result as any).rows || []).map((row: any) => ({
        id: row.id,
        contactEmail: row.contact_email,
        city: row.city,
        state: row.state,
        type: row.newsletter_type,
        subject: row.subject,
        success: row.success,
        errorMessage: row.error_message,
        sentAt: row.sent_at
      }));
    }),
  
  // Unsubscribe a contact
  unsubscribe: publicProcedure
    .input(z.object({
      email: z.string().email()
    }))
    .mutation(async ({ input }) => {
      await unsubscribeContact(input.email);
      return { success: true };
    }),
  
  // Get newsletter configuration
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== 'admin') {
      throw new Error('Admin access required');
    }
    
    return {
      weeklyEmailTemplateId: process.env.HUBSPOT_WEEKLY_EMAIL_ID || 'Not configured',
      dealAlertEmailTemplateId: process.env.HUBSPOT_DEAL_ALERT_EMAIL_ID || 'Not configured',
      hubspotConfigured: !!process.env.HUBSPOT_API_KEY,
      airdnaConfigured: !!process.env.AIRDNA_API_KEY,
      geminiConfigured: !!process.env.GEMINI_API_KEY
    };
  }),
  
  // Send a full test deal alert (email + SMS) with sample data
  sendTestDealAlertFull: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      firstName: z.string(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      bedrooms: z.number().optional(),
      bathrooms: z.number().optional(),
      monthlyRent: z.number().optional(),
      monthlyRevenue: z.number().optional(),
      sendEmail: z.boolean().optional(),
      sendSms: z.boolean().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new Error('Admin access required');
      }
      
      console.log(`[Newsletter] Sending full test deal alert to ${input.email}`);
      
      const result = await sendTestDealAlert(input);
      
      return result;
    }),
  
  // Preview newsletter content without sending
  previewContent: protectedProcedure
    .input(z.object({
      city: z.string(),
      state: z.string(),
      type: z.enum(['weekly_market', 'deal_alert'])
    }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new Error('Admin access required');
      }
      
      const result = await sendTestNewsletter({
        email: 'preview@example.com',
        firstName: 'Preview',
        city: input.city,
        state: input.state,
        type: input.type
      });
      
      return {
        success: result.success,
        content: result.content,
        error: result.error
      };
    }),
  
  // Send deal alert with HubSpot template (production method)
  sendDealAlertTemplate: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      firstName: z.string(),
      lastName: z.string().optional(),
      contactId: z.string().optional(),
      dealData: z.object({
        previewText: z.string().optional(),
        aiNarration: z.string(),
        propertyAddress: z.string(),
        bedrooms: z.number(),
        bathrooms: z.number(),
        propertyType: z.string().optional(),
        monthlyRevenue: z.number(),
        monthlyRent: z.number(),
        monthlyProfit: z.number(),
        occupancy: z.number(),
        analysisUrl: z.string(),
        compsSummary: z.string().optional(),
        comps: z.array(z.object({
          title: z.string(),
          revenue: z.number(),
          occupancy: z.number()
        })).optional()
      })
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new Error('Admin access required');
      }
      
      console.log(`[Newsletter] Sending deal alert template to ${input.email}`);
      
      const result = await sendDealAlertWithTemplate({
        recipient: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName || '',
          contactId: input.contactId
        },
        dealData: input.dealData as DealAlertData
      });
      
      return result;
    }),
  
  // Quick test deal alert with sample data
  quickTestDealAlert: protectedProcedure
    .input(z.object({
      email: z.string().email()
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new Error('Admin access required');
      }
      
      console.log(`[Newsletter] Sending quick test deal alert to ${input.email}`);
      
      const result = await sendTestDealAlertTemplate(input.email);
      
      return result;
    })
});
