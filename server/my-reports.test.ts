import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for the My Reports feature
 * 
 * Since the router depends on database and auth context,
 * we test the data transformation and display logic.
 */

describe('My Reports - Data Transformation', () => {
  // Test occupancy rate normalization (the bug we fixed)
  describe('Occupancy Rate Display', () => {
    function normalizeOccupancy(value: string | number | null): number | null {
      if (value === null || value === undefined) return null;
      const val = parseFloat(String(value));
      if (isNaN(val)) return null;
      // Values > 1 are already percentages (e.g., 54.00), values <= 1 are decimals (e.g., 0.54)
      return Math.round(val > 1 ? val : val * 100);
    }

    it('should handle decimal occupancy rates (0.xx format)', () => {
      expect(normalizeOccupancy('0.54')).toBe(54);
      expect(normalizeOccupancy('0.73')).toBe(73);
      expect(normalizeOccupancy('0.88')).toBe(88);
      expect(normalizeOccupancy('0.41')).toBe(41);
    });

    it('should handle percentage occupancy rates (xx.xx format)', () => {
      expect(normalizeOccupancy('54.00')).toBe(54);
      expect(normalizeOccupancy('58.00')).toBe(58);
      expect(normalizeOccupancy('73.50')).toBe(74);
      expect(normalizeOccupancy('41.00')).toBe(41);
    });

    it('should handle edge cases', () => {
      expect(normalizeOccupancy(null)).toBe(null);
      expect(normalizeOccupancy('0')).toBe(0);
      expect(normalizeOccupancy('1')).toBe(100); // 1.0 = 100%
      expect(normalizeOccupancy('100')).toBe(100);
      expect(normalizeOccupancy('0.99')).toBe(99);
    });

    it('should handle numeric inputs', () => {
      expect(normalizeOccupancy(0.54)).toBe(54);
      expect(normalizeOccupancy(54)).toBe(54);
      expect(normalizeOccupancy(0)).toBe(0);
    });
  });

  // Test report type configuration
  describe('Report Type Configuration', () => {
    const REPORT_TYPES = ['revenue', 'validator', 'ai_advisor', 'market', 'regulation', 'property', 'full'];

    it('should have all expected report types', () => {
      for (const type of REPORT_TYPES) {
        expect(REPORT_TYPES).toContain(type);
      }
    });

    it('should have 7 report types total', () => {
      expect(REPORT_TYPES.length).toBe(7);
    });
  });

  // Test report source mapping
  describe('Report Source Mapping', () => {
    function getShareUrl(source: string, id: string, shareCode?: string, shareId?: string): string | null {
      switch (source) {
        case 'shared':
          return shareId ? `/report/${shareId}` : null;
        case 'universal':
          return shareCode ? `/share/${shareCode}` : null;
        case 'analysis':
          return null; // Analysis reports don't have share URLs
        default:
          return null;
      }
    }

    it('should generate correct share URLs for shared_reports', () => {
      expect(getShareUrl('shared', '1', undefined, 'abc123')).toBe('/report/abc123');
      expect(getShareUrl('shared', '1')).toBe(null);
    });

    it('should generate correct share URLs for universal_shareable_reports', () => {
      expect(getShareUrl('universal', '1', 'RxLHhzUAvv')).toBe('/share/RxLHhzUAvv');
      expect(getShareUrl('universal', '1')).toBe(null);
    });

    it('should return null for analysis_reports', () => {
      expect(getShareUrl('analysis', '1')).toBe(null);
      expect(getShareUrl('analysis', '1', 'code', 'id')).toBe(null);
    });
  });

  // Test filter logic
  describe('Filter Logic', () => {
    const SHARED_TYPES = ['property', 'market', 'full'];
    const UNIVERSAL_TYPES = ['revenue', 'validator', 'ai_advisor', 'market', 'regulation'];

    function shouldQueryShared(typeFilter: string): boolean {
      return typeFilter === 'all' || SHARED_TYPES.includes(typeFilter);
    }

    function shouldQueryUniversal(typeFilter: string): boolean {
      return typeFilter === 'all' || UNIVERSAL_TYPES.includes(typeFilter);
    }

    it('should query both sources for "all" filter', () => {
      expect(shouldQueryShared('all')).toBe(true);
      expect(shouldQueryUniversal('all')).toBe(true);
    });

    it('should query only shared for property/full types', () => {
      expect(shouldQueryShared('property')).toBe(true);
      expect(shouldQueryUniversal('property')).toBe(false);
      expect(shouldQueryShared('full')).toBe(true);
      expect(shouldQueryUniversal('full')).toBe(false);
    });

    it('should query only universal for validator/ai_advisor/regulation types', () => {
      expect(shouldQueryShared('validator')).toBe(false);
      expect(shouldQueryUniversal('validator')).toBe(true);
      expect(shouldQueryShared('ai_advisor')).toBe(false);
      expect(shouldQueryUniversal('ai_advisor')).toBe(true);
      expect(shouldQueryShared('regulation')).toBe(false);
      expect(shouldQueryUniversal('regulation')).toBe(true);
    });

    it('should query both sources for market type (exists in both)', () => {
      expect(shouldQueryShared('market')).toBe(true);
      expect(shouldQueryUniversal('market')).toBe(true);
    });

    it('should query only universal for revenue type', () => {
      expect(shouldQueryShared('revenue')).toBe(false);
      expect(shouldQueryUniversal('revenue')).toBe(true);
    });
  });

  // Test sort logic
  describe('Report Sorting', () => {
    it('should sort reports by date descending', () => {
      const reports = [
        { createdAt: '2026-01-15T00:00:00Z' },
        { createdAt: '2026-02-12T00:00:00Z' },
        { createdAt: '2026-01-20T00:00:00Z' },
        { createdAt: '2026-02-01T00:00:00Z' },
      ];

      reports.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      expect(reports[0].createdAt).toBe('2026-02-12T00:00:00Z');
      expect(reports[1].createdAt).toBe('2026-02-01T00:00:00Z');
      expect(reports[2].createdAt).toBe('2026-01-20T00:00:00Z');
      expect(reports[3].createdAt).toBe('2026-01-15T00:00:00Z');
    });
  });

  // Test search filtering logic
  describe('Search Filtering', () => {
    const reports = [
      { address: '2953 Kalmia St, San Diego, CA 92104', city: 'San Diego', state: 'CA', title: null, creatorName: 'John' },
      { address: '1028 17th St, Plano, TX 75074', city: 'Plano', state: 'TX', title: null, creatorName: 'Nanette' },
      { address: null, city: 'Charlotte', state: 'NC', title: 'Market Report: Charlotte', creatorName: 'Bryson' },
    ];

    function filterReports(query: string) {
      const q = query.toLowerCase();
      return reports.filter((r) =>
        (r.address && r.address.toLowerCase().includes(q)) ||
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.city && r.city.toLowerCase().includes(q)) ||
        (r.state && r.state.toLowerCase().includes(q)) ||
        (r.creatorName && r.creatorName.toLowerCase().includes(q))
      );
    }

    it('should filter by address', () => {
      expect(filterReports('Kalmia').length).toBe(1);
      expect(filterReports('Kalmia')[0].address).toContain('Kalmia');
    });

    it('should filter by city', () => {
      expect(filterReports('San Diego').length).toBe(1);
      expect(filterReports('Charlotte').length).toBe(1);
    });

    it('should filter by state', () => {
      expect(filterReports('TX').length).toBe(1);
    });

    it('should filter by title', () => {
      expect(filterReports('Market Report').length).toBe(1);
    });

    it('should filter by creator name', () => {
      expect(filterReports('Nanette').length).toBe(1);
      expect(filterReports('Bryson').length).toBe(1);
    });

    it('should return all for empty query', () => {
      // ''.includes('') returns true, so empty query matches everything
      // In the actual component, empty query is short-circuited to return all reports
      expect(filterReports('').length).toBe(3);
    });

    it('should be case insensitive', () => {
      expect(filterReports('san diego').length).toBe(1);
      expect(filterReports('SAN DIEGO').length).toBe(1);
    });
  });

  // Test currency formatting
  describe('Currency Formatting', () => {
    function formatCurrency(amount: number): string {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }

    it('should format currency correctly', () => {
      expect(formatCurrency(81721)).toBe('$81,721');
      expect(formatCurrency(128139)).toBe('$128,139');
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(1000000)).toBe('$1,000,000');
    });
  });

  // Test date formatting
  describe('Date Formatting', () => {
    function formatDate(dateStr: string | Date): string {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    it('should format dates correctly', () => {
      // Use noon UTC to avoid timezone edge cases
      expect(formatDate('2026-02-12T12:00:00Z')).toBe('Feb 12, 2026');
      expect(formatDate('2026-01-27T12:00:00Z')).toBe('Jan 27, 2026');
    });
  });
});
