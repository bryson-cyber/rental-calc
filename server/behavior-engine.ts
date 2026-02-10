/**
 * Behavior-Adaptive Follow-Up Engine
 * 
 * Analyzes user behavior from toolUsageEvents and dynamically selects
 * the most relevant next email/notification content instead of a fixed timer.
 * 
 * This is the "Claude Code for STR" intelligence layer — it watches what
 * users do and adapts its outreach accordingly.
 */

import { eq, and, desc, gte, sql, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { toolUsageEvents } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";

// ============================================================
// Types
// ============================================================

export interface UserBehaviorProfile {
  email: string;
  
  // Engagement metrics
  totalEvents: number;
  uniqueTools: string[];
  uniqueMarkets: { city: string; state: string; count: number }[];
  mostUsedTool: string | null;
  lastActiveAt: Date | null;
  daysSinceLastActive: number;
  
  // Interest signals
  engagementLevel: 'cold' | 'warm' | 'hot' | 'power_user';
  primaryInterest: 'arbitrage' | 'investment' | 'research' | 'unknown';
  topMarket: { city: string; state: string } | null;
  
  // Journey stage
  journeyStage: 'awareness' | 'consideration' | 'decision' | 'retention';
  
  // Tool usage breakdown
  toolBreakdown: Record<string, number>;
  
  // Revenue signals
  hasSearchedProperties: boolean;
  hasUsedCalculator: boolean;
  hasUsedAdvisor: boolean;
  hasCheckedRegulations: boolean;
  hasGeneratedReport: boolean;
  hasSetDealAlerts: boolean;
}

export interface AdaptiveEmailContent {
  subject: string;
  previewText: string;
  htmlBody: string;
  emailType: string; // e.g., 'market_update', 'deal_opportunity', 'regulation_alert', 'engagement_nudge'
  reasoning: string; // Why this email was chosen
  priority: number; // 1-10, higher = more urgent
}

export type EmailStrategy = 
  | 'market_deep_dive'      // User searched a market but didn't go deeper
  | 'property_nudge'        // User used calculator but didn't check specific properties
  | 'regulation_reminder'   // User hasn't checked regulations for their top market
  | 'deal_alert_setup'      // Active user who hasn't set up deal alerts
  | 'advisor_intro'         // User hasn't tried the AI advisor
  | 'report_upsell'         // User has done basic research but no full report
  | 'win_back'              // User was active but went cold
  | 'power_user_reward'     // Highly engaged user — give exclusive content
  | 'new_market_suggestion' // Suggest a related market based on their searches
  | 'seasonal_opportunity'; // Timely market opportunity based on seasonality

// ============================================================
// Behavior Analysis
// ============================================================

export async function buildUserBehaviorProfile(email: string): Promise<UserBehaviorProfile | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Get all events for this user in the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const events = await db
    .select()
    .from(toolUsageEvents)
    .where(
      and(
        eq(toolUsageEvents.email, email),
        gte(toolUsageEvents.createdAt, ninetyDaysAgo)
      )
    )
    .orderBy(desc(toolUsageEvents.createdAt))
    .limit(500);
  
  if (events.length === 0) {
    return {
      email,
      totalEvents: 0,
      uniqueTools: [],
      uniqueMarkets: [],
      mostUsedTool: null,
      lastActiveAt: null,
      daysSinceLastActive: 999,
      engagementLevel: 'cold',
      primaryInterest: 'unknown',
      topMarket: null,
      journeyStage: 'awareness',
      toolBreakdown: {},
      hasSearchedProperties: false,
      hasUsedCalculator: false,
      hasUsedAdvisor: false,
      hasCheckedRegulations: false,
      hasGeneratedReport: false,
      hasSetDealAlerts: false,
    };
  }
  
  // Tool breakdown
  const toolBreakdown: Record<string, number> = {};
  for (const event of events) {
    toolBreakdown[event.toolName] = (toolBreakdown[event.toolName] || 0) + 1;
  }
  
  // Market breakdown
  const marketMap = new Map<string, { city: string; state: string; count: number }>();
  for (const event of events) {
    if (event.city && event.state) {
      const key = `${event.city.toLowerCase()},${event.state.toLowerCase()}`;
      const existing = marketMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        marketMap.set(key, { city: event.city, state: event.state, count: 1 });
      }
    }
  }
  const uniqueMarkets = Array.from(marketMap.values()).sort((a, b) => b.count - a.count);
  
  // Most used tool
  const sortedTools = Object.entries(toolBreakdown).sort(([, a], [, b]) => b - a);
  const mostUsedTool = sortedTools.length > 0 ? sortedTools[0][0] : null;
  
  // Last active
  const lastActiveAt = events[0]?.createdAt || null;
  const daysSinceLastActive = lastActiveAt 
    ? Math.floor((Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  
  // Engagement level
  let engagementLevel: UserBehaviorProfile['engagementLevel'] = 'cold';
  if (events.length >= 20 && daysSinceLastActive <= 7) {
    engagementLevel = 'power_user';
  } else if (events.length >= 5 && daysSinceLastActive <= 14) {
    engagementLevel = 'hot';
  } else if (events.length >= 2 && daysSinceLastActive <= 30) {
    engagementLevel = 'warm';
  }
  
  // Primary interest detection
  const toolNames = events.map(e => e.toolName.toLowerCase());
  let primaryInterest: UserBehaviorProfile['primaryInterest'] = 'unknown';
  
  const arbitrageSignals = toolNames.filter(t => 
    t.includes('arbitrage') || t.includes('rent') || t.includes('calculator')
  ).length;
  const investmentSignals = toolNames.filter(t => 
    t.includes('investment') || t.includes('purchase') || t.includes('buy')
  ).length;
  const researchSignals = toolNames.filter(t => 
    t.includes('market') || t.includes('advisor') || t.includes('regulation') || t.includes('explore')
  ).length;
  
  if (arbitrageSignals > investmentSignals && arbitrageSignals > researchSignals) {
    primaryInterest = 'arbitrage';
  } else if (investmentSignals > arbitrageSignals && investmentSignals > researchSignals) {
    primaryInterest = 'investment';
  } else if (researchSignals > 0) {
    primaryInterest = 'research';
  }
  
  // Journey stage
  let journeyStage: UserBehaviorProfile['journeyStage'] = 'awareness';
  const uniqueToolNames = Array.from(new Set(toolNames));
  
  if (uniqueToolNames.length >= 4 && events.length >= 10) {
    journeyStage = 'retention';
  } else if (uniqueToolNames.length >= 3 || events.length >= 5) {
    journeyStage = 'decision';
  } else if (events.length >= 2) {
    journeyStage = 'consideration';
  }
  
  // Feature usage flags
  const hasSearchedProperties = toolNames.some(t => t.includes('search') || t.includes('explore') || t.includes('validate'));
  const hasUsedCalculator = toolNames.some(t => t.includes('calculator') || t.includes('revenue') || t.includes('prove'));
  const hasUsedAdvisor = toolNames.some(t => t.includes('advisor') || t.includes('chat'));
  const hasCheckedRegulations = toolNames.some(t => t.includes('regulation'));
  const hasGeneratedReport = toolNames.some(t => t.includes('report') || t.includes('full_report'));
  const hasSetDealAlerts = toolNames.some(t => t.includes('deal_alert') || t.includes('alert'));
  
  return {
    email,
    totalEvents: events.length,
    uniqueTools: uniqueToolNames,
    uniqueMarkets,
    mostUsedTool,
    lastActiveAt,
    daysSinceLastActive,
    engagementLevel,
    primaryInterest,
    topMarket: uniqueMarkets.length > 0 ? { city: uniqueMarkets[0].city, state: uniqueMarkets[0].state } : null,
    journeyStage,
    toolBreakdown,
    hasSearchedProperties,
    hasUsedCalculator,
    hasUsedAdvisor,
    hasCheckedRegulations,
    hasGeneratedReport,
    hasSetDealAlerts,
  };
}

// ============================================================
// Strategy Selection
// ============================================================

export function selectEmailStrategy(profile: UserBehaviorProfile): EmailStrategy {
  // Win-back: user was active but went cold (14+ days)
  if (profile.engagementLevel === 'cold' && profile.totalEvents > 0 && profile.daysSinceLastActive >= 14) {
    return 'win_back';
  }
  
  // Power user reward: highly engaged users get exclusive content
  if (profile.engagementLevel === 'power_user') {
    if (!profile.hasSetDealAlerts) return 'deal_alert_setup';
    return 'power_user_reward';
  }
  
  // Hot users: push them toward conversion
  if (profile.engagementLevel === 'hot') {
    if (!profile.hasGeneratedReport && profile.topMarket) return 'report_upsell';
    if (!profile.hasSetDealAlerts) return 'deal_alert_setup';
    if (!profile.hasCheckedRegulations && profile.topMarket) return 'regulation_reminder';
    return 'new_market_suggestion';
  }
  
  // Warm users: deepen engagement
  if (profile.engagementLevel === 'warm') {
    if (!profile.hasUsedAdvisor && profile.topMarket) return 'advisor_intro';
    if (profile.hasUsedCalculator && !profile.hasSearchedProperties) return 'property_nudge';
    if (profile.topMarket && !profile.hasCheckedRegulations) return 'regulation_reminder';
    return 'market_deep_dive';
  }
  
  // Cold users with some history: re-engage
  if (profile.topMarket) {
    return 'seasonal_opportunity';
  }
  
  return 'market_deep_dive';
}

// ============================================================
// Email Content Generation
// ============================================================

export async function generateAdaptiveEmail(
  profile: UserBehaviorProfile,
  strategy?: EmailStrategy
): Promise<AdaptiveEmailContent> {
  const selectedStrategy = strategy || selectEmailStrategy(profile);
  const market = profile.topMarket;
  const marketLabel = market ? `${market.city}, ${market.state}` : 'your target market';
  
  const strategyPrompts: Record<EmailStrategy, string> = {
    market_deep_dive: `Write a personalized email about the ${marketLabel} short-term rental market. The user has shown interest but hasn't explored deeply. Include specific data points about revenue potential, occupancy trends, and why this market is worth investigating further. End with a CTA to use the Market Evaluation tool.`,
    
    property_nudge: `Write a personalized email encouraging the user to search for specific properties in ${marketLabel}. They've used the revenue calculator but haven't looked at actual listings. Mention that finding the right property is the next step after knowing the revenue potential. CTA to the Property Explorer tool.`,
    
    regulation_reminder: `Write a personalized email about STR regulations in ${marketLabel}. The user has been researching this market but hasn't checked the rules yet. Emphasize that understanding regulations before investing saves time and money. CTA to the Regulation Tracker.`,
    
    deal_alert_setup: `Write a personalized email about the Deal Alerts feature. The user is highly engaged but hasn't set up automated alerts. Explain how deal alerts work while they sleep — scanning for properties that match their criteria. CTA to set up their first deal alert.`,
    
    advisor_intro: `Write a personalized email introducing the AI Market Advisor. The user has been using other tools but hasn't tried the advisor yet. Position it as having a local Airbnb expert available 24/7 who knows everything about ${marketLabel}. CTA to chat with the advisor.`,
    
    report_upsell: `Write a personalized email about the Full Report feature. The user has done basic research on ${marketLabel} but hasn't generated a comprehensive report. Explain how the full report combines all their research into one actionable document with AI analysis. CTA to generate a full report.`,
    
    win_back: `Write a re-engagement email for someone who was actively researching ${marketLabel} but hasn't visited in ${profile.daysSinceLastActive} days. Include a compelling "what's changed" angle — mention that market conditions shift and their earlier research may need updating. CTA to come back and check the latest data.`,
    
    power_user_reward: `Write an exclusive email for a power user who's deeply engaged with the platform. Thank them for their dedication, share an insider tip about ${marketLabel} or STR investing in general, and mention the new One-Click Market Evaluation feature. Make them feel valued.`,
    
    new_market_suggestion: `Write a personalized email suggesting a related market to ${marketLabel}. The user has thoroughly researched their primary market and might benefit from diversifying. Suggest 2-3 nearby or similar markets worth exploring. CTA to evaluate a new market.`,
    
    seasonal_opportunity: `Write a timely email about seasonal opportunities in ${marketLabel}. Reference the current time of year and how it affects STR revenue, occupancy, and pricing. Include actionable advice about timing their investment or listing strategy. CTA to check current market data.`,
  };
  
  const prompt = strategyPrompts[selectedStrategy];
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are Coach Inayah's email copywriter. Write short, warm, personalized emails for short-term rental investors. 
          
Rules:
- Keep emails under 200 words
- Use a warm, supportive, conversational tone (like a friend who's also a mentor)
- Write at a 5th grade reading level — simple words, short sentences
- Include one clear CTA with a link placeholder [CTA_LINK]
- Never use the word "AirDNA" — say "powered by Coach Inayah market data" if referencing data source
- Sign off as "Coach Inayah"
- Format as JSON with fields: subject, previewText, htmlBody (simple HTML with inline styles)`
        },
        {
          role: 'user',
          content: `${prompt}

User profile:
- Engagement: ${profile.engagementLevel}
- Primary interest: ${profile.primaryInterest}
- Tools used: ${profile.uniqueTools.join(', ') || 'none yet'}
- Markets researched: ${profile.uniqueMarkets.map(m => `${m.city}, ${m.state} (${m.count}x)`).join('; ') || 'none yet'}
- Days since last active: ${profile.daysSinceLastActive}
- Journey stage: ${profile.journeyStage}`
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'adaptive_email',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              subject: { type: 'string', description: 'Email subject line' },
              previewText: { type: 'string', description: 'Email preview text (shown in inbox)' },
              htmlBody: { type: 'string', description: 'Email HTML body with inline styles' },
            },
            required: ['subject', 'previewText', 'htmlBody'],
            additionalProperties: false,
          },
        },
      },
    });
    
    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('No LLM response');
    
    const parsed = JSON.parse(content as string);
    
    return {
      subject: parsed.subject,
      previewText: parsed.previewText,
      htmlBody: parsed.htmlBody,
      emailType: selectedStrategy,
      reasoning: `Strategy: ${selectedStrategy}. User is ${profile.engagementLevel} with ${profile.totalEvents} events. Primary interest: ${profile.primaryInterest}. Top market: ${marketLabel}. Journey stage: ${profile.journeyStage}.`,
      priority: calculatePriority(profile, selectedStrategy),
    };
  } catch (error) {
    console.error('[BehaviorEngine] Failed to generate adaptive email:', error);
    
    // Fallback to a simple template
    return {
      subject: `New insights for ${marketLabel}`,
      previewText: `Check out the latest data for ${marketLabel}`,
      htmlBody: `<p>Hey there,</p><p>We've got new market data for ${marketLabel}. Come check it out!</p><p>— Coach Inayah</p>`,
      emailType: selectedStrategy,
      reasoning: 'Fallback template used due to LLM error',
      priority: 3,
    };
  }
}

function calculatePriority(profile: UserBehaviorProfile, strategy: EmailStrategy): number {
  // Higher priority = more urgent/important
  const basePriority: Record<EmailStrategy, number> = {
    win_back: 8,
    deal_alert_setup: 7,
    report_upsell: 6,
    regulation_reminder: 6,
    property_nudge: 5,
    advisor_intro: 5,
    market_deep_dive: 4,
    power_user_reward: 7,
    new_market_suggestion: 4,
    seasonal_opportunity: 5,
  };
  
  let priority = basePriority[strategy] || 5;
  
  // Boost priority for hot/power users
  if (profile.engagementLevel === 'power_user') priority = Math.min(10, priority + 2);
  if (profile.engagementLevel === 'hot') priority = Math.min(10, priority + 1);
  
  // Reduce priority for very cold users (they might not open anyway)
  if (profile.daysSinceLastActive > 60) priority = Math.max(1, priority - 2);
  
  return priority;
}

// ============================================================
// Batch Processing
// ============================================================

export async function processAdaptiveFollowUps(limit: number = 50): Promise<{
  processed: number;
  emails: Array<{
    email: string;
    strategy: EmailStrategy;
    priority: number;
    reasoning: string;
  }>;
}> {
  const db = await getDb();
  if (!db) return { processed: 0, emails: [] };
  
  // Get unique emails from recent tool usage events
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentUsers = await db
    .selectDistinct({ email: toolUsageEvents.email })
    .from(toolUsageEvents)
    .where(
      and(
        gte(toolUsageEvents.createdAt, thirtyDaysAgo),
        sql`${toolUsageEvents.email} IS NOT NULL AND ${toolUsageEvents.email} != ''`
      )
    )
    .limit(limit);
  
  const results: Array<{
    email: string;
    strategy: EmailStrategy;
    priority: number;
    reasoning: string;
  }> = [];
  
  for (const user of recentUsers) {
    if (!user.email) continue;
    
    try {
      const profile = await buildUserBehaviorProfile(user.email);
      if (!profile) continue;
      
      const strategy = selectEmailStrategy(profile);
      const emailContent = await generateAdaptiveEmail(profile, strategy);
      
      results.push({
        email: user.email,
        strategy,
        priority: emailContent.priority,
        reasoning: emailContent.reasoning,
      });
      
      // In production, you would send the email here using sendEmail()
      // For now, we just log the strategy selection
      console.log(`[BehaviorEngine] ${user.email}: ${strategy} (priority: ${emailContent.priority})`);
    } catch (error) {
      console.error(`[BehaviorEngine] Failed to process ${user.email}:`, error);
    }
  }
  
  // Sort by priority (highest first)
  results.sort((a, b) => b.priority - a.priority);
  
  return {
    processed: results.length,
    emails: results,
  };
}

// ============================================================
// Analytics
// ============================================================

export async function getEngagementAnalytics(): Promise<{
  totalUsers: number;
  engagementBreakdown: Record<string, number>;
  topStrategies: Array<{ strategy: string; count: number }>;
  topMarkets: Array<{ city: string; state: string; users: number }>;
  averageEventsPerUser: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalUsers: 0,
      engagementBreakdown: {},
      topStrategies: [],
      topMarkets: [],
      averageEventsPerUser: 0,
    };
  }
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Get all recent users
  const recentUsers = await db
    .selectDistinct({ email: toolUsageEvents.email })
    .from(toolUsageEvents)
    .where(
      and(
        gte(toolUsageEvents.createdAt, thirtyDaysAgo),
        sql`${toolUsageEvents.email} IS NOT NULL AND ${toolUsageEvents.email} != ''`
      )
    );
  
  const engagementBreakdown: Record<string, number> = {
    cold: 0,
    warm: 0,
    hot: 0,
    power_user: 0,
  };
  
  const strategyCount: Record<string, number> = {};
  const marketUserMap = new Map<string, Set<string>>();
  let totalEvents = 0;
  
  // Sample up to 100 users for analytics
  const sampleUsers = recentUsers.slice(0, 100);
  
  for (const user of sampleUsers) {
    if (!user.email) continue;
    
    const profile = await buildUserBehaviorProfile(user.email);
    if (!profile) continue;
    
    engagementBreakdown[profile.engagementLevel]++;
    totalEvents += profile.totalEvents;
    
    const strategy = selectEmailStrategy(profile);
    strategyCount[strategy] = (strategyCount[strategy] || 0) + 1;
    
    if (profile.topMarket) {
      const key = `${profile.topMarket.city},${profile.topMarket.state}`;
      if (!marketUserMap.has(key)) marketUserMap.set(key, new Set());
      marketUserMap.get(key)!.add(user.email);
    }
  }
  
  const topStrategies = Object.entries(strategyCount)
    .sort(([, a], [, b]) => b - a)
    .map(([strategy, count]) => ({ strategy, count }));
  
  const topMarkets = Array.from(marketUserMap.entries())
    .map(([key, users]) => {
      const [city, state] = key.split(',');
      return { city, state, users: users.size };
    })
    .sort((a, b) => b.users - a.users)
    .slice(0, 10);
  
  return {
    totalUsers: recentUsers.length,
    engagementBreakdown,
    topStrategies,
    topMarkets,
    averageEventsPerUser: sampleUsers.length > 0 ? Math.round(totalEvents / sampleUsers.length) : 0,
  };
}
