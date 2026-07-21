import { z } from "zod";
import { isValidWhopTaxonomySelection } from "./whop-taxonomy";

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
 * One-tap activity presets: verified provider-taxonomy triples for common
 * client profiles. A validity test guards these against taxonomy
 * regeneration drift.
 */
export const LLC_ACTIVITY_PRESETS = [
  {
    key: "clothing_brand",
    label: "Clothing brand",
    description: "Apparel, streetwear, boutique, or custom clothing",
    businessType: "physical_product",
    industryGroup: "clothing_and_apparel",
    industryType: "casual_everyday_clothing",
  },
] as const;

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
  useRegisteredAgent: z.boolean().default(false),
  companyAddress: llcDraftAddressSchema.default({ country: "US" }),
  expediteEin: z.boolean().default(false),
  accuracyAttested: z.boolean().default(false),
  founders: z.array(llcDraftFounderSchema).max(10, "A maximum of 10 founders is supported"),
});

const e164PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Use international format, for example +12125550100");

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
    if (
      !isValidWhopTaxonomySelection(
        value.businessType,
        value.industryGroup,
        value.industryType,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["industryType"],
        message: "Select a valid business type, group, and industry combination",
      });
    }
  });

export const llcAddressStepSchema = z
  .object({
    useRegisteredAgent: z.boolean(),
    companyAddress: llcDraftAddressSchema,
  })
  .superRefine((value, context) => {
    if (value.useRegisteredAgent) return;
    const addressResult = completeAddressSchema.safeParse(value.companyAddress);
    if (!addressResult.success) {
      for (const issue of addressResult.error.issues) {
        context.addIssue({
          ...issue,
          path: ["companyAddress", ...issue.path],
        });
      }
    }
  });

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
    if (
      !isValidWhopTaxonomySelection(
        value.businessType,
        value.industryGroup,
        value.industryType,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["industryType"],
        message: "Select a valid business type, group, and industry combination",
      });
    }

    if (!value.useRegisteredAgent) {
      const addressResult = completeAddressSchema.safeParse(value.companyAddress);
      if (!addressResult.success) {
        for (const issue of addressResult.error.issues) {
          context.addIssue({
            ...issue,
            path: ["companyAddress", ...issue.path],
          });
        }
      }
    }

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
