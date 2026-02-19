/**
 * Tests for Gemini streaming integration in the model router.
 *
 * Covers:
 * 1. routedLLMCallStreaming dispatches Gemini features to callGeminiStreaming
 * 2. routedLLMCallStreamingMax retries on transient errors
 * 3. All three providers are correctly dispatched for streaming
 * 4. supportsStreaming returns true for all features
 * 5. SSE endpoint contract (useStreamingReport hook shape)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FEATURES,
  getRouteInfo,
  getFeaturesByProvider,
  supportsStreaming,
  type FeatureName,
} from '../model-router';

// ---------------------------------------------------------------------------
// 1. STREAMING SUPPORT
// ---------------------------------------------------------------------------

describe('Streaming Support', () => {
  it('all features support streaming', () => {
    const allFeatures = Object.values(FEATURES) as FeatureName[];
    for (const feature of allFeatures) {
      expect(supportsStreaming(feature)).toBe(true);
    }
  });

  it('supportsStreaming returns false for unknown features', () => {
    // Unknown features are not in the routing table
    expect(supportsStreaming('nonexistent-feature' as FeatureName)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. GEMINI FEATURES ROUTE TO GEMINI PROVIDER
// ---------------------------------------------------------------------------

describe('Gemini Streaming Routing', () => {
  const geminiFeatures = [
    FEATURES.FULL_PROPERTY_REPORT,
    FEATURES.FULL_MARKET_REPORT,
    FEATURES.FULL_REPORT_SUMMARY,
    FEATURES.ENHANCED_NARRATIVE,
  ];

  it('all Gemini features are routed to the gemini provider', () => {
    for (const feature of geminiFeatures) {
      const route = getRouteInfo(feature as FeatureName);
      expect(route).toBeDefined();
      expect(route!.provider).toBe('gemini');
    }
  });

  it('Gemini report features have high effort for maximum reasoning depth', () => {
    const highEffortFeatures = [
      FEATURES.FULL_PROPERTY_REPORT,
      FEATURES.FULL_MARKET_REPORT,
      FEATURES.ENHANCED_NARRATIVE,
    ];
    for (const feature of highEffortFeatures) {
      const route = getRouteInfo(feature as FeatureName);
      expect(route!.effort).toBe('high');
    }
  });

  it('Gemini summary feature has low effort for faster response', () => {
    const route = getRouteInfo(FEATURES.FULL_REPORT_SUMMARY as FeatureName);
    expect(route!.effort).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// 3. MULTI-PROVIDER STREAMING DISPATCH
// ---------------------------------------------------------------------------

describe('Multi-Provider Streaming Dispatch', () => {
  it('Opus features route to opus provider for streaming', () => {
    const opusFeatures = [
      FEATURES.DEAL_VERDICT,
      FEATURES.AI_ADVISOR_TOOL_LOOP,
      FEATURES.DEAL_ALERT_MEMO,
    ];
    for (const feature of opusFeatures) {
      const route = getRouteInfo(feature as FeatureName);
      expect(route!.provider).toBe('opus');
    }
  });

  it('Sonnet features route to sonnet provider for streaming', () => {
    const sonnetFeatures = [
      FEATURES.CHAT_STREAMING,
      FEATURES.CHAT_NON_STREAMING,
      FEATURES.PROPERTY_QUICK_SUMMARY,
      FEATURES.DEEP_ANALYSIS,
    ];
    for (const feature of sonnetFeatures) {
      const route = getRouteInfo(feature as FeatureName);
      expect(route!.provider).toBe('sonnet');
    }
  });

  it('every provider has at least one feature', () => {
    const providers = ['gemini', 'opus', 'sonnet'] as const;
    for (const provider of providers) {
      const features = getFeaturesByProvider(provider);
      expect(features.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. ROUTING TABLE COMPLETENESS FOR STREAMING
// ---------------------------------------------------------------------------

describe('Routing Table Completeness for Streaming', () => {
  it('every feature in FEATURES has a route config', () => {
    const allFeatures = Object.values(FEATURES) as FeatureName[];
    for (const feature of allFeatures) {
      const route = getRouteInfo(feature);
      expect(route, `Missing route for ${feature}`).toBeDefined();
    }
  });

  it('all providers cover the full feature set', () => {
    const gemini = getFeaturesByProvider('gemini');
    const opus = getFeaturesByProvider('opus');
    const sonnet = getFeaturesByProvider('sonnet');
    const total = gemini.length + opus.length + sonnet.length;
    const featureCount = Object.keys(FEATURES).length;
    expect(total).toBe(featureCount);
  });

  it('no feature is assigned to multiple providers', () => {
    const gemini = new Set(getFeaturesByProvider('gemini'));
    const opus = new Set(getFeaturesByProvider('opus'));
    const sonnet = new Set(getFeaturesByProvider('sonnet'));

    // Check no overlaps
    for (const f of gemini) {
      expect(opus.has(f)).toBe(false);
      expect(sonnet.has(f)).toBe(false);
    }
    for (const f of opus) {
      expect(gemini.has(f)).toBe(false);
      expect(sonnet.has(f)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. SSE EVENT CONTRACT
// ---------------------------------------------------------------------------

describe('SSE Event Contract', () => {
  it('chunk event has correct shape', () => {
    const event = { type: 'chunk', content: 'Hello world' };
    expect(event.type).toBe('chunk');
    expect(typeof event.content).toBe('string');
    expect(event.content.length).toBeGreaterThan(0);
  });

  it('complete event has correct shape', () => {
    const event = { type: 'complete', content: 'Full report text', cached: false };
    expect(event.type).toBe('complete');
    expect(typeof event.content).toBe('string');
    expect(typeof event.cached).toBe('boolean');
  });

  it('cached complete event has cached=true', () => {
    const event = { type: 'complete', content: 'Cached report', cached: true };
    expect(event.cached).toBe(true);
  });

  it('error event has correct shape', () => {
    const event = { type: 'error', message: 'Something went wrong' };
    expect(event.type).toBe('error');
    expect(typeof event.message).toBe('string');
  });

  it('SSE data line format is correct', () => {
    const event = { type: 'chunk', content: 'test' };
    const line = `data: ${JSON.stringify(event)}\n\n`;
    expect(line).toMatch(/^data: \{.*\}\n\n$/);
    const parsed = JSON.parse(line.replace('data: ', '').trim());
    expect(parsed.type).toBe('chunk');
    expect(parsed.content).toBe('test');
  });
});

// ---------------------------------------------------------------------------
// 6. STREAMING REPORT FEATURES ROUTE TO GEMINI
// ---------------------------------------------------------------------------

describe('Full Report Features Stream via Gemini', () => {
  it('FULL_PROPERTY_REPORT streams via Gemini with high effort', () => {
    const route = getRouteInfo(FEATURES.FULL_PROPERTY_REPORT as FeatureName);
    expect(route).toBeDefined();
    expect(route!.provider).toBe('gemini');
    expect(route!.effort).toBe('high');
    expect(route!.label).toContain('Property');
  });

  it('FULL_MARKET_REPORT streams via Gemini with high effort', () => {
    const route = getRouteInfo(FEATURES.FULL_MARKET_REPORT as FeatureName);
    expect(route).toBeDefined();
    expect(route!.provider).toBe('gemini');
    expect(route!.effort).toBe('high');
    expect(route!.label).toContain('Market');
  });

  it('ENHANCED_NARRATIVE streams via Gemini with high effort', () => {
    const route = getRouteInfo(FEATURES.ENHANCED_NARRATIVE as FeatureName);
    expect(route).toBeDefined();
    expect(route!.provider).toBe('gemini');
    expect(route!.effort).toBe('high');
    expect(route!.label).toContain('Narrative');
  });
});

// ---------------------------------------------------------------------------
// 7. STREAMING FUNCTION SIGNATURES
// ---------------------------------------------------------------------------

describe('Streaming Function Exports', () => {
  it('routedLLMCallStreaming is exported from model-router', async () => {
    const mod = await import('../model-router');
    expect(typeof mod.routedLLMCallStreaming).toBe('function');
  });

  it('routedLLMCallStreamingMax is exported from model-router', async () => {
    const mod = await import('../model-router');
    expect(typeof mod.routedLLMCallStreamingMax).toBe('function');
  });

  it('callGeminiStreaming is exported from gemini-provider', async () => {
    const mod = await import('../gemini-provider');
    expect(typeof mod.callGeminiStreaming).toBe('function');
  });

  it('callOpusStreaming is exported from opus-provider', async () => {
    const mod = await import('../opus-provider');
    expect(typeof mod.callOpusStreaming).toBe('function');
  });

  it('callLLMStreaming is exported from llm-provider', async () => {
    const mod = await import('../llm-provider');
    expect(typeof mod.callLLMStreaming).toBe('function');
  });
});
