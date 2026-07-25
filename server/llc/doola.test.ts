import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DoolaApiError,
  DoolaConfigurationError,
  deriveBusinessDescription,
  deriveDoolaIndustry,
  formatSsnForDoola,
  getDoolaConfig,
  getDoolaWebhookSecret,
  mapRegistrationToDoolaCompany,
  mapRegistrationToDoolaCustomer,
  normalizeDoolaCompanyStatus,
  normalizeDoolaDocumentType,
  toIso3Country,
} from "./doola";
import { encryptPii } from "./pii";

const TEST_KEY = "a".repeat(64);

const now = new Date("2026-07-24T12:00:00.000Z");

function makeRegistration(overrides: Record<string, unknown> = {}) {
  return {
    id: 41,
    userId: 7,
    status: "payment_required",
    currentStep: 6,
    legalName: "Amara Rose Stays",
    entitySuffix: "LLC",
    formationState: "GA",
    businessType: "brick_and_mortar",
    industryGroup: "hospitality_and_lodging",
    industryType: "vacation_rental_property",
    businessPhone: "+17025550100",
    website: null,
    useRegisteredAgent: true,
    companyAddressLine1: null,
    companyAddressLine2: null,
    companyAddressCity: null,
    companyAddressState: null,
    companyAddressPostalCode: null,
    companyAddressCountry: "US",
    expediteEin: false,
    accuracyAttested: true,
    whopAccountId: null,
    accountEmailAlias: null,
    checkoutSessionId: null,
    checkoutUrl: null,
    checkoutTotal: null,
    checkoutCurrency: null,
    retailPriceCents: 59900,
    retailPaidAt: now,
    opsNotifiedAt: null,
    providerStatus: null,
    lastProviderSyncAt: null,
    lastErrorType: null,
    lastErrorMessage: null,
    retryable: false,
    submissionKey: "abc123",
    isTest: false,
    provider: "doola",
    doolaCustomerId: null,
    doolaCompanyId: null,
    ein: null,
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as never;
}

function makeFounder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    registrationId: 41,
    sortOrder: 0,
    isPrimary: true,
    firstName: "Amara",
    lastName: "Johnson",
    email: "amara@example.com",
    phone: "+14045550137",
    ssnEncrypted: null,
    ownershipBasisPoints: 10_000,
    addressLine1: "1847 Peachtree Walk NE",
    addressLine2: null,
    addressCity: "Atlanta",
    addressState: "GA",
    addressPostalCode: "30309",
    addressCountry: "US",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as never;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Doola configuration", () => {
  it("accepts sandbox and live keys, rejects everything else", () => {
    vi.stubEnv("DOOLA_API_KEY", "dk_test_abcdefghijklmnop");
    expect(getDoolaConfig().apiKey).toBe("dk_test_abcdefghijklmnop");
    vi.stubEnv("DOOLA_API_KEY", "dk_live_abcdefghijklmnop");
    expect(getDoolaConfig().apiKey).toBe("dk_live_abcdefghijklmnop");
    vi.stubEnv("DOOLA_API_KEY", "sk_whatever");
    expect(() => getDoolaConfig()).toThrow(DoolaConfigurationError);
  });

  it("locks the base URL to the doola production or sandbox hosts over HTTPS", () => {
    vi.stubEnv("DOOLA_API_KEY", "dk_test_abcdefghijklmnop");
    vi.stubEnv("DOOLA_API_BASE_URL", "https://api.test.doola.com");
    expect(getDoolaConfig().baseUrl).toBe("https://api.test.doola.com");
    vi.stubEnv("DOOLA_API_BASE_URL", "https://evil.example.com");
    expect(() => getDoolaConfig()).toThrow(DoolaConfigurationError);
    vi.stubEnv("DOOLA_API_BASE_URL", "http://api.doola.com");
    expect(() => getDoolaConfig()).toThrow(DoolaConfigurationError);
  });

  it("requires a plausible webhook secret", () => {
    vi.stubEnv("DOOLA_WEBHOOK_SECRET", "short");
    expect(getDoolaWebhookSecret()).toBeNull();
    vi.stubEnv("DOOLA_WEBHOOK_SECRET", "a-sufficiently-long-secret");
    expect(getDoolaWebhookSecret()).toBe("a-sufficiently-long-secret");
  });
});

describe("Doola request mapping", () => {
  it("maps the primary founder to the customer payload with alpha-3 country", () => {
    const customer = mapRegistrationToDoolaCustomer(makeRegistration(), [makeFounder()]);
    expect(customer).toEqual({
      email: "amara@example.com",
      firstName: "Amara",
      lastName: "Johnson",
      countryOfResidence: "USA",
      phoneNumber: "+14045550137",
    });
  });

  it("registered-agent mode routes BOTH addresses through the RA with no address objects", () => {
    const company = mapRegistrationToDoolaCompany(makeRegistration(), [makeFounder()], "dc_1");
    expect(company.addresses).toEqual([
      { provider: "registeredAgent", type: "mailing" },
      { provider: "registeredAgent", type: "business" },
    ]);
  });

  it("own-address mode sends the company address for both entries with the business phone", () => {
    const registration = makeRegistration({
      useRegisteredAgent: false,
      companyAddressLine1: "500 Main St",
      companyAddressCity: "Las Vegas",
      companyAddressState: "NV",
      companyAddressPostalCode: "89101",
      companyAddressCountry: "US",
    });
    const company = mapRegistrationToDoolaCompany(registration, [makeFounder()], "dc_1");
    const addresses = company.addresses as Array<{ provider: string; type: string; address?: { line1: string; phone?: string } }>;
    expect(addresses).toHaveLength(2);
    for (const entry of addresses) {
      expect(entry.provider).toBe("customer");
      expect(entry.address?.line1).toBe("500 Main St");
      expect(entry.address?.phone).toBe("+17025550100");
    }
  });

  it("formats decrypted SSNs as XXX-XX-XXXX and omits them when absent", () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", TEST_KEY);
    const withSsn = mapRegistrationToDoolaCompany(
      makeRegistration(),
      [makeFounder({ ssnEncrypted: encryptPii("123456789") })],
      "dc_1",
    );
    expect((withSsn.responsibleParty as { ssn?: string }).ssn).toBe("123-45-6789");
    expect((withSsn.members as Array<{ ssn?: string }>)[0].ssn).toBe("123-45-6789");

    const withoutSsn = mapRegistrationToDoolaCompany(makeRegistration(), [makeFounder()], "dc_1");
    expect(withoutSsn.responsibleParty).not.toHaveProperty("ssn");
    expect((withoutSsn.members as Array<Record<string, unknown>>)[0]).not.toHaveProperty("ssn");
  });

  it("converts ownership basis points to percent and always requests standard EIN", () => {
    const company = mapRegistrationToDoolaCompany(
      makeRegistration(),
      [makeFounder({ ownershipBasisPoints: 2_550, isPrimary: true })],
      "dc_1",
    );
    expect((company.members as Array<{ ownershipPercent: number }>)[0].ownershipPercent).toBe(25.5);
    expect(company.requestedServices).toEqual([{ service: "EinCreation", variant: "Standard" }]);
  });

  it("derives Doola's industry label from the matching activity preset", () => {
    expect(deriveDoolaIndustry(makeRegistration())).toBe("Vacation rentals");
    expect(
      deriveDoolaIndustry(makeRegistration({ industryType: "something_custom" })),
    ).toBeUndefined();
    const company = mapRegistrationToDoolaCompany(makeRegistration(), [makeFounder()], "dc_1");
    expect(company.industry).toBe("Vacation rentals");
    expect(company).not.toHaveProperty("naicsCode");
  });

  it("derives a human description from the taxonomy", () => {
    expect(deriveBusinessDescription(makeRegistration())).toBe(
      "Vacation rental property business",
    );
    expect(
      deriveBusinessDescription(makeRegistration({ industryType: null, industryGroup: null, businessType: null })),
    ).toBe("General business activities");
  });

  it("normalizes bare US phones to E.164 everywhere Doola sees a phone", () => {
    const customer = mapRegistrationToDoolaCustomer(
      makeRegistration(),
      [makeFounder({ phone: "7025550100" })],
    );
    expect(customer.phoneNumber).toBe("+17025550100");

    const company = mapRegistrationToDoolaCompany(
      makeRegistration(),
      [makeFounder({ phone: "(702) 555-0100" })],
      "dc_1",
    );
    expect((company.responsibleParty as { address: { phone: string } }).address.phone).toBe(
      "+17025550100",
    );
    expect((company.members as Array<{ address: { phone: string } }>)[0].address.phone).toBe(
      "+17025550100",
    );
  });

  it("maps common alpha-2 countries and refuses unknowns", () => {
    expect(toIso3Country("US")).toBe("USA");
    expect(toIso3Country("gb")).toBe("GBR");
    expect(toIso3Country(null)).toBe("USA");
    expect(() => toIso3Country("XX")).toThrow(DoolaApiError);
  });

  it("formats SSNs defensively", () => {
    expect(formatSsnForDoola("123456789")).toBe("123-45-6789");
    expect(formatSsnForDoola("123-45-6789")).toBe("123-45-6789");
    expect(formatSsnForDoola("12345")).toBeUndefined();
    expect(formatSsnForDoola(null)).toBeUndefined();
  });
});

describe("Doola status normalization", () => {
  it("maps documented document types to the vault vocabulary", () => {
    expect(normalizeDoolaDocumentType("ArticlesOfOrganization")).toBe("articles_of_organization");
    expect(normalizeDoolaDocumentType("EinLetter")).toBe("ein_letter");
    expect(normalizeDoolaDocumentType("OperatingAgreement")).toBe("operating_agreement");
    expect(normalizeDoolaDocumentType("Mail")).toBe("mail");
    expect(normalizeDoolaDocumentType("SignedSS4")).toBe("signed_ss4");
    expect(normalizeDoolaDocumentType(undefined)).toBeNull();
  });

  it("submitted formation without milestones is processing", () => {
    const result = normalizeDoolaCompanyStatus({ formationSubmissionStatus: "SUBMITTED" });
    expect(result.localStatus).toBe("processing");
    expect(result.ein).toBeNull();
  });

  it("FAILED submission demands ops attention", () => {
    const result = normalizeDoolaCompanyStatus({ formationSubmissionStatus: "FAILED" });
    expect(result.localStatus).toBe("action_required");
  });

  it("a pending SS-4 signature outranks progress", () => {
    const result = normalizeDoolaCompanyStatus({
      formationSubmissionStatus: "SUBMITTED",
      signatureRequirements: [{ documentType: "SS4", status: "PENDING" }],
    });
    expect(result.localStatus).toBe("action_required");
    expect(result.snapshot.signatures?.[0]?.form).toBe("ss4");
  });

  it("filing date alone is processing (EIN outstanding); filing date + EIN is completed", () => {
    const filedOnly = normalizeDoolaCompanyStatus({
      formationSubmissionStatus: "SUBMITTED",
      formationFilingDate: "2026-07-30",
    });
    expect(filedOnly.localStatus).toBe("processing");

    const complete = normalizeDoolaCompanyStatus({
      formationSubmissionStatus: "SUBMITTED",
      formationFilingDate: "2026-07-30",
      ein: "99-1234567",
    });
    expect(complete.localStatus).toBe("completed");
    expect(complete.ein).toBe("99-1234567");
    expect(complete.snapshot.ein_registered).toBe(true);
    expect(complete.snapshot.state_registered).toBe(true);
  });

  it("normalizes documents into the shared snapshot shape", () => {
    const result = normalizeDoolaCompanyStatus({ formationSubmissionStatus: "SUBMITTED" }, [
      {
        id: "doc_1",
        name: "Articles of Organization",
        documentType: "ArticlesOfOrganization",
        downloadUrl: "https://cdn.doola.example/a.pdf",
      },
    ]);
    expect(result.snapshot.documents?.[0]).toEqual({
      id: "doc_1",
      name: "Articles of Organization",
      document_type: "articles_of_organization",
      download_url: "https://cdn.doola.example/a.pdf",
    });
  });
});
