import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { marketAlerts } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const marketAlertsRouter = router({
    // List user's market alerts
    list: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        const alerts = await db
          .select()
          .from(marketAlerts)
          .where(input.sessionId ? eq(marketAlerts.sessionId, input.sessionId) : undefined)
          .orderBy(desc(marketAlerts.createdAt));
        
        return alerts;
      }),

    // Create a new market alert
    create: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        email: z.string().email(),
        marketId: z.string(),
        marketName: z.string(),
        alertType: z.enum(['revenue_change', 'occupancy_change', 'adr_change', 'all_changes']).default('all_changes'),
        thresholdPercent: z.number().min(1).max(100).default(10),
        baselineRevenue: z.number().optional(),
        baselineOccupancy: z.number().optional(),
        baselineAdr: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Check if alert already exists for this market/email
        const existing = await db
          .select()
          .from(marketAlerts)
          .where(
            and(
              eq(marketAlerts.marketId, input.marketId),
              eq(marketAlerts.email, input.email)
            )
          )
          .limit(1);
        
        if (existing.length > 0) {
          return { success: true, message: 'Alert already exists', id: existing[0].id };
        }
        
        const result = await db.insert(marketAlerts).values({
          sessionId: input.sessionId,
          email: input.email,
          marketId: input.marketId,
          marketName: input.marketName,
          alertType: input.alertType,
          thresholdPercent: input.thresholdPercent,
          baselineRevenue: input.baselineRevenue,
          baselineOccupancy: input.baselineOccupancy?.toString(),
          baselineAdr: input.baselineAdr,
        });
        
        return { success: true, id: Number((result as any).insertId) };
      }),

    // Update an existing alert
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        alertType: z.enum(['revenue_change', 'occupancy_change', 'adr_change', 'all_changes']).optional(),
        thresholdPercent: z.number().min(1).max(100).optional(),
        isActive: z.enum(['true', 'false']).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const updateData: any = {};
        if (input.alertType) updateData.alertType = input.alertType;
        if (input.thresholdPercent) updateData.thresholdPercent = input.thresholdPercent;
        if (input.isActive) updateData.isActive = input.isActive;
        
        await db.update(marketAlerts)
          .set(updateData)
          .where(eq(marketAlerts.id, input.id));
        
        return { success: true };
      }),

    // Delete an alert
    delete: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        await db.delete(marketAlerts).where(eq(marketAlerts.id, input.id));
        
        return { success: true };
      }),

    // Toggle alert active status
    toggle: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const existing = await db
          .select()
          .from(marketAlerts)
          .where(eq(marketAlerts.id, input.id))
          .limit(1);
        
        if (existing.length === 0) {
          throw new Error('Alert not found');
        }
        
        const newStatus = existing[0].isActive === 'true' ? 'false' : 'true';
        
        await db.update(marketAlerts)
          .set({ isActive: newStatus })
          .where(eq(marketAlerts.id, input.id));
        
        return { success: true, isActive: newStatus };
      }),
});
