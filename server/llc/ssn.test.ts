import { afterEach, describe, expect, it, vi } from "vitest";
import { llcCompleteSchema, llcDraftSchema } from "../../shared/llc";
import { validDraft } from "./test-fixtures";
import { decryptPii, encryptPii, isPiiEncryptionConfigured, maskSsn, PiiConfigurationError } from "./pii";
import { bundleToOpsView, bundleToRegistrationView } from "./domain";
import { mapLlcToWhopRequest } from "./whop";

const TEST_KEY = "a".repeat(64);

function completeWith(overrides: {
  ssn?: string;
  expediteEin?: boolean;
}) {
  return llcCompleteSchema.parse({
    ...validDraft,
    currentStep: 6,
    accuracyAttested: true,
    expediteEin: overrides.expediteEin ?? false,
    founders: validDraft.founders.map((founder, index) => ({
      ...founder,
      ssn: index === 0 ? overrides.ssn : undefined,
    })),
  });
}

describe("SSN validation and the expedited-EIN exclusivity rule", () => {
  it("accepts a valid dashed SSN and normalizes it to digits", () => {
    const complete = completeWith({ ssn: "123-45-6789" });
    expect(complete.founders[0].ssn).toBe("123456789");
  });

  it("accepts an empty SSN (non-US founders)", () => {
    const complete = completeWith({ ssn: "" });
    expect(complete.founders[0].ssn).toBeUndefined();
  });

  it.each(["12345", "000-12-3456", "666-12-3456", "912-12-3456", "123-00-4567", "123-45-0000"])(
    "rejects invalid SSN %s",
    (ssn) => {
      expect(() => completeWith({ ssn })).toThrow();
    },
  );

  it("tolerates partial SSNs in drafts (autosave while typing)", () => {
    const draft = llcDraftSchema.parse({
      ...validDraft,
      founders: validDraft.founders.map((founder) => ({ ...founder, ssn: "123-4" })),
    });
    expect(draft.founders[0].ssn).toBe("123-4");
  });

  it("coerces expediteEin off when any founder supplies an SSN (Whop forbids the combination)", () => {
    const complete = completeWith({ ssn: "123-45-6789", expediteEin: true });
    expect(complete.expediteEin).toBe(false);
  });

  it("keeps expediteEin on when no SSN is supplied", () => {
    const complete = completeWith({ ssn: "", expediteEin: true });
    expect(complete.expediteEin).toBe(true);
  });

  it("sends ssn to Whop only when present and never sends expedite_ein alongside one", () => {
    const withSsn = mapLlcToWhopRequest({
      ...completeWith({ ssn: "123-45-6789" }),
      expediteEin: true,
    });
    expect(withSsn.founders[0]).toMatchObject({ ssn: "123456789" });
    expect(withSsn.business_info.expedite_ein).toBe(false);

    const withoutSsn = mapLlcToWhopRequest(completeWith({ ssn: "", expediteEin: true }));
    expect(withoutSsn.founders[0]).not.toHaveProperty("ssn");
    expect(withoutSsn.business_info.expedite_ein).toBe(true);
  });
});

describe("SSN encryption at rest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips through AES-256-GCM", () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", TEST_KEY);
    const stored = encryptPii("123456789");
    expect(stored).toMatch(/^v1:/);
    expect(stored).not.toContain("123456789");
    expect(decryptPii(stored)).toBe("123456789");
  });

  it("fails closed when no key is configured", () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    expect(isPiiEncryptionConfigured()).toBe(false);
    expect(() => encryptPii("123456789")).toThrow(PiiConfigurationError);
  });

  it("returns null instead of garbage for tampered or wrong-key data", () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", TEST_KEY);
    const stored = encryptPii("123456789");
    vi.stubEnv("PII_ENCRYPTION_KEY", "b".repeat(64));
    expect(decryptPii(stored)).toBeNull();
    vi.stubEnv("PII_ENCRYPTION_KEY", TEST_KEY);
    expect(decryptPii(stored.slice(0, -4) + "AAAA")).toBeNull();
    expect(decryptPii("not-an-envelope")).toBeNull();
    expect(decryptPii(null)).toBeNull();
  });

  it("masks SSNs for operations surfaces", () => {
    expect(maskSsn("123456789")).toBe("•••-••-6789");
    expect(maskSsn("123-45-6789")).toBe("•••-••-6789");
    expect(maskSsn(null)).toBeNull();
    expect(maskSsn("12")).toBe("•••-••-••••");
  });
});

describe("SSN view boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the full SSN only to the owning client view and a mask to ops", () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", TEST_KEY);
    const now = new Date("2026-07-21T12:00:00.000Z");
    const bundle = {
      registration: {
        id: 41,
        userId: 7,
        status: "draft",
        currentStep: 4,
        legalName: "Fixture Co",
        entitySuffix: "LLC" as const,
        formationState: "NM",
        businessType: null,
        industryGroup: null,
        industryType: null,
        businessPhone: null,
        website: null,
        useRegisteredAgent: true,
        companyAddressLine1: null,
        companyAddressLine2: null,
        companyAddressCity: null,
        companyAddressState: null,
        companyAddressPostalCode: null,
        companyAddressCountry: "US",
        expediteEin: false,
        accuracyAttested: false,
        whopAccountId: null,
        accountEmailAlias: null,
        checkoutSessionId: null,
        checkoutUrl: null,
        checkoutTotal: null,
        checkoutCurrency: null,
        retailPriceCents: null,
        opsNotifiedAt: null,
        providerStatus: null,
        lastProviderSyncAt: null,
        lastErrorType: null,
        lastErrorMessage: null,
        retryable: false,
        submissionKey: null,
        submittedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      founders: [
        {
          id: 1,
          registrationId: 41,
          sortOrder: 0,
          isPrimary: true,
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          phone: "+12125550100",
          ssnEncrypted: encryptPii("123456789"),
          ownershipBasisPoints: 10_000,
          addressLine1: "1 Main St",
          addressLine2: null,
          addressCity: "Albuquerque",
          addressState: "NM",
          addressPostalCode: "87101",
          addressCountry: "US",
          createdAt: now,
          updatedAt: now,
        },
      ],
      history: [],
    };

    const clientView = bundleToRegistrationView(bundle as never);
    expect(clientView.draft.founders[0].ssn).toBe("123456789");

    const opsView = bundleToOpsView(bundle as never);
    expect(opsView.draft.founders[0].ssn).toBe("•••-••-6789");
    expect(JSON.stringify(opsView)).not.toContain("123456789");
  });
});
