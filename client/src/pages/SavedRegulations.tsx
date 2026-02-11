/**
 * SavedRegulations.tsx
 * 
 * Dashboard page showing all saved regulation searches for easy comparison.
 * Allows users to view, compare, and manage their saved regulation searches.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bookmark, 
  Trash2, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Clock,
  FileText,
  Home,
  DollarSign,
  ExternalLink,
  Loader2,
  Search,
  ArrowLeft,
  Shield,
  Filter,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { Link } from 'wouter';
import { SharePageButton } from '@/components/SharePageButton';

interface RegulationSource {
  title: string;
  url: string;
  type: 'official' | 'news' | 'third_party';
}

interface SavedRegulation {
  id: number;
  city: string;
  state: string;
  status: string;
  permitRequired: boolean | null;
  primaryResidenceOnly: boolean | null;
  registrationFee: string | null;
  sources: RegulationSource[] | null;
  createdAt: Date | string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  allowed: { 
    label: 'Allowed', 
    color: 'oklch(0.35 0.12 145)', 
    bgColor: 'oklch(0.55 0.15 145 / 0.1)',
    icon: CheckCircle2 
  },
  allowed_with_permit: { 
    label: 'Allowed with Permit', 
    color: 'oklch(0.35 0.12 145)', 
    bgColor: 'oklch(0.55 0.15 145 / 0.1)',
    icon: FileText 
  },
  allowed_with_requirements: { 
    label: 'Allowed with Requirements', 
    color: 'oklch(0.45 0.12 85)', 
    bgColor: 'oklch(0.65 0.15 85 / 0.1)',
    icon: AlertTriangle 
  },
  restricted: { 
    label: 'Restricted', 
    color: 'oklch(0.45 0.12 85)', 
    bgColor: 'oklch(0.65 0.15 85 / 0.1)',
    icon: AlertTriangle 
  },
  banned: { 
    label: 'Not Allowed', 
    color: 'oklch(0.45 0.15 25)', 
    bgColor: 'oklch(0.55 0.2 25 / 0.1)',
    icon: XCircle 
  },
  paused: { 
    label: 'Paused', 
    color: 'oklch(0.45 0.1 250)', 
    bgColor: 'oklch(0.55 0.15 250 / 0.1)',
    icon: Clock 
  },
  unknown: { 
    label: 'Unknown', 
    color: 'oklch(0.5 0 0)', 
    bgColor: 'oklch(0.9 0 0)',
    icon: AlertTriangle 
  }
};

export default function SavedRegulations() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [sortBy, setSortBy] = useState<'date' | 'city' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Get saved regulations
  const savedRegulationsQuery = trpc.regulationTracker.getSavedRegulations.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  
  // Delete saved regulation mutation
  const deleteSavedMutation = trpc.regulationTracker.deleteSavedRegulation.useMutation({
    onSuccess: () => {
      toast.success('Regulation removed from saved');
      savedRegulationsQuery.refetch();
    },
    onError: (error) => {
      toast.error('Failed to remove: ' + error.message);
    }
  });
  
  const savedRegulations = (savedRegulationsQuery.data?.data || []) as SavedRegulation[];
  
  // Sort and filter regulations
  const filteredAndSortedRegulations = savedRegulations
    .filter(reg => filterStatus === 'all' || reg.status === filterStatus)
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'city') {
        comparison = a.city.localeCompare(b.city);
      } else if (sortBy === 'status') {
        comparison = a.status.localeCompare(b.status);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  
  const getStatusConfig = (status: string) => {
    return statusConfig[status] || statusConfig.unknown;
  };
  
  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0F172A]/40" />
      </div>
    );
  }
  
  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md" style={{ borderRadius: '1rem' }}>
          <Shield className="w-16 h-16 mx-auto mb-4" style={{ color: 'oklch(0.55 0.15 250)' }} />
          <h2 className="text-2xl font-semibold text-[#0F172A] mb-2">
            Sign In Required
          </h2>
          <p className="text-[#0F172A]/60 mb-6">
            Please sign in to view your saved regulation searches.
          </p>
          <Button 
            onClick={() => window.location.href = getLoginUrl()}
            style={{ backgroundColor: 'oklch(0.55 0.15 250)' }}
          >
            Sign In
          </Button>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDFBF7] to-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/?tab=regulations">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Regulation Tracker
            </Button>
          </Link>
          
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-serif font-semibold text-[#0F172A]">
                My Saved Regulations
              </h1>
              <p className="text-[#0F172A]/60 mt-1">
                {savedRegulations.length} saved location{savedRegulations.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            {/* Share and Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <SharePageButton
                pagePath="/saved-regulations"
                params={{}}
                shareDescription="my saved regulations"
                variant="outline"
                size="sm"
              />
              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#0F172A]/40" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F172A]/20"
                >
                  <option value="all">All Statuses</option>
                  <option value="allowed">Allowed</option>
                  <option value="allowed_with_permit">Allowed with Permit</option>
                  <option value="restricted">Restricted</option>
                  <option value="banned">Not Allowed</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              
              {/* Sort */}
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'city' | 'status')}
                  className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F172A]/20"
                >
                  <option value="date">Sort by Date</option>
                  <option value="city">Sort by City</option>
                  <option value="status">Sort by Status</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Loading State */}
        {savedRegulationsQuery.isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-[#0F172A]/40" />
            <p className="text-[#0F172A]/60">Loading saved regulations...</p>
          </div>
        )}
        
        {/* Empty State */}
        {!savedRegulationsQuery.isLoading && savedRegulations.length === 0 && (
          <Card 
            className="p-12 text-center" 
            style={{ 
              borderRadius: '1rem',
              backgroundColor: 'oklch(0.98 0 0)',
              borderStyle: 'dashed'
            }}
          >
            <Bookmark className="w-16 h-16 mx-auto mb-4" style={{ color: 'oklch(0.80 0 0)' }} />
            <h3 className="text-lg font-semibold text-[#0F172A]/60 mb-2">
              No Saved Regulations Yet
            </h3>
            <p className="text-[#0F172A]/40 max-w-md mx-auto mb-6">
              Search for regulations and click the "Save" button to add them to your favorites for easy comparison.
            </p>
            <Link href="/?tab=regulations">
              <Button style={{ backgroundColor: 'oklch(0.55 0.15 250)' }}>
                <Search className="w-4 h-4 mr-2" />
                Search Regulations
              </Button>
            </Link>
          </Card>
        )}
        
        {/* Regulations Grid */}
        {!savedRegulationsQuery.isLoading && filteredAndSortedRegulations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredAndSortedRegulations.map((regulation) => {
                const statusConf = getStatusConfig(regulation.status);
                const StatusIcon = statusConf.icon;
                
                return (
                  <motion.div
                    key={regulation.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="p-5 h-full flex flex-col" style={{ borderRadius: '1rem' }}>
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-5 h-5" style={{ color: 'oklch(0.55 0.15 250)' }} />
                          <div>
                            <h3 className="font-semibold text-[#0F172A]">
                              {regulation.city}
                            </h3>
                            <p className="text-sm text-[#0F172A]/50">{regulation.state}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSavedMutation.mutate({ id: regulation.id })}
                          className="h-8 w-8 p-0"
                          title="Remove from saved"
                        >
                          <Trash2 className="w-4 h-4 text-[#0F172A]/40 hover:text-red-500" />
                        </Button>
                      </div>
                      
                      {/* Status Badge */}
                      <div 
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 w-fit"
                        style={{ 
                          backgroundColor: statusConf.bgColor,
                          color: statusConf.color
                        }}
                      >
                        <StatusIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">{statusConf.label}</span>
                      </div>
                      
                      {/* Key Info */}
                      <div className="space-y-2 flex-1">
                        {regulation.permitRequired !== null && (
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="w-4 h-4 text-[#0F172A]/40" />
                            <span className="text-[#0F172A]/60">Permit Required:</span>
                            <span className="font-medium text-[#0F172A]">
                              {regulation.permitRequired ? 'Yes' : 'No'}
                            </span>
                          </div>
                        )}
                        {regulation.primaryResidenceOnly !== null && (
                          <div className="flex items-center gap-2 text-sm">
                            <Home className="w-4 h-4 text-[#0F172A]/40" />
                            <span className="text-[#0F172A]/60">Primary Residence Only:</span>
                            <span className="font-medium text-[#0F172A]">
                              {regulation.primaryResidenceOnly ? 'Yes' : 'No'}
                            </span>
                          </div>
                        )}
                        {regulation.registrationFee && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-[#0F172A]/40" />
                            <span className="text-[#0F172A]/60">Fee:</span>
                            <span className="font-medium text-[#0F172A]">
                              {regulation.registrationFee}
                            </span>
                          </div>
                        )}
                        
                        {/* Official Sources */}
                        {regulation.sources && regulation.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[#0F172A]/10">
                            <p className="text-xs text-[#0F172A]/50 mb-2 flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              Official Sources:
                            </p>
                            <div className="space-y-1">
                              {regulation.sources
                                .filter(s => s.type === 'official')
                                .slice(0, 2)
                                .map((source, idx) => (
                                  <a
                                    key={idx}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs hover:underline truncate"
                                    style={{ color: 'oklch(0.45 0.15 250)' }}
                                    title={source.title}
                                  >
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{source.title}</span>
                                  </a>
                                ))}
                              {regulation.sources.filter(s => s.type === 'official').length === 0 && (
                                <span className="text-xs text-[#0F172A]/40 italic">No official sources saved</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Footer */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#0F172A]/10">
                        <span className="text-xs text-[#0F172A]/40">
                          Saved {new Date(regulation.createdAt).toLocaleDateString()}
                        </span>
                        <Link href={`/?tab=regulations&city=${encodeURIComponent(regulation.city)}&state=${encodeURIComponent(regulation.state)}`}>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        
        {/* No results after filter */}
        {!savedRegulationsQuery.isLoading && savedRegulations.length > 0 && filteredAndSortedRegulations.length === 0 && (
          <Card 
            className="p-8 text-center" 
            style={{ borderRadius: '1rem', backgroundColor: 'oklch(0.98 0 0)' }}
          >
            <Filter className="w-12 h-12 mx-auto mb-4" style={{ color: 'oklch(0.80 0 0)' }} />
            <h3 className="text-lg font-semibold text-[#0F172A]/60 mb-2">
              No Results
            </h3>
            <p className="text-[#0F172A]/40 mb-4">
              No saved regulations match your current filter.
            </p>
            <Button variant="outline" onClick={() => setFilterStatus('all')}>
              Clear Filter
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
