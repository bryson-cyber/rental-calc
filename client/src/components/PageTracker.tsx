import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useToolTracking, type ToolName, type ToolEventType } from '@/hooks/useToolTracking';

/**
 * Maps URL paths to tool names for automatic page-view tracking.
 * This component sits at the App level and fires `tool_view` events
 * whenever the user navigates to a tool page.
 */
const PATH_TO_TOOL: Record<string, ToolName> = {
  '/': 'revenue_calculator',
  '/calculator': 'revenue_calculator',
  '/full-report': 'full_report',
  '/full-analysis': 'property_analyzer',
  '/market-advisor': 'market_advisor',
  '/opportunity-finder': 'opportunity_finder',
  '/map': 'map_view',
  '/deal-alerts': 'deal_alerts',
  '/evaluate-market': 'market_explorer',
  '/discover-markets': 'market_explorer',
  '/investment-calculator': 'revenue_calculator',
};

/**
 * Extracts city/state from URL search params if present.
 * Many tool pages receive location context via query params.
 */
function getLocationFromUrl(): { city?: string; state?: string; address?: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    city: params.get('city') || undefined,
    state: params.get('state') || undefined,
    address: params.get('address') || undefined,
  };
}

/**
 * Invisible component that tracks page views for tool pages.
 * Place once in App.tsx — it watches route changes and fires events.
 */
export function PageTracker() {
  const [location] = useLocation();
  const { trackEvent } = useToolTracking();
  const lastTrackedPath = useRef<string>('');

  useEffect(() => {
    // Normalize path (remove trailing slash, query params)
    const path = location.split('?')[0].replace(/\/$/, '') || '/';

    // Skip if same path (prevents double-tracking on re-renders)
    if (path === lastTrackedPath.current) return;
    lastTrackedPath.current = path;

    // Find matching tool
    const toolName = PATH_TO_TOOL[path];
    if (!toolName) return;

    const locationData = getLocationFromUrl();

    trackEvent({
      eventType: 'tool_view',
      toolName,
      ...locationData,
    });
  }, [location, trackEvent]);

  return null;
}

/**
 * Hook for tracking specific tool actions (search, generate, export).
 * Use inside tool page components for action-level tracking.
 *
 * @example
 * ```tsx
 * const { trackAction } = useActionTracking('revenue_calculator');
 * // When user searches:
 * trackAction('search_started', { city: 'Denver', state: 'CO' });
 * // When estimate is displayed:
 * trackAction('estimate_viewed', { revenueEstimate: 128000 });
 * ```
 */
export function useActionTracking(toolName: ToolName) {
  const { trackEvent } = useToolTracking();

  const trackAction = (
    eventType: ToolEventType,
    data?: {
      city?: string;
      state?: string;
      zipCode?: string;
      address?: string;
      revenueEstimate?: number;
      regulationStatus?: string;
    }
  ) => {
    trackEvent({
      eventType,
      toolName,
      ...data,
    });
  };

  return { trackAction };
}
