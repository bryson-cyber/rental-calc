/**
 * HasData API Integration for Zillow Listings
 * 
 * This module provides functions to search Zillow rental and sale listings
 * using the HasData scraping API.
 */

import { ENV } from "./_core/env";
import { makeRequest, GeocodingResult } from "./_core/map";

// Types for Zillow Listing API
export interface ZillowListingParams {
  keyword: string; // Location (city, zip, address)
  type: "forRent" | "forSale" | "sold" | "recentlySold";
  priceMin?: number;
  priceMax?: number;
  bedsMin?: number;
  bedsMax?: number;
  bathsMin?: number;
  bathsMax?: number;
  homeTypes?: string[]; // SINGLE_FAMILY, CONDO, TOWNHOUSE, APARTMENT, etc.
  page?: number;
}

export interface ZillowProperty {
  id: string;
  url: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  homeType: string;
  image: string;
  photos: string[]; // All property photos from the listing
  status: string;
  daysOnZillow?: number;
  latitude?: number;
  longitude?: number;
}

export interface ZillowListingResponse {
  success: boolean;
  totalResults: number;
  totalPages: number;
  currentPage: number;
  properties: ZillowProperty[];
  error?: string;
}

/**
 * Search Zillow listings using HasData API
 */
export async function searchZillowListings(
  params: ZillowListingParams
): Promise<ZillowListingResponse> {
  const apiKey = ENV.hasdataApiKey;
  
  if (!apiKey) {
    return {
      success: false,
      totalResults: 0,
      totalPages: 0,
      currentPage: params.page || 1,
      properties: [],
      error: "HasData API key not configured"
    };
  }

  try {
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.set("keyword", params.keyword);
    queryParams.set("type", params.type);
    
    if (params.priceMin) queryParams.set("price[min]", params.priceMin.toString());
    if (params.priceMax) queryParams.set("price[max]", params.priceMax.toString());
    if (params.bedsMin) queryParams.set("beds[min]", params.bedsMin.toString());
    if (params.bedsMax) queryParams.set("beds[max]", params.bedsMax.toString());
    if (params.bathsMin) queryParams.set("baths[min]", params.bathsMin.toString());
    if (params.bathsMax) queryParams.set("baths[max]", params.bathsMax.toString());
    if (params.page) queryParams.set("page", params.page.toString());
    
    if (params.homeTypes && params.homeTypes.length > 0) {
      params.homeTypes.forEach(type => {
        queryParams.append("homeTypes[]", type);
      });
    }

    const url = `https://api.hasdata.com/scrape/zillow/listing?${queryParams.toString()}`;
    
    console.log(`[HasData] Searching Zillow: ${params.keyword} (${params.type})`);
    
    // Add AbortController for timeout (120 seconds for scraping API - large markets take longer)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HasData] API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        totalResults: 0,
        totalPages: 0,
        currentPage: params.page || 1,
        properties: [],
        error: `API error: ${response.status}`
      };
    }

    const data = await response.json();
    
    // Parse the response into our format
    // HasData returns address as an object: { street, city, state, zipcode }
    const properties: ZillowProperty[] = (data.properties || data.results || []).map((prop: any) => {
      // Handle address as object or string
      const addressObj = typeof prop.address === 'object' ? prop.address : null;
      const addressStr = typeof prop.address === 'string' ? prop.address : prop.addressRaw || '';
      
      return {
        id: prop.zpid || prop.id || String(Math.random()),
        url: prop.detailUrl || prop.url || `https://www.zillow.com/homedetails/${prop.zpid}_zpid/`,
        address: addressObj 
          ? `${addressObj.street || ''}, ${addressObj.city || ''}, ${addressObj.state || ''} ${addressObj.zipcode || ''}`.trim()
          : (prop.streetAddress || addressStr || ""),
        city: addressObj?.city || prop.city || extractCity(addressStr) || "",
        state: addressObj?.state || prop.state || extractState(addressStr) || "",
        zipCode: addressObj?.zipcode || prop.zipcode || prop.zipCode || extractZipCode(addressStr) || "",
        price: prop.price || prop.unformattedPrice || prop.rentZestimate || prop.minPrice || 0,
        bedrooms: prop.bedrooms || prop.beds || 0,
        bathrooms: prop.bathrooms || prop.baths || 0,
        squareFeet: prop.livingArea || prop.area || prop.sqft || undefined,
        homeType: normalizeHomeType(prop.homeType || prop.propertyType || ""),
        image: prop.imgSrc || prop.image || (prop.photos && prop.photos[0]) || prop.thumbnail || "",
        photos: Array.isArray(prop.photos) ? prop.photos : (prop.imgSrc ? [prop.imgSrc] : []),
        status: prop.homeStatus || prop.status || params.type,
        daysOnZillow: prop.daysOnZillow || undefined,
        latitude: prop.latitude || prop.lat || undefined,
        longitude: prop.longitude || prop.lng || undefined
      };
    });

    // Filter out properties without price - they're not useful for analysis
    const propertiesWithPrice = properties.filter(p => p.price > 0);
    
    // Extract pagination info from the correct API response structure
    // HasData API returns:
    // - searchInformation.totalResults (the total count of all results)
    // - pagination.currentPage, pagination.nextPage, pagination.otherPages (for navigation)
    const totalResults = data.searchInformation?.totalResults || 
                         data.searchInformation?.totalResultsCount || 
                         data.totalResultCount || 
                         data.totalResults || 
                         properties.length;
    
    // Calculate total pages from total results (Zillow returns ~40 per page)
    // Also check if pagination.otherPages exists to determine page count
    const pagesFromOtherPages = data.pagination?.otherPages ? Object.keys(data.pagination.otherPages).length + 1 : 0;
    const totalPages = data.pagination?.totalPages || 
                       pagesFromOtherPages ||
                       Math.ceil(totalResults / 40) || 
                       1;
    const currentPage = params.page || 1;
    
    console.log(`[HasData] Found ${properties.length} properties, ${propertiesWithPrice.length} with price data. Total: ${totalResults}, Pages: ${totalPages}, Current: ${currentPage}`);

    return {
      success: true,
      totalResults: totalResults,
      totalPages: totalPages,
      currentPage: currentPage,
      properties: propertiesWithPrice
    };

  } catch (error) {
    console.error("[HasData] Error searching Zillow:", error);
    return {
      success: false,
      totalResults: 0,
      totalPages: 0,
      currentPage: params.page || 1,
      properties: [],
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Get detailed property information from Zillow
 */
export async function getZillowProperty(propertyUrl: string): Promise<ZillowProperty | null> {
  const apiKey = ENV.hasdataApiKey;
  
  if (!apiKey) {
    console.error("[HasData] API key not configured");
    return null;
  }

  try {
    const queryParams = new URLSearchParams();
    queryParams.set("url", propertyUrl);

    const url = `https://api.hasdata.com/scrape/zillow/property?${queryParams.toString()}`;
    
    console.log(`[HasData] Getting property details: ${propertyUrl}`);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      }
    });

    if (!response.ok) {
      console.error(`[HasData] Property API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    return {
      id: data.zpid || data.id || "",
      url: propertyUrl,
      address: data.streetAddress || data.address || "",
      city: data.city || "",
      state: data.state || "",
      zipCode: data.zipcode || "",
      price: data.price || 0,
      bedrooms: data.bedrooms || 0,
      bathrooms: data.bathrooms || 0,
      squareFeet: data.livingArea || undefined,
      homeType: normalizeHomeType(data.homeType || ""),
      image: data.imgSrc || data.image || "",
      photos: Array.isArray(data.photos) ? data.photos : (data.imgSrc ? [data.imgSrc] : []),
      status: data.homeStatus || "",
      daysOnZillow: data.daysOnZillow || undefined,
      latitude: data.latitude || undefined,
      longitude: data.longitude || undefined
    };

  } catch (error) {
    console.error("[HasData] Error getting property:", error);
    return null;
  }
}

// Helper functions to extract address components
function extractCity(address: string): string {
  if (!address) return "";
  const parts = address.split(",");
  if (parts.length >= 2) {
    return parts[parts.length - 2].trim();
  }
  return "";
}

function extractState(address: string): string {
  if (!address) return "";
  const parts = address.split(",");
  if (parts.length >= 1) {
    const lastPart = parts[parts.length - 1].trim();
    const stateZip = lastPart.split(" ");
    if (stateZip.length >= 1) {
      return stateZip[0];
    }
  }
  return "";
}

function extractZipCode(address: string): string {
  if (!address) return "";
  const zipMatch = address.match(/\b\d{5}(-\d{4})?\b/);
  return zipMatch ? zipMatch[0] : "";
}

function normalizeHomeType(homeType: string): string {
  const typeMap: Record<string, string> = {
    "SINGLE_FAMILY": "Single Family",
    "CONDO": "Condo",
    "TOWNHOUSE": "Townhouse",
    "APARTMENT": "Apartment",
    "MULTI_FAMILY": "Multi-Family",
    "MANUFACTURED": "Manufactured",
    "LOT": "Lot/Land",
    "LAND": "Lot/Land"
  };
  return typeMap[homeType.toUpperCase()] || homeType || "Unknown";
}

// ============================================
// CONTACT INFORMATION TYPES
// ============================================

export interface ZillowAgentContact {
  name: string;
  phone: string | null;
  email: string | null;
  brokerage: string | null;
}

export interface ZillowPropertyWithContacts extends ZillowProperty {
  agent: ZillowAgentContact | null;
  listingAgent: ZillowAgentContact | null;
  buildingName?: string;
  description?: string;
  yearBuilt?: number;
  amenities?: string[];
}

/**
 * Get detailed property information including agent contact details
 * Uses the HasData Property API with extractAgentEmails=true
 * Cost: 5 credits per request
 */
export async function getZillowPropertyWithContacts(propertyUrl: string): Promise<ZillowPropertyWithContacts | null> {
  const apiKey = ENV.hasdataApiKey;
  
  if (!apiKey) {
    console.error("[HasData] API key not configured");
    return null;
  }

  try {
    const queryParams = new URLSearchParams();
    queryParams.set("url", propertyUrl);
    queryParams.set("extractAgentEmails", "true"); // Enable agent email extraction

    const url = `https://api.hasdata.com/scrape/zillow/property?${queryParams.toString()}`;
    
    console.log(`[HasData] Getting property with contacts: ${propertyUrl}`);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HasData] Property API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log(`[HasData] Property response keys:`, Object.keys(data));
    
    // Extract agent contact information
    // HasData returns agent info in various fields depending on listing type
    let agent: ZillowAgentContact | null = null;
    let listingAgent: ZillowAgentContact | null = null;
    
    // Check for listing agent (rental listings)
    if (data.listingAgent || data.agent) {
      const agentData = data.listingAgent || data.agent;
      agent = {
        name: agentData.name || agentData.displayName || "",
        phone: agentData.phone || agentData.phoneNumber || null,
        email: agentData.email || null,
        brokerage: agentData.brokerageName || agentData.brokerage || null
      };
    }
    
    // Check for building/property manager (apartments)
    if (data.buildingPhoneNumber || data.propertyPhoneNumber || data.contactPhone) {
      listingAgent = {
        name: data.buildingName || data.propertyName || "Property Manager",
        phone: data.buildingPhoneNumber || data.propertyPhoneNumber || data.contactPhone || null,
        email: data.contactEmail || data.buildingEmail || null,
        brokerage: data.managementCompany || null
      };
    }
    
    // Check for attributionInfo (common in Zillow responses)
    if (data.attributionInfo) {
      const attr = data.attributionInfo;
      if (attr.agentName || attr.agentPhoneNumber || attr.agentEmail) {
        agent = {
          name: attr.agentName || "",
          phone: attr.agentPhoneNumber || null,
          email: attr.agentEmail || null,
          brokerage: attr.brokerName || null
        };
      }
    }
    
    // Extract amenities if available
    const amenities: string[] = [];
    if (data.amenities && Array.isArray(data.amenities)) {
      amenities.push(...data.amenities);
    }
    if (data.homeFactsAndFeatures) {
      Object.values(data.homeFactsAndFeatures).forEach((section: any) => {
        if (Array.isArray(section)) {
          section.forEach((item: any) => {
            if (typeof item === 'string') amenities.push(item);
            else if (item.factLabel) amenities.push(item.factLabel);
          });
        }
      });
    }

    return {
      id: data.zpid || data.id || "",
      url: propertyUrl,
      address: data.streetAddress || data.address || "",
      city: data.city || "",
      state: data.state || "",
      zipCode: data.zipcode || "",
      price: data.price || data.rentZestimate || 0,
      bedrooms: data.bedrooms || 0,
      bathrooms: data.bathrooms || 0,
      squareFeet: data.livingArea || undefined,
      homeType: normalizeHomeType(data.homeType || ""),
      image: data.imgSrc || data.image || "",
      photos: Array.isArray(data.photos) ? data.photos : (data.imgSrc ? [data.imgSrc] : []),
      status: data.homeStatus || "",
      daysOnZillow: data.daysOnZillow || undefined,
      latitude: data.latitude || undefined,
      longitude: data.longitude || undefined,
      agent,
      listingAgent,
      buildingName: data.buildingName || undefined,
      description: data.description || undefined,
      yearBuilt: data.yearBuilt || undefined,
      amenities: amenities.length > 0 ? amenities : undefined
    };

  } catch (error) {
    console.error("[HasData] Error getting property with contacts:", error);
    return null;
  }
}


/**
 * Enrich properties that have no price OR no coordinates by fetching details from Zillow Property API
 * This is useful for:
 * - Multi-unit listings that show "Contact for Price"
 * - Properties missing lat/lng coordinates (needed for Map tab)
 * 
 * @param properties - Array of properties, some may have price = 0 or missing coordinates
 * @param maxEnrichments - Maximum number of properties to enrich (to control API costs)
 * @returns Array of properties with enriched price and coordinate data where available
 */
export async function enrichPropertiesWithPrice(
  properties: ZillowProperty[],
  maxEnrichments: number = 5
): Promise<ZillowProperty[]> {
  const apiKey = ENV.hasdataApiKey;
  
  if (!apiKey) {
    console.log("[HasData] No API key, skipping enrichment");
    return properties;
  }

  // Identify properties that need enrichment:
  // 1. No price (price <= 0)
  // 2. No coordinates (missing lat/lng)
  const needsEnrichment = (p: ZillowProperty) => p.price <= 0 || !p.latitude || !p.longitude;
  
  const complete = properties.filter(p => !needsEnrichment(p));
  const incomplete = properties.filter(needsEnrichment);
  
  if (incomplete.length === 0) {
    console.log("[HasData] All properties have prices and coordinates, no enrichment needed");
    return properties;
  }

  // Prioritize properties without price, then those without coordinates
  const withoutPrice = incomplete.filter(p => p.price <= 0);
  const withoutCoords = incomplete.filter(p => p.price > 0 && (!p.latitude || !p.longitude));
  const toEnrichPrioritized = [...withoutPrice, ...withoutCoords];
  
  console.log(`[HasData] Enriching ${Math.min(toEnrichPrioritized.length, maxEnrichments)} of ${incomplete.length} incomplete properties (${withoutPrice.length} without price, ${withoutCoords.length} without coordinates)`);
  
  // Legacy variable names for compatibility
  const withPrice = complete;
  
  // Enrich up to maxEnrichments properties from the prioritized list
  const toEnrich = toEnrichPrioritized.slice(0, maxEnrichments);
  const enrichedProperties: ZillowProperty[] = [];
  const enrichedIds = new Set<string>();
  
  for (const prop of toEnrich) {
    if (!prop.url || !prop.url.includes('zillow.com')) {
      console.log(`[HasData] Skipping property without valid Zillow URL: ${prop.address}`);
      continue;
    }
    
    try {
      const enriched = await getZillowProperty(prop.url);
      if (enriched) {
        // Check if we got useful data (price or coordinates)
        const hasNewPrice = enriched.price > 0 && prop.price <= 0;
        const hasNewCoords = (enriched.latitude && enriched.longitude) && (!prop.latitude || !prop.longitude);
        
        if (hasNewPrice || hasNewCoords || enriched.price > 0) {
          console.log(`[HasData] Enriched ${prop.address}: price=$${enriched.price || prop.price}, coords=${enriched.latitude},${enriched.longitude}`);
          enrichedProperties.push({
            ...prop,
            price: enriched.price > 0 ? enriched.price : prop.price,
            bedrooms: enriched.bedrooms || prop.bedrooms,
            bathrooms: enriched.bathrooms || prop.bathrooms,
            squareFeet: enriched.squareFeet || prop.squareFeet,
            latitude: enriched.latitude || prop.latitude,
            longitude: enriched.longitude || prop.longitude
          });
          enrichedIds.add(prop.id);
        } else {
          console.log(`[HasData] No useful data for ${prop.address}`);
        }
      } else {
        console.log(`[HasData] Could not get data for ${prop.address}`);
      }
    } catch (error) {
      console.error(`[HasData] Error enriching ${prop.address}:`, error);
    }
    
    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Include properties that weren't enriched but still have price (even if missing coords)
  const notEnrichedButHasPrice = incomplete.filter(p => !enrichedIds.has(p.id) && p.price > 0);
  
  // Combine: complete properties + enriched properties + non-enriched with price
  let result = [...withPrice, ...enrichedProperties, ...notEnrichedButHasPrice];
  console.log(`[HasData] After Zillow enrichment: ${result.length} properties (${withPrice.length} complete, ${enrichedProperties.length} enriched, ${notEnrichedButHasPrice.length} partial)`);
  
  // GEOCODING FALLBACK: For properties still missing coordinates, use Google Geocoding API
  const stillMissingCoords = result.filter(p => !p.latitude || !p.longitude);
  if (stillMissingCoords.length > 0) {
    console.log(`[HasData] Geocoding ${stillMissingCoords.length} properties still missing coordinates`);
    result = await geocodePropertiesMissingCoords(result);
  }
  
  console.log(`[HasData] Final result: ${result.length} properties`);
  return result;
}

/**
 * Search Zillow listings with automatic price enrichment
 * This combines the listing search with property detail lookups for better data
 */
export async function searchZillowListingsWithEnrichment(
  params: ZillowListingParams,
  enrichmentOptions?: { maxEnrichments?: number; skipEnrichment?: boolean }
): Promise<ZillowListingResponse> {
  // First, get the listings
  const response = await searchZillowListings(params);
  
  if (!response.success || response.properties.length === 0) {
    return response;
  }
  
  // If enrichment is disabled, return as-is
  if (enrichmentOptions?.skipEnrichment) {
    return response;
  }
  
  // Check if any properties need enrichment (missing price OR missing coordinates)
  const needsEnrichment = response.properties.some(p => p.price <= 0 || !p.latitude || !p.longitude);
  if (!needsEnrichment) {
    console.log('[HasData] All properties have prices and coordinates, skipping enrichment');
    return response;
  }
  
  // Enrich ALL properties that are missing price or coordinates
  // Use higher limit to ensure Map tab works properly
  const enrichedProperties = await enrichPropertiesWithPrice(
    response.properties,
    enrichmentOptions?.maxEnrichments || 20 // Increased default to enrich more properties
  );
  
  // Preserve the original pagination info, don't override totalResults
  // The totalResults should reflect the total available in the market, not just what we have
  return {
    ...response,
    properties: enrichedProperties,
    // Keep original totalResults for pagination calculation
  };
}


/**
 * Geocode properties that are missing lat/lng coordinates using Google Geocoding API
 * This is a fallback for when Zillow doesn't provide coordinates
 * 
 * @param properties - Array of properties, some may be missing coordinates
 * @returns Array of properties with coordinates filled in where possible
 */
async function geocodePropertiesMissingCoords(
  properties: ZillowProperty[]
): Promise<ZillowProperty[]> {
  const result: ZillowProperty[] = [];
  
  for (const prop of properties) {
    // Skip if already has coordinates
    if (prop.latitude && prop.longitude) {
      result.push(prop);
      continue;
    }
    
    // Build full address for geocoding
    const fullAddress = prop.address || `${prop.city}, ${prop.state} ${prop.zipCode}`;
    
    if (!fullAddress || fullAddress.trim() === ', ') {
      console.log(`[Geocoding] Skipping property with no address: ${prop.id}`);
      result.push(prop);
      continue;
    }
    
    try {
      console.log(`[Geocoding] Geocoding address: ${fullAddress}`);
      
      const geocodeResult = await makeRequest<GeocodingResult>(
        '/maps/api/geocode/json',
        { address: fullAddress }
      );
      
      if (geocodeResult.status === 'OK' && geocodeResult.results.length > 0) {
        const location = geocodeResult.results[0].geometry.location;
        console.log(`[Geocoding] Found coordinates for ${fullAddress}: ${location.lat}, ${location.lng}`);
        
        result.push({
          ...prop,
          latitude: location.lat,
          longitude: location.lng
        });
      } else {
        console.log(`[Geocoding] No results for ${fullAddress}: ${geocodeResult.status}`);
        result.push(prop);
      }
    } catch (error) {
      console.error(`[Geocoding] Error geocoding ${fullAddress}:`, error);
      result.push(prop);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const geocodedCount = result.filter(p => p.latitude && p.longitude).length;
  console.log(`[Geocoding] Geocoded ${geocodedCount}/${result.length} properties have coordinates`);
  
  return result;
}
