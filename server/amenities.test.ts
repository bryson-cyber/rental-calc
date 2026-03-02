import { describe, it, expect } from 'vitest';
import { parseAmenities, AMENITY_LABEL_MAP, SELECTABLE_AMENITIES } from './airdna';

describe('parseAmenities', () => {
  it('should convert raw AirDNA amenities object to human-readable labels', () => {
    const raw = {
      has_pool: true,
      has_hottub: false,
      has_kitchen: true,
      has_parking: true,
    };
    const result = parseAmenities(raw);
    expect(result).toContain('Pool');
    expect(result).toContain('Kitchen');
    expect(result).toContain('Parking');
    expect(result).not.toContain('Hot Tub');
  });

  it('should return empty array for null input', () => {
    expect(parseAmenities(null)).toEqual([]);
  });

  it('should return empty array for undefined input', () => {
    expect(parseAmenities(undefined)).toEqual([]);
  });

  it('should return empty array for non-object input', () => {
    // @ts-ignore - testing invalid input
    expect(parseAmenities('not an object')).toEqual([]);
  });

  it('should return empty array when all amenities are false', () => {
    const raw = {
      has_pool: false,
      has_hottub: false,
      has_kitchen: false,
    };
    expect(parseAmenities(raw)).toEqual([]);
  });

  it('should handle unknown amenity keys with fallback formatting', () => {
    const raw = {
      has_some_new_feature: true,
      has_pool: true,
    };
    const result = parseAmenities(raw);
    expect(result).toContain('Pool');
    // Unknown key should be formatted as title case with has_ prefix removed
    expect(result).toContain('Some New Feature');
  });

  it('should sort results alphabetically', () => {
    const raw = {
      has_wifi: true,
      has_aircon: true,
      has_pool: true,
    };
    const result = parseAmenities(raw);
    expect(result).toEqual(['A/C', 'Pool', 'WiFi']);
  });

  it('should handle empty object', () => {
    expect(parseAmenities({})).toEqual([]);
  });
});

describe('AMENITY_LABEL_MAP', () => {
  it('should have labels for all selectable amenities', () => {
    for (const amenity of SELECTABLE_AMENITIES) {
      expect(AMENITY_LABEL_MAP[amenity.apiKey]).toBeDefined();
      expect(AMENITY_LABEL_MAP[amenity.apiKey]).toBe(amenity.label);
    }
  });

  it('should have at least 10 mapped amenities', () => {
    expect(Object.keys(AMENITY_LABEL_MAP).length).toBeGreaterThanOrEqual(10);
  });
});

describe('SELECTABLE_AMENITIES', () => {
  it('should have 10 selectable amenities', () => {
    expect(SELECTABLE_AMENITIES.length).toBe(10);
  });

  it('should have unique keys', () => {
    const keys = SELECTABLE_AMENITIES.map(a => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('should have unique labels', () => {
    const labels = SELECTABLE_AMENITIES.map(a => a.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('should have icons for all amenities', () => {
    for (const amenity of SELECTABLE_AMENITIES) {
      expect(amenity.icon).toBeTruthy();
      expect(amenity.icon.length).toBeGreaterThan(0);
    }
  });
});

describe('Amenity matching logic (frontend simulation)', () => {
  // Simulates the matching logic used in the TeslaDashboard comp cards
  const mockComps = [
    { amenities: ['Pool', 'Hot Tub', 'Kitchen', 'A/C'], revenue: 120000 },
    { amenities: ['Kitchen', 'A/C', 'Parking'], revenue: 80000 },
    { amenities: ['Pool', 'Kitchen', 'Washer/Dryer'], revenue: 95000 },
    { amenities: [], revenue: 60000 },
    { amenities: ['Hot Tub', 'Fireplace', 'EV Charger'], revenue: 110000 },
  ];

  it('should correctly identify matching amenities', () => {
    const selected = ['Pool', 'Kitchen'];
    const comp = mockComps[0];
    const matches = comp.amenities.filter(a => selected.includes(a));
    expect(matches).toEqual(['Pool', 'Kitchen']);
  });

  it('should handle no matches', () => {
    const selected = ['Gym'];
    const comp = mockComps[0];
    const matches = comp.amenities.filter(a => selected.includes(a));
    expect(matches).toEqual([]);
  });

  it('should calculate amenity prevalence correctly', () => {
    const compsWithAmenities = mockComps.filter(c => c.amenities.length > 0);
    const amenityCounts: Record<string, number> = {};
    compsWithAmenities.forEach(c => {
      c.amenities.forEach(a => {
        amenityCounts[a] = (amenityCounts[a] || 0) + 1;
      });
    });
    
    // Kitchen appears in 3 out of 4 comps with amenities = 75%
    expect(amenityCounts['Kitchen']).toBe(3);
    expect(Math.round((amenityCounts['Kitchen'] / compsWithAmenities.length) * 100)).toBe(75);
    
    // Pool appears in 2 out of 4 = 50%
    expect(amenityCounts['Pool']).toBe(2);
    expect(Math.round((amenityCounts['Pool'] / compsWithAmenities.length) * 100)).toBe(50);
  });

  it('should calculate revenue premium correctly', () => {
    // Median revenue of all comps
    const allRevs = mockComps.filter(c => c.revenue > 0).map(c => c.revenue).sort((a, b) => a - b);
    const medianRevenue = allRevs[Math.floor(allRevs.length / 2)]; // 95000
    
    // Avg revenue of comps with Pool
    const poolComps = mockComps.filter(c => c.amenities.includes('Pool'));
    const avgPoolRev = poolComps.reduce((sum, c) => sum + c.revenue, 0) / poolComps.length;
    
    const premium = Math.round(((avgPoolRev - medianRevenue) / medianRevenue) * 100);
    // Pool comps: 120000 + 95000 = 215000 / 2 = 107500
    // Premium: (107500 - 95000) / 95000 * 100 = 13%
    expect(premium).toBe(13);
  });
});

describe('Amenity label-to-API-key conversion', () => {
  // Simulates the labelToKey map used in exploreListingsInRadius
  const labelToKey: Record<string, string> = {
    'Pool': 'has_pool',
    'Hot Tub': 'has_hottub',
    'Pet Friendly': 'has_pets_allowed',
    'Parking': 'has_parking',
    'Gym': 'has_gym',
    'Kitchen': 'has_kitchen',
    'Washer/Dryer': 'has_washer',
    'A/C': 'has_aircon',
    'Fireplace': 'has_fireplace',
    'EV Charger': 'has_ev_charger',
  };

  it('should convert all selectable amenity labels to API keys', () => {
    const selectedLabels = ['Pool', 'Kitchen', 'A/C'];
    const amenityMap: Record<string, boolean> = {};
    for (const label of selectedLabels) {
      const key = labelToKey[label];
      if (key) amenityMap[key] = true;
    }
    expect(amenityMap).toEqual({
      has_pool: true,
      has_kitchen: true,
      has_aircon: true,
    });
  });

  it('should handle empty amenity selection', () => {
    const selectedLabels: string[] = [];
    const amenityMap: Record<string, boolean> = {};
    for (const label of selectedLabels) {
      const key = labelToKey[label];
      if (key) amenityMap[key] = true;
    }
    expect(Object.keys(amenityMap).length).toBe(0);
  });

  it('should ignore unknown labels', () => {
    const selectedLabels = ['Pool', 'Unknown Amenity', 'Kitchen'];
    const amenityMap: Record<string, boolean> = {};
    for (const label of selectedLabels) {
      const key = labelToKey[label];
      if (key) amenityMap[key] = true;
    }
    expect(amenityMap).toEqual({
      has_pool: true,
      has_kitchen: true,
    });
  });

  it('should have a mapping for every SELECTABLE_AMENITIES label', () => {
    for (const amenity of SELECTABLE_AMENITIES) {
      expect(labelToKey[amenity.label]).toBe(amenity.apiKey);
    }
  });
});

describe('Amenity filter fallback logic', () => {
  // Simulates the fallback logic in getComprehensivePropertyReport
  it('should mark filter as applied when enough comps found', () => {
    const radiusComps = Array(10).fill({ id: '1', amenities: ['Pool'] });
    const hasAmenityFilter = true;
    let amenityFilterApplied = false;
    let amenityFilterRelaxed = false;

    if (hasAmenityFilter && radiusComps.length >= 3) {
      amenityFilterApplied = true;
    }

    expect(amenityFilterApplied).toBe(true);
    expect(amenityFilterRelaxed).toBe(false);
  });

  it('should mark filter as relaxed when too few comps found', () => {
    const radiusComps = Array(2).fill({ id: '1', amenities: ['Pool'] });
    const hasAmenityFilter = true;
    let amenityFilterApplied = false;
    let amenityFilterRelaxed = false;

    if (hasAmenityFilter && radiusComps.length < 3) {
      amenityFilterRelaxed = true;
      // In real code, would re-fetch without amenity filter
    }

    expect(amenityFilterApplied).toBe(false);
    expect(amenityFilterRelaxed).toBe(true);
  });

  it('should not apply any filter metadata when no amenities selected', () => {
    const hasAmenityFilter = false;
    const amenityFilter = hasAmenityFilter ? {
      applied: true,
      relaxed: false,
      selected_amenities: [],
      comp_count: 10,
    } : undefined;

    expect(amenityFilter).toBeUndefined();
  });
});

describe('Amenity enrichment from market listings', () => {
  it('should enrich radius comps with amenities from market listings', () => {
    const radiusComps = [
      { id: 'prop1', title: 'Comp 1', amenities: [] as string[] },
      { id: 'prop2', title: 'Comp 2', amenities: [] as string[] },
      { id: 'prop3', title: 'Comp 3', amenities: ['Kitchen'] },
    ];

    const marketListings = [
      { id: 'prop1', amenities: ['Pool', 'Kitchen', 'A/C'] },
      { id: 'prop2', amenities: ['Hot Tub', 'Parking'] },
      { id: 'prop4', amenities: ['Gym'] }, // Not in radius comps
    ];

    // Build amenity map from market listings
    const amenityMap = new Map<string, string[]>();
    for (const listing of marketListings) {
      if (listing.amenities && listing.amenities.length > 0) {
        amenityMap.set(listing.id, listing.amenities);
      }
    }

    // Enrich radius comps
    for (const comp of radiusComps) {
      if ((!comp.amenities || comp.amenities.length === 0) && amenityMap.has(comp.id)) {
        comp.amenities = amenityMap.get(comp.id)!;
      }
    }

    expect(radiusComps[0].amenities).toEqual(['Pool', 'Kitchen', 'A/C']);
    expect(radiusComps[1].amenities).toEqual(['Hot Tub', 'Parking']);
    // prop3 already had amenities, should not be overwritten
    expect(radiusComps[2].amenities).toEqual(['Kitchen']);
  });

  it('should not overwrite existing amenities', () => {
    const comp = { id: 'prop1', amenities: ['Pool', 'Kitchen'] };
    const marketAmenities = ['Hot Tub', 'Parking'];

    // Only enrich if comp has no amenities
    if (!comp.amenities || comp.amenities.length === 0) {
      comp.amenities = marketAmenities;
    }

    expect(comp.amenities).toEqual(['Pool', 'Kitchen']);
  });
});
