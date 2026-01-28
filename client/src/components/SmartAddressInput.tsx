/**
 * SmartAddressInput Component
 * 
 * A smart input field that can accept either:
 * 1. A regular address (passed through as-is)
 * 2. A Zillow URL (auto-fetches property details)
 * 3. A Redfin URL (auto-fetches property details)
 * 
 * When a Zillow or Redfin URL is detected, it automatically calls the HasData API
 * to extract property details and populates the form fields.
 */

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { MapPin, Link2, Loader2, CheckCircle, AlertCircle, Home } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

export function SmartAddressInput({
  value,
  onChange,
  onPropertyDetected,
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

  const zillowMutation = trpc.zillow.getPropertyDetails.useMutation();
  const redfinMutation = trpc.redfin.getPropertyDetails.useMutation();

  // Detect input type and fetch property data if URL is detected
  const handleInputChange = useCallback((newValue: string) => {
    onChange(newValue);
    setErrorMessage(null);

    const urlType = isPropertyUrl(newValue);
    if (urlType) {
      setInputType(urlType);
    } else {
      setInputType('address');
      setFetchStatus('idle');
      setDetectedProperty(null);
    }
  }, [onChange]);

  // Auto-fetch property data when URL is detected (Zillow or Redfin)
  useEffect(() => {
    if ((inputType === 'zillow' || inputType === 'redfin') && value && fetchStatus === 'idle') {
      const fetchPropertyData = async () => {
        setFetchStatus('loading');
        setErrorMessage(null);

        try {
          // Call the appropriate API based on URL type
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
            // Reset inputType to 'address' since we're now showing the extracted address
            setInputType('address');

            // Notify parent component
            if (onPropertyDetected) {
              onPropertyDetected(property);
            }

            // Update the input value to the extracted address
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

      // Debounce the fetch
      const timeoutId = setTimeout(fetchPropertyData, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [inputType, value, fetchStatus, zillowMutation, redfinMutation, onPropertyDetected, onChange]);

  // Reset fetch status when input changes
  useEffect(() => {
    if (inputType === 'zillow' || inputType === 'redfin') {
      setFetchStatus('idle');
    }
  }, [value, inputType]);

  const getInputIcon = () => {
    if (fetchStatus === 'loading') {
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
                type="text"
                value={value}
                onChange={(e) => handleInputChange(e.target.value)}
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
