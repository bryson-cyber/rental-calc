/**
 * Tests for the multi-model routing system.
 * 
 * Tests cover:
 * 1. Model Router — correct routing of features to providers
 * 2. Feature constants — completeness and consistency
 * 3. Routing table — every feature has a valid route
 * 4. Provider selection — Gemini, Opus, Sonnet assignments
 */

import { describe, it, expect } from 'vitest';
import {
  FEATURES,
  getRouteInfo,
  getFeaturesByProvider,
  type FeatureName,
} from './model-router';

// ---------------------------------------------------------------------------
// FEATURE CONSTANTS
// ---------------------------------------------------------------------------

describe('FEATURES constants', () => {
  it('has all expected Gemini features', () => {
    expect(FEATURES.FULL_PROPERTY_REPORT).toBe('full-property-report');
    expect(FEATURES.FULL_MARKET_REPORT).toBe('full-market-report');
    expect(FEATURES.FULL_REPORT_SUMMARY).toBe('full-report-summary');
    expect(FEATURES.ENHANCED_NARRATIVE).toBe('enhanced-narrative');
  });

  it('has all expected Opus features', () => {
    expect(FEATURES.DEAL_VERDICT).toBe('deal-verdict');
    expect(FEATURES.AI_ADVISOR_TOOL_LOOP).toBe('ai-advisor-tool-loop');
    expect(FEATURES.DEAL_ALERT_MEMO).toBe('deal-alert-memo');
    expect(FEATURES.CONTENT_HUB_SCRIPT).toBe('content-hub-script');
  });

  it('has all expected Sonnet features', () => {
    expect(FEATURES.CHAT_STREAMING).toBe('chat-streaming');
    expect(FEATURES.CHAT_NON_STREAMING).toBe('chat-non-streaming');
    expect(FEATURES.PROPERTY_QUICK_SUMMARY).toBe('property-quick-summary');
    expect(FEATURES.MARKET_QUICK_SUMMARY).toBe('market-quick-summary');
    expect(FEATURES.TREND_ANALYSIS).toBe('trend-analysis');
    expect(FEATURES.PROPERTY_ANALYSIS_STRUCTURED).toBe('property-analysis-structured');
    expect(FEATURES.PROPERTY_ANALYSIS_GENERAL).toBe('property-analysis-general');
    expect(FEATURES.PHOTO_ANALYSIS).toBe('photo-analysis');
    expect(FEATURES.DEEP_ANALYSIS).toBe('deep-analysis');
    expect(FEATURES.CONTENT_STUDIO).toBe('content-studio');
    expect(FEATURES.BEHAVIOR_ENGINE_EMAIL).toBe('behavior-engine-email');
    expect(FEATURES.NEWSLETTER_CONTENT).toBe('newsletter-content');
    expect(FEATURES.REGULATION_TRACKER).toBe('regulation-tracker');
    expect(FEATURES.SLACK_REPORT).toBe('slack-report');
    expect(FEATURES.DEAL_ALERT_SNIPPET).toBe('deal-alert-snippet');
    expect(FEATURES.AI_FALLBACK).toBe('ai-fallback');
    expect(FEATURES.HEALTH_CHECK).toBe('health-check');
  });

  it('has exactly 25 features', () => {
    const featureCount = Object.keys(FEATURES).length;
    expect(featureCount).toBe(25);
  });

  it('has no duplicate feature values', () => {
    const values = Object.values(FEATURES);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// ROUTING TABLE
// ---------------------------------------------------------------------------

describe('Routing Table', () => {
  it('routes every feature to a valid provider', () => {
    const allFeatures = Object.values(FEATURES) as FeatureName[];
    for (const feature of allFeatures) {
      const route = getRouteInfo(feature);
      expect(route, `Missing route for feature: ${feature}`).toBeDefined();
      expect(['gemini', 'opus', 'sonnet']).toContain(route!.provider);
    }
  });

  it('assigns valid effort levels to every feature', () => {
    const allFeatures = Object.values(FEATURES) as FeatureName[];
    for (const feature of allFeatures) {
      const route = getRouteInfo(feature);
      expect(['low', 'medium', 'high']).toContain(route!.effort);
    }
  });

  it('has a human-readable label for every feature', () => {
    const allFeatures = Object.values(FEATURES) as FeatureName[];
    for (const feature of allFeatures) {
      const route = getRouteInfo(feature);
      expect(route!.label).toBeTruthy();
      expect(route!.label.length).toBeGreaterThan(3);
    }
  });
});

// ---------------------------------------------------------------------------
// PROVIDER ASSIGNMENTS
// ---------------------------------------------------------------------------

describe('Provider Assignments', () => {
  it('routes exactly 4 features to Gemini', () => {
    const geminiFeatures = getFeaturesByProvider('gemini');
    expect(geminiFeatures).toHaveLength(4);
    expect(geminiFeatures).toContain(FEATURES.FULL_PROPERTY_REPORT);
    expect(geminiFeatures).toContain(FEATURES.FULL_MARKET_REPORT);
    expect(geminiFeatures).toContain(FEATURES.FULL_REPORT_SUMMARY);
    expect(geminiFeatures).toContain(FEATURES.ENHANCED_NARRATIVE);
  });

  it('routes exactly 4 features to Opus', () => {
    const opusFeatures = getFeaturesByProvider('opus');
    expect(opusFeatures).toHaveLength(4);
    expect(opusFeatures).toContain(FEATURES.DEAL_VERDICT);
    expect(opusFeatures).toContain(FEATURES.AI_ADVISOR_TOOL_LOOP);
    expect(opusFeatures).toContain(FEATURES.DEAL_ALERT_MEMO);
    expect(opusFeatures).toContain(FEATURES.CONTENT_HUB_SCRIPT);
  });

  it('routes exactly 17 features to Sonnet', () => {
    const sonnetFeatures = getFeaturesByProvider('sonnet');
    expect(sonnetFeatures).toHaveLength(17);
  });

  it('total features across all providers equals 25', () => {
    const gemini = getFeaturesByProvider('gemini').length;
    const opus = getFeaturesByProvider('opus').length;
    const sonnet = getFeaturesByProvider('sonnet').length;
    expect(gemini + opus + sonnet).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// EFFORT LEVEL ASSIGNMENTS
// ---------------------------------------------------------------------------

describe('Effort Level Assignments', () => {
  it('assigns high effort to all Gemini report features', () => {
    const reportFeatures = [
      FEATURES.FULL_PROPERTY_REPORT,
      FEATURES.FULL_MARKET_REPORT,
      FEATURES.ENHANCED_NARRATIVE,
    ];
    for (const feature of reportFeatures) {
      const route = getRouteInfo(feature as FeatureName);
      expect(route!.effort).toBe('high');
    }
  });

  it('assigns high effort to all Opus precision features', () => {
    const opusFeatures = [
      FEATURES.DEAL_VERDICT,
      FEATURES.AI_ADVISOR_TOOL_LOOP,
      FEATURES.DEAL_ALERT_MEMO,
    ];
    for (const feature of opusFeatures) {
      const route = getRouteInfo(feature as FeatureName);
      expect(route!.effort).toBe('high');
    }
  });

  it('assigns low effort to chat and quick tasks', () => {
    const quickFeatures = [
      FEATURES.CHAT_STREAMING,
      FEATURES.CHAT_NON_STREAMING,
      FEATURES.CONTENT_STUDIO,
      FEATURES.HEALTH_CHECK,
    ];
    for (const feature of quickFeatures) {
      const route = getRouteInfo(feature as FeatureName);
      expect(route!.effort).toBe('low');
    }
  });

  it('assigns high effort to deep analysis', () => {
    const route = getRouteInfo(FEATURES.DEEP_ANALYSIS as FeatureName);
    expect(route!.effort).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// BENCHMARK JUSTIFICATION SANITY CHECKS
// ---------------------------------------------------------------------------

describe('Benchmark Justification', () => {
  it('heavy synthesis tasks go to Gemini (GPQA Diamond 94.3%, 1M context)', () => {
    const synthesisTasks = [
      FEATURES.FULL_PROPERTY_REPORT,
      FEATURES.FULL_MARKET_REPORT,
      FEATURES.FULL_REPORT_SUMMARY,
      FEATURES.ENHANCED_NARRATIVE,
    ];
    for (const task of synthesisTasks) {
      const route = getRouteInfo(task as FeatureName);
      expect(route!.provider).toBe('gemini');
    }
  });

  it('precision judgment tasks go to Opus (HLE 53.1%, SWE-Bench 80.8%)', () => {
    const precisionTasks = [
      FEATURES.DEAL_VERDICT,
      FEATURES.AI_ADVISOR_TOOL_LOOP,
      FEATURES.DEAL_ALERT_MEMO,
    ];
    for (const task of precisionTasks) {
      const route = getRouteInfo(task as FeatureName);
      expect(route!.provider).toBe('opus');
    }
  });

  it('fast interactive tasks go to Sonnet (GDPval-AA 1633 Elo, fast + cheap)', () => {
    const fastTasks = [
      FEATURES.CHAT_STREAMING,
      FEATURES.CHAT_NON_STREAMING,
      FEATURES.PROPERTY_QUICK_SUMMARY,
      FEATURES.MARKET_QUICK_SUMMARY,
    ];
    for (const task of fastTasks) {
      const route = getRouteInfo(task as FeatureName);
      expect(route!.provider).toBe('sonnet');
    }
  });
});

// ---------------------------------------------------------------------------
// EDGE CASES
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  it('returns undefined for unknown features', () => {
    const route = getRouteInfo('nonexistent-feature' as FeatureName);
    expect(route).toBeUndefined();
  });

  it('getFeaturesByProvider returns empty array for unknown provider', () => {
    const features = getFeaturesByProvider('unknown' as any);
    expect(features).toHaveLength(0);
  });
});
