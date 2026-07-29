import type { LlcDraft } from "../../shared/llc";

export const validDraft: LlcDraft = {
  currentStep: 6,
  legalName: "Northstar Studio",
  entitySuffix: "LLC",
  formationState: "WY",
  businessType: "coaching_and_courses",
  industryGroup: "trading_and_investing",
  industryType: "stock_trading",
  businessPhone: "+12125550100",
  website: "https://northstar.example",
  useRegisteredAgent: false,
  companyAddress: {
    line1: "100 Main Street",
    line2: "Suite 4",
    city: "Cheyenne",
    state: "WY",
    postalCode: "82001",
    country: "US",
  },
  expediteEin: false,
  accuracyAttested: true,
  founders: [
    {
      isPrimary: true,
      firstName: "Avery",
      lastName: "Stone",
      email: "avery@example.com",
      phone: "+12125550101",
      ssn: "",
      ownershipPercentage: 60,
      address: {
        line1: "10 Pine Road",
        line2: "",
        city: "Cheyenne",
        state: "WY",
        postalCode: "82001",
        country: "US",
      },
    },
    {
      isPrimary: false,
      firstName: "Jordan",
      lastName: "Lee",
      email: "jordan@example.com",
      phone: "+12125550102",
      ssn: "",
      ownershipPercentage: 40,
      address: {
        line1: "20 Birch Road",
        line2: "",
        city: "Cheyenne",
        state: "WY",
        postalCode: "82001",
        country: "US",
      },
    },
  ],
};

export type TestLlcStatus =
  | "draft"
  | "ready"
  | "submitting"
  | "payment_required"
  | "processing"
  | "completed"
  | "action_required"
  | "failed";

export function makePersistedBundle(status: TestLlcStatus = "ready") {
  const now = new Date("2026-07-21T12:00:00.000Z");
  return {
    registration: {
      id: 41,
      userId: 7,
      status,
      currentStep: 6,
      legalName: validDraft.legalName,
      entitySuffix: validDraft.entitySuffix,
      formationState: validDraft.formationState,
      businessType: validDraft.businessType,
      industryGroup: validDraft.industryGroup,
      industryType: validDraft.industryType,
      businessPhone: validDraft.businessPhone,
      website: validDraft.website,
      useRegisteredAgent: validDraft.useRegisteredAgent,
      companyAddressLine1: validDraft.companyAddress.line1,
      companyAddressLine2: validDraft.companyAddress.line2,
      companyAddressCity: validDraft.companyAddress.city,
      companyAddressState: validDraft.companyAddress.state,
      companyAddressPostalCode: validDraft.companyAddress.postalCode,
      companyAddressCountry: validDraft.companyAddress.country,
      expediteEin: validDraft.expediteEin,
      accuracyAttested: validDraft.accuracyAttested,
      whopAccountId: null as string | null,
      checkoutSessionId: null as string | null,
      checkoutUrl: null as string | null,
      checkoutTotal: null as number | null,
      checkoutCurrency: null as string | null,
      retailPriceCents: null as number | null,
      retailPaidAt: null as Date | null,
      providerStatus: null as Record<string, unknown> | null,
      lastProviderSyncAt: null as Date | null,
      lastErrorType: null as string | null,
      lastErrorMessage: null as string | null,
      retryable: false,
      submissionKey: "stable-submission-key",
      // Token-less by default so the URL pins in existing email tests stay
      // exact; token-mode tests set this explicitly (2026-07-28).
      statusToken: null as string | null,
      submittedAt: null as Date | null,
      createdAt: now,
      updatedAt: now,
    },
    founders: validDraft.founders.map((founder, index) => ({
      id: index + 1,
      registrationId: 41,
      sortOrder: index,
      isPrimary: founder.isPrimary,
      firstName: founder.firstName,
      lastName: founder.lastName,
      email: founder.email,
      phone: founder.phone,
      ownershipBasisPoints:
        founder.ownershipPercentage === undefined
          ? null
          : Math.round(founder.ownershipPercentage * 100),
      addressLine1: founder.address.line1,
      addressLine2: founder.address.line2,
      addressCity: founder.address.city,
      addressState: founder.address.state,
      addressPostalCode: founder.address.postalCode,
      addressCountry: founder.address.country,
      createdAt: now,
      updatedAt: now,
    })),
    attempts: [],
    history: [
      {
        id: 1,
        registrationId: 41,
        fromStatus: status === "draft" ? null : ("draft" as TestLlcStatus),
        toStatus: status,
        source: "user" as const,
        note: "Registration state fixture",
        createdAt: now,
      },
    ],
  };
}

export type TestRegistrationBundle = ReturnType<typeof makePersistedBundle>;
