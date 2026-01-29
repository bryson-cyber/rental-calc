/**
 * HasData API Integration for Zillow Listings
 * 
 * This module provides functions to search Zillow rental and sale listings
 * using the HasData scraping API.
 */

import { ENV } from "./_core/env";

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
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HasData] API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        totalResults: 0,
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
        price: prop.price || prop.unformattedPrice || prop.rentZestimate || 0,
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

    // Filter out properties without price data (apartment buildings with multiple units)
    const filteredProperties = properties.filter(p => p.price > 0 && p.bedrooms > 0);
    
    console.log(`[HasData] Found ${properties.length} properties, ${filteredProperties.length} with price data`);

    return {
      success: true,
      totalResults: data.totalResultCount || data.totalResults || filteredProperties.length,
      properties: filteredProperties
    };

  } catch (error) {
    console.error("[HasData] Error searching Zillow:", error);
    return {
      success: false,
      totalResults: 0,
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
