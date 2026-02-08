/**
 * Newsletter SMS Alerts Service
 * 
 * Sends SMS alerts for deals using SimpleTexting API.
 * Designed to complement email alerts with quick, actionable messages.
 * All CTAs drive to "Book a call with our team".
 */

import { getDb } from './db';
import { sql } from 'drizzle-orm';

const SIMPLETEXTING_API_KEY = process.env.SIMPLETEXTING_API_KEY;
const SIMPLETEXTING_API_BASE = 'https://api-app2.simpletexting.com/v2';

// Brand URLs
const BOOKING_URL = 'masterclass.coachinayah.com/the-turnkey-program';
const TOOL_URL = 'coachinayahturnkeytool.com';

export interface SMSRecipient {
  phone: string;
  firstName: string;
  contactId?: string;
}

export interface SendSMSParams {
  recipient: SMSRecipient;
  message: string;
}

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface DealAlertSMSParams {
  recipient: SMSRecipient;
  city: string;
  state: string;
  deal: {
    address: string;
    bedrooms: number;
    bathrooms: number;
    monthlyRevenue: number;
    monthlyRent?: number;
    occupancyRate: number;
    dealScore: number;
  };
  compsCount?: number;
  avgCompRevenue?: number;
}

export interface MarketUpdateSMSParams {
  recipient: SMSRecipient;
  city: string;
  state: string;
  avgRevenue: number;
  occupancy: number;
  trend: 'up' | 'down' | 'stable';
  dealsFound?: number;
}

/**
 * Send a single SMS message via SimpleTexting API
 */
export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  const { recipient, message } = params;
  
  if (!SIMPLETEXTING_API_KEY) {
    console.error('[SMS] SimpleTexting API key not configured');
    return { success: false, error: 'SMS service not configured' };
  }
  
  // Clean phone number (remove non-digits, ensure starts with country code)
  let phone = recipient.phone.replace(/\D/g, '');
  if (phone.length === 10) {
    phone = '1' + phone; // Add US country code
  }
  
  try {
    const response = await fetch(`${SIMPLETEXTING_API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SIMPLETEXTING_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contactPhone: phone,
        text: message,
        mode: 'AUTO', // Auto-select best sending method
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SMS] SimpleTexting API error:', response.status, errorText);
      return { 
        success: false, 
        error: `API error: ${response.status}` 
      };
    }
    
    const result = await response.json();
    
    // Log the SMS send
    await logSMSSend({
      contactId: recipient.contactId,
      phone: recipient.phone,
      messageId: result.id,
      success: true,
    });
    
    console.log(`[SMS] Sent successfully to ${recipient.phone}`);
    return { 
      success: true, 
      messageId: result.id 
    };
  } catch (error) {
    console.error('[SMS] Error sending SMS:', error);
    
    await logSMSSend({
      contactId: recipient.contactId,
      phone: recipient.phone,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Send a deal alert via SMS
 * Includes profit potential and comparable properties data
 * CTA: Book a call with our team
 */
export async function sendDealAlertSMS(params: DealAlertSMSParams): Promise<SendSMSResult> {
  const { recipient, city, state, deal, compsCount, avgCompRevenue } = params;
  
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  const formatPercent = (n: number) => `${Math.round(n * 100)}%`;
  
  // Calculate profit if we have rent data
  const hasRentData = deal.monthlyRent && deal.monthlyRent > 0;
  const monthlyProfit = hasRentData ? deal.monthlyRevenue - deal.monthlyRent! : 0;
  
  // Build message based on available data
  let message = `🏠 ${recipient.firstName}, new ${city} opportunity!\n\n`;
  
  // Show profit if available, otherwise revenue
  if (hasRentData && monthlyProfit > 0) {
    message += `${formatCurrency(monthlyProfit)}/mo profit potential\n`;
    message += `(${formatCurrency(deal.monthlyRevenue)} revenue - ${formatCurrency(deal.monthlyRent!)} rent)\n\n`;
  } else {
    message += `${formatCurrency(deal.monthlyRevenue)}/mo revenue potential\n`;
    message += `${formatPercent(deal.occupancyRate)} avg occupancy\n\n`;
  }
  
  // Add comps data if available - this is the proof
  if (compsCount && avgCompRevenue) {
    message += `✓ ${compsCount} similar properties nearby averaging ${formatCurrency(avgCompRevenue)}/mo\n\n`;
  }
  
  // Single CTA: Book a call
  message += `Book a call: ${BOOKING_URL}\n\n`;
  message += `Reply STOP to opt out`;
  
  return sendSMS({
    recipient,
    message,
  });
}

/**
 * Send a weekly market update SMS
 * CTA: Book a call with our team
 */
export async function sendWeeklyMarketSMS(params: MarketUpdateSMSParams): Promise<SendSMSResult> {
  const { recipient, city, state, avgRevenue, occupancy, trend, dealsFound } = params;
  
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  const formatPercent = (n: number) => `${Math.round(n * 100)}%`;
  const trendEmoji = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';
  
  let message = `${trendEmoji} ${city} Market Update\n\n`;
  message += `Avg Revenue: ${formatCurrency(avgRevenue)}/mo\n`;
  message += `Occupancy: ${formatPercent(occupancy)}\n`;
  
  if (dealsFound && dealsFound > 0) {
    message += `\n🔥 ${dealsFound} opportunities found this week\n`;
  }
  
  // Single CTA: Book a call
  message += `\nBook a call: ${BOOKING_URL}\n\n`;
  message += `Reply STOP to opt out`;
  
  return sendSMS({
    recipient,
    message,
  });
}

/**
 * Send a welcome SMS when someone opts in
 * Introduces them to the market data they'll receive
 */
export async function sendWelcomeSMS(params: {
  recipient: SMSRecipient;
  city: string;
  state: string;
  avgRevenue?: number;
  occupancy?: number;
}): Promise<SendSMSResult> {
  const { recipient, city, state, avgRevenue, occupancy } = params;
  
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  const formatPercent = (n: number) => `${Math.round(n * 100)}%`;
  
  let message = `Hey ${recipient.firstName}! 👋\n\n`;
  message += `Thanks for checking out ${city} rentals.\n\n`;
  
  if (avgRevenue && occupancy) {
    message += `Quick stats:\n`;
    message += `• Avg revenue: ${formatCurrency(avgRevenue)}/mo\n`;
    message += `• Occupancy: ${formatPercent(occupancy)}\n\n`;
  }
  
  message += `I'll send you deals when I find them.\n\n`;
  message += `Questions? Book a call: ${BOOKING_URL}\n\n`;
  message += `Reply STOP to opt out`;
  
  return sendSMS({
    recipient,
    message,
  });
}

/**
 * Send a follow-up SMS after they've viewed a property
 * Encourages booking a call
 */
export async function sendPropertyFollowUpSMS(params: {
  recipient: SMSRecipient;
  city: string;
  propertyAddress: string;
  monthlyProfit?: number;
}): Promise<SendSMSResult> {
  const { recipient, city, propertyAddress, monthlyProfit } = params;
  
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  
  let message = `Hey ${recipient.firstName}!\n\n`;
  message += `Saw you checked out that ${city} property`;
  
  if (monthlyProfit && monthlyProfit > 0) {
    message += ` (${formatCurrency(monthlyProfit)}/mo profit potential)`;
  }
  message += `.\n\n`;
  
  message += `Want us to run the full numbers and reach out to the landlord?\n\n`;
  message += `Book a call: ${BOOKING_URL}\n\n`;
  message += `Reply STOP to opt out`;
  
  return sendSMS({
    recipient,
    message,
  });
}

/**
 * Check if a contact has opted out of SMS
 */
export async function isContactOptedOutSMS(contactId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    const result = await db.execute(sql`
      SELECT smsAlertsEnabled FROM newsletter_preferences 
      WHERE hubspotContactId = ${contactId}
    `);
    
    const rows = (result as any)[0] as any[];
    return rows.length > 0 && (rows[0].smsAlertsEnabled === 0 || rows[0].smsAlertsEnabled === false);
  } catch (error) {
    console.error('[SMS] Error checking opt-out status:', error);
    return false;
  }
}

/**
 * Check if a phone number has opted out
 */
export async function isPhoneOptedOut(phone: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Clean phone number
  const cleanPhone = phone.replace(/\D/g, '');
  
  try {
    const result = await db.execute(sql`
      SELECT smsAlertsEnabled FROM newsletter_preferences 
      WHERE email LIKE CONCAT('%', ${cleanPhone}, '%')
    `);
    
    const rows = (result as any)[0] as any[];
    return rows.length > 0 && (rows[0].smsAlertsEnabled === 0 || rows[0].smsAlertsEnabled === false);
  } catch (error) {
    console.error('[SMS] Error checking phone opt-out:', error);
    return false;
  }
}

/**
 * Opt a contact out of SMS alerts
 */
export async function optOutSMS(contactId: string, phone?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.execute(sql`
      INSERT INTO newsletter_preferences (hubspotContactId, email, smsAlertsEnabled, updatedAt)
      VALUES (${contactId}, ${phone || ''}, 0, NOW())
      ON DUPLICATE KEY UPDATE smsAlertsEnabled = 0, updatedAt = NOW()
    `);
    console.log(`[SMS] Opted out contact ${contactId}`);
  } catch (error) {
    console.error('[SMS] Error opting out:', error);
  }
}

/**
 * Log SMS send to database
 */
async function logSMSSend(params: {
  contactId?: string;
  phone: string;
  messageId?: string;
  success: boolean;
  error?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.execute(sql`
      INSERT INTO newsletter_sends (
        hubspotContactId, 
        email,
        emailType, 
        status, 
        errorMessage, 
        sentAt
      ) VALUES (
        ${params.contactId || 'unknown'},
        ${params.phone},
        'weekly_market',
        ${params.success ? 'sent' : 'failed'},
        ${params.error || null},
        NOW()
      )
    `);
  } catch (error) {
    console.error('[SMS] Error logging SMS send:', error);
  }
}

/**
 * Get SMS send statistics
 */
export async function getSMSStats(days: number = 30): Promise<{
  total: number;
  successful: number;
  failed: number;
}> {
  const db = await getDb();
  if (!db) return { total: 0, successful: 0, failed: 0 };
  
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM newsletter_sends 
      WHERE emailType LIKE 'sms_%'
      AND sentAt >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
    `);
    
    const rows = (result as any)[0] as any[];
    const row = rows[0] || { total: 0, successful: 0, failed: 0 };
    
    return {
      total: Number(row.total) || 0,
      successful: Number(row.successful) || 0,
      failed: Number(row.failed) || 0,
    };
  } catch (error) {
    console.error('[SMS] Error getting stats:', error);
    return { total: 0, successful: 0, failed: 0 };
  }
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  // US phone numbers: 10 digits or 11 with country code
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'));
}
