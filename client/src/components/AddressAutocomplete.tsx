/**
 * Address Autocomplete Component using Google Places API
 * 
 * Uses the Manus proxy for Google Maps services - no API key needed from user.
 * Provides address suggestions as the user types.
 * Fetches full place details including zip code when a place is selected.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

// Track if Google Maps script is loaded
let isScriptLoaded = false;
let isScriptLoading = false;
let scriptLoadPromise: Promise<void> | null = null;

function loadGoogleMapsScript(): Promise<void> {
  if (isScriptLoaded && window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (isScriptLoading && scriptLoadPromise) {
    return scriptLoadPromise;
  }

  isScriptLoading = true;
  scriptLoadPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google?.maps?.places) {
      isScriptLoaded = true;
      isScriptLoading = false;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=places`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      isScriptLoaded = true;
      isScriptLoading = false;
      resolve();
    };
    script.onerror = () => {
      isScriptLoading = false;
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

// Full place details returned after selection
export interface PlaceDetails {
  address: string;
  placeId: string;
  zipCode?: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (address: string, placeId: string, details?: PlaceDetails) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  variant?: 'dark' | 'light';
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Enter your property address...",
  className,
  inputClassName,
  disabled = false,
  variant = 'dark',
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Google Maps and Autocomplete Service
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await loadGoogleMapsScript();
        if (!mounted) return;
        
        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        
        // Create a hidden div for PlacesService (required by Google API)
        const hiddenDiv = document.createElement('div');
        hiddenDiv.style.display = 'none';
        document.body.appendChild(hiddenDiv);
        placesServiceRef.current = new google.maps.places.PlacesService(hiddenDiv);
        
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize Google Places:", error);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch predictions when value changes
  const fetchPredictions = useCallback(async (input: string) => {
    if (!autocompleteServiceRef.current || !input.trim() || input.length < 3) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await autocompleteServiceRef.current.getPlacePredictions({
        input,
        sessionToken: sessionTokenRef.current!,
        types: ["address"],
        componentRestrictions: { country: "us" }, // Restrict to US addresses
      });

      const formattedPredictions: PlacePrediction[] = (response.predictions || []).map(
        (prediction) => ({
          placeId: prediction.place_id,
          description: prediction.description,
          mainText: prediction.structured_formatting.main_text,
          secondaryText: prediction.structured_formatting.secondary_text || "",
        })
      );

      setPredictions(formattedPredictions);
      setIsOpen(formattedPredictions.length > 0);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error("Error fetching predictions:", error);
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced input handler
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce the API call
      debounceTimerRef.current = setTimeout(() => {
        fetchPredictions(newValue);
      }, 300);
    },
    [onChange, fetchPredictions]
  );

  // Fetch full place details using place_id
  const fetchPlaceDetails = useCallback((placeId: string): Promise<PlaceDetails | null> => {
    return new Promise((resolve) => {
      if (!placesServiceRef.current) {
        console.error('PlacesService not initialized');
        resolve(null);
        return;
      }

      placesServiceRef.current.getDetails(
        {
          placeId,
          fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
          sessionToken: sessionTokenRef.current!,
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            const details: PlaceDetails = {
              address: place.formatted_address || '',
              placeId: place.place_id || placeId,
              lat: place.geometry?.location?.lat(),
              lng: place.geometry?.location?.lng(),
            };

            // Extract address components
            if (place.address_components) {
              for (const component of place.address_components) {
                const types = component.types;
                
                if (types.includes('postal_code')) {
                  details.zipCode = component.long_name;
                } else if (types.includes('locality')) {
                  details.city = component.long_name;
                } else if (types.includes('administrative_area_level_1')) {
                  details.state = component.short_name; // Use short name for state (e.g., "TN" instead of "Tennessee")
                } else if (types.includes('country')) {
                  details.country = component.short_name;
                }
              }
            }

            console.log('[AddressAutocomplete] Fetched place details:', details);
            resolve(details);
          } else {
            console.error('Failed to fetch place details:', status);
            resolve(null);
          }
        }
      );
    });
  }, []);

  // Handle prediction selection
  const handleSelect = useCallback(
    async (prediction: PlacePrediction) => {
      setIsLoading(true);
      onChange(prediction.description);
      setPredictions([]);
      setIsOpen(false);
      
      // Fetch full place details
      const details = await fetchPlaceDetails(prediction.placeId);
      
      // Create a new session token for the next search
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      
      setIsLoading(false);
      
      if (onSelect) {
        // Pass the full details including zip code
        onSelect(
          details?.address || prediction.description, 
          prediction.placeId,
          details || undefined
        );
      }
    },
    [onChange, onSelect, fetchPlaceDetails]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || predictions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < predictions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : predictions.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < predictions.length) {
            handleSelect(predictions[highlightedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, predictions, highlightedIndex, handleSelect]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled || !isInitialized}
          className={cn(
            "w-full h-12 px-4 rounded-xl font-medium",
            "focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            variant === 'dark' 
              ? "bg-white/10 border border-white/20 text-white placeholder:text-white/60 placeholder:font-normal"
              : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-500 placeholder:font-normal",
            inputClassName
          )}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Predictions Dropdown */}
      {isOpen && predictions.length > 0 && (
        <div className={cn(
          "absolute z-50 w-full mt-1 rounded-lg shadow-lg overflow-y-auto max-h-64 top-full left-0",
          variant === 'dark'
            ? "bg-[#1a2744] border border-white/20"
            : "bg-white border border-slate-200"
        )}>
          {predictions.map((prediction, index) => (
            <button
              key={prediction.placeId}
              type="button"
              onClick={() => handleSelect(prediction)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                "w-full px-4 py-3 text-left flex items-start gap-3 transition-colors",
                variant === 'dark' 
                  ? "hover:bg-white/10" 
                  : "hover:bg-slate-100",
                highlightedIndex === index && (variant === 'dark' ? "bg-white/10" : "bg-slate-100")
              )}
            >
              <MapPin className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "font-medium truncate",
                  variant === 'dark' ? "text-white" : "text-slate-900"
                )}>
                  {prediction.mainText}
                </div>
                {prediction.secondaryText && (
                  <div className={cn(
                    "text-sm truncate",
                    variant === 'dark' ? "text-white/60" : "text-slate-500"
                  )}>
                    {prediction.secondaryText}
                  </div>
                )}
              </div>
            </button>
          ))}
          <div className={cn(
            "px-4 py-2 text-xs border-t",
            variant === 'dark'
              ? "text-white/40 border-white/10 bg-white/5"
              : "text-slate-400 border-slate-100 bg-slate-50"
          )}>
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
