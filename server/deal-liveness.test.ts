import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./hasdata-zillow", () => ({ getZillowPropertyDetails: vi.fn() }));
vi.mock("./webinar-personalization", () => ({ computePersonalizationForEmail: vi.fn() }));

import { getZillowPropertyDetails } from "./hasdata-zillow";
import { computePersonalizationForEmail } from "./webinar-personalization";
import { _resetLivenessCacheForTests, verifyDealListing } from "./deal-liveness";
import { newsletterDeals, webinarRegistrants } from "../drizzle/schema";

const mockDetails = getZillowPropertyDetails as unknown as ReturnType<typeof vi.fn>;
const mockCompute = computePersonalizationForEmail as unknown as ReturnType<typeof vi.fn>;

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

const URL = "https://www.zillow.com/homedetails/3511-Desert-Cliff-St-UNIT-103_zpid/";

beforeEach(() => {
  vi.clearAllMocks();
  _resetLivenessCacheForTests();
});

describe("verifyDealListing", () => {
  it("confirms a live rental and caches it — one API call for repeat checks", async () => {
    mockDetails.mockResolvedValue({ success: true, data: { priceType: "rent", homeStatus: "FOR_RENT" } });
    const { db, updates } = fakeDb(new Map());

    expect(await verifyDealListing(db as any, { sourceUrl: URL, address: "x" })).toBe("live");
    expect(await verifyDealListing(db as any, { sourceUrl: URL, address: "x" })).toBe("live");
    expect(mockDetails).toHaveBeenCalledTimes(1);
    expect(updates).toHaveLength(0);
  });

  it("retires an off-market listing and refreshes payloads still quoting it", async () => {
    mockDetails.mockResolvedValue({ success: true, data: { priceType: "unknown", homeStatus: "OFF_MARKET" } });
    const freshPayload = { version: 5, city: "Las Vegas", state: "NV", dealCount: 1 };
    mockCompute.mockResolvedValue(freshPayload);
    const { db, updates } = fakeDb(new Map<object, any[]>([
      [webinarRegistrants as object, [
        { id: 9, email: "lead@example.com", metadata: { personalization: { dealZillowUrl: URL, city: "Las Vegas" } } },
      ]],
    ]));

    expect(await verifyDealListing(db as any, { sourceUrl: URL, address: "3511 Desert Cliff St" })).toBe("dead");

    const dealUpdate = updates.find((u) => u.table === (newsletterDeals as object));
    expect(dealUpdate!.values.status).toBe("removed");
    const payloadUpdate = updates.find((u) => u.table === (webinarRegistrants as object));
    expect(payloadUpdate!.values.metadata.personalization).toEqual(freshPayload);
  });

  it("treats API trouble as unknown — never retires on a failed lookup", async () => {
    mockDetails.mockResolvedValue({ success: false, error: "API error: 500" });
    const { db, updates } = fakeDb(new Map());

    expect(await verifyDealListing(db as any, { sourceUrl: URL, address: "x" })).toBe("unknown");
    expect(updates).toHaveLength(0);

    mockDetails.mockRejectedValue(new Error("network"));
    expect(await verifyDealListing(db as any, { sourceUrl: URL, address: "x" })).toBe("unknown");
    expect(updates).toHaveLength(0);
  });
});
