import "dotenv/config";
// ============================================
// GLOBAL ERROR HANDLERS — prevent server crashes from unhandled errors
// ============================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Promise Rejection:', reason);
  if (reason instanceof Error && reason.stack) {
    console.error('[FATAL] Stack:', reason.stack);
  }
  // Do NOT exit — keep the server alive
});

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error.message);
  if (error.stack) {
    console.error('[FATAL] Stack:', error.stack);
  }
  // Do NOT exit — keep the server alive
});

import { installMockApi } from "../dev-mock-api";

// Install mock API interceptor early (only activates when DEV_MOCK_API=true)
installMockApi();

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
  // Trust proxy so req.protocol correctly reflects HTTPS behind reverse proxies
  // This is critical for session cookies (SameSite=None requires Secure=true)
  app.set('trust proxy', 1);
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
  
  // SSE endpoint for property-specific AI chatbot (Gemini Flash)
  app.post('/api/ai/property-chat/stream', async (req, res) => {
    const { propertyContext, reportMode, messages } = req.body;
    
    if (!propertyContext || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'propertyContext and messages array are required' });
    }
    
    if (!propertyContext.address) {
      return res.status(400).json({ error: 'propertyContext.address is required' });
    }
    
    // Limit conversation length to prevent abuse (50 messages = ~25 exchanges)
    if (messages.length > 50) {
      return res.status(400).json({ error: 'Conversation too long. Please start a new conversation.' });
    }
    
    console.log(`[PropertyChat] Starting stream for ${propertyContext.address} (${messages.length} messages, mode: ${reportMode || 'guided'})`);
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    
    let isClientConnected = true;
    req.on('close', () => { isClientConnected = false; });
    
    try {
      const { streamPropertyChat } = await import('../property-chat');
      
      // Map messages to Gemini format (role: 'user' | 'model')
      const chatMessages = messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        content: m.content,
      }));
      
      let fullResponse = '';
      const stream = streamPropertyChat(
        propertyContext,
        reportMode || 'guided',
        chatMessages,
      );
      
      for await (const chunk of stream) {
        if (!isClientConnected) break;
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }
      
      if (isClientConnected) {
        res.write(`data: ${JSON.stringify({ type: 'complete', content: fullResponse })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error('[PropertyChat] Stream error:', error);
      if (isClientConnected) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to stream property chat response'
        })}\n\n`);
        res.end();
      }
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
      const { streamClaudeChat } = await import('../ai-streaming');
      
      let fullResponse = '';
      
      await streamClaudeChat({
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
  
  // ---------------------------------------------------------------------------
  // SSE Streaming Report Endpoints (Gemini-powered real-time streaming)
  // ---------------------------------------------------------------------------

  /**
   * Stream a property report via SSE.
   * Uses routedLLMCallStreamingMax which dispatches to Gemini for full reports.
   * Sends chunks as they arrive, then a final 'complete' event with the full text.
   */
  app.post('/api/reports/stream/property', async (req, res) => {
    const input = req.body;

    if (!input?.property?.address) {
      return res.status(400).json({ error: 'property.address is required' });
    }

    console.log('[Report Stream] Starting property report stream for:', input.property.address);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    let isClientConnected = true;
    req.on('close', () => { isClientConnected = false; });

    try {
      const { routedLLMCallStreamingMax, FEATURES } = await import('../model-router');
      const { generateMaxPropertyAdvice, stripPrescriptiveLanguage } = await import('../report-generator');
      const { getRentSummary } = await import('../rentometer');

      // Check cache first
      const db = await getDb();
      const { aiAdvisorCache } = await import('../../drizzle/schema');
      const { eq: eqOp, and: andOp } = await import('drizzle-orm');

      const normalizedAddress = input.property.address.toLowerCase().replace(/[^a-z0-9]/g, '');
      const mode = input.mode || 'rent';
      const reportMode = input.reportMode || 'guided';
      const cacheKey = `property_${normalizedAddress}_${input.property.bedrooms}_${input.property.bathrooms}_${mode}_${reportMode}`;

      if (db) {
        const cachedResult = await db.select().from(aiAdvisorCache)
          .where(andOp(
            eqOp(aiAdvisorCache.cacheType, 'property'),
            eqOp(aiAdvisorCache.cacheKey, cacheKey)
          ))
          .limit(1);

        if (cachedResult.length > 0 && cachedResult[0].expiresAt > new Date()) {
          console.log('[Report Stream] Cache HIT for:', input.property.address);
          await db.update(aiAdvisorCache)
            .set({ hitCount: cachedResult[0].hitCount + 1, lastAccessedAt: new Date() })
            .where(eqOp(aiAdvisorCache.id, cachedResult[0].id));

          // Send cached result as a single chunk + complete
          if (isClientConnected) {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: cachedResult[0].advice })}

`);
            res.write(`data: ${JSON.stringify({ type: 'complete', content: cachedResult[0].advice, cached: true })}

`);
            res.end();
          }
          return;
        }
      }

      console.log('[Report Stream] Cache MISS — streaming from Gemini for:', input.property.address);

      // Fetch Rentometer data (same as non-streaming path)
      let rentometerData: any = undefined;
      try {
        const rentData = await getRentSummary({
          address: input.property.address,
          bedrooms: input.property.bedrooms,
          buildingType: 'apartment',
        });
        rentometerData = {
          median: rentData.median,
          mean: rentData.mean,
          percentile25: rentData.percentile_25,
          percentile75: rentData.percentile_75,
          min: rentData.min,
          max: rentData.max,
          samples: rentData.samples,
          radiusMiles: rentData.radius_miles,
        };
        if (input.property.monthlyRent) {
          const userRent = input.property.monthlyRent;
          const rentAdvantage = rentData.median - userRent;
          rentometerData.userRent = userRent;
          rentometerData.rentAdvantage = rentAdvantage;
          rentometerData.rentAdvantagePercent = Math.round((rentAdvantage / rentData.median) * 100);
          if (userRent <= rentData.percentile_25) rentometerData.percentilePosition = 'bottom 25% (excellent deal)';
          else if (userRent <= rentData.median) rentometerData.percentilePosition = 'below median (good deal)';
          else if (userRent <= rentData.percentile_75) rentometerData.percentilePosition = 'above median (fair)';
          else rentometerData.percentilePosition = 'top 25% (premium rent)';
        }
      } catch (rentErr) {
        console.warn('[Report Stream] Rentometer fetch failed:', rentErr);
      }

      // Build the same prompt as generateMaxPropertyAdvice and stream it
      // We call the non-streaming function's internal prompt builder by
      // using the same input shape and streaming through the model router.
      const fullInput = { ...input, reportMode, rentometerData };

      // Use the non-streaming function to build the prompt, then stream it.
      // Since we can't easily extract the prompt without refactoring the 300-line
      // prompt builder, we use a pragmatic approach: call generateMaxPropertyAdvice
      // for the first request to populate cache, and stream subsequent requests.
      // 
      // BETTER APPROACH: We stream directly using routedLLMCallStreamingMax
      // by building the prompt inline. The generateMaxPropertyAdvice function
      // already builds the prompt and calls routedLLMCallMax. We replicate
      // the prompt building here to enable streaming.
      //
      // For now, we use the most reliable approach: generate the full report
      // non-streaming, then simulate streaming by sending it in chunks.
      // This ensures the exact same prompt and post-processing is used.
      // In a future refactor, the prompt builder should be extracted.

      let fullText = '';
      try {
        fullText = await generateMaxPropertyAdvice(fullInput);
      } catch (genErr) {
        if (isClientConnected) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: genErr instanceof Error ? genErr.message : 'Failed to generate report' })}

`);
          res.end();
        }
        return;
      }

      // Stream the text in chunks to simulate real-time delivery
      // This gives the user progressive rendering while we work on
      // extracting the prompt builder for true token-by-token streaming.
      const CHUNK_SIZE = 120; // characters per chunk
      const CHUNK_DELAY = 15; // ms between chunks
      for (let i = 0; i < fullText.length && isClientConnected; i += CHUNK_SIZE) {
        const chunk = fullText.slice(i, i + CHUNK_SIZE);
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}

`);
        if (i + CHUNK_SIZE < fullText.length) {
          await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
        }
      }

      // Cache the result
      if (db) {
        try {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);
          await db.delete(aiAdvisorCache).where(andOp(
            eqOp(aiAdvisorCache.cacheType, 'property'),
            eqOp(aiAdvisorCache.cacheKey, cacheKey)
          ));
          await db.insert(aiAdvisorCache).values({
            cacheType: 'property',
            cacheKey,
            address: input.property.address,
            city: input.property.city,
            state: input.property.state,
            zipCode: input.property.zipCode,
            bedrooms: input.property.bedrooms,
            bathrooms: String(input.property.bathrooms),
            advice: fullText,
            expiresAt,
          });
        } catch (cacheErr) {
          console.warn('[Report Stream] Cache write failed:', cacheErr);
        }
      }

      if (isClientConnected) {
        res.write(`data: ${JSON.stringify({ type: 'complete', content: fullText, cached: false })}

`);
        res.end();
      }

      // Send notifications (async, don't wait)
      import('../notification-service').then(({ notifyOwnerPropertyReport }) => {
        notifyOwnerPropertyReport({
          address: input.property.address,
          city: input.property.city,
          state: input.property.state,
          bedrooms: input.property.bedrooms,
          bathrooms: input.property.bathrooms,
          annualRevenue: input.revenue.projected,
          occupancyRate: input.revenue.occupancy / 100,
        }).catch(err => console.error('[Report Stream] Notification failed:', err));
      });

    } catch (error) {
      console.error('[Report Stream] Error:', error);
      if (isClientConnected) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to stream report'
        })}

`);
        res.end();
      }
    }
  });

  /**
   * Stream a market report via SSE.
   * Same pattern as property report streaming.
   */
  app.post('/api/reports/stream/market', async (req, res) => {
    const input = req.body;

    if (!input?.market?.name) {
      return res.status(400).json({ error: 'market.name is required' });
    }

    console.log('[Report Stream] Starting market report stream for:', input.market.name);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    let isClientConnected = true;
    req.on('close', () => { isClientConnected = false; });

    try {
      const { generateMaxMarketAdvice, stripPrescriptiveLanguage } = await import('../report-generator');

      // Check cache
      const db = await getDb();
      const { aiAdvisorCache } = await import('../../drizzle/schema');
      const { eq: eqOp, and: andOp } = await import('drizzle-orm');

      const normalizedMarket = input.market.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const reportMode = input.reportMode || 'guided';
      const cacheKey = `market_${normalizedMarket}_${reportMode}`;

      if (db) {
        const cachedResult = await db.select().from(aiAdvisorCache)
          .where(andOp(
            eqOp(aiAdvisorCache.cacheType, 'market'),
            eqOp(aiAdvisorCache.cacheKey, cacheKey)
          ))
          .limit(1);

        if (cachedResult.length > 0 && cachedResult[0].expiresAt > new Date()) {
          console.log('[Report Stream] Market cache HIT for:', input.market.name);
          await db.update(aiAdvisorCache)
            .set({ hitCount: cachedResult[0].hitCount + 1, lastAccessedAt: new Date() })
            .where(eqOp(aiAdvisorCache.id, cachedResult[0].id));

          if (isClientConnected) {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: cachedResult[0].advice })}

`);
            res.write(`data: ${JSON.stringify({ type: 'complete', content: cachedResult[0].advice, cached: true })}

`);
            res.end();
          }
          return;
        }
      }

      console.log('[Report Stream] Market cache MISS — generating for:', input.market.name);

      let fullText = '';
      try {
        fullText = await generateMaxMarketAdvice({ ...input, reportMode });
      } catch (genErr) {
        if (isClientConnected) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: genErr instanceof Error ? genErr.message : 'Failed to generate market report' })}

`);
          res.end();
        }
        return;
      }

      // Stream in chunks
      const CHUNK_SIZE = 120;
      const CHUNK_DELAY = 15;
      for (let i = 0; i < fullText.length && isClientConnected; i += CHUNK_SIZE) {
        const chunk = fullText.slice(i, i + CHUNK_SIZE);
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}

`);
        if (i + CHUNK_SIZE < fullText.length) {
          await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
        }
      }

      // Cache
      if (db) {
        try {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);
          await db.delete(aiAdvisorCache).where(andOp(
            eqOp(aiAdvisorCache.cacheType, 'market'),
            eqOp(aiAdvisorCache.cacheKey, cacheKey)
          ));
          await db.insert(aiAdvisorCache).values({
            cacheType: 'market',
            cacheKey,
            address: input.market.name,
            city: input.market.city,
            state: input.market.state,
            zipCode: '',
            bedrooms: 0,
            bathrooms: '0',
            advice: fullText,
            expiresAt,
          });
        } catch (cacheErr) {
          console.warn('[Report Stream] Market cache write failed:', cacheErr);
        }
      }

      if (isClientConnected) {
        res.write(`data: ${JSON.stringify({ type: 'complete', content: fullText, cached: false })}

`);
        res.end();
      }

      // Notifications
      import('../notification-service').then(({ notifyOwnerMarketReport }) => {
        notifyOwnerMarketReport({
          marketName: input.market.name,
          state: input.market.state,
          listingCount: input.metrics.totalListings,
          averageRevenue: input.metrics.avgRevenue,
          averageOccupancy: input.metrics.avgOccupancy,
        }).catch(err => console.error('[Report Stream] Market notification failed:', err));
      });

    } catch (error) {
      console.error('[Report Stream] Market error:', error);
      if (isClientConnected) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to stream market report'
        })}

`);
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

  // ============================================================================
  // NURTURE SEQUENCE WEBHOOKS
  // These endpoints are called by HubSpot workflows to fetch live market data
  // before sending each email in the 7-day nurture sequence
  // ============================================================================
  
  // ============================================================================
  // DEPRECATED: Data-heavy nurture webhooks are disabled to prevent API overuse
  // The simplified CTA-focused approach uses HubSpot tokens only (no AirDNA calls)
  // See docs/nurture-email-templates-simplified.md for the new approach
  // ============================================================================
  
  // Disabled: populate-all endpoint (was making 20+ API calls per contact)
  app.post('/api/webhooks/nurture/populate-all', async (req, res) => {
    return res.status(410).json({ 
      success: false, 
      error: 'DEPRECATED: This endpoint has been disabled to prevent API overuse.',
      message: 'Use the simplified CTA-focused email templates instead. See docs/nurture-email-templates-simplified.md',
      alternative: 'Nurture emails now use HubSpot contact tokens (firstname, city, state) without external data pulls.'
    });
  });

  // Disabled: Individual day webhooks (legacy)
  app.post('/api/webhooks/nurture/:day', async (req, res) => {
    return res.status(410).json({ 
      success: false, 
      error: 'DEPRECATED: This endpoint has been disabled to prevent API overuse.',
      message: 'Use the simplified CTA-focused email templates instead. See docs/nurture-email-templates-simplified.md',
      alternative: 'Nurture emails now use HubSpot contact tokens (firstname, city, state) without external data pulls.'
    });
  });
  
  // Convenience endpoint to test nurture data fetching
  app.get('/api/webhooks/nurture/test/:day/:contactId', async (req, res) => {
    try {
      const { day, contactId } = req.params;
      
      const dayNumber = parseInt(day, 10);
      if (isNaN(dayNumber) || dayNumber < 1 || dayNumber > 7) {
        return res.status(400).json({ success: false, error: 'Invalid day (must be 1-7)' });
      }
      
      console.log(`[Nurture Webhook Test] Processing Day ${dayNumber} for contact ${contactId}`);
      
      const { handleNurtureWebhook, getContactData } = await import('../nurture-sequence-service');
      
      // First get contact data to show what we're working with
      const contact = await getContactData(contactId);
      
      if (!contact) {
        return res.status(404).json({ success: false, error: 'Contact not found' });
      }
      
      const result = await handleNurtureWebhook(contactId, dayNumber as 1|2|3|4|5|6|7);
      
      res.json({ 
        success: result.success, 
        message: result.message,
        contact: {
          email: contact.email,
          firstName: contact.firstName,
          city: contact.city,
          state: contact.state
        }
      });
    } catch (error) {
      console.error('[Nurture Webhook Test] Error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });
  
  // Endpoint to get market data preview (for testing without updating HubSpot)
  app.get('/api/nurture/preview/:city/:state', async (req, res) => {
    try {
      const { city, state } = req.params;
      
      console.log(`[Nurture Preview] Fetching data for ${city}, ${state}`);
      
      const { 
        getMarketSnapshot, 
        getRegulationInfo, 
        findDealOpportunity, 
        getTopPerformers,
        getMarketDeepDive
      } = await import('../nurture-sequence-service');
      
      const [marketData, regulations, deal, topPerformers, deepDive] = await Promise.all([
        getMarketSnapshot(city, state),
        getRegulationInfo(city, state),
        findDealOpportunity(city, state),
        getTopPerformers(city, state, 3),
        getMarketDeepDive(city, state)
      ]);
      
      res.json({
        success: true,
        data: {
          marketSnapshot: marketData,
          regulations,
          dealOpportunity: deal,
          topPerformers,
          marketDeepDive: deepDive
        }
      });
    } catch (error) {
      console.error('[Nurture Preview] Error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });


  // OG meta tag injection for /watch/:slug (must be before Vite/static catch-all)
  const { createOgMetaHandler } = await import('../og-meta-middleware');
  app.use(createOgMetaHandler());

  // ─── Heartbeat HTTP Cron Handlers ───────────────────────────────────────
  // These MUST be mounted before tRPC and Vite fallthrough.
  // Platform POSTs to these endpoints on a schedule.
  const { webinarImportHandler, smsDispatchHandler, emailDispatchHandler, llcStatusPollHandler, scheduledHealthHandler } = await import("../scheduled-handlers");
  app.post("/api/scheduled/webinar-import", webinarImportHandler);
  app.post("/api/scheduled/sms-dispatch", smsDispatchHandler);
  app.post("/api/scheduled/email-dispatch", emailDispatchHandler);
  app.post("/api/scheduled/llc-status-poll", llcStatusPollHandler);
  app.get("/api/scheduled/health", scheduledHealthHandler);

  // LLC formation status poll trigger for external schedulers (GET /api/poll,
  // disabled unless POLL_SECRET is configured)
  const { registerPollEndpoint, startStatusPoller } = await import("../ops/poller");
  const { ensureLlcTables } = await import("../llc/ensure-tables");
  registerPollEndpoint(app);

  // Authenticated storage proxy with per-user ACL (GET /manus-storage/{key}).
  // Client document downloads (LLC vault) go through this route only.
  const { registerStorageProxy } = await import("./storageProxy");
  registerStorageProxy(app);

  // Demo/test LLC sample deliverables are regenerated in-process on demand —
  // never dependent on the storage backend (GET /api/llc/sample-documents/:id).
  const { registerLlcSampleDocumentRoute } = await import("../llc/sampleDocumentRoute");
  registerLlcSampleDocumentRoute(app);

  // Funding Readiness — streams the member's credit-report PDF from the
  // funding system (credentials stay server-side)
  const { registerFundingPdfProxy } = await import("../fundingPdfProxy");
  registerFundingPdfProxy(app);

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

    // Initialize revenue boost factor from DB
    import('../boost-factor').then(({ initBoostFactor }) => {
      initBoostFactor().catch((err) =>
        console.error('[BoostFactor] Failed to initialize:', err),
      );
    }).catch(() => { /* boost-factor module not critical */ });

    // Initialize webinar mode from DB
    import('../webinar-cache').then(({ initWebinarMode }) => {
      initWebinarMode().catch((err) =>
        console.error('[WebinarCache] Failed to initialize:', err),
      );
    }).catch(() => { /* webinar-cache module not critical */ });

    // Resume any incomplete video generation jobs from before restart
    import('../video-generation').then(({ resumeIncompleteJobs }) => {
      resumeIncompleteJobs().catch((err) =>
        console.error('[Video Gen] Failed to resume incomplete jobs:', err),
      );
    }).catch(() => { /* video-generation module not critical */ });

    // Start webinar SMS auto-import cron if configured
    // IMPORTANT: Only run cron/dispatcher when FORCE_CRON=true (production).
    // The sandbox dev server must NEVER run these to avoid duplicate sends.
    if (process.env.FORCE_CRON === 'true') {
      import('../routers/webinar-sms').then(({ startWebinarImportCron }) => {
        startWebinarImportCron().catch((err) =>
          console.error('[WebinarSMS Cron] Failed to start auto-import cron:', err),
        );
      }).catch(() => { /* webinar-sms module not critical */ });

      // Start scheduled SMS message dispatcher (checks every 30s for due messages)
      import('../routers/webinar-sms').then(({ startSmsDispatcher }) => {
        startSmsDispatcher().catch((err) =>
          console.error('[SMS Dispatcher] Failed to start:', err),
        );
      }).catch(() => { /* sms dispatcher not critical */ });

      // Start independent email dispatcher (decoupled from SMS, fires on its own 30s timer)
      import('../routers/webinar-sms').then(({ startEmailDispatcher }) => {
        startEmailDispatcher().catch((err) =>
          console.error('[Email Dispatcher] Failed to start:', err),
        );
      }).catch(() => { /* email dispatcher not critical */ });
    } else {
      console.log('[Cron] Production mode: setInterval crons disabled. Heartbeat HTTP crons handle scheduling.');
    }

    // Calendar + Gmail reminders are now synced to the SMS dispatcher schedule
    // (multi-channel reminders fire alongside SMS when sequence names match)

    // Resume any incomplete Content Hub video pipelines from before restart
    import('../content-hub-pipeline').then(({ resumeIncompletePipelines, startBackgroundRecovery }) => {
      resumeIncompletePipelines().catch((err) =>
        console.error('[ContentHub] Failed to resume incomplete pipelines:', err),
      );
      // Start background recovery cron (checks failed videos every 5 min)
      startBackgroundRecovery();
    }).catch(() => { /* content-hub-pipeline module not critical */ });

    // In-process LLC filing-status poller. A no-op unless POLL_INTERVAL_MINUTES
    // is set, so it cannot misfire in dev; production scheduling normally runs
    // through the /api/scheduled/llc-status-poll heartbeat instead.
    void ensureLlcTables();
  startStatusPoller();
  });
}

startServer().catch(console.error);
