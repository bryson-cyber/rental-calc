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
  
  // Coordinates for map centering
  latitude?: number;
  longitude?: number;
  
  // Property characteristics
  bedrooms: number;
  bathrooms: number;
  accommodates?: number;
  propertyType?: string;
  
  // Financial inputs
  monthlyRent?: number;
  
  // Analysis results (optional - populated after validation)
  annualRevenue?: number;
  occupancyRate?: number;
  adr?: number;
}

interface PropertyContextType {
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
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [myProperty, setMyPropertyState] = useState<PropertyDetails | null>(null);
  const [enforceApplesToApples, setEnforceApplesToApples] = useState(true);
  
  const setMyProperty = useCallback((property: PropertyDetails | null) => {
    setMyPropertyState(property);
  }, []);
  
  const updateProperty = useCallback((updates: Partial<PropertyDetails>) => {
    setMyPropertyState(prev => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });
  }, []);
  
  const clearProperty = useCallback(() => {
    setMyPropertyState(null);
  }, []);
  
  const hasProperty = myProperty !== null && myProperty.address.length > 0;
  
  // Bedroom filter for apples-to-apples comparison
  const bedroomFilter = enforceApplesToApples && myProperty ? myProperty.bedrooms : null;
  
  return (
    <PropertyContext.Provider
      value={{
        myProperty,
        setMyProperty,
        updateProperty,
        clearProperty,
        hasProperty,
        bedroomFilter,
        enforceApplesToApples,
        setEnforceApplesToApples,
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
