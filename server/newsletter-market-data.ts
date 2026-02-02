/**
 * Newsletter Market Data Aggregation Service
 * 
 * Fetches and aggregates market data from AirDNA for newsletter content.
 * Used by the Deal Flow Machine to generate personalized market intelligence.
 */

import { 
  searchMarketsAPI, 
  getMarketDetails, 
  getSubmarketDetails,
  searchByZipcode,
  type MarketSearchResult,
  type ZipCodeSearchResult
} from './airdna';

export interface MarketSnapshot {
  city: string;
  state: string;
  marketId: string;
  marketName: string;
  metrics: {
    averageRevenue: number;
    averageDailyRate: number;
    occupancyRate: number;
    revpar: number;
    activeListings: number;
    marketScore: number;
  };
  trends: {
    revenueChange: number; // % change from last month
    occupancyChange: number;
    adrChange: number;
  };
  topPerformers: Array<{
    title: string;
    bedrooms: number;
    bathrooms: number;
    annualRevenue: number;
    occupancy: number;
    adr: number;
    rating: number | null;
    reviews: number;
    airbnbUrl?: string;
  }>;
  insights: {
    marketHealth: 'hot' | 'warm' | 'neutral' | 'cooling';
    bestBedroomCount: number;
    peakSeason: string;
    recommendation: string;
  };
  fetchedAt: Date;
}

/**
 * Get market snapshot for a city
 * This is the main function used by the newsletter system
 */
export async function getMarketSnapshotForCity(
  city: string, 
  state: string
): Promise<MarketSnapshot | null> {
  try {
    console.log(`[Newsletter] Fetching market data for ${city}, ${state}`);
    
    // Step 1: Search for the market
    const searchTerm = `${city}, ${state}`;
    const searchResults = await searchMarketsAPI(searchTerm, 5);
    
    if (searchResults.length === 0) {
      console.log(`[Newsletter] No market found for ${city}, ${state}`);
      return null;
    }
    
    // Find the best match
    const bestMatch = searchResults[0];
    console.log(`[Newsletter] Found market: ${bestMatch.name} (${bestMatch.id})`);
    
    // Step 2: Get market details
    let marketDetails;
    if (bestMatch.type === 'submarket') {
      marketDetails = await getSubmarketDetails(bestMatch.id);
    } else {
      marketDetails = await getMarketDetails(bestMatch.id);
    }
    
    if (!marketDetails) {
      console.log(`[Newsletter] Could not fetch details for market ${bestMatch.id}`);
      return null;
    }
    
    // Step 3: Build the market snapshot
    const metrics = marketDetails.metrics || {
      market_score: 0,
      revenue: 0,
      booked: 0,
      daily_rate: 0,
      revpar: 0
    };
    
    // Determine market health based on metrics
    let marketHealth: MarketSnapshot['insights']['marketHealth'] = 'neutral';
    const score = metrics.market_score || 0;
    const occupancy = metrics.booked || 0;
    
    if (score >= 80 && occupancy >= 0.65) {
      marketHealth = 'hot';
    } else if (score >= 60 && occupancy >= 0.50) {
      marketHealth = 'warm';
    } else if (score < 40 || occupancy < 0.35) {
      marketHealth = 'cooling';
    }
    
    // Generate recommendation based on market health
    let recommendation = '';
    switch (marketHealth) {
      case 'hot':
        recommendation = `${city} is a high-demand market with strong occupancy. Properties here are booking quickly - ideal for arbitrage opportunities.`;
        break;
      case 'warm':
        recommendation = `${city} shows solid performance with room for growth. Focus on properties with competitive amenities to stand out.`;
        break;
      case 'neutral':
        recommendation = `${city} is a stable market. Success depends on property quality and pricing strategy.`;
        break;
      case 'cooling':
        recommendation = `${city} is showing signs of cooling. Be selective and ensure strong profit margins before committing.`;
        break;
    }
    
    const snapshot: MarketSnapshot = {
      city,
      state,
      marketId: bestMatch.id,
      marketName: bestMatch.name,
      metrics: {
        averageRevenue: metrics.revenue || 0,
        averageDailyRate: metrics.daily_rate || 0,
        occupancyRate: metrics.booked || 0,
        revpar: metrics.revpar || 0,
        activeListings: marketDetails.listing_count || 0,
        marketScore: metrics.market_score || 0
      },
      trends: {
        revenueChange: 0, // Would need historical data to calculate
        occupancyChange: 0,
        adrChange: 0
      },
      topPerformers: [], // Would need separate API call
      insights: {
        marketHealth,
        bestBedroomCount: 2, // Default, would need bedroom performance data
        peakSeason: 'Summer', // Default, would need seasonal data
        recommendation
      },
      fetchedAt: new Date()
    };
    
    return snapshot;
  } catch (error) {
    console.error(`[Newsletter] Error fetching market data for ${city}, ${state}:`, error);
    return null;
  }
}

/**
 * Get market snapshot by zip code
 * More precise than city-level data
 */
export async function getMarketSnapshotByZipcode(zipcode: string): Promise<MarketSnapshot | null> {
  try {
    console.log(`[Newsletter] Fetching market data for zip code ${zipcode}`);
    
    const zipResult = await searchByZipcode(zipcode, { limit: 10 });
    
    if (!zipResult) {
      console.log(`[Newsletter] No market found for zip code ${zipcode}`);
      return null;
    }
    
    const metrics = zipResult.metrics || {
      revenue: 0,
      occupancy: 0,
      adr: 0,
      revpar: 0,
      active_listings: 0,
      market_score: 0
    };
    
    // Determine market health
    let marketHealth: MarketSnapshot['insights']['marketHealth'] = 'neutral';
    const score = metrics.market_score || 0;
    const occupancy = metrics.occupancy || 0;
    
    if (score >= 80 && occupancy >= 0.65) {
      marketHealth = 'hot';
    } else if (score >= 60 && occupancy >= 0.50) {
      marketHealth = 'warm';
    } else if (score < 40 || occupancy < 0.35) {
      marketHealth = 'cooling';
    }
    
    const marketName = zipResult.submarket?.name || zipResult.market?.name || zipResult.location;
    const marketId = zipResult.submarket?.id || zipResult.market?.id || zipcode;
    
    const snapshot: MarketSnapshot = {
      city: zipResult.location.split(',')[0]?.trim() || zipcode,
      state: zipResult.location.split(',')[1]?.trim() || '',
      marketId,
      marketName,
      metrics: {
        averageRevenue: metrics.revenue,
        averageDailyRate: metrics.adr,
        occupancyRate: metrics.occupancy,
        revpar: metrics.revpar,
        activeListings: metrics.active_listings,
        marketScore: metrics.market_score || 0
      },
      trends: {
        revenueChange: 0,
        occupancyChange: 0,
        adrChange: 0
      },
      topPerformers: (zipResult.top_performers || []).map(p => ({
        title: p.title,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        annualRevenue: p.annual_revenue,
        occupancy: p.occupancy,
        adr: p.adr,
        rating: p.rating,
        reviews: p.reviews,
        airbnbUrl: p.airbnb_url
      })),
      insights: {
        marketHealth,
        bestBedroomCount: 2,
        peakSeason: 'Summer',
        recommendation: `This zip code has ${metrics.active_listings} active listings with ${Math.round(metrics.occupancy * 100)}% average occupancy.`
      },
      fetchedAt: new Date()
    };
    
    return snapshot;
  } catch (error) {
    console.error(`[Newsletter] Error fetching market data for zip ${zipcode}:`, error);
    return null;
  }
}

/**
 * Batch fetch market snapshots for multiple cities
 * Used for weekly newsletter generation
 */
export async function batchGetMarketSnapshots(
  cities: Array<{ city: string; state: string; postalCode?: string }>
): Promise<Map<string, MarketSnapshot>> {
  const results = new Map<string, MarketSnapshot>();
  
  // Process in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < cities.length; i += batchSize) {
    const batch = cities.slice(i, i + batchSize);
    
    const promises = batch.map(async ({ city, state, postalCode }) => {
      const key = `${city.toUpperCase()}-${state.toUpperCase()}`;
      
      // Try zip code first if available (more precise)
      if (postalCode) {
        const snapshot = await getMarketSnapshotByZipcode(postalCode);
        if (snapshot) {
          results.set(key, snapshot);
          return;
        }
      }
      
      // Fall back to city search
      const snapshot = await getMarketSnapshotForCity(city, state);
      if (snapshot) {
        results.set(key, snapshot);
      }
    });
    
    await Promise.all(promises);
    
    // Small delay between batches
    if (i + batchSize < cities.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`[Newsletter] Fetched market data for ${results.size}/${cities.length} cities`);
  return results;
}

/**
 * Format market snapshot for email content
 */
export function formatMarketSnapshotForEmail(snapshot: MarketSnapshot): string {
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  const formatPercent = (n: number) => `${Math.round(n * 100)}%`;
  
  return `
📍 ${snapshot.city}, ${snapshot.state}

💰 Average Annual Revenue: ${formatCurrency(snapshot.metrics.averageRevenue)}
📊 Average Daily Rate: ${formatCurrency(snapshot.metrics.averageDailyRate)}
🏠 Occupancy Rate: ${formatPercent(snapshot.metrics.occupancyRate)}
⭐ Market Score: ${snapshot.metrics.marketScore}/100

${snapshot.insights.recommendation}
  `.trim();
}

// MarketSnapshot is already exported via the interface declaration above
