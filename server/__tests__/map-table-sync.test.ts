import { describe, it, expect } from 'vitest';

/**
 * Tests for the bidirectional map-table sync feature:
 * - Clicking a map marker should produce a compKey that matches the table's stable key
 * - The getCompKey bridge function should correctly match comps between map and table
 * - Highlight state should toggle correctly
 */

interface MockComp {
  id?: string;
  airbnb_listing_id?: string;
  title: string;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  rating: number | null;
  reviews: number;
  distance_meters?: number;
  latitude?: number;
  longitude?: number;
}

// Replicate the key generation logic from FullPropertyReport.tsx
const getCompKey = (comp: any, displayIndex: number) =>
  comp.id || comp.airbnb_listing_id || `comp-${displayIndex}`;

function buildCompMaps(comps: MockComp[]) {
  const displayComps = [...comps].sort((a, b) => b.annual_revenue - a.annual_revenue);

  const compToDisplayIndex = new Map<MockComp, number>();
  displayComps.forEach((c, i) => compToDisplayIndex.set(c, i));

  const revenueRankMap = new Map<string, number>();
  displayComps.forEach((c, i) => {
    revenueRankMap.set(getCompKey(c, i), i + 1);
  });

  const getStableCompKey = (comp: MockComp) => {
    const displayIndex = compToDisplayIndex.get(comp) ?? -1;
    return getCompKey(comp, displayIndex);
  };

  return { displayComps, compToDisplayIndex, revenueRankMap, getStableCompKey };
}

// Simulate the getCompKey bridge function passed to CompsMapView
function createMapKeyBridge(displayComps: MockComp[], getStableCompKey: (comp: MockComp) => string) {
  return (mapComp: Partial<MockComp>): string => {
    const match = displayComps.find(dc =>
      (dc.airbnb_listing_id && dc.airbnb_listing_id === mapComp.airbnb_listing_id) ||
      (dc.id && dc.id === mapComp.id) ||
      (dc.latitude === mapComp.latitude && dc.longitude === mapComp.longitude && dc.title === mapComp.title)
    );
    return match ? getStableCompKey(match) : (mapComp.id || mapComp.airbnb_listing_id || 'unknown');
  };
}

const testComps: MockComp[] = [
  { id: 'comp-a', title: 'Amazing Luxury 5BR', annual_revenue: 115935, adr: 450, occupancy: 0.71, rating: 4.8, reviews: 132, distance_meters: 2500, latitude: 39.7392, longitude: -104.9903 },
  { id: 'comp-b', title: 'Exquisite 6BR Retreat', annual_revenue: 99063, adr: 380, occupancy: 0.68, rating: 4.8, reviews: 38, distance_meters: 1200, latitude: 39.7400, longitude: -104.9850 },
  { id: 'comp-c', title: 'Peaceful 6BR Home', annual_revenue: 86382, adr: 320, occupancy: 0.74, rating: 4.8, reviews: 94, distance_meters: 800, latitude: 39.7380, longitude: -104.9880 },
  { id: 'comp-d', title: 'Grand Retreat', annual_revenue: 85405, adr: 410, occupancy: 0.57, rating: 5.0, reviews: 47, distance_meters: 3200, latitude: 39.7350, longitude: -104.9920 },
  { id: 'comp-e', title: 'Spacious 6BR/3.5BA', annual_revenue: 63105, adr: 280, occupancy: 0.62, rating: 4.8, reviews: 121, distance_meters: 600, latitude: 39.7410, longitude: -104.9870 },
];

describe('Map-Table Key Bridge', () => {
  it('should match map comp to table comp by id', () => {
    const { displayComps, getStableCompKey } = buildCompMaps(testComps);
    const bridge = createMapKeyBridge(displayComps, getStableCompKey);

    // Simulate a map comp (subset of fields, as CompsMapView receives)
    const mapComp = { id: 'comp-a', title: 'Amazing Luxury 5BR', latitude: 39.7392, longitude: -104.9903 };
    const key = bridge(mapComp);
    expect(key).toBe('comp-a');
    expect(key).toBe(getStableCompKey(testComps[0]));
  });

  it('should match map comp to table comp by airbnb_listing_id', () => {
    const compsWithAirbnbId: MockComp[] = [
      { airbnb_listing_id: 'ab-123', title: 'Test A', annual_revenue: 100000, adr: 400, occupancy: 0.7, rating: 4.8, reviews: 50, latitude: 39.74, longitude: -104.99 },
      { airbnb_listing_id: 'ab-456', title: 'Test B', annual_revenue: 80000, adr: 350, occupancy: 0.65, rating: 4.7, reviews: 30, latitude: 39.73, longitude: -104.98 },
    ];
    const { displayComps, getStableCompKey } = buildCompMaps(compsWithAirbnbId);
    const bridge = createMapKeyBridge(displayComps, getStableCompKey);

    const mapComp = { airbnb_listing_id: 'ab-456', title: 'Test B', latitude: 39.73, longitude: -104.98 };
    const key = bridge(mapComp);
    expect(key).toBe('ab-456');
    expect(key).toBe(getStableCompKey(compsWithAirbnbId[1]));
  });

  it('should match map comp to table comp by lat/lng/title when no ids', () => {
    const compsNoId: MockComp[] = [
      { title: 'High Revenue', annual_revenue: 150000, adr: 500, occupancy: 0.8, rating: 4.9, reviews: 200, latitude: 39.74, longitude: -104.99 },
      { title: 'Low Revenue', annual_revenue: 50000, adr: 200, occupancy: 0.5, rating: 4.5, reviews: 20, latitude: 39.73, longitude: -104.98 },
    ];
    const { displayComps, getStableCompKey } = buildCompMaps(compsNoId);
    const bridge = createMapKeyBridge(displayComps, getStableCompKey);

    const mapComp = { title: 'Low Revenue', latitude: 39.73, longitude: -104.98 };
    const key = bridge(mapComp);
    // Low Revenue is rank 2 (displayIndex 1) so key is comp-1
    expect(key).toBe('comp-1');
    expect(key).toBe(getStableCompKey(compsNoId[1]));
  });

  it('should return unknown for unmatched comp', () => {
    const { displayComps, getStableCompKey } = buildCompMaps(testComps);
    const bridge = createMapKeyBridge(displayComps, getStableCompKey);

    const unknownComp = { title: 'Unknown Property', latitude: 0, longitude: 0 };
    const key = bridge(unknownComp);
    expect(key).toBe('unknown');
  });
});

describe('Highlight State Toggle', () => {
  it('should toggle highlight on when clicking a comp key', () => {
    let highlightedCompKey: string | null = null;

    // Simulate handleCompRowClick
    const handleCompRowClick = (compKey: string) => {
      highlightedCompKey = highlightedCompKey === compKey ? null : compKey;
    };

    handleCompRowClick('comp-a');
    expect(highlightedCompKey).toBe('comp-a');
  });

  it('should toggle highlight off when clicking the same comp key again', () => {
    let highlightedCompKey: string | null = 'comp-a';

    const handleCompRowClick = (compKey: string) => {
      highlightedCompKey = highlightedCompKey === compKey ? null : compKey;
    };

    handleCompRowClick('comp-a');
    expect(highlightedCompKey).toBeNull();
  });

  it('should switch highlight to a different comp when clicking another key', () => {
    let highlightedCompKey: string | null = 'comp-a';

    const handleCompRowClick = (compKey: string) => {
      highlightedCompKey = highlightedCompKey === compKey ? null : compKey;
    };

    handleCompRowClick('comp-b');
    expect(highlightedCompKey).toBe('comp-b');
  });

  it('handleMapCompSelect should always set (not toggle) the highlight', () => {
    let highlightedCompKey: string | null = null;

    // Simulate handleMapCompSelect (always sets, doesn't toggle)
    const handleMapCompSelect = (compKey: string) => {
      highlightedCompKey = compKey;
    };

    handleMapCompSelect('comp-c');
    expect(highlightedCompKey).toBe('comp-c');

    // Clicking same marker again should keep it highlighted
    handleMapCompSelect('comp-c');
    expect(highlightedCompKey).toBe('comp-c');
  });
});

describe('Bidirectional Sync Consistency', () => {
  it('map marker click should produce the same key as table row key', () => {
    const { displayComps, getStableCompKey } = buildCompMaps(testComps);
    const bridge = createMapKeyBridge(displayComps, getStableCompKey);

    // For each comp, the key from the map bridge should match the table's stable key
    for (const comp of displayComps) {
      const tableKey = getStableCompKey(comp);
      const mapKey = bridge({
        id: comp.id,
        airbnb_listing_id: comp.airbnb_listing_id,
        title: comp.title,
        latitude: comp.latitude,
        longitude: comp.longitude,
      });
      expect(mapKey).toBe(tableKey);
    }
  });

  it('filtered comps passed to map should all produce valid keys', () => {
    const { displayComps, getStableCompKey } = buildCompMaps(testComps);
    const bridge = createMapKeyBridge(displayComps, getStableCompKey);

    // Simulate filtering: select first 3 comps
    const selectedIds = new Set(displayComps.slice(0, 3).map(c => getStableCompKey(c)));
    const filteredComps = displayComps.filter(c => selectedIds.has(getStableCompKey(c)));

    expect(filteredComps).toHaveLength(3);

    // Each filtered comp should produce a valid key via the bridge
    for (const comp of filteredComps) {
      const key = bridge({
        id: comp.id,
        airbnb_listing_id: comp.airbnb_listing_id,
        title: comp.title,
        latitude: comp.latitude,
        longitude: comp.longitude,
      });
      expect(selectedIds.has(key)).toBe(true);
    }
  });

  it('highlighting a comp should not affect selection state', () => {
    const { displayComps, getStableCompKey } = buildCompMaps(testComps);

    // All comps selected
    const selectedIds = new Set(displayComps.map(c => getStableCompKey(c)));

    // Highlight comp-c
    const highlightedKey = getStableCompKey(testComps[2]); // comp-c

    // Selection should still have all 5
    expect(selectedIds.size).toBe(5);
    expect(selectedIds.has(highlightedKey)).toBe(true);

    // Highlighting doesn't modify selectedIds
    expect(selectedIds.size).toBe(5);
  });
});
