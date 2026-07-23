import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

import { invokeLLM } from "./_core/llm";
import { buildDealReplyMessage, classifyReply } from "./sms-engagement";
import { computeLeadPriority } from "./lead-priority";
import type { RegistrantPersonalization } from "./webinar-personalization";

const mockLLM = invokeLLM as unknown as ReturnType<typeof vi.fn>;

const basePayload: RegistrantPersonalization = {
  version: 4,
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
