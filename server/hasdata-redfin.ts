/**
 * HasData Redfin Property API Integration
 * 
 * This module provides functionality to extract property details from Redfin URLs
 * using the HasData Redfin Property scraper API.
 * 
 * API Documentation: https://hasdata.com/apis/redfin-api
 * Cost: ~5 credits per request
 */

import { ENV } from "./_core/env";

// Types for Redfin property data (matching Zillow structure for consistency)
export interface RedfinPropertyData {
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
  propertyId?: string;
  homeStatus?: string;
  imageUrl?: string;
  rawResponse?: unknown;
}

export interface HasDataRedfinResponse {
  success: boolean;
  data?: RedfinPropertyData;
  error?: string;
  creditsUsed?: number;
}

/**
 * Validates if a URL is a valid Redfin property URL
 */
export function isRedfinUrl(url: string): boolean {
  if (!url) return false;
  
  const redfinPatterns = [
    /^https?:\/\/(www\.)?redfin\.com\/[A-Z]{2}\/[^/]+\/[^/]+\/home\/\d+/i,
    /^https?:\/\/(www\.)?redfin\.com\/[A-Z]{2}\/[^/]+\/[^/]+\/unit-[^/]+\/home\/\d+/i,
    /^https?:\/\/(www\.)?redfin\.com\/[A-Z]{2}\/[^/]+\/[^/]+\/apartment-[^/]+\/home\/\d+/i,
  ];
  
  return redfinPatterns.some(pattern => pattern.test(url));
}

/**
 * Extracts property ID from a Redfin URL if present
 */
export function extractRedfinPropertyId(url: string): string | null {
  const idMatch = url.match(/\/home\/(\d+)/i);
  return idMatch ? idMatch[1] : null;
}

/**
 * Fetches property details from a Redfin URL using HasData API
 */
export async function getRedfinPropertyDetails(redfinUrl: string): Promise<HasDataRedfinResponse> {
  const apiKey = ENV.hasdataApiKey;
  
  if (!apiKey) {
    console.error("[HasData Redfin] API key not configured");
    return {
      success: false,
      error: "HasData API key not configured"
    };
  }
  
  if (!isRedfinUrl(redfinUrl)) {
    return {
      success: false,
      error: "Invalid Redfin URL format"
    };
  }
  
  try {
    console.log(`[HasData Redfin] Fetching property details for: ${redfinUrl}`);
    
    // HasData Redfin Property API endpoint - uses GET with URL parameter
    const apiUrl = `https://api.hasdata.com/scrape/redfin/property?url=${encodeURIComponent(redfinUrl)}`;
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HasData Redfin] API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `API error: ${response.status}`
      };
    }
    
    const rawData = await response.json();
    console.log("[HasData Redfin] Raw response:", JSON.stringify(rawData, null, 2));
    
    // Parse the response based on HasData's Redfin Property API format
    const propertyData = parseRedfinResponse(rawData);
    
    return {
      success: true,
      data: propertyData,
      creditsUsed: 5
    };
    
  } catch (error) {
    console.error("[HasData Redfin] Error fetching property details:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

/**
 * Parses the HasData Redfin API response into our standardized format
 */
function parseRedfinResponse(rawData: Record<string, unknown>): RedfinPropertyData {
  // HasData returns the property data in a 'property' key
  const data = (rawData.property || rawData.data || rawData) as Record<string, unknown>;
  
  // Address is nested in an 'address' object
  const addressObj = data.address as Record<string, unknown> | undefined;
  let streetAddress = "";
  let city = "";
  let state = "";
  let zipcode = "";
  
  if (typeof addressObj === 'object' && addressObj !== null) {
    streetAddress = (addressObj.street as string) || "";
    city = (addressObj.city as string) || "";
    state = (addressObj.state as string) || "";
    zipcode = (addressObj.zipcode as string) || "";
  }
  
  let fullAddress = streetAddress;
  if (city) fullAddress += `, ${city}`;
  if (state) fullAddress += `, ${state}`;
  if (zipcode) fullAddress += ` ${zipcode}`;
  
  // Determine price type (sale vs rent)
  // Redfin status: "sold", "for_sale", "for_rent", etc.
  const status = ((data.status as string) || "").toLowerCase();
  
  let priceType: 'sale' | 'rent' | 'unknown' = 'unknown';
  if (status.includes('rent')) {
    priceType = 'rent';
  } else if (status.includes('sale') || status.includes('sold')) {
    priceType = 'sale';
  }
  
  // Extract price
  let price: number | null = null;
  const rawPrice = data.price;
  if (typeof rawPrice === 'number') {
    price = rawPrice;
  } else if (typeof rawPrice === 'string') {
    const cleanPrice = rawPrice.replace(/[$,]/g, '');
    price = parseFloat(cleanPrice) || null;
  }
  
  // Extract bedrooms
  let bedrooms: number | null = null;
  const rawBedrooms = data.beds || data.bedrooms;
  if (typeof rawBedrooms === 'number') {
    bedrooms = rawBedrooms;
  } else if (typeof rawBedrooms === 'string') {
    bedrooms = parseInt(rawBedrooms, 10) || null;
  }
  
  // Extract bathrooms
  let bathrooms: number | null = null;
  const rawBathrooms = data.baths || data.bathrooms;
  if (typeof rawBathrooms === 'number') {
    bathrooms = rawBathrooms;
  } else if (typeof rawBathrooms === 'string') {
    bathrooms = parseFloat(rawBathrooms) || null;
  }
  
  // Extract living area
  let livingArea: number | undefined;
  const rawArea = data.area || data.livingArea || data.sqft;
  if (typeof rawArea === 'number') {
    livingArea = rawArea;
  } else if (typeof rawArea === 'string') {
    livingArea = parseFloat(rawArea.replace(/,/g, '')) || undefined;
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
    propertyType: (data.homeType as string) || (data.propertyType as string) || undefined,
    description: data.description as string || undefined,
    latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
    longitude: typeof data.longitude === 'number' ? data.longitude : undefined,
    propertyId: (data.propertyId as string) || extractRedfinPropertyId(data.url as string || "") || undefined,
    homeStatus: status || undefined,
    imageUrl: (data.image as string) || undefined,
    rawResponse: rawData
  };
}
