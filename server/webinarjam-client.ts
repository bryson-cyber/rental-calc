/**
 * WebinarJam API Client
 * 
 * Handles all WebinarJam operations: listing webinars, fetching registrants,
 * detecting no-shows, and registering new attendees.
 * 
 * API Docs: https://support.webinarjam.com/support/solutions/153000174610
 * Base URL: https://api.webinarjam.com/webinarjam
 * Auth: api_key in POST body (form-urlencoded)
 */

import { ENV } from './_core/env';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface WebinarJamWebinar {
  webinar_id: number;
  name: string;
  description?: string;
  schedules: WebinarJamSchedule[];
  [key: string]: unknown;
}

export interface WebinarJamSchedule {
  schedule: number; // schedule_id
  date: string;
  time: string;
  timezone: string;
  comment?: string;
}

export interface WebinarJamRegistrant {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  phone_country_code?: string;
  schedule: number;
  attended_live: number; // 0 = no-show, 1 = attended
  date_live?: string;
  entered_live?: string;
  time_live?: string;
  attended_replay: number;
  live_room: string;
  replay_room: string;
  subscribed: number;
  lead_id: number;
  [key: string]: unknown;
}

export interface WebinarJamRegistration {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  schedule: number;
  date: string;
  live_room_url: string;
  replay_room_url: string;
  thank_you_url: string;
}

export interface NoShowResult {
  registrant: WebinarJamRegistrant;
  phone: string;
  firstName: string;
  liveRoomUrl: string;
}

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

const BASE_URL = 'https://api.webinarjam.com/webinarjam';

function getApiKey(): string {
  const key = ENV.webinarjamApiKey;
  if (!key) {
    throw new Error('[WebinarJam] WEBINARJAM_API_KEY is not set.');
  }
  return key;
}

/**
 * Make a POST request to WebinarJam API.
 * WebinarJam uses form-urlencoded POST with api_key in the body.
 */
async function wjPost<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const body = new URLSearchParams();
  body.append('api_key', getApiKey());
  for (const [key, value] of Object.entries(params)) {
    body.append(key, String(value));
  }

  const url = `${BASE_URL}${endpoint}`;
  console.log(`[WebinarJam] POST ${endpoint}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[WebinarJam] API error: ${response.status} — ${errorText}`);
    throw new Error(`WebinarJam API error: ${response.status} — ${errorText}`);
  }

  const data = await response.json();

  // WebinarJam returns { status: "success", ... } on success
  if (data.status && data.status !== 'success') {
    console.error(`[WebinarJam] API returned error status:`, data);
    throw new Error(`WebinarJam API error: ${JSON.stringify(data)}`);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// WEBINAR OPERATIONS
// ---------------------------------------------------------------------------

/**
 * List all webinars in the account.
 */
export async function listWebinars(): Promise<WebinarJamWebinar[]> {
  const data = await wjPost<{ webinars: WebinarJamWebinar[] }>('/webinars');
  console.log(`[WebinarJam] Found ${data.webinars?.length ?? 0} webinars`);
  return data.webinars ?? [];
}

/**
 * Get detailed info for a specific webinar, including schedules.
 */
export async function getWebinar(webinarId: string | number): Promise<WebinarJamWebinar> {
  const data = await wjPost<{ webinar: WebinarJamWebinar }>('/webinar', {
    webinar_id: webinarId,
  });
  return data.webinar;
}

// ---------------------------------------------------------------------------
// REGISTRANT OPERATIONS
// ---------------------------------------------------------------------------

/**
 * Fetch all registrants for a specific webinar + schedule.
 */
export async function getRegistrants(
  webinarId: string | number,
  scheduleId: string | number
): Promise<WebinarJamRegistrant[]> {
  const data = await wjPost<{ registrants: WebinarJamRegistrant[] }>('/registrants', {
    webinar_id: webinarId,
    schedule_id: scheduleId,
  });

  const registrants = data.registrants ?? [];
  console.log(`[WebinarJam] Fetched ${registrants.length} registrants for webinar ${webinarId}, schedule ${scheduleId}`);
  return registrants;
}

/**
 * Detect no-shows: registrants who signed up but didn't attend live.
 * Filters for attended_live === 0 and has a valid phone number.
 * 
 * @returns Array of no-show registrants with their phone and live room URL
 */
export async function getNoShows(
  webinarId: string | number,
  scheduleId: string | number
): Promise<NoShowResult[]> {
  const registrants = await getRegistrants(webinarId, scheduleId);

  const noShows = registrants
    .filter(r => {
      // No-show: attended_live is 0 or falsy
      const didNotAttend = !r.attended_live || r.attended_live === 0;
      // Must have a phone number to send SMS
      const hasPhone = !!r.phone && r.phone.trim().length > 0;
      return didNotAttend && hasPhone;
    })
    .map(r => ({
      registrant: r,
      phone: cleanPhone(r.phone!, r.phone_country_code),
      firstName: r.first_name || 'there',
      liveRoomUrl: r.live_room || '',
    }));

  console.log(`[WebinarJam] Found ${noShows.length} no-shows out of ${registrants.length} registrants`);
  return noShows;
}

/**
 * Get all attendees who actually showed up live.
 */
export async function getAttendees(
  webinarId: string | number,
  scheduleId: string | number
): Promise<WebinarJamRegistrant[]> {
  const registrants = await getRegistrants(webinarId, scheduleId);
  return registrants.filter(r => r.attended_live === 1);
}

// ---------------------------------------------------------------------------
// REGISTRATION
// ---------------------------------------------------------------------------

/**
 * Register a new person for a webinar.
 */
export async function registerPerson(params: {
  webinarId: string | number;
  firstName: string;
  lastName?: string;
  email: string;
  scheduleId: string | number;
  phone?: string;
  phoneCountryCode?: string;
}): Promise<WebinarJamRegistration> {
  const body: Record<string, string | number> = {
    webinar_id: params.webinarId,
    first_name: params.firstName,
    email: params.email,
    schedule: params.scheduleId,
  };

  if (params.lastName) body.last_name = params.lastName;
  if (params.phone) body.phone = params.phone;
  if (params.phoneCountryCode) body.phone_country_code = params.phoneCountryCode;

  const data = await wjPost<{ user: WebinarJamRegistration }>('/register', body);
  console.log(`[WebinarJam] Registered ${params.firstName} for webinar ${params.webinarId}`);
  return data.user;
}

// ---------------------------------------------------------------------------
// UNSUBSCRIBE
// ---------------------------------------------------------------------------

/**
 * Unsubscribe a lead from a webinar.
 */
export async function unsubscribeLead(
  webinarId: string | number,
  leadId: string | number
): Promise<void> {
  await wjPost('/unsubscribe', {
    webinar_id: webinarId,
    lead_id: leadId,
  });
  console.log(`[WebinarJam] Unsubscribed lead ${leadId} from webinar ${webinarId}`);
}

// ---------------------------------------------------------------------------
// SYNC UTILITY
// ---------------------------------------------------------------------------

/**
 * Sync registrants from WebinarJam into our local database.
 * Returns the full list of registrants for further processing.
 */
export async function syncRegistrantsFromWebinarJam(
  webinarId: string | number,
  scheduleId: string | number
): Promise<{
  total: number;
  attended: number;
  noShows: number;
  registrants: WebinarJamRegistrant[];
}> {
  const registrants = await getRegistrants(webinarId, scheduleId);

  const attended = registrants.filter(r => r.attended_live === 1).length;
  const noShows = registrants.filter(r => !r.attended_live || r.attended_live === 0).length;

  console.log(`[WebinarJam] Sync complete: ${registrants.length} total, ${attended} attended, ${noShows} no-shows`);

  return {
    total: registrants.length,
    attended,
    noShows,
    registrants,
  };
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Clean and normalize a phone number.
 * Ensures it's digits-only and prepends country code if needed.
 */
function cleanPhone(phone: string, countryCode?: string): string {
  // Strip all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // If country code provided and phone doesn't start with it, prepend
  if (countryCode) {
    const cleanCode = countryCode.replace(/\D/g, '');
    if (!cleaned.startsWith(cleanCode)) {
      cleaned = cleanCode + cleaned;
    }
  }

  // Default: if 10 digits (US), prepend 1
  if (cleaned.length === 10) {
    cleaned = '1' + cleaned;
  }

  return cleaned;
}
