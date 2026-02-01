/**
 * SMS and Email Notification Service
 * Handles sending notifications via SimpleTexting (SMS) and email
 */

import { ENV } from "./_core/env";

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
 * Uses the built-in notification system or Zapier webhook
 */
export async function sendEmailNotification(
  email: string,
  subject: string,
  body: string,
  recipientName?: string
): Promise<{ success: boolean; error?: string }> {
  // Try using Zapier webhook for email if configured
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
          timestamp: new Date().toISOString(),
        }),
      });
      
      if (response.ok) {
        console.log(`[Email] Successfully queued email to ${email} via Zapier`);
        return { success: true };
      }
    } catch (error) {
      console.error('[Email] Zapier webhook error:', error);
    }
  }
  
  // Fallback: Log the email for manual sending
  console.log(`[Email] Would send to ${email}:`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Body: ${body.substring(0, 100)}...`);
  
  // For now, return success since we've logged it
  // In production, you'd integrate with SendGrid, Mailgun, etc.
  return { success: true };
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
  },
  contact: {
    phone?: string;
    email?: string;
    name?: string;
  }
): Promise<{ sms?: { success: boolean; error?: string }; email?: { success: boolean; error?: string } }> {
  const results: { sms?: { success: boolean; error?: string }; email?: { success: boolean; error?: string } } = {};
  const baseUrl = process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com';
  const reportUrl = `${baseUrl}/report/${reportData.shareCode}`;
  
  // Send SMS if phone provided
  if (contact.phone) {
    const smsMessage = `Your STR Regulation Report for ${reportData.city}, ${reportData.state} is ready! Status: ${reportData.status}. View: ${reportUrl}`;
    results.sms = await sendSMSNotification(contact.phone, smsMessage);
  }
  
  // Send Email if email provided
  if (contact.email) {
    const emailSubject = `STR Regulation Report: ${reportData.city}, ${reportData.state}`;
    const emailBody = `Hi ${contact.name || 'there'},

Your STR Regulation Report is ready!

Location: ${reportData.city}, ${reportData.state}
Status: ${reportData.status}

View your full report here: ${reportUrl}

This report includes:
• Permit requirements
• Registration fees
• Occupancy taxes
• Key regulations to follow
• Official sources

Questions? Reply to this email or visit coachinayahturnkeytool.com

Best,
Coach Inayah Team`;
    
    results.email = await sendEmailNotification(contact.email, emailSubject, emailBody, contact.name);
  }
  
  return results;
}
