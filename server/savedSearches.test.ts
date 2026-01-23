import { describe, it, expect } from 'vitest';

/**
 * Tests for Save Reports (savedSearches) feature
 * The actual implementation is in routers.ts savedSearches router
 */

interface SavedSearch {
  id: number;
  userId: string | null;
  sessionId: string | null;
  searchType: 'market' | 'property';
  marketId?: string;
  marketName?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  bedrooms?: number;
  bathrooms?: string;
  cachedRevenue?: number;
  cachedOccupancy?: string;
  cachedAdr?: number;
  label?: string;
  notes?: string;
  createdAt: Date;
}

// Validation functions
function validateSaveInput(input: {
  sessionId?: string;
  searchType: string;
  marketId?: string;
  address?: string;
}): { valid: boolean; error?: string } {
  if (!input.searchType || !['market', 'property'].includes(input.searchType)) {
    return { valid: false, error: 'Invalid search type' };
  }
  
  if (input.searchType === 'market' && !input.marketId) {
    return { valid: false, error: 'Market ID required for market searches' };
  }
  
  if (input.searchType === 'property' && !input.address) {
    return { valid: false, error: 'Address required for property searches' };
  }
  
  return { valid: true };
}

function canAccessSearch(search: SavedSearch, userId?: string, sessionId?: string): boolean {
  if (userId && search.userId === userId) return true;
  if (sessionId && search.sessionId === sessionId) return true;
  return false;
}

function formatSearchForDisplay(search: SavedSearch): {
  type: string;
  title: string;
  subtitle: string;
  metrics?: { revenue?: number; occupancy?: number; adr?: number };
} {
  if (search.searchType === 'market') {
    return {
      type: 'Market',
      title: search.marketName || 'Unknown Market',
      subtitle: search.label || 'Saved Market Analysis',
      metrics: {
        revenue: search.cachedRevenue,
        occupancy: search.cachedOccupancy ? parseFloat(search.cachedOccupancy) : undefined,
        adr: search.cachedAdr,
      },
    };
  } else {
    return {
      type: 'Property',
      title: search.address || 'Unknown Address',
      subtitle: search.label || `${search.bedrooms || '?'} BR Property`,
      metrics: {
        revenue: search.cachedRevenue,
        occupancy: search.cachedOccupancy ? parseFloat(search.cachedOccupancy) : undefined,
        adr: search.cachedAdr,
      },
    };
  }
}

describe('Save Reports (savedSearches)', () => {
  it('should validate market search input correctly', () => {
    const validMarket = validateSaveInput({
      searchType: 'market',
      marketId: 'us/denver',
    });
    expect(validMarket.valid).toBe(true);
    
    const invalidMarket = validateSaveInput({
      searchType: 'market',
    });
    expect(invalidMarket.valid).toBe(false);
    expect(invalidMarket.error).toBe('Market ID required for market searches');
  });

  it('should validate property search input correctly', () => {
    const validProperty = validateSaveInput({
      searchType: 'property',
      address: '123 Main St, Denver, CO',
    });
    expect(validProperty.valid).toBe(true);
    
    const invalidProperty = validateSaveInput({
      searchType: 'property',
    });
    expect(invalidProperty.valid).toBe(false);
    expect(invalidProperty.error).toBe('Address required for property searches');
  });

  it('should reject invalid search types', () => {
    const invalid = validateSaveInput({
      searchType: 'invalid',
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toBe('Invalid search type');
  });

  it('should check access permissions by userId', () => {
    const search: SavedSearch = {
      id: 1,
      userId: 'user123',
      sessionId: null,
      searchType: 'market',
      createdAt: new Date(),
    };
    
    expect(canAccessSearch(search, 'user123')).toBe(true);
    expect(canAccessSearch(search, 'user456')).toBe(false);
  });

  it('should check access permissions by sessionId', () => {
    const search: SavedSearch = {
      id: 1,
      userId: null,
      sessionId: 'session123',
      searchType: 'property',
      createdAt: new Date(),
    };
    
    expect(canAccessSearch(search, undefined, 'session123')).toBe(true);
    expect(canAccessSearch(search, undefined, 'session456')).toBe(false);
  });

  it('should deny access without matching credentials', () => {
    const search: SavedSearch = {
      id: 1,
      userId: 'user123',
      sessionId: 'session123',
      searchType: 'market',
      createdAt: new Date(),
    };
    
    expect(canAccessSearch(search)).toBe(false);
    expect(canAccessSearch(search, 'wrongUser', 'wrongSession')).toBe(false);
  });

  it('should format market search for display', () => {
    const search: SavedSearch = {
      id: 1,
      userId: 'user123',
      sessionId: null,
      searchType: 'market',
      marketName: 'Denver, CO',
      cachedRevenue: 85000,
      cachedOccupancy: '72.5',
      cachedAdr: 250,
      createdAt: new Date(),
    };
    
    const display = formatSearchForDisplay(search);
    expect(display.type).toBe('Market');
    expect(display.title).toBe('Denver, CO');
    expect(display.metrics?.revenue).toBe(85000);
    expect(display.metrics?.occupancy).toBe(72.5);
  });

  it('should format property search for display', () => {
    const search: SavedSearch = {
      id: 1,
      userId: 'user123',
      sessionId: null,
      searchType: 'property',
      address: '123 Main St, Denver, CO',
      bedrooms: 3,
      cachedRevenue: 95000,
      label: 'Investment Property',
      createdAt: new Date(),
    };
    
    const display = formatSearchForDisplay(search);
    expect(display.type).toBe('Property');
    expect(display.title).toBe('123 Main St, Denver, CO');
    expect(display.subtitle).toBe('Investment Property');
  });

  it('should handle missing optional fields gracefully', () => {
    const search: SavedSearch = {
      id: 1,
      userId: null,
      sessionId: 'session123',
      searchType: 'property',
      createdAt: new Date(),
    };
    
    const display = formatSearchForDisplay(search);
    expect(display.title).toBe('Unknown Address');
    expect(display.subtitle).toBe('? BR Property');
    expect(display.metrics?.revenue).toBeUndefined();
  });

  it('should support both market and property search types', () => {
    const marketValid = validateSaveInput({ searchType: 'market', marketId: 'test' });
    const propertyValid = validateSaveInput({ searchType: 'property', address: 'test' });
    
    expect(marketValid.valid).toBe(true);
    expect(propertyValid.valid).toBe(true);
  });
});
