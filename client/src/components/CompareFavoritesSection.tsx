/**
 * Compare Favorites Section
 * 
 * Displays user's saved favorites from the Map view and allows side-by-side comparison
 * of their STR revenue potential.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { InfoTooltip } from '@/components/InfoTooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Heart,
  Trophy,
  Trash2,
  MapPin,
  BedDouble,
  Bath,
  DollarSign,
  TrendingUp,
  ExternalLink,
  Loader2,
  RefreshCw,
  Plus,
  ArrowRight,
  Star,
  Percent,
  Calendar
} from 'lucide-react';
import { Link } from 'wouter';

// Generate or retrieve session ID for anonymous users
function getSessionId(): string {
  let sessionId = localStorage.getItem("rental_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("rental_session_id", sessionId);
  }
  return sessionId;
}

// Also check the other sessionId key used by MapFirstLayoutV2
function getMapSessionId(): string | undefined {
  return localStorage.getItem('sessionId') || undefined;
}

interface FavoriteListing {
  id: number;
  listingId: string;
  title: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  revenue: number | null;
  occupancy: string | null;
  adr: number | null;
  latitude: string | null;
  longitude: string | null;
  airbnbUrl: string | null;
  thumbnailUrl: string | null;
  searchAddress: string | null;
  createdAt: Date;
}

interface ComparisonResult {
  listingId: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  revenue: number;
  occupancy: number;
  adr: number;
  monthlyProfit: number;
  annualProfit: number;
  profitRatio: number;
  monthlyRent: number;
  thumbnailUrl?: string;
  airbnbUrl?: string;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface CompareFavoritesSectionProps {
  onNavigateToMap?: () => void;
}

export function CompareFavoritesSection({ onNavigateToMap }: CompareFavoritesSectionProps) {
  const { user, isAuthenticated } = useAuth();
  const [rentInputs, setRentInputs] = useState<Record<string, number>>({});
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set());
  
  // Get sessionId for anonymous users
  const sessionId = useMemo(() => {
    if (isAuthenticated) return undefined;
    // Try both sessionId keys
    return getMapSessionId() || getSessionId();
  }, [isAuthenticated]);
  
  // Fetch favorites from database
  const favoritesQuery = trpc.favoriteListings.list.useQuery(
    { sessionId },
    { 
      staleTime: 1000 * 60 * 5, // Cache for 5 minutes
      refetchOnWindowFocus: true 
    }
  );
  
  const removeFavoriteMutation = trpc.favoriteListings.remove.useMutation({
    onSuccess: () => {
      favoritesQuery.refetch();
      toast.success('Removed from favorites');
    },
    onError: () => {
      toast.error('Failed to remove favorite');
    }
  });
  
  const favorites = favoritesQuery.data?.data || [];
  
  // Initialize rent inputs when favorites load
  useEffect(() => {
    if (favorites.length > 0) {
      const initialRents: Record<string, number> = {};
      favorites.forEach(fav => {
        if (!rentInputs[fav.listingId]) {
          // Estimate rent as ~40% of monthly revenue (rough arbitrage assumption)
          const monthlyRevenue = (fav.revenue || 0) / 12;
          initialRents[fav.listingId] = Math.round(monthlyRevenue * 0.4 / 100) * 100; // Round to nearest 100
        }
      });
      if (Object.keys(initialRents).length > 0) {
        setRentInputs(prev => ({ ...prev, ...initialRents }));
      }
    }
  }, [favorites]);
  
  // Toggle selection for comparison
  const toggleSelection = (listingId: string) => {
    setSelectedForComparison(prev => {
      const newSet = new Set(prev);
      if (newSet.has(listingId)) {
        newSet.delete(listingId);
      } else {
        newSet.add(listingId);
      }
      return newSet;
    });
  };
  
  // Select all favorites
  const selectAll = () => {
    setSelectedForComparison(new Set(favorites.map(f => f.listingId)));
  };
  
  // Clear selection
  const clearSelection = () => {
    setSelectedForComparison(new Set());
  };
  
  // Run comparison
  const runComparison = useCallback(() => {
    const selectedFavorites = favorites.filter(f => selectedForComparison.has(f.listingId));
    
    if (selectedFavorites.length < 2) {
      toast.error('Please select at least 2 properties to compare');
      return;
    }
    
    setIsComparing(true);
    
    // Calculate comparison results
    const results: ComparisonResult[] = selectedFavorites.map(fav => {
      const monthlyRent = rentInputs[fav.listingId] || 0;
      const annualRevenue = fav.revenue || 0;
      const monthlyRevenue = annualRevenue / 12;
      const expenseRate = 0.20; // 20% for expenses
      const monthlyProfit = monthlyRevenue * (1 - expenseRate) - monthlyRent;
      const annualProfit = monthlyProfit * 12;
      const profitRatio = monthlyRent > 0 ? monthlyRevenue / monthlyRent : 0;
      
      return {
        listingId: fav.listingId,
        title: fav.title || 'Untitled Property',
        bedrooms: fav.bedrooms || 0,
        bathrooms: parseFloat(fav.bathrooms || '0'),
        revenue: annualRevenue,
        occupancy: parseFloat(fav.occupancy || '0') * 100,
        adr: fav.adr || 0,
        monthlyProfit,
        annualProfit,
        profitRatio,
        monthlyRent,
        thumbnailUrl: fav.thumbnailUrl || undefined,
        airbnbUrl: fav.airbnbUrl || undefined,
      };
    });
    
    // Sort by monthly profit (highest first)
    results.sort((a, b) => b.monthlyProfit - a.monthlyProfit);
    
    setComparisonResults(results);
    setIsComparing(false);
    
    toast.success(`Compared ${results.length} properties!`);
  }, [favorites, selectedForComparison, rentInputs]);
  
  // Remove a favorite
  const handleRemove = (listingId: string) => {
    removeFavoriteMutation.mutate({ listingId, sessionId });
    setSelectedForComparison(prev => {
      const newSet = new Set(prev);
      newSet.delete(listingId);
      return newSet;
    });
  };
  
  // Get grade based on profit ratio
  const getGrade = (ratio: number): { grade: string; color: string; bgColor: string } => {
    if (ratio >= 3) return { grade: 'A+', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200' };
    if (ratio >= 2.5) return { grade: 'A', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200' };
    if (ratio >= 2) return { grade: 'B+', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' };
    if (ratio >= 1.75) return { grade: 'B', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' };
    if (ratio >= 1.5) return { grade: 'C+', color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200' };
    if (ratio >= 1.25) return { grade: 'C', color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200' };
    if (ratio >= 1) return { grade: 'D', color: 'text-slate-600', bgColor: 'bg-slate-50 border-slate-200' };
    return { grade: 'F', color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' };
  };
  
  // Loading state
  if (favoritesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[oklch(0.55_0.14_75)]" />
        <span className="ml-3 text-[oklch(0.50_0_0)]">Loading your favorites...</span>
      </div>
    );
  }
  
  // Empty state - no favorites yet
  if (favorites.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-[oklch(0.55_0.14_75)]/10 rounded-2xl mb-4">
          <Heart className="w-8 h-8 text-[oklch(0.55_0.14_75)]" />
        </div>
        <h3 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-2">No Favorites Yet</h3>
        <p className="text-[oklch(0.50_0_0)] mb-6 max-w-md mx-auto">
          Save properties from the Map view to compare them here. Click the heart icon on any listing to add it to your favorites.
        </p>
        <Button
          onClick={onNavigateToMap}
          className="btn-gold"
        >
          <MapPin className="w-4 h-4 mr-2" />
          Go to Map View
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      {/* Header with actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[oklch(0.15_0_0)]">Your Saved Favorites</h3>
          <p className="text-sm text-[oklch(0.55_0_0)]">
            {favorites.length} properties saved • Select properties to compare
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => favoritesQuery.refetch()}
            disabled={favoritesQuery.isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${favoritesQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {selectedForComparison.size > 0 ? (
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Clear ({selectedForComparison.size})
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
          )}
        </div>
      </div>
      
      {/* Favorites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {favorites.map((fav) => {
          const isSelected = selectedForComparison.has(fav.listingId);
          const monthlyRevenue = (fav.revenue || 0) / 12;
          
          return (
            <div
              key={fav.listingId}
              className={`relative bg-white border rounded-xl p-4 transition-all duration-200 cursor-pointer ${
                isSelected 
                  ? 'border-[oklch(0.55_0.14_75)] ring-2 ring-[oklch(0.55_0.14_75)]/20' 
                  : 'border-[oklch(0.90_0_0)] hover:border-[oklch(0.80_0_0)]'
              }`}
              onClick={() => toggleSelection(fav.listingId)}
            >
              {/* Selection indicator */}
              <div className={`absolute top-3 left-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                isSelected 
                  ? 'bg-[oklch(0.55_0.14_75)] border-[oklch(0.55_0.14_75)]' 
                  : 'border-[oklch(0.80_0_0)] bg-white'
              }`}>
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              
              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(fav.listingId);
                }}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-[oklch(0.60_0_0)] hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              <div className="flex gap-4 mt-6">
                {/* Thumbnail */}
                {fav.thumbnailUrl && (
                  <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-[oklch(0.95_0_0)]">
                    <img 
                      src={fav.thumbnailUrl} 
                      alt={fav.title || 'Property'} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-[oklch(0.20_0_0)] text-sm line-clamp-2 mb-1">
                    {fav.title || 'Untitled Property'}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-[oklch(0.50_0_0)] mb-2">
                    <span className="flex items-center gap-1">
                      <BedDouble className="w-3.5 h-3.5" />
                      {fav.bedrooms || '?'} bed
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="w-3.5 h-3.5" />
                      {fav.bathrooms || '?'} bath
                    </span>
                  </div>
                  
                  {/* Revenue info */}
                  <div className="flex items-center gap-4 text-xs">
                    <InfoTooltip content="Estimated annual revenue based on comparable properties in this area">
                      <span className="text-emerald-600 font-semibold">
                        {formatCurrency(fav.revenue || 0)}/yr
                      </span>
                    </InfoTooltip>
                    <InfoTooltip content="Average nightly rate guests pay">
                      <span className="text-[oklch(0.50_0_0)]">
                        ${fav.adr || 0}/night
                      </span>
                    </InfoTooltip>
                  </div>
                </div>
              </div>
              
              {/* Rent input */}
              <div className="mt-4 pt-4 border-t border-[oklch(0.92_0_0)]" onClick={(e) => e.stopPropagation()}>
                <InfoTooltip content="Enter the monthly rent you'd pay for a similar property to calculate profit potential">
                  <label className="block text-xs font-medium text-[oklch(0.45_0_0)] mb-1.5">
                    Monthly Rent (for comparison)
                  </label>
                </InfoTooltip>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[oklch(0.50_0_0)]" />
                  <Input
                    type="number"
                    value={rentInputs[fav.listingId] || ''}
                    onChange={(e) => setRentInputs(prev => ({
                      ...prev,
                      [fav.listingId]: parseFloat(e.target.value) || 0
                    }))}
                    placeholder="2000"
                    className="pl-9 h-10 text-sm"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Compare Button */}
      <Button
        onClick={runComparison}
        disabled={selectedForComparison.size < 2 || isComparing}
        className="btn-gold w-full h-12"
      >
        {isComparing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Comparing...
          </>
        ) : (
          <>
            <Trophy className="w-5 h-5 mr-2" />
            Compare {selectedForComparison.size} Properties
          </>
        )}
      </Button>
      
      {/* Comparison Results */}
      {comparisonResults.length > 0 && (
        <div className="space-y-6 pt-8 border-t border-[oklch(0.90_0_0)]">
          <h3 className="text-xl font-semibold text-[oklch(0.15_0_0)]">Comparison Results</h3>
          
          {/* Winner Card */}
          {comparisonResults[0] && (
            <div className="bg-white border border-[oklch(0.90_0_0)] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[oklch(0.55_0.14_75)]/10 rounded-xl flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[oklch(0.15_0_0)]">Best Deal</h4>
                    <p className="text-sm text-[oklch(0.50_0_0)]">{comparisonResults.length} properties compared</p>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg border ${getGrade(comparisonResults[0].profitRatio).bgColor}`}>
                  <span className={`text-lg font-bold ${getGrade(comparisonResults[0].profitRatio).color}`}>
                    {getGrade(comparisonResults[0].profitRatio).grade}
                  </span>
                </div>
              </div>
              
              <h5 className="font-medium text-[oklch(0.20_0_0)] mb-2">{comparisonResults[0].title}</h5>
              <div className="flex items-center gap-4 text-sm text-[oklch(0.50_0_0)] mb-4">
                <span>{comparisonResults[0].bedrooms} bed</span>
                <span>{comparisonResults[0].bathrooms} bath</span>
                <span>{formatCurrency(comparisonResults[0].monthlyRent)}/mo rent</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-[oklch(0.97_0_0)] rounded-xl">
                  <InfoTooltip content="Monthly profit after 20% expenses and rent">
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(comparisonResults[0].monthlyProfit)}</p>
                  </InfoTooltip>
                  <p className="text-xs text-[oklch(0.50_0_0)]">Monthly Profit</p>
                </div>
                <div className="text-center p-3 bg-[oklch(0.97_0_0)] rounded-xl">
                  <InfoTooltip content="How many times your revenue exceeds your rent. Higher is better - 2x+ is good.">
                    <p className="text-xl font-bold text-[oklch(0.25_0_0)]">{comparisonResults[0].profitRatio.toFixed(1)}x</p>
                  </InfoTooltip>
                  <p className="text-xs text-[oklch(0.50_0_0)]">Profit Multiplier</p>
                </div>
                <div className="text-center p-3 bg-[oklch(0.97_0_0)] rounded-xl">
                  <InfoTooltip content="Estimated annual revenue from short-term rentals">
                    <p className="text-xl font-bold text-[oklch(0.25_0_0)]">{formatCurrency(comparisonResults[0].revenue)}</p>
                  </InfoTooltip>
                  <p className="text-xs text-[oklch(0.50_0_0)]">Annual Revenue</p>
                </div>
                <div className="text-center p-3 bg-[oklch(0.97_0_0)] rounded-xl">
                  <InfoTooltip content="How often the property is booked throughout the year">
                    <p className="text-xl font-bold text-[oklch(0.25_0_0)]">{Math.round(comparisonResults[0].occupancy)}%</p>
                  </InfoTooltip>
                  <p className="text-xs text-[oklch(0.50_0_0)]">Occupancy</p>
                </div>
              </div>
            </div>
          )}
          
          {/* All Results Table */}
          <div className="bg-white border border-[oklch(0.90_0_0)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[oklch(0.97_0_0)]">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[oklch(0.45_0_0)] uppercase tracking-wider">Rank</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[oklch(0.45_0_0)] uppercase tracking-wider">Property</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[oklch(0.45_0_0)] uppercase tracking-wider">Rent</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[oklch(0.45_0_0)] uppercase tracking-wider">Revenue</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[oklch(0.45_0_0)] uppercase tracking-wider">Profit</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-[oklch(0.45_0_0)] uppercase tracking-wider">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[oklch(0.92_0_0)]">
                  {comparisonResults.map((result, index) => {
                    const grade = getGrade(result.profitRatio);
                    return (
                      <tr key={result.listingId} className={index === 0 ? 'bg-[oklch(0.55_0.14_75)]/5' : ''}>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            index === 0 ? 'bg-[oklch(0.55_0.14_75)] text-white' : 'bg-[oklch(0.92_0_0)] text-[oklch(0.45_0_0)]'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {result.thumbnailUrl && (
                              <img src={result.thumbnailUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                            )}
                            <div>
                              <p className="font-medium text-sm text-[oklch(0.20_0_0)] line-clamp-1">{result.title}</p>
                              <p className="text-xs text-[oklch(0.50_0_0)]">{result.bedrooms} bed • {result.bathrooms} bath</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-[oklch(0.40_0_0)]">
                          {formatCurrency(result.monthlyRent)}/mo
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-[oklch(0.40_0_0)]">
                          {formatCurrency(result.revenue)}/yr
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold text-sm ${result.monthlyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(result.monthlyProfit)}/mo
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${grade.color} ${grade.bgColor}`}>
                            {grade.grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Add more properties CTA */}
          <div className="text-center pt-4">
            <p className="text-sm text-[oklch(0.50_0_0)] mb-3">
              Want to compare more properties?
            </p>
            <Button variant="outline" onClick={onNavigateToMap}>
              <Plus className="w-4 h-4 mr-2" />
              Add More from Map View
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
