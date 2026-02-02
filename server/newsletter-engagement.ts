/**
 * Newsletter Engagement Tracking
 * Pulls engagement data from HubSpot contact fields and segments contacts
 */

import { getDb } from './db';
import { newsletterSends, newsletterPreferences } from '../drizzle/schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Engagement levels based on activity
export type EngagementLevel = 'cold' | 'warm' | 'hot';

export interface ContactEngagement {
  hubspotId: string;
  email: string;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  engagementLevel: EngagementLevel;
  engagementScore: number;
  lastEmailOpen?: Date;
  lastEmailClick?: Date;
  lastFormSubmission?: Date;
  totalEmailsOpened: number;
  totalEmailsClicked: number;
  totalFormSubmissions: number;
  lastActivityDate?: Date;
  daysSinceLastActivity: number;
}

export interface EngagementStats {
  total: number;
  cold: number;
  warm: number;
  hot: number;
  avgEngagementScore: number;
}

/**
 * Get engagement data for a specific contact from HubSpot
 */
export async function getContactEngagement(hubspotId: string): Promise<ContactEngagement | null> {
  if (!HUBSPOT_API_KEY) {
    console.warn('[Engagement] HubSpot API key not configured');
    return null;
  }

  try {
    // Fetch contact with engagement properties
    const response = await fetch(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/${hubspotId}?properties=email,firstname,lastname,data_perfection__city,data_perfection__state,hs_email_last_open_date,hs_email_last_click_date,hs_email_open,hs_email_click,hs_analytics_last_visit_timestamp,num_conversion_events,recent_conversion_date`,
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('[Engagement] HubSpot API error:', response.status);
      return null;
    }

    const data = await response.json();
    const props = data.properties || {};

    // Calculate engagement metrics
    const lastEmailOpen = props.hs_email_last_open_date ? new Date(props.hs_email_last_open_date) : undefined;
    const lastEmailClick = props.hs_email_last_click_date ? new Date(props.hs_email_last_click_date) : undefined;
    const lastFormSubmission = props.recent_conversion_date ? new Date(props.recent_conversion_date) : undefined;
    
    const totalEmailsOpened = parseInt(props.hs_email_open || '0', 10);
    const totalEmailsClicked = parseInt(props.hs_email_click || '0', 10);
    const totalFormSubmissions = parseInt(props.num_conversion_events || '0', 10);

    // Determine last activity date
    const activityDates = [lastEmailOpen, lastEmailClick, lastFormSubmission].filter(Boolean) as Date[];
    const lastActivityDate = activityDates.length > 0 
      ? new Date(Math.max(...activityDates.map(d => d.getTime())))
      : undefined;

    const daysSinceLastActivity = lastActivityDate
      ? Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Calculate engagement score (0-100)
    const engagementScore = calculateEngagementScore({
      totalEmailsOpened,
      totalEmailsClicked,
      totalFormSubmissions,
      daysSinceLastActivity,
    });

    // Determine engagement level
    const engagementLevel = getEngagementLevel(engagementScore, daysSinceLastActivity);

    return {
      hubspotId,
      email: props.email || '',
      firstName: props.firstname || '',
      lastName: props.lastname || '',
      city: props.data_perfection__city || '',
      state: props.data_perfection__state || '',
      engagementLevel,
      engagementScore,
      lastEmailOpen,
      lastEmailClick,
      lastFormSubmission,
      totalEmailsOpened,
      totalEmailsClicked,
      totalFormSubmissions,
      lastActivityDate,
      daysSinceLastActivity,
    };
  } catch (error) {
    console.error('[Engagement] Error fetching contact:', error);
    return null;
  }
}

/**
 * Get engagement data for all contacts in a city
 */
export async function getEngagementByCity(city: string, state: string): Promise<ContactEngagement[]> {
  if (!HUBSPOT_API_KEY) {
    console.warn('[Engagement] HubSpot API key not configured');
    return [];
  }

  try {
    // Search for contacts in the city with engagement properties
    const response = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'data_perfection__city',
                operator: 'EQ',
                value: city.toUpperCase(),
              },
              {
                propertyName: 'data_perfection__state',
                operator: 'EQ',
                value: state.toUpperCase(),
              },
            ],
          },
        ],
        properties: [
          'email',
          'firstname',
          'lastname',
          'data_perfection__city',
          'data_perfection__state',
          'hs_email_last_open_date',
          'hs_email_last_click_date',
          'hs_email_open',
          'hs_email_click',
          'num_conversion_events',
          'recent_conversion_date',
        ],
        limit: 100,
      }),
    });

    if (!response.ok) {
      console.error('[Engagement] HubSpot search error:', response.status);
      return [];
    }

    const data = await response.json();
    const contacts: ContactEngagement[] = [];

    for (const result of data.results || []) {
      const props = result.properties || {};
      
      const lastEmailOpen = props.hs_email_last_open_date ? new Date(props.hs_email_last_open_date) : undefined;
      const lastEmailClick = props.hs_email_last_click_date ? new Date(props.hs_email_last_click_date) : undefined;
      const lastFormSubmission = props.recent_conversion_date ? new Date(props.recent_conversion_date) : undefined;
      
      const totalEmailsOpened = parseInt(props.hs_email_open || '0', 10);
      const totalEmailsClicked = parseInt(props.hs_email_click || '0', 10);
      const totalFormSubmissions = parseInt(props.num_conversion_events || '0', 10);

      const activityDates = [lastEmailOpen, lastEmailClick, lastFormSubmission].filter(Boolean) as Date[];
      const lastActivityDate = activityDates.length > 0 
        ? new Date(Math.max(...activityDates.map(d => d.getTime())))
        : undefined;

      const daysSinceLastActivity = lastActivityDate
        ? Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const engagementScore = calculateEngagementScore({
        totalEmailsOpened,
        totalEmailsClicked,
        totalFormSubmissions,
        daysSinceLastActivity,
      });

      const engagementLevel = getEngagementLevel(engagementScore, daysSinceLastActivity);

      contacts.push({
        hubspotId: result.id,
        email: props.email || '',
        firstName: props.firstname || '',
        lastName: props.lastname || '',
        city: props.data_perfection__city || '',
        state: props.data_perfection__state || '',
        engagementLevel,
        engagementScore,
        lastEmailOpen,
        lastEmailClick,
        lastFormSubmission,
        totalEmailsOpened,
        totalEmailsClicked,
        totalFormSubmissions,
        lastActivityDate,
        daysSinceLastActivity,
      });
    }

    return contacts;
  } catch (error) {
    console.error('[Engagement] Error fetching contacts by city:', error);
    return [];
  }
}

/**
 * Get overall engagement statistics
 */
export async function getEngagementStats(): Promise<EngagementStats> {
  if (!HUBSPOT_API_KEY) {
    return { total: 0, cold: 0, warm: 0, hot: 0, avgEngagementScore: 0 };
  }

  try {
    // Get all contacts with engagement data
    const response = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'data_perfection__city',
                operator: 'HAS_PROPERTY',
              },
            ],
          },
        ],
        properties: [
          'hs_email_open',
          'hs_email_click',
          'num_conversion_events',
          'hs_email_last_open_date',
        ],
        limit: 100,
      }),
    });

    if (!response.ok) {
      return { total: 0, cold: 0, warm: 0, hot: 0, avgEngagementScore: 0 };
    }

    const data = await response.json();
    const results = data.results || [];

    let cold = 0, warm = 0, hot = 0;
    let totalScore = 0;

    for (const result of results) {
      const props = result.properties || {};
      
      const totalEmailsOpened = parseInt(props.hs_email_open || '0', 10);
      const totalEmailsClicked = parseInt(props.hs_email_click || '0', 10);
      const totalFormSubmissions = parseInt(props.num_conversion_events || '0', 10);
      
      const lastEmailOpen = props.hs_email_last_open_date ? new Date(props.hs_email_last_open_date) : undefined;
      const daysSinceLastActivity = lastEmailOpen
        ? Math.floor((Date.now() - lastEmailOpen.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const score = calculateEngagementScore({
        totalEmailsOpened,
        totalEmailsClicked,
        totalFormSubmissions,
        daysSinceLastActivity,
      });

      totalScore += score;

      const level = getEngagementLevel(score, daysSinceLastActivity);
      if (level === 'cold') cold++;
      else if (level === 'warm') warm++;
      else hot++;
    }

    return {
      total: results.length,
      cold,
      warm,
      hot,
      avgEngagementScore: results.length > 0 ? Math.round(totalScore / results.length) : 0,
    };
  } catch (error) {
    console.error('[Engagement] Error getting stats:', error);
    return { total: 0, cold: 0, warm: 0, hot: 0, avgEngagementScore: 0 };
  }
}

/**
 * Calculate engagement score (0-100)
 */
function calculateEngagementScore(metrics: {
  totalEmailsOpened: number;
  totalEmailsClicked: number;
  totalFormSubmissions: number;
  daysSinceLastActivity: number;
}): number {
  let score = 0;

  // Email opens (max 30 points)
  score += Math.min(30, metrics.totalEmailsOpened * 3);

  // Email clicks (max 40 points) - clicks are more valuable
  score += Math.min(40, metrics.totalEmailsClicked * 10);

  // Form submissions (max 30 points) - highest value action
  score += Math.min(30, metrics.totalFormSubmissions * 15);

  // Recency bonus/penalty
  if (metrics.daysSinceLastActivity < 7) {
    score *= 1.2; // 20% bonus for activity in last week
  } else if (metrics.daysSinceLastActivity < 30) {
    score *= 1.0; // No change for activity in last month
  } else if (metrics.daysSinceLastActivity < 90) {
    score *= 0.8; // 20% penalty for 1-3 months inactive
  } else {
    score *= 0.5; // 50% penalty for 3+ months inactive
  }

  return Math.min(100, Math.round(score));
}

/**
 * Determine engagement level based on score and recency
 */
function getEngagementLevel(score: number, daysSinceLastActivity: number): EngagementLevel {
  // Hot: High score AND recent activity
  if (score >= 60 && daysSinceLastActivity < 14) {
    return 'hot';
  }
  
  // Warm: Moderate score OR recent activity
  if (score >= 30 || daysSinceLastActivity < 30) {
    return 'warm';
  }
  
  // Cold: Low score AND no recent activity
  return 'cold';
}

/**
 * Get recommended email frequency based on engagement level
 */
export function getRecommendedFrequency(level: EngagementLevel): {
  dealAlerts: 'daily' | 'weekly' | 'none';
  marketUpdates: 'weekly' | 'biweekly' | 'monthly';
  monthlyReports: boolean;
} {
  switch (level) {
    case 'hot':
      return {
        dealAlerts: 'daily',
        marketUpdates: 'weekly',
        monthlyReports: true,
      };
    case 'warm':
      return {
        dealAlerts: 'weekly',
        marketUpdates: 'weekly',
        monthlyReports: true,
      };
    case 'cold':
      return {
        dealAlerts: 'none', // Don't bombard cold contacts
        marketUpdates: 'monthly',
        monthlyReports: false,
      };
  }
}

/**
 * Update contact preferences based on engagement
 */
export async function updatePreferencesFromEngagement(hubspotId: string): Promise<void> {
  const engagement = await getContactEngagement(hubspotId);
  if (!engagement) return;

  const db = await getDb();
  if (!db) return;
  
  const frequency = getRecommendedFrequency(engagement.engagementLevel);

  // Check if preferences exist
  const existing = await db
    .select()
    .from(newsletterPreferences)
    .where(eq(newsletterPreferences.hubspotContactId, hubspotId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(newsletterPreferences)
      .set({
        dealAlertsEnabled: frequency.dealAlerts !== 'none' ? 1 : 0,
        weeklyMarketEnabled: frequency.marketUpdates === 'weekly' ? 1 : 0,
        monthlyReportEnabled: frequency.monthlyReports ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(newsletterPreferences.hubspotContactId, hubspotId));
  } else {
    await db.insert(newsletterPreferences).values({
      hubspotContactId: hubspotId,
      email: engagement.email,
      dealAlertsEnabled: frequency.dealAlerts !== 'none' ? 1 : 0,
      weeklyMarketEnabled: frequency.marketUpdates === 'weekly' ? 1 : 0,
      monthlyReportEnabled: frequency.monthlyReports ? 1 : 0,
    });
  }
}

/**
 * Segment contacts by engagement level for targeted campaigns
 */
export async function segmentContactsByEngagement(): Promise<{
  hot: ContactEngagement[];
  warm: ContactEngagement[];
  cold: ContactEngagement[];
}> {
  if (!HUBSPOT_API_KEY) {
    return { hot: [], warm: [], cold: [] };
  }

  try {
    const response = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'data_perfection__city',
                operator: 'HAS_PROPERTY',
              },
            ],
          },
        ],
        properties: [
          'email',
          'firstname',
          'lastname',
          'data_perfection__city',
          'data_perfection__state',
          'hs_email_last_open_date',
          'hs_email_last_click_date',
          'hs_email_open',
          'hs_email_click',
          'num_conversion_events',
          'recent_conversion_date',
        ],
        limit: 100,
      }),
    });

    if (!response.ok) {
      return { hot: [], warm: [], cold: [] };
    }

    const data = await response.json();
    const segments: { hot: ContactEngagement[]; warm: ContactEngagement[]; cold: ContactEngagement[] } = {
      hot: [],
      warm: [],
      cold: [],
    };

    for (const result of data.results || []) {
      const props = result.properties || {};
      
      const lastEmailOpen = props.hs_email_last_open_date ? new Date(props.hs_email_last_open_date) : undefined;
      const lastEmailClick = props.hs_email_last_click_date ? new Date(props.hs_email_last_click_date) : undefined;
      const lastFormSubmission = props.recent_conversion_date ? new Date(props.recent_conversion_date) : undefined;
      
      const totalEmailsOpened = parseInt(props.hs_email_open || '0', 10);
      const totalEmailsClicked = parseInt(props.hs_email_click || '0', 10);
      const totalFormSubmissions = parseInt(props.num_conversion_events || '0', 10);

      const activityDates = [lastEmailOpen, lastEmailClick, lastFormSubmission].filter(Boolean) as Date[];
      const lastActivityDate = activityDates.length > 0 
        ? new Date(Math.max(...activityDates.map(d => d.getTime())))
        : undefined;

      const daysSinceLastActivity = lastActivityDate
        ? Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const engagementScore = calculateEngagementScore({
        totalEmailsOpened,
        totalEmailsClicked,
        totalFormSubmissions,
        daysSinceLastActivity,
      });

      const engagementLevel = getEngagementLevel(engagementScore, daysSinceLastActivity);

      const contact: ContactEngagement = {
        hubspotId: result.id,
        email: props.email || '',
        firstName: props.firstname || '',
        lastName: props.lastname || '',
        city: props.data_perfection__city || '',
        state: props.data_perfection__state || '',
        engagementLevel,
        engagementScore,
        lastEmailOpen,
        lastEmailClick,
        lastFormSubmission,
        totalEmailsOpened,
        totalEmailsClicked,
        totalFormSubmissions,
        lastActivityDate,
        daysSinceLastActivity,
      };

      segments[engagementLevel].push(contact);
    }

    return segments;
  } catch (error) {
    console.error('[Engagement] Error segmenting contacts:', error);
    return { hot: [], warm: [], cold: [] };
  }
}
