import { describe, expect, it } from "vitest";
import {
  dateWords,
  feeWords,
  validateAnnualReportAnswers,
  visibleFields,
  type MemberAnnualReportField,
} from "../../../shared/llcAnnualReports";

const field = (overrides: Partial<MemberAnnualReportField> & Pick<MemberAnnualReportField, "fieldId" | "type">): MemberAnnualReportField => ({
  label: overrides.fieldId,
  group: "QUESTION",
  required: true,
  affectsFee: false,
  options: [],
  dependsOn: null,
  ...overrides,
});

describe("annual report requirements: dependsOn gating", () => {
  const fields = [
    field({ fieldId: "hasAssets", type: "BOOLEAN" }),
    field({ fieldId: "assetValue", type: "AMOUNT", dependsOn: { fieldId: "hasAssets", answer: "true" } }),
    field({ fieldId: "assetKind", type: "SELECT", options: [{ value: "real_estate", label: "Real estate" }, { value: "other", label: "Other" }], dependsOn: { fieldId: "hasAssets", answer: "true" } }),
    field({ fieldId: "assetNote", type: "TEXT", dependsOn: { fieldId: "assetKind", answer: "other" } }),
    field({ fieldId: "orphan", type: "TEXT", dependsOn: { fieldId: "missing", answer: "x" } }),
  ];

  it("hides gated fields until the gate is met, following chains to the end", () => {
    expect(visibleFields(fields, {}).map((f) => f.fieldId)).toEqual(["hasAssets"]);
    expect(visibleFields(fields, { hasAssets: false }).map((f) => f.fieldId)).toEqual(["hasAssets"]);
    expect(visibleFields(fields, { hasAssets: true }).map((f) => f.fieldId)).toEqual(["hasAssets", "assetValue", "assetKind"]);
    expect(visibleFields(fields, { hasAssets: true, assetKind: "other" }).map((f) => f.fieldId)).toEqual(["hasAssets", "assetValue", "assetKind", "assetNote"]);
    // The chain breaks when the first gate closes, even with a stale answer further down.
    expect(visibleFields(fields, { hasAssets: false, assetKind: "other" }).map((f) => f.fieldId)).toEqual(["hasAssets"]);
  });

  it("a hidden field is neither required nor sent, and a gate on an unknown field keeps it hidden", () => {
    const result = validateAnnualReportAnswers(fields, { hasAssets: false, assetValue: "5000", orphan: "sneaky" });
    expect(result.ok).toBe(true);
    expect(result.cleaned).toEqual({ hasAssets: false });
  });

  it("a shown required field must be answered", () => {
    const result = validateAnnualReportAnswers(fields, { hasAssets: true });
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(["assetKind", "assetValue"]);
  });

  it("drops fields the requirements never returned", () => {
    const result = validateAnnualReportAnswers(fields, { hasAssets: false, invented: "x" } as never);
    expect(result.cleaned).not.toHaveProperty("invented");
  });

  it("gates on a loop never crash and stay hidden", () => {
    const loop = [
      field({ fieldId: "a", type: "TEXT", dependsOn: { fieldId: "b", answer: "1" } }),
      field({ fieldId: "b", type: "TEXT", dependsOn: { fieldId: "a", answer: "1" } }),
    ];
    expect(visibleFields(loop, { a: "1", b: "1" })).toEqual([]);
  });
});

describe("annual report answers: all eight types", () => {
  const all = [
    field({ fieldId: "text", type: "TEXT" }),
    field({ fieldId: "number", type: "NUMBER" }),
    field({ fieldId: "select", type: "SELECT", options: [{ value: "A", label: "Choice A" }] }),
    field({ fieldId: "radio", type: "RADIO", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] }),
    field({ fieldId: "amount", type: "AMOUNT" }),
    field({ fieldId: "date", type: "DATE" }),
    field({ fieldId: "bool", type: "BOOLEAN" }),
    field({ fieldId: "address", type: "ADDRESS" }),
  ];

  it("cleans every type to what the state's form takes", () => {
    const result = validateAnnualReportAnswers(all, {
      text: "  Clothing design  ",
      number: "3",
      select: "a",
      radio: "no",
      amount: "$12,500.50",
      date: "2026-12-01",
      bool: "yes",
      address: { line1: "1 Main St", city: "Cheyenne", state: "WY", postalCode: "82001", country: "" },
    });
    expect(result.ok).toBe(true);
    expect(result.cleaned).toEqual({
      text: "Clothing design",
      number: 3,
      select: "A",
      radio: "no",
      amount: 12500.5,
      date: "2026-12-01",
      bool: true,
      address: { line1: "1 Main St", city: "Cheyenne", state: "WY", postalCode: "82001", country: "USA" },
    });
  });

  it("says what's wrong in plain words", () => {
    const result = validateAnnualReportAnswers(all, {
      text: "x",
      number: "three",
      select: "Z",
      radio: "maybe",
      amount: "-5",
      date: "2026-02-30",
      bool: "perhaps",
      address: { line1: "1 Main St", city: "", state: "WY", postalCode: "", country: "USA" },
    });
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(["address", "amount", "bool", "date", "number", "radio", "select"]);
    for (const message of Object.values(result.errors)) expect(message).not.toMatch(/E_|doola|whop/i);
  });
});

describe("annual report words", () => {
  it("dates and fees read the way she'd say them", () => {
    expect(dateWords("2027-03-01")).toBe("March 1, 2027");
    expect(dateWords("2027-02-30")).toBeNull();
    expect(dateWords(null)).toBeNull();
    expect(feeWords(6000)).toBe("$60");
    expect(feeWords(6250)).toBe("$62.50");
  });
});
