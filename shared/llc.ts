import { z } from "zod";
import { isValidWhopTaxonomySelection } from "./whop-taxonomy";
import { DOOLA_VALID_INDUSTRIES } from "./doola-industries";
import {
  ACCEPTED_BUSINESS_AGENT_ACK_VERSIONS,
  ACCEPTED_MAILING_AGENT_ACK_VERSIONS,
  BUSINESS_AGENT_ACK,
  LLC_ADDRESS_MODES,
  MAILING_AGENT_ACK,
  agentBusinessAddressBlockedReason,
  nonStreetAddressReason,
  type LlcAddressMode,
} from "./llcAddress";

export const LLC_FORMATION_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;

/** Display names for supported formation states (client-facing copy). */
export const LLC_STATE_NAMES: Record<(typeof LLC_FORMATION_STATES)[number], string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "Washington, D.C.",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

export const LLC_ENTITY_SUFFIXES = [
  "LLC",
  "L.L.C",
  "L.L.C.",
  "Limited Liability Company",
] as const;

export const LLC_STATUSES = [
  "draft",
  "ready",
  "submitting",
  "payment_required",
  "processing",
  "completed",
  "action_required",
  "failed",
] as const;

export const LLC_STATUS_LABELS: Record<(typeof LLC_STATUSES)[number], string> = {
  draft: "Draft",
  ready: "Ready to submit",
  submitting: "Submitting securely",
  payment_required: "Payment required",
  processing: "Filing in progress",
  completed: "Formation completed",
  action_required: "Action required",
  failed: "Submission interrupted",
};

/**
 * Client-facing labels. The wholesale payment leg (payment_required) is an
 * internal operations step — clients only ever see "order received / filing
 * being prepared", never a payment state or the provider's name.
 */
export const LLC_CLIENT_STATUS_LABELS: Record<
  (typeof LLC_STATUSES)[number],
  string
> = {
  draft: "Draft",
  ready: "Ready to submit",
  submitting: "Submitting securely",
  payment_required: "Order received — preparing your filing",
  processing: "Filing in progress",
  completed: "Formation completed",
  action_required: "In review with our team",
  failed: "Submission interrupted",
};

/**
 * One-tap activity presets: common client profiles with direct Doola industry labels.
 * Each preset stores the exact Doola industry string (validated against their API).
 * The wizard uses businessType="doola_direct" as a marker that the new system is in use.
 */
export const LLC_ACTIVITY_PRESETS = [
  {
    key: "short_term_rental",
    label: "Short-term rental",
    description: "Airbnb, vacation rental, or VRBO property business",
    doolaIndustry: "Short term rentals",
    naicsCode: "721310",
  },
  {
    key: "airbnb_rentals",
    label: "Airbnb rentals",
    description: "Airbnb-specific rental hosting business",
    doolaIndustry: "Airbnb rentals",
    naicsCode: "721310",
  },
  {
    key: "vacation_rentals",
    label: "Vacation rentals",
    description: "Vacation rental or seasonal property business",
    doolaIndustry: "Vacation rentals",
    naicsCode: "531110",
  },
  {
    key: "rental_property",
    label: "Rental property",
    description: "Long-term or mixed rental property management",
    doolaIndustry: "Rental property",
    naicsCode: "531110",
  },
  {
    key: "real_estate_investing",
    label: "Real estate investing",
    description: "Real estate investment and holding company",
    doolaIndustry: "Real estate investing",
    naicsCode: "531390",
  },
  {
    key: "property_management",
    label: "Property management",
    description: "Managing rental properties for owners",
    doolaIndustry: "Property management",
    naicsCode: "531311",
  },
] as const;

/** Marker value for businessType when using the Doola-direct industry system */
export const DOOLA_DIRECT_MARKER = "doola_direct";

/**
 * Activity choices this app offers beside the one-tap presets and the
 * searchable industry list (the owner, 2026-10-29: "could you add this NAICS
 * code? NAICS Code: 541618 – Other Management Consulting Services"). Each is
 * keyed in the three-level activity style (businessType / industryGroup /
 * industryType), in the existing services / consulting group, so the order
 * keeps the client's own activity; server/llc/industryMap.ts maps it to the
 * filing industry label sent with the filing.
 */
export const LLC_ACTIVITY_CHOICES = [
  {
    key: "other_management_consulting",
    label: "Other management consulting services",
    description: "Management consulting for businesses and organizations",
    naicsCode: "541618",
    businessType: "services",
    industryGroup: "consulting",
    industryType: "other_management_consulting_services",
  },
] as const;

export type LlcActivityChoice = (typeof LLC_ACTIVITY_CHOICES)[number];

/** The app-offered activity choice these keys select, if any. */
export function findLlcActivityChoice(activity: {
  businessType?: string | null;
  industryGroup?: string | null;
  industryType?: string | null;
}): LlcActivityChoice | undefined {
  return LLC_ACTIVITY_CHOICES.find(
    (choice) =>
      choice.businessType === activity.businessType &&
      choice.industryGroup === activity.industryGroup &&
      choice.industryType === activity.industryType,
  );
}

/** How an activity reads to the client: an app choice by its label, otherwise the stored industry. */
export function llcActivityLabel(activity: {
  businessType?: string | null;
  industryGroup?: string | null;
  industryType?: string | null;
}): string {
  return findLlcActivityChoice(activity)?.label ?? activity.industryType ?? "";
}

/**
 * Returns true if the industry value is a valid Doola industry label.
 * Used for both step-level and complete-schema validation.
 */
export function isValidDoolaIndustry(industry: string): boolean {
  return DOOLA_VALID_INDUSTRIES.has(industry);
}

export const LLC_WIZARD_STEPS = [
  { id: 1, slug: "business", title: "Business" },
  { id: 2, slug: "activity", title: "Activity" },
  { id: 3, slug: "address", title: "Address" },
  { id: 4, slug: "founders", title: "Founders" },
  { id: 5, slug: "preferences", title: "Preferences" },
  { id: 6, slug: "review", title: "Review" },
] as const;

const trimmedDraftString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .or(z.literal(""));

const requiredTrimmedString = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

export const llcDraftAddressSchema = z.object({
  line1: trimmedDraftString(255),
  line2: trimmedDraftString(255),
  city: trimmedDraftString(120),
  state: trimmedDraftString(64),
  postalCode: trimmedDraftString(24),
  country: trimmedDraftString(2).default("US"),
});

export function normalizeSsn(value: string): string {
  return value.replace(/[\s-]/g, "");
}

/**
 * SSA-format validation: 9 digits; area not 000/666/900-999; group not 00;
 * serial not 0000. Optional — non-US founders leave it empty (which is also
 * the only configuration where Whop's expedited-EIN add-on is available).
 */
const completeSsnSchema = z
  .string()
  .trim()
  .transform(normalizeSsn)
  .refine((value) => /^\d{9}$/.test(value), {
    message: "Enter a 9-digit SSN, for example 123-45-6789",
  })
  .refine(
    (value) =>
      !/^(000|666|9)/.test(value) &&
      value.slice(3, 5) !== "00" &&
      value.slice(5) !== "0000",
    { message: "Enter a valid Social Security Number" },
  );

export const llcDraftFounderSchema = z.object({
  isPrimary: z.boolean().default(false),
  firstName: trimmedDraftString(100),
  lastName: trimmedDraftString(100),
  email: trimmedDraftString(320),
  phone: trimmedDraftString(32),
  ssn: trimmedDraftString(11),
  ownershipPercentage: z.number().min(0).max(100).optional(),
  address: llcDraftAddressSchema.default({ country: "US" }),
});

export const llcDraftSchema = z.object({
  currentStep: z.number().int().min(1).max(6),
  legalName: trimmedDraftString(160),
  entitySuffix: z.enum(LLC_ENTITY_SUFFIXES).default("LLC"),
  formationState: trimmedDraftString(2),
  businessType: trimmedDraftString(128),
  industryGroup: trimmedDraftString(128),
  industryType: trimmedDraftString(128),
  businessPhone: trimmedDraftString(32),
  website: trimmedDraftString(2048),
  /**
   * Legacy single switch (before 2026-10-14). Read-only now: the server
   * derives it from the two modes below on every save (on only when both are
   * the agent's) and ignores what a client sends, so an old browser tab can
   * never again send the agent's address by leaving it on.
   */
  useRegisteredAgent: z.boolean().default(false),
  /** The principal place of business on the state filing. Default: the client's own street address. */
  businessAddressMode: z.enum(LLC_ADDRESS_MODES).default("customer"),
  /** Where mail and the EIN letter go. Default: the client's business address. */
  mailingAddressMode: z.enum(LLC_ADDRESS_MODES).default("customer"),
  /** Wording version acknowledged for the agent's address as business address ("" = not acknowledged). */
  businessAgentAckVersion: z.string().trim().max(64).default(""),
  /** Wording version acknowledged for mail at the agent ("" = not acknowledged). */
  mailingAgentAckVersion: z.string().trim().max(64).default(""),
  /** The client's own address: used for every address entry that is "customer". */
  companyAddress: llcDraftAddressSchema.default({ country: "US" }),
  expediteEin: z.boolean().default(false),
  accuracyAttested: z.boolean().default(false),
  founders: z.array(llcDraftFounderSchema).max(10, "A maximum of 10 founders is supported"),
});

/**
 * Accepts US numbers exactly as people type them (7025550100,
 * (702) 555-0100, 1-702-555-0100) by normalizing to E.164; numbers from
 * other countries must carry their + country code.
 */
const e164PhoneSchema = z
  .string()
  .trim()
  .transform((value) => {
    const hasPlus = value.startsWith("+");
    const digits = value.replace(/\D/g, "");
    if (hasPlus) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return value;
  })
  .pipe(
    z
      .string()
      .regex(
        /^\+[1-9]\d{7,14}$/,
        "Enter a 10-digit US number, or include a + country code for international numbers",
      ),
  );

const completeAddressSchema = z.object({
  line1: requiredTrimmedString("Street address", 255),
  line2: z.string().trim().max(255).optional().or(z.literal("")),
  city: requiredTrimmedString("City", 120),
  state: requiredTrimmedString("State", 64),
  postalCode: requiredTrimmedString("ZIP or postal code", 24),
  country: z
    .string()
    .trim()
    .length(2, "Use a two-letter country code")
    .transform((value) => value.toUpperCase()),
});

const completeFounderSchema = z.object({
  isPrimary: z.boolean(),
  firstName: requiredTrimmedString("First name", 100),
  lastName: requiredTrimmedString("Last name", 100),
  email: z.string().trim().email("Enter a valid email address").max(320),
  phone: e164PhoneSchema,
  ssn: z
    .union([completeSsnSchema, z.literal("")])
    .optional()
    .transform((value) => value || undefined),
  ownershipPercentage: z
    .number({ error: "Ownership percentage is required" })
    .gt(0, "Ownership must be greater than 0%")
    .lte(100, "Ownership cannot exceed 100%")
    .refine(
      (value) => Number.isInteger(value * 100),
      "Use no more than two decimal places",
    ),
  address: completeAddressSchema,
});

export const llcBusinessStepSchema = z.object({
  legalName: requiredTrimmedString("Legal business name", 160),
  entitySuffix: z.enum(LLC_ENTITY_SUFFIXES),
  formationState: z.enum(LLC_FORMATION_STATES, {
    error: "Select a supported formation state",
  }),
  businessPhone: z
    .union([e164PhoneSchema, z.literal("")])
    .optional()
    .transform((value) => value || undefined),
  website: z
    .union([
      z.string().trim().url("Enter a complete URL beginning with https://"),
      z.literal(""),
    ])
    .optional()
    .transform((value) => value || undefined),
});

export const llcActivityStepSchema = z
  .object({
    businessType: requiredTrimmedString("Business type", 128),
    industryGroup: requiredTrimmedString("Industry group", 128),
    industryType: requiredTrimmedString("Industry", 128),
  })
  .superRefine((value, context) => {
    // New system: businessType === "doola_direct" means industryType is a Doola label
    if (value.businessType === DOOLA_DIRECT_MARKER) {
      if (!isValidDoolaIndustry(value.industryType)) {
        context.addIssue({
          code: "custom",
          path: ["industryType"],
          message: "Select a valid industry from the list",
        });
      }
      return;
    }
    // Legacy path: whop-taxonomy validation for old registrations, plus this
    // app's own activity choices (LLC_ACTIVITY_CHOICES).
    if (
      !isValidWhopTaxonomySelection(
        value.businessType,
        value.industryGroup,
        value.industryType,
      ) &&
      !findLlcActivityChoice(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["industryType"],
        message: "Select a valid business type, group, and industry combination",
      });
    }
  });

export type LlcAddressPlanInput = {
  formationState?: string | null;
  businessAddressMode: LlcAddressMode;
  mailingAddressMode: LlcAddressMode;
  businessAgentAckVersion?: string | null;
  mailingAgentAckVersion?: string | null;
  companyAddress: z.input<typeof llcDraftAddressSchema>;
  businessPhone?: string | null;
};

export type LlcAddressPlanIssueCode =
  | "state_requires_own_business_address"
  | "business_agent_ack_missing"
  | "mailing_agent_ack_missing"
  | "address_incomplete"
  | "address_not_street"
  | "phone_missing"
  | "phone_invalid";

export type LlcAddressPlanIssue = {
  code: LlcAddressPlanIssueCode;
  path: (string | number)[];
  message: string;
};

/**
 * Every reason an order's address choices cannot be filed (2026-10-14). One
 * rule set for the wizard (Step 3), final validation, and the server's filing
 * gate:
 *  - the agent's address as business address where the state refuses it;
 *  - either agent opt-in without its acknowledgment (a wording version the
 *    client actually saw; new orders must carry the current version);
 *  - the client's own address used anywhere without a full street address
 *    (no PO box, no "c/o"), or without a business phone.
 * Messages are plain words and never contain the address itself.
 */
export function llcAddressPlanIssues(
  input: LlcAddressPlanInput,
  options: {
    acceptedBusinessAckVersions?: readonly string[];
    acceptedMailingAckVersions?: readonly string[];
  } = {},
): LlcAddressPlanIssue[] {
  const issues: LlcAddressPlanIssue[] = [];
  const businessVersions = options.acceptedBusinessAckVersions ?? [BUSINESS_AGENT_ACK.version];
  const mailingVersions = options.acceptedMailingAckVersions ?? [MAILING_AGENT_ACK.version];

  if (input.businessAddressMode === "registered_agent") {
    const blocked = agentBusinessAddressBlockedReason(input.formationState);
    if (blocked) {
      issues.push({ code: "state_requires_own_business_address", path: ["businessAddressMode"], message: blocked });
    }
    if (!businessVersions.includes((input.businessAgentAckVersion ?? "").trim())) {
      issues.push({
        code: "business_agent_ack_missing",
        path: ["businessAgentAckVersion"],
        message: "Check the box to confirm, or use your own street address instead.",
      });
    }
  }

  if (input.mailingAddressMode === "registered_agent") {
    if (!mailingVersions.includes((input.mailingAgentAckVersion ?? "").trim())) {
      issues.push({
        code: "mailing_agent_ack_missing",
        path: ["mailingAgentAckVersion"],
        message: "Check the box to confirm, or have mail sent to your own address instead.",
      });
    }
  }

  if (input.businessAddressMode === "customer" || input.mailingAddressMode === "customer") {
    const addressResult = completeAddressSchema.safeParse(input.companyAddress);
    if (!addressResult.success) {
      for (const issue of addressResult.error.issues) {
        issues.push({
          code: "address_incomplete",
          path: ["companyAddress", ...(issue.path as (string | number)[])],
          message: issue.message,
        });
      }
    }
    for (const field of ["line1", "line2"] as const) {
      const reason = nonStreetAddressReason(input.companyAddress[field]);
      if (reason) {
        issues.push({
          code: "address_not_street",
          path: ["companyAddress", field],
          message:
            reason === "po_box"
              ? "Use a street address. A PO box can't be used here."
              : "Use your own street address here, without \"c/o\".",
        });
      }
    }
    // Provider contract, kept from before: a phone always rides with the
    // client's own address. A phone typed wrong is called wrong, not
    // missing: Step 3 now has its own phone field.
    const phone = (input.businessPhone ?? "").trim();
    const phoneCheck = phone ? e164PhoneSchema.safeParse(phone) : null;
    if (!phone) {
      issues.push({
        code: "phone_missing",
        path: ["businessPhone"],
        message: "A business phone is required when using your own company address",
      });
    } else if (phoneCheck && !phoneCheck.success) {
      issues.push({
        code: "phone_invalid",
        path: ["businessPhone"],
        message: phoneCheck.error.issues[0]?.message ?? "Enter a valid business phone number",
      });
    }
  }

  return issues;
}

/** The same rules for an order already on file, accepting every wording version still honored. */
export function llcAddressPlanIssuesForFiling(input: LlcAddressPlanInput): LlcAddressPlanIssue[] {
  return llcAddressPlanIssues(input, {
    acceptedBusinessAckVersions: ACCEPTED_BUSINESS_AGENT_ACK_VERSIONS,
    acceptedMailingAckVersions: ACCEPTED_MAILING_AGENT_ACK_VERSIONS,
  });
}

function addAddressPlanIssues(
  input: LlcAddressPlanInput,
  context: { addIssue: (issue: { code: "custom"; path: (string | number)[]; message: string }) => void },
) {
  for (const issue of llcAddressPlanIssues(input)) {
    context.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
}

export const llcAddressStepSchema = z
  .object({
    formationState: z.string().trim().max(2).optional().or(z.literal("")),
    businessAddressMode: z.enum(LLC_ADDRESS_MODES),
    mailingAddressMode: z.enum(LLC_ADDRESS_MODES),
    businessAgentAckVersion: z.string().trim().max(64).optional(),
    mailingAgentAckVersion: z.string().trim().max(64).optional(),
    companyAddress: llcDraftAddressSchema,
    businessPhone: z.string().trim().max(32).optional().or(z.literal("")),
  })
  .superRefine((value, context) => addAddressPlanIssues(value, context));

export const llcFoundersStepSchema = z
  .object({
    founders: z
      .array(completeFounderSchema)
      .min(1, "Add at least one founder")
      .max(10, "A maximum of 10 founders is supported"),
  })
  .superRefine((value, context) => {
    const primaryCount = value.founders.filter((founder) => founder.isPrimary).length;
    if (primaryCount !== 1) {
      context.addIssue({
        code: "custom",
        path: ["founders"],
        message: "Mark exactly one founder as the primary responsible party",
      });
    }

    const totalBasisPoints = value.founders.reduce(
      (total, founder) => total + Math.round(founder.ownershipPercentage * 100),
      0,
    );
    if (totalBasisPoints !== 10_000) {
      context.addIssue({
        code: "custom",
        path: ["founders"],
        message: "Founder ownership percentages must total exactly 100%",
      });
    }
  });

export const llcPreferencesStepSchema = z.object({
  expediteEin: z.boolean(),
});

export const llcReviewStepSchema = z.object({
  accuracyAttested: z.literal(true, {
    error: "Confirm that the information is accurate before submitting",
  }),
});

export const llcCompleteSchema = z
  .object({
    currentStep: z.literal(6),
    legalName: requiredTrimmedString("Legal business name", 160),
    entitySuffix: z.enum(LLC_ENTITY_SUFFIXES),
    formationState: z.enum(LLC_FORMATION_STATES, {
      error: "Select a supported formation state",
    }),
    businessType: requiredTrimmedString("Business type", 128),
    industryGroup: requiredTrimmedString("Industry group", 128),
    industryType: requiredTrimmedString("Industry", 128),
    businessPhone: z
      .union([e164PhoneSchema, z.literal("")])
      .optional()
      .transform((value) => value || undefined),
    website: z
      .union([
        z.string().trim().url("Enter a complete URL beginning with https://"),
        z.literal(""),
      ])
      .optional()
      .transform((value) => value || undefined),
    useRegisteredAgent: z.boolean(),
    businessAddressMode: z.enum(LLC_ADDRESS_MODES),
    mailingAddressMode: z.enum(LLC_ADDRESS_MODES),
    businessAgentAckVersion: z.string().trim().max(64).default(""),
    mailingAgentAckVersion: z.string().trim().max(64).default(""),
    companyAddress: llcDraftAddressSchema,
    expediteEin: z.boolean(),
    accuracyAttested: z.literal(true, {
      error: "Confirm that the information is accurate before submitting",
    }),
    founders: z
      .array(completeFounderSchema)
      .min(1, "Add at least one founder")
      .max(10, "A maximum of 10 founders is supported"),
  })
  .superRefine((value, context) => {
    // New system: businessType === "doola_direct" means industryType is a Doola label
    if (value.businessType === DOOLA_DIRECT_MARKER) {
      if (!isValidDoolaIndustry(value.industryType)) {
        context.addIssue({
          code: "custom",
          path: ["industryType"],
          message: "Select a valid industry from the list",
        });
      }
    } else if (
      !isValidWhopTaxonomySelection(
        value.businessType,
        value.industryGroup,
        value.industryType,
      ) &&
      !findLlcActivityChoice(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["industryType"],
        message: "Select a valid business type, group, and industry combination",
      });
    }

    // Address choices (2026-10-14): the business address and the mail
    // address are checked separately, the old single switch is ignored. The
    // phone rule rides along (required whenever the client's own address is
    // used), so an own-address order can never be rejected downstream for a
    // missing phone.
    addAddressPlanIssues(value, context);

    const primaryCount = value.founders.filter((founder) => founder.isPrimary).length;
    if (primaryCount !== 1) {
      context.addIssue({
        code: "custom",
        path: ["founders"],
        message: "Mark exactly one founder as the primary responsible party",
      });
    }

    const totalBasisPoints = value.founders.reduce(
      (total, founder) => total + Math.round(founder.ownershipPercentage * 100),
      0,
    );
    if (totalBasisPoints !== 10_000) {
      context.addIssue({
        code: "custom",
        path: ["founders"],
        message: "Founder ownership percentages must total exactly 100%",
      });
    }
  })
  // Whop's contract: expedited EIN is available ONLY when no founder supplies
  // an SSN (an SSN already unlocks the fastest IRS path). Coerce rather than
  // error so a founder adding an SSN late never dead-ends the submission.
  .transform((value) => ({
    ...value,
    expediteEin:
      value.expediteEin && !value.founders.some((founder) => founder.ssn),
  }));

export const llcStatusSchema = z.enum(LLC_STATUSES);

export function validateLlcStep(step: number, draft: LlcDraft) {
  switch (step) {
    case 1:
      return llcBusinessStepSchema.safeParse(draft);
    case 2:
      return llcActivityStepSchema.safeParse(draft);
    case 3:
      return llcAddressStepSchema.safeParse(draft);
    case 4:
      return llcFoundersStepSchema.safeParse(draft);
    case 5:
      return llcPreferencesStepSchema.safeParse(draft);
    case 6:
      return llcCompleteSchema.safeParse({ ...draft, currentStep: 6 });
    default:
      return z.never().safeParse(draft);
  }
}

export type LlcDraftInput = z.input<typeof llcDraftSchema>;
export type LlcDraft = z.output<typeof llcDraftSchema>;
export type LlcCompleteInput = z.input<typeof llcCompleteSchema>;
export type LlcComplete = z.output<typeof llcCompleteSchema>;
export type LlcFounder = z.output<typeof completeFounderSchema>;
export type LlcStatus = z.output<typeof llcStatusSchema>;

export function issuesByField(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    fields[key] ??= issue.message;
  }
  return fields;
}
