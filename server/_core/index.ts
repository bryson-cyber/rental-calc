import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { progressTracker, type ProgressState } from "../progress-tracker";
import { getDb } from "../db";
import { analysisReports } from "../../drizzle/schema";
import { desc, like, eq, or } from "drizzle-orm";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // SSE endpoint for progress tracking
  app.get('/api/progress/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    
    // Send initial state if exists
    const initialState = progressTracker.getState(sessionId);
    if (initialState) {
      res.write(`data: ${JSON.stringify(initialState)}\n\n`);
    }
    
    // Listen for progress updates
    const onProgress = (sid: string, state: ProgressState) => {
      if (sid === sessionId) {
        res.write(`data: ${JSON.stringify(state)}\n\n`);
      }
    };
    
    progressTracker.on('progress', onProgress);
    
    // Clean up on client disconnect
    req.on('close', () => {
      progressTracker.off('progress', onProgress);
    });
  });
  
  // SSE endpoint for streaming market listings with progressive loading
  app.get('/api/stream/listings', async (req, res) => {
    const { marketId, marketType = 'market', sortBy = 'revenue', maxListings = '500' } = req.query;
    const maxLimit = parseInt(maxListings as string, 10) || 500;
    
    if (!marketId || typeof marketId !== 'string') {
      return res.status(400).json({ error: 'marketId is required' });
    }
    
    // Keep the full market ID (airdna-XXX format) - the API requires it
    console.log(`[SSE] Starting stream for market: ${marketId}`);
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    
    const startTime = Date.now();
    const pageSize = 25;
    let offset = 0;
    let totalCount = 0;
    let fetchedCount = 0;
    let isClientConnected = true;
    
    // Track client disconnect
    req.on('close', () => {
      isClientConnected = false;
    });
    
    try {
      // Import the API functions dynamically
      const { getMarketListings, getSubmarketListings } = await import('../airdna');
      
      // Helper function to construct image URL from Airbnb listing ID
      const getImageUrl = (listing: any): string | null => {
        // First check if image_url is already set
        if (listing.image_url) return listing.image_url;
        
        // Try to extract Airbnb ID from the listing ID or URL
        let airbnbId: string | null = null;
        
        // Check if ID starts with 'abnb_' prefix
        if (listing.id?.startsWith('abnb_')) {
          airbnbId = listing.id.replace('abnb_', '');
        }
        // Or extract from airbnb_url
        else if (listing.airbnb_url) {
          const match = listing.airbnb_url.match(/rooms\/(\d+)/);
          if (match) airbnbId = match[1];
        }
        
        if (airbnbId) {
          // Use Airbnb's public image CDN
          return `https://a0.muscache.com/im/pictures/miso/Hosting-${airbnbId}/original/listing-photo.jpg`;
        }
        
        return null;
      };
      
      // First fetch to get total count
      const firstResult = marketType === 'submarket'
        ? await getSubmarketListings(marketId, { limit: pageSize, offset: 0, orderBy: sortBy as any, orderDirection: 'desc' })
        : await getMarketListings(marketId, { limit: pageSize, offset: 0, orderBy: sortBy as any, orderDirection: 'desc' });
      
      totalCount = firstResult.total_count || 0;
      
      // Send initial progress
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        totalCount,
        fetchedCount: firstResult.listings.length,
        elapsedMs: Date.now() - startTime,
        currentPage: 1,
        totalPages: Math.ceil(totalCount / pageSize)
      })}\n\n`);
      
      // Send first batch of listings
      if (firstResult.listings.length > 0) {
        res.write(`data: ${JSON.stringify({
          type: 'listings',
          listings: firstResult.listings.map(l => ({
            id: l.id,
            title: l.title,
            imageUrl: getImageUrl(l),
            airbnbUrl: l.airbnb_url || null,
            bedrooms: l.bedrooms,
            bathrooms: l.bathrooms,
            annualRevenue: l.annual_revenue,
            occupancyRate: l.occupancy,
            adr: l.adr,
            rating: l.rating,
            reviewCount: l.reviews,
            latitude: l.latitude || null,
            longitude: l.longitude || null,
            zipcode: l.zipcode || null,
          }))
        })}\n\n`);
      }
      
      fetchedCount = firstResult.listings.length;
      offset = pageSize;
      
      // Continue fetching remaining pages (up to maxLimit)
      while (offset < totalCount && offset < maxLimit && isClientConnected) {
        const currentPage = Math.floor(offset / pageSize) + 1;
        const totalPages = Math.ceil(totalCount / pageSize);
        
        const result = marketType === 'submarket'
          ? await getSubmarketListings(marketId, { limit: pageSize, offset, orderBy: sortBy as any, orderDirection: 'desc' })
          : await getMarketListings(marketId, { limit: pageSize, offset, orderBy: sortBy as any, orderDirection: 'desc' });
        
        if (!result.listings || result.listings.length === 0) break;
        
        fetchedCount += result.listings.length;
        
        // Send progress update
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          totalCount,
          fetchedCount,
          elapsedMs: Date.now() - startTime,
          currentPage,
          totalPages
        })}\n\n`);
        
        // Send listings batch
        res.write(`data: ${JSON.stringify({
          type: 'listings',
          listings: result.listings.map(l => ({
            id: l.id,
            title: l.title,
            imageUrl: getImageUrl(l),
            airbnbUrl: l.airbnb_url || null,
            bedrooms: l.bedrooms,
            bathrooms: l.bathrooms,
            annualRevenue: l.annual_revenue,
            occupancyRate: l.occupancy,
            adr: l.adr,
            rating: l.rating,
            reviewCount: l.reviews,
            latitude: l.latitude || null,
            longitude: l.longitude || null,
            zipcode: l.zipcode || null,
          }))
        })}\n\n`);
        
        offset += pageSize;
        
        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Send completion message
      const hasMore = fetchedCount < totalCount;
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        totalCount,
        fetchedCount,
        elapsedMs: Date.now() - startTime,
        hasMore,
        maxLimit
      })}\n\n`);
      
      res.end();
    } catch (error) {
      console.error('[Stream Listings] Error:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch listings'
      })}\n\n`);
      res.end();
    }
  });
  
  // SSE endpoint for streaming listings by radius (more efficient than market-wide search)
  app.get('/api/stream/listings-by-radius', async (req, res) => {
    const { lat, lng, radius = '1609', bedrooms, sortBy = 'revenue' } = req.query;
    
    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const radiusMeters = parseInt(radius as string, 10);
    const bedroomFilter = bedrooms && bedrooms !== 'all' ? parseInt(bedrooms as string, 10) : undefined;
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Valid lat and lng are required' });
    }
    
    console.log(`[SSE Radius] Starting stream for lat=${latitude}, lng=${longitude}, radius=${radiusMeters}m, bedrooms=${bedroomFilter || 'all'}`);
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    
    const startTime = Date.now();
    let isClientConnected = true;
    
    // Track client disconnect
    req.on('close', () => {
      isClientConnected = false;
    });
    
    try {
      // Import the API function dynamically
      const { getListingsInRadius } = await import('../airdna');
      
      // Helper function to construct image URL from Airbnb listing ID
      const getImageUrl = (listing: any): string | null => {
        // First check if image_url is already set
        if (listing.image_url) return listing.image_url;
        
        // Try to extract Airbnb ID from the listing ID or URL
        let airbnbId: string | null = null;
        
        // Check if ID starts with 'abnb_' prefix
        if (listing.id?.startsWith('abnb_')) {
          airbnbId = listing.id.replace('abnb_', '');
        }
        // Or extract from airbnb_url
        else if (listing.airbnb_url) {
          const match = listing.airbnb_url.match(/rooms\/(\d+)/);
          if (match) airbnbId = match[1];
        }
        
        if (airbnbId) {
          // Use Airbnb's public image CDN
          return `https://a0.muscache.com/im/pictures/miso/Hosting-${airbnbId}/original/listing-photo.jpg`;
        }
        
        return null;
      };
      
      // Fetch listings within radius - API max is 25 per page
      const pageSize = 25;
      let offset = 0;
      let totalCount = 0;
      let fetchedCount = 0;
      let allListings: any[] = [];
      
      // First fetch to get total count
      const firstResult = await getListingsInRadius(latitude, longitude, radiusMeters, {
        limit: pageSize,
        offset: 0,
        bedrooms: bedroomFilter,
        sort_by: sortBy as any,
        sort_direction: 'desc'
      });
      
      totalCount = firstResult.total_count || 0;
      
      // Send initial progress
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        totalCount,
        fetchedCount: firstResult.listings.length,
        elapsedMs: Date.now() - startTime,
        currentPage: 1,
        totalPages: Math.ceil(totalCount / pageSize)
      })}\n\n`);
      
      // Send first batch of listings
      if (firstResult.listings.length > 0) {
        res.write(`data: ${JSON.stringify({
          type: 'listings',
          listings: firstResult.listings.map(l => ({
            id: l.id,
            title: l.title,
            imageUrl: getImageUrl(l),
            airbnbUrl: l.airbnb_url || null,
            bedrooms: l.bedrooms,
            bathrooms: l.bathrooms,
            annualRevenue: l.annual_revenue,
            occupancyRate: l.occupancy,
            adr: l.adr,
            rating: l.rating,
            reviewCount: l.reviews,
            latitude: l.latitude || null,
            longitude: l.longitude || null,
            zipcode: l.zipcode || null,
            distanceMeters: l.distance_meters || null,
          }))
        })}\n\n`);
      }
      
      fetchedCount = firstResult.listings.length;
      allListings = [...firstResult.listings];
      offset = pageSize;
      
      // Continue fetching remaining pages - limit to 500 listings max to prevent excessive API calls
      const maxListings = 500;
      while (offset < totalCount && offset < maxListings && isClientConnected) {
        const currentPage = Math.floor(offset / pageSize) + 1;
        const totalPages = Math.ceil(totalCount / pageSize);
        
        const result = await getListingsInRadius(latitude, longitude, radiusMeters, {
          limit: pageSize,
          offset,
          bedrooms: bedroomFilter,
          sort_by: sortBy as any,
          sort_direction: 'desc'
        });
        
        if (!result.listings || result.listings.length === 0) break;
        
        fetchedCount += result.listings.length;
        allListings = [...allListings, ...result.listings];
        
        // Send progress update
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          totalCount,
          fetchedCount,
          elapsedMs: Date.now() - startTime,
          currentPage,
          totalPages
        })}\n\n`);
        
        // Send listings batch
        res.write(`data: ${JSON.stringify({
          type: 'listings',
          listings: result.listings.map(l => ({
            id: l.id,
            title: l.title,
            imageUrl: getImageUrl(l),
            airbnbUrl: l.airbnb_url || null,
            bedrooms: l.bedrooms,
            bathrooms: l.bathrooms,
            annualRevenue: l.annual_revenue,
            occupancyRate: l.occupancy,
            adr: l.adr,
            rating: l.rating,
            reviewCount: l.reviews,
            latitude: l.latitude || null,
            longitude: l.longitude || null,
            zipcode: l.zipcode || null,
            distanceMeters: l.distance_meters || null,
          }))
        })}\n\n`);
        
        offset += pageSize;
        
        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Send completion message
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        totalCount,
        fetchedCount,
        elapsedMs: Date.now() - startTime,
        hasMore: false,
        radiusMeters
      })}\n\n`);
      
      res.end();
    } catch (error) {
      console.error('[Stream Listings Radius] Error:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch listings'
      })}\n\n`);
      res.end();
    }
  });
  
  // Admin API endpoints
  app.get('/api/admin/reports', async (req, res) => {
    try {
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: 'Database not available', reports: [] });
      }
      
      const reports = await db
        .select()
        .from(analysisReports)
        .orderBy(desc(analysisReports.createdAt))
        .limit(100);
      
      res.json({ reports });
    } catch (error) {
      console.error('[Admin] Error fetching reports:', error);
      res.status(500).json({ error: 'Failed to fetch reports', reports: [] });
    }
  });
  
  app.get('/api/admin/reports/:id', async (req, res) => {
    try {
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: 'Database not available' });
      }
      
      const [report] = await db
        .select()
        .from(analysisReports)
        .where(eq(analysisReports.id, parseInt(req.params.id)))
        .limit(1);
      
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      res.json({ report });
    } catch (error) {
      console.error('[Admin] Error fetching report:', error);
      res.status(500).json({ error: 'Failed to fetch report' });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
