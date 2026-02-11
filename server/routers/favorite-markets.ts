import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { favoriteMarkets } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const favoriteMarketsRouter = router({
    // List user's favorite markets
    list: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        const favorites = await db
          .select()
          .from(favoriteMarkets)
          .where(input.sessionId ? eq(favoriteMarkets.sessionId, input.sessionId) : undefined)
          .orderBy(desc(favoriteMarkets.createdAt));
        
        return favorites;
      }),

    // Add a market to favorites
    add: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        marketId: z.string(),
        marketName: z.string(),
        marketType: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        marketScore: z.number().optional(),
        listingCount: z.number().optional(),
        averageRevenue: z.number().optional(),
        averageOccupancy: z.number().optional(),
        averageAdr: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Check if already favorited
        const existing = await db
          .select()
          .from(favoriteMarkets)
          .where(
            and(
              eq(favoriteMarkets.marketId, input.marketId),
              input.sessionId ? eq(favoriteMarkets.sessionId, input.sessionId) : undefined
            )
          )
          .limit(1);
        
        if (existing.length > 0) {
          return { success: true, message: 'Already favorited', id: existing[0].id };
        }
        
        const result = await db.insert(favoriteMarkets).values({
          sessionId: input.sessionId,
          marketId: input.marketId,
          marketName: input.marketName,
          marketType: input.marketType,
          state: input.state,
          country: input.country,
          marketScore: input.marketScore?.toString(),
          listingCount: input.listingCount,
          averageRevenue: input.averageRevenue,
          averageOccupancy: input.averageOccupancy?.toString(),
          averageAdr: input.averageAdr,
        });
        
        return { success: true, id: Number((result as any).insertId) };
      }),

    // Remove a market from favorites
    remove: publicProcedure
      .input(z.object({
        id: z.number().optional(),
        marketId: z.string().optional(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        if (input.id) {
          await db.delete(favoriteMarkets).where(eq(favoriteMarkets.id, input.id));
        } else if (input.marketId && input.sessionId) {
          await db.delete(favoriteMarkets).where(
            and(
              eq(favoriteMarkets.marketId, input.marketId),
              eq(favoriteMarkets.sessionId, input.sessionId)
            )
          );
        }
        
        return { success: true };
      }),

    // Check if a market is favorited
    isFavorited: publicProcedure
      .input(z.object({
        marketId: z.string(),
        sessionId: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return false;
        
        const existing = await db
          .select()
          .from(favoriteMarkets)
          .where(
            and(
              eq(favoriteMarkets.marketId, input.marketId),
              input.sessionId ? eq(favoriteMarkets.sessionId, input.sessionId) : undefined
            )
          )
          .limit(1);
        
        return existing.length > 0;
      }),
});
