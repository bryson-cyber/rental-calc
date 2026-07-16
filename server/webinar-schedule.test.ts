import { describe, expect, it } from "vitest";
import { getWebinarPhase, parseWebinarScheduleDate } from "@shared/webinar-schedule";
import { plainTextToEmailHtml } from "./hubspot-smtp";

describe("parseWebinarScheduleDate", () => {
  it("treats naive WebinarJam strings as Eastern wall-clock (EDT, summer)", () => {
    // Jul 15 2026, 7:00 PM EDT (UTC-4) → 23:00 UTC. This exact string hid the
    // no-show list all evening during the Jul 15 live webinar.
    const d = parseWebinarScheduleDate("2026-07-15 19:00");
    expect(d?.toISOString()).toBe("2026-07-15T23:00:00.000Z");
  });

  it("handles EST (winter) offset", () => {
    // Jan 15 2026, 7:00 PM EST (UTC-5) → 00:00 UTC next day
    const d = parseWebinarScheduleDate("2026-01-15 19:00");
    expect(d?.toISOString()).toBe("2026-01-16T00:00:00.000Z");
  });

  it("accepts seconds and T separators in naive strings", () => {
    const d = parseWebinarScheduleDate("2026-07-15T19:00:30");
    expect(d?.toISOString()).toBe("2026-07-15T23:00:30.000Z");
  });

  it("passes through explicit-zone ISO strings unchanged", () => {
    const d = parseWebinarScheduleDate("2026-07-15T23:00:00.000Z");
    expect(d?.toISOString()).toBe("2026-07-15T23:00:00.000Z");
    const offset = parseWebinarScheduleDate("2026-07-15T19:00:00-04:00");
    expect(offset?.toISOString()).toBe("2026-07-15T23:00:00.000Z");
  });

  it("treats zone-less human formats as Eastern wall-clock too", () => {
    // Legacy WebinarJam display format — must not fall back to browser-local
    const d = parseWebinarScheduleDate("February 25, 2026 8:00 PM");
    expect(d?.toISOString()).toBe("2026-02-26T01:00:00.000Z"); // 8 PM EST = 01:00 UTC
  });

  it("accepts single-digit month/day/hour in naive strings", () => {
    const d = parseWebinarScheduleDate("2026-7-15 9:00");
    expect(d?.toISOString()).toBe("2026-07-15T13:00:00.000Z"); // 9 AM EDT
  });

  it("returns null for missing or garbage input", () => {
    expect(parseWebinarScheduleDate(null)).toBeNull();
    expect(parseWebinarScheduleDate(undefined)).toBeNull();
    expect(parseWebinarScheduleDate("")).toBeNull();
    expect(parseWebinarScheduleDate("not a date")).toBeNull();
  });
});

describe("getWebinarPhase", () => {
  const schedule = "2026-07-15 19:00"; // 23:00 UTC start

  it("is upcoming before start", () => {
    expect(getWebinarPhase(schedule, new Date("2026-07-15T22:00:00Z")).phase).toBe("upcoming");
  });

  it("is live during the webinar — including 7:05 PM ET, when the admin was watching", () => {
    expect(getWebinarPhase(schedule, new Date("2026-07-15T23:05:00Z")).phase).toBe("live");
    // 3h default window — these webinars regularly run past 2 hours
    expect(getWebinarPhase(schedule, new Date("2026-07-16T01:59:00Z")).phase).toBe("live");
  });

  it("is ended after start + duration", () => {
    expect(getWebinarPhase(schedule, new Date("2026-07-16T02:00:00Z")).phase).toBe("ended");
  });

  it("respects a custom duration", () => {
    const oneHour = 60 * 60 * 1000;
    expect(getWebinarPhase(schedule, new Date("2026-07-16T00:30:00Z"), oneHour).phase).toBe("ended");
  });

  it("is unknown without a date", () => {
    const { phase, start } = getWebinarPhase(null);
    expect(phase).toBe("unknown");
    expect(start).toBeNull();
  });
});

describe("plainTextToEmailHtml", () => {
  it("escapes HTML, splits paragraphs, and preserves single line breaks", () => {
    const html = plainTextToEmailHtml("Hi <there> & welcome\nsecond line\n\nnew paragraph");
    expect(html).toContain("Hi &lt;there&gt; &amp; welcome<br>second line");
    expect((html.match(/<p /g) || []).length).toBe(2);
    expect(html).not.toContain("<there>");
  });

  it("links bare URLs", () => {
    const html = plainTextToEmailHtml("Join here: https://example.com/live?x=1");
    expect(html).toContain('<a href="https://example.com/live?x=1"');
  });

  it("does not glue surrounding punctuation or escaped entities onto the URL", () => {
    const html = plainTextToEmailHtml("Join <https://example.com/live>, now.");
    expect(html).toContain('<a href="https://example.com/live"');
    expect(html).not.toContain("live&gt;");
    // trailing comma stays outside the link
    expect(html).toContain("</a>");

    const html2 = plainTextToEmailHtml("Go to https://example.com/live. Thanks!");
    expect(html2).toContain('<a href="https://example.com/live"');
    expect(html2).not.toContain('href="https://example.com/live."');
  });

  it("escapes quotes so URLs cannot break out of the href attribute", () => {
    const html = plainTextToEmailHtml('See https://example.com/x?q="onmouseover=alert(1)');
    expect(html).not.toContain('q="onmouseover');
    expect(html).toContain("&quot;");
  });
});
