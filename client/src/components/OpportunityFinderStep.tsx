/**
 * Opportunity Finder Step Component
 * 
 * A Zillow-like experience where users can browse rental listings,
 * see STR revenue analysis inline on each card, and take action.
 * 
 * Design: Coach Inayah brand system (gold accents, light theme)
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
  TrendingUp,
  Info,
  Filter,
  Building,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Users,
  Map,
  BarChart3,
  ArrowRight,
  Calendar,
  Percent,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';

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
  
  // Handle validation (Analyze button)
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
          error: 'Could not get revenue estimate for this property',
        },
      }));
    } finally {
      setValidatingId(null);
    }
  };
  
  // Build URL for navigation to other tools
  const buildPropertyUrl = (property: ZillowProperty, path: string = '/') => {
    const params = new URLSearchParams({
      address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
      bedrooms: String(property.bedrooms || 2),
      bathrooms: String(property.bathrooms || 1),
      rent: String(property.price),
    });
    return `${path}?${params.toString()}`;
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
          Browse rental listings and instantly see their STR profit potential. Click "Analyze" to get revenue projections right here.
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
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 mt-4 border-t" style={{ borderColor: 'oklch(0.90 0 0)' }}>
                  {/* Price Range */}
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: 'oklch(0.45 0 0)' }}>Min Price</Label>
                    <Input
                      type="number"
                      placeholder="$0"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: 'oklch(0.45 0 0)' }}>Max Price</Label>
                    <Input
                      type="number"
                      placeholder="Any"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  
                  {/* Bedrooms */}
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: 'oklch(0.45 0 0)' }}>Min Beds</Label>
                    <Select value={bedsMin} onValueChange={setBedsMin}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: 'oklch(0.45 0 0)' }}>Max Beds</Label>
                    <Select value={bedsMax} onValueChange={setBedsMax}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Bathrooms */}
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: 'oklch(0.45 0 0)' }}>Min Baths</Label>
                    <Select value={bathsMin} onValueChange={setBathsMin}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 1.5, 2, 2.5, 3, 3.5, 4].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Home Type */}
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: 'oklch(0.45 0 0)' }}>Property Type</Label>
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
                    Click "Analyze" on any property to see projected STR revenue and profit potential.
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
                const hasAnalysis = validation?.success && validation?.projection;
                
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
                      <div className="relative h-44 bg-gray-100">
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
                        {/* Zillow Link */}
                        <button
                          onClick={() => window.open(property.url, '_blank')}
                          className="absolute bottom-3 right-3 p-2 rounded-full transition-all"
                          style={{ 
                            backgroundColor: 'oklch(0.98 0 0 / 0.9)',
                            color: 'oklch(0.35 0 0)',
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
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
                        
                        {/* INLINE ANALYSIS RESULTS */}
                        {hasAnalysis && validation.projection && (
                          <div 
                            className="rounded-xl p-4 mb-4"
                            style={{ 
                              backgroundColor: validation.isGoodDeal ? 'oklch(0.55 0.15 145 / 0.08)' : 'oklch(0.96 0 0)',
                              border: validation.isGoodDeal ? '1px solid oklch(0.55 0.15 145 / 0.2)' : '1px solid oklch(0.90 0 0)',
                            }}
                          >
                            {/* Monthly Profit - Hero Metric */}
                            <div className="text-center mb-4 pb-3" style={{ borderBottom: '1px solid oklch(0.90 0 0)' }}>
                              <p className="text-xs font-medium mb-1" style={{ color: 'oklch(0.50 0 0)' }}>
                                Estimated Monthly Profit
                              </p>
                              <p 
                                className="text-2xl font-bold"
                                style={{ 
                                  color: validation.projection.monthlyProfit > 0 ? 'oklch(0.45 0.15 145)' : 'oklch(0.55 0.20 25)',
                                }}
                              >
                                {formatCurrency(validation.projection.monthlyProfit)}
                              </p>
                              <p className="text-xs mt-1" style={{ color: 'oklch(0.55 0 0)' }}>
                                {formatCurrency(validation.projection.annualProfit)}/year
                              </p>
                            </div>
                            
                            {/* Key Metrics Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <DollarSign className="w-3 h-3" style={{ color: 'oklch(0.55 0.14 75)' }} />
                                  <span className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>Revenue</span>
                                </div>
                                <p className="text-sm font-semibold" style={{ color: 'oklch(0.25 0 0)' }}>
                                  {formatCurrency(validation.projection.monthlyRevenue)}/mo
                                </p>
                              </div>
                              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <Calendar className="w-3 h-3" style={{ color: 'oklch(0.55 0.14 75)' }} />
                                  <span className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>Occupancy</span>
                                </div>
                                <p className="text-sm font-semibold" style={{ color: 'oklch(0.25 0 0)' }}>
                                  {validation.projection.occupancy}%
                                </p>
                              </div>
                              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <Target className="w-3 h-3" style={{ color: 'oklch(0.55 0.14 75)' }} />
                                  <span className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>Nightly Rate</span>
                                </div>
                                <p className="text-sm font-semibold" style={{ color: 'oklch(0.25 0 0)' }}>
                                  {formatCurrency(validation.projection.adr)}
                                </p>
                              </div>
                              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: 'oklch(0.98 0 0)' }}>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <Percent className="w-3 h-3" style={{ color: 'oklch(0.55 0.14 75)' }} />
                                  <span className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>ROI</span>
                                </div>
                                <p className="text-sm font-semibold" style={{ color: 'oklch(0.25 0 0)' }}>
                                  {validation.projection.roi}%
                                </p>
                              </div>
                            </div>
                            
                            {/* Verdict */}
                            <p 
                              className="text-xs font-medium text-center py-2 rounded-lg"
                              style={{ 
                                backgroundColor: validation.isGoodDeal ? 'oklch(0.55 0.15 145 / 0.1)' : 'oklch(0.55 0.20 25 / 0.1)',
                                color: validation.isGoodDeal ? 'oklch(0.40 0.15 145)' : 'oklch(0.50 0.15 25)',
                              }}
                            >
                              {validation.verdict}
                            </p>
                          </div>
                        )}
                        
                        {/* Error State */}
                        {validation && !validation.success && (
                          <div 
                            className="p-3 rounded-lg mb-4 text-center"
                            style={{ backgroundColor: 'oklch(0.55 0.14 75 / 0.1)' }}
                          >
                            <p className="text-xs" style={{ color: 'oklch(0.45 0 0)' }}>
                              {validation.error || 'Could not get revenue estimate'}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'oklch(0.55 0 0)' }}>
                              Try the full analysis for more options
                            </p>
                          </div>
                        )}
                        
                        {/* ACTION BUTTONS */}
                        {!validation ? (
                          // Before analysis - show Analyze button
                          <Button
                            onClick={() => handleValidate(property)}
                            disabled={isValidating}
                            className="w-full h-10 text-sm"
                            style={{
                              backgroundColor: 'oklch(0.55 0.14 75)',
                              borderRadius: '980px',
                            }}
                          >
                            {isValidating ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <TrendingUp className="w-4 h-4 mr-2" />
                                Analyze Property
                              </>
                            )}
                          </Button>
                        ) : (
                          // After analysis - show action buttons
                          <div className="space-y-3">
                            {/* Deep Dive Buttons */}
                            <div className="grid grid-cols-3 gap-2">
                              <Link href={buildPropertyUrl(property, '/')}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-9 text-xs px-2"
                                  style={{ borderRadius: '0.5rem' }}
                                >
                                  <Users className="w-3 h-3 mr-1" />
                                  Competition
                                </Button>
                              </Link>
                              <Link href={buildPropertyUrl(property, '/')}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-9 text-xs px-2"
                                  style={{ borderRadius: '0.5rem' }}
                                >
                                  <Map className="w-3 h-3 mr-1" />
                                  Map
                                </Button>
                              </Link>
                              <Link href={`/market-advisor?location=${encodeURIComponent(property.city + ', ' + property.state)}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-9 text-xs px-2"
                                  style={{ borderRadius: '0.5rem' }}
                                >
                                  <BarChart3 className="w-3 h-3 mr-1" />
                                  Market
                                </Button>
                              </Link>
                            </div>
                            
                            {/* Turnkey CTA */}
                            <a 
                              href="https://coachinayah.com/turnkey"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <Button
                                className="w-full h-10 text-sm group"
                                style={{
                                  backgroundColor: 'oklch(0.55 0.14 75)',
                                  borderRadius: '980px',
                                }}
                              >
                                <Sparkles className="w-4 h-4 mr-2" />
                                Apply for Turnkey Program
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                              </Button>
                            </a>
                          </div>
                        )}
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
            Enter a city or zip code above to browse available rentals. Click "Analyze" on any property to see its STR profit potential instantly.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['Atlanta, GA', 'Denver, CO', 'Austin, TX', 'Nashville, TN'].map(city => (
              <button
                key={city}
                onClick={() => {
                  setLocation(city);
                  setTimeout(handleSearch, 100);
                }}
                className="px-4 py-2 text-sm rounded-full transition-all duration-300 hover:scale-105"
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
