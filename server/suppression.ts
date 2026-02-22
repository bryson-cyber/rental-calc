/**
 * Suppression List Helper
 * 
 * Provides a centralized function to check if a phone number is suppressed
 * and should NOT receive SMS blasts. Used by all blast functions.
 * 
 * Suppression tags:
 *   - 'buyer': NEVER text (already purchased the program)
 *   - 'past_attendee': Skip weekly re-engagement reminders (already attended)
 *   - 'past_noshow': Keep re-inviting until they attend (NOT suppressed from reminders)
 *   - 'dnc': Do Not Contact — manual suppression, NEVER text
 */

import { getDb } from './db';
import { suppressionContacts } from '../drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Blast types that determine which suppression tags apply.
 * 
 * - 'reminder': Pre-webinar reminders (noon, 2hr, 1hr, 15min, live now)
 *   Suppressed: buyer, past_attendee, dnc
 *   NOT suppressed: past_noshow (we want to re-invite them!)
 * 
 * - 'no_show': Post-webinar no-show blast
 *   Suppressed: buyer, dnc
 *   NOT suppressed: past_noshow (that's who we're targeting)
 *   Note: past_attendee shouldn't be in the no-show list anyway
 * 
 * - 'attendee_cta': Post-webinar CTA for attendees
 *   Suppressed: buyer, dnc
 *   NOT suppressed: past_attendee (they attended today, we want to send CTA)
 * 
 * - 'all': Suppress for all tags (buyer + dnc at minimum)
 *   Used for custom blasts or manual sends
 */
export type BlastType = 'reminder' | 'no_show' | 'attendee_cta' | 'all';

/**
 * Get the set of suppression tags that apply for a given blast type.
 */
function getSuppressionTagsForBlast(blastType: BlastType): string[] {
  switch (blastType) {
    case 'reminder':
      // Buyers and DNC never get texted; past attendees skip reminders
      return ['buyer', 'past_attendee', 'dnc'];
    case 'no_show':
      // Buyers and DNC never get texted
      return ['buyer', 'dnc'];
    case 'attendee_cta':
      // Buyers and DNC never get texted
      return ['buyer', 'dnc'];
    case 'all':
      // Suppress all except past_noshow (they should keep getting invited)
      return ['buyer', 'past_attendee', 'dnc'];
    default:
      return ['buyer', 'dnc'];
  }
}

/**
 * Check if a single phone number is suppressed for a given blast type.
 * 
 * @param phone - Phone number (any format, will be normalized)
 * @param blastType - Type of blast to check suppression for
 * @returns true if the phone should be SKIPPED (suppressed)
 */
export async function isPhoneSuppressed(phone: string, blastType: BlastType): Promise<boolean> {
  const db = await getDb();
  if (!db) return false; // If DB is unavailable, don't suppress (fail open for sending)

  const normalized = normalizePhone(phone);
  if (!normalized) return false;

  const tags = getSuppressionTagsForBlast(blastType);

  const rows = await db
    .select({ id: suppressionContacts.id })
    .from(suppressionContacts)
    .where(
      and(
        eq(suppressionContacts.phone, normalized),
        inArray(suppressionContacts.tag, tags as any)
      )
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Batch check which phone numbers from a list are suppressed.
 * More efficient than checking one by one — does a single DB query.
 * 
 * @param phones - Array of phone numbers (any format)
 * @param blastType - Type of blast to check suppression for
 * @returns Set of normalized phone numbers that ARE suppressed (should be skipped)
 */
export async function getSuppressedPhones(phones: string[], blastType: BlastType): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();
  if (phones.length === 0) return new Set();

  const tags = getSuppressionTagsForBlast(blastType);

  // Normalize all phones
  const normalizedPhones = phones
    .map(p => normalizePhone(p))
    .filter((p): p is string => p !== null);

  if (normalizedPhones.length === 0) return new Set();

  // Query in batches of 500 to avoid MySQL IN clause limits
  const suppressedSet = new Set<string>();
  const batchSize = 500;

  for (let i = 0; i < normalizedPhones.length; i += batchSize) {
    const batch = normalizedPhones.slice(i, i + batchSize);
    const rows = await db
      .select({ phone: suppressionContacts.phone })
      .from(suppressionContacts)
      .where(
        and(
          inArray(suppressionContacts.phone, batch),
          inArray(suppressionContacts.tag, tags as any)
        )
      );

    for (const row of rows) {
      if (row.phone) suppressedSet.add(row.phone);
    }
  }

  return suppressedSet;
}

/**
 * Normalize a phone number to the format stored in the suppression list.
 * Returns +1XXXXXXXXXX format or null if invalid.
 */
function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 7) return `+1${digits}`;
  return null;
}

/**
 * Auto-tag contacts after a webinar ends.
 * Called after attendance sync to mark attendees and no-shows in the suppression list.
 * 
 * - Attendees get tagged as 'past_attendee' (won't get reminders next week)
 * - No-shows get tagged as 'past_noshow' (WILL get reminders next week)
 * 
 * Uses INSERT IGNORE semantics to avoid duplicates.
 */
export async function autoTagAfterWebinar(scheduleId: number): Promise<{
  attendeesTagged: number;
  noShowsTagged: number;
}> {
  const db = await getDb();
  if (!db) return { attendeesTagged: 0, noShowsTagged: 0 };

  // Import here to avoid circular dependency
  const { webinarRegistrants } = await import('../drizzle/schema');

  // Get all registrants for this schedule
  const registrants = await db
    .select()
    .from(webinarRegistrants)
    .where(eq(webinarRegistrants.scheduleId, scheduleId));

  let attendeesTagged = 0;
  let noShowsTagged = 0;

  for (const reg of registrants) {
    if (!reg.phone) continue;

    const normalized = normalizePhone(reg.phone);
    if (!normalized) continue;

    const tag = reg.attendanceStatus === 'attended' ? 'past_attendee' as const
      : reg.attendanceStatus === 'no_show' ? 'past_noshow' as const
      : null;

    if (!tag) continue; // Skip 'registered' status (webinar hasn't happened yet for them)

    // Check if already tagged
    const [existing] = await db
      .select({ id: suppressionContacts.id })
      .from(suppressionContacts)
      .where(
        and(
          eq(suppressionContacts.phone, normalized),
          eq(suppressionContacts.tag, tag)
        )
      )
      .limit(1);

    if (!existing) {
      try {
        await db.insert(suppressionContacts).values({
          phone: normalized,
          email: reg.email || null,
          firstName: reg.firstName || null,
          lastName: reg.lastName || null,
          tag,
          source: 'webinarjam_sync',
        });

        if (tag === 'past_attendee') attendeesTagged++;
        else noShowsTagged++;
      } catch {
        // Duplicate — skip
      }
    }
  }

  console.log(`[Suppression] Auto-tagged after webinar: ${attendeesTagged} attendees, ${noShowsTagged} no-shows`);
  return { attendeesTagged, noShowsTagged };
}
