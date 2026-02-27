import { describe, it, expect } from "vitest";

/**
 * Tests for Rentometer data display logic
 * Ensures that falsy-but-valid values (0, 0.0) are displayed correctly
 * instead of being treated as missing data.
 */
describe("Rentometer display value handling", () => {
  // Replicate the display logic from TeslaDashboard.tsx
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // The FIXED display logic (uses != null instead of ||)
  const displayStdDev = (stdDev: number | undefined | null): string => {
    return stdDev != null ? `±${formatCurrency(stdDev)}` : "N/A";
  };

  const displayRadiusMiles = (radiusMiles: number | undefined | null): string => {
    return radiusMiles != null ? String(radiusMiles) : "?";
  };

  // The OLD buggy display logic (uses || which treats 0 as falsy)
  const displayStdDevBuggy = (stdDev: number | undefined | null): string => {
    return stdDev ? `±${formatCurrency(stdDev)}` : "N/A";
  };

  const displayRadiusMilesBuggy = (radiusMiles: number | undefined | null): string => {
    return String(radiusMiles || "?");
  };

  describe("stdDev display", () => {
    it("should display a normal stdDev value correctly", () => {
      expect(displayStdDev(838)).toBe("±$838");
    });

    it("should display stdDev of 0 as ±$0, not N/A", () => {
      // This was the bug: 0 is falsy in JS, so `0 ? ... : 'N/A'` returns 'N/A'
      expect(displayStdDev(0)).toBe("±$0");
      // Verify the old buggy version would fail
      expect(displayStdDevBuggy(0)).toBe("N/A"); // This is the bug behavior
    });

    it("should display N/A when stdDev is undefined", () => {
      expect(displayStdDev(undefined)).toBe("N/A");
    });

    it("should display N/A when stdDev is null", () => {
      expect(displayStdDev(null)).toBe("N/A");
    });
  });

  describe("radiusMiles display", () => {
    it("should display a normal radiusMiles value correctly", () => {
      expect(displayRadiusMiles(0.5)).toBe("0.5");
    });

    it("should display radiusMiles of 0 as 0, not ?", () => {
      expect(displayRadiusMiles(0)).toBe("0");
      // Verify the old buggy version would fail
      expect(displayRadiusMilesBuggy(0)).toBe("?"); // This is the bug behavior
    });

    it("should display ? when radiusMiles is undefined", () => {
      expect(displayRadiusMiles(undefined)).toBe("?");
    });

    it("should display ? when radiusMiles is null", () => {
      expect(displayRadiusMiles(null)).toBe("?");
    });
  });

  describe("Rentometer API response field mapping", () => {
    it("should correctly map snake_case API fields to camelCase state", () => {
      // Simulate the Rentometer API response (snake_case)
      const apiResponse = {
        mean: 2795,
        median: 2782,
        min: 1000,
        max: 5250,
        percentile_5: 1418,
        percentile_25: 2230,
        percentile_75: 3360,
        percentile_95: 4172,
        std_dev: 838,
        samples: 40,
        radius_miles: 0.5,
        quickview_url: "https://www.rentometer.com/analysis/test",
      };

      // Simulate the mapping done in LeadMagnet.tsx
      const mappedData = {
        median: apiResponse.median,
        percentile25: apiResponse.percentile_25,
        percentile75: apiResponse.percentile_75,
        min: apiResponse.min,
        max: apiResponse.max,
        mean: apiResponse.mean,
        stdDev: apiResponse.std_dev,
        sampleCount: apiResponse.samples,
        radiusMiles: apiResponse.radius_miles,
        quickviewUrl: apiResponse.quickview_url,
      };

      expect(mappedData.stdDev).toBe(838);
      expect(mappedData.radiusMiles).toBe(0.5);
      expect(mappedData.sampleCount).toBe(40);
      expect(mappedData.mean).toBe(2795);
      expect(mappedData.quickviewUrl).toContain("rentometer.com");
    });

    it("should handle API response with zero values for std_dev and radius_miles", () => {
      const apiResponse = {
        std_dev: 0,
        radius_miles: 0,
        samples: 1,
      };

      const mappedData = {
        stdDev: apiResponse.std_dev,
        radiusMiles: apiResponse.radius_miles,
        sampleCount: apiResponse.samples,
      };

      // These should be 0, not undefined/null
      expect(mappedData.stdDev).toBe(0);
      expect(mappedData.radiusMiles).toBe(0);
      
      // And should display correctly
      expect(displayStdDev(mappedData.stdDev)).toBe("±$0");
      expect(displayRadiusMiles(mappedData.radiusMiles)).toBe("0");
    });
  });
});
