// @ts-nocheck -- Market-level component disabled (AirDNA removed)
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  TrendingUp, 
  DollarSign, 
  Star, 
  Building2, 
  ChevronRight,
  Loader2,
  Mountain,
  Waves,
  TreePine,
  Home,
  Building,
  Heart,
  Trash2,
  BarChart3,
  Download,
  FileText,
  FileDown
} from 'lucide-react';
import { exportFavoritesPDF } from '@/lib/pdfExport';
import { SharePageButton } from '@/components/SharePageButton';
import { Link } from 'wouter';

const marketTypeIcons: Record<string, React.ReactNode> = {
  coastal: <Waves className="w-4 h-4" />,
  urban_metro: <Building className="w-4 h-4" />,
  mountains_lakes: <Mountain className="w-4 h-4" />,
  suburban: <Home className="w-4 h-4" />,
  rural: <TreePine className="w-4 h-4" />,
  mid_size_city: <Building2 className="w-4 h-4" />,
};

const marketTypeLabels: Record<string, string> = {
  coastal: 'Coastal',
  urban_metro: 'Urban Metro',
  mountains_lakes: 'Mountains & Lakes',
  suburban: 'Suburban',
  rural: 'Rural',
  mid_size_city: 'Mid-Size City',
};

export default function MyFavoritesPage() {
  const [sessionId] = useState(() => {
    let id = localStorage.getItem('favoriteSessionId');
    if (!id) {
      id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('favoriteSessionId', id);
    }
    return id;
  });

  const utils = trpc.useUtils();
  const favoritesQuery = trpc.favoriteMarkets.list.useQuery({ sessionId });

  const removeFavoriteMutation = trpc.favoriteMarkets.remove.useMutation({
    onSuccess: () => {
      utils.favoriteMarkets.list.invalidate();
    },
  });

  const handleRemove = (id: number) => {
    removeFavoriteMutation.mutate({ id });
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-amber-600 bg-amber-50';
    return 'text-slate-600 bg-slate-50';
  };

  const exportToCSV = () => {
    if (!favoritesQuery.data || favoritesQuery.data.length === 0) return;

    const headers = ['Market Name', 'Market Type', 'State', 'Market Score', 'Listings', 'Avg Revenue', 'Occupancy', 'ADR'];
    const rows = favoritesQuery.data.map(fav => [
      fav.marketName,
      marketTypeLabels[fav.marketType || ''] || fav.marketType || '',
      fav.state || '',
      fav.marketScore || '',
      fav.listingCount || '',
      fav.averageRevenue || '',
      fav.averageOccupancy ? `${Math.round(parseFloat(fav.averageOccupancy) * 100)}%` : '',
      fav.averageAdr || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `my-favorite-markets-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportToPDF = () => {
    if (!favoritesQuery.data || favoritesQuery.data.length === 0) return;

    const markets = favoritesQuery.data.map(fav => ({
      name: fav.marketName,
      state: fav.state || undefined,
      avgRevenue: fav.averageRevenue ? parseFloat(String(fav.averageRevenue)) : undefined,
      avgOccupancy: fav.averageOccupancy ? parseFloat(String(fav.averageOccupancy)) : undefined,
      avgAdr: fav.averageAdr ? parseFloat(String(fav.averageAdr)) : undefined,
      propertyCount: fav.listingCount || undefined,
      // topPerformerRevenue not available in favorites data
    }));

    exportFavoritesPDF(markets, {
      title: 'My Favorite Markets',
      subtitle: `${markets.length} Saved Markets`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  ← Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                  My Favorite Markets
                </h1>
                <p className="text-sm text-slate-500">
                  {favoritesQuery.data?.length || 0} saved markets
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SharePageButton
                pagePath="/my-favorites"
                params={{}}
                shareDescription="my favorite markets"
                variant="outline"
                size="sm"
              />
              {favoritesQuery.data && favoritesQuery.data.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToCSV}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToPDF}
                    className="gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    Export PDF
                  </Button>
                  <Link href="/compare-markets">
                    <Button variant="default" size="sm" className="gap-2 bg-amber-600 hover:bg-amber-700">
                      <BarChart3 className="w-4 h-4" />
                      Compare Markets
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {favoritesQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            <span className="ml-3 text-slate-600">Loading your favorites...</span>
          </div>
        ) : favoritesQuery.isError ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">Failed to load favorites. Please try again.</p>
            </CardContent>
          </Card>
        ) : favoritesQuery.data?.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-300">
            <CardContent className="pt-12 pb-12 text-center">
              <Heart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No Favorites Yet</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Start exploring markets and click the heart icon to save your favorites for quick access.
              </p>
              <Link href="/discover-markets">
                <Button className="bg-amber-600 hover:bg-amber-700">
                  Discover Markets
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Heart className="w-4 h-4" />
                    <span className="text-sm">Saved Markets</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{favoritesQuery.data?.length || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Star className="w-4 h-4" />
                    <span className="text-sm">Avg Score</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {(favoritesQuery.data?.length || 0) > 0
                      ? Math.round(
                          (favoritesQuery.data || []).reduce((sum, m) => sum + (parseFloat(m.marketScore || '0') || 0), 0) /
                            (favoritesQuery.data?.length || 1)
                        )
                      : 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Building2 className="w-4 h-4" />
                    <span className="text-sm">Total Listings</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {(favoritesQuery.data || [])
                      .reduce((sum, m) => sum + (m.listingCount || 0), 0)
                      .toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Avg Revenue</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {(favoritesQuery.data?.length || 0) > 0
                      ? formatCurrency(
                          (favoritesQuery.data || []).reduce((sum, m) => sum + (m.averageRevenue || 0), 0) /
                            (favoritesQuery.data?.length || 1)
                        )
                      : '$0'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Favorites Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(favoritesQuery.data || []).map((favorite) => (
                <Card key={favorite.id} className="hover:shadow-lg transition-shadow group relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {favorite.marketType && marketTypeIcons[favorite.marketType]}
                        <CardTitle className="text-lg">{favorite.marketName}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemove(favorite.id)}
                          disabled={removeFavoriteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        {favorite.marketScore && (
                          <Badge className={getScoreColor(parseFloat(favorite.marketScore))}>
                            {Math.round(parseFloat(favorite.marketScore))}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {favorite.marketType && (
                        <Badge variant="outline" className="w-fit text-xs">
                          {marketTypeLabels[favorite.marketType] || favorite.marketType}
                        </Badge>
                      )}
                      {favorite.state && (
                        <Badge variant="secondary" className="w-fit text-xs">
                          {favorite.state}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Listings</span>
                        <span className="font-medium">{(favorite.listingCount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Avg Revenue</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(favorite.averageRevenue)}/yr
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Occupancy</span>
                        <span className="font-medium">
                          {favorite.averageOccupancy
                            ? `${Math.round(parseFloat(favorite.averageOccupancy) * 100)}%`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">ADR</span>
                        <span className="font-medium">{formatCurrency(favorite.averageAdr)}/night</span>
                      </div>

                      {/* Saved Date */}
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400">
                          Saved {new Date(favorite.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Action */}
                      <Link href={`/market-advisor?marketId=${favorite.marketId}&marketName=${encodeURIComponent(favorite.marketName)}`}>
                        <Button variant="ghost" className="w-full mt-2 group-hover:bg-amber-50 group-hover:text-amber-700">
                          View Details
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
