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

    const startDate = typeof params.startTime === "string"
      ? new Date(params.startTime)
      : params.startTime;

    // Default end time: 90 minutes after start
    const endDate = params.endTime
      ? (typeof params.endTime === "string" ? new Date(params.endTime) : params.endTime)
      : new Date(startDate.getTime() + 90 * 60 * 1000);

    const timezone = params.timezone || "America/Los_Angeles";

    // Build description with join link
    let description = params.description || "";
    if (params.joinUrl) {
      description += `\n\n🔗 Join the webinar: ${params.joinUrl}`;
    }

    const event: calendar_v3.Schema$Event = {
      summary: params.title,
      description: description.trim(),
      location: params.location || (params.joinUrl ? params.joinUrl : undefined),
      start: {
        dateTime: startDate.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endDate.toISOString(),
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

    // If there's a join URL, add it as a conference-like entry point
    if (params.joinUrl) {
      event.conferenceData = {
        entryPoints: [
          {
            entryPointType: "video",
            uri: params.joinUrl,
            label: "Join Webinar",
          },
        ],
        conferenceSolution: {
          key: { type: "addOn" },
          name: "Webinar Link",
        },
        conferenceId: params.webinarId || "webinar",
      };
    }

    const response = await calendar.events.insert({
      calendarId: "primary", // support@coachinayah.com's primary calendar
      requestBody: event,
      sendUpdates: "all", // Send email invitations to attendees
      conferenceDataVersion: params.joinUrl ? 1 : 0,
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
 * Send calendar invites to multiple attendees for the same webinar event.
 * Creates individual events (not one event with multiple attendees) so each
 * person gets their own calendar entry they can accept/decline independently.
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

  for (const attendee of attendees) {
    // Small delay between invites to avoid rate limiting
    if (results.length > 0) {
      await new Promise((r) => setTimeout(r, 200));
    }

    const result = await sendCalendarInvite({
      ...eventDetails,
      attendeeEmail: attendee.email,
      attendeeName: attendee.name,
    });

    results.push(result);
    if (result.success) sent++;
    else failed++;
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

    for (const event of items) {
      if (!event.id) continue;

      // Small delay to avoid rate limiting
      if (updated + failed > 0) {
        await new Promise(r => setTimeout(r, 200));
      }

      // Prepend reminder to existing description
      const currentDesc = event.description || "";
      // Remove any previous reminder prefix (to avoid stacking)
      const cleanDesc = currentDesc
        .replace(/^(\u23f0|\u26a1|\ud83d\udfe2).*?\n\n/s, "")
        .trim();
      const newDesc = `${reminderPrefix}${joinLine}\n\n${cleanDesc}`;

      const result = await updateCalendarEvent(event.id, {
        description: newDesc,
      }, true);

      if (result.success) {
        updated++;
      } else {
        failed++;
        errors.push(`Event ${event.id}: ${result.error}`);
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
