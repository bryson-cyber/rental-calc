/**
 * Webinar Environment Admin Router
 * 
 * Provides admin-only endpoints for managing webinar mode:
 * - Toggle webinar mode on/off
 * - Get current webinar mode status
 * - List all cached properties available for webinar demos
 * - Delete cached properties
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  isWebinarMode,
  toggleWebinarMode,
  getAllCachedProperties,
  deleteCachedProperty,
} from "../webinar-cache";

// Admin-only guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const webinarEnvRouter = router({
  /** Get current webinar mode status */
  getStatus: adminProcedure.query(async () => {
    return {
      isActive: isWebinarMode(),
    };
  }),

  /** Toggle webinar mode on or off */
  toggle: adminProcedure
    .input(z.object({
      enabled: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await toggleWebinarMode(input.enabled, ctx.user.id);
      return {
        isActive: result,
        toggledBy: ctx.user.name || ctx.user.email || `User #${ctx.user.id}`,
      };
    }),

  /** List all cached properties available for webinar demos */
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
