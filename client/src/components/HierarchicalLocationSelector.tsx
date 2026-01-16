/**
 * Hierarchical Location Selector
 * 
 * Cascading dropdown for: State → City/Market → Submarket → Zip Code
 * Each level shows data at that specificity when selected.
 * Includes search buttons at each level and a reset button.
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { ChevronDown, MapPin, Building2, Map, Hash, X, Loader2, Search, RotateCcw } from 'lucide-react';

// Skeleton loading component with pulse animation
const Skeleton = ({ className = '' }: { className?: string }) => (
  <div 
    className={`animate-pulse bg-gradient-to-r from-[oklch(0.92_0_0)] via-[oklch(0.96_0_0)] to-[oklch(0.92_0_0)] bg-[length:200%_100%] rounded ${className}`}
    style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
  />
);

// Add shimmer keyframes to document if not already present
if (typeof document !== 'undefined') {
  const styleId = 'skeleton-shimmer-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

// Error message component with retry button
const ErrorMessage = ({ 
  message, 
  onRetry 
}: { 
  message: string; 
  onRetry: () => void;
}) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span className="flex-1">{message}</span>
    <button
      onClick={onRetry}
      className="flex items-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-red-800 font-medium transition-colors"
    >
      <RotateCcw className="w-3 h-3" />
      Retry
    </button>
  </div>
);

// US States list
const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'Washington D.C.' },
];

interface Market {
  id: string;
  name: string;
  listingCount: number;
  locationName?: string;
  state?: string;
  type?: string;
  isVirtual?: boolean;
  virtualSubmarkets?: string[];
  isSubmarketAsMarket?: boolean;
  zipcodes?: string[];
}

interface Submarket {
  id: string;
  name: string;
  listingCount: number;
  revenue?: number;
  occupancy?: number;
  zipcodes?: string[];  // Zip codes fetched via search API
}

interface LocationSelection {
  level: 'state' | 'market' | 'submarket' | 'zipcode';
  state?: { code: string; name: string };
  market?: Market;
  submarket?: Submarket;
  zipcode?: string;
}

interface HierarchicalLocationSelectorProps {
  onSelectionChange: (selection: LocationSelection | null) => void;
  onSearch: (selection: LocationSelection) => void;
  disabled?: boolean;
}

export function HierarchicalLocationSelector({
  onSelectionChange,
  onSearch,
  disabled = false
}: HierarchicalLocationSelectorProps) {
  // Selection state
  const [selectedState, setSelectedState] = useState<{ code: string; name: string } | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedSubmarket, setSelectedSubmarket] = useState<Submarket | null>(null);
  const [selectedZipcode, setSelectedZipcode] = useState<string | null>(null);
  
  // Dropdown open state
  const [stateOpen, setStateOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [submarketOpen, setSubmarketOpen] = useState(false);
  const [zipcodeOpen, setZipcodeOpen] = useState(false);
  
  // Data state
  const [markets, setMarkets] = useState<Market[]>([]);
  const [submarkets, setSubmarkets] = useState<Submarket[]>([]);
  const [zipcodes, setZipcodes] = useState<{ zipcode: string; listingCount: number }[]>([]);
  
  // Search state
  const [marketSearchQuery, setMarketSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Market[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Loading state
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [loadingSubmarkets, setLoadingSubmarkets] = useState(false);
  const [loadingZipcodes, setLoadingZipcodes] = useState(false);
  const [zipcodeLoadTime, setZipcodeLoadTime] = useState<number | null>(null);
  
  // Error state
  const [marketError, setMarketError] = useState<string | null>(null);
  const [submarketError, setSubmarketError] = useState<string | null>(null);
  const [zipcodeError, setZipcodeError] = useState<string | null>(null);
  
  // TRPC mutations
  const searchMarkets = trpc.marketResearchSimple.searchMarkets.useMutation();
  const getSubmarkets = trpc.marketResearchSimple.getSubmarkets.useMutation();
  const getZipcodes = trpc.marketResearchSimple.getZipcodesInSubmarket.useMutation();
  
  // Fetch markets when state is selected
  // Major cities by state to search for markets
  const MAJOR_CITIES: Record<string, string[]> = {
    'AZ': ['Phoenix', 'Tucson', 'Scottsdale', 'Mesa', 'Flagstaff', 'Sedona', 'Glendale', 'Tempe', 'Chandler', 'Gilbert', 'Peoria'],
    'CA': ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'Oakland', 'Palm Springs', 'Santa Barbara', 'Napa'],
    'CO': ['Denver', 'Boulder', 'Colorado Springs', 'Aspen', 'Vail', 'Fort Collins'],
    'FL': ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale', 'Naples', 'Key West', 'Destin'],
    'GA': ['Atlanta', 'Savannah', 'Augusta', 'Athens'],
    'HI': ['Honolulu', 'Maui', 'Kauai', 'Big Island', 'Oahu'],
    'IL': ['Chicago', 'Springfield', 'Naperville'],
    'LA': ['New Orleans', 'Baton Rouge', 'Lafayette'],
    'MA': ['Boston', 'Cambridge', 'Cape Cod', 'Martha\'s Vineyard'],
    'MI': ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Traverse City'],
    'MO': ['St. Louis', 'Springfield', 'Missouri'], // Only St. Louis and Springfield have market-level entries; 'Missouri' gets the Missouri Area market
    'NC': ['Charlotte', 'Raleigh', 'Asheville', 'Wilmington', 'Durham'],
    'NV': ['Las Vegas', 'Reno', 'Lake Tahoe'],
    'NY': ['New York', 'Buffalo', 'Albany', 'Rochester', 'Long Island', 'Hamptons'],
    'OH': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo'],
    'OR': ['Portland', 'Eugene', 'Bend', 'Salem'],
    'PA': ['Philadelphia', 'Pittsburgh', 'Harrisburg', 'Lancaster'],
    'SC': ['Charleston', 'Myrtle Beach', 'Columbia', 'Greenville', 'Hilton Head'],
    'TN': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Gatlinburg', 'Pigeon Forge'],
    'TX': ['Austin', 'Houston', 'Dallas', 'San Antonio', 'Fort Worth', 'El Paso', 'Galveston'],
    'UT': ['Salt Lake City', 'Park City', 'Moab', 'St. George'],
    'VA': ['Virginia Beach', 'Richmond', 'Norfolk', 'Arlington', 'Alexandria'],
    'WA': ['Seattle', 'Tacoma', 'Spokane', 'Bellevue'],
  };

  // Define virtual markets for cities that only exist as submarkets in AirDNA
  // These will be created by grouping orphaned submarkets under a virtual market
  const VIRTUAL_MARKETS: Record<string, { name: string; searchTerms: string[] }> = {
    'MO': { name: 'Kansas City Area', searchTerms: ['Kansas City', 'Midtown Westport', 'Independence', 'Grandview'] },
    'TN': { name: 'Nashville Area', searchTerms: ['Nashville'] },
    'NC': { name: 'Charlotte Area', searchTerms: ['Charlotte'] },
  };

  // SPECIAL MARKET MAPPINGS: For states where the AirDNA search API returns poor results
  // These markets exist in AirDNA but aren't returned by the search API
  const SPECIAL_MARKET_IDS: Record<string, Array<{ id: string; name: string; listingCount: number }>> = {
    'UT': [
      { id: 'airdna-22', name: 'Park City', listingCount: 4500 },
      { id: 'airdna-495', name: 'Salt Lake City', listingCount: 3200 },
      { id: 'airdna-326', name: 'Utah Area', listingCount: 7997 },
    ],
    'DC': [
      { id: 'airdna-402', name: 'Washington DC', listingCount: 8500 },
    ],
  };

  useEffect(() => {
    if (!selectedState) {
      setMarkets([]);
      return;
    }
    
    const fetchMarkets = async () => {
      setLoadingMarkets(true);
      setMarketError(null); // Clear any previous error
      try {
        // SPECIAL HANDLING: For states with known search issues (Utah, DC), use direct market IDs
        const specialMarkets = SPECIAL_MARKET_IDS[selectedState.code];
        if (specialMarkets && specialMarkets.length > 0) {
          console.log(`[HierarchicalLocationSelector] Using special market mappings for ${selectedState.code}`);
          const marketsWithState = specialMarkets.map(m => ({
            ...m,
            type: 'market' as const,
            state: selectedState.name,
            locationName: `${m.name}, ${selectedState.name}, United States`
          }));
          setMarkets(marketsWithState);
          setLoadingMarkets(false);
          return;
        }
        
        // Get major cities for this state, or use state name as fallback
        const citiesToSearch = MAJOR_CITIES[selectedState.code] || [selectedState.name];
        
        // Search for each city and collect unique markets
        const allMarkets: Market[] = [];
        const seenIds = new Set<string>();
        const orphanedSubmarkets: any[] = [];
        
        for (const city of citiesToSearch) {
          try {
            const response = await searchMarkets.mutateAsync({ query: city });
            // Handle both array and wrapped response formats
            const results = Array.isArray(response) ? response : ((response as any)?.data || response || []);
            
            // Separate markets and submarkets
            for (const result of results) {
              // Strict state matching - only include results that match the selected state
              const stateName = selectedState.name.toLowerCase();
              const stateCode = selectedState.code.toLowerCase();
              const resultState = (result.state || '').toLowerCase();
              const resultLocation = (result.locationName || '').toLowerCase();
              
              // Debug: Log what we're checking
              console.log(`[StateFilter] Checking ${result.name}: state="${result.state}", location="${result.locationName}", selectedState="${selectedState.name}" (${selectedState.code})`);
              
              // Check if result matches the selected state
              // Must have explicit state match - don't include results without state info
              const matchesStateField = resultState && (
                resultState === stateName ||
                resultState === stateCode ||
                resultState.includes(stateName) ||
                resultState.includes(stateCode)
              );
              
              const matchesLocationField = resultLocation && (
                resultLocation.includes(`, ${stateName},`) ||
                resultLocation.includes(`, ${stateCode},`) ||
                resultLocation.endsWith(`, ${stateName}`) ||
                resultLocation.endsWith(`, ${stateCode}`) ||
                // Also check for state code at the end (e.g., "St. Louis, MO")
                resultLocation.endsWith(`, ${stateCode.toUpperCase()}`) ||
                resultLocation.includes(`, ${stateCode.toUpperCase()},`)
              );
              
              const matchesState = matchesStateField || matchesLocationField;
              
              console.log(`[StateFilter] ${result.name}: matchesStateField=${matchesStateField}, matchesLocationField=${matchesLocationField}, matchesState=${matchesState}`);
              
              if (!matchesState) {
                console.log(`[StateFilter] SKIPPING ${result.name} - does not match ${selectedState.name}`);
                continue;
              }
              
              if (result.type === 'market') {
                if (!seenIds.has(result.id)) {
                  seenIds.add(result.id);
                  allMarkets.push(result);
                }
              } else if (result.type === 'submarket') {
                // ENHANCEMENT: Also add submarkets as selectable "markets" in the City/Metro dropdown
                // This allows users to select cities like Glendale, AZ which are submarkets in AirDNA
                if (!seenIds.has(result.id)) {
                  seenIds.add(result.id);
                  // Add submarket as a market with its parent info for context
                  allMarkets.push({
                    ...result,
                    // Keep the original type for later processing
                    isSubmarketAsMarket: true,
                    // Include zipcodes from the search result
                    zipcodes: result.zipcodes || []
                  });
                }
                // Also collect for virtual market creation
                orphanedSubmarkets.push(result);
              }
            }
          } catch (error) {
            console.error(`Error searching for ${city}:`, error);
          }
        }
        
        // Check if we should create a virtual market for orphaned submarkets
        const virtualMarketConfig = VIRTUAL_MARKETS[selectedState.code];
        if (virtualMarketConfig && orphanedSubmarkets.length > 0) {
          // Check if we already have a market covering these submarkets
          const virtualMarketName = virtualMarketConfig.name;
          const hasExistingMarket = allMarkets.some(m => 
            m.name.toLowerCase().includes(virtualMarketName.toLowerCase().replace(' area', ''))
          );
          
          if (!hasExistingMarket) {
            // Create a virtual market that will show these orphaned submarkets
            const totalListings = orphanedSubmarkets.reduce((sum, s) => sum + (s.listingCount || 0), 0);
            const virtualMarket: Market = {
              id: `virtual-${selectedState.code}-${virtualMarketName.replace(/\s+/g, '-').toLowerCase()}`,
              name: virtualMarketName,
              type: 'market',
              listingCount: totalListings,
              state: selectedState.name,
              locationName: `${virtualMarketName}, ${selectedState.name}, United States`,
              isVirtual: true,
              virtualSubmarkets: orphanedSubmarkets.map(s => s.id)
            };
            allMarkets.push(virtualMarket as any);
            console.log(`[HierarchicalLocationSelector] Created virtual market: ${virtualMarketName} with ${orphanedSubmarkets.length} submarkets`);
          }
        }
        
        // Sort by listing count descending
        allMarkets.sort((a, b) => b.listingCount - a.listingCount);
        setMarkets(allMarkets);
      } catch (error) {
        console.error('Error fetching markets:', error);
        setMarkets([]);
        setMarketError('Failed to load cities. Please check your connection and try again.');
      } finally {
        setLoadingMarkets(false);
      }
    };
    
    fetchMarkets();
  }, [selectedState]);
  
  // Fetch submarkets when market is selected
  useEffect(() => {
    if (!selectedMarket) {
      setSubmarkets([]);
      return;
    }
    
    // If the selected market is actually a submarket (like Glendale, AZ), 
    // skip fetching submarkets and directly use the market's zipcodes
    if (selectedMarket.isSubmarketAsMarket) {
      console.log('[HierarchicalLocationSelector] Selected market is a submarket, skipping submarket fetch');
      setSubmarkets([]);
      // If the market has zipcodes, set them directly
      if (selectedMarket.zipcodes && selectedMarket.zipcodes.length > 0) {
        console.log(`[HierarchicalLocationSelector] Using ${selectedMarket.zipcodes.length} zipcodes from market:`, selectedMarket.zipcodes);
        setZipcodes(selectedMarket.zipcodes.map(z => ({ zipcode: z, listingCount: 0 })));
      }
      return;
    }
    
    const fetchSubmarkets = async () => {
      setLoadingSubmarkets(true);
      setSubmarketError(null); // Clear any previous error
      try {
        // Handle virtual markets differently - search for their submarkets
        if (selectedMarket.isVirtual && selectedMarket.virtualSubmarkets) {
          // For virtual markets, we already have the submarket IDs from the search
          // We need to fetch details for each one
          const virtualMarketName = selectedMarket.name.replace(' Area', '');
          const searchResults = await searchMarkets.mutateAsync({ query: virtualMarketName });
          
          // Filter to only submarkets in the selected state
          const stateSubmarkets = searchResults.filter(
            (r: any) => r.type === 'submarket' && 
              (r.state?.toLowerCase().includes(selectedState?.name.toLowerCase() || '') ||
               r.locationName?.toLowerCase().includes(selectedState?.name.toLowerCase() || ''))
          ).map((s: any) => ({
            id: s.id,
            name: s.name,
            listingCount: s.listingCount || 0,
            revenue: s.revenue,
            occupancy: s.occupancy
          }));
          
          // Sort alphabetically by name
          stateSubmarkets.sort((a: Submarket, b: Submarket) => a.name.localeCompare(b.name));
          setSubmarkets(stateSubmarkets);
        } else {
          // Regular market - fetch from API
          // Pass expectedState to validate submarkets match the selected state
          // This fixes the AirDNA data issue where Annapolis, MD shares the same ID as Salt Lake City, UT
          const results = await getSubmarkets.mutateAsync({ 
            marketId: selectedMarket.id,
            expectedState: selectedState?.name 
          });
          
          // If no submarkets returned (possibly due to state mismatch), treat the market as a submarket
          if (results.length === 0 && selectedMarket.zipcodes && selectedMarket.zipcodes.length > 0) {
            console.log('[HierarchicalLocationSelector] No valid submarkets found, using market zipcodes directly');
            setZipcodes(selectedMarket.zipcodes.map(z => ({ zipcode: z, listingCount: 0 })));
          }
          setSubmarkets(results);
        }
      } catch (error) {
        console.error('Error fetching submarkets:', error);
        setSubmarkets([]);
        setSubmarketError('Failed to load neighborhoods. Please try again.');
      } finally {
        setLoadingSubmarkets(false);
      }
    };
    
    fetchSubmarkets();
  }, [selectedMarket, selectedState]);
  
  // Fetch zip codes when submarket is selected
  useEffect(() => {
    if (!selectedSubmarket) {
      setZipcodes([]);
      return;
    }
    
    const fetchZipcodes = async () => {
      setLoadingZipcodes(true);
      setZipcodeError(null); // Clear any previous error
      setZipcodeLoadTime(null); // Reset load time
      const startTime = Date.now();
      
      try {
        // First, try to get zip codes from the submarket's existing data
        if (selectedSubmarket.zipcodes && selectedSubmarket.zipcodes.length > 0) {
          // Use existing zip codes from the submarket
          const zipResults = selectedSubmarket.zipcodes.map(zip => ({
            zipcode: zip,
            listingCount: 0 // Count not available from search results
          }));
          setZipcodes(zipResults);
          setZipcodeLoadTime(Date.now() - startTime);
          return;
        }
        
        // If no zip codes in submarket data, try the API
        try {
          const results = await getZipcodes.mutateAsync({ 
            submarketId: selectedSubmarket.id,
            marketId: selectedMarket?.id, // Pass market ID for fallback
            submarketListingCount: selectedSubmarket.listingCount || 0
          });
          if (results && results.length > 0) {
            setZipcodes(results);
            setZipcodeLoadTime(Date.now() - startTime);
            return;
          }
        } catch (apiError) {
          console.log('API zip code fetch failed, trying search fallback:', apiError);
        }
        
        // Fallback: Search for the submarket by name to get its zip codes
        // Include state name in search for more accurate results
        try {
          const stateContext = selectedState ? `, ${selectedState.name}` : '';
          const searchQuery = `${selectedSubmarket.name}${stateContext}`;
          console.log(`[ZipCodeFetch] Searching for: "${searchQuery}"`);
          const searchResponse = await searchMarkets.mutateAsync({ query: searchQuery });
          const searchResults = Array.isArray(searchResponse) ? searchResponse : ((searchResponse as any)?.data || searchResponse || []);
          
          // Find a matching result with zip codes, prioritizing state match
          for (const result of searchResults) {
            if (result.zipcodes && result.zipcodes.length > 0) {
              // Check if this result matches our submarket (by name similarity)
              const resultName = (result.name || result.locationName || '').toLowerCase();
              const submarketName = selectedSubmarket.name.toLowerCase();
              const resultState = (result.state || '').toLowerCase();
              
              // Check state match if we have a selected state
              const stateMatches = !selectedState || (
                resultState === selectedState.name.toLowerCase() ||
                resultState === selectedState.code.toLowerCase() ||
                resultState.includes(selectedState.name.toLowerCase())
              );
              
              if (stateMatches && (resultName.includes(submarketName) || submarketName.includes(resultName))) {
                console.log(`[ZipCodeFetch] Found match: ${result.name} in ${result.state} with ${result.zipcodes.length} zip codes`);
                const zipResults = result.zipcodes.map((zip: string) => ({
                  zipcode: zip,
                  listingCount: 0
                }));
                setZipcodes(zipResults);
                setZipcodeLoadTime(Date.now() - startTime);
                return;
              }
            }
          }
          
          // No matching zip codes found
          setZipcodes([]);
          setZipcodeLoadTime(Date.now() - startTime);
        } catch (searchError) {
          console.error('Search fallback failed:', searchError);
          setZipcodes([]);
          setZipcodeError('Failed to load zip codes. Please try again.');
        }
      } catch (error) {
        console.error('Error fetching zipcodes:', error);
        setZipcodes([]);
        setZipcodeError('Failed to load zip codes. Please try again.');
      } finally {
        setLoadingZipcodes(false);
      }
    };
    
    fetchZipcodes();
  }, [selectedSubmarket, selectedState]);
  
  // Notify parent of selection changes
  useEffect(() => {
    if (selectedZipcode) {
      onSelectionChange({
        level: 'zipcode',
        state: selectedState!,
        market: selectedMarket!,
        submarket: selectedSubmarket!,
        zipcode: selectedZipcode
      });
    } else if (selectedSubmarket) {
      onSelectionChange({
        level: 'submarket',
        state: selectedState!,
        market: selectedMarket!,
        submarket: selectedSubmarket
      });
    } else if (selectedMarket) {
      onSelectionChange({
        level: 'market',
        state: selectedState!,
        market: selectedMarket
      });
    } else if (selectedState) {
      onSelectionChange({
        level: 'state',
        state: selectedState
      });
    } else {
      onSelectionChange(null);
    }
  }, [selectedState, selectedMarket, selectedSubmarket, selectedZipcode]);
  
  // Handle state selection
  const handleStateSelect = (state: { code: string; name: string }) => {
    setSelectedState(state);
    setSelectedMarket(null);
    setSelectedSubmarket(null);
    setSelectedZipcode(null);
    setStateOpen(false);
  };
  
  // Handle market selection
  const handleMarketSelect = (market: Market) => {
    setSelectedMarket(market);
    setSelectedSubmarket(null);
    setSelectedZipcode(null);
    setMarketOpen(false);
  };
  
  // Handle submarket selection
  const handleSubmarketSelect = (submarket: Submarket) => {
    setSelectedSubmarket(submarket);
    setSelectedZipcode(null);
    setSubmarketOpen(false);
  };
  
  // Handle zipcode selection
  const handleZipcodeSelect = (zipcode: string) => {
    setSelectedZipcode(zipcode);
    setZipcodeOpen(false);
  };
  
  // Clear all selections (Reset All)
  const handleReset = () => {
    setSelectedState(null);
    setSelectedMarket(null);
    setSelectedSubmarket(null);
    setSelectedZipcode(null);
    setMarkets([]);
    setSubmarkets([]);
    setZipcodes([]);
    setStateOpen(false);
    setMarketOpen(false);
    setSubmarketOpen(false);
    setZipcodeOpen(false);
  };
  
  // Handle market search - filter predefined and search API for new cities
  // Debounce hook for search queries
  const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    
    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      
      return () => clearTimeout(handler);
    }, [value, delay]);
    
    return debouncedValue;
  };
  
  const debouncedSearchQuery = useDebounce(marketSearchQuery, 400);
  
  // Effect to handle debounced search - only trigger on search query changes
  useEffect(() => {
    // Skip if no search query
    if (!debouncedSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    let isCancelled = false;
    
    const performSearch = async () => {
      setIsSearching(true);
      try {
        // Filter predefined markets by search query
        const queryLower = debouncedSearchQuery.toLowerCase();
        const filteredPredefined = markets.filter(m => 
          m.name.toLowerCase().includes(queryLower)
        );
        
        // Search API for additional cities not in predefined list
        const apiResults = await searchMarkets.mutateAsync({ query: debouncedSearchQuery });
        
        // Don't update state if effect was cancelled
        if (isCancelled) return;
        
        const results = Array.isArray(apiResults) ? apiResults : ((apiResults as any)?.data || apiResults || []);
        
        // Filter to markets only and remove duplicates
        // Also filter by selected state if one is selected
        const apiMarkets = (results as any[]).filter(r => {
          // Must be a market or submarket
          if (r.type !== 'market' && r.type !== 'submarket') return false;
          
          // If a state is selected, filter by state
          if (selectedState) {
            const stateName = selectedState.name.toLowerCase();
            const stateCode = selectedState.code.toLowerCase();
            const resultState = (r.state || '').toLowerCase();
            const resultLocation = (r.locationName || '').toLowerCase();
            
            // Check if result matches the selected state
            const matchesStateField = resultState && (
              resultState === stateName ||
              resultState === stateCode ||
              resultState.includes(stateName) ||
              resultState.includes(stateCode)
            );
            
            const matchesLocationField = resultLocation && (
              resultLocation.includes(`, ${stateName},`) ||
              resultLocation.includes(`, ${stateCode},`) ||
              resultLocation.endsWith(`, ${stateName}`) ||
              resultLocation.endsWith(`, ${stateCode}`) ||
              resultLocation.endsWith(`, ${stateCode.toUpperCase()}`) ||
              resultLocation.includes(`, ${stateCode.toUpperCase()},`)
            );
            
            if (!matchesStateField && !matchesLocationField) {
              console.log(`[SearchFilter] SKIPPING ${r.name} - state="${r.state}", location="${r.locationName}" does not match ${selectedState.name}`);
              return false;
            }
          }
          
          return true;
        });
        const seenIds = new Set(filteredPredefined.map(m => m.id));
        const newApiMarkets = apiMarkets.filter(m => !seenIds.has(m.id));
        
        // Combine filtered predefined and new API results
        const combined = [...filteredPredefined, ...newApiMarkets];
        setSearchResults(combined);
      } catch (error) {
        if (!isCancelled) {
          console.error('Error searching markets:', error);
          setSearchResults([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    };
    
    performSearch();
    
    // Cleanup function to cancel if effect re-runs
    return () => {
      isCancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery]); // Only depend on debouncedSearchQuery - markets and searchMarkets are stable
  
  const handleMarketSearch = (query: string) => {
    setMarketSearchQuery(query);
  };
  
  // Handle search at current level
  const handleSearchAtLevel = (level: 'market' | 'submarket' | 'zipcode') => {
    if (level === 'zipcode' && selectedZipcode) {
      onSearch({
        level: 'zipcode',
        state: selectedState!,
        market: selectedMarket!,
        submarket: selectedSubmarket!,
        zipcode: selectedZipcode
      });
    } else if (level === 'submarket' && selectedSubmarket) {
      onSearch({
        level: 'submarket',
        state: selectedState!,
        market: selectedMarket!,
        submarket: selectedSubmarket
      });
    } else if (level === 'market' && selectedMarket) {
      onSearch({
        level: 'market',
        state: selectedState!,
        market: selectedMarket
      });
    }
  };
  
  // Check if any selection is made
  const hasSelection = selectedState || selectedMarket || selectedSubmarket || selectedZipcode;
  
  // Direct zip code search state
  const [directZipSearch, setDirectZipSearch] = useState('');
  const [directZipSearching, setDirectZipSearching] = useState(false);
  
  // Handle direct zip code search
  const handleDirectZipSearch = async () => {
    const zip = directZipSearch.trim();
    if (!zip || !/^\d{5}$/.test(zip)) {
      alert('Please enter a valid 5-digit zip code');
      return;
    }
    
    setDirectZipSearching(true);
    try {
      // Search for the zip code to find its market/submarket
      const response = await searchMarkets.mutateAsync({ query: zip });
      const results = Array.isArray(response) ? response : ((response as any)?.data || response || []);
      
      if (results.length > 0) {
        // Use the first result
        const result = results[0];
        
        // Set the zip code directly and trigger search
        setSelectedZipcode(zip);
        onSearch({
          level: 'zipcode',
          zipcode: zip,
          market: result.type === 'market' ? {
            id: result.id,
            name: result.name,
            listingCount: result.listing_count || 0
          } : undefined,
          submarket: result.type === 'submarket' ? {
            id: result.id,
            name: result.name,
            listingCount: result.listing_count || 0
          } : undefined
        });
      } else {
        alert(`No data found for zip code ${zip}. Try searching by city or state instead.`);
      }
    } catch (error) {
      console.error('Error searching zip code:', error);
      alert('Error searching zip code. Please try again.');
    } finally {
      setDirectZipSearching(false);
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Direct Zip Code Search */}
      <div className="bg-[oklch(0.98_0_0)] border border-[oklch(0.85_0_0)] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Hash className="w-4 h-4 text-[oklch(0.50_0_0)]" />
          <h3 className="text-sm font-medium text-[oklch(0.30_0_0)]">Quick Search by Zip Code</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={directZipSearch}
            onChange={(e) => setDirectZipSearch(e.target.value.replace(/\D/g, '').slice(0, 5))}
            onKeyDown={(e) => e.key === 'Enter' && handleDirectZipSearch()}
            placeholder="Enter 5-digit zip code"
            disabled={disabled || directZipSearching}
            className="flex-1 px-3 py-2 border border-[oklch(0.85_0_0)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(0.50_0.15_250)] disabled:opacity-50 disabled:cursor-not-allowed"
            maxLength={5}
          />
          <button
            onClick={handleDirectZipSearch}
            disabled={disabled || directZipSearching || directZipSearch.length !== 5}
            className="px-4 py-2 bg-[oklch(0.30_0_0)] text-white rounded-lg hover:bg-[oklch(0.25_0_0)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
          >
            {directZipSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Search
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-[oklch(0.50_0_0)] mt-2">Skip the hierarchical selection and search directly by zip code</p>
      </div>
      
      {/* OR Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[oklch(0.85_0_0)]"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-[oklch(0.50_0_0)]">Or browse by location</span>
        </div>
      </div>
      
      {/* Reset All Button - only show when there's a selection */}
      {hasSelection && (
        <div className="flex justify-end">
          <button
            onClick={handleReset}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-[oklch(0.50_0_0)] hover:text-[oklch(0.30_0_0)] hover:bg-[oklch(0.96_0_0)] rounded-lg transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset All
          </button>
        </div>
      )}
      
      {/* Selection breadcrumb */}
      {selectedState && (
        <div className="flex items-center gap-2 text-sm text-[oklch(0.50_0_0)] flex-wrap">
          <span className="font-medium">Selected:</span>
          <span className="bg-[oklch(0.96_0_0)] px-2 py-1 rounded">{selectedState.name}</span>
          {selectedMarket && (
            <>
              <span>→</span>
              <span className="bg-[oklch(0.96_0_0)] px-2 py-1 rounded">{selectedMarket.name}</span>
            </>
          )}
          {selectedSubmarket && (
            <>
              <span>→</span>
              <span className="bg-[oklch(0.96_0_0)] px-2 py-1 rounded">{selectedSubmarket.name}</span>
            </>
          )}
          {selectedZipcode && (
            <>
              <span>→</span>
              <span className="bg-[oklch(0.96_0_0)] px-2 py-1 rounded">{selectedZipcode}</span>
            </>
          )}
        </div>
      )}
      
      {/* Dropdown grid with search buttons */}
      <div className="space-y-3">
        {/* Row 1: State and City/Metro */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* State Dropdown with Reset Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <button
                onClick={() => !disabled && setStateOpen(!stateOpen)}
                disabled={disabled}
                className={`w-full h-14 px-4 flex items-center justify-between bg-white border rounded-xl transition-all ${
                  stateOpen ? 'border-[oklch(0.75_0.15_75)] ring-2 ring-[oklch(0.75_0.15_75)]/20' : 'border-[oklch(0.90_0_0)]'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[oklch(0.80_0_0)]'}`}
              >
                <div className="flex items-center gap-2">
                  <Map className="w-4 h-4 text-[oklch(0.50_0_0)]" />
                  <span className={selectedState ? 'text-[oklch(0.25_0_0)]' : 'text-[oklch(0.50_0_0)]'}>
                    {selectedState?.name || 'State'}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[oklch(0.50_0_0)] transition-transform ${stateOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {stateOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {US_STATES.map((state) => (
                    <button
                      key={state.code}
                      onClick={() => handleStateSelect(state)}
                      className={`w-full px-4 py-2.5 text-left hover:bg-[oklch(0.96_0_0)] transition-colors first:rounded-t-xl last:rounded-b-xl ${
                        selectedState?.code === state.code ? 'bg-[oklch(0.96_0_0)] font-medium' : ''
                      }`}
                    >
                      {state.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Reset State Button */}
            {selectedState && (
              <button
                onClick={() => {
                  setSelectedState(null);
                  setSelectedMarket(null);
                  setSelectedSubmarket(null);
                  setSelectedZipcode(null);
                  setMarkets([]);
                  setSubmarkets([]);
                  setZipcodes([]);
                }}
                disabled={disabled}
                className="h-14 w-14 flex items-center justify-center bg-white border border-[oklch(0.90_0_0)] text-[oklch(0.50_0_0)] rounded-xl transition-all hover:bg-[oklch(0.96_0_0)] hover:border-[oklch(0.80_0_0)]"
                title="Clear state selection"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Market/City Dropdown with Search */}
          <div className="space-y-2 flex-1">
            {/* Search Input - Always visible when state is selected */}
            {selectedState && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search cities..."
                  value={marketSearchQuery}
                  onChange={(e) => handleMarketSearch(e.target.value)}
                  disabled={disabled}
                  className="flex-1 h-10 px-3 border border-[oklch(0.90_0_0)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(0.75_0.15_75)]/20 disabled:opacity-50"
                />
              </div>
            )}
            
            {/* Market Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => !disabled && selectedState && setMarketOpen(!marketOpen)}
                disabled={disabled || !selectedState}
                className={`w-full h-14 px-4 flex items-center justify-between bg-white border rounded-xl transition-all ${
                  marketOpen ? 'border-[oklch(0.75_0.15_75)] ring-2 ring-[oklch(0.75_0.15_75)]/20' : 'border-[oklch(0.90_0_0)]'
                } ${disabled || !selectedState ? 'opacity-50 cursor-not-allowed' : 'hover:border-[oklch(0.80_0_0)]'}`}
              >
                <div className="flex items-center gap-2">
                  {loadingMarkets ? (
                    <Loader2 className="w-4 h-4 text-[oklch(0.50_0_0)] animate-spin" />
                  ) : (
                    <Building2 className="w-4 h-4 text-[oklch(0.50_0_0)]" />
                  )}
                  <span className={selectedMarket ? 'text-[oklch(0.25_0_0)]' : 'text-[oklch(0.50_0_0)]'}>
                    {loadingMarkets ? (
                      <Skeleton className="h-4 w-20" />
                    ) : (
                      selectedMarket?.name || 'City/Metro'
                    )}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[oklch(0.50_0_0)] transition-transform ${marketOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Error Message */}
              {marketError && (
                <div className="mt-2">
                  <ErrorMessage 
                    message={marketError} 
                    onRetry={() => {
                      setMarketError(null);
                      // Trigger re-fetch by toggling state
                      const currentState = selectedState;
                      setSelectedState(null);
                      setTimeout(() => setSelectedState(currentState), 0);
                    }} 
                  />
                </div>
              )}
              
              {/* Dropdown Menu */}
              {marketOpen && !marketError && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {marketSearchQuery ? (
                    isSearching ? (
                      <div className="px-4 py-8 text-center text-[oklch(0.50_0_0)] text-sm">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Searching...
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((market) => (
                        <button
                          key={market.id}
                          onClick={() => handleMarketSelect(market)}
                          className={`w-full px-4 py-2.5 text-left hover:bg-[oklch(0.96_0_0)] transition-colors ${selectedMarket?.id === market.id ? 'bg-[oklch(0.96_0_0)] font-medium' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{market.name}</span>
                            <span className="text-xs text-[oklch(0.50_0_0)]">{market.listingCount.toLocaleString()} listings</span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center text-[oklch(0.50_0_0)] text-sm">No cities found matching "{marketSearchQuery}"</div>
                    )
                  ) : (
                    markets.length > 0 ? (
                      markets.map((market) => (
                        <button
                          key={market.id}
                          onClick={() => handleMarketSelect(market)}
                          className={`w-full px-4 py-2.5 text-left hover:bg-[oklch(0.96_0_0)] transition-colors ${selectedMarket?.id === market.id ? 'bg-[oklch(0.96_0_0)] font-medium' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{market.name}</span>
                            <span className="text-xs text-[oklch(0.50_0_0)]">{market.listingCount.toLocaleString()} listings</span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center text-[oklch(0.50_0_0)] text-sm">No markets found in {selectedState?.name}</div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Search Button - Kept for consistency with other levels */}
          <div className="flex gap-2">
            {/* Reset City/Metro Button */}
            {selectedMarket && (
              <button
                onClick={() => {
                  setSelectedMarket(null);
                  setSelectedSubmarket(null);
                  setSelectedZipcode(null);
                  setSubmarkets([]);
                  setZipcodes([]);
                }}
                disabled={disabled}
                className="h-14 w-14 flex items-center justify-center bg-white border border-[oklch(0.90_0_0)] text-[oklch(0.50_0_0)] rounded-xl transition-all hover:bg-[oklch(0.96_0_0)] hover:border-[oklch(0.80_0_0)]"
                title="Clear city selection"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            {/* Search at City/Metro level */}
            <button
              onClick={() => handleSearchAtLevel('market')}
              disabled={disabled || !selectedMarket}
              className={`h-14 px-5 flex items-center gap-2 justify-center bg-[oklch(0.75_0.15_75)] text-white rounded-xl transition-all font-medium ${
                disabled || !selectedMarket ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[oklch(0.65_0.15_75)] shadow-lg'
              }`}
              title="Search this city/metro"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </div>
        
        {/* Row 2: Neighborhood and Zip Code */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Submarket/Neighborhood Dropdown with Search Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <button
                onClick={() => !disabled && selectedMarket && setSubmarketOpen(!submarketOpen)}
                disabled={disabled || !selectedMarket}
                className={`w-full h-14 px-4 flex items-center justify-between bg-white border rounded-xl transition-all ${
                  submarketOpen ? 'border-[oklch(0.75_0.15_75)] ring-2 ring-[oklch(0.75_0.15_75)]/20' : 'border-[oklch(0.90_0_0)]'
                } ${disabled || !selectedMarket ? 'opacity-50 cursor-not-allowed' : 'hover:border-[oklch(0.80_0_0)]'}`}
              >
                <div className="flex items-center gap-2">
                  {loadingSubmarkets ? (
                    <Loader2 className="w-4 h-4 text-[oklch(0.50_0_0)] animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4 text-[oklch(0.50_0_0)]" />
                  )}
                  <span className={selectedSubmarket ? 'text-[oklch(0.25_0_0)]' : 'text-[oklch(0.50_0_0)]'}>
                    {loadingSubmarkets ? (
                      <Skeleton className="h-4 w-24" />
                    ) : (
                      selectedSubmarket?.name || 'Neighborhood'
                    )}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[oklch(0.50_0_0)] transition-transform ${submarketOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Error Message */}
              {submarketError && (
                <div className="mt-2">
                  <ErrorMessage 
                    message={submarketError} 
                    onRetry={() => {
                      setSubmarketError(null);
                      // Trigger re-fetch by toggling market
                      const currentMarket = selectedMarket;
                      setSelectedMarket(null);
                      setTimeout(() => setSelectedMarket(currentMarket), 0);
                    }} 
                  />
                </div>
              )}
              
              {submarketOpen && !submarketError && submarkets.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {submarkets.map((submarket) => (
                    <button
                      key={submarket.id}
                      onClick={() => handleSubmarketSelect(submarket)}
                      className={`w-full px-4 py-2.5 text-left hover:bg-[oklch(0.96_0_0)] transition-colors first:rounded-t-xl last:rounded-b-xl ${
                        selectedSubmarket?.id === submarket.id ? 'bg-[oklch(0.96_0_0)] font-medium' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{submarket.name}</span>
                        <div className="flex items-center gap-2 text-xs text-[oklch(0.50_0_0)]">
                          {submarket.revenue && (
                            <span className="text-emerald-600">${Math.round(submarket.revenue / 1000)}k/yr</span>
                          )}
                          {submarket.listingCount > 0 && (
                            <span>{submarket.listingCount.toLocaleString()} listings</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {submarketOpen && !submarketError && submarkets.length === 0 && !loadingSubmarkets && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg p-4 text-center text-[oklch(0.50_0_0)] text-sm">
                  No neighborhoods found
                </div>
              )}
            </div>
            
            {/* Reset Neighborhood Button */}
            {selectedSubmarket && (
              <button
                onClick={() => {
                  setSelectedSubmarket(null);
                  setSelectedZipcode(null);
                  setZipcodes([]);
                }}
                disabled={disabled}
                className="h-14 w-14 flex items-center justify-center bg-white border border-[oklch(0.90_0_0)] text-[oklch(0.50_0_0)] rounded-xl transition-all hover:bg-[oklch(0.96_0_0)] hover:border-[oklch(0.80_0_0)]"
                title="Clear neighborhood selection"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            {/* Search at Neighborhood level */}
            <button
              onClick={() => handleSearchAtLevel('submarket')}
              disabled={disabled || !selectedSubmarket}
              className={`h-14 px-5 flex items-center gap-2 justify-center bg-[oklch(0.75_0.15_75)] text-white rounded-xl transition-all font-medium ${
                disabled || !selectedSubmarket ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[oklch(0.65_0.15_75)] shadow-lg'
              }`}
              title="Search this neighborhood"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
          
          {/* Zip Code Dropdown with Search Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <button
                onClick={() => !disabled && (selectedSubmarket || zipcodes.length > 0) && setZipcodeOpen(!zipcodeOpen)}
                disabled={disabled || (!selectedSubmarket && zipcodes.length === 0)}
                className={`w-full h-14 px-4 flex items-center justify-between bg-white border rounded-xl transition-all ${
                  zipcodeOpen ? 'border-[oklch(0.75_0.15_75)] ring-2 ring-[oklch(0.75_0.15_75)]/20' : 'border-[oklch(0.90_0_0)]'
                } ${disabled || (!selectedSubmarket && zipcodes.length === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:border-[oklch(0.80_0_0)]'}`}
              >
                <div className="flex items-center gap-2">
                  {loadingZipcodes ? (
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                  ) : zipcodes.length > 0 && !selectedZipcode ? (
                    <Hash className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Hash className="w-4 h-4 text-[oklch(0.50_0_0)]" />
                  )}
                  <span className={selectedZipcode ? 'text-[oklch(0.25_0_0)]' : loadingZipcodes ? 'text-emerald-600' : 'text-[oklch(0.50_0_0)]'}>
                    {loadingZipcodes ? (
                      <span className="flex items-center gap-1">
                        <span>Pre-loading zip codes...</span>
                      </span>
                    ) : (
                      selectedZipcode || (zipcodes.length > 0 ? `Zip Code (${zipcodes.length} ready)` : 'Zip Code')
                    )}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[oklch(0.50_0_0)] transition-transform ${zipcodeOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Error Message */}
              {zipcodeError && (
                <div className="mt-2">
                  <ErrorMessage 
                    message={zipcodeError} 
                    onRetry={() => {
                      setZipcodeError(null);
                      // Trigger re-fetch by toggling submarket
                      const currentSubmarket = selectedSubmarket;
                      setSelectedSubmarket(null);
                      setTimeout(() => setSelectedSubmarket(currentSubmarket), 0);
                    }} 
                  />
                </div>
              )}
              
              {zipcodeOpen && !zipcodeError && zipcodes.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {zipcodes.map((zip) => (
                    <button
                      key={zip.zipcode}
                      onClick={() => handleZipcodeSelect(zip.zipcode)}
                      className={`w-full px-4 py-2.5 text-left hover:bg-[oklch(0.96_0_0)] transition-colors first:rounded-t-xl last:rounded-b-xl flex items-center justify-between ${
                        selectedZipcode === zip.zipcode ? 'bg-[oklch(0.96_0_0)] font-medium' : ''
                      }`}
                    >
                      <span>{zip.zipcode}</span>
                      <span className="text-xs text-[oklch(0.50_0_0)]">{zip.listingCount} listings</span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Show zip code count and loading time when loaded */}
              {!zipcodeOpen && !loadingZipcodes && zipcodes.length > 0 && !selectedZipcode && (
                <div className="absolute -bottom-5 left-0 text-xs text-emerald-600 font-medium flex items-center gap-2">
                  <span>✓ {zipcodes.length} zip codes found</span>
                  {zipcodeLoadTime !== null && (
                    <span className="text-[oklch(0.50_0_0)]">
                      ({zipcodeLoadTime < 1000 ? `${zipcodeLoadTime}ms` : `${(zipcodeLoadTime / 1000).toFixed(1)}s`})
                    </span>
                  )}
                </div>
              )}
              
              {zipcodeOpen && !zipcodeError && zipcodes.length === 0 && !loadingZipcodes && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg p-4 text-center text-[oklch(0.50_0_0)] text-sm">
                  No zip codes found
                </div>
              )}
            </div>
            
            {/* Search at Zip Code level */}
            <button
              onClick={() => handleSearchAtLevel('zipcode')}
              disabled={disabled || !selectedZipcode}
              className={`h-14 px-5 flex items-center gap-2 justify-center bg-[oklch(0.75_0.15_75)] text-white rounded-xl transition-all font-medium ${
                disabled || !selectedZipcode ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[oklch(0.65_0.15_75)] shadow-lg'
              }`}
              title="Search this zip code"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Helper text */}
      <p className="text-sm text-[oklch(0.50_0.02_265)]">
        {!selectedState && 'Start by selecting a state, then drill down to city, neighborhood, or zip code'}
        {selectedState && !selectedMarket && 'Select a city/metro area to see market data'}
        {selectedMarket && !selectedSubmarket && 'Click the search button to see city data, or select a neighborhood for more specific data'}
        {selectedSubmarket && !selectedZipcode && 'Click the search button to see neighborhood data, or select a zip code for hyper-local data'}
        {selectedZipcode && 'Click the search button to see data for this zip code'}
      </p>
    </div>
  );
}

export type { LocationSelection };
