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
  let bathrooms: number | null = null;
  const rawBathrooms = data.bathrooms || data.baths || data.bathroom;
  if (typeof rawBathrooms === 'number') {
    bathrooms = rawBathrooms;
  } else if (typeof rawBathrooms === 'string') {
    bathrooms = parseFloat(rawBathrooms) || null;
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
