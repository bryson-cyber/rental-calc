import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { personalizedLinks } from "../../drizzle/schema";
import { getListingsInRadius } from "../airdna";

export const webhookRouter = router({
    // Track tool usage events - sends data to Zapier webhook for HubSpot sync
    trackUsage: publicProcedure
      .input(z.object({
        // Event type
        event: z.enum([
          'revenue_calculated',
          'market_researched', 
          'regulation_checked',
          'property_analyzed',
          'comps_searched',
          'ai_advisor_used',
          'report_generated',
          'report_shared',
          'property_saved',
          'market_saved',
        ]),
        // Contact info (from HubSpot personalized link or form)
        email: z.string().email().optional(),
        hubspotContactId: z.string().optional(),
        // Location data
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        address: z.string().optional(),
        // Tool-specific data
        toolData: z.object({
          // Revenue calculator
          estimatedRevenue: z.number().optional(),
          occupancyRate: z.number().optional(),
          averageDailyRate: z.number().optional(),
          // Market research
          marketName: z.string().optional(),
          marketScore: z.number().optional(),
          totalListings: z.number().optional(),
          // Property analysis
          bedrooms: z.number().optional(),
          bathrooms: z.number().optional(),
          monthlyRent: z.number().optional(),
          estimatedProfit: z.number().optional(),
          // Regulation tracker
          regulationStatus: z.string().optional(),
          permitRequired: z.boolean().optional(),
        }).optional(),
        // Personalized link generation
        generatePersonalizedLinks: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const timestamp = new Date().toISOString();
          
          // Build personalized links for all tools based on location
          let personalizedLinks: Record<string, string> | null = null;
          if (input.generatePersonalizedLinks && (input.city || input.zipCode)) {
            const baseUrl = process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com';
            const locationParams = new URLSearchParams();
            if (input.city) locationParams.set('city', input.city);
            if (input.state) locationParams.set('state', input.state);
            if (input.zipCode) locationParams.set('zip', input.zipCode);
            const locationQuery = locationParams.toString();
            
            personalizedLinks = {
              revenueCalculator: `${baseUrl}/?tab=prove&${locationQuery}&autoAnalyze=true`,
              marketAdvisor: `${baseUrl}/?tab=market&${locationQuery}&autoAnalyze=true`,
              regulationTracker: `${baseUrl}/?tab=regulations&${locationQuery}`,
              propertyAnalyzer: `${baseUrl}/?tab=validate&${locationQuery}`,
              compsExplorer: `${baseUrl}/?tab=explore&${locationQuery}&autoAnalyze=true`,
              aiAdvisor: `${baseUrl}/?tab=advisor&${locationQuery}`,
              opportunityFinder: `${baseUrl}/?tab=opportunity&${locationQuery}`,
            };
          }
          
          // Prepare webhook payload for Zapier
          const webhookPayload = {
            event: input.event,
            timestamp,
            contact: {
              email: input.email,
              hubspotContactId: input.hubspotContactId,
            },
            location: {
              city: input.city,
              state: input.state,
              zipCode: input.zipCode,
              address: input.address,
            },
            toolData: input.toolData,
            personalizedLinks,
            // HubSpot custom properties to update
            hubspotProperties: {
              tool_last_used: timestamp,
              last_tool_event: input.event,
              last_searched_city: input.city,
              last_searched_state: input.state,
              last_revenue_estimate: input.toolData?.estimatedRevenue,
              last_market_score: input.toolData?.marketScore,
              personalized_tool_link: personalizedLinks?.revenueCalculator,
            },
          };
          
          console.log('[Webhook] Tool usage tracked:', input.event, input.city, input.state);
          
          // Return the payload - Zapier webhook URL will be called from frontend
          // This allows the webhook URL to be configured in Zapier without exposing it in code
          return {
            success: true,
            data: webhookPayload,
          };
        } catch (error) {
          console.error('[Webhook] Error tracking usage:', error);
          return {
            success: false,
            error: 'Failed to track usage',
          };
        }
      }),

    // Generate personalized links for a contact
    generateLinks: publicProcedure
      .input(z.object({
        city: z.string(),
        state: z.string(),
        zipCode: z.string().optional(),
        address: z.string().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
      }))
      .query(({ input }) => {
        const baseUrl = process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com';
        const params = new URLSearchParams();
        params.set('city', input.city);
        params.set('state', input.state);
        if (input.zipCode) params.set('zip', input.zipCode);
        if (input.address) params.set('address', input.address);
        if (input.bedrooms) params.set('bedrooms', String(input.bedrooms));
        if (input.bathrooms) params.set('bathrooms', String(input.bathrooms));
        const query = params.toString();
        
        return {
          // All tool links with location pre-populated
          revenueCalculator: `${baseUrl}/?tab=prove&${query}&autoAnalyze=true`,
          marketAdvisor: `${baseUrl}/?tab=market&${query}&autoAnalyze=true`,
          regulationTracker: `${baseUrl}/?tab=regulations&${query}`,
          propertyAnalyzer: `${baseUrl}/?tab=validate&${query}`,
          compsExplorer: `${baseUrl}/?tab=explore&${query}&autoAnalyze=true`,
          aiAdvisor: `${baseUrl}/?tab=advisor&${query}`,
          opportunityFinder: `${baseUrl}/?tab=opportunity&${query}`,
          // Main tool link (most commonly used)
          mainTool: `${baseUrl}/?${query}`,
        };
      }),

    // Get daily property recommendations for a location (for automated emails)
    getDailyProperties: publicProcedure
      .input(z.object({
        city: z.string(),
        state: z.string(),
        zipCode: z.string().optional(),
        bedrooms: z.number().optional(),
        minRevenue: z.number().optional(),
        limit: z.number().int().min(1).max(10).default(5),
      }))
      .query(async ({ input }) => {
        try {
          // This would integrate with your existing property search
          // For now, return the structure that Zapier can use
          console.log('[Webhook] Daily properties request for:', input.city, input.state);
          
          return {
            success: true,
            location: {
              city: input.city,
              state: input.state,
              zipCode: input.zipCode,
            },
            // Placeholder - integrate with your existing getListingsInRadius or similar
            message: 'Use the comps explorer to find properties in this area',
            toolLink: `https://coachinayahturnkeytool.com/?tab=explore&city=${encodeURIComponent(input.city)}&state=${encodeURIComponent(input.state)}${input.zipCode ? `&zip=${input.zipCode}` : ''}&autoAnalyze=true`,
          };
        } catch (error) {
          console.error('[Webhook] Error getting daily properties:', error);
          return {
            success: false,
            error: 'Failed to get daily properties',
          };
        }
      }),
});
