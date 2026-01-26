import { useState } from 'react';
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
  isMarketLevel?: boolean; // true = city/metro level, false = neighborhood level
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
  const pageSize = 25;

  // Fetch listings using tRPC
  const { data, isLoading, error } = trpc.compData.getListings.useQuery({
    submarketId,
    isMarketLevel, // Pass whether this is a market-level or submarket-level query
    page: currentPage,
    pageSize,
    orderBy,
    orderDirection,
  });

  const listings = data?.listings || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    // Handle both decimal (0.73) and percentage (73) formats
    const percent = value > 1 ? value : value * 100;
    return `${Math.round(percent)}%`;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
            <span className="ml-3 text-gray-600">Loading property listings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="text-center py-12 text-red-500">
            Failed to load listings. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (listings.length === 0) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="text-center py-12 text-gray-500">
            No listings found for this market.
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
            <h3 className="text-xl font-semibold text-gray-900">Comp Data - {marketName}</h3>
            <p className="text-sm text-gray-500 mt-1">
              Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount} listings
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

        {/* Filters (placeholder for now) */}
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
                  <option value="revenue">Revenue</option>
                  <option value="adr">ADR</option>
                  <option value="occupancy">Occupancy</option>
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
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">Any</option>
                  <option value="1">1 BR</option>
                  <option value="2">2 BR</option>
                  <option value="3">3 BR</option>
                  <option value="4">4+ BR</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Listings Grid */}
        <div className="space-y-4">
          {listings.map((listing: any) => (
            <div 
              key={listing.id}
              className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-[#C9A962]/50 transition-colors"
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
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    No Image
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900 truncate">{listing.title}</h4>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <BedDouble className="w-3.5 h-3.5" />
                        {listing.bedrooms} BR
                      </span>
                      <span className="flex items-center gap-1">
                        <Bath className="w-3.5 h-3.5" />
                        {listing.bathrooms} BA
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {listing.accommodates} Guests
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {listing.is_superhost && (
                      <Badge variant="secondary" className="bg-[#C9A962]/10 text-[#C9A962] border-[#C9A962]/20">
                        Superhost
                      </Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {listing.property_type}
                    </Badge>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-gray-500">Annual Revenue</p>
                    <p className="font-semibold text-emerald-600">{formatCurrency(listing.annual_revenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">ADR</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(listing.adr)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Occupancy</p>
                    <p className="font-semibold text-gray-900">{formatPercent(listing.occupancy)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Rating</p>
                    <p className="font-semibold text-gray-900 flex items-center gap-1">
                      {listing.rating ? (
                        <>
                          <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                          {listing.rating.toFixed(1)} ({listing.reviews})
                        </>
                      ) : (
                        <span className="text-gray-400">No rating</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Airbnb Link */}
                {listing.airbnb_url && (
                  <a 
                    href={listing.airbnb_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[#C9A962] hover:text-[#B8984F] mt-3"
                  >
                    View on Airbnb
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className={currentPage === pageNum ? "bg-[#C9A962] hover:bg-[#B8984F]" : ""}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
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
