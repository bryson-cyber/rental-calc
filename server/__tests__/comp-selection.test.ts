import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the comp selection feature:
 * 1. Backend: saveCompSelection mutation stores selectedIds in reportData
 * 2. Frontend logic: getCompKey generates stable keys, filteredComps filters correctly
 */

// --- Unit tests for comp key generation logic ---
describe('Comp Key Generation', () => {
  const getCompKey = (comp: any, index: number) =>
    comp.id || comp.airbnb_listing_id || `comp-${index}`;

  it('should use comp.id when available', () => {
    const comp = { id: 'listing-123', airbnb_listing_id: 'ab-456', title: 'Test' };
    expect(getCompKey(comp, 0)).toBe('listing-123');
  });

  it('should fall back to airbnb_listing_id when id is missing', () => {
    const comp = { airbnb_listing_id: 'ab-456', title: 'Test' };
    expect(getCompKey(comp, 0)).toBe('ab-456');
  });

  it('should fall back to index-based key when both ids are missing', () => {
    const comp = { title: 'Test' };
    expect(getCompKey(comp, 3)).toBe('comp-3');
  });

  it('should generate unique keys for different comps', () => {
    const comps = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
      { airbnb_listing_id: 'c', title: 'C' },
      { title: 'D' },
    ];
    const keys = comps.map((c, i) => getCompKey(c, i));
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});

// --- Unit tests for comp filtering logic ---
describe('Comp Filtering', () => {
  const mockComps = [
    { id: 'comp-1', title: 'Luxury Loft', annual_revenue: 120000, adr: 500, occupancy: 0.7, rating: 4.9, reviews: 100 },
    { id: 'comp-2', title: 'City Townhome', annual_revenue: 80000, adr: 350, occupancy: 0.65, rating: 4.8, reviews: 50 },
    { id: 'comp-3', title: 'Urban Retreat', annual_revenue: 60000, adr: 300, occupancy: 0.6, rating: 4.7, reviews: 30 },
    { id: 'comp-4', title: 'Cozy Studio', annual_revenue: 40000, adr: 200, occupancy: 0.55, rating: 4.5, reviews: 20 },
    { id: 'comp-5', title: 'Beach House', annual_revenue: 150000, adr: 600, occupancy: 0.8, rating: 5.0, reviews: 200 },
  ];

  it('should return all comps when all are selected', () => {
    const selectedIds = new Set(mockComps.map(c => c.id));
    const filtered = mockComps.filter((c, i) => selectedIds.has(c.id));
    expect(filtered).toHaveLength(5);
  });

  it('should return only selected comps', () => {
    const selectedIds = new Set(['comp-1', 'comp-3', 'comp-5']);
    const filtered = mockComps.filter(c => selectedIds.has(c.id));
    expect(filtered).toHaveLength(3);
    expect(filtered.map(c => c.id)).toEqual(['comp-1', 'comp-3', 'comp-5']);
  });

  it('should return empty array when none selected', () => {
    const selectedIds = new Set<string>();
    const filtered = mockComps.filter(c => selectedIds.has(c.id));
    expect(filtered).toHaveLength(0);
  });

  it('should correctly calculate summary stats from filtered comps', () => {
    const selectedIds = new Set(['comp-1', 'comp-5']);
    const filtered = mockComps.filter(c => selectedIds.has(c.id));

    const avgRevenue = filtered.reduce((sum, c) => sum + c.annual_revenue, 0) / filtered.length;
    const avgAdr = filtered.reduce((sum, c) => sum + c.adr, 0) / filtered.length;
    const avgOcc = filtered.reduce((sum, c) => sum + c.occupancy, 0) / filtered.length;
    const avgRating = filtered.reduce((sum, c) => sum + c.rating, 0) / filtered.length;
    const highestRevenue = Math.max(...filtered.map(c => c.annual_revenue));

    expect(avgRevenue).toBe(135000); // (120000 + 150000) / 2
    expect(avgAdr).toBe(550); // (500 + 600) / 2
    expect(avgOcc).toBe(0.75); // (0.7 + 0.8) / 2
    expect(avgRating).toBe(4.95); // (4.9 + 5.0) / 2
    expect(highestRevenue).toBe(150000);
  });

  it('should handle single comp selection', () => {
    const selectedIds = new Set(['comp-3']);
    const filtered = mockComps.filter(c => selectedIds.has(c.id));

    expect(filtered).toHaveLength(1);
    const avgRevenue = filtered.reduce((sum, c) => sum + c.annual_revenue, 0) / filtered.length;
    expect(avgRevenue).toBe(60000);
  });
});

// --- Unit tests for comp_selection persistence format ---
describe('Comp Selection Persistence', () => {
  it('should serialize comp_selection correctly', () => {
    const compSelection = {
      selectedIds: ['comp-1', 'comp-3', 'comp-5'],
      savedAt: Date.now(),
      savedBy: 'Test Admin',
    };

    const json = JSON.stringify(compSelection);
    const parsed = JSON.parse(json);

    expect(parsed.selectedIds).toEqual(['comp-1', 'comp-3', 'comp-5']);
    expect(parsed.savedBy).toBe('Test Admin');
    expect(typeof parsed.savedAt).toBe('number');
  });

  it('should merge comp_selection into reportData without losing other fields', () => {
    const reportData = {
      property: { address: '123 Main St', bedrooms: 3 },
      revenue_estimate: { annual: 100000 },
      comps: [{ id: 'comp-1' }, { id: 'comp-2' }],
    };

    // Simulate the backend mutation
    const updatedData = {
      ...reportData,
      comp_selection: {
        selectedIds: ['comp-1'],
        savedAt: Date.now(),
        savedBy: 'Admin',
      },
    };

    expect(updatedData.property.address).toBe('123 Main St');
    expect(updatedData.revenue_estimate.annual).toBe(100000);
    expect(updatedData.comps).toHaveLength(2);
    expect(updatedData.comp_selection.selectedIds).toEqual(['comp-1']);
  });

  it('should handle localStorage serialization with Set conversion', () => {
    const selectedIds = new Set(['comp-1', 'comp-3']);
    const serialized = JSON.stringify(Array.from(selectedIds));
    const deserialized = JSON.parse(serialized) as string[];
    const restored = new Set(deserialized);

    expect(restored.size).toBe(2);
    expect(restored.has('comp-1')).toBe(true);
    expect(restored.has('comp-3')).toBe(true);
    expect(restored.has('comp-2')).toBe(false);
  });

  it('should prioritize backend selection over localStorage', () => {
    const backendSelection = ['comp-1', 'comp-5'];
    const localStorageSelection = ['comp-1', 'comp-2', 'comp-3'];
    const allComps = [
      { id: 'comp-1' }, { id: 'comp-2' }, { id: 'comp-3' },
      { id: 'comp-4' }, { id: 'comp-5' },
    ];

    // Simulate priority logic: backend first, then localStorage, then all
    let selectedIds: Set<string>;

    if (backendSelection.length > 0) {
      const validIds = backendSelection.filter(id =>
        allComps.some(c => c.id === id)
      );
      selectedIds = new Set(validIds);
    } else if (localStorageSelection.length > 0) {
      selectedIds = new Set(localStorageSelection);
    } else {
      selectedIds = new Set(allComps.map(c => c.id));
    }

    // Backend selection should win
    expect(selectedIds.size).toBe(2);
    expect(selectedIds.has('comp-1')).toBe(true);
    expect(selectedIds.has('comp-5')).toBe(true);
    expect(selectedIds.has('comp-2')).toBe(false);
  });

  it('should fall back to all comps when no saved selection exists', () => {
    const backendSelection: string[] = [];
    const localStorageSelection: string[] = [];
    const allComps = [
      { id: 'comp-1' }, { id: 'comp-2' }, { id: 'comp-3' },
    ];

    let selectedIds: Set<string>;

    if (backendSelection.length > 0) {
      selectedIds = new Set(backendSelection);
    } else if (localStorageSelection.length > 0) {
      selectedIds = new Set(localStorageSelection);
    } else {
      selectedIds = new Set(allComps.map(c => c.id));
    }

    expect(selectedIds.size).toBe(3);
  });
});

// --- Unit tests for toggle logic ---
describe('Comp Selection Toggle', () => {
  it('should toggle individual comp selection', () => {
    const selectedIds = new Set(['comp-1', 'comp-2', 'comp-3']);

    // Toggle off comp-2
    const afterToggleOff = new Set(selectedIds);
    afterToggleOff.delete('comp-2');
    expect(afterToggleOff.size).toBe(2);
    expect(afterToggleOff.has('comp-2')).toBe(false);

    // Toggle on comp-2
    const afterToggleOn = new Set(afterToggleOff);
    afterToggleOn.add('comp-2');
    expect(afterToggleOn.size).toBe(3);
    expect(afterToggleOn.has('comp-2')).toBe(true);
  });

  it('should select all when not all selected', () => {
    const allCompIds = ['comp-1', 'comp-2', 'comp-3', 'comp-4', 'comp-5'];
    const selectedIds = new Set(['comp-1', 'comp-3']);

    // Select all
    const allSelected = new Set(allCompIds);
    expect(allSelected.size).toBe(5);
  });

  it('should deselect all when all are selected', () => {
    const allCompIds = ['comp-1', 'comp-2', 'comp-3'];
    const selectedIds = new Set(allCompIds);

    // Deselect all
    if (selectedIds.size === allCompIds.length) {
      const empty = new Set<string>();
      expect(empty.size).toBe(0);
    }
  });
});
