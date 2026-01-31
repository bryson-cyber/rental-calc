import { useState, useEffect, useCallback } from 'react';

export interface SavedMarket {
  id: string;
  name: string;
  state: string;
  avgRevenue: number;
  avgOccupancy: number;
  savedAt: string;
  notes?: string;
}

export interface SavedProperty {
  id: string;
  title: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  revenue: number;
  adr: number;
  occupancy: number;
  airbnbUrl?: string;
  savedAt: string;
  notes?: string;
  // Purchase mode investor metrics
  mode?: 'rent' | 'purchase';
  purchasePrice?: number;
  loanType?: 'conventional' | 'dscr' | 'fha' | 'cash';
  downPaymentPercent?: number;
  interestRate?: number;
  cashFlow?: number;
  cashOnCash?: number;
  capRate?: number;
  totalReturn?: number;
  zillowUrl?: string;
}

const SAVED_MARKETS_KEY = 'rental-calculator-saved-markets';
const SAVED_PROPERTIES_KEY = 'rental-calculator-saved-properties';

export function useSavedItems() {
  const [savedMarkets, setSavedMarkets] = useState<SavedMarket[]>([]);
  const [savedProperties, setSavedProperties] = useState<SavedProperty[]>([]);

  // Load saved items from localStorage on mount
  useEffect(() => {
    try {
      const marketsJson = localStorage.getItem(SAVED_MARKETS_KEY);
      const propertiesJson = localStorage.getItem(SAVED_PROPERTIES_KEY);
      
      if (marketsJson) {
        setSavedMarkets(JSON.parse(marketsJson));
      }
      if (propertiesJson) {
        setSavedProperties(JSON.parse(propertiesJson));
      }
    } catch (error) {
      console.error('Error loading saved items:', error);
    }
  }, []);

  // Save market
  const saveMarket = useCallback((market: Omit<SavedMarket, 'id' | 'savedAt'>) => {
    const newMarket: SavedMarket = {
      ...market,
      id: `market-${Date.now()}`,
      savedAt: new Date().toISOString(),
    };
    
    setSavedMarkets(prev => {
      // Check if already saved
      const exists = prev.some(m => m.name === market.name && m.state === market.state);
      if (exists) return prev;
      
      const updated = [...prev, newMarket];
      localStorage.setItem(SAVED_MARKETS_KEY, JSON.stringify(updated));
      return updated;
    });
    
    return newMarket;
  }, []);

  // Remove market
  const removeMarket = useCallback((id: string) => {
    setSavedMarkets(prev => {
      const updated = prev.filter(m => m.id !== id);
      localStorage.setItem(SAVED_MARKETS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Update market notes
  const updateMarketNote = useCallback((id: string, notes: string) => {
    setSavedMarkets(prev => {
      const updated = prev.map(m => 
        m.id === id ? { ...m, notes } : m
      );
      localStorage.setItem(SAVED_MARKETS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Save property
  const saveProperty = useCallback((property: Omit<SavedProperty, 'id' | 'savedAt'>) => {
    const newProperty: SavedProperty = {
      ...property,
      id: `property-${Date.now()}`,
      savedAt: new Date().toISOString(),
    };
    
    setSavedProperties(prev => {
      // Check if already saved (by title or address)
      const exists = prev.some(p => p.title === property.title || p.address === property.address);
      if (exists) return prev;
      
      const updated = [...prev, newProperty];
      localStorage.setItem(SAVED_PROPERTIES_KEY, JSON.stringify(updated));
      return updated;
    });
    
    return newProperty;
  }, []);

  // Remove property
  const removeProperty = useCallback((id: string) => {
    setSavedProperties(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem(SAVED_PROPERTIES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Update property notes
  const updatePropertyNote = useCallback((id: string, notes: string) => {
    setSavedProperties(prev => {
      const updated = prev.map(p => 
        p.id === id ? { ...p, notes } : p
      );
      localStorage.setItem(SAVED_PROPERTIES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Check if market is saved
  const isMarketSaved = useCallback((name: string, state: string) => {
    return savedMarkets.some(m => m.name === name && m.state === state);
  }, [savedMarkets]);

  // Check if property is saved
  const isPropertySaved = useCallback((title: string) => {
    return savedProperties.some(p => p.title === title);
  }, [savedProperties]);

  // Clear all saved items
  const clearAll = useCallback(() => {
    setSavedMarkets([]);
    setSavedProperties([]);
    localStorage.removeItem(SAVED_MARKETS_KEY);
    localStorage.removeItem(SAVED_PROPERTIES_KEY);
  }, []);

  return {
    savedMarkets,
    savedProperties,
    saveMarket,
    removeMarket,
    updateMarketNote,
    saveProperty,
    removeProperty,
    updatePropertyNote,
    isMarketSaved,
    isPropertySaved,
    clearAll,
    totalSaved: savedMarkets.length + savedProperties.length,
  };
}
