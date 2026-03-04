/**
 * Webinar Environment Admin Router (Per-User Mode)
 * 
 * Provides admin-only endpoints for managing webinar mode:
 * - Toggle webinar mode on/off for the CURRENT admin user
 * - Get current webinar mode status for the CURRENT admin user
 * - List all cached properties available for webinar demos (global pool)
 * - Delete cached properties
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  isWebinarModeForUser,
  toggleWebinarMode,
  getAllCachedProperties,
  deleteCachedProperty,
  getWebinarModeUsers,
} from "../webinar-cache";

// Admin-only guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const webinarEnvRouter = router({
  /** Get current webinar mode status for THIS admin user */
  getStatus: adminProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const isActive = isWebinarModeForUser(userId);
    const allActiveUsers = getWebinarModeUsers();
    return {
      isActive,
      userId,
      activeUserCount: allActiveUsers.length,
      activeUserIds: allActiveUsers,
    };
  }),

  /** Toggle webinar mode on or off for THIS admin user */
  toggle: adminProcedure
    .input(z.object({
      enabled: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const result = await toggleWebinarMode(input.enabled, userId);
      return {
        isActive: result,
        toggledBy: ctx.user.name || ctx.user.email || `User #${userId}`,
        toggledAt: new Date().toISOString(),
      };
    }),

  /** List all cached properties available for webinar demos (global pool) */
  listCachedProperties: adminProcedure.query(async () => {
    const properties = await getAllCachedProperties();
    return { properties };
  }),

  /** Delete a cached property */
  deleteCachedProperty: adminProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      const success = await deleteCachedProperty(input.id);
      return { success };
    }),
});
