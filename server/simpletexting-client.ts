/**
 * SimpleTexting API Client
 * 
 * Handles all SMS operations: sending messages, managing webhooks, and contacts.
 * Uses SimpleTexting API v2 with Bearer token authentication.
 * 
 * API Docs: https://simpletexting.com/api/docs/v2/
 * Base URL: https://api-app2.simpletexting.com/v2
 */

import { ENV } from './_core/env';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface SendSmsParams {
  /** Recipient phone number (digits only, no formatting) */
  contactPhone: string;
  /** Message text */
  text: string;
  /** Sending mode: AUTO (default), SINGLE_SMS_STRICTLY, MMS_PREFERRED */
  mode?: 'AUTO' | 'SINGLE_SMS_STRICTLY' | 'MMS_PREFERRED';
  /** Optional: specific sender number */
  accountPhone?: string;
  /** Optional: MMS media URLs */
  mediaItems?: string[];
}

export interface SendSmsResponse {
  id: string;
  credits: number;
}

export interface IncomingMessageWebhook {
  reportId: string;
  webhookId: string;
  type: 'INCOMING_MESSAGE';
  values: {
    messageId: string;
    text: string;
    accountPhone: string;
    contactPhone: string;
    timestamp: string;
    category: 'SMS' | 'MMS' | 'EXTENDED_SMS';
    subject?: string;
    mediaItems?: string[];
  };
}

export interface DeliveryReportWebhook {
  reportId: string;
  webhookId: string;
  type: 'DELIVERY_REPORT' | 'NON_DELIVERED_REPORT';
  values: {
    messageId: string;
    contactPhone: string;
    accountPhone: string;
    timestamp: string;
  };
}

export interface UnsubscribeReportWebhook {
  reportId: string;
  webhookId: string;
  type: 'UNSUBSCRIBE_REPORT';
  values: {
    contactPhone: string;
    accountPhone: string;
    timestamp: string;
  };
}

export type SimpleTextingWebhook = 
  | IncomingMessageWebhook 
  | DeliveryReportWebhook 
  | UnsubscribeReportWebhook;

export interface CreateWebhookParams {
  url: string;
  triggers: Array<'INCOMING_MESSAGE' | 'OUTGOING_MESSAGE' | 'DELIVERY_REPORT' | 'NON_DELIVERED_REPORT' | 'UNSUBSCRIBE_REPORT'>;
  requestPerSecLimit?: number;
  accountPhone?: string;
}

export interface WebhookResponse {
  id: string;
  url: string;
  triggers: string[];
}

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

const BASE_URL = 'https://api-app2.simpletexting.com/v2';

function getApiKey(): string {
  const key = ENV.simpletextingApiKey;
  if (!key) {
    throw new Error('[SimpleTexting] SIMPLETEXTING_API_KEY is not set.');
  }
  return key;
}

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getApiKey()}`,
  };
}

// ---------------------------------------------------------------------------
// SMS SENDING
// ---------------------------------------------------------------------------

/**
 * Send an SMS message via SimpleTexting.
 * 
 * @param params - Message parameters
 * @returns Message ID and credit cost
 * @throws Error if the API call fails
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResponse> {
  const { contactPhone, text, mode = 'AUTO', accountPhone, mediaItems } = params;

  // Clean phone number — digits only
  const cleanPhone = contactPhone.replace(/\D/g, '');

  const body: Record<string, unknown> = {
    contactPhone: cleanPhone,
    text,
    mode,
  };

  if (accountPhone) body.accountPhone = accountPhone;
  if (mediaItems && mediaItems.length > 0) body.mediaItems = mediaItems;

  console.log(`[SimpleTexting] Sending SMS to ${cleanPhone.slice(-4)}... (${text.length} chars)`);

  const response = await fetch(`${BASE_URL}/api/messages`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[SimpleTexting] Send failed: ${response.status} — ${errorText}`);
    throw new Error(`SimpleTexting send failed: ${response.status} — ${errorText}`);
  }

  const result = await response.json() as SendSmsResponse;
  console.log(`[SimpleTexting] SMS sent successfully. ID: ${result.id}, Credits: ${result.credits}`);
  return result;
}

/**
 * Send a bulk SMS to multiple recipients.
 * Sends sequentially with a small delay to avoid rate limits.
 * 
 * @param recipients - Array of { phone, text } pairs
 * @param delayMs - Delay between sends (default: 100ms)
 * @returns Array of results (success or error per recipient)
 */
export async function sendBulkSms(
  recipients: Array<{ phone: string; text: string }>,
  delayMs: number = 100
): Promise<Array<{ phone: string; success: boolean; messageId?: string; error?: string }>> {
  const results: Array<{ phone: string; success: boolean; messageId?: string; error?: string }> = [];

  console.log(`[SimpleTexting] Starting bulk send to ${recipients.length} recipients...`);

  for (const recipient of recipients) {
    try {
      const result = await sendSms({
        contactPhone: recipient.phone,
        text: recipient.text,
      });
      results.push({ phone: recipient.phone, success: true, messageId: result.id });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SimpleTexting] Failed to send to ${recipient.phone}: ${errorMsg}`);
      results.push({ phone: recipient.phone, success: false, error: errorMsg });
    }

    // Rate limit delay
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`[SimpleTexting] Bulk send complete: ${successCount}/${recipients.length} succeeded`);

  return results;
}

// ---------------------------------------------------------------------------
// WEBHOOK MANAGEMENT
// ---------------------------------------------------------------------------

/**
 * Create a webhook in SimpleTexting to receive incoming messages and delivery reports.
 */
export async function createWebhook(params: CreateWebhookParams): Promise<WebhookResponse> {
  const body: Record<string, unknown> = {
    url: params.url,
    triggers: params.triggers,
    requestPerSecLimit: params.requestPerSecLimit ?? 15,
  };

  if (params.accountPhone) body.accountPhone = params.accountPhone;

  console.log(`[SimpleTexting] Creating webhook → ${params.url} (triggers: ${params.triggers.join(', ')})`);

  const response = await fetch(`${BASE_URL}/api/webhooks`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SimpleTexting webhook creation failed: ${response.status} — ${errorText}`);
  }

  const result = await response.json() as WebhookResponse;
  console.log(`[SimpleTexting] Webhook created: ${result.id}`);
  return result;
}

/**
 * List all existing webhooks.
 */
export async function listWebhooks(): Promise<WebhookResponse[]> {
  const response = await fetch(`${BASE_URL}/api/webhooks`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SimpleTexting list webhooks failed: ${response.status} — ${errorText}`);
  }

  return (await response.json()) as WebhookResponse[];
}

/**
 * Delete a webhook by ID.
 */
export async function deleteWebhook(webhookId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SimpleTexting delete webhook failed: ${response.status} — ${errorText}`);
  }

  console.log(`[SimpleTexting] Webhook deleted: ${webhookId}`);
}

// ---------------------------------------------------------------------------
// WEBHOOK PAYLOAD PARSING
// ---------------------------------------------------------------------------

/**
 * Parse and validate an incoming SimpleTexting webhook payload.
 * Returns typed webhook data or null if invalid.
 */
export function parseWebhookPayload(body: unknown): SimpleTextingWebhook | null {
  if (!body || typeof body !== 'object') return null;

  const payload = body as Record<string, unknown>;
  const type = payload.type as string;

  if (!type || !payload.values) return null;

  switch (type) {
    case 'INCOMING_MESSAGE':
      return payload as unknown as IncomingMessageWebhook;
    case 'DELIVERY_REPORT':
    case 'NON_DELIVERED_REPORT':
      return payload as unknown as DeliveryReportWebhook;
    case 'UNSUBSCRIBE_REPORT':
      return payload as unknown as UnsubscribeReportWebhook;
    default:
      console.warn(`[SimpleTexting] Unknown webhook type: ${type}`);
      return null;
  }
}

// ---------------------------------------------------------------------------
// TEMPLATE RENDERING
// ---------------------------------------------------------------------------

/**
 * Render a message template with variable substitution.
 * Supports: {{firstName}}, {{webinarName}}, {{liveRoomUrl}}, {{startTime}}, {{date}}
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  // Remove any remaining unreplaced placeholders
  result = result.replace(/\{\{\w+\}\}/g, '');
  return result;
}

/**
 * Format a phone number for the SimpleTexting API.
 * Strips non-digits and ensures US country code prefix.
 */
export function formatPhoneForApi(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) return `1${clean}`;
  return clean;
}
