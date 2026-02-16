import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { favoriteProperties } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const favoritesRouter = router({
    // Get all favorite properties for a user or session
    list: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) {
            return { success: false, error: "Database not available", data: [] };
          }

          const userId = ctx.user?.id;
          const sessionId = input.sessionId;

          let favorites;
          if (userId) {
            favorites = await db
              .select()
              .from(favoriteProperties)
              .where(eq(favoriteProperties.userId, userId))
              .orderBy(desc(favoriteProperties.createdAt));
          } else if (sessionId) {
            favorites = await db
              .select()
              .from(favoriteProperties)
              .where(eq(favoriteProperties.sessionId, sessionId))
              .orderBy(desc(favoriteProperties.createdAt));
          } else {
            return { success: true, data: [] };
          }

          return { success: true, data: favorites };
        } catch (error) {
          console.error("[Favorites] Error listing:", error);
          return { success: false, error: "Failed to load favorites", data: [] };
        }
      }),

    // Add a property to favorites
    add: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        address: z.string().min(1, "Address is required"),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        bedrooms: z.number().int().optional(),
        bathrooms: z.number().optional(),
        propertyType: z.string().optional(),
        marketId: z.string().optional(),
        marketName: z.string().optional(),
        annualRevenue: z.number().int().optional(),
        monthlyRevenue: z.number().int().optional(),
        occupancyRate: z.number().optional(),
        averageDailyRate: z.number().int().optional(),
        monthlyRent: z.number().int().optional(),
        estimatedProfit: z.number().int().optional(),
        purchasePrice: z.number().int().optional(),
        zillowUrl: z.string().optional(),
        imageUrl: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) {
            return { success: false, error: "Database not available" };
          }

          const userId = ctx.user?.id;
          const sessionId = input.sessionId;

          if (!userId && !sessionId) {
            return { success: false, error: "User or session ID required" };
          }

          const [result] = await db.insert(favoriteProperties).values({
            userId: userId || null,
            sessionId: sessionId || null,
            address: input.address,
            city: input.city,
            state: input.state,
            zipCode: input.zipCode,
            latitude: input.latitude?.toString(),
            longitude: input.longitude?.toString(),
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms?.toString(),
            propertyType: input.propertyType,
            marketId: input.marketId,
            marketName: input.marketName,
            annualRevenue: input.annualRevenue,
            monthlyRevenue: input.monthlyRevenue,
            occupancyRate: input.occupancyRate?.toString(),
            averageDailyRate: input.averageDailyRate,
            monthlyRent: input.monthlyRent,
            estimatedProfit: input.estimatedProfit,
            purchasePrice: input.purchasePrice,
            zillowUrl: input.zillowUrl,
            imageUrl: input.imageUrl,
            notes: input.notes,
          });

          return { success: true, data: { id: result.insertId } };
        } catch (error) {
          console.error("[Favorites] Error adding:", error);
          return { success: false, error: "Failed to add favorite" };
        }
      }),

    // Remove a property from favorites
    remove: publicProcedure
      .input(z.object({
        id: z.number().int(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) {
            return { success: false, error: "Database not available" };
          }

          const userId = ctx.user?.id;
          const sessionId = input.sessionId;

          if (userId) {
            await db
              .delete(favoriteProperties)
              .where(and(
                eq(favoriteProperties.id, input.id),
                eq(favoriteProperties.userId, userId)
              ));
          } else if (sessionId) {
            await db
              .delete(favoriteProperties)
              .where(and(
                eq(favoriteProperties.id, input.id),
                eq(favoriteProperties.sessionId, sessionId)
              ));
          } else {
            return { success: false, error: "User or session ID required" };
          }

          return { success: true };
        } catch (error) {
          console.error("[Favorites] Error removing:", error);
          return { success: false, error: "Failed to remove favorite" };
        }
      }),

    // Update notes on a favorite property
    updateNotes: publicProcedure
      .input(z.object({
        id: z.number().int(),
        notes: z.string(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) {
            return { success: false, error: "Database not available" };
          }

          const userId = ctx.user?.id;
          const sessionId = input.sessionId;

          if (userId) {
            await db
              .update(favoriteProperties)
              .set({ notes: input.notes })
              .where(and(
                eq(favoriteProperties.id, input.id),
                eq(favoriteProperties.userId, userId)
              ));
          } else if (sessionId) {
            await db
              .update(favoriteProperties)
              .set({ notes: input.notes })
              .where(and(
                eq(favoriteProperties.id, input.id),
                eq(favoriteProperties.sessionId, sessionId)
              ));
          } else {
            return { success: false, error: "User or session ID required" };
          }

          return { success: true };
        } catch (error) {
          console.error("[Favorites] Error updating notes:", error);
          return { success: false, error: "Failed to update notes" };
        }
      }),
});
