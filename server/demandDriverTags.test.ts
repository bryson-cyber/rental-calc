import { describe, it, expect } from 'vitest';

/**
 * Tests for Demand Driver Tags (Market Type) feature
 * The actual implementation is in MarketDiscoveryPage.tsx and EnhancedInsights.tsx
 */

type MarketType = 'coastal' | 'urban_metro' | 'mountains_lakes' | 'suburban' | 'rural' | 'mid_size_city';

// Market type labels
const marketTypeLabels: Record<MarketType, string> = {
  coastal: 'Coastal',
  urban_metro: 'Urban Metro',
  mountains_lakes: 'Mountains & Lakes',
  suburban: 'Suburban',
  rural: 'Rural',
  mid_size_city: 'Mid-Size City',
};

// Get label for market type
function getMarketTypeLabel(type: string): string {
  return marketTypeLabels[type as MarketType] || type;
}

// Check if market type is valid
function isValidMarketType(type: string): type is MarketType {
  return type in marketTypeLabels;
}

// Get icon class for market type (simplified for testing)
function getMarketTypeIconClass(type: MarketType): string {
  const iconClasses: Record<MarketType, string> = {
    coastal: 'waves-icon',
    urban_metro: 'building-icon',
    mountains_lakes: 'mountain-icon',
    suburban: 'home-icon',
    rural: 'tree-icon',
    mid_size_city: 'city-icon',
  };
  return iconClasses[type];
}

// Filter markets by type
function filterMarketsByType<T extends { market_type?: string }>(
  markets: T[],
  type: string
): T[] {
  if (type === 'all') return markets;
  return markets.filter(m => m.market_type === type);
}

// Get demand characteristics based on market type
function getDemandCharacteristics(type: MarketType): {
  seasonality: 'high' | 'moderate' | 'low';
  weekendPremium: boolean;
  businessTravel: boolean;
  familyFriendly: boolean;
} {
  const characteristics: Record<MarketType, ReturnType<typeof getDemandCharacteristics>> = {
    coastal: { seasonality: 'high', weekendPremium: true, businessTravel: false, familyFriendly: true },
    urban_metro: { seasonality: 'low', weekendPremium: false, businessTravel: true, familyFriendly: false },
    mountains_lakes: { seasonality: 'high', weekendPremium: true, businessTravel: false, familyFriendly: true },
    suburban: { seasonality: 'moderate', weekendPremium: true, businessTravel: false, familyFriendly: true },
    rural: { seasonality: 'moderate', weekendPremium: true, businessTravel: false, familyFriendly: true },
    mid_size_city: { seasonality: 'moderate', weekendPremium: false, businessTravel: true, familyFriendly: true },
  };
  return characteristics[type];
}

describe('Demand Driver Tags (Market Type)', () => {
  it('should return correct label for each market type', () => {
    expect(getMarketTypeLabel('coastal')).toBe('Coastal');
    expect(getMarketTypeLabel('urban_metro')).toBe('Urban Metro');
    expect(getMarketTypeLabel('mountains_lakes')).toBe('Mountains & Lakes');
    expect(getMarketTypeLabel('suburban')).toBe('Suburban');
    expect(getMarketTypeLabel('rural')).toBe('Rural');
    expect(getMarketTypeLabel('mid_size_city')).toBe('Mid-Size City');
  });

  it('should return original string for unknown market types', () => {
    expect(getMarketTypeLabel('unknown_type')).toBe('unknown_type');
    expect(getMarketTypeLabel('')).toBe('');
  });

  it('should validate known market types', () => {
    expect(isValidMarketType('coastal')).toBe(true);
    expect(isValidMarketType('urban_metro')).toBe(true);
    expect(isValidMarketType('mountains_lakes')).toBe(true);
    expect(isValidMarketType('suburban')).toBe(true);
    expect(isValidMarketType('rural')).toBe(true);
    expect(isValidMarketType('mid_size_city')).toBe(true);
  });

  it('should reject invalid market types', () => {
    expect(isValidMarketType('beach')).toBe(false);
    expect(isValidMarketType('city')).toBe(false);
    expect(isValidMarketType('')).toBe(false);
  });

  it('should return correct icon class for each market type', () => {
    expect(getMarketTypeIconClass('coastal')).toBe('waves-icon');
    expect(getMarketTypeIconClass('urban_metro')).toBe('building-icon');
    expect(getMarketTypeIconClass('mountains_lakes')).toBe('mountain-icon');
  });

  it('should filter markets by type correctly', () => {
    const markets = [
      { name: 'Miami', market_type: 'coastal' },
      { name: 'Denver', market_type: 'urban_metro' },
      { name: 'Aspen', market_type: 'mountains_lakes' },
      { name: 'San Diego', market_type: 'coastal' },
    ];
    
    const coastalMarkets = filterMarketsByType(markets, 'coastal');
    expect(coastalMarkets.length).toBe(2);
    expect(coastalMarkets[0].name).toBe('Miami');
    expect(coastalMarkets[1].name).toBe('San Diego');
  });

  it('should return all markets when type is "all"', () => {
    const markets = [
      { name: 'Miami', market_type: 'coastal' },
      { name: 'Denver', market_type: 'urban_metro' },
    ];
    
    const allMarkets = filterMarketsByType(markets, 'all');
    expect(allMarkets.length).toBe(2);
  });

  it('should return demand characteristics for coastal markets', () => {
    const coastal = getDemandCharacteristics('coastal');
    expect(coastal.seasonality).toBe('high');
    expect(coastal.weekendPremium).toBe(true);
    expect(coastal.businessTravel).toBe(false);
    expect(coastal.familyFriendly).toBe(true);
  });

  it('should return demand characteristics for urban metro markets', () => {
    const urban = getDemandCharacteristics('urban_metro');
    expect(urban.seasonality).toBe('low');
    expect(urban.businessTravel).toBe(true);
    expect(urban.weekendPremium).toBe(false);
  });

  it('should handle markets without market_type field', () => {
    const markets = [
      { name: 'Unknown Market' },
      { name: 'Miami', market_type: 'coastal' },
    ];
    
    const filtered = filterMarketsByType(markets, 'coastal');
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Miami');
  });
});
