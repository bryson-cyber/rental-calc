import { describe, it, expect } from 'vitest';

/**
 * Tests for the stable revenue rank feature:
 * - Revenue rank (#) should always reflect the comp's position when sorted by revenue (desc)
 * - Rank should NOT change when the user sorts the table by a different field (distance, ADR, etc.)
 * - getStableCompKey should return the same key regardless of the comp's position in the sorted array
 */

// Replicate the key generation logic from FullPropertyReport.tsx
const getCompKey = (comp: any, displayIndex: number) =>
  comp.id || comp.airbnb_listing_id || `comp-${displayIndex}`;

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
}

// Build displayComps (sorted by revenue desc) and the helper maps
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

// Sort helper (mirrors FullPropertyReport sorting logic)
type SortField = 'revenue' | 'adr' | 'occupancy' | 'rating' | 'reviews' | 'distance';
type SortDir = 'asc' | 'desc';

function sortComps(displayComps: MockComp[], field: SortField, dir: SortDir): MockComp[] {
  const sorted = [...displayComps];
  sorted.sort((a, b) => {
    let aVal: number, bVal: number;
    switch (field) {
      case 'revenue': aVal = a.annual_revenue || 0; bVal = b.annual_revenue || 0; break;
      case 'adr': aVal = a.adr || 0; bVal = b.adr || 0; break;
      case 'occupancy': aVal = a.occupancy || 0; bVal = b.occupancy || 0; break;
      case 'rating': aVal = a.rating || 0; bVal = b.rating || 0; break;
      case 'reviews': aVal = a.reviews || 0; bVal = b.reviews || 0; break;
      case 'distance': aVal = a.distance_meters ?? 9999; bVal = b.distance_meters ?? 9999; break;
      default: aVal = a.annual_revenue || 0; bVal = b.annual_revenue || 0;
    }
    return dir === 'desc' ? bVal - aVal : aVal - bVal;
  });
  return sorted;
}

const testComps: MockComp[] = [
  { id: 'comp-a', title: 'Amazing Luxury 5BR', annual_revenue: 115935, adr: 450, occupancy: 0.71, rating: 4.8, reviews: 132, distance_meters: 2500 },
  { id: 'comp-b', title: 'Exquisite 6BR Retreat', annual_revenue: 99063, adr: 380, occupancy: 0.68, rating: 4.8, reviews: 38, distance_meters: 1200 },
  { id: 'comp-c', title: 'Peaceful 6BR Home', annual_revenue: 86382, adr: 320, occupancy: 0.74, rating: 4.8, reviews: 94, distance_meters: 800 },
  { id: 'comp-d', title: 'Grand Retreat', annual_revenue: 85405, adr: 410, occupancy: 0.57, rating: 5.0, reviews: 47, distance_meters: 3200 },
  { id: 'comp-e', title: 'Spacious 6BR/3.5BA', annual_revenue: 63105, adr: 280, occupancy: 0.62, rating: 4.8, reviews: 121, distance_meters: 600 },
];

describe('Stable Revenue Rank', () => {
  it('should assign ranks based on revenue descending order', () => {
    const { revenueRankMap, getStableCompKey } = buildCompMaps(testComps);

    expect(revenueRankMap.get(getStableCompKey(testComps[0]))).toBe(1); // $115,935
    expect(revenueRankMap.get(getStableCompKey(testComps[1]))).toBe(2); // $99,063
    expect(revenueRankMap.get(getStableCompKey(testComps[2]))).toBe(3); // $86,382
    expect(revenueRankMap.get(getStableCompKey(testComps[3]))).toBe(4); // $85,405
    expect(revenueRankMap.get(getStableCompKey(testComps[4]))).toBe(5); // $63,105
  });

  it('should keep the same rank when sorted by distance ascending', () => {
    const { displayComps, revenueRankMap, getStableCompKey } = buildCompMaps(testComps);
    const sortedByDistance = sortComps(displayComps, 'distance', 'asc');

    // After sorting by distance, the order changes but ranks should stay the same
    // Distance order: comp-e (600m), comp-c (800m), comp-b (1200m), comp-a (2500m), comp-d (3200m)
    expect(sortedByDistance[0].title).toBe('Spacious 6BR/3.5BA'); // 600m, but rank 5
    expect(revenueRankMap.get(getStableCompKey(sortedByDistance[0]))).toBe(5);

    expect(sortedByDistance[1].title).toBe('Peaceful 6BR Home'); // 800m, but rank 3
    expect(revenueRankMap.get(getStableCompKey(sortedByDistance[1]))).toBe(3);

    expect(sortedByDistance[2].title).toBe('Exquisite 6BR Retreat'); // 1200m, but rank 2
    expect(revenueRankMap.get(getStableCompKey(sortedByDistance[2]))).toBe(2);

    expect(sortedByDistance[3].title).toBe('Amazing Luxury 5BR'); // 2500m, but rank 1
    expect(revenueRankMap.get(getStableCompKey(sortedByDistance[3]))).toBe(1);

    expect(sortedByDistance[4].title).toBe('Grand Retreat'); // 3200m, but rank 4
    expect(revenueRankMap.get(getStableCompKey(sortedByDistance[4]))).toBe(4);
  });

  it('should keep the same rank when sorted by reviews descending', () => {
    const { displayComps, revenueRankMap, getStableCompKey } = buildCompMaps(testComps);
    const sortedByReviews = sortComps(displayComps, 'reviews', 'desc');

    // Reviews order: comp-a (132), comp-e (121), comp-c (94), comp-d (47), comp-b (38)
    expect(sortedByReviews[0].title).toBe('Amazing Luxury 5BR'); // 132 reviews, rank 1
    expect(revenueRankMap.get(getStableCompKey(sortedByReviews[0]))).toBe(1);

    expect(sortedByReviews[1].title).toBe('Spacious 6BR/3.5BA'); // 121 reviews, rank 5
    expect(revenueRankMap.get(getStableCompKey(sortedByReviews[1]))).toBe(5);
  });

  it('should keep the same rank when sorted by rating descending', () => {
    const { displayComps, revenueRankMap, getStableCompKey } = buildCompMaps(testComps);
    const sortedByRating = sortComps(displayComps, 'rating', 'desc');

    // Grand Retreat has rating 5.0 (rank 4 by revenue)
    expect(sortedByRating[0].title).toBe('Grand Retreat');
    expect(revenueRankMap.get(getStableCompKey(sortedByRating[0]))).toBe(4);
  });

  it('should keep the same rank when sorted by ADR descending', () => {
    const { displayComps, revenueRankMap, getStableCompKey } = buildCompMaps(testComps);
    const sortedByAdr = sortComps(displayComps, 'adr', 'desc');

    // ADR order: comp-a (450), comp-d (410), comp-b (380), comp-c (320), comp-e (280)
    sortedByAdr.forEach((comp) => {
      const rank = revenueRankMap.get(getStableCompKey(comp));
      expect(rank).toBeDefined();
      expect(rank).toBeGreaterThan(0);
      expect(rank).toBeLessThanOrEqual(5);
    });
  });
});

describe('Stable Comp Keys', () => {
  it('should generate the same key for a comp regardless of sort order', () => {
    const { displayComps, getStableCompKey } = buildCompMaps(testComps);

    // Get keys from revenue-sorted order
    const keysFromRevenueSorted = displayComps.map(c => getStableCompKey(c));

    // Get keys from distance-sorted order
    const sortedByDistance = sortComps(displayComps, 'distance', 'asc');
    const keysFromDistanceSorted = sortedByDistance.map(c => getStableCompKey(c));

    // The set of keys should be the same
    expect(new Set(keysFromRevenueSorted)).toEqual(new Set(keysFromDistanceSorted));

    // Each individual comp should have the same key
    for (const comp of displayComps) {
      const keyFromRevenue = getStableCompKey(comp);
      const keyFromDistance = getStableCompKey(comp);
      expect(keyFromRevenue).toBe(keyFromDistance);
    }
  });

  it('should use comp.id as key when available', () => {
    const { getStableCompKey } = buildCompMaps(testComps);
    expect(getStableCompKey(testComps[0])).toBe('comp-a');
  });

  it('should use airbnb_listing_id when id is missing', () => {
    const compsWithoutId: MockComp[] = [
      { airbnb_listing_id: 'ab-123', title: 'Test A', annual_revenue: 100000, adr: 400, occupancy: 0.7, rating: 4.8, reviews: 50 },
      { airbnb_listing_id: 'ab-456', title: 'Test B', annual_revenue: 80000, adr: 350, occupancy: 0.65, rating: 4.7, reviews: 30 },
    ];
    const { getStableCompKey } = buildCompMaps(compsWithoutId);
    expect(getStableCompKey(compsWithoutId[0])).toBe('ab-123');
    expect(getStableCompKey(compsWithoutId[1])).toBe('ab-456');
  });

  it('should use displayIndex-based key when both ids are missing', () => {
    const compsWithoutIds: MockComp[] = [
      { title: 'Test A', annual_revenue: 100000, adr: 400, occupancy: 0.7, rating: 4.8, reviews: 50 },
      { title: 'Test B', annual_revenue: 80000, adr: 350, occupancy: 0.65, rating: 4.7, reviews: 30 },
    ];
    const { getStableCompKey } = buildCompMaps(compsWithoutIds);
    // Test A has higher revenue, so displayIndex = 0
    expect(getStableCompKey(compsWithoutIds[0])).toBe('comp-0');
    // Test B has lower revenue, so displayIndex = 1
    expect(getStableCompKey(compsWithoutIds[1])).toBe('comp-1');
  });

  it('should maintain stable keys even when comps without ids are re-sorted', () => {
    const compsWithoutIds: MockComp[] = [
      { title: 'High Revenue', annual_revenue: 150000, adr: 500, occupancy: 0.8, rating: 4.9, reviews: 200, distance_meters: 3000 },
      { title: 'Mid Revenue', annual_revenue: 100000, adr: 400, occupancy: 0.7, rating: 4.8, reviews: 100, distance_meters: 1000 },
      { title: 'Low Revenue', annual_revenue: 50000, adr: 200, occupancy: 0.5, rating: 4.5, reviews: 20, distance_meters: 500 },
    ];

    const { displayComps, revenueRankMap, getStableCompKey } = buildCompMaps(compsWithoutIds);

    // Revenue-sorted: High (rank 1), Mid (rank 2), Low (rank 3)
    expect(revenueRankMap.get(getStableCompKey(compsWithoutIds[0]))).toBe(1);
    expect(revenueRankMap.get(getStableCompKey(compsWithoutIds[1]))).toBe(2);
    expect(revenueRankMap.get(getStableCompKey(compsWithoutIds[2]))).toBe(3);

    // Sort by distance: Low (500m), Mid (1000m), High (3000m)
    const sortedByDist = sortComps(displayComps, 'distance', 'asc');
    expect(sortedByDist[0].title).toBe('Low Revenue');
    expect(revenueRankMap.get(getStableCompKey(sortedByDist[0]))).toBe(3); // Still rank 3!
    expect(sortedByDist[1].title).toBe('Mid Revenue');
    expect(revenueRankMap.get(getStableCompKey(sortedByDist[1]))).toBe(2); // Still rank 2!
    expect(sortedByDist[2].title).toBe('High Revenue');
    expect(revenueRankMap.get(getStableCompKey(sortedByDist[2]))).toBe(1); // Still rank 1!
  });
});

describe('Checkbox Selection Stability', () => {
  it('should maintain selection when sort order changes', () => {
    const { displayComps, getStableCompKey } = buildCompMaps(testComps);

    // Select comps 1 and 3 (by revenue rank)
    const selectedIds = new Set([
      getStableCompKey(displayComps[0]), // rank 1
      getStableCompKey(displayComps[2]), // rank 3
    ]);

    // Sort by distance
    const sortedByDistance = sortComps(displayComps, 'distance', 'asc');

    // Check that the same comps are still selected
    const selectedAfterSort = sortedByDistance.filter(c => selectedIds.has(getStableCompKey(c)));
    expect(selectedAfterSort).toHaveLength(2);
    expect(selectedAfterSort.map(c => c.title).sort()).toEqual(
      ['Amazing Luxury 5BR', 'Peaceful 6BR Home'].sort()
    );
  });

  it('should correctly filter comps using stable keys after re-sort', () => {
    const { displayComps, getStableCompKey } = buildCompMaps(testComps);

    // Select all except rank 5
    const selectedIds = new Set(
      displayComps.slice(0, 4).map(c => getStableCompKey(c))
    );

    // Filter using stable keys (this is what filteredComps does)
    const filtered = displayComps.filter(c => selectedIds.has(getStableCompKey(c)));
    expect(filtered).toHaveLength(4);
    expect(filtered.find(c => c.title === 'Spacious 6BR/3.5BA')).toBeUndefined();
  });
});
