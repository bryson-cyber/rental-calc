/**
 * My Favorites Page - View and manage saved properties
 * 
 * Features:
 * - List of all favorited properties
 * - Remove from favorites
 * - Export favorites to CSV
 * - Navigate to property on map
 */

import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Heart,
  Trash2,
  MapPin,
  BedDouble,
  Bath,
  DollarSign,
  TrendingUp,
  Calendar,
  ExternalLink,
  Download,
  Loader2,
  ArrowLeft,
  Star,
  Building,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { SharePageButton } from '@/components/SharePageButton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Type for favorite listing from database
interface FavoriteListing {
  id: number;
  userId: number | null;
  sessionId: string | null;
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
  searchSubmarketId: string | null;
  createdAt: Date;
  updatedAt: Date;
  rating?: number | null;
  imageUrl?: string | null;
}

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Get tier color based on revenue
const getTierColor = (revenue: number, avgRevenue: number) => {
  const highThreshold = avgRevenue * 1.2;
  const lowThreshold = avgRevenue * 0.8;
  
  if (revenue >= highThreshold) return { bg: 'bg-green-100', text: 'text-green-700', label: 'Top Performer' };
  if (revenue >= lowThreshold) return { bg: 'bg-[#C9A962]/20', text: 'text-[#C9A962]', label: 'Mid Performer' };
  return { bg: 'bg-red-100', text: 'text-red-700', label: 'Lower Performer' };
};

export default function MyFavorites() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [removingId, setRemovingId] = useState<string | null>(null);
  
  // Get sessionId for anonymous users
  const getSessionId = () => {
    if (typeof window === 'undefined') return undefined;
    return localStorage.getItem('rental_calc_session_id') || undefined;
  };
  
  // Fetch favorites
  const favoritesQuery = trpc.favoriteListings.list.useQuery({
    sessionId: isAuthenticated ? undefined : getSessionId(),
  });
  
  // Toggle mutation (for removing)
  const toggleMutation = trpc.favoriteListings.toggle.useMutation({
    onSuccess: () => {
      favoritesQuery.refetch();
    },
  });
  
  // Calculate average revenue for tier coloring
  const avgRevenue = favoritesQuery.data?.data?.length 
    ? (favoritesQuery.data.data as FavoriteListing[]).reduce((sum: number, f: FavoriteListing) => sum + (f.revenue || 0), 0) / favoritesQuery.data.data.length
    : 0;
  
  // Handle remove from favorites
  const handleRemove = async (favorite: any) => {
    setRemovingId(favorite.listingId);
    try {
      await toggleMutation.mutateAsync({
        sessionId: isAuthenticated ? undefined : getSessionId(),
        listingId: favorite.listingId,
        title: favorite.title || undefined,
        bedrooms: favorite.bedrooms || undefined,
        bathrooms: favorite.bathrooms ? parseFloat(String(favorite.bathrooms)) : undefined,
        revenue: favorite.revenue ? Math.round(favorite.revenue) : undefined,
        adr: favorite.adr ? Math.round(favorite.adr) : undefined,
        occupancy: favorite.occupancy ? parseFloat(String(favorite.occupancy)) : undefined,
        latitude: favorite.latitude ? parseFloat(String(favorite.latitude)) : undefined,
        longitude: favorite.longitude ? parseFloat(String(favorite.longitude)) : undefined,
        airbnbUrl: favorite.airbnbUrl || undefined,
      });
    } finally {
      setRemovingId(null);
    }
  };
  
  // Export to CSV
  const handleExport = () => {
    if (!favoritesQuery.data?.data?.length) return;
    
    const headers = ['Title', 'Bedrooms', 'Bathrooms', 'Annual Revenue', 'Nightly Rate', 'Occupancy', 'Rating', 'Airbnb URL'];
    const rows = (favoritesQuery.data.data as FavoriteListing[]).map((f: FavoriteListing) => [
      `"${(f.title || '').replace(/"/g, '""')}"`,
      f.bedrooms || 0,
      f.bathrooms || 0,
      f.revenue || 0,
      f.adr || 0,
      `${Math.round(parseFloat(String(f.occupancy || 0)) * 100)}%`,
      f.rating || 'N/A',
      f.airbnbUrl || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-favorites-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Loading state
  if (authLoading || favoritesQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#faf9f6] to-[#f5f3ef] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#C9A962] mx-auto mb-4" />
          <p className="text-[#0F172A]/60">Loading your favorites...</p>
        </div>
      </div>
    );
  }
  
  const favorites: FavoriteListing[] = (favoritesQuery.data?.data || []) as FavoriteListing[];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f6] to-[#f5f3ef]">
      {/* Header */}
      <div className="bg-[#0F172A] text-white py-6">
        <div className="container max-w-6xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-serif font-semibold flex items-center gap-3">
                  <Heart className="w-6 h-6 text-[#C9A962] fill-[#C9A962]" />
                  My Saved Properties
                </h1>
                <p className="text-white/60 text-sm mt-1">
                  {favorites.length} {favorites.length === 1 ? 'property' : 'properties'} saved
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <SharePageButton
                pagePath="/saved-properties"
                params={{}}
                shareDescription="my saved properties"
                variant="outline"
                size="default"
                className="border-[#C9A962]/50 text-[#C9A962] hover:bg-[#C9A962]/10"
              />
              {favorites.length > 0 && (
                <Button
                  onClick={handleExport}
                  variant="outline"
                  className="border-[#C9A962]/50 text-[#C9A962] hover:bg-[#C9A962]/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="container max-w-6xl py-8">
        {favorites.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Heart className="w-16 h-16 text-[#0F172A]/20 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-[#0F172A] mb-2">No Saved Properties Yet</h2>
              <p className="text-[#0F172A]/60 mb-6 max-w-md mx-auto">
                Start exploring properties and click the heart icon to save your favorites for easy comparison.
              </p>
              <Link href="/">
                <Button className="bg-[#C9A962] hover:bg-[#b8984f] text-white">
                  <MapPin className="w-4 h-4 mr-2" />
                  Explore Properties
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-[#0F172A]/60 mb-1">Total Saved</p>
                  <p className="text-2xl font-bold text-[#0F172A]">{favorites.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-[#0F172A]/60 mb-1">Avg Revenue</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(avgRevenue)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-[#0F172A]/60 mb-1">Avg Nightly Rate</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(favorites.reduce((sum: number, f) => sum + (f.adr || 0), 0) / favorites.length)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-[#0F172A]/60 mb-1">Avg Occupancy</p>
                  <p className="text-2xl font-bold text-[#C9A962]">
                    {Math.round(favorites.reduce((sum: number, f) => {
                      const occVal = parseFloat(String(f.occupancy || 0));
                      return sum + (occVal > 1 ? occVal : occVal * 100);
                    }, 0) / favorites.length)}%
                  </p>
                </CardContent>
              </Card>
            </div>
            
            {/* Property Cards */}
            {favorites.map((favorite) => {
              const tier = getTierColor(favorite.revenue || 0, avgRevenue);
              const occupancyVal = parseFloat(String(favorite.occupancy || 0));
              const occupancyDisplay = occupancyVal > 1 
                ? Math.round(occupancyVal) 
                : Math.round(occupancyVal * 100);
              
              return (
                <Card key={favorite.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="flex">
                    {/* Image */}
                    <div className="w-48 h-40 flex-shrink-0 bg-[#0F172A]/5">
                      {favorite.imageUrl ? (
                        <img 
                          src={favorite.imageUrl} 
                          alt={favorite.title || 'Property'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building className="w-12 h-12 text-[#0F172A]/20" />
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-[#0F172A] line-clamp-1">{favorite.title}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>
                              {tier.label}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-[#0F172A]/60 mb-3">
                            <span className="flex items-center gap-1">
                              <BedDouble className="w-3.5 h-3.5" />
                              {favorite.bedrooms} BR
                            </span>
                            <span className="flex items-center gap-1">
                              <Bath className="w-3.5 h-3.5" />
                              {favorite.bathrooms} BA
                            </span>
                            {favorite.rating && (
                              <span className="flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                {favorite.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                          
                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-[#0F172A]/50 uppercase tracking-wide">Annual Revenue</p>
                              <p className="text-lg font-bold text-green-600">{formatCurrency(favorite.revenue || 0)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#0F172A]/50 uppercase tracking-wide">Nightly Rate</p>
                              <p className="text-lg font-bold text-blue-600">{formatCurrency(favorite.adr || 0)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#0F172A]/50 uppercase tracking-wide">Occupancy</p>
                              <p className="text-lg font-bold text-[#C9A962]">{occupancyDisplay}%</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex flex-col gap-2 ml-4">
                          {favorite.airbnbUrl && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={favorite.airbnbUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg bg-[#0F172A]/5 hover:bg-[#0F172A]/10 transition-colors"
                                  >
                                    <ExternalLink className="w-4 h-4 text-[#0F172A]/60" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>View on Airbnb</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className="p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
                                disabled={removingId === favorite.listingId}
                              >
                                {removingId === favorite.listingId ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                                ) : (
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                )}
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove from Favorites?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove "{favorite.title}" from your saved properties?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemove(favorite)}
                                  className="bg-red-500 hover:bg-red-600"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
