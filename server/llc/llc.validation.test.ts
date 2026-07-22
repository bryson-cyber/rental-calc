import { describe, expect, it } from "vitest";
import {
  issuesByField,
  llcCompleteSchema,
  validateLlcStep,
} from "../../shared/llc";
import { validDraft } from "./test-fixtures";

describe("LLC step validation", () => {
  it("accepts a complete documented Whop registration", () => {
    expect(llcCompleteSchema.safeParse(validDraft).success).toBe(true);
  });

  it("rejects invalid taxonomy combinations with field-level guidance", () => {
    const result = validateLlcStep(2, {
      ...validDraft,
      industryType: "not_a_documented_industry",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(issuesByField(result.error).industryType).toMatch(
        /valid business type, group, and industry/i,
      );
    }
  });

  it("requires a company address only when Whop registered-agent service is not selected", () => {
    const emptyAddress = {
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "US" as const,
    };
    expect(
      validateLlcStep(3, {
        ...validDraft,
        useRegisteredAgent: true,
        companyAddress: emptyAddress,
      }).success,
    ).toBe(true);

    const result = validateLlcStep(3, {
      ...validDraft,
      useRegisteredAgent: false,
      companyAddress: emptyAddress,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(issuesByField(result.error)["companyAddress.line1"]).toMatch(/required/i);
    }
  });

  it("requires exactly one primary founder and 100 percent total ownership", () => {
    const noPrimary = validateLlcStep(4, {
      ...validDraft,
      founders: validDraft.founders.map((founder) => ({
        ...founder,
        isPrimary: false,
      })),
    });
    expect(noPrimary.success).toBe(false);

    const incompleteOwnership = validateLlcStep(4, {
      ...validDraft,
      founders: validDraft.founders.map((founder, index) => ({
        ...founder,
        ownershipPercentage: index === 0 ? 50 : 40,
      })),
    });
    expect(incompleteOwnership.success).toBe(false);
  });

  it("normalizes plain US phone digits to E.164", () => {
    for (const typed of ["7025218792", "(702) 521-8792", "1-702-521-8792"]) {
      const result = llcCompleteSchema.safeParse({
        ...validDraft,
        businessPhone: typed,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.businessPhone).toBe("+17025218792");
      }
    }
  });

  it("requires a business phone only when not using the registered-agent service", () => {
    // Provider contract: business_phone is required unless use_registered_agent
    // is true (the agent supplies the contact details).
    const withoutPhone = { ...validDraft, businessPhone: "" };

    const ownAddress = llcCompleteSchema.safeParse({
      ...withoutPhone,
      useRegisteredAgent: false,
    });
    expect(ownAddress.success).toBe(false);
    if (!ownAddress.success) {
      expect(issuesByField(ownAddress.error).businessPhone).toMatch(
        /business phone is required when using your own company address/i,
      );
    }

    const withAgent = llcCompleteSchema.safeParse({
      ...withoutPhone,
      useRegisteredAgent: true,
    });
    expect(withAgent.success).toBe(true);
  });

  it("blocks final submission until the accuracy attestation is accepted", () => {
    const result = llcCompleteSchema.safeParse({
      ...validDraft,
      accuracyAttested: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(issuesByField(result.error).accuracyAttested).toMatch(/confirm/i);
    }
  });
});

describe("LLC activity presets", () => {
  it("every preset is a valid Whop taxonomy combination", async () => {
    const { LLC_ACTIVITY_PRESETS } = await import("../../shared/llc");
    const { isValidWhopTaxonomySelection } = await import("../../shared/whop-taxonomy");
    for (const preset of LLC_ACTIVITY_PRESETS) {
      expect(
        isValidWhopTaxonomySelection(
          preset.businessType,
          preset.industryGroup,
          preset.industryType,
        ),
      ).toBe(true);
    }
  });
});
