/**
 * Notification Service
 * Handles sending notifications to the owner when reports are generated
 * and managing in-app notifications for users
 */

import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { notifications, ownerNotificationLog } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

// Types for notification payloads
export interface PropertyReportNotification {
  address: string;
  city?: string;
  state?: string;
  bedrooms?: number;
  bathrooms?: number;
  annualRevenue?: number;
  occupancyRate?: number;
  verdict?: string;
  userIp?: string;
  userId?: number;
  reportId?: number;
}

export interface MarketReportNotification {
  marketName: string;
  state?: string;
  bedrooms?: number;
  averageRevenue?: number;
  averageOccupancy?: number;
  listingCount?: number;
  userIp?: string;
  userId?: number;
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format percentage for display
 */
function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Send notification to owner when a Property Advisor report is generated
 */
export async function notifyOwnerPropertyReport(data: PropertyReportNotification): Promise<boolean> {
  const db = await getDb();
  
  // Build notification title
  const title = `🏠 New Property Report: ${data.address}`;
  
  // Build notification content with key metrics
  const lines: string[] = [
    `📍 Property: ${data.address}`,
  ];
  
  if (data.city && data.state) {
    lines.push(`📌 Location: ${data.city}, ${data.state}`);
  }
  
  if (data.bedrooms !== undefined && data.bathrooms !== undefined) {
    lines.push(`🛏️ Size: ${data.bedrooms} BR / ${data.bathrooms} BA`);
  }
  
  if (data.annualRevenue !== undefined) {
    lines.push(`💰 Est. Annual Revenue: ${formatCurrency(data.annualRevenue)}`);
  }
  
  if (data.occupancyRate !== undefined) {
    lines.push(`📊 Occupancy Rate: ${formatPercent(data.occupancyRate)}`);
  }
  
  if (data.verdict) {
    const verdictEmoji = data.verdict === 'GO' ? '✅' : data.verdict === 'CAUTION' ? '⚠️' : '❌';
    lines.push(`${verdictEmoji} Verdict: ${data.verdict}`);
  }
  
  lines.push('');
  lines.push(`⏰ Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT`);
  
  const content = lines.join('\n');
  
  // Log the notification attempt
  if (db) {
    try {
      await db.insert(ownerNotificationLog).values({
        notificationType: 'property_report',
        reportId: data.reportId,
        title,
        summary: `${data.address} - ${data.annualRevenue ? formatCurrency(data.annualRevenue) : 'N/A'} annual revenue`,
        triggeredByIp: data.userIp,
        triggeredByUserId: data.userId,
        deliveryStatus: 'pending',
      });
    } catch (err) {
      console.error('[NotificationService] Failed to log notification:', err);
    }
  }
  
  // Send the notification
  const success = await notifyOwner({ title, content });
  
  // Update delivery status
  if (db) {
    try {
      // Get the most recent log entry for this report
      const [logEntry] = await db
        .select()
        .from(ownerNotificationLog)
        .where(eq(ownerNotificationLog.reportId, data.reportId || 0))
        .orderBy(desc(ownerNotificationLog.createdAt))
        .limit(1);
      
      if (logEntry) {
        await db
          .update(ownerNotificationLog)
          .set({
            deliveryStatus: success ? 'sent' : 'failed',
            deliveredAt: success ? new Date() : null,
            errorMessage: success ? null : 'Notification service unavailable',
          })
          .where(eq(ownerNotificationLog.id, logEntry.id));
      }
    } catch (err) {
      console.error('[NotificationService] Failed to update notification log:', err);
    }
  }
  
  return success;
}

/**
 * Send notification to owner when a Market Advisor report is generated
 */
export async function notifyOwnerMarketReport(data: MarketReportNotification): Promise<boolean> {
  const db = await getDb();
  
  // Build notification title
  const title = `📊 New Market Report: ${data.marketName}${data.state ? `, ${data.state}` : ''}`;
  
  // Build notification content with key metrics
  const lines: string[] = [
    `🗺️ Market: ${data.marketName}${data.state ? `, ${data.state}` : ''}`,
  ];
  
  if (data.bedrooms !== undefined) {
    lines.push(`🛏️ Bedroom Filter: ${data.bedrooms} BR`);
  }
  
  if (data.averageRevenue !== undefined) {
    lines.push(`💰 Avg. Annual Revenue: ${formatCurrency(data.averageRevenue)}`);
  }
  
  if (data.averageOccupancy !== undefined) {
    lines.push(`📊 Avg. Occupancy: ${formatPercent(data.averageOccupancy)}`);
  }
  
  if (data.listingCount !== undefined) {
    lines.push(`🏠 Active Listings: ${data.listingCount.toLocaleString()}`);
  }
  
  lines.push('');
  lines.push(`⏰ Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT`);
  
  const content = lines.join('\n');
  
  // Log the notification attempt
  if (db) {
    try {
      await db.insert(ownerNotificationLog).values({
        notificationType: 'market_report',
        title,
        summary: `${data.marketName} - ${data.listingCount || 0} listings analyzed`,
        triggeredByIp: data.userIp,
        triggeredByUserId: data.userId,
        deliveryStatus: 'pending',
      });
    } catch (err) {
      console.error('[NotificationService] Failed to log notification:', err);
    }
  }
  
  // Send the notification
  const success = await notifyOwner({ title, content });
  
  return success;
}

/**
 * Create an in-app notification for a user
 */
export async function createInAppNotification(
  userId: number | null,
  type: 'report_generated' | 'system' | 'alert' | 'info',
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.insert(notifications).values({
      userId,
      type,
      title,
      message,
      metadata: metadata || null,
      isRead: 0,
    });
    return true;
  } catch (err) {
    console.error('[NotificationService] Failed to create in-app notification:', err);
    return false;
  }
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: number,
  limit: number = 20,
  includeRead: boolean = false
): Promise<typeof notifications.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const conditions = includeRead
      ? eq(notifications.userId, userId)
      : and(eq(notifications.userId, userId), eq(notifications.isRead, 0));
    
    const results = await db
      .select()
      .from(notifications)
      .where(conditions)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    
    return results;
  } catch (err) {
    console.error('[NotificationService] Failed to get user notifications:', err);
    return [];
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db
      .update(notifications)
      .set({
        isRead: 1,
        readAt: new Date(),
      })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
    return true;
  } catch (err) {
    console.error('[NotificationService] Failed to mark notification as read:', err);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
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
    return true;
  } catch (err) {
    console.error('[NotificationService] Failed to mark all notifications as read:', err);
    return false;
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  try {
    const results = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, 0)
      ));
    
    return results.length;
  } catch (err) {
    console.error('[NotificationService] Failed to get unread count:', err);
    return 0;
  }
}
