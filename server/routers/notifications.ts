import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { notifications } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const notificationsRouter = router({
    // Get all notifications for the current user
    getAll: publicProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(100).default(20),
        includeRead: z.boolean().default(true),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          return { notifications: [] };
        }
        
        const userId = ctx.user?.id;
        if (!userId) {
          return { notifications: [] };
        }
        
        try {
          const conditions = input.includeRead
            ? eq(notifications.userId, userId)
            : and(eq(notifications.userId, userId), eq(notifications.isRead, 0));
          
          const results = await db
            .select()
            .from(notifications)
            .where(conditions)
            .orderBy(desc(notifications.createdAt))
            .limit(input.limit);
          
          return { notifications: results };
        } catch (error) {
          console.error('[Notifications] Error fetching:', error);
          return { notifications: [] };
        }
      }),
    
    // Mark a notification as read
    markAsRead: publicProcedure
      .input(z.object({
        notificationId: z.number().int(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          return { success: false, error: 'Database not available' };
        }
        
        const userId = ctx.user?.id;
        if (!userId) {
          return { success: false, error: 'User not authenticated' };
        }
        
        try {
          await db
            .update(notifications)
            .set({
              isRead: 1,
              readAt: new Date(),
            })
            .where(and(
              eq(notifications.id, input.notificationId),
              eq(notifications.userId, userId)
            ));
          
          return { success: true };
        } catch (error) {
          console.error('[Notifications] Error marking as read:', error);
          return { success: false, error: 'Failed to mark notification as read' };
        }
      }),
    
    // Mark all notifications as read
    markAllAsRead: publicProcedure
      .mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
          return { success: false, error: 'Database not available' };
        }
        
        const userId = ctx.user?.id;
        if (!userId) {
          return { success: false, error: 'User not authenticated' };
        }
        
        try {
          await db
            .update(notifications)
            .set({
              isRead: 1,
              readAt: new Date(),
            })
            .where(and(
              eq(notifications.userId, userId),
              eq(notifications.isRead, 0)
            ));
          
          return { success: true };
        } catch (error) {
          console.error('[Notifications] Error marking all as read:', error);
          return { success: false, error: 'Failed to mark all notifications as read' };
        }
      }),
    
    // Clear all notifications
    clearAll: publicProcedure
      .mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
          return { success: false, error: 'Database not available' };
        }
        
        const userId = ctx.user?.id;
        if (!userId) {
          return { success: false, error: 'User not authenticated' };
        }
        
        try {
          await db
            .delete(notifications)
            .where(eq(notifications.userId, userId));
          
          return { success: true };
        } catch (error) {
          console.error('[Notifications] Error clearing all:', error);
          return { success: false, error: 'Failed to clear notifications' };
        }
      }),
    
    // Get unread count
    getUnreadCount: publicProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
          return { count: 0 };
        }
        
        const userId = ctx.user?.id;
        if (!userId) {
          return { count: 0 };
        }
        
        try {
          const results = await db
            .select()
            .from(notifications)
            .where(and(
              eq(notifications.userId, userId),
              eq(notifications.isRead, 0)
            ));
          
          return { count: results.length };
        } catch (error) {
          console.error('[Notifications] Error getting unread count:', error);
          return { count: 0 };
        }
      }),
});
