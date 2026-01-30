/**
 * Google Places Autocomplete Component
 * 
 * Uses Google Places API for city, neighborhood, and address autocomplete.
 * This provides better recognition of city name variations (St. Louis vs Saint Louis)
 * and supports addresses, neighborhoods, cities, and zip codes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Building2, Loader2, Navigation, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// Google Maps API configuration
const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL = import.meta.env.VITE_FRONTEND_FORGE_API_URL || "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

declare global {
  interface Window {
    google?: typeof google;
    __googleMapsLoading?: Promise<void>;
    __googleMapsLoaded?: boolean;
    __googleMapsLibrariesLoaded?: boolean;
  }
}

// Load Google Maps script
async function loadMapScript(): Promise<void> {
  if (window.__googleMapsLoaded && window.google?.maps) {
    await loadLibraries();
    return;
  }
  
  if (window.__googleMapsLoading) {
    await window.__googleMapsLoading;
    await loadLibraries();
    return;
  }
  
  window.__googleMapsLoading = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      `script[src*="${MAPS_PROXY_URL}/maps/api/js"]`
    );
    
    if (existingScript) {
      if (window.google?.maps) {
        window.__googleMapsLoaded = true;
        resolve();
        return;
      }
      existingScript.addEventListener('load', () => {
        window.__googleMapsLoaded = true;
        resolve();
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load Google Maps script'));
      });
      return;
    }
    
    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      window.__googleMapsLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(script);
  });
  
  await window.__googleMapsLoading;
  await loadLibraries();
}

async function loadLibraries(): Promise<void> {
  if (window.__googleMapsLibrariesLoaded) return;
  if (!window.google?.maps) return;
  
  try {
    await Promise.all([
      google.maps.importLibrary("places"),
      google.maps.importLibrary("geocoding"),
    ]);
    window.__googleMapsLibrariesLoaded = true;
  } catch (err) {
    console.error("[GooglePlacesAutocomplete] Error loading libraries:", err);
  }
}

interface PlaceResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  types: string[];
}

// Search history storage key
const SEARCH_HISTORY_KEY = 'googlePlaces_searchHistory';
const MAX_SEARCH_HISTORY = 5;

// Load search history from localStorage
function loadSearchHistory(): { name: string; placeId: string }[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Save search to history
function saveToSearchHistory(place: { name: string; placeId: string }): void {
  if (typeof window === 'undefined') return;
  try {
    const history = loadSearchHistory();
    // Remove duplicates
    const filtered = history.filter(h => h.name !== place.name);
    // Add to beginning
    const updated = [place, ...filtered].slice(0, MAX_SEARCH_HISTORY);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('[SearchHistory] Error saving:', e);
  }
}

interface GooglePlacesAutocompleteProps {
  onSelect: (place: { name: string; placeId: string; lat?: number; lng?: number }) => void;
  onQueryChange?: (query: string) => void; // Callback when query changes (for fallback search)
  placeholder?: string;
  className?: string;
  types?: string[]; // e.g., ['(cities)', '(regions)', 'address']
  countryRestriction?: string; // e.g., 'us'
  allowDirectSearch?: boolean; // Allow searching with unrecognized locations
  showSearchHistory?: boolean; // Show recent searches dropdown
  initialValue?: string; // Pre-fill the input with this value (for HubSpot email deep links)
}

export function GooglePlacesAutocomplete({
  onSelect,
  onQueryChange,
  placeholder = "Search city, neighborhood, or zip code...",
  className,
  types = [], // Empty array = all types (cities, neighborhoods, zip codes, addresses)
  countryRestriction = 'us',
  allowDirectSearch = false,
  showSearchHistory = true, // Default to showing search history
  initialValue = '', // For pre-filling from URL params (HubSpot emails)
}: GooglePlacesAutocompleteProps) {
  const [query, setQuery] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchHistory, setSearchHistory] = useState<{ name: string; placeId: string }[]>(() => loadSearchHistory());
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync query when initialValue prop changes (for HubSpot email deep links)
  useEffect(() => {
    if (initialValue && initialValue !== query) {
      console.log('[GooglePlacesAutocomplete] Syncing initialValue:', initialValue);
      setQuery(initialValue);
      // Also notify parent of the query change
      if (onQueryChange) {
        onQueryChange(initialValue);
      }
    }
  }, [initialValue]);

  // Initialize Google Places services
  useEffect(() => {
    const init = async () => {
      try {
        await loadMapScript();
        
        if (window.google?.maps?.places) {
          autocompleteService.current = new google.maps.places.AutocompleteService();
          // Create a dummy div for PlacesService (required by API)
          const dummyDiv = document.createElement('div');
          placesService.current = new google.maps.places.PlacesService(dummyDiv);
          sessionToken.current = new google.maps.places.AutocompleteSessionToken();
          setIsInitialized(true);
          console.log('[GooglePlacesAutocomplete] Initialized successfully');
        }
      } catch (error) {
        console.error('[GooglePlacesAutocomplete] Failed to initialize:', error);
      }
    };
    
    init();
  }, []);

  // Search for places
  const searchPlaces = useCallback((searchQuery: string) => {
    if (!autocompleteService.current || !isInitialized || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);

    // Use (regions) type to get ONLY cities, neighborhoods, and zip codes
    // This is the key fix - (regions) includes: locality, sublocality, postal_code, country, admin_area_1, admin_area_2
    const request: google.maps.places.AutocompletionRequest = {
      input: searchQuery,
      sessionToken: sessionToken.current!,
      componentRestrictions: countryRestriction ? { country: countryRestriction } : undefined,
      // ALWAYS use (regions) to get cities, neighborhoods, and zip codes - NOT addresses or businesses
      types: types.length > 0 ? types : ['(regions)'],
    };

    autocompleteService.current.getPlacePredictions(request, (predictions, status) => {
      setIsLoading(false);
      
      if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
        // With (regions) type, Google already filters to only return:
        // locality, sublocality, postal_code, country, admin_area_1, admin_area_2
        // We just need minimal filtering to remove any edge cases
        
        const placeResults: PlaceResult[] = predictions.map((prediction) => ({
          placeId: prediction.place_id,
          description: prediction.description,
          mainText: prediction.structured_formatting.main_text,
          secondaryText: prediction.structured_formatting.secondary_text || '',
          types: prediction.types || [],
        }));
        setResults(placeResults);
      } else {
        setResults([]);
      }
    });
  }, [isInitialized, countryRestriction, types]);

  // Debounced search
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.length >= 2) {
      debounceTimer.current = setTimeout(() => {
        searchPlaces(query);
      }, 150); // Fast debounce for responsive UX
    } else {
      setResults([]);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, searchPlaces]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle place selection
  const handleSelect = async (place: PlaceResult) => {
    setQuery(place.description);
    setIsOpen(false);
    
    // Save to search history
    saveToSearchHistory({ name: place.description, placeId: place.placeId });
    setSearchHistory(loadSearchHistory());
    
    // Get place details for coordinates
    if (placesService.current) {
      placesService.current.getDetails(
        {
          placeId: place.placeId,
          fields: ['geometry', 'formatted_address', 'name'],
          sessionToken: sessionToken.current!,
        },
        (placeDetails, status) => {
          // Create new session token after selection
          sessionToken.current = new google.maps.places.AutocompleteSessionToken();
          
          if (status === google.maps.places.PlacesServiceStatus.OK && placeDetails) {
            const lat = placeDetails.geometry?.location?.lat();
            const lng = placeDetails.geometry?.location?.lng();
            
            onSelect({
              name: place.description,
              placeId: place.placeId,
              lat,
              lng,
            });
          } else {
            // Fallback without coordinates
            onSelect({
              name: place.description,
              placeId: place.placeId,
            });
          }
        }
      );
    } else {
      onSelect({
        name: place.description,
        placeId: place.placeId,
      });
    }
  };
  
  // Handle search history selection
  const handleHistorySelect = (item: { name: string; placeId: string }) => {
    setQuery(item.name);
    setIsOpen(false);
    onSelect(item);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsOpen(true);
    // Notify parent of query changes for fallback search
    if (onQueryChange) {
      onQueryChange(newQuery);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Get appropriate Lucide icon based on place type
  const getPlaceIcon = (types: string[]) => {
    if (types.includes('postal_code')) {
      return <Navigation className="w-5 h-5 text-teal-500" />;
    }
    if (types.includes('neighborhood') || types.includes('sublocality')) {
      return <Building2 className="w-5 h-5 text-teal-500" />;
    }
    // City or larger area
    return <MapPin className="w-5 h-5 text-amber-500" />;
  };

  return (
    <div className={cn("relative", className)}>
      {/* Input Field */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-12 pr-10 py-4 bg-white border border-neutral-200 rounded-xl text-base focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none transition-all"
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500 animate-spin" />
        )}
        {query && !isLoading && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 hover:text-neutral-600 text-lg"
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white border border-neutral-200 rounded-xl shadow-lg max-h-80 overflow-y-auto"
        >
          {results.map((place) => (
            <button
              key={place.placeId}
              onClick={() => handleSelect(place)}
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-neutral-50 transition-colors text-left border-b border-neutral-100 last:border-b-0"
            >
              <div className="mt-0.5">
                {getPlaceIcon(place.types)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-900 truncate">
                    {place.mainText}
                  </span>
                  {(place.types.includes('neighborhood') || place.types.includes('sublocality')) && (
                    <span className="text-teal-600 text-xs font-medium">Neighborhood</span>
                  )}
                </div>
                {place.secondaryText && (
                  <div className="text-sm text-neutral-500 truncate">
                    {place.secondaryText}
                  </div>
                )}
              </div>
            </button>
          ))}
          
          {/* Google attribution */}
          <div className="px-4 py-2 text-xs text-neutral-400 border-t border-neutral-100 flex items-center gap-1">
            <span>Powered by</span>
            <span className="font-medium" style={{ color: '#4285F4' }}>G</span>
            <span className="font-medium" style={{ color: '#EA4335' }}>o</span>
            <span className="font-medium" style={{ color: '#FBBC05' }}>o</span>
            <span className="font-medium" style={{ color: '#4285F4' }}>g</span>
            <span className="font-medium" style={{ color: '#34A853' }}>l</span>
            <span className="font-medium" style={{ color: '#EA4335' }}>e</span>
          </div>
        </div>
      )}

      {/* Search History - show when input is empty and focused */}
      {isOpen && showSearchHistory && query.length < 2 && searchHistory.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white border border-neutral-200 rounded-xl shadow-lg max-h-80 overflow-y-auto"
        >
          <div className="px-4 py-2 text-xs font-medium text-neutral-500 border-b border-neutral-100">
            Recent Searches
          </div>
          {searchHistory.map((item, index) => (
            <button
              key={`${item.placeId}-${index}`}
              onClick={() => handleHistorySelect(item)}
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-neutral-50 transition-colors text-left border-b border-neutral-100 last:border-b-0"
            >
              <div className="mt-0.5">
                <Clock className="w-5 h-5 text-neutral-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-neutral-900 truncate block">
                  {item.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {isOpen && query.length >= 2 && !isLoading && results.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white border border-neutral-200 rounded-xl shadow-lg p-4 text-center text-neutral-500"
        >
          <p>No locations found for "{query}"</p>
          <p className="text-xs mt-1">Try a different city, neighborhood, or zip code</p>
          {allowDirectSearch && (
            <button
              onClick={() => {
                setIsOpen(false);
                onSelect({
                  name: query,
                  placeId: 'direct-search',
                });
              }}
              className="mt-3 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              Search anyway
            </button>
          )}
        </div>
      )}
      
      {/* Loading state while initializing */}
      {!isInitialized && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl">
          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
        </div>
      )}
    </div>
  );
}

export default GooglePlacesAutocomplete;
