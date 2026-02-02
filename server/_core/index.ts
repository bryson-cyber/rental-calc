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
      
      // Helper function to get image URL - prioritize API-provided URLs
      const getImageUrl = (listing: any): string | null => {
        // First check if image_url is already set from the API (this is the real image URL)
        if (listing.image_url && listing.image_url.length > 0) {
          return listing.image_url;
        }
        
        // No fallback to constructed URLs - they don't work reliably
        // Return null and let the frontend show a placeholder
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
      // Import the API functions dynamically
      const { getListingsInRadius, enrichListingsWithImages } = await import('../airdna');
      
      // Helper function to get image URL - prioritize API-provided URLs
      const getImageUrl = (listing: any): string | null => {
        // First check if image_url is already set from the API (this is the real image URL)
        if (listing.image_url && listing.image_url.length > 0) {
          return listing.image_url;
        }
        
        // No fallback to constructed URLs - they don't work reliably
        // Return null and let the frontend show a placeholder
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
      
      // Enrich first batch with images (limit to 20 to avoid too many API calls)
      const enrichedFirstBatch = await enrichListingsWithImages(firstResult.listings, 20);
      
      // Send first batch of listings
      if (enrichedFirstBatch.length > 0) {
        res.write(`data: ${JSON.stringify({
          type: 'listings',
          listings: enrichedFirstBatch.map(l => ({
            id: l.id,
            title: l.title,
            imageUrl: l.image_url || null,
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
        
        // Enrich batch with images (limit to 20 per batch)
        const enrichedBatch = await enrichListingsWithImages(result.listings, 20);
        
        // Send listings batch
        res.write(`data: ${JSON.stringify({
          type: 'listings',
          listings: enrichedBatch.map(l => ({
            id: l.id,
            title: l.title,
            imageUrl: l.image_url || null,
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
  
  // SSE endpoint for streaming AI chat responses
  app.post('/api/ai/stream', async (req, res) => {
    const { messages, systemPrompt, conversationId } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    
    console.log(`[AI Stream] Starting stream with ${messages.length} messages`);
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    
    let isClientConnected = true;
    
    // Track client disconnect
    req.on('close', () => {
      isClientConnected = false;
    });
    
    try {
      const { streamGeminiChat } = await import('../gemini-streaming');
      
      let fullResponse = '';
      
      await streamGeminiChat({
        messages: messages.map((m: any) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
        systemPrompt,
        onChunk: (chunk) => {
          if (isClientConnected) {
            fullResponse += chunk;
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
          }
        },
        onComplete: async (response) => {
          if (isClientConnected) {
            // If conversationId provided, save to database
            if (conversationId) {
              try {
                const { aiMessages, aiConversations } = await import('../../drizzle/schema');
                const { eq } = await import('drizzle-orm');
                const db = await getDb();
                if (db) {
                  // Save the assistant message
                  await db.insert(aiMessages).values({
                    conversationId: parseInt(conversationId),
                    role: 'assistant',
                    content: response,
                    isComplete: 1,
                  });
                  // Update conversation message count and last message time
                  const { sql } = await import('drizzle-orm');
                  await db.execute(
                    sql`UPDATE ai_conversations SET messageCount = messageCount + 1, lastMessageAt = NOW() WHERE id = ${parseInt(conversationId)}`
                  );
                }
              } catch (dbError) {
                console.error('[AI Stream] Error saving to database:', dbError);
              }
            }
            
            res.write(`data: ${JSON.stringify({ type: 'complete', content: response })}\n\n`);
            res.end();
          }
        },
        onError: (error) => {
          if (isClientConnected) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
          }
        },
      });
    } catch (error) {
      console.error('[AI Stream] Error:', error);
      if (isClientConnected) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to stream AI response'
        })}\n\n`);
        res.end();
      }
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
