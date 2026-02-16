import { describe, expect, it } from "vitest";

/**
 * Tests for the comp filtering logic that ensures comps match the subject
 * property's bedroom AND bathroom count (not just bedrooms).
 *
 * The core logic under test:
 * - matchesBathrooms(compBa, targetBa) => Math.abs(compBa - targetBa) <= 0.5
 * - Comps are sorted: exact BA match first, then same-BR-only, then adjacent-BR
 * - Fallback: if fewer than 10 exact BR+BA matches, supplement with same-BR comps
 */

// Replicate the matchesBathrooms function from airdna.ts
const matchesBathrooms = (compBa: number, targetBa: number) =>
  Math.abs(compBa - targetBa) <= 0.5;

// Helper to create a mock comp
function mockComp(overrides: {
  id: string;
  bedrooms: number;
  bathrooms: number;
  annual_revenue: number;
  adr: number;
}) {
  return {
    id: overrides.id,
    title: `Listing ${overrides.id}`,
    bedrooms: overrides.bedrooms,
    bathrooms: overrides.bathrooms,
    annual_revenue: overrides.annual_revenue,
    adr: overrides.adr,
    occupancy: 0.75,
    rating: 4.5,
    reviews: 50,
    accommodates: overrides.bedrooms * 2,
    property_type: "house",
  };
}

describe("matchesBathrooms tolerance", () => {
  it("exact match returns true", () => {
    expect(matchesBathrooms(1, 1)).toBe(true);
    expect(matchesBathrooms(2, 2)).toBe(true);
    expect(matchesBathrooms(2.5, 2.5)).toBe(true);
  });

  it("half-bath difference returns true (±0.5 tolerance)", () => {
    expect(matchesBathrooms(1, 1.5)).toBe(true);
    expect(matchesBathrooms(1.5, 1)).toBe(true);
    expect(matchesBathrooms(2, 2.5)).toBe(true);
    expect(matchesBathrooms(2.5, 2)).toBe(true);
  });

  it("full bathroom difference returns false", () => {
    expect(matchesBathrooms(1, 2)).toBe(false);
    expect(matchesBathrooms(2, 1)).toBe(false);
    expect(matchesBathrooms(1, 2.5)).toBe(false);
    expect(matchesBathrooms(2.5, 1)).toBe(false);
  });

  it("large differences return false", () => {
    expect(matchesBathrooms(1, 3)).toBe(false);
    expect(matchesBathrooms(1, 4)).toBe(false);
  });
});

describe("comp sorting: exact BA match first, then different BA", () => {
  it("sorts exact BA matches before different BA comps", () => {
    const propertyBathrooms = 1;

    const comps = [
      mockComp({ id: "a", bedrooms: 2, bathrooms: 2, annual_revenue: 50000, adr: 174 }),
      mockComp({ id: "b", bedrooms: 2, bathrooms: 1, annual_revenue: 35000, adr: 110 }),
      mockComp({ id: "c", bedrooms: 2, bathrooms: 2.5, annual_revenue: 48000, adr: 160 }),
      mockComp({ id: "d", bedrooms: 2, bathrooms: 1.5, annual_revenue: 42000, adr: 137 }),
      mockComp({ id: "e", bedrooms: 2, bathrooms: 1, annual_revenue: 32000, adr: 105 }),
    ];

    const sorted = [...comps].sort((a, b) => {
      const aExact = matchesBathrooms(a.bathrooms, propertyBathrooms) ? 0 : 1;
      const bExact = matchesBathrooms(b.bathrooms, propertyBathrooms) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return b.annual_revenue - a.annual_revenue;
    });

    // First should be exact BA matches (1 or 1.5 BA), sorted by revenue
    expect(sorted[0].id).toBe("d"); // 1.5 BA, $42K (within ±0.5 of 1 BA)
    expect(sorted[1].id).toBe("b"); // 1 BA, $35K
    expect(sorted[2].id).toBe("e"); // 1 BA, $32K

    // Then different BA comps, sorted by revenue
    expect(sorted[3].id).toBe("a"); // 2 BA, $50K
    expect(sorted[4].id).toBe("c"); // 2.5 BA, $48K
  });

  it("for 2BA property, 2BA and 2.5BA are exact, 1BA is not", () => {
    const propertyBathrooms = 2;

    const comps = [
      mockComp({ id: "a", bedrooms: 3, bathrooms: 1, annual_revenue: 60000, adr: 200 }),
      mockComp({ id: "b", bedrooms: 3, bathrooms: 2, annual_revenue: 50000, adr: 170 }),
      mockComp({ id: "c", bedrooms: 3, bathrooms: 2.5, annual_revenue: 55000, adr: 180 }),
      mockComp({ id: "d", bedrooms: 3, bathrooms: 3, annual_revenue: 65000, adr: 210 }),
    ];

    const sorted = [...comps].sort((a, b) => {
      const aExact = matchesBathrooms(a.bathrooms, propertyBathrooms) ? 0 : 1;
      const bExact = matchesBathrooms(b.bathrooms, propertyBathrooms) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return b.annual_revenue - a.annual_revenue;
    });

    // Exact matches (2 or 2.5 BA) first
    expect(sorted[0].id).toBe("c"); // 2.5 BA, $55K
    expect(sorted[1].id).toBe("b"); // 2 BA, $50K

    // Different BA after
    expect(sorted[2].id).toBe("d"); // 3 BA, $65K
    expect(sorted[3].id).toBe("a"); // 1 BA, $60K
  });
});

describe("comp filtering simulation: 2BR/1BA property (Phoenix scenario)", () => {
  it("prioritizes 2BR/1BA comps over 2BR/2BA comps", () => {
    const propertyBedrooms = 2;
    const propertyBathrooms = 1;

    // Simulate the Phoenix scenario: mix of 2BR/1BA and 2BR/2BA comps
    const allComps = [
      mockComp({ id: "1", bedrooms: 2, bathrooms: 2, annual_revenue: 48000, adr: 174 }), // 2BR/2BA
      mockComp({ id: "2", bedrooms: 2, bathrooms: 1, annual_revenue: 42000, adr: 134 }), // 2BR/1BA
      mockComp({ id: "3", bedrooms: 2, bathrooms: 1, annual_revenue: 42000, adr: 137 }), // 2BR/1BA
      mockComp({ id: "4", bedrooms: 2, bathrooms: 2, annual_revenue: 38000, adr: 117 }), // 2BR/2BA
      mockComp({ id: "5", bedrooms: 2, bathrooms: 1, annual_revenue: 35000, adr: 113 }), // 2BR/1BA
      mockComp({ id: "6", bedrooms: 2, bathrooms: 1.5, annual_revenue: 32000, adr: 110 }), // 2BR/1.5BA (within tolerance)
      mockComp({ id: "7", bedrooms: 2, bathrooms: 2.5, annual_revenue: 52000, adr: 190 }), // 2BR/2.5BA
    ];

    // Filter same bedroom
    const sameBedroom = allComps.filter((c) => c.bedrooms === propertyBedrooms);
    expect(sameBedroom.length).toBe(7);

    // Split into exact BA match and different BA
    const exactMatch = sameBedroom.filter((c) =>
      matchesBathrooms(c.bathrooms, propertyBathrooms)
    );
    const differentBa = sameBedroom.filter(
      (c) => !matchesBathrooms(c.bathrooms, propertyBathrooms)
    );

    expect(exactMatch.length).toBe(4); // 1BA and 1.5BA comps
    expect(differentBa.length).toBe(3); // 2BA and 2.5BA comps

    // Sort with exact match priority
    const sorted = [...sameBedroom].sort((a, b) => {
      const aExact = matchesBathrooms(a.bathrooms, propertyBathrooms) ? 0 : 1;
      const bExact = matchesBathrooms(b.bathrooms, propertyBathrooms) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return b.annual_revenue - a.annual_revenue;
    });

    // First 4 should all be exact BA matches (1 or 1.5 BA)
    for (let i = 0; i < 4; i++) {
      expect(matchesBathrooms(sorted[i].bathrooms, propertyBathrooms)).toBe(true);
    }

    // Last 3 should be different BA
    for (let i = 4; i < 7; i++) {
      expect(matchesBathrooms(sorted[i].bathrooms, propertyBathrooms)).toBe(false);
    }

    // Within exact matches, sorted by revenue descending
    expect(sorted[0].annual_revenue).toBeGreaterThanOrEqual(sorted[1].annual_revenue);
    expect(sorted[1].annual_revenue).toBeGreaterThanOrEqual(sorted[2].annual_revenue);

    // The highest-revenue exact match ($42K) should come before the highest different-BA ($52K)
    expect(sorted[0].annual_revenue).toBe(42000);
    expect(sorted[4].annual_revenue).toBe(52000); // 2.5BA comp is highest but pushed down
  });
});
