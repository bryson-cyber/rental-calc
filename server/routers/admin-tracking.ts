import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { emailOptins, personalizedLinks, linkClicks, promotions, toolUsageEvents } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const adminTrackingRouter = router({
    // Create a personalized link
    createLink: protectedProcedure
      .input(z.object({
        email: z.string().email().optional(),
        hubspotContactId: z.string().optional(),
        targetCity: z.string(),
        targetState: z.string(),
        targetZip: z.string().optional(),
        targetTab: z.string().default('prove'),
        campaignName: z.string().optional(),
        campaignType: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const baseUrl = process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com';
        
        // Build the personalized link URL
        const params = new URLSearchParams();
        params.set('tab', input.targetTab);
        params.set('city', input.targetCity);
        params.set('state', input.targetState);
        if (input.targetZip) params.set('zip', input.targetZip);
        params.set('autoAnalyze', 'true');
        
        const linkUrl = `${baseUrl}/?${params.toString()}`;
        
        // Generate a short code for tracking
        const shortCode = Math.random().toString(36).substring(2, 10);
        
        const result = await db.insert(personalizedLinks).values({
          email: input.email,
          hubspotContactId: input.hubspotContactId,
          linkUrl,
          shortCode,
          targetCity: input.targetCity,
          targetState: input.targetState,
          targetZip: input.targetZip,
          targetTab: input.targetTab,
          campaignName: input.campaignName,
          campaignType: input.campaignType,
        });
        
        return {
          success: true,
          linkId: result[0].insertId,
          linkUrl,
          shortCode,
        };
      }),
    
    // Track a link click
    trackClick: publicProcedure
      .input(z.object({
        linkId: z.number(),
        userIp: z.string().optional(),
        userAgent: z.string().optional(),
        referer: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          
          // Record the click
          await db.insert(linkClicks).values({
            linkId: input.linkId,
            userIp: input.userIp,
            userAgent: input.userAgent,
            referer: input.referer,
          });
          
          // Update click count on the link - fetch current then increment
          const currentLink = await db.select().from(personalizedLinks).where(eq(personalizedLinks.id, input.linkId)).limit(1);
          if (currentLink.length > 0) {
            await db.update(personalizedLinks)
              .set({
                clickCount: (currentLink[0].clickCount || 0) + 1,
                lastClickedAt: new Date(),
              })
              .where(eq(personalizedLinks.id, input.linkId));
          }
          
          return { success: true };
        } catch (error) {
          console.error('[AdminTracking] Track click error:', error);
          return { success: false };
        }
      }),
    
    // Get all personalized links (admin)
    getLinks: protectedProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        campaignName: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const results = await db.select().from(personalizedLinks).orderBy(desc(personalizedLinks.createdAt)).limit(input.limit).offset(input.offset);
        return results;
      }),
    
    // Get link analytics (admin)
    getLinkAnalytics: protectedProcedure
      .input(z.object({
        linkId: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const link = await db.select().from(personalizedLinks).where(eq(personalizedLinks.id, input.linkId)).limit(1);
        const clicks = await db.select().from(linkClicks).where(eq(linkClicks.linkId, input.linkId)).orderBy(desc(linkClicks.clickedAt));
        
        return {
          link: link[0],
          clicks,
          totalClicks: clicks.length,
        };
      }),
    
    // Create a promotion campaign (admin)
    createPromotion: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        type: z.enum(['email', 'sms', 'both']).default('email'),
        targetCity: z.string().optional(),
        targetState: z.string().optional(),
        targetSegment: z.string().optional(),
        emailSubject: z.string().optional(),
        emailPreviewText: z.string().optional(),
        smsMessage: z.string().optional(),
        linkTemplate: z.string().optional(),
        scheduledFor: z.string().optional(), // ISO date string
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const result = await db.insert(promotions).values({
          name: input.name,
          description: input.description,
          type: input.type,
          targetCity: input.targetCity,
          targetState: input.targetState,
          targetSegment: input.targetSegment,
          emailSubject: input.emailSubject,
          emailPreviewText: input.emailPreviewText,
          smsMessage: input.smsMessage,
          linkTemplate: input.linkTemplate,
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
          createdBy: ctx.user.id,
        });
        
        return {
          success: true,
          promotionId: result[0].insertId,
        };
      }),
    
    // Get all promotions (admin)
    getPromotions: protectedProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        status: z.enum(['draft', 'scheduled', 'sent', 'cancelled']).optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        let results;
        if (input.status) {
          results = await db.select().from(promotions).where(eq(promotions.status, input.status)).orderBy(desc(promotions.createdAt)).limit(input.limit).offset(input.offset);
        } else {
          results = await db.select().from(promotions).orderBy(desc(promotions.createdAt)).limit(input.limit).offset(input.offset);
        }
        return results;
      }),
    
    // Track tool usage event
    trackToolUsage: publicProcedure
      .input(z.object({
        email: z.string().email().optional(),
        sessionId: z.string().optional(),
        eventType: z.string(),
        toolName: z.string(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        address: z.string().optional(),
        revenueEstimate: z.number().optional(),
        regulationStatus: z.string().optional(),
        utmSource: z.string().optional(),
        utmMedium: z.string().optional(),
        utmCampaign: z.string().optional(),
        personalizedLinkId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          const result = await db.insert(toolUsageEvents).values({
            email: input.email,
            sessionId: input.sessionId,
            eventType: input.eventType,
            toolName: input.toolName,
            city: input.city,
            state: input.state,
            zipCode: input.zipCode,
            address: input.address,
            revenueEstimate: input.revenueEstimate,
            regulationStatus: input.regulationStatus,
            utmSource: input.utmSource,
            utmMedium: input.utmMedium,
            utmCampaign: input.utmCampaign,
            personalizedLinkId: input.personalizedLinkId,
          });
          
          console.log('[ToolUsage] Event tracked:', input.eventType, input.toolName, input.city);
          
          return {
            success: true,
            eventId: result[0].insertId,
          };
        } catch (error) {
          console.error('[ToolUsage] Error:', error);
          return { success: false };
        }
      }),
    
    // Get tool usage stats (admin)
    getToolUsageStats: protectedProcedure
      .input(z.object({
        days: z.number().default(30),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const results = await db.select().from(toolUsageEvents).orderBy(desc(toolUsageEvents.createdAt)).limit(500);
        
        // Aggregate stats
        const byTool: Record<string, number> = {};
        const byCity: Record<string, number> = {};
        const byEvent: Record<string, number> = {};
        
        for (const event of results) {
          byTool[event.toolName] = (byTool[event.toolName] || 0) + 1;
          if (event.city) {
            byCity[event.city] = (byCity[event.city] || 0) + 1;
          }
          byEvent[event.eventType] = (byEvent[event.eventType] || 0) + 1;
        }
        
        return {
          totalEvents: results.length,
          byTool,
          byCity,
          byEvent,
          recentEvents: results.slice(0, 20),
        };
      }),
    
    // Dashboard summary (admin)
    getDashboardSummary: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Get counts
        const optinsResult = await db.select().from(emailOptins).where(eq(emailOptins.isActive, 1));
        const linksResult = await db.select().from(personalizedLinks);
        const promotionsResult = await db.select().from(promotions);
        const eventsResult = await db.select().from(toolUsageEvents).limit(1000);
        
        // Calculate total clicks
        const totalClicks = linksResult.reduce((sum, link) => sum + (link.clickCount || 0), 0);
        
        return {
          totalOptins: optinsResult.length,
          totalLinks: linksResult.length,
          totalClicks,
          totalPromotions: promotionsResult.length,
          totalToolUsageEvents: eventsResult.length,
          recentOptins: optinsResult.slice(0, 5),
          recentLinks: linksResult.slice(0, 5),
        };
      }),
});
