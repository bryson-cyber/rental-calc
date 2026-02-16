/**
 * Newsletter Deal Finder Service
 * 
 * Automatically scans for rental arbitrage opportunities in target markets.
 * Uses AirDNA Rentalizer API to project revenue for rental listings.
 * 
 * This is the "Step 5" logic adapted for autonomous newsletter operation.
 */

import { getRentalizerEstimate, type RentalizerResponse } from './airdna';
import { getMarketSnapshotForCity, type MarketSnapshot } from './newsletter-market-data';

export interface RentalDeal {
  // Property info
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;
  propertyType: string;
  
  // Source info
  sourceUrl: string;
  sourcePlatform: 'zillow' | 'apartments' | 'trulia' | 'realtor' | 'manual';
  imageUrl?: string;
  
  // AirDNA projections
  projectedAnnualRevenue: number;
  projectedMonthlyRevenue: number;
  projectedAdr: number;
  projectedOccupancy: number;
  
  // Profitability
  monthlyProfit: number;
  annualProfit: number;
  profitMargin: number; // As decimal (0.25 = 25%)
  breakEvenOccupancy: number;
  
  // Deal scoring
  dealScore: number; // 1-100
  dealGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  
  // Comparable properties
  topComps: Array<{
    title: string;
    bedrooms: number;
    annualRevenue: number;
    occupancy: number;
    adr: number;
    rating: number | null;
    reviews: number;
    airbnbUrl?: string;
  }>;
  
  // Metadata
  analyzedAt: Date;
}

export interface DealScanResult {
  city: string;
  state: string;
  dealsFound: number;
  deals: RentalDeal[];
  marketSnapshot?: MarketSnapshot;
  scannedAt: Date;
  errors: string[];
}

/**
 * Analyze a single property for arbitrage potential
 */
export async function analyzePropertyForArbitrage(params: {
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;
  propertyType?: string;
  sourceUrl?: string;
  sourcePlatform?: RentalDeal['sourcePlatform'];
  imageUrl?: string;
}): Promise<RentalDeal | null> {
  try {
    console.log(`[DealFinder] Analyzing: ${params.address}`);
    
    // Get AirDNA estimate
    const estimate = await getRentalizerEstimate({
      address: params.address,
      bedrooms: params.bedrooms,
      bathrooms: params.bathrooms,
      accommodates: params.bedrooms * 2 + 2 // Estimate: 2 guests per bedroom + 2
    });
    
    if (!estimate) {
      console.log(`[DealFinder] No estimate available for ${params.address}`);
      return null;
    }
    
    // Calculate profitability
    const monthlyRevenue = estimate.estimates.annual_revenue / 12;
    const operatingCosts = monthlyRevenue * 0.20;
    const monthlyProfit = monthlyRevenue - params.monthlyRent - operatingCosts;
    const annualProfit = monthlyProfit * 12;
    const profitMargin = monthlyProfit / monthlyRevenue;
    
    // Calculate break-even occupancy
    // Break-even = (Monthly Rent) / (ADR * 30)
    const breakEvenOccupancy = params.monthlyRent / (estimate.estimates.average_daily_rate * 30);
    
    // Calculate deal score (1-100)
    const dealScore = calculateDealScore({
      profitMargin,
      monthlyProfit,
      occupancy: estimate.estimates.occupancy_rate,
      breakEvenOccupancy,
      marketScore: 70 // Default, would need market data
    });
    
    // Determine deal grade
    const dealGrade = getDealGrade(dealScore);
    
    // Extract top comps
    const topComps = (estimate.comps || []).slice(0, 5).map(comp => ({
      title: comp.title,
      bedrooms: comp.bedrooms,
      annualRevenue: comp.annual_revenue,
      occupancy: comp.occupancy,
      adr: comp.adr,
      rating: comp.rating,
      reviews: comp.reviews,
      airbnbUrl: comp.airbnb_url
    }));
    
    const deal: RentalDeal = {
      address: params.address,
      city: params.city,
      state: params.state,
      zipCode: params.zipCode || estimate.property.zipcode || '',
      bedrooms: params.bedrooms,
      bathrooms: params.bathrooms,
      monthlyRent: params.monthlyRent,
      propertyType: params.propertyType || 'Unknown',
      
      sourceUrl: params.sourceUrl || '',
      sourcePlatform: params.sourcePlatform || 'manual',
      imageUrl: params.imageUrl,
      
      projectedAnnualRevenue: estimate.estimates.annual_revenue,
      projectedMonthlyRevenue: monthlyRevenue,
      projectedAdr: estimate.estimates.average_daily_rate,
      projectedOccupancy: estimate.estimates.occupancy_rate,
      
      monthlyProfit,
      annualProfit,
      profitMargin,
      breakEvenOccupancy,
      
      dealScore,
      dealGrade,
      
      topComps,
      
      analyzedAt: new Date()
    };
    
    return deal;
  } catch (error) {
    console.error(`[DealFinder] Error analyzing ${params.address}:`, error);
    return null;
  }
}

/**
 * Calculate deal score based on multiple factors
 */
function calculateDealScore(params: {
  profitMargin: number;
  monthlyProfit: number;
  occupancy: number;
  breakEvenOccupancy: number;
  marketScore: number;
}): number {
  let score = 0;
  
  // Profit margin (0-30 points)
  // 30%+ margin = 30 points, 0% = 0 points
  score += Math.min(30, Math.max(0, params.profitMargin * 100));
  
  // Monthly profit amount (0-25 points)
  // $2000+ = 25 points, $0 = 0 points
  score += Math.min(25, Math.max(0, params.monthlyProfit / 80));
  
  // Occupancy cushion (0-25 points)
  // How much higher is projected occupancy vs break-even?
  const occupancyCushion = params.occupancy - params.breakEvenOccupancy;
  score += Math.min(25, Math.max(0, occupancyCushion * 100));
  
  // Market score (0-20 points)
  score += Math.min(20, params.marketScore / 5);
  
  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Convert deal score to letter grade
 */
function getDealGrade(score: number): RentalDeal['dealGrade'] {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

/**
 * Scan a market for deals using sample rental listings
 * In production, this would integrate with Zillow/Apartments.com APIs or scraping
 */
export async function scanMarketForDeals(params: {
  city: string;
  state: string;
  sampleListings?: Array<{
    address: string;
    bedrooms: number;
    bathrooms: number;
    monthlyRent: number;
    propertyType?: string;
    sourceUrl?: string;
    imageUrl?: string;
  }>;
  minProfitMargin?: number; // Minimum profit margin to include (default 0.15 = 15%)
  maxDeals?: number; // Maximum deals to return (default 10)
}): Promise<DealScanResult> {
  const result: DealScanResult = {
    city: params.city,
    state: params.state,
    dealsFound: 0,
    deals: [],
    scannedAt: new Date(),
    errors: []
  };
  
  try {
    // Get market snapshot for context
    result.marketSnapshot = await getMarketSnapshotForCity(params.city, params.state) || undefined;
    
    // If no sample listings provided, we can't scan
    // In production, this would fetch from rental listing APIs
    if (!params.sampleListings || params.sampleListings.length === 0) {
      console.log(`[DealFinder] No sample listings provided for ${params.city}, ${params.state}`);
      return result;
    }
    
    const minMargin = params.minProfitMargin ?? 0.15;
    const maxDeals = params.maxDeals ?? 10;
    
    // Analyze each listing
    for (const listing of params.sampleListings) {
      try {
        const deal = await analyzePropertyForArbitrage({
          address: listing.address,
          city: params.city,
          state: params.state,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          monthlyRent: listing.monthlyRent,
          propertyType: listing.propertyType,
          sourceUrl: listing.sourceUrl,
          imageUrl: listing.imageUrl,
          sourcePlatform: 'zillow'
        });
        
        if (deal && deal.profitMargin >= minMargin) {
          result.deals.push(deal);
        }
        
        // Stop if we have enough deals
        if (result.deals.length >= maxDeals) {
          break;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        result.errors.push(`Error analyzing ${listing.address}: ${error}`);
      }
    }
    
    // Sort deals by score (best first)
    result.deals.sort((a, b) => b.dealScore - a.dealScore);
    result.dealsFound = result.deals.length;
    
    console.log(`[DealFinder] Found ${result.dealsFound} deals in ${params.city}, ${params.state}`);
    return result;
  } catch (error) {
    console.error(`[DealFinder] Error scanning ${params.city}, ${params.state}:`, error);
    result.errors.push(`Market scan error: ${error}`);
    return result;
  }
}

/**
 * Format a deal for email content
 */
export function formatDealForEmail(deal: RentalDeal): string {
  const formatCurrency = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const formatPercent = (n: number) => `${Math.round(n * 100)}%`;
  
  return `
[Grade ${deal.dealGrade}] DEAL ALERT: ${deal.city}, ${deal.state}

${deal.address}
${deal.bedrooms} BR / ${deal.bathrooms} BA

Monthly Rent: ${formatCurrency(deal.monthlyRent)}
Projected Revenue: ${formatCurrency(deal.projectedMonthlyRevenue)}/mo
Projected Profit: ${formatCurrency(deal.monthlyProfit)}/mo

Key Metrics:
- Occupancy: ${formatPercent(deal.projectedOccupancy)}
- ADR: ${formatCurrency(deal.projectedAdr)}
- Profit Margin: ${formatPercent(deal.profitMargin)}
- Deal Score: ${deal.dealScore}/100 (Grade ${deal.dealGrade})

${deal.sourceUrl ? `View Listing: ${deal.sourceUrl}` : ''}
  `.trim();
}

/**
 * Filter deals by quality threshold
 */
export function filterDealsForNewsletter(
  deals: RentalDeal[],
  options?: {
    minScore?: number;
    minGrade?: RentalDeal['dealGrade'];
    minProfit?: number;
    maxDeals?: number;
  }
): RentalDeal[] {
  const minScore = options?.minScore ?? 50;
  const minGrade = options?.minGrade ?? 'C';
  const minProfit = options?.minProfit ?? 500;
  const maxDeals = options?.maxDeals ?? 5;
  
  const gradeOrder = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1 };
  const minGradeValue = gradeOrder[minGrade];
  
  return deals
    .filter(deal => 
      deal.dealScore >= minScore &&
      gradeOrder[deal.dealGrade] >= minGradeValue &&
      deal.monthlyProfit >= minProfit
    )
    .slice(0, maxDeals);
}
