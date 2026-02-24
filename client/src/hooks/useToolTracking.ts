import { useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc';

/**
 * Tool usage event types that map to user actions across the app.
 * These feed the behavior engine for personalized follow-ups.
 */
export type ToolEventType =
  | 'tool_view'        // User opened/viewed a tool page
  | 'search_started'   // User initiated a property/market search
  | 'report_generated' // Full report was generated
  | 'report_viewed'    // User viewed an existing report
  | 'estimate_viewed'  // Revenue estimate was displayed
  | 'deal_validated'   // User validated a specific deal (Step 5)
  | 'regulation_check' // Regulation tracker was used
  | 'market_explored'  // Market explorer was used
  | 'deal_alert_set'   // User set up a deal alert
  | 'advisor_chat'     // User interacted with AI advisor
  | 'export_downloaded' // User downloaded a PDF/Excel export
  | 'comp_analyzed'    // Comparable properties were analyzed
  | 'map_explored';    // Map view was used

export type ToolName =
  | 'revenue_calculator'
  | 'validate_deal'
  | 'full_report'
  | 'regulation_tracker'
  | 'market_explorer'
  | 'market_advisor'
  | 'deal_alerts'
  | 'ai_advisor'
  | 'map_view'
  | 'property_analyzer'
  | 'opportunity_finder'
  | 'comp_analysis'
  | 'content_studio'
  | 'export';

interface TrackEventParams {
  eventType: ToolEventType;
  toolName: ToolName;
  city?: string;
  state?: string;
  zipCode?: string;
  address?: string;
  revenueEstimate?: number;
  regulationStatus?: string;
}

/**
 * Hook for tracking tool usage events.
 * Fires events silently — never blocks UI or shows errors to users.
 * Deduplicates rapid-fire events (e.g., re-renders) with a 2-second cooldown per event key.
 */
export function useToolTracking() {
  const trackMutation = trpc.adminTracking.trackToolUsage.useMutation();
  const lastTracked = useRef<Record<string, number>>({});

  const trackEvent = useCallback(
    (params: TrackEventParams) => {
      // Deduplicate: skip if same event fired within 2 seconds
      const key = `${params.eventType}:${params.toolName}:${params.city || ''}`;
      const now = Date.now();
      if (lastTracked.current[key] && now - lastTracked.current[key] < 2000) {
        return;
      }
      lastTracked.current[key] = now;

      // Get session ID from localStorage for anonymous users
      let sessionId = localStorage.getItem('tool_session_id');
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        localStorage.setItem('tool_session_id', sessionId);
      }

      // Get UTM params from URL if present
      const urlParams = new URLSearchParams(window.location.search);
      const utmSource = urlParams.get('utm_source') || undefined;
      const utmMedium = urlParams.get('utm_medium') || undefined;
      const utmCampaign = urlParams.get('utm_campaign') || undefined;

      // Fire and forget — never block UI
      trackMutation.mutate(
        {
          ...params,
          sessionId,
          utmSource,
          utmMedium,
          utmCampaign,
        },
        {
          // Silent — no error handling needed for tracking
          onError: () => {},
        }
      );
    },
    [trackMutation]
  );

  return { trackEvent };
}
