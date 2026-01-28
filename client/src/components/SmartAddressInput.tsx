/**
 * SmartAddressInput Component
 * 
 * A smart input field that can accept either:
 * 1. A regular address (passed through as-is)
 * 2. A Zillow URL (auto-fetches property details)
 * 
 * When a Zillow URL is detected, it automatically calls the HasData API
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

export function SmartAddressInput({
  value,
  onChange,
  onPropertyDetected,
  placeholder = "Enter address or paste Zillow URL...",
  className = "",
  disabled = false,
  showPropertyCard = true,
  label,
  required = false,
}: SmartAddressInputProps) {
  const [inputType, setInputType] = useState<'address' | 'zillow'>('address');
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedProperty, setDetectedProperty] = useState<PropertyDetails | null>(null);

  const zillowMutation = trpc.zillow.getPropertyDetails.useMutation();

  // Detect input type and fetch Zillow data if needed
  const handleInputChange = useCallback((newValue: string) => {
    onChange(newValue);
    setErrorMessage(null);

    if (isZillowUrl(newValue)) {
      setInputType('zillow');
    } else {
      setInputType('address');
      setFetchStatus('idle');
      setDetectedProperty(null);
    }
  }, [onChange]);

  // Auto-fetch Zillow data when URL is detected
  useEffect(() => {
    if (inputType === 'zillow' && value && fetchStatus === 'idle') {
      const fetchZillowData = async () => {
        setFetchStatus('loading');
        setErrorMessage(null);

        try {
          const result = await zillowMutation.mutateAsync({ url: value.trim() });

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
              zpid: result.data.zpid,
              city: result.data.city,
              state: result.data.state,
              zipcode: result.data.zipcode,
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
          console.error('Error fetching Zillow data:', error);
          setFetchStatus('error');
          setErrorMessage('Failed to connect to property lookup service');
        }
      };

      // Debounce the fetch
      const timeoutId = setTimeout(fetchZillowData, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [inputType, value, fetchStatus, zillowMutation, onPropertyDetected, onChange]);

  // Reset fetch status when input changes
  useEffect(() => {
    if (inputType === 'zillow') {
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
    if (inputType === 'zillow') {
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
        <label className="block text-sm font-medium text-[#0F172A]/70 uppercase tracking-wider">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
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
              {inputType === 'zillow' && fetchStatus !== 'loading' && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                    Zillow URL
                  </span>
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-sm">
              <strong>Tip:</strong> Paste a Zillow listing URL to auto-fill property details, 
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
          <span>Fetching property details from Zillow...</span>
        </div>
      )}
    </div>
  );
}

export default SmartAddressInput;
