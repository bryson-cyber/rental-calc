/**
 * HubSpot Single Send API Integration
 * 
 * Uses HubSpot Marketing Hub Enterprise to send branded transactional emails.
 * Requires email templates to be created in HubSpot's email editor first.
 * 
 * Environment Variables:
 * - HUBSPOT_API_KEY: HubSpot private app access token
 * - HUBSPOT_REPORT_EMAIL_ID: Email template ID for report notifications
 * - HUBSPOT_SHARE_EMAIL_ID: Email template ID for share notifications
 */

import { ENV } from './_core/env';

// HubSpot API base URL
const HUBSPOT_API_BASE = 'https://api.hubapi.com';

// Email template IDs (set via environment variables)
const REPORT_EMAIL_ID = process.env.HUBSPOT_REPORT_EMAIL_ID;
const SHARE_EMAIL_ID = process.env.HUBSPOT_SHARE_EMAIL_ID;

export interface HubSpotEmailOptions {
  to: string;
  emailType: 'report' | 'share';
  customProperties: {
    reportLink?: string;
    propertyAddress?: string;
    reportType?: string;
    recipientName?: string;
    senderName?: string;
    marketName?: string;
    annualRevenue?: string;
    occupancyRate?: string;
    [key: string]: string | undefined;
  };
  contactProperties?: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    city?: string;
    state?: string;
    [key: string]: string | undefined;
  };
}

export interface HubSpotSendResult {
  success: boolean;
  statusId?: string;
  status?: string;
  error?: string;
}

/**
 * Send an email using HubSpot Single Send API
 * 
 * @param options - Email options including recipient, type, and custom properties
 * @returns Result with success status and optional statusId for tracking
 */
export async function sendHubSpotEmail(options: HubSpotEmailOptions): Promise<HubSpotSendResult> {
  const { to, emailType, customProperties, contactProperties } = options;
  
  // Get the appropriate email template ID
  const emailId = emailType === 'report' ? REPORT_EMAIL_ID : SHARE_EMAIL_ID;
  
  if (!emailId) {
    console.warn(`[HubSpot] No email template ID configured for type: ${emailType}`);
    return {
      success: false,
      error: `Email template ID not configured for ${emailType}. Set HUBSPOT_${emailType.toUpperCase()}_EMAIL_ID environment variable.`
    };
  }
  
  const hubspotApiKey = process.env.HUBSPOT_API_KEY;
  if (!hubspotApiKey) {
    console.warn('[HubSpot] No API key configured');
    return {
      success: false,
      error: 'HubSpot API key not configured. Set HUBSPOT_API_KEY environment variable.'
    };
  }
  
  // Build the request payload
  const payload = {
    emailId: parseInt(emailId, 10),
    message: {
      to,
      // Generate a unique sendId to prevent duplicate sends
      sendId: `${emailType}-${to}-${Date.now()}`
    },
    // Custom properties for email template (accessible via {{ custom.propertyName }})
    customProperties: Object.fromEntries(
      Object.entries(customProperties).filter(([_, v]) => v !== undefined)
    ),
    // Contact properties to set/update on the contact record
    ...(contactProperties && {
      contactProperties: Object.fromEntries(
        Object.entries(contactProperties).filter(([_, v]) => v !== undefined)
      )
    })
  };
  
  try {
    console.log('[HubSpot] Sending email:', { to, emailType, emailId });
    
    const response = await fetch(`${HUBSPOT_API_BASE}/marketing/v4/email/single-send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hubspotApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('[HubSpot] API error:', data);
      return {
        success: false,
        error: data.message || `HubSpot API error: ${response.status}`
      };
    }
    
    console.log('[HubSpot] Email sent successfully:', data);
    
    return {
      success: true,
      statusId: data.statusId,
      status: data.status
    };
  } catch (error) {
    console.error('[HubSpot] Request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Query the status of a previously sent email
 * 
 * @param statusId - The statusId returned from sendHubSpotEmail
 * @returns Status information including sendResult
 */
export async function getEmailStatus(statusId: string): Promise<{
  status: string;
  sendResult?: string;
  requestedAt?: string;
  completedAt?: string;
  error?: string;
}> {
  const hubspotApiKey = process.env.HUBSPOT_API_KEY;
  if (!hubspotApiKey) {
    return { status: 'error', error: 'HubSpot API key not configured' };
  }
  
  try {
    const response = await fetch(
      `${HUBSPOT_API_BASE}/marketing/v3/email/send-statuses/${statusId}`,
      {
        headers: {
          'Authorization': `Bearer ${hubspotApiKey}`
        }
      }
    );
    
    if (!response.ok) {
      const data = await response.json();
      return { status: 'error', error: data.message || `API error: ${response.status}` };
    }
    
    const data = await response.json();
    return {
      status: data.status,
      sendResult: data.sendResult,
      requestedAt: data.requestedAt,
      completedAt: data.completedAt
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create or update a contact in HubSpot CRM
 * 
 * @param email - Contact email address
 * @param properties - Contact properties to set
 * @returns Success status and contact ID
 */
export async function upsertHubSpotContact(
  email: string,
  properties: Record<string, string>
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  const hubspotApiKey = process.env.HUBSPOT_API_KEY;
  if (!hubspotApiKey) {
    return { success: false, error: 'HubSpot API key not configured' };
  }
  
  try {
    // Use the contacts API to create or update
    const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hubspotApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          email,
          ...properties
        }
      })
    });
    
    // If contact exists (409 conflict), update instead
    if (response.status === 409) {
      // Search for existing contact
      const searchResponse = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubspotApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: email
            }]
          }]
        })
      });
      
      const searchData = await searchResponse.json();
      if (searchData.results && searchData.results.length > 0) {
        const contactId = searchData.results[0].id;
        
        // Update existing contact
        const updateResponse = await fetch(
          `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${hubspotApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ properties })
          }
        );
        
        if (updateResponse.ok) {
          return { success: true, contactId };
        }
      }
    }
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, contactId: data.id };
    }
    
    const errorData = await response.json();
    return { success: false, error: errorData.message || `API error: ${response.status}` };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send a report notification email with Coach Inayah branding
 * 
 * This is a convenience wrapper that handles the common use case of
 * sending a report link to a user after they complete an analysis.
 */
export async function sendReportNotificationEmail(params: {
  recipientEmail: string;
  recipientName?: string;
  reportLink: string;
  reportType: string;
  propertyAddress?: string;
  marketName?: string;
  annualRevenue?: number;
  occupancyRate?: number;
}): Promise<HubSpotSendResult> {
  const {
    recipientEmail,
    recipientName,
    reportLink,
    reportType,
    propertyAddress,
    marketName,
    annualRevenue,
    occupancyRate
  } = params;
  
  // Format the report type for display
  const reportTypeDisplay = reportType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  
  return sendHubSpotEmail({
    to: recipientEmail,
    emailType: 'report',
    customProperties: {
      reportLink,
      reportType: reportTypeDisplay,
      propertyAddress: propertyAddress || 'N/A',
      recipientName: recipientName || 'Investor',
      marketName: marketName || 'N/A',
      annualRevenue: annualRevenue ? `$${annualRevenue.toLocaleString()}` : 'N/A',
      occupancyRate: occupancyRate ? `${Math.round(occupancyRate * 100)}%` : 'N/A'
    },
    contactProperties: {
      firstname: recipientName?.split(' ')[0],
      email: recipientEmail
    }
  });
}

/**
 * Send a share notification email when someone shares a report
 */
export async function sendShareNotificationEmail(params: {
  recipientEmail: string;
  recipientName?: string;
  senderName?: string;
  reportLink: string;
  reportType: string;
  propertyAddress?: string;
}): Promise<HubSpotSendResult> {
  const {
    recipientEmail,
    recipientName,
    senderName,
    reportLink,
    reportType,
    propertyAddress
  } = params;
  
  const reportTypeDisplay = reportType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  
  return sendHubSpotEmail({
    to: recipientEmail,
    emailType: 'share',
    customProperties: {
      reportLink,
      reportType: reportTypeDisplay,
      propertyAddress: propertyAddress || 'a property',
      recipientName: recipientName || 'there',
      senderName: senderName || 'Someone'
    }
  });
}
