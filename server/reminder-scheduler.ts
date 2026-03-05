/**
 * Automated Reminder Scheduler
 *
 * Polls every 60 seconds, checks if any scheduled reminders are due,
 * and fires them via both Google Calendar event updates and Gmail API.
 *
 * Reminders are fired at:
 *  - 24 hours before webinar start
 *  - 1 hour before webinar start
 *  - At webinar start time ("Live Now")
 *
 * Auto-disables the schedule 2 hours after the webinar ends.
 */

import { getDb } from "./db";
import {
  webinarReminderSchedule,
  emailSendLog,
  webinarRegistrants,
} from "../drizzle/schema";
import { eq, and, lte } from "drizzle-orm";
import { sendCalendarReminderUpdates } from "./google-calendar";
import {
  sendReminderEmail,
  buildWebinarReminderEmail,
} from "./gmail-reminders";

// ─── UTM Helpers ────────────────────────────────────────────────────────────

/**
 * Add UTM tracking parameters to a join URL
 */
export function addUtmParams(
  baseUrl: string,
  reminderType: "24h" | "1h" | "starting",
  channel: "gmail" | "calendar_update"
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

// ─── Scheduler Core ─────────────────────────────────────────────────────────

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the automated reminder scheduler (polls every 60 seconds)
 */
export function startReminderScheduler(): void {
  if (schedulerInterval) {
    console.log("[Reminder Scheduler] Already running, skipping duplicate start");
    return;
  }

  console.log("[Reminder Scheduler] Starting automated reminder scheduler (every 60s)");

  // Run immediately on start, then every 60s
  checkAndFireReminders().catch((err) =>
    console.error("[Reminder Scheduler] Initial check failed:", err)
  );

  schedulerInterval = setInterval(() => {
    checkAndFireReminders().catch((err) =>
      console.error("[Reminder Scheduler] Check failed:", err)
    );
  }, 60_000);
}

/**
 * Stop the scheduler
 */
export function stopReminderScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Reminder Scheduler] Stopped");
  }
}

/**
 * Main check loop: find due reminders and fire them
 */
async function checkAndFireReminders(): Promise<void> {
  const db = await getDb();
  const now = new Date();

  // Get all enabled schedules
  const schedules = await db
    .select()
    .from(webinarReminderSchedule)
    .where(eq(webinarReminderSchedule.enabled, 1));

  for (const schedule of schedules) {
    const startTime = new Date(schedule.webinarStartTime);
    const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Auto-disable if webinar ended more than 2 hours ago
    if (hoursUntilStart < -2) {
      await db
        .update(webinarReminderSchedule)
        .set({ enabled: 0 })
        .where(eq(webinarReminderSchedule.id, schedule.id));
      console.log(
        `[Reminder Scheduler] Auto-disabled schedule for webinar ${schedule.webinarId} (ended ${Math.abs(Math.round(hoursUntilStart))}h ago)`
      );
      continue;
    }

    // Check each reminder window
    // 24h reminder: fire when <= 24h away and status is 'pending'
    if (hoursUntilStart <= 24 && schedule.reminder24h === "pending") {
      await fireReminder(schedule, "24h");
    }

    // 1h reminder: fire when <= 1h away and status is 'pending'
    if (hoursUntilStart <= 1 && schedule.reminder1h === "pending") {
      await fireReminder(schedule, "1h");
    }

    // Starting reminder: fire when <= 0 (at or past start time) and status is 'pending'
    if (hoursUntilStart <= 0 && schedule.reminderStarting === "pending") {
      await fireReminder(schedule, "starting");
    }
  }
}

/**
 * Fire a specific reminder for a schedule
 */
async function fireReminder(
  schedule: typeof webinarReminderSchedule.$inferSelect,
  reminderType: "24h" | "1h" | "starting"
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const results: string[] = [];
  let overallSuccess = true;

  console.log(
    `[Reminder Scheduler] Firing ${reminderType} reminder for webinar ${schedule.webinarId}`
  );

  // 1. Send Calendar Event Updates (if enabled)
  if (schedule.sendCalendarUpdates) {
    try {
      const joinUrl = schedule.joinUrl
        ? addUtmParams(schedule.joinUrl, reminderType, "calendar_update")
        : undefined;

      const calResult = await sendCalendarReminderUpdates(
        schedule.webinarId,
        reminderType,
        joinUrl
      );

      results.push(
        `Calendar: ${calResult.updated} updated, ${calResult.failed} failed`
      );

      // Log calendar updates to email_send_log
      if (calResult.updated > 0) {
        await db.insert(emailSendLog).values({
          webinarId: schedule.webinarId,
          registrantId: 0,
          recipientEmail: "all_attendees",
          recipientName: "All Calendar Attendees",
          emailType: `reminder_${reminderType}`,
          subject: `Calendar Update: ${reminderType} reminder`,
          channel: "calendar_update",
          status: "sent",
          trackedJoinUrl: joinUrl || null,
        });
      }

      if (calResult.failed > 0) {
        overallSuccess = false;
      }
    } catch (err: any) {
      results.push(`Calendar: Error - ${err.message}`);
      overallSuccess = false;
    }
  }

  // 2. Send Gmail Reminder Emails (if enabled)
  if (schedule.sendGmailReminders) {
    try {
      // Get all registrants with calendar invites for this webinar
      const registrants = await db
        .select()
        .from(webinarRegistrants)
        .where(
          and(
            eq(webinarRegistrants.webinarId, schedule.webinarId),
            eq(webinarRegistrants.calendarInviteSent, 1)
          )
        );

      let gmailSent = 0;
      let gmailFailed = 0;

      const eventDate = schedule.webinarStartTime
        ? new Date(schedule.webinarStartTime).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })
        : undefined;

      for (const reg of registrants) {
        if (!reg.email) continue;

        // Rate limit: 500ms between sends
        if (gmailSent + gmailFailed > 0) {
          await new Promise((r) => setTimeout(r, 500));
        }

        const joinUrl = schedule.joinUrl
          ? addUtmParams(schedule.joinUrl, reminderType, "gmail")
          : "";

        const emailParams = buildWebinarReminderEmail(
          reg.name || "there",
          reg.email,
          reminderType,
          schedule.webinarName || "Live Masterclass",
          joinUrl,
          eventDate
        );

        const emailResult = await sendReminderEmail(emailParams);

        // Log to email_send_log
        await db.insert(emailSendLog).values({
          webinarId: schedule.webinarId,
          registrantId: reg.id,
          recipientEmail: reg.email,
          recipientName: reg.name,
          emailType: `reminder_${reminderType}`,
          subject: emailParams.subject,
          channel: "gmail",
          status: emailResult.success ? "sent" : "failed",
          messageId: emailResult.messageId || null,
          errorMessage: emailResult.error || null,
          trackedJoinUrl: joinUrl || null,
        });

        if (emailResult.success) {
          gmailSent++;
        } else {
          gmailFailed++;
        }
      }

      results.push(`Gmail: ${gmailSent} sent, ${gmailFailed} failed out of ${registrants.length} registrants`);
      if (gmailFailed > 0) overallSuccess = false;
    } catch (err: any) {
      results.push(`Gmail: Error - ${err.message}`);
      overallSuccess = false;
    }
  }

  // 3. Update the schedule status
  const statusField =
    reminderType === "24h"
      ? "reminder24h"
      : reminderType === "1h"
      ? "reminder1h"
      : "reminderStarting";

  const timeField =
    reminderType === "24h"
      ? "reminder24hAt"
      : reminderType === "1h"
      ? "reminder1hAt"
      : "reminderStartingAt";

  const resultField =
    reminderType === "24h"
      ? "reminder24hResult"
      : reminderType === "1h"
      ? "reminder1hResult"
      : "reminderStartingResult";

  await db
    .update(webinarReminderSchedule)
    .set({
      [statusField]: overallSuccess ? "sent" : "failed",
      [timeField]: now,
      [resultField]: results.join(" | "),
    })
    .where(eq(webinarReminderSchedule.id, schedule.id));

  console.log(
    `[Reminder Scheduler] ${reminderType} complete for ${schedule.webinarId}: ${results.join(" | ")}`
  );
}
