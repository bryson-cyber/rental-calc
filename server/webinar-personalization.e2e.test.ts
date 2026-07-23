/**
 * End-to-end pipeline test: drives the REAL compute → vars → render path with
 * a faked database and faked external APIs (HubSpot, HasData, rentalizer,
 * regulation tracker), asserting the exact SMS/email output for three
 * realistic personas. This is the closest possible verification to production
 * without live credentials.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./hubspot", () => ({ getContactLocationByEmail: vi.fn() }));
vi.mock("./hasdata-zillow", () => ({ searchZillowRentals: vi.fn() }));
vi.mock("./newsletter-deal-finder", () => ({ analyzePropertyForArbitrage: vi.fn() }));
vi.mock("./regulation-tracker", () => ({ getRegulationInfo: vi.fn() }));

import { getContactLocationByEmail } from "./hubspot";
import { searchZillowRentals } from "./hasdata-zillow";
import { analyzePropertyForArbitrage } from "./newsletter-deal-finder";
import { getRegulationInfo } from "./regulation-tracker";
import {
  analysisReports,
  emailOptins,
  newsletterCities,
  newsletterDeals,
  personalizedLinks,
  regulationCache,
} from "../drizzle/schema";
import {
  buildEmailPersonalization,
  buildPersonalizationVars,
  computePersonalizationForEmail,
  ensureCityData,
  renderMessageTemplate,
} from "./webinar-personalization";
import { buildWebinarEmail } from "./hubspot-smtp";

const mockHubspot = getContactLocationByEmail as unknown as ReturnType<typeof vi.fn>;
const mockZillow = searchZillowRentals as unknown as ReturnType<typeof vi.fn>;
const mockAnalyze = analyzePropertyForArbitrage as unknown as ReturnType<typeof vi.fn>;
const mockRegs = getRegulationInfo as unknown as ReturnType<typeof vi.fn>;

// ─── Minimal chainable fake for the drizzle client ───────────────────────────

interface FakeDb {
  db: any;
  inserts: Array<{ table: object; values: any }>;
  updates: Array<{ table: object; values: any }>;
}

function fakeDb(tableRows: Map<object, any[]>): FakeDb {
  const inserts: FakeDb["inserts"] = [];
  const updates: FakeDb["updates"] = [];
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
    insert: (table: object) => ({
      values: (values: any) => {
        inserts.push({ table, values });
        const p: any = Promise.resolve([{ insertId: 1, affectedRows: 1 }]);
        return p;
      },
    }),
    update: (table: object) => ({
      set: (values: any) => ({
        where: () => {
          updates.push({ table, values });
          return Promise.resolve([{ affectedRows: 1 }]);
        },
      }),
    }),
  };
  return { db, inserts, updates };
}

// The exact production seed bodies (kept in sync by the upgradeBody specs)
const DAY_BEFORE_SEED = `Reminder from Inayah: your Airbnb Masterclass is tomorrow.[IF_DEAL] My deal scanner found a property near %CITY% renting for %DEAL_RENT%/mo that comps say could do %DEAL_REVENUE%/mo on Airbnb. Tomorrow I show you exactly how to find and check deals like it.[/IF_DEAL][IF_CITY_ONLY] I'll show you how to run %CITY% through my research tool live.[/IF_CITY_ONLY] Stay tuned for your join link.`;

const VEGAS_DEAL_ROW = {
  id: 7,
  cityId: 3,
  city: "Las Vegas",
  state: "NV",
  address: "1234 Sample St, Las Vegas, NV 89135",
  bedrooms: 2,
  monthlyRent: 1850,
  projectedRevenue: 49200, // annual → $4,100/mo
  projectedProfit: 25200, // annual → $2,100/mo
  dealScore: 82,
  status: "active",
  sourceUrl: "https://www.zillow.com/homedetails/x_zpid/",
  discoveredAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("persona A — HubSpot address + claimable deal (the target experience)", () => {
  function vegasDb() {
    return fakeDb(new Map<object, any[]>([
      [analysisReports as object, []],
      [emailOptins as object, []],
      [newsletterCities as object, [{ id: 3, city: "Las Vegas", state: "NV", airdnaMarketName: "Las Vegas, NV", cachedAdr: 210 }]],
      [newsletterDeals as object, [VEGAS_DEAL_ROW]],
      [regulationCache as object, [{ status: "allowed_with_permit", yesNoSummary: "Yes, short-term rentals are allowed in Las Vegas with a permit." }]],
      [personalizedLinks as object, []],
    ]));
  }

  it("computes the full payload from the soft-pull address", async () => {
    mockHubspot.mockResolvedValue({ hubspotId: "101", city: "LAS VEGAS", state: "NV", postalCode: "89135" });
    const { db, inserts } = vegasDb();

    const p = await computePersonalizationForEmail(db as any, "lead@example.com");

    expect(p).not.toBeNull();
    expect(p!.source).toBe("hubspot");
    expect(p!.city).toBe("Las Vegas"); // upper-cased HubSpot value normalized
    expect(p!.timezone).toBe("America/Los_Angeles");
    expect(p!.regStatus).toBe("allowed_with_permit");
    expect(p!.deal?.monthlyRent).toBe(1850);
    expect(p!.deal?.monthlyRevenue).toBe(4100);
    expect(p!.deal?.monthlyProfit).toBe(2100);
    // A tracked tool link was minted for this lead's city
    expect(inserts.some((i) => i.table === (personalizedLinks as object) && i.values.targetCity === "Las Vegas")).toBe(true);
  });

  it("renders the exact day-before SMS a Vegas lead receives", async () => {
    mockHubspot.mockResolvedValue({ hubspotId: "101", city: "LAS VEGAS", state: "NV", postalCode: "89135" });
    const { db } = vegasDb();
    const p = await computePersonalizationForEmail(db as any, "lead@example.com");

    const sms = renderMessageTemplate(DAY_BEFORE_SEED, {
      ...buildPersonalizationVars(p),
      name: "Jordan",
    });

    expect(sms).toBe(
      "Reminder from Inayah: your Airbnb Masterclass is tomorrow. My deal scanner found a property near Las Vegas renting for $1,850/mo that comps say could do $4,100/mo on Airbnb. Tomorrow I show you exactly how to find and check deals like it. Stay tuned for your join link.",
    );
  });

  it("renders the Near-{city} card and personalized subject in the day-before email", async () => {
    mockHubspot.mockResolvedValue({ hubspotId: "101", city: "LAS VEGAS", state: "NV", postalCode: "89135" });
    const { db } = vegasDb();
    const p = await computePersonalizationForEmail(db as any, "lead@example.com");

    const email = buildWebinarEmail("day_before", {
      firstName: "Jordan",
      webinarLink: "https://example.com/join",
      personalization: buildEmailPersonalization(p),
    })!;

    expect(email.subject).toContain("Las Vegas");
    expect(email.html).toContain("Near Las Vegas");
    expect(email.html).toContain("$1,850");
    expect(email.html).toContain("$4,100");
    expect(email.html).toContain("allowed in Las Vegas with a permit");
  });
});

describe("persona B — opt-in city, no deal yet, failed regulation research", () => {
  it("claims nothing local, offers the live city run instead", async () => {
    mockHubspot.mockResolvedValue(null);
    const { db } = fakeDb(new Map<object, any[]>([
      [analysisReports as object, []],
      [emailOptins as object, [{ city: "Butte", state: "MT" }]],
      [newsletterCities as object, []],
      [newsletterDeals as object, []],
      [regulationCache as object, [{ status: "unknown", yesNoSummary: "Please check official sources." }]],
      [personalizedLinks as object, []],
    ]));

    const p = await computePersonalizationForEmail(db as any, "lead-b@example.com");
    expect(p!.source).toBe("email_optin");
    expect(p!.regStatus).toBeUndefined(); // failed research never reaches copy

    const sms = renderMessageTemplate(DAY_BEFORE_SEED, { ...buildPersonalizationVars(p), name: "Sam" });
    expect(sms).toBe(
      "Reminder from Inayah: your Airbnb Masterclass is tomorrow. I'll show you how to run Butte through my research tool live. Stay tuned for your join link.",
    );
    expect(sms).not.toContain("$");
  });
});

describe("persona C — no location anywhere", () => {
  it("renders clean generic copy with no leftover markers or tokens", async () => {
    mockHubspot.mockResolvedValue(null);
    const { db } = fakeDb(new Map<object, any[]>([
      [analysisReports as object, []],
      [emailOptins as object, []],
    ]));

    const p = await computePersonalizationForEmail(db as any, "lead-c@example.com");
    expect(p).toBeNull();

    const sms = renderMessageTemplate(DAY_BEFORE_SEED, { ...buildPersonalizationVars(p), name: "Alex" });
    expect(sms).toBe("Reminder from Inayah: your Airbnb Masterclass is tomorrow. Stay tuned for your join link.");
    expect(sms).not.toMatch(/\[IF_|%[A-Z_]+%|\{\{/);
  });
});

describe("live city scan — automating step 4 for a dry city", () => {
  it("analyzes best-fit listings first, writes complete deal rows, stops after a claimable hook", async () => {
    mockRegs.mockResolvedValue({ status: "allowed" });
    mockZillow.mockResolvedValue({
      success: true,
      listings: [
        { address: "9 Mansion Way, Boise, ID 83702", zpid: "1", price: 5500, bedrooms: 5, bathrooms: 4, detailUrl: "u1", imgSrc: "", homeType: "house", zipcode: "83702" },
        { address: "12 Fit St, Boise, ID 83702", zpid: "2", price: 1700, bedrooms: 3, bathrooms: 2, detailUrl: "u2", imgSrc: "", homeType: "house", zipcode: "83702" },
        { address: "34 Also Fit Ave, Boise, ID 83702", zpid: "3", price: 2100, bedrooms: 2, bathrooms: 1, detailUrl: "u3", imgSrc: "", homeType: "apartment", zipcode: "83702" },
      ],
      totalCount: 3, currentPage: 1, totalPages: 1,
    });
    mockAnalyze.mockResolvedValue({
      address: "12 Fit St, Boise, ID 83702", city: "Boise", state: "ID", zipCode: "83702",
      bedrooms: 3, bathrooms: 2, monthlyRent: 1700, propertyType: "house",
      sourceUrl: "u2", sourcePlatform: "zillow", imageUrl: "",
      projectedAnnualRevenue: 54000, projectedMonthlyRevenue: 4500, projectedAdr: 220,
      projectedOccupancy: 0.62, monthlyProfit: 1900, annualProfit: 22800, profitMargin: 0.42,
      breakEvenOccupancy: 0.26, dealScore: 78, dealGrade: "B", topComps: [], analyzedAt: new Date(),
    });

    const { db, inserts } = fakeDb(new Map<object, any[]>([
      [newsletterCities as object, [{ id: 9, city: "Boise", state: "ID", lastDealScan: null }]],
      [newsletterDeals as object, []],
    ]));

    const result = await ensureCityData(db as any, "Boise", "ID");

    expect(mockRegs).toHaveBeenCalledWith("Boise", "ID");
    // Best-fit (2–3BR, moderate rent) listings analyzed before the 5BR mansion
    const firstAnalyzed = mockAnalyze.mock.calls[0][0];
    expect(firstAnalyzed.monthlyRent).not.toBe(5500);
    // Early stop: claimable hook found → no third analysis
    expect(mockAnalyze.mock.calls.length).toBeLessThanOrEqual(2);
    expect(result.scanned).toBe(true);
    expect(result.newDeals).toBeGreaterThanOrEqual(1);

    const dealInsert = inserts.find((i) => i.table === (newsletterDeals as object));
    expect(dealInsert!.values.projectedProfit).toBe(22800);
    expect(dealInsert!.values.projectedRevenue).toBe(54000);
    expect(dealInsert!.values.status).toBe("active");
  });
});
