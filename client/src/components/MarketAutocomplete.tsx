import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Building2, Loader2, Navigation } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

// Helper to detect if input is a US zip code (5 digits)
const isZipCode = (input: string): boolean => {
  return /^\d{5}$/.test(input.trim());
};

interface MarketResult {
  id: string;
  name: string;
  type: 'market' | 'submarket';
  listingCount: number;
  state?: string;
  country?: string;
  parentMarket?: { id: string; name: string };
  zipcodes: string[];
}

interface MarketAutocompleteProps {
  onSelect: (market: MarketResult) => void;
  placeholder?: string;
  className?: string;
}

export function MarketAutocomplete({ 
  onSelect, 
  placeholder = "Search city, neighborhood, or zip code...",
  className 
}: MarketAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<MarketResult | null>(null);
  const [zipLookupResult, setZipLookupResult] = useState<MarketResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search query
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Check if current query is a zip code
  const queryIsZipCode = isZipCode(debouncedQuery);

  // Search markets using tRPC (for city/neighborhood search)
  const { data: results, isLoading: isSearchLoading } = trpc.marketExplorer.searchMarkets.useQuery(
    { query: debouncedQuery, limit: 10 },
    { enabled: debouncedQuery.length >= 2 && !queryIsZipCode }
  );

  // Zip code lookup using tRPC
  const { data: zipResult, isLoading: isZipLoading } = trpc.rental.geocodeZipCode.useQuery(
    { zipcode: debouncedQuery.trim() },
    { enabled: queryIsZipCode }
  );

  // Process zip code result into MarketResult format
  useEffect(() => {
    if (zipResult?.success && (zipResult.market || zipResult.submarket)) {
      // Prefer submarket if available, otherwise use market
      const marketData = zipResult.submarket || zipResult.market;
      if (marketData) {
        const result: MarketResult = {
          id: marketData.id,
          name: `${zipResult.city || marketData.name}, ${zipResult.stateCode || zipResult.state || ''}`.trim(),
          type: zipResult.submarket ? 'submarket' : 'market',
          listingCount: marketData.listingCount,
          state: zipResult.stateCode || zipResult.state,
          country: 'US',
          parentMarket: zipResult.submarket && zipResult.market ? {
            id: zipResult.market.id,
            name: zipResult.market.name
          } : undefined,
          zipcodes: [debouncedQuery.trim()]
        };
        setZipLookupResult(result);
      }
    } else {
      setZipLookupResult(null);
    }
  }, [zipResult, debouncedQuery]);

  const isLoading = isSearchLoading || isZipLoading;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (market: MarketResult) => {
    setSelectedMarket(market);
    setQuery(market.name);
    setIsOpen(false);
    onSelect(market);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedMarket(null);
    setZipLookupResult(null);
    setIsOpen(true);
  };

  const handleClear = () => {
    setQuery('');
    setSelectedMarket(null);
    setZipLookupResult(null);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Determine what results to show
  const displayResults = queryIsZipCode 
    ? (zipLookupResult ? [zipLookupResult] : [])
    : (results || []);

  const hasResults = displayResults.length > 0;
  const showNoResults = isOpen && debouncedQuery.length >= 2 && !isLoading && !hasResults;

  return (
    <div className={cn("relative", className)}>
      {/* Input Field */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-12 pr-10 py-4 bg-white border border-neutral-200 rounded-xl text-base focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none transition-all"
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500 animate-spin" />
        )}
        {query && !isLoading && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 hover:text-neutral-600"
          >
            ×
          </button>
        )}
      </div>

      {/* Selected Market Info */}
      {selectedMarket && selectedMarket.zipcodes.length > 0 && (
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">{selectedMarket.name}, {selectedMarket.state}</span>
            <span className="text-amber-600">•</span>
            <span className="text-amber-600">{selectedMarket.listingCount.toLocaleString()} properties</span>
          </div>
          <div className="mt-1 text-xs text-amber-700">
            <span className="font-medium">Zip codes: </span>
            {selectedMarket.zipcodes.slice(0, 8).join(', ')}
            {selectedMarket.zipcodes.length > 8 && ` +${selectedMarket.zipcodes.length - 8} more`}
          </div>
        </div>
      )}

      {/* Dropdown Results */}
      {isOpen && hasResults && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white border border-neutral-200 rounded-xl shadow-lg max-h-80 overflow-y-auto"
        >
          {/* Zip code result header */}
          {queryIsZipCode && zipLookupResult && (
            <div className="px-4 py-2 bg-teal-50 border-b border-teal-100">
              <div className="flex items-center gap-2 text-xs text-teal-700">
                <Navigation className="w-3 h-3" />
                <span>Found market for zip code <strong>{debouncedQuery}</strong></span>
              </div>
            </div>
          )}
          
          {displayResults.map((market) => (
            <button
              key={market.id}
              onClick={() => handleSelect(market)}
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-neutral-50 transition-colors text-left border-b border-neutral-100 last:border-b-0"
            >
              <div className="mt-0.5">
                {market.type === 'market' ? (
                  <MapPin className="w-5 h-5 text-amber-500" />
                ) : (
                  <Building2 className="w-5 h-5 text-teal-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-900 truncate">
                    {market.name}
                  </span>
                  {market.parentMarket && (
                    <span className="text-xs text-neutral-500">
                      in {market.parentMarket.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <span>{market.state}</span>
                  <span>•</span>
                  <span>{market.listingCount.toLocaleString()} properties</span>
                  {market.type === 'submarket' && (
                    <>
                      <span>•</span>
                      <span className="text-teal-600 text-xs font-medium">Neighborhood</span>
                    </>
                  )}
                </div>
                {market.zipcodes.length > 0 && (
                  <div className="text-xs text-neutral-400 mt-1">
                    Zip: {market.zipcodes.slice(0, 5).join(', ')}
                    {market.zipcodes.length > 5 && '...'}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {showNoResults && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white border border-neutral-200 rounded-xl shadow-lg p-4 text-center text-neutral-500"
        >
          {queryIsZipCode ? (
            <div>
              <p>No market found for zip code "{debouncedQuery}"</p>
              <p className="text-xs mt-1">Try searching by city name instead</p>
            </div>
          ) : (
            <p>No markets found for "{debouncedQuery}"</p>
          )}
        </div>
      )}
    </div>
  );
}

export default MarketAutocomplete;
