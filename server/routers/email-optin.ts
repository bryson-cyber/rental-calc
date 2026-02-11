import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { emailOptins } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const emailOptinRouter = router({
    // Submit email opt-in (public - anyone can opt in)
    submit: publicProcedure
      .input(z.object({
        email: z.string().email(),
        phone: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        wantsMarketUpdates: z.boolean().default(true),
        wantsRegulationAlerts: z.boolean().default(true),
        wantsSmsAlerts: z.boolean().default(false),
        source: z.string().optional(), // Which tool they opted in from
        utmSource: z.string().optional(),
        utmMedium: z.string().optional(),
        utmCampaign: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          
          // Check if email already exists
          const existing = await db.select().from(emailOptins).where(eq(emailOptins.email, input.email)).limit(1);
          
          if (existing.length > 0) {
            // Update existing opt-in
            await db.update(emailOptins)
              .set({
                phone: input.phone || existing[0].phone,
                firstName: input.firstName || existing[0].firstName,
                lastName: input.lastName || existing[0].lastName,
                city: input.city || existing[0].city,
                state: input.state || existing[0].state,
                zipCode: input.zipCode || existing[0].zipCode,
                wantsMarketUpdates: input.wantsMarketUpdates ? 1 : 0,
                wantsRegulationAlerts: input.wantsRegulationAlerts ? 1 : 0,
                wantsSmsAlerts: input.wantsSmsAlerts ? 1 : 0,
                isActive: 1,
                unsubscribedAt: null,
              })
              .where(eq(emailOptins.id, existing[0].id));
            
            return {
              success: true,
              message: 'Preferences updated',
              isNew: false,
              optinId: existing[0].id,
            };
          }
          
          // Create new opt-in
          const result = await db.insert(emailOptins).values({
            email: input.email,
            phone: input.phone,
            firstName: input.firstName,
            lastName: input.lastName,
            city: input.city,
            state: input.state,
            zipCode: input.zipCode,
            wantsMarketUpdates: input.wantsMarketUpdates ? 1 : 0,
            wantsRegulationAlerts: input.wantsRegulationAlerts ? 1 : 0,
            wantsSmsAlerts: input.wantsSmsAlerts ? 1 : 0,
            source: input.source,
            utmSource: input.utmSource,
            utmMedium: input.utmMedium,
            utmCampaign: input.utmCampaign,
          });
          
          console.log('[EmailOptin] New opt-in:', input.email, input.city, input.state);
          
          return {
            success: true,
            message: 'Successfully subscribed',
            isNew: true,
            optinId: result[0].insertId,
          };
        } catch (error) {
          console.error('[EmailOptin] Error:', error);
          return {
            success: false,
            error: 'Failed to save opt-in',
          };
        }
      }),
    
    // Unsubscribe
    unsubscribe: publicProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        try {
           const db = await getDb();
          if (!db) throw new Error('Database not available');
          await db.update(emailOptins)
            .set({
              isActive: 0,
              unsubscribedAt: new Date(),
            })
            .where(eq(emailOptins.email, input.email));
          
          return { success: true };
        } catch (error) {
          console.error('[EmailOptin] Unsubscribe error:', error);
          return { success: false };
        }
      }),
    
    // Get all opt-ins (admin only)
    list: protectedProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        activeOnly: z.boolean().default(true),
      }))
      .query(async ({ input, ctx }) => {
        // Check admin role
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        let results;
        if (input.activeOnly) {
          results = await db.select().from(emailOptins).where(eq(emailOptins.isActive, 1)).orderBy(desc(emailOptins.createdAt)).limit(input.limit).offset(input.offset);
        } else {
          results = await db.select().from(emailOptins).orderBy(desc(emailOptins.createdAt)).limit(input.limit).offset(input.offset);
        }
        
        return results;
      }),
});
