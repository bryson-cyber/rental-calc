/**
 * Newsletter SMS Alerts Service
 * 
 * Sends SMS alerts for hot deals using SimpleTexting API.
 * Only sends for high-score deals (80+) to avoid spamming.
 */

import { getDb } from './db';
import { sql } from 'drizzle-orm';

const SIMPLETEXTING_API_KEY = process.env.SIMPLETEXTING_API_KEY;
const SIMPLETEXTING_API_BASE = 'https://api-app2.simpletexting.com/v2';

// Brand URLs (shortened for SMS)
const TOOL_URL = 'coachinayahturnkeytool.com';
const VSL_URL = 'masterclass.coachinayah.com/the-turnkey-program';

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
    monthlyRevenue: number;
    dealScore: number;
  };
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
 * Send a hot deal alert via SMS
 * Only sends for deals with score >= 80
 */
export async function sendDealAlertSMS(params: DealAlertSMSParams): Promise<SendSMSResult> {
  const { recipient, city, state, deal } = params;
  
  // Only send SMS for high-score deals
  if (deal.dealScore < 80) {
    console.log(`[SMS] Skipping SMS for deal score ${deal.dealScore} (minimum 80)`);
    return { success: false, error: 'Deal score too low for SMS alert' };
  }
  
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  
  // Craft a concise, compelling SMS message
  const message = `🔥 ${recipient.firstName}, new opportunity in ${city}!\n\n` +
    `${formatCurrency(deal.monthlyRevenue)}/mo potential\n` +
    `Score: ${deal.dealScore}/100\n\n` +
    `View details: ${TOOL_URL}?step=5&address=${encodeURIComponent(deal.address)}&autoAnalyze=true\n\n` +
    `Reply STOP to unsubscribe`;
  
  return sendSMS({
    recipient,
    message,
  });
}

/**
 * Send a weekly market summary SMS
 */
export async function sendWeeklyMarketSMS(params: {
  recipient: SMSRecipient;
  city: string;
  state: string;
  avgRevenue: number;
  occupancy: number;
  trend: 'up' | 'down' | 'stable';
}): Promise<SendSMSResult> {
  const { recipient, city, state, avgRevenue, occupancy, trend } = params;
  
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  const formatPercent = (n: number) => `${Math.round(n * 100)}%`;
  const trendEmoji = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';
  
  const message = `${trendEmoji} ${city}, ${state} Market Update\n\n` +
    `Avg Revenue: ${formatCurrency(avgRevenue)}/mo\n` +
    `Occupancy: ${formatPercent(occupancy)}\n\n` +
    `See full report: ${TOOL_URL}?step=3&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}\n\n` +
    `Reply STOP to unsubscribe`;
  
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
  
  const result = await db.execute(sql`
    SELECT sms_opted_out FROM newsletter_preferences 
    WHERE contact_id = ${contactId}
  `) as unknown as { rows: Array<{ sms_opted_out: number }> };
  
  const rows = result.rows || [];
  return rows.length > 0 && rows[0].sms_opted_out === 1;
}

/**
 * Opt a contact out of SMS alerts
 */
export async function optOutSMS(contactId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.execute(sql`
    INSERT INTO newsletter_preferences (contact_id, sms_opted_out, updated_at)
    VALUES (${contactId}, 1, NOW())
    ON DUPLICATE KEY UPDATE sms_opted_out = 1, updated_at = NOW()
  `);
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
        contact_id, 
        email_type, 
        subject, 
        status, 
        error_message, 
        sent_at
      ) VALUES (
        ${params.contactId || 'unknown'},
        'sms_deal_alert',
        ${params.phone},
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
  
  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM newsletter_sends 
    WHERE email_type LIKE 'sms_%'
    AND sent_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
  `) as unknown as { rows: Array<{ total: number; successful: number; failed: number }> };
  
  const rows = result.rows || [];
  const row = rows[0] || { total: 0, successful: 0, failed: 0 };
  
  return {
    total: Number(row.total) || 0,
    successful: Number(row.successful) || 0,
    failed: Number(row.failed) || 0,
  };
}
