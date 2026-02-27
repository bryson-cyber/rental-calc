/**
 * Property-Specific AI Chatbot — Gemini Flash
 * 
 * Provides a conversational AI assistant grounded exclusively in a specific
 * property's analysis data. Uses Gemini 3 Flash for fast, cost-effective
 * multi-turn chat with full property context injected as system instruction.
 * 
 * Supports two tones:
 * - 'guided' → beginner-friendly Coach Inayah style
 * - 'pro'    → investor-grade, data-dense language
 */

import { GoogleGenAI } from '@google/genai';
import { ENV } from './_core/env';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface PropertyChatContext {
  // Property basics
  address: string;
  bedrooms: number;
  bathrooms: number;
  accommodates?: number;
  monthlyRent?: number;

  // Revenue
  projectedRevenue: number;
  revenueLow: number;
  revenueHigh: number;
  adr: number;
  occupancyRate: number;

  // Cash flow
  monthlyRevenue: number;
  monthlyProfit: number;

  // Revenue scenarios (P50/P75/P90)
  revenueScenarios?: {
    conservative: number;
    target: number;
    optimistic: number;
    compCount: number;
  };

  // Monthly forecast
  forecast?: Array<{
    month: string;
    revenue: number;
    adr: number;
    occupancy: number;
  }>;

  // Comparable properties
  comparables?: Array<{
    title?: string;
    bedrooms?: number;
    bathrooms?: number;
    rating?: number;
    reviews?: number;
    annualRevenue?: number;
    adr?: number;
    occupancy?: number;
    distance?: number;
  }>;

  // Historical data
  historicalTrend?: string; // 'up' | 'down' | 'stable'
  yearlyPctChange?: number;

  // Market insights
  marketInsights?: {
    professionallyManagedPct?: number;
    superhostPct?: number;
    avgRating?: number;
    totalListings?: number;
    marketScore?: number;
  };

  // Rentometer data
  rentometer?: {
    median: number;
    mean?: number;
    min: number;
    max: number;
    sampleCount: number;
    radiusMiles?: number;
    stdDev?: number;
    userRentVsMarket: string;
    rentAdvantage: number;
    percentileRank: number;
  };

  // Mode
  mode?: 'rent' | 'purchase';
  purchasePrice?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

// ---------------------------------------------------------------------------
// SYSTEM PROMPT BUILDER
// ---------------------------------------------------------------------------

function buildSystemPrompt(ctx: PropertyChatContext, reportMode: 'pro' | 'guided'): string {
  const toneInstruction = reportMode === 'pro'
    ? `You are an expert short-term rental investment analyst. Use precise financial terminology, cite exact numbers and percentages, reference market benchmarks, and write in a data-dense investor-grade style. Do NOT over-explain basic concepts. Be concise and analytical.`
    : `You are Coach Inayah's friendly AI assistant helping someone learn about short-term rental investing. Use plain language with context and analogies. Explain industry terms when you use them. Break down complex concepts step by step. Be encouraging and supportive. This user may be newer to short-term rental investing.`;

  const parts: string[] = [
    toneInstruction,
    '',
    'You are a property-specific AI assistant. You ONLY answer questions about the specific property below. If someone asks about a different property or topic unrelated to this analysis, politely redirect them back to this property.',
    '',
    '=== PROPERTY ANALYSIS DATA ===',
    '',
    `Address: ${ctx.address}`,
    `Bedrooms: ${ctx.bedrooms} | Bathrooms: ${ctx.bathrooms}${ctx.accommodates ? ` | Accommodates: ${ctx.accommodates} guests` : ''}`,
    ctx.monthlyRent ? `Monthly Rent: $${ctx.monthlyRent.toLocaleString()}` : '',
    ctx.mode === 'purchase' && ctx.purchasePrice ? `Purchase Price: $${ctx.purchasePrice.toLocaleString()}` : '',
    '',
    '--- Revenue Projections ---',
    `Projected Annual Revenue: $${ctx.projectedRevenue.toLocaleString()}`,
    `Revenue Range: $${ctx.revenueLow.toLocaleString()} – $${ctx.revenueHigh.toLocaleString()}`,
    `Average Daily Rate (ADR): $${ctx.adr}`,
    `Occupancy Rate: ${(ctx.occupancyRate * 100).toFixed(1)}%`,
    `Monthly Revenue: $${ctx.monthlyRevenue.toLocaleString()}`,
    `Monthly Profit: $${ctx.monthlyProfit.toLocaleString()}`,
  ];

  // Revenue scenarios
  if (ctx.revenueScenarios) {
    const s = ctx.revenueScenarios;
    parts.push('');
    parts.push('--- Revenue Scenarios (Based on Comparable Properties) ---');
    parts.push(`Conservative (P50 – Median): $${s.conservative.toLocaleString()}/year`);
    parts.push(`Target (P75 – Top Quarter): $${s.target.toLocaleString()}/year`);
    parts.push(`Optimistic (P90 – Top 10%): $${s.optimistic.toLocaleString()}/year`);
    parts.push(`Based on ${s.compCount} comparable properties`);
  }

  // Monthly forecast
  if (ctx.forecast && ctx.forecast.length > 0) {
    parts.push('');
    parts.push('--- Monthly Revenue Forecast ---');
    ctx.forecast.forEach(m => {
      parts.push(`${m.month}: $${m.revenue.toLocaleString()} (ADR: $${m.adr}, Occupancy: ${(m.occupancy * 100).toFixed(0)}%)`);
    });

    // Identify best/worst months
    const sorted = [...ctx.forecast].sort((a, b) => b.revenue - a.revenue);
    const best = sorted.slice(0, 3).map(m => m.month).join(', ');
    const worst = sorted.slice(-3).map(m => m.month).join(', ');
    parts.push(`Best earning months: ${best}`);
    parts.push(`Slowest months: ${worst}`);
  }

  // Comparables
  if (ctx.comparables && ctx.comparables.length > 0) {
    parts.push('');
    parts.push(`--- Comparable Properties (${ctx.comparables.length} comps) ---`);
    ctx.comparables.slice(0, 10).forEach((comp, i) => {
      const info = [
        comp.title || `Comp ${i + 1}`,
        comp.bedrooms != null ? `${comp.bedrooms}BR` : '',
        comp.annualRevenue ? `$${comp.annualRevenue.toLocaleString()}/yr` : '',
        comp.adr ? `$${comp.adr} ADR` : '',
        comp.occupancy ? `${(comp.occupancy * 100).toFixed(0)}% occ` : '',
        comp.rating ? `${comp.rating}★ (${comp.reviews || 0} reviews)` : '',
        comp.distance ? `${(comp.distance / 1000).toFixed(1)}km away` : '',
      ].filter(Boolean).join(' | ');
      parts.push(`${i + 1}. ${info}`);
    });
  }

  // Historical trend
  if (ctx.historicalTrend || ctx.yearlyPctChange != null) {
    parts.push('');
    parts.push('--- Market Trend ---');
    if (ctx.historicalTrend) parts.push(`Revenue trend: ${ctx.historicalTrend}`);
    if (ctx.yearlyPctChange != null) parts.push(`Year-over-year change: ${ctx.yearlyPctChange > 0 ? '+' : ''}${ctx.yearlyPctChange.toFixed(1)}%`);
  }

  // Market insights
  if (ctx.marketInsights) {
    const mi = ctx.marketInsights;
    parts.push('');
    parts.push('--- Market Insights ---');
    if (mi.totalListings) parts.push(`Total active listings in area: ${mi.totalListings}`);
    if (mi.professionallyManagedPct != null) parts.push(`Professionally managed: ${(mi.professionallyManagedPct * 100).toFixed(0)}%`);
    if (mi.superhostPct != null) parts.push(`Superhosts: ${(mi.superhostPct * 100).toFixed(0)}%`);
    if (mi.avgRating) parts.push(`Average rating: ${mi.avgRating.toFixed(1)}`);
    if (mi.marketScore) parts.push(`Market score: ${mi.marketScore}/100`);
  }

  // Rentometer data
  if (ctx.rentometer) {
    const r = ctx.rentometer;
    parts.push('');
    parts.push('--- Rent Validation (Rentometer) ---');
    parts.push(`Median rent in area: $${r.median.toLocaleString()}/month`);
    if (r.mean) parts.push(`Mean rent: $${r.mean.toLocaleString()}/month`);
    parts.push(`Rent range: $${r.min.toLocaleString()} – $${r.max.toLocaleString()}`);
    parts.push(`Sample size: ${r.sampleCount} properties`);
    if (r.radiusMiles != null) parts.push(`Search radius: ${r.radiusMiles} miles`);
    if (r.stdDev != null) parts.push(`Standard deviation: ±$${r.stdDev.toLocaleString()}`);
    parts.push(`Your rent vs market: ${r.userRentVsMarket} (${r.rentAdvantage > 0 ? '+' : ''}$${r.rentAdvantage.toLocaleString()})`);
    parts.push(`Percentile rank: ${r.percentileRank}th`);
  }

  parts.push('');
  parts.push('=== END OF PROPERTY DATA ===');
  parts.push('');
  parts.push('RULES:');
  parts.push('1. ONLY discuss this specific property and its data. Do not make up numbers.');
  parts.push('2. When citing figures, use the exact numbers from the data above.');
  parts.push('3. If asked something not covered by the data, say so honestly.');
  parts.push('4. Keep responses concise — aim for 2-4 paragraphs unless the user asks for detail.');
  parts.push('5. When giving advice, frame it as educational information, not financial advice.');

  return parts.filter(p => p !== undefined).join('\n');
}

// ---------------------------------------------------------------------------
// GEMINI FLASH CHAT
// ---------------------------------------------------------------------------

const FLASH_MODEL = 'gemini-3-flash-preview';

function getClient(): GoogleGenAI {
  const apiKey = ENV.geminiApiKey;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Stream a property chat response via Gemini Flash.
 * Yields text chunks as they arrive.
 */
export async function* streamPropertyChat(
  propertyContext: PropertyChatContext,
  reportMode: 'pro' | 'guided',
  messages: ChatMessage[],
): AsyncGenerator<string, void, unknown> {
  const client = getClient();
  const systemPrompt = buildSystemPrompt(propertyContext, reportMode);

  // Build contents array for multi-turn conversation
  // Gemini expects alternating user/model turns
  const contents = messages.map(m => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  console.log(`[PropertyChat] Streaming with ${messages.length} messages, mode: ${reportMode}`);

  const config: Record<string, unknown> = {
    systemInstruction: systemPrompt,
    maxOutputTokens: 4096,
    thinkingConfig: {
      thinkingLevel: 'low',
    },
  };

  const response = await client.models.generateContentStream({
    model: FLASH_MODEL,
    contents,
    config,
  });

  for await (const chunk of response) {
    const text = chunk.text;
    if (text) {
      yield text;
    }
  }
}

/**
 * Non-streaming property chat (fallback).
 */
export async function propertyChat(
  propertyContext: PropertyChatContext,
  reportMode: 'pro' | 'guided',
  messages: ChatMessage[],
): Promise<string> {
  const client = getClient();
  const systemPrompt = buildSystemPrompt(propertyContext, reportMode);

  const contents = messages.map(m => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  console.log(`[PropertyChat] Non-streaming with ${messages.length} messages, mode: ${reportMode}`);

  const config: Record<string, unknown> = {
    systemInstruction: systemPrompt,
    maxOutputTokens: 4096,
    thinkingConfig: {
      thinkingLevel: 'low',
    },
  };

  const response = await client.models.generateContent({
    model: FLASH_MODEL,
    contents,
    config,
  });

  return response.text ?? '';
}
