/**
 * API Response Caching Layer
 * 
 * Provides HYBRID caching for AirDNA API responses:
 * 1. In-memory cache for fast access
 * 2. Database-backed cache for persistence across server restarts
 * 
 * This prevents the ~113k API calls/month issue by ensuring cache
 * survives deployments and server restarts.
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
   * Get a value from cache (checks memory first, then database)
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
   * Get a value from cache with async database fallback
   * Use this when you need to check database cache on miss
   */
  async getAsync<T>(key: string): Promise<T | null> {
    // Check memory first
    const memResult = this.get<T>(key);
    if (memResult !== null) {
      return memResult;
    }
    
    // Check database cache
    try {
      const { getDbCache } = await import('./api-logger');
      const dbResult = await getDbCache<T>(key);
      if (dbResult !== null) {
        // Restore to memory cache
        this.cache.set(key, {
          data: dbResult,
          timestamp: Date.now(),
          ttl: this.DEFAULT_TTL
        });
        this.stats.size = this.cache.size;
        this.stats.hits++;
        console.log(`[Cache] DB HIT: ${key.substring(0, 50)}...`);
        return dbResult;
      }
    } catch (error) {
      console.warn('[Cache] DB check failed:', error);
    }
    
    return null;
  }
  
  /**
   * Set a value in cache (memory + database for persistence)
   */
  set<T>(key: string, data: T, cacheType?: string): void {
    const ttl = cacheType ? this.getTTL(cacheType) : this.DEFAULT_TTL;
    const timestamp = Date.now();
    
    // Set in memory cache
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
    
    // Also persist to database (async, don't block)
    this.persistToDb(key, cacheType || 'default', data, ttl).catch(err => {
      console.warn('[Cache] DB persist failed:', err);
    });
  }
  
  /**
   * Persist cache entry to database for cross-restart persistence
   */
  private async persistToDb<T>(key: string, cacheType: string, data: T, ttl: number): Promise<void> {
    try {
      const { setDbCache } = await import('./api-logger');
      await setDbCache(key, cacheType, data, ttl);
    } catch (error) {
      // Silently fail - memory cache still works
    }
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
   * Uses hybrid approach: check memory -> check DB -> fetch fresh
   */
  async cached<T>(
    key: string,
    cacheType: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    // 1. Check in-memory cache first (fastest)
    const memCached = this.get<T>(key);
    if (memCached !== null) {
      return memCached;
    }
    
    // 2. Check database cache (survives restarts)
    try {
      const { getDbCache, setDbCache, logApiCall } = await import('./api-logger');
      const dbCached = await getDbCache<T>(key);
      if (dbCached !== null) {
        // Restore to memory cache for faster subsequent access
        this.set(key, dbCached, cacheType);
        console.log(`[Cache] DB HIT: ${key.substring(0, 50)}...`);
        
        // Log as cache hit
        logApiCall({
          provider: 'airdna',
          endpoint: cacheType,
          success: true,
          cacheHit: true,
          source: 'db_cache',
        });
        
        return dbCached;
      }
    } catch (error) {
      console.warn('[Cache] DB cache check failed:', error);
    }
    
    // 3. Fetch fresh data
    const data = await fetchFn();
    
    // 4. Cache the result in both memory and database
    if (data !== null && data !== undefined) {
      this.set(key, data, cacheType);
      
      // Also save to database for persistence
      try {
        const { setDbCache } = await import('./api-logger');
        const ttl = this.getTTL(cacheType);
        await setDbCache(key, cacheType, data, ttl);
        console.log(`[Cache] DB SET: ${key.substring(0, 50)}...`);
      } catch (error) {
        console.warn('[Cache] DB cache set failed:', error);
      }
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
