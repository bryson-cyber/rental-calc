/**
 * HubSpot/Zapier Webhook Integration Hook
 * 
 * Tracks tool usage and sends data to Zapier for HubSpot sync.
 * Enables ultra-personalized follow-up emails with location-specific tool links.
 * 
 * Usage:
 * const { trackUsage, generateLinks } = useWebhook();
 * 
 * // Track when user completes an action
 * trackUsage({
 *   event: 'revenue_calculated',
 *   city: 'Austin',
 *   state: 'TX',
 *   toolData: { estimatedRevenue: 85000 }
 * });
 */

import { trpc } from '@/lib/trpc';
import { useCallback } from 'react';

export type WebhookEvent = 
  | 'revenue_calculated'
  | 'market_researched'
  | 'regulation_checked'
  | 'property_analyzed'
  | 'comps_searched'
  | 'ai_advisor_used'
  | 'report_generated'
  | 'report_shared'
  | 'property_saved'
  | 'market_saved';

export interface TrackUsageParams {
  event: WebhookEvent;
  email?: string;
  hubspotContactId?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  address?: string;
  toolData?: {
    estimatedRevenue?: number;
    occupancyRate?: number;
    averageDailyRate?: number;
    marketName?: string;
    marketScore?: number;
    totalListings?: number;
    bedrooms?: number;
    bathrooms?: number;
    monthlyRent?: number;
    estimatedProfit?: number;
    regulationStatus?: string;
    permitRequired?: boolean;
  };
  generatePersonalizedLinks?: boolean;
}

export interface PersonalizedLinks {
  revenueCalculator: string;
  marketAdvisor: string;
  regulationTracker: string;
  propertyAnalyzer: string;
  compsExplorer: string;
  aiAdvisor: string;
  opportunityFinder: string;
  mainTool: string;
}

export function useWebhook() {
  const trackUsageMutation = trpc.webhook.trackUsage.useMutation();
  const generateLinksMutation = trpc.webhook.generateLinks.useQuery;

  /**
   * Track tool usage event
   * Call this when a user completes a significant action (e.g., generates a report)
   */
  const trackUsage = useCallback(async (params: TrackUsageParams) => {
    try {
      const result = await trackUsageMutation.mutateAsync(params);
      
      if (result.success && result.data) {
        // If a Zapier webhook URL is configured, send the data
        const zapierWebhookUrl = localStorage.getItem('zapierWebhookUrl');
        if (zapierWebhookUrl) {
          try {
            await fetch(zapierWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(result.data),
            });
            console.log('[Webhook] Sent to Zapier:', params.event);
          } catch (zapierError) {
            console.warn('[Webhook] Failed to send to Zapier:', zapierError);
          }
        }
        
        return result.data;
      }
      
      return null;
    } catch (error) {
      console.error('[Webhook] Error tracking usage:', error);
      return null;
    }
  }, [trackUsageMutation]);

  /**
   * Generate personalized links for a location
   * Use this to create custom URLs for HubSpot email templates
   */
  const getPersonalizedLinks = useCallback((params: {
    city: string;
    state: string;
    zipCode?: string;
    address?: string;
    bedrooms?: number;
    bathrooms?: number;
  }): PersonalizedLinks => {
    const baseUrl = window.location.origin;
    const urlParams = new URLSearchParams();
    urlParams.set('city', params.city);
    urlParams.set('state', params.state);
    if (params.zipCode) urlParams.set('zip', params.zipCode);
    if (params.address) urlParams.set('address', params.address);
    if (params.bedrooms) urlParams.set('bedrooms', String(params.bedrooms));
    if (params.bathrooms) urlParams.set('bathrooms', String(params.bathrooms));
    const query = urlParams.toString();

    return {
      revenueCalculator: `${baseUrl}/?tab=prove&${query}&autoAnalyze=true`,
      marketAdvisor: `${baseUrl}/?tab=market&${query}&autoAnalyze=true`,
      regulationTracker: `${baseUrl}/?tab=regulations&${query}`,
      propertyAnalyzer: `${baseUrl}/?tab=validate&${query}`,
      compsExplorer: `${baseUrl}/?tab=explore&${query}&autoAnalyze=true`,
      aiAdvisor: `${baseUrl}/?tab=advisor&${query}`,
      opportunityFinder: `${baseUrl}/?tab=opportunity&${query}`,
      mainTool: `${baseUrl}/?${query}`,
    };
  }, []);

  /**
   * Set Zapier webhook URL (call once during setup)
   */
  const setZapierWebhookUrl = useCallback((url: string) => {
    localStorage.setItem('zapierWebhookUrl', url);
  }, []);

  /**
   * Get current Zapier webhook URL
   */
  const getZapierWebhookUrl = useCallback(() => {
    return localStorage.getItem('zapierWebhookUrl');
  }, []);

  return {
    trackUsage,
    getPersonalizedLinks,
    setZapierWebhookUrl,
    getZapierWebhookUrl,
    isTracking: trackUsageMutation.isPending,
  };
}

/**
 * Example HubSpot Email Template Variables:
 * 
 * IMPORTANT: City names with spaces (e.g., "Las Vegas") MUST be URL-encoded
 * in email links, otherwise the link will break at the space character.
 * 
 * For HubSpot MARKETING emails (HubL templates), use the |urlencode filter:
 * 
 * Revenue Calculator: https://coachinayahturnkeytool.com/?tab=prove&city={{ contact.data_perfection__city|urlencode }}&state={{ contact.data_perfection__state|urlencode }}&autoAnalyze=true
 * 
 * Market Advisor: https://coachinayahturnkeytool.com/?tab=market&city={{ contact.data_perfection__city|urlencode }}&state={{ contact.data_perfection__state|urlencode }}&autoAnalyze=true
 * 
 * AI Advisor: https://coachinayahturnkeytool.com/?tab=advisor&city={{ contact.data_perfection__city|urlencode }}&state={{ contact.data_perfection__state|urlencode }}&autoAnalyze=true
 * 
 * For SALES emails/sequences (no HubL), generate pre-encoded links
 * using the Admin Portal > HubSpot Templates > "Generate Pre-Encoded Links" tool.
 */
