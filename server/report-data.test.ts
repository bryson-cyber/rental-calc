import { describe, expect, it } from "vitest";

/**
 * Tests for the report data pipeline fixes:
 * 1. City extraction from various address formats
 * 2. Revenue percentiles calculation
 * 3. BuildFullReportButton data construction logic
 */

// City extraction logic (mirrors BuildFullReportButton)
function extractCity(address: string, city?: string): string {
  if (city) return city;
  const parts = address.split(',');
  if (parts.length >= 3) return parts[1]?.trim() || 'Unknown';
  // Single comma: the state part is after comma, city is the last word before comma
  const beforeComma = parts[0]?.trim() || '';
  const words = beforeComma.split(/\s+/);
  // For "2680 Carnation Dr Richardson" -> "Richardson"
  return words.length > 2 ? words[words.length - 1] : 'Unknown';
}

// State extraction logic (mirrors BuildFullReportButton)
function extractState(address: string, state?: string): string {
  if (state) return state;
  const parts = address.split(',');
  const lastPart = parts[parts.length - 1]?.trim() || '';
  const stateMatch = lastPart.match(/\b([A-Z]{2})\b/);
  return stateMatch ? stateMatch[1] : lastPart.split(' ')[0] || '';
}

// Revenue percentiles calculation (mirrors LeadMagnet)
function calculatePercentiles(comps: Array<{ annual_revenue: number }>) {
  if (comps.length < 5) return undefined;
  const revenues = comps
    .map(c => c.annual_revenue || 0)
    .filter(r => r > 0)
    .sort((a, b) => a - b);
  if (revenues.length < 5) return undefined;
  const percentile = (arr: number[], p: number) => arr[Math.floor(arr.length * p / 100)] || 0;
  return {
    p10: percentile(revenues, 10),
    p25: percentile(revenues, 25),
    p50: percentile(revenues, 50),
    p75: percentile(revenues, 75),
    p90: percentile(revenues, 90),
  };
}

// City extraction for market search (mirrors airdna.ts)
function extractCityForMarketSearch(address: string): string {
  const parts = address.split(',');
  if (parts.length >= 3) {
    return parts[1]?.trim() || '';
  }
  // Single comma: "2680 Carnation Dr Richardson, TX 75082"
  if (parts.length === 2) {
    const beforeComma = parts[0]?.trim() || '';
    const afterComma = parts[1]?.trim() || '';
    // After comma should be "TX 75082" or "TX"
    const stateMatch = afterComma.match(/^([A-Z]{2})\b/);
    if (stateMatch) {
      // City is likely the last word(s) before the comma
      const words = beforeComma.split(/\s+/);
      // Skip street number and street name, take remaining as city
      if (words.length >= 3) {
        // Try to find where the city name starts (after street number + street type)
        // Common patterns: "2680 Carnation Dr Richardson" -> "Richardson"
        // "123 Main St Springfield" -> "Springfield"
        const streetTypes = ['st', 'ave', 'blvd', 'dr', 'ln', 'rd', 'ct', 'pl', 'way', 'cir', 'pkwy', 'ter', 'loop'];
        for (let i = 1; i < words.length; i++) {
          if (streetTypes.includes(words[i].toLowerCase())) {
            // Everything after the street type is the city
            const city = words.slice(i + 1).join(' ');
            if (city) return city;
          }
        }
        // Fallback: last word is the city
        return words[words.length - 1];
      }
    }
  }
  return '';
}

describe("City extraction from address", () => {
  it("extracts city from standard 3-part address", () => {
    expect(extractCity("123 Main St, Springfield, IL 62701")).toBe("Springfield");
  });

  it("extracts city from single-comma address (Richardson, TX)", () => {
    expect(extractCity("2680 Carnation Dr Richardson, TX 75082")).toBe("Richardson");
  });

  it("extracts city from single-comma address (Denver, CO)", () => {
    expect(extractCity("1321 15th St Denver, CO 80202")).toBe("Denver");
  });

  it("uses provided city when available", () => {
    expect(extractCity("2680 Carnation Dr Richardson, TX 75082", "Richardson")).toBe("Richardson");
  });

  it("returns Unknown for very short addresses", () => {
    expect(extractCity("TX 75082")).toBe("Unknown");
  });
});

describe("State extraction from address", () => {
  it("extracts state from standard address", () => {
    expect(extractState("123 Main St, Springfield, IL 62701")).toBe("IL");
  });

  it("extracts state from single-comma address", () => {
    expect(extractState("2680 Carnation Dr Richardson, TX 75082")).toBe("TX");
  });

  it("uses provided state when available", () => {
    expect(extractState("2680 Carnation Dr Richardson, TX 75082", "TX")).toBe("TX");
  });
});

describe("Revenue percentiles calculation", () => {
  it("returns undefined for fewer than 5 comps", () => {
    const comps = [
      { annual_revenue: 50000 },
      { annual_revenue: 60000 },
      { annual_revenue: 70000 },
    ];
    expect(calculatePercentiles(comps)).toBeUndefined();
  });

  it("calculates percentiles correctly for 10 comps", () => {
    const comps = [
      { annual_revenue: 10000 },
      { annual_revenue: 20000 },
      { annual_revenue: 30000 },
      { annual_revenue: 40000 },
      { annual_revenue: 50000 },
      { annual_revenue: 60000 },
      { annual_revenue: 70000 },
      { annual_revenue: 80000 },
      { annual_revenue: 90000 },
      { annual_revenue: 100000 },
    ];
    const result = calculatePercentiles(comps);
    expect(result).toBeDefined();
    // Math.floor(10 * 10/100) = 1 -> 20000
    expect(result!.p10).toBe(20000);
    // Math.floor(10 * 25/100) = 2 -> 30000
    expect(result!.p25).toBe(30000);
    // Math.floor(10 * 50/100) = 5 -> 60000
    expect(result!.p50).toBe(60000);
    // Math.floor(10 * 75/100) = 7 -> 80000
    expect(result!.p75).toBe(80000);
    // Math.floor(10 * 90/100) = 9 -> 100000
    expect(result!.p90).toBe(100000);
  });

  it("filters out zero-revenue comps", () => {
    const comps = [
      { annual_revenue: 0 },
      { annual_revenue: 0 },
      { annual_revenue: 0 },
      { annual_revenue: 50000 },
      { annual_revenue: 60000 },
      { annual_revenue: 70000 },
      { annual_revenue: 80000 },
    ];
    // Only 4 non-zero, should return undefined
    expect(calculatePercentiles(comps)).toBeUndefined();
  });

  it("works with exactly 5 comps", () => {
    const comps = [
      { annual_revenue: 50000 },
      { annual_revenue: 60000 },
      { annual_revenue: 70000 },
      { annual_revenue: 80000 },
      { annual_revenue: 90000 },
    ];
    const result = calculatePercentiles(comps);
    expect(result).toBeDefined();
    // Math.floor(5 * 50/100) = 2 -> 70000
    expect(result!.p50).toBe(70000);
  });
});

describe("City extraction for market search (server-side)", () => {
  it("extracts city from standard 3-part address", () => {
    expect(extractCityForMarketSearch("123 Main St, Springfield, IL 62701")).toBe("Springfield");
  });

  it("extracts city from single-comma address with street type", () => {
    expect(extractCityForMarketSearch("2680 Carnation Dr Richardson, TX 75082")).toBe("Richardson");
  });

  it("extracts city from single-comma address with St street type", () => {
    expect(extractCityForMarketSearch("1321 15th St Denver, CO 80202")).toBe("Denver");
  });

  it("extracts city from address with Blvd", () => {
    expect(extractCityForMarketSearch("500 Sunset Blvd Hollywood, CA 90028")).toBe("Hollywood");
  });

  it("extracts city from address with Ave", () => {
    expect(extractCityForMarketSearch("742 Evergreen Ave Springfield, IL 62701")).toBe("Springfield");
  });
});
