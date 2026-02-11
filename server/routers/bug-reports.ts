import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bugReports } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const bugReportsRouter = router({
    // Create a new bug report
    create: publicProcedure
      .input(z.object({
        title: z.string().min(5, 'Title must be at least 5 characters'),
        description: z.string().optional(),
        stepsToReproduce: z.string().optional(),
        expectedBehavior: z.string().optional(),
        actualBehavior: z.string().optional(),
        toolName: z.string().optional(),
        pagePath: z.string().optional(),
        propertyAddress: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        marketId: z.string().optional(),
        browserInfo: z.string().optional(),
        screenSize: z.string().optional(),
        errorMessage: z.string().optional(),
        consoleErrors: z.string().optional(),
        screenshotUrl: z.string().optional(),
        reporterEmail: z.string().email().optional(),
        reporterName: z.string().optional(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          
          // Generate unique share code
          const shareCode = `BUG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          
          const result = await db.insert(bugReports).values({
            shareCode,
            title: input.title,
            description: input.description,
            stepsToReproduce: input.stepsToReproduce,
            expectedBehavior: input.expectedBehavior,
            actualBehavior: input.actualBehavior,
            toolName: input.toolName,
            pagePath: input.pagePath,
            propertyAddress: input.propertyAddress,
            city: input.city,
            state: input.state,
            marketId: input.marketId,
            browserInfo: input.browserInfo,
            screenSize: input.screenSize,
            errorMessage: input.errorMessage,
            consoleErrors: input.consoleErrors,
            screenshotUrl: input.screenshotUrl,
            reporterEmail: input.reporterEmail,
            reporterName: input.reporterName,
            sessionId: input.sessionId,
            userId: ctx.user?.id,
          });
          
          console.log('[BugReport] New report created:', shareCode, input.title);
          
          return {
            success: true,
            shareCode,
            bugId: result[0].insertId,
            shareUrl: `https://coachinayahturnkeytool.com/bug/${shareCode}`,
          };
        } catch (error) {
          console.error('[BugReport] Error creating report:', error);
          return {
            success: false,
            error: 'Failed to create bug report',
          };
        }
      }),
    
    // Get bug report by share code (public)
    getByShareCode: publicProcedure
      .input(z.object({
        shareCode: z.string(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const result = await db.select().from(bugReports).where(eq(bugReports.shareCode, input.shareCode)).limit(1);
        
        if (result.length === 0) {
          return null;
        }
        
        return result[0];
      }),
    
    // List all bug reports (admin only)
    list: protectedProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        status: z.enum(['new', 'investigating', 'in_progress', 'resolved', 'wont_fix', 'duplicate']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const results = await db.select().from(bugReports).orderBy(desc(bugReports.createdAt)).limit(input.limit).offset(input.offset);
        return results;
      }),
    
    // Update bug report status (admin only)
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['new', 'investigating', 'in_progress', 'resolved', 'wont_fix', 'duplicate']),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        resolution: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const updateData: Record<string, unknown> = {
          status: input.status,
        };
        
        if (input.priority) {
          updateData.priority = input.priority;
        }
        
        if (input.resolution) {
          updateData.resolution = input.resolution;
        }
        
        if (input.status === 'resolved') {
          updateData.resolvedAt = new Date();
        }
        
        await db.update(bugReports).set(updateData).where(eq(bugReports.id, input.id));
        
        return { success: true };
      }),
});
