import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { favoriteListings } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const favoriteListingsRouter = router({
    // Get all favorite listing IDs for a user or session
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
              .from(favoriteListings)
              .where(eq(favoriteListings.userId, userId))
              .orderBy(desc(favoriteListings.createdAt));
          } else if (sessionId) {
            favorites = await db
              .select()
              .from(favoriteListings)
              .where(eq(favoriteListings.sessionId, sessionId))
              .orderBy(desc(favoriteListings.createdAt));
          } else {
            return { success: true, data: [] };
          }

          return { success: true, data: favorites };
        } catch (error) {
          console.error("[FavoriteListings] Error listing:", error);
          return { success: false, error: "Failed to load favorites", data: [] };
        }
      }),

    // Add a listing to favorites
    add: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        listingId: z.string().min(1, "Listing ID is required"),
        title: z.string().optional(),
        bedrooms: z.number().int().optional(),
        bathrooms: z.number().optional(),
        revenue: z.number().int().optional(),
        occupancy: z.number().optional(),
        adr: z.number().int().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        airbnbUrl: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        searchAddress: z.string().optional(),
        searchSubmarketId: z.string().optional(),
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

          // Check if already favorited
          const existing = await db
            .select()
            .from(favoriteListings)
            .where(
              and(
                eq(favoriteListings.listingId, input.listingId),
                userId ? eq(favoriteListings.userId, userId) : eq(favoriteListings.sessionId, sessionId!)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            return { success: true, data: { id: existing[0].id }, message: "Already favorited" };
          }

          const [result] = await db.insert(favoriteListings).values({
            userId: userId || null,
            sessionId: sessionId || null,
            listingId: input.listingId,
            title: input.title,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms?.toString(),
            revenue: input.revenue,
            occupancy: input.occupancy?.toString(),
            adr: input.adr,
            latitude: input.latitude?.toString(),
            longitude: input.longitude?.toString(),
            airbnbUrl: input.airbnbUrl,
            thumbnailUrl: input.thumbnailUrl,
            searchAddress: input.searchAddress,
            searchSubmarketId: input.searchSubmarketId,
          });

          return { success: true, data: { id: result.insertId } };
        } catch (error) {
          console.error("[FavoriteListings] Error adding:", error);
          return { success: false, error: "Failed to add favorite" };
        }
      }),

    // Remove a listing from favorites by listing ID
    remove: publicProcedure
      .input(z.object({
        listingId: z.string().min(1, "Listing ID is required"),
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
              .delete(favoriteListings)
              .where(and(
                eq(favoriteListings.listingId, input.listingId),
                eq(favoriteListings.userId, userId)
              ));
          } else if (sessionId) {
            await db
              .delete(favoriteListings)
              .where(and(
                eq(favoriteListings.listingId, input.listingId),
                eq(favoriteListings.sessionId, sessionId)
              ));
          } else {
            return { success: false, error: "User or session ID required" };
          }

          return { success: true };
        } catch (error) {
          console.error("[FavoriteListings] Error removing:", error);
          return { success: false, error: "Failed to remove favorite" };
        }
      }),

    // Toggle a listing favorite (add if not exists, remove if exists)
    toggle: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        listingId: z.string().min(1, "Listing ID is required"),
        title: z.string().optional(),
        bedrooms: z.number().int().optional(),
        bathrooms: z.number().optional(),
        revenue: z.number().int().optional(),
        occupancy: z.number().optional(),
        adr: z.number().int().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        airbnbUrl: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        searchAddress: z.string().optional(),
        searchSubmarketId: z.string().optional(),
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

          // Check if already favorited
          const existing = await db
            .select()
            .from(favoriteListings)
            .where(
              and(
                eq(favoriteListings.listingId, input.listingId),
                userId ? eq(favoriteListings.userId, userId) : eq(favoriteListings.sessionId, sessionId!)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            // Remove it
            await db
              .delete(favoriteListings)
              .where(eq(favoriteListings.id, existing[0].id));
            return { success: true, action: "removed", isFavorited: false };
          } else {
            // Add it
            const [result] = await db.insert(favoriteListings).values({
              userId: userId || null,
              sessionId: sessionId || null,
              listingId: input.listingId,
              title: input.title,
              bedrooms: input.bedrooms,
              bathrooms: input.bathrooms?.toString(),
              revenue: input.revenue,
              occupancy: input.occupancy?.toString(),
              adr: input.adr,
              latitude: input.latitude?.toString(),
              longitude: input.longitude?.toString(),
              airbnbUrl: input.airbnbUrl,
              thumbnailUrl: input.thumbnailUrl,
              searchAddress: input.searchAddress,
              searchSubmarketId: input.searchSubmarketId,
            });
            return { success: true, action: "added", isFavorited: true, id: result.insertId };
          }
        } catch (error) {
          console.error("[FavoriteListings] Error toggling:", error);
          return { success: false, error: "Failed to toggle favorite" };
        }
      }),
});
