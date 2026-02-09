import { describe, it, expect } from 'vitest';
import { generateFullArbitrageAnalysis } from '../sop-reports';

describe('Data Fields Check', () => {
  it('should return all new data fields', async () => {
    // Pass parameters as positional arguments, not an object
    const result = await generateFullArbitrageAnalysis(
      '1321 15th St, Denver, CO',  // address
      2500,                         // monthly_rent
      3,                            // bedrooms
      2                             // bathrooms
    );
    
    console.log('=== Data Fields Present ===');
    console.log('five_year_summary:', result.five_year_summary ? 'YES' : 'NO');
    console.log('supply_trend:', result.supply_trend ? 'YES' : 'NO');
    console.log('professional_host_stats:', result.professional_host_stats ? 'YES' : 'NO');
    console.log('booking_patterns:', result.booking_patterns ? 'YES' : 'NO');
    console.log('market_saturation:', result.market_saturation ? 'YES' : 'NO');
    console.log('market_insights:', result.market_insights ? 'YES' : 'NO');
    console.log('qualifying_competitors:', result.qualifying_competitors ? 'YES' : 'NO');
    console.log('radius_listings:', result.radius_listings ? 'YES' : 'NO');
    console.log('property_type_analysis:', result.property_type_analysis ? 'YES' : 'NO');
    console.log('nearby_markets:', result.nearby_markets ? 'YES' : 'NO');
    console.log('airdna_feasibility:', result.airdna_feasibility ? 'YES' : 'NO');
    
    // Check competitor fields
    if (result.competitors && result.competitors.length > 0) {
      const comp = result.competitors[0];
      console.log('\n=== Competitor Fields ===');
      console.log('is_superhost:', comp.is_superhost !== undefined ? 'YES' : 'NO');
      console.log('is_professional:', comp.is_professional !== undefined ? 'YES' : 'NO');
      console.log('property_type:', comp.property_type ? 'YES' : 'NO');
      console.log('similarity_score:', comp.similarity_score !== undefined ? 'YES' : 'NO');
    }
    
    expect(result).toBeTruthy();
  }, 300000);
});
