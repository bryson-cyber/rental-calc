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
  // AirDNA updates data monthly, so 30 days is safe and reduces API calls significantly
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days default
  private readonly TTL_CONFIG: Record<string, number> = {
    // Market data - changes slowly (AirDNA updates monthly) - 30 days
    'market_details': 30 * 24 * 60 * 60 * 1000, // 30 days
    'market_historical': 30 * 24 * 60 * 60 * 1000, // 30 days
    'market_seasonality': 30 * 24 * 60 * 60 * 1000, // 30 days
    'market_listings': 30 * 24 * 60 * 60 * 1000, // 30 days
    'submarket_details': 30 * 24 * 60 * 60 * 1000, // 30 days
    'submarkets_in_market': 30 * 24 * 60 * 60 * 1000, // 30 days
    'submarket_seasonality': 30 * 24 * 60 * 60 * 1000, // 30 days
    'submarket_comprehensive': 30 * 24 * 60 * 60 * 1000, // 30 days
    'market_comprehensive': 30 * 24 * 60 * 60 * 1000, // 30 days
    'all_submarket_listings': 30 * 24 * 60 * 60 * 1000, // 30 days - paginated listings
    'all_market_listings': 30 * 24 * 60 * 60 * 1000, // 30 days - paginated listings
    
    // Property data - more dynamic (7 days)
    'rentalizer': 7 * 24 * 60 * 60 * 1000, // 7 days
    'listing_comps': 7 * 24 * 60 * 60 * 1000, // 7 days
    'listing_pricing': 7 * 24 * 60 * 60 * 1000, // 7 days
    'property_details': 7 * 24 * 60 * 60 * 1000, // 7 days
    
    // Search results - 30 days (markets don't change often)
    'search_markets': 30 * 24 * 60 * 60 * 1000, // 30 days
    'search_zipcode': 30 * 24 * 60 * 60 * 1000, // 30 days
    
    // Analysis results - cache for 30 days since they're expensive
    'full_analysis': 30 * 24 * 60 * 60 * 1000, // 30 days
    
    // AI analysis results - cache for 30 days since they're expensive to generate
    'ai_analysis': 30 * 24 * 60 * 60 * 1000, // 30 days
    'ai_narrative': 30 * 24 * 60 * 60 * 1000, // 30 days
    'ai_structured': 30 * 24 * 60 * 60 * 1000, // 30 days
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
   * Clear cache entries by prefix
   */
  clearByPrefix(prefix: string): number {
    let cleared = 0;
    const entries = Array.from(this.cache.keys());
    for (const key of entries) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    this.stats.size = this.cache.size;
    console.log(`[Cache] CLEARED ${cleared} entries with prefix: ${prefix}`);
    return cleared;
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
