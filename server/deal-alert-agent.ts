/**
 * Deal Alert Agent Service
 * 
 * The autonomous agent that scans for rental deals matching user criteria.
 * This is the "Claude Code for STR" engine — it works while users sleep.
 * 
 * Flow:
 * 1. User sets criteria (city, bedrooms, max rent, min profit, etc.)
 * 2. Agent periodically scans for matching properties
 * 3. When matches are found, agent stores them and sends notifications
 * 4. User reviews matches and takes action
 */

import { getDb } from './db';
import { dealAlertCriteria, dealAlertMatches } from '../drizzle/schema';
import { eq, and, desc, sql, isNull, gt, lt, or } from 'drizzle-orm';
import { analyzePropertyForArbitrage, type RentalDeal } from './newsletter-deal-finder';
import { sendDealAlertEmail } from './newsletter-email-sender';
import { getRentalizerEstimate, searchMarketsAPI, getMarketDetails, getMarketHistoricalData, getMarketSeasonality, getTopPerformers, getMarketListings, calculateMarketInsights } from './airdna';
import { routedLLMCall, FEATURES } from './model-router';
import { searchZillowRentals, type ZillowListing } from './hasdata-zillow';

// ============================================================
// Types
// ============================================================

export interface DealAlertCriteriaInput {
  email: string;
  firstName?: string;
  phone?: string;
  sessionId?: string;
  userId?: number;
  
  // Location
  city: string;
  state: string;
  zipCode?: string;
  marketId?: string;
  marketName?: string;
  
  // Analysis type
  analysisType: 'arbitrage' | 'investment' | 'both';
  
  // Property criteria
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxRent?: number;
  maxPurchasePrice?: number;
  propertyTypes?: string[];
  
  // Profitability criteria
  minMonthlyProfit?: number;
  minProfitMargin?: number;
  minDealScore?: number;
  minOccupancy?: number;
  
  // Notification preferences
  notifyEmail?: boolean;
  notifySms?: boolean;
  notifyInApp?: boolean;
  frequency?: 'instant' | 'daily' | 'weekly';
}

export interface ScanResult {
  criteriaId: number;
  city: string;
  state: string;
  propertiesScanned: number;
  matchesFound: number;
  alertsSent: number;
  errors: string[];
  duration: number; // ms
}

// ============================================================
// CRUD Operations
// ============================================================

/**
 * Create a new deal alert criteria
 */
export async function createDealAlertCriteria(input: DealAlertCriteriaInput): Promise<{ id: number; success: boolean }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Check for duplicate (same email + city + state + analysis type)
  const existing = await db
    .select()
    .from(dealAlertCriteria)
    .where(
      and(
        eq(dealAlertCriteria.email, input.email),
        eq(dealAlertCriteria.city, input.city),
        eq(dealAlertCriteria.state, input.state),
        eq(dealAlertCriteria.analysisType, input.analysisType)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing instead of creating duplicate
    await db.update(dealAlertCriteria)
      .set({
        minBedrooms: input.minBedrooms ?? 1,
        maxBedrooms: input.maxBedrooms ?? 5,
        maxRent: input.maxRent,
        maxPurchasePrice: input.maxPurchasePrice,
        minMonthlyProfit: input.minMonthlyProfit ?? 500,
        minProfitMargin: input.minProfitMargin?.toString() ?? '0.15',
        minDealScore: input.minDealScore ?? 50,
        frequency: input.frequency ?? 'daily',
        isActive: 1,
      })
      .where(eq(dealAlertCriteria.id, existing[0].id));
    
    return { id: existing[0].id, success: true };
  }
  
  const result = await db.insert(dealAlertCriteria).values({
    email: input.email,
    firstName: input.firstName,
    phone: input.phone,
    sessionId: input.sessionId,
    userId: input.userId,
    city: input.city,
    state: input.state,
    zipCode: input.zipCode,
    marketId: input.marketId,
    marketName: input.marketName,
    analysisType: input.analysisType,
    minBedrooms: input.minBedrooms ?? 1,
    maxBedrooms: input.maxBedrooms ?? 5,
    minBathrooms: input.minBathrooms?.toString() ?? '1',
    maxRent: input.maxRent,
    maxPurchasePrice: input.maxPurchasePrice,
    propertyTypes: input.propertyTypes,
    minMonthlyProfit: input.minMonthlyProfit ?? 500,
    minProfitMargin: input.minProfitMargin?.toString() ?? '0.15',
    minDealScore: input.minDealScore ?? 50,
    minOccupancy: input.minOccupancy?.toString(),
    notifyEmail: input.notifyEmail !== false ? 1 : 0,
    notifySms: input.notifySms ? 1 : 0,
    notifyInApp: input.notifyInApp !== false ? 1 : 0,
    frequency: input.frequency ?? 'daily',
  });
  
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  console.log(`[DealAlertAgent] Created criteria #${id} for ${input.email} in ${input.city}, ${input.state}`);
  
  return { id, success: true };
}

/**
 * List deal alert criteria for a user
 */
export async function listDealAlertCriteria(params: {
  email?: string;
  sessionId?: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (params.email) conditions.push(eq(dealAlertCriteria.email, params.email));
  if (params.sessionId) conditions.push(eq(dealAlertCriteria.sessionId, params.sessionId));
  if (params.userId) conditions.push(eq(dealAlertCriteria.userId, params.userId));
  
  if (conditions.length === 0) return [];
  
  return db
    .select()
    .from(dealAlertCriteria)
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    .orderBy(desc(dealAlertCriteria.createdAt));
}

/**
 * Get matches for a specific criteria
 */
export async function getDealAlertMatches(criteriaId: number, options?: {
  status?: 'new' | 'notified' | 'viewed' | 'saved' | 'dismissed';
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(dealAlertMatches.criteriaId, criteriaId)];
  if (options?.status) conditions.push(eq(dealAlertMatches.status, options.status));
  
  return db
    .select()
    .from(dealAlertMatches)
    .where(and(...conditions))
    .orderBy(desc(dealAlertMatches.discoveredAt))
    .limit(options?.limit ?? 50);
}

/**
 * Update match status (viewed, saved, dismissed)
 */
export async function updateMatchStatus(matchId: number, status: 'viewed' | 'saved' | 'dismissed') {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const updateData: any = { status };
  if (status === 'viewed') updateData.viewedAt = new Date();
  
  await db.update(dealAlertMatches)
    .set(updateData)
    .where(eq(dealAlertMatches.id, matchId));
}

/**
 * Toggle criteria active/inactive
 */
export async function toggleCriteriaActive(criteriaId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const existing = await db.select().from(dealAlertCriteria).where(eq(dealAlertCriteria.id, criteriaId)).limit(1);
  if (!existing.length) throw new Error('Criteria not found');
  
  const newStatus = existing[0].isActive === 1 ? 0 : 1;
  await db.update(dealAlertCriteria).set({ isActive: newStatus }).where(eq(dealAlertCriteria.id, criteriaId));
  
  return { isActive: newStatus === 1 };
}

/**
 * Delete a criteria and its matches
 */
export async function deleteDealAlertCriteria(criteriaId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.delete(dealAlertMatches).where(eq(dealAlertMatches.criteriaId, criteriaId));
  await db.delete(dealAlertCriteria).where(eq(dealAlertCriteria.id, criteriaId));
}

// ============================================================
// Agent Scanning Logic
// ============================================================

/**
 * Find real rental listings from Zillow via HasData API.
 * Falls back to synthetic samples if HasData is unavailable or returns no results.
 *
 * Cost: 5 credits per HasData Listing API call (returns up to 40 listings).
 */
async function findRealListings(criteria: typeof dealAlertCriteria.$inferSelect): Promise<Array<{
  address: string;
  streetAddress: string;
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;
  propertyType: string;
  sourceUrl: string;
  sourcePlatform: 'zillow' | 'manual';
  imageUrl: string;
  zpid: string;
}>> {
  try {
    const searchResult = await searchZillowRentals({
      city: criteria.city,
      state: criteria.state,
      minBeds: criteria.minBedrooms ?? 1,
      maxBeds: criteria.maxBedrooms ?? 5,
      maxPrice: criteria.maxRent ?? undefined,
    });

    if (searchResult.success && searchResult.listings.length > 0) {
      // Filter to listings with price and bedrooms
      const valid = searchResult.listings.filter(l => l.price > 0 && l.bedrooms > 0);
      console.log(`[DealAlertAgent] HasData returned ${searchResult.listings.length} listings, ${valid.length} with price+beds`);

      // Cap at 15 listings to control AirDNA API usage
      return valid.slice(0, 15).map(l => ({
        address: l.address || `${l.streetAddress}, ${l.city}, ${l.state} ${l.zipcode}`,
        streetAddress: l.streetAddress || l.address,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms || Math.max(1, Math.ceil(l.bedrooms * 0.75)),
        monthlyRent: l.price,
        propertyType: l.homeType || (l.bedrooms <= 2 ? 'apartment' : 'house'),
        sourceUrl: l.detailUrl || `https://www.zillow.com/homedetails/${l.zpid}_zpid/`,
        sourcePlatform: 'zillow' as const,
        imageUrl: l.imgSrc || '',
        zpid: l.zpid,
      }));
    }
  } catch (err) {
    console.warn('[DealAlertAgent] HasData search failed, falling back to synthetic samples:', err);
  }

  // Fallback: generate synthetic samples (same as old generateSampleProperties)
  console.log('[DealAlertAgent] Using synthetic samples (HasData unavailable)');
  const samples: Array<{
    address: string;
    streetAddress: string;
    bedrooms: number;
    bathrooms: number;
    monthlyRent: number;
    propertyType: string;
    sourceUrl: string;
    sourcePlatform: 'zillow' | 'manual';
    imageUrl: string;
    zpid: string;
  }> = [];

  for (let br = (criteria.minBedrooms ?? 1); br <= (criteria.maxBedrooms ?? 5); br++) {
    const bathrooms = Math.max(1, Math.ceil(br * 0.75));
    const baseRent = criteria.maxRent
      ? Math.round(criteria.maxRent * 0.8)
      : br * 600 + 400;
    samples.push({
      address: `${criteria.city}, ${criteria.state}${criteria.zipCode ? ' ' + criteria.zipCode : ''}`,
      streetAddress: '',
      bedrooms: br,
      bathrooms,
      monthlyRent: baseRent,
      propertyType: br <= 2 ? 'apartment' : 'house',
      sourceUrl: '',
      sourcePlatform: 'manual',
      imageUrl: '',
      zpid: '',
    });
  }
  return samples;
}

/**
 * Check if a deal matches the user's criteria
 */
function dealMatchesCriteria(deal: RentalDeal, criteria: typeof dealAlertCriteria.$inferSelect): boolean {
  // Check minimum monthly profit
  if (criteria.minMonthlyProfit && deal.monthlyProfit < criteria.minMonthlyProfit) {
    return false;
  }
  
  // Check minimum profit margin
  if (criteria.minProfitMargin && deal.profitMargin < parseFloat(criteria.minProfitMargin)) {
    return false;
  }
  
  // Check minimum deal score
  if (criteria.minDealScore && deal.dealScore < criteria.minDealScore) {
    return false;
  }
  
  // Check minimum occupancy
  if (criteria.minOccupancy && deal.projectedOccupancy < parseFloat(criteria.minOccupancy)) {
    return false;
  }
  
  // Check max rent
  if (criteria.maxRent && deal.monthlyRent > criteria.maxRent) {
    return false;
  }
  
  return true;
}

/**
 * Scan for deals matching a single criteria
 */
export async function scanForCriteria(criteriaId: number): Promise<ScanResult> {
  const startTime = Date.now();
  const result: ScanResult = {
    criteriaId,
    city: '',
    state: '',
    propertiesScanned: 0,
    matchesFound: 0,
    alertsSent: 0,
    errors: [],
    duration: 0,
  };
  
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    // Get criteria
    const [criteria] = await db.select().from(dealAlertCriteria).where(eq(dealAlertCriteria.id, criteriaId)).limit(1);
    if (!criteria) throw new Error(`Criteria #${criteriaId} not found`);
    if (criteria.isActive !== 1) throw new Error(`Criteria #${criteriaId} is inactive`);
    
    result.city = criteria.city;
    result.state = criteria.state;
    
    console.log(`[DealAlertAgent] Scanning for criteria #${criteriaId}: ${criteria.city}, ${criteria.state} (${criteria.analysisType})`);
    
    // Find real Zillow listings (falls back to synthetic if HasData unavailable)
    const listings = await findRealListings(criteria);
    result.propertiesScanned = listings.length;
    console.log(`[DealAlertAgent] Analyzing ${listings.length} listings for criteria #${criteriaId}`);
    
    const newMatches: Array<typeof dealAlertMatches.$inferInsert> = [];
    
    // Analyze each listing through AirDNA
    for (const listing of listings) {
      try {
        const deal = await analyzePropertyForArbitrage({
          address: listing.address,
          city: criteria.city,
          state: criteria.state,
          zipCode: criteria.zipCode || undefined,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          monthlyRent: listing.monthlyRent,
          propertyType: listing.propertyType,
          sourceUrl: listing.sourceUrl,
          sourcePlatform: listing.sourcePlatform,
          imageUrl: listing.imageUrl,
        });
        
        if (!deal) continue;
        
        // Check if deal matches criteria
        if (!dealMatchesCriteria(deal, criteria)) continue;
        
        // Check for duplicate matches by sourceUrl (Zillow URL) or address+bedrooms
        const existingMatch = await db
          .select()
          .from(dealAlertMatches)
          .where(
            and(
              eq(dealAlertMatches.criteriaId, criteriaId),
              listing.sourceUrl
                ? eq(dealAlertMatches.sourceUrl, listing.sourceUrl)
                : and(
                    eq(dealAlertMatches.address, listing.address),
                    eq(dealAlertMatches.bedrooms, listing.bedrooms)
                  )
            )
          )
          .limit(1);
        
        if (existingMatch.length > 0) {
          // Update existing match with fresh data
          await db.update(dealAlertMatches)
            .set({
              projectedRevenue: Math.round(deal.projectedMonthlyRevenue * 12),
              projectedAdr: Math.round(deal.projectedAdr),
              projectedOccupancy: deal.projectedOccupancy.toString(),
              projectedMonthlyProfit: Math.round(deal.monthlyProfit),
              projectedAnnualProfit: Math.round(deal.annualProfit),
              profitMargin: deal.profitMargin.toString(),
              dealScore: deal.dealScore,
              dealGrade: deal.dealGrade,
              monthlyRent: listing.monthlyRent,
              imageUrl: listing.imageUrl || existingMatch[0].imageUrl,
              sourceUrl: listing.sourceUrl || existingMatch[0].sourceUrl,
            })
            .where(eq(dealAlertMatches.id, existingMatch[0].id));
          continue;
        }
        
        // Store new match with real property data
        const matchData: typeof dealAlertMatches.$inferInsert = {
          criteriaId,
          address: deal.address,
          city: criteria.city,
          state: criteria.state,
          zipCode: deal.zipCode || criteria.zipCode || undefined,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms.toString(),
          monthlyRent: listing.monthlyRent,
          propertyType: listing.propertyType,
          sourceUrl: listing.sourceUrl || deal.sourceUrl || undefined,
          sourcePlatform: listing.sourcePlatform,
          imageUrl: listing.imageUrl || deal.imageUrl || undefined,
          projectedRevenue: Math.round(deal.projectedMonthlyRevenue * 12),
          projectedAdr: Math.round(deal.projectedAdr),
          projectedOccupancy: deal.projectedOccupancy.toString(),
          projectedMonthlyProfit: Math.round(deal.monthlyProfit),
          projectedAnnualProfit: Math.round(deal.annualProfit),
          profitMargin: deal.profitMargin.toString(),
          dealScore: deal.dealScore,
          dealGrade: deal.dealGrade,
        };
        
        await db.insert(dealAlertMatches).values(matchData);
        newMatches.push(matchData);
        result.matchesFound++;
        
        // Rate limiting between AirDNA calls
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        result.errors.push(`Error analyzing listing ${listing.address}: ${err}`);
      }
    }
    
    // Update criteria stats
    await db.update(dealAlertCriteria)
      .set({
        lastScannedAt: new Date(),
        ...(newMatches.length > 0 ? { lastMatchFoundAt: new Date() } : {}),
        totalMatchesFound: sql`${dealAlertCriteria.totalMatchesFound} + ${newMatches.length}`,
      })
      .where(eq(dealAlertCriteria.id, criteriaId));
    
    // Send notification if new matches found
    if (newMatches.length > 0 && criteria.notifyEmail === 1) {
      try {
        const bestMatch = newMatches.sort((a, b) => (b.dealScore ?? 0) - (a.dealScore ?? 0))[0];
        
        // Generate AI narrative for the alert
        const narrative = await generateDealAlertNarrative(criteria, newMatches);
        
        await sendDealAlertEmail({
          recipient: {
            email: criteria.email,
            firstName: criteria.firstName || 'Investor',
            lastName: '',
          },
          city: criteria.city,
          state: criteria.state,
          deal: {
            address: bestMatch.address as string,
            bedrooms: bestMatch.bedrooms ?? 3,
            bathrooms: parseFloat(bestMatch.bathrooms as string) || 2,
            monthlyRevenue: Math.round((bestMatch.projectedRevenue ?? 0) / 12),
            annualRevenue: bestMatch.projectedRevenue ?? 0,
            occupancyRate: parseFloat(bestMatch.projectedOccupancy as string) || 0,
            averageDailyRate: bestMatch.projectedAdr ?? 0,
            dealScore: bestMatch.dealScore ?? 0,
            monthlyRent: bestMatch.monthlyRent ?? 0,
          },
          aiNarrative: narrative,
        });
        
        result.alertsSent++;
        
        // Update alert count
        await db.update(dealAlertCriteria)
          .set({ totalAlertsSent: sql`${dealAlertCriteria.totalAlertsSent} + 1` })
          .where(eq(dealAlertCriteria.id, criteriaId));
        
        // Mark all new matches as notified in parallel
        await Promise.all(newMatches.map(match =>
          db.update(dealAlertMatches)
            .set({ status: 'notified', notifiedAt: new Date() })
            .where(
              and(
                eq(dealAlertMatches.criteriaId, criteriaId),
                eq(dealAlertMatches.status, 'new')
              )
            )
        ));
        
      } catch (err) {
        result.errors.push(`Error sending notification: ${err}`);
      }
    }
    
  } catch (err) {
    result.errors.push(`Scan error: ${err}`);
  }
  
  result.duration = Date.now() - startTime;
  console.log(`[DealAlertAgent] Scan complete for criteria #${criteriaId}: ${result.matchesFound} matches in ${result.duration}ms`);
  
  return result;
}

/**
 * Run the full deal alert scan job
 * Processes all active criteria that are due for scanning
 */
export async function runDealAlertScanJob(): Promise<{
  criteriaProcessed: number;
  totalMatches: number;
  totalAlerts: number;
  errors: string[];
  duration: number;
}> {
  const startTime = Date.now();
  const jobResult = {
    criteriaProcessed: 0,
    totalMatches: 0,
    totalAlerts: 0,
    errors: [] as string[],
    duration: 0,
  };
  
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    // Get all active criteria that need scanning
    const now = new Date();
    const activeCriteria = await db
      .select()
      .from(dealAlertCriteria)
      .where(eq(dealAlertCriteria.isActive, 1))
      .orderBy(dealAlertCriteria.lastScannedAt);
    
    console.log(`[DealAlertAgent] Starting scan job: ${activeCriteria.length} active criteria`);
    
    for (const criteria of activeCriteria) {
      // Check if criteria is due for scanning based on frequency
      if (criteria.lastScannedAt) {
        const hoursSinceLastScan = (now.getTime() - new Date(criteria.lastScannedAt).getTime()) / (1000 * 60 * 60);
        
        if (criteria.frequency === 'daily' && hoursSinceLastScan < 20) continue;
        if (criteria.frequency === 'weekly' && hoursSinceLastScan < 144) continue;
        // 'instant' always scans
      }
      
      try {
        const scanResult = await scanForCriteria(criteria.id);
        jobResult.criteriaProcessed++;
        jobResult.totalMatches += scanResult.matchesFound;
        jobResult.totalAlerts += scanResult.alertsSent;
        jobResult.errors.push(...scanResult.errors);
        
        // Rate limit between criteria
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (err) {
        jobResult.errors.push(`Error processing criteria #${criteria.id}: ${err}`);
      }
    }
    
  } catch (err) {
    jobResult.errors.push(`Job error: ${err}`);
  }
  
  jobResult.duration = Date.now() - startTime;
  console.log(`[DealAlertAgent] Job complete: ${jobResult.criteriaProcessed} criteria, ${jobResult.totalMatches} matches, ${jobResult.totalAlerts} alerts in ${jobResult.duration}ms`);
  
  return jobResult;
}

// ============================================================
// AI Narrative Generation
// ============================================================

/**
 * Generate a personalized AI narrative for a deal alert email
 */
async function generateDealAlertNarrative(
  criteria: typeof dealAlertCriteria.$inferSelect,
  matches: Array<typeof dealAlertMatches.$inferInsert>
): Promise<string> {
  try {
    const bestMatch = matches.sort((a, b) => (b.dealScore ?? 0) - (a.dealScore ?? 0))[0];
    
    const prompt = `Write a brief, personalized email paragraph (2-3 sentences) about a deal alert for ${criteria.firstName || 'there'}. Use the "story before the stats" approach — lead with a compelling narrative, then back it with specific numbers. Be warm but direct.

Market: ${criteria.city}, ${criteria.state}
Property: ${bestMatch.bedrooms}BR/${bestMatch.bathrooms}BA
Monthly Rent: $${bestMatch.monthlyRent?.toLocaleString() || 'N/A'}
Projected Monthly Revenue: $${Math.round((bestMatch.projectedRevenue ?? 0) / 12).toLocaleString()}
Projected Monthly Profit: $${bestMatch.projectedMonthlyProfit?.toLocaleString() || 'N/A'}
Deal Score: ${bestMatch.dealScore}/100
Total Matches Found: ${matches.length}

Write in a warm, conversational tone. Mention the key numbers. Keep it under 60 words.`;

    const response = await routedLLMCall(FEATURES.DEAL_ALERT_SNIPPET, prompt, {
      maxTokens: 512,
      systemPrompt: 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist and founder of StayMetrics, managing $100M+ across 400+ properties. Write brief, warm email content on behalf of Coach Inayah. Use the "story before the stats" approach. Be warm but direct.',
    });
    
    return response || '';
  } catch (err) {
    console.error('[DealAlertAgent] Error generating narrative:', err);
    return '';
  }
}

// ============================================================
// Market Evaluation Agent
// ============================================================

/**
 * Run a one-click market evaluation
 * Chains: market overview → revenue estimates → comps → regulations → AI memo
 */
export async function runMarketEvaluation(params: {
  city: string;
  state: string;
  analysisType?: 'arbitrage' | 'investment' | 'both';
  bedrooms?: number;
  sessionId?: string;
  userId?: number;
  email?: string;
  onProgress?: (step: string, progress: number) => void;
  _evaluationId?: number; // If provided, reuse existing DB record instead of creating new one
}): Promise<{
  evaluationId: number;
  marketScore: number;
  summary: string;
}> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const { marketEvaluations } = await import('../drizzle/schema');
  
  let evaluationId: number;
  
  if (params._evaluationId) {
    // Reuse existing record (created by startMarketEvaluation)
    evaluationId = params._evaluationId;
    await db.update(marketEvaluations)
      .set({ status: 'running', startedAt: new Date(), currentStep: 'market_overview', progress: 0 })
      .where(eq(marketEvaluations.id, evaluationId));
  } else {
    // Create new evaluation record
    const [insertResult] = await db.insert(marketEvaluations).values({
      city: params.city,
      state: params.state,
      analysisType: params.analysisType ?? 'both',
      bedrooms: params.bedrooms ?? 3,
      sessionId: params.sessionId,
      userId: params.userId,
      email: params.email,
      status: 'running',
      startedAt: new Date(),
      currentStep: 'market_overview',
      progress: 0,
    }) as any;
    evaluationId = Number(insertResult?.insertId ?? insertResult);
  }
  
  try {
    // ============================================================
    // Step 1: Market Discovery (0-15%)
    // Find the AirDNA market and get overview data
    // ============================================================
    params.onProgress?.('Discovering market...', 5);
    await db.update(marketEvaluations)
      .set({ currentStep: 'market_discovery', progress: 5 })
      .where(eq(marketEvaluations.id, evaluationId));
    
    let marketId: string | null = null;
    let marketName = `${params.city}, ${params.state}`;
    let marketDetails: any = null;
    
    try {
      const markets = await searchMarketsAPI(`${params.city}, ${params.state}`, 5);
      if (markets.length > 0) {
        marketId = markets[0].id;
        marketName = markets[0].name;
      }
    } catch (err) {
      console.error('[MarketEval] Market search failed:', err);
    }
    
    if (marketId) {
      try {
        marketDetails = await getMarketDetails(marketId);
      } catch (err) {
        console.error('[MarketEval] Market details failed:', err);
      }
    }
    
    // ============================================================
    // Step 2: Revenue Analysis (15-35%)
    // Get revenue estimates for multiple bedroom counts
    // ============================================================
    params.onProgress?.('Analyzing revenue potential...', 15);
    await db.update(marketEvaluations)
      .set({ currentStep: 'revenue_analysis', progress: 15 })
      .where(eq(marketEvaluations.id, evaluationId));
    
    const targetBR = params.bedrooms ?? 3;
    const bedroomCounts = [Math.max(1, targetBR - 1), targetBR, Math.min(8, targetBR + 1)];
    const revenueData: any[] = [];
    
    // Fetch revenue estimates for all bedroom counts in parallel
    const revenueResults = await Promise.all(
      bedroomCounts.map(async (br) => {
        try {
          const estimate = await getRentalizerEstimate({
            address: `${params.city}, ${params.state}`,
            bedrooms: br,
            bathrooms: Math.max(1, Math.ceil(br * 0.75)),
            accommodates: br * 2 + 2,
          });
          
          if (estimate) {
            return {
              bedrooms: br,
              annualRevenue: estimate.estimates.annual_revenue,
              monthlyRevenue: Math.round(estimate.estimates.annual_revenue / 12),
              adr: estimate.estimates.average_daily_rate,
              occupancy: estimate.estimates.occupancy_rate,
              revenueRange: {
                low: estimate.estimates.annual_revenue_low,
                high: estimate.estimates.annual_revenue_high,
              },
              monthlyForecast: estimate.monthly_forecast || [],
            };
          }
          return null;
        } catch (err) {
          console.error(`[MarketEval] Error getting estimate for ${br}BR:`, err);
          return null;
        }
      })
    );
    revenueData.push(...revenueResults.filter(Boolean));
    
    await db.update(marketEvaluations)
      .set({ revenueData, progress: 30 })
      .where(eq(marketEvaluations.id, evaluationId));
    
    // ============================================================
    // Step 3: Market Trends & Seasonality (35-50%)
    // Historical performance and seasonal patterns
    // ============================================================
    params.onProgress?.('Analyzing market trends & seasonality...', 35);
    await db.update(marketEvaluations)
      .set({ currentStep: 'market_trends', progress: 35 })
      .where(eq(marketEvaluations.id, evaluationId));
    
    let historicalData: any = null;
    let seasonalityData: any = null;
    
    if (marketId) {
      try {
        historicalData = await getMarketHistoricalData(marketId, 24);
      } catch (err) {
        console.error('[MarketEval] Historical data failed:', err);
      }
      
      try {
        seasonalityData = await getMarketSeasonality(marketId);
      } catch (err) {
        console.error('[MarketEval] Seasonality data failed:', err);
      }
    }
    
    // ============================================================
    // Step 4: Competitive Landscape (50-65%)
    // Top performers and market listings
    // ============================================================
    params.onProgress?.('Analyzing competitive landscape...', 50);
    await db.update(marketEvaluations)
      .set({ currentStep: 'competitive_landscape', progress: 50 })
      .where(eq(marketEvaluations.id, evaluationId));
    
    let topPerformers: any[] = [];
    let marketListings: any = null;
    let marketInsights: any = null;
    
    if (marketId) {
      try {
        const topPerformersResult = await getTopPerformers({ marketId, limit: 10, filters: { bedrooms: targetBR } });
        topPerformers = topPerformersResult?.listings || [];
      } catch (err) {
        console.error('[MarketEval] Top performers failed:', err);
      }
      
      try {
        const listingsResult = await getMarketListings(marketId, { limit: 50, filters: { bedrooms: targetBR } });
        if (listingsResult?.listings && listingsResult.listings.length > 0) {
          marketListings = listingsResult.listings.slice(0, 10); // Keep top 10 for display
          marketInsights = calculateMarketInsights(listingsResult.listings);
        }
      } catch (err) {
        console.error('[MarketEval] Market listings failed:', err);
      }
    }
    
    // ============================================================
    // Step 5: Calculate Market Score (65-75%)
    // Comprehensive scoring based on all data
    // ============================================================
    params.onProgress?.('Calculating market score...', 65);
    await db.update(marketEvaluations)
      .set({ currentStep: 'scoring', progress: 65 })
      .where(eq(marketEvaluations.id, evaluationId));
    
    const avgRevenue = revenueData.length > 0
      ? Math.round(revenueData.reduce((sum: number, r: any) => sum + r.annualRevenue, 0) / revenueData.length)
      : 0;
    const avgOccupancy = revenueData.length > 0
      ? revenueData.reduce((sum: number, r: any) => sum + r.occupancy, 0) / revenueData.length
      : 0;
    const avgAdr = revenueData.length > 0
      ? Math.round(revenueData.reduce((sum: number, r: any) => sum + r.adr, 0) / revenueData.length)
      : 0;
    
    // Enhanced scoring with more data points
    let marketScore = 40; // Base score
    
    // Revenue scoring (0-20 pts)
    if (avgRevenue > 80000) marketScore += 20;
    else if (avgRevenue > 60000) marketScore += 16;
    else if (avgRevenue > 40000) marketScore += 12;
    else if (avgRevenue > 25000) marketScore += 8;
    else if (avgRevenue > 15000) marketScore += 4;
    
    // Occupancy scoring (0-15 pts)
    if (avgOccupancy > 0.75) marketScore += 15;
    else if (avgOccupancy > 0.65) marketScore += 12;
    else if (avgOccupancy > 0.55) marketScore += 8;
    else if (avgOccupancy > 0.4) marketScore += 4;
    
    // ADR scoring (0-10 pts)
    if (avgAdr > 250) marketScore += 10;
    else if (avgAdr > 180) marketScore += 8;
    else if (avgAdr > 120) marketScore += 5;
    else if (avgAdr > 80) marketScore += 3;
    
    // Market depth scoring (0-10 pts) - are there enough listings?
    if (marketInsights) {
      if (marketInsights.totalListings > 500) marketScore += 5; // Large market
      else if (marketInsights.totalListings > 100) marketScore += 8; // Good market
      else if (marketInsights.totalListings > 30) marketScore += 10; // Less competition
      else marketScore += 3; // Very small market
    }
    
    // Seasonality bonus (0-5 pts) - less seasonal = more stable
    if (seasonalityData?.months) {
      const occupancies = seasonalityData.months.map((m: any) => m.occupancy || 0).filter((o: number) => o > 0);
      if (occupancies.length > 0) {
        const maxOcc = Math.max(...occupancies);
        const minOcc = Math.min(...occupancies);
        const spread = maxOcc - minOcc;
        if (spread < 0.15) marketScore += 5; // Very stable
        else if (spread < 0.25) marketScore += 3;
        else if (spread < 0.35) marketScore += 1;
      }
    }
    
    marketScore = Math.min(100, Math.max(0, marketScore));
    
    // ============================================================
    // Step 6: AI Investment Memo (75-95%)
    // Comprehensive memo using ALL collected data
    // ============================================================
    params.onProgress?.('Generating AI investment memo...', 75);
    await db.update(marketEvaluations)
      .set({ currentStep: 'ai_memo', progress: 75 })
      .where(eq(marketEvaluations.id, evaluationId));
    
    let aiMemo = '';
    try {
      // Build comprehensive data context for the LLM
      const dataContext = [
        `## Market: ${marketName}`,
        `Market Score: ${marketScore}/100`,
        `Analysis Type: ${params.analysisType ?? 'both'}`,
        '',
        '## Revenue Estimates by Bedroom Count:',
        ...revenueData.map((r: any) => 
          `- **${r.bedrooms}BR**: $${r.annualRevenue.toLocaleString()}/year ($${r.monthlyRevenue.toLocaleString()}/mo), ADR: $${r.adr}, Occupancy: ${Math.round(r.occupancy * 100)}%, Range: $${r.revenueRange.low.toLocaleString()}-$${r.revenueRange.high.toLocaleString()}`
        ),
      ];
      
      if (marketDetails) {
        dataContext.push('', '## Market Overview:');
        if (marketDetails.totalListings) dataContext.push(`- Total active listings: ${marketDetails.totalListings}`);
        if (marketDetails.averageRevenue) dataContext.push(`- Market avg revenue: $${Math.round(marketDetails.averageRevenue).toLocaleString()}`);
        if (marketDetails.averageOccupancy) dataContext.push(`- Market avg occupancy: ${Math.round(marketDetails.averageOccupancy * 100)}%`);
        if (marketDetails.averageDailyRate) dataContext.push(`- Market avg ADR: $${Math.round(marketDetails.averageDailyRate)}`);
      }
      
      if (historicalData?.months?.length) {
        dataContext.push('', '## Historical Trends (last 24 months):');
        const recent = historicalData.months.slice(-6);
        const older = historicalData.months.slice(0, 6);
        const recentAvgRev = recent.reduce((s: number, m: any) => s + (m.revenue || 0), 0) / recent.length;
        const olderAvgRev = older.reduce((s: number, m: any) => s + (m.revenue || 0), 0) / older.length;
        const revTrend = olderAvgRev > 0 ? ((recentAvgRev - olderAvgRev) / olderAvgRev * 100).toFixed(1) : 'N/A';
        dataContext.push(`- Revenue trend: ${revTrend}% change (recent 6mo vs prior 6mo)`);
      }
      
      if (seasonalityData?.months?.length) {
        dataContext.push('', '## Seasonality:');
        const months = seasonalityData.months;
        const bestMonth = months.reduce((best: any, m: any) => (!best || (m.revenue || 0) > (best.revenue || 0)) ? m : best, null);
        const worstMonth = months.reduce((worst: any, m: any) => (!worst || (m.revenue || 0) < (worst.revenue || 0)) ? m : worst, null);
        if (bestMonth) dataContext.push(`- Peak season: ${bestMonth.month || 'N/A'} (Revenue: $${Math.round(bestMonth.revenue || 0).toLocaleString()})`);
        if (worstMonth) dataContext.push(`- Off season: ${worstMonth.month || 'N/A'} (Revenue: $${Math.round(worstMonth.revenue || 0).toLocaleString()})`);
      }
      
      if (topPerformers?.length) {
        dataContext.push('', '## Top Performers (what success looks like):');
        topPerformers.slice(0, 5).forEach((p: any, i: number) => {
          dataContext.push(`${i + 1}. ${p.title || 'Listing'}: $${Math.round(p.annual_revenue || p.revenue || 0).toLocaleString()}/yr, ${p.rating || 'N/A'} stars, ${p.reviews || 0} reviews`);
        });
      }
      
      if (marketInsights) {
        dataContext.push('', '## Market Insights:');
        if (marketInsights.totalListings) dataContext.push(`- Total listings analyzed: ${marketInsights.totalListings}`);
        if (marketInsights.medianRevenue) dataContext.push(`- Median revenue: $${Math.round(marketInsights.medianRevenue).toLocaleString()}`);
        if (marketInsights.medianAdr) dataContext.push(`- Median ADR: $${Math.round(marketInsights.medianAdr)}`);
        if (marketInsights.averageRating) dataContext.push(`- Average rating: ${marketInsights.averageRating.toFixed(1)} stars`);
      }
      
      const memoPrompt = `Write a market evaluation memo for ${params.city}, ${params.state} based on this data:

${dataContext.join('\n')}

Structure the memo EXACTLY as follows:

# ${params.city}, ${params.state} — Market Evaluation

**Market Score: ${marketScore}/100**

---

### The Bottom Line
(2-3 punchy sentences. Would YOU put your money here? Why or why not? Be direct.)

### Revenue Breakdown
(Use a table format showing each bedroom count with monthly revenue, annual revenue, ADR, and occupancy. Bold the "sweet spot" bedroom count — the one with the best revenue-to-effort ratio. Explain WHY that's the sweet spot in 1-2 sentences after the table.)

### Market Health Check
(Cover these in short paragraphs with bold headers:
- **Competition**: How crowded is this market? Total listings, what that means for a newcomer
- **Demand Trends**: Is revenue growing or shrinking? Use the historical data
- **Seasonality**: When's the money season vs. the slow season? How big is the gap?
- **Pricing Power**: What's the ADR telling us about guest willingness to pay?)

### What Winners Do Differently
(Based on top performer data — 3 specific, actionable things that separate the top earners from the average. Use actual numbers from the top performers vs. market averages.)

### Watch Out For
(2-3 honest risk factors. Be specific — don't just say "regulations." Say what kind of regulations and how they'd affect a new host.)

### My Recommendation
(One clear sentence: GO, CONDITIONAL GO, or PASS. Then 2-3 sentences explaining the conditions or reasoning.)

### Your Next 3 Steps
(Exactly 3 numbered, specific action items. Not vague like "do more research" — specific like "Search for 2BR properties under $X/month rent in [specific area] and run the numbers through the calculator.")

Keep it under 900 words. Every claim must reference actual data. Write like you're talking to a friend who's about to invest their savings.`;

      aiMemo = await routedLLMCall(FEATURES.DEAL_ALERT_MEMO, memoPrompt, {
        maxTokens: 4096,
        systemPrompt: `You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist and founder of StayMetrics, managing $100M+ across 400+ properties in 35 U.S. markets. You have 30 years of experience in data science, quantitative analytics, and real estate investment. You operate on the "Generate, Interrogate, Certify" model. Your tone is warm but direct — like a trusted advisor giving real talk over coffee. You never sugarcoat, but you always empower. Use the "story before the stats" approach: lead with a plain-language narrative, then bring in specific numbers.

Rules:
- Use specific dollar amounts and percentages from the data provided — never make up numbers
- Frame everything as "here's what this means for YOUR bottom line"
- When data shows a strong market, be enthusiastic but grounded
- When data shows a weak market, be honest and redirect to better options
- Use markdown formatting with bold for key numbers
- Reference the actual data points (revenue, occupancy, ADR) to support every claim
- Write for someone evaluating their FIRST short-term rental market — no jargon without explanation`,
      });
      
      if (!aiMemo) aiMemo = 'Unable to generate memo.';
    } catch (err) {
      console.error('[MarketEval] AI memo generation failed:', err);
      aiMemo = `# Market Evaluation: ${params.city}, ${params.state}\n\n## Market Score: ${marketScore}/100\n\n### Revenue Summary\n${revenueData.map((r: any) => `- **${r.bedrooms}BR**: $${r.annualRevenue.toLocaleString()}/year, ADR: $${r.adr}, Occupancy: ${Math.round(r.occupancy * 100)}%`).join('\n')}\n\n*AI memo generation encountered an error. The data above is from Coach Inayah market analysis.*`;
    }
    
    // ============================================================
    // Step 7: Complete (100%)
    // ============================================================
    params.onProgress?.('Evaluation complete!', 100);
    
    await db.update(marketEvaluations)
      .set({
        status: 'completed',
        currentStep: 'complete',
        progress: 100,
        aiMemo,
        marketScore,
        marketId: marketId,
        marketName: marketName,
        averageRevenue: avgRevenue,
        averageOccupancy: avgOccupancy.toString(),
        averageAdr: avgAdr,
        revenueData,
        marketOverviewData: marketDetails ? { details: marketDetails, historical: historicalData, seasonality: seasonalityData } : null,
        compsData: marketInsights ? { insights: marketInsights, listings: marketListings } : null,
        topPropertiesData: topPerformers.length > 0 ? topPerformers.slice(0, 10) : null,
        completedAt: new Date(),
      })
      .where(eq(marketEvaluations.id, evaluationId));
    
    return {
      evaluationId,
      marketScore,
      summary: aiMemo,
    };
    
  } catch (err) {
    // Mark as failed
    await db.update(marketEvaluations)
      .set({
        status: 'failed',
        errorMessage: String(err),
      })
      .where(eq(marketEvaluations.id, evaluationId));
    
    throw err;
  }
}

/**
 * Starts a market evaluation asynchronously.
 * Creates the DB record and returns the evaluationId immediately,
 * then runs the full evaluation in the background.
 * The frontend polls via getEvaluation to track progress.
 */
export async function startMarketEvaluation(params: {
  city: string;
  state: string;
  analysisType?: 'arbitrage' | 'investment' | 'both';
  bedrooms?: number;
  sessionId?: string;
  userId?: number;
  email?: string;
}): Promise<{ evaluationId: number }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const { marketEvaluations } = await import('../drizzle/schema');
  
  // Create evaluation record immediately
  const [insertResult] = await db.insert(marketEvaluations).values({
    city: params.city,
    state: params.state,
    analysisType: params.analysisType ?? 'both',
    bedrooms: params.bedrooms ?? 3,
    sessionId: params.sessionId,
    userId: params.userId,
    email: params.email,
    status: 'pending',
    startedAt: new Date(),
    currentStep: 'market_overview',
    progress: 0,
  }) as any;
  
  const evaluationId = Number(insertResult?.insertId ?? insertResult);
  
  // Run the full evaluation in the background (fire-and-forget)
  // The frontend will poll via getEvaluation to track progress
  runMarketEvaluation({
    ...params,
    _evaluationId: evaluationId,
  }).catch(err => {
    console.error(`[MarketEval] Background evaluation ${evaluationId} failed:`, err);
  });
  
  return { evaluationId };
}
