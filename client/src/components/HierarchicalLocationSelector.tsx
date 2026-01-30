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
  parentMarketId?: string;  // Parent market ID for submarkets (used for Historical Charts)
  parentMarketName?: string;  // Parent market name for display
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
  coordinates?: { lat: number; lng: number };
}

interface HierarchicalLocationSelectorProps {
  onSelectionChange: (selection: LocationSelection | null) => void;
  onSearch: (selection: LocationSelection) => void;
  disabled?: boolean;
  initialZipCode?: string;
  initialCity?: string;
  initialState?: string;
  autoSearch?: boolean;
}

export function HierarchicalLocationSelector({
  onSelectionChange,
  onSearch,
  disabled = false,
  initialZipCode,
  initialCity,
  initialState,
  autoSearch = false
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
  const [zipcodeLoadingStatus, setZipcodeLoadingStatus] = useState<string>('');
  
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
                    zipcodes: result.zipcodes || [],
                    // Store parent market info for Historical Charts (API returns parentMarket for submarkets)
                    parentMarketId: result.parentMarket?.id || result.parent_market?.id,
                    parentMarketName: result.parentMarket?.name || result.parent_market?.name,
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
    
    // If the selected market is actually a submarket (like Glendale, AZ or Downtown Orlando), 
    // skip fetching submarkets and fetch zip codes with listing counts from API
    if (selectedMarket.isSubmarketAsMarket) {
      console.log('[HierarchicalLocationSelector] Selected market is a submarket, fetching zip code listing counts');
      setSubmarkets([]);
      // If the market has zipcodes, fetch listing counts from API
      if (selectedMarket.zipcodes && selectedMarket.zipcodes.length > 0) {
        console.log(`[HierarchicalLocationSelector] Fetching listing counts for ${selectedMarket.zipcodes.length} zipcodes`);
        // Use async IIFE to handle the API call
        (async () => {
          setLoadingZipcodes(true);
          setZipcodeLoadingStatus(`Fetching listings from ${selectedMarket.name}...`);
          const startTime = Date.now();
          try {
            const zipResults = await getZipcodes.mutateAsync({ 
              submarketId: selectedMarket.id,
              marketId: selectedMarket.id, // Use market ID for both since this is a submarket-as-market
              submarketListingCount: selectedMarket.listingCount || 0
            });
            if (zipResults && zipResults.length > 0) {
              setZipcodes(zipResults);
              setZipcodeLoadTime(Date.now() - startTime);
              setZipcodeLoadingStatus('');
            } else {
              // Fallback to cached zip codes if API returns nothing
              setZipcodes(selectedMarket.zipcodes!.map(z => ({ zipcode: z, listingCount: 0 })));
              setZipcodeLoadTime(Date.now() - startTime);
              setZipcodeLoadingStatus('');
            }
          } catch (apiError) {
            console.log('[HierarchicalLocationSelector] API zip code fetch failed, using cached:', apiError);
            setZipcodes(selectedMarket.zipcodes!.map(z => ({ zipcode: z, listingCount: 0 })));
            setZipcodeLoadTime(Date.now() - startTime);
            setZipcodeLoadingStatus('');
          } finally {
            setLoadingZipcodes(false);
          }
        })();
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
            console.log('[HierarchicalLocationSelector] No valid submarkets found, fetching zip code listing counts');
            // Fetch listing counts from API instead of using cached zip codes with 0 counts
            setLoadingZipcodes(true);
            setZipcodeLoadingStatus(`Fetching listings from ${selectedMarket.name}...`);
            const startTime = Date.now();
            try {
              const zipResults = await getZipcodes.mutateAsync({ 
                submarketId: selectedMarket.id,
                marketId: selectedMarket.id, // Use market ID for both since this is a market without submarkets
                submarketListingCount: selectedMarket.listingCount || 0
              });
              if (zipResults && zipResults.length > 0) {
                setZipcodes(zipResults);
                setZipcodeLoadTime(Date.now() - startTime);
                setZipcodeLoadingStatus('');
              } else {
                // Fallback to cached zip codes if API returns nothing
                setZipcodes(selectedMarket.zipcodes.map(z => ({ zipcode: z, listingCount: 0 })));
                setZipcodeLoadTime(Date.now() - startTime);
                setZipcodeLoadingStatus('');
              }
            } catch (apiError) {
              console.log('[HierarchicalLocationSelector] API zip code fetch failed, using cached:', apiError);
              setZipcodes(selectedMarket.zipcodes.map(z => ({ zipcode: z, listingCount: 0 })));
              setZipcodeLoadTime(Date.now() - startTime);
              setZipcodeLoadingStatus('');
            } finally {
              setLoadingZipcodes(false);
            }
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
      setZipcodeLoadingStatus('Initializing...');
      const startTime = Date.now();
      
      try {
        // ALWAYS try the API first to get accurate listing counts
        // Even if submarket has cached zip codes, we want the listing counts
        try {
          setZipcodeLoadingStatus(`Fetching listings from ${selectedSubmarket.name}...`);
          const results = await getZipcodes.mutateAsync({ 
            submarketId: selectedSubmarket.id,
            marketId: selectedMarket?.id, // Pass market ID for fallback
            submarketListingCount: selectedSubmarket.listingCount || 0
          });
          if (results && results.length > 0) {
            setZipcodeLoadingStatus(`Found ${results.length} zip codes!`);
            setZipcodes(results);
            setZipcodeLoadTime(Date.now() - startTime);
            setZipcodeLoadingStatus('');
            return;
          }
        } catch (apiError) {
          console.log('API zip code fetch failed, trying search fallback:', apiError);
          setZipcodeLoadingStatus('Trying alternative method...');
        }
        
        // Fallback 1: Use cached zip codes from submarket data (without listing counts)
        if (selectedSubmarket.zipcodes && selectedSubmarket.zipcodes.length > 0) {
          setZipcodeLoadingStatus('Using cached data...');
          // Use existing zip codes from the submarket
          const zipResults = selectedSubmarket.zipcodes.map(zip => ({
            zipcode: zip,
            listingCount: 0 // Count not available from search results
          }));
          setZipcodes(zipResults);
          setZipcodeLoadTime(Date.now() - startTime);
          setZipcodeLoadingStatus('');
          return;
        }
        
        // Fallback: Search for the submarket by name to get its zip codes
        // Include state name in search for more accurate results
        try {
          setZipcodeLoadingStatus('Searching market database...');
          const stateContext = selectedState ? `, ${selectedState.name}` : '';
          const searchQuery = `${selectedSubmarket.name}${stateContext}`;
          console.log(`[ZipCodeFetch] Searching for: "${searchQuery}"`);
          const searchResponse = await searchMarkets.mutateAsync({ query: searchQuery });
          const searchResults = Array.isArray(searchResponse) ? searchResponse : ((searchResponse as any)?.data || searchResponse || []);
          
          setZipcodeLoadingStatus('Processing results...');
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
                setZipcodeLoadingStatus('');
                return;
              }
            }
          }
          
          // No matching zip codes found
          setZipcodes([]);
          setZipcodeLoadTime(Date.now() - startTime);
          setZipcodeLoadingStatus('');
        } catch (searchError) {
          console.error('Search fallback failed:', searchError);
          setZipcodes([]);
          setZipcodeError('Failed to load zip codes. Please try again.');
          setZipcodeLoadingStatus('');
        }
      } catch (error) {
        console.error('Error fetching zipcodes:', error);
        setZipcodes([]);
        setZipcodeError('Failed to load zip codes. Please try again.');
        setZipcodeLoadingStatus('');
      } finally {
        setLoadingZipcodes(false);
        setZipcodeLoadingStatus('');
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
  const [directZipSearch, setDirectZipSearch] = useState(initialZipCode || '');
  const [directZipSearching, setDirectZipSearching] = useState(false);
  const [directZipError, setDirectZipError] = useState<string | null>(null);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  
  // Zip code autocomplete state
  const [zipSearchResults, setZipSearchResults] = useState<Array<{ zip: string; city: string; state: string }>>([]);
  const [showZipResults, setShowZipResults] = useState(false);
  const [isLoadingZipSuggestions, setIsLoadingZipSuggestions] = useState(false);
  
  // Direct city/market search state
  const [directCitySearch, setDirectCitySearch] = useState(initialCity && initialState ? `${initialCity}, ${initialState}` : '');
  const [directCitySearching, setDirectCitySearching] = useState(false);
  const [directCityError, setDirectCityError] = useState<string | null>(null);
  const [citySearchResults, setCitySearchResults] = useState<Market[]>([]);
  const [showCityResults, setShowCityResults] = useState(false);
  const [isLoadingCitySuggestions, setIsLoadingCitySuggestions] = useState(false);
  
  // Debounced city search autocomplete - search as user types
  useEffect(() => {
    // Don't search if input is too short or empty
    if (directCitySearch.length < 2) {
      setCitySearchResults([]);
      setShowCityResults(false);
      return;
    }
    
    // Debounce the search
    const timeoutId = setTimeout(async () => {
      setIsLoadingCitySuggestions(true);
      try {
        const response = await searchMarkets.mutateAsync({ query: directCitySearch });
        const results = Array.isArray(response) ? response : ((response as any)?.data || response || []);
        
        if (results.length > 0) {
          // Transform results to set isSubmarketAsMarket for submarkets
          const transformedResults = results.slice(0, 10).map((r: any) => ({
            ...r,
            isSubmarketAsMarket: r.type === 'submarket',
            parentMarketId: r.parentMarket?.id,
            parentMarketName: r.parentMarket?.name,
          }));
          setCitySearchResults(transformedResults); // Limit to 10 results
          setShowCityResults(true);
        } else {
          setCitySearchResults([]);
          setShowCityResults(false);
        }
      } catch (error) {
        console.error('Error searching cities:', error);
        setCitySearchResults([]);
        setShowCityResults(false);
      } finally {
        setIsLoadingCitySuggestions(false);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [directCitySearch]);
  
  // Debounced zip code search autocomplete - search as user types
  useEffect(() => {
    // Don't search if input is empty or not numeric
    const cleanedZip = directZipSearch.replace(/\D/g, '');
    if (cleanedZip.length < 1) {
      setZipSearchResults([]);
      setShowZipResults(false);
      return;
    }
    
    // Don't show autocomplete if we have a complete 5-digit zip
    if (cleanedZip.length === 5) {
      setShowZipResults(false);
      return;
    }
    
    // Debounce the search
    const timeoutId = setTimeout(async () => {
      setIsLoadingZipSuggestions(true);
      try {
        const response = await fetch(`/api/trpc/rental.searchZipCodes?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { prefix: cleanedZip } } }))}`);
        const data = await response.json();
        const results = data?.[0]?.result?.data?.json?.data || [];
        
        if (results.length > 0) {
          setZipSearchResults(results);
          setShowZipResults(true);
        } else {
          setZipSearchResults([]);
          setShowZipResults(false);
        }
      } catch (error) {
        console.error('Error searching zip codes:', error);
        setZipSearchResults([]);
        setShowZipResults(false);
      } finally {
        setIsLoadingZipSuggestions(false);
      }
    }, 200); // 200ms debounce for zip codes (faster since it's local)
    
    return () => clearTimeout(timeoutId);
  }, [directZipSearch]);
  
  // Handle direct zip code search with geocoding fallback
  const geocodeZipCode = trpc.rental.geocodeZipCode.useQuery;
  
  const handleDirectZipSearch = async (overrideZip?: string) => {
    // Use override zip if provided (for auto-search), otherwise use state
    const zip = (overrideZip || directZipSearch).trim();
    setDirectZipError(null); // Clear any previous error
    
    // Validation with specific error messages
    if (!zip) {
      setDirectZipError('Please enter a zip code to search');
      return;
    }
    
    if (zip.length < 5) {
      setDirectZipError(`Please enter all 5 digits. You entered ${zip.length} digit${zip.length === 1 ? '' : 's'} (${zip}).`);
      return;
    }
    
    if (!/^\d{5}$/.test(zip)) {
      setDirectZipError('Please enter only numbers (0-9) for the zip code');
      return;
    }
    
    setDirectZipSearching(true);
    try {
      // First, try the traditional market search
      const response = await searchMarkets.mutateAsync({ query: zip });
      const results = Array.isArray(response) ? response : ((response as any)?.data || response || []);
      
      if (results.length > 0) {
        // Use the first result
        const result = results[0];
        
        // Set the zip code directly and trigger search
        setSelectedZipcode(zip);
        // Also set visual state for the dropdowns
        if (result.parentMarket) {
          // Find the state from the parent market name (e.g., "Miami" -> "Florida")
          const foundState = US_STATES.find(s => 
            result.parentMarket?.name?.toLowerCase().includes(s.name.toLowerCase()) ||
            result.name?.toLowerCase().includes(s.name.toLowerCase())
          );
          if (foundState) {
            setSelectedState(foundState);
          }
          
          // Set the parent market
          setSelectedMarket({
            id: result.parentMarket.id,
            name: result.parentMarket.name,
            listingCount: result.listingCount || 0
          });
        }
        
        // Set the submarket if the result is a submarket
        if (result.type === 'submarket') {
          setSelectedSubmarket({
            id: result.id,
            name: result.name,
            listingCount: result.listingCount || 0
          });
        }
        
        onSearch({
          level: 'zipcode',
          zipcode: zip,
          market: result.type === 'market' ? {
            id: result.id,
            name: result.name,
            listingCount: result.listingCount || 0
          } : result.parentMarket ? {
            id: result.parentMarket.id,
            name: result.parentMarket.name,
            listingCount: result.listingCount || 0
          } : undefined,
          submarket: result.type === 'submarket' ? {
            id: result.id,
            name: result.name,
            listingCount: result.listingCount || 0
          } : undefined
        });
      } else {
        // Fallback: Use geocoding to find the market
        console.log(`[DirectZipSearch] No direct results for ${zip}, trying geocoding fallback...`);
        
        // Use fetch directly since we need to await the result
        const geocodeResponse = await fetch(`/api/trpc/rental.geocodeZipCode?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { zipcode: zip } } }))}`);
        const geocodeData = await geocodeResponse.json();
        const geocodeResult = geocodeData?.[0]?.result?.data?.json;
        
        if (geocodeResult?.success && geocodeResult?.market) {
          console.log(`[DirectZipSearch] Geocoding found: ${geocodeResult.city}, ${geocodeResult.state} -> ${geocodeResult.market.name}`);
          
          // Find the state from the geocoded result
          const stateCode = geocodeResult.stateCode;
          const stateName = geocodeResult.state;
          const foundState = US_STATES.find(s => 
            s.code.toLowerCase() === stateCode?.toLowerCase() ||
            s.name.toLowerCase() === stateName?.toLowerCase()
          );
          
          // Set the hierarchical selections
          if (foundState) {
            setSelectedState(foundState);
          }
          
          // Set the market
          const market = {
            id: geocodeResult.market.id,
            name: geocodeResult.market.name,
            listingCount: geocodeResult.market.listingCount || 0
          };
          setSelectedMarket(market);
          
          // Set the submarket if available
          if (geocodeResult.submarket) {
            setSelectedSubmarket({
              id: geocodeResult.submarket.id,
              name: geocodeResult.submarket.name,
              listingCount: geocodeResult.submarket.listingCount || 0
            });
          }
          
          // Set the zip code
          setSelectedZipcode(zip);
          
          // Trigger search with the found market
          onSearch({
            level: geocodeResult.submarket ? 'submarket' : 'market',
            state: foundState,
            zipcode: zip,
            market: market,
            submarket: geocodeResult.submarket ? {
              id: geocodeResult.submarket.id,
              name: geocodeResult.submarket.name,
              listingCount: geocodeResult.submarket.listingCount || 0
            } : undefined,
            coordinates: geocodeResult.coordinates
          });
        } else if (geocodeResult?.coordinates) {
          // No market found, but we have coordinates - still trigger search to center the map
          console.log(`[DirectZipSearch] No market found, but have coordinates for ${geocodeResult.city}, ${geocodeResult.state}`);
          
          // Find the state from the geocoded result
          const stateCode = geocodeResult.stateCode;
          const stateName = geocodeResult.state;
          const foundState = US_STATES.find(s => 
            s.code.toLowerCase() === stateCode?.toLowerCase() ||
            s.name.toLowerCase() === stateName?.toLowerCase()
          );
          
          // Set the state if found
          if (foundState) {
            setSelectedState(foundState);
          }
          
          // Set the zip code
          setSelectedZipcode(zip);
          
          // Trigger search with just the coordinates and zip code
          // This will at least center the map on the correct location
          onSearch({
            level: 'zipcode',
            state: foundState,
            zipcode: zip,
            coordinates: geocodeResult.coordinates
          });
          
          // Show a warning message that no market data is available
          setDirectZipError(`Located ${geocodeResult.city}, ${geocodeResult.state}. No market data available for this area. The map will center on this location, but listing data may be limited.`);
        } else {
          // Show the error from geocoding or a default message
          const errorMsg = geocodeResult?.error || 
            `No rental data found for zip code ${zip}. This area may not have enough Airbnb listings. Try a nearby city or browse by state instead.`;
          setDirectZipError(errorMsg);
        }
      }
    } catch (error) {
      console.error('Error searching zip code:', error);
      setDirectZipError('Unable to search this zip code. Please check your connection and try again.');
    } finally {
      setDirectZipSearching(false);
    }
  };
  
  // Auto-search when initialZipCode is provided and autoSearch is enabled
  useEffect(() => {
    if (initialZipCode && autoSearch && !hasAutoSearched && initialZipCode.length === 5) {
      console.log('[HierarchicalLocationSelector] Auto-searching for zip code:', initialZipCode);
      setDirectZipSearch(initialZipCode);
      setHasAutoSearched(true);
      // Pass the zip directly to avoid race condition with state update
      handleDirectZipSearch(initialZipCode);
    }
  }, [initialZipCode, autoSearch, hasAutoSearched]);
  
  // Update directZipSearch when initialZipCode changes
  useEffect(() => {
    if (initialZipCode && initialZipCode !== directZipSearch) {
      setDirectZipSearch(initialZipCode);
      setHasAutoSearched(false); // Reset so it can auto-search again
    }
  }, [initialZipCode]);
  
  // Auto-search when initialCity is provided and autoSearch is enabled
  const [hasCityAutoSearched, setHasCityAutoSearched] = useState(false);
  useEffect(() => {
    if (initialCity && initialState && autoSearch && !hasCityAutoSearched && !initialZipCode) {
      console.log('[HierarchicalLocationSelector] Auto-searching for city:', initialCity, initialState);
      const cityQuery = `${initialCity}, ${initialState}`;
      setDirectCitySearch(cityQuery);
      setHasCityAutoSearched(true);
      // Trigger the city search after a short delay to ensure state is set
      setTimeout(() => {
        handleDirectCitySearch();
      }, 100);
    }
  }, [initialCity, initialState, autoSearch, hasCityAutoSearched, initialZipCode]);
  
  // Handle direct city/market search
  const handleDirectCitySearch = async () => {
    const query = directCitySearch.trim();
    setDirectCityError(null);
    setCitySearchResults([]);
    setShowCityResults(false);
    
    if (!query) {
      setDirectCityError('Please enter a city or market name');
      return;
    }
    
    if (query.length < 2) {
      setDirectCityError('Please enter at least 2 characters');
      return;
    }
    
    setDirectCitySearching(true);
    try {
      const response = await searchMarkets.mutateAsync({ query });
      const results = Array.isArray(response) ? response : ((response as any)?.data || response || []);
      
      if (results.length > 0) {
        // Transform results to set isSubmarketAsMarket for submarkets
        const transformedResults = results.slice(0, 10).map((r: any) => ({
          ...r,
          isSubmarketAsMarket: r.type === 'submarket',
          parentMarketId: r.parentMarket?.id,
          parentMarketName: r.parentMarket?.name,
        }));
        setCitySearchResults(transformedResults); // Limit to 10 results
        setShowCityResults(true);
      } else {
        setDirectCityError(`No markets found for "${query}". Try a different city name or use the state dropdown below.`);
      }
    } catch (error) {
      console.error('Error searching cities:', error);
      setDirectCityError('Unable to search. Please check your connection and try again.');
    } finally {
      setDirectCitySearching(false);
    }
  };
  
  // Handle selecting a city from search results
  const handleCityResultSelect = (market: Market) => {
    // Find the state from the market
    const foundState = US_STATES.find(s => 
      market.state?.toLowerCase() === s.code.toLowerCase() ||
      market.state?.toLowerCase() === s.name.toLowerCase() ||
      market.locationName?.toLowerCase().includes(s.name.toLowerCase()) ||
      market.name?.toLowerCase().includes(s.name.toLowerCase())
    );
    
    if (foundState) {
      setSelectedState(foundState);
    }
    
    setSelectedMarket(market);
    setShowCityResults(false);
    setDirectCitySearch('');
    
    // Determine the correct level based on the market type from AirDNA API
    // AirDNA returns type: 'market' or 'submarket' for each result
    const isSubmarket = market.type === 'submarket' || market.isSubmarketAsMarket;
    const level = isSubmarket ? 'submarket' : 'market';
    
    console.log(`[handleCityResultSelect] Selected: ${market.name}, type: ${market.type}, level: ${level}`);
    
    // Trigger search with the selected market/submarket
    if (isSubmarket) {
      // For submarkets, we need to pass it as a submarket
      onSearch({
        level: 'submarket',
        state: foundState,
        market: market, // Keep the market reference for parent info
        submarket: {
          id: market.id,
          name: market.name,
          listingCount: market.listingCount || 0,
        }
      });
    } else {
      onSearch({
        level: 'market',
        state: foundState,
        market: market
      });
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
        <div className="flex gap-2 relative">
          <div className="flex-1 relative">
            <input
              type="text"
              value={directZipSearch}
              onChange={(e) => {
                // Clear any previous error when user starts typing
                if (directZipError) setDirectZipError(null);
                // Filter to only digits and limit to 5 characters
                setDirectZipSearch(e.target.value.replace(/\D/g, '').slice(0, 5));
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleDirectZipSearch()}
              onBlur={() => {
                // Delay hiding results to allow click to register
                setTimeout(() => setShowZipResults(false), 200);
              }}
              onFocus={() => {
                if (zipSearchResults.length > 0 && directZipSearch.length > 0 && directZipSearch.length < 5) {
                  setShowZipResults(true);
                }
              }}
              placeholder="Enter 5-digit zip code"
              disabled={disabled || directZipSearching}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(0.50_0.15_250)] disabled:opacity-50 disabled:cursor-not-allowed ${directZipError ? 'border-red-400 bg-red-50' : 'border-[oklch(0.85_0_0)]'}`}
              maxLength={5}
            />
            {/* Loading indicator */}
            {isLoadingZipSuggestions && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-[oklch(0.50_0_0)]" />
              </div>
            )}
            {/* Zip code autocomplete dropdown */}
            {showZipResults && zipSearchResults.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[oklch(0.85_0_0)] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {zipSearchResults.map((result, index) => (
                  <button
                    key={`${result.zip}-${index}`}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-[oklch(0.96_0_0)] transition-colors flex items-center gap-2 text-sm border-b border-[oklch(0.95_0_0)] last:border-b-0"
                    onClick={() => {
                      setDirectZipSearch(result.zip);
                      setShowZipResults(false);
                      // Pass the zip directly to avoid race condition with state update
                      handleDirectZipSearch(result.zip);
                    }}
                  >
                    <Hash className="w-3 h-3 text-[oklch(0.50_0_0)]" />
                    <span className="font-medium text-[oklch(0.30_0_0)]">{result.zip}</span>
                    <span className="text-[oklch(0.50_0_0)]">{result.city}, {result.state}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => handleDirectZipSearch()}
            disabled={disabled || directZipSearching}
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
        
        {/* Error message display */}
        {directZipError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-red-700 font-medium">No Data Available</p>
                <p className="text-sm text-red-600 mt-1">{directZipError}</p>
              </div>
              <button
                onClick={() => setDirectZipError(null)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Direct City/Market Search */}
      <div className="bg-[oklch(0.98_0_0)] border border-[oklch(0.85_0_0)] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="w-4 h-4 text-[oklch(0.50_0_0)]" />
          <h3 className="text-sm font-medium text-[oklch(0.30_0_0)]">Quick Search by City/Market</h3>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={directCitySearch}
              onChange={(e) => {
                if (directCityError) setDirectCityError(null);
                setDirectCitySearch(e.target.value);
                // Don't hide results - let the debounced search update them
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleDirectCitySearch()}
              placeholder="Enter city name (e.g., Miami, Austin, Nashville)"
              disabled={disabled || directCitySearching}
              className={`w-full px-3 py-2 pr-8 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(0.50_0.15_250)] disabled:opacity-50 disabled:cursor-not-allowed ${directCityError ? 'border-red-400 bg-red-50' : 'border-[oklch(0.85_0_0)]'}`}
            />
            
            {/* Loading indicator inside input */}
            {isLoadingCitySuggestions && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 text-[oklch(0.50_0_0)] animate-spin" />
              </div>
            )}
            
            {/* City Search Results Dropdown - shows as user types */}
            {showCityResults && citySearchResults.length > 0 && (
              <div 
                className="absolute z-[100] w-full mt-1 bg-white border border-[oklch(0.85_0_0)] rounded-lg shadow-lg max-h-64 overflow-y-auto"
                role="listbox"
                aria-label="City search results"
              >
                {citySearchResults.map((market, index) => (
                  <button
                    key={market.id || index}
                    type="button"
                    role="option"
                    data-market-id={market.id}
                    data-market-name={market.name}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCityResultSelect(market);
                    }}
                    onMouseDown={(e) => {
                      // Prevent blur on input before click completes
                      e.preventDefault();
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-[oklch(0.94_0.02_250)] active:bg-[oklch(0.90_0.03_250)] transition-colors flex items-center justify-between first:rounded-t-lg last:rounded-b-lg cursor-pointer border-b border-[oklch(0.92_0_0)] last:border-b-0"
                  >
                    <div className="pointer-events-none">
                      <span className="font-medium text-[oklch(0.25_0_0)]">{market.name}</span>
                      {market.locationName && market.locationName !== market.name && (
                        <span className="text-[oklch(0.50_0_0)] text-sm ml-1">({market.locationName})</span>
                      )}
                    </div>
                    <span className="text-xs text-[oklch(0.50_0_0)] bg-[oklch(0.96_0_0)] px-2 py-1 rounded pointer-events-none">
                      {market.listingCount?.toLocaleString() || 0} listings
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleDirectCitySearch}
            disabled={disabled || directCitySearching}
            className="px-4 py-2 bg-[oklch(0.30_0_0)] text-white rounded-lg hover:bg-[oklch(0.25_0_0)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
          >
            {directCitySearching ? (
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
        <p className="text-xs text-[oklch(0.50_0_0)] mt-2">Search for any city or market directly - no need to select a state first</p>
        
        {/* City Error message display */}
        {directCityError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-red-700 font-medium">No Markets Found</p>
                <p className="text-sm text-red-600 mt-1">{directCityError}</p>
              </div>
              <button
                onClick={() => setDirectCityError(null)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
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
                <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg max-h-64 overflow-y-auto overscroll-contain" style={{ maxHeight: '256px' }}>
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
                <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg max-h-64 overflow-y-auto overscroll-contain" style={{ maxHeight: '256px' }}>
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
              data-prove-button
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
                <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg max-h-64 overflow-y-auto overscroll-contain" style={{ maxHeight: '256px' }}>
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
                <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg p-4 text-center text-sm">
                  {selectedMarket?.isSubmarketAsMarket ? (
                    <div className="text-[oklch(0.40_0.10_75)]">
                      <span className="font-medium">{selectedMarket.name}</span> is already a neighborhood.
                      <br />
                      <span className="text-[oklch(0.50_0_0)]">Select a zip code below for more specific data.</span>
                    </div>
                  ) : (
                    <span className="text-[oklch(0.50_0_0)]">No neighborhoods found</span>
                  )}
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
              data-prove-button
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
                      <span className="flex items-center gap-1 text-sm">
                        <span>{zipcodeLoadingStatus || 'Loading zip codes...'}</span>
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
                <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg max-h-64 overflow-y-auto overscroll-contain" style={{ maxHeight: '256px' }}>
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
              data-prove-button
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
