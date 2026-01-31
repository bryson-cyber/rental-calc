/**
 * Compare Favorites Section
 * 
 * Displays user's saved favorites from the Find a Property tab and allows side-by-side comparison
 * of their STR revenue potential.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useProperty } from '@/contexts/PropertyContext';
import { toast } from 'sonner';
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
  Search,
  Map,
  BarChart3,
  Users,
  LayoutGrid,
  Table2
} from 'lucide-react';
import { Link } from 'wouter';
import { ComparisonDashboard } from './ComparisonDashboard';

// Generate or retrieve session ID for anonymous users
function getSessionId(): string {
  let sessionId = localStorage.getItem("rental_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("rental_session_id", sessionId);
  }
  return sessionId;
}

interface ComparisonResult {
  id: number;
  address: string;
  city: string | null;
  state: string | null;
  bedrooms: number;
  bathrooms: number;
  annualRevenue: number;
  occupancy: number;
  adr: number;
  monthlyProfit: number;
  annualProfit: number;
  profitRatio: number;
  monthlyRent: number;
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
  const { globalMode } = useProperty();
  const [rentInputs, setRentInputs] = useState<Record<number, number>>({});
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table'); // Default to table view
  
  // Get sessionId for anonymous users
  const sessionId = useMemo(() => {
    if (isAuthenticated) return undefined;
    return getSessionId();
  }, [isAuthenticated]);
  
  // Fetch favorites from database
  const favoritesQuery = trpc.favorites.list.useQuery(
    { sessionId },
    { 
      staleTime: 1000 * 60 * 5, // Cache for 5 minutes
      refetchOnWindowFocus: true 
    }
  );
  
  const removeFavoriteMutation = trpc.favorites.remove.useMutation({
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
      const initialRents: Record<number, number> = {};
      favorites.forEach(fav => {
        if (!rentInputs[fav.id]) {
          // Use stored monthlyRent or estimate from revenue
          if (fav.monthlyRent) {
            initialRents[fav.id] = fav.monthlyRent;
          } else if (fav.annualRevenue) {
            // Estimate rent as ~40% of monthly revenue (rough arbitrage assumption)
            const monthlyRevenue = fav.annualRevenue / 12;
            initialRents[fav.id] = Math.round(monthlyRevenue * 0.4 / 100) * 100;
          }
        }
      });
      if (Object.keys(initialRents).length > 0) {
        setRentInputs(prev => ({ ...prev, ...initialRents }));
      }
    }
  }, [favorites]);
  
  // Toggle selection for comparison
  const toggleSelection = (id: number) => {
    setSelectedForComparison(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  // Select all favorites
  const selectAll = () => {
    setSelectedForComparison(new Set(favorites.map(f => f.id)));
  };
  
  // Clear selection
  const clearSelection = () => {
    setSelectedForComparison(new Set());
  };
  
  // Run comparison
  const runComparison = useCallback(() => {
    const selectedFavorites = favorites.filter(f => selectedForComparison.has(f.id));
    
    if (selectedFavorites.length < 2) {
      toast.error('Please select at least 2 properties to compare');
      return;
    }
    
    setIsComparing(true);
    
    // Calculate comparison results
    const results: ComparisonResult[] = selectedFavorites.map(fav => {
      const monthlyRent = rentInputs[fav.id] || fav.monthlyRent || 0;
      const annualRevenue = fav.annualRevenue || 0;
      const monthlyRevenue = annualRevenue / 12;
      const expenseRate = 0.20; // 20% for expenses
      const monthlyProfit = monthlyRevenue * (1 - expenseRate) - monthlyRent;
      const annualProfit = monthlyProfit * 12;
      const profitRatio = monthlyRent > 0 ? monthlyRevenue / monthlyRent : 0;
      
      return {
        id: fav.id,
        address: fav.address,
        city: fav.city,
        state: fav.state,
        bedrooms: fav.bedrooms || 0,
        bathrooms: parseFloat(fav.bathrooms || '0'),
        annualRevenue,
        occupancy: parseFloat(fav.occupancyRate || '0') * 100,
        adr: fav.averageDailyRate || 0,
        monthlyProfit,
        annualProfit,
        profitRatio,
        monthlyRent,
      };
    });
    
    // Sort by monthly profit (highest first)
    results.sort((a, b) => b.monthlyProfit - a.monthlyProfit);
    
    setComparisonResults(results);
    setIsComparing(false);
    
    toast.success(`Compared ${results.length} properties!`);
  }, [favorites, selectedForComparison, rentInputs]);
  
  // Remove a favorite
  const handleRemove = (id: number) => {
    removeFavoriteMutation.mutate({ id, sessionId });
    setSelectedForComparison(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
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
          Save properties from the Find a Property tab to compare them here. Click the heart icon on any property card to add it to your favorites.
        </p>
        <Link href="/?tab=opportunity">
          <Button className="btn-gold">
            <Search className="w-4 h-4 mr-2" />
            Find Properties
          </Button>
        </Link>
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
            {favorites.length} properties saved • {globalMode === 'purchase' ? 'Purchase Mode' : 'Arbitrage Mode'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:text-slate-600'}`}
              title="Table View"
            >
              <Table2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:text-slate-600'}`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => favoritesQuery.refetch()}
            disabled={favoritesQuery.isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${favoritesQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Table View - ComparisonDashboard */}
      {viewMode === 'table' && (
        <ComparisonDashboard
          properties={favorites.map(fav => ({
            id: fav.id,
            address: fav.address,
            city: fav.city,
            state: fav.state,
            zipCode: fav.zipCode,
            bedrooms: fav.bedrooms || 0,
            bathrooms: fav.bathrooms || '0',
            annualRevenue: fav.annualRevenue || 0,
            occupancyRate: fav.occupancyRate || '0',
            averageDailyRate: fav.averageDailyRate || 0,
            monthlyRent: fav.monthlyRent,
            zillowUrl: fav.zillowUrl,
            // Purchase mode fields - use defaults if not stored
            purchasePrice: (fav as any).purchasePrice || null,
            loanType: (fav as any).loanType || null,
            downPaymentPercent: (fav as any).downPaymentPercent || null,
            interestRate: (fav as any).interestRate || null,
          }))}
          onRemove={(id) => handleRemove(id)}
          mode={globalMode || 'rent'}
        />
      )}
      
      {/* Card View - Original Grid */}
      {viewMode === 'cards' && (
        <>
          {/* Selection Actions */}
          <div className="flex items-center gap-2">
            {selectedForComparison.size > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                >
                  Clear ({selectedForComparison.size})
                </Button>
                <Button
                  size="sm"
                  onClick={runComparison}
                  disabled={selectedForComparison.size < 2}
                  className="btn-gold"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Compare Selected
                </Button>
              </>
            )}
            {selectedForComparison.size === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
              >
                Select All
              </Button>
            )}
          </div>
      
          {/* Favorites Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {favorites.map(fav => {
          const isSelected = selectedForComparison.has(fav.id);
          const monthlyRent = rentInputs[fav.id] || fav.monthlyRent || 0;
          const annualRevenue = fav.annualRevenue || 0;
          const monthlyRevenue = annualRevenue / 12;
          const monthlyProfit = monthlyRevenue * 0.8 - monthlyRent;
          const profitRatio = monthlyRent > 0 ? monthlyRevenue / monthlyRent : 0;
          const grade = getGrade(profitRatio);
          
          return (
            <div
              key={fav.id}
              className={`relative rounded-xl border-2 p-4 transition-all cursor-pointer ${
                isSelected 
                  ? 'border-[oklch(0.55_0.14_75)] bg-[oklch(0.55_0.14_75)]/5' 
                  : 'border-[oklch(0.90_0_0)] hover:border-[oklch(0.70_0_0)]'
              }`}
              onClick={() => toggleSelection(fav.id)}
            >
              {/* Selection indicator */}
              <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                isSelected 
                  ? 'bg-[oklch(0.55_0.14_75)] border-[oklch(0.55_0.14_75)]' 
                  : 'border-[oklch(0.70_0_0)]'
              }`}>
                {isSelected && (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              
              {/* Property Info */}
              <div className="pr-8">
                <h4 className="font-semibold text-[oklch(0.15_0_0)] text-sm mb-1 truncate">
                  {fav.address}
                </h4>
                <p className="text-xs text-[oklch(0.55_0_0)] mb-3">
                  {fav.city}, {fav.state} {fav.zipCode}
                </p>
                
                {/* Property Details */}
                <div className="flex items-center gap-3 text-xs text-[oklch(0.45_0_0)] mb-3">
                  <span className="flex items-center gap-1">
                    <BedDouble className="w-3.5 h-3.5" />
                    {fav.bedrooms || '?'} bed
                  </span>
                  <span className="flex items-center gap-1">
                    <Bath className="w-3.5 h-3.5" />
                    {fav.bathrooms || '?'} bath
                  </span>
                </div>
                
                {/* Revenue Info */}
                {annualRevenue > 0 && (
                  <div className="bg-[oklch(0.97_0_0)] rounded-lg p-3 mb-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-[oklch(0.55_0_0)]">Est. Annual Revenue</span>
                      <span className="font-semibold text-[oklch(0.15_0_0)]">{formatCurrency(annualRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[oklch(0.55_0_0)]">Monthly Rent</span>
                      <span className="font-medium text-[oklch(0.35_0_0)]">{formatCurrency(monthlyRent)}/mo</span>
                    </div>
                  </div>
                )}
                
                {/* Profit Preview */}
                {monthlyRent > 0 && annualRevenue > 0 && (
                  <div className={`flex items-center justify-between p-2 rounded-lg border ${grade.bgColor}`}>
                    <span className="text-xs text-[oklch(0.45_0_0)]">Est. Monthly Profit</span>
                    <span className={`font-bold ${monthlyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(monthlyProfit)}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[oklch(0.92_0_0)]">
                <Link 
                  href={`/?tab=map&location=${encodeURIComponent((fav.city || '') + ', ' + (fav.state || ''))}&address=${encodeURIComponent(fav.address)}&bedrooms=${fav.bedrooms || 2}&autoAnalyze=true`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2">
                    <Map className="w-3.5 h-3.5 mr-1" />
                    Map
                  </Button>
                </Link>
                <Link 
                  href={`/?tab=compare&location=${encodeURIComponent((fav.city || '') + ', ' + (fav.state || ''))}&address=${encodeURIComponent(fav.address)}&bedrooms=${fav.bedrooms || 2}&autoAnalyze=true`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2">
                    <Users className="w-3.5 h-3.5 mr-1" />
                    Comps
                  </Button>
                </Link>
                {fav.zillowUrl && (
                  <a 
                    href={fav.zillowUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="outline" size="sm" className="h-8 text-xs px-2">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      Zillow
                    </Button>
                  </a>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(fav.id);
                  }}
                  className="ml-auto p-1.5 rounded-full hover:bg-red-50 text-[oklch(0.55_0_0)] hover:text-red-500 transition-colors"
                  title="Remove from favorites"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Comparison Results */}
      {comparisonResults.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-6 h-6 text-[oklch(0.55_0.14_75)]" />
            <h3 className="text-lg font-semibold text-[oklch(0.15_0_0)]">Comparison Results</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[oklch(0.97_0_0)]">
                  <th className="text-left p-3 text-xs font-semibold text-[oklch(0.35_0_0)]">Rank</th>
                  <th className="text-left p-3 text-xs font-semibold text-[oklch(0.35_0_0)]">Property</th>
                  <th className="text-right p-3 text-xs font-semibold text-[oklch(0.35_0_0)]">Annual Revenue</th>
                  <th className="text-right p-3 text-xs font-semibold text-[oklch(0.35_0_0)]">Monthly Rent</th>
                  <th className="text-right p-3 text-xs font-semibold text-[oklch(0.35_0_0)]">Monthly Profit</th>
                  <th className="text-center p-3 text-xs font-semibold text-[oklch(0.35_0_0)]">Grade</th>
                </tr>
              </thead>
              <tbody>
                {comparisonResults.map((result, index) => {
                  const grade = getGrade(result.profitRatio);
                  return (
                    <tr key={result.id} className={`border-b border-[oklch(0.92_0_0)] ${index === 0 ? 'bg-emerald-50/50' : ''}`}>
                      <td className="p-3">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          index === 0 ? 'bg-[oklch(0.55_0.14_75)] text-white' : 'bg-[oklch(0.92_0_0)] text-[oklch(0.45_0_0)]'
                        }`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-medium text-[oklch(0.15_0_0)]">{result.address}</div>
                        <div className="text-xs text-[oklch(0.55_0_0)]">{result.city}, {result.state}</div>
                      </td>
                      <td className="p-3 text-right font-medium text-[oklch(0.25_0_0)]">
                        {formatCurrency(result.annualRevenue)}
                      </td>
                      <td className="p-3 text-right text-[oklch(0.45_0_0)]">
                        {formatCurrency(result.monthlyRent)}/mo
                      </td>
                      <td className={`p-3 text-right font-bold ${result.monthlyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(result.monthlyProfit)}/mo
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold border ${grade.bgColor} ${grade.color}`}>
                          {grade.grade}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Winner callout */}
          {comparisonResults.length > 0 && comparisonResults[0].monthlyProfit > 0 && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-800">Best Deal: {comparisonResults[0].address}</p>
                  <p className="text-sm text-emerald-700">
                    Estimated {formatCurrency(comparisonResults[0].monthlyProfit)}/month profit with {formatCurrency(comparisonResults[0].annualRevenue)} annual revenue
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}
