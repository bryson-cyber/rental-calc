/**
 * Promo Drip — audience snapshot builder.
 *
 * Pulls every member of the campaign's HubSpot list, applies exclusions
 * (upcoming-webinar registrants, contacts with no usable email or phone,
 * duplicate emails), and freezes the result into promo_drip_recipients.
 * The snapshot is what gets messaged for the whole drip — HubSpot list churn
 * after launch doesn't change the audience; only unsubscribes/exclusions do.
 *
 * Only allowed while the campaign is in draft. Rebuilding replaces the
 * previous snapshot.
 */

import { eq, isNotNull } from "drizzle-orm";
import { promoDripCampaigns, promoDripRecipients, type InsertPromoDripRecipient } from "../../drizzle/schema";
import { batchReadContacts, getListInfo, getListMembershipContactIds } from "../hubspot";
import { buildPromoExclusionSets } from "./promo-webinar-exclusion";
import { chunk, isUsCanadaPromoPhone, normalizeEmail, normalizePromoPhone } from "./promo-util";

export interface SnapshotProgress {
  running: boolean;
  campaignId: number | null;
  stage: string;
  processed: number;
  total: number;
  error: string | null;
}

/** In-memory progress, polled by the admin UI while a snapshot builds. */
export const snapshotProgress: SnapshotProgress = {
  running: false,
  campaignId: null,
  stage: "idle",
  processed: 0,
  total: 0,
  error: null,
};

export interface SnapshotResult {
  snapshotTotal: number;
  eligibleCount: number;
  excludedWebinarCount: number;
  excludedNoContactCount: number;
  excludedDuplicateCount: number;
  smsEligibleCount: number;
  upcomingWebinarIds: string[];
}

/**
 * Pick the SMS-able phone for a contact. TCPA: only the number the lead
 * themselves submitted (the `phone` property, written by their LeadFi
 * qualification) — NEVER vendor-appended numbers like data_perfection__phones,
 * which carry no texting consent.
 */
export function pickPromoPhone(props: Record<string, string | undefined>): { phone: string; valid: boolean } {
  const raw = (props.phone || "").trim();
  if (!raw) return { phone: "", valid: false };
  if (isUsCanadaPromoPhone(raw)) {
    const normalized = normalizePromoPhone(raw);
    if (normalized.length === 10) return { phone: normalized, valid: true };
  }
  return { phone: normalizePromoPhone(raw), valid: false };
}

export async function buildAudienceSnapshot(db: any, campaignId: number): Promise<SnapshotResult> {
  if (snapshotProgress.running) {
    throw new Error("A snapshot build is already in progress");
  }

  const [campaign] = await db.select().from(promoDripCampaigns).where(eq(promoDripCampaigns.id, campaignId));
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
  if (campaign.status !== "draft") {
    throw new Error(`Snapshot can only be built while the campaign is in draft (current: ${campaign.status})`);
  }

  snapshotProgress.running = true;
  snapshotProgress.campaignId = campaignId;
  snapshotProgress.error = null;
  snapshotProgress.processed = 0;
  snapshotProgress.total = 0;

  try {
    // 0. Invalidate the previous snapshot FIRST: if this rebuild crashes
    // partway, launchCampaign must see "no snapshot" rather than stale
    // counters over a partial audience.
    await db
      .update(promoDripCampaigns)
      .set({ snapshotAt: null, snapshotTotal: 0, eligibleCount: 0, excludedWebinarCount: 0, smsEligibleCount: 0 })
      .where(eq(promoDripCampaigns.id, campaignId));

    // 0b. Carry unsubscribes forward: emails that unsubscribed from ANY prior
    // promo campaign stay suppressed in this one.
    snapshotProgress.stage = "prior-unsubscribes";
    const priorUnsubRows: Array<{ email: string | null }> = await db
      .selectDistinct({ email: promoDripRecipients.email })
      .from(promoDripRecipients)
      .where(isNotNull(promoDripRecipients.unsubscribedAt));
    const priorUnsubEmails = new Set(priorUnsubRows.map((r) => normalizeEmail(r.email)).filter((e): e is string => !!e));

    // 1. Webinar exclusion sets — fail hard if WebinarJam can't be resolved.
    snapshotProgress.stage = "webinar-exclusions";
    const sets = await buildPromoExclusionSets(db);
    if (!sets.ok) throw new Error(sets.error);

    // 2. List membership.
    snapshotProgress.stage = "hubspot-list";
    const contactIds = await getListMembershipContactIds(campaign.hubspotListId);
    snapshotProgress.total = contactIds.length;

    // 3. Contact details, 100 at a time (loop here so progress stays live).
    snapshotProgress.stage = "hubspot-contacts";
    const contacts: Array<{ id: string; properties: Record<string, string | undefined> }> = [];
    for (const ids of chunk(contactIds, 100)) {
      const batch = await batchReadContacts(ids);
      contacts.push(...batch);
      snapshotProgress.processed = contacts.length;
    }

    // 4. Build snapshot rows.
    snapshotProgress.stage = "building-rows";
    const seenEmails = new Set<string>();
    const now = new Date();
    let excludedWebinarCount = 0;
    let excludedNoContactCount = 0;
    let excludedDuplicateCount = 0;
    let eligibleCount = 0;
    let smsEligibleCount = 0;

    const rows: InsertPromoDripRecipient[] = contacts.map((c) => {
      const email = normalizeEmail(c.properties.email);
      const { phone, valid } = pickPromoPhone(c.properties);
      const firstName = (c.properties.firstname || "").trim() || null;

      let excludedReason: string | null = null;
      if (!email && !valid) {
        excludedReason = "no_email_no_phone";
      } else if (email && seenEmails.has(email)) {
        excludedReason = "duplicate_email";
      } else if (email && priorUnsubEmails.has(email)) {
        excludedReason = "previously_unsubscribed";
      } else if ((email && sets.upcomingEmails.has(email)) || (valid && sets.upcomingPhones.has(phone))) {
        excludedReason = "upcoming_webinar";
      }
      if (email) seenEmails.add(email);

      if (excludedReason === "upcoming_webinar") excludedWebinarCount++;
      else if (excludedReason === "no_email_no_phone") excludedNoContactCount++;
      else if (excludedReason === "duplicate_email") excludedDuplicateCount++;
      else {
        if (email) eligibleCount++;
        if (valid && !sets.optedOutPhones.has(phone)) smsEligibleCount++;
      }

      return {
        campaignId,
        hubspotContactId: c.id,
        email,
        firstName,
        phone,
        phoneValid: valid ? 1 : 0,
        excludedAt: excludedReason ? now : null,
        excludedReason,
      };
    });

    // 5. Replace any previous snapshot.
    snapshotProgress.stage = "writing";
    await db.delete(promoDripRecipients).where(eq(promoDripRecipients.campaignId, campaignId));
    for (const batch of chunk(rows, 500)) {
      if (batch.length > 0) await db.insert(promoDripRecipients).values(batch);
    }

    // 6. Update campaign counters (+ refresh list name, non-fatal).
    let listName = campaign.hubspotListName;
    try {
      const info = await getListInfo(campaign.hubspotListId);
      if (info.name) listName = info.name;
    } catch {
      // keep the stored name
    }
    await db
      .update(promoDripCampaigns)
      .set({
        snapshotAt: now,
        snapshotTotal: contacts.length,
        eligibleCount,
        excludedWebinarCount,
        smsEligibleCount,
        hubspotListName: listName,
      })
      .where(eq(promoDripCampaigns.id, campaignId));

    snapshotProgress.stage = "done";
    return {
      snapshotTotal: contacts.length,
      eligibleCount,
      excludedWebinarCount,
      excludedNoContactCount,
      excludedDuplicateCount,
      smsEligibleCount,
      upcomingWebinarIds: sets.upcomingWebinarIds,
    };
  } catch (err: any) {
    snapshotProgress.error = err?.message || String(err);
    throw err;
  } finally {
    snapshotProgress.running = false;
  }
}
