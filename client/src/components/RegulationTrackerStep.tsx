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
 * - Save regulations to favorites
 * - Community comments section
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
  Building2,
  Bookmark,
  BookmarkCheck,
  MessageSquare,
  Send,
  Trash2,
  User
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { GooglePlacesAutocomplete } from '@/components/GooglePlacesAutocomplete';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';

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

interface Comment {
  id: number;
  content: string;
  createdAt: Date | string;
  userId: number;
  userName: string | null;
}

export function RegulationTrackerStep() {
  const { user, isAuthenticated } = useAuth();
  const [selectedPlace, setSelectedPlace] = useState<{ name: string; placeId: string; lat?: number; lng?: number } | null>(null);
  const [result, setResult] = useState<RegulationResult | null>(null);
  const [showSimplified, setShowSimplified] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  
  // Helper to process regulation result
  const processRegulationResult = (data: any) => {
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
  };

  // Standard mutation for city/state input
  const getRegulationsMutation = trpc.regulationTracker.getRegulations.useMutation({
    onSuccess: processRegulationResult,
    onError: (error) => {
      toast.error('Failed to look up regulations: ' + error.message);
    }
  });
  
  // Mutation for raw input (URLs, addresses, etc.)
  const getRegulationsFromInputMutation = trpc.regulationTracker.getRegulationsFromInput.useMutation({
    onSuccess: (response) => {
      if (response.success && response.data) {
        processRegulationResult(response.data);
      } else {
        toast.error(response.error || 'Failed to parse location');
      }
    },
    onError: (error) => {
      toast.error('Failed to look up regulations: ' + error.message);
    }
  });
  
  // Save regulation mutation
  const saveRegulationMutation = trpc.regulationTracker.saveRegulation.useMutation({
    onSuccess: (response) => {
      if (response.success) {
        toast.success('Regulation saved to favorites!');
        isRegulationSavedQuery.refetch();
      } else if (response.alreadySaved) {
        toast.info('Already saved to favorites');
      } else {
        toast.error(response.error || 'Failed to save');
      }
    },
    onError: (error) => {
      toast.error('Failed to save: ' + error.message);
    }
  });
  
  // Check if regulation is saved
  const isRegulationSavedQuery = trpc.regulationTracker.isRegulationSaved.useQuery(
    { city: result?.city || '', state: result?.state || '' },
    { enabled: !!result && isAuthenticated }
  );
  
  // Get comments for this regulation
  const commentsQuery = trpc.regulationTracker.getComments.useQuery(
    { city: result?.city || '', state: result?.state || '' },
    { enabled: !!result }
  );
  
  // Add comment mutation
  const addCommentMutation = trpc.regulationTracker.addComment.useMutation({
    onSuccess: () => {
      toast.success('Comment added!');
      setNewComment('');
      commentsQuery.refetch();
    },
    onError: (error) => {
      toast.error('Failed to add comment: ' + error.message);
    }
  });
  
  // Delete comment mutation
  const deleteCommentMutation = trpc.regulationTracker.deleteComment.useMutation({
    onSuccess: () => {
      toast.success('Comment deleted');
      commentsQuery.refetch();
    },
    onError: (error) => {
      toast.error('Failed to delete: ' + error.message);
    }
  });
  
  const handlePlaceSelect = (place: { name: string; placeId: string; lat?: number; lng?: number }) => {
    setSelectedPlace(place);
    // Clear previous results when selecting new place
    setResult(null);
  };
  
  // Check if input looks like a URL
  const isUrl = (input: string) => {
    return input.startsWith('http://') || input.startsWith('https://') || 
           input.includes('zillow.com') || input.includes('redfin.com');
  };
  
  const handleSearch = () => {
    if (!selectedPlace) {
      toast.error('Please select a city from the dropdown');
      return;
    }
    
    // Check if it's a direct search (URL or unrecognized location)
    if (selectedPlace.placeId === 'direct-search' || isUrl(selectedPlace.name)) {
      // Use the raw input endpoint for URLs and direct searches
      getRegulationsFromInputMutation.mutate({ input: selectedPlace.name });
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
  
  const handleSaveRegulation = () => {
    if (!result) return;
    if (!isAuthenticated) {
      toast.error('Please log in to save regulations');
      window.location.href = getLoginUrl();
      return;
    }
    
    saveRegulationMutation.mutate({
      city: result.city,
      state: result.state,
      status: result.status,
      permitRequired: result.permitRequired,
      primaryResidenceOnly: result.primaryResidenceOnly,
      registrationFee: result.registrationFee,
    });
  };
  
  const handleAddComment = () => {
    if (!result) return;
    if (!isAuthenticated) {
      toast.error('Please log in to comment');
      window.location.href = getLoginUrl();
      return;
    }
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    
    addCommentMutation.mutate({
      city: result.city,
      state: result.state,
      content: newComment.trim(),
    });
  };
  
  const isLoading = getRegulationsMutation.isPending || getRegulationsFromInputMutation.isPending;
  const isSaved = isRegulationSavedQuery.data?.saved || false;
  const comments = (commentsQuery.data?.data || []) as Comment[];
  
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
              types={['geocode']} // geocode includes both addresses AND regions (cities, neighborhoods, zip codes)
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
                
                <div className="flex items-center gap-2">
                  {/* Save Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveRegulation}
                    disabled={saveRegulationMutation.isPending || isSaved}
                    className="flex items-center gap-1"
                  >
                    {isSaved ? (
                      <>
                        <BookmarkCheck className="w-4 h-4" style={{ color: 'oklch(0.55 0.15 145)' }} />
                        <span className="hidden sm:inline">Saved</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-4 h-4" />
                        <span className="hidden sm:inline">Save</span>
                      </>
                    )}
                  </Button>
                  
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
              
              {/* Key Info Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-[#0F172A]/40" />
                    <span className="text-xs text-[#0F172A]/50">Permit Required</span>
                  </div>
                  <p className="font-semibold text-[#0F172A]">
                    {result.permitRequired ? 'Yes' : 'No'}
                  </p>
                </div>
                
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Home className="w-4 h-4 text-[#0F172A]/40" />
                    <span className="text-xs text-[#0F172A]/50">Primary Residence Only</span>
                  </div>
                  <p className="font-semibold text-[#0F172A]">
                    {result.primaryResidenceOnly ? 'Yes' : 'No'}
                  </p>
                </div>
                
                {result.registrationFee && (
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-[#0F172A]/40" />
                      <span className="text-xs text-[#0F172A]/50">Registration Fee</span>
                    </div>
                    <p className="font-semibold text-[#0F172A] text-sm">
                      {result.registrationFee}
                    </p>
                  </div>
                )}
                
                {result.occupancyTax && (
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-[#0F172A]/40" />
                      <span className="text-xs text-[#0F172A]/50">Occupancy Tax</span>
                    </div>
                    <p className="font-semibold text-[#0F172A] text-sm">
                      {result.occupancyTax}
                    </p>
                  </div>
                )}
                
                {result.maxNightsPerYear && (
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-[#0F172A]/40" />
                      <span className="text-xs text-[#0F172A]/50">Max Nights/Year</span>
                    </div>
                    <p className="font-semibold text-[#0F172A]">
                      {result.maxNightsPerYear}
                    </p>
                  </div>
                )}
                
                {result.zoningRestrictions && (
                  <div className="p-3 rounded-lg col-span-2" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-[#0F172A]/40" />
                      <span className="text-xs text-[#0F172A]/50">Zoning</span>
                    </div>
                    <p className="font-semibold text-[#0F172A] text-sm">
                      {result.zoningRestrictions}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Confidence Indicator */}
              <div className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-[#0F172A]/40" />
                <span className="text-[#0F172A]/50">
                  Confidence: <span className={`font-medium ${
                    result.confidence === 'high' ? 'text-green-600' :
                    result.confidence === 'medium' ? 'text-yellow-600' : 'text-red-600'
                  }`}>{result.confidence}</span>
                </span>
                {result.ordinanceNumber && (
                  <span className="text-[#0F172A]/40">
                    • Ordinance: {result.ordinanceNumber}
                  </span>
                )}
              </div>
            </Card>
            
            {/* Key Requirements */}
            {result.keyRequirements.length > 0 && (
              <Card className="p-6" style={{ borderRadius: '1rem' }}>
                <h4 className="font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" style={{ color: 'oklch(0.55 0.15 250)' }} />
                  Key Requirements ({result.keyRequirements.length})
                </h4>
                <ul className="space-y-3">
                  {result.keyRequirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span 
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium"
                        style={{ backgroundColor: 'oklch(0.55 0.15 250 / 0.1)', color: 'oklch(0.55 0.15 250)' }}
                      >
                        {index + 1}
                      </span>
                      <span className="text-[#0F172A]/80">{req}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            
            {/* Official Sources */}
            {(() => {
              const officialSources = result.sources.filter(s => s.type === 'official');
              if (officialSources.length > 0) {
                return (
                  <Card className="p-6" style={{ borderRadius: '1rem', borderColor: 'oklch(0.55 0.15 145 / 0.3)', borderWidth: '2px' }}>
                    <h4 className="font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                      <Building2 className="w-5 h-5" style={{ color: 'oklch(0.45 0.15 145)' }} />
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
            
            {/* Community Comments Section */}
            <Card className="p-6" style={{ borderRadius: '1rem' }}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-[#0F172A] flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" style={{ color: 'oklch(0.55 0.15 250)' }} />
                  Community Insights ({comments.length})
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowComments(!showComments)}
                >
                  {showComments ? 'Hide' : 'Show'} Comments
                </Button>
              </div>
              
              <AnimatePresence>
                {showComments && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    {/* Add Comment Form */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={isAuthenticated ? "Share your experience or tips..." : "Log in to comment"}
                        disabled={!isAuthenticated}
                        className="flex-1 px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F172A]/20"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                      />
                      <Button
                        onClick={handleAddComment}
                        disabled={addCommentMutation.isPending || !newComment.trim() || !isAuthenticated}
                        size="sm"
                      >
                        {addCommentMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    
                    {/* Comments List */}
                    {comments.length === 0 ? (
                      <p className="text-sm text-[#0F172A]/50 text-center py-4">
                        No comments yet. Be the first to share your insights!
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {comments.map((comment) => (
                          <div key={comment.id} className="p-3 rounded-lg" style={{ backgroundColor: 'oklch(0.97 0 0)' }}>
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 rounded-full bg-[#0F172A]/10 flex items-center justify-center">
                                  <User className="w-3 h-3 text-[#0F172A]/50" />
                                </div>
                                <span className="text-sm font-medium text-[#0F172A]">
                                  {comment.userName || 'Anonymous'}
                                </span>
                                <span className="text-xs text-[#0F172A]/40">
                                  {new Date(comment.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              {user?.id === comment.userId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteCommentMutation.mutate({ id: comment.id })}
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="w-3 h-3 text-[#0F172A]/40 hover:text-red-500" />
                                </Button>
                              )}
                            </div>
                            <p className="text-sm text-[#0F172A]/70">{comment.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
            
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
