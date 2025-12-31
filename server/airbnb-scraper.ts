/**
 * Airbnb Image Scraping Service
 * Fetches listing thumbnail images from Airbnb URLs
 */

import * as cheerio from 'cheerio';

// Cache for scraped images to avoid repeated requests
const imageCache = new Map<string, { images: string[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Extract Airbnb listing ID from URL
 */
export function extractAirbnbListingId(url: string): string | null {
  if (!url) return null;
  
  // Match patterns like:
  // https://www.airbnb.com/rooms/12345
  // https://www.airbnb.com/rooms/12345?...
  // https://airbnb.com/rooms/12345
  const match = url.match(/airbnb\.com\/rooms\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Construct Airbnb image CDN URL from listing ID
 * Airbnb uses a predictable CDN pattern for listing images
 */
export function constructAirbnbImageUrl(listingId: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
  // Airbnb CDN patterns:
  // Small: https://a0.muscache.com/im/pictures/miso/Hosting-{id}/original/{photo-id}.jpg?im_w=240
  // Medium: https://a0.muscache.com/im/pictures/miso/Hosting-{id}/original/{photo-id}.jpg?im_w=720
  // Large: https://a0.muscache.com/im/pictures/miso/Hosting-{id}/original/{photo-id}.jpg?im_w=1200
  
  const widths = { small: 240, medium: 720, large: 1200 };
  
  // This is a fallback pattern - actual images need to be scraped
  return `https://a0.muscache.com/im/pictures/miso/Hosting-${listingId}/original/listing-photo.jpg?im_w=${widths[size]}`;
}

/**
 * Scrape listing images from Airbnb page
 */
export async function scrapeAirbnbImages(airbnbUrl: string): Promise<string[]> {
  const listingId = extractAirbnbListingId(airbnbUrl);
  if (!listingId) {
    console.log(`[scrapeAirbnbImages] Invalid Airbnb URL: ${airbnbUrl}`);
    return [];
  }
  
  // Check cache first
  const cached = imageCache.get(listingId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[scrapeAirbnbImages] Cache hit for listing ${listingId}`);
    return cached.images;
  }
  
  try {
    console.log(`[scrapeAirbnbImages] Fetching images for listing ${listingId}`);
    
    // Fetch the Airbnb page with a browser-like user agent
    const response = await fetch(airbnbUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });
    
    if (!response.ok) {
      console.log(`[scrapeAirbnbImages] Failed to fetch page: ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const images: string[] = [];
    
    // Method 1: Look for images in the page's JSON-LD data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $('script[type="application/ld+json"]').each((_: number, el: any) => {
      try {
        const data = JSON.parse($(el).html() || '{}');
        if (data.image) {
          if (Array.isArray(data.image)) {
            images.push(...data.image);
          } else if (typeof data.image === 'string') {
            images.push(data.image);
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });
    
    // Method 2: Look for og:image meta tag
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage && !images.includes(ogImage)) {
      images.unshift(ogImage); // Add to front as it's usually the main image
    }
    
    // Method 3: Look for images in the page's data attributes
    $('img[data-original-uri]').each((_, el) => {
      const src = $(el).attr('data-original-uri');
      if (src && src.includes('muscache.com') && !images.includes(src)) {
        images.push(src);
      }
    });
    
    // Method 4: Look for images in picture elements
    $('picture source[srcset]').each((_, el) => {
      const srcset = $(el).attr('srcset');
      if (srcset && srcset.includes('muscache.com')) {
        // Extract the largest image from srcset
        const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
        urls.forEach(url => {
          if (url && !images.includes(url)) {
            images.push(url);
          }
        });
      }
    });
    
    // Method 5: Look for any muscache.com images
    $('img[src*="muscache.com"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !images.includes(src)) {
        images.push(src);
      }
    });
    
    // Deduplicate and limit to first 10 images
    const uniqueImages = Array.from(new Set(images)).slice(0, 10);
    
    console.log(`[scrapeAirbnbImages] Found ${uniqueImages.length} images for listing ${listingId}`);
    
    // Cache the results
    imageCache.set(listingId, { images: uniqueImages, timestamp: Date.now() });
    
    return uniqueImages;
  } catch (error) {
    console.error(`[scrapeAirbnbImages] Error scraping listing ${listingId}:`, error);
    return [];
  }
}

/**
 * Batch scrape images for multiple listings
 * Returns a map of airbnb_url -> images array
 */
export async function batchScrapeAirbnbImages(
  airbnbUrls: string[],
  maxConcurrent: number = 3
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  
  // Filter out invalid URLs
  const validUrls = airbnbUrls.filter((url: string) => extractAirbnbListingId(url));
  
  console.log(`[batchScrapeAirbnbImages] Processing ${validUrls.length} URLs`);
  
  // Process in batches to avoid rate limiting
  for (let i = 0; i < validUrls.length; i += maxConcurrent) {
    const batch = validUrls.slice(i, i + maxConcurrent);
    
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const images = await scrapeAirbnbImages(url);
        return { url, images };
      })
    );
    
    batchResults.forEach(({ url, images }) => {
      if (images.length > 0) {
        results.set(url, images);
      }
    });
    
    // Add a small delay between batches to avoid rate limiting
    if (i + maxConcurrent < validUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`[batchScrapeAirbnbImages] Successfully scraped ${results.size}/${validUrls.length} listings`);
  
  return results;
}

/**
 * Get the primary image URL for a listing
 * Returns the first scraped image or a placeholder
 */
export async function getListingThumbnail(airbnbUrl: string): Promise<string | null> {
  const images = await scrapeAirbnbImages(airbnbUrl);
  return images.length > 0 ? images[0] : null;
}

/**
 * Clear the image cache (for testing or memory management)
 */
export function clearImageCache(): void {
  imageCache.clear();
  console.log('[clearImageCache] Image cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: imageCache.size,
    entries: Array.from(imageCache.keys()),
  };
}
