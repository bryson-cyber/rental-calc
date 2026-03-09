/**
 * Google Calendar Service
 *
 * Uses a GCP service account with domain-wide delegation to create
 * calendar events (with attendees) on behalf of support@coachinayah.com.
 *
 * The service account must have:
 *   1. Domain-wide delegation enabled in GCP console
 *   2. The scope https://www.googleapis.com/auth/calendar granted in
 *      Google Workspace Admin → Security → API Controls → Domain-wide Delegation
 *   3. The impersonation email must be a real Workspace user
 */

import { google, type calendar_v3 } from "googleapis";
import { JWT } from "google-auth-library";
import { ENV } from "./_core/env";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CalendarInviteParams {
  /** Attendee email address */
  attendeeEmail: string;
  /** Attendee display name (optional) */
  attendeeName?: string;
  /** Event title / summary */
  title: string;
  /** Event description (HTML supported) */
  description?: string;
  /** Event start time (ISO 8601 string or Date) */
  startTime: string | Date;
  /** Event end time (ISO 8601 string or Date). Defaults to startTime + 90 minutes */
  endTime?: string | Date;
  /** IANA timezone string, e.g. "America/New_York". Defaults to "America/Los_Angeles" */
  timezone?: string;
  /** Video conference / join URL (will be added to description and as a conference link) */
  joinUrl?: string;
  /** Location text */
  location?: string;
  /** Webinar ID for tracking (stored in extendedProperties) */
  webinarId?: string;
}

export interface CalendarInviteResult {
  success: boolean;
  eventId?: string;
  htmlLink?: string;
  error?: string;
}

// ─── Auth Helper ─────────────────────────────────────────────────────────────

let _cachedAuth: JWT | null = null;

function getCalendarAuth() {
  if (_cachedAuth) return _cachedAuth;

  const saJson = ENV.googleCalendarServiceAccountJson;
  const impersonateEmail = ENV.googleCalendarImpersonateEmail || "support@coachinayah.com";

  if (!saJson) {
    throw new Error("GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON is not configured");
  }

  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(saJson);
  } catch {
    throw new Error("GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Service account JSON missing client_email or private_key");
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: impersonateEmail, // domain-wide delegation impersonation
  });

  _cachedAuth = auth;
  return auth;
}

// ─── Calendar Client ─────────────────────────────────────────────────────────

function getCalendarClient(): calendar_v3.Calendar {
  const auth = getCalendarAuth();
  return google.calendar({ version: "v3", auth });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Send a Google Calendar invite to an attendee for a webinar.
 *
 * The event is created on support@coachinayah.com's calendar and the
 * attendee receives an email invitation from Google Calendar.
 */
export async function sendCalendarInvite(
  params: CalendarInviteParams
): Promise<CalendarInviteResult> {
  try {
    const calendar = getCalendarClient();

    const timezone = params.timezone || "America/Los_Angeles";

    // ─── TIMEZONE-AWARE DATE HANDLING ─────────────────────────────────────────
    // WebinarJam returns schedule dates like "2026-03-11 19:00" in the webinar's
    // timezone (e.g., America/New_York). We must NOT convert through JavaScript's
    // Date object because `new Date("2026-03-11 19:00:00")` parses as UTC,
    // causing a 4-5 hour offset.
    //
    // Google Calendar API accepts dateTime in two formats:
    //   1. "2026-03-11T19:00:00Z"     → UTC (ignores timeZone field)
    //   2. "2026-03-11T19:00:00"      → local time, uses timeZone field
    //
    // We use format #2 so the timeZone field is respected.
    // ─────────────────────────────────────────────────────────────────────────────

    let startDateTimeLocal: string;
    let endDateTimeLocal: string;

    if (typeof params.startTime === "string") {
      // If it's a string like "2026-03-11 19:00" or "2026-03-11T19:00:00",
      // normalize to "YYYY-MM-DDTHH:mm:ss" format (NO Z suffix)
      startDateTimeLocal = params.startTime.replace(" ", "T");
      if (!startDateTimeLocal.includes(":", 14)) {
        startDateTimeLocal += ":00"; // Add seconds if missing
      }
      // Strip any trailing Z or timezone offset — we want local time
      startDateTimeLocal = startDateTimeLocal.replace(/Z$/, "").replace(/[+-]\d{2}:\d{2}$/, "");
    } else {
      // It's a Date object — format as local ISO without Z
      // WARNING: This still uses UTC internally, so only use Date objects
      // when they already represent the correct wall-clock time
      const d = params.startTime;
      startDateTimeLocal = d.toISOString().replace(/Z$/, "");
    }

    if (params.endTime) {
      if (typeof params.endTime === "string") {
        endDateTimeLocal = params.endTime.replace(" ", "T");
        if (!endDateTimeLocal.includes(":", 14)) {
          endDateTimeLocal += ":00";
        }
        endDateTimeLocal = endDateTimeLocal.replace(/Z$/, "").replace(/[+-]\d{2}:\d{2}$/, "");
      } else {
        endDateTimeLocal = params.endTime.toISOString().replace(/Z$/, "");
      }
    } else {
      // Default end time: 90 minutes after start
      // Parse the local time string to compute end time
      const [datePart, timePart] = startDateTimeLocal.split("T");
      const [hours, minutes, seconds] = timePart.split(":").map(Number);
      const totalMinutes = hours * 60 + minutes + 90;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      endDateTimeLocal = `${datePart}T${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:${String(seconds || 0).padStart(2, "0")}`;
    }

    // Build description with join link
    let description = params.description || "";
    if (params.joinUrl) {
      description += `\n\n🔗 Join the webinar: ${params.joinUrl}`;
    }

    const event: calendar_v3.Schema$Event = {
      summary: params.title,
      description: description.trim(),
      location: params.joinUrl || params.location || undefined,
      // Set organizer display name
      organizer: {
        email: ENV.googleCalendarImpersonateEmail || "support@coachinayah.com",
        displayName: "Inayah McMillan",
      },
      start: {
        dateTime: startDateTimeLocal,
        timeZone: timezone,
      },
      end: {
        dateTime: endDateTimeLocal,
        timeZone: timezone,
      },
      attendees: [
        {
          email: params.attendeeEmail,
          displayName: params.attendeeName,
          responseStatus: "needsAction",
        },
      ],
      // Reminders: these apply to the organizer's calendar; attendees get
      // their own default reminders from Google Calendar, but the event
      // creation email (sendUpdates: "all") serves as the initial notification.
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 1440 },  // 24 hours before
          { method: "email", minutes: 60 },     // 1 hour before
          { method: "popup", minutes: 30 },     // 30 minutes before
          { method: "popup", minutes: 10 },     // 10 minutes before
        ],
      },
      // Store webinar metadata for tracking
      extendedProperties: {
        private: {
          webinarId: params.webinarId || "",
          source: "rental-calculator-app",
          createdBy: "auto-registration",
        },
      },
      // Ensure attendees get email notifications
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: false,
    };

    const response = await calendar.events.insert({
      calendarId: "primary", // support@coachinayah.com's primary calendar
      requestBody: event,
      sendUpdates: "all", // Send email invitations to attendees
    });

    console.log(
      `[Calendar] Invite sent to ${params.attendeeEmail} for "${params.title}" (eventId: ${response.data.id})`
    );

    return {
      success: true,
      eventId: response.data.id || undefined,
      htmlLink: response.data.htmlLink || undefined,
    };
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error(`[Calendar] Failed to send invite to ${params.attendeeEmail}:`, message);

    // Provide more specific error messages
    if (message.includes("Not Authorized") || message.includes("forbidden")) {
      return {
        success: false,
        error: `Domain-wide delegation not authorized. Ensure the service account has calendar scope for ${ENV.googleCalendarImpersonateEmail}`,
      };
    }
    if (message.includes("invalid_grant")) {
      return {
        success: false,
        error: "Service account credentials are invalid or expired. Re-generate the key in GCP console.",
      };
    }

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Check if an error message indicates a rate limit from Google Calendar API.
 */
function isRateLimitError(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase();
  return (
    lower.includes("rate limit") ||
    lower.includes("ratelimit") ||
    lower.includes("quota") ||
    lower.includes("too many requests") ||
    lower.includes("429") ||
    lower.includes("user rate limit exceeded") ||
    lower.includes("calendar usage limits")
  );
}

/**
 * Send calendar invites to multiple attendees for the same webinar event.
 * Creates individual events (not one event with multiple attendees) so each
 * person gets their own calendar entry they can accept/decline independently.
 *
 * Rate limiting strategy:
 * - 1500ms base delay between invites (~40/min, under Google's 60/min limit)
 * - Exponential backoff on rate limit errors (5s → 10s → 20s → 40s)
 * - Up to 3 retries per invite on rate limit errors
 * - Progress logging every 25 invites
 */
export async function sendBulkCalendarInvites(
  attendees: Array<{ email: string; name?: string }>,
  eventDetails: Omit<CalendarInviteParams, "attendeeEmail" | "attendeeName">
): Promise<{
  total: number;
  sent: number;
  failed: number;
  results: CalendarInviteResult[];
}> {
  const results: CalendarInviteResult[] = [];
  let sent = 0;
  let failed = 0;

  // Base delay between invites: 1500ms = ~40 invites/minute (safely under Google's 60/min limit)
  const BASE_DELAY_MS = 1500;
  // Max retries for rate-limited invites
  const MAX_RETRIES = 3;
  // Initial backoff delay when rate-limited
  const INITIAL_BACKOFF_MS = 5000;
  // Consecutive rate limits trigger a longer cooldown
  let consecutiveRateLimits = 0;

  console.log(`[Calendar] Starting bulk invite: ${attendees.length} attendees`);

  for (let i = 0; i < attendees.length; i++) {
    const attendee = attendees[i];

    // Delay between invites (skip for the first one)
    if (i > 0) {
      // If we've been hitting rate limits, add extra cooldown
      const cooldownMs = consecutiveRateLimits > 0
        ? BASE_DELAY_MS + (consecutiveRateLimits * 2000)
        : BASE_DELAY_MS;
      await new Promise((r) => setTimeout(r, cooldownMs));
    }

    // Try sending with retries on rate limit
    let result: CalendarInviteResult | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      result = await sendCalendarInvite({
        ...eventDetails,
        attendeeEmail: attendee.email,
        attendeeName: attendee.name,
      });

      if (result.success) {
        consecutiveRateLimits = 0; // Reset on success
        break;
      }

      // Check if this is a rate limit error
      if (result.error && isRateLimitError(result.error) && attempt < MAX_RETRIES) {
        consecutiveRateLimits++;
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt); // 5s, 10s, 20s
        console.log(
          `[Calendar] Rate limited on ${attendee.email} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), ` +
          `backing off ${backoffMs / 1000}s...`
        );
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      // Non-rate-limit error or max retries exhausted — accept the failure
      break;
    }

    results.push(result!);
    if (result!.success) sent++;
    else failed++;

    // Progress logging every 25 invites
    if ((i + 1) % 25 === 0 || i === attendees.length - 1) {
      console.log(
        `[Calendar] Progress: ${i + 1}/${attendees.length} processed (${sent} sent, ${failed} failed)`
      );
    }
  }

  console.log(
    `[Calendar] Bulk invite complete: ${sent} sent, ${failed} failed out of ${attendees.length}`
  );

  return { total: attendees.length, sent, failed, results };
}

/**
 * Check if the Google Calendar integration is properly configured.
 * Returns a diagnostic object.
 */
export async function checkCalendarHealth(): Promise<{
  configured: boolean;
  authenticated: boolean;
  impersonateEmail: string;
  error?: string;
}> {
  const impersonateEmail = ENV.googleCalendarImpersonateEmail || "support@coachinayah.com";

  if (!ENV.googleCalendarServiceAccountJson) {
    return {
      configured: false,
      authenticated: false,
      impersonateEmail,
      error: "GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON not set",
    };
  }

  try {
    const calendar = getCalendarClient();
    // Try listing 1 event to verify auth works
    await calendar.events.list({
      calendarId: "primary",
      maxResults: 1,
      timeMin: new Date().toISOString(),
    });

    return {
      configured: true,
      authenticated: true,
      impersonateEmail,
    };
  } catch (error: any) {
    return {
      configured: true,
      authenticated: false,
      impersonateEmail,
      error: error?.message || String(error),
    };
  }
}

/**
 * Update an existing calendar event and optionally notify attendees.
 * 
 * This is the key mechanism for sending "reminder" emails through Google Calendar:
 * When you update an event with sendUpdates: "all", Google sends a change notification
 * email to all attendees. This is a legitimate way to remind people about the event
 * since the email comes directly from Google Calendar (high deliverability).
 */
export async function updateCalendarEvent(
  eventId: string,
  updates: {
    description?: string;
    summary?: string;
    location?: string;
  },
  sendNotification: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = getCalendarClient();

    // First get the current event
    const existing = await calendar.events.get({
      calendarId: "primary",
      eventId,
    });

    if (!existing.data) {
      return { success: false, error: "Event not found" };
    }

    // Merge updates
    const updatedEvent: calendar_v3.Schema$Event = {
      ...existing.data,
    };
    if (updates.description !== undefined) updatedEvent.description = updates.description;
    if (updates.summary !== undefined) updatedEvent.summary = updates.summary;
    if (updates.location !== undefined) updatedEvent.location = updates.location;

    await calendar.events.update({
      calendarId: "primary",
      eventId,
      requestBody: updatedEvent,
      sendUpdates: sendNotification ? "all" : "none",
    });

    console.log(`[Calendar] Event ${eventId} updated${sendNotification ? " (notifications sent)" : ""}`);
    return { success: true };
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error(`[Calendar] Failed to update event ${eventId}:`, message);
    return { success: false, error: message };
  }
}

/**
 * Send reminder updates to all calendar events for a webinar.
 * Updates the event description with a reminder message and triggers
 * Google Calendar to send notification emails to all attendees.
 * 
 * @param webinarId - The webinar ID to find events for
 * @param reminderType - "24h" or "1h" to customize the reminder message
 */
export async function sendCalendarReminderUpdates(
  webinarId: string,
  reminderType: "24h" | "1h" | "starting",
  joinUrl?: string
): Promise<{ updated: number; failed: number; errors: string[] }> {
  try {
    const calendar = getCalendarClient();

    // Find all events for this webinar using extended properties
    const events = await calendar.events.list({
      calendarId: "primary",
      privateExtendedProperty: `webinarId=${webinarId}`,
      maxResults: 2500,
      singleEvents: true,
    });

    const items = events.data.items || [];
    if (items.length === 0) {
      return { updated: 0, failed: 0, errors: ["No calendar events found for this webinar"] };
    }

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    // Build reminder prefix based on type
    const reminderPrefix = reminderType === "24h"
      ? "\u23f0 REMINDER: This webinar starts TOMORROW!"
      : reminderType === "1h"
      ? "\u26a1 STARTING SOON: This webinar begins in 1 hour!"
      : "\ud83d\udfe2 LIVE NOW: The webinar is starting!";

    const joinLine = joinUrl ? `\n\n\ud83d\udd17 Join now: ${joinUrl}` : "";

    let consecutiveRateLimits = 0;

    for (let i = 0; i < items.length; i++) {
      const event = items[i];
      if (!event.id) continue;

      // Rate-limited delay between updates (1500ms base, more if rate-limited)
      if (updated + failed > 0) {
        const cooldownMs = consecutiveRateLimits > 0
          ? 1500 + (consecutiveRateLimits * 2000)
          : 1500;
        await new Promise(r => setTimeout(r, cooldownMs));
      }

      // Prepend reminder to existing description
      const currentDesc = event.description || "";
      // Remove any previous reminder prefix (to avoid stacking)
      const cleanDesc = currentDesc
        .replace(/^(\u23f0|\u26a1|\ud83d\udfe2).*?\n\n/s, "")
        .trim();
      const newDesc = `${reminderPrefix}${joinLine}\n\n${cleanDesc}`;

      // Try with retries on rate limit
      let result: { success: boolean; error?: string } = { success: false };
      for (let attempt = 0; attempt <= 3; attempt++) {
        result = await updateCalendarEvent(event.id, {
          description: newDesc,
        }, true);

        if (result.success) {
          consecutiveRateLimits = 0;
          break;
        }

        if (result.error && isRateLimitError(result.error) && attempt < 3) {
          consecutiveRateLimits++;
          const backoffMs = 5000 * Math.pow(2, attempt);
          console.log(`[Calendar Reminder] Rate limited on event ${event.id} (attempt ${attempt + 1}/4), backing off ${backoffMs / 1000}s...`);
          await new Promise(r => setTimeout(r, backoffMs));
          continue;
        }
        break;
      }

      if (result.success) {
        updated++;
      } else {
        failed++;
        errors.push(`Event ${event.id}: ${result.error}`);
      }

      // Progress logging every 25 events
      if ((i + 1) % 25 === 0 || i === items.length - 1) {
        console.log(`[Calendar Reminder] Progress: ${i + 1}/${items.length} processed (${updated} updated, ${failed} failed)`);
      }
    }

    console.log(`[Calendar Reminder] ${reminderType}: Updated ${updated}, failed ${failed} for webinar ${webinarId}`);
    return { updated, failed, errors };
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error(`[Calendar Reminder] Failed:`, message);
    return { updated: 0, failed: 0, errors: [message] };
  }
}

/**
 * Clear the cached auth client (useful for testing or credential rotation).
 */
export function clearCalendarAuthCache(): void {
  _cachedAuth = null;
}
