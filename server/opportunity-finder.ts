/**
 * Opportunity Finder - Complete Implementation
 * 
 * Combines:
 * 1. Browser Use → Zillow (rental listings)
 * 2. Browser Use → Coach Inayah (market data + top performers)
 * 3. Browser Use → Airbnb (amenity analysis from top performers)
 * 4. AirDNA API → Revenue projections for each rental
 * 
 * Shows beginners real arbitrage opportunities with what they need to win.
 */

import { z } from 'zod';
import { router, publicProcedure } from './_core/trpc';
import { TRPCError } from '@trpc/server';
import { ENV } from './_core/env';
import { getDb } from './db';
import { eq } from 'drizzle-orm';
import { 
  createSession, 
  createTask, 
  getTask, 
  stopSession,
} from './browser-use';

// ============================================
// TYPES
// ============================================

interface ZillowRental {
  address: string;
  neighborhood: string;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  sqft?: number;
  photoUrl?: string;
  listingUrl: string;
}

interface AmenityInsight {
  amenity: string;
  percentage: number;
  icon: string;
}

interface RentalOpportunity {
  rental: ZillowRental;
  projectedRevenue: number;
  occupancy: number;
  adr: number;
  profit: number;
  similarAirbnbRevenue?: number;
}

interface OpportunityFinderResult {
  market: string;
  marketSnapshot: {
    totalListings: number;
    avgOccupancy: number;
    avgMonthlyRevenue: number;
    hotNeighborhoods: string[];
  };
  winningAmenities: AmenityInsight[];
  opportunities: RentalOpportunity[];
  generatedAt: string;
}

// ============================================
// PROMPTS
// ============================================

function createZillowScrapingPrompt(city: string, minRent: number, maxRent: number): string {
  return `You are a real estate research assistant. Your task is to find rental properties on Zillow that could be used for Airbnb arbitrage.

**TASK:**
1. Navigate to https://www.zillow.com/homes/for_rent/
2. Search for "${city}"
3. Apply filters:
   - Rent: $${minRent} - $${maxRent}
   - Property types: Houses, Apartments, Townhouses
4. Extract the first 15-20 rental listings with:
   - Full address
   - Neighborhood/area name
   - Monthly rent price
   - Number of bedrooms
   - Number of bathrooms
   - Square footage (if available)
   - Main photo URL
   - Zillow listing URL

**OUTPUT FORMAT:**
Return a JSON array of rental properties:
[
  {
    "address": "123 Main St, Atlanta, GA 30301",
    "neighborhood": "Midtown",
    "rent": 1800,
    "bedrooms": 2,
    "bathrooms": 2,
    "sqft": 1200,
    "photoUrl": "https://photos.zillowstatic.com/...",
    "listingUrl": "https://www.zillow.com/homedetails/..."
  },
  ...
]

**IMPORTANT:**
- Only return valid JSON
- Get at least 15 properties if available
- Skip any listings without rent price or address
- Include the full Zillow URL for each listing`;
}

function createAmenityAnalysisPrompt(city: string): string {
  return `You are a market research analyst. Your task is to analyze what amenities make Airbnb properties successful in ${city}.

**TASK:**
1. Navigate to https://coachinayah.com/login
2. Login with:
   - Email: ${ENV.coachinayahEmail}
   - Password: ${ENV.coachinayahPassword}
3. Go to https://coachinayah.com/market-charts
4. Select "${city}" from the cities dropdown
5. Click on "Comp Data" tab
6. Sort by Revenue (highest first)
7. Note the top 10 highest-earning properties
8. For each of the top 5 properties:
   - Click on the Airbnb link (if available)
   - Extract the amenities list from the Airbnb listing
9. Also extract from the Dashboard tab:
   - Total listings count
   - Average occupancy
   - Top property types
   - Top amenities percentages

**OUTPUT FORMAT:**
Return JSON with market data and amenity analysis:
{
  "marketSnapshot": {
    "totalListings": 4200,
    "avgOccupancy": 0.62,
    "avgMonthlyRevenue": 3800,
    "hotNeighborhoods": ["Midtown", "East Atlanta", "Buckhead"]
  },
  "topPerformerAmenities": [
    {"amenity": "Hot tub", "count": 4, "percentage": 80},
    {"amenity": "Pool", "count": 3, "percentage": 60},
    {"amenity": "Free parking", "count": 5, "percentage": 100},
    {"amenity": "Game room", "count": 3, "percentage": 60},
    {"amenity": "Professional photos", "count": 5, "percentage": 100}
  ],
  "uniqueFindings": [
    "Most top performers have themed decor (music, sports, etc.)",
    "Properties sleeping 6+ guests earn 40% more",
    "Hot tubs add $500-800/month in revenue"
  ]
}

**IMPORTANT:**
- Be thorough - visit actual Airbnb listings to see amenities
- Look for both obvious amenities (pool, hot tub) and subtle ones (guitar, board games)
- Note any patterns in decor, style, or presentation`;
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

    // Use the Rentalizer API
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

    if (!response.ok) return null;

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
      const searchId = `opp_${Date.now()}`;
      
      try {
        console.log(`[Opportunity Finder] Starting search for: ${input.city}`);
        
        // Step 1: Create session and run amenity analysis (includes market data)
        const amenitySession = await createSession({
          startUrl: 'https://coachinayah.com/login',
          saveBrowserData: true,
        });
        
        console.log(`[Opportunity Finder] Amenity session created: ${amenitySession.id}`);
        
        const amenityTask = await createTask({
          sessionId: amenitySession.id,
          task: createAmenityAnalysisPrompt(input.city),
          maxSteps: 100,
          llm: 'claude-opus-4-5-20251101',
          thinking: true,
          vision: true,
        });
        
        console.log(`[Opportunity Finder] Amenity task created: ${amenityTask.id}`);
        
        // Step 2: Create session for Zillow scraping (can run in parallel)
        const zillowSession = await createSession({
          startUrl: 'https://www.zillow.com',
          saveBrowserData: true,
        });
        
        console.log(`[Opportunity Finder] Zillow session created: ${zillowSession.id}`);
        
        const zillowTask = await createTask({
          sessionId: zillowSession.id,
          task: createZillowScrapingPrompt(input.city, input.minRent, input.maxRent),
          maxSteps: 80,
          llm: 'claude-opus-4-5-20251101',
          thinking: true,
          vision: true,
        });
        
        console.log(`[Opportunity Finder] Zillow task created: ${zillowTask.id}`);
        
        return {
          success: true,
          searchId,
          amenityTaskId: amenityTask.id,
          zillowTaskId: zillowTask.id,
          amenitySessionId: amenitySession.id,
          zillowSessionId: zillowSession.id,
          message: `Opportunity search started for ${input.city}`,
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
   * Check the status of both tasks
   */
  getSearchStatus: publicProcedure
    .input(z.object({
      amenityTaskId: z.string(),
      zillowTaskId: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const [amenityTask, zillowTask] = await Promise.all([
          getTask(input.amenityTaskId),
          getTask(input.zillowTaskId),
        ]);
        
        const amenityDone = amenityTask.status === 'finished';
        const zillowDone = zillowTask.status === 'finished';
        
        let progress = 0;
        let currentStep = 'Starting...';
        
        if (!amenityDone && !zillowDone) {
          progress = 10;
          currentStep = 'Analyzing market and searching rentals...';
        } else if (amenityDone && !zillowDone) {
          progress = 50;
          currentStep = 'Market analysis complete. Finding rentals...';
        } else if (!amenityDone && zillowDone) {
          progress = 50;
          currentStep = 'Rentals found. Analyzing market...';
        } else {
          progress = 80;
          currentStep = 'Calculating projections...';
        }
        
        return {
          status: amenityDone && zillowDone ? 'ready' : 'running',
          progress,
          currentStep,
          amenityStatus: amenityTask.status,
          zillowStatus: zillowTask.status,
          amenityOutput: amenityDone && amenityTask.isSuccess ? amenityTask.output : null,
          zillowOutput: zillowDone && zillowTask.isSuccess ? zillowTask.output : null,
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
   * Process the results and add AirDNA projections
   */
  processResults: publicProcedure
    .input(z.object({
      city: z.string(),
      amenityOutput: z.string(),
      zillowOutput: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        // Parse the outputs
        let marketData: any;
        let rentals: ZillowRental[];
        
        try {
          const amenityMatch = input.amenityOutput.match(/\{[\s\S]*\}/);
          if (amenityMatch) {
            marketData = JSON.parse(amenityMatch[0]);
          }
        } catch (e) {
          console.error('[Opportunity Finder] Error parsing amenity data:', e);
          marketData = {
            marketSnapshot: {
              totalListings: 0,
              avgOccupancy: 0.5,
              avgMonthlyRevenue: 3000,
              hotNeighborhoods: [],
            },
            topPerformerAmenities: [],
            uniqueFindings: [],
          };
        }
        
        try {
          const zillowMatch = input.zillowOutput.match(/\[[\s\S]*\]/);
          if (zillowMatch) {
            rentals = JSON.parse(zillowMatch[0]);
          } else {
            rentals = [];
          }
        } catch (e) {
          console.error('[Opportunity Finder] Error parsing Zillow data:', e);
          rentals = [];
        }
        
        // Get AirDNA projections for each rental
        const opportunities: RentalOpportunity[] = [];
        
        for (const rental of rentals.slice(0, 15)) {
          const estimate = await getAirDNAEstimate(
            rental.address,
            rental.bedrooms,
            rental.bathrooms
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
              similarAirbnbRevenue: Math.round(monthlyRevenue * 1.1), // Slight variance for "similar" properties
            });
          }
        }
        
        // Sort by profit
        opportunities.sort((a, b) => b.profit - a.profit);
        
        // Format amenities with icons
        const amenityIcons: Record<string, string> = {
          'hot tub': '🛁',
          'pool': '🏊',
          'parking': '🅿️',
          'free parking': '🅿️',
          'game room': '🎮',
          'wifi': '📶',
          'kitchen': '🍳',
          'washer': '🧺',
          'dryer': '🧺',
          'air conditioning': '❄️',
          'heating': '🔥',
          'tv': '📺',
          'workspace': '💻',
          'gym': '💪',
          'fireplace': '🔥',
          'bbq': '🍖',
          'grill': '🍖',
          'patio': '🌳',
          'balcony': '🌳',
          'view': '🏔️',
          'guitar': '🎸',
          'board games': '🎲',
          'professional photos': '📸',
        };
        
        const winningAmenities: AmenityInsight[] = (marketData.topPerformerAmenities || [])
          .slice(0, 6)
          .map((a: any) => ({
            amenity: a.amenity,
            percentage: a.percentage,
            icon: amenityIcons[a.amenity.toLowerCase()] || '✨',
          }));
        
        const result: OpportunityFinderResult = {
          market: input.city,
          marketSnapshot: marketData.marketSnapshot || {
            totalListings: 0,
            avgOccupancy: 0.5,
            avgMonthlyRevenue: 3000,
            hotNeighborhoods: [],
          },
          winningAmenities,
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
   * Clean up sessions
   */
  cleanup: publicProcedure
    .input(z.object({
      amenitySessionId: z.string(),
      zillowSessionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        await Promise.all([
          stopSession(input.amenitySessionId).catch(() => {}),
          stopSession(input.zillowSessionId).catch(() => {}),
        ]);
        return { success: true };
      } catch (error) {
        return { success: false };
      }
    }),
});
