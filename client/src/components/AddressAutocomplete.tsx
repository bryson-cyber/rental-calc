/**
 * Address Autocomplete Component using Google Places API (New)
 * 
 * Uses REST API calls to the Google Places API (New) for autocomplete.
 * This approach works reliably without the deprecated JavaScript SDK.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Use user's Google Places API key
const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<string>(generateSessionToken());

  // Generate a unique session token for billing optimization
  function generateSessionToken(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  // Fetch predictions using REST API
  const fetchPredictions = useCallback(async (input: string) => {
    if (!input.trim() || input.length < 3) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    if (!GOOGLE_PLACES_API_KEY) {
      console.error('[AddressAutocomplete] VITE_GOOGLE_PLACES_API_KEY not set');
      return;
    }

    setIsLoading(true);

    try {
      // Use the Places API (New) Autocomplete endpoint
      const response = await fetch(
        'https://places.googleapis.com/v1/places:autocomplete',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          },
          body: JSON.stringify({
            input,
            includedRegionCodes: ['us'],
            sessionToken: sessionTokenRef.current,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AddressAutocomplete] API error:', response.status, errorText);
        setPredictions([]);
        setIsOpen(false);
        return;
      }

      const data = await response.json();
      
      const formattedPredictions: PlacePrediction[] = (data.suggestions || [])
        .filter((s: any) => s.placePrediction)
        .map((s: any) => {
          const pred = s.placePrediction;
          return {
            placeId: pred.placeId,
            description: pred.text?.text || '',
            mainText: pred.structuredFormat?.mainText?.text || pred.text?.text || '',
            secondaryText: pred.structuredFormat?.secondaryText?.text || '',
          };
        });

      setPredictions(formattedPredictions);
      setIsOpen(formattedPredictions.length > 0);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error('[AddressAutocomplete] Error fetching predictions:', error);
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
  const fetchPlaceDetails = useCallback(async (placeId: string): Promise<PlaceDetails | null> => {
    if (!GOOGLE_PLACES_API_KEY) {
      console.error('[AddressAutocomplete] VITE_GOOGLE_PLACES_API_KEY not set');
      return null;
    }

    try {
      // Use the Places API (New) Place Details endpoint
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}?sessionToken=${sessionTokenRef.current}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'id,formattedAddress,addressComponents,location',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AddressAutocomplete] Place details error:', response.status, errorText);
        return null;
      }

      const place = await response.json();
      
      const details: PlaceDetails = {
        address: place.formattedAddress || '',
        placeId: place.id || placeId,
        lat: place.location?.latitude,
        lng: place.location?.longitude,
      };

      // Extract address components
      if (place.addressComponents) {
        for (const component of place.addressComponents) {
          const types = component.types || [];
          
          if (types.includes('postal_code')) {
            details.zipCode = component.longText;
          } else if (types.includes('locality')) {
            details.city = component.longText;
          } else if (types.includes('administrative_area_level_1')) {
            details.state = component.shortText; // Use short name for state (e.g., "TN" instead of "Tennessee")
          } else if (types.includes('country')) {
            details.country = component.shortText;
          }
        }
      }

      console.log('[AddressAutocomplete] Fetched place details:', details);
      
      // Generate a new session token for the next search
      sessionTokenRef.current = generateSessionToken();
      
      return details;
    } catch (error) {
      console.error('[AddressAutocomplete] Error fetching place details:', error);
      return null;
    }
  }, []);

  // Handle prediction selection
  const handleSelect = useCallback(
    async (prediction: PlacePrediction) => {
      setIsLoading(true);
      
      // Update the input value immediately
      onChange(prediction.description);
      setPredictions([]);
      setIsOpen(false);
      
      // Fetch full place details
      const details = await fetchPlaceDetails(prediction.placeId);
      
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
          disabled={disabled}
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
