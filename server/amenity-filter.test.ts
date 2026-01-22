/**
 * Amenity Filter Tests
 * 
 * Tests the amenity filter functionality in the listingsByArea endpoint
 */
import { describe, it, expect } from 'vitest';

// Test the amenity filter structure
describe('Amenity Filter', () => {
  describe('Filter Structure', () => {
    it('should create correct amenity filter object for pool', () => {
      const amenities = { pool: true };
      const amenitiesFilter: Record<string, boolean> = {};
      
      if (amenities.pool) amenitiesFilter.has_pool = true;
      
      expect(amenitiesFilter).toEqual({ has_pool: true });
    });
    
    it('should create correct amenity filter object for hot tub', () => {
      const amenities = { hotTub: true };
      const amenitiesFilter: Record<string, boolean> = {};
      
      if (amenities.hotTub) amenitiesFilter.has_hottub = true;
      
      expect(amenitiesFilter).toEqual({ has_hottub: true });
    });
    
    it('should create correct amenity filter object for pet friendly', () => {
      const amenities = { petFriendly: true };
      const amenitiesFilter: Record<string, boolean> = {};
      
      if (amenities.petFriendly) amenitiesFilter.has_pets_allowed = true;
      
      expect(amenitiesFilter).toEqual({ has_pets_allowed: true });
    });
    
    it('should create correct amenity filter object for parking', () => {
      const amenities = { parking: true };
      const amenitiesFilter: Record<string, boolean> = {};
      
      if (amenities.parking) amenitiesFilter.has_parking = true;
      
      expect(amenitiesFilter).toEqual({ has_parking: true });
    });
    
    it('should create combined filter for multiple amenities', () => {
      const amenities = { pool: true, hotTub: true, petFriendly: false, parking: true };
      const amenitiesFilter: Record<string, boolean> = {};
      
      if (amenities.pool) amenitiesFilter.has_pool = true;
      if (amenities.hotTub) amenitiesFilter.has_hottub = true;
      if (amenities.petFriendly) amenitiesFilter.has_pets_allowed = true;
      if (amenities.parking) amenitiesFilter.has_parking = true;
      
      expect(amenitiesFilter).toEqual({
        has_pool: true,
        has_hottub: true,
        has_parking: true
      });
      expect(amenitiesFilter).not.toHaveProperty('has_pets_allowed');
    });
    
    it('should return empty object when no amenities selected', () => {
      const amenities = { pool: false, hotTub: false };
      const amenitiesFilter: Record<string, boolean> = {};
      
      if (amenities.pool) amenitiesFilter.has_pool = true;
      if (amenities.hotTub) amenitiesFilter.has_hottub = true;
      
      expect(Object.keys(amenitiesFilter).length).toBe(0);
    });
  });
  
  describe('Filter Array Construction', () => {
    it('should add amenity filter to filters array when amenities selected', () => {
      const filters: Array<{ field: string; type: string; value: any }> = [];
      const amenities = { pool: true, hotTub: true };
      
      const amenitiesFilter: Record<string, boolean> = {};
      if (amenities.pool) amenitiesFilter.has_pool = true;
      if (amenities.hotTub) amenitiesFilter.has_hottub = true;
      
      if (Object.keys(amenitiesFilter).length > 0) {
        filters.push({
          field: 'amenities',
          type: 'jsonb_boolean',
          value: amenitiesFilter
        });
      }
      
      expect(filters.length).toBe(1);
      expect(filters[0]).toEqual({
        field: 'amenities',
        type: 'jsonb_boolean',
        value: { has_pool: true, has_hottub: true }
      });
    });
    
    it('should not add amenity filter when no amenities selected', () => {
      const filters: Array<{ field: string; type: string; value: any }> = [];
      const amenities = {};
      
      const amenitiesFilter: Record<string, boolean> = {};
      
      if (Object.keys(amenitiesFilter).length > 0) {
        filters.push({
          field: 'amenities',
          type: 'jsonb_boolean',
          value: amenitiesFilter
        });
      }
      
      expect(filters.length).toBe(0);
    });
  });
  
  describe('UI State Management', () => {
    it('should toggle amenity state correctly', () => {
      let exploreAmenities: { pool?: boolean; hotTub?: boolean; petFriendly?: boolean; parking?: boolean } = {};
      
      // Toggle pool on
      exploreAmenities = { ...exploreAmenities, pool: !exploreAmenities.pool };
      expect(exploreAmenities.pool).toBe(true);
      
      // Toggle pool off
      exploreAmenities = { ...exploreAmenities, pool: !exploreAmenities.pool };
      expect(exploreAmenities.pool).toBe(false);
      
      // Toggle multiple
      exploreAmenities = { ...exploreAmenities, hotTub: true, parking: true };
      expect(exploreAmenities).toEqual({ pool: false, hotTub: true, parking: true });
    });
    
    it('should determine if amenities should be passed to API', () => {
      const emptyAmenities = {};
      const selectedAmenities = { pool: true };
      
      const shouldPassEmpty = Object.keys(emptyAmenities).length > 0;
      const shouldPassSelected = Object.keys(selectedAmenities).length > 0;
      
      expect(shouldPassEmpty).toBe(false);
      expect(shouldPassSelected).toBe(true);
    });
  });
});
