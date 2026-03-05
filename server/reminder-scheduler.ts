/**
 * Reminder Scheduler Utilities
 *
 * The main scheduling logic is now integrated into the SMS dispatcher
 * (multi-channel reminders fire alongside SMS when sequence names match).
 *
 * This file retains shared utility functions used by both the dispatcher
 * and manual reminder endpoints.
 */

// ─── UTM Helpers ────────────────────────────────────────────────────────────

/**
 * Add UTM tracking parameters to a join URL
 */
export function addUtmParams(
  baseUrl: string,
  reminderType: "24h" | "1h" | "starting",
  channel: "gmail" | "calendar_update" | "multi_channel"
): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("utm_source", "coach_inayah");
    url.searchParams.set("utm_medium", channel === "gmail" ? "email" : "calendar");
    url.searchParams.set("utm_campaign", `webinar_reminder_${reminderType}`);
    url.searchParams.set("utm_content", `auto_${reminderType}`);
    return url.toString();
  } catch {
    // If URL parsing fails, return original
    return baseUrl;
  }
}

/**
 * Map SMS sequence names to reminder types.
 * Used by the SMS dispatcher to determine which multi-channel reminders to fire.
 */
export const SMS_TO_REMINDER_MAP: Record<string, "24h" | "1h" | "starting"> = {
  "Day Before Reminder": "24h",
  "2 Days Before Reminder": "24h",
  "1 Hour Warning": "1h",
  "Starting NOW": "starting",
};
