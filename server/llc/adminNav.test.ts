/**
 * Admin discoverability pins (operator 2026-07-28).
 *
 * The LLC ops page (/admin/llc — per-state retail pricing, the bulk
 * "state fee + markup" action, registrations with wholesale/margin) existed
 * but was reachable only by typing the URL. The operator's ask: "add the
 * LLC portion to the admin navigation... so we can always adjust our
 * prices." These pins keep that link from silently disappearing, and pin
 * the pricing controls the operator now depends on.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(join(__dirname, "..", "..", relative), "utf8");

describe("LLC ops is one click from the admin", () => {
  it("the admin tab row links to /admin/llc", () => {
    const admin = read("client/src/pages/UnifiedAdmin.tsx");
    expect(admin).toContain('href="/admin/llc"');
    // Sits inside the TabsList so it reads as part of the navigation.
    const tabsList = admin.slice(
      admin.indexOf("<TabsList"),
      admin.indexOf("</TabsList>"),
    );
    expect(tabsList).toContain('href="/admin/llc"');
  });

  it("the route itself still exists", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('<Route path="/admin/llc" component={LlcOpsPage} />');
  });
});

describe("the pricing controls the operator depends on stay present", () => {
  it("bulk markup ('our fee + state fee for all active states') is wired end to end", () => {
    const pricing = read("server/llc/pricing.ts");
    expect(pricing).toContain(
      "retailPriceCents: sql`${llcStatePricing.stateFeeCents} + ${markupCents}`",
    );
    const ops = read("client/src/pages/admin/LlcOpsPage.tsx");
    expect(ops).toContain("trpc.llcOps.applyStateMarkup.useMutation");
  });

  it("the wizard shows the all-in total once a retail price is published", () => {
    const wizard = read("client/src/components/llc-formation/WizardSteps.tsx");
    expect(wizard).toContain("includes the {formatUsdFromCents(pricing.stateFeeCents)} state filing fee");
  });
});
