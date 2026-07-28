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

describe('nagging-popup fixes (operator 2026-07-28: "it just keeps popping up")', () => {
  it('Skip for now PERSISTS — the old remember=false branch deleted the stored mode', () => {
    const modal = read('client/src/components/ReportModeOnboarding.tsx');
    expect(modal).toContain("completeOnboarding('guided', true)");
    expect(modal).not.toContain("completeOnboarding('guided', false)");
  });

  it('the TOS gate consults the server record, not just this browser', () => {
    const tos = read('client/src/components/TermsAcceptanceModal.tsx');
    expect(tos).toContain('export function useTosGate()');
    expect(tos).toContain('trpc.tos.checkAcceptance.useQuery');
    // Accepted-elsewhere users never see a flash while the check runs.
    expect(tos).toContain('accepted || serverCheck.isFetched || serverCheck.isError');
    // Write-through so the next load is instant.
    expect(tos).toContain('markTosAccepted(); // write-through');
    // Both gated pages use the hook instead of raw localStorage.
    for (const page of ['client/src/pages/ExplorePage.tsx', 'client/src/pages/LeadMagnet.tsx']) {
      const src = read(page);
      expect(src).toContain('useTosGate');
      expect(src).not.toContain('hasTosBeenAccepted()');
    }
  });
});

describe('LLC ops page redesign invariants', () => {
  const ops = read('client/src/pages/admin/LlcOpsPage.tsx');

  it('internal tooling headings are sans — the marketing serif read as broken', () => {
    expect(ops).toContain('font-sans text-2xl font-semibold tracking-tight text-slate-900');
    // Explicit text-white: the global heading rule hard-codes near-black,
    // which silently beat the banner's inherited white (operator screenshot).
    expect(ops).toContain('font-sans text-base font-semibold tracking-tight text-white');
  });

  it('at-a-glance stat tiles exist (orders, awaiting payment, collected, margin)', () => {
    for (const label of ['Filing orders', 'Awaiting payment', 'Retail collected', 'Margin to date']) {
      expect(ops).toContain(label);
    }
  });

  it('both data surfaces have a real error state with retry', () => {
    expect(ops).toContain("Couldn't load filing orders.");
    expect(ops).toContain("Couldn't load state pricing.");
    expect((ops.match(/Try again/g) ?? []).length).toBe(2);
  });

  it('bulk pricing actions are grouped and labeled, not floating placeholder-only forms', () => {
    expect(ops).toContain('Bulk actions — all states at once');
    expect(ops).toContain("Our fee ($) — added to each state's fee");
    expect(ops).not.toContain('placeholder="Markup $"');
  });

  it('the orders table dropped to 8 columns with paid folded into Retail', () => {
    expect(ops).toContain('min-w-[64rem]');
    expect(ops).not.toContain('min-w-[76rem]');
    expect(ops).not.toContain("'Retail paid',");
    expect(ops).not.toContain("'Last sync',");
    // Last sync survives inside the expanded documents row.
    expect(ops).toContain('Last provider sync:');
  });
});

describe('operator fee sheet (Google Sheet, loaded 2026-07-28)', () => {
  const pricing = read('server/llc/pricing.ts');

  it('the seed carries the sheet values, including observed billed cents', () => {
    expect(pricing).toContain('NV: 43563');
    expect(pricing).toContain('TX: 30810');
    expect(pricing).toContain('AL: 23600');
    expect(pricing).toContain('WY: 10240');
    expect(pricing).toContain('GA: 11000'); // doola-confirmed production value
  });

  it('seeding prefers the operator sheet over the SANDBOX snapshot', () => {
    expect(pricing).toContain('STATE_FILING_FEES_CENTS[state] ?? DOOLA_STATE_FEES_CENTS[state]');
    expect(pricing).not.toContain('DOOLA_STATE_FEES_CENTS[state] ?? STATE_FILING_FEES_CENTS[state]');
  });

  it('the sheet is loadable from the ops page in one action', () => {
    expect(pricing).toContain('export async function applyReferenceFees()');
    const router = read('server/llc/router.ts');
    expect(router).toContain('applyReferenceFees: adminProcedure.mutation');
    const ops = read('client/src/pages/admin/LlcOpsPage.tsx');
    expect(ops).toContain('trpc.llcOps.applyReferenceFees.useMutation');
    expect(ops).toContain('Load fee sheet');
  });
});
