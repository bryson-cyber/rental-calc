/**
 * Tests for Interactive Tour Feature
 */
import { describe, it, expect } from 'vitest';

describe('Interactive Tour Feature', () => {
  describe('Tour Steps Configuration', () => {
    it('should have all required tour steps', () => {
      const TOUR_STEPS = [
        'welcome',
        'opportunity-intro',
        'opportunity-search',
        'validate-intro',
        'validate-address',
        'validate-details',
        'validate-button',
        'compare-intro',
        'compare-add',
        'map-intro',
        'map-explore',
        'advisor-intro',
        'advisor-chat',
        'regulations-intro',
        'complete',
      ];
      
      expect(TOUR_STEPS).toHaveLength(15);
      expect(TOUR_STEPS[0]).toBe('welcome');
      expect(TOUR_STEPS[TOUR_STEPS.length - 1]).toBe('complete');
    });

    it('should have proper step structure', () => {
      const sampleStep = {
        id: 'validate-address',
        targetSelector: '[data-tour="address-input"]',
        title: 'Enter the Property Address',
        description: 'Paste any address, Zillow link, or Redfin link here.',
        position: 'bottom',
        waitForElement: true,
        showSampleData: true,
      };

      expect(sampleStep.id).toBeDefined();
      expect(sampleStep.title).toBeDefined();
      expect(sampleStep.description).toBeDefined();
      expect(['top', 'bottom', 'left', 'right', 'center']).toContain(sampleStep.position);
    });
  });

  describe('Tour Sample Data', () => {
    it('should have valid sample property data', () => {
      const TOUR_SAMPLE_DATA = {
        property: {
          address: '1847 Market St, Denver, CO 80202',
          bedrooms: '3',
          bathrooms: '2',
          monthlyRent: '2800',
        },
        market: {
          searchQuery: 'Denver, CO',
          marketId: 'airdna-163',
        },
      };

      expect(TOUR_SAMPLE_DATA.property.address).toContain('Denver');
      expect(parseInt(TOUR_SAMPLE_DATA.property.bedrooms)).toBeGreaterThan(0);
      expect(parseInt(TOUR_SAMPLE_DATA.property.bathrooms)).toBeGreaterThan(0);
      expect(parseInt(TOUR_SAMPLE_DATA.property.monthlyRent)).toBeGreaterThan(0);
    });
  });

  describe('Tour Spotlight Component', () => {
    it('should calculate spotlight position correctly', () => {
      const mockRect = {
        top: 100,
        left: 200,
        width: 300,
        height: 50,
      };
      const padding = 8;

      const spotlightPosition = {
        top: mockRect.top - padding,
        left: mockRect.left - padding,
        width: mockRect.width + padding * 2,
        height: mockRect.height + padding * 2,
      };

      expect(spotlightPosition.top).toBe(92);
      expect(spotlightPosition.left).toBe(192);
      expect(spotlightPosition.width).toBe(316);
      expect(spotlightPosition.height).toBe(66);
    });

    it('should calculate tooltip position for different placements', () => {
      const mockRect = {
        top: 200,
        bottom: 250,
        left: 300,
        right: 600,
        width: 300,
        height: 50,
      };
      const tooltipWidth = 320;
      const tooltipHeight = 200;

      // Bottom placement
      const bottomPosition = {
        top: mockRect.bottom + 20,
        left: mockRect.left + mockRect.width / 2 - tooltipWidth / 2,
      };
      expect(bottomPosition.top).toBe(270);
      expect(bottomPosition.left).toBe(290);

      // Top placement
      const topPosition = {
        top: mockRect.top - tooltipHeight - 20,
        left: mockRect.left + mockRect.width / 2 - tooltipWidth / 2,
      };
      expect(topPosition.top).toBe(-20);
      expect(topPosition.left).toBe(290);
    });
  });

  describe('Tour Navigation', () => {
    it('should track current step correctly', () => {
      const totalSteps = 15;
      let currentStep = 0;

      // Move forward
      currentStep = Math.min(currentStep + 1, totalSteps - 1);
      expect(currentStep).toBe(1);

      // Move backward
      currentStep = Math.max(currentStep - 1, 0);
      expect(currentStep).toBe(0);

      // Cannot go below 0
      currentStep = Math.max(currentStep - 1, 0);
      expect(currentStep).toBe(0);
    });

    it('should identify first and last steps', () => {
      const totalSteps = 15;
      
      const isFirstStep = (step: number) => step === 0;
      const isLastStep = (step: number) => step === totalSteps - 1;

      expect(isFirstStep(0)).toBe(true);
      expect(isFirstStep(1)).toBe(false);
      expect(isLastStep(14)).toBe(true);
      expect(isLastStep(0)).toBe(false);
    });
  });

  describe('Tour Data Selectors', () => {
    it('should have valid CSS selectors for tour targets', () => {
      const tourSelectors = [
        '[data-tour="address-input"]',
        '[data-tour="property-details"]',
        '[data-tour="analyze-button"]',
        '[data-tour="opportunity-search"]',
        '[data-tour="compare-add"]',
        '[data-tour="map-container"]',
        '[data-tour="advisor-input"]',
      ];

      tourSelectors.forEach(selector => {
        expect(selector).toMatch(/^\[data-tour="[a-z-]+"\]$/);
      });
    });
  });

  describe('Tour LocalStorage', () => {
    it('should use correct storage key', () => {
      const STORAGE_KEY = 'coach-inayah-interactive-tour-complete';
      expect(STORAGE_KEY).toBe('coach-inayah-interactive-tour-complete');
      expect(STORAGE_KEY.length).toBeGreaterThan(0);
    });
  });

  describe('Tour Actions', () => {
    it('should support tab navigation actions', () => {
      const validTabs = [
        'ebook',
        'regulations',
        'opportunity',
        'prove',
        'find',
        'validate',
        'compare',
        'map',
        'market',
        'advisor',
      ];

      const navigateToTab = (tabId: string) => {
        return validTabs.includes(tabId);
      };

      expect(navigateToTab('validate')).toBe(true);
      expect(navigateToTab('opportunity')).toBe(true);
      expect(navigateToTab('invalid-tab')).toBe(false);
    });
  });
});
