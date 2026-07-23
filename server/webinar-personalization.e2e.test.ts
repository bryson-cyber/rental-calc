/**
 * End-to-end pipeline test: drives the REAL compute → vars → render path with
 * a faked database and faked external APIs (HubSpot, HasData, rentalizer,
 * regulation tracker), asserting the exact SMS/email output for three
 * realistic personas. This is the closest possible verification to production
 * without live credentials.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./hubspot", () => ({ getContactLocationByEmail: vi.fn(), getContactLocationsByEmails: vi.fn() }));
vi.mock("./hasdata-zillow", () => ({ searchZillowRentals: vi.fn() }));
vi.mock("./newsletter-deal-finder", () => ({ analyzePropertyForArbitrageDetailed: vi.fn() }));
vi.mock("./regulation-tracker", () => ({ getRegulationInfo: vi.fn() }));
vi.mock("./airdna", () => ({ getRentalizerEstimate: vi.fn() }));
vi.mock("./shareable-reports", () => ({ createShareableReport: vi.fn() }));

import { getContactLocationByEmail } from "./hubspot";
import { searchZillowRentals } from "./hasdata-zillow";
import { analyzePropertyForArbitrageDetailed } from "./newsletter-deal-finder";
import { getRegulationInfo } from "./regulation-tracker";
import { createShareableReport } from "./shareable-reports";
import {
  analysisReports,
  emailOptins,
  newsletterCities,
  newsletterDeals,
  personalizedLinks,
  regulationCache,
  universalShareableReports,
  webinarRegistrants,
} from "../drizzle/schema";
import {
  buildEmailPersonalization,
  buildPersonalizationVars,
  computePersonalizationForEmail,
  ensureCityData,
  ensureDealReportForCity,
  renderMessageTemplate,
} from "./webinar-personalization";
import { getRentalizerEstimate } from "./airdna";
import { buildWebinarEmail } from "./hubspot-smtp";

const mockHubspot = getContactLocationByEmail as unknown as ReturnType<typeof vi.fn>;
const mockZillow = searchZillowRentals as unknown as ReturnType<typeof vi.fn>;
const mockAnalyze = analyzePropertyForArbitrageDetailed as unknown as ReturnType<typeof vi.fn>;
const mockRegs = getRegulationInfo as unknown as ReturnType<typeof vi.fn>;
const mockShareReport = createShareableReport as unknown as ReturnType<typeof vi.fn>;
const mockRentalizer = getRentalizerEstimate as unknown as ReturnType<typeof vi.fn>;

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
const DAY_BEFORE_SEED = `Reminder from Inayah: your Airbnb Masterclass is tomorrow.[IF_DEAL] My deal scanner found a property near %CITY% renting for %DEAL_RENT%/mo that comps say could do %DEAL_REVENUE%/mo on Airbnb. Tomorrow I show you exactly how to find and check deals like it.[/IF_DEAL][IF_CITY_ONLY] The system I teach finds opportunities in markets like %CITY% — you'll see it start to finish.[/IF_CITY_ONLY] Stay tuned for your join link.`;

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
      [universalShareableReports as object, [{ shareCode: "vegasrep123", address: VEGAS_DEAL_ROW.address, reportType: "validator" }]],
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
    // The deal resolves to the tool's own shared report, sent as a tracked
    // short link — a public page, never the login-gated tool
    expect(p!.dealReportShareId).toBe("vegasrep123");
    expect(p!.dealShortLink).toMatch(/\/l\/[a-z0-9]+$/);
    const linkInsert = inserts.find((i) => i.table === (personalizedLinks as object));
    expect(linkInsert!.values.linkUrl).toContain("/share/vegasrep123");
    expect(linkInsert!.values.targetCity).toBe("Las Vegas");
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
    // Primary link: the tool's own report (tracked); secondary: the Zillow listing
    expect(email.html).toContain("See the full property report");
    expect(email.html).toContain("View the live listing on Zillow");
    expect(email.html).toContain(VEGAS_DEAL_ROW.sourceUrl);
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
      "Reminder from Inayah: your Airbnb Masterclass is tomorrow. The system I teach finds opportunities in markets like Butte — you'll see it start to finish. Stay tuned for your join link.",
    );
    expect(sms).not.toContain("$");
  });
});

describe("persona D — lead texted us a different city earlier", () => {
  it("their texted city is durable: it beats HubSpot on every recompute", async () => {
    // HubSpot says Las Vegas, but the lead replied 'Phoenix' to the
    // engagement question last week — that choice must never revert
    mockHubspot.mockResolvedValue({ hubspotId: "101", city: "LAS VEGAS", state: "NV", postalCode: "89135" });
    const { db } = fakeDb(new Map<object, any[]>([
      [webinarRegistrants as object, [{
        id: 1,
        metadata: { engagement: { cityOverride: { city: "Phoenix", state: "AZ" } } },
      }]],
      [analysisReports as object, []],
      [emailOptins as object, []],
      [newsletterCities as object, []],
      [newsletterDeals as object, []],
      [regulationCache as object, []],
      [personalizedLinks as object, []],
      [universalShareableReports as object, []],
    ]));

    const p = await computePersonalizationForEmail(db as any, "lead-d@example.com");
    expect(p!.city).toBe("Phoenix");
    expect(p!.state).toBe("AZ");
    expect(p!.source).toBe("engagement");
    expect(p!.timezone).toBe("America/Phoenix");
    expect(mockHubspot).not.toHaveBeenCalled();
  });
});

describe("HubSpot rate limiting", () => {
  it("propagates HUBSPOT_RATE_LIMITED so the enrichment cycle backs off", async () => {
    mockHubspot.mockRejectedValue(new Error("HUBSPOT_RATE_LIMITED"));
    const { db } = fakeDb(new Map<object, any[]>([
      [analysisReports as object, []],
      [emailOptins as object, []],
    ]));
    await expect(computePersonalizationForEmail(db as any, "lead-rl@example.com")).rejects.toThrow("HUBSPOT_RATE_LIMITED");
  });

  it("uses a prefetched batch location without any per-contact lookup", async () => {
    mockHubspot.mockRejectedValue(new Error("should not be called"));
    const { db } = fakeDb(new Map<object, any[]>([
      [analysisReports as object, []],
      [emailOptins as object, []],
      [newsletterCities as object, []],
      [newsletterDeals as object, []],
      [regulationCache as object, []],
      [personalizedLinks as object, []],
      [universalShareableReports as object, []],
    ]));
    const p = await computePersonalizationForEmail(db as any, "lead-batch@example.com", {
      hubspotLocation: { city: "DALLAS", state: "TX" },
    });
    expect(p!.city).toBe("Dallas");
    expect(p!.source).toBe("hubspot");
    expect(mockHubspot).not.toHaveBeenCalled();
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
    mockShareReport.mockResolvedValue({ success: true, shareCode: "newcode", shareUrl: "/share/newcode" });
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
      deal: {
        address: "12 Fit St, Boise, ID 83702", city: "Boise", state: "ID", zipCode: "83702",
        bedrooms: 3, bathrooms: 2, monthlyRent: 1700, propertyType: "house",
        sourceUrl: "u2", sourcePlatform: "zillow", imageUrl: "",
        projectedAnnualRevenue: 54000, projectedMonthlyRevenue: 4500, projectedAdr: 220,
        projectedOccupancy: 0.62, monthlyProfit: 1900, annualProfit: 22800, profitMargin: 0.42,
        breakEvenOccupancy: 0.26, dealScore: 78, dealGrade: "B", topComps: [], analyzedAt: new Date(),
      },
      estimate: {
        property: { address: "12 Fit St, Boise, ID 83702", zipcode: "83702", bedrooms: 3, bathrooms: 2, accommodates: 8 },
        estimates: { annual_revenue: 54000, annual_revenue_low: 43000, annual_revenue_high: 65000, average_daily_rate: 220, occupancy_rate: 62, currency: "USD", currency_symbol: "$" },
        monthly_forecast: [],
        comps: [],
      },
    });

    const { db, inserts } = fakeDb(new Map<object, any[]>([
      [newsletterCities as object, [{ id: 9, city: "Boise", state: "ID", lastDealScan: null }]],
      [newsletterDeals as object, []],
      [universalShareableReports as object, []],
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

    // The public /share validator report was built from the same estimate —
    // no extra rentalizer call — and carries the Zillow listing URL inside
    expect(mockShareReport).toHaveBeenCalled();
    const shareInput = mockShareReport.mock.calls[0][0];
    expect(shareInput.reportType).toBe("validator");
    expect(shareInput.address).toBe("12 Fit St, Boise, ID 83702");
    expect(shareInput.annualRevenue).toBe(54000);
    expect(shareInput.reportData._listingUrl).toBe("u2");
    expect(shareInput.reportData.revenue.projected).toBe(54000);
    expect(shareInput.reportData.cashFlow.monthlyProfit).toBe(4500 - 1700 - 900); // rev − rent − 20% opex
    expect(result.reportsCreated).toBeGreaterThanOrEqual(1);
  });
});

describe("on-demand report (YES-reply path)", () => {
  it("builds the report for the deal the message quotes, not the top-scored one", async () => {
    // Top-scored deal has no rent figure → unclaimable → the message quotes
    // the runner-up. The report MUST be built for that same runner-up, or the
    // lead's link stays on the Zillow fallback forever.
    const unclaimableTop = {
      id: 21, city: "Las Vegas", state: "NV", address: "1 High Score Blvd, Las Vegas, NV 89129",
      bedrooms: 4, bathrooms: 3, monthlyRent: null, projectedRevenue: null, projectedProfit: null,
      dealScore: 95, status: "active", sourceUrl: "https://www.zillow.com/homedetails/top_zpid/",
      discoveredAt: new Date(),
    };
    const claimableRunnerUp = {
      id: 22, city: "Las Vegas", state: "NV", address: "10452 Mihela Ave, Las Vegas, NV 89129",
      bedrooms: 3, bathrooms: 2, monthlyRent: 1690, projectedRevenue: 79632, projectedProfit: 43428,
      dealScore: 80, status: "active", sourceUrl: "https://www.zillow.com/homedetails/mihela_zpid/",
      discoveredAt: new Date(),
    };
    mockRentalizer.mockResolvedValue({
      property: { address: claimableRunnerUp.address, zipcode: "89129", bedrooms: 3, bathrooms: 2, accommodates: 8 },
      estimates: { annual_revenue: 79632, annual_revenue_low: 64000, annual_revenue_high: 95000, average_daily_rate: 240, occupancy_rate: 74, currency: "USD", currency_symbol: "$" },
      monthly_forecast: [],
      comps: [],
    });
    mockShareReport.mockResolvedValue({ success: true, shareCode: "ondemand1", shareUrl: "/share/ondemand1" });
    const { db } = fakeDb(new Map<object, any[]>([
      [newsletterDeals as object, [unclaimableTop, claimableRunnerUp]],
      [universalShareableReports as object, []],
    ]));

    const ok = await ensureDealReportForCity(db as any, "Las Vegas", "NV");

    expect(ok).toBe(true);
    expect(mockShareReport).toHaveBeenCalledTimes(1);
    const input = mockShareReport.mock.calls[0][0];
    expect(input.address).toBe(claimableRunnerUp.address);
    expect(input.reportType).toBe("validator");
    expect(input.reportData._listingUrl).toBe(claimableRunnerUp.sourceUrl);
  });
});
