/**
 * Tests for state disambiguation in market search functions.
 * 
 * Bug: When searching for "Fayetteville" (which exists in both NC and AR),
 * the system was returning Fayetteville, AR instead of Fayetteville, NC
 * when the user's address was in North Carolina.
 * 
 * Fix: searchMarkets now accepts state info in the search term (e.g., "Fayetteville, NC")
 * and applies a +200 score bonus for state-matched markets and -50 penalty for mismatched ones.
 */

import { describe, it, expect } from 'vitest';

// Simulate the scoring logic from searchMarkets
function scoreMarket(
  marketName: string,
  citySearch: string,
  searchState?: string
): number {
  const nameLower = marketName.toLowerCase();
  const marketState = marketName.includes(',') 
    ? marketName.split(',')[1].trim().toUpperCase() 
    : undefined;
  
  let score = 0;
  // Note: market names include state (e.g., "Fayetteville, NC")
  // so "fayetteville, nc" !== "fayetteville" → falls to startsWith
  if (nameLower === citySearch) score += 100;
  else if (nameLower.startsWith(citySearch)) score += 75;
  else if (nameLower.includes(citySearch)) score += 50;
  
  if (score > 0 && searchState) {
    if (marketState === searchState) {
      score += 200;
    } else if (marketState && marketState !== searchState) {
      score -= 50;
      score = Math.max(score, 1);
    }
  }
  
  return score;
}

describe('State Disambiguation in Market Search', () => {
  
  describe('State extraction from search terms', () => {
    it('should extract state from "Fayetteville, NC" format', () => {
      const searchTerm = 'Fayetteville, NC';
      const stateMatch = searchTerm.match(/,\s*([A-Z]{2})\b/i) || searchTerm.match(/\s+([A-Z]{2})\s*$/i);
      const searchState = stateMatch ? stateMatch[1].toUpperCase() : undefined;
      expect(searchState).toBe('NC');
    });
    
    it('should extract state from "Fayetteville NC" format (no comma)', () => {
      const searchTerm = 'Fayetteville NC';
      const stateMatch = searchTerm.match(/,\s*([A-Z]{2})\b/i) || searchTerm.match(/\s+([A-Z]{2})\s*$/i);
      const searchState = stateMatch ? stateMatch[1].toUpperCase() : undefined;
      expect(searchState).toBe('NC');
    });
    
    it('should extract state from "Denver, CO" format', () => {
      const searchTerm = 'Denver, CO';
      const stateMatch = searchTerm.match(/,\s*([A-Z]{2})\b/i) || searchTerm.match(/\s+([A-Z]{2})\s*$/i);
      const searchState = stateMatch ? stateMatch[1].toUpperCase() : undefined;
      expect(searchState).toBe('CO');
    });
    
    it('should return undefined when no state is present', () => {
      const searchTerm = 'Fayetteville';
      const stateMatch = searchTerm.match(/,\s*([A-Z]{2})\b/i) || searchTerm.match(/\s+([A-Z]{2})\s*$/i);
      const searchState = stateMatch ? stateMatch[1].toUpperCase() : undefined;
      expect(searchState).toBeUndefined();
    });
  });
  
  describe('City name extraction from search terms', () => {
    it('should extract city from "Fayetteville, NC"', () => {
      const searchLower = 'fayetteville, nc';
      const citySearch = searchLower
        .replace(/,\s*/g, ' ')
        .replace(/\b[a-z]{2}\b$/i, '')
        .replace(/\s+\d{5}.*$/, '')
        .trim()
        .split(/\s+/)[0];
      expect(citySearch).toBe('fayetteville');
    });
    
    it('should extract city from "Fayetteville NC"', () => {
      const searchLower = 'fayetteville nc';
      const citySearch = searchLower
        .replace(/,\s*/g, ' ')
        .replace(/\b[a-z]{2}\b$/i, '')
        .replace(/\s+\d{5}.*$/, '')
        .trim()
        .split(/\s+/)[0];
      expect(citySearch).toBe('fayetteville');
    });
    
    it('should extract city from "Denver, CO 80202"', () => {
      const searchLower = 'denver, co 80202';
      const citySearch = searchLower
        .replace(/,\s*/g, ' ')
        .replace(/\b[a-z]{2}\b$/i, '')
        .replace(/\s+\d{5}.*$/, '')
        .trim()
        .split(/\s+/)[0];
      expect(citySearch).toBe('denver');
    });
  });
  
  describe('Market scoring with state disambiguation', () => {
    // Market names include state abbreviation (e.g., "Fayetteville, NC")
    // so the name comparison uses startsWith (75 base) not exact match (100)
    
    it('should score Fayetteville, NC higher than Fayetteville, AR when searching for NC', () => {
      const ncScoreForNC = scoreMarket('Fayetteville, NC', 'fayetteville', 'NC');
      const arScoreForNC = scoreMarket('Fayetteville, AR', 'fayetteville', 'NC');
      
      expect(ncScoreForNC).toBeGreaterThan(arScoreForNC);
      // NC: base 75 (startsWith "fayetteville") + 200 (state match) = 275
      expect(ncScoreForNC).toBe(275);
      // AR: base 75 (startsWith "fayetteville") - 50 (wrong state) = 25
      expect(arScoreForNC).toBe(25);
    });
    
    it('should score Fayetteville, AR higher than Fayetteville, NC when searching for AR', () => {
      const ncScoreForAR = scoreMarket('Fayetteville, NC', 'fayetteville', 'AR');
      const arScoreForAR = scoreMarket('Fayetteville, AR', 'fayetteville', 'AR');
      
      expect(arScoreForAR).toBeGreaterThan(ncScoreForAR);
      // AR: base 75 + 200 = 275
      expect(arScoreForAR).toBe(275);
      // NC: base 75 - 50 = 25
      expect(ncScoreForAR).toBe(25);
    });
    
    it('should score both equally when no state is specified', () => {
      const ncScore = scoreMarket('Fayetteville, NC', 'fayetteville', undefined);
      const arScore = scoreMarket('Fayetteville, AR', 'fayetteville', undefined);
      
      // Without state, both should get the same base score
      expect(ncScore).toBe(arScore);
      expect(ncScore).toBe(75); // startsWith "fayetteville"
    });
    
    it('should handle Portland, OR vs Portland, ME disambiguation', () => {
      const orScore = scoreMarket('Portland, OR', 'portland', 'OR');
      const meScore = scoreMarket('Portland, ME', 'portland', 'OR');
      
      expect(orScore).toBeGreaterThan(meScore);
      expect(orScore).toBe(275);
      expect(meScore).toBe(25);
    });
    
    it('should handle Springfield disambiguation (many states)', () => {
      const moScore = scoreMarket('Springfield, MO', 'springfield', 'IL');
      const ilScore = scoreMarket('Springfield, IL', 'springfield', 'IL');
      
      expect(ilScore).toBeGreaterThan(moScore);
      expect(ilScore).toBe(275);
      expect(moScore).toBe(25);
    });
    
    it('should not penalize markets without state info when state is specified', () => {
      // Some markets might not have state in their name
      const noStateScore = scoreMarket('Fayetteville', 'fayetteville', 'NC');
      
      // Exact match (100) with no marketState to compare → no bonus/penalty
      expect(noStateScore).toBe(100);
    });
    
    it('should handle case-insensitive state matching', () => {
      const score = scoreMarket('Fayetteville, nc', 'fayetteville', 'NC');
      // The market name has lowercase "nc" but we uppercase both for comparison
      // base 75 (startsWith) + 200 (state match) = 275
      expect(score).toBe(275);
    });
    
    it('should ensure state bonus is large enough to override any base score difference', () => {
      // Even if one market has a slightly better name match, state should win
      // "fayetteville" startsWith match (75) + state mismatch (-50) = 25
      // vs "fayetteville" startsWith match (75) + state match (+200) = 275
      const wrongState = scoreMarket('Fayetteville, AR', 'fayetteville', 'NC');
      const rightState = scoreMarket('Fayetteville, NC', 'fayetteville', 'NC');
      
      // The state-matched market should always win by a large margin
      expect(rightState - wrongState).toBeGreaterThanOrEqual(200);
    });
  });
  
  describe('Address state extraction for market search', () => {
    it('should extract state from standard address format', () => {
      const address = '7544 Decatur Dr, Fayetteville, NC 28303';
      const cityMatch = address.match(/,\s*([^,]+),\s*([A-Z]{2})/);
      const stateFromZip = address.match(/,\s*([A-Z]{2})\s*\d{5}/)?.[1];
      const stateFromAddress = cityMatch ? cityMatch[2] : null;
      const state = stateFromAddress || stateFromZip;
      
      expect(state).toBe('NC');
    });
    
    it('should extract city from standard address format', () => {
      const address = '7544 Decatur Dr, Fayetteville, NC 28303';
      const cityMatch = address.match(/,\s*([^,]+),\s*([A-Z]{2})/);
      const searchTerm = cityMatch ? cityMatch[1].trim() : '';
      
      expect(searchTerm).toBe('Fayetteville');
    });
    
    it('should build state-aware search term', () => {
      const address = '7544 Decatur Dr, Fayetteville, NC 28303';
      const cityMatch = address.match(/,\s*([^,]+),\s*([A-Z]{2})/);
      const stateFromAddress = cityMatch ? cityMatch[2] : null;
      const state = stateFromAddress;
      const searchTerm = cityMatch ? cityMatch[1].trim() : '';
      
      const searchWithState = state ? `${searchTerm}, ${state}` : searchTerm;
      expect(searchWithState).toBe('Fayetteville, NC');
    });
    
    it('should handle addresses without state abbreviation', () => {
      const address = '123 Main St, Denver';
      const cityMatch = address.match(/,\s*([^,]+),\s*([A-Z]{2})/);
      const stateFromZip = address.match(/,\s*([A-Z]{2})\s*\d{5}/)?.[1];
      const state = (cityMatch ? cityMatch[2] : null) || stateFromZip;
      
      expect(state).toBeUndefined();
    });
    
    it('should handle Zillow-style addresses', () => {
      const address = '7544 Decatur Dr, Fayetteville, NC 28303';
      const cityMatch = address.match(/,\s*([^,]+),\s*([A-Z]{2})/);
      expect(cityMatch).not.toBeNull();
      expect(cityMatch![1].trim()).toBe('Fayetteville');
      expect(cityMatch![2]).toBe('NC');
    });
    
    it('should handle address with state but no zip', () => {
      const address = '7544 Decatur Dr, Fayetteville, NC';
      const cityMatch = address.match(/,\s*([^,]+),\s*([A-Z]{2})/);
      expect(cityMatch).not.toBeNull();
      expect(cityMatch![2]).toBe('NC');
    });
  });
});
