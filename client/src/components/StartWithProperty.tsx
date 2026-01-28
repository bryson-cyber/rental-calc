/**
 * StartWithProperty - Entry point for property-centric workflow
 * 
 * When a user has a specific property they want to analyze, they can enter
 * it here and all tools will auto-populate with relevant data filtered
 * to match the property's characteristics (apples-to-apples comparison).
 */

import { useState, useEffect } from 'react';
import { useProperty, PropertyDetails } from '@/contexts/PropertyContext';
import { AddressAutocomplete, PlaceDetails } from '@/components/AddressAutocomplete';
import { SmartAddressInput, PropertyDetails as ZillowPropertyDetails } from '@/components/SmartAddressInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Home, 
  MapPin, 
  Bed, 
  Bath, 
  DollarSign, 
  CheckCircle2, 
  X,
  Sparkles,
  ArrowRight,
  Target,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface StartWithPropertyProps {
  onPropertySet?: (property: PropertyDetails) => void;
  onNavigateToStep?: (step: string) => void;
  compact?: boolean;
}

export function StartWithProperty({ 
  onPropertySet, 
  onNavigateToStep,
  compact = false 
}: StartWithPropertyProps) {
  const { myProperty, setMyProperty, clearProperty, hasProperty, enforceApplesToApples, setEnforceApplesToApples } = useProperty();
  
  // Form state - initialize from existing property if available
  const [address, setAddress] = useState(myProperty?.address || '');
  const [bedrooms, setBedrooms] = useState(myProperty?.bedrooms?.toString() || '2');
  const [bathrooms, setBathrooms] = useState(myProperty?.bathrooms?.toString() || '1');
  const [monthlyRent, setMonthlyRent] = useState(myProperty?.monthlyRent?.toString() || '');
  const [isExpanded, setIsExpanded] = useState(!hasProperty);
  
  // Sync form state when property changes (e.g., when editing)
  useEffect(() => {
    if (myProperty) {
      setAddress(myProperty.address || '');
      setBedrooms(myProperty.bedrooms?.toString() || '2');
      setBathrooms(myProperty.bathrooms?.toString() || '1');
      setMonthlyRent(myProperty.monthlyRent?.toString() || '');
    }
  }, [myProperty]);
  
  // Selected place ID and details for geocoding
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedPlaceDetails, setSelectedPlaceDetails] = useState<PlaceDetails | null>(null);
  
  // Handle address selection from autocomplete
  const handleAddressSelect = (selectedAddress: string, placeId: string, details?: PlaceDetails) => {
    setAddress(selectedAddress);
    setSelectedPlaceId(placeId);
    if (details) {
      setSelectedPlaceDetails(details);
      console.log('[StartWithProperty] Received place details:', details);
    }
  };
  
  // Handle property detected from Zillow URL
  // Helper to find the closest valid bathroom option
  const findClosestBathroomOption = (value: number): string => {
    const options = [1, 1.5, 2, 2.5, 3, 3.5, 4];
    // For values >= 4, use 4+
    if (value >= 4) return '4';
    // Find the closest option
    let closest = options[0];
    let minDiff = Math.abs(value - closest);
    for (const opt of options) {
      const diff = Math.abs(value - opt);
      if (diff < minDiff) {
        minDiff = diff;
        closest = opt;
      }
    }
    return closest.toString();
  };
  
  // Helper to find the closest valid bedroom option
  const findClosestBedroomOption = (value: number): string => {
    // Options: 0 (Studio), 1, 2, 3, 4, 5+
    if (value <= 0) return '0';
    if (value >= 5) return '5';
    return Math.round(value).toString();
  };
  
  const handleZillowPropertyDetected = (property: ZillowPropertyDetails) => {
    console.log('[StartWithProperty] Zillow property detected:', property);
    
    // Update form fields with Zillow data
    setAddress(property.address);
    
    if (property.bedrooms !== null) {
      setBedrooms(findClosestBedroomOption(property.bedrooms));
    }
    
    if (property.bathrooms !== null) {
      setBathrooms(findClosestBathroomOption(property.bathrooms));
    }
    
    if (property.price !== null && property.priceType === 'rent') {
      setMonthlyRent(property.price.toString());
    }
    
    // Store location details for later use
    if (property.city || property.state || property.zipcode) {
      setSelectedPlaceDetails({
        city: property.city,
        state: property.state,
        zipCode: property.zipcode,
      } as PlaceDetails);
    }
    
    const platformName = property.source === 'redfin' ? 'Redfin' : 'Zillow';
    toast.success(`Property details loaded from ${platformName}!`);
  };
  
  // Extract location details from address string
  const extractLocationFromAddress = (addr: string) => {
    // Parse various address formats:
    // "123 Main St, Miami, FL 33139, USA"
    // "123 Main St, Miami Beach, Florida, USA"
    // "123 Main St, Miami, FL, USA"
    const parts = addr.split(',').map(p => p.trim());
    let city, state, zipCode;
    
    // Try to find zip code anywhere in the address (5 digits)
    const zipMatch = addr.match(/\b(\d{5})\b/);
    if (zipMatch) {
      zipCode = zipMatch[1];
    }
    
    // Try to find state (2-letter code or full name)
    const stateAbbrevMatch = addr.match(/\b([A-Z]{2})\b(?:\s+\d{5})?/);
    if (stateAbbrevMatch) {
      state = stateAbbrevMatch[1];
    }
    
    // City is usually before the state
    if (parts.length >= 3) {
      // Find the part that contains the state and look before it
      for (let i = 0; i < parts.length - 1; i++) {
        if (parts[i + 1].match(/^[A-Z]{2}\b/) || parts[i + 1].match(/Florida|California|Texas|New York/i)) {
          city = parts[i];
          break;
        }
      }
      // Fallback: city is 3rd from end
      if (!city && parts.length >= 3) {
        city = parts[parts.length - 3];
      }
    }
    
    console.log('[StartWithProperty] Extracted location:', { city, state, zipCode, from: addr });
    
    return { city, state, zipCode };
  };
  
  // Set the property context
  const handleSetProperty = () => {
    if (!address) {
      toast.error('Please enter a property address');
      return;
    }
    
    // Use place details from Google API if available, otherwise fall back to regex extraction
    let locationInfo: { city?: string; state?: string; zipCode?: string };
    
    if (selectedPlaceDetails) {
      locationInfo = {
        city: selectedPlaceDetails.city,
        state: selectedPlaceDetails.state,
        zipCode: selectedPlaceDetails.zipCode,
      };
      console.log('[StartWithProperty] Using Google place details:', locationInfo);
    } else {
      locationInfo = extractLocationFromAddress(address);
      console.log('[StartWithProperty] Falling back to regex extraction:', locationInfo);
    }
    
    const property: PropertyDetails = {
      address,
      formattedAddress: address,
      zipCode: locationInfo.zipCode,
      city: locationInfo.city,
      state: locationInfo.state,
      bedrooms: parseInt(bedrooms) || 2,
      bathrooms: parseFloat(bathrooms) || 1,
      monthlyRent: monthlyRent ? parseFloat(monthlyRent) : undefined,
      latitude: selectedPlaceDetails?.lat,
      longitude: selectedPlaceDetails?.lng,
    };
    
    console.log('[StartWithProperty] Setting property:', property);
    
    setMyProperty(property);
    setIsExpanded(false);
    toast.success('Property set! All tools will now show relevant data for your property.');
    
    if (onPropertySet) {
      onPropertySet(property);
    }
  };
  
  // Clear the property
  const handleClearProperty = () => {
    clearProperty();
    setAddress('');
    setBedrooms('2');
    setBathrooms('1');
    setMonthlyRent('');
    setSelectedPlaceId(null);
    setIsExpanded(true);
    toast.info('Property cleared. Tools will show all data.');
  };
  
  // Compact view when property is set
  if (hasProperty && !isExpanded && compact) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Home className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Analyzing</p>
              <p className="font-medium text-slate-900 truncate max-w-[200px] md:max-w-[400px]">
                {myProperty?.address}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-amber-700 font-medium">
              {myProperty?.bedrooms} BR / {myProperty?.bathrooms} BA
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearProperty}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Full property set view
  if (hasProperty && !isExpanded) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Home className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">My Property</h3>
              <p className="text-sm text-slate-500">All tools filtered to match</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearProperty}
              className="text-slate-400 hover:text-red-500"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Property Details */}
        <div className="bg-slate-50 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3 mb-4">
            <MapPin className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-slate-900">{myProperty?.address}</p>
              {myProperty?.city && myProperty?.state && (
                <p className="text-sm text-slate-500">
                  {myProperty.city}, {myProperty.state} {myProperty.zipCode}
                </p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Bed className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700">{myProperty?.bedrooms} Bedrooms</span>
            </div>
            <div className="flex items-center gap-2">
              <Bath className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700">{myProperty?.bathrooms} Bathrooms</span>
            </div>
            {myProperty?.monthlyRent && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">${myProperty.monthlyRent.toLocaleString()}/mo</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Apples-to-Apples Toggle */}
        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-slate-700">
              Show only {myProperty?.bedrooms}BR properties (apples-to-apples)
            </span>
          </div>
          <button
            onClick={() => setEnforceApplesToApples(!enforceApplesToApples)}
            className={`w-12 h-6 rounded-full transition-colors ${
              enforceApplesToApples ? 'bg-amber-500' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                enforceApplesToApples ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        
        {/* Quick Actions */}
        {onNavigateToStep && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-500 mb-3">Quick Actions:</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateToStep('validate')}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 justify-start"
              >
                <Target className="w-4 h-4 mr-2" />
                Validate Deal
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateToStep('map')}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 justify-start"
              >
                <MapPin className="w-4 h-4 mr-2" />
                See on Map
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Form view - LIGHT THEME
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Start with Your Property</h3>
          <p className="text-sm text-slate-500">
            Enter your property to see relevant data across all tools
          </p>
        </div>
      </div>
      
      {/* Benefits */}
      <div className="bg-slate-50 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Auto-fill location data
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            See matching comps only
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Distance to competitors
          </div>
        </div>
      </div>
      
      {/* Form */}
      <div className="space-y-4">
        {/* Address - Now supports Zillow URLs */}
        <SmartAddressInput
          value={address}
          onChange={setAddress}
          onPropertyDetected={handleZillowPropertyDetected}
          placeholder="Enter address or paste Zillow/Redfin URL..."
          label="Property Address"
          required={true}
          showPropertyCard={true}
        />
        
        {/* Bedrooms & Bathrooms */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bedrooms
            </label>
            <select
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none"
            >
              <option value="0">Studio</option>
              <option value="1">1 Bedroom</option>
              <option value="2">2 Bedrooms</option>
              <option value="3">3 Bedrooms</option>
              <option value="4">4 Bedrooms</option>
              <option value="5">5+ Bedrooms</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bathrooms
            </label>
            <select
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none"
            >
              <option value="1">1 Bathroom</option>
              <option value="1.5">1.5 Bathrooms</option>
              <option value="2">2 Bathrooms</option>
              <option value="2.5">2.5 Bathrooms</option>
              <option value="3">3 Bathrooms</option>
              <option value="3.5">3.5 Bathrooms</option>
              <option value="4">4+ Bathrooms</option>
            </select>
          </div>
        </div>
        
        {/* Monthly Rent or Mortgage (Required) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Monthly Rent or Mortgage <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="number"
              min="0"
              value={monthlyRent}
              onChange={(e) => {
                const val = e.target.value;
                // Prevent negative values
                if (val === '' || parseFloat(val) >= 0) {
                  setMonthlyRent(val);
                }
              }}
              placeholder="2,500"
              className="w-full h-12 pl-12 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Required for profit calculations and break-even analysis
          </p>
        </div>
        
        {/* Submit Button */}
        <Button
          onClick={handleSetProperty}
          disabled={!address || !monthlyRent || parseFloat(monthlyRent) <= 0}
          className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50"
        >
          <Home className="w-5 h-5 mr-2" />
          Set My Property
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        
        {/* Skip option */}
        <p className="text-center text-sm text-slate-500">
          Or explore markets without a specific property
        </p>
      </div>
    </div>
  );
}
