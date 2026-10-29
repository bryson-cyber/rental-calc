/**
 * The filing industry for every activity this app's wizard can produce
 * (2026-10-29, ported from Her First Order's PR #397). The provider refuses a
 * company create without `industry` since 2026-10-27 and no longer accepts
 * `naicsCode`; HFO's order #32 ("workwear") was refused that way. Here the
 * wizard can produce four kinds of activity, and every one is pinned to a
 * label that is on this app's reference list (shared/doola-industries.ts)
 * AND on the provider's live list fetched 2026-10-29
 * (fixtures/provider-industries-2026-10-29.json):
 *  1. a one-tap preset (businessType DIRECT_LABEL_MARKER, industryType = its label);
 *  2. any label from the searchable list (the same shape);
 *  3. the app's own choices (LLC_ACTIVITY_CHOICES; the owner's NAICS 541618);
 *  4. every taxonomy choice (orders and drafts from before the provider-label
 *     switch, or a triple the activity step still accepts).
 * Nothing outside those maps, and the payload builder never sends a company
 * without an industry, or a naicsCode.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DOOLA_INDUSTRY_OPTIONS, DOOLA_VALID_INDUSTRIES } from "../../shared/doola-industries";
import {
  DIRECT_LABEL_MARKER,
  LLC_ACTIVITY_CHOICES,
  LLC_ACTIVITY_PRESETS,
  findLlcActivityChoice,
  llcActivityLabel,
  llcActivityStepSchema,
  llcCompleteSchema,
} from "../../shared/llc";
import { WHOP_BUSINESS_TAXONOMY } from "../../shared/whop-taxonomy";
import { CHOICE_INDUSTRY, GROUP_INDUSTRY, industryForActivity } from "./industryMap";
import { DoolaApiError, deriveBusinessDescription, deriveDoolaIndustry, mapRegistrationToDoolaCompany } from "./doola";
import { makePersistedBundle, validDraft } from "./test-fixtures";

const live = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "provider-industries-2026-10-29.json"), "utf8"),
) as { count: number; industries: Array<{ industry: string; naicsCode: string }> };
const LIVE_LABELS = new Set(live.industries.map((entry) => entry.industry));

const taxonomy = WHOP_BUSINESS_TAXONOMY as unknown as Record<string, Record<string, readonly string[]>>;
const taxonomyChoices = Object.entries(taxonomy).flatMap(([businessType, groups]) =>
  Object.entries(groups).flatMap(([industryGroup, types]) =>
    types.map((industryType) => ({ businessType, industryGroup, industryType })),
  ),
);

/** Exactly what the wizard's preset tiles write (client/src/components/llc-formation/WizardSteps.tsx). */
const presetActivities = LLC_ACTIVITY_PRESETS.map((preset) => ({
  businessType: DIRECT_LABEL_MARKER,
  industryGroup: preset.naicsCode,
  industryType: preset.filingIndustry,
}));
/** Exactly what the searchable list writes for each label it offers. */
const listActivities = DOOLA_INDUSTRY_OPTIONS.map((option) => ({
  businessType: DIRECT_LABEL_MARKER,
  industryGroup: DIRECT_LABEL_MARKER,
  industryType: option.value,
}));
const appChoiceActivities = LLC_ACTIVITY_CHOICES.map(({ businessType, industryGroup, industryType }) => ({
  businessType,
  industryGroup,
  industryType,
}));

const CONSULTING_541618 = {
  businessType: "services",
  industryGroup: "consulting",
  industryType: "other_management_consulting_services",
};

/** A registration row as the filing step reads it: the fixture order with this activity. */
function rowWith(activity: { businessType: string | null; industryGroup: string | null; industryType: string | null }) {
  const bundle = makePersistedBundle("payment_required");
  return {
    registration: {
      ...bundle.registration,
      ...activity,
      businessAddressMode: "customer",
      mailingAddressMode: "customer",
    } as never,
    founders: bundle.founders as never,
  };
}

function keysDeep(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) keysDeep(item, keys);
  else if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      keys.add(key);
      keysDeep(inner, keys);
    }
  }
  return keys;
}

describe("the provider's live list (fetched 2026-10-29)", () => {
  it("is the 867-entry snapshot, and every label this app's reference list holds is on it", () => {
    expect(live.count).toBe(867);
    expect(LIVE_LABELS.size).toBe(867);
    const missing = [...DOOLA_VALID_INDUSTRIES].filter((label) => !LIVE_LABELS.has(label));
    expect(missing).toEqual([]);
  });
});

describe("every wizard activity has a filing industry on the live list", () => {
  it("each one-tap preset files under its own label", () => {
    expect(presetActivities.length).toBeGreaterThan(0);
    for (const [index, activity] of presetActivities.entries()) {
      const label = deriveDoolaIndustry(activity);
      expect(label).toBe(LLC_ACTIVITY_PRESETS[index].filingIndustry);
      expect(LIVE_LABELS.has(label!), label).toBe(true);
    }
  });

  it("each label the searchable list offers files as itself (all of them)", () => {
    expect(listActivities.length).toBe(DOOLA_VALID_INDUSTRIES.size);
    const unmapped = listActivities.filter((activity) => deriveDoolaIndustry(activity) !== activity.industryType);
    expect(unmapped).toEqual([]);
    for (const activity of listActivities) expect(LIVE_LABELS.has(activity.industryType), activity.industryType).toBe(true);
  });

  it("each of the app's own choices maps to a label on the live list", () => {
    for (const activity of appChoiceActivities) {
      const label = deriveDoolaIndustry(activity);
      expect(label, activity.industryType).toBeDefined();
      expect(DOOLA_VALID_INDUSTRIES.has(label!)).toBe(true);
      expect(LIVE_LABELS.has(label!)).toBe(true);
    }
  });

  it("every one of the 2,033 taxonomy choices maps to a label on both lists", () => {
    expect(taxonomyChoices.length).toBe(2033);
    const unmapped = taxonomyChoices.filter((choice) => !deriveDoolaIndustry(choice));
    expect(unmapped).toEqual([]);
    const offList = taxonomyChoices.filter((choice) => !LIVE_LABELS.has(deriveDoolaIndustry(choice)!));
    expect(offList).toEqual([]);
    for (const choice of taxonomyChoices) expect(DOOLA_VALID_INDUSTRIES.has(deriveDoolaIndustry(choice)!)).toBe(true);
  });

  it("files workwear (HFO's order #32) as a clothing brand, and this app's rental choices under closer labels", () => {
    expect(deriveDoolaIndustry({ businessType: "physical_product", industryGroup: "clothing_and_apparel", industryType: "workwear" })).toBe("Clothing brand");
    expect(deriveDoolaIndustry({ businessType: "brick_and_mortar", industryGroup: "hospitality_and_lodging", industryType: "vacation_rental_property" })).toBe("Vacation rentals");
    expect(deriveDoolaIndustry({ businessType: "brick_and_mortar", industryGroup: "hospitality_and_lodging", industryType: "motel" })).toBe("Hospitality");
    expect(deriveDoolaIndustry({ businessType: "services", industryGroup: "professional_services", industryType: "property_management" })).toBe("Property management");
    // The fixture order's own activity (a legacy taxonomy triple).
    expect(deriveDoolaIndustry(validDraft as never)).toBe("Online education services");
  });

  it("the table holds exactly the taxonomy's groups, and every override is a real choice with a valid label", () => {
    const groups = Object.entries(taxonomy).flatMap(([businessType, g]) => Object.keys(g).map((group) => `${businessType}/${group}`));
    expect(Object.keys(GROUP_INDUSTRY).sort()).toEqual(groups.sort());
    for (const label of [...Object.values(GROUP_INDUSTRY), ...Object.values(CHOICE_INDUSTRY)]) {
      expect(DOOLA_VALID_INDUSTRIES.has(label), label).toBe(true);
      expect(LIVE_LABELS.has(label), label).toBe(true);
    }
    const real = new Set(
      [...taxonomyChoices, ...appChoiceActivities].map((c) => `${c.businessType}/${c.industryGroup}/${c.industryType}`),
    );
    for (const key of Object.keys(CHOICE_INDUSTRY)) expect(real.has(key), key).toBe(true);
  });

  it("nothing outside the wizard's choices maps", () => {
    expect(industryForActivity({ businessType: "physical_product", industryGroup: "clothing_and_apparel", industryType: "something_custom" })).toBeUndefined();
    expect(industryForActivity({ businessType: "services", industryGroup: "clothing_and_apparel", industryType: "workwear" })).toBeUndefined();
    expect(industryForActivity({ businessType: null, industryGroup: null, industryType: null })).toBeUndefined();
    // A provider-label row whose label is not on the list (an old or typed value).
    expect(deriveDoolaIndustry({ businessType: DIRECT_LABEL_MARKER, industryGroup: DIRECT_LABEL_MARKER, industryType: "Workwear studio" })).toBeUndefined();
    expect(deriveDoolaIndustry({ businessType: DIRECT_LABEL_MARKER, industryGroup: DIRECT_LABEL_MARKER, industryType: "" })).toBeUndefined();
    // The app's choice keys only count together.
    expect(deriveDoolaIndustry({ ...CONSULTING_541618, industryGroup: "professional_services" })).toBeUndefined();
  });
});

describe("NAICS 541618, Other management consulting services (the owner, 2026-10-29)", () => {
  it("is one of the wizard's choices, in the services / consulting group, and the wizard renders it", () => {
    const choice = findLlcActivityChoice(CONSULTING_541618);
    expect(choice).toMatchObject({ label: "Other management consulting services", naicsCode: "541618" });
    expect(LLC_ACTIVITY_CHOICES).toContainEqual(expect.objectContaining(CONSULTING_541618));
    expect(Object.keys(taxonomy.services)).toContain("consulting");
    const wizard = readFileSync(join(__dirname, "..", "..", "client", "src", "components", "llc-formation", "WizardSteps.tsx"), "utf8");
    expect(wizard).toContain("LLC_ACTIVITY_CHOICES.map((choice) =>");
    expect(wizard).toContain("businessType: choice.businessType,");
    expect(wizard).toContain("industryType: choice.industryType,");
    expect(wizard).toContain("NAICS: {choice.naicsCode}");
    // The review step shows her the choice's name, not its key.
    expect(llcActivityLabel(CONSULTING_541618)).toBe("Other management consulting services");
    expect(wizard).toContain("llcActivityLabel(draft)");
  });

  it("is accepted and saved like any other activity: the activity step and the full submission both pass", () => {
    expect(llcActivityStepSchema.safeParse(CONSULTING_541618).success).toBe(true);
    const complete = llcCompleteSchema.safeParse({ ...validDraft, ...CONSULTING_541618 });
    expect(complete.success).toBe(true);
    expect(complete.data).toMatchObject(CONSULTING_541618);
    expect(llcActivityStepSchema.safeParse({ ...CONSULTING_541618, industryType: "other_consulting" }).success).toBe(false);
  });

  it("files as \"Business consulting\": the 54161 parent on the live list, since the only 541618 label is sports consulting", () => {
    expect(deriveDoolaIndustry(CONSULTING_541618)).toBe("Business consulting");
    expect(CHOICE_INDUSTRY["services/consulting/other_management_consulting_services"]).toBe("Business consulting");
    expect(live.industries).toContainEqual({ industry: "Business consulting", naicsCode: "54161" });
    expect(live.industries.filter((entry) => entry.naicsCode === "541618").map((entry) => entry.industry)).toEqual([
      "Sports management consulting",
    ]);

    const { registration, founders } = rowWith(CONSULTING_541618);
    const body = mapRegistrationToDoolaCompany(registration, founders, "cus_1");
    expect(body.industry).toBe("Business consulting");
    expect(body.description).toBe("Other management consulting services business");
    // Labels only: the code is never sent.
    expect(keysDeep(body).has("naicsCode")).toBe(false);
    expect(JSON.stringify(body)).not.toContain("541618");
  });
});

describe("the payload builder", () => {
  it("always sends an industry, never a naicsCode (a preset row keeps its NAICS code in industryGroup, unsent)", () => {
    for (const activity of [...presetActivities, ...appChoiceActivities, taxonomyChoices[0]]) {
      const { registration, founders } = rowWith(activity);
      const body = mapRegistrationToDoolaCompany(registration, founders, "cus_1");
      expect(typeof body.industry).toBe("string");
      expect(body.industry.length).toBeGreaterThan(0);
      expect(keysDeep(body).has("naicsCode")).toBe(false);
    }
    const preset = LLC_ACTIVITY_PRESETS[0];
    const { registration, founders } = rowWith(presetActivities[0]);
    const body = mapRegistrationToDoolaCompany(registration, founders, "cus_1");
    expect(body.industry).toBe(preset.filingIndustry);
    expect(JSON.stringify(body)).not.toContain(`"${preset.naicsCode}"`);
  });

  it("refuses to build a company with no industry (E_INDUSTRY_UNMAPPED)", () => {
    const { registration, founders } = rowWith({ businessType: "physical_product", industryGroup: "clothing_and_apparel", industryType: "something_custom" });
    expect(() => mapRegistrationToDoolaCompany(registration, founders, "cus_1")).toThrow(DoolaApiError);
    try {
      mapRegistrationToDoolaCompany(registration, founders, "cus_1");
    } catch (error) {
      expect(error).toMatchObject({ code: "E_INDUSTRY_UNMAPPED", retryable: false });
    }
  });

  it("the server code never names a naicsCode field outside comments", () => {
    for (const file of ["doola.ts", "doolaSubmission.ts", "industryMap.ts", join("annualReports", "provider.ts")]) {
      const code = readFileSync(join(__dirname, file), "utf8")
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join("\n");
      expect(code, file).not.toMatch(/naicsCode/);
    }
    expect(deriveBusinessDescription(rowWith(CONSULTING_541618).registration)).toContain("management consulting");
  });
});
