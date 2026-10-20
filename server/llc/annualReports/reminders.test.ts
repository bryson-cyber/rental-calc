import { describe, expect, it, vi } from "vitest";
import { annualReportReminderEmail } from "./copy";
import { reminderStageFor, runAnnualReportReminders, type ReminderDeps } from "./reminders";
import { filing, makeDeps } from "./testFakes";

// Wednesday 2026-12-30, 11 AM Pacific.
const NOON = new Date("2026-12-30T19:00:00Z");

function setup(options: { due?: string; status?: string; eligible?: boolean; now?: Date; sendOk?: boolean } = {}) {
  const t = makeDeps({ facts: filing({ eligible: options.eligible ?? true }), now: options.now ?? NOON });
  t.memory.compliance.set(42, {
    registrationId: 42,
    userId: 7,
    state: "WY",
    nextDueDate: options.due ?? "2027-01-29",
    lastFiledDate: null,
    status: options.status ?? "UPCOMING",
    filingRequired: true,
    quotePriceCents: 6000,
    quoteIsMinimum: false,
    syncedAt: NOON,
    lastError: null,
  });
  const claimed = new Set<string>();
  const sent: Array<{ to: string; subject: string; html: string; text: string }> = [];
  const deps: ReminderDeps = {
    service: t.deps,
    claims: {
      claim: vi.fn(async (key) => {
        const id = `${key.registrationId}:${key.type}`;
        if (claimed.has(id)) return false;
        claimed.add(id);
        return true;
      }),
      release: vi.fn(async (key) => {
        claimed.delete(`${key.registrationId}:${key.type}`);
      }),
    },
    recipient: async () => ({ email: "amina@example.com", firstName: "Amina" }),
    portalUrl: (id) => `https://coachinayahturnkeytool.com/llc/status/${id}`,
    email: {
      send: vi.fn(async (to, content) => {
        sent.push({ to, ...content });
        return options.sendOk ?? true;
      }),
    },
  };
  return { t, deps, claimed, sent };
}

describe("reminder stages", () => {
  it("one stage at a time, the most urgent that applies", () => {
    const today = "2026-12-30";
    expect(reminderStageFor("2027-03-01", today)).toBeNull(); // 61 days
    expect(reminderStageFor("2027-02-28", today)).toBe("60");
    expect(reminderStageFor("2027-01-30", today)).toBe("60"); // 31 days
    expect(reminderStageFor("2027-01-29", today)).toBe("30");
    expect(reminderStageFor("2027-01-07", today)).toBe("30"); // 8 days
    expect(reminderStageFor("2027-01-06", today)).toBe("7");
    expect(reminderStageFor("2026-12-30", today)).toBe("7"); // due today
    expect(reminderStageFor("2026-12-29", today)).toBe("overdue");
    expect(reminderStageFor("2027-01-29", today, "OVERDUE")).toBe("overdue");
  });
});

describe("annual report reminders", () => {
  it("emails once per filing, due date and stage, to the account email, with the filing link", async () => {
    const s = setup();
    const first = await runAnnualReportReminders(s.deps);
    expect(first).toMatchObject({ emailed: 1, failed: 0 });
    expect([...s.claimed]).toEqual(["42:annual_report_2027-01-29_30"]);
    expect(s.sent[0].to).toBe("amina@example.com");
    expect(s.sent[0].text).toContain("https://coachinayahturnkeytool.com/llc/status/42?file=annual-report");
    expect(s.sent[0].html).toContain("File my annual report");
    expect(s.sent[0].subject).toBe("30 days until your annual report is due");

    const again = await runAnnualReportReminders(s.deps);
    expect(again).toMatchObject({ emailed: 0, skipped: { email_already_sent: 1 } });

    // The 7-day stage is its own claim.
    s.t.setNow(new Date("2027-01-23T19:00:00Z"));
    expect(await runAnnualReportReminders(s.deps)).toMatchObject({ emailed: 1 });
    expect(s.claimed.has("42:annual_report_2027-01-29_7")).toBe(true);
  });

  it("overdue sends once, with its own words", async () => {
    const s = setup({ due: "2026-12-01", status: "OVERDUE" });
    await runAnnualReportReminders(s.deps);
    await runAnnualReportReminders(s.deps);
    expect(s.sent).toHaveLength(1);
    expect(s.sent[0].subject).toBe("Your LLC's annual report is past due");
    expect(s.sent[0].text).toContain("was due December 1, 2026");
  });

  it("nothing more than 60 days out", async () => {
    const s = setup({ due: "2027-04-30" });
    expect(await runAnnualReportReminders(s.deps)).toMatchObject({ considered: 0, emailed: 0 });
  });

  it("stops once that cycle's report is paid, handed over or filed", async () => {
    const s = setup();
    const row = await s.t.memory.store.upsertReport({ registrationId: 42, userId: 7, fiscalYear: 2027 }, { status: "FILLED", priceInCents: 6000 });
    // Saved answers alone still get reminders.
    expect((await runAnnualReportReminders(s.deps)).emailed).toBe(1);
    s.t.setNow(new Date("2027-01-23T19:00:00Z"));
    await s.t.memory.store.updateReport(row.id, { paidAt: new Date(), paidCents: 6000 });
    expect(await runAnnualReportReminders(s.deps)).toMatchObject({ emailed: 0, skipped: { already_filing: 1 } });
  });

  it("skips test and demo filings", async () => {
    const s = setup({ eligible: false });
    expect(await runAnnualReportReminders(s.deps)).toMatchObject({ emailed: 0, skipped: { not_eligible: 1 } });
  });

  it("a failed send lets the claim go so a later pass retries", async () => {
    const s = setup({ sendOk: false });
    expect(await runAnnualReportReminders(s.deps)).toMatchObject({ emailed: 0, failed: 1 });
    expect(s.claimed.size).toBe(0);
  });

  it("email only: the reminder deps carry no text channel", () => {
    const s = setup();
    expect(Object.keys(s.deps)).not.toContain("text");
  });
});

describe("reminder words", () => {
  it("are branded, white-label, dash-free, and carry the filing link as the button", () => {
    for (const stage of ["60", "30", "7", "overdue"] as const) {
      const input = { stage, firstName: "Amina", companyName: "Amina Studio LLC", stateName: "Wyoming", dueWords: "March 1, 2027", daysLeft: 30, fileUrl: "https://coachinayahturnkeytool.com/llc/status/42?file=annual-report", quote: { priceCents: 6000, isMinimum: true } };
      const email = annualReportReminderEmail(input);
      for (const words of [email.subject, email.text]) {
        expect(words).not.toMatch(/doola|whop/i);
        expect(words).not.toMatch(/[—–]/);
      }
      expect(email.html).not.toMatch(/doola|whop/i);
      expect(email.html).toContain(">File my annual report</a>");
      expect(email.html).toContain(`href="${input.fileUrl}"`);
      expect(email.text).toContain("Coach Inayah");
      expect(email.text).toContain("starts at $60");
    }
  });

  it("escapes what she typed into her company name", () => {
    const email = annualReportReminderEmail({ stage: "60", firstName: "<b>A</b>", companyName: "<script>x</script> LLC", stateName: "Wyoming", dueWords: "March 1, 2027", daysLeft: 60, fileUrl: "https://coachinayahturnkeytool.com/llc/status/42?file=annual-report", quote: null });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>A</b>");
  });
});
