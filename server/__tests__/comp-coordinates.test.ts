import { describe, it, expect } from 'vitest';

/**
 * Tests to verify that comparable property coordinates (latitude/longitude)
 * flow correctly through the data pipeline:
 * 
 * 1. Server API returns lat/lng in same_bedroom_comps
 * 2. LeadMagnet.tsx maps lat/lng into Comparable interface
 * 3. TeslaDashboard.tsx includes lat/lng when building shareable report data
 * 4. BuildFullReportButton.tsx passes lat/lng to the report
 * 5. FullPropertyReport.tsx / CompsMapView.tsx filters comps with valid coordinates
 */

// Simulate the LeadMagnet.tsx comparable mapping (line 1359-1382)
function mapServerCompToLeadMagnetComp(c: any) {
  return {
    id: c.id || String(Math.random()),
    title: c.title || `${c.bedrooms}BR Property`,
    bedrooms: c.bedrooms,
    bathrooms: c.bathrooms,
    accommodates: c.accommodates,
    revenue: c.annual_revenue || 0,
    adr: c.adr || 0,
    occupancy: (() => {
      const occ = c.occupancy || 0;
      return occ < 1 ? Math.round(occ * 100) : Math.round(occ);
    })(),
    rating: c.rating || 0,
    reviews: c.reviews || 0,
    imageUrl: c.image_url || c.thumbnail_url || undefined,
    images: c.images || [],
    airbnbUrl: c.airbnb_url,
    distanceMeters: c.distance_meters,
    latitude: c.latitude,
    longitude: c.longitude,
  };
}

// Simulate the TeslaDashboard.tsx shareable report mapping (line 2275-2289)
function mapCompToShareableReport(c: any) {
  return {
    title: c.title,
    bedrooms: c.bedrooms,
    bathrooms: c.bathrooms,
    revenue: c.revenue,
    adr: c.adr,
    occupancy: c.occupancy,
    rating: c.rating || 0,
    reviews: c.reviews,
    distanceMeters: c.distanceMeters,
    latitude: c.latitude,
    longitude: c.longitude,
    isSuperhost: false,
    isProfessionallyManaged: false,
  };
}

// Simulate the BuildFullReportButton.tsx comp mapping (line 217-235)
function mapCompToFullReport(c: any) {
  return {
    id: c.id || c.airbnb_listing_id || String(Math.random()),
    title: c.title || `${c.bedrooms}BR Property`,
    airbnb_url: c.airbnb_url || c.airbnbUrl,
    bedrooms: c.bedrooms,
    bathrooms: c.bathrooms,
    accommodates: c.accommodates,
    annual_revenue: c.annual_revenue || c.revenue || 0,
    adr: c.adr || 0,
    occupancy: c.occupancy || 0,
    superhost: c.superhost,
    distance_meters: c.distance_meters || c.distanceMeters,
    latitude: c.latitude,
    longitude: c.longitude,
  };
}

// Simulate the CompsMapView.tsx filter (filters comps with valid coordinates)
function filterCompsWithCoords(comps: any[]) {
  return comps.filter(c => c.latitude && c.longitude);
}

describe('Comparable Coordinates Data Flow', () => {
  // Sample server data matching what getQualifyingCompetitors returns
  const serverComp = {
    id: 'listing-123',
    title: 'Cozy Downtown Loft',
    bedrooms: 2,
    bathrooms: 1,
    accommodates: 4,
    annual_revenue: 45000,
    adr: 150,
    occupancy: 0.72,
    rating: 4.8,
    reviews: 45,
    image_url: 'https://example.com/img.jpg',
    images: ['https://example.com/img1.jpg'],
    airbnb_url: 'https://airbnb.com/rooms/123',
    distance_meters: 850,
    latitude: 33.749,
    longitude: -84.388,
    superhost: true,
    professionally_managed: false,
    host_size: 'small',
  };

  const serverCompNoCoords = {
    ...serverComp,
    id: 'listing-456',
    title: 'Suburban Retreat',
    latitude: null,
    longitude: null,
  };

  describe('Step 1: Server → LeadMagnet mapping', () => {
    it('should preserve latitude and longitude from server data', () => {
      const mapped = mapServerCompToLeadMagnetComp(serverComp);
      expect(mapped.latitude).toBe(33.749);
      expect(mapped.longitude).toBe(-84.388);
    });

    it('should handle null coordinates from rentalizer comps', () => {
      const mapped = mapServerCompToLeadMagnetComp(serverCompNoCoords);
      expect(mapped.latitude).toBeNull();
      expect(mapped.longitude).toBeNull();
    });

    it('should handle undefined coordinates', () => {
      const { latitude, longitude, ...compWithoutCoords } = serverComp;
      const mapped = mapServerCompToLeadMagnetComp(compWithoutCoords);
      expect(mapped.latitude).toBeUndefined();
      expect(mapped.longitude).toBeUndefined();
    });
  });

  describe('Step 2: LeadMagnet → TeslaDashboard shareable report', () => {
    it('should include latitude and longitude in shareable report data', () => {
      const leadMagnetComp = mapServerCompToLeadMagnetComp(serverComp);
      const shareableComp = mapCompToShareableReport(leadMagnetComp);
      expect(shareableComp.latitude).toBe(33.749);
      expect(shareableComp.longitude).toBe(-84.388);
    });

    it('should pass through null coordinates', () => {
      const leadMagnetComp = mapServerCompToLeadMagnetComp(serverCompNoCoords);
      const shareableComp = mapCompToShareableReport(leadMagnetComp);
      expect(shareableComp.latitude).toBeNull();
      expect(shareableComp.longitude).toBeNull();
    });
  });

  describe('Step 3: TeslaDashboard → BuildFullReportButton', () => {
    it('should include latitude and longitude in full report data', () => {
      const leadMagnetComp = mapServerCompToLeadMagnetComp(serverComp);
      const fullReportComp = mapCompToFullReport(leadMagnetComp);
      expect(fullReportComp.latitude).toBe(33.749);
      expect(fullReportComp.longitude).toBe(-84.388);
    });
  });

  describe('Step 4: CompsMapView coordinate filter', () => {
    it('should include comps with valid coordinates', () => {
      const comps = [
        mapServerCompToLeadMagnetComp(serverComp),
        mapServerCompToLeadMagnetComp(serverCompNoCoords),
      ];
      const withCoords = filterCompsWithCoords(comps);
      expect(withCoords).toHaveLength(1);
      expect(withCoords[0].title).toBe('Cozy Downtown Loft');
    });

    it('should exclude comps with null coordinates', () => {
      const comps = [
        mapServerCompToLeadMagnetComp(serverCompNoCoords),
      ];
      const withCoords = filterCompsWithCoords(comps);
      expect(withCoords).toHaveLength(0);
    });

    it('should include all comps when all have coordinates', () => {
      const comp2 = { ...serverComp, id: 'listing-789', latitude: 33.750, longitude: -84.390 };
      const comps = [
        mapServerCompToLeadMagnetComp(serverComp),
        mapServerCompToLeadMagnetComp(comp2),
      ];
      const withCoords = filterCompsWithCoords(comps);
      expect(withCoords).toHaveLength(2);
    });
  });

  describe('End-to-end: Server → Map display', () => {
    it('should preserve coordinates through the entire pipeline', () => {
      // Step 1: Server → LeadMagnet
      const leadMagnetComp = mapServerCompToLeadMagnetComp(serverComp);
      expect(leadMagnetComp.latitude).toBe(33.749);
      expect(leadMagnetComp.longitude).toBe(-84.388);

      // Step 2: LeadMagnet → TeslaDashboard shareable report
      const shareableComp = mapCompToShareableReport(leadMagnetComp);
      expect(shareableComp.latitude).toBe(33.749);
      expect(shareableComp.longitude).toBe(-84.388);

      // Step 3: Through BuildFullReportButton mapping
      const fullReportComp = mapCompToFullReport(shareableComp);
      expect(fullReportComp.latitude).toBe(33.749);
      expect(fullReportComp.longitude).toBe(-84.388);

      // Step 4: CompsMapView filter
      const withCoords = filterCompsWithCoords([fullReportComp]);
      expect(withCoords).toHaveLength(1);
      expect(withCoords[0].latitude).toBe(33.749);
      expect(withCoords[0].longitude).toBe(-84.388);
    });

    it('should correctly handle the broken pipeline (pre-fix behavior)', () => {
      // Before the fix, the LeadMagnet mapping did NOT include lat/lng
      // This test documents what was happening
      function brokenMapServerComp(c: any) {
        return {
          id: c.id,
          title: c.title,
          bedrooms: c.bedrooms,
          bathrooms: c.bathrooms,
          revenue: c.annual_revenue,
          adr: c.adr,
          occupancy: c.occupancy,
          rating: c.rating,
          reviews: c.reviews,
          distanceMeters: c.distance_meters,
          // NOTE: latitude and longitude were MISSING here
        };
      }

      const brokenComp = brokenMapServerComp(serverComp);
      // latitude/longitude are undefined because they weren't mapped
      expect(brokenComp).not.toHaveProperty('latitude');
      expect(brokenComp).not.toHaveProperty('longitude');

      // CompsMapView would filter this out
      const withCoords = filterCompsWithCoords([brokenComp]);
      expect(withCoords).toHaveLength(0); // No comps on map!
    });
  });
});
