/**
 * White-label (2026-10-29): the activity marker and the preset property no
 * longer name the provider anywhere the browser sees them. The shared code
 * that ships in the client bundle carries neither word; an older cached
 * browser that still sends the legacy marker is accepted and renamed before
 * validation and storage; a stored row the boot rename has not reached reads
 * back with the current marker; and the boot update renames stored values
 * once, idempotently, without touching updatedAt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const store = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));

vi.mock("./store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store")>();
  return { ...actual, getLlcRegistrationById: store.get, saveLlcDraft: store.save };
});

import { appRouter } from "../routers";
import * as sharedLlc from "../../shared/llc";
import { DIRECT_LABEL_MARKER, LLC_ACTIVITY_PRESETS } from "../../shared/llc";
import { DOOLA_INDUSTRY_OPTIONS } from "../../shared/doola-industries";
import {
  ACTIVITY_MARKER_COLUMNS,
  LEGACY_DIRECT_LABEL_MARKER,
  activityMarkerRenameStatements,
  isDirectLabelMarker,
  normalizeActivityMarker,
  renameLegacyActivityMarkers,
  withNormalizedActivityMarker,
} from "./activityMarker";
import { deriveDoolaIndustry } from "./doola";
import { bundleToRegistrationView } from "./domain";
import { makePersistedBundle, validDraft } from "./test-fixtures";

const PROVIDER_WORD = /doola|whop/i;

function context(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "user-7",
      email: "owner7@example.com",
      name: "Owner 7",
      phone: null,
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      reportMode: null,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

/** A stored order the boot rename has not reached: the legacy marker on both columns. */
function legacyBundle(status: Parameters<typeof makePersistedBundle>[0] = "draft") {
  const bundle = makePersistedBundle(status);
  Object.assign(bundle.registration, {
    businessType: LEGACY_DIRECT_LABEL_MARKER,
    industryGroup: LEGACY_DIRECT_LABEL_MARKER,
    industryType: "Short term rentals",
    provider: "doola",
  });
  return bundle;
}

let log: ReturnType<typeof vi.spyOn>;
let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  log.mockRestore();
  errorLog.mockRestore();
});

describe("what the browser bundle ships", () => {
  it("the marker and every preset carry neither provider word, keys included", () => {
    expect(DIRECT_LABEL_MARKER).toBe("direct_label");
    expect(JSON.stringify(LLC_ACTIVITY_PRESETS)).not.toMatch(PROVIDER_WORD);
    for (const preset of LLC_ACTIVITY_PRESETS) {
      expect(Object.keys(preset)).toEqual(["key", "label", "description", "filingIndustry", "naicsCode"]);
    }
  });

  it("no data export of shared/llc.ts names a provider (export names are minified away; values are not)", () => {
    for (const [name, value] of Object.entries(sharedLlc)) {
      const isData =
        typeof value === "string" ||
        Array.isArray(value) ||
        (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype);
      if (!isData) continue;
      expect(JSON.stringify(value), name).not.toMatch(PROVIDER_WORD);
    }
    expect(JSON.stringify(DOOLA_INDUSTRY_OPTIONS)).not.toMatch(PROVIDER_WORD);
  });

  it("the legacy value lives only in server code, never in shared or wizard source", () => {
    const root = join(__dirname, "..", "..");
    for (const file of ["shared/llc.ts", "client/src/components/llc-formation/WizardSteps.tsx"]) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source, file).not.toContain(LEGACY_DIRECT_LABEL_MARKER);
      expect(source, file).not.toContain("doolaIndustry");
    }
    const wizard = readFileSync(join(root, "client/src/components/llc-formation/WizardSteps.tsx"), "utf8");
    expect(wizard).not.toMatch(PROVIDER_WORD);
  });
});

describe("normalizing the legacy marker", () => {
  it("renames only the legacy value", () => {
    expect(normalizeActivityMarker(LEGACY_DIRECT_LABEL_MARKER)).toBe(DIRECT_LABEL_MARKER);
    expect(normalizeActivityMarker(DIRECT_LABEL_MARKER)).toBe(DIRECT_LABEL_MARKER);
    expect(normalizeActivityMarker("services")).toBe("services");
    expect(normalizeActivityMarker(null)).toBeNull();
    expect(normalizeActivityMarker(undefined)).toBeUndefined();
    expect(isDirectLabelMarker(LEGACY_DIRECT_LABEL_MARKER)).toBe(true);
    expect(isDirectLabelMarker(DIRECT_LABEL_MARKER)).toBe(true);
    expect(isDirectLabelMarker("services")).toBe(false);
  });

  it("renames both activity fields and leaves an already-current activity as the same object", () => {
    expect(
      withNormalizedActivityMarker({
        businessType: LEGACY_DIRECT_LABEL_MARKER,
        industryGroup: "721310",
        industryType: "Short term rentals",
      }),
    ).toEqual({ businessType: DIRECT_LABEL_MARKER, industryGroup: "721310", industryType: "Short term rentals" });
    expect(
      withNormalizedActivityMarker({
        businessType: LEGACY_DIRECT_LABEL_MARKER,
        industryGroup: LEGACY_DIRECT_LABEL_MARKER,
      }),
    ).toEqual({ businessType: DIRECT_LABEL_MARKER, industryGroup: DIRECT_LABEL_MARKER });
    const current = { businessType: DIRECT_LABEL_MARKER, industryGroup: DIRECT_LABEL_MARKER };
    expect(withNormalizedActivityMarker(current)).toBe(current);
  });

  it("a filing reads the label under either marker", () => {
    for (const businessType of [DIRECT_LABEL_MARKER, LEGACY_DIRECT_LABEL_MARKER]) {
      expect(
        deriveDoolaIndustry({ businessType, industryGroup: businessType, industryType: "Short term rentals" }),
      ).toBe("Short term rentals");
    }
  });
});

describe("a stored order read back to the browser", () => {
  it("carries the current marker and no provider word, even before the boot rename reaches it", () => {
    const bundle = legacyBundle("action_required");
    Object.assign(bundle.registration, {
      lastErrorMessage: "Please finish this step in your doola dashboard.",
    });
    const now = new Date("2026-10-29T12:00:00.000Z");
    Object.assign(bundle, {
      requiredActions: [
        {
          id: 1,
          actionCode: "FORMATION_SUPPORT",
          actionName: "Doola support review",
          reason: "Reply to the doola team to continue.",
          status: "created",
          open: true,
          updatedAt: now,
        },
        {
          id: 2,
          actionCode: "FORMATION_NAME_OPTIONS_EXHAUSTED",
          actionName: "Name options exhausted",
          reason: "The state rejected every name option.",
          status: "created",
          open: true,
          updatedAt: now,
        },
      ],
    });
    const view = bundleToRegistrationView(bundle as never);
    expect(view.draft.businessType).toBe(DIRECT_LABEL_MARKER);
    expect(view.draft.industryGroup).toBe(DIRECT_LABEL_MARKER);
    expect(view.draft.industryType).toBe("Short term rentals");
    expect(JSON.stringify(view)).not.toMatch(PROVIDER_WORD);
    // Provider wording that names no provider is shown as it was written.
    expect(view.requiredActions[1]).toMatchObject({
      title: "Name options exhausted",
      reason: "The state rejected every name option.",
    });
    expect(view.requiredActions[0].title).toBe("Filing action needed");
  });
});

describe("an older cached browser that still sends the legacy marker", () => {
  const legacyDraft = {
    ...validDraft,
    currentStep: 2,
    businessType: LEGACY_DIRECT_LABEL_MARKER,
    industryGroup: LEGACY_DIRECT_LABEL_MARKER,
    industryType: "Short term rentals",
  };

  beforeEach(() => {
    const saved = makePersistedBundle("draft");
    Object.assign(saved.registration, {
      businessType: DIRECT_LABEL_MARKER,
      industryGroup: DIRECT_LABEL_MARKER,
      industryType: "Short term rentals",
    });
    store.save.mockResolvedValue(saved);
  });

  it("llc.saveDraft stores the current marker and sends no provider word back", async () => {
    const result = await appRouter.createCaller(context()).llc.saveDraft({ id: 41, draft: legacyDraft });
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(store.save.mock.calls[0][2]).toMatchObject({
      businessType: DIRECT_LABEL_MARKER,
      industryGroup: DIRECT_LABEL_MARKER,
      industryType: "Short term rentals",
    });
    expect(JSON.stringify(result)).not.toMatch(PROVIDER_WORD);
  });

  it("llc.advanceStep validates the Activity step under the current marker, then stores it", async () => {
    const result = await appRouter.createCaller(context()).llc.advanceStep({ id: 41, step: 2, draft: legacyDraft });
    expect(result.advanced).toBe(true);
    expect(store.save.mock.calls[0][2]).toMatchObject({
      currentStep: 3,
      businessType: DIRECT_LABEL_MARKER,
      industryGroup: DIRECT_LABEL_MARKER,
    });
    expect(JSON.stringify(result)).not.toMatch(PROVIDER_WORD);
  });

  it("a preset pick (the NAICS code as industryGroup) passes the same way", async () => {
    const result = await appRouter.createCaller(context()).llc.advanceStep({
      id: 41,
      step: 2,
      draft: { ...legacyDraft, industryGroup: "721310" },
    });
    expect(result.advanced).toBe(true);
    expect(store.save.mock.calls[0][2]).toMatchObject({ businessType: DIRECT_LABEL_MARKER, industryGroup: "721310" });
  });
});

describe("the boot-time rename of stored markers", () => {
  it("is one idempotent UPDATE per stored column that keeps updatedAt as it was", () => {
    expect(ACTIVITY_MARKER_COLUMNS).toEqual([
      { table: "llc_registrations", column: "businessType" },
      { table: "llc_registrations", column: "industryGroup" },
    ]);
    expect(activityMarkerRenameStatements()).toEqual([
      "UPDATE `llc_registrations` SET `businessType` = 'direct_label', `updatedAt` = `updatedAt` WHERE `businessType` = 'doola_direct'",
      "UPDATE `llc_registrations` SET `industryGroup` = 'direct_label', `updatedAt` = `updatedAt` WHERE `industryGroup` = 'doola_direct'",
    ]);
  });

  it("logs the count of renamed values, and nothing once there is nothing left to rename", async () => {
    const statements: string[] = [];
    const renamedOnce = [3, 1];
    const failed = await renameLegacyActivityMarkers(async (statement) => {
      statements.push(statement);
      return [{ affectedRows: renamedOnce[statements.length - 1] }, undefined];
    });
    expect(failed).toEqual([]);
    expect(statements).toEqual(activityMarkerRenameStatements());
    expect(log.mock.calls.map((call) => call.join(" "))).toEqual([
      "[LLC] Renamed the legacy activity marker on 3 llc_registrations.businessType values",
      "[LLC] Renamed the legacy activity marker on 1 llc_registrations.industryGroup values",
    ]);

    log.mockClear();
    const again = await renameLegacyActivityMarkers(async () => [{ affectedRows: 0 }, undefined]);
    expect(again).toEqual([]);
    expect(log).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("logs a column it could not update by name and code only, and still tries the next", async () => {
    const statements: string[] = [];
    const failed = await renameLegacyActivityMarkers(async (statement) => {
      statements.push(statement);
      if (statements.length === 1) {
        throw Object.assign(new Error("UPDATE command denied to user 'app'@'10.0.0.5'"), { code: "ER_TABLEACCESS_DENIED_ERROR" });
      }
      return [{ affectedRows: 0 }, undefined];
    });
    expect(statements).toHaveLength(2);
    expect(failed).toEqual(["llc_registrations.businessType"]);
    const logged = errorLog.mock.calls[0].join(" ");
    expect(logged).toContain("llc_registrations.businessType");
    expect(logged).toContain("ER_TABLEACCESS_DENIED_ERROR");
    expect(logged).not.toContain("10.0.0.5");
    expect(logged).not.toContain("UPDATE");
  });

  it("runs at boot inside ensureLlcTables, after the column guards and before the schema is reported ensured", () => {
    const ensure = readFileSync(join(__dirname, "ensure-tables.ts"), "utf8");
    const detail = ensure.indexOf("await ensureFilingDetailColumns(");
    const rename = ensure.indexOf("await renameLegacyActivityMarkers(");
    expect(detail).toBeGreaterThan(-1);
    expect(rename).toBeGreaterThan(detail);
    expect(rename).toBeLessThan(ensure.indexOf('console.log("[LLC] Schema ensured")'));
  });
});
