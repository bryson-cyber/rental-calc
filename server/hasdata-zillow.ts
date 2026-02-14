/**
 * HasData Zillow Property API Integration
 * 
 * This module provides functionality to extract property details from Zillow URLs
 * using the HasData Zillow Property scraper API.
 * 
 * API Documentation: https://docs.hasdata.com/zillow-property
 * Cost: 5 credits per request
 */

import { ENV } from "./_core/env";

// Types for Zillow property data
export interface ZillowPropertyData {
  address: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  bedrooms: number | null;
  bathrooms: number | null;
  price: number | null;
  priceType: 'sale' | 'rent' | 'unknown';
  livingArea?: number;
  lotSize?: number;
  yearBuilt?: number;
  propertyType?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  zpid?: string;
  homeStatus?: string;
  imageUrl?: string;
  rawResponse?: unknown;
}

export interface HasDataResponse {
  success: boolean;
  data?: ZillowPropertyData;
  error?: string;
  creditsUsed?: number;
}

/**
 * Validates if a URL is a valid Zillow property URL
 */
export function isZillowUrl(url: string): boolean {
  if (!url) return false;
  
  const zillowPatterns = [
    /^https?:\/\/(www\.)?zillow\.com\/homedetails\//i,
    /^https?:\/\/(www\.)?zillow\.com\/homes\//i,
    /^https?:\/\/(www\.)?zillow\.com\/b\//i,
    /^https?:\/\/(www\.)?zillow\.com\/[^/]+\/[^/]+_zpid/i,
  ];
  
  return zillowPatterns.some(pattern => pattern.test(url));
}

/**
 * Extracts ZPID from a Zillow URL if present
 */
export function extractZpid(url: string): string | null {
  const zpidMatch = url.match(/(\d+)_zpid/i);
  return zpidMatch ? zpidMatch[1] : null;
}

/**
 * Fetches property details from a Zillow URL using HasData API
 */
export async function getZillowPropertyDetails(zillowUrl: string): Promise<HasDataResponse> {
  const apiKey = ENV.hasdataApiKey;
  
  if (!apiKey) {
    console.error("[HasData] API key not configured");
    return {
      success: false,
      error: "HasData API key not configured"
    };
  }
  
  if (!isZillowUrl(zillowUrl)) {
    return {
      success: false,
      error: "Invalid Zillow URL format"
    };
  }
  
  try {
    console.log(`[HasData] Fetching property details for: ${zillowUrl}`);
    
    // HasData Zillow Property API endpoint - uses GET with URL parameter
    const apiUrl = `https://api.hasdata.com/scrape/zillow/property?url=${encodeURIComponent(zillowUrl)}`;
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HasData] API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `API error: ${response.status}`
      };
    }
    
    const rawData = await response.json();
    console.log("[HasData] Raw response:", JSON.stringify(rawData, null, 2));
    
    // Parse the response based on HasData's Zillow Property API format
    const propertyData = parseHasDataResponse(rawData);
    
    return {
      success: true,
      data: propertyData,
      creditsUsed: 5
    };
    
  } catch (error) {
    console.error("[HasData] Error fetching property details:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

/**
 * Parses the HasData API response into our standardized format
 */
function parseHasDataResponse(rawData: Record<string, unknown>): ZillowPropertyData {
  // HasData returns the property data in a 'property' key (not 'data')
  const data = (rawData.property || rawData.data || rawData) as Record<string, unknown>;
  
  // Address can be nested in an 'address' object or flat
  const addressObj = data.address as Record<string, unknown> | string | undefined;
  let streetAddress = "";
  let city = "";
  let state = "";
  let zipcode = "";
  
  if (typeof addressObj === 'object' && addressObj !== null) {
    // Address is nested: { street: '...', city: '...', state: '...', zipcode: '...' }
    streetAddress = (addressObj.street as string) || (addressObj.streetAddress as string) || "";
    city = (addressObj.city as string) || "";
    state = (addressObj.state as string) || "";
    zipcode = (addressObj.zipcode as string) || (addressObj.zip as string) || "";
  } else {
    // Address is flat or a string
    streetAddress = (data.streetAddress as string) || (addressObj as string) || (data.addressRaw as string) || "";
    city = (data.city as string) || "";
    state = (data.state as string) || "";
    zipcode = (data.zipcode as string) || (data.zip as string) || "";
  }
  
  let fullAddress = streetAddress;
  if (city) fullAddress += `, ${city}`;
  if (state) fullAddress += `, ${state}`;
  if (zipcode) fullAddress += ` ${zipcode}`;
  
  // Determine price type (sale vs rent)
  // HasData returns status like "FOR_RENT", "FOR_SALE", etc.
  const homeStatus = (data.homeStatus as string || data.status as string || "").toLowerCase();
  const listingType = (data.listingType as string || data.listing_type as string || "").toLowerCase();
  
  let priceType: 'sale' | 'rent' | 'unknown' = 'unknown';
  if (homeStatus.includes('rent') || listingType.includes('rent') || homeStatus === 'for_rent') {
    priceType = 'rent';
  } else if (homeStatus.includes('sale') || listingType.includes('sale') || homeStatus.includes('sold') || homeStatus === 'for_sale') {
    priceType = 'sale';
  }
  
  // Extract price - could be sale price or rent price
  let price: number | null = null;
  const rawPrice = data.price || data.rentZestimate || data.zestimate;
  if (typeof rawPrice === 'number') {
    price = rawPrice;
  } else if (typeof rawPrice === 'string') {
    // Remove $ and commas, then parse
    const cleanPrice = rawPrice.replace(/[$,]/g, '');
    price = parseFloat(cleanPrice) || null;
  }
  
  // Extract bedrooms
  let bedrooms: number | null = null;
  const rawBedrooms = data.bedrooms || data.beds || data.bedroom;
  if (typeof rawBedrooms === 'number') {
    bedrooms = rawBedrooms;
  } else if (typeof rawBedrooms === 'string') {
    bedrooms = parseInt(rawBedrooms, 10) || null;
  }
  
  // Extract bathrooms
  // Note: HasData API sometimes rounds half-baths (2.5 -> 3), so we check description for accurate count
  let bathrooms: number | null = null;
  const rawBathrooms = data.bathrooms || data.baths || data.bathroom;
  if (typeof rawBathrooms === 'number') {
    bathrooms = rawBathrooms;
  } else if (typeof rawBathrooms === 'string') {
    bathrooms = parseFloat(rawBathrooms) || null;
  }
  
  // Try to extract more accurate bathroom count from description (e.g., "2.5 Bath" or "2.5 bathroom")
  const description = (data.description as string) || "";
  const bathDescMatch = description.match(/(\d+(?:\.5)?)\s*(?:bath|bathroom|ba)/i);
  if (bathDescMatch) {
    const descBaths = parseFloat(bathDescMatch[1]);
    // Use description value if it has a half-bath (.5) and API value is rounded
    if (!isNaN(descBaths) && descBaths % 1 === 0.5 && bathrooms !== null && Math.round(descBaths) === bathrooms) {
      bathrooms = descBaths;
    }
  }
  
  // Extract living area
  let livingArea: number | undefined;
  const rawLivingArea = data.livingArea || data.livingAreaSqFt || data.sqft || data.squareFeet;
  if (typeof rawLivingArea === 'number') {
    livingArea = rawLivingArea;
  } else if (typeof rawLivingArea === 'string') {
    livingArea = parseFloat(rawLivingArea.replace(/,/g, '')) || undefined;
  }
  
  return {
    address: fullAddress || "Address not available",
    streetAddress,
    city,
    state,
    zipcode,
    bedrooms,
    bathrooms,
    price,
    priceType,
    livingArea,
    lotSize: typeof data.lotSize === 'number' ? data.lotSize : undefined,
    yearBuilt: typeof data.yearBuilt === 'number' ? data.yearBuilt : undefined,
    propertyType: data.propertyType as string || data.homeType as string || undefined,
    description: data.description as string || undefined,
    latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
    longitude: typeof data.longitude === 'number' ? data.longitude : undefined,
    zpid: data.zpid as string || extractZpid(data.url as string || "") || undefined,
    homeStatus: data.homeStatus as string || data.status as string || undefined,
    imageUrl: data.imgSrc as string || data.image as string || data.primaryImage as string || undefined,
    rawResponse: rawData
  };
}

/**
 * Batch fetch multiple Zillow properties (for Step 4 comparison)
 * Note: Each property costs 5 credits
 */
export async function getMultipleZillowProperties(
  zillowUrls: string[]
): Promise<{ results: HasDataResponse[]; totalCreditsUsed: number }> {
  const results: HasDataResponse[] = [];
  let totalCreditsUsed = 0;
  
  // Process sequentially to avoid rate limiting
  for (const url of zillowUrls) {
    const result = await getZillowPropertyDetails(url);
    results.push(result);
    if (result.creditsUsed) {
      totalCreditsUsed += result.creditsUsed;
    }
    
    // Small delay between requests to be respectful of rate limits
    if (zillowUrls.indexOf(url) < zillowUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return { results, totalCreditsUsed };
}


// ============================================
// NEWSLETTER DEAL CACHING FUNCTIONS
// ============================================

import { getDb } from './db';
import { newsletterDeals } from '../drizzle/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export interface ZillowListing {
  zpid: string;
  address: string;
  streetAddress: string;
  city: string;
  state: string;
  zipcode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  livingArea: number;
  homeType: string;
  latitude: number;
  longitude: number;
  imgSrc: string;
  detailUrl: string;
  statusText: string;
  daysOnZillow: number;
}

export interface ZillowListingResponse {
  success: boolean;
  listings: ZillowListing[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

/**
 * Search Zillow for rental listings in a city.
 *
 * Two-step approach because the Listing API does NOT return price/beds:
 *   1. Listing API  → `data.properties[]` with URLs + addresses (no price/beds)
 *   2. Property API → `property.listings[]` sub-array with price, beds, baths
 *
 * Credit budget per scan: 5 (listing) + maxEnrich×5 (property) ≈ 65–85 credits.
 */
export async function searchZillowRentals(params: {
  city: string;
  state: string;
  minBeds?: number;
  maxBeds?: number;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  /** Max properties to enrich via Property API (default 12, 5 credits each) */
  maxEnrich?: number;
}): Promise<ZillowListingResponse> {
  const apiKey = ENV.hasdataApiKey;

  if (!apiKey) {
    console.warn('[HasData] API key not configured');
    return { success: false, listings: [], totalCount: 0, currentPage: 1, totalPages: 0 };
  }

  const searchParams = new URLSearchParams({
    keyword: `${params.city}, ${params.state}`,
    type: 'forRent',
  });

  if (params.minBeds) searchParams.append('beds[min]', params.minBeds.toString());
  if (params.maxBeds) searchParams.append('beds[max]', params.maxBeds.toString());
  if (params.minPrice) searchParams.append('price[min]', params.minPrice.toString());
  if (params.maxPrice) searchParams.append('price[max]', params.maxPrice.toString());
  if (params.page) searchParams.append('page', params.page.toString());

  try {
    console.log(`[HasData] Step 1: Listing API for ${params.city}, ${params.state}...`);

    const response = await fetch(
      `https://api.hasdata.com/scrape/zillow/listing?${searchParams}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error('[HasData] Listing API error:', response.status, await response.text());
      return { success: false, listings: [], totalCount: 0, currentPage: 1, totalPages: 0 };
    }

    const data = await response.json();

    // HasData returns `properties` (NOT `listings` or `results`)
    const rawProperties: any[] = data.properties || data.listings || data.results || [];

    if (rawProperties.length === 0) {
      console.log('[HasData] No properties returned from Listing API');
      return { success: false, listings: [], totalCount: 0, currentPage: 1, totalPages: 0 };
    }

    const maxEnrich = params.maxEnrich ?? 12;
    const propertiesToEnrich = rawProperties
      .filter((p: any) => p.url && (p.status === 'FOR_RENT' || !p.status))
      .slice(0, maxEnrich);

    console.log(
      `[HasData] Step 1 found ${rawProperties.length} properties. Enriching top ${propertiesToEnrich.length}...`
    );

    // Step 2: Enrich each property with price/beds/baths via Property API
    const allListings: ZillowListing[] = [];

    for (const prop of propertiesToEnrich) {
      try {
        const enriched = await enrichPropertyWithDetails(
          prop,
          apiKey,
          params.city,
          params.state
        );
        allListings.push(...enriched);

        // Small delay between Property API calls
        if (propertiesToEnrich.indexOf(prop) < propertiesToEnrich.length - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch (err) {
        console.warn(`[HasData] Failed to enrich ${prop.url}:`, err);
        // Fallback: create a basic listing from Listing API data
        const addr = prop.address || {};
        allListings.push({
          zpid: prop.id || '',
          address:
            prop.addressRaw ||
            `${addr.street || ''}, ${addr.city || params.city}, ${addr.state || params.state} ${addr.zipcode || ''}`,
          streetAddress: addr.street || '',
          city: addr.city || params.city,
          state: addr.state || params.state,
          zipcode: addr.zipcode || '',
          price: 0,
          bedrooms: 0,
          bathrooms: 0,
          livingArea: 0,
          homeType: prop.homeType || '',
          latitude: prop.latitude || 0,
          longitude: prop.longitude || 0,
          imgSrc: prop.image || '',
          detailUrl: prop.url || '',
          statusText: prop.status || 'FOR_RENT',
          daysOnZillow: 0,
        });
      }
    }

    const withPrice = allListings.filter((l) => l.price > 0);
    console.log(
      `[HasData] Step 2 complete: ${allListings.length} listings total, ${withPrice.length} with price`
    );

    const pagination = data.pagination || {};

    return {
      success: true,
      listings: allListings,
      totalCount: pagination.totalCount || data.totalCount || rawProperties.length,
      currentPage: pagination.currentPage || params.page || 1,
      totalPages:
        pagination.totalPages ||
        Math.ceil((pagination.totalCount || rawProperties.length) / 40),
    };
  } catch (error) {
    console.error('[HasData] Listing request failed:', error);
    return { success: false, listings: [], totalCount: 0, currentPage: 1, totalPages: 0 };
  }
}

/**
 * Enrich a single property from the Listing API with full details from the Property API.
 *
 * The Property API returns a `listings` sub-array for multi-unit buildings,
 * each with price, beds, baths, and area. We flatten these into ZillowListing objects.
 */
async function enrichPropertyWithDetails(
  prop: any,
  apiKey: string,
  fallbackCity: string,
  fallbackState: string
): Promise<ZillowListing[]> {
  const propUrl = prop.url;
  if (!propUrl) return [];

  const response = await fetch(
    `https://api.hasdata.com/scrape/zillow/property?url=${encodeURIComponent(propUrl)}`,
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    }
  );

  if (!response.ok) {
    console.warn(`[HasData] Property API error for ${propUrl}: ${response.status}`);
    return [];
  }

  const data = await response.json();
  const property = data.property || data.data || data;
  const addr = property.address || prop.address || {};
  const city = addr.city || fallbackCity;
  const state = addr.state || fallbackState;
  const zipcode = addr.zipcode || '';
  const streetBase = addr.street || '';
  const parentImage = property.image || prop.image || '';

  // Multi-unit buildings have a `listings` sub-array
  const subListings: any[] = property.listings || [];
  const forRentListings = subListings.filter((l: any) => l.status === 'FOR_RENT');

  if (forRentListings.length > 0) {
    return forRentListings.map((unit: any) => ({
      zpid: unit.id || property.id || '',
      address: `${streetBase}, ${city}, ${state} ${zipcode}`.trim(),
      streetAddress: streetBase,
      city,
      state,
      zipcode,
      price: unit.price || 0,
      bedrooms: unit.beds || 0,
      bathrooms: unit.baths || 0,
      livingArea: unit.area || 0,
      homeType: property.homeType || '',
      latitude: property.latitude || prop.latitude || 0,
      longitude: property.longitude || prop.longitude || 0,
      imgSrc: unit.image || parentImage,
      detailUrl: unit.url || propUrl,
      statusText: unit.status || 'FOR_RENT',
      daysOnZillow: 0,
    }));
  }

  // Single-unit property
  const price = property.price || property.rentZestimate || 0;
  const beds = property.bedrooms || property.beds || 0;
  const baths = property.bathrooms || property.baths || 0;
  const area = property.livingArea || property.area || 0;

  return [
    {
      zpid: property.id || property.zpid || prop.id || '',
      address:
        property.addressRaw ||
        `${streetBase}, ${city}, ${state} ${zipcode}`.trim(),
      streetAddress: streetBase,
      city,
      state,
      zipcode,
      price,
      bedrooms: beds,
      bathrooms: baths,
      livingArea: area,
      homeType: property.homeType || '',
      latitude: property.latitude || prop.latitude || 0,
      longitude: property.longitude || prop.longitude || 0,
      imgSrc: parentImage,
      detailUrl: property.url || propUrl,
      statusText: property.status || 'FOR_RENT',
      daysOnZillow: 0,
    },
  ];
}

/**
 * Cache a deal in the database for newsletter alerts
 */
export async function cacheDeal(deal: {
  city: string;
  state: string;
  address: string;
  zillowUrl: string;
  zillowId: string;
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;
  estimatedRevenue: number;
  dealScore: number;
  imageUrl?: string;
  propertyType?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Check if deal already exists by sourceUrl
  const existing = await db
    .select()
    .from(newsletterDeals)
    .where(eq(newsletterDeals.sourceUrl, deal.zillowUrl))
    .limit(1);

  if (existing.length > 0) {
    // Update existing deal
    await db
      .update(newsletterDeals)
      .set({
        dealScore: deal.dealScore,
        projectedRevenue: deal.estimatedRevenue,
        monthlyRent: deal.monthlyRent,
      })
      .where(eq(newsletterDeals.sourceUrl, deal.zillowUrl));
  } else {
    // Insert new deal
    await db.insert(newsletterDeals).values({
      cityId: 0, // Will be updated when we have city tracking
      city: deal.city,
      state: deal.state,
      address: deal.address,
      sourceUrl: deal.zillowUrl,
      sourcePlatform: 'zillow',
      bedrooms: deal.bedrooms,
      bathrooms: String(deal.bathrooms),
      monthlyRent: deal.monthlyRent,
      projectedRevenue: deal.estimatedRevenue,
      dealScore: deal.dealScore,
      imageUrl: deal.imageUrl,
      propertyType: deal.propertyType,
      status: 'active',
    });
  }
}

/**
 * Get cached deals for a city (for newsletter alerts)
 */
export async function getCachedDeals(params: {
  city: string;
  state: string;
  minScore?: number;
  limit?: number;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const deals = await db
    .select()
    .from(newsletterDeals)
    .where(
      and(
        eq(newsletterDeals.city, params.city),
        eq(newsletterDeals.state, params.state),
        eq(newsletterDeals.status, 'active'),
        gte(newsletterDeals.discoveredAt, oneDayAgo),
        params.minScore ? gte(newsletterDeals.dealScore, params.minScore) : undefined
      )
    )
    .orderBy(sql`${newsletterDeals.dealScore} DESC`)
    .limit(params.limit || 10);

  return deals;
}

/**
 * Mark a deal as sent (so we don't send it again)
 */
export async function markDealAsSent(zillowId: string): Promise<void> {
  const db = await getDb();
  
  if (!db) return;
  
  await db
    .update(newsletterDeals)
    .set({
      status: 'sent',
      sentAt: new Date(),
    })
    .where(eq(newsletterDeals.sourceUrl, `https://www.zillow.com/homedetails/${zillowId}_zpid/`));
}

/**
 * Scan a city for rental deals and cache them
 * This is the main function called by the daily deal scan job
 */
export async function scanCityForDeals(params: {
  city: string;
  state: string;
  getRevenueEstimate: (address: string, bedrooms: number, bathrooms: number) => Promise<{ monthlyRevenue: number } | null>;
}): Promise<{ scanned: number; cached: number; errors: number }> {
  console.log(`[HasData] Scanning ${params.city}, ${params.state} for deals...`);
  
  const stats = { scanned: 0, cached: 0, errors: 0 };
  
  // Search for rentals in the city
  const searchResult = await searchZillowRentals({
    city: params.city,
    state: params.state,
    minBeds: 1,
    maxBeds: 5,
  });

  if (!searchResult.success || searchResult.listings.length === 0) {
    console.log(`[HasData] No listings found for ${params.city}, ${params.state}`);
    return stats;
  }

  // Filter out listings without price or bedroom data (enrichment failed)
  const enrichedListings = searchResult.listings.filter(
    (l) => l.price > 0 && l.bedrooms > 0
  );
  console.log(
    `[HasData] Processing ${enrichedListings.length} enriched listings (${searchResult.listings.length - enrichedListings.length} skipped — missing price/beds)...`
  );

  // Process each enriched listing
  for (const listing of enrichedListings) {
    stats.scanned++;
    
    try {
      // Get revenue estimate from AirDNA
      const estimate = await params.getRevenueEstimate(
        listing.address,
        listing.bedrooms,
        listing.bathrooms
      );

      if (!estimate) {
        stats.errors++;
        continue;
      }

      // Calculate deal score
      const monthlyRent = listing.price;
      const monthlyRevenue = estimate.monthlyRevenue;
      const profitMargin = monthlyRent > 0 ? (monthlyRevenue - monthlyRent) / monthlyRent : 0;
      
      // Deal score: 0-100 based on profit margin
      // 50% margin = 100 score, 0% margin = 50 score, negative = below 50
      const dealScore = Math.min(100, Math.max(0, 50 + (profitMargin * 100)));

      // Only cache deals with score >= 60 (at least 10% profit margin)
      if (dealScore >= 60) {
        await cacheDeal({
          city: listing.city,
          state: listing.state,
          address: listing.address,
          zillowUrl: listing.detailUrl,
          zillowId: listing.zpid,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          monthlyRent,
          estimatedRevenue: monthlyRevenue,
          dealScore: Math.round(dealScore),
          imageUrl: listing.imgSrc,
          propertyType: listing.homeType,
        });
        stats.cached++;
        console.log(`[HasData] Cached deal: ${listing.address} (score: ${Math.round(dealScore)})`);
      }
    } catch (error) {
      console.error(`[HasData] Error processing listing ${listing.zpid}:`, error);
      stats.errors++;
    }
  }

  console.log(`[HasData] Scan complete: ${stats.scanned} scanned, ${stats.cached} cached, ${stats.errors} errors`);
  return stats;
}
