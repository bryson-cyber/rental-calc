/**
 * API Response Caching Layer
 * 
 * Provides in-memory caching for AirDNA API responses to reduce
 * redundant API calls and improve response times.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

class APICache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    oldestEntry: null,
    newestEntry: null
  };
  
  // Default TTLs for different types of data (in milliseconds)
  private readonly DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly TTL_CONFIG: Record<string, number> = {
    // Market data - changes slowly
    'market_details': 60 * 60 * 1000, // 1 hour
    'market_historical': 60 * 60 * 1000, // 1 hour
    'market_seasonality': 60 * 60 * 1000, // 1 hour
    'market_listings': 30 * 60 * 1000, // 30 minutes
    'submarket_details': 60 * 60 * 1000, // 1 hour
    'submarkets_in_market': 60 * 60 * 1000, // 1 hour
    
    // Property data - more dynamic
    'rentalizer': 15 * 60 * 1000, // 15 minutes
    'listing_comps': 15 * 60 * 1000, // 15 minutes
    'listing_pricing': 15 * 60 * 1000, // 15 minutes
    'property_details': 15 * 60 * 1000, // 15 minutes
    
    // Search results - moderate
    'search_markets': 30 * 60 * 1000, // 30 minutes
    'search_zipcode': 30 * 60 * 1000, // 30 minutes
    
    // Analysis results - cache longer since they're expensive
    'full_analysis': 60 * 60 * 1000, // 1 hour
    
    // AI analysis results - cache for 24 hours since they're expensive to generate
    'ai_analysis': 24 * 60 * 60 * 1000, // 24 hours
    'ai_narrative': 24 * 60 * 60 * 1000, // 24 hours
    'ai_structured': 24 * 60 * 60 * 1000, // 24 hours
  };
  
  /**
   * Generate a cache key from the function name and parameters
   */
  generateKey(functionName: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, unknown>);
    
    return `${functionName}:${JSON.stringify(sortedParams)}`;
  }
  
  /**
   * Get TTL for a specific cache type
   */
  private getTTL(cacheType: string): number {
    return this.TTL_CONFIG[cacheType] || this.DEFAULT_TTL;
  }
  
  /**
   * Check if a cache entry is still valid
   */
  private isValid(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }
  
  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      console.log(`[Cache] MISS: ${key.substring(0, 50)}...`);
      return null;
    }
    
    if (!this.isValid(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      console.log(`[Cache] EXPIRED: ${key.substring(0, 50)}...`);
      return null;
    }
    
    this.stats.hits++;
    console.log(`[Cache] HIT: ${key.substring(0, 50)}...`);
    return entry.data as T;
  }
  
  /**
   * Set a value in cache
   */
  set<T>(key: string, data: T, cacheType?: string): void {
    const ttl = cacheType ? this.getTTL(cacheType) : this.DEFAULT_TTL;
    const timestamp = Date.now();
    
    this.cache.set(key, {
      data,
      timestamp,
      ttl
    });
    
    this.stats.size = this.cache.size;
    
    if (!this.stats.oldestEntry || timestamp < this.stats.oldestEntry) {
      this.stats.oldestEntry = timestamp;
    }
    this.stats.newestEntry = timestamp;
    
    console.log(`[Cache] SET: ${key.substring(0, 50)}... (TTL: ${ttl / 1000}s)`);
  }
  
  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      oldestEntry: null,
      newestEntry: null
    };
    console.log('[Cache] CLEARED');
  }
  
  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();
    
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    this.stats.size = this.cache.size;
    console.log(`[Cache] CLEANUP: Removed ${cleaned} expired entries`);
    return cleaned;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: string } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) + '%' : '0%';
    
    return {
      ...this.stats,
      hitRate
    };
  }
  
  /**
   * Wrapper function to cache API calls
   */
  async cached<T>(
    key: string,
    cacheType: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch fresh data
    const data = await fetchFn();
    
    // Cache the result (only if not null/undefined)
    if (data !== null && data !== undefined) {
      this.set(key, data, cacheType);
    }
    
    return data;
  }
}

// Singleton instance
export const apiCache = new APICache();

// Start periodic cleanup every 5 minutes
setInterval(() => {
  apiCache.cleanup();
}, 5 * 60 * 1000);

// Export types
export type { CacheStats };
