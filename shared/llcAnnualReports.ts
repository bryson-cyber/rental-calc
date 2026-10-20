/**
 * Annual report filing (the owner, 2026-10-20): the rules and words the member page and the server share. Pure: no
 * provider names, no I/O. The server validates with the same functions the page uses to show and hide questions, so
 * a question the page hides is never sent and a question the page asks is never refused for being hidden.
 *
 * Field types (the provider's requirements): TEXT, NUMBER, SELECT, RADIO, AMOUNT, DATE, BOOLEAN, ADDRESS.
 * A field with `dependsOn` is shown, required and accepted only while the field it depends on is shown and answered
 * with `dependsOn.answer`; a chain of gates is followed to the end.
 */

export type AnnualReportFieldType = "TEXT" | "NUMBER" | "SELECT" | "RADIO" | "AMOUNT" | "DATE" | "BOOLEAN" | "ADDRESS";

export type AnnualReportAddressValue = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type AnnualReportValue = string | number | boolean | AnnualReportAddressValue;

/** One question as the member page gets it (labels scrubbed of any provider name on the server). */
export type MemberAnnualReportField = {
  fieldId: string;
  label: string;
  type: AnnualReportFieldType;
  group: "QUESTION" | "COMPANY_DETAIL";
  required: boolean;
  affectsFee: boolean;
  options: Array<{ value: string; label: string }>;
  dependsOn: { fieldId: string; answer: string } | null;
};

export type AnnualReportAnswers = Record<string, AnnualReportValue | null | undefined>;

/** "true" for true, "12" for 12, the trimmed lower-cased text otherwise; "" for nothing. */
export function answerKey(value: AnnualReportValue | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") return value.trim().toLowerCase();
  return "";
}

/** The fields shown for these answers, in the provider's order. */
export function visibleFields<F extends Pick<MemberAnnualReportField, "fieldId" | "dependsOn">>(fields: readonly F[], answers: AnnualReportAnswers): F[] {
  const byId = new Map(fields.map((field) => [field.fieldId, field]));
  const memo = new Map<string, boolean>();
  const shown = (field: F, seen: Set<string>): boolean => {
    const known = memo.get(field.fieldId);
    if (known !== undefined) return known;
    let result = true;
    if (field.dependsOn) {
      const gate = byId.get(field.dependsOn.fieldId);
      // A gate on a field we were not given, or a loop, keeps the field hidden (never sent, never required).
      if (!gate || seen.has(gate.fieldId)) result = false;
      else {
        seen.add(field.fieldId);
        result = shown(gate, seen) && answerKey(answers[gate.fieldId]) === answerKey(field.dependsOn.answer);
      }
    }
    memo.set(field.fieldId, result);
    return result;
  };
  return fields.filter((field) => shown(field, new Set()));
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function validDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

function isEmpty(value: AnnualReportValue | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return !Number.isFinite(value);
  if (typeof value === "object") return !value.line1?.trim() && !value.city?.trim() && !value.postalCode?.trim();
  return false;
}

function toNumber(value: AnnualReportValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,\s]/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    return Number(cleaned);
  }
  return null;
}

/** One answer cleaned to the type the field takes, or the reason it can't be, in plain words. */
export function cleanAnswer(field: MemberAnnualReportField, value: AnnualReportValue): { value: AnnualReportValue } | { error: string } {
  switch (field.type) {
    case "TEXT": {
      if (typeof value !== "string" && typeof value !== "number") return { error: "Type an answer." };
      const text = String(value).trim();
      return text.length > 500 ? { error: "Keep this under 500 characters." } : { value: text };
    }
    case "NUMBER": {
      const number = toNumber(value);
      return number === null ? { error: "Enter a number." } : { value: number };
    }
    case "AMOUNT": {
      const number = toNumber(value);
      if (number === null || number < 0) return { error: "Enter a dollar amount, like 2500." };
      return { value: Math.round(number * 100) / 100 };
    }
    case "SELECT":
    case "RADIO": {
      const text = String(value).trim();
      if (field.options.length === 0) return text ? { value: text } : { error: "Pick an answer." };
      const option = field.options.find((candidate) => candidate.value === text || candidate.value.toLowerCase() === text.toLowerCase());
      return option ? { value: option.value } : { error: "Pick one of the answers shown." };
    }
    case "DATE": {
      const text = String(value).trim();
      return validDate(text) ? { value: text } : { error: "Enter a date." };
    }
    case "BOOLEAN": {
      if (typeof value === "boolean") return { value };
      const text = String(value).trim().toLowerCase();
      if (text === "true" || text === "yes") return { value: true };
      if (text === "false" || text === "no") return { value: false };
      return { error: "Pick yes or no." };
    }
    case "ADDRESS": {
      if (!value || typeof value !== "object") return { error: "Enter the full address." };
      const address = value as AnnualReportAddressValue;
      const line1 = String(address.line1 ?? "").trim();
      const city = String(address.city ?? "").trim();
      const state = String(address.state ?? "").trim();
      const postalCode = String(address.postalCode ?? "").trim();
      if (!line1 || !city || !state || !postalCode) return { error: "Enter the street, city, state and ZIP code." };
      const line2 = String(address.line2 ?? "").trim();
      return {
        value: {
          line1: line1.slice(0, 200),
          ...(line2 ? { line2: line2.slice(0, 200) } : {}),
          city: city.slice(0, 120),
          state: state.slice(0, 64),
          postalCode: postalCode.slice(0, 20),
          country: String(address.country ?? "").trim().slice(0, 3).toUpperCase() || "USA",
        },
      };
    }
    default:
      return { error: "This question can't be answered here." };
  }
}

export type AnnualReportValidation = {
  ok: boolean;
  /** fieldId → the problem, in plain words. */
  errors: Record<string, string>;
  /** Only shown fields that were answered, cleaned. Hidden and unknown fields are dropped, never sent. */
  cleaned: Record<string, AnnualReportValue>;
};

export function validateAnnualReportAnswers(fields: readonly MemberAnnualReportField[], answers: AnnualReportAnswers): AnnualReportValidation {
  const errors: Record<string, string> = {};
  const cleaned: Record<string, AnnualReportValue> = {};
  for (const field of visibleFields(fields, answers)) {
    const value = answers[field.fieldId];
    if (isEmpty(value)) {
      if (field.required) errors[field.fieldId] = field.type === "SELECT" || field.type === "RADIO" || field.type === "BOOLEAN" ? "Pick an answer." : "This one is needed.";
      continue;
    }
    const result = cleanAnswer(field, value as AnnualReportValue);
    if ("error" in result) errors[field.fieldId] = result.error;
    else cleaned[field.fieldId] = result.value;
  }
  return { ok: Object.keys(errors).length === 0, errors, cleaned };
}

// ─── Plain words ───────────────────────────────────────────────────────────────────────────────────────────────────

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2027-03-01" → "March 1, 2027"; null for anything else. */
export function dateWords(value: string | null | undefined): string | null {
  const match = DATE_RE.exec(String(value ?? "").slice(0, 10));
  if (!match || !validDate(match[0])) return null;
  return `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}`;
}

/** "$60", "$62.50". */
export function feeWords(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** The member card's state. */
export type AnnualReportCardState =
  | "checking"
  | "not_required"
  | "not_yet_due"
  | "confirming_year"
  | "due"
  | "overdue"
  | "saved"
  | "paid_finishing"
  | "filing"
  | "awaiting_information"
  | "filed";

export const ANNUAL_REPORT_CARD_HEADLINES: Record<AnnualReportCardState, string> = {
  checking: "We're checking your state's annual report date",
  not_required: "Your state doesn't require an annual report",
  not_yet_due: "Not due yet",
  confirming_year: "We're confirming your filing year",
  due: "Your annual report is coming up",
  overdue: "Your annual report is past due",
  saved: "Your answers are saved",
  paid_finishing: "We've got your payment",
  filing: "We're filing it with the state",
  awaiting_information: "Our team is reviewing a detail",
  filed: "Your annual report is filed",
};

/** Words the member sees for a report's status in the history list. */
export const ANNUAL_REPORT_STATUS_WORDS: Record<string, string> = {
  FILLED: "Answers saved, not filed yet",
  IN_PROGRESS: "Being filed with the state",
  AWAITING_INFORMATION: "Our team is reviewing a detail",
  FILING_COMPLETED: "Filed",
};

export const ANNUAL_REPORT_MINIMUM_FEE_NOTE = "This is the starting fee. The final fee is set when you submit your answers.";

/** The member view of her annual report for one LLC (llc.annualReport). */
export type MemberAnnualReportView = {
  registrationId: number;
  stateName: string;
  cardState: AnnualReportCardState;
  headline: string;
  body: string;
  dueDate: string | null;
  dueDateWords: string | null;
  /** The day filing opens, in words, while it isn't open yet. */
  opensOnWords: string | null;
  canFile: boolean;
  /** The state's fee quote before she answers, when known. */
  quote: { priceCents: number; isMinimum: boolean } | null;
  current: {
    id: number;
    fiscalYear: number;
    status: string | null;
    statusWords: string;
    priceCents: number | null;
    paid: boolean;
    confirmed: boolean;
    filedOnWords: string | null;
    canEdit: boolean;
    needsPayment: boolean;
  } | null;
  history: Array<{ fiscalYear: number; statusWords: string; filedOnWords: string | null }>;
};
