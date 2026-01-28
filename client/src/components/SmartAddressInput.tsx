/**
 * SmartAddressInput Component
 * 
 * A smart input field that can accept either:
 * 1. A regular address (with Google Places autocomplete)
 * 2. A Zillow URL (auto-fetches property details)
 * 3. A Redfin URL (auto-fetches property details)
 * 
 * When a Zillow or Redfin URL is detected, it automatically calls the HasData API
 * to extract property details and populates the form fields.
 * When a regular address is typed, it shows Google Places autocomplete suggestions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { trpc } from '@/lib/trpc';
import { MapPin, Link2, Loader2, CheckCircle, AlertCircle, Home } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Google Places API key
const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

// Zillow URL detection regex patterns
const ZILLOW_URL_PATTERNS = [
  /^https?:\/\/(www\.)?zillow\.com\/homedetails\//i,
  /^https?:\/\/(www\.)?zillow\.com\/homes\//i,
  /^https?:\/\/(www\.)?zillow\.com\/b\//i,
  /^https?:\/\/(www\.)?zillow\.com\/[^/]+\/[^/]+_zpid/i,
];

// Redfin URL detection regex patterns
const REDFIN_URL_PATTERNS = [
  /^https?:\/\/(www\.)?redfin\.com\/[A-Z]{2}\/[^/]+\/[^/]+\/home\/\d+/i,
  /^https?:\/\/(www\.)?redfin\.com\/[A-Z]{2}\/[^/]+\/[^/]+\/unit-[^/]+\/home\/\d+/i,
  /^https?:\/\/(www\.)?redfin\.com\/[A-Z]{2}\/[^/]+\/[^/]+\/apartment-[^/]+\/home\/\d+/i,
];

interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PropertyDetails {
  address: string;
  bedrooms: number | null;
  bathrooms: number | null;
  price: number | null;
  priceType: 'sale' | 'rent' | 'unknown';
  livingArea?: number;
  yearBuilt?: number;
  propertyType?: string;
  imageUrl?: string;
  zpid?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  source?: 'zillow' | 'redfin';
}

interface SmartAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onPropertyDetected?: (property: PropertyDetails) => void;
  onAddressSelect?: (address: string, placeId: string, details?: { zipCode?: string; city?: string; state?: string }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showPropertyCard?: boolean;
  label?: string;
  required?: boolean;
}

export function isZillowUrl(input: string): boolean {
  if (!input) return false;
  return ZILLOW_URL_PATTERNS.some(pattern => pattern.test(input.trim()));
}

export function isRedfinUrl(input: string): boolean {
  if (!input) return false;
  return REDFIN_URL_PATTERNS.some(pattern => pattern.test(input.trim()));
}

export function isPropertyUrl(input: string): 'zillow' | 'redfin' | null {
  if (isZillowUrl(input)) return 'zillow';
  if (isRedfinUrl(input)) return 'redfin';
  return null;
}

// Generate a unique session token for Google Places billing optimization
function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function SmartAddressInput({
  value,
  onChange,
  onPropertyDetected,
  onAddressSelect,
  placeholder = "Enter address or paste Zillow/Redfin URL...",
  className = "",
  disabled = false,
  showPropertyCard = true,
  label,
  required = false,
}: SmartAddressInputProps) {
  const [inputType, setInputType] = useState<'address' | 'zillow' | 'redfin'>('address');
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedProperty, setDetectedProperty] = useState<PropertyDetails | null>(null);
  
  // Google Places autocomplete state
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<string>(generateSessionToken());

  const zillowMutation = trpc.zillow.getPropertyDetails.useMutation();
  const redfinMutation = trpc.redfin.getPropertyDetails.useMutation();

  // Update dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // Update position when dropdown opens
  useEffect(() => {
    if (isDropdownOpen) {
      updateDropdownPosition();
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [isDropdownOpen, updateDropdownPosition]);

  // Fetch Google Places predictions
  const fetchPredictions = useCallback(async (input: string) => {
    if (!input.trim() || input.length < 3) {
      setPredictions([]);
      setIsDropdownOpen(false);
      return;
    }

    if (!GOOGLE_PLACES_API_KEY) {
      console.error('[SmartAddressInput] VITE_GOOGLE_PLACES_API_KEY not set');
      return;
    }

    setIsLoadingPredictions(true);

    try {
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
        console.error('[SmartAddressInput] API error:', response.status);
        setPredictions([]);
        setIsDropdownOpen(false);
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
      setIsDropdownOpen(formattedPredictions.length > 0);
      setHighlightedIndex(-1);
      updateDropdownPosition();
    } catch (error) {
      console.error('[SmartAddressInput] Error fetching predictions:', error);
      setPredictions([]);
    } finally {
      setIsLoadingPredictions(false);
    }
  }, [updateDropdownPosition]);

  // Fetch place details
  const fetchPlaceDetails = useCallback(async (placeId: string) => {
    if (!GOOGLE_PLACES_API_KEY) return null;

    try {
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

      if (!response.ok) return null;

      const place = await response.json();
      
      const details: { address: string; zipCode?: string; city?: string; state?: string } = {
        address: place.formattedAddress || '',
      };

      if (place.addressComponents) {
        for (const component of place.addressComponents) {
          const types = component.types || [];
          if (types.includes('postal_code')) {
            details.zipCode = component.longText;
          } else if (types.includes('locality')) {
            details.city = component.longText;
          } else if (types.includes('administrative_area_level_1')) {
            details.state = component.shortText;
          }
        }
      }

      sessionTokenRef.current = generateSessionToken();
      return details;
    } catch (error) {
      console.error('[SmartAddressInput] Error fetching place details:', error);
      return null;
    }
  }, []);

  // Handle prediction selection
  const handleSelectPrediction = useCallback(async (prediction: PlacePrediction) => {
    setIsLoadingPredictions(true);
    onChange(prediction.description);
    setPredictions([]);
    setIsDropdownOpen(false);
    
    const details = await fetchPlaceDetails(prediction.placeId);
    setIsLoadingPredictions(false);
    
    if (onAddressSelect) {
      onAddressSelect(
        details?.address || prediction.description,
        prediction.placeId,
        details || undefined
      );
    }
  }, [onChange, fetchPlaceDetails, onAddressSelect]);

  // Detect input type and handle accordingly
  const handleInputChange = useCallback((newValue: string) => {
    onChange(newValue);
    setErrorMessage(null);

    const urlType = isPropertyUrl(newValue);
    if (urlType) {
      // It's a Zillow or Redfin URL
      setInputType(urlType);
      setPredictions([]);
      setIsDropdownOpen(false);
    } else {
      // It's a regular address - show Google Places suggestions
      setInputType('address');
      setFetchStatus('idle');
      setDetectedProperty(null);
      
      // Debounce the Google Places API call
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        fetchPredictions(newValue);
      }, 300);
    }
  }, [onChange, fetchPredictions]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isDropdownOpen || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < predictions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < predictions.length) {
          handleSelectPrediction(predictions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsDropdownOpen(false);
        break;
    }
  }, [isDropdownOpen, predictions, highlightedIndex, handleSelectPrediction]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-fetch property data when URL is detected (Zillow or Redfin)
  useEffect(() => {
    if ((inputType === 'zillow' || inputType === 'redfin') && value && fetchStatus === 'idle') {
      const fetchPropertyData = async () => {
        setFetchStatus('loading');
        setErrorMessage(null);

        try {
          const result = inputType === 'zillow' 
            ? await zillowMutation.mutateAsync({ url: value.trim() })
            : await redfinMutation.mutateAsync({ url: value.trim() });

          if (result.success && result.data) {
            const property: PropertyDetails = {
              address: result.data.address,
              bedrooms: result.data.bedrooms,
              bathrooms: result.data.bathrooms,
              price: result.data.price,
              priceType: result.data.priceType,
              livingArea: result.data.livingArea,
              yearBuilt: result.data.yearBuilt,
              propertyType: result.data.propertyType,
              imageUrl: result.data.imageUrl,
              zpid: inputType === 'zillow' ? (result.data as { zpid?: string }).zpid : undefined,
              city: result.data.city,
              state: result.data.state,
              zipcode: result.data.zipcode,
              source: inputType as 'zillow' | 'redfin',
            };

            setDetectedProperty(property);
            setFetchStatus('success');
            setInputType('address');

            if (onPropertyDetected) {
              onPropertyDetected(property);
            }

            onChange(property.address);
          } else {
            setFetchStatus('error');
            setErrorMessage(result.error || 'Failed to fetch property details');
          }
        } catch (error) {
          console.error(`Error fetching ${inputType} data:`, error);
          setFetchStatus('error');
          setErrorMessage('Failed to connect to property lookup service');
        }
      };

      const timeoutId = setTimeout(fetchPropertyData, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [inputType, value, fetchStatus, zillowMutation, redfinMutation, onPropertyDetected, onChange]);

  // Reset fetch status when input changes to a URL
  useEffect(() => {
    if (inputType === 'zillow' || inputType === 'redfin') {
      setFetchStatus('idle');
    }
  }, [value, inputType]);

  const getInputIcon = () => {
    if (fetchStatus === 'loading' || isLoadingPredictions) {
      return <Loader2 className="w-5 h-5 text-[#C9A962] animate-spin" />;
    }
    if (fetchStatus === 'success') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (fetchStatus === 'error') {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    if (inputType === 'zillow' || inputType === 'redfin') {
      return <Link2 className="w-5 h-5 text-[#C9A962]" />;
    }
    return <MapPin className="w-5 h-5 text-[#C9A962]" />;
  };

  const formatPrice = (price: number, priceType: string) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);

    if (priceType === 'rent') {
      return `${formatted}/mo`;
    }
    return formatted;
  };

  // Dropdown portal
  const dropdown = isDropdownOpen && predictions.length > 0 && createPortal(
    <div
      className="fixed bg-white border border-gray-200 rounded-xl shadow-lg z-[9999] max-h-60 overflow-auto"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
      }}
    >
      {predictions.map((prediction, index) => (
        <div
          key={prediction.placeId}
          className={`px-4 py-3 cursor-pointer transition-colors ${
            index === highlightedIndex 
              ? 'bg-[#C9A962]/10' 
              : 'hover:bg-gray-50'
          }`}
          onClick={() => handleSelectPrediction(prediction)}
          onMouseEnter={() => setHighlightedIndex(index)}
        >
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-[#C9A962] flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {prediction.mainText}
              </div>
              <div className="text-sm text-gray-500 truncate">
                {prediction.secondaryText}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>,
    document.body
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center gap-3 mb-1">
          <label className="block text-sm font-medium text-[#0F172A]/70 uppercase tracking-wider">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          <div className="flex items-center gap-2 px-2 py-0.5 bg-gray-50 rounded-full border border-gray-200">
            <img 
              src="/zillow-logo.png" 
              alt="Zillow" 
              className="h-5 w-5 object-contain" 
              title="Paste a Zillow URL"
            />
            <span className="text-gray-300">|</span>
            <img 
              src="/redfin-logo.png" 
              alt="Redfin" 
              className="h-5 w-5 object-contain" 
              title="Paste a Redfin URL"
            />
          </div>
        </div>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                {getInputIcon()}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (predictions.length > 0) {
                    setIsDropdownOpen(true);
                  }
                }}
                placeholder={placeholder}
                disabled={disabled || fetchStatus === 'loading'}
                className={`
                  w-full pl-12 pr-4 py-3 
                  border-2 rounded-xl 
                  text-base font-sans
                  transition-all duration-300
                  outline-none
                  ${fetchStatus === 'error' 
                    ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' 
                    : fetchStatus === 'success'
                    ? 'border-green-300 focus:border-green-500 focus:ring-2 focus:ring-green-500/20'
                    : 'border-[#0F172A]/10 focus:border-[#C9A962] focus:ring-2 focus:ring-[#C9A962]/20'
                  }
                  ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
                `}
              />
              {(inputType === 'zillow' || inputType === 'redfin') && fetchStatus !== 'loading' && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <img 
                    src={inputType === 'zillow' ? '/zillow-logo.png' : '/redfin-logo.png'}
                    alt={inputType === 'zillow' ? 'Zillow' : 'Redfin'}
                    className="h-5 w-5 object-contain"
                  />
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-sm">
              <strong>Tip:</strong> Paste a Zillow or Redfin listing URL to auto-fill property details, 
              or type an address manually.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {dropdown}

      {/* Error message */}
      {fetchStatus === 'error' && errorMessage && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success message with property card */}
      {fetchStatus === 'success' && detectedProperty && showPropertyCard && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            {detectedProperty.imageUrl ? (
              <img 
                src={detectedProperty.imageUrl} 
                alt="Property" 
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <Home className="w-8 h-8 text-green-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-sm font-medium text-green-800">Property details loaded!</span>
              </div>
              <p className="text-sm text-green-700 truncate">{detectedProperty.address}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {detectedProperty.bedrooms !== null && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                    {detectedProperty.bedrooms} bed
                  </span>
                )}
                {detectedProperty.bathrooms !== null && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                    {detectedProperty.bathrooms} bath
                  </span>
                )}
                {detectedProperty.price !== null && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                    {formatPrice(detectedProperty.price, detectedProperty.priceType)}
                  </span>
                )}
                {detectedProperty.livingArea && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                    {detectedProperty.livingArea.toLocaleString()} sqft
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {fetchStatus === 'loading' && (
        <div className="flex items-center gap-2 text-[#C9A962] text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Fetching property details from {inputType === 'redfin' ? 'Redfin' : 'Zillow'}...</span>
        </div>
      )}
    </div>
  );
}

export default SmartAddressInput;
