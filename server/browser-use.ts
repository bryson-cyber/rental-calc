/**
 * Browser Use Cloud API Integration
 * 
 * Architecture:
 * - Profile: Persistent login state for coachinayah.com (created once, reused)
 * - Session: Created per research request, inherits profile login state
 * - Task: Individual automation steps within a session
 */

import { ENV } from "./_core/env";

const BROWSER_USE_API_URL = "https://api.browser-use.com";
const BROWSER_USE_API_KEY = ENV.browserUseApiKey;

// Default LLM model - using Claude Opus 4.5 for maximum reliability
const DEFAULT_LLM = "claude-opus-4-5-20251101";

export interface BrowserUseProfile {
  id: string;
  name: string;
  createdAt: string;
}

export interface BrowserUseSession {
  id: string;
  status: "active" | "stopped";
  liveUrl: string | null;
  profileId?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface BrowserUseTask {
  id: string;
  status: "created" | "started" | "finished" | "stopped";
  output: string | null;
  isSuccess: boolean | null;
  steps?: Array<{
    step: number;
    action: string;
    result: string;
  }>;
}

interface CreateTaskParams {
  task: string;
  sessionId?: string;
  startUrl?: string;
  maxSteps?: number;
  llm?: string;
  structuredOutput?: string;
  flashMode?: boolean;
  thinking?: boolean;
  vision?: boolean | "auto";
  allowedDomains?: string[];
}

/**
 * Make authenticated request to Browser Use API v2
 */
async function browserUseRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Use API v2 endpoints
  const apiEndpoint = endpoint.startsWith("/api/v2") ? endpoint : `/api/v2${endpoint}`;
  const url = `${BROWSER_USE_API_URL}${apiEndpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "X-Browser-Use-API-Key": BROWSER_USE_API_KEY,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Browser Use API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// ============================================
// PROFILE MANAGEMENT
// ============================================

/**
 * List all profiles
 */
export async function listProfiles(): Promise<BrowserUseProfile[]> {
  const response = await browserUseRequest<{ items: BrowserUseProfile[]; totalItems: number }>("/profiles");
  return response.items || [];
}

/**
 * Create a new profile for persistent login state
 */
export async function createProfile(name: string): Promise<BrowserUseProfile> {
  return browserUseRequest<BrowserUseProfile>("/profiles", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

/**
 * Get or create the Coach Inayah profile
 */
export async function getOrCreateCoachInayahProfile(): Promise<BrowserUseProfile> {
  const profiles = await listProfiles();
  const existingProfile = profiles.find(p => p.name === "coach-inayah-market-charts");
  
  if (existingProfile) {
    return existingProfile;
  }
  
  return createProfile("coach-inayah-market-charts");
}

/**
 * Delete a profile
 */
export async function deleteProfile(profileId: string): Promise<void> {
  await browserUseRequest(`/profiles/${profileId}`, {
    method: "DELETE",
  });
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Create a new browser session
 */
export async function createSession(params: {
  profileId?: string;
  startUrl?: string;
  proxyCountryCode?: string;
  saveBrowserData?: boolean;
}): Promise<BrowserUseSession> {
  return browserUseRequest<BrowserUseSession>("/sessions", {
    method: "POST",
    body: JSON.stringify({
      profileId: params.profileId,
      startUrl: params.startUrl,
      proxyCountryCode: params.proxyCountryCode || "us",
      saveBrowserData: params.saveBrowserData ?? true, // Always save browser data for persistent login
    }),
  });
}

/**
 * Get session details
 */
export async function getSession(sessionId: string): Promise<BrowserUseSession> {
  return browserUseRequest<BrowserUseSession>(`/sessions/${sessionId}`);
}

/**
 * Stop/Delete a session
 */
export async function stopSession(sessionId: string): Promise<void> {
  // Use API v2 endpoints
  const apiEndpoint = `/api/v2/sessions/${sessionId}`;
  const url = `${BROWSER_USE_API_URL}${apiEndpoint}`;
  
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "X-Browser-Use-API-Key": BROWSER_USE_API_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Browser Use API error (${response.status}): ${errorText}`);
  }
  // 204 No Content - no body to parse
}

/**
 * Create a public share link for a session (for debugging)
 */
export async function shareSession(sessionId: string): Promise<{ publicShareUrl: string }> {
  return browserUseRequest(`/sessions/${sessionId}/share`, {
    method: "POST",
  });
}

// ============================================
// TASK MANAGEMENT
// ============================================

/**
 * Create and start a new task
 */
export async function createTask(params: CreateTaskParams): Promise<BrowserUseTask> {
  return browserUseRequest<BrowserUseTask>("/tasks", {
    method: "POST",
    body: JSON.stringify({
      task: params.task,
      sessionId: params.sessionId,
      startUrl: params.startUrl,
      maxSteps: params.maxSteps || 30,
      llm: params.llm || DEFAULT_LLM,
      structuredOutput: params.structuredOutput,
      flashMode: params.flashMode ?? false,
      thinking: params.thinking ?? false,
      vision: params.vision ?? true,
      allowedDomains: params.allowedDomains,
    }),
  });
}

/**
 * Get task status and result
 */
export async function getTask(taskId: string): Promise<BrowserUseTask> {
  return browserUseRequest<BrowserUseTask>(`/tasks/${taskId}`);
}

/**
 * Stop a running task
 */
export async function stopTask(taskId: string): Promise<void> {
  await browserUseRequest(`/tasks/${taskId}/stop`, {
    method: "POST",
  });
}

/**
 * Wait for a task to complete (polling)
 */
export async function waitForTask(
  taskId: string,
  options: {
    pollInterval?: number;
    timeout?: number;
    onProgress?: (task: BrowserUseTask) => void;
  } = {}
): Promise<BrowserUseTask> {
  const { pollInterval = 2000, timeout = 300000, onProgress } = options;
  const startTime = Date.now();

  while (true) {
    const task = await getTask(taskId);
    
    if (onProgress) {
      onProgress(task);
    }

    if (task.status === "finished" || task.status === "stopped") {
      return task;
    }

    if (Date.now() - startTime > timeout) {
      throw new Error(`Task ${taskId} timed out after ${timeout}ms`);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}

/**
 * Create a task and wait for it to complete
 */
export async function runTask(
  params: CreateTaskParams,
  options?: {
    pollInterval?: number;
    timeout?: number;
    onProgress?: (task: BrowserUseTask) => void;
  }
): Promise<BrowserUseTask> {
  const task = await createTask(params);
  return waitForTask(task.id, options);
}

// ============================================
// SKILLS API
// ============================================

export interface BrowserUseSkill {
  id: string;
  status: "created" | "generating" | "finished" | "failed";
  title?: string;
  description?: string;
  goal?: string;
  agentPrompt?: string;
  parameters?: Record<string, any>;
  outputSchema?: Record<string, any>;
  createdAt?: string;
}

export interface SkillExecutionResult {
  success: boolean;
  error?: string | null;
  stderr?: string | null;
  latencyMs?: number | null;
  output?: any;
}

/**
 * Create a new skill
 */
export async function createSkill(params: {
  goal: string;
  agentPrompt: string;
  title?: string;
  description?: string;
}): Promise<{ id: string }> {
  return browserUseRequest<{ id: string }>("/skills", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * Get skill details and status
 */
export async function getSkill(skillId: string): Promise<BrowserUseSkill> {
  return browserUseRequest<BrowserUseSkill>(`/skills/${skillId}`);
}

/**
 * List all skills
 */
export async function listSkills(): Promise<BrowserUseSkill[]> {
  const response = await browserUseRequest<{ items: BrowserUseSkill[]; totalItems: number }>("/skills");
  return response.items || [];
}

/**
 * Execute a skill with parameters
 */
export async function executeSkill(skillId: string, parameters?: Record<string, any>): Promise<SkillExecutionResult> {
  return browserUseRequest<SkillExecutionResult>(`/skills/${skillId}/execute`, {
    method: "POST",
    body: JSON.stringify({ parameters: parameters || {} }),
  });
}

/**
 * Refine a skill with feedback
 */
export async function refineSkill(skillId: string, feedback: string): Promise<void> {
  await browserUseRequest(`/skills/${skillId}/refine`, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
}

/**
 * Delete a skill
 */
export async function deleteSkill(skillId: string): Promise<void> {
  await browserUseRequest(`/skills/${skillId}`, {
    method: "DELETE",
  });
}

/**
 * Wait for a skill to finish building
 */
export async function waitForSkillReady(
  skillId: string,
  options: {
    pollInterval?: number;
    timeout?: number;
  } = {}
): Promise<BrowserUseSkill> {
  const { pollInterval = 3000, timeout = 300000 } = options;
  const startTime = Date.now();

  while (true) {
    const skill = await getSkill(skillId);
    
    if (skill.status === "finished") {
      return skill;
    }
    
    if (skill.status === "failed") {
      throw new Error(`Skill ${skillId} failed to build`);
    }

    if (Date.now() - startTime > timeout) {
      throw new Error(`Skill ${skillId} timed out after ${timeout}ms`);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}

/**
 * Get or create a skill by name/goal
 */
export async function getOrCreateSkill(params: {
  goal: string;
  agentPrompt: string;
  title: string;
  description?: string;
}): Promise<BrowserUseSkill> {
  // Check if skill already exists
  const skills = await listSkills();
  const existingSkill = skills.find(s => s.title === params.title && s.status === "finished");
  
  if (existingSkill) {
    return existingSkill;
  }
  
  // Create new skill
  const { id } = await createSkill(params);
  
  // Wait for it to be ready
  return waitForSkillReady(id);
}

// ============================================
// MARKET RESEARCH AGENT
// ============================================

export interface MarketResearchProgress {
  step: number;
  totalSteps: number;
  stepName: string;
  status: "pending" | "running" | "completed" | "error";
  data?: any;
  error?: string;
}

export interface MarketResearchResult {
  market: string;
  executiveSummary: {
    analysisDate: string;
    optimalBedroomSize: string;
    targetNeighborhoods: string[];
    keyFinding: string;
  };
  marketOverview: {
    totalListings: number;
    avgMonthlyListings: number;
    listingsPercentChange: number;
    avgOccupancy: number;
    avgADR: number;
    avgAnnualRevenue: number;
    marketHealthAssessment: string;
  };
  bedroomAnalysis: Array<{
    bedroomSize: string;
    avgRevenue: number;
    avgOccupancy: number;
    avgADR: number;
    listingCount: number;
    topPerformerRevenue: number;
  }>;
  geographicAnalysis: {
    primaryNeighborhood: { name: string; greenPinCount: number; notableFeatures: string[]; whyTarget: string };
    secondaryNeighborhood: { name: string; greenPinCount: number; notableFeatures: string[]; whyTarget: string };
    tertiaryNeighborhood: { name: string; greenPinCount: number; notableFeatures: string[]; whyTarget: string };
  };
  topPerformers: Array<{
    title: string;
    airbnbUrl: string;
    revenue: number;
    occupancy: number;
    adr: number;
    rating: number;
    reviewCount: number;
    designStyle: string;
    competitiveEdge: string;
    qualityRating: number;
  }>;
  seasonalityInsights: {
    peakSeason: string[];
    lowSeason: string[];
    revenueVariance: string;
    yoyTrend: string;
  };
  recommendations: {
    propertyHuntingFocus: string;
    pricingStrategy: string;
    designInvestment: string[];
    revenueExpectations: {
      conservative: number;
      target: number;
      stretch: number;
    };
  };
}

/**
 * Run the full 8-step market research process
 */
export async function runMarketResearch(
  marketName: string,
  onProgress?: (progress: MarketResearchProgress) => void
): Promise<MarketResearchResult> {
  const steps = [
    "Market Selection & ZIP Code Verification",
    "Market Explorer Analysis",
    "Bedroom Size Performance Analysis",
    "Favorite Top Performers",
    "Map Analysis for Geographic Clusters",
    "Seasonality Analysis",
    "Visit Top Performer Airbnb Listings",
    "Compile Market Research Report",
  ];

  // Get or create profile
  const profile = await getOrCreateCoachInayahProfile();
  
  // Create session with profile
  const session = await createSession({
    profileId: profile.id,
    startUrl: "https://coachinayah.com/market-charts",
    proxyCountryCode: "us",
  });

  const results: any = {
    market: marketName,
  };

  try {
    // Step 1: Market Selection & ZIP Code Verification
    onProgress?.({
      step: 1,
      totalSteps: 8,
      stepName: steps[0],
      status: "running",
    });

    const step1Task = await runTask({
      sessionId: session.id,
      task: `
        You are on coachinayah.com/market-charts. Complete these steps:
        1. Make sure you're on the "Comp Data" tab initially
        2. Click the "Select Submarkets" dropdown
        3. Type "${marketName}" in the search
        4. Select the matching submarket from the dropdown list
        5. Wait for the submarket tag to appear
        6. Click the "Select Zipcodes" dropdown
        7. Check if ZIP codes are already available in the dropdown
        8. If ZIP codes ARE in the dropdown, select all relevant ones for this area
        9. If ZIP codes are NOT in the dropdown, type a ZIP code for ${marketName}, click "Add/Refresh ZIP Data", wait 10-30 seconds, then select the newly added ZIP code(s)
        
        Return the selected submarket name and ZIP codes as JSON:
        {
          "submarketName": "name",
          "zipCodes": ["zip1", "zip2"]
        }
      `,
      maxSteps: 20,
      structuredOutput: JSON.stringify({
        type: "object",
        properties: {
          submarketName: { type: "string" },
          zipCodes: { type: "array", items: { type: "string" } },
        },
        required: ["submarketName", "zipCodes"],
      }),
    });

    results.marketSetup = JSON.parse(step1Task.output || "{}");
    onProgress?.({
      step: 1,
      totalSteps: 8,
      stepName: steps[0],
      status: "completed",
      data: results.marketSetup,
    });

    // Step 2: Market Explorer Analysis
    onProgress?.({
      step: 2,
      totalSteps: 8,
      stepName: steps[1],
      status: "running",
    });

    const step2Task = await runTask({
      sessionId: session.id,
      task: `
        Click the "Market Explorer" tab. Then click "Show Glossary" button to see metric definitions.
        
        Extract ALL 11 market metrics with their current values:
        1. Annual Revenue - Total revenue earned per year
        2. Occupancy - Percentage of available nights booked
        3. ADR (Average Daily Rate) - Average price per booked night
        4. RevPAR - Revenue divided by all available nights
        5. Average Rating - Mean guest review score
        6. Total Reviews - Cumulative reviews across all listings
        7. Listings - Total active short-term rental listings
        8. Avg Monthly Listings - Average listings per month
        9. Listings % Change - Year-over-year change in listings
        10. Days Available - Average days listed per property
        11. Market Size - Overall market scale indicator
        
        Return the data as JSON with this structure:
        {
          "annualRevenue": number,
          "occupancy": number (as percentage, e.g., 65 for 65%),
          "adr": number,
          "revpar": number,
          "averageRating": number,
          "totalReviews": number,
          "listings": number,
          "avgMonthlyListings": number,
          "listingsPercentChange": number,
          "daysAvailable": number,
          "marketSize": string
        }
      `,
      maxSteps: 15,
      structuredOutput: JSON.stringify({
        type: "object",
        properties: {
          annualRevenue: { type: "number" },
          occupancy: { type: "number" },
          adr: { type: "number" },
          revpar: { type: "number" },
          averageRating: { type: "number" },
          totalReviews: { type: "number" },
          listings: { type: "number" },
          avgMonthlyListings: { type: "number" },
          listingsPercentChange: { type: "number" },
          daysAvailable: { type: "number" },
          marketSize: { type: "string" },
        },
        required: ["annualRevenue", "occupancy", "adr", "listings"],
      }),
    });

    results.marketOverview = JSON.parse(step2Task.output || "{}");
    onProgress?.({
      step: 2,
      totalSteps: 8,
      stepName: steps[1],
      status: "completed",
      data: results.marketOverview,
    });

    // Step 3: Bedroom Size Performance Analysis
    onProgress?.({
      step: 3,
      totalSteps: 8,
      stepName: steps[2],
      status: "running",
    });

    const step3Task = await runTask({
      sessionId: session.id,
      task: `
        Click the "Comp Data" tab. For EACH bedroom configuration (1BR, 2BR, 3BR, 4BR, 5BR+), do the following:
        
        1. Click "Filter by" dropdown and select the bedroom count
        2. Press Escape to close the filter menu
        3. Scroll right to find the "Revenue" column
        4. Click the Revenue column header TWICE to sort descending (highest to lowest)
        5. Record from the "Average" row at top:
           - Average Revenue
           - Average Occupancy
           - Average ADR
        6. Count the number of listings in this category
        7. Note the top performer's revenue
        
        Repeat for all bedroom sizes and return as JSON:
        {
          "bedroomAnalysis": [
            {
              "bedroomSize": "1BR",
              "avgRevenue": number,
              "avgOccupancy": number,
              "avgADR": number,
              "listingCount": number,
              "topPerformerRevenue": number
            },
            ... repeat for 2BR, 3BR, 4BR, 5BR+
          ],
          "optimalBedroomSize": "XBR" (the one with highest avg revenue AND 50%+ occupancy)
        }
      `,
      maxSteps: 40,
      structuredOutput: JSON.stringify({
        type: "object",
        properties: {
          bedroomAnalysis: {
            type: "array",
            items: {
              type: "object",
              properties: {
                bedroomSize: { type: "string" },
                avgRevenue: { type: "number" },
                avgOccupancy: { type: "number" },
                avgADR: { type: "number" },
                listingCount: { type: "number" },
                topPerformerRevenue: { type: "number" },
              },
            },
          },
          optimalBedroomSize: { type: "string" },
        },
        required: ["bedroomAnalysis", "optimalBedroomSize"],
      }),
    });

    results.bedroomAnalysis = JSON.parse(step3Task.output || "{}");
    onProgress?.({
      step: 3,
      totalSteps: 8,
      stepName: steps[2],
      status: "completed",
      data: results.bedroomAnalysis,
    });

    // Step 4: Favorite Top Performers
    onProgress?.({
      step: 4,
      totalSteps: 8,
      stepName: steps[3],
      status: "running",
    });

    const optimalBedroom = results.bedroomAnalysis?.optimalBedroomSize || "3BR";
    
    const step4Task = await runTask({
      sessionId: session.id,
      task: `
        On the Comp Data tab:
        1. Click "Filter by" and select "${optimalBedroom}"
        2. Sort by Revenue descending (click Revenue header twice)
        3. For the top 10-15 revenue performers:
           - Click the property title to open the popup
           - Check if it has an "airBnb Property Page" link (not just VRBO)
           - If it has Airbnb link, click the heart icon in the "Favorite" column to favorite it
           - Skip any VRBO-only properties
           - CRITICAL: Only favorite properties that have recent reviews (within last 2 months)
        
        Return the list of favorited properties:
        {
          "favoritedProperties": [
            {
              "title": "property name",
              "revenue": number,
              "occupancy": number,
              "adr": number,
              "hasAirbnbLink": true,
              "airbnbUrl": "url if available"
            }
          ],
          "totalFavorited": number
        }
      `,
      maxSteps: 50,
      structuredOutput: JSON.stringify({
        type: "object",
        properties: {
          favoritedProperties: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                revenue: { type: "number" },
                occupancy: { type: "number" },
                adr: { type: "number" },
                hasAirbnbLink: { type: "boolean" },
                airbnbUrl: { type: "string" },
              },
            },
          },
          totalFavorited: { type: "number" },
        },
        required: ["favoritedProperties", "totalFavorited"],
      }),
    });

    results.favoritedProperties = JSON.parse(step4Task.output || "{}");
    onProgress?.({
      step: 4,
      totalSteps: 8,
      stepName: steps[3],
      status: "completed",
      data: results.favoritedProperties,
    });

    // Step 5: Map Analysis
    onProgress?.({
      step: 5,
      totalSteps: 8,
      stepName: steps[4],
      status: "running",
    });

    const step5Task = await runTask({
      sessionId: session.id,
      task: `
        Click the "Map" tab. The map will display all properties as pins:
        - Green pins = Your favorited top performers
        - Red pins = Regular properties
        
        Analyze the map:
        1. Look for clusters of green pins (your favorited high-revenue properties)
        2. Identify 3 neighborhoods/areas where green pins are concentrated
        3. For each cluster, note:
           - Neighborhood/area name
           - Number of green pins
           - Notable landmarks nearby (if visible)
        
        4. Click the "Metric" dropdown and change to "Revenue" to see the revenue heatmap
        5. Note which areas show highest revenue concentration (red/orange on scale)
        
        Return:
        {
          "geographicClusters": [
            {
              "neighborhoodName": "name",
              "greenPinCount": number,
              "notableLandmarks": ["landmark1", "landmark2"],
              "revenueConcentration": "high/medium/low"
            }
          ],
          "primaryTargetNeighborhood": "name",
          "secondaryTargetNeighborhood": "name",
          "tertiaryTargetNeighborhood": "name"
        }
      `,
      maxSteps: 20,
      structuredOutput: JSON.stringify({
        type: "object",
        properties: {
          geographicClusters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                neighborhoodName: { type: "string" },
                greenPinCount: { type: "number" },
                notableLandmarks: { type: "array", items: { type: "string" } },
                revenueConcentration: { type: "string" },
              },
            },
          },
          primaryTargetNeighborhood: { type: "string" },
          secondaryTargetNeighborhood: { type: "string" },
          tertiaryTargetNeighborhood: { type: "string" },
        },
        required: ["geographicClusters", "primaryTargetNeighborhood"],
      }),
    });

    results.geographicAnalysis = JSON.parse(step5Task.output || "{}");
    onProgress?.({
      step: 5,
      totalSteps: 8,
      stepName: steps[4],
      status: "completed",
      data: results.geographicAnalysis,
    });

    // Step 6: Seasonality Analysis
    onProgress?.({
      step: 6,
      totalSteps: 8,
      stepName: steps[5],
      status: "running",
    });

    const step6Task = await runTask({
      sessionId: session.id,
      task: `
        Click the "Charts" tab. Analyze the seasonality data:
        
        1. Look at the "Metric by Month" chart (should show revenue by default)
        2. Focus on 2024 and 2025 data only
        3. Record:
           - Peak months (highest revenue)
           - Low months (lowest revenue)
           - Revenue range (high to low)
        
        4. Look at the "YoY Change %" chart
        5. Record:
           - Months with positive growth
           - Months with negative growth
           - Overall trend direction
        
        6. Look at the ADR chart
        7. Note seasonal pricing patterns and premium pricing periods
        
        Return:
        {
          "monthlyData": [
            { "month": "Jan", "revenue": number, "yoyChange": number, "adr": number }
          ],
          "peakMonths": ["month1", "month2"],
          "lowMonths": ["month1", "month2"],
          "revenueRange": { "high": number, "low": number },
          "yoyTrend": "growing/declining/stable",
          "premiumPricingPeriods": ["period1", "period2"]
        }
      `,
      maxSteps: 20,
      structuredOutput: JSON.stringify({
        type: "object",
        properties: {
          monthlyData: {
            type: "array",
            items: {
              type: "object",
              properties: {
                month: { type: "string" },
                revenue: { type: "number" },
                yoyChange: { type: "number" },
                adr: { type: "number" },
              },
            },
          },
          peakMonths: { type: "array", items: { type: "string" } },
          lowMonths: { type: "array", items: { type: "string" } },
          revenueRange: {
            type: "object",
            properties: {
              high: { type: "number" },
              low: { type: "number" },
            },
          },
          yoyTrend: { type: "string" },
          premiumPricingPeriods: { type: "array", items: { type: "string" } },
        },
        required: ["peakMonths", "lowMonths", "yoyTrend"],
      }),
    });

    results.seasonalityAnalysis = JSON.parse(step6Task.output || "{}");
    onProgress?.({
      step: 6,
      totalSteps: 8,
      stepName: steps[5],
      status: "completed",
      data: results.seasonalityAnalysis,
    });

    // Step 7: Visit Airbnb Listings for Photo/Design Analysis
    onProgress?.({
      step: 7,
      totalSteps: 8,
      stepName: steps[6],
      status: "running",
    });

    const step7Task = await runTask({
      sessionId: session.id,
      task: `
        Go back to the "Comp Data" tab. Filter by ${optimalBedroom} and sort by Revenue descending.
        
        For the top 5 favorited properties that have Airbnb links:
        1. Click the property title to open popup
        2. Click the "airBnb Property Page" link to open the Airbnb listing
        3. On the Airbnb listing page, analyze:
        
        PROPERTY DETAILS:
        - Listing title
        - Number of reviews
        - Average rating
        
        PHOTO ANALYSIS (click "Show all photos"):
        - Total number of photos
        - Photo quality (Professional/Amateur)
        - Staging quality (Excellent/Good/Average/Poor)
        
        DESIGN & VIBE BREAKDOWN:
        - Overall Aesthetic (Modern/Traditional/Bohemian/Industrial/Coastal/Mixed)
        - Color Palette (Neutral/Bold/Warm/Cool/Monochromatic)
        - Flooring (Hardwood/Laminate/Tile/Carpet/Mixed)
        - Furniture Style (Contemporary/Traditional/Mid-Century/Budget/Mixed)
        - Kitchen Status (Fully Renovated/Partially Updated/Original/Builder Grade)
        - Standout Features (list unique elements)
        - Interior Quality Rating (1-10)
        - Outdoor Space Quality (1-10 or N/A)
        - Instagram-Worthiness (High/Medium/Low)
        - Atmosphere (Cozy/Luxurious/Family-Friendly/Party-Ready/Romantic)
        - Competitive Edge (what makes this listing succeed?)
        
        4. Close the Airbnb tab and return to Coach Inayah
        5. Repeat for next property
        
        Return:
        {
          "topPerformerAnalysis": [
            {
              "title": "listing title",
              "airbnbUrl": "url",
              "revenue": number,
              "occupancy": number,
              "reviewCount": number,
              "rating": number,
              "photoCount": number,
              "photoQuality": "Professional/Amateur",
              "stagingQuality": "Excellent/Good/Average/Poor",
              "aesthetic": "style",
              "colorPalette": "palette",
              "flooring": "type",
              "furnitureStyle": "style",
              "kitchenStatus": "status",
              "standoutFeatures": ["feature1", "feature2"],
              "interiorQualityRating": number,
              "outdoorSpaceRating": number or null,
              "instagramWorthiness": "High/Medium/Low",
              "atmosphere": "type",
              "competitiveEdge": "description"
            }
          ]
        }
      `,
      maxSteps: 100,
      vision: true,
      structuredOutput: JSON.stringify({
        type: "object",
        properties: {
          topPerformerAnalysis: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                airbnbUrl: { type: "string" },
                revenue: { type: "number" },
                occupancy: { type: "number" },
                reviewCount: { type: "number" },
                rating: { type: "number" },
                photoCount: { type: "number" },
                photoQuality: { type: "string" },
                stagingQuality: { type: "string" },
                aesthetic: { type: "string" },
                colorPalette: { type: "string" },
                flooring: { type: "string" },
                furnitureStyle: { type: "string" },
                kitchenStatus: { type: "string" },
                standoutFeatures: { type: "array", items: { type: "string" } },
                interiorQualityRating: { type: "number" },
                outdoorSpaceRating: { type: "number" },
                instagramWorthiness: { type: "string" },
                atmosphere: { type: "string" },
                competitiveEdge: { type: "string" },
              },
            },
          },
        },
        required: ["topPerformerAnalysis"],
      }),
    });

    results.topPerformerAnalysis = JSON.parse(step7Task.output || "{}");
    onProgress?.({
      step: 7,
      totalSteps: 8,
      stepName: steps[6],
      status: "completed",
      data: results.topPerformerAnalysis,
    });

    // Step 8: Compile Final Report
    onProgress?.({
      step: 8,
      totalSteps: 8,
      stepName: steps[7],
      status: "running",
    });

    // Compile all results into final report structure
    const finalReport: MarketResearchResult = {
      market: marketName,
      executiveSummary: {
        analysisDate: new Date().toISOString().split("T")[0],
        optimalBedroomSize: results.bedroomAnalysis?.optimalBedroomSize || "Unknown",
        targetNeighborhoods: [
          results.geographicAnalysis?.primaryTargetNeighborhood,
          results.geographicAnalysis?.secondaryTargetNeighborhood,
          results.geographicAnalysis?.tertiaryTargetNeighborhood,
        ].filter(Boolean),
        keyFinding: generateKeyFinding(results),
      },
      marketOverview: {
        totalListings: results.marketOverview?.listings || 0,
        avgMonthlyListings: results.marketOverview?.avgMonthlyListings || 0,
        listingsPercentChange: results.marketOverview?.listingsPercentChange || 0,
        avgOccupancy: results.marketOverview?.occupancy || 0,
        avgADR: results.marketOverview?.adr || 0,
        avgAnnualRevenue: results.marketOverview?.annualRevenue || 0,
        marketHealthAssessment: assessMarketHealth(results.marketOverview),
      },
      bedroomAnalysis: results.bedroomAnalysis?.bedroomAnalysis || [],
      geographicAnalysis: {
        primaryNeighborhood: {
          name: results.geographicAnalysis?.primaryTargetNeighborhood || "",
          greenPinCount: results.geographicAnalysis?.geographicClusters?.[0]?.greenPinCount || 0,
          notableFeatures: results.geographicAnalysis?.geographicClusters?.[0]?.notableLandmarks || [],
          whyTarget: results.geographicAnalysis?.geographicClusters?.[0]?.revenueConcentration === "high" 
            ? "High concentration of top-performing properties" 
            : "Good cluster of successful listings",
        },
        secondaryNeighborhood: {
          name: results.geographicAnalysis?.secondaryTargetNeighborhood || "",
          greenPinCount: results.geographicAnalysis?.geographicClusters?.[1]?.greenPinCount || 0,
          notableFeatures: results.geographicAnalysis?.geographicClusters?.[1]?.notableLandmarks || [],
          whyTarget: "Secondary cluster of high-revenue properties",
        },
        tertiaryNeighborhood: {
          name: results.geographicAnalysis?.tertiaryTargetNeighborhood || "",
          greenPinCount: results.geographicAnalysis?.geographicClusters?.[2]?.greenPinCount || 0,
          notableFeatures: results.geographicAnalysis?.geographicClusters?.[2]?.notableLandmarks || [],
          whyTarget: "Emerging area with growth potential",
        },
      },
      topPerformers: (results.topPerformerAnalysis?.topPerformerAnalysis || []).map((p: any) => ({
        title: p.title,
        airbnbUrl: p.airbnbUrl,
        revenue: p.revenue,
        occupancy: p.occupancy,
        adr: p.revenue / (p.occupancy / 100 * 365) || 0,
        rating: p.rating,
        reviewCount: p.reviewCount,
        designStyle: p.aesthetic,
        competitiveEdge: p.competitiveEdge,
        qualityRating: p.interiorQualityRating,
      })),
      seasonalityInsights: {
        peakSeason: results.seasonalityAnalysis?.peakMonths || [],
        lowSeason: results.seasonalityAnalysis?.lowMonths || [],
        revenueVariance: results.seasonalityAnalysis?.revenueRange 
          ? `$${results.seasonalityAnalysis.revenueRange.low} - $${results.seasonalityAnalysis.revenueRange.high}`
          : "Unknown",
        yoyTrend: results.seasonalityAnalysis?.yoyTrend || "Unknown",
      },
      recommendations: generateRecommendations(results),
    };

    onProgress?.({
      step: 8,
      totalSteps: 8,
      stepName: steps[7],
      status: "completed",
      data: finalReport,
    });

    return finalReport;

  } finally {
    // Always stop the session when done
    try {
      await stopSession(session.id);
    } catch (e) {
      console.error("Failed to stop session:", e);
    }
  }
}

// Helper functions
function generateKeyFinding(results: any): string {
  const optimalBedroom = results.bedroomAnalysis?.optimalBedroomSize || "3BR";
  const avgRevenue = results.marketOverview?.annualRevenue || 0;
  const occupancy = results.marketOverview?.occupancy || 0;
  
  if (occupancy > 70) {
    return `Strong demand market with ${occupancy}% occupancy. ${optimalBedroom} properties perform best with average revenue of $${avgRevenue.toLocaleString()}/year.`;
  } else if (occupancy > 50) {
    return `Moderate demand market with ${occupancy}% occupancy. Focus on ${optimalBedroom} properties in target neighborhoods for best results.`;
  } else {
    return `Competitive market with ${occupancy}% occupancy. Differentiation through design and amenities is key for ${optimalBedroom} properties.`;
  }
}

function assessMarketHealth(marketOverview: any): string {
  if (!marketOverview) return "Unknown";
  
  const listingsChange = marketOverview.listingsPercentChange || 0;
  const occupancy = marketOverview.occupancy || 0;
  
  if (listingsChange > 5 && occupancy > 60) return "Growing";
  if (listingsChange > 0 && occupancy > 50) return "Stable";
  if (listingsChange < 0 && occupancy > 60) return "Consolidating";
  if (occupancy < 50) return "Declining";
  return "Stable";
}

function generateRecommendations(results: any): MarketResearchResult["recommendations"] {
  const optimalBedroom = results.bedroomAnalysis?.optimalBedroomSize || "3BR";
  const topPerformers = results.topPerformerAnalysis?.topPerformerAnalysis || [];
  const avgRevenue = results.marketOverview?.annualRevenue || 50000;
  
  // Extract common design elements from top performers
  const designElements = topPerformers
    .filter((p: any) => p.standoutFeatures)
    .flatMap((p: any) => p.standoutFeatures)
    .slice(0, 3);

  return {
    propertyHuntingFocus: `Target ${optimalBedroom} properties in ${results.geographicAnalysis?.primaryTargetNeighborhood || "identified target neighborhoods"}`,
    pricingStrategy: `Target ADR of $${Math.round(results.marketOverview?.adr || 150)} based on top performers`,
    designInvestment: designElements.length > 0 ? designElements : ["Modern furnishings", "Professional photography", "Quality linens"],
    revenueExpectations: {
      conservative: Math.round(avgRevenue * 0.7),
      target: Math.round(avgRevenue),
      stretch: Math.round(avgRevenue * 1.3),
    },
  };
}

// Export for testing
export { browserUseRequest };
