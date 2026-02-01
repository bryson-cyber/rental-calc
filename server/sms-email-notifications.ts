/**
 * SMS and Email Notification Service
 * Handles sending notifications via SimpleTexting (SMS) and HubSpot/Zapier (email)
 */

import { ENV } from "./_core/env";
import { sendReportNotificationEmail, sendShareNotificationEmail } from './hubspot-email';

// Generate a unique share code for reports
export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Format phone number for SimpleTexting (E.164 format)
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it's a 10-digit US number, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it starts with 1 and is 11 digits, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it already has country code, just add +
  if (digits.length > 10) {
    return `+${digits}`;
  }
  
  // Return as-is if we can't determine format
  return phone;
}

/**
 * Send SMS via SimpleTexting API
 */
export async function sendSMSNotification(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const apiKey = ENV.simpletextingApiKey;
  
  if (!apiKey) {
    console.error('[SMS] SimpleTexting API key not configured');
    return { success: false, error: 'SMS service not configured' };
  }
  
  const formattedPhone = formatPhoneNumber(phoneNumber);
  console.log(`[SMS] Sending to ${formattedPhone}: ${message.substring(0, 50)}...`);
  
  try {
    const response = await fetch('https://api-app2.simpletexting.com/v2/api/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contactPhone: formattedPhone,
        mode: 'SINGLE_SMS',
        text: message,
      }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`[SMS] Successfully sent to ${formattedPhone}`);
      return { success: true, messageId: data.id };
    } else {
      console.error(`[SMS] Failed to send:`, data);
      return { success: false, error: data.message || 'Failed to send SMS' };
    }
  } catch (error) {
    console.error('[SMS] Error sending SMS:', error);
    return { success: false, error: 'Failed to send SMS' };
  }
}

/**
 * Send Email notification
 * Priority: HubSpot Single Send API > Zapier webhook > Console log
 */
export async function sendEmailNotification(
  email: string,
  subject: string,
  body: string,
  recipientName?: string,
  metadata?: {
    reportLink?: string;
    reportType?: string;
    propertyAddress?: string;
    marketName?: string;
    annualRevenue?: number;
    occupancyRate?: number;
  }
): Promise<{ success: boolean; error?: string; provider?: string }> {
  
  // Priority 1: Try HubSpot Single Send API if configured
  const hubspotApiKey = process.env.HUBSPOT_API_KEY;
  const hubspotEmailId = process.env.HUBSPOT_REPORT_EMAIL_ID;
  
  if (hubspotApiKey && hubspotEmailId && metadata?.reportLink) {
    console.log(`[Email] Attempting HubSpot Single Send to ${email}`);
    const hubspotResult = await sendReportNotificationEmail({
      recipientEmail: email,
      recipientName,
      reportLink: metadata.reportLink,
      reportType: metadata.reportType || 'Analysis Report',
      propertyAddress: metadata.propertyAddress,
      marketName: metadata.marketName,
      annualRevenue: metadata.annualRevenue,
      occupancyRate: metadata.occupancyRate
    });
    
    if (hubspotResult.success) {
      console.log(`[Email] Successfully sent to ${email} via HubSpot`);
      return { success: true, provider: 'hubspot' };
    } else {
      console.warn(`[Email] HubSpot failed: ${hubspotResult.error}, falling back to Zapier`);
    }
  }
  
  // Priority 2: Try Zapier webhook
  const zapierWebhook = ENV.zapierWebhookUrl;
  
  if (zapierWebhook) {
    try {
      const response = await fetch(zapierWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'email_notification',
          email,
          recipientName: recipientName || 'Investor',
          subject,
          body,
          reportLink: metadata?.reportLink,
          reportType: metadata?.reportType,
          propertyAddress: metadata?.propertyAddress,
          timestamp: new Date().toISOString(),
        }),
      });
      
      if (response.ok) {
        console.log(`[Email] Successfully queued email to ${email} via Zapier`);
        return { success: true, provider: 'zapier' };
      }
    } catch (error) {
      console.error('[Email] Zapier webhook error:', error);
    }
  }
  
  // Priority 3: Log for manual sending (development fallback)
  console.log(`[Email] Would send to ${email}:`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Body: ${body.substring(0, 100)}...`);
  
  return { success: true, provider: 'console' };
}

/**
 * Send both SMS and Email notifications for a completed report
 */
export async function sendReportNotifications(
  reportData: {
    city: string;
    state: string;
    status: string;
    shareCode: string;
    reportType?: string;
    propertyAddress?: string;
    annualRevenue?: number;
    occupancyRate?: number;
  },
  contact: {
    phone?: string;
    email?: string;
    name?: string;
  }
): Promise<{ sms?: { success: boolean; error?: string }; email?: { success: boolean; error?: string; provider?: string } }> {
  const results: { sms?: { success: boolean; error?: string }; email?: { success: boolean; error?: string; provider?: string } } = {};
  const baseUrl = process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com';
  const reportUrl = `${baseUrl}/share/${reportData.shareCode}`;
  
  // Send SMS if phone provided
  if (contact.phone) {
    const smsMessage = `Your ${reportData.reportType || 'Analysis'} Report for ${reportData.city}, ${reportData.state} is ready! View: ${reportUrl}`;
    results.sms = await sendSMSNotification(contact.phone, smsMessage);
  }
  
  // Send Email if email provided (with HubSpot priority)
  if (contact.email) {
    const emailSubject = `Your ${reportData.reportType || 'Analysis'} Report: ${reportData.city}, ${reportData.state}`;
    const emailBody = `Hi ${contact.name || 'there'},

Your ${reportData.reportType || 'Analysis'} Report is ready!

Location: ${reportData.city}, ${reportData.state}
${reportData.propertyAddress ? `Property: ${reportData.propertyAddress}\n` : ''}
${reportData.annualRevenue ? `Estimated Annual Revenue: $${reportData.annualRevenue.toLocaleString()}\n` : ''}
${reportData.occupancyRate ? `Occupancy Rate: ${Math.round(reportData.occupancyRate * 100)}%\n` : ''}

View your full report here: ${reportUrl}

Questions? Reply to this email or visit coachinayahturnkeytool.com

Best,
Coach Inayah Team`;
    
    results.email = await sendEmailNotification(
      contact.email, 
      emailSubject, 
      emailBody, 
      contact.name,
      {
        reportLink: reportUrl,
        reportType: reportData.reportType,
        propertyAddress: reportData.propertyAddress,
        marketName: `${reportData.city}, ${reportData.state}`,
        annualRevenue: reportData.annualRevenue,
        occupancyRate: reportData.occupancyRate
      }
    );
  }
  
  return results;
}

/**
 * Send share notification when someone shares a report with another person
 */
export async function sendShareNotification(
  shareData: {
    shareCode: string;
    reportType: string;
    propertyAddress?: string;
    senderName?: string;
  },
  recipient: {
    email: string;
    name?: string;
  }
): Promise<{ success: boolean; error?: string; provider?: string }> {
  const baseUrl = process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com';
  const reportUrl = `${baseUrl}/share/${shareData.shareCode}`;
  
  // Try HubSpot first
  const hubspotApiKey = process.env.HUBSPOT_API_KEY;
  const hubspotShareEmailId = process.env.HUBSPOT_SHARE_EMAIL_ID;
  
  if (hubspotApiKey && hubspotShareEmailId) {
    const result = await sendShareNotificationEmail({
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      senderName: shareData.senderName,
      reportLink: reportUrl,
      reportType: shareData.reportType,
      propertyAddress: shareData.propertyAddress
    });
    
    if (result.success) {
      return { success: true, provider: 'hubspot' };
    }
  }
  
  // Fallback to Zapier
  const zapierWebhook = ENV.zapierWebhookUrl;
  if (zapierWebhook) {
    try {
      const response = await fetch(zapierWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'share_notification',
          email: recipient.email,
          recipientName: recipient.name || 'there',
          senderName: shareData.senderName || 'Someone',
          reportType: shareData.reportType,
          propertyAddress: shareData.propertyAddress,
          reportLink: reportUrl,
          timestamp: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        return { success: true, provider: 'zapier' };
      }
    } catch (error) {
      console.error('[Share Email] Zapier error:', error);
    }
  }
  
  console.log(`[Share Email] Would send share notification to ${recipient.email}`);
  return { success: true, provider: 'console' };
}
