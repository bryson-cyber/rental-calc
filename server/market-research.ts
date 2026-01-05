/**
 * Market Research Router - Single Task Approach
 * 
 * Uses Browser Use Cloud API with:
 * - Single comprehensive task per research request
 * - New session per request with profile for persistent login
 * - Claude Opus 4.5 with thinking mode and vision enabled
 * - Max 150 steps for full research workflow
 * - saveBrowserData enabled to persist login cookies
 */

import { z } from 'zod';
import { router, publicProcedure } from './_core/trpc';
import { TRPCError } from '@trpc/server';
import { 
  createSession, 
  createTask, 
  getTask, 
  stopSession,
  listProfiles,
  createProfile
} from './browser-use';
import { getDb } from './db';
import { browserUseSettings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

// ============================================
// TYPES
// ============================================

interface MarketResearchResult {
  market: string;
  executiveSummary: string;
  marketOverview: {
    totalListings: number;
    avgOccupancy: number;
    avgADR: number;
    avgRevenue: number;
    revparChange: number;
    seasonalityScore: number;
    professionallyManaged: number;
  };
  submarkets: Array<{
    name: string;
    listings: number;
    occupancy: number;
    adr: number;
    revpar: number;
    revparChange: number;
  }>;
  bedroomAnalysis: Array<{
    bedrooms: string;
    occupancy: number;
    adr: number;
    revenue: number;
    count: number;
  }>;
  topPerformers: Array<{
    title: string;
    revenue: number;
    occupancy: number;
    adr: number;
    bedrooms: number;
    propertyType: string;
    url?: string;
    designNotes?: string;
  }>;
  geographicClusters: Array<{
    area: string;
    description: string;
    avgRevpar: number;
  }>;
  seasonality: {
    peakMonths: string[];
    lowMonths: string[];
    peakOccupancy: number;
    lowOccupancy: number;
    recommendation: string;
  };
  recommendations: string[];
}

// In-memory storage for active research tasks
const activeResearch: Map<string, {
  market: string;
  sessionId: string;
  taskId: string;
  status: 'running' | 'completed' | 'error';
  progress: number;
  result?: MarketResearchResult;
  error?: string;
}> = new Map();

// ============================================
// DATABASE HELPERS
// ============================================

async function getSettingValue(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(browserUseSettings).where(eq(browserUseSettings.settingKey, key)).limit(1);
  return result[0]?.settingValue || null;
}

async function setSettingValue(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const existing = await db.select().from(browserUseSettings).where(eq(browserUseSettings.settingKey, key)).limit(1);
  
  if (existing.length > 0) {
    await db.update(browserUseSettings)
      .set({ settingValue: value, updatedAt: new Date() })
      .where(eq(browserUseSettings.settingKey, key));
  } else {
    await db.insert(browserUseSettings)
      .values({ settingKey: key, settingValue: value });
  }
}

// ============================================
// PROFILE MANAGEMENT
// ============================================

const PROFILE_NAME = 'CoachInayah-MarketCharts';

async function getOrCreateProfile(): Promise<string> {
  // Check if we have a stored profile ID
  const storedProfileId = await getSettingValue('browser_use_profile_id');
  if (storedProfileId) {
    // Verify it still exists
    const profiles = await listProfiles();
    if (profiles.some(p => p.id === storedProfileId)) {
      return storedProfileId;
    }
  }
  
  // Check if profile exists by name
  const profiles = await listProfiles();
  const existingProfile = profiles.find(p => p.name === PROFILE_NAME);
  if (existingProfile) {
    await setSettingValue('browser_use_profile_id', existingProfile.id);
    return existingProfile.id;
  }
  
  // Create new profile
  const newProfile = await createProfile(PROFILE_NAME);
  await setSettingValue('browser_use_profile_id', newProfile.id);
  return newProfile.id;
}

// ============================================
// COMPREHENSIVE RESEARCH PROMPT
// ============================================

function buildComprehensivePrompt(market: string): string {
  return `You are a market research analyst. Your task is to gather comprehensive Airbnb market data for "${market}" from coachinayah.com/market-charts.

IMPORTANT: You are already logged in. The site should recognize your session.

## STEP-BY-STEP INSTRUCTIONS:

### Step 1: Navigate and Select Market
1. Go to https://coachinayah.com/market-charts
2. Click on "Select Cities" dropdown
3. Type "${market}" and select it from the dropdown
4. Wait for data to load (you'll see "Loading Filtered Data..." then data appears)

### Step 2: Extract Dashboard Data
On the Dashboard tab (default view), extract:
- TTM Occupancy Heat Map by bedroom size (1BR through 6+BR occupancy percentages)
- Property Types distribution
- Note the general market health indicators

### Step 3: Extract Market Explorer Data
1. Click on "Market Explorer" tab
2. Extract the TOP 10 submarkets by RevPAR:
   - Market Name
   - Average Monthly Listings
   - Annual Occupancy (%)
   - Annual ADR ($)
   - Annual RevPAR ($)
   - RevPAR % Change
   - Seasonality Score
   - % Professionally Managed

### Step 4: Extract Comp Data (Top Performers)
1. Click on "Comp Data" tab
2. Note the market averages shown at top:
   - Total listings count
   - Average Occupancy
   - Average ADR
   - Average Revenue
3. Extract TOP 10 properties by Revenue:
   - Title
   - Market Name (submarket)
   - Occupancy (%)
   - ADR ($)
   - Revenue ($)
   - Bedrooms
   - Property Type
   - Property ID (for building Airbnb URL)

### Step 5: Map Analysis
1. Click on "Map" tab
2. Check "Show heatmap" checkbox
3. Identify 3-5 geographic clusters/hotspots where high-performing properties are concentrated
4. Note the neighborhoods/areas with highest occupancy (green areas)

### Step 6: Seasonality Analysis
1. Click on "Charts" tab
2. Analyze the "Metric by Month" chart for seasonal patterns
3. Identify:
   - Peak months (highest occupancy)
   - Low months (lowest occupancy)
   - Overall seasonal trend

### Step 7: Compile Results
Based on all data collected, compile:
1. Executive Summary (2-3 sentences about market opportunity)
2. Top 3 recommendations for investors

## OUTPUT FORMAT:
Return your findings as a JSON object with this structure:
{
  "market": "${market}",
  "executiveSummary": "Brief summary of market opportunity...",
  "marketOverview": {
    "totalListings": number,
    "avgOccupancy": number (percentage, e.g., 48.5),
    "avgADR": number (dollars),
    "avgRevenue": number (annual dollars),
    "revparChange": number (percentage change),
    "seasonalityScore": number,
    "professionallyManaged": number (percentage)
  },
  "submarkets": [
    {
      "name": "Submarket Name",
      "listings": number,
      "occupancy": number,
      "adr": number,
      "revpar": number,
      "revparChange": number
    }
  ],
  "bedroomAnalysis": [
    {
      "bedrooms": "1BR",
      "occupancy": number,
      "adr": number,
      "revenue": number,
      "count": number
    }
  ],
  "topPerformers": [
    {
      "title": "Property Title",
      "revenue": number,
      "occupancy": number,
      "adr": number,
      "bedrooms": number,
      "propertyType": "House/Apartment/etc",
      "url": "https://airbnb.com/rooms/PROPERTY_ID"
    }
  ],
  "geographicClusters": [
    {
      "area": "Neighborhood Name",
      "description": "Brief description of why this area performs well",
      "avgRevpar": number
    }
  ],
  "seasonality": {
    "peakMonths": ["Month1", "Month2"],
    "lowMonths": ["Month1", "Month2"],
    "peakOccupancy": number,
    "lowOccupancy": number,
    "recommendation": "Best time to invest/operate"
  },
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2",
    "Recommendation 3"
  ]
}

IMPORTANT: 
- Extract REAL data from the website, do not make up numbers
- If a field cannot be found, use null or 0
- Return ONLY the JSON object, no additional text`;
}

// ============================================
// RESEARCH EXECUTION
// ============================================

async function runMarketResearch(researchId: string, market: string): Promise<void> {
  const research = activeResearch.get(researchId);
  if (!research) return;

  try {
    console.log(`[MarketResearch] Starting research for ${market}`);
    
    // Get or create profile
    const profileId = await getOrCreateProfile();
    console.log(`[MarketResearch] Using profile: ${profileId}`);
    
    // Create new session with profile
    const session = await createSession({
      profileId,
      saveBrowserData: true,
    });
    console.log(`[MarketResearch] Created session: ${session.id}`);
    
    research.sessionId = session.id;
    
    // Create comprehensive task
    const task = await createTask({
      sessionId: session.id,
      task: buildComprehensivePrompt(market),
      maxSteps: 150,
      vision: true,
      thinking: true,
    });
    console.log(`[MarketResearch] Created task: ${task.id}`);
    
    research.taskId = task.id;
    research.progress = 10;
    
    // Poll for task completion
    let attempts = 0;
    const maxAttempts = 180; // 6 minutes max (2s intervals)
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
      const taskStatus = await getTask(task.id);
      console.log(`[MarketResearch] Task status: ${taskStatus.status}, steps: ${taskStatus.steps?.length || 0}`);
      
      // Update progress based on steps completed
      const stepsCompleted = taskStatus.steps?.length || 0;
      research.progress = Math.min(10 + Math.floor((stepsCompleted / 100) * 80), 90);
      
      if (taskStatus.status === 'finished') {
        console.log(`[MarketResearch] Task finished, success: ${taskStatus.isSuccess}`);
        
        // Try to parse the output as JSON
        let result: MarketResearchResult | null = null;
        
        if (taskStatus.output) {
          try {
            // Extract JSON from output (might be wrapped in markdown code blocks)
            let jsonStr = taskStatus.output;
            const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/) || 
                            jsonStr.match(/```\s*([\s\S]*?)\s*```/) ||
                            jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              jsonStr = jsonMatch[1] || jsonMatch[0];
            }
            result = JSON.parse(jsonStr);
          } catch (parseError) {
            console.log(`[MarketResearch] Failed to parse output as JSON:`, parseError);
            // Create a basic result from the raw output
            result = {
              market,
              executiveSummary: taskStatus.output.substring(0, 500),
              marketOverview: {
                totalListings: 0,
                avgOccupancy: 0,
                avgADR: 0,
                avgRevenue: 0,
                revparChange: 0,
                seasonalityScore: 0,
                professionallyManaged: 0,
              },
              submarkets: [],
              bedroomAnalysis: [],
              topPerformers: [],
              geographicClusters: [],
              seasonality: {
                peakMonths: [],
                lowMonths: [],
                peakOccupancy: 0,
                lowOccupancy: 0,
                recommendation: '',
              },
              recommendations: [],
            };
          }
        }
        
        if (result) {
          research.status = 'completed';
          research.progress = 100;
          research.result = result;
        } else {
          research.status = 'error';
          research.error = 'Failed to extract market data. The agent could not parse the website data.';
        }
        
        // Stop the session
        try {
          await stopSession(session.id);
        } catch (e) {
          console.log(`[MarketResearch] Failed to stop session:`, e);
        }
        
        return;
      }
      
      if (taskStatus.status === 'stopped') {
        research.status = 'error';
        research.error = `Task ${taskStatus.status}: ${taskStatus.output || 'Unknown error'}`;
        
        try {
          await stopSession(session.id);
        } catch (e) {
          console.log(`[MarketResearch] Failed to stop session:`, e);
        }
        
        return;
      }
    }
    
    // Timeout
    research.status = 'error';
    research.error = 'Research timed out after 6 minutes. Please try again.';
    
    try {
      await stopSession(research.sessionId);
    } catch (e) {
      console.log(`[MarketResearch] Failed to stop session:`, e);
    }
    
  } catch (error) {
    console.log(`[MarketResearch] Error:`, error);
    research.status = 'error';
    research.error = error instanceof Error ? error.message : 'Unknown error occurred';
  }
}

// ============================================
// TRPC ROUTER
// ============================================

export const marketResearchRouter = router({
  // Start market research
  start: publicProcedure
    .input(z.object({
      market: z.string().min(1, 'Market name is required'),
    }))
    .mutation(async ({ input }) => {
      // Check if authenticated
      const authStatus = await getSettingValue('browser_use_authenticated');
      const authExpiry = await getSettingValue('browser_use_auth_expiry');
      
      if (authStatus !== 'true' || !authExpiry || new Date(authExpiry) < new Date()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Market research service is not configured. Please contact support.',
        });
      }
      
      // Generate unique research ID
      const researchId = `research_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Initialize research state
      activeResearch.set(researchId, {
        market: input.market,
        sessionId: '',
        taskId: '',
        status: 'running',
        progress: 0,
      });
      
      // Start research in background (don't await)
      runMarketResearch(researchId, input.market).catch(err => {
        console.error(`[MarketResearch] Background error:`, err);
        const research = activeResearch.get(researchId);
        if (research) {
          research.status = 'error';
          research.error = err.message;
        }
      });
      
      return {
        researchId,
        message: `Starting market research for ${input.market}...`,
      };
    }),

  // Get research progress
  getProgress: publicProcedure
    .input(z.object({
      researchId: z.string(),
    }))
    .query(async ({ input }) => {
      const research = activeResearch.get(input.researchId);
      
      if (!research) {
        return {
          status: 'not_found',
          progress: 0,
          error: 'Research not found',
        };
      }
      
      return {
        status: research.status,
        progress: research.progress,
        result: research.result,
        error: research.error,
      };
    }),

  // Admin: Setup login session
  adminSetupLogin: publicProcedure
    .mutation(async () => {
      const profileId = await getOrCreateProfile();
      
      const session = await createSession({
        profileId,
        saveBrowserData: true,
      });
      
      return {
        sessionId: session.id,
        liveUrl: session.liveUrl,
        profileId,
        instructions: 'Open the liveUrl in your browser, log in to coachinayah.com, then call confirmLogin.',
      };
    }),

  // Admin: Confirm login
  confirmLogin: publicProcedure
    .input(z.object({
      sessionId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Mark as authenticated for 24 hours
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      await setSettingValue('browser_use_authenticated', 'true');
      await setSettingValue('browser_use_auth_expiry', expiresAt.toISOString());
      
      // Stop the setup session if provided
      if (input.sessionId) {
        try {
          await stopSession(input.sessionId);
        } catch (e) {
          // Ignore errors stopping session
        }
      }
      
      return {
        success: true,
        message: 'Login confirmed. The market research service is now ready to use.',
        expiresAt: expiresAt.toISOString(),
      };
    }),

  // Get service status
  getServiceStatus: publicProcedure
    .query(async () => {
      const profileId = await getSettingValue('browser_use_profile_id');
      const authStatus = await getSettingValue('browser_use_authenticated');
      const authExpiry = await getSettingValue('browser_use_auth_expiry');
      
      const isAuthenticated = authStatus === 'true' && authExpiry && new Date(authExpiry) > new Date();
      
      return {
        isAuthenticated,
        profileId,
        authExpiry: authExpiry || null,
        message: isAuthenticated 
          ? 'Service is configured and authenticated.' 
          : 'Service needs authentication. Call adminSetupLogin to configure.',
      };
    }),
});
