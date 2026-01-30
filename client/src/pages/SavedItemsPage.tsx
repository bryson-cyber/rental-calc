import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, 
  TrendingUp, 
  DollarSign, 
  Building2, 
  ChevronRight,
  Loader2,
  Home,
  Trash2,
  ExternalLink,
  Calendar,
  Percent,
  BedDouble,
  Bath,
  Save,
  ArrowLeft,
  LogIn
} from 'lucide-react';
import { SharePageButton } from '@/components/SharePageButton';
import { Link, useLocation } from 'wouter';
import { getLoginUrl } from '@/const';
export default function SavedItemsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Session ID for anonymous users
  const [sessionId] = useState(() => {
    let id = localStorage.getItem('savedItemsSessionId');
    if (!id) {
      id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('savedItemsSessionId', id);
    }
    return id;
  });

  const utils = trpc.useUtils();
  
  // Fetch saved searches (markets)
  const savedSearchesQuery = trpc.savedSearches.list.useQuery({ 
    sessionId: !isAuthenticated ? sessionId : undefined 
  });
  
  // Fetch favorite properties
  const favoritePropertiesQuery = trpc.favorites.list.useQuery({ 
    sessionId: !isAuthenticated ? sessionId : undefined 
  });

  // Delete mutations
  const deleteSearchMutation = trpc.savedSearches.delete.useMutation({
    onSuccess: () => {
      utils.savedSearches.list.invalidate();
    },
  });

  const deletePropertyMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => {
      utils.favorites.list.invalidate();
    },
  });

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Filter saved searches by type
  const savedMarkets = savedSearchesQuery.data?.data?.filter(s => s.searchType === 'market') || [];
  const savedProperties = favoritePropertiesQuery.data?.data || [];

  const isLoading = savedSearchesQuery.isLoading || favoritePropertiesQuery.isLoading || authLoading;

  // If not authenticated, show login prompt
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/30">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Save className="w-5 h-5 text-amber-600" />
                  My Saved Items
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Login Required Message */}
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto border-dashed border-2 border-slate-300">
            <CardContent className="pt-12 pb-12 text-center">
              <LogIn className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Login Required</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Create a free account to save markets and properties for later. Your saved items will sync across all your devices.
              </p>
              <Button 
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => window.location.href = getLoginUrl()}
              >
                <LogIn className="w-4 h-4 mr-2" />
                Login or Create Account
              </Button>
              <p className="text-xs text-slate-400 mt-4">
                All tools remain free to use without an account
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Save className="w-5 h-5 text-amber-600" />
                  My Saved Items
                </h1>
                <p className="text-sm text-slate-500">
                  {savedMarkets.length} markets · {savedProperties.length} properties
                </p>
              </div>
            </div>
            <SharePageButton
              pagePath="/saved-items"
              params={{}}
              shareDescription="my saved items"
              variant="outline"
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            <span className="ml-3 text-slate-600">Loading your saved items...</span>
          </div>
        ) : (
          <Tabs defaultValue="markets" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
              <TabsTrigger value="markets" className="gap-2">
                <MapPin className="w-4 h-4" />
                Markets ({savedMarkets.length})
              </TabsTrigger>
              <TabsTrigger value="properties" className="gap-2">
                <Home className="w-4 h-4" />
                Properties ({savedProperties.length})
              </TabsTrigger>
            </TabsList>

            {/* Saved Markets Tab */}
            <TabsContent value="markets">
              {savedMarkets.length === 0 ? (
                <Card className="border-dashed border-2 border-slate-300">
                  <CardContent className="pt-12 pb-12 text-center">
                    <MapPin className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">No Saved Markets</h3>
                    <p className="text-slate-500 mb-6 max-w-md mx-auto">
                      When you find a market you're interested in, click "Save Market" to add it here for easy access.
                    </p>
                    <Link href="/">
                      <Button className="bg-amber-600 hover:bg-amber-700">
                        Start Analyzing Markets
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedMarkets.map((market) => (
                    <Card key={market.id} className="hover:shadow-lg transition-shadow group">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-amber-600" />
                            <CardTitle className="text-lg">{market.marketName || 'Unknown Market'}</CardTitle>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteSearchMutation.mutate({ id: market.id, sessionId })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        {market.submarketName && (
                          <p className="text-sm text-slate-500">{market.submarketName}</p>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {/* Cached metrics */}
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-slate-50 rounded-lg p-2">
                              <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                                <DollarSign className="w-3 h-3" />
                              </div>
                              <p className="text-sm font-semibold text-slate-900">
                                {market.cachedRevenue ? formatCurrency(market.cachedRevenue) : '-'}
                              </p>
                              <p className="text-xs text-slate-400">Revenue</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-2">
                              <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                                <Percent className="w-3 h-3" />
                              </div>
                              <p className="text-sm font-semibold text-slate-900">
                                {market.cachedOccupancy ? `${Math.round(Number(market.cachedOccupancy))}%` : '-'}
                              </p>
                              <p className="text-xs text-slate-400">Booking Rate</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-2">
                              <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                                <TrendingUp className="w-3 h-3" />
                              </div>
                              <p className="text-sm font-semibold text-slate-900">
                                {market.cachedAdr ? formatCurrency(market.cachedAdr) : '-'}
                              </p>
                              <p className="text-xs text-slate-400">Nightly Rate</p>
                            </div>
                          </div>

                          {/* Notes */}
                          {market.notes && (
                            <p className="text-sm text-slate-600 bg-amber-50 p-2 rounded-lg">
                              {market.notes}
                            </p>
                          )}

                          {/* Saved date */}
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Saved {formatDate(market.createdAt)}
                            </span>
                            <Link href={`/?market=${market.marketId}`}>
                              <Button variant="ghost" size="sm" className="h-6 text-xs text-amber-600 hover:text-amber-700">
                                View Details
                                <ExternalLink className="w-3 h-3 ml-1" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Saved Properties Tab */}
            <TabsContent value="properties">
              {savedProperties.length === 0 ? (
                <Card className="border-dashed border-2 border-slate-300">
                  <CardContent className="pt-12 pb-12 text-center">
                    <Home className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">No Saved Properties</h3>
                    <p className="text-slate-500 mb-6 max-w-md mx-auto">
                      When you analyze a property, click "Save Property" to add it here for comparison and tracking.
                    </p>
                    <Link href="/">
                      <Button className="bg-amber-600 hover:bg-amber-700">
                        Start Analyzing Properties
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedProperties.map((property) => (
                    <Card key={property.id} className="hover:shadow-lg transition-shadow group">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate">{property.address}</CardTitle>
                            <p className="text-sm text-slate-500">
                              {[property.city, property.state].filter(Boolean).join(', ')}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            onClick={() => deletePropertyMutation.mutate({ id: property.id, sessionId })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {/* Property details */}
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            {property.bedrooms && (
                              <span className="flex items-center gap-1">
                                <BedDouble className="w-4 h-4" />
                                {property.bedrooms} BR
                              </span>
                            )}
                            {property.bathrooms && (
                              <span className="flex items-center gap-1">
                                <Bath className="w-4 h-4" />
                                {property.bathrooms} BA
                              </span>
                            )}
                            {property.propertyType && (
                              <Badge variant="outline" className="text-xs">
                                {property.propertyType}
                              </Badge>
                            )}
                          </div>

                          {/* Revenue metrics */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-emerald-50 rounded-lg p-3">
                              <p className="text-xs text-emerald-600 mb-1">Annual Revenue</p>
                              <p className="text-lg font-bold text-emerald-700">
                                {property.annualRevenue ? formatCurrency(property.annualRevenue) : '-'}
                              </p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-3">
                              <p className="text-xs text-blue-600 mb-1">Nightly Rate</p>
                              <p className="text-lg font-bold text-blue-700">
                                {property.averageDailyRate ? formatCurrency(property.averageDailyRate) : '-'}
                              </p>
                            </div>
                          </div>

                          {/* Occupancy and profit */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">
                              Booking Rate: {property.occupancyRate ? `${Math.round(Number(property.occupancyRate))}%` : '-'}
                            </span>
                            {property.estimatedProfit && (
                              <Badge className={property.estimatedProfit > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                                {property.estimatedProfit > 0 ? '+' : ''}{formatCurrency(property.estimatedProfit)}/yr profit
                              </Badge>
                            )}
                          </div>

                          {/* Notes */}
                          {property.notes && (
                            <p className="text-sm text-slate-600 bg-amber-50 p-2 rounded-lg">
                              {property.notes}
                            </p>
                          )}

                          {/* Saved date */}
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Saved {formatDate(property.createdAt)}
                            </span>
                            <Link href={`/?address=${encodeURIComponent(property.address || '')}`}>
                              <Button variant="ghost" size="sm" className="h-6 text-xs text-amber-600 hover:text-amber-700">
                                Re-analyze
                                <ExternalLink className="w-3 h-3 ml-1" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
