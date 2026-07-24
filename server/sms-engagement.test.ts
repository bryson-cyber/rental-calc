import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

import { invokeLLM } from "./_core/llm";
import { buildDealReplyMessage, classifyReply, sendEngagementQuestions } from "./sms-engagement";
import { computeLeadPriority } from "./lead-priority";
import type { RegistrantPersonalization } from "./webinar-personalization";
import { webinarRegistrants, webinarSmsSettings } from "../drizzle/schema";

const mockLLM = invokeLLM as unknown as ReturnType<typeof vi.fn>;

const basePayload: RegistrantPersonalization = {
  version: 5,
  source: "engagement",
  city: "San Diego",
  state: "CA",
  deal: {
    label: "a 2-bedroom in San Diego",
    bedrooms: 2,
    monthlyRent: 1850,
    monthlyRevenue: 4100,
    monthlyProfit: 2100,
    sourceUrl: "https://www.zillow.com/homedetails/x_zpid/",
  },
  dealCount: 1,
  dealShortLink: "https://coachinayahturnkeytool.com/l/abc123",
  dealReportShareId: "rep123",
  dealZillowUrl: "https://www.zillow.com/homedetails/x_zpid/",
  toolLink: "https://coachinayahturnkeytool.com",
  computedAt: "2026-07-23T00:00:00.000Z",
};

beforeEach(() => vi.clearAllMocks());

describe("buildDealReplyMessage", () => {
  it("sends the deal numbers with the report link and class tie-in", () => {
    const msg = buildDealReplyMessage(basePayload);
    expect(msg).toContain("San Diego");
    expect(msg).toContain("$1,850/mo");
    expect(msg).toContain("$4,100/mo");
    expect(msg).toContain("https://coachinayahturnkeytool.com/l/abc123");
    expect(msg).toContain("masterclass");
    expect(msg).not.toMatch(/%[A-Z_]+%|\[IF_/);
  });

  it("promises honestly when no claimable deal exists yet", () => {
    const noDeal = { ...basePayload, deal: undefined, dealCount: 0, dealShortLink: undefined };
    const msg = buildDealReplyMessage(noDeal);
    expect(msg).toContain("San Diego");
    expect(msg).not.toContain("$");
    expect(msg).toContain("masterclass");
  });
});

describe("computeLeadPriority", () => {
  it("ranks the ladder: qualified + engaged = hot, either = warm, neither = standard", () => {
    expect(computeLeadPriority({ qualified: true }, "yes")).toBe("hot");
    expect(computeLeadPriority({ qualified: true }, "city")).toBe("hot");
    expect(computeLeadPriority({ qualified: true }, "no")).toBe("warm");
    expect(computeLeadPriority({ qualified: true }, undefined)).toBe("warm");
    expect(computeLeadPriority(null, "yes")).toBe("warm");
    expect(computeLeadPriority(null, "no")).toBe("standard");
    expect(computeLeadPriority(undefined, undefined)).toBe("standard");
  });
});

describe("classifyReply", () => {
  const llmAnswer = (obj: unknown) => ({
    choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(obj) }, finish_reason: "stop" }],
  });

  it("classifies plain YES/NO/STOP deterministically — no LLM involved", async () => {
    mockLLM.mockRejectedValue(new Error("LLM must not be called"));
    expect((await classifyReply("YES")).intent).toBe("yes");
    expect((await classifyReply("Yes!!")).intent).toBe("yes");
    expect((await classifyReply("yeah 👍")).intent).toBe("yes");
    expect((await classifyReply("No thanks")).intent).toBe("no");
    expect((await classifyReply("STOP")).intent).toBe("stop");
    expect(mockLLM).not.toHaveBeenCalled();
  });

  it("parses a city reply", async () => {
    mockLLM.mockResolvedValue(llmAnswer({ intent: "city", city: "Phoenix", state: "AZ" }));
    const parsed = await classifyReply("what about pheonix az?");
    expect(parsed).toEqual({ intent: "city", city: "Phoenix", state: "AZ" });
  });

  it("handles array-style LLM content and prose-wrapped JSON", async () => {
    mockLLM.mockResolvedValue({
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: [{ type: "text", text: 'Here is the result: {"intent": "city", "city": "Denver", "state": "CO"}' }],
        },
        finish_reason: "stop",
      }],
    });
    const parsed = await classifyReply("thinking about denver maybe");
    expect(parsed).toEqual({ intent: "city", city: "Denver", state: "CO" });
  });

  it("falls back to 'other' on malformed LLM output or errors", async () => {
    mockLLM.mockResolvedValue(llmAnswer({ intent: "banana" }));
    expect((await classifyReply("hm")).intent).toBe("other");

    mockLLM.mockRejectedValue(new Error("llm down"));
    expect((await classifyReply("hm")).intent).toBe("other");
  });
});

// ─── One question per person, not per row ────────────────────────────────────

function fakeDb(tableRows: Map<object, any[]>) {
  const updates: Array<{ table: object; values: any }> = [];
  const builder = (rows: any[]) => {
    const b: any = {
      where: () => b,
      orderBy: () => b,
      limit: (n: number) => Promise.resolve(rows.slice(0, n)),
      then: (onOk: any, onErr: any) => Promise.resolve(rows).then(onOk, onErr),
    };
    return b;
  };
  const db = {
    select: (_cols?: unknown) => ({ from: (table: object) => builder(tableRows.get(table) ?? []) }),
    update: (table: object) => ({
      set: (values: any) => ({
        where: () => {
          updates.push({ table, values });
          return Promise.resolve([{ affectedRows: 1 }]);
        },
      }),
    }),
  };
  return { db, updates };
}

describe("sendEngagementQuestions — one question per person", () => {
  it("skips phones already asked on any row and stamps all sibling rows on ask", async () => {
    const past = new Date(Date.now() - 10 * 60 * 1000);
    const rows = [
      // Phone A: three registrant rows (repeat test adds); ONE was already
      // asked — the person must not be asked again from the un-asked rows
      { id: 1, phone: "702-521-8792", metadata: { tag: "A1", engagement: { askedAt: "2026-07-23T16:00:00.000Z", replies: 0 } }, confirmationSmsAt: past },
      { id: 2, phone: "7025218792", metadata: { tag: "A2" }, confirmationSmsAt: past },
      { id: 3, phone: "+17025218792", metadata: { tag: "A3" }, confirmationSmsAt: past },
      // Phone B: two rows, none asked — ask once, stamp both
      { id: 4, phone: "615-555-0101", metadata: { tag: "B-old" }, confirmationSmsAt: past },
      { id: 5, phone: "6155550101", metadata: { tag: "B-new" }, confirmationSmsAt: past },
    ];
    const { db, updates } = fakeDb(new Map<object, any[]>([
      [webinarSmsSettings as object, []],
      [webinarRegistrants as object, rows],
    ]));

    await sendEngagementQuestions(db as any, "wb-1");

    const touched = updates.map((u) => (u.values.metadata as any).tag);
    expect(touched).not.toContain("A1");
    expect(touched).not.toContain("A2");
    expect(touched).not.toContain("A3");
    expect(touched.sort()).toEqual(["B-new", "B-old"]);
    for (const u of updates) {
      expect((u.values.metadata as any).engagement.askedAt).toBeTruthy();
    }
  });
});
