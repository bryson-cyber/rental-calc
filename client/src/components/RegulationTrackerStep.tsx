/**
 * Regulation Tracker Step Component - Premium Glass Morphism Design
 * 
 * Apple-inspired design with glass effects, generous whitespace,
 * and the status verdict as the hero element.
 * 
 * Features:
 * - Google Places autocomplete for city selection
 * - Smart jurisdiction resolution for small towns
 * - Real-time regulation lookup via Claude AI with Google Search
 * - Simple explanation (3rd-grade level) and full details
 * - Links to official government sources
 * - Save regulations to favorites
 * - Community comments section
 * - Premium glass morphism UI with smooth animations
 */

import { useState, useEffect } from 'react';
import { useSearch } from 'wouter';
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
  User,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Sparkles,
  ChevronRight,
  Share2,
  Copy,
  Mail,
  Phone
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { GooglePlacesAutocomplete } from '@/components/GooglePlacesAutocomplete';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { Link } from 'wouter';
import { useProperty } from '@/contexts/PropertyContext';
import { UniversalShareButton } from '@/components/UniversalShareButton';

// Premium status configuration with gradients
const statusConfig = {
  allowed: {
    gradient: 'from-emerald-400 to-teal-500',
    glow: 'shadow-emerald-500/25',
    bgGlow: 'from-emerald-100/50',
    icon: CheckCircle2,
    label: 'Allowed',
    description: 'You can operate here'
  },
  'allowed_with_permit': {
    gradient: 'from-emerald-400 to-teal-500',
    glow: 'shadow-emerald-500/25',
    bgGlow: 'from-emerald-100/50',
    icon: FileCheck,
    label: 'Allowed',
    description: 'Permit required'
  },
  'allowed_with_requirements': {
    gradient: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/25',
    bgGlow: 'from-amber-100/50',
    icon: Scale,
    label: 'Allowed',
    description: 'With requirements'
  },
  restricted: {
    gradient: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/25',
    bgGlow: 'from-amber-100/50',
    icon: AlertTriangle,
    label: 'Restricted',
    description: 'Some limitations apply'
  },
  limited: {
    gradient: 'from-orange-400 to-red-400',
    glow: 'shadow-orange-500/25',
    bgGlow: 'from-orange-100/50',
    icon: AlertTriangle,
    label: 'Limited',
    description: 'Limited circumstances'
  },
  banned: {
    gradient: 'from-red-400 to-rose-500',
    glow: 'shadow-red-500/25',
    bgGlow: 'from-red-100/50',
    icon: Ban,
    label: 'Not Allowed',
    description: 'Prohibited in this area'
  },
  paused: {
    gradient: 'from-blue-400 to-indigo-500',
    glow: 'shadow-blue-500/25',
    bgGlow: 'from-blue-100/50',
    icon: PauseCircle,
    label: 'Paused',
    description: 'Under review'
  },
  pending: {
    gradient: 'from-yellow-400 to-amber-500',
    glow: 'shadow-yellow-500/25',
    bgGlow: 'from-yellow-100/50',
    icon: Clock,
    label: 'Pending',
    description: 'Being considered'
  },
  unknown: {
    gradient: 'from-gray-400 to-gray-500',
    glow: 'shadow-gray-500/25',
    bgGlow: 'from-gray-100/50',
    icon: HelpCircle,
    label: 'Unknown',
    description: 'Status unclear'
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
  upvotes: number;
  downvotes: number;
  voteScore: number;
  isFlagged: number;
}

export function RegulationTrackerStep() {
  const { user, isAuthenticated } = useAuth();
  const { myProperty } = useProperty();
  const searchString = useSearch();
  const [selectedPlace, setSelectedPlace] = useState<{ name: string; placeId: string; lat?: number; lng?: number } | null>(null);
  const [result, setResult] = useState<RegulationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'requirements' | 'sources'>('summary');
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [autoSearchTriggered, setAutoSearchTriggered] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [sharePhoneNumber, setSharePhoneNumber] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [autoNotificationSent, setAutoNotificationSent] = useState(false);
  
  // Helper to process regulation result and trigger auto-notification
  const processRegulationResult = (data: RegulationResult) => {
    let mappedStatus = data.status;
    if (data.status === 'restricted' && data.permitRequired && !data.primaryResidenceOnly) {
      mappedStatus = 'allowed_with_permit';
    } else if (data.status === 'restricted' && Array.isArray(data.keyRequirements) && data.keyRequirements.length > 0) {
      mappedStatus = 'allowed_with_requirements';
    }
    
    const processedResult = { ...data, status: mappedStatus } as RegulationResult;
    setResult(processedResult);
    setActiveTab('summary');
    toast.success(`Found regulations for ${data.city}, ${data.state}`);
    
    // Auto-send notification if user has contact info and auto-notifications enabled
    const hasContactInfo = myProperty?.userEmail || myProperty?.userPhone;
    const autoNotifyEnabled = myProperty?.enableAutoNotifications !== false; // Default to true
    
    if (hasContactInfo && autoNotifyEnabled && !autoNotificationSent) {
      console.log('[RegulationTracker] Auto-sending notification to:', {
        email: myProperty?.userEmail,
        phone: myProperty?.userPhone,
      });
      
      // Trigger auto-notification
      autoCreateAndNotifyMutation.mutate({
        city: data.city,
        state: data.state,
        status: mappedStatus,
        summary: data.summary,
        permitRequired: data.permitRequired || false,
        primaryResidenceOnly: data.primaryResidenceOnly || false,
        maxNightsPerYear: data.maxNightsPerYear,
        registrationFee: data.registrationFee,
        occupancyTax: data.occupancyTax,
        confidence: data.confidence,
        fullRegulationData: data,
        keyRequirements: data.keyRequirements,
        sources: data.sources,
        userEmail: myProperty?.userEmail,
        userPhone: myProperty?.userPhone,
      });
    }
  };

  // Auto-search from URL parameters
  useEffect(() => {
    if (autoSearchTriggered) return;
    
    const params = new URLSearchParams(searchString);
    const city = params.get('city');
    const state = params.get('state');
    
    if (city && state) {
      setAutoSearchTriggered(true);
      setSelectedPlace({
        name: `${city}, ${state}, USA`,
        placeId: 'url-param'
      });
      setTimeout(() => {
        getRegulationsMutation.mutate({ city, state });
      }, 100);
    }
  }, [searchString, autoSearchTriggered]);

  // Mutations
  const getRegulationsMutation = trpc.regulationTracker.getRegulations.useMutation({
    onSuccess: processRegulationResult,
    onError: (error) => {
      toast.error('Failed to look up regulations: ' + error.message);
    }
  });
  
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
  
  // Comments mutations
  const addCommentMutation = trpc.regulationTracker.addComment.useMutation({
    onSuccess: (response) => {
      if (response.success) {
        toast.success('Comment added!');
        setNewComment('');
        commentsQuery.refetch();
      }
    },
    onError: (error) => {
      toast.error('Failed to add comment: ' + error.message);
    }
  });
  
  const deleteCommentMutation = trpc.regulationTracker.deleteComment.useMutation({
    onSuccess: () => {
      toast.success('Comment deleted');
      commentsQuery.refetch();
    }
  });
  
  const voteCommentMutation = trpc.regulationTracker.voteComment.useMutation({
    onSuccess: () => {
      commentsQuery.refetch();
      userVotesQuery.refetch();
    }
  });
  
  const flagCommentMutation = trpc.regulationTracker.flagComment.useMutation({
    onSuccess: () => {
      toast.success('Comment reported');
    }
  });
  
  // Share mutations
  const createShareableReportMutation = trpc.regulationTracker.createShareableReport.useMutation({
    onSuccess: (response) => {
      if (response.success) {
        setShareCode(response.shareCode);
        toast.success('Shareable link created!');
      } else {
        toast.error('Failed to create shareable link');
      }
    }
  });
  
  const sendReportSMSMutation = trpc.regulationTracker.sendReportSMS.useMutation({
    onSuccess: (response) => {
      if (response.success) {
        toast.success('SMS sent successfully!');
        setSharePhoneNumber('');
      } else {
        toast.error(response.error || 'Failed to send SMS');
      }
    }
  });
  
  const sendReportEmailMutation = trpc.regulationTracker.sendReportEmail.useMutation({
    onSuccess: (response) => {
      if (response.success) {
        toast.success('Email sent successfully!');
        setShareEmail('');
      } else {
        toast.error(response.error || 'Failed to send email');
      }
    }
  });
  
  // Auto-create and notify mutation
  const autoCreateAndNotifyMutation = trpc.regulationTracker.autoCreateAndNotify.useMutation({
    onSuccess: (response) => {
      if (response.success) {
        setShareCode(response.shareCode);
        setAutoNotificationSent(true);
        
        // Show appropriate toast based on what was sent
        const sentMethods: string[] = [];
        if (response.notificationsSent?.sms) sentMethods.push('SMS');
        if (response.notificationsSent?.email) sentMethods.push('email');
        
        if (sentMethods.length > 0) {
          toast.success(`Report sent via ${sentMethods.join(' and ')}!`, {
            description: 'Check your inbox for the shareable link.',
            duration: 5000,
          });
        }
      }
    },
    onError: (error) => {
      console.error('[AutoNotify] Error:', error);
      // Silently fail - don't disrupt the user experience
    }
  });
  
  // Queries
  const isRegulationSavedQuery = trpc.regulationTracker.isRegulationSaved.useQuery(
    { city: result?.city || '', state: result?.state || '' },
    { enabled: !!result && isAuthenticated, staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false }
  );
  
  const commentsQuery = trpc.regulationTracker.getComments.useQuery(
    { city: result?.city || '', state: result?.state || '' },
    { enabled: !!result, staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false }
  );
  
  const commentIds = (commentsQuery.data?.data || []).map((c: Comment) => c.id);
  const userVotesQuery = trpc.regulationTracker.getUserVotes.useQuery(
    { commentIds },
    { enabled: commentIds.length > 0 && isAuthenticated, staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false }
  );
  
  const handlePlaceSelect = (place: { name: string; placeId: string; lat?: number; lng?: number }) => {
    setSelectedPlace(place);
  };
  
  const handleSearch = () => {
    if (!selectedPlace) return;
    
    // Reset previous results and tab state for clean new search
    setResult(null);
    setActiveTab('summary');
    setShowSharePanel(false);
    setShareCode(null);
    setShowComments(false);
    setAutoNotificationSent(false);
    
    const input = selectedPlace.name;
    
    // Check if it's a URL
    if (input.includes('redfin.com') || input.includes('zillow.com') || input.includes('realtor.com')) {
      getRegulationsFromInputMutation.mutate({ input });
      return;
    }
    
    // Parse city/state from the place name
    const parts = input.split(',').map(p => p.trim());
    let city = parts[0];
    let state = parts.length > 1 ? parts[1] : '';
    
    // Handle zip codes
    if (/^\d{5}$/.test(city)) {
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
      sources: (Array.isArray(result.sources) ? result.sources : []).map(s => ({
        title: s.title,
        url: s.url,
        type: s.type,
      })),
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
  
  const handleCreateShareLink = () => {
    if (!result) return;
    createShareableReportMutation.mutate({
      city: result.city,
      state: result.state,
      status: result.status,
      summary: result.summary,
      permitRequired: result.permitRequired,
      primaryResidenceOnly: result.primaryResidenceOnly,
      maxNightsPerYear: result.maxNightsPerYear,
      registrationFee: result.registrationFee || undefined,
      occupancyTax: result.occupancyTax || undefined,
      confidence: result.confidence,
      fullRegulationData: result,
      keyRequirements: result.keyRequirements,
      sources: result.sources,
    });
  };
  
  const handleCopyShareLink = async () => {
    if (!shareCode) return;
    const url = `${window.location.origin}/regulation/${shareCode}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };
  
  const handleSendSMS = () => {
    if (!shareCode || !sharePhoneNumber) return;
    sendReportSMSMutation.mutate({
      shareCode,
      phoneNumber: sharePhoneNumber,
    });
  };
  
  const handleSendEmail = () => {
    if (!shareCode || !shareEmail) return;
    sendReportEmailMutation.mutate({
      shareCode,
      email: shareEmail,
    });
  };
  
  const isLoading = getRegulationsMutation.isPending || getRegulationsFromInputMutation.isPending;
  const isSaved = isRegulationSavedQuery.data?.saved || false;
  const comments = (commentsQuery.data?.data || []) as Comment[];
  const userVotes = (userVotesQuery.data?.votes || {}) as Record<number, 'up' | 'down'>;
  
  const getStatusConfig = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.restricted;
  };
  
  const status = result ? getStatusConfig(result.status) : null;
  const StatusIcon = status?.icon || Shield;
  
  return (
    <div className="relative min-h-[600px]">
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-amber-100/30 to-transparent rounded-full blur-3xl -translate-y-1/3 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-100/30 to-transparent rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>
      </div>
      
      <div className="relative z-10 space-y-8">
        {/* Premium Header */}
        <div className="text-center pt-8">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl mb-6"
          >
            <Shield className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
            Regulation Tracker
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto font-light">
            Check short-term rental regulations for any city. Get instant answers explained simply.
          </p>
          {isAuthenticated && (
            <Link href="/saved-regulations">
              <Button variant="outline" size="sm" className="mt-6 rounded-full px-6">
                <Bookmark className="w-4 h-4 mr-2" />
                View Saved Regulations
              </Button>
            </Link>
          )}
        </div>
        
        {/* Premium Search Card */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 shadow-xl p-6 md:p-8 relative z-20"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative z-30">
              <label className="block text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">
                City, Address, or Property URL
              </label>
              <GooglePlacesAutocomplete
                onSelect={handlePlaceSelect}
                placeholder="Enter city, address, or paste Redfin/Zillow URL..."
                types={['geocode']}
                countryRestriction="us"
                showSearchHistory={true}
                className="w-full"
                allowDirectSearch={true}
              />
              {selectedPlace && (
                <p className="text-sm text-gray-400 mt-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {selectedPlace.name}
                </p>
              )}
            </div>
            
            <div className="flex items-end">
              <Button
                onClick={handleSearch}
                disabled={isLoading || !selectedPlace}
                className="w-full md:w-auto px-8 py-6 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-medium shadow-lg transition-all hover:shadow-xl"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Check Regulations
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
        
        {/* Loading State */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-16"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 mb-6">
                <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
              </div>
              <p className="text-xl text-gray-600 font-light">
                Researching regulations...
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Searching official government sources
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Results - Premium Glass Design */}
        <AnimatePresence>
          {result && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4 }}
              className="space-y-6 relative z-10"
            >
              {/* Status Hero Card */}
              <div className={`relative bg-gradient-to-br ${status?.bgGlow} to-white/50 backdrop-blur-xl rounded-3xl border border-white/50 shadow-xl`}>
                {/* Decorative gradient orb - clipped separately to avoid clipping tab content */}
                <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                  <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${status?.gradient} opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2`}></div>
                </div>
                
                <div className="relative p-8 md:p-10">
                  {/* Header with Status Badge */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                    <div>
                      <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                        <Building2 className="w-4 h-4" />
                        <span>{result.governingJurisdiction || result.city}</span>
                        <UniversalShareButton
                          reportType="regulation"
                          reportData={result}
                          city={result.city}
                          state={result.state}
                          title={`Regulation Check - ${result.city}, ${result.state}`}
                          summary={`${status?.label}: ${result.yesNoSummary || status?.description}`}
                          verdict={status?.label}
                          size="sm"
                          variant="ghost"
                          className="ml-2"
                        />
                      </div>
                      <h3 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
                        {result.city}, {result.state}
                      </h3>
                      <p className="text-sm text-gray-400 mt-2">
                        Updated {new Date(result.lastUpdated).toLocaleDateString()}
                      </p>
                    </div>
                    
                    {/* Floating Status Badge */}
                    <div className={`bg-gradient-to-r ${status?.gradient} p-1 rounded-2xl shadow-lg ${status?.glow}`}>
                      <div className="bg-white/95 backdrop-blur-sm rounded-xl px-6 py-4 flex items-center gap-3">
                        <StatusIcon className="w-7 h-7 text-gray-700" />
                        <div>
                          <p className="font-bold text-gray-900 text-lg">{status?.label}</p>
                          <p className="text-sm text-gray-500">{status?.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Yes/No Summary Banner */}
                  <div className="bg-white/80 backdrop-blur rounded-2xl p-6 mb-8 border border-gray-100">
                    <p className="text-xl text-gray-700 leading-relaxed font-medium">
                      {result.yesNoSummary || status?.description}
                    </p>
                  </div>
                  
                  {/* Tab Navigation */}
                  <div className="flex gap-2 mb-6 p-1.5 bg-gray-100/80 rounded-2xl w-fit">
                    {(['summary', 'requirements', 'sources'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${
                          activeTab === tab 
                            ? 'bg-white shadow-sm text-gray-900' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {tab === 'summary' && 'Summary'}
                        {tab === 'requirements' && `Requirements (${Array.isArray(result.keyRequirements) ? result.keyRequirements.length : 0})`}
                        {tab === 'sources' && `Sources (${Array.isArray(result.sources) ? result.sources.length : 0})`}
                      </button>
                    ))}
                  </div>
                  
                  {/* Tab Content */}
                  <div className="min-h-[300px]">
                    <AnimatePresence mode="wait">
                      {activeTab === 'summary' && (
                        <motion.div
                          key="summary"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ duration: 0.2 }}
                        >
                          {/* Quick Answer */}
                          <div className="flex items-start gap-4 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center flex-shrink-0 shadow-sm">
                              <Sparkles className="w-7 h-7 text-amber-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2 text-lg">Quick Answer</h4>
                              <p className="text-lg text-gray-600 leading-relaxed">
                                {result.simplifiedSummary}
                              </p>
                            </div>
                          </div>
                          
                          {/* Stats Grid - Fixed height cards with proper text handling */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                            <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm h-[100px] sm:h-[110px] flex flex-col justify-between">
                              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                              <div>
                                <p className="text-lg sm:text-xl font-bold text-gray-900">{result.permitRequired ? 'Yes' : 'No'}</p>
                                <p className="text-xs sm:text-sm text-gray-500">Permit Required</p>
                              </div>
                            </div>
                            
                            <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm h-[100px] sm:h-[110px] flex flex-col justify-between">
                              <Home className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                              <div>
                                <p className="text-lg sm:text-xl font-bold text-gray-900">{result.primaryResidenceOnly ? 'Yes' : 'No'}</p>
                                <p className="text-xs sm:text-sm text-gray-500">Primary Only</p>
                              </div>
                            </div>
                            
                            {result.registrationFee && (
                              <div 
                                className="bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm h-[100px] sm:h-[110px] flex flex-col justify-between cursor-help" 
                                title={result.registrationFee}
                              >
                                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                <div className="overflow-hidden">
                                  <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                                    {(() => {
                                      const fee = result.registrationFee;
                                      // If it says "Not specified" or similar, show "N/A"
                                      if (fee.toLowerCase().includes('not specified') || fee.toLowerCase().includes('not available')) {
                                        return 'N/A';
                                      }
                                      // Extract just the dollar amounts (e.g., "$226-$1,170")
                                      const dollarMatch = fee.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?/);
                                      if (dollarMatch) {
                                        return dollarMatch[0].replace(/\s+/g, '');
                                      }
                                      // If no dollar match, show truncated version
                                      return fee.length > 10 ? fee.substring(0, 10) + '…' : fee;
                                    })()}
                                  </p>
                                  <p className="text-xs sm:text-sm text-gray-500">Registration</p>
                                </div>
                              </div>
                            )}
                            
                            {result.occupancyTax && (
                              <div 
                                className="bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm h-[100px] sm:h-[110px] flex flex-col justify-between cursor-help"
                                title={result.occupancyTax}
                              >
                                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                <div className="overflow-hidden">
                                  <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                                    {(() => {
                                      const tax = result.occupancyTax;
                                      // Extract percentage (e.g., "10.5%")
                                      const percentMatch = tax.match(/[\d.]+%/);
                                      if (percentMatch) {
                                        return percentMatch[0];
                                      }
                                      // If it says "Not specified" or similar, show "N/A"
                                      if (tax.toLowerCase().includes('not specified') || tax.toLowerCase().includes('not available')) {
                                        return 'N/A';
                                      }
                                      // Otherwise truncate
                                      return tax.length > 10 ? tax.substring(0, 10) + '…' : tax;
                                    })()}
                                  </p>
                                  <p className="text-xs sm:text-sm text-gray-500">Tax Rate</p>
                                </div>
                              </div>
                            )}
                            
                            {result.maxNightsPerYear && (
                              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm h-[100px] sm:h-[110px] flex flex-col justify-between">
                                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                <div>
                                  <p className="text-lg sm:text-xl font-bold text-gray-900">{result.maxNightsPerYear}</p>
                                  <p className="text-xs sm:text-sm text-gray-500">Max Nights/Year</p>
                                </div>
                              </div>
                            )}
                            
                            <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm h-[100px] sm:h-[110px] flex flex-col justify-between">
                              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                              <div>
                                <p className="text-lg sm:text-xl font-bold text-gray-900 capitalize">{result.confidence}</p>
                                <p className="text-xs sm:text-sm text-gray-500">Confidence</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Zoning Info */}
                          {result.zoningRestrictions && (
                            <div className="mt-6 bg-gradient-to-br from-blue-50 to-white rounded-2xl p-5 border border-blue-100">
                              <div className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-blue-500 mt-0.5" />
                                <div>
                                  <p className="font-medium text-gray-900 mb-1">Zoning Restrictions</p>
                                  <p className="text-gray-600">{result.zoningRestrictions}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Full Details Toggle */}
                          <div className="mt-6 p-5 bg-gray-50 rounded-2xl">
                            <h4 className="font-medium text-gray-900 mb-3">Full Details</h4>
                            <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                              {result.summary}
                            </p>
                          </div>
                        </motion.div>
                      )}
                      
                      {activeTab === 'requirements' && (
                        <motion.div
                          key="requirements"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-3"
                        >
                          {(!Array.isArray(result.keyRequirements) || result.keyRequirements.length === 0) ? (
                            <div className="text-center py-12">
                              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                              <p className="text-lg text-gray-600">No specific requirements found</p>
                              <p className="text-sm text-gray-400 mt-1">This area may have minimal regulations</p>
                            </div>
                          ) : (
                            (Array.isArray(result.keyRequirements) ? result.keyRequirements : []).map((req, i) => (
                              <motion.div 
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-start gap-4 p-5 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors"
                              >
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${status?.gradient} text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm`}>
                                  {i + 1}
                                </div>
                                <p className="text-gray-700 pt-2 leading-relaxed">{req}</p>
                              </motion.div>
                            ))
                          )}
                        </motion.div>
                      )}
                      
                      {activeTab === 'sources' && (
                        <motion.div
                          key="sources"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-3"
                        >
                          {(!Array.isArray(result.sources) || result.sources.length === 0) ? (
                            <div className="text-center py-12">
                              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                              <p className="text-lg text-gray-600">No official sources found</p>
                              <p className="text-sm text-gray-400 mt-1">
                                Search for "{result.city} short term rental regulations" to find official sources
                              </p>
                            </div>
                          ) : (
                            (Array.isArray(result.sources) ? result.sources : []).map((source, i) => (
                              <motion.a 
                                key={i}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all group"
                              >
                                <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                    source.type === 'official' 
                                      ? 'bg-emerald-100' 
                                      : source.type === 'news' 
                                        ? 'bg-blue-100' 
                                        : 'bg-gray-100'
                                  }`}>
                                    {source.type === 'official' ? (
                                      <Building2 className="w-6 h-6 text-emerald-600" />
                                    ) : (
                                      <FileText className="w-6 h-6 text-gray-600" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 group-hover:text-gray-700">{source.title}</p>
                                    <p className={`text-sm capitalize ${
                                      source.type === 'official' ? 'text-emerald-600 font-medium' : 'text-gray-500'
                                    }`}>
                                      {source.type === 'official' ? 'Official Government Source' : `${source.type} source`}
                                    </p>
                                  </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                              </motion.a>
                            ))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Action Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 mt-8 border-t border-gray-100">
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${
                        result.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                        result.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {result.confidence} confidence
                      </span>
                      {result.ordinanceNumber && (
                        <span className="text-gray-400">Ordinance: {result.ordinanceNumber}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowComments(!showComments)}
                        className="rounded-xl"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Comments ({comments.length})
                      </Button>
                      
                      <Button
                        onClick={handleSaveRegulation}
                        disabled={saveRegulationMutation.isPending || isSaved}
                        className={`rounded-xl px-6 ${isSaved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-900 hover:bg-gray-800'}`}
                      >
                        {isSaved ? (
                          <>
                            <BookmarkCheck className="w-4 h-4 mr-2" />
                            Saved
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-4 h-4 mr-2" />
                            Save Regulation
                          </>
                        )}
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (!shareCode) {
                            handleCreateShareLink();
                          }
                          setShowSharePanel(!showSharePanel);
                        }}
                        disabled={createShareableReportMutation.isPending}
                        className="rounded-xl px-6 border-amber-200 text-amber-700 hover:bg-amber-50"
                      >
                        {createShareableReportMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Share2 className="w-4 h-4 mr-2" />
                            Share Report
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Share Panel */}
                  <AnimatePresence>
                    {showSharePanel && shareCode && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 p-6 bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-100"
                      >
                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Share2 className="w-5 h-5 text-amber-600" />
                          Share This Report
                        </h4>
                        
                        {/* Copy Link */}
                        <div className="mb-6">
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Shareable Link</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={`${window.location.origin}/regulation/${shareCode}`}
                              className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600"
                            />
                            <Button
                              onClick={handleCopyShareLink}
                              variant="outline"
                              className="rounded-xl px-4"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Send via SMS */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                              <Phone className="w-4 h-4 text-gray-400" />
                              Send via SMS
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="tel"
                                placeholder="Phone number"
                                value={sharePhoneNumber}
                                onChange={(e) => setSharePhoneNumber(e.target.value)}
                                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                              />
                              <Button
                                onClick={handleSendSMS}
                                disabled={sendReportSMSMutation.isPending || !sharePhoneNumber}
                                className="rounded-xl bg-amber-600 hover:bg-amber-700"
                              >
                                {sendReportSMSMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Send'
                                )}
                              </Button>
                            </div>
                          </div>
                          
                          {/* Send via Email */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                              <Mail className="w-4 h-4 text-gray-400" />
                              Send via Email
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="email"
                                placeholder="Email address"
                                value={shareEmail}
                                onChange={(e) => setShareEmail(e.target.value)}
                                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                              />
                              <Button
                                onClick={handleSendEmail}
                                disabled={sendReportEmailMutation.isPending || !shareEmail}
                                className="rounded-xl bg-amber-600 hover:bg-amber-700"
                              >
                                {sendReportEmailMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Send'
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              
              {/* Warnings */}
              {Array.isArray(result.warnings) && result.warnings.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-amber-50 to-white rounded-2xl p-6 border border-amber-100"
                >
                  <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Important Notes
                  </h4>
                  <ul className="space-y-2">
                    {(Array.isArray(result.warnings) ? result.warnings : []).map((warning, index) => (
                      <li key={index} className="text-sm text-amber-700 flex items-start gap-2">
                        <span className="text-amber-400 mt-1">•</span>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
              
              {/* Community Comments Section */}
              <AnimatePresence>
                {showComments && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 shadow-xl p-6 md:p-8"
                  >
                    <h4 className="font-semibold text-gray-900 mb-6 flex items-center gap-2 text-lg">
                      <MessageSquare className="w-5 h-5 text-gray-400" />
                      Community Insights
                    </h4>
                    
                    {/* Add Comment Form */}
                    <div className="flex gap-3 mb-6">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={isAuthenticated ? "Share your experience or tips..." : "Log in to comment"}
                        disabled={!isAuthenticated}
                        className="flex-1 px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                      />
                      <Button
                        onClick={handleAddComment}
                        disabled={addCommentMutation.isPending || !newComment.trim() || !isAuthenticated}
                        className="rounded-xl px-6 bg-gray-900 hover:bg-gray-800"
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
                      <div className="text-center py-8">
                        <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No comments yet. Be the first to share your insights!</p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {comments.map((comment) => (
                          <div key={comment.id} className="p-4 bg-gray-50 rounded-xl">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                  <User className="w-4 h-4 text-gray-500" />
                                </div>
                                <div>
                                  <span className="font-medium text-gray-900">
                                    {comment.userName || 'Anonymous'}
                                  </span>
                                  <span className="text-xs text-gray-400 ml-2">
                                    {new Date(comment.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {user?.id === comment.userId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteCommentMutation.mutate({ id: comment.id })}
                                    className="h-8 w-8 p-0 rounded-lg"
                                  >
                                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                                  </Button>
                                )}
                                {isAuthenticated && user?.id !== comment.userId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => flagCommentMutation.mutate({ commentId: comment.id })}
                                    className="h-8 w-8 p-0 rounded-lg"
                                    title="Report this comment"
                                  >
                                    <Flag className="w-4 h-4 text-gray-400 hover:text-orange-500" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-700 ml-11">{comment.content}</p>
                            
                            {/* Voting */}
                            <div className="flex items-center gap-4 mt-3 ml-11">
                              <button
                                onClick={() => voteCommentMutation.mutate({ commentId: comment.id, voteType: 'up' })}
                                disabled={!isAuthenticated}
                                className={`flex items-center gap-1.5 text-sm transition-colors ${
                                  userVotes[comment.id] === 'up' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                <ThumbsUp className="w-4 h-4" />
                                {comment.upvotes}
                              </button>
                              <button
                                onClick={() => voteCommentMutation.mutate({ commentId: comment.id, voteType: 'down' })}
                                disabled={!isAuthenticated}
                                className={`flex items-center gap-1.5 text-sm transition-colors ${
                                  userVotes[comment.id] === 'down' ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                <ThumbsDown className="w-4 h-4" />
                                {comment.downvotes}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
