/**
 * Webhook Auto-Configurator
 * 
 * Automatically configures:
 * 1. SimpleTexting webhook for INCOMING_MESSAGE → our /api/webhooks/simpletexting endpoint
 * 2. WebinarJam registrant polling (since WJ has no webhook API)
 * 
 * Runs on server startup and can be triggered from the admin dashboard.
 */

import { listWebhooks, createWebhook, deleteWebhook } from './simpletexting-client';
import { getDb } from './db';
import { webinarSchedules, webinarRegistrants } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { syncRegistrants } from './webinar-engine';
import { ENV } from './_core/env';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

/**
 * The production domain for this app.
 * Used to construct webhook callback URLs.
 */
const SITE_DOMAIN = 'https://coachinayahturnkeytool.com';

const SIMPLETEXTING_WEBHOOK_URL = `${SITE_DOMAIN}/api/webhooks/simpletexting`;

// ---------------------------------------------------------------------------
// SIMPLETEXTING WEBHOOK AUTO-CONFIG
// ---------------------------------------------------------------------------

/**
 * Ensure a SimpleTexting webhook exists pointing to our incoming SMS endpoint.
 * 
 * Logic:
 * 1. List all existing webhooks
 * 2. If one already points to our URL with INCOMING_MESSAGE trigger → done
 * 3. If not → create one
 * 
 * @returns Status of the webhook configuration
 */
export async function ensureSimpleTextingWebhook(): Promise<{
  status: 'already_configured' | 'created' | 'error';
  webhookId?: string;
  error?: string;
}> {
  // Skip if no API key configured
  if (!ENV.simpletextingApiKey) {
    console.log('[WebhookConfig] SimpleTexting API key not set, skipping webhook config');
    return { status: 'error', error: 'SIMPLETEXTING_API_KEY not configured' };
  }

  try {
    // Check existing webhooks
    const existing = await listWebhooks();
    console.log(`[WebhookConfig] Found ${existing.length} existing SimpleTexting webhooks`);

    // Look for one that already points to our URL
    const ourWebhook = existing.find(wh => 
      wh.url === SIMPLETEXTING_WEBHOOK_URL && 
      wh.triggers.includes('INCOMING_MESSAGE')
    );

    if (ourWebhook) {
      console.log(`[WebhookConfig] SimpleTexting webhook already configured (ID: ${ourWebhook.id})`);
      return { status: 'already_configured', webhookId: ourWebhook.id };
    }

    // Remove any stale webhooks pointing to our domain but with wrong URL
    for (const wh of existing) {
      if (wh.url.includes('coachinayahturnkeytool.com') && wh.url !== SIMPLETEXTING_WEBHOOK_URL) {
        console.log(`[WebhookConfig] Removing stale webhook: ${wh.url} (ID: ${wh.id})`);
        try {
          await deleteWebhook(wh.id);
        } catch (err) {
          console.warn(`[WebhookConfig] Failed to delete stale webhook ${wh.id}:`, err);
        }
      }
    }

    // Create new webhook
    const result = await createWebhook({
      url: SIMPLETEXTING_WEBHOOK_URL,
      triggers: ['INCOMING_MESSAGE', 'UNSUBSCRIBE_REPORT'],
      requestPerSecLimit: 15,
    });

    console.log(`[WebhookConfig] SimpleTexting webhook created successfully (ID: ${result.id})`);
    return { status: 'created', webhookId: result.id };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[WebhookConfig] Failed to configure SimpleTexting webhook:`, msg);
    return { status: 'error', error: msg };
  }
}

// ---------------------------------------------------------------------------
// WEBINARJAM REGISTRANT POLLING
// ---------------------------------------------------------------------------

/** Track the polling interval so we can stop it */
let pollingInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Poll WebinarJam for new registrants across all active schedules.
 * 
 * Since WebinarJam has NO webhook API, we poll every 5 minutes to:
 * 1. Fetch registrants from all active schedules with WJ IDs
 * 2. Upsert new registrants into our database
 * 3. Send welcome SMS to newly discovered registrants
 * 
 * @returns Summary of the sync across all schedules
 */
export async function pollWebinarJamRegistrants(): Promise<{
  schedulesPolled: number;
  newRegistrants: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) {
    console.log('[WebhookConfig] Database not available, skipping WJ poll');
    return { schedulesPolled: 0, newRegistrants: 0, errors: 0 };
  }

  // Get all active schedules with WebinarJam IDs
  const schedules = await db
    .select()
    .from(webinarSchedules)
    .where(
      and(
        eq(webinarSchedules.isActive, 1),
      )
    );

  const wjSchedules = schedules.filter(
    s => s.webinarjamWebinarId && s.webinarjamScheduleId
  );

  if (wjSchedules.length === 0) {
    console.log('[WebhookConfig] No active schedules with WebinarJam IDs, skipping poll');
    return { schedulesPolled: 0, newRegistrants: 0, errors: 0 };
  }

  let totalNew = 0;
  let errors = 0;

  for (const schedule of wjSchedules) {
    try {
      const result = await syncRegistrants(schedule.id);
      totalNew += result.newRegistrants;
      console.log(`[WebhookConfig] Polled schedule "${schedule.name}": ${result.newRegistrants} new, ${result.updated} updated`);
    } catch (error) {
      errors++;
      console.error(`[WebhookConfig] Failed to poll schedule "${schedule.name}" (ID: ${schedule.id}):`, error);
    }
  }

  console.log(`[WebhookConfig] Poll complete: ${wjSchedules.length} schedules, ${totalNew} new registrants, ${errors} errors`);
  return { schedulesPolled: wjSchedules.length, newRegistrants: totalNew, errors };
}

/**
 * Start the WebinarJam polling interval.
 * Polls every 5 minutes for new registrants.
 */
export function startWebinarJamPolling(intervalMs: number = 5 * 60 * 1000): void {
  // Don't start if no API key
  if (!ENV.webinarjamApiKey) {
    console.log('[WebhookConfig] WebinarJam API key not set, skipping polling');
    return;
  }

  // Don't double-start
  if (pollingInterval) {
    console.log('[WebhookConfig] WebinarJam polling already running');
    return;
  }

  console.log(`[WebhookConfig] Starting WebinarJam polling (every ${intervalMs / 1000}s)`);

  // Run immediately on start
  pollWebinarJamRegistrants().catch(err => {
    console.error('[WebhookConfig] Initial WJ poll failed:', err);
  });

  // Then poll on interval
  pollingInterval = setInterval(() => {
    pollWebinarJamRegistrants().catch(err => {
      console.error('[WebhookConfig] WJ poll failed:', err);
    });
  }, intervalMs);
}

/**
 * Stop the WebinarJam polling interval.
 */
export function stopWebinarJamPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('[WebhookConfig] WebinarJam polling stopped');
  }
}

/**
 * Check if WebinarJam polling is currently active.
 */
export function isPollingActive(): boolean {
  return pollingInterval !== null;
}

// ---------------------------------------------------------------------------
// COMBINED STARTUP
// ---------------------------------------------------------------------------

/**
 * Run the full auto-configuration on server startup.
 * 
 * 1. Configure SimpleTexting webhook (if API key available)
 * 2. Start WebinarJam polling (if API key available)
 * 
 * This is safe to call multiple times — it's idempotent.
 */
export async function runWebhookAutoConfig(): Promise<{
  simpleTexting: { status: string; webhookId?: string; error?: string };
  webinarJam: { pollingStarted: boolean };
}> {
  console.log('[WebhookConfig] Running auto-configuration...');

  // 1. SimpleTexting webhook
  const stResult = await ensureSimpleTextingWebhook();

  // 2. WebinarJam polling
  startWebinarJamPolling();

  console.log('[WebhookConfig] Auto-configuration complete:', {
    simpleTexting: stResult.status,
    webinarJam: isPollingActive() ? 'polling' : 'disabled',
  });

  return {
    simpleTexting: stResult,
    webinarJam: { pollingStarted: isPollingActive() },
  };
}
