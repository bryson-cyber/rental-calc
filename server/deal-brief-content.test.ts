import { describe, it, expect, vi } from 'vitest';
import { clientDealWatchOuts, isProjectionComparisonWarning } from '../shared/deal-brief-content';
import { buildDealFacts, generateDealBrief, parseDealBrief } from './deal-brief';
import { routedLLMCall } from './model-router';

vi.mock('./model-router', () => ({
  routedLLMCall: vi.fn(),
  FEATURES: { DEAL_BRIEF: 'deal_brief' },
}));

const screenshotWarning = {
  risk: 'The $6,075/mo optimized projection far exceeds what top nearby comps actually earn',
  howTopOperatorsHandleIt: 'The best comp earns $37,597/yr. Top operators underwrite to real comp numbers, not projections, and confirm the deal still pays before signing.',
};
const seasonality = {
  risk: 'Seasonality',
  howTopOperatorsHandleIt: 'Keep a reserve for slower months and monitor bookings.',
};
const brief = {
  headline: 'Example client deal', summary: 'An optimized scenario, not a guarantee.',
  whyItWorks: ['Rent and running costs are included in the math.'],
  upsideMoves: [{ move: 'Improve the photos', why: 'Show the layout clearly.' }],
  watchOuts: [screenshotWarning, seasonality], closingNote: 'Review the numbers.',
};

describe('client deal watch-outs', () => {
  it('removes the exact screenshot warning from a stored brief without mutating it', () => {
    const frozen = Object.freeze([Object.freeze({ ...screenshotWarning }), Object.freeze({ ...seasonality })]);
    expect(clientDealWatchOuts(frozen)).toEqual([seasonality]);
    expect(frozen).toHaveLength(2);
    expect(frozen[0].risk).toContain('$6,075/mo');
  });

  it.each([
    ['Projected revenue is higher than the top comparables', 'Validate the revenue gap.'],
    ['Revenue forecast exceeds nearby listings', 'Use the actual comparable numbers.'],
    ['An aggressive estimate versus comparable earnings', 'Underwrite to real comp numbers.'],
    ['Underwriting assumptions', 'Underwrite to comparable revenue, not projected earnings.'],
    ['The optimized projection is above similar properties', 'Review the projection.'],
  ])('removes a paraphrase: %s', (risk, howTopOperatorsHandleIt) => {
    expect(isProjectionComparisonWarning({ risk, howTopOperatorsHandleIt })).toBe(true);
  });

  it.each([
    seasonality,
    { risk: 'Running costs may exceed the estimate', howTopOperatorsHandleIt: 'Track utility bills and reserve for upkeep.' },
    { risk: 'Seasonal demand', howTopOperatorsHandleIt: 'Watch nearby comps for seasonal booking patterns.' },
    { risk: 'Repairs', howTopOperatorsHandleIt: 'Maintain a reserve above the projected repair budget.' },
  ])('preserves unrelated operational risk: $risk', watchOut => {
    expect(clientDealWatchOuts([watchOut])).toEqual([watchOut]);
  });

  it('handles empty or missing stored watch-outs', () => {
    expect(clientDealWatchOuts([])).toEqual([]);
    expect(clientDealWatchOuts(null)).toEqual([]);
    expect(clientDealWatchOuts(undefined)).toEqual([]);
  });

  it('discards only the removed warning during parsing, keeping other brief content', () => {
    expect(parseDealBrief(JSON.stringify(brief))).toEqual({ ...brief, watchOuts: [seasonality] });
  });

  it('allows a brief whose only watch-out was the removed warning', () => {
    expect(parseDealBrief(JSON.stringify({ ...brief, watchOuts: [screenshotWarning] }))?.watchOuts).toEqual([]);
  });

  it('keeps the projection and comp facts and prevents the warning in future generation', async () => {
    const facts = buildDealFacts({
      bedrooms: 2, bathrooms: 1, monthlyRent: 1500,
      projection: {
        annualRevenue: 72900, annualRevenueLow: 40000, adr: 300,
        occupancy: 0.66, boostFactor: 1.3,
        comps: [{ title: 'Real comp', annualRevenue: 37597, occupancy: 0.56, adr: 190 }],
      },
    });
    const before = structuredClone(facts);
    vi.mocked(routedLLMCall).mockResolvedValueOnce(JSON.stringify(brief));
    const result = await generateDealBrief({ address: 'Local regression fixture' }, facts);
    expect(result?.watchOuts).toEqual([seasonality]);
    expect(facts).toEqual(before);
    expect(facts.monthlyRevenue).toBe(6075);
    expect(facts.comps[0].annualRevenue).toBe(37597);
    const call = vi.mocked(routedLLMCall).mock.calls.at(-1)!;
    expect(call[1]).toContain('Optimized scenario revenue: $6,075/mo');
    expect(call[1]).toContain('$37,597/yr');
    expect(call[2]?.systemPrompt).toContain('Do not include a projection-versus-comparable earnings warning');
    expect(call[2]?.systemPrompt).toContain('Never claim that the projection has been proven by comps when it has not');
  });
});
