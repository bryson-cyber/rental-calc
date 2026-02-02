/**
 * Newsletter Email Sender Service
 * 
 * Sends personalized newsletters via HubSpot Single Send API.
 * Requires Marketing Hub Enterprise for Single Send functionality.
 */

import { getDb } from './db';
import { sql } from 'drizzle-orm';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_API_BASE = 'https://api.hubapi.com';

export interface EmailRecipient {
  email: string;
  firstName: string;
  lastName: string;
  contactId?: string;
}

export interface SendEmailParams {
  emailId: number; // HubSpot email template ID
  recipient: EmailRecipient;
  customProperties?: Record<string, string>;
  contactProperties?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  sendId?: string;
  error?: string;
  statusCode?: number;
}

export interface BulkSendResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    email: string;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Send a single email via HubSpot Single Send API
 */
export async function sendSingleEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!HUBSPOT_API_KEY) {
    return { success: false, error: 'HUBSPOT_API_KEY is not configured' };
  }
  
  const sendId = `newsletter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const response = await fetch(`${HUBSPOT_API_BASE}/marketing/v4/email/single-send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emailId: params.emailId,
        message: {
          to: params.recipient.email,
          sendId: sendId
        },
        contactProperties: {
          firstname: params.recipient.firstName,
          lastname: params.recipient.lastName,
          ...params.contactProperties
        },
        customProperties: params.customProperties || {}
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Newsletter] HubSpot Single Send error:`, errorText);
      return {
        success: false,
        error: `HubSpot API error (${response.status}): ${errorText}`,
        statusCode: response.status
      };
    }
    
    const result = await response.json();
    console.log(`[Newsletter] Email sent successfully to ${params.recipient.email}`);
    
    return {
      success: true,
      sendId: sendId
    };
  } catch (error) {
    console.error(`[Newsletter] Error sending email to ${params.recipient.email}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send bulk emails with rate limiting
 */
export async function sendBulkEmails(params: {
  emailId: number;
  recipients: Array<EmailRecipient & { customProperties?: Record<string, string> }>;
  batchSize?: number;
  delayBetweenBatches?: number; // ms
}): Promise<BulkSendResult> {
  const { emailId, recipients, batchSize = 10, delayBetweenBatches = 1000 } = params;
  
  const result: BulkSendResult = {
    total: recipients.length,
    successful: 0,
    failed: 0,
    results: []
  };
  
  // Process in batches
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    // Send batch in parallel
    const batchPromises = batch.map(async (recipient) => {
      const sendResult = await sendSingleEmail({
        emailId,
        recipient,
        customProperties: recipient.customProperties
      });
      
      return {
        email: recipient.email,
        success: sendResult.success,
        error: sendResult.error
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const r of batchResults) {
      result.results.push(r);
      if (r.success) {
        result.successful++;
      } else {
        result.failed++;
      }
    }
    
    // Delay between batches to respect rate limits
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  console.log(`[Newsletter] Bulk send complete: ${result.successful}/${result.total} successful`);
  return result;
}

/**
 * Alternative: Send email via transactional email (for non-marketing emails)
 * This works without Marketing Hub Enterprise
 */
export async function sendTransactionalEmail(params: {
  to: string;
  from: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}): Promise<SendEmailResult> {
  if (!HUBSPOT_API_KEY) {
    return { success: false, error: 'HUBSPOT_API_KEY is not configured' };
  }
  
  const sendId = `transactional-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Note: This uses the transactional email API which has different requirements
    // For now, we'll use the marketing single send API
    // If that doesn't work, we can fall back to SMTP or a third-party service
    
    const response = await fetch(`${HUBSPOT_API_BASE}/marketing/v3/transactional/single-email/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emailId: 0, // Would need a transactional template ID
        message: {
          to: params.to,
          from: params.from,
          subject: params.subject,
          html: params.htmlContent,
          text: params.textContent
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HubSpot Transactional API error (${response.status}): ${errorText}`,
        statusCode: response.status
      };
    }
    
    return { success: true, sendId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Log a newsletter send to the database
 */
export async function logNewsletterSend(params: {
  contactEmail: string;
  contactId?: string;
  city: string;
  state: string;
  newsletterType: 'weekly_market' | 'deal_alert' | 'monthly_report';
  subject: string;
  success: boolean;
  errorMessage?: string;
  hubspotSendId?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`
      INSERT INTO newsletter_sends (
        contact_email, contact_id, city, state, newsletter_type,
        subject, success, error_message, hubspot_send_id, sent_at
      ) VALUES (
        ${params.contactEmail},
        ${params.contactId || null},
        ${params.city},
        ${params.state},
        ${params.newsletterType},
        ${params.subject},
        ${params.success},
        ${params.errorMessage || null},
        ${params.hubspotSendId || null},
        NOW()
      )
    `);
  } catch (error) {
    console.error('[Newsletter] Error logging send:', error);
  }
}

/**
 * Check if a contact has unsubscribed
 */
export async function isContactUnsubscribed(email: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    const result = await db.execute(sql`
      SELECT 1 FROM newsletter_preferences
      WHERE contact_email = ${email}
      AND unsubscribed = true
      LIMIT 1
    `);
    
    return (result as any).rows?.length > 0;
  } catch (error) {
    console.error('[Newsletter] Error checking unsubscribe status:', error);
    return false;
  }
}

/**
 * Unsubscribe a contact
 */
export async function unsubscribeContact(email: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`
      INSERT INTO newsletter_preferences (contact_email, unsubscribed, unsubscribed_at)
      VALUES (${email}, true, NOW())
      ON DUPLICATE KEY UPDATE unsubscribed = true, unsubscribed_at = NOW()
    `);
    console.log(`[Newsletter] Unsubscribed: ${email}`);
  } catch (error) {
    console.error('[Newsletter] Error unsubscribing:', error);
  }
}

/**
 * Get send statistics for a time period
 */
export async function getSendStats(params: {
  startDate: Date;
  endDate: Date;
  newsletterType?: string;
}): Promise<{
  totalSent: number;
  successful: number;
  failed: number;
  byCity: Array<{ city: string; state: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
}> {
  try {
    const db = await getDb();
    if (!db) return {
      totalSent: 0,
      successful: 0,
      failed: 0,
      byCity: [],
      byType: []
    };
    // Total counts
    const totalResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed
      FROM newsletter_sends
      WHERE sent_at >= ${params.startDate}
      AND sent_at <= ${params.endDate}
      ${params.newsletterType ? sql`AND newsletter_type = ${params.newsletterType}` : sql``}
    `);
    
    // By city
    const byCityResult = await db.execute(sql`
      SELECT city, state, COUNT(*) as count
      FROM newsletter_sends
      WHERE sent_at >= ${params.startDate}
      AND sent_at <= ${params.endDate}
      GROUP BY city, state
      ORDER BY count DESC
      LIMIT 20
    `);
    
    // By type
    const byTypeResult = await db.execute(sql`
      SELECT newsletter_type as type, COUNT(*) as count
      FROM newsletter_sends
      WHERE sent_at >= ${params.startDate}
      AND sent_at <= ${params.endDate}
      GROUP BY newsletter_type
    `);
    
    const totals = (totalResult as any).rows?.[0] || { total: 0, successful: 0, failed: 0 };
    
    return {
      totalSent: Number(totals.total) || 0,
      successful: Number(totals.successful) || 0,
      failed: Number(totals.failed) || 0,
      byCity: ((byCityResult as any).rows || []).map((r: any) => ({
        city: r.city,
        state: r.state,
        count: Number(r.count)
      })),
      byType: ((byTypeResult as any).rows || []).map((r: any) => ({
        type: r.type,
        count: Number(r.count)
      }))
    };
  } catch (error) {
    console.error('[Newsletter] Error getting send stats:', error);
    return {
      totalSent: 0,
      successful: 0,
      failed: 0,
      byCity: [],
      byType: []
    };
  }
}
