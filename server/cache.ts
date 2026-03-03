/**
 * API Response Caching Layer
 * 
 * Provides HYBRID caching for AirDNA API responses:
 * 1. In-memory LRU cache (max 500 entries) for fast access
 * 2. Database-backed cache for persistence across server restarts
 * 
 * This prevents unnecessary API calls by ensuring cache
 * survives deployments and server restarts.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  lastAccessed: number; // For LRU eviction
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

class APICache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly MAX_ENTRIES = 500; // LRU eviction threshold
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    evictions: 0,
    oldestEntry: null,
    newestEntry: null
  };
  
  // Default TTLs for different types of data (in milliseconds)
  // AirDNA updates data monthly, so 30 days is safe and reduces API calls significantly
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days default
  private readonly TTL_CONFIG: Record<string, number> = {
    // Market data - changes slowly (AirDNA updates monthly) - 30 days
    'market_details': 30 * 24 * 60 * 60 * 1000,
    'market_historical': 30 * 24 * 60 * 60 * 1000,
    'market_seasonality': 30 * 24 * 60 * 60 * 1000,
    'market_listings': 30 * 24 * 60 * 60 * 1000,
    'submarket_details': 30 * 24 * 60 * 60 * 1000,
    'submarkets_in_market': 30 * 24 * 60 * 60 * 1000,
    'submarket_seasonality': 30 * 24 * 60 * 60 * 1000,
    'submarket_comprehensive': 30 * 24 * 60 * 60 * 1000,
    'market_comprehensive': 30 * 24 * 60 * 60 * 1000,
    'all_submarket_listings': 30 * 24 * 60 * 60 * 1000,
    'all_market_listings': 30 * 24 * 60 * 60 * 1000,
    
    // Property data - 14 days (balances freshness vs API conservation)
    'rentalizer': 14 * 24 * 60 * 60 * 1000,
    'listing_comps': 14 * 24 * 60 * 60 * 1000,
    'listing_pricing': 14 * 24 * 60 * 60 * 1000,
    'property_details': 14 * 24 * 60 * 60 * 1000,
    'single_property': 30 * 24 * 60 * 60 * 1000, // Images/details rarely change
    'listing_details': 14 * 24 * 60 * 60 * 1000,
    'listing_historical': 14 * 24 * 60 * 60 * 1000,
    'listing_future_pricing': 7 * 24 * 60 * 60 * 1000,
    'listings_in_radius': 14 * 24 * 60 * 60 * 1000,
    'enhanced_rentalizer': 14 * 24 * 60 * 60 * 1000,
    'rentalizer_comps': 14 * 24 * 60 * 60 * 1000,
    
    // Static reference data - 30 days (US market list barely changes)
    'all_us_markets': 30 * 24 * 60 * 60 * 1000,
    
    // Search results - 30 days (markets don't change often)
    'search_markets': 30 * 24 * 60 * 60 * 1000,
    'search_zipcode': 30 * 24 * 60 * 60 * 1000,
    
    // Hierarchy data - 30 days (market structure rarely changes)
    'state_markets': 30 * 24 * 60 * 60 * 1000,
    'market_search_hierarchy': 30 * 24 * 60 * 60 * 1000,
    'zipcode_lookup': 30 * 24 * 60 * 60 * 1000,
    
    // Analysis results - cache for 30 days since they're expensive
    'full_analysis': 30 * 24 * 60 * 60 * 1000,
    
    // AI analysis results - cache for 30 days since they're expensive to generate
    'ai_analysis': 30 * 24 * 60 * 60 * 1000,
    'ai_narrative': 30 * 24 * 60 * 60 * 1000,
    'ai_structured': 30 * 24 * 60 * 60 * 1000,
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
  getTTL(cacheType: string): number {
    return this.TTL_CONFIG[cacheType] || this.DEFAULT_TTL;
  }
  
  /**
   * Check if a cache entry is still valid.
   * In webinar mode, all entries are considered valid (expired entries are served).
   */
  private isValid(entry: CacheEntry<unknown>): boolean {
    // Lazy import to avoid circular dependency
    try {
      const { isWebinarMode } = require('./webinar-cache');
      if (isWebinarMode()) return true; // Serve expired entries in webinar mode
    } catch { /* module not loaded yet */ }
    return Date.now() - entry.timestamp < entry.ttl;
  }
  
  /**
   * Evict the least recently accessed entry when cache exceeds MAX_ENTRIES
   */
  private evictLRU(): void {
    if (this.cache.size <= this.MAX_ENTRIES) return;
    
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;
    
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
      console.log(`[Cache] LRU EVICT: ${oldestKey.substring(0, 50)}...`);
    }
  }
  
  /**
   * Set a value in memory cache ONLY (no DB persist).
   * Used when restoring from DB cache to avoid writing back what we just read.
   */
  private setMemoryOnly<T>(key: string, data: T, cacheType?: string): void {
    const ttl = cacheType ? this.getTTL(cacheType) : this.DEFAULT_TTL;
    const now = Date.now();
    
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl,
      lastAccessed: now
    });
    
    this.stats.size = this.cache.size;
    this.evictLRU();
  }
  
  /**
   * Get a value from memory cache only (sync)
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    if (!this.isValid(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      return null;
    }
    
    // Update last accessed time for LRU tracking
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    return entry.data as T;
  }
  
  /**
   * Get a value from cache with async database fallback.
   * On DB hit, restores to memory only (no double DB write).
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
        // Restore to memory ONLY — don't write back to DB (it's already there)
        this.setMemoryOnly(key, dbResult);
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
    const now = Date.now();
    
    // Set in memory cache
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl,
      lastAccessed: now
    });
    
    this.stats.size = this.cache.size;
    
    if (!this.stats.oldestEntry || now < this.stats.oldestEntry) {
      this.stats.oldestEntry = now;
    }
    this.stats.newestEntry = now;
    
    // Evict LRU if over limit
    this.evictLRU();
    
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
      evictions: 0,
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
   * Clean up expired entries from memory
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
    console.log(`[Cache] CLEANUP: Removed ${cleaned} expired entries (${this.cache.size} remaining, max ${this.MAX_ENTRIES})`);
    return cleaned;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: string; maxEntries: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) + '%' : '0%';
    
    return {
      ...this.stats,
      hitRate,
      maxEntries: this.MAX_ENTRIES
    };
  }
  
  /**
   * Wrapper function to cache API calls
   * Uses hybrid approach: check memory -> check DB -> fetch fresh
   * IMPORTANT: No double DB writes — set() handles the single DB persist
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
      const { getDbCache, logApiCall } = await import('./api-logger');
      const dbCached = await getDbCache<T>(key);
      if (dbCached !== null) {
        // Restore to memory ONLY — don't write back to DB (it's already there)
        this.setMemoryOnly(key, dbCached, cacheType);
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
    
    // 4. Cache the result — set() handles BOTH memory and DB persist (single write)
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
