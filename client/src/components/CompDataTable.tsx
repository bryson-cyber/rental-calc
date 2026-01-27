import { useState, useMemo, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  BedDouble, 
  Bath, 
  Users, 
  Star,
  SlidersHorizontal,
  Loader2
} from 'lucide-react';

interface CompDataTableProps {
  submarketId: string;
  marketName: string;
  isMarketLevel?: boolean;
}

export function CompDataTable({ 
  submarketId, 
  marketName,
  isMarketLevel = false
}: CompDataTableProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [orderBy, setOrderBy] = useState<'revenue' | 'adr' | 'occupancy' | 'rating'>('revenue');
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc');
  const [bedroomFilter, setBedroomFilter] = useState<number | undefined>(undefined);
  const pageSize = 25;

  // Reset to page 1 when filters change
  const handleBedroomChange = (value: string) => {
    const newFilter = value ? parseInt(value) : undefined;
    setBedroomFilter(newFilter);
    setCurrentPage(1);
  };

  // Always fetch all listings for client-side filtering
  const { data: allData, isLoading, error } = trpc.compData.getAllListings.useQuery(
    {
      submarketId,
      isMarketLevel,
      maxListings: 500,
      bedrooms: undefined, // Don't pass to API, we'll filter client-side
    },
    {
      refetchOnWindowFocus: false,
      staleTime: 60000, // Cache for 1 minute
    }
  );

  // Get raw listings from the query
  const rawListings = allData?.listings || [];
  const marketTotalCount = allData?.marketTotalCount || rawListings.length;

  // Debug logging - use useEffect to avoid re-logging on every render
  useEffect(() => {
    console.log('[CompDataTable] bedroomFilter changed to:', bedroomFilter);
    console.log('[CompDataTable] rawListings count:', rawListings.length);
    if (rawListings.length > 0) {
      console.log('[CompDataTable] first 3 listings:', rawListings.slice(0, 3).map((l: any) => ({
        title: l.title?.substring(0, 30),
        bedrooms: l.bedrooms
      })));
      // Count listings by bedroom
      const bedroomCounts: Record<number, number> = {};
      rawListings.forEach((l: any) => {
        bedroomCounts[l.bedrooms] = (bedroomCounts[l.bedrooms] || 0) + 1;
      });
      console.log('[CompDataTable] bedroom distribution:', bedroomCounts);
    }
  }, [bedroomFilter, rawListings]);

  // Apply client-side bedroom filter
  const filteredListings = useMemo(() => {
    if (!bedroomFilter) return rawListings;
    
    return rawListings.filter((listing: any) => {
      if (bedroomFilter === 5) {
        // 5+ means 5 or more bedrooms
        return listing.bedrooms >= 5;
      }
      return listing.bedrooms === bedroomFilter;
    });
  }, [rawListings, bedroomFilter]);

  // Apply client-side sorting
  const sortedListings = useMemo(() => {
    return [...filteredListings].sort((a: any, b: any) => {
      let aVal = a[orderBy === 'revenue' ? 'annual_revenue' : orderBy];
      let bVal = b[orderBy === 'revenue' ? 'annual_revenue' : orderBy];
      if (orderDirection === 'desc') {
        return bVal - aVal;
      }
      return aVal - bVal;
    });
  }, [filteredListings, orderBy, orderDirection]);

  // Apply client-side pagination
  const totalCount = sortedListings.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const listings = sortedListings.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    const percent = value > 1 ? value : value * 100;
    return `${Math.round(percent)}%`;
  };

  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            <span className="ml-3 text-gray-600">Loading listings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="text-center py-12 text-red-600">
            Error loading listings. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">What are successful properties doing?</h3>
            <p className="text-sm text-gray-500 mt-1">
              {bedroomFilter ? (
                <>Showing {listings.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount} {bedroomFilter === 5 ? '5+ BR' : `${bedroomFilter} BR`} listings (from {marketTotalCount.toLocaleString()} total in market)</>
              ) : (
                <>Showing {listings.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0}-{Math.min(currentPage * pageSize, totalCount)} of {rawListings.length} sample listings ({marketTotalCount.toLocaleString()} total in market)</>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={orderBy}
                  onChange={(e) => setOrderBy(e.target.value as typeof orderBy)}
                >
                  <option value="revenue">Annual Income</option>
                  <option value="adr">Nightly Rate</option>
                  <option value="occupancy">Booking Rate</option>
                  <option value="rating">Rating</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={orderDirection}
                  onChange={(e) => setOrderDirection(e.target.value as typeof orderDirection)}
                >
                  <option value="desc">High to Low</option>
                  <option value="asc">Low to High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">All Types</option>
                  <option value="house">House</option>
                  <option value="apartment">Apartment</option>
                  <option value="condo">Condo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={bedroomFilter ?? ''}
                  onChange={(e) => handleBedroomChange(e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="1">1 BR</option>
                  <option value="2">2 BR</option>
                  <option value="3">3 BR</option>
                  <option value="4">4 BR</option>
                  <option value="5">5+ BR</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Listings Grid */}
        <div className="space-y-4">
          {listings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {bedroomFilter ? (
                <>No {bedroomFilter === 5 ? '5+ bedroom' : `${bedroomFilter} bedroom`} listings found in this market. Try a different filter.</>
              ) : (
                <>No listings found in this market.</>
              )}
            </div>
          ) : (
            listings.map((listing: any, index: number) => (
              <div 
                key={listing.id || index}
                className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-amber-200 transition-colors"
              >
                {/* Image */}
                <div className="w-32 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200">
                  {listing.image_url ? (
                    <img 
                      src={listing.image_url} 
                      alt={listing.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/128x96?text=No+Image';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <BedDouble className="w-8 h-8" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-gray-900 truncate">{listing.title}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <BedDouble className="w-4 h-4" />
                          {listing.bedrooms} BR
                        </span>
                        <span className="flex items-center gap-1">
                          <Bath className="w-4 h-4" />
                          {listing.bathrooms} BA
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {listing.accommodates} Guests
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {listing.is_superhost && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          Top Host
                        </Badge>
                      )}
                      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                        {listing.property_type || 'House'}
                      </Badge>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-4 mt-3">
                    <div className="relative group">
                      <div className="text-xs text-gray-500 cursor-help border-b border-dotted border-gray-400 inline-block">Yearly Income</div>
                      <div className="font-semibold text-green-600">{formatCurrency(listing.annual_revenue)}</div>
                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-48 pointer-events-none">
                        <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-lg">
                          Estimated yearly income from this property based on bookings and rates
                          <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
                        </div>
                      </div>
                    </div>
                    <div className="relative group">
                      <div className="text-xs text-gray-500 cursor-help border-b border-dotted border-gray-400 inline-block">Nightly Rate</div>
                      <div className="font-medium text-gray-900">{formatCurrency(listing.adr)}</div>
                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-48 pointer-events-none">
                        <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-lg">
                          The typical price per night this property charges
                          <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
                        </div>
                      </div>
                    </div>
                    <div className="relative group">
                      <div className="text-xs text-gray-500 cursor-help border-b border-dotted border-gray-400 inline-block">Booking Rate</div>
                      <div className="font-medium text-gray-900">{formatPercent(listing.occupancy)}</div>
                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-48 pointer-events-none">
                        <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-lg">
                          How often this property is booked. 70%+ is excellent
                          <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
                        </div>
                      </div>
                    </div>
                    <div className="relative group">
                      <div className="text-xs text-gray-500 cursor-help border-b border-dotted border-gray-400 inline-block">Rating</div>
                      <div className="font-medium text-gray-900 flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        {listing.rating?.toFixed(1) || 'N/A'} ({listing.reviews || 0})
                      </div>
                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-48 pointer-events-none">
                        <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-lg">
                          Guest rating (out of 5) and total reviews. Higher ratings = better guest experience
                          <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Link */}
                  <a 
                    href={listing.airbnb_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-sm text-amber-600 hover:text-amber-700"
                  >
                    View on Airbnb <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
