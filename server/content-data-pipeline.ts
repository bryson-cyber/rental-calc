/**
 * Content Data Pipeline — Autonomous Data Gathering
 *
 * Pulls real data from the platform database and AirDNA to feed
 * into the Content Studio's script generation. Zero user input required.
 *
 * Data sources:
 *   1. analysisReports — recent property analyses with verdicts, revenue, etc.
 *   2. leads — lead capture data with market info
 *   3. toolUsageEvents — trending searches and tool usage patterns
 *   4. contentScripts — previously generated topics (to avoid repeats)
 */

import { desc, sql, isNotNull } from 'drizzle-orm';
import { getDb } from './db';
import {
  analysisReports,
  leads,
  toolUsageEvents,
  contentScripts,
} from '../drizzle/schema';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PropertySnapshot {
  address: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  annualRevenue: number;
  annualRevenueRange: { low: number; high: number };
  occupancyRate: number;
  averageDailyRate: number;
  monthlyRent: number | null;
  verdict: string;
  confidenceScore: number | null;
  annualProfit: number | null;
  createdAt: Date;
}

export interface MarketSnapshot {
  marketName: string;
  totalListings: number;
  averageRevenue: number;
}

export interface PlatformStats {
  totalReports: number;
  totalLeads: number;
  topMarkets: Array<{ market: string; count: number }>;
  recentSearches: Array<{ city: string; state: string; count: number }>;
}

export interface ContentDataBundle {
  recentProperties: PropertySnapshot[];
  marketSnapshots: MarketSnapshot[];
  platformStats: PlatformStats;
  previousTopics: string[];
  pulledAt: Date;
}

// ── Data gathering ──────────────────────────────────────────────────────────

export async function gatherContentData(): Promise<ContentDataBundle> {
  const db = await getDb();

  const emptyBundle: ContentDataBundle = {
    recentProperties: [],
    marketSnapshots: [],
    platformStats: {
      totalReports: 0,
      totalLeads: 0,
      topMarkets: [],
      recentSearches: [],
    },
    previousTopics: [],
    pulledAt: new Date(),
  };

  if (!db) return emptyBundle;

  try {
    // 1. Recent property analyses (last 60 days, up to 20)
    const recentReports = await db
      .select({
        address: analysisReports.address,
        city: analysisReports.city,
        state: analysisReports.state,
        bedrooms: analysisReports.bedrooms,
        bathrooms: analysisReports.bathrooms,
        annualRevenueConservative: analysisReports.annualRevenueConservative,
        annualRevenueRealistic: analysisReports.annualRevenueRealistic,
        annualRevenueOptimistic: analysisReports.annualRevenueOptimistic,
        occupancyRate: analysisReports.occupancyRate,
        averageDailyRate: analysisReports.averageDailyRate,
        monthlyRent: analysisReports.monthlyRent,
        verdict: analysisReports.verdict,
        confidenceScore: analysisReports.confidenceScore,
        annualProfitRealistic: analysisReports.annualProfitRealistic,
        createdAt: analysisReports.createdAt,
      })
      .from(analysisReports)
      .where(
        sql`${analysisReports.createdAt} > DATE_SUB(NOW(), INTERVAL 60 DAY)
            AND ${analysisReports.annualRevenueRealistic} IS NOT NULL`,
      )
      .orderBy(desc(analysisReports.createdAt))
      .limit(20);

    const recentProperties: PropertySnapshot[] = recentReports.map((r) => ({
      address: r.address,
      city: r.city || 'Unknown',
      state: r.state || '',
      bedrooms: r.bedrooms ?? 0,
      bathrooms: Number(r.bathrooms) || 0,
      annualRevenue: r.annualRevenueRealistic || 0,
      annualRevenueRange: {
        low: r.annualRevenueConservative || 0,
        high: r.annualRevenueOptimistic || 0,
      },
      occupancyRate: Number(r.occupancyRate) || 0,
      averageDailyRate: r.averageDailyRate || 0,
      monthlyRent: r.monthlyRent || null,
      verdict: r.verdict || 'UNKNOWN',
      confidenceScore: r.confidenceScore || null,
      annualProfit: r.annualProfitRealistic || null,
      createdAt: r.createdAt,
    }));

    // 2. Top markets from analysis reports (aggregated)
    const marketAgg = await db
      .select({
        marketName: analysisReports.marketName,
        count: sql<number>`count(*)`,
        avgRevenue: sql<number>`ROUND(AVG(${analysisReports.annualRevenueRealistic}))`,
      })
      .from(analysisReports)
      .where(isNotNull(analysisReports.marketName))
      .groupBy(analysisReports.marketName)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    const marketSnapshots: MarketSnapshot[] = marketAgg.map((m) => ({
      marketName: m.marketName || 'Unknown',
      totalListings: m.count,
      averageRevenue: m.avgRevenue || 0,
    }));

    // 3. Platform stats
    const [reportCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(analysisReports);

    const [leadCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads);

    // Top searched markets from tool usage
    const topSearches = await db
      .select({
        city: toolUsageEvents.city,
        state: toolUsageEvents.state,
        count: sql<number>`count(*)`,
      })
      .from(toolUsageEvents)
      .where(isNotNull(toolUsageEvents.city))
      .groupBy(toolUsageEvents.city, toolUsageEvents.state)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    // 4. Previously generated topics (to avoid repeats)
    const prevTopics = await db
      .select({ topic: contentScripts.topic })
      .from(contentScripts)
      .orderBy(desc(contentScripts.createdAt))
      .limit(50);

    return {
      recentProperties,
      marketSnapshots,
      platformStats: {
        totalReports: reportCount?.count ?? 0,
        totalLeads: leadCount?.count ?? 0,
        topMarkets: marketAgg.map((m) => ({
          market: m.marketName || 'Unknown',
          count: m.count,
        })),
        recentSearches: topSearches.map((s) => ({
          city: s.city || 'Unknown',
          state: s.state || '',
          count: s.count,
        })),
      },
      previousTopics: prevTopics.map((t) => t.topic),
      pulledAt: new Date(),
    };
  } catch (err) {
    console.error('[Content Data Pipeline] Error gathering data:', err);
    return emptyBundle;
  }
}

// ── Format data for prompt injection ────────────────────────────────────────

export function formatDataForPrompt(bundle: ContentDataBundle): string {
  const lines: string[] = [];

  lines.push('=== LIVE PLATFORM DATA (use these REAL numbers in scripts) ===\n');

  // Platform scale
  lines.push(`Platform Scale: ${bundle.platformStats.totalReports.toLocaleString()} total property analyses run, ${bundle.platformStats.totalLeads.toLocaleString()} leads captured.\n`);

  // Top markets
  if (bundle.platformStats.topMarkets.length > 0) {
    lines.push('Top Searched Markets:');
    bundle.platformStats.topMarkets.slice(0, 5).forEach((m) => {
      lines.push(`  - ${m.market} (${m.count} analyses)`);
    });
    lines.push('');
  }

  // Trending searches
  if (bundle.platformStats.recentSearches.length > 0) {
    lines.push('Trending City Searches:');
    bundle.platformStats.recentSearches.slice(0, 5).forEach((s) => {
      lines.push(`  - ${s.city}, ${s.state} (${s.count} searches)`);
    });
    lines.push('');
  }

  // Recent property analyses with real data
  if (bundle.recentProperties.length > 0) {
    lines.push('Recent Property Analyses (REAL data — use these exact numbers):');
    bundle.recentProperties.slice(0, 8).forEach((p) => {
      const monthlyRev = Math.round(p.annualRevenue / 12);
      const rentNote = p.monthlyRent ? `, rent $${p.monthlyRent.toLocaleString()}/mo` : '';
      const profitNote = p.annualProfit ? `, annual profit $${p.annualProfit.toLocaleString()}` : '';
      lines.push(
        `  - ${p.city}, ${p.state}: ${p.bedrooms}BR/${p.bathrooms}BA → $${monthlyRev.toLocaleString()}/mo ($${p.annualRevenue.toLocaleString()}/yr), ` +
        `ADR $${p.averageDailyRate}, occupancy ${Math.round(p.occupancyRate * 100)}%${rentNote}${profitNote} → Verdict: ${p.verdict}`,
      );
    });
    lines.push('');

    // Compute aggregate stats
    const goDeals = bundle.recentProperties.filter((p) => p.verdict === 'GO');
    const avgRevenue = Math.round(
      bundle.recentProperties.reduce((s, p) => s + p.annualRevenue, 0) / bundle.recentProperties.length,
    );
    const avgOccupancy = Math.round(
      (bundle.recentProperties.reduce((s, p) => s + p.occupancyRate, 0) / bundle.recentProperties.length) * 100,
    );
    lines.push(`Aggregate: ${bundle.recentProperties.length} properties analyzed recently, ${goDeals.length} rated GO, avg revenue $${avgRevenue.toLocaleString()}/yr, avg occupancy ${avgOccupancy}%.`);
    lines.push('');
  }

  // Market snapshots
  if (bundle.marketSnapshots.length > 0) {
    lines.push('Market Averages:');
    bundle.marketSnapshots.slice(0, 5).forEach((m) => {
      lines.push(
        `  - ${m.marketName}: ${m.totalListings} analyses, avg revenue $${m.averageRevenue.toLocaleString()}/yr`,
      );
    });
    lines.push('');
  }

  return lines.join('\n');
}
