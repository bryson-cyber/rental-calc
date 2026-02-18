/**
 * Opportunity Finder - Simplified Implementation
 * 
 * Simplified approach:
 * 1. Browser Use → Apartments.com/Trulia (rental listings)
 * 2. AirDNA API → Revenue projections for each rental
 * 
 * Target: ~6 minute completion time
 */

import { z } from 'zod';
import { router, publicProcedure } from './_core/trpc';

// In-memory cache for AirDNA estimates (24h TTL)
let _oppCache: Map<string, { data: any; ts: number }> = new Map();
import { TRPCError } from '@trpc/server';
import { ENV } from './_core/env';
// Browser Use removed - stub functions for compilation
const createSession = async (_opts: any): Promise<any> => ({ id: '', liveUrl: '' });
const createTask = async (_opts: any): Promise<any> => ({ id: '' });
const getTask = async (_id: string): Promise<any> => ({ status: 'stopped', steps: [], output: '' });
const stopSession = async (_id: string): Promise<void> => {};
import { searchZillowListings, searchZillowListingsWithEnrichment, getZillowPropertyWithContacts, type ZillowProperty, type ZillowListingResponse, type ZillowAgentContact, type ZillowPropertyWithContacts } from './hasdata';
import { rateLimitedAirDNARequest, AirDNARateLimitError } from './airdna-rate-limiter';
import { recordAnalysisUsage } from './usage-limits';
import { getRentalizerComps } from './airdna';

// ============================================
// CITY NAME NORMALIZATION
// ============================================

import { makeRequest, GeocodingResult } from './_core/map';

/**
 * Normalize city name abbreviations to their full forms for better search results
 * This helps with searching for cities like "St. Louis" vs "Saint Louis"
 * Zillow/HasData API works better with full names
 */
function normalizeCityName(name: string): string {
  let normalized = name;
  
  // Common abbreviation mappings - expand to full form for better API results
  const abbreviations: [RegExp, string][] = [
    [/\bst\.?\s+/gi, 'Saint '],      // St. Louis -> Saint Louis
    [/\bmt\.?\s+/gi, 'Mount '],      // Mt. Vernon -> Mount Vernon
    [/\bft\.?\s+/gi, 'Fort '],       // Ft. Worth -> Fort Worth
    [/\bn\.\s+/gi, 'North '],        // N. Charleston -> North Charleston
    [/\bs\.\s+/gi, 'South '],        // S. Bend -> South Bend
    [/\be\.\s+/gi, 'East '],         // E. St. Louis -> East Saint Louis
    [/\bw\.\s+/gi, 'West '],         // W. Palm Beach -> West Palm Beach
  ];
  
  for (const [pattern, replacement] of abbreviations) {
    normalized = normalized.replace(pattern, replacement);
  }
  
  return normalized.trim();
}

/**
 * Disambiguate location by geocoding to get the correct city and state
 * This fixes issues where "Saint Louis" could match multiple cities
 */
async function disambiguateLocation(location: string): Promise<string> {
  // Clean up Google Places format: "City, ST ZIPCODE, USA" -> "City, ST"
  // Also handles: "City, ST ZIPCODE, Country" and "City, State ZIPCODE, Country"
  const googlePlacesPattern = /^(.+?,\s*[A-Z]{2})\s+\d{5}(?:-\d{4})?,\s*(?:USA|United States)$/i;
  const googlePlacesMatch = location.match(googlePlacesPattern);
  if (googlePlacesMatch) {
    const cleaned = googlePlacesMatch[1];
    console.log(`[OpportunityFinder] Cleaned Google Places format: "${location}" -> "${cleaned}"`);
    location = cleaned;
  }
  
  // Also handle: "City, ST, USA" or "City, ST, United States" -> "City, ST"
  const countryPattern = /^(.+?,\s*[A-Z]{2}),\s*(?:USA|United States)$/i;
  const countryMatch = location.match(countryPattern);
  if (countryMatch) {
    const cleaned = countryMatch[1];
    console.log(`[OpportunityFinder] Removed country suffix: "${location}" -> "${cleaned}"`);
    location = cleaned;
  }
  
  // Handle: "City, FullStateName, USA" or "City, FullStateName, United States" -> "City, FullStateName"
  // Google Places sometimes sends full state names with country suffix
  const fullStateCountryPattern = /^(.+?,\s*(?:Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)),\s*(?:USA|United States)$/i;
  const fullStateCountryMatch = location.match(fullStateCountryPattern);
  if (fullStateCountryMatch) {
    const cleaned = fullStateCountryMatch[1];
    console.log(`[OpportunityFinder] Removed country suffix (full state): "${location}" -> "${cleaned}"`);
    location = cleaned;
  }

  // State name to abbreviation mapping for Zillow/HasData compatibility
  // Zillow works better with "St. Louis, MO" than "St. Louis, Missouri"
  const stateNameToAbbr: Record<string, string> = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
    'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
    'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
    'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
    'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
    'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
    'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
    'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
    'wisconsin': 'WI', 'wyoming': 'WY'
  };

  // If location already contains a state abbreviation or full state name
  const stateAbbrPattern = /,\s*([A-Z]{2})\s*$/;
  const stateNamePattern = /,\s*(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\s*$/i;
  
  // Check for state abbreviation first (already good format)
  if (stateAbbrPattern.test(location)) {
    console.log(`[OpportunityFinder] Location already has state abbreviation: ${location}`);
    return location;
  }
  
  // Check for full state name and convert to abbreviation
  const fullStateMatch = location.match(stateNamePattern);
  if (fullStateMatch) {
    const stateName = fullStateMatch[1].toLowerCase();
    const abbr = stateNameToAbbr[stateName];
    if (abbr) {
      const cityPart = location.replace(stateNamePattern, '');
      const converted = `${cityPart}, ${abbr}`;
      console.log(`[OpportunityFinder] Converted full state name: "${location}" -> "${converted}"`);
      return converted;
    }
    // If somehow not in our map, return as-is
    console.log(`[OpportunityFinder] Location has state name but no abbreviation found: ${location}`);
    return location;
  }
  
  // If it's a zip code, use as-is
  if (/^\d{5}$/.test(location.trim())) {
    console.log(`[OpportunityFinder] Location is a zip code: ${location}`);
    return location;
  }
  
  try {
    // Geocode the location to get the correct city and state
    console.log(`[OpportunityFinder] Geocoding location for disambiguation: ${location}`);
    
    const geocodeResult = await makeRequest<GeocodingResult>(
      '/maps/api/geocode/json',
      { address: `${location}, USA` }
    );
    
    if (geocodeResult.status === 'OK' && geocodeResult.results?.[0]) {
      const result = geocodeResult.results[0];
      let city = '';
      let state = '';
      
      for (const component of result.address_components) {
        if (component.types.includes('locality')) {
          city = component.long_name;
        } else if (component.types.includes('administrative_area_level_1')) {
          state = component.short_name; // Use state abbreviation (MO, FL, etc.)
        }
      }
      
      if (city && state) {
        const disambiguated = `${city}, ${state}`;
        console.log(`[OpportunityFinder] Disambiguated "${location}" to "${disambiguated}"`);
        return disambiguated;
      }
    }
    
    console.log(`[OpportunityFinder] Could not disambiguate, using original: ${location}`);
    return location;
  } catch (error) {
    console.error(`[OpportunityFinder] Geocoding error:`, error);
    return location;
  }
}

// ============================================
// TYPES
// ============================================

interface RentalListing {
  address: string;
  neighborhood: string;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  sqft?: number;
  photoUrl?: string;
  listingUrl: string;
}

interface RentalOpportunity {
  rental: RentalListing;
  projectedRevenue: number;
  occupancy: number;
  adr: number;
  profit: number;
}

interface OpportunityResult {
  market: string;
  opportunities: RentalOpportunity[];
  generatedAt: string;
}

// ============================================
// PROMPTS
// ============================================

function createRentalScrapingPrompt(city: string, minRent: number, maxRent: number): string {
  return `You are a real estate research assistant. Your task is to find rental properties that could be used for Airbnb arbitrage.

**TASK:**
1. Navigate to https://www.apartments.com/
2. In the search box, type "${city}" and search
3. Apply filters:
   - Rent: $${minRent} - $${maxRent} per month
4. Extract the first 12-15 rental listings with these details:
   - Full address (street, city, state, zip)
   - Neighborhood or area name
   - Monthly rent price (number only)
   - Number of bedrooms (number only, use 1 if studio)
   - Number of bathrooms (number only)
   - Square footage (if shown)
   - Main photo URL (the src of the listing image)
   - Full listing URL

**FALLBACK:**
If apartments.com has issues (captcha, blocking), try:
- https://www.trulia.com/for_rent/${city.replace(/,?\s+/g, '_').toLowerCase()}/
- Or https://www.zillow.com/homes/for_rent/

**OUTPUT FORMAT:**
Return ONLY a valid JSON array. No other text before or after.
[
  {
    "address": "123 Main St, Atlanta, GA 30301",
    "neighborhood": "Midtown",
    "rent": 1800,
    "bedrooms": 2,
    "bathrooms": 2,
    "sqft": 1200,
    "photoUrl": "https://...",
    "listingUrl": "https://..."
  }
]

**IMPORTANT:**
- Return ONLY valid JSON, no markdown code blocks
- Get at least 10 properties if available
- Skip listings without a clear rent price
- Use numeric values for rent, bedrooms, bathrooms (no strings)
- If bedrooms shows "Studio", use 1
- If bathrooms shows "1 ba", use 1`;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getAirDNAEstimate(address: string, bedrooms: number, bathrooms: number): Promise<{
  revenue: number;
  occupancy: number;
  adr: number;
} | null> {
  try {
    const apiKey = ENV.airdnaApiKey;
    if (!apiKey) return null;

    // Strip unit numbers from address - AirDNA works better with street addresses only
    // Removes patterns like "#7", "Unit 2525", "Apt 101", "# H1464B", etc.
    let cleanAddress = address
      .replace(/\s*#\s*[A-Za-z0-9-]+/gi, '') // #7, # H1464B
      .replace(/\s*Unit\s*[A-Za-z0-9-]+/gi, '') // Unit 2525
      .replace(/\s*Apt\.?\s*[A-Za-z0-9-]+/gi, '') // Apt 101, Apt. 101
      .replace(/\s*Suite\s*[A-Za-z0-9-]+/gi, '') // Suite 200
      .replace(/\s+/g, ' ') // Clean up extra spaces
      .trim();
    
    console.log(`[AirDNA] Original: ${address} -> Clean: ${cleanAddress}`);

    // Check in-memory cache first (keyed by cleaned address + bedrooms + bathrooms)
    const cacheKey = `opp_rentalizer_${cleanAddress}_${bedrooms}_${bathrooms}`;
    if (!_oppCache) { _oppCache = new Map(); }
    const cached = _oppCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000) {
      console.log(`[AirDNA] CACHE HIT for ${cleanAddress}`);
      return cached.data;
    }

    let data: any;
    try {
      data = await rateLimitedAirDNARequest('/rentalizer/estimate', 'POST', {
        address: cleanAddress,
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        accommodates: Math.max(bedrooms * 2, 2),
        currency: 'usd'
      }, {
        retries: 2,
        source: 'opportunity-finder',
      });
    } catch (err: any) {
      if (err?.isRateLimit) {
        console.log(`[AirDNA] Rate limited for ${address}: ${err.message}`);
        return null;
      }
      console.log(`[AirDNA] Error for ${address}: ${err}`);
      return null;
    }
    console.log(`[AirDNA] Response status: ${data.status?.type}`);
    
    // Handle enterprise API response format - data is in payload.stats.future.summary
    const stats = data.payload?.stats;
    if (!stats?.future?.summary) {
      console.log(`[AirDNA] No stats data found for ${cleanAddress}`);
      console.log(`[AirDNA] Response payload keys:`, Object.keys(data.payload || {}));
      return null;
    }
    
    const summary = stats.future.summary;
    
    // Occupancy is returned as decimal (0.84), convert to percentage for display
    const result = {
      revenue: summary.revenue || 0,
      occupancy: (summary.occupancy || 0) * 100, // Convert to percentage
      adr: summary.adr || 0,
    };
    // Cache the result
    _oppCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (error) {
    console.error('[AirDNA] Error getting estimate:', error);
    return null;
  }
}

// ============================================
// COMP-MEDIAN REVENUE ADJUSTMENT
// Uses median revenue from same bed/bath comps as the headline number
// This shows what real operators with the same property type are actually earning
// ============================================

async function getCompMedianRevenue(
  address: string,
  bedrooms: number,
  bathrooms: number,
  rentalizerRevenue: number
): Promise<{ adjustedRevenue: number; adjustedAdr: number; adjustedOccupancy: number; source: string; compCount: number }> {
  try {
    const compsData = await getRentalizerComps(address, bedrooms, bathrooms, 25);
    if (!compsData || !compsData.comps || compsData.comps.length === 0) {
      console.log(`[Comp-Median] No comps found for ${address}, using Rentalizer as-is`);
      return { adjustedRevenue: rentalizerRevenue, adjustedAdr: 0, adjustedOccupancy: 0, source: 'rentalizer', compCount: 0 };
    }

    // Match same bed/bath (within 0.5 for bathrooms)
    const matchesBathrooms = (compBa: number, targetBa: number) => Math.abs(compBa - targetBa) <= 0.5;
    const exactMatchComps = compsData.comps.filter(
      c => c.bedrooms === bedrooms && matchesBathrooms(c.bathrooms, bathrooms) && c.annual_revenue > 0
    );

    if (exactMatchComps.length >= 3) {
      // Use median of exact-match comps
      const sortedRevs = exactMatchComps.map(c => c.annual_revenue).sort((a, b) => a - b);
      const sortedAdrs = exactMatchComps.map(c => c.adr).sort((a, b) => a - b);
      const sortedOccs = exactMatchComps.map(c => c.occupancy).sort((a, b) => a - b);
      const midIdx = Math.floor(sortedRevs.length / 2);
      const medianRevenue = sortedRevs.length % 2 === 0
        ? Math.round((sortedRevs[midIdx - 1] + sortedRevs[midIdx]) / 2)
        : sortedRevs[midIdx];
      const medianAdr = sortedAdrs.length % 2 === 0
        ? Math.round((sortedAdrs[midIdx - 1] + sortedAdrs[midIdx]) / 2)
        : sortedAdrs[midIdx];
      const medianOcc = sortedOccs.length % 2 === 0
        ? (sortedOccs[midIdx - 1] + sortedOccs[midIdx]) / 2
        : sortedOccs[midIdx];

      console.log(`[Comp-Median] ${exactMatchComps.length} exact-match comps for ${bedrooms}BR/${bathrooms}BA: median=$${medianRevenue.toLocaleString()}, Rentalizer=$${rentalizerRevenue.toLocaleString()}`);
      return { adjustedRevenue: medianRevenue, adjustedAdr: medianAdr, adjustedOccupancy: medianOcc, source: 'comp_median', compCount: exactMatchComps.length };
    }

    // Fallback: P75 of same-bedroom comps (capped at 1.5x Rentalizer)
    const sameBrComps = compsData.comps.filter(c => c.bedrooms === bedrooms && c.annual_revenue > 0);
    if (sameBrComps.length >= 3) {
      const sortedRevs = sameBrComps.map(c => c.annual_revenue).sort((a, b) => a - b);
      const p75Idx = Math.max(0, Math.ceil((75 / 100) * sortedRevs.length) - 1);
      const p75Revenue = sortedRevs[p75Idx];
      const cap = Math.floor(rentalizerRevenue * 1.5);
      const targetRevenue = Math.min(p75Revenue, cap);

      if (targetRevenue > rentalizerRevenue) {
        console.log(`[Comp-Median] P75 fallback: ${sameBrComps.length} same-BR comps, P75=$${p75Revenue.toLocaleString()}, target=$${targetRevenue.toLocaleString()}, Rentalizer=$${rentalizerRevenue.toLocaleString()}`);
        return { adjustedRevenue: targetRevenue, adjustedAdr: 0, adjustedOccupancy: 0, source: 'p75_fallback', compCount: sameBrComps.length };
      }
    }

    console.log(`[Comp-Median] Not enough comps (${exactMatchComps.length} exact, ${sameBrComps.length} same-BR), using Rentalizer`);
    return { adjustedRevenue: rentalizerRevenue, adjustedAdr: 0, adjustedOccupancy: 0, source: 'rentalizer', compCount: exactMatchComps.length };
  } catch (error) {
    console.error(`[Comp-Median] Error fetching comps for ${address}:`, error);
    return { adjustedRevenue: rentalizerRevenue, adjustedAdr: 0, adjustedOccupancy: 0, source: 'rentalizer', compCount: 0 };
  }
}

// ============================================
// ROUTER
// ============================================

export const opportunityFinderRouter = router({
  /**
   * Start the Opportunity Finder search
   */
  findOpportunities: publicProcedure
    .input(z.object({
      city: z.string().min(1, 'City is required'),
      minRent: z.number().min(500).default(1000),
      maxRent: z.number().max(10000).default(3500),
    }))
    .mutation(async ({ input }) => {
      try {
        console.log(`[Opportunity Finder] Starting search for: ${input.city}`);
        
        // Create session for rental scraping
        const session = await createSession({
          startUrl: 'https://www.apartments.com',
          saveBrowserData: true,
        });
        
        console.log(`[Opportunity Finder] Session created: ${session.id}`);
        
        // Create task for rental scraping
        const task = await createTask({
          sessionId: session.id,
          task: createRentalScrapingPrompt(input.city, input.minRent, input.maxRent),
          maxSteps: 60,
          llm: 'claude-opus-4-5-20251101',
          thinking: true,
          vision: true,
        });
        
        console.log(`[Opportunity Finder] Task created: ${task.id}`);
        
        return {
          success: true,
          taskId: task.id,
          sessionId: session.id,
          city: input.city,
          message: `Searching for rentals in ${input.city}...`,
        };
        
      } catch (error) {
        console.error('[Opportunity Finder] Error starting search:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to start opportunity search',
        });
      }
    }),

  /**
   * Check the status of the rental scraping task
   */
  getSearchStatus: publicProcedure
    .input(z.object({
      taskId: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const task = await getTask(input.taskId);
        
        const isFinished = task.status === 'finished';
        const isFailed = task.status === 'stopped';
        
        let progress = 10;
        let currentStep = 'Searching for rentals...';
        
        if (isFinished) {
          progress = 50;
          currentStep = 'Rentals found! Calculating projections...';
        } else if (isFailed) {
          progress = 0;
          currentStep = 'Search failed. Please try again.';
        }
        
        return {
          status: isFinished ? 'ready' : isFailed ? 'error' : 'running',
          progress,
          currentStep,
          output: isFinished && task.isSuccess ? task.output : null,
          error: isFailed ? 'Search failed or was stopped' : null,
        };
        
      } catch (error) {
        console.error('[Opportunity Finder] Error checking status:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check search status',
        });
      }
    }),

  /**
   * Process the rental listings and add AirDNA projections
   */
  processResults: publicProcedure
    .input(z.object({
      city: z.string(),
      rentalOutput: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        console.log('[Opportunity Finder] Processing results...');
        
        // Parse the rental listings
        let rentals: RentalListing[] = [];
        
        try {
          // Try to extract JSON array from the output
          const jsonMatch = input.rentalOutput.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            rentals = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error('[Opportunity Finder] Error parsing rental data:', e);
          rentals = [];
        }
        
        console.log(`[Opportunity Finder] Found ${rentals.length} rentals`);
        
        if (rentals.length === 0) {
          return {
            market: input.city,
            opportunities: [],
            generatedAt: new Date().toISOString(),
            error: 'No rentals found. Try a different city or adjust your budget range.',
          };
        }
        
        // Get AirDNA projections for each rental
        const opportunities: RentalOpportunity[] = [];
        
        for (const rental of rentals.slice(0, 12)) {
          console.log(`[Opportunity Finder] Getting estimate for: ${rental.address}`);
          
          const estimate = await getAirDNAEstimate(
            rental.address,
            rental.bedrooms ?? 2,
            rental.bathrooms ?? 1
          );
          
          if (estimate && estimate.revenue > 0) {
            // Apply comp-median adjustment
            const compMedian = await getCompMedianRevenue(rental.address, rental.bedrooms ?? 2, rental.bathrooms ?? 1, estimate.revenue);
            const headlineRevenue = compMedian.adjustedRevenue;
            const headlineAdr = compMedian.adjustedAdr > 0 ? compMedian.adjustedAdr : estimate.adr;
            const headlineOccupancy = compMedian.adjustedOccupancy > 0 ? compMedian.adjustedOccupancy : estimate.occupancy;
            
            const monthlyRevenue = headlineRevenue / 12;
            const estimatedExpenses = monthlyRevenue * 0.20; // 20% of revenue for operating costs
            const profit = monthlyRevenue - rental.rent - estimatedExpenses;
            
            opportunities.push({
              rental,
              projectedRevenue: Math.round(monthlyRevenue),
              occupancy: headlineOccupancy,
              adr: headlineAdr,
              profit: Math.round(profit),
            });
          }
        }
        
        // Sort by profit (highest first)
        opportunities.sort((a, b) => b.profit - a.profit);
        
        console.log(`[Opportunity Finder] Processed ${opportunities.length} opportunities`);
        
        const result: OpportunityResult = {
          market: input.city,
          opportunities,
          generatedAt: new Date().toISOString(),
        };
        
        return result;
        
      } catch (error) {
        console.error('[Opportunity Finder] Error processing results:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process search results',
        });
      }
    }),

  /**
   * Clean up session
   */
  cleanup: publicProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        await stopSession(input.sessionId).catch(() => {});
        return { success: true };
      } catch (error) {
        return { success: false };
      }
    }),

  // ============================================
  // HASDATA ZILLOW API ENDPOINTS (Fast & Reliable)
  // ============================================

  /**
   * Search Zillow rentals using HasData API
   * This is the fast, reliable alternative to browser scraping
   * Supports pagination with Load More functionality
   */
  searchZillowRentals: publicProcedure
    .input(z.object({
      location: z.string().min(1, 'Location is required'),
      priceMin: z.number().optional(),
      priceMax: z.number().optional(),
      bedsMin: z.number().optional(),
      bedsMax: z.number().optional(),
      bathsMin: z.number().optional(),
      bathsMax: z.number().optional(),
      homeTypes: z.array(z.string()).optional(),
      page: z.number().optional().default(1),
      loadMore: z.boolean().optional().default(false), // If true, fetch only the specified page
    }))
    .mutation(async ({ input }) => {
      try {
        // DO NOT normalize city names for HasData/Zillow search.
        // normalizeCityName expands "St." to "Saint" which causes Zillow to resolve
        // "Saint Louis" to "Saint Petersburg" instead. Zillow handles "St. Louis" correctly.
        // normalizeCityName is only useful for AirDNA's local market database search.
        
        // Extract zip code from original input BEFORE disambiguation
        // Google Places may send "63108, Saint Louis, MO, USA" which gets disambiguated to "Saint Louis, MO"
        // We need to preserve the zip code for filtering
        const zipCodeMatch = input.location.match(/\b(\d{5})\b/);
        const filterZipCode = zipCodeMatch ? zipCodeMatch[1] : undefined;
        
        // Disambiguate location by geocoding to get correct city + state
        // Pass the ORIGINAL location (not normalized) to preserve abbreviations like "St."
        const disambiguatedLocation = await disambiguateLocation(input.location.trim());
        console.log(`[Opportunity Finder] Searching Zillow rentals: ${input.location} -> ${disambiguatedLocation}, filterZipCode: ${filterZipCode || 'none'}, page: ${input.page}, loadMore: ${input.loadMore}`);
        
        // If loadMore is true, just fetch the specific page
        if (input.loadMore && input.page > 1) {
          const result = await searchZillowListingsWithEnrichment(
            {
              keyword: disambiguatedLocation,
              type: 'forRent',
              priceMin: input.priceMin,
              priceMax: input.priceMax,
              bedsMin: input.bedsMin,
              bedsMax: input.bedsMax,
              bathsMin: input.bathsMin,
              bathsMax: input.bathsMax,
              homeTypes: input.homeTypes,
              page: input.page,
              filterZipCode,
            },
            { maxEnrichments: 10 }
          );
          
          if (!result.success) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: result.error || 'Failed to search Zillow rentals',
            });
          }
          
          const estimatedTotalPages = Math.ceil(result.totalResults / 40);
          const hasMore = input.page < estimatedTotalPages;
          
          console.log(`[Opportunity Finder] Load more rentals page ${input.page}: ${result.properties.length} properties, hasMore: ${hasMore}`);
          
          return {
            success: true,
            totalResults: result.totalResults,
            properties: result.properties,
            location: input.location,
            hasMore,
            currentPage: input.page,
            totalPages: estimatedTotalPages,
          };
        }
        
        // Initial search: fetch first 3 pages for comprehensive results
        // This fixes the issue where only ~37 of 97 rentals were returned
        const firstResult = await searchZillowListingsWithEnrichment(
          {
            keyword: disambiguatedLocation,
            type: 'forRent',
            priceMin: input.priceMin,
            priceMax: input.priceMax,
            bedsMin: input.bedsMin,
            bedsMax: input.bedsMax,
            bathsMin: input.bathsMin,
            bathsMax: input.bathsMax,
            homeTypes: input.homeTypes,
            page: 1,
            filterZipCode,
          },
          { maxEnrichments: 15 }
        );
        
        if (!firstResult.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: firstResult.error || 'Failed to search Zillow rentals',
          });
        }
        
        let allProperties = [...firstResult.properties];
        const totalResults = firstResult.totalResults;
        
        // Estimate ~40 properties per page
        const estimatedTotalPages = Math.ceil(totalResults / 40);
        // Fetch first 3 pages on initial load for comprehensive coverage
        const initialPagesToFetch = Math.min(3, estimatedTotalPages);
        
        console.log(`[Opportunity Finder] Rentals total: ${totalResults}, estimated pages: ${estimatedTotalPages}, fetching initial ${initialPagesToFetch} pages`);
        
        // Fetch pages 2-3 in parallel for initial load
        if (initialPagesToFetch > 1) {
          const pagePromises = [];
          for (let page = 2; page <= initialPagesToFetch; page++) {
            pagePromises.push(
              searchZillowListings({
                keyword: disambiguatedLocation,
                type: 'forRent',
                priceMin: input.priceMin,
                priceMax: input.priceMax,
                bedsMin: input.bedsMin,
                bedsMax: input.bedsMax,
                bathsMin: input.bathsMin,
                bathsMax: input.bathsMax,
                homeTypes: input.homeTypes,
                page,
                filterZipCode,
              })
            );
          }
          
          const additionalResults = await Promise.all(pagePromises);
          
          for (const result of additionalResults) {
            if (result.success && result.properties.length > 0) {
              // Deduplicate by property ID
              const existingIds = new Set(allProperties.map(p => p.id));
              const newProperties = result.properties.filter(p => !existingIds.has(p.id));
              allProperties.push(...newProperties);
            }
          }
        }
        
        // Determine if there are more pages to load
        const hasMore = initialPagesToFetch < estimatedTotalPages;
        
        console.log(`[Opportunity Finder] Fetched ${allProperties.length} total rental properties, hasMore: ${hasMore}`);
        
        return {
          success: true,
          totalResults: totalResults,
          properties: allProperties,
          location: input.location,
          currentPage: initialPagesToFetch,
          totalPages: estimatedTotalPages,
          hasMore: hasMore,
        };
        
      } catch (error) {
        console.error('[Opportunity Finder] Zillow search error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to search Zillow rentals',
        });
      }
    }),

  /**
   * Search Zillow properties for sale using HasData API
   * Fetches multiple pages to get more results (up to 5 pages = ~200 properties)
   */
  searchZillowForSale: publicProcedure
    .input(z.object({
      location: z.string().min(1, 'Location is required'),
      priceMin: z.number().optional(),
      priceMax: z.number().optional(),
      bedsMin: z.number().optional(),
      bedsMax: z.number().optional(),
      bathsMin: z.number().optional(),
      bathsMax: z.number().optional(),
      homeTypes: z.array(z.string()).optional(),
      page: z.number().optional().default(1),
      loadMore: z.boolean().optional().default(false), // If true, fetch only the specified page
    }))
    .mutation(async ({ input }) => {
      try {
        // DO NOT normalize city names for HasData/Zillow search.
        // normalizeCityName expands "St." to "Saint" which causes Zillow to resolve
        // "Saint Louis" to "Saint Petersburg" instead. Zillow handles "St. Louis" correctly.
        
        // Extract zip code from original input BEFORE disambiguation
        const zipCodeMatch = input.location.match(/\b(\d{5})\b/);
        const filterZipCode = zipCodeMatch ? zipCodeMatch[1] : undefined;
        
        // Disambiguate location by geocoding to get correct city + state
        // Pass the ORIGINAL location (not normalized) to preserve abbreviations like "St."
        const disambiguatedLocation = await disambiguateLocation(input.location.trim());
        console.log(`[Opportunity Finder] Searching Zillow for sale: ${input.location} -> ${disambiguatedLocation}, filterZipCode: ${filterZipCode || 'none'}, page: ${input.page}, loadMore: ${input.loadMore}`);
        
        // If loadMore is true, just fetch the specific page
        if (input.loadMore && input.page > 1) {
          const result = await searchZillowListingsWithEnrichment(
            {
              keyword: disambiguatedLocation,
              type: 'forSale',
              priceMin: input.priceMin,
              priceMax: input.priceMax,
              bedsMin: input.bedsMin,
              bedsMax: input.bedsMax,
              bathsMin: input.bathsMin,
              bathsMax: input.bathsMax,
              homeTypes: input.homeTypes,
              page: input.page,
              filterZipCode,
            },
            { maxEnrichments: 10 }
          );
          
          if (!result.success) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: result.error || 'Failed to search Zillow properties',
            });
          }
          
          // Estimate ~40 properties per page
          const estimatedTotalPages = Math.ceil(result.totalResults / 40);
          const hasMore = input.page < estimatedTotalPages;
          
          console.log(`[Opportunity Finder] Load more page ${input.page}: ${result.properties.length} properties, hasMore: ${hasMore}`);
          
          return {
            success: true,
            totalResults: result.totalResults,
            properties: result.properties,
            location: input.location,
            hasMore,
            currentPage: input.page,
          };
        }
        
        // Initial search: fetch first 3 pages for faster initial load
        const firstResult = await searchZillowListingsWithEnrichment(
          {
            keyword: disambiguatedLocation,
            type: 'forSale',
            priceMin: input.priceMin,
            priceMax: input.priceMax,
            bedsMin: input.bedsMin,
            bedsMax: input.bedsMax,
            bathsMin: input.bathsMin,
            bathsMax: input.bathsMax,
            homeTypes: input.homeTypes,
            page: 1,
            filterZipCode,
          },
          { maxEnrichments: 15 }
        );
        
        if (!firstResult.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: firstResult.error || 'Failed to search Zillow properties',
          });
        }
        
        let allProperties = [...firstResult.properties];
        const totalResults = firstResult.totalResults;
        
        // Estimate ~40 properties per page
        const estimatedTotalPages = Math.ceil(totalResults / 40);
        // Fetch first 3 pages on initial load for faster response
        const initialPagesToFetch = Math.min(3, estimatedTotalPages);
        
        console.log(`[Opportunity Finder] Total results: ${totalResults}, estimated pages: ${estimatedTotalPages}, fetching initial ${initialPagesToFetch} pages`);
        
        // Fetch pages 2-3 in parallel for initial load
        if (initialPagesToFetch > 1) {
          const pagePromises = [];
          for (let page = 2; page <= initialPagesToFetch; page++) {
            pagePromises.push(
              searchZillowListings({
                keyword: disambiguatedLocation,
                type: 'forSale',
                priceMin: input.priceMin,
                priceMax: input.priceMax,
                bedsMin: input.bedsMin,
                bedsMax: input.bedsMax,
                bathsMin: input.bathsMin,
                bathsMax: input.bathsMax,
                homeTypes: input.homeTypes,
                page,
                filterZipCode,
              })
            );
          }
          
          const additionalResults = await Promise.all(pagePromises);
          
          for (const result of additionalResults) {
            if (result.success && result.properties.length > 0) {
              // Deduplicate by property ID
              const existingIds = new Set(allProperties.map(p => p.id));
              const newProperties = result.properties.filter(p => !existingIds.has(p.id));
              allProperties.push(...newProperties);
            }
          }
        }
        
        // Determine if there are more pages to load
        const hasMore = initialPagesToFetch < estimatedTotalPages;
        
        console.log(`[Opportunity Finder] Fetched ${allProperties.length} total properties for sale, hasMore: ${hasMore}`);
        
        return {
          success: true,
          totalResults: totalResults,
          properties: allProperties,
          location: input.location,
          hasMore,
          currentPage: initialPagesToFetch,
        };
        
      } catch (error) {
        console.error('[Opportunity Finder] Zillow for sale search error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to search Zillow properties',
        });
      }
    }),

  /**
   * Validate a Zillow property with AirDNA revenue projection
   * Returns the property with projected STR revenue and profit calculation
   */
  /**
   * Get property contact information (agent/landlord details)
   * Uses HasData Property API with extractAgentEmails=true
   * Cost: 5 credits per request
   */
  getPropertyContacts: publicProcedure
    .input(z.object({
      zillowUrl: z.string().min(1, 'Zillow URL is required'),
    }))
    .mutation(async ({ input }) => {
      try {
        console.log(`[Opportunity Finder] Getting contacts for: ${input.zillowUrl}`);
        
        const propertyData = await getZillowPropertyWithContacts(input.zillowUrl);
        
        if (!propertyData) {
          return {
            success: false,
            error: 'Could not retrieve property contact information',
            contacts: null,
          };
        }
        
        // Determine the best contact to show
        const primaryContact = propertyData.agent || propertyData.listingAgent;
        
        return {
          success: true,
          contacts: {
            agent: propertyData.agent,
            listingAgent: propertyData.listingAgent,
            primaryContact,
            buildingName: propertyData.buildingName,
          },
          property: {
            address: propertyData.address,
            price: propertyData.price,
            bedrooms: propertyData.bedrooms,
            bathrooms: propertyData.bathrooms,
            description: propertyData.description,
            amenities: propertyData.amenities,
          },
        };
        
      } catch (error) {
        console.error('[Opportunity Finder] Contact fetch error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get property contacts',
        });
      }
    }),

  validateProperty: publicProcedure
    .input(z.object({
      address: z.string().min(1, 'Address is required'),
      rent: z.number().min(0, 'Rent is required'),
      bedrooms: z.number().min(1),
      bathrooms: z.number().min(0.5),
      zillowUrl: z.string().optional(),
      image: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        console.log(`[Opportunity Finder] Validating property: ${input.address}`);
        
        // Get AirDNA estimate
        const estimate = await getAirDNAEstimate(
          input.address,
          input.bedrooms,
          input.bathrooms
        );
        
        if (!estimate || estimate.revenue === 0) {
          return {
            success: false,
            error: 'Could not get revenue estimate for this property. Try a different address.',
            property: input,
          };
        }
        
        // Apply comp-median adjustment: use median of same bed/bath comps as headline revenue
        // This shows what real operators are actually earning, not AirDNA's conservative new-listing prediction
        const compMedian = await getCompMedianRevenue(input.address, input.bedrooms, input.bathrooms, estimate.revenue);
        const headlineRevenue = compMedian.adjustedRevenue;
        const headlineAdr = compMedian.adjustedAdr > 0 ? compMedian.adjustedAdr : estimate.adr;
        const headlineOccupancy = compMedian.adjustedOccupancy > 0 ? compMedian.adjustedOccupancy : estimate.occupancy;
        
        console.log(`[Opportunity Finder] Revenue: Rentalizer=$${estimate.revenue.toLocaleString()} → Headline=$${headlineRevenue.toLocaleString()} (source: ${compMedian.source}, ${compMedian.compCount} comps)`);
        
        // Calculate profitability using comp-median revenue
        const monthlyRevenue = headlineRevenue / 12;
        const operatingCosts = monthlyRevenue * 0.20; // 20% for utilities, supplies, cleaning, etc.
        const monthlyProfit = monthlyRevenue - input.rent - operatingCosts;
        const annualProfit = monthlyProfit * 12;
        const roi = (annualProfit / (input.rent * 12)) * 100;
        
        // Determine if it's a good deal
        const isGoodDeal = monthlyProfit > 500 && headlineOccupancy > 50;
        const verdict = monthlyProfit > 1000 ? 'Excellent Opportunity' :
                        monthlyProfit > 500 ? 'Good Opportunity' :
                        monthlyProfit > 0 ? 'Marginal - Proceed with Caution' :
                        'Not Recommended';
        
        // Record AirDNA usage
        const userId = ctx.user?.id;
        const ipAddress = ctx.req?.ip || ctx.req?.socket?.remoteAddress;
        await recordAnalysisUsage(userId, undefined, ipAddress, 1).catch(err =>
          console.error('[OpportunityFinder] Error recording usage:', err)
        );

        return {
          success: true,
          property: {
            address: input.address,
            rent: input.rent,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            zillowUrl: input.zillowUrl,
            image: input.image,
          },
          projection: {
            annualRevenue: Math.round(headlineRevenue),
            monthlyRevenue: Math.round(monthlyRevenue),
            occupancy: headlineOccupancy,
            adr: headlineAdr,
            operatingCosts: Math.round(operatingCosts),
            monthlyProfit: Math.round(monthlyProfit),
            annualProfit: Math.round(annualProfit),
            roi: Math.round(roi),
          },
          verdict,
          isGoodDeal,
        };
        
      } catch (error) {
        console.error('[Opportunity Finder] Validation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to validate property',
        });
      }
    }),

  /**
   * Batch Analyze All Properties
   * Runs AirDNA Rentalizer on up to 20 properties concurrently
   * and returns results ranked by profitability
   */
  batchValidateProperties: publicProcedure
    .input(z.object({
      properties: z.array(z.object({
        id: z.string(),
        address: z.string().min(1),
        rent: z.number().min(0),
        bedrooms: z.number().min(0),
        bathrooms: z.number().min(0),
        zillowUrl: z.string().optional(),
        image: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
      })).min(1).max(50),
      minProfitThreshold: z.number().min(0).default(500),
    }))
    .mutation(async ({ input, ctx }) => {
      const { properties, minProfitThreshold } = input;
      console.log(`[Batch Analyze] Starting batch analysis of ${properties.length} properties`);
      const startTime = Date.now();

      // Run all AirDNA estimates concurrently with a concurrency limit of 5
      const CONCURRENCY = 5;
      const results: Array<{
        id: string;
        success: boolean;
        property: {
          address: string;
          rent: number;
          bedrooms: number;
          bathrooms: number;
          zillowUrl?: string;
          image?: string;
          city?: string;
          state?: string;
          zipCode?: string;
        };
        projection?: {
          annualRevenue: number;
          monthlyRevenue: number;
          occupancy: number;
          adr: number;
          operatingCosts: number;
          monthlyProfit: number;
          annualProfit: number;
          roi: number;
        };
        verdict?: string;
        isGoodDeal?: boolean;
        error?: string;
      }> = [];

      // Process in batches of CONCURRENCY
      for (let i = 0; i < properties.length; i += CONCURRENCY) {
        const batch = properties.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
          batch.map(async (prop) => {
            try {
              const estimate = await getAirDNAEstimate(
                `${prop.address}, ${prop.city || ''}, ${prop.state || ''} ${prop.zipCode || ''}`.trim(),
                prop.bedrooms,
                prop.bathrooms
              );

              if (!estimate || estimate.revenue === 0) {
                return {
                  id: prop.id,
                  success: false as const,
                  property: prop,
                  error: 'Could not get revenue estimate',
                };
              }

              // Apply comp-median adjustment: use median of same bed/bath comps as headline
              const fullAddress = `${prop.address}, ${prop.city || ''}, ${prop.state || ''} ${prop.zipCode || ''}`.trim();
              const compMedian = await getCompMedianRevenue(fullAddress, prop.bedrooms, prop.bathrooms, estimate.revenue);
              const headlineRevenue = compMedian.adjustedRevenue;
              const headlineAdr = compMedian.adjustedAdr > 0 ? compMedian.adjustedAdr : estimate.adr;
              const headlineOccupancy = compMedian.adjustedOccupancy > 0 ? compMedian.adjustedOccupancy : estimate.occupancy;
              
              console.log(`[Batch Analyze] ${prop.address}: Rentalizer=$${estimate.revenue.toLocaleString()} → Headline=$${headlineRevenue.toLocaleString()} (${compMedian.source}, ${compMedian.compCount} comps)`);

              const monthlyRevenue = headlineRevenue / 12;
              const operatingCosts = monthlyRevenue * 0.20;
              const monthlyProfit = monthlyRevenue - prop.rent - operatingCosts;
              const annualProfit = monthlyProfit * 12;
              const roi = (annualProfit / (prop.rent * 12)) * 100;
              const isGoodDeal = monthlyProfit >= minProfitThreshold;
              const verdict = monthlyProfit > 1000 ? 'Excellent Opportunity' :
                              monthlyProfit > 500 ? 'Good Opportunity' :
                              monthlyProfit > 0 ? 'Marginal - Proceed with Caution' :
                              'Not Recommended';

              return {
                id: prop.id,
                success: true as const,
                property: prop,
                projection: {
                  annualRevenue: Math.round(headlineRevenue),
                  monthlyRevenue: Math.round(monthlyRevenue),
                  occupancy: headlineOccupancy,
                  adr: headlineAdr,
                  operatingCosts: Math.round(operatingCosts),
                  monthlyProfit: Math.round(monthlyProfit),
                  annualProfit: Math.round(annualProfit),
                  roi: Math.round(roi),
                },
                verdict,
                isGoodDeal,
              };
            } catch (err) {
              console.error(`[Batch Analyze] Error for ${prop.address}:`, err);
              return {
                id: prop.id,
                success: false as const,
                property: prop,
                error: 'Analysis failed',
              };
            }
          })
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            // This shouldn't happen since we catch inside, but just in case
            results.push({
              id: 'unknown',
              success: false,
              property: { address: 'Unknown', rent: 0, bedrooms: 0, bathrooms: 0 },
              error: 'Unexpected error',
            });
          }
        }
      }

      // Sort by monthly profit descending (successful ones first)
      const successful = results.filter(r => r.success && r.projection);
      const failed = results.filter(r => !r.success);
      successful.sort((a, b) => (b.projection?.monthlyProfit || 0) - (a.projection?.monthlyProfit || 0));

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Batch Analyze] Complete: ${successful.length} succeeded, ${failed.length} failed in ${elapsed}s`);

      // Record AirDNA usage for all successful analyses
      if (successful.length > 0) {
        const userId = ctx.user?.id;
        const ipAddress = ctx.req?.ip || ctx.req?.socket?.remoteAddress;
        await recordAnalysisUsage(userId, undefined, ipAddress, successful.length).catch(err =>
          console.error('[BatchAnalyze] Error recording usage:', err)
        );
      }

      return {
        success: true,
        totalAnalyzed: properties.length,
        successCount: successful.length,
        failedCount: failed.length,
        elapsedSeconds: parseFloat(elapsed),
        // Ranked results: profitable first, then marginal, then failed
        results: [...successful, ...failed],
        // Top deals summary
        topDeals: successful
          .filter(r => r.isGoodDeal)
          .slice(0, 5)
          .map(r => ({
            id: r.id,
            address: r.property.address,
            city: r.property.city,
            state: r.property.state,
            rent: r.property.rent,
            monthlyProfit: r.projection!.monthlyProfit,
            annualProfit: r.projection!.annualProfit,
            annualRevenue: r.projection!.annualRevenue,
            monthlyRevenue: r.projection!.monthlyRevenue,
            roi: r.projection!.roi,
            occupancy: r.projection!.occupancy,
            adr: r.projection!.adr,
            verdict: r.verdict!,
            image: r.property.image,
            zillowUrl: r.property.zillowUrl,
            bedrooms: r.property.bedrooms,
            bathrooms: r.property.bathrooms,
          })),
      };
    }),
});
