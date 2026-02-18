import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { emailOptins, personalizedLinks, linkClicks, promotions, toolUsageEvents, users } from "../../drizzle/schema";
import { eq, desc, sql, and, gte, isNotNull } from "drizzle-orm";

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
      .mutation(async ({ input, ctx }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          
          // Capture userId from session when available
          const userId = ctx.user?.id || undefined;
          const email = input.email || ctx.user?.email || undefined;
          
          const result = await db.insert(toolUsageEvents).values({
            email,
            sessionId: input.sessionId,
            userId,
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
          
          console.log('[ToolUsage] Event tracked:', input.eventType, input.toolName, input.city, userId ? `user:${userId}` : 'anonymous');
          
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
    
    // Get per-user activity feed (admin) — shows what each user is doing
    getUserActivityFeed: protectedProcedure
      .input(z.object({
        limit: z.number().default(100),
        userId: z.number().optional(), // Filter to specific user
        days: z.number().default(30),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - input.days);
        
        const conditions = [
          gte(toolUsageEvents.createdAt, cutoffDate),
        ];
        
        if (input.userId) {
          conditions.push(eq(toolUsageEvents.userId, input.userId));
        }
        
        const events = await db
          .select({
            id: toolUsageEvents.id,
            userId: toolUsageEvents.userId,
            email: toolUsageEvents.email,
            sessionId: toolUsageEvents.sessionId,
            eventType: toolUsageEvents.eventType,
            toolName: toolUsageEvents.toolName,
            city: toolUsageEvents.city,
            state: toolUsageEvents.state,
            zipCode: toolUsageEvents.zipCode,
            address: toolUsageEvents.address,
            revenueEstimate: toolUsageEvents.revenueEstimate,
            regulationStatus: toolUsageEvents.regulationStatus,
            utmSource: toolUsageEvents.utmSource,
            utmMedium: toolUsageEvents.utmMedium,
            utmCampaign: toolUsageEvents.utmCampaign,
            createdAt: toolUsageEvents.createdAt,
          })
          .from(toolUsageEvents)
          .where(and(...conditions))
          .orderBy(desc(toolUsageEvents.createdAt))
          .limit(input.limit);
        
        return events;
      }),
    
    // Get user activity summary — grouped by user with their key actions (admin)
    getUserActivitySummary: protectedProcedure
      .input(z.object({
        days: z.number().default(30),
        limit: z.number().default(50),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - input.days);
        
        // Get all events in the time range that have a userId or email
        const events = await db
          .select()
          .from(toolUsageEvents)
          .where(and(
            gte(toolUsageEvents.createdAt, cutoffDate),
          ))
          .orderBy(desc(toolUsageEvents.createdAt))
          .limit(2000);
        
        // Group by user (userId or email or sessionId)
        const userMap = new Map<string, {
          userId: number | null;
          email: string | null;
          sessionId: string | null;
          userName: string | null;
          totalEvents: number;
          lastActive: Date;
          firstSeen: Date;
          toolsUsed: Set<string>;
          citiesSearched: Set<string>;
          propertiesViewed: string[];
          reportsGenerated: number;
          revenueEstimates: number[];
          utmSource: string | null;
          utmCampaign: string | null;
          events: typeof events;
        }>();
        
        for (const event of events) {
          // Use userId > email > sessionId as the grouping key
          const key = event.userId ? `user:${event.userId}` : event.email ? `email:${event.email}` : `session:${event.sessionId}`;
          
          if (!userMap.has(key)) {
            userMap.set(key, {
              userId: event.userId,
              email: event.email,
              sessionId: event.sessionId,
              userName: null,
              totalEvents: 0,
              lastActive: event.createdAt,
              firstSeen: event.createdAt,
              toolsUsed: new Set(),
              citiesSearched: new Set(),
              propertiesViewed: [],
              reportsGenerated: 0,
              revenueEstimates: [],
              utmSource: event.utmSource,
              utmCampaign: event.utmCampaign,
              events: [],
            });
          }
          
          const user = userMap.get(key)!;
          user.totalEvents++;
          user.toolsUsed.add(event.toolName);
          if (event.city && event.state) {
            user.citiesSearched.add(`${event.city}, ${event.state}`);
          }
          if (event.address) {
            user.propertiesViewed.push(event.address);
          }
          if (event.eventType === 'report_generated') {
            user.reportsGenerated++;
          }
          if (event.revenueEstimate) {
            user.revenueEstimates.push(event.revenueEstimate);
          }
          if (event.createdAt < user.firstSeen) {
            user.firstSeen = event.createdAt;
          }
          // Update email/userId if we have better info
          if (event.userId && !user.userId) user.userId = event.userId;
          if (event.email && !user.email) user.email = event.email;
          if (!user.utmSource && event.utmSource) user.utmSource = event.utmSource;
          if (!user.utmCampaign && event.utmCampaign) user.utmCampaign = event.utmCampaign;
          user.events.push(event);
        }
        
        // Resolve user names from the users table
        const userIds = Array.from(userMap.values()).filter(u => u.userId).map(u => u.userId!);
        if (userIds.length > 0) {
          try {
            const userRows = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);
            const nameMap = new Map(userRows.map(u => [u.id, { name: u.name, email: u.email }]));
            for (const user of Array.from(userMap.values())) {
              if (user.userId && nameMap.has(user.userId)) {
                const info = nameMap.get(user.userId)!;
                user.userName = info.name;
                if (!user.email) user.email = info.email;
              }
            }
          } catch (e) {
            // Non-critical — continue without names
          }
        }
        
        // Convert to array and sort by last active
        const summaries = Array.from(userMap.values())
          .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime())
          .slice(0, input.limit)
          .map(u => ({
            userId: u.userId,
            email: u.email,
            sessionId: u.sessionId,
            userName: u.userName,
            totalEvents: u.totalEvents,
            lastActive: u.lastActive,
            firstSeen: u.firstSeen,
            toolsUsed: Array.from(u.toolsUsed),
            citiesSearched: Array.from(u.citiesSearched),
            propertiesViewed: Array.from(new Set(u.propertiesViewed)).slice(0, 10), // Dedupe, limit to 10
            reportsGenerated: u.reportsGenerated,
            avgRevenueEstimate: u.revenueEstimates.length > 0 
              ? Math.round(u.revenueEstimates.reduce((a: number, b: number) => a + b, 0) / u.revenueEstimates.length)
              : null,
            utmSource: u.utmSource,
            utmCampaign: u.utmCampaign,
            recentEvents: u.events.slice(0, 5).map((e: any) => ({
              eventType: e.eventType,
              toolName: e.toolName,
              city: e.city,
              state: e.state,
              address: e.address,
              revenueEstimate: e.revenueEstimate,
              createdAt: e.createdAt,
            })),
          }));
        
        return {
          totalUsers: userMap.size,
          users: summaries,
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
