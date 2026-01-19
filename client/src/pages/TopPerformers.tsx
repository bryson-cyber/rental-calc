import { useState, useMemo } from 'react';
import { Link, useSearch } from 'wouter';
import { trpc } from '@/lib/trpc';
import { 
  ArrowLeft, 
  Trophy,
  Star,
  DollarSign,
  Percent,
  Users,
  Home,
  ExternalLink,
  Filter,
  Search,
  Loader2,
  Award,
  TrendingUp,
  Building,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ListingData {
  id: string;
  title: string;
  airbnb_url?: string;
  image_url?: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  property_type: string;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  superhost?: boolean;
  professionally_managed?: boolean;
  host_size?: string;
  latitude?: number | null;
  longitude?: number | null;
  zipcode?: string;
}

function ListingCard({ listing, rank }: { listing: ListingData; rank: number }) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-0">
        {/* Image */}
        <div className="h-40 bg-gradient-to-br from-[#0F172A]/10 to-[#0F172A]/20 relative">
          {listing.image_url ? (
            <img 
              src={listing.image_url} 
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Home className="w-10 h-10 text-[#0F172A]/30" />
            </div>
          )}
          
          {/* Rank Badge */}
          <div className={`absolute top-3 left-3 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
            rank <= 3 ? 'bg-[#C9A962] text-white' : 'bg-white/90 text-[#0F172A]'
          }`}>
            {rank <= 3 ? <Trophy className="w-5 h-5" /> : `#${rank}`}
          </div>

          {/* Badges */}
          <div className="absolute top-3 right-3 flex flex-col gap-1">
            {listing.superhost && (
              <Badge className="bg-[#C9A962] text-white text-xs">
                <Award className="w-3 h-3 mr-1" />
                Superhost
              </Badge>
            )}
            {listing.professionally_managed && (
              <Badge variant="secondary" className="text-xs">
                <Building className="w-3 h-3 mr-1" />
                Pro Managed
              </Badge>
            )}
          </div>
        </div>

        <div className="p-4">
          {/* Title */}
          <h3 className="font-semibold text-[#0F172A] line-clamp-2 mb-2 min-h-[48px]">
            {listing.title}
          </h3>

          {/* Property Details */}
          <div className="flex items-center gap-2 text-sm text-[#0F172A]/60 mb-3">
            <span>{listing.bedrooms} BR</span>
            <span>•</span>
            <span>{listing.bathrooms} BA</span>
            <span>•</span>
            <span>{listing.accommodates} guests</span>
          </div>

          {/* Rating */}
          {listing.rating && (
            <div className="flex items-center gap-1 mb-3">
              <Star className="w-4 h-4 text-[#C9A962] fill-[#C9A962]" />
              <span className="font-medium">{listing.rating.toFixed(2)}</span>
              <span className="text-[#0F172A]/60 text-sm">({listing.reviews} reviews)</span>
            </div>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                ${Math.round(listing.annual_revenue / 1000)}K
              </div>
              <div className="text-xs text-green-700">Revenue</div>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">
                ${Math.round(listing.adr)}
              </div>
              <div className="text-xs text-blue-700">ADR</div>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600">
                {Math.round(listing.occupancy)}%
              </div>
              <div className="text-xs text-purple-700">Occupancy</div>
            </div>
          </div>

          {/* View on Airbnb */}
          {listing.airbnb_url && (
            <a 
              href={listing.airbnb_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="outline" className="w-full" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                View on Airbnb
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TopPerformers() {
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);
  const initialMarketId = params.get('market') || '';

  const [marketSearch, setMarketSearch] = useState('');
  const [selectedMarketId, setSelectedMarketId] = useState(initialMarketId);
  const [selectedMarketName, setSelectedMarketName] = useState('');
  const [sortBy, setSortBy] = useState<'revenue' | 'adr' | 'occupancy' | 'rating' | 'reviews'>('revenue');
  const [superhostOnly, setSuperhostOnly] = useState(false);
  const [professionallyManaged, setProfessionallyManaged] = useState<boolean | undefined>(undefined);
  const [bedrooms, setBedrooms] = useState<string>('');
  const [minRating, setMinRating] = useState<string>('');

  // Search for markets
  const { data: searchResults, isLoading: isSearching } = trpc.rental.searchMarkets.useQuery(
    { searchTerm: marketSearch, limit: 10 },
    { enabled: marketSearch.length >= 2 }
  );

  // Get top performers
  const { data: performersData, isLoading: isLoadingPerformers } = trpc.advanced.getTopPerformers.useQuery(
    {
      marketId: selectedMarketId,
      limit: 25,
      sort_by: sortBy,
      superhost_only: superhostOnly,
      professionally_managed: professionallyManaged,
      bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
      min_rating: minRating ? parseFloat(minRating) : undefined,
    },
    { enabled: !!selectedMarketId }
  );

  const handleSelectMarket = (market: { id: string; name: string }) => {
    setSelectedMarketId(market.id);
    setSelectedMarketName(market.name);
    setMarketSearch('');
  };

  const stats = useMemo(() => {
    if (!performersData?.data?.listings || performersData.data.listings.length === 0) return null;
    
    const listings = performersData.data.listings;
    const avgRevenue = listings.reduce((sum, l) => sum + l.annual_revenue, 0) / listings.length;
    const avgAdr = listings.reduce((sum, l) => sum + l.adr, 0) / listings.length;
    const avgOccupancy = listings.reduce((sum, l) => sum + l.occupancy, 0) / listings.length;
    const superhostCount = listings.filter(l => l.superhost).length;
    
    return { avgRevenue, avgAdr, avgOccupancy, superhostCount, totalCount: performersData.data.total_count };
  }, [performersData?.data]);

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Header */}
      <div className="bg-[#0F172A] text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#C9A962]/20 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-[#C9A962]" />
            </div>
            <span className="text-[#C9A962] text-sm font-medium uppercase tracking-wider">Top Performers</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-serif font-semibold mb-2">
            Find the Highest-Earning Listings
          </h1>
          <p className="text-white/70 max-w-2xl">
            Discover the top-performing Airbnb listings in any market. Learn from the best to optimize your own property.
          </p>
        </div>
      </div>

      {/* Market Search */}
      <div className="bg-white border-b border-[#0F172A]/10 py-4 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[250px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F172A]/40" />
              <Input
                placeholder="Search for a market..."
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                className="pl-10"
              />
              
              {/* Search Results Dropdown */}
              {marketSearch.length >= 2 && searchResults?.data && searchResults.data.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#0F172A]/10 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {searchResults.data.map((market) => (
                    <button
                      key={market.id}
                      onClick={() => handleSelectMarket(market)}
                      className="w-full px-4 py-2 text-left hover:bg-[#0F172A]/5 flex items-center justify-between"
                    >
                      <span className="font-medium text-[#0F172A]">{market.name}</span>
                      <span className="text-sm text-[#0F172A]/60">{market.listing_count.toLocaleString()} listings</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {selectedMarketName && (
              <Badge variant="secondary" className="text-base py-1.5 px-4">
                {selectedMarketName}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      {selectedMarketId && (
        <div className="bg-white border-b border-[#0F172A]/10 py-4 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center gap-4">
              {/* Sort By */}
              <div className="flex items-center gap-2">
                <Label className="text-sm text-[#0F172A]/60">Sort by:</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="adr">ADR</SelectItem>
                    <SelectItem value="occupancy">Occupancy</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                    <SelectItem value="reviews">Reviews</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bedrooms */}
              <div className="flex items-center gap-2">
                <Label className="text-sm text-[#0F172A]/60">Bedrooms:</Label>
                <Select value={bedrooms} onValueChange={setBedrooms}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n} BR</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Min Rating */}
              <div className="flex items-center gap-2">
                <Label className="text-sm text-[#0F172A]/60">Min Rating:</Label>
                <Select value={minRating} onValueChange={setMinRating}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="4.5">4.5+</SelectItem>
                    <SelectItem value="4.7">4.7+</SelectItem>
                    <SelectItem value="4.9">4.9+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Superhost Only */}
              <div className="flex items-center gap-2">
                <Switch
                  id="superhost"
                  checked={superhostOnly}
                  onCheckedChange={setSuperhostOnly}
                />
                <Label htmlFor="superhost" className="text-sm cursor-pointer">Superhosts only</Label>
              </div>

              {/* Pro Managed */}
              <div className="flex items-center gap-2">
                <Switch
                  id="pro-managed"
                  checked={professionallyManaged === true}
                  onCheckedChange={(checked) => setProfessionallyManaged(checked ? true : undefined)}
                />
                <Label htmlFor="pro-managed" className="text-sm cursor-pointer">Pro managed</Label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {stats && (
        <div className="bg-[#0F172A]/5 py-4 px-4">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <Trophy className="w-5 h-5 text-[#C9A962]" />
              </div>
              <div>
                <div className="text-sm text-[#0F172A]/60">Total Found</div>
                <div className="font-semibold text-[#0F172A]">{stats.totalCount.toLocaleString()}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-sm text-[#0F172A]/60">Avg Revenue</div>
                <div className="font-semibold text-[#0F172A]">${Math.round(stats.avgRevenue / 1000)}K</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-sm text-[#0F172A]/60">Avg ADR</div>
                <div className="font-semibold text-[#0F172A]">${Math.round(stats.avgAdr)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <Percent className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <div className="text-sm text-[#0F172A]/60">Avg Occupancy</div>
                <div className="font-semibold text-[#0F172A]">{Math.round(stats.avgOccupancy * 100)}%</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <Award className="w-5 h-5 text-[#C9A962]" />
              </div>
              <div>
                <div className="text-sm text-[#0F172A]/60">Superhosts</div>
                <div className="font-semibold text-[#0F172A]">{stats.superhostCount}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {!selectedMarketId ? (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-[#0F172A]/20" />
            <h2 className="text-xl font-semibold text-[#0F172A] mb-2">Select a Market</h2>
            <p className="text-[#0F172A]/60">Search for a market above to discover top-performing listings</p>
          </div>
        ) : isLoadingPerformers ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
            <span className="ml-3 text-[#0F172A]/60">Loading top performers...</span>
          </div>
        ) : !performersData?.data?.listings || performersData.data.listings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#0F172A]/60">No listings found matching your criteria. Try adjusting the filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {performersData.data.listings.map((listing, index) => (
              <ListingCard key={listing.id} listing={listing} rank={index + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
