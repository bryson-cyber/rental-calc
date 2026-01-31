/**
 * PropertyContext - Global state for the user's property being analyzed
 * 
 * This context enables the "property-centric workflow" where entering one
 * property address auto-populates all tools with relevant, apples-to-apples data.
 * 
 * Key features:
 * - Stores user's property details (address, bedrooms, bathrooms, location)
 * - All tools can access and filter by the property's characteristics
 * - Enables apples-to-apples comparison (3BR property sees 3BR comps)
 * - Persists Market Advisor filters across component remounts
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Property details extracted from user input
export interface PropertyDetails {
  // Address info
  address: string;
  formattedAddress?: string;
  
  // Location details (auto-extracted)
  zipCode?: string;
  city?: string;
  state?: string;
  neighborhood?: string;
  
  // Market/Submarket IDs from AirDNA (for filtering)
  marketId?: string;
  submarketId?: string;
  submarketName?: string;
  
  // Coordinates for map centering
  latitude?: number;
  longitude?: number;
  
  // Property characteristics
  bedrooms: number;
  bathrooms: number;
  accommodates?: number;
  propertyType?: string;
  
  // Mode: rent (arbitrage) or purchase (buying)
  mode?: 'rent' | 'purchase';
  
  // Financial inputs - Rent mode
  monthlyRent?: number;
  
  // Financial inputs - Purchase mode
  purchasePrice?: number;
  downPaymentPercent?: number;
  loanType?: string; // 'conventional' | 'dscr' | 'fha' | 'cash'
  interestRate?: number;
  monthlyMortgage?: number;
  totalCashNeeded?: number;
  
  // Analysis results (optional - populated after validation)
  annualRevenue?: number;
  occupancyRate?: number;
  adr?: number;
}

// Market Advisor amenities filter type
export interface AmenitiesFilter {
  pool: boolean;
  hotTub: boolean;
  petFriendly: boolean;
  parking: boolean;
  kitchen: boolean;
  washerDryer: boolean;
}

// Market Advisor filters type
export interface MarketAdvisorFilters {
  bedroomFilter: string;
  amenitiesFilter: AmenitiesFilter;
  propertyTypeFilter: string;
  ratingFilter: string;
  reviewCountFilter: string;
  superhostOnly: boolean;
  professionalOnly: boolean;
  instantBookOnly: boolean;
  listingTypeFilter: string;
}

// Default filter values
const defaultAmenitiesFilter: AmenitiesFilter = {
  pool: false,
  hotTub: false,
  petFriendly: false,
  parking: false,
  kitchen: false,
  washerDryer: false,
};

const defaultMarketAdvisorFilters: MarketAdvisorFilters = {
  bedroomFilter: 'all',
  amenitiesFilter: defaultAmenitiesFilter,
  propertyTypeFilter: 'all',
  ratingFilter: 'all',
  reviewCountFilter: 'all',
  superhostOnly: false,
  professionalOnly: false,
  instantBookOnly: false,
  listingTypeFilter: 'all',
};

// LocalStorage keys
const MARKET_ADVISOR_FILTERS_KEY = 'marketAdvisorFilters';
const MY_PROPERTY_KEY = 'myProperty';
const GLOBAL_MODE_KEY = 'globalMode';

// Global mode type - determines entire app experience
export type GlobalMode = 'rent' | 'purchase';

// Helper to load mode from localStorage
function loadModeFromStorage(): GlobalMode {
  if (typeof window === 'undefined') return 'rent';
  try {
    const saved = localStorage.getItem(GLOBAL_MODE_KEY);
    if (saved === 'rent' || saved === 'purchase') {
      return saved;
    }
  } catch (e) {
    console.error('[PropertyContext] Error loading mode from localStorage:', e);
  }
  return 'rent'; // Default to rent mode
}

// Helper to save mode to localStorage
function saveModeToStorage(mode: GlobalMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GLOBAL_MODE_KEY, mode);
  } catch (e) {
    console.error('[PropertyContext] Error saving mode to localStorage:', e);
  }
}

// Helper to load property from URL parameters (for Opportunity Finder integration)
function loadPropertyFromUrlParams(): PropertyDetails | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const address = params.get('address');
    const bedrooms = params.get('bedrooms');
    const bathrooms = params.get('bathrooms');
    const rent = params.get('rent');
    
    if (address) {
      // Extract city and state from address if possible
      const addressParts = address.split(',').map(s => s.trim());
      let city = '';
      let state = '';
      let zipCode = '';
      
      if (addressParts.length >= 2) {
        city = addressParts[addressParts.length - 2] || '';
        const stateZip = addressParts[addressParts.length - 1] || '';
        const stateZipMatch = stateZip.match(/([A-Z]{2})\s*(\d{5})?/);
        if (stateZipMatch) {
          state = stateZipMatch[1];
          zipCode = stateZipMatch[2] || '';
        }
      }
      
      return {
        address: address,
        bedrooms: bedrooms ? parseInt(bedrooms) : 2,
        bathrooms: bathrooms ? parseFloat(bathrooms) : 1,
        monthlyRent: rent ? parseInt(rent) : undefined,
        city,
        state,
        zipCode,
      };
    }
  } catch (e) {
    console.error('[PropertyContext] Error loading property from URL params:', e);
  }
  return null;
}

// Helper to load property from localStorage
function loadPropertyFromStorage(): PropertyDetails | null {
  if (typeof window === 'undefined') return null;
  
  // Check URL parameters first (takes priority for Opportunity Finder flow)
  const urlProperty = loadPropertyFromUrlParams();
  if (urlProperty) {
    // Save to localStorage so it persists
    savePropertyToStorage(urlProperty);
    // Clear URL params after loading to prevent stale data
    if (typeof window !== 'undefined' && window.history.replaceState) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    return urlProperty;
  }
  
  try {
    const saved = localStorage.getItem(MY_PROPERTY_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('[PropertyContext] Error loading property from localStorage:', e);
  }
  return null;
}

// Helper to save property to localStorage
function savePropertyToStorage(property: PropertyDetails | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (property) {
      localStorage.setItem(MY_PROPERTY_KEY, JSON.stringify(property));
    } else {
      localStorage.removeItem(MY_PROPERTY_KEY);
    }
  } catch (e) {
    console.error('[PropertyContext] Error saving property to localStorage:', e);
  }
}

// Helper to load filters from localStorage
function loadFiltersFromStorage(): MarketAdvisorFilters {
  if (typeof window === 'undefined') return defaultMarketAdvisorFilters;
  try {
    const saved = localStorage.getItem(MARKET_ADVISOR_FILTERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to handle any missing keys
      return { ...defaultMarketAdvisorFilters, ...parsed };
    }
  } catch (e) {
    console.error('[PropertyContext] Error loading filters from localStorage:', e);
  }
  return defaultMarketAdvisorFilters;
}

// Helper to save filters to localStorage
function saveFiltersToStorage(filters: MarketAdvisorFilters): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MARKET_ADVISOR_FILTERS_KEY, JSON.stringify(filters));
  } catch (e) {
    console.error('[PropertyContext] Error saving filters to localStorage:', e);
  }
}

interface PropertyContextType {
  // Global mode - rent (arbitrage) or purchase (buying)
  globalMode: GlobalMode;
  setGlobalMode: (mode: GlobalMode) => void;
  
  // The user's property being analyzed
  myProperty: PropertyDetails | null;
  
  // Set the entire property
  setMyProperty: (property: PropertyDetails | null) => void;
  
  // Update specific fields
  updateProperty: (updates: Partial<PropertyDetails>) => void;
  
  // Clear the property context
  clearProperty: () => void;
  
  // Check if a property is set
  hasProperty: boolean;
  
  // Get bedroom filter value (for apples-to-apples comparison)
  bedroomFilter: number | null;
  
  // Toggle whether to enforce apples-to-apples filtering
  enforceApplesToApples: boolean;
  setEnforceApplesToApples: (enforce: boolean) => void;
  
  // Market Advisor filters (persists across component remounts)
  marketAdvisorFilters: MarketAdvisorFilters;
  setMarketAdvisorBedroomFilter: (filter: string) => void;
  setMarketAdvisorAmenitiesFilter: (filter: AmenitiesFilter) => void;
  setMarketAdvisorPropertyTypeFilter: (filter: string) => void;
  setMarketAdvisorRatingFilter: (filter: string) => void;
  setMarketAdvisorReviewCountFilter: (filter: string) => void;
  setMarketAdvisorSuperhostOnly: (value: boolean) => void;
  setMarketAdvisorProfessionalOnly: (value: boolean) => void;
  setMarketAdvisorInstantBookOnly: (value: boolean) => void;
  setMarketAdvisorListingTypeFilter: (filter: string) => void;
  resetMarketAdvisorFilters: () => void;
  
  // Legacy accessor for backward compatibility
  marketAdvisorBedroomFilter: string;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export function PropertyProvider({ children }: { children: ReactNode }) {
  // Global mode state
  const [globalMode, setGlobalModeState] = useState<GlobalMode>(() => {
    return loadModeFromStorage();
  });
  
  const setGlobalMode = useCallback((mode: GlobalMode) => {
    console.log('[PropertyContext] setGlobalMode called with:', mode);
    setGlobalModeState(mode);
    saveModeToStorage(mode);
  }, []);
  
  const [myProperty, setMyPropertyState] = useState<PropertyDetails | null>(() => {
    return loadPropertyFromStorage();
  });
  const [enforceApplesToApples, setEnforceApplesToApples] = useState(true);
  const [marketAdvisorFilters, setMarketAdvisorFiltersState] = useState<MarketAdvisorFilters>(() => {
    return loadFiltersFromStorage();
  });
  
  // Helper to update filters and persist to localStorage
  const updateFilters = useCallback((updates: Partial<MarketAdvisorFilters>) => {
    setMarketAdvisorFiltersState(prev => {
      const newFilters = { ...prev, ...updates };
      saveFiltersToStorage(newFilters);
      return newFilters;
    });
  }, []);
  
  const setMarketAdvisorBedroomFilter = useCallback((filter: string) => {
    console.log('[PropertyContext] setMarketAdvisorBedroomFilter called with:', filter);
    updateFilters({ bedroomFilter: filter });
  }, [updateFilters]);
  
  const setMarketAdvisorAmenitiesFilter = useCallback((filter: AmenitiesFilter) => {
    console.log('[PropertyContext] setMarketAdvisorAmenitiesFilter called with:', filter);
    updateFilters({ amenitiesFilter: filter });
  }, [updateFilters]);
  
  const setMarketAdvisorPropertyTypeFilter = useCallback((filter: string) => {
    console.log('[PropertyContext] setMarketAdvisorPropertyTypeFilter called with:', filter);
    updateFilters({ propertyTypeFilter: filter });
  }, [updateFilters]);
  
  const setMarketAdvisorRatingFilter = useCallback((filter: string) => {
    console.log('[PropertyContext] setMarketAdvisorRatingFilter called with:', filter);
    updateFilters({ ratingFilter: filter });
  }, [updateFilters]);
  
  const setMarketAdvisorReviewCountFilter = useCallback((filter: string) => {
    console.log('[PropertyContext] setMarketAdvisorReviewCountFilter called with:', filter);
    updateFilters({ reviewCountFilter: filter });
  }, [updateFilters]);
  
  const setMarketAdvisorSuperhostOnly = useCallback((value: boolean) => {
    console.log('[PropertyContext] setMarketAdvisorSuperhostOnly called with:', value);
    updateFilters({ superhostOnly: value });
  }, [updateFilters]);
  
  const setMarketAdvisorProfessionalOnly = useCallback((value: boolean) => {
    console.log('[PropertyContext] setMarketAdvisorProfessionalOnly called with:', value);
    updateFilters({ professionalOnly: value });
  }, [updateFilters]);
  
  const setMarketAdvisorInstantBookOnly = useCallback((value: boolean) => {
    console.log('[PropertyContext] setMarketAdvisorInstantBookOnly called with:', value);
    updateFilters({ instantBookOnly: value });
  }, [updateFilters]);
  
  const setMarketAdvisorListingTypeFilter = useCallback((filter: string) => {
    console.log('[PropertyContext] setMarketAdvisorListingTypeFilter called with:', filter);
    updateFilters({ listingTypeFilter: filter });
  }, [updateFilters]);
  
  const resetMarketAdvisorFilters = useCallback(() => {
    console.log('[PropertyContext] resetMarketAdvisorFilters called');
    setMarketAdvisorFiltersState(defaultMarketAdvisorFilters);
    saveFiltersToStorage(defaultMarketAdvisorFilters);
  }, []);
  
  const setMyProperty = useCallback((property: PropertyDetails | null) => {
    setMyPropertyState(property);
    savePropertyToStorage(property);
  }, []);
  
  const updateProperty = useCallback((updates: Partial<PropertyDetails>) => {
    setMyPropertyState(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      savePropertyToStorage(updated);
      return updated;
    });
  }, []);
  
  const clearProperty = useCallback(() => {
    setMyPropertyState(null);
    savePropertyToStorage(null);
  }, []);
  
  const hasProperty = myProperty !== null && myProperty.address.length > 0;
  
  // Bedroom filter for apples-to-apples comparison
  const bedroomFilter = enforceApplesToApples && myProperty ? myProperty.bedrooms : null;
  
  return (
    <PropertyContext.Provider
      value={{
        globalMode,
        setGlobalMode,
        myProperty,
        setMyProperty,
        updateProperty,
        clearProperty,
        hasProperty,
        bedroomFilter,
        enforceApplesToApples,
        setEnforceApplesToApples,
        marketAdvisorFilters,
        setMarketAdvisorBedroomFilter,
        setMarketAdvisorAmenitiesFilter,
        setMarketAdvisorPropertyTypeFilter,
        setMarketAdvisorRatingFilter,
        setMarketAdvisorReviewCountFilter,
        setMarketAdvisorSuperhostOnly,
        setMarketAdvisorProfessionalOnly,
        setMarketAdvisorInstantBookOnly,
        setMarketAdvisorListingTypeFilter,
        resetMarketAdvisorFilters,
        // Legacy accessor for backward compatibility
        marketAdvisorBedroomFilter: marketAdvisorFilters.bedroomFilter,
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
}

// Helper hook to get just the bedroom filter
export function useBedroomFilter() {
  const { bedroomFilter, enforceApplesToApples, setEnforceApplesToApples } = useProperty();
  return { bedroomFilter, enforceApplesToApples, setEnforceApplesToApples };
}

// Helper hook to check if property context is available
export function useHasProperty() {
  const { hasProperty, myProperty } = useProperty();
  return { hasProperty, myProperty };
}

// Helper hook to get Market Advisor filters
export function useMarketAdvisorFilters() {
  const { 
    marketAdvisorFilters,
    setMarketAdvisorBedroomFilter,
    setMarketAdvisorAmenitiesFilter,
    setMarketAdvisorPropertyTypeFilter,
    setMarketAdvisorRatingFilter,
    setMarketAdvisorReviewCountFilter,
    setMarketAdvisorSuperhostOnly,
    setMarketAdvisorProfessionalOnly,
    setMarketAdvisorInstantBookOnly,
    setMarketAdvisorListingTypeFilter,
    resetMarketAdvisorFilters,
  } = useProperty();
  
  return {
    filters: marketAdvisorFilters,
    setBedroomFilter: setMarketAdvisorBedroomFilter,
    setAmenitiesFilter: setMarketAdvisorAmenitiesFilter,
    setPropertyTypeFilter: setMarketAdvisorPropertyTypeFilter,
    setRatingFilter: setMarketAdvisorRatingFilter,
    setReviewCountFilter: setMarketAdvisorReviewCountFilter,
    setSuperhostOnly: setMarketAdvisorSuperhostOnly,
    setProfessionalOnly: setMarketAdvisorProfessionalOnly,
    setInstantBookOnly: setMarketAdvisorInstantBookOnly,
    setListingTypeFilter: setMarketAdvisorListingTypeFilter,
    resetFilters: resetMarketAdvisorFilters,
  };
}
