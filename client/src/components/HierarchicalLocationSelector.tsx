/**
 * Hierarchical Location Selector
 * 
 * Cascading dropdown for: State → City/Market → Submarket → Zip Code
 * Each level shows data at that specificity when selected.
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { ChevronDown, MapPin, Building2, Map, Hash, X, Loader2 } from 'lucide-react';

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
}

interface Submarket {
  id: string;
  name: string;
  listingCount: number;
  revenue?: number;
  occupancy?: number;
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
  const [zipcodes, setZipcodes] = useState<string[]>([]);
  
  // Loading state
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [loadingSubmarkets, setLoadingSubmarkets] = useState(false);
  const [loadingZipcodes, setLoadingZipcodes] = useState(false);
  
  // TRPC mutations
  const searchMarkets = trpc.marketResearchSimple.searchMarkets.useMutation();
  const getSubmarkets = trpc.marketResearchSimple.getSubmarkets.useMutation();
  const getZipcodes = trpc.marketResearchSimple.getZipcodesInSubmarket.useMutation();
  
  // Fetch markets when state is selected
  // Major cities by state to search for markets
  const MAJOR_CITIES: Record<string, string[]> = {
    'AZ': ['Phoenix', 'Tucson', 'Scottsdale', 'Mesa', 'Flagstaff', 'Sedona'],
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

  useEffect(() => {
    if (!selectedState) {
      setMarkets([]);
      return;
    }
    
    const fetchMarkets = async () => {
      setLoadingMarkets(true);
      try {
        // Get major cities for this state, or use state name as fallback
        const citiesToSearch = MAJOR_CITIES[selectedState.code] || [selectedState.name];
        
        // Search for each city and collect unique markets
        const allMarkets: Market[] = [];
        const seenIds = new Set<string>();
        const orphanedSubmarkets: any[] = [];
        
        for (const city of citiesToSearch) {
          try {
            const results = await searchMarkets.mutateAsync({ query: city });
            console.log(`[HierarchicalLocationSelector] Search results for "${city}":`, results.map((r: any) => ({ name: r.name, type: r.type, state: r.state, locationName: r.locationName })));
            
            // Separate markets and submarkets
            for (const result of results) {
              const matchesState = result.state?.toLowerCase().includes(selectedState.name.toLowerCase()) ||
                                   result.locationName?.toLowerCase().includes(selectedState.name.toLowerCase()) ||
                                   result.locationName?.includes(selectedState.code);
              
              if (!matchesState) continue;
              
              if (result.type === 'market') {
                if (!seenIds.has(result.id)) {
                  seenIds.add(result.id);
                  allMarkets.push(result);
                }
              } else if (result.type === 'submarket') {
                // Collect orphaned submarkets for potential virtual market creation
                orphanedSubmarkets.push(result);
              }
            }
          } catch (e) {
            console.error(`Error searching for ${city}:`, e);
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
    
    const fetchSubmarkets = async () => {
      setLoadingSubmarkets(true);
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
          
          // Sort by listing count
          stateSubmarkets.sort((a: Submarket, b: Submarket) => b.listingCount - a.listingCount);
          setSubmarkets(stateSubmarkets);
        } else {
          // Regular market - fetch from API
          const results = await getSubmarkets.mutateAsync({ marketId: selectedMarket.id });
          setSubmarkets(results);
        }
      } catch (error) {
        console.error('Error fetching submarkets:', error);
        setSubmarkets([]);
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
      try {
        const results = await getZipcodes.mutateAsync({ submarketId: selectedSubmarket.id });
        setZipcodes(results);
      } catch (error) {
        console.error('Error fetching zipcodes:', error);
        setZipcodes([]);
      } finally {
        setLoadingZipcodes(false);
      }
    };
    
    fetchZipcodes();
  }, [selectedSubmarket]);
  
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
  
  // Clear all selections
  const handleClear = () => {
    setSelectedState(null);
    setSelectedMarket(null);
    setSelectedSubmarket(null);
    setSelectedZipcode(null);
    setMarkets([]);
    setSubmarkets([]);
    setZipcodes([]);
  };
  
  // Get current selection label
  const getSelectionLabel = () => {
    if (selectedZipcode) {
      return `${selectedZipcode}, ${selectedSubmarket?.name}`;
    }
    if (selectedSubmarket) {
      return `${selectedSubmarket.name}, ${selectedMarket?.name}`;
    }
    if (selectedMarket) {
      return selectedMarket.name;
    }
    if (selectedState) {
      return selectedState.name;
    }
    return 'Select a location...';
  };
  
  // Handle search button click
  const handleSearchClick = () => {
    if (selectedZipcode) {
      onSearch({
        level: 'zipcode',
        state: selectedState!,
        market: selectedMarket!,
        submarket: selectedSubmarket!,
        zipcode: selectedZipcode
      });
    } else if (selectedSubmarket) {
      onSearch({
        level: 'submarket',
        state: selectedState!,
        market: selectedMarket!,
        submarket: selectedSubmarket
      });
    } else if (selectedMarket) {
      onSearch({
        level: 'market',
        state: selectedState!,
        market: selectedMarket
      });
    }
  };
  
  return (
    <div className="space-y-4">
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
          <button
            onClick={handleClear}
            className="ml-2 text-[oklch(0.50_0_0)] hover:text-[oklch(0.30_0_0)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Dropdown grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* State Dropdown */}
        <div className="relative">
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
        
        {/* Market/City Dropdown */}
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
                {loadingMarkets ? 'Loading...' : selectedMarket?.name || 'City/Metro'}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-[oklch(0.50_0_0)] transition-transform ${marketOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {marketOpen && markets.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {markets.map((market) => (
                <button
                  key={market.id}
                  onClick={() => handleMarketSelect(market)}
                  className={`w-full px-4 py-2.5 text-left hover:bg-[oklch(0.96_0_0)] transition-colors first:rounded-t-xl last:rounded-b-xl ${
                    selectedMarket?.id === market.id ? 'bg-[oklch(0.96_0_0)] font-medium' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{market.name}</span>
                    <span className="text-xs text-[oklch(0.50_0_0)]">
                      {market.listingCount.toLocaleString()} listings
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {marketOpen && markets.length === 0 && !loadingMarkets && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg p-4 text-center text-[oklch(0.50_0_0)] text-sm">
              No markets found in {selectedState?.name}
            </div>
          )}
        </div>
        
        {/* Submarket/Neighborhood Dropdown */}
        <div className="relative">
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
                {loadingSubmarkets ? 'Loading...' : selectedSubmarket?.name || 'Neighborhood'}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-[oklch(0.50_0_0)] transition-transform ${submarketOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {submarketOpen && submarkets.length > 0 && (
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
          
          {submarketOpen && submarkets.length === 0 && !loadingSubmarkets && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg p-4 text-center text-[oklch(0.50_0_0)] text-sm">
              No neighborhoods found
            </div>
          )}
        </div>
        
        {/* Zip Code Dropdown */}
        <div className="relative">
          <button
            onClick={() => !disabled && selectedSubmarket && setZipcodeOpen(!zipcodeOpen)}
            disabled={disabled || !selectedSubmarket}
            className={`w-full h-14 px-4 flex items-center justify-between bg-white border rounded-xl transition-all ${
              zipcodeOpen ? 'border-[oklch(0.75_0.15_75)] ring-2 ring-[oklch(0.75_0.15_75)]/20' : 'border-[oklch(0.90_0_0)]'
            } ${disabled || !selectedSubmarket ? 'opacity-50 cursor-not-allowed' : 'hover:border-[oklch(0.80_0_0)]'}`}
          >
            <div className="flex items-center gap-2">
              {loadingZipcodes ? (
                <Loader2 className="w-4 h-4 text-[oklch(0.50_0_0)] animate-spin" />
              ) : (
                <Hash className="w-4 h-4 text-[oklch(0.50_0_0)]" />
              )}
              <span className={selectedZipcode ? 'text-[oklch(0.25_0_0)]' : 'text-[oklch(0.50_0_0)]'}>
                {loadingZipcodes ? 'Loading...' : selectedZipcode || 'Zip Code (optional)'}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-[oklch(0.50_0_0)] transition-transform ${zipcodeOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {zipcodeOpen && zipcodes.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg max-h-64 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedZipcode(null);
                  setZipcodeOpen(false);
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-[oklch(0.96_0_0)] transition-colors rounded-t-xl text-[oklch(0.50_0_0)] italic"
              >
                All zip codes
              </button>
              {zipcodes.map((zipcode) => (
                <button
                  key={zipcode}
                  onClick={() => handleZipcodeSelect(zipcode)}
                  className={`w-full px-4 py-2.5 text-left hover:bg-[oklch(0.96_0_0)] transition-colors last:rounded-b-xl ${
                    selectedZipcode === zipcode ? 'bg-[oklch(0.96_0_0)] font-medium' : ''
                  }`}
                >
                  {zipcode}
                </button>
              ))}
            </div>
          )}
          
          {zipcodeOpen && zipcodes.length === 0 && !loadingZipcodes && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-[oklch(0.90_0_0)] rounded-xl shadow-lg p-4 text-center text-[oklch(0.50_0_0)] text-sm">
              No zip codes found
            </div>
          )}
        </div>
      </div>
      
      {/* Helper text */}
      <p className="text-sm text-[oklch(0.50_0.02_265)]">
        {!selectedState && 'Start by selecting a state, then drill down to city, neighborhood, or zip code'}
        {selectedState && !selectedMarket && 'Select a city/metro area to see market data, or continue to narrow down'}
        {selectedMarket && !selectedSubmarket && 'Select a neighborhood for more specific data, or search the entire metro'}
        {selectedSubmarket && !selectedZipcode && 'Optionally select a zip code for hyper-local data'}
        {selectedZipcode && 'Ready to search! Click the button below to see data for this zip code'}
      </p>
    </div>
  );
}

export type { LocationSelection };
