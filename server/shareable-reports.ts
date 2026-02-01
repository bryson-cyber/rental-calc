/**
 * Universal Shareable Reports Service
 * Handles creating shareable links for all tools and sending notifications
 */

import { getDb } from "./db";
import { universalShareableReports, notificationAnalytics } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { generateShareCode, sendSMSNotification, sendEmailNotification } from "./sms-email-notifications";

// Report types supported by the universal shareable system
export type ShareableReportType = 
  | "revenue"      // Revenue Calculator (Step 3)
  | "validator"    // Property Validator (Step 5)
  | "market"       // Market Advisor (Step 8)
  | "ai_advisor"   // AI Advisor (Step 9)
  | "listings"     // Explore Listings (Step 4)
  | "comparison"   // Compare Favorites (Step 6)
  | "map";         // Map View (Step 7)

// Input for creating a shareable report
export interface CreateShareableReportInput {
  reportType: ShareableReportType;
  
  // Property information (for property-based reports)
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  bedrooms?: number;
  bathrooms?: number;
  monthlyRent?: number;
  
  // Market information (for market-based reports)
  marketId?: string;
  marketName?: string;
  
  // Full report data (JSON)
  reportData: any;
  
  // Summary for preview
  title?: string;
  summary?: string;
  
  // Key metrics for quick display
  annualRevenue?: number;
  occupancyRate?: number;
  averageDailyRate?: number;
  profitMargin?: number;
  verdict?: string;
  
  // Creator information
  creatorEmail?: string;
  creatorPhone?: string;
  creatorName?: string;
  creatorUserId?: number;
  sessionId?: string;
}

// Result of creating a shareable report
export interface CreateShareableReportResult {
  success: boolean;
  shareCode?: string;
  shareUrl?: string;
  reportId?: number;
  error?: string;
}

// Result of sending notifications
export interface NotificationResult {
  sms?: { success: boolean; error?: string };
  email?: { success: boolean; error?: string };
}

/**
 * Create a shareable report for any tool type
 */
export async function createShareableReport(
  input: CreateShareableReportInput
): Promise<CreateShareableReportResult> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, error: "Database not available" };
    }
    
    const shareCode = generateShareCode();
    
    const [result] = await db.insert(universalShareableReports).values({
      shareCode,
      reportType: input.reportType,
      address: input.address,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      latitude: input.latitude?.toString(),
      longitude: input.longitude?.toString(),
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms?.toString(),
      monthlyRent: input.monthlyRent,
      marketId: input.marketId,
      marketName: input.marketName,
      reportData: input.reportData,
      title: input.title,
      summary: input.summary,
      annualRevenue: input.annualRevenue,
      occupancyRate: input.occupancyRate?.toString(),
      averageDailyRate: input.averageDailyRate,
      profitMargin: input.profitMargin?.toString(),
      verdict: input.verdict,
      creatorEmail: input.creatorEmail,
      creatorPhone: input.creatorPhone,
      creatorName: input.creatorName,
      creatorUserId: input.creatorUserId,
      sessionId: input.sessionId,
    });
    
    console.log(`[ShareableReport] Created ${input.reportType} report with code: ${shareCode}`);
    
    return {
      success: true,
      shareCode,
      shareUrl: `/share/${shareCode}`,
      reportId: result.insertId,
    };
  } catch (error) {
    console.error("[ShareableReport] Error creating report:", error);
    return { success: false, error: "Failed to create shareable report" };
  }
}

/**
 * Get a shareable report by share code
 */
export async function getShareableReport(shareCode: string) {
  try {
    const db = await getDb();
    if (!db) return null;
    
    const [report] = await db.select()
      .from(universalShareableReports)
      .where(eq(universalShareableReports.shareCode, shareCode))
      .limit(1);
    
    if (report) {
      // Increment view count
      await db.execute(
        `UPDATE universal_shareable_reports SET viewCount = viewCount + 1, lastViewedAt = NOW() WHERE id = ${report.id}`
      );
    }
    
    return report;
  } catch (error) {
    console.error("[ShareableReport] Error getting report:", error);
    return null;
  }
}

/**
 * Send notifications for a shareable report
 */
export async function sendShareableReportNotifications(
  shareCode: string,
  reportType: ShareableReportType,
  contact: {
    phone?: string;
    email?: string;
    name?: string;
  },
  context: {
    city?: string;
    state?: string;
    address?: string;
    title?: string;
    isAutoNotification?: boolean;
    triggeredBy?: string;
    senderUserId?: number;
    sessionId?: string;
  }
): Promise<NotificationResult> {
  const results: NotificationResult = {};
  const baseUrl = process.env.VITE_APP_URL || "https://coachinayahturnkeytool.com";
  const reportUrl = `${baseUrl}/share/${shareCode}`;
  
  // Get friendly report type name
  const reportTypeNames: Record<ShareableReportType, string> = {
    revenue: "Revenue Analysis",
    validator: "Property Validation",
    market: "Market Analysis",
    ai_advisor: "AI Advisor Report",
    listings: "Listings Report",
    comparison: "Property Comparison",
    map: "Map View Report",
  };
  const reportTypeName = reportTypeNames[reportType] || "Analysis Report";
  
  // Build location string
  const location = context.address || 
    (context.city && context.state ? `${context.city}, ${context.state}` : "your selected area");
  
  // Send SMS if phone provided
  if (contact.phone) {
    const smsMessage = `Your ${reportTypeName} for ${location} is ready! View: ${reportUrl}`;
    results.sms = await sendSMSNotification(contact.phone, smsMessage);
    
    // Track notification
    await trackNotification({
      notificationType: "sms",
      reportType,
      shareCode,
      recipientPhone: contact.phone,
      recipientName: contact.name,
      city: context.city,
      state: context.state,
      address: context.address,
      status: results.sms.success ? "sent" : "failed",
      errorMessage: results.sms.error,
      isAutoNotification: context.isAutoNotification,
      triggeredBy: context.triggeredBy,
      senderUserId: context.senderUserId,
      sessionId: context.sessionId,
    });
  }
  
  // Send Email if email provided
  if (contact.email) {
    const emailSubject = `${reportTypeName}: ${location}`;
    const emailBody = `Hi ${contact.name || "there"},

Your ${reportTypeName} is ready!

${context.title ? `Report: ${context.title}\n` : ""}Location: ${location}

View your full report here: ${reportUrl}

This report includes comprehensive analysis and data to help you make informed decisions.

Questions? Reply to this email or visit coachinayahturnkeytool.com

Best,
Coach Inayah Team`;
    
    results.email = await sendEmailNotification(contact.email, emailSubject, emailBody, contact.name);
    
    // Track notification
    await trackNotification({
      notificationType: "email",
      reportType,
      shareCode,
      recipientEmail: contact.email,
      recipientName: contact.name,
      city: context.city,
      state: context.state,
      address: context.address,
      status: results.email.success ? "sent" : "failed",
      errorMessage: results.email.error,
      isAutoNotification: context.isAutoNotification,
      triggeredBy: context.triggeredBy,
      senderUserId: context.senderUserId,
      sessionId: context.sessionId,
    });
  }
  
  // Update the report with notification status
  try {
    const db = await getDb();
    if (db) {
      const updates: string[] = [];
      if (results.sms?.success && contact.phone) {
        updates.push(`smsSentTo = '${contact.phone}', smsSentAt = NOW()`);
      }
      if (results.email?.success && contact.email) {
        updates.push(`emailSentTo = '${contact.email}', emailSentAt = NOW()`);
      }
      if (context.isAutoNotification) {
        updates.push(`autoNotificationSent = 1`);
      }
      if (updates.length > 0) {
        await db.execute(
          `UPDATE universal_shareable_reports SET ${updates.join(", ")} WHERE shareCode = '${shareCode}'`
        );
      }
    }
  } catch (error) {
    console.error("[ShareableReport] Error updating notification status:", error);
  }
  
  return results;
}

/**
 * Track a notification for analytics
 */
async function trackNotification(data: {
  notificationType: "sms" | "email";
  reportType: ShareableReportType;
  shareCode: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientName?: string;
  city?: string;
  state?: string;
  address?: string;
  status: "pending" | "sent" | "delivered" | "failed" | "opened" | "clicked";
  errorMessage?: string;
  isAutoNotification?: boolean;
  triggeredBy?: string;
  senderUserId?: number;
  sessionId?: string;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    
    await db.insert(notificationAnalytics).values({
      notificationType: data.notificationType,
      reportType: data.reportType,
      shareCode: data.shareCode,
      recipientPhone: data.recipientPhone,
      recipientEmail: data.recipientEmail,
      recipientName: data.recipientName,
      city: data.city,
      state: data.state,
      address: data.address,
      status: data.status,
      errorMessage: data.errorMessage,
      isAutoNotification: data.isAutoNotification ? 1 : 0,
      triggeredBy: data.triggeredBy,
      senderUserId: data.senderUserId,
      sessionId: data.sessionId,
    });
    
    console.log(`[NotificationAnalytics] Tracked ${data.notificationType} notification for ${data.shareCode}`);
  } catch (error) {
    console.error("[NotificationAnalytics] Error tracking notification:", error);
  }
}

/**
 * Create shareable report and send notifications in one call
 * This is the main function for auto-notification flow
 */
export async function createAndNotifyShareableReport(
  input: CreateShareableReportInput,
  contact: {
    phone?: string;
    email?: string;
    name?: string;
  },
  options?: {
    isAutoNotification?: boolean;
    triggeredBy?: string;
  }
): Promise<{
  success: boolean;
  shareCode?: string;
  shareUrl?: string;
  reportId?: number;
  notificationsSent?: NotificationResult;
  error?: string;
}> {
  // Only proceed if at least one contact method provided
  if (!contact.email && !contact.phone) {
    return {
      success: false,
      error: "No contact information provided for notification",
    };
  }
  
  // Create the shareable report
  const createResult = await createShareableReport(input);
  
  if (!createResult.success || !createResult.shareCode) {
    return {
      success: false,
      error: createResult.error || "Failed to create shareable report",
    };
  }
  
  // Send notifications
  const notificationsSent = await sendShareableReportNotifications(
    createResult.shareCode,
    input.reportType,
    contact,
    {
      city: input.city,
      state: input.state,
      address: input.address,
      title: input.title,
      isAutoNotification: options?.isAutoNotification ?? true,
      triggeredBy: options?.triggeredBy,
      senderUserId: input.creatorUserId,
      sessionId: input.sessionId,
    }
  );
  
  console.log(
    `[ShareableReport] Created and notified: ${createResult.shareCode}, SMS: ${notificationsSent.sms?.success || false}, Email: ${notificationsSent.email?.success || false}`
  );
  
  return {
    success: true,
    shareCode: createResult.shareCode,
    shareUrl: createResult.shareUrl,
    reportId: createResult.reportId,
    notificationsSent,
  };
}

/**
 * Get notification analytics summary
 */
export async function getNotificationAnalytics(options?: {
  reportType?: ShareableReportType;
  startDate?: Date;
  endDate?: Date;
}) {
  try {
    const db = await getDb();
    if (!db) return null;
    
    // Get report counts from universal_shareable_reports table
    const whereClause = options?.reportType ? `WHERE reportType = '${options.reportType}'` : "";
    
    const [reportCounts] = await db.execute(`
      SELECT 
        reportType,
        COUNT(*) as totalCount,
        SUM(viewCount) as totalViews,
        SUM(CASE WHEN smsSentAt IS NOT NULL THEN 1 ELSE 0 END) as totalSmsSent,
        SUM(CASE WHEN emailSentAt IS NOT NULL THEN 1 ELSE 0 END) as totalEmailsSent
      FROM universal_shareable_reports
      ${whereClause}
      GROUP BY reportType
    `) as any[];
    
    // Get recent notifications from notification_analytics table
    const [recentNotifications] = await db.execute(`
      SELECT 
        id,
        notificationType as channel,
        reportType,
        shareCode,
        status,
        recipientEmail,
        recipientPhone,
        createdAt
      FROM notification_analytics
      ORDER BY createdAt DESC
      LIMIT 20
    `) as any[];
    
    // Calculate totals
    let totalReports = 0;
    let totalViews = 0;
    let totalSmsSent = 0;
    let totalEmailsSent = 0;
    const byType: Record<string, { count: number; views: number; smsSent: number; emailsSent: number }> = {};
    
    if (Array.isArray(reportCounts)) {
      for (const row of reportCounts as any[]) {
        const count = Number(row.totalCount) || 0;
        const views = Number(row.totalViews) || 0;
        const smsSent = Number(row.totalSmsSent) || 0;
        const emailsSent = Number(row.totalEmailsSent) || 0;
        
        totalReports += count;
        totalViews += views;
        totalSmsSent += smsSent;
        totalEmailsSent += emailsSent;
        
        byType[row.reportType] = {
          count,
          views,
          smsSent,
          emailsSent,
        };
      }
    }
    
    // Calculate success rates from notification_analytics
    const [smsStats] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('sent', 'delivered') THEN 1 ELSE 0 END) as successful
      FROM notification_analytics
      WHERE notificationType = 'sms'
    `) as any[];
    
    const [emailStats] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('sent', 'delivered') THEN 1 ELSE 0 END) as successful
      FROM notification_analytics
      WHERE notificationType = 'email'
    `) as any[];
    
    const smsTotal = Number((smsStats as any[])?.[0]?.total) || 0;
    const smsSuccessful = Number((smsStats as any[])?.[0]?.successful) || 0;
    const emailTotal = Number((emailStats as any[])?.[0]?.total) || 0;
    const emailSuccessful = Number((emailStats as any[])?.[0]?.successful) || 0;
    
    // Format recent notifications
    const formattedNotifications = Array.isArray(recentNotifications) 
      ? (recentNotifications as any[]).map((n: any) => ({
          channel: n.channel,
          reportType: n.reportType,
          shareCode: n.shareCode,
          success: n.status === 'sent' || n.status === 'delivered',
          createdAt: n.createdAt,
        }))
      : [];
    
    return {
      totalReports,
      totalViews,
      totalSmsSent,
      totalEmailsSent,
      smsSuccessRate: smsTotal > 0 ? smsSuccessful / smsTotal : 0,
      emailSuccessRate: emailTotal > 0 ? emailSuccessful / emailTotal : 0,
      byType,
      recentNotifications: formattedNotifications,
    };
  } catch (error) {
    console.error("[NotificationAnalytics] Error getting analytics:", error);
    return null;
  }
}
