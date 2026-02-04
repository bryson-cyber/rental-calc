/**
 * Nurture Sequence Data Service
 * 
 * Fetches live market data from AirDNA for personalized email content.
 * Called via webhook before each email in the 7-day nurture sequence.
 */

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const AIRDNA_BASE_URL = 'https://api.airdna.co/api/enterprise/v2';
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_API_BASE = 'https://api.hubapi.com';

// ============================================================================
// TYPES
// ============================================================================

export interface MarketData {
  marketId: string;
  marketName: string;
  city: string;
  state: string;
  listingCount: number;
  avgAnnualRevenue: number;
  avgOccupancy: number;
  avgAdr: number;
  revenueTrend: 'up' | 'down' | 'stable';
  topPropertyType: string;
}

export interface MarketDeepDive {
  revenueByBedroom: Array<{ bedrooms: number; avgRevenue: number }>;
  seasonality: Array<{ month: string; occupancy: number; adr: number }>;
  peakSeason: string;
  lowSeason: string;
  yearOverYearGrowth: number;
}

export interface DealOpportunity {
  address: string;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  monthlyRevenue: number;
  monthlyRent: number;
  monthlyProfit: number;
  occupancy: number;
  adr: number;
  analysisUrl: string;
  zillowUrl?: string;
}

export interface TopPerformer {
  title: string;
  bedrooms: number;
  monthlyRevenue: number;
  annualRevenue: number;
  occupancy: number;
  adr: number;
  rating: number | null;
  reviews: number;
  airbnbUrl?: string;
}

export interface RegulationInfo {
  status: 'permitted' | 'restricted' | 'banned' | 'unknown';
  permitRequired: boolean;
  notes: string;
  arbitrageFriendly: boolean;
  recentChanges?: string;
}

export interface NurtureContactData {
  contactId: string;
  email: string;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
}

// ============================================================================
// HUBSPOT CONTACT FETCHING
// ============================================================================

/**
 * Fetch contact data from HubSpot including data_perfection_city/state
 */
export async function getContactData(contactId: string): Promise<NurtureContactData | null> {
  if (!HUBSPOT_API_KEY) {
    console.error('[NurtureService] HubSpot API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}?properties=email,firstname,lastname,data_perfection__city,data_perfection__state`,
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error(`[NurtureService] Failed to fetch contact: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const props = data.properties;

    return {
      contactId: data.id,
      email: props.email || '',
      firstName: props.firstname || '',
      lastName: props.lastname || '',
      city: props.data_perfection__city || '',
      state: props.data_perfection__state || ''
    };
  } catch (error) {
    console.error('[NurtureService] Error fetching contact:', error);
    return null;
  }
}

// ============================================================================
// AIRDNA MARKET DATA
// ============================================================================

// Import existing AirDNA functions to avoid duplication
import { 
  searchMarketsAPI,
  searchMarkets as searchMarketsLocal,
  getRentalizerEstimate, 
  getTopPerformers as getAirDNATopPerformers,
  getMarketDetails,
  getMarketHistoricalData,
  getMarketSeasonality
} from './airdna';

/**
 * Search for market ID by city name using existing AirDNA service
 * Uses API search first, then falls back to local market search
 */
async function searchMarket(city: string, state?: string): Promise<{ marketId: string; marketName: string; listingCount: number } | null> {
  const searchTerm = state ? `${city}, ${state}` : city;

  try {
    // Try API search first
    const results = await searchMarketsAPI(searchTerm, 5);
    
    if (results && results.length > 0) {
      const market = results[0];
      console.log(`[NurtureService] Found market via API: ${market.name} (${market.id}) - ${market.listing_count} listings`);
      return {
        marketId: market.id,
        marketName: market.name,
        listingCount: market.listing_count || 0
      };
    }
  } catch (error) {
    console.log(`[NurtureService] API search failed for "${searchTerm}", trying local search...`);
  }

  // Fallback to local market search (searches all US markets)
  try {
    const localResults = await searchMarketsLocal(searchTerm, 5);
    
    if (localResults && localResults.length > 0) {
      const market = localResults[0];
      console.log(`[NurtureService] Found market via local search: ${market.name} (${market.id})`);
      return {
        marketId: market.id,
        marketName: market.name,
        listingCount: market.listing_count || 0
      };
    }
  } catch (error) {
    console.error('[NurtureService] Local search also failed:', error);
  }

  console.error(`[NurtureService] Could not find market for: ${searchTerm}`);
  return null;
}

/**
 * Get market revenue metrics
 */
async function getMarketRevenue(marketId: string): Promise<{ avgRevenue: number; trend: 'up' | 'down' | 'stable' } | null> {
  if (!AIRDNA_API_KEY) return null;

  try {
    // Get last 12 months of data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    const response = await fetch(`${AIRDNA_BASE_URL}/market/${marketId}/revenue`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRDNA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filters: [],
        time_period: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const metrics = data.payload?.metrics || [];

    if (metrics.length === 0) return null;

    // Calculate average and trend
    const revenues = metrics.map((m: any) => m.revenue || m.value || 0);
    const avgRevenue = revenues.reduce((a: number, b: number) => a + b, 0) / revenues.length;

    // Compare first half to second half for trend
    const firstHalf = revenues.slice(0, Math.floor(revenues.length / 2));
    const secondHalf = revenues.slice(Math.floor(revenues.length / 2));
    const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (secondAvg > firstAvg * 1.05) trend = 'up';
    else if (secondAvg < firstAvg * 0.95) trend = 'down';

    return { avgRevenue, trend };
  } catch (error) {
    console.error('[NurtureService] Error fetching market revenue:', error);
    return null;
  }
}

/**
 * Get market occupancy metrics
 */
async function getMarketOccupancy(marketId: string): Promise<{ avgOccupancy: number; seasonality: Array<{ month: string; occupancy: number }> } | null> {
  if (!AIRDNA_API_KEY) return null;

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    const response = await fetch(`${AIRDNA_BASE_URL}/market/${marketId}/occupancy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRDNA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filters: [],
        time_period: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const metrics = data.payload?.metrics || [];

    if (metrics.length === 0) return null;

    const seasonality = metrics.map((m: any) => ({
      month: m.date || m.month,
      occupancy: m.occupancy || m.value || 0
    }));

    const avgOccupancy = seasonality.reduce((a: number, b: any) => a + b.occupancy, 0) / seasonality.length;

    return { avgOccupancy, seasonality };
  } catch (error) {
    console.error('[NurtureService] Error fetching market occupancy:', error);
    return null;
  }
}

/**
 * Get market ADR metrics
 */
async function getMarketAdr(marketId: string): Promise<{ avgAdr: number; seasonality: Array<{ month: string; adr: number }> } | null> {
  if (!AIRDNA_API_KEY) return null;

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    const response = await fetch(`${AIRDNA_BASE_URL}/market/${marketId}/adr`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRDNA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filters: [],
        time_period: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const metrics = data.payload?.metrics || [];

    if (metrics.length === 0) return null;

    const seasonality = metrics.map((m: any) => ({
      month: m.date || m.month,
      adr: m.adr || m.value || 0
    }));

    const avgAdr = seasonality.reduce((a: number, b: any) => a + b.adr, 0) / seasonality.length;

    return { avgAdr, seasonality };
  } catch (error) {
    console.error('[NurtureService] Error fetching market ADR:', error);
    return null;
  }
}

/**
 * Get active listings count
 */
async function getActiveListings(marketId: string): Promise<number | null> {
  if (!AIRDNA_API_KEY) return null;

  try {
    const response = await fetch(`${AIRDNA_BASE_URL}/market/${marketId}/active_listings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRDNA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filters: []
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.payload?.listing_count || data.payload?.count || null;
  } catch (error) {
    console.error('[NurtureService] Error fetching active listings:', error);
    return null;
  }
}

// ============================================================================
// TOP PERFORMERS
// ============================================================================

/**
 * Get top performing listings in a market using existing AirDNA service
 */
export async function getTopPerformers(city: string, state: string, limit: number = 5): Promise<TopPerformer[]> {
  try {
    // Use the existing getTopPerformers function from airdna.ts
    // First we need to get the market ID
    const market = await searchMarket(city, state);
    if (!market) {
      console.error(`[NurtureService] Could not find market for ${city}, ${state}`);
      return [];
    }

    // Use the existing function with correct options format
    const result = await getAirDNATopPerformers({
      marketId: market.marketId,
      limit: limit,
      sort_by: 'revenue'
    });

    return result.listings.map((l: any) => ({
      title: l.title || 'Untitled Listing',
      bedrooms: l.bedrooms || 0,
      monthlyRevenue: Math.round((l.annual_revenue || 0) / 12),
      annualRevenue: l.annual_revenue || 0,
      occupancy: l.occupancy || 0,
      adr: l.adr || 0,
      rating: l.rating || null,
      reviews: l.reviews || 0,
      airbnbUrl: l.airbnb_url || null
    }));
  } catch (error) {
    console.error('[NurtureService] Error fetching top performers:', error);
    return [];
  }
}

// ============================================================================
// DEAL FINDER
// ============================================================================

/**
 * Find a deal opportunity in the market
 * Uses existing Rentalizer service to estimate revenue for a sample property
 */
export async function findDealOpportunity(city: string, state: string): Promise<DealOpportunity | null> {
  try {
    // Get a sample address in the city (we'll use the city center)
    const sampleAddress = `${city}, ${state}`;

    // Get revenue estimate for a typical 3BR property using existing service
    const estimate = await getRentalizerEstimate({
      address: sampleAddress,
      bedrooms: 3,
      bathrooms: 2,
      accommodates: 6,
      currency: 'usd'
    });

    if (!estimate) {
      console.error(`[NurtureService] Rentalizer estimate failed for ${sampleAddress}`);
      return null;
    }

    // Calculate monthly figures from the response
    const annualRevenue = estimate.estimates?.annual_revenue || 0;
    const monthlyRevenue = Math.round(annualRevenue / 12);
    const occupancy = estimate.estimates?.occupancy_rate || 0.7;
    const adr = estimate.estimates?.average_daily_rate || 0;

    // Estimate rent (typically 40-50% of revenue for arbitrage)
    const monthlyRent = Math.round(monthlyRevenue * 0.55);
    const monthlyProfit = monthlyRevenue - monthlyRent;

    // Build analysis URL
    const analysisUrl = `https://coachinayahturnkeytool.com?step=5&address=${encodeURIComponent(sampleAddress)}&bedrooms=3&bathrooms=2&rent=${monthlyRent}&autoAnalyze=true`;

    return {
      address: sampleAddress,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'Single Family',
      monthlyRevenue,
      monthlyRent,
      monthlyProfit,
      occupancy: typeof occupancy === 'number' && occupancy < 1 ? occupancy * 100 : occupancy,
      adr,
      analysisUrl
    };
  } catch (error) {
    console.error('[NurtureService] Error finding deal opportunity:', error);
    return null;
  }
}

// ============================================================================
// REGULATION DATA
// ============================================================================

/**
 * Get regulation information for a city
 * Note: This is a simplified version - in production, you'd want a more comprehensive database
 */
export async function getRegulationInfo(city: string, state: string): Promise<RegulationInfo> {
  // Common regulation patterns by state
  const stateRegulations: Record<string, Partial<RegulationInfo>> = {
    'TX': { status: 'permitted', permitRequired: false, arbitrageFriendly: true, notes: 'Texas is generally STR-friendly with minimal state-level restrictions.' },
    'FL': { status: 'permitted', permitRequired: true, arbitrageFriendly: true, notes: 'Florida requires registration but is arbitrage-friendly in most areas.' },
    'AZ': { status: 'permitted', permitRequired: true, arbitrageFriendly: true, notes: 'Arizona has state preemption protecting STR rights.' },
    'TN': { status: 'permitted', permitRequired: true, arbitrageFriendly: true, notes: 'Tennessee allows STRs with local permits in most areas.' },
    'GA': { status: 'permitted', permitRequired: false, arbitrageFriendly: true, notes: 'Georgia has minimal STR restrictions at the state level.' },
    'NC': { status: 'permitted', permitRequired: true, arbitrageFriendly: true, notes: 'North Carolina allows STRs with local registration requirements.' },
    'CO': { status: 'permitted', permitRequired: true, arbitrageFriendly: true, notes: 'Colorado allows STRs with local licensing requirements.' },
    'CA': { status: 'restricted', permitRequired: true, arbitrageFriendly: false, notes: 'California has strict local regulations. Check city-specific rules carefully.' },
    'NY': { status: 'restricted', permitRequired: true, arbitrageFriendly: false, notes: 'New York has strict STR laws, especially in NYC. Verify local rules.' },
    'HI': { status: 'restricted', permitRequired: true, arbitrageFriendly: false, notes: 'Hawaii has strict STR regulations with limited permits available.' }
  };

  const stateInfo = stateRegulations[state.toUpperCase()] || {
    status: 'unknown',
    permitRequired: true,
    arbitrageFriendly: true,
    notes: `Regulations vary by city in ${state}. We recommend checking local ordinances before proceeding.`
  };

  return {
    status: stateInfo.status as 'permitted' | 'restricted' | 'banned' | 'unknown',
    permitRequired: stateInfo.permitRequired ?? true,
    notes: stateInfo.notes || '',
    arbitrageFriendly: stateInfo.arbitrageFriendly ?? true,
    recentChanges: undefined
  };
}

// ============================================================================
// MAIN DATA AGGREGATION
// ============================================================================

/**
 * Get complete market snapshot for Day 1 email
 */
export async function getMarketSnapshot(city: string, state: string): Promise<MarketData | null> {
  const market = await searchMarket(city, state);
  if (!market) {
    console.error(`[NurtureService] Could not find market for ${city}, ${state}`);
    return null;
  }

  try {
    // Use existing getMarketDetails function which has the metrics
    const marketDetails = await getMarketDetails(market.marketId);
    
    // Also get historical data for trend analysis
    const historicalData = await getMarketHistoricalData(market.marketId, 12);
    
    // Calculate trend from historical revenue data
    let revenueTrend: 'up' | 'down' | 'stable' = 'stable';
    if (historicalData && historicalData.revenue && historicalData.revenue.length >= 6) {
      const revenues = historicalData.revenue.map(r => r.value);
      const firstHalf = revenues.slice(0, Math.floor(revenues.length / 2));
      const secondHalf = revenues.slice(Math.floor(revenues.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      if (secondAvg > firstAvg * 1.05) revenueTrend = 'up';
      else if (secondAvg < firstAvg * 0.95) revenueTrend = 'down';
    }
    
    // Use market details metrics directly (they are annual/average values)
    // The historical data is monthly, so we use market details for the snapshot
    const avgOccupancy = marketDetails?.metrics?.booked 
      ? Math.round(marketDetails.metrics.booked * 100) // Convert decimal to percentage
      : 0;
    
    const avgAdr = marketDetails?.metrics?.daily_rate || 0;
    
    // Revenue from market details is annual revenue
    const avgRevenue = marketDetails?.metrics?.revenue || 0;

    return {
      marketId: market.marketId,
      marketName: market.marketName,
      city,
      state,
      listingCount: market.listingCount, // Use listing count from search result
      avgAnnualRevenue: Math.round(avgRevenue),
      avgOccupancy: avgOccupancy,
      avgAdr: Math.round(avgAdr),
      revenueTrend,
      topPropertyType: 'Entire Home'
    };
  } catch (error) {
    console.error(`[NurtureService] Error fetching market snapshot:`, error);
    return null;
  }
}

/**
 * Get deep dive data for Day 4 email
 */
export async function getMarketDeepDive(city: string, state: string): Promise<MarketDeepDive | null> {
  const market = await searchMarket(city, state);
  if (!market) return null;

  try {
    // Use existing functions
    const [historicalData, seasonalityData] = await Promise.all([
      getMarketHistoricalData(market.marketId, 12),
      getMarketSeasonality(market.marketId)
    ]);

    if (!historicalData) return null;

    // Build seasonality from data
    const seasonality = seasonalityData?.map(s => ({
      month: s.month,
      occupancy: s.occupancy || 0,
      adr: s.adr || 0
    })) || [];

    // If no seasonality data, build from historical
    if (seasonality.length === 0 && historicalData.occupancy && historicalData.adr) {
      for (let i = 0; i < Math.min(historicalData.occupancy.length, historicalData.adr.length); i++) {
        seasonality.push({
          month: historicalData.occupancy[i].date,
          occupancy: historicalData.occupancy[i].value,
          adr: historicalData.adr[i].value
        });
      }
    }

    // Find peak and low seasons
    const sortedByOccupancy = [...seasonality].sort((a, b) => b.occupancy - a.occupancy);
    const peakSeason = sortedByOccupancy[0]?.month || 'Summer';
    const lowSeason = sortedByOccupancy[sortedByOccupancy.length - 1]?.month || 'Winter';
    
    // Calculate average ADR for revenue estimates
    const avgAdr = historicalData.adr?.length
      ? historicalData.adr.reduce((a, b) => a + b.value, 0) / historicalData.adr.length
      : 200;

    // Calculate year-over-year growth from historical data
    let yearOverYearGrowth = 0;
    if (historicalData.revenue && historicalData.revenue.length >= 12) {
      const recentRevenue = historicalData.revenue.slice(-6).reduce((a, b) => a + b.value, 0) / 6;
      const olderRevenue = historicalData.revenue.slice(0, 6).reduce((a, b) => a + b.value, 0) / 6;
      if (olderRevenue > 0) {
        yearOverYearGrowth = Math.round(((recentRevenue - olderRevenue) / olderRevenue) * 100);
      }
    }

    return {
      revenueByBedroom: [
        { bedrooms: 1, avgRevenue: Math.round(avgAdr * 365 * 0.6 * 0.5) },
        { bedrooms: 2, avgRevenue: Math.round(avgAdr * 365 * 0.65 * 0.75) },
        { bedrooms: 3, avgRevenue: Math.round(avgAdr * 365 * 0.7) },
        { bedrooms: 4, avgRevenue: Math.round(avgAdr * 365 * 0.68 * 1.3) }
      ],
      seasonality,
      peakSeason,
      lowSeason,
      yearOverYearGrowth
    };
  } catch (error) {
    console.error(`[NurtureService] Error fetching market deep dive:`, error);
    return null;
  }
}

// ============================================================================
// HUBSPOT PROPERTY UPDATES
// ============================================================================

/**
 * Update HubSpot contact with nurture sequence data
 */
export async function updateNurtureProperties(
  contactId: string,
  emailType: 'day1' | 'day2' | 'day3' | 'day4' | 'day5' | 'day6' | 'day7',
  data: Record<string, string | number>
): Promise<boolean> {
  if (!HUBSPOT_API_KEY) {
    console.error('[NurtureService] HubSpot API key not configured');
    return false;
  }

  // Prefix all properties with nurture_ and the email type
  const properties: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    properties[`nurture_${key}`] = String(value);
  }

  // Add trigger property for the workflow
  properties[`nurture_${emailType}_trigger`] = 'send';

  try {
    const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[NurtureService] Failed to update contact: ${response.status}`, errorText);
      return false;
    }

    console.log(`[NurtureService] Updated contact ${contactId} with ${emailType} data`);
    return true;
  } catch (error) {
    console.error('[NurtureService] Error updating contact:', error);
    return false;
  }
}

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Day 1: Welcome + Market Snapshot
 */
export async function prepareDay1Email(contactId: string): Promise<boolean> {
  const contact = await getContactData(contactId);
  if (!contact || !contact.city) {
    console.error('[NurtureService] Contact not found or missing city');
    return false;
  }

  const marketData = await getMarketSnapshot(contact.city, contact.state);
  if (!marketData) {
    console.error('[NurtureService] Could not fetch market data');
    return false;
  }

  return updateNurtureProperties(contactId, 'day1', {
    market_name: marketData.marketName,
    city: marketData.city,
    state: marketData.state,
    listing_count: marketData.listingCount,
    avg_annual_revenue: marketData.avgAnnualRevenue,
    avg_monthly_revenue: Math.round(marketData.avgAnnualRevenue / 12),
    avg_occupancy: Math.round(marketData.avgOccupancy),
    avg_adr: Math.round(marketData.avgAdr),
    revenue_trend: marketData.revenueTrend
  });
}

/**
 * Day 2: Regulation Update
 */
export async function prepareDay2Email(contactId: string): Promise<boolean> {
  const contact = await getContactData(contactId);
  if (!contact || !contact.city) return false;

  const regulations = await getRegulationInfo(contact.city, contact.state);

  return updateNurtureProperties(contactId, 'day2', {
    city: contact.city,
    state: contact.state,
    regulation_status: regulations.status,
    permit_required: regulations.permitRequired ? 'Yes' : 'No',
    regulation_notes: regulations.notes,
    arbitrage_friendly: regulations.arbitrageFriendly ? 'Yes' : 'No'
  });
}

/**
 * Day 3: Deal Alert
 */
export async function prepareDay3Email(contactId: string): Promise<boolean> {
  const contact = await getContactData(contactId);
  if (!contact || !contact.city) return false;

  const deal = await findDealOpportunity(contact.city, contact.state);
  if (!deal) return false;

  return updateNurtureProperties(contactId, 'day3', {
    city: contact.city,
    state: contact.state,
    deal_address: deal.address,
    deal_bedrooms: deal.bedrooms,
    deal_bathrooms: deal.bathrooms,
    deal_monthly_revenue: deal.monthlyRevenue,
    deal_monthly_rent: deal.monthlyRent,
    deal_monthly_profit: deal.monthlyProfit,
    deal_occupancy: Math.round(deal.occupancy),
    deal_adr: Math.round(deal.adr),
    deal_analysis_url: deal.analysisUrl
  });
}

/**
 * Day 4: Market Deep Dive
 */
export async function prepareDay4Email(contactId: string): Promise<boolean> {
  const contact = await getContactData(contactId);
  if (!contact || !contact.city) return false;

  const deepDive = await getMarketDeepDive(contact.city, contact.state);
  if (!deepDive) return false;

  // Format revenue by bedroom for display
  const revenueByBedroom = deepDive.revenueByBedroom
    .map(r => `${r.bedrooms}BR: $${r.avgRevenue.toLocaleString()}`)
    .join(' | ');

  return updateNurtureProperties(contactId, 'day4', {
    city: contact.city,
    state: contact.state,
    revenue_by_bedroom: revenueByBedroom,
    peak_season: deepDive.peakSeason,
    low_season: deepDive.lowSeason,
    yoy_growth: deepDive.yearOverYearGrowth,
    '1br_revenue': deepDive.revenueByBedroom[0]?.avgRevenue || 0,
    '2br_revenue': deepDive.revenueByBedroom[1]?.avgRevenue || 0,
    '3br_revenue': deepDive.revenueByBedroom[2]?.avgRevenue || 0,
    '4br_revenue': deepDive.revenueByBedroom[3]?.avgRevenue || 0
  });
}

/**
 * Day 5: New Listings Alert
 * Note: This would integrate with Zillow/rental listing APIs
 */
export async function prepareDay5Email(contactId: string): Promise<boolean> {
  const contact = await getContactData(contactId);
  if (!contact || !contact.city) return false;

  // For now, we'll use the deal finder to get sample listings
  // In production, this would integrate with Zillow/Apartments.com APIs
  const deal = await findDealOpportunity(contact.city, contact.state);

  return updateNurtureProperties(contactId, 'day5', {
    city: contact.city,
    state: contact.state,
    new_listings_count: 5, // Placeholder
    sample_listing_address: deal?.address || `${contact.city}, ${contact.state}`,
    sample_listing_revenue: deal?.monthlyRevenue || 0,
    sample_listing_profit: deal?.monthlyProfit || 0
  });
}

/**
 * Day 6: Competitor Analysis
 */
export async function prepareDay6Email(contactId: string): Promise<boolean> {
  const contact = await getContactData(contactId);
  if (!contact || !contact.city) return false;

  const topPerformers = await getTopPerformers(contact.city, contact.state, 5);

  if (topPerformers.length === 0) return false;

  // Format top performers for email
  const properties: Record<string, string | number> = {
    city: contact.city,
    state: contact.state,
    top_performers_count: topPerformers.length
  };

  // Add individual performer data
  topPerformers.slice(0, 3).forEach((performer, i) => {
    const idx = i + 1;
    properties[`performer_${idx}_title`] = performer.title;
    properties[`performer_${idx}_revenue`] = performer.monthlyRevenue;
    properties[`performer_${idx}_occupancy`] = Math.round(performer.occupancy);
    properties[`performer_${idx}_rating`] = performer.rating || 0;
  });

  return updateNurtureProperties(contactId, 'day6', properties);
}

/**
 * Day 7: Webinar Reminder + Opportunity Summary
 */
export async function prepareDay7Email(contactId: string): Promise<boolean> {
  const contact = await getContactData(contactId);
  if (!contact || !contact.city) return false;

  // Get summary data
  const [marketData, deal] = await Promise.all([
    getMarketSnapshot(contact.city, contact.state),
    findDealOpportunity(contact.city, contact.state)
  ]);

  return updateNurtureProperties(contactId, 'day7', {
    city: contact.city,
    state: contact.state,
    market_avg_revenue: marketData?.avgAnnualRevenue || 0,
    market_avg_occupancy: Math.round(marketData?.avgOccupancy || 0),
    best_deal_profit: deal?.monthlyProfit || 0,
    best_deal_url: deal?.analysisUrl || '',
    webinar_date: 'Sunday', // Would be dynamic in production
    webinar_time: '2:00 PM EST' // Would be dynamic in production
  });
}

/**
 * Main webhook handler - routes to appropriate day handler
 */
export async function handleNurtureWebhook(
  contactId: string,
  emailDay: 1 | 2 | 3 | 4 | 5 | 6 | 7
): Promise<{ success: boolean; message: string }> {
  console.log(`[NurtureService] Processing Day ${emailDay} for contact ${contactId}`);

  const handlers: Record<number, (id: string) => Promise<boolean>> = {
    1: prepareDay1Email,
    2: prepareDay2Email,
    3: prepareDay3Email,
    4: prepareDay4Email,
    5: prepareDay5Email,
    6: prepareDay6Email,
    7: prepareDay7Email
  };

  const handler = handlers[emailDay];
  if (!handler) {
    return { success: false, message: `Invalid email day: ${emailDay}` };
  }

  try {
    const success = await handler(contactId);
    return {
      success,
      message: success
        ? `Day ${emailDay} data prepared successfully`
        : `Failed to prepare Day ${emailDay} data`
    };
  } catch (error) {
    console.error(`[NurtureService] Error processing Day ${emailDay}:`, error);
    return { success: false, message: `Error: ${error}` };
  }
}
