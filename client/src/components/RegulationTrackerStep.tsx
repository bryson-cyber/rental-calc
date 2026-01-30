/**
 * Regulation Tracker Step Component
 * 
 * Allows users to look up current STR regulations for any city
 * and see them explained in simple, 3rd-grade reading level language.
 * 
 * Features:
 * - Google Places autocomplete for city selection
 * - Smart jurisdiction resolution for small towns
 * - Real-time regulation lookup via Gemini with Google Search
 * - Simple explanation (3rd-grade level) and full details
 * - Links to official government sources
 * - Less scary status messaging (permit required ≠ banned)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  HelpCircle,
  FileText,
  DollarSign,
  Home,
  Calendar,
  MapPin,
  ExternalLink,
  Loader2,
  Info,
  Ban,
  PauseCircle,
  FileCheck,
  Scale,
  Building2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { GooglePlacesAutocomplete } from '@/components/GooglePlacesAutocomplete';

// Updated status configuration - less scary, more accurate
const statusConfig = {
  allowed: {
    color: 'oklch(0.55 0.15 145)',
    bgColor: 'oklch(0.55 0.15 145 / 0.1)',
    icon: CheckCircle2,
    label: 'Allowed',
    description: 'Short-term rentals are permitted with minimal requirements'
  },
  'allowed_with_permit': {
    color: 'oklch(0.55 0.15 145)',
    bgColor: 'oklch(0.55 0.15 145 / 0.1)',
    icon: FileCheck,
    label: 'Allowed with Permit',
    description: 'You can operate - just need to get a permit first'
  },
  'allowed_with_requirements': {
    color: 'oklch(0.60 0.12 85)',
    bgColor: 'oklch(0.60 0.12 85 / 0.1)',
    icon: Scale,
    label: 'Allowed with Requirements',
    description: 'Permitted with some rules to follow'
  },
  restricted: {
    color: 'oklch(0.65 0.15 85)',
    bgColor: 'oklch(0.65 0.15 85 / 0.1)',
    icon: AlertTriangle,
    label: 'Some Restrictions',
    description: 'Allowed but with some limitations to be aware of'
  },
  limited: {
    color: 'oklch(0.60 0.15 60)',
    bgColor: 'oklch(0.60 0.15 60 / 0.1)',
    icon: AlertTriangle,
    label: 'Limited',
    description: 'Allowed in limited circumstances'
  },
  banned: {
    color: 'oklch(0.55 0.2 25)',
    bgColor: 'oklch(0.55 0.2 25 / 0.1)',
    icon: Ban,
    label: 'Not Allowed',
    description: 'Short-term rentals are currently prohibited'
  },
  paused: {
    color: 'oklch(0.60 0.15 250)',
    bgColor: 'oklch(0.60 0.15 250 / 0.1)',
    icon: PauseCircle,
    label: 'Paused',
    description: 'Regulations currently under review or suspended'
  },
  pending: {
    color: 'oklch(0.65 0.12 60)',
    bgColor: 'oklch(0.65 0.12 60 / 0.1)',
    icon: Clock,
    label: 'Pending',
    description: 'New regulations are being considered'
  },
  unknown: {
    color: 'oklch(0.50 0 0)',
    bgColor: 'oklch(0.50 0 0 / 0.1)',
    icon: HelpCircle,
    label: 'Unknown',
    description: 'Unable to determine current status'
  }
};

interface RegulationResult {
  city: string;
  state: string;
  status: 'allowed' | 'allowed_with_permit' | 'allowed_with_requirements' | 'restricted' | 'limited' | 'banned' | 'paused' | 'pending' | 'unknown';
  yesNoSummary: string;
  summary: string;
  simplifiedSummary: string;
  keyRequirements: string[];
  permitRequired: boolean;
  primaryResidenceOnly: boolean;
  maxNightsPerYear?: number;
  registrationFee?: string;
  occupancyTax?: string;
  zoningRestrictions?: string;
  sources: Array<{
    title: string;
    url: string;
    type: 'official' | 'news' | 'third_party';
  }>;
  lastUpdated: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  ordinanceNumber?: string;
  governingJurisdiction?: string;
}

export function RegulationTrackerStep() {
  const [selectedPlace, setSelectedPlace] = useState<{ name: string; placeId: string; lat?: number; lng?: number } | null>(null);
  const [result, setResult] = useState<RegulationResult | null>(null);
  const [showSimplified, setShowSimplified] = useState(true);
  
  const getRegulationsMutation = trpc.regulationTracker.getRegulations.useMutation({
    onSuccess: (data) => {
      // Map the status to our improved status labels
      let mappedStatus = data.status;
      if (data.status === 'restricted' && data.permitRequired && !data.primaryResidenceOnly) {
        // If it's just a permit requirement, make it less scary
        mappedStatus = 'allowed_with_permit' as any;
      } else if (data.status === 'restricted' && data.keyRequirements.length > 0) {
        mappedStatus = 'allowed_with_requirements' as any;
      }
      
      setResult({ ...data, status: mappedStatus } as RegulationResult);
      toast.success(`Found regulations for ${data.city}, ${data.state}`);
    },
    onError: (error) => {
      toast.error('Failed to look up regulations: ' + error.message);
    }
  });
  
  const handlePlaceSelect = (place: { name: string; placeId: string; lat?: number; lng?: number }) => {
    setSelectedPlace(place);
    // Clear previous results when selecting new place
    setResult(null);
  };
  
  const handleSearch = () => {
    if (!selectedPlace) {
      toast.error('Please select a city from the dropdown');
      return;
    }
    
    // Parse city and state from the place name
    // Format is usually "City, State, USA" or "City, State"
    const parts = selectedPlace.name.split(',').map(p => p.trim());
    let city = parts[0];
    let state = parts.length > 1 ? parts[1] : '';
    
    // Remove "USA" if present
    if (state.toLowerCase() === 'usa' && parts.length > 2) {
      state = parts[1];
    }
    
    // Handle zip codes - if city looks like a zip code, use it differently
    if (/^\d{5}$/.test(city)) {
      // It's a zip code, use the second part as city
      if (parts.length > 1) {
        city = parts[1];
        state = parts.length > 2 ? parts[2] : '';
      }
    }
    
    getRegulationsMutation.mutate({ city, state });
  };
  
  const isLoading = getRegulationsMutation.isPending;
  
  // Get the status config, falling back to 'restricted' for new status types
  const getStatusConfig = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.restricted;
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: 'oklch(0.55 0.15 250 / 0.1)' }}>
          <Shield className="w-8 h-8" style={{ color: 'oklch(0.55 0.15 250)' }} />
        </div>
        <h2 className="text-2xl font-serif font-semibold text-[#0F172A] mb-2">
          Regulation Tracker
        </h2>
        <p className="text-[#0F172A]/60 max-w-lg mx-auto">
          Check current short-term rental regulations for any city. Get real-time status and requirements explained in simple terms.
        </p>
      </div>
      
      {/* Search Form - Supports cities, addresses, and property URLs */}
      <Card className="p-6" style={{ borderRadius: '1rem' }}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-[#0F172A]/70 mb-2">
              City, Address, or Property URL
            </label>
            <GooglePlacesAutocomplete
              onSelect={handlePlaceSelect}
              placeholder="Enter city, address, or paste Redfin/Zillow URL..."
              types={['(regions)', 'address']} // Cities, regions, and addresses
              countryRestriction="us"
              showSearchHistory={true}
              className="w-full"
              allowDirectSearch={true} // Allow searching with URLs or unrecognized locations
            />
            {selectedPlace && (
              <p className="text-xs text-[#0F172A]/50 mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {selectedPlace.name}
              </p>
            )}
            <p className="text-xs text-[#0F172A]/40 mt-2">
              Tip: Paste a Redfin or Zillow URL to automatically extract the location
            </p>
          </div>
          
          <div className="flex items-end">
            <Button
              onClick={handleSearch}
              disabled={isLoading || !selectedPlace}
              className="w-full md:w-auto px-8"
              style={{ backgroundColor: '#0F172A' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Check Regulations
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
      
      {/* Loading State */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: 'oklch(0.55 0.15 250)' }} />
            <p className="text-[#0F172A]/60">
              Researching current regulations...
            </p>
            <p className="text-sm text-[#0F172A]/40 mt-2">
              Searching official government sources
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Results */}
      <AnimatePresence>
        {result && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Status Card */}
            <Card className="p-6 overflow-hidden" style={{ borderRadius: '1rem' }}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-[#0F172A]">
                    {result.city}, {result.state}
                  </h3>
                  {result.governingJurisdiction && result.governingJurisdiction !== result.city && (
                    <p className="text-sm text-[#0F172A]/60 flex items-center gap-1 mt-1">
                      <Building2 className="w-3 h-3" />
                      Governed by: {result.governingJurisdiction}
                    </p>
                  )}
                  <p className="text-sm text-[#0F172A]/50 mt-1">
                    Last updated: {new Date(result.lastUpdated).toLocaleDateString()}
                  </p>
                </div>
                
                {/* Status Badge - Now with improved labels */}
                <div 
                  className="flex items-center gap-2 px-4 py-2 rounded-full"
                  style={{ 
                    backgroundColor: getStatusConfig(result.status).bgColor,
                    color: getStatusConfig(result.status).color
                  }}
                >
                  {(() => {
                    const StatusIcon = getStatusConfig(result.status).icon;
                    return <StatusIcon className="w-5 h-5" />;
                  })()}
                  <span className="font-semibold">{getStatusConfig(result.status).label}</span>
                </div>
              </div>
              
              {/* Yes/No Summary - Clear answer at the top */}
              <div 
                className="p-4 rounded-xl mb-4 border-2"
                style={{ 
                  backgroundColor: result.status === 'banned' ? 'oklch(0.55 0.2 25 / 0.05)' : 'oklch(0.55 0.15 145 / 0.05)',
                  borderColor: result.status === 'banned' ? 'oklch(0.55 0.2 25 / 0.2)' : 'oklch(0.55 0.15 145 / 0.2)'
                }}
              >
                <p className="text-lg font-medium" style={{ color: result.status === 'banned' ? 'oklch(0.45 0.15 25)' : 'oklch(0.35 0.12 145)' }}>
                  {result.yesNoSummary || getStatusConfig(result.status).description}
                </p>
              </div>
              
              {/* Toggle between simple and detailed */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={showSimplified ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowSimplified(true)}
                  style={showSimplified ? { backgroundColor: 'oklch(0.55 0.15 250)' } : {}}
                >
                  Simple Explanation
                </Button>
                <Button
                  variant={!showSimplified ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowSimplified(false)}
                  style={!showSimplified ? { backgroundColor: 'oklch(0.55 0.15 250)' } : {}}
                >
                  Full Details
                </Button>
              </div>
              
              {/* Summary */}
              <div 
                className="p-4 rounded-xl mb-4"
                style={{ backgroundColor: 'oklch(0.97 0 0)' }}
              >
                <p className="text-[#0F172A]/80 leading-relaxed whitespace-pre-line">
                  {showSimplified ? result.simplifiedSummary : result.summary}
                </p>
              </div>
              
              {/* Confidence indicator */}
              <div className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-[#0F172A]/40" />
                <span className="text-[#0F172A]/50">
                  Confidence: 
                  <span 
                    className="ml-1 font-medium"
                    style={{ 
                      color: result.confidence === 'high' ? 'oklch(0.55 0.15 145)' : 
                             result.confidence === 'medium' ? 'oklch(0.65 0.15 85)' : 
                             'oklch(0.55 0.2 25)'
                    }}
                  >
                    {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)}
                  </span>
                </span>
              </div>
            </Card>
            
            {/* Key Requirements */}
            {result.keyRequirements.length > 0 && (
              <Card className="p-6" style={{ borderRadius: '1rem' }}>
                <h4 className="font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" style={{ color: 'oklch(0.55 0.15 250)' }} />
                  Key Requirements
                </h4>
                <ul className="space-y-3">
                  {result.keyRequirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span 
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium text-white"
                        style={{ backgroundColor: 'oklch(0.55 0.15 250)' }}
                      >
                        {index + 1}
                      </span>
                      <span className="text-[#0F172A]/70">{req}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            
            {/* Quick Facts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Permit Required */}
              <Card className="p-4" style={{ borderRadius: '0.75rem' }}>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'oklch(0.55 0.15 250 / 0.1)' }}
                  >
                    <FileText className="w-5 h-5" style={{ color: 'oklch(0.55 0.15 250)' }} />
                  </div>
                  <div>
                    <p className="text-sm text-[#0F172A]/50">Permit Required</p>
                    <p className="font-semibold text-[#0F172A]">
                      {result.permitRequired ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </Card>
              
              {/* Primary Residence */}
              <Card className="p-4" style={{ borderRadius: '0.75rem' }}>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'oklch(0.55 0.15 145 / 0.1)' }}
                  >
                    <Home className="w-5 h-5" style={{ color: 'oklch(0.55 0.15 145)' }} />
                  </div>
                  <div>
                    <p className="text-sm text-[#0F172A]/50">Primary Residence Only</p>
                    <p className="font-semibold text-[#0F172A]">
                      {result.primaryResidenceOnly ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </Card>
              
              {/* Registration Fee */}
              <Card className="p-4" style={{ borderRadius: '0.75rem' }}>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'oklch(0.65 0.15 85 / 0.1)' }}
                  >
                    <DollarSign className="w-5 h-5" style={{ color: 'oklch(0.65 0.15 85)' }} />
                  </div>
                  <div>
                    <p className="text-sm text-[#0F172A]/50">Registration Fee</p>
                    <p className="font-semibold text-[#0F172A]">
                      {result.registrationFee || 'Unknown'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
            
            {/* Additional Details */}
            {(result.occupancyTax || result.maxNightsPerYear || result.zoningRestrictions) && (
              <Card className="p-4" style={{ borderRadius: '0.75rem' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {result.occupancyTax && (
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5" style={{ color: 'oklch(0.55 0.15 250)' }} />
                      <div>
                        <p className="text-sm text-[#0F172A]/50">Occupancy Tax</p>
                        <p className="font-medium text-[#0F172A]">{result.occupancyTax}</p>
                      </div>
                    </div>
                  )}
                  {result.maxNightsPerYear && (
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5" style={{ color: 'oklch(0.55 0.15 250)' }} />
                      <div>
                        <p className="text-sm text-[#0F172A]/50">Max Nights/Year</p>
                        <p className="font-medium text-[#0F172A]">{result.maxNightsPerYear}</p>
                      </div>
                    </div>
                  )}
                  {result.zoningRestrictions && result.zoningRestrictions !== 'Unknown' && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5" style={{ color: 'oklch(0.55 0.15 250)' }} />
                      <div>
                        <p className="text-sm text-[#0F172A]/50">Zoning</p>
                        <p className="font-medium text-[#0F172A]">{result.zoningRestrictions}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
            
            {/* Sources Section - ONLY show official government sources */}
            {(() => {
              // Filter to only show official government sources
              const officialSources = result.sources.filter(s => s.type === 'official');
              
              if (officialSources.length > 0) {
                return (
                  <Card className="p-6" style={{ borderRadius: '1rem', borderColor: 'oklch(0.55 0.15 145 / 0.3)', borderWidth: '2px' }}>
                    <h4 className="font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
                      <Building2 className="w-5 h-5" style={{ color: 'oklch(0.55 0.15 145)' }} />
                      Official Government Sources
                    </h4>
                    <p className="text-sm text-[#0F172A]/60 mb-4">
                      Verify this information directly with these official sources:
                    </p>
                    <div className="space-y-3">
                      {officialSources.map((source, index) => (
                        <a
                          key={index}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-[#0F172A]/5 group border border-[#0F172A]/10"
                        >
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: 'oklch(0.55 0.15 145 / 0.15)' }}
                          >
                            <Building2 className="w-5 h-5" style={{ color: 'oklch(0.45 0.15 145)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[#0F172A] group-hover:underline truncate">
                              {source.title}
                            </p>
                            <p className="text-xs text-green-600 font-medium">
                              ✓ Official Government Source
                            </p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-[#0F172A]/30 group-hover:text-[#0F172A]/60 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  </Card>
                );
              } else {
                // No official sources found - show a message
                return (
                  <Card className="p-6" style={{ borderRadius: '1rem', borderColor: 'oklch(0.65 0.15 85 / 0.3)', borderWidth: '2px' }}>
                    <h4 className="font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" style={{ color: 'oklch(0.55 0.15 85)' }} />
                      Verify with Official Sources
                    </h4>
                    <p className="text-sm text-[#0F172A]/70">
                      We recommend verifying this information directly with the official {result.city} city or county government website. 
                      Search for "{result.city} short term rental regulations" on your preferred search engine to find the official municipal code.
                    </p>
                  </Card>
                );
              }
            })()}
            
            {/* Warnings */}
            {result.warnings.length > 0 && (
              <Card 
                className="p-4" 
                style={{ 
                  borderRadius: '0.75rem',
                  backgroundColor: 'oklch(0.65 0.15 85 / 0.05)',
                  borderColor: 'oklch(0.65 0.15 85 / 0.2)'
                }}
              >
                <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'oklch(0.55 0.15 85)' }}>
                  <AlertTriangle className="w-5 h-5" />
                  Important Notes
                </h4>
                <ul className="space-y-2">
                  {result.warnings.map((warning, index) => (
                    <li key={index} className="text-sm text-[#0F172A]/70 flex items-start gap-2">
                      <span className="text-[#0F172A]/40">•</span>
                      {warning}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            
            {/* Disclaimer */}
            <p className="text-center text-sm text-[#0F172A]/40 px-4">
              This information is for educational purposes only. Always verify with official city/county sources before making investment decisions.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Empty State */}
      {!result && !isLoading && (
        <Card 
          className="p-12 text-center" 
          style={{ 
            borderRadius: '1rem',
            backgroundColor: 'oklch(0.98 0 0)',
            borderStyle: 'dashed'
          }}
        >
          <Shield className="w-16 h-16 mx-auto mb-4" style={{ color: 'oklch(0.80 0 0)' }} />
          <h3 className="text-lg font-semibold text-[#0F172A]/60 mb-2">
            Check Before You Invest
          </h3>
          <p className="text-[#0F172A]/40 max-w-md mx-auto">
            Enter a city and state above to see current short-term rental regulations. Understanding local rules is the first step to a successful rental business.
          </p>
        </Card>
      )}
    </div>
  );
}
