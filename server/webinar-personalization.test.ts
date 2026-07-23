import { describe, expect, it } from "vitest";
import {
  applyConditionalBlocks,
  buildEmailPersonalization,
  buildPersonalizationVars,
  personalizationFromMetadata,
  type RegistrantPersonalization,
} from "./webinar-personalization";

const fullPayload: RegistrantPersonalization = {
  version: 2,
  source: "hubspot",
  city: "San Diego",
  state: "CA",
  marketName: "San Diego, CA",
  deal: {
    label: "a 2-bedroom in San Diego",
    bedrooms: 2,
    monthlyRent: 1850,
    monthlyRevenue: 4100,
    monthlyProfit: 2100,
  },
  dealCount: 3,
  toolLink: "https://coachinayahturnkeytool.com/?tab=listings&city=San+Diego",
  computedAt: "2026-07-23T00:00:00.000Z",
};

describe("buildPersonalizationVars", () => {
  it("returns generic fallbacks and zeroed flags without a payload", () => {
    const vars = buildPersonalizationVars(null);
    expect(vars.city).toBe("your city");
    expect(vars.has_city).toBe("0");
    expect(vars.has_deal).toBe("0");
    expect(vars.has_city_only).toBe("0");
    expect(vars.deal_link).toBe("https://coachinayahturnkeytool.com");
  });

  it("formats real deal figures as monthly dollar strings", () => {
    const vars = buildPersonalizationVars(fullPayload);
    expect(vars.city).toBe("San Diego");
    expect(vars.has_city).toBe("1");
    expect(vars.has_deal).toBe("1");
    expect(vars.has_city_only).toBe("0");
    expect(vars.deal_rent).toBe("$1,850");
    expect(vars.deal_revenue).toBe("$4,100");
    expect(vars.deal_profit).toBe("$2,100");
    expect(vars.tool_link).toContain("San+Diego");
  });

  it("never claims a deal without real numbers", () => {
    const noNumbers = { ...fullPayload, deal: { label: "a unit in San Diego" } };
    const vars = buildPersonalizationVars(noNumbers);
    expect(vars.has_deal).toBe("0");
    expect(vars.has_city_only).toBe("1");
    // Fallbacks stay generic, not fabricated local figures
    expect(vars.deal_rent).toBe("about $2,000");
  });

  it("never claims a weak-profit deal", () => {
    const weak = {
      ...fullPayload,
      deal: { ...fullPayload.deal!, monthlyProfit: 220 },
    };
    const vars = buildPersonalizationVars(weak);
    expect(vars.has_deal).toBe("0");
    expect(vars.has_city_only).toBe("1");
  });
});

describe("applyConditionalBlocks", () => {
  const template =
    "Class is tomorrow.[IF_DEAL] A unit near %CITY% rents for %DEAL_RENT%/mo.[/IF_DEAL][IF_CITY_ONLY] I'll run %CITY% live.[/IF_CITY_ONLY] Join link coming.";

  it("keeps the deal block and drops the city-only block when a deal exists", () => {
    const out = applyConditionalBlocks(template, buildPersonalizationVars(fullPayload));
    expect(out).toContain("A unit near %CITY% rents for %DEAL_RENT%/mo.");
    expect(out).not.toContain("I'll run");
    expect(out).not.toContain("[IF_");
  });

  it("keeps the city-only block when there is a city but no deal", () => {
    const cityOnly = { ...fullPayload, deal: undefined };
    const out = applyConditionalBlocks(template, buildPersonalizationVars(cityOnly));
    expect(out).toContain("I'll run %CITY% live.");
    expect(out).not.toContain("rents for");
  });

  it("strips every block, without leftover markers or doubled spaces, when there is no payload", () => {
    const out = applyConditionalBlocks(template, buildPersonalizationVars(null));
    expect(out).toBe("Class is tomorrow. Join link coming.");
  });

  it("leaves templates without blocks untouched", () => {
    const plain = "Hey %FIRST_NAME%,  see you tonight.";
    expect(applyConditionalBlocks(plain, buildPersonalizationVars(null))).toBe(plain);
  });
});

describe("buildEmailPersonalization", () => {
  it("passes deal strings through only when numbers exist", () => {
    const email = buildEmailPersonalization(fullPayload)!;
    expect(email.dealLabel).toBe("a 2-bedroom in San Diego");
    expect(email.dealRent).toBe("$1,850");

    const noDeal = buildEmailPersonalization({ ...fullPayload, deal: undefined })!;
    expect(noDeal.city).toBe("San Diego");
    expect(noDeal.dealLabel).toBeUndefined();
  });

  it("returns undefined without a payload", () => {
    expect(buildEmailPersonalization(null)).toBeUndefined();
  });
});

describe("personalizationFromMetadata", () => {
  it("extracts a valid payload and rejects junk", () => {
    expect(personalizationFromMetadata({ personalization: fullPayload })?.city).toBe("San Diego");
    expect(personalizationFromMetadata({ personalization: { city: "" } })).toBeNull();
    expect(personalizationFromMetadata(null)).toBeNull();
    expect(personalizationFromMetadata({ signup_date: "2026-07-01" })).toBeNull();
  });
});
