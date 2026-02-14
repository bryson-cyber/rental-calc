/**
 * Regulation Tracker Service
 * 
 * Provides real-time STR regulation lookup using Gemini API with Google Search grounding.
 * Features:
 * - Database caching (7-day TTL) to reduce API calls
 * - URL validation to filter out 404 errors
 * - Address search support (city, address, or Redfin/Zillow links)
 * - PTCF-optimized prompts for professional, clear output
 */

import { ENV } from "./_core/env";
import { getDb } from "./db";
import { regulationCache } from "../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";

// Types for regulation data
export interface RegulationSearchResult {
  city: string;
  state: string;
  status: 'allowed' | 'allowed_with_permit' | 'restricted' | 'limited' | 'banned' | 'paused' | 'pending' | 'unknown';
  yesNoSummary: string;
  summary: string;
  simplifiedSummary: string;
  keyRequirements: string[];
  permitRequired: boolean;
  primaryResidenceOnly: boolean;
  maxNightsPerYear?: number;
  registrationFee?: string;
  occupancyTax?: string;
  zoningRestrictions?: string;
  sources: RegulationSource[];
  lastUpdated: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  fromCache?: boolean;
}

export interface RegulationSource {
  title: string;
  url: string;
  type: 'official' | 'news' | 'third_party';
  isOfficial: boolean;
  date?: string;
  snippet?: string;
  validated?: boolean;
}

// Gemini API response types
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: Array<{
        web?: {
          uri?: string;
          title?: string;
        };
      }>;
      searchEntryPoint?: {
        renderedContent?: string;
      };
      groundingSupports?: Array<{
        segment?: {
          startIndex?: number;
          endIndex?: number;
          text?: string;
        };
        groundingChunkIndices?: number[];
        confidenceScores?: number[];
      }>;
    };
  }>;
  error?: {
    message?: string;
    code?: number;
  };
}

// Cache TTL: 7 days in milliseconds
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// LOCATION PARSING - Extract city/state from various input formats
// ============================================================================

interface ParsedLocation {
  city: string;
  state: string;
  address?: string;
}

/**
 * Parse location from various input formats:
 * - City, State (e.g., "St. Louis, MO")
 * - Full address (e.g., "123 Main St, Denver, CO 80202")
 * - Redfin URL (e.g., "https://www.redfin.com/CO/Denver/123-Main-St-80202/...")
 * - Zillow URL (e.g., "https://www.zillow.com/homedetails/123-Main-St-Denver-CO-80202/...")
 */
export function parseLocation(input: string): ParsedLocation | null {
  const trimmed = input.trim();
  
  // Check for Redfin URL
  if (trimmed.includes('redfin.com')) {
    return parseRedfinUrl(trimmed);
  }
  
  // Check for Zillow URL
  if (trimmed.includes('zillow.com')) {
    return parseZillowUrl(trimmed);
  }
  
  // Check for full address (contains numbers and multiple commas)
  if (/\d/.test(trimmed) && trimmed.split(',').length >= 2) {
    return parseAddress(trimmed);
  }
  
  // Default: City, State format
  return parseCityState(trimmed);
}

function parseRedfinUrl(url: string): ParsedLocation | null {
  try {
    // Redfin URL format: https://www.redfin.com/STATE/City/Address/home/ID
    // Example: https://www.redfin.com/CO/Denver/123-Main-St-80202/home/12345
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    if (pathParts.length >= 3) {
      const state = pathParts[0]; // e.g., "CO"
      const city = pathParts[1].replace(/-/g, ' '); // e.g., "Denver"
      const addressPart = pathParts[2].replace(/-/g, ' '); // e.g., "123 Main St 80202"
      
      return {
        city: capitalizeWords(city),
        state: state.toUpperCase(),
        address: addressPart
      };
    }
  } catch (e) {
    console.error('[RegulationTracker] Failed to parse Redfin URL:', e);
  }
  return null;
}

function parseZillowUrl(url: string): ParsedLocation | null {
  try {
    // Zillow URL format: https://www.zillow.com/homedetails/Address-City-State-Zip/ID_zpid/
    // Examples:
    // - https://www.zillow.com/homedetails/123-Main-St-Denver-CO-80202/12345_zpid/
    // - https://www.zillow.com/homedetails/3715-Mission-Blvd-11-San-Diego-CA-92109/450213296_zpid/
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // Find the homedetails part
    const detailsIndex = pathParts.indexOf('homedetails');
    if (detailsIndex !== -1 && pathParts.length > detailsIndex + 1) {
      const addressPart = pathParts[detailsIndex + 1];
      
      // Use regex to find state-zip pattern at the end
      // Pattern: City-Name-ST-12345 where ST is 2-letter state code and 12345 is zip
      const stateZipMatch = addressPart.match(/^(.+)-([A-Z]{2})-(\d{5})$/i);
      if (stateZipMatch) {
        const beforeStateZip = stateZipMatch[1]; // e.g., "3715-Mission-Blvd-11-San-Diego"
        const state = stateZipMatch[2].toUpperCase(); // e.g., "CA"
        
        // Split by hyphen
        const parts = beforeStateZip.split('-');
        
        // Strategy 1: Look for a standalone unit/apt number that separates address from city
        // This handles cases like "3715-Mission-Blvd-11-San-Diego" where "11" is unit number
        // IMPORTANT: Skip index 0 as that's the street number, not a unit number
        let cityStartIndex = -1;
        
        // Look from the end for a number that's NOT at the beginning (street number)
        // and is followed by non-number parts (the city)
        for (let i = parts.length - 1; i >= 2; i--) {
          // If we find a standalone number (unit/apt number) that's not the street number
          if (/^\d+$/.test(parts[i - 1]) && i - 1 > 0) {
            cityStartIndex = i;
            break;
          }
        }
        
        // If we found a unit number separator, extract city from there
        if (cityStartIndex > 1 && cityStartIndex < parts.length) {
          const cityParts = parts.slice(cityStartIndex);
          const city = capitalizeWords(cityParts.join(' '));
          const address = parts.slice(0, cityStartIndex).join(' ');
          
          if (city && !/\d/.test(city)) { // City should not contain numbers
            return { city, state, address };
          }
        }
        
        // Fallback: Scan from the end looking for known multi-word city prefixes
        // Common multi-word city prefixes (San Diego, New York, Saint Louis, etc.)
        const multiWordPrefixes = ['san', 'new', 'los', 'las', 'saint', 'st', 'fort', 'el', 'la', 'west', 'east', 'north', 'south', 'port', 'mount', 'lake'];
        
        // Scan backwards through parts looking for a city prefix
        for (let i = parts.length - 2; i >= 0; i--) {
          const part = parts[i].toLowerCase();
          if (multiWordPrefixes.includes(part)) {
            // Found a city prefix - everything from here to end is the city
            const cityParts = parts.slice(i);
            // Verify city parts don't contain numbers (would indicate it's part of address)
            if (!cityParts.some(p => /\d/.test(p))) {
              const city = capitalizeWords(cityParts.join(' '));
              const address = parts.slice(0, i).join(' ');
              return { city, state, address };
            }
          }
        }
        
        // Final fallback: assume last part is single-word city (Denver, Austin, etc.)
        if (parts.length >= 1) {
          const lastPart = parts[parts.length - 1];
          if (!/\d/.test(lastPart)) {
            const city = capitalizeWords(lastPart);
            const address = parts.slice(0, -1).join(' ');
            return { city, state, address };
          }
        }
      }
      
      // Fallback: Try original parsing method for other URL formats
      const parts = addressPart.split('-');
      for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        if (/^[A-Z]{2}$/i.test(part)) {
          const state = part.toUpperCase();
          const city = i > 0 ? capitalizeWords(parts[i - 1]) : '';
          const address = parts.slice(0, i - 1).join(' ');
          if (city) {
            return { city, state, address };
          }
        }
      }
    }
  } catch (e) {
    console.error('[RegulationTracker] Failed to parse Zillow URL:', e);
  }
  return null;
}

function parseAddress(address: string): ParsedLocation | null {
  // Common address format: "123 Main St, Denver, CO 80202"
  const parts = address.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    // Last part usually contains state (and possibly zip)
    const lastPart = parts[parts.length - 1];
    // Second to last is usually city
    const cityPart = parts[parts.length - 2];
    
    // Extract state from last part (e.g., "CO 80202" or "CO")
    const stateMatch = lastPart.match(/^([A-Za-z]{2})\s*\d*$/);
    if (stateMatch) {
      return {
        city: capitalizeWords(cityPart),
        state: stateMatch[1].toUpperCase(),
        address: parts.slice(0, -2).join(', ')
      };
    }
    
    // Try to find state in the format "City, State"
    const stateWords = lastPart.split(/\s+/);
    for (const word of stateWords) {
      const abbrev = getStateAbbreviation(word);
      if (abbrev && abbrev.length === 2) {
        return {
          city: capitalizeWords(cityPart),
          state: abbrev,
          address: parts.slice(0, -2).join(', ')
        };
      }
    }
  }
  
  return null;
}

function parseCityState(input: string): ParsedLocation | null {
  // Format: "City, State" or "City State"
  const parts = input.split(/[,\s]+/).filter(Boolean);
  
  if (parts.length >= 2) {
    // Last part is state
    const statePart = parts[parts.length - 1];
    const state = getStateAbbreviation(statePart) || statePart;
    
    // Everything else is city
    const city = parts.slice(0, -1).join(' ');
    
    return {
      city: capitalizeWords(city),
      state: state.toUpperCase()
    };
  }
  
  return null;
}

function capitalizeWords(str: string): string {
  return str.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================================================
// URL VALIDATION - Filter out 404 errors
// ============================================================================

/**
 * Validate a URL by making a HEAD request
 * Returns true if the URL is accessible (2xx or 3xx status)
 */
async function validateUrl(url: string): Promise<boolean> {
  try {
    // Skip validation for Google redirect URLs (they're always valid)
    if (url.includes('vertexaisearch.cloud.google.com')) {
      return true;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RegulationTracker/1.0)'
      }
    });
    
    clearTimeout(timeoutId);
    
    // Accept 2xx and 3xx status codes
    const isValid = response.status >= 200 && response.status < 400;
    if (!isValid) {
      console.log(`[RegulationTracker] URL validation failed (${response.status}): ${url}`);
    }
    return isValid;
  } catch (error) {
    // If HEAD fails, try GET (some servers don't support HEAD)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RegulationTracker/1.0)'
        }
      });
      
      clearTimeout(timeoutId);
      return response.status >= 200 && response.status < 400;
    } catch {
      console.log(`[RegulationTracker] URL validation error: ${url}`);
      return false;
    }
  }
}

/**
 * Validate multiple URLs in parallel and filter out invalid ones
 */
async function validateSources(sources: RegulationSource[]): Promise<RegulationSource[]> {
  const validationPromises = sources.map(async (source) => {
    const isValid = await validateUrl(source.url);
    return { source, isValid };
  });
  
  const results = await Promise.all(validationPromises);
  
  const validSources = results
    .filter(r => r.isValid)
    .map(r => ({ ...r.source, validated: true }));
  
  console.log(`[RegulationTracker] URL validation: ${validSources.length}/${sources.length} sources valid`);
  
  return validSources;
}

// ============================================================================
// CACHE FUNCTIONS
// ============================================================================

function normalizeLocationKey(city: string, state: string): string {
  return `${city.toLowerCase().trim()}_${state.toLowerCase().trim()}`.replace(/[^a-z0-9_]/g, '');
}

async function getCachedRegulation(city: string, state: string): Promise<RegulationSearchResult | null> {
  try {
    const locationKey = normalizeLocationKey(city, state);
    const now = new Date();
    
    const db = await getDb();
    if (!db) return null;
    
    const cached = await db.select()
      .from(regulationCache)
      .where(
        and(
          eq(regulationCache.locationKey, locationKey),
          gt(regulationCache.expiresAt, now)
        )
      )
      .limit(1);
    
    if (cached.length > 0) {
      const record = cached[0];
      console.log(`[RegulationTracker] Cache hit for ${city}, ${state}`);
      return {
        city: record.city,
        state: record.state,
        status: record.status as any,
        yesNoSummary: record.yesNoSummary || '',
        summary: record.summary || '',
        simplifiedSummary: record.simplifiedSummary || '',
        keyRequirements: (record.keyRequirements as string[]) || [],
        permitRequired: record.permitRequired === 1,
        primaryResidenceOnly: record.primaryResidenceOnly === 1,
        maxNightsPerYear: record.maxNightsPerYear || undefined,
        registrationFee: record.registrationFee || undefined,
        occupancyTax: record.occupancyTax || undefined,
        zoningRestrictions: record.zoningRestrictions || undefined,
        sources: (record.sources as RegulationSource[]) || [],
        lastUpdated: record.updatedAt.toISOString(),
        confidence: (record.confidence as any) || 'medium',
        warnings: (record.warnings as string[]) || [],
        fromCache: true
      };
    }
    
    return null;
  } catch (error) {
    console.error('[RegulationTracker] Cache lookup error:', error);
    return null;
  }
}

async function cacheRegulation(result: RegulationSearchResult): Promise<void> {
  try {
    const locationKey = normalizeLocationKey(result.city, result.state);
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    
    const db = await getDb();
    if (!db) return;
    
    await db.delete(regulationCache)
      .where(eq(regulationCache.locationKey, locationKey));
    
    await db.insert(regulationCache).values({
      locationKey,
      city: result.city,
      state: result.state,
      status: result.status,
      yesNoSummary: result.yesNoSummary,
      summary: result.summary,
      simplifiedSummary: result.simplifiedSummary,
      keyRequirements: result.keyRequirements,
      permitRequired: result.permitRequired ? 1 : 0,
      primaryResidenceOnly: result.primaryResidenceOnly ? 1 : 0,
      maxNightsPerYear: result.maxNightsPerYear || null,
      registrationFee: result.registrationFee || null,
      occupancyTax: result.occupancyTax || null,
      zoningRestrictions: result.zoningRestrictions || null,
      sources: result.sources,
      confidence: result.confidence,
      warnings: result.warnings,
      expiresAt
    });
    
    console.log(`[RegulationTracker] Cached regulation for ${result.city}, ${result.state}`);
  } catch (error) {
    console.error('[RegulationTracker] Cache save error:', error);
  }
}

// ============================================================================
// SOURCE CLASSIFICATION
// ============================================================================

function isOfficialSource(url: string, title: string): boolean {
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  
  // Official government domains - check both URL and title
  if (urlLower.includes('.gov')) return true;
  if (titleLower.includes('.gov')) return true;
  if (titleLower.includes('gov.')) return true;
  
  // Check title for specific government domain patterns
  const govDomainPatterns = [
    /[a-z]+gov\.org/i,
    /[a-z]+gov\.com/i,
    /city[a-z]+\.org/i,
    /county[a-z]+\.org/i,
    /denvergov/i,
    /stlouis-mo/i,
    /stl\.gov/i,
  ];
  
  for (const pattern of govDomainPatterns) {
    if (pattern.test(titleLower) || pattern.test(urlLower)) return true;
  }
  
  // Common official municipal patterns
  const officialPatterns = [
    /cityof[a-z]+\.(com|org|net)/i,
    /[a-z]+city\.(com|org|net)/i,
    /[a-z]+-city\.(com|org|net)/i,
    /[a-z]+county\.(com|org|net)/i,
    /county[a-z]+\.(com|org|net)/i,
    /[a-z]+\.municipal/i,
    /town(of)?[a-z]+\.(com|org|net)/i,
    /village(of)?[a-z]+\.(com|org|net)/i,
  ];
  
  for (const pattern of officialPatterns) {
    if (pattern.test(urlLower) || pattern.test(titleLower)) return true;
  }
  
  // Check title for official indicators
  const officialTitleKeywords = [
    'official', 'city of', 'county of', 'town of', 'village of',
    'municipal', 'government', 'city council', 'board of supervisors',
    'ordinance', 'municipal code', 'city code'
  ];
  
  for (const keyword of officialTitleKeywords) {
    if (titleLower.includes(keyword)) return true;
  }
  
  return false;
}

function isThirdPartyCommercial(url: string): boolean {
  const urlLower = url.toLowerCase();
  
  const thirdPartyDomains = [
    'allurahomes', 'vacationrentallicense', 'sdhouseguys', 'sandiegoshorttermrentals',
    'cristineclark', 'avalara.com', 'bnbcalc.com', 'getchalet.com', 'chalet.com',
    'hostcompliance', 'granicus', 'harmari', 'rentalscape',
    'airbnb.com', 'vrbo.com', 'booking.com', 'expedia.com', 'homeaway.com',
    'hostaway', 'guesty', 'lodgify', 'hostfully', 'uplisting', 'igms', 'ownerrez',
    'hospitable', 'tokeet', 'smoobu', 'beds24', 'cloudbeds',
    'airdna.co', 'mashvisor', 'awning', 'rabbu', 'alltherooms', 'pricelabs',
    'realtor.com', 'zillow.com', 'redfin.com', 'trulia.com', 'homes.com',
    'biggerpockets', 'roofstock', 'fundrise', 'arrived', 'lofty',
    'avvo.com', 'lawyers.com', 'findlaw.com', 'justia.com', 'nolo.com',
    'wikipedia.org', 'reddit.com', 'quora.com', 'medium.com',
    'yelp.com', 'tripadvisor.com', 'trustpilot.com',
    'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
    'youtube.com', 'tiktok.com', 'pinterest.com',
    'strwise', 'strtips', 'airbnbsecrets', 'learnbnb', 'getpaidforyourpad',
    'hosttools', 'beyondpricing', 'wheelhouse', 'usewheelhouse'
  ];
  
  for (const domain of thirdPartyDomains) {
    if (urlLower.includes(domain)) return true;
  }
  
  return false;
}

function isNewsSource(url: string, title: string): boolean {
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  
  const newsIndicators = [
    'news', 'times', 'tribune', 'herald', 'post', 'journal', 'gazette',
    'press', 'daily', 'weekly', 'chronicle', 'observer', 'reporter',
    'patch.com', 'local', 'ktvb', 'kusa', 'ksdk', 'kmov', 'ktvi'
  ];
  
  for (const indicator of newsIndicators) {
    if (urlLower.includes(indicator) || titleLower.includes(indicator)) return true;
  }
  
  return false;
}

// ============================================================================
// GEMINI API CALL
// ============================================================================

async function callGeminiWithSearch(prompt: string, systemPrompt?: string): Promise<{
  text: string;
  sources: RegulationSource[];
}> {
  const apiKey = ENV.geminiApiKey;
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    tools: [{
      google_search: {}
    }],
    generationConfig: {
      temperature: 1.0,
      maxOutputTokens: 8192,
      thinkingConfig: {
        thinkingLevel: 'medium'
      }
    }
  };

  // Use native systemInstruction instead of fake user/model pairs
  if (systemPrompt) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Gemini API Error]', response.status, errorText);
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data: GeminiResponse = await response.json();
  
  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  const candidates = data.candidates;
  if (!candidates || candidates.length === 0) {
    console.error('[Gemini API] No candidates in response');
    return { text: '', sources: [] };
  }
  
  const content = candidates[0]?.content;
  const parts = content?.parts || [];
  // Filter out thinking parts - only extract text parts
  const text = parts
    .filter((p: any) => p.text && !p.thought)
    .map((p: any) => p.text)
    .join('') || '';
  
  // Extract sources from grounding metadata
  const sources: RegulationSource[] = [];
  const groundingChunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seenUrls = new Set<string>();
  
  console.log('[RegulationTracker] Grounding chunks found:', groundingChunks.length);
  
  for (const chunk of groundingChunks) {
    if (chunk.web?.uri && chunk.web?.title) {
      const sourceUrl = chunk.web.uri;
      const sourceTitle = chunk.web.title;
      
      if (seenUrls.has(sourceUrl)) continue;
      seenUrls.add(sourceUrl);
      
      // Skip third-party commercial sites
      if (isThirdPartyCommercial(sourceUrl)) {
        continue;
      }
      
      const isOfficial = isOfficialSource(sourceUrl, sourceTitle);
      const isNews = isNewsSource(sourceUrl, sourceTitle);
      
      sources.push({
        title: sourceTitle,
        url: sourceUrl,
        type: isOfficial ? 'official' : isNews ? 'news' : 'third_party',
        isOfficial
      });
    }
  }
  
  // Sort sources: official first, then news, then others
  sources.sort((a, b) => {
    if (a.isOfficial && !b.isOfficial) return -1;
    if (!a.isOfficial && b.isOfficial) return 1;
    if (a.type === 'news' && b.type === 'third_party') return -1;
    if (a.type === 'third_party' && b.type === 'news') return 1;
    return 0;
  });

  return { text, sources };
}

// ============================================================================
// STATE ABBREVIATION HELPER
// ============================================================================

function getStateAbbreviation(state: string): string {
  const stateMap: Record<string, string> = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
    'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
    'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
    'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
    'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
    'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
    'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
    'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
    'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC'
  };
  
  const normalized = state.toLowerCase().trim();
  if (normalized.length === 2) return normalized.toUpperCase();
  return stateMap[normalized] || state;
}

// ============================================================================
// MAIN FUNCTION - Get Regulation Info
// ============================================================================

/**
 * Get regulation info for a location
 * Accepts: city/state, full address, or Redfin/Zillow URL
 */
export async function getRegulationInfo(
  city: string,
  state: string
): Promise<RegulationSearchResult> {
  const stateAbbrev = getStateAbbreviation(state) || state;
  
  // Check cache first
  const cached = await getCachedRegulation(city, stateAbbrev);
  if (cached) {
    return cached;
  }
  
  console.log(`[RegulationTracker] Cache miss - fetching fresh data for ${city}, ${stateAbbrev}`);

  // =========================================================================
  // PTCF-OPTIMIZED PROMPT
  // Persona: Regulatory research specialist
  // Task: Research and structure STR regulations
  // Context: Official government sources, specific city/state
  // Format: JSON with specific fields
  // =========================================================================
  
  const researchPrompt = `You are a regulatory research specialist. Research the current short-term rental regulations for ${city}, ${stateAbbrev}.

SEARCH: "${city} ${stateAbbrev} short term rental ordinance site:gov"

OUTPUT ONLY THIS JSON:
{
  "status": "allowed_with_permit",
  "yesNoSummary": "Yes, short-term rentals are allowed in ${city} with a permit.",
  "permitRequired": true,
  "primaryResidenceOnly": false,
  "maxNightsPerYear": null,
  "registrationFee": "$150",
  "occupancyTax": "10%",
  "zoningRestrictions": "Allowed in residential zones with permit",
  "keyRequirements": [
    "Obtain STR permit from city",
    "Pass safety inspection",
    "Provide local contact info"
  ],
  "summary": "2-3 sentence factual summary of CURRENT regulations.",
  "confidence": "high",
  "warnings": ["Only include warnings that affect ability to operate"],
  "officialSourceUrls": ["https://city.gov/str-info"]
}

STATUS OPTIONS:
- "allowed" = No permit needed
- "allowed_with_permit" = Permit required, standard process
- "restricted" = Significant limits (zones, caps, residency)
- "limited" = Heavy restrictions but possible
- "paused" = Enforcement suspended/moratorium
- "banned" = Not permitted

CRITICAL RULES:
1. primaryResidenceOnly = true ONLY if owner MUST live there as main home
2. If investors CAN rent properties they don't live in, set primaryResidenceOnly = false
3. Needing a permit is NORMAL - don't frame it negatively
4. Include actual .gov URLs you found

EXCLUDE FROM OUTPUT (not actionable):
- Rejected proposals or failed legislation
- Historical context (when ordinance was passed)
- Pending proposals that haven't passed
- Political debates or news commentary
- Anything that doesn't affect current ability to operate

FOCUS ONLY ON:
- Can I operate? (Yes/No/With permit)
- What do I need to do? (Permit, fees, requirements)
- What restrictions apply? (Primary residence, caps, zones)`;

  const systemPrompt = `You are a regulatory research specialist. Your role is to provide accurate, factual information about short-term rental regulations from official government sources. Be precise and objective. If you cannot verify a fact from an official source, say so. Never make assumptions about regulations.`;

  try {
    console.log(`[RegulationTracker] Searching regulations for ${city}, ${state}...`);
    
    const { text: researchText, sources } = await callGeminiWithSearch(
      researchPrompt,
      systemPrompt
    );

    console.log('[RegulationTracker] Response length:', researchText.length);
    console.log('[RegulationTracker] Sources found:', sources.length);
    
    // Extract JSON from the response
    let researchData: any = {};
    try {
      const jsonMatch = researchText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        researchData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error('[RegulationTracker] Failed to parse JSON:', parseError);
      researchData = {
        status: 'unknown',
        yesNoSummary: `Please check official ${city} government sources for current STR regulations.`,
        permitRequired: false,
        primaryResidenceOnly: false,
        keyRequirements: [],
        summary: `Unable to parse regulation data for ${city}, ${state}.`,
        confidence: 'low',
        warnings: ['Could not parse structured data. Please verify with official sources.']
      };
    }

    // Create simplified summary
    const simplifiedSummary = createSimplifiedSummary(researchData, city, state);

    // Combine sources from grounding metadata with any URLs in the response
    const allSources = [...sources];
    if (researchData.officialSourceUrls && Array.isArray(researchData.officialSourceUrls)) {
      for (const url of researchData.officialSourceUrls) {
        if (typeof url === 'string' && url.startsWith('http') && !allSources.some(s => s.url === url)) {
          allSources.push({
            title: url.includes('.gov') ? `${city} Government - STR Regulations` : `${city} Official STR Regulations`,
            url,
            type: 'official',
            isOfficial: url.includes('.gov')
          });
        }
      }
    }
    
    // Filter to official and news sources only
    const filteredSources = allSources.filter(s => s.isOfficial || s.type === 'news');
    
    let finalSources = filteredSources.length > 0 
      ? filteredSources.slice(0, 6)
      : allSources.slice(0, 3);
    
    // Validate URLs to filter out 404 errors
    if (finalSources.length > 0) {
      console.log('[RegulationTracker] Validating source URLs...');
      finalSources = await validateSources(finalSources);
    }

    const result: RegulationSearchResult = {
      city,
      state: stateAbbrev,
      status: researchData.status || 'unknown',
      yesNoSummary: researchData.yesNoSummary || `Check official ${city} sources for current STR regulations.`,
      summary: researchData.summary || `Regulations for ${city}, ${state} - please verify with official sources.`,
      simplifiedSummary,
      keyRequirements: researchData.keyRequirements || [],
      permitRequired: researchData.permitRequired || false,
      primaryResidenceOnly: researchData.primaryResidenceOnly || false,
      maxNightsPerYear: researchData.maxNightsPerYear,
      registrationFee: researchData.registrationFee || 'Unknown',
      occupancyTax: researchData.occupancyTax || 'Unknown',
      zoningRestrictions: researchData.zoningRestrictions || 'Unknown',
      sources: finalSources.length > 0 ? finalSources : [{
        title: `Search ${city} STR Regulations`,
        url: `https://www.google.com/search?q=${encodeURIComponent(`${city} ${state} short term rental regulations site:gov`)}`,
        type: 'official',
        isOfficial: false
      }],
      lastUpdated: new Date().toISOString(),
      confidence: researchData.confidence || 'medium',
      warnings: [
        ...(researchData.warnings || []),
        "Verify with official city/county sources before investing."
      ].filter(Boolean) as string[]
    };

    // Cache the result
    await cacheRegulation(result);

    return result;
  } catch (error) {
    console.error('[RegulationTracker] Error:', error);
    
    return {
      city,
      state: stateAbbrev,
      status: 'unknown',
      yesNoSummary: `Unable to retrieve regulations for ${city}. Please check official city/county websites.`,
      summary: `Unable to retrieve current regulations for ${city}, ${state}. Please check official city/county websites.`,
      simplifiedSummary: `We couldn't find the current rules for ${city}. Please check the city's official website or contact their planning department.`,
      keyRequirements: [],
      permitRequired: false,
      primaryResidenceOnly: false,
      sources: [{
        title: `Search ${city} STR Regulations`,
        url: `https://www.google.com/search?q=${encodeURIComponent(`${city} ${state} short term rental regulations site:gov`)}`,
        type: 'official',
        isOfficial: false
      }],
      lastUpdated: new Date().toISOString(),
      confidence: 'low',
      warnings: [
        "Could not retrieve regulation data. Please verify with official sources.",
        error instanceof Error ? `Error: ${error.message}` : "Unknown error occurred"
      ]
    };
  }
}

// ============================================================================
// SIMPLIFIED SUMMARY - Professional but clear
// ============================================================================

function createSimplifiedSummary(data: any, city: string, state: string): string {
  const parts: string[] = [];
  
  // Opening statement based on status - direct and actionable
  switch (data.status) {
    case 'allowed':
      parts.push(`Yes, you can operate in ${city}. No permit required.`);
      break;
    case 'allowed_with_permit':
      parts.push(`Yes, you can operate in ${city} with a permit.`);
      break;
    case 'paused':
      parts.push(`${city} STR enforcement is currently paused. Check status before proceeding.`);
      break;
    case 'banned':
      parts.push(`No, STRs are not currently permitted in ${city}.`);
      break;
    case 'restricted':
      parts.push(`STRs allowed in ${city} with significant restrictions.`);
      break;
    case 'limited':
      parts.push(`STRs possible in ${city} but heavily regulated.`);
      break;
    case 'pending':
      parts.push(`${city} regulations are changing. Verify current rules before proceeding.`);
      break;
    default:
      parts.push(`STR regulations for ${city}:`);
  }
  
  // Primary residence - CRITICAL restriction, mention prominently
  if (data.primaryResidenceOnly) {
    parts.push(`IMPORTANT: Primary residence required - you must live in the property.`);
  }
  
  // Fees - actionable info
  if (data.registrationFee && data.registrationFee !== 'Unknown') {
    parts.push(`Permit fee: ${data.registrationFee}.`);
  }
  
  // Occupancy tax - actionable info
  if (data.occupancyTax && data.occupancyTax !== 'Unknown') {
    parts.push(`Occupancy tax: ${data.occupancyTax}.`);
  }
  
  // Key requirements count - brief
  if (data.keyRequirements && data.keyRequirements.length > 0) {
    parts.push(`${data.keyRequirements.length} requirements to follow (see details below).`);
  }
  
  // Closing - brief
  parts.push(`Verify with official sources before investing.`);
  
  return parts.join(' ');
}
