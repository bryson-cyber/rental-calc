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
  '/content-studio': 'content_studio',
  '/discover-markets': 'market_explorer',
  '/investment-calculator': 'revenue_calculator',
};

/**
 * Maps tab query params to tool names for tab-based navigation tracking.
 * When a path matches AND has a tab param, the tab mapping takes priority.
 */
const TAB_TO_TOOL: Record<string, Record<string, ToolName>> = {
  '/': {
    'validate': 'validate_deal',
    'compare': 'comp_analysis',
    'map': 'map_view',
    'market': 'market_explorer',
    'advisor': 'ai_advisor',
    'find': 'opportunity_finder',
  },
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
 * Resolves the tool name from the current URL path and query params.
 * Tab-based navigation takes priority over path-only mapping.
 */
function resolveToolName(location: string): ToolName | undefined {
  const [rawPath, queryString] = location.split('?');
  const path = rawPath.replace(/\/$/, '') || '/';

  // Check for tab-based mapping first
  if (queryString) {
    const params = new URLSearchParams(queryString);
    const tab = params.get('tab');
    if (tab && TAB_TO_TOOL[path]?.[tab]) {
      return TAB_TO_TOOL[path][tab];
    }
  }

  return PATH_TO_TOOL[path];
}

/**
 * Invisible component that tracks page views for tool pages.
 * Place once in App.tsx — it watches route changes and fires events.
 * Now also tracks tab-based navigation within the same page.
 */
export function PageTracker() {
  const [location] = useLocation();
  const { trackEvent } = useToolTracking();
  const lastTrackedKey = useRef<string>('');

  useEffect(() => {
    // Include full location (path + query) for tab-aware tracking
    const fullLocation = window.location.pathname + window.location.search;
    const toolName = resolveToolName(fullLocation);
    if (!toolName) return;

    // Build a unique key that includes the tool name to detect tab changes
    const trackKey = `${toolName}`;

    // Skip if same tool (prevents double-tracking on re-renders)
    if (trackKey === lastTrackedKey.current) return;
    lastTrackedKey.current = trackKey;

    const locationData = getLocationFromUrl();

    trackEvent({
      eventType: 'tool_view',
      toolName,
      ...locationData,
    });
  }, [location, trackEvent]);

  // Also watch for hash/search changes (tab switches don't always change wouter location)
  useEffect(() => {
    const handlePopState = () => {
      const fullLocation = window.location.pathname + window.location.search;
      const toolName = resolveToolName(fullLocation);
      if (!toolName) return;

      const trackKey = `${toolName}`;
      if (trackKey === lastTrackedKey.current) return;
      lastTrackedKey.current = trackKey;

      const locationData = getLocationFromUrl();
      trackEvent({
        eventType: 'tool_view',
        toolName,
        ...locationData,
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [trackEvent]);

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
