/**
 * Market Research Router - Complete Implementation with Database Persistence
 * 
 * Uses Browser Use Cloud API to scrape coachinayah.com/market-charts
 * and generate comprehensive market reports.
 */

import { z } from 'zod';
import { router, publicProcedure } from './_core/trpc';
import { TRPCError } from '@trpc/server';
import { ENV } from './_core/env';
import { getDb } from './db';
import { marketResearchReports } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
// Browser Use removed - stub functions for compilation
const createSession = async (_opts: any): Promise<any> => ({ id: '', liveUrl: '' });
const createTask = async (_opts: any): Promise<any> => ({ id: '' });
const getTask = async (_id: string): Promise<any> => ({ status: 'stopped', steps: [], output: '' });
const stopSession = async (_id: string): Promise<void> => {};

// ============================================
// TYPES
// ============================================

interface MarketResearchResult {
  market: string;
  executiveSummary: {
    analysisDate: string;
    optimalBedroomSize: string;
    targetNeighborhoods: string[];
    keyFinding: string;
  };
  marketOverview: {
    totalListings: number;
    avgOccupancy: number;
    avgADR: number;
    avgRevenue: number;
    topPropertyType: string;
    topAmenities: string[];
  };
  bedroomAnalysis: Array<{
    bedroomSize: string;
    occupancy: number;
    avgRevenue?: number;
  }>;
  submarkets: Array<{
    name: string;
    listings: number;
    occupancy: number;
    adr: number;
    revpar: number;
    seasonalityScore: number;
    professionallyManaged: number;
  }>;
  topPerformers: Array<{
    title: string;
    revenue: number;
    occupancy: number;
    adr: number;
    bedrooms: number;
    propertyType: string;
    propertyId: string;
    airbnbUrl?: string;
  }>;
  seasonality: {
    peakMonths: string[];
    lowMonths: string[];
    recommendation: string;
    monthlyOccupancy?: Record<string, number>;
    yearOverYearTrend?: string;
  };
  recommendations: string[];
}

// ============================================
// COMPREHENSIVE MARKET RESEARCH PROMPT
// ============================================

function createMarketResearchPrompt(marketName: string): string {
  return `You are a professional market research analyst. Your task is to extract comprehensive Airbnb market data from coachinayah.com/market-charts for ${marketName}.

**IMPORTANT INSTRUCTIONS:**

1. **Login First:**
   - Navigate to https://coachinayah.com/login
   - Enter email: ${ENV.coachinayahEmail}
   - Enter password: ${ENV.coachinayahPassword}
   - Click login button
   - Wait for successful login (you should be redirected to dashboard)

2. **Navigate to Market Charts:**
   - Go to https://coachinayah.com/market-charts
   - Wait for page to fully load

3. **Select the Market:**
   - Find the "Select Cities" dropdown
   - Click to open it
   - Type "${marketName}" in the search box
   - Select the matching city from the dropdown
   - Wait for data to load (you'll see "Loading..." indicators disappear)

4. **Extract Data from Dashboard Tab:**
   - You should already be on the Dashboard tab
   - Extract the following data:
     * TTM Occupancy Heat Map by Bedroom (1BR through 6+BR with percentages)
     * Property Types distribution (house, apartment, etc.)
     * Top amenities percentages (AC, parking, pool, etc.)
   - Take note of all visible metrics

5. **Extract Data from Market Explorer Tab:**
   - Click on the "Market Explorer" tab
   - Wait for the table to load
   - Extract ALL submarkets/neighborhoods with their metrics:
     * Market Name
     * Average Monthly Listings
     * Annual Occupancy
     * Annual ADR
     * Annual RevPAR
     * Seasonality Score
     * % Professionally Managed
   - If there are multiple pages, paginate through ALL pages
   - Aim to get at least 20-30 submarkets

6. **Extract Data from Comp Data Tab:**
   - Click on the "Comp Data" tab
   - Wait for the listings table to load
   - Sort by Revenue (highest first) if possible
   - Extract the TOP 20 performing properties with:
     * Title
     * Occupancy
     * ADR
     * Revenue
     * Property ID (abnb_XXXXX or vrbo_XXXXX)
     * Accommodates
     * Bedrooms
     * Bathrooms
     * Property Type
   - For Airbnb properties, construct the URL: https://airbnb.com/rooms/{property_id_without_prefix}

7. **Extract Data from Charts Tab:**
   - Click on the "Charts" tab
   - Wait for charts to render
   - Identify seasonality patterns:
     * Which months have highest occupancy (peak season)
     * Which months have lowest occupancy (low season)
     * Any notable year-over-year trends
   - Extract monthly occupancy data if visible

8. **Generate Comprehensive Report:**
   Based on all the data you've collected, create a structured JSON report with:
   
   {
     "market": "${marketName}",
     "executiveSummary": {
       "analysisDate": "YYYY-MM-DD",
       "optimalBedroomSize": "Which bedroom count has best occupancy/revenue",
       "targetNeighborhoods": ["Top 3 submarkets by RevPAR"],
       "keyFinding": "One sentence summary of the market opportunity"
     },
     "marketOverview": {
       "totalListings": number,
       "avgOccupancy": number (as decimal, e.g. 0.52 for 52%),
       "avgADR": number,
       "avgRevenue": number,
       "topPropertyType": "house/apartment/etc",
       "topAmenities": ["top 3 amenities"]
     },
     "bedroomAnalysis": [
       {"bedroomSize": "1BR", "occupancy": 0.50, "avgRevenue": 25000},
       {"bedroomSize": "2BR", "occupancy": 0.47, "avgRevenue": 30000},
       ... for all bedroom sizes
     ],
     "submarkets": [
       {
         "name": "Submarket Name",
         "listings": number,
         "occupancy": decimal,
         "adr": number,
         "revpar": number,
         "seasonalityScore": decimal,
         "professionallyManaged": decimal
       },
       ... for all submarkets (aim for 20-30)
     ],
     "topPerformers": [
       {
         "title": "Property Title",
         "revenue": number,
         "occupancy": decimal,
         "adr": number,
         "bedrooms": number,
         "propertyType": "house/apartment/etc",
         "propertyId": "abnb_XXXXX or vrbo_XXXXX",
         "airbnbUrl": "https://airbnb.com/rooms/XXXXX" (if Airbnb)
       },
       ... for top 20 properties
     ],
     "seasonality": {
       "peakMonths": ["March", "April", "May"],
       "lowMonths": ["January", "February"],
       "recommendation": "Best time to launch or pricing strategy"
     },
     "recommendations": [
       "Specific actionable recommendation 1",
       "Specific actionable recommendation 2",
       "Specific actionable recommendation 3",
       "Specific actionable recommendation 4",
       "Specific actionable recommendation 5"
     ]
   }

**CRITICAL REQUIREMENTS:**
- You MUST complete ALL 8 steps above
- You MUST extract data from ALL tabs (Dashboard, Market Explorer, Comp Data, Charts)
- You MUST return valid JSON at the end
- If you encounter errors, retry the step up to 3 times
- If data is loading, wait at least 5 seconds before proceeding
- Be thorough - this report will be used for real investment decisions

**OUTPUT FORMAT:**
Return the complete JSON report as your final output. Do not include any other text outside the JSON.`;
}

// ============================================
// ROUTER
// ============================================

export const marketResearchRouter = router({
  /**
   * Start a new market research task
   */
  startResearch: publicProcedure
    .input(z.object({
      market: z.string().min(1, 'Market name is required'),
    }))
    .mutation(async ({ input }) => {
      const researchId = `research_${Date.now()}`;
      
      try {
        console.log(`[Market Research] Starting research for: ${input.market}`);
        
        // Create a new Browser Use session
        const session = await createSession({
          startUrl: 'https://coachinayah.com/login',
          saveBrowserData: true,
        });
        
        console.log(`[Market Research] Session created: ${session.id}`);
        
        // Create the comprehensive research task
        const task = await createTask({
          sessionId: session.id,
          task: createMarketResearchPrompt(input.market),
          maxSteps: 150,
          llm: 'claude-opus-4-5-20251101',
          thinking: true,
          vision: true,
        });
        
        console.log(`[Market Research] Task created: ${task.id}`);
        
        // Save to database
        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }
        await db.insert(marketResearchReports).values({
          researchId,
          market: input.market,
          status: 'running',
          progress: 0,
          currentStep: 'Logging in...',
          sessionId: session.id,
          taskId: task.id,
        });
        
        return {
          success: true,
          researchId,
          message: `Market research started for ${input.market}`,
        };
        
      } catch (error) {
        console.error('[Market Research] Error starting research:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to start market research',
        });
      }
    }),

  /**
   * Get the status and progress of a research task
   */
  getResearchStatus: publicProcedure
    .input(z.object({
      researchId: z.string(),
    }))
    .query(async ({ input }) => {
      // Get from database
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available',
        });
      }
      const [research] = await db
        .select()
        .from(marketResearchReports)
        .where(eq(marketResearchReports.researchId, input.researchId))
        .limit(1);
      
      if (!research) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Research task not found',
        });
      }
      
      // If already completed or errored, return cached result
      if (research.status === 'completed' || research.status === 'error') {
        return {
          status: research.status,
          progress: research.progress || (research.status === 'completed' ? 100 : 0),
          currentStep: research.currentStep || (research.status === 'completed' ? 'Completed' : 'Error'),
          result: research.result as MarketResearchResult | null,
          error: research.errorMessage,
        };
      }
      
      try {
        // Get the latest task status from Browser Use
        const task = await getTask(research.taskId!);
        
        let progress = research.progress || 0;
        let currentStep = research.currentStep || 'Processing...';
        let status: 'pending' | 'running' | 'completed' | 'error' = research.status;
        let result: MarketResearchResult | null = null;
        let error: string | undefined;
        
        if (task.status === 'started') {
          // Estimate progress based on steps completed
          const stepsCompleted = task.steps?.length || 0;
          progress = Math.min(90, Math.floor((stepsCompleted / 150) * 100));
          
          // Update current step based on latest action
          if (task.steps && task.steps.length > 0) {
            const latestStep = task.steps[task.steps.length - 1];
            currentStep = latestStep.action || currentStep;
          }
          
          // Update database
          await db!.update(marketResearchReports)
            .set({ progress, currentStep })
            .where(eq(marketResearchReports.researchId, input.researchId));
        }
        
        if (task.status === 'finished') {
          progress = 100;
          currentStep = 'Completed';
          
          if (task.isSuccess && task.output) {
            try {
              // Try to extract JSON from the output
              const jsonMatch = task.output.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]) as MarketResearchResult;
                status = 'completed';
                
                // Update database with result
                await db!.update(marketResearchReports)
                  .set({ 
                    status: 'completed',
                    progress: 100,
                    currentStep: 'Completed',
                    result: result,
                    completedAt: new Date(),
                  })
                  .where(eq(marketResearchReports.researchId, input.researchId));
                
                // Clean up session
                try {
                  await stopSession(research.sessionId!);
                } catch (cleanupError) {
                  console.error('[Market Research] Error stopping session:', cleanupError);
                }
              }
            } catch (parseError) {
              console.error('[Market Research] Error parsing result:', parseError);
              status = 'error';
              error = 'Failed to parse research results';
              
              await db!.update(marketResearchReports)
                .set({ 
                  status: 'error',
                  errorMessage: error,
                })
                .where(eq(marketResearchReports.researchId, input.researchId));
            }
          } else {
            status = 'error';
            error = task.output || 'Research task failed';
            
            await db!.update(marketResearchReports)
              .set({ 
                status: 'error',
                errorMessage: error,
              })
              .where(eq(marketResearchReports.researchId, input.researchId));
          }
        }
        
        if (task.status === 'stopped') {
          status = 'error';
          error = 'Research task was stopped unexpectedly';
          
          await db!.update(marketResearchReports)
            .set({ 
              status: 'error',
              errorMessage: error,
            })
            .where(eq(marketResearchReports.researchId, input.researchId));
        }
        
        return {
          status,
          progress,
          currentStep,
          result,
          error,
        };
        
      } catch (apiError) {
        console.error('[Market Research] Error fetching task status:', apiError);
        return {
          status: research.status,
          progress: research.progress || 0,
          currentStep: research.currentStep || 'Processing...',
          result: research.result as MarketResearchResult | null,
          error: undefined,
        };
      }
    }),

  /**
   * Get a completed research report by ID
   */
  getResearchReport: publicProcedure
    .input(z.object({
      researchId: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available',
        });
      }
      const [research] = await db
        .select()
        .from(marketResearchReports)
        .where(eq(marketResearchReports.researchId, input.researchId))
        .limit(1);
      
      if (!research) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Research report not found',
        });
      }
      
      return {
        id: research.id,
        researchId: research.researchId,
        market: research.market,
        status: research.status,
        result: research.result as MarketResearchResult | null,
        createdAt: research.createdAt,
        completedAt: research.completedAt,
      };
    }),

  /**
   * List all research reports
   */
  listResearchReports: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) {
        return [];
      }
      const reports = await db
        .select({
          id: marketResearchReports.id,
          researchId: marketResearchReports.researchId,
          market: marketResearchReports.market,
          status: marketResearchReports.status,
          createdAt: marketResearchReports.createdAt,
          completedAt: marketResearchReports.completedAt,
        })
        .from(marketResearchReports)
        .orderBy(marketResearchReports.createdAt);
      
      return reports;
    }),

  /**
   * Cancel a running research task
   */
  cancelResearch: publicProcedure
    .input(z.object({
      researchId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available',
        });
      }
      const [research] = await db
        .select()
        .from(marketResearchReports)
        .where(eq(marketResearchReports.researchId, input.researchId))
        .limit(1);
      
      if (!research) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Research task not found',
        });
      }
      
      if (research.status !== 'running') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Research task is not running',
        });
      }
      
      try {
        // Stop the Browser Use session
        if (research.sessionId) {
          await stopSession(research.sessionId);
        }
        
        // Update database
        await db.update(marketResearchReports)
          .set({ 
            status: 'error',
            errorMessage: 'Cancelled by user',
          })
          .where(eq(marketResearchReports.researchId, input.researchId));
        
        return { success: true };
        
      } catch (error) {
        console.error('[Market Research] Error cancelling research:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cancel research task',
        });
      }
    }),
});
