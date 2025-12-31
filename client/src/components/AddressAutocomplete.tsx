/**
 * Address Autocomplete Component using Google Places API
 * 
 * Uses the Manus proxy for Google Maps services - no API key needed from user.
 * Provides address suggestions as the user types.
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

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (address: string, placeId: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Enter your property address...",
  className,
  inputClassName,
  disabled = false,
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
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

  // Handle prediction selection
  const handleSelect = useCallback(
    (prediction: PlacePrediction) => {
      onChange(prediction.description);
      setPredictions([]);
      setIsOpen(false);
      
      // Create a new session token for the next search
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      
      if (onSelect) {
        onSelect(prediction.description, prediction.placeId);
      }
    },
    [onChange, onSelect]
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
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
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
            "w-full pl-12 pr-10 py-4 text-lg border border-border rounded-lg",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
            "transition-all duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            inputClassName
          )}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Predictions Dropdown */}
      {isOpen && predictions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg overflow-hidden">
          {predictions.map((prediction, index) => (
            <button
              key={prediction.placeId}
              type="button"
              onClick={() => handleSelect(prediction)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                "w-full px-4 py-3 text-left flex items-start gap-3 transition-colors",
                "hover:bg-muted/50",
                highlightedIndex === index && "bg-muted/50"
              )}
            >
              <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">
                  {prediction.mainText}
                </div>
                {prediction.secondaryText && (
                  <div className="text-sm text-muted-foreground truncate">
                    {prediction.secondaryText}
                  </div>
                )}
              </div>
            </button>
          ))}
          <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border bg-muted/30">
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
