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

    const response = await fetch(
      `https://api.airdna.co/v2/rentalizer/estimate?` +
      `address=${encodeURIComponent(address)}&` +
      `bedrooms=${bedrooms}&` +
      `bathrooms=${bathrooms}&` +
      `currency=USD`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.log(`[AirDNA] Error for ${address}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    return {
      revenue: data.revenue?.ltm || data.revenue?.projected || 0,
      occupancy: data.occupancy?.ltm || data.occupancy?.projected || 0,
      adr: data.adr?.ltm || data.adr?.projected || 0,
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
});
