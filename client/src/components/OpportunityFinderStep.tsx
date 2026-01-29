/**
 * Opportunity Finder Step Component
 * 
 * Allows users to browse Zillow rental listings and validate them
 * for STR arbitrage potential using AirDNA data.
 * 
 * Design: Coach Inayah brand system (gold accents, light theme)
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Search, 
  Home, 
  MapPin, 
  Bed, 
  Bath, 
  DollarSign, 
  Loader2,
  ExternalLink,
  CheckCircle,
  XCircle,
  TrendingUp,
  Info,
  Filter,
  Building,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface ZillowProperty {
  id: string;
  url: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  homeType: string;
  image: string;
  status: string;
  daysOnZillow?: number;
}

interface ValidationResult {
  success: boolean;
  property: {
    address: string;
    rent: number;
    bedrooms: number;
    bathrooms: number;
  };
  projection?: {
    annualRevenue: number;
    monthlyRevenue: number;
    occupancy: number;
    adr: number;
    operatingCosts: number;
    monthlyProfit: number;
    annualProfit: number;
    roi: number;
  };
  verdict?: string;
  isGoodDeal?: boolean;
  error?: string;
}

interface OpportunityFinderStepProps {
  onSelectProperty?: (property: {
    address: string;
    bedrooms: number;
    bathrooms: number;
    monthlyRent: number;
  }) => void;
}

// Home type options
const HOME_TYPES = [
  { value: 'SINGLE_FAMILY', label: 'Single Family' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'TOWNHOUSE', label: 'Townhouse' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'MULTI_FAMILY', label: 'Multi-Family' },
];

export default function OpportunityFinderStep({ onSelectProperty }: OpportunityFinderStepProps) {
  // Search state
  const [location, setLocation] = useState('');
  const [searchType, setSearchType] = useState<'forRent' | 'forSale'>('forRent');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter state
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [bedsMin, setBedsMin] = useState<string>('');
  const [bedsMax, setBedsMax] = useState<string>('');
  const [bathsMin, setBathsMin] = useState<string>('');
  const [homeType, setHomeType] = useState<string>('');
  
  // Results state
  const [properties, setProperties] = useState<ZillowProperty[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Validation state
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  
  // Mutations
  const searchRentals = trpc.opportunityFinder.searchZillowRentals.useMutation();
  const searchForSale = trpc.opportunityFinder.searchZillowForSale.useMutation();
  const validateProperty = trpc.opportunityFinder.validateProperty.useMutation();
  
  const isSearching = searchRentals.isPending || searchForSale.isPending;
  
  // Handle search
  const handleSearch = async () => {
    if (!location.trim()) return;
    
    setHasSearched(true);
    setProperties([]);
    setValidationResults({});
    
    const params = {
      location: location.trim(),
      priceMin: priceMin ? parseInt(priceMin) : undefined,
      priceMax: priceMax ? parseInt(priceMax) : undefined,
      bedsMin: bedsMin ? parseInt(bedsMin) : undefined,
      bedsMax: bedsMax ? parseInt(bedsMax) : undefined,
      bathsMin: bathsMin ? parseFloat(bathsMin) : undefined,
      homeTypes: homeType ? [homeType] : undefined,
    };
    
    try {
      const result = searchType === 'forRent' 
        ? await searchRentals.mutateAsync(params)
        : await searchForSale.mutateAsync(params);
      
      setProperties(result.properties);
      setTotalResults(result.totalResults);
    } catch (error) {
      console.error('Search error:', error);
    }
  };
  
  // Handle validation
  const handleValidate = async (property: ZillowProperty) => {
    setValidatingId(property.id);
    
    try {
      const result = await validateProperty.mutateAsync({
        address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
        rent: property.price,
        bedrooms: property.bedrooms || 2,
        bathrooms: property.bathrooms || 1,
        zillowUrl: property.url,
        image: property.image,
      });
      
      setValidationResults(prev => ({
        ...prev,
        [property.id]: result,
      }));
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResults(prev => ({
        ...prev,
        [property.id]: {
          success: false,
          property: {
            address: property.address,
            rent: property.price,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
          },
          error: 'Failed to validate property',
        },
      }));
    } finally {
      setValidatingId(null);
    }
  };
  
  // Handle select for full analysis
  const handleSelectForAnalysis = (property: ZillowProperty) => {
    if (onSelectProperty) {
      onSelectProperty({
        address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
        bedrooms: property.bedrooms || 2,
        bathrooms: property.bathrooms || 1,
        monthlyRent: property.price,
      });
    }
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ backgroundColor: 'oklch(0.55 0.14 75 / 0.15)' }}>
          <Search className="w-7 h-7" style={{ color: 'oklch(0.55 0.14 75)' }} />
        </div>
        <h2 className="text-2xl font-semibold mb-2" style={{ color: 'oklch(0.15 0 0)' }}>
          Find Your Next Opportunity
        </h2>
        <p className="text-base max-w-xl mx-auto" style={{ color: 'oklch(0.45 0 0)' }}>
          Browse rental listings and instantly see their STR profit potential. Click "Validate" to get revenue projections.
        </p>
      </div>
      
      {/* Search Section */}
      <Card className="border" style={{ borderColor: 'oklch(0.90 0 0)', borderRadius: '1.25rem' }}>
        <CardContent className="p-6">
          {/* Search Type Toggle */}
          <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ backgroundColor: 'oklch(0.96 0 0)', border: '1px solid oklch(0.90 0 0)' }}>
            <button
              onClick={() => setSearchType('forRent')}
              className="flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300"
              style={{
                backgroundColor: searchType === 'forRent' ? 'oklch(0.55 0.14 75)' : 'transparent',
                color: searchType === 'forRent' ? 'oklch(0.98 0 0)' : 'oklch(0.45 0 0)',
              }}
            >
              <Home className="w-4 h-4 inline-block mr-2" />
              For Rent
            </button>
            <button
              onClick={() => setSearchType('forSale')}
              className="flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300"
              style={{
                backgroundColor: searchType === 'forSale' ? 'oklch(0.55 0.14 75)' : 'transparent',
                color: searchType === 'forSale' ? 'oklch(0.98 0 0)' : 'oklch(0.45 0 0)',
              }}
            >
              <Building className="w-4 h-4 inline-block mr-2" />
              For Sale
            </button>
          </div>
          
          {/* Location Search */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'oklch(0.55 0.14 75)' }} />
              <Input
                placeholder="Enter city, state or zip code..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-12 h-12 text-base"
                style={{
                  borderRadius: '0.75rem',
                  borderColor: 'oklch(0.88 0 0)',
                }}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!location.trim() || isSearching}
              className="h-12 px-6"
              style={{
                backgroundColor: 'oklch(0.55 0.14 75)',
                borderRadius: '980px',
              }}
            >
              {isSearching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: 'oklch(0.45 0 0)' }}
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {/* Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-4 pt-4" style={{ borderTop: '1px solid oklch(0.90 0 0)' }}>
                  <div>
                    <Label className="text-xs mb-1 block" style={{ color: 'oklch(0.45 0 0)' }}>
                      Min {searchType === 'forRent' ? 'Rent' : 'Price'}
                    </Label>
                    <Input
                      type="number"
                      placeholder="$0"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block" style={{ color: 'oklch(0.45 0 0)' }}>
                      Max {searchType === 'forRent' ? 'Rent' : 'Price'}
                    </Label>
                    <Input
                      type="number"
                      placeholder="Any"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block" style={{ color: 'oklch(0.45 0 0)' }}>Min Beds</Label>
                    <Select value={bedsMin} onValueChange={setBedsMin}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1+</SelectItem>
                        <SelectItem value="2">2+</SelectItem>
                        <SelectItem value="3">3+</SelectItem>
                        <SelectItem value="4">4+</SelectItem>
                        <SelectItem value="5">5+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block" style={{ color: 'oklch(0.45 0 0)' }}>Max Beds</Label>
                    <Select value={bedsMax} onValueChange={setBedsMax}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="5">5+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block" style={{ color: 'oklch(0.45 0 0)' }}>Min Baths</Label>
                    <Select value={bathsMin} onValueChange={setBathsMin}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1+</SelectItem>
                        <SelectItem value="2">2+</SelectItem>
                        <SelectItem value="3">3+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block" style={{ color: 'oklch(0.45 0 0)' }}>Home Type</Label>
                    <Select value={homeType} onValueChange={setHomeType}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        {HOME_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
      
      {/* Results */}
      {hasSearched && (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'oklch(0.45 0 0)' }}>
              {isSearching ? (
                'Searching...'
              ) : (
                <>
                  Found <span className="font-semibold" style={{ color: 'oklch(0.15 0 0)' }}>{totalResults}</span> properties in <span className="font-semibold" style={{ color: 'oklch(0.15 0 0)' }}>{location}</span>
                </>
              )}
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4" style={{ color: 'oklch(0.55 0 0)' }} />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-sm">
                    Click "Validate" on any property to see projected STR revenue and profit potential.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {/* Property Grid */}
          {isSearching ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'oklch(0.55 0.14 75)' }} />
            </div>
          ) : properties.length === 0 ? (
            <Card className="p-8 text-center" style={{ borderRadius: '1.25rem' }}>
              <Home className="w-12 h-12 mx-auto mb-4" style={{ color: 'oklch(0.55 0 0)' }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'oklch(0.15 0 0)' }}>
                No Properties Found
              </h3>
              <p style={{ color: 'oklch(0.45 0 0)' }}>
                Try adjusting your filters or searching a different location.
              </p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map((property) => {
                const validation = validationResults[property.id];
                const isValidating = validatingId === property.id;
                
                return (
                  <motion.div
                    key={property.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card 
                      className="overflow-hidden transition-all duration-300 hover:shadow-lg"
                      style={{ 
                        borderRadius: '1rem',
                        border: validation?.isGoodDeal ? '2px solid oklch(0.55 0.15 145)' : '1px solid oklch(0.90 0 0)',
                      }}
                    >
                      {/* Property Image */}
                      <div className="relative h-40 bg-gray-100">
                        {property.image ? (
                          <img
                            src={property.image}
                            alt={property.address}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Home className="w-12 h-12" style={{ color: 'oklch(0.70 0 0)' }} />
                          </div>
                        )}
                        {/* Price Badge */}
                        <div 
                          className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-sm font-semibold"
                          style={{ 
                            backgroundColor: 'oklch(0.15 0 0 / 0.85)',
                            color: 'oklch(0.98 0 0)',
                          }}
                        >
                          {formatCurrency(property.price)}{searchType === 'forRent' ? '/mo' : ''}
                        </div>
                        {/* Good Deal Badge */}
                        {validation?.isGoodDeal && (
                          <div 
                            className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1"
                            style={{ 
                              backgroundColor: 'oklch(0.55 0.15 145)',
                              color: 'oklch(0.98 0 0)',
                            }}
                          >
                            <Sparkles className="w-3 h-3" />
                            Good Deal
                          </div>
                        )}
                      </div>
                      
                      {/* Property Details */}
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-sm mb-1 truncate" style={{ color: 'oklch(0.15 0 0)' }}>
                          {property.address}
                        </h3>
                        <p className="text-xs mb-3" style={{ color: 'oklch(0.55 0 0)' }}>
                          {property.city}, {property.state} {property.zipCode}
                        </p>
                        
                        {/* Property Stats */}
                        <div className="flex items-center gap-4 text-xs mb-4" style={{ color: 'oklch(0.45 0 0)' }}>
                          <span className="flex items-center gap-1">
                            <Bed className="w-3.5 h-3.5" />
                            {property.bedrooms || '?'} bed
                          </span>
                          <span className="flex items-center gap-1">
                            <Bath className="w-3.5 h-3.5" />
                            {property.bathrooms || '?'} bath
                          </span>
                          {property.squareFeet && (
                            <span>{property.squareFeet.toLocaleString()} sqft</span>
                          )}
                        </div>
                        
                        {/* Validation Results */}
                        {validation && validation.success && validation.projection && (
                          <div 
                            className="p-3 rounded-lg mb-4"
                            style={{ 
                              backgroundColor: validation.isGoodDeal ? 'oklch(0.55 0.15 145 / 0.1)' : 'oklch(0.96 0 0)',
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium" style={{ color: 'oklch(0.45 0 0)' }}>
                                Projected Monthly Profit
                              </span>
                              <span 
                                className="text-sm font-bold"
                                style={{ 
                                  color: validation.projection.monthlyProfit > 0 ? 'oklch(0.45 0.15 145)' : 'oklch(0.55 0.20 25)',
                                }}
                              >
                                {formatCurrency(validation.projection.monthlyProfit)}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span style={{ color: 'oklch(0.55 0 0)' }}>Revenue: </span>
                                <span style={{ color: 'oklch(0.25 0 0)' }}>{formatCurrency(validation.projection.monthlyRevenue)}/mo</span>
                              </div>
                              <div>
                                <span style={{ color: 'oklch(0.55 0 0)' }}>Occupancy: </span>
                                <span style={{ color: 'oklch(0.25 0 0)' }}>{validation.projection.occupancy}%</span>
                              </div>
                              <div>
                                <span style={{ color: 'oklch(0.55 0 0)' }}>Nightly Rate: </span>
                                <span style={{ color: 'oklch(0.25 0 0)' }}>{formatCurrency(validation.projection.adr)}</span>
                              </div>
                              <div>
                                <span style={{ color: 'oklch(0.55 0 0)' }}>ROI: </span>
                                <span style={{ color: 'oklch(0.25 0 0)' }}>{validation.projection.roi}%</span>
                              </div>
                            </div>
                            <p 
                              className="text-xs font-medium mt-2 pt-2"
                              style={{ 
                                borderTop: '1px solid oklch(0.90 0 0)',
                                color: validation.isGoodDeal ? 'oklch(0.45 0.15 145)' : 'oklch(0.55 0.20 25)',
                              }}
                            >
                              {validation.verdict}
                            </p>
                          </div>
                        )}
                        
                        {validation && !validation.success && (
                          <div 
                            className="p-3 rounded-lg mb-4 flex items-center gap-2"
                            style={{ backgroundColor: 'oklch(0.55 0.20 25 / 0.1)' }}
                          >
                            <XCircle className="w-4 h-4" style={{ color: 'oklch(0.55 0.20 25)' }} />
                            <span className="text-xs" style={{ color: 'oklch(0.55 0.20 25)' }}>
                              {validation.error || 'Could not validate property'}
                            </span>
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {!validation ? (
                            <Button
                              onClick={() => handleValidate(property)}
                              disabled={isValidating}
                              className="flex-1 h-9 text-sm"
                              style={{
                                backgroundColor: 'oklch(0.55 0.14 75)',
                                borderRadius: '980px',
                              }}
                            >
                              {isValidating ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <TrendingUp className="w-4 h-4 mr-2" />
                              )}
                              {isValidating ? 'Validating...' : 'Validate'}
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleSelectForAnalysis(property)}
                              className="flex-1 h-9 text-sm"
                              style={{
                                backgroundColor: 'oklch(0.55 0.14 75)',
                                borderRadius: '980px',
                              }}
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              Full Analysis
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() => window.open(property.url, '_blank')}
                            style={{ borderRadius: '980px' }}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Empty State */}
      {!hasSearched && (
        <Card className="p-12 text-center" style={{ borderRadius: '1.25rem', backgroundColor: 'oklch(0.98 0 0)' }}>
          <div 
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: 'oklch(0.55 0.14 75 / 0.15)' }}
          >
            <Search className="w-8 h-8" style={{ color: 'oklch(0.55 0.14 75)' }} />
          </div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'oklch(0.15 0 0)' }}>
            Search for Rental Opportunities
          </h3>
          <p className="max-w-md mx-auto mb-6" style={{ color: 'oklch(0.45 0 0)' }}>
            Enter a city or zip code above to browse available rentals. Click "Validate" on any property to see its STR profit potential.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['Atlanta, GA', 'Denver, CO', 'Austin, TX', 'Nashville, TN'].map(city => (
              <button
                key={city}
                onClick={() => {
                  setLocation(city);
                  setTimeout(handleSearch, 100);
                }}
                className="px-4 py-2 text-sm rounded-full transition-all duration-300"
                style={{
                  backgroundColor: 'oklch(0.96 0 0)',
                  color: 'oklch(0.35 0 0)',
                  border: '1px solid oklch(0.88 0 0)',
                }}
              >
                {city}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
