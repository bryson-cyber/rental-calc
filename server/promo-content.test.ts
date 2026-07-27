/**
 * Promo drip content integrity tests.
 *
 * The affiliate-arbitrage campaign content was generated from the source
 * campaign markdown; these tests pin the invariants that make the sends safe
 * and cheap: correct step counts/offsets, GSM-7-safe SMS bodies (2-segment
 * billing), FTC disclosures on every email, STOP language on the opening
 * text, and the destination link everywhere.
 */
import { describe, expect, it } from "vitest";
import {
  AFFILIATE_ARBITRAGE_LIST_ID,
  AFFILIATE_ARBITRAGE_STEPS,
  toGsm7Safe,
} from "./promo/promo-content";

const emails = AFFILIATE_ARBITRAGE_STEPS.filter((s) => s.channel === "email");
const texts = AFFILIATE_ARBITRAGE_STEPS.filter((s) => s.channel === "sms");

describe("affiliate arbitrage campaign content", () => {
  it("has 12 emails and 13 texts (25 steps)", () => {
    expect(emails).toHaveLength(12);
    expect(texts).toHaveLength(13);
    expect(AFFILIATE_ARBITRAGE_STEPS).toHaveLength(25);
  });

  it("targets the HubSpot SQL list", () => {
    expect(AFFILIATE_ARBITRAGE_LIST_ID).toBe("3756");
  });

  it("uses the exact day offsets from the campaign plan", () => {
    expect(emails.map((e) => e.dayOffset)).toEqual([0, 1, 3, 5, 7, 9, 11, 12, 13, 14, 15, 16]);
    expect(texts.map((t) => t.dayOffset)).toEqual([0, 1, 3, 5, 7, 9, 11, 12, 13, 14, 15, 16, 18]);
  });

  it("has unique step keys and strictly increasing sequence order", () => {
    const keys = AFFILIATE_ARBITRAGE_STEPS.map((s) => s.stepKey);
    expect(new Set(keys).size).toBe(keys.length);
    const orders = AFFILIATE_ARBITRAGE_STEPS.map((s) => s.sequenceOrder);
    expect(orders).toEqual([...Array(25)].map((_, i) => i + 1));
  });

  it("every step drives to 0percentfunded.com", () => {
    for (const step of AFFILIATE_ARBITRAGE_STEPS) {
      expect(step.body, step.stepKey).toContain("https://0percentfunded.com/");
    }
  });

  it("every email has a subject and the FTC affiliate disclosure", () => {
    for (const email of emails) {
      expect(email.subject, email.stepKey).toBeTruthy();
      expect(email.body, email.stepKey).toContain("Disclosure:");
      expect(email.body, email.stepKey).toContain("compensated");
    }
  });

  it("emails contain no markdown remnants (they render as plain text)", () => {
    for (const email of emails) {
      expect(email.body, email.stepKey).not.toMatch(/\*\*/);
      expect(email.body, email.stepKey).not.toMatch(/\]\(http/);
    }
  });

  it("the day-0 text identifies the sender and keeps the STOP opt-out line", () => {
    const day0 = texts.find((t) => t.dayOffset === 0)!;
    expect(day0.body).toContain("Inayah");
    expect(day0.body).toMatch(/reply stop to opt out/i);
  });

  it("all SMS bodies are GSM-7 stable (no Unicode segment billing)", () => {
    for (const text of texts) {
      expect(toGsm7Safe(text.body), text.stepKey).toBe(text.body);
      // Belt-and-braces: no common Unicode offenders survive
      expect(text.body, text.stepKey).not.toMatch(/[—–‘’“”…]/);
    }
  });

  it("SMS bodies stay within 2 segments (306 GSM-7 chars)", () => {
    for (const text of texts) {
      expect(text.body.length, `${text.stepKey} is ${text.body.length} chars`).toBeLessThanOrEqual(306);
    }
  });

  it("emails send at 9:00 AM ET and texts at 2:00 PM ET (8:00 AM Hawaii — TCPA-safe in every US zone)", () => {
    for (const email of emails) expect(email.sendTimeEt).toBe("09:00");
    for (const text of texts) expect(text.sendTimeEt).toBe("14:00");
  });

  it("exports the CAN-SPAM postal address used in email footers", async () => {
    const { PROMO_POSTAL_ADDRESS } = await import("./promo/promo-content");
    expect(PROMO_POSTAL_ADDRESS.length).toBeGreaterThan(10);
  });
});
