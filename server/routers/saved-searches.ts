import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { savedSearches } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const savedSearchesRouter = router({
    // Get all saved searches for a user or session
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

          // Get by user ID if logged in, otherwise by session ID
          const userId = ctx.user?.id;
          const sessionId = input.sessionId;

          let searches;
          if (userId) {
            searches = await db
              .select()
              .from(savedSearches)
              .where(eq(savedSearches.userId, userId))
              .orderBy(desc(savedSearches.createdAt));
          } else if (sessionId) {
            searches = await db
              .select()
              .from(savedSearches)
              .where(eq(savedSearches.sessionId, sessionId))
              .orderBy(desc(savedSearches.createdAt));
          } else {
            return { success: true, data: [] };
          }

          return { success: true, data: searches };
        } catch (error) {
          console.error("[SavedSearches] Error listing:", error);
          return { success: false, error: "Failed to load saved searches", data: [] };
        }
      }),

    // Save a new search
    save: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        searchType: z.enum(["market", "property"]),
        marketId: z.string().optional(),
        marketName: z.string().optional(),
        submarketId: z.string().optional(),
        submarketName: z.string().optional(),
        address: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        cachedRevenue: z.number().optional(),
        cachedOccupancy: z.number().optional(),
        cachedAdr: z.number().optional(),
        label: z.string().optional(),
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

          const [result] = await db.insert(savedSearches).values({
            userId: userId || null,
            sessionId: sessionId || null,
            searchType: input.searchType,
            marketId: input.marketId,
            marketName: input.marketName,
            submarketId: input.submarketId,
            submarketName: input.submarketName,
            address: input.address,
            latitude: input.latitude?.toString(),
            longitude: input.longitude?.toString(),
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms?.toString(),
            cachedRevenue: input.cachedRevenue,
            cachedOccupancy: input.cachedOccupancy?.toString(),
            cachedAdr: input.cachedAdr,
            label: input.label,
            notes: input.notes,
          });

          return { success: true, id: Number((result as any).insertId) };
        } catch (error) {
          console.error("[SavedSearches] Error saving:", error);
          return { success: false, error: "Failed to save search" };
        }
      }),

    // Delete a saved search
    delete: publicProcedure
      .input(z.object({
        id: z.number(),
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

          // Ensure user can only delete their own searches
          if (userId) {
            await db
              .delete(savedSearches)
              .where(and(
                eq(savedSearches.id, input.id),
                eq(savedSearches.userId, userId)
              ));
          } else if (sessionId) {
            await db
              .delete(savedSearches)
              .where(and(
                eq(savedSearches.id, input.id),
                eq(savedSearches.sessionId, sessionId)
              ));
          } else {
            return { success: false, error: "User or session ID required" };
          }

          return { success: true };
        } catch (error) {
          console.error("[SavedSearches] Error deleting:", error);
          return { success: false, error: "Failed to delete saved search" };
        }
      }),

    // Update a saved search (label/notes)
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        sessionId: z.string().optional(),
        label: z.string().optional(),
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

          const updates: Record<string, unknown> = {};
          if (input.label !== undefined) updates.label = input.label;
          if (input.notes !== undefined) updates.notes = input.notes;

          if (userId) {
            await db
              .update(savedSearches)
              .set(updates)
              .where(and(
                eq(savedSearches.id, input.id),
                eq(savedSearches.userId, userId)
              ));
          } else if (sessionId) {
            await db
              .update(savedSearches)
              .set(updates)
              .where(and(
                eq(savedSearches.id, input.id),
                eq(savedSearches.sessionId, sessionId)
              ));
          } else {
            return { success: false, error: "User or session ID required" };
          }

          return { success: true };
        } catch (error) {
          console.error("[SavedSearches] Error updating:", error);
          return { success: false, error: "Failed to update saved search" };
        }
      }),
});
