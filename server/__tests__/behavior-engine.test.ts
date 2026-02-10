import { describe, it, expect } from 'vitest';
import { selectEmailStrategy } from '../behavior-engine';
import type { UserBehaviorProfile } from '../behavior-engine';

function makeProfile(overrides: Partial<UserBehaviorProfile> = {}): UserBehaviorProfile {
  return {
    email: 'test@example.com',
    totalEvents: 5,
    uniqueTools: ['revenue_calculator', 'market_advisor'],
    uniqueMarkets: [{ city: 'Las Vegas', state: 'NV', count: 3 }],
    mostUsedTool: 'revenue_calculator',
    lastActiveAt: new Date(),
    daysSinceLastActive: 2,
    engagementLevel: 'warm',
    primaryInterest: 'arbitrage',
    topMarket: { city: 'Las Vegas', state: 'NV' },
    journeyStage: 'consideration',
    toolBreakdown: { revenue_calculator: 3, market_advisor: 2 },
    hasSearchedProperties: false,
    hasUsedCalculator: true,
    hasUsedAdvisor: true,
    hasCheckedRegulations: false,
    hasGeneratedReport: false,
    hasSetDealAlerts: false,
    ...overrides,
  };
}

describe('Behavior Engine - Strategy Selection', () => {
  it('should recommend win_back for cold users who were previously active', () => {
    const profile = makeProfile({
      engagementLevel: 'cold',
      totalEvents: 10,
      daysSinceLastActive: 20,
    });
    expect(selectEmailStrategy(profile)).toBe('win_back');
  });

  it('should recommend deal_alert_setup for power users without alerts', () => {
    const profile = makeProfile({
      engagementLevel: 'power_user',
      totalEvents: 30,
      daysSinceLastActive: 1,
      hasSetDealAlerts: false,
    });
    expect(selectEmailStrategy(profile)).toBe('deal_alert_setup');
  });

  it('should recommend power_user_reward for power users with alerts set', () => {
    const profile = makeProfile({
      engagementLevel: 'power_user',
      totalEvents: 30,
      daysSinceLastActive: 1,
      hasSetDealAlerts: true,
    });
    expect(selectEmailStrategy(profile)).toBe('power_user_reward');
  });

  it('should recommend report_upsell for hot users without reports', () => {
    const profile = makeProfile({
      engagementLevel: 'hot',
      totalEvents: 8,
      daysSinceLastActive: 3,
      hasGeneratedReport: false,
      topMarket: { city: 'Denver', state: 'CO' },
    });
    expect(selectEmailStrategy(profile)).toBe('report_upsell');
  });

  it('should recommend deal_alert_setup for hot users with reports but no alerts', () => {
    const profile = makeProfile({
      engagementLevel: 'hot',
      totalEvents: 8,
      daysSinceLastActive: 3,
      hasGeneratedReport: true,
      hasSetDealAlerts: false,
    });
    expect(selectEmailStrategy(profile)).toBe('deal_alert_setup');
  });

  it('should recommend regulation_reminder for hot users with reports and alerts but no regulation check', () => {
    const profile = makeProfile({
      engagementLevel: 'hot',
      totalEvents: 8,
      daysSinceLastActive: 3,
      hasGeneratedReport: true,
      hasSetDealAlerts: true,
      hasCheckedRegulations: false,
      topMarket: { city: 'Austin', state: 'TX' },
    });
    expect(selectEmailStrategy(profile)).toBe('regulation_reminder');
  });

  it('should recommend advisor_intro for warm users who havent tried the advisor', () => {
    const profile = makeProfile({
      engagementLevel: 'warm',
      hasUsedAdvisor: false,
      topMarket: { city: 'Nashville', state: 'TN' },
    });
    expect(selectEmailStrategy(profile)).toBe('advisor_intro');
  });

  it('should recommend property_nudge for warm users who used calculator but not property search', () => {
    const profile = makeProfile({
      engagementLevel: 'warm',
      hasUsedAdvisor: true,
      hasUsedCalculator: true,
      hasSearchedProperties: false,
    });
    expect(selectEmailStrategy(profile)).toBe('property_nudge');
  });

  it('should recommend regulation_reminder for warm users who searched but havent checked regulations', () => {
    const profile = makeProfile({
      engagementLevel: 'warm',
      hasUsedAdvisor: true,
      hasUsedCalculator: true,
      hasSearchedProperties: true,
      hasCheckedRegulations: false,
      topMarket: { city: 'Miami', state: 'FL' },
    });
    expect(selectEmailStrategy(profile)).toBe('regulation_reminder');
  });

  it('should recommend seasonal_opportunity for cold users with a top market', () => {
    const profile = makeProfile({
      engagementLevel: 'cold',
      totalEvents: 0,
      daysSinceLastActive: 999,
      topMarket: { city: 'Gatlinburg', state: 'TN' },
    });
    expect(selectEmailStrategy(profile)).toBe('seasonal_opportunity');
  });

  it('should recommend market_deep_dive as the default fallback', () => {
    const profile = makeProfile({
      engagementLevel: 'cold',
      totalEvents: 0,
      daysSinceLastActive: 999,
      topMarket: null,
    });
    expect(selectEmailStrategy(profile)).toBe('market_deep_dive');
  });

  it('should recommend new_market_suggestion for fully engaged hot users', () => {
    const profile = makeProfile({
      engagementLevel: 'hot',
      hasGeneratedReport: true,
      hasSetDealAlerts: true,
      hasCheckedRegulations: true,
      topMarket: { city: 'Denver', state: 'CO' },
    });
    expect(selectEmailStrategy(profile)).toBe('new_market_suggestion');
  });
});
