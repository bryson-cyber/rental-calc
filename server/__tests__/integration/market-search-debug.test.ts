import { describe, it, expect } from 'vitest';
import { searchMarkets } from '../airdna';

describe('Market Search Debug', () => {
  it('should find San Diego when searching for "San Diego"', async () => {
    const results = await searchMarkets('San Diego', 10);
    console.log('Search results for "San Diego":', results);
    
    expect(results.length).toBeGreaterThan(0);
    
    // The first result should be San Diego, not San Juan
    const firstResult = results[0];
    console.log('First result:', firstResult);
    
    expect(firstResult.name.toLowerCase()).toContain('san diego');
    expect(firstResult.name.toLowerCase()).not.toContain('san juan');
  }, 30000);
  
  it('should list all markets containing "san"', async () => {
    const results = await searchMarkets('san', 20);
    console.log('All "san" markets:', results.map(r => r.name));
    
    // Check what San markets exist
    const sanDiego = results.find(r => r.name.toLowerCase().includes('san diego'));
    const sanJuan = results.find(r => r.name.toLowerCase().includes('san juan'));
    
    console.log('San Diego found:', sanDiego);
    console.log('San Juan found:', sanJuan);
  }, 30000);
});
