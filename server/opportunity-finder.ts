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
import { TRPCError } from '@trpc/server';
import { ENV } from './_core/env';
import { 
  createSession, 
  createTask, 
  getTask, 
  stopSession,
} from './browser-use';
import { searchZillowListings, getZillowPropertyWithContacts, type ZillowProperty, type ZillowListingResponse, type ZillowAgentContact, type ZillowPropertyWithContacts } from './hasdata';

// ============================================
// CITY NAME NORMALIZATION
// ============================================

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

    const response = await fetch(
      `https://api.airdna.co/api/enterprise/v2/rentalizer/estimate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: cleanAddress,
          bedrooms: bedrooms,
          bathrooms: bathrooms,
          accommodates: Math.max(bedrooms * 2, 2), // Estimate accommodates
          currency: 'usd'
        })
      }
    );

    if (!response.ok) {
      console.log(`[AirDNA] Error for ${address}: ${response.status}`);
      return null;
    }

    const data = await response.json();
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
    return {
      revenue: summary.revenue || 0,
      occupancy: (summary.occupancy || 0) * 100, // Convert to percentage
      adr: summary.adr || 0,
    };
  } catch (error) {
    console.error('[AirDNA] Error getting estimate:', error);
    return null;
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
            rental.bedrooms || 2,
            rental.bathrooms || 1
          );
          
          if (estimate && estimate.revenue > 0) {
            const monthlyRevenue = estimate.revenue / 12;
            const estimatedExpenses = rental.rent * 0.15; // ~15% for utilities, supplies, etc.
            const profit = monthlyRevenue - rental.rent - estimatedExpenses;
            
            opportunities.push({
              rental,
              projectedRevenue: Math.round(monthlyRevenue),
              occupancy: estimate.occupancy,
              adr: estimate.adr,
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
        // Normalize city name variations (St. Louis -> Saint Louis, etc.)
        const normalizedLocation = normalizeCityName(input.location);
        console.log(`[Opportunity Finder] Searching Zillow rentals: ${input.location} (normalized: ${normalizedLocation}), page: ${input.page}`);
        
        // Fetch the requested page
        const result = await searchZillowListings({
          keyword: normalizedLocation,
          type: 'forRent',
          priceMin: input.priceMin,
          priceMax: input.priceMax,
          bedsMin: input.bedsMin,
          bedsMax: input.bedsMax,
          bathsMin: input.bathsMin,
          bathsMax: input.bathsMax,
          homeTypes: input.homeTypes,
          page: input.page,
        });
        
        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Failed to search Zillow rentals',
          });
        }
        
        const totalResults = result.totalResults;
        const propertiesPerPage = 40; // Zillow returns ~40 per page
        const totalPages = Math.ceil(totalResults / propertiesPerPage);
        const hasMore = input.page < totalPages;
        
        console.log(`[Opportunity Finder] Page ${input.page}: ${result.properties.length} properties, total: ${totalResults}, hasMore: ${hasMore}`);
        
        return {
          success: true,
          totalResults: totalResults,
          properties: result.properties,
          location: input.location,
          currentPage: input.page,
          totalPages: totalPages,
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
      page: z.number().optional(),
      maxPages: z.number().optional().default(5), // Fetch up to 5 pages by default
    }))
    .mutation(async ({ input }) => {
      try {
        // Normalize city name variations (St. Louis -> Saint Louis, etc.)
        const normalizedLocation = normalizeCityName(input.location);
        console.log(`[Opportunity Finder] Searching Zillow for sale: ${input.location} (normalized: ${normalizedLocation})`);
        
        // Fetch first page to get total results
        const firstResult = await searchZillowListings({
          keyword: normalizedLocation,
          type: 'forSale',
          priceMin: input.priceMin,
          priceMax: input.priceMax,
          bedsMin: input.bedsMin,
          bedsMax: input.bedsMax,
          bathsMin: input.bathsMin,
          bathsMax: input.bathsMax,
          homeTypes: input.homeTypes,
          page: input.page || 1,
        });
        
        if (!firstResult.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: firstResult.error || 'Failed to search Zillow properties',
          });
        }
        
        let allProperties = [...firstResult.properties];
        const totalResults = firstResult.totalResults;
        const maxPages = input.maxPages || 5;
        
        // Estimate ~40 properties per page, fetch additional pages
        const estimatedPages = Math.ceil(totalResults / 40);
        const pagesToFetch = Math.min(estimatedPages, maxPages);
        
        console.log(`[Opportunity Finder] Total results: ${totalResults}, fetching ${pagesToFetch} pages`);
        
        // Fetch additional pages in parallel (pages 2 through pagesToFetch)
        if (pagesToFetch > 1 && !input.page) {
          const pagePromises = [];
          for (let page = 2; page <= pagesToFetch; page++) {
            pagePromises.push(
              searchZillowListings({
                keyword: input.location,
                type: 'forSale',
                priceMin: input.priceMin,
                priceMax: input.priceMax,
                bedsMin: input.bedsMin,
                bedsMax: input.bedsMax,
                bathsMin: input.bathsMin,
                bathsMax: input.bathsMax,
                homeTypes: input.homeTypes,
                page,
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
        
        console.log(`[Opportunity Finder] Fetched ${allProperties.length} total properties for sale`);
        
        return {
          success: true,
          totalResults: totalResults,
          properties: allProperties,
          location: input.location,
          hasMore: false, // For sale fetches all pages upfront
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
    .mutation(async ({ input }) => {
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
        
        // Calculate profitability
        const monthlyRevenue = estimate.revenue / 12;
        const operatingCosts = input.rent * 0.20; // 20% for utilities, supplies, cleaning, etc.
        const monthlyProfit = monthlyRevenue - input.rent - operatingCosts;
        const annualProfit = monthlyProfit * 12;
        const roi = (annualProfit / (input.rent * 12)) * 100;
        
        // Determine if it's a good deal
        const isGoodDeal = monthlyProfit > 500 && estimate.occupancy > 50;
        const verdict = monthlyProfit > 1000 ? 'Excellent Opportunity' :
                        monthlyProfit > 500 ? 'Good Opportunity' :
                        monthlyProfit > 0 ? 'Marginal - Proceed with Caution' :
                        'Not Recommended';
        
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
            annualRevenue: Math.round(estimate.revenue),
            monthlyRevenue: Math.round(monthlyRevenue),
            occupancy: estimate.occupancy,
            adr: estimate.adr,
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
});
