/**
 * Regulation Tracker Service
 * 
 * Provides real-time STR regulation lookup using Gemini API with Google Search grounding
 * and simplifies regulations to 3rd-grade reading level.
 */

import { ENV } from "./_core/env";

// Types for regulation data
export interface RegulationSearchResult {
  city: string;
  state: string;
  status: 'allowed' | 'restricted' | 'banned' | 'paused' | 'pending' | 'unknown';
  summary: string;
  simplifiedSummary: string; // 3rd-grade reading level
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
}

export interface RegulationSource {
  title: string;
  url: string;
  type: 'official' | 'news' | 'third_party';
  date?: string;
  snippet?: string;
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
      groundingSupports?: Array<{
        segment?: {
          startIndex?: number;
          endIndex?: number;
          text?: string;
        };
        groundingChunkIndices?: number[];
      }>;
    };
  }>;
  error?: {
    message?: string;
    code?: number;
  };
}

// Call Gemini API directly with Google Search grounding
async function callGeminiWithSearch(prompt: string, systemPrompt?: string): Promise<{
  text: string;
  sources: RegulationSource[];
}> {
  const apiKey = ENV.geminiApiKey;
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      ...(systemPrompt ? [{
        role: "user",
        parts: [{ text: `System instruction: ${systemPrompt}` }]
      }, {
        role: "model",
        parts: [{ text: "I understand. I will follow these instructions." }]
      }] : []),
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    tools: [{
      google_search: {}
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    }
  };

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

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  // Extract sources from grounding metadata
  const sources: RegulationSource[] = [];
  const groundingChunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  
  for (const chunk of groundingChunks) {
    if (chunk.web?.uri && chunk.web?.title) {
      sources.push({
        title: chunk.web.title,
        url: chunk.web.uri,
        type: chunk.web.uri.includes('.gov') ? 'official' : 
              chunk.web.uri.includes('news') || chunk.web.uri.includes('article') ? 'news' : 'third_party'
      });
    }
  }

  return { text, sources };
}

// Call Gemini without search for simplification
async function callGeminiSimple(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = ENV.geminiApiKey;
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      ...(systemPrompt ? [{
        role: "user",
        parts: [{ text: `System instruction: ${systemPrompt}` }]
      }, {
        role: "model",
        parts: [{ text: "I understand. I will follow these instructions." }]
      }] : []),
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data: GeminiResponse = await response.json();
  
  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Use Gemini with Google Search to research and simplify regulations
export async function getRegulationInfo(
  city: string,
  state: string
): Promise<RegulationSearchResult> {
  const stateAbbrev = getStateAbbreviation(state) || state;
  
  // Use Gemini with Google Search grounding to find CURRENT regulations
  const researchPrompt = `Search for the CURRENT (2024-2026) short-term rental (Airbnb/VRBO) regulations for ${city}, ${state}.

IMPORTANT: I need REAL-TIME, UP-TO-DATE information. Search for:
- "${city} ${state} short term rental regulations 2024 2025"
- "${city} ${state} Airbnb ordinance"
- "${city} ${state} STR permit requirements"
- Official city/county government sources

Find and report:
1. Current regulation STATUS - Is STR allowed, restricted, banned, paused, or pending?
2. Are permits/licenses required? What type?
3. Primary residence requirements (must owner live there?)
4. Night limits per year (if any)
5. Registration/permit fees
6. Occupancy/lodging taxes
7. Zoning restrictions
8. ANY recent changes, pauses, moratoriums, or pending legislation
9. Enforcement status - is the city actively enforcing?

Format your response as JSON:
{
  "status": "allowed|restricted|banned|paused|pending|unknown",
  "permitRequired": true/false,
  "permitType": "description of permit type if required",
  "primaryResidenceOnly": true/false,
  "maxNightsPerYear": number or null,
  "registrationFee": "amount or 'None' or 'Unknown'",
  "occupancyTax": "percentage or 'None' or 'Unknown'",
  "zoningRestrictions": "description or 'None'",
  "keyRequirements": ["requirement 1", "requirement 2", ...],
  "summary": "2-3 sentence professional summary of the current regulations",
  "recentChanges": "any recent changes, pauses, moratoriums, or pending legislation",
  "enforcementStatus": "active|paused|limited|unknown",
  "confidence": "high|medium|low",
  "warnings": ["any important warnings or caveats"]
}`;

  try {
    console.log(`[RegulationTracker] Searching regulations for ${city}, ${state}...`);
    
    // Call Gemini with Google Search grounding
    const { text: researchText, sources } = await callGeminiWithSearch(
      researchPrompt,
      "You are an expert researcher on short-term rental regulations. Use Google Search to find the most current, accurate information from official government sources. Be specific about dates and cite your sources."
    );

    console.log('[RegulationTracker] Research response received, parsing...');
    
    // Extract JSON from the response
    let researchData: any = {};
    try {
      // Try to find JSON in the response
      const jsonMatch = researchText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        researchData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error('[RegulationTracker] Failed to parse JSON, using defaults:', parseError);
      // If parsing fails, try to extract key information from text
      researchData = {
        status: researchText.toLowerCase().includes('banned') ? 'banned' :
                researchText.toLowerCase().includes('paused') ? 'paused' :
                researchText.toLowerCase().includes('restricted') ? 'restricted' :
                researchText.toLowerCase().includes('allowed') ? 'allowed' : 'unknown',
        permitRequired: researchText.toLowerCase().includes('permit') || researchText.toLowerCase().includes('license'),
        primaryResidenceOnly: researchText.toLowerCase().includes('primary residence'),
        maxNightsPerYear: null,
        registrationFee: 'Unknown',
        occupancyTax: 'Unknown',
        zoningRestrictions: 'Unknown',
        keyRequirements: [],
        summary: researchText.slice(0, 500),
        recentChanges: '',
        confidence: 'low',
        warnings: ['Could not parse structured data. Please verify with official sources.']
      };
    }

    // Now simplify to 3rd-grade reading level
    const simplifyPrompt = `Take this short-term rental regulation information and rewrite it so a 3rd grader (8-9 year old) can understand it. Use simple words, short sentences, and explain any confusing terms.

City: ${city}, ${state}
Status: ${researchData.status}
Summary: "${researchData.summary || 'No summary available'}"

Key requirements:
${(researchData.keyRequirements || []).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n') || 'None listed'}

Recent changes: ${researchData.recentChanges || 'None'}

Write a simple explanation (3-5 sentences) that covers:
1. Can you rent your home to visitors? (yes/no/sometimes)
2. What do you need to do first? (permits, registration)
3. Are there any limits? (how many nights, where)
4. How much does it cost? (fees, taxes)

Use words like "you", "your home", "visitors", "permission", "rules". Avoid legal jargon. Be friendly and clear.`;

    const simplifiedSummary = await callGeminiSimple(
      simplifyPrompt,
      "You are a teacher who explains complex topics to young children. Use simple words, short sentences, and friendly language. Never use legal jargon."
    );

    console.log('[RegulationTracker] Simplification complete');

    return {
      city,
      state: stateAbbrev,
      status: researchData.status || 'unknown',
      summary: researchData.summary || `Regulations for ${city}, ${state} - please verify with official sources.`,
      simplifiedSummary: simplifiedSummary || `We found some rules about renting your home in ${city}. Please check with the city to make sure you understand them.`,
      keyRequirements: researchData.keyRequirements || [],
      permitRequired: researchData.permitRequired || false,
      primaryResidenceOnly: researchData.primaryResidenceOnly || false,
      maxNightsPerYear: researchData.maxNightsPerYear,
      registrationFee: researchData.registrationFee || 'Unknown',
      occupancyTax: researchData.occupancyTax || 'Unknown',
      zoningRestrictions: researchData.zoningRestrictions || 'Unknown',
      sources: sources.length > 0 ? sources : [{
        title: `${city} Official Website`,
        url: `https://www.google.com/search?q=${encodeURIComponent(`${city} ${state} short term rental regulations official`)}`,
        type: 'third_party'
      }],
      lastUpdated: new Date().toISOString(),
      confidence: researchData.confidence || 'medium',
      warnings: [
        ...(researchData.warnings || []),
        researchData.recentChanges ? `Recent changes: ${researchData.recentChanges}` : null,
        "This information is for educational purposes only. Always verify with official city/county sources before making investment decisions."
      ].filter(Boolean) as string[]
    };
  } catch (error) {
    console.error('[RegulationTracker] Error fetching regulations:', error);
    
    return {
      city,
      state: stateAbbrev,
      status: 'unknown',
      summary: `Unable to retrieve current regulations for ${city}, ${state}. Please check official city/county websites.`,
      simplifiedSummary: `We couldn't find the rules for renting your home in ${city}. You should ask the city government directly.`,
      keyRequirements: [],
      permitRequired: false,
      primaryResidenceOnly: false,
      sources: [{
        title: `Search for ${city} STR Regulations`,
        url: `https://www.google.com/search?q=${encodeURIComponent(`${city} ${state} short term rental regulations`)}`,
        type: 'third_party'
      }],
      lastUpdated: new Date().toISOString(),
      confidence: 'low',
      warnings: [
        "Could not retrieve regulation data. Please verify with official sources.",
        "Contact your local city/county government for accurate information.",
        error instanceof Error ? `Error: ${error.message}` : "Unknown error occurred"
      ]
    };
  }
}

// Helper function to get state abbreviation
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
  
  // If already an abbreviation, return as-is
  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }
  
  return stateMap[normalized] || state;
}
