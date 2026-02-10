/**
 * CityAutocomplete Component
 * 
 * Uses Google Maps Places Autocomplete (via the Manus proxy) to provide
 * city-level autocomplete. When a user selects a city, it parses the
 * city name, state abbreviation, and zip code from the place result.
 * 
 * Styled to match the main app design system (oklch tokens, rounded-xl, etc.)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { loadMapScript } from '@/components/Map';
import { MapPin, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CityAutocompleteProps {
  /** Called when user selects a city from the dropdown */
  onCitySelect: (city: string, state: string, zipCode?: string) => void;
  /** Initial city value */
  initialCity?: string;
  /** Initial state value */
  initialState?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Additional className for the wrapper */
  className?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Label text (optional) */
  label?: string;
}

// Map of US state names to abbreviations
const STATE_ABBREV: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

export default function CityAutocomplete({
  onCitySelect,
  initialCity = '',
  initialState = '',
  placeholder = 'Search for a city...',
  className,
  disabled = false,
  label,
}: CityAutocompleteProps) {
  const [inputValue, setInputValue] = useState(
    initialCity && initialState ? `${initialCity}, ${initialState}` : initialCity || ''
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Initialize Google Maps and Places service
  useEffect(() => {
    let cancelled = false;
    
    async function init() {
      try {
        setIsLoading(true);
        await loadMapScript();
        
        if (cancelled) return;
        
        if (window.google?.maps?.places) {
          autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
          // PlacesService needs a div element (doesn't need to be visible)
          const div = document.createElement('div');
          placesServiceRef.current = new google.maps.places.PlacesService(div);
          geocoderRef.current = new google.maps.Geocoder();
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
          setIsReady(true);
        }
      } catch (err) {
        console.error('[CityAutocomplete] Failed to initialize:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    
    init();
    return () => { cancelled = true; };
  }, []);

  // Update input when initial values change
  useEffect(() => {
    if (initialCity && initialState) {
      setInputValue(`${initialCity}, ${initialState}`);
    } else if (initialCity) {
      setInputValue(initialCity);
    }
  }, [initialCity, initialState]);

  // Fetch predictions
  const fetchPredictions = useCallback((input: string) => {
    if (!autocompleteServiceRef.current || !input.trim()) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    autocompleteServiceRef.current.getPlacePredictions(
      {
        input,
        types: ['(cities)'],
        componentRestrictions: { country: 'us' },
        sessionToken: sessionTokenRef.current!,
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results);
          setShowDropdown(true);
          setHighlightedIndex(-1);
        } else {
          setPredictions([]);
          setShowDropdown(false);
        }
      }
    );
  }, []);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    if (value.length >= 2) {
      fetchPredictions(value);
    } else {
      setPredictions([]);
      setShowDropdown(false);
    }
  };

  // Parse city, state, and zip code from place details
  const parseCityStateZip = (place: google.maps.places.PlaceResult): { city: string; state: string; zipCode?: string } => {
    let city = '';
    let state = '';
    let zipCode: string | undefined;

    if (place.address_components) {
      for (const component of place.address_components) {
        if (component.types.includes('locality')) {
          city = component.long_name;
        }
        if (component.types.includes('administrative_area_level_1')) {
          // Try short_name first (e.g., "CO"), fall back to converting long_name
          state = component.short_name || STATE_ABBREV[component.long_name] || component.long_name;
        }
        if (component.types.includes('postal_code')) {
          zipCode = component.short_name || component.long_name;
        }
      }
    }

    return { city, state, zipCode };
  };

  // Reverse geocode to get zip code from city coordinates
  const getZipCodeFromLocation = async (location: google.maps.LatLng): Promise<string | undefined> => {
    if (!geocoderRef.current) return undefined;
    
    try {
      const response = await geocoderRef.current.geocode({ location });
      if (response.results && response.results.length > 0) {
        // Look through results for a postal code
        for (const result of response.results) {
          for (const component of result.address_components) {
            if (component.types.includes('postal_code')) {
              return component.short_name || component.long_name;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[CityAutocomplete] Geocode for zip failed:', err);
    }
    return undefined;
  };

  // Handle prediction selection
  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesServiceRef.current) return;

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['address_components', 'name', 'geometry'],
        sessionToken: sessionTokenRef.current!,
      },
      async (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const { city, state, zipCode } = parseCityStateZip(place);
          
          if (city && state) {
            setInputValue(`${city}, ${state}`);
            
            // If no zip code from place details, try reverse geocoding the city center
            let finalZip = zipCode;
            if (!finalZip && place.geometry?.location) {
              finalZip = await getZipCodeFromLocation(place.geometry.location);
            }
            
            onCitySelect(city, state, finalZip);
          } else {
            // Fallback: parse from the prediction description
            const parts = prediction.description.split(',').map(s => s.trim());
            const fallbackCity = parts[0] || '';
            const fallbackState = STATE_ABBREV[parts[1]] || parts[1] || '';
            setInputValue(`${fallbackCity}, ${fallbackState}`);
            onCitySelect(fallbackCity, fallbackState);
          }
        }
        
        // Reset session token after selection
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        setPredictions([]);
        setShowDropdown(false);
      }
    );
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || predictions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < predictions.length) {
        handleSelect(predictions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear input
  const handleClear = () => {
    setInputValue('');
    setPredictions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  return (
    <div className={cn('relative', className)}>
      {label && (
        <label className="block text-sm font-medium text-foreground/70 mb-2 uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) setShowDropdown(true);
          }}
          placeholder={isLoading ? 'Loading...' : placeholder}
          disabled={disabled || isLoading}
          className={cn(
            'w-full pl-10 pr-10 py-3 rounded-xl border border-border',
            'bg-background text-foreground',
            'focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none',
            'transition-all duration-200',
            'placeholder:text-muted-foreground/50',
            'text-sm',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
        {!isLoading && inputValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground transition-colors"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
        >
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              type="button"
              onClick={() => handleSelect(prediction)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                'w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors',
                index === highlightedIndex
                  ? 'bg-primary/10 text-foreground'
                  : 'text-foreground/80 hover:bg-muted/50'
              )}
            >
              <MapPin className="w-4 h-4 text-primary/50 flex-shrink-0" />
              <div>
                <span className="font-medium">
                  {prediction.structured_formatting.main_text}
                </span>
                <span className="text-muted-foreground ml-1">
                  {prediction.structured_formatting.secondary_text}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
