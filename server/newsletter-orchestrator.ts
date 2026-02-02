/**
 * Newsletter Orchestrator
 * 
 * Coordinates the entire newsletter automation flow:
 * 1. Fetches contacts from HubSpot grouped by city
 * 2. Gets market data from AirDNA
 * 3. Generates personalized content with Gemini
 * 4. Sends emails via HubSpot Single Send API
 * 
 * This is the main entry point for scheduled newsletter jobs.
 */

import { getContactsByCity, getUniqueCities, type NewsletterContact } from './hubspot';
import { getMarketSnapshotForCity, batchGetMarketSnapshots, type MarketSnapshot } from './newsletter-market-data';
import { scanMarketForDeals, filterDealsForNewsletter, type RentalDeal } from './newsletter-deal-finder';
import { 
  generateWeeklyMarketNewsletter, 
  generateDealAlertNewsletter,
  generateEmailHtml,
  type NewsletterContent 
} from './newsletter-content-generator';
import { 
  sendSingleEmail, 
  logNewsletterSend, 
  isContactUnsubscribed,
  type SendEmailResult 
} from './newsletter-email-sender';
import { getDb } from './db';
import { sql } from 'drizzle-orm';

// Configuration
const TOOL_URL = process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com';
const WEEKLY_EMAIL_TEMPLATE_ID = parseInt(process.env.HUBSPOT_WEEKLY_EMAIL_ID || '0');
const DEAL_ALERT_EMAIL_TEMPLATE_ID = parseInt(process.env.HUBSPOT_DEAL_ALERT_EMAIL_ID || '0');

export interface NewsletterJobResult {
  jobType: 'weekly_market' | 'deal_alert' | 'monthly_report';
  startedAt: Date;
  completedAt: Date;
  citiesProcessed: number;
  contactsProcessed: number;
  emailsSent: number;
  emailsFailed: number;
  errors: string[];
}

/**
 * Run the weekly market intelligence newsletter job
 * This should be scheduled to run weekly (e.g., Monday 9 AM)
 */
export async function runWeeklyMarketNewsletterJob(): Promise<NewsletterJobResult> {
  const result: NewsletterJobResult = {
    jobType: 'weekly_market',
    startedAt: new Date(),
    completedAt: new Date(),
    citiesProcessed: 0,
    contactsProcessed: 0,
    emailsSent: 0,
    emailsFailed: 0,
    errors: []
  };
  
  try {
    console.log('[Newsletter] Starting weekly market newsletter job...');
    
    // Step 1: Get unique cities from HubSpot contacts
    const cities = await getUniqueCities();
    console.log(`[Newsletter] Found ${cities.length} unique cities`);
    
    if (cities.length === 0) {
      result.errors.push('No cities found in HubSpot contacts');
      result.completedAt = new Date();
      return result;
    }
    
    // Step 2: Get market data for all cities
    const marketSnapshots = await batchGetMarketSnapshots(cities);
    console.log(`[Newsletter] Fetched market data for ${marketSnapshots.size} cities`);
    
    // Step 3: Process each city
    for (const { city, state } of cities) {
      try {
        const key = `${city.toUpperCase()}-${state.toUpperCase()}`;
        const marketSnapshot = marketSnapshots.get(key);
        
        if (!marketSnapshot) {
          console.log(`[Newsletter] No market data for ${city}, ${state} - skipping`);
          continue;
        }
        
        // Get contacts in this city
        const contacts = await getContactsByCity(city, state);
        console.log(`[Newsletter] Found ${contacts.length} contacts in ${city}, ${state}`);
        
        // Send email to each contact
        for (const contact of contacts) {
          try {
            // Check if unsubscribed
            if (await isContactUnsubscribed(contact.email)) {
              console.log(`[Newsletter] Skipping unsubscribed contact: ${contact.email}`);
              continue;
            }
            
            result.contactsProcessed++;
            
            // Generate personalized content
            const content = await generateWeeklyMarketNewsletter({
              contact: {
                firstName: contact.firstName,
                lastName: contact.lastName,
                email: contact.email,
                city: city,
                state: state
              },
              marketSnapshot,
              toolUrl: `${TOOL_URL}?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`
            });
            
            // Send email
            let sendResult: SendEmailResult;
            
            if (WEEKLY_EMAIL_TEMPLATE_ID > 0) {
              // Use HubSpot template
              sendResult = await sendSingleEmail({
                emailId: WEEKLY_EMAIL_TEMPLATE_ID,
                recipient: {
                  email: contact.email,
                  firstName: contact.firstName,
                  lastName: contact.lastName,
                  contactId: contact.hubspotId
                },
                customProperties: {
                  subject: content.subject,
                  preheader: content.preheader,
                  greeting: content.greeting,
                  mainContent: content.mainContent,
                  callToAction: content.callToAction,
                  footer: content.footer,
                  city: city,
                  state: state,
                  marketScore: String(marketSnapshot.metrics.marketScore),
                  averageRevenue: String(marketSnapshot.metrics.averageRevenue),
                  occupancyRate: String(Math.round(marketSnapshot.metrics.occupancyRate * 100))
                }
              });
            } else {
              // Fallback: Log that we would send (for testing without HubSpot template)
              console.log(`[Newsletter] Would send to ${contact.email}: ${content.subject}`);
              sendResult = { success: true, sendId: `test-${Date.now()}` };
            }
            
            // Log the send
            await logNewsletterSend({
              contactEmail: contact.email,
              contactId: contact.hubspotId,
              city,
              state,
              newsletterType: 'weekly_market',
              subject: content.subject,
              success: sendResult.success,
              errorMessage: sendResult.error,
              hubspotSendId: sendResult.sendId
            });
            
            if (sendResult.success) {
              result.emailsSent++;
            } else {
              result.emailsFailed++;
            }
            
            // Small delay between emails
            await new Promise(resolve => setTimeout(resolve, 200));
            
          } catch (contactError) {
            result.emailsFailed++;
            result.errors.push(`Error sending to ${contact.email}: ${contactError}`);
          }
        }
        
        result.citiesProcessed++;
        
      } catch (cityError) {
        result.errors.push(`Error processing ${city}, ${state}: ${cityError}`);
      }
    }
    
  } catch (error) {
    result.errors.push(`Job error: ${error}`);
  }
  
  result.completedAt = new Date();
  console.log(`[Newsletter] Weekly job complete: ${result.emailsSent} sent, ${result.emailsFailed} failed`);
  
  // Log job result to database
  await logJobResult(result);
  
  return result;
}

/**
 * Run the deal alert newsletter job
 * This should be scheduled to run daily or when deals are found
 */
export async function runDealAlertJob(params?: {
  cities?: Array<{ city: string; state: string }>;
  minDealScore?: number;
}): Promise<NewsletterJobResult> {
  const result: NewsletterJobResult = {
    jobType: 'deal_alert',
    startedAt: new Date(),
    completedAt: new Date(),
    citiesProcessed: 0,
    contactsProcessed: 0,
    emailsSent: 0,
    emailsFailed: 0,
    errors: []
  };
  
  try {
    console.log('[Newsletter] Starting deal alert job...');
    
    // Get cities to scan (either provided or from HubSpot)
    const cities = params?.cities || await getUniqueCities();
    console.log(`[Newsletter] Scanning ${cities.length} cities for deals`);
    
    for (const { city, state } of cities) {
      try {
        // Note: In production, this would integrate with rental listing APIs
        // For now, we'll check if there are any cached deals in the database
        const cachedDeals = await getCachedDealsForCity(city, state);
        
        if (cachedDeals.length === 0) {
          console.log(`[Newsletter] No deals found for ${city}, ${state}`);
          continue;
        }
        
        // Filter deals by quality
        const qualityDeals = filterDealsForNewsletter(cachedDeals, {
          minScore: params?.minDealScore || 50,
          minGrade: 'C',
          maxDeals: 3
        });
        
        if (qualityDeals.length === 0) {
          continue;
        }
        
        console.log(`[Newsletter] Found ${qualityDeals.length} quality deals in ${city}, ${state}`);
        
        // Get contacts in this city
        const contacts = await getContactsByCity(city, state);
        
        // Get market snapshot for context
        const marketSnapshot = await getMarketSnapshotForCity(city, state);
        
        // Send deal alerts to contacts
        for (const contact of contacts) {
          try {
            if (await isContactUnsubscribed(contact.email)) {
              continue;
            }
            
            result.contactsProcessed++;
            
            // Generate deal alert content
            const content = await generateDealAlertNewsletter({
              contact: {
                firstName: contact.firstName,
                lastName: contact.lastName,
                email: contact.email,
                city,
                state
              },
              deals: qualityDeals,
              marketSnapshot: marketSnapshot || undefined,
              toolUrl: `${TOOL_URL}?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`
            });
            
            // Send email
            let sendResult: SendEmailResult;
            
            if (DEAL_ALERT_EMAIL_TEMPLATE_ID > 0) {
              sendResult = await sendSingleEmail({
                emailId: DEAL_ALERT_EMAIL_TEMPLATE_ID,
                recipient: {
                  email: contact.email,
                  firstName: contact.firstName,
                  lastName: contact.lastName,
                  contactId: contact.hubspotId
                },
                customProperties: {
                  subject: content.subject,
                  mainContent: content.mainContent,
                  topDealAddress: qualityDeals[0]?.address || '',
                  topDealProfit: String(qualityDeals[0]?.monthlyProfit || 0),
                  topDealScore: String(qualityDeals[0]?.dealScore || 0)
                }
              });
            } else {
              console.log(`[Newsletter] Would send deal alert to ${contact.email}: ${content.subject}`);
              sendResult = { success: true, sendId: `test-deal-${Date.now()}` };
            }
            
            await logNewsletterSend({
              contactEmail: contact.email,
              contactId: contact.hubspotId,
              city,
              state,
              newsletterType: 'deal_alert',
              subject: content.subject,
              success: sendResult.success,
              errorMessage: sendResult.error,
              hubspotSendId: sendResult.sendId
            });
            
            if (sendResult.success) {
              result.emailsSent++;
            } else {
              result.emailsFailed++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
          } catch (contactError) {
            result.emailsFailed++;
            result.errors.push(`Error sending deal alert to ${contact.email}: ${contactError}`);
          }
        }
        
        result.citiesProcessed++;
        
      } catch (cityError) {
        result.errors.push(`Error processing deals for ${city}, ${state}: ${cityError}`);
      }
    }
    
  } catch (error) {
    result.errors.push(`Deal alert job error: ${error}`);
  }
  
  result.completedAt = new Date();
  console.log(`[Newsletter] Deal alert job complete: ${result.emailsSent} sent, ${result.emailsFailed} failed`);
  
  await logJobResult(result);
  
  return result;
}

/**
 * Get cached deals from database for a city
 */
async function getCachedDealsForCity(city: string, state: string): Promise<RentalDeal[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    
    const result = await db.execute(sql`
      SELECT * FROM newsletter_deals
      WHERE city = ${city}
      AND state = ${state}
      AND analyzed_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY deal_score DESC
      LIMIT 10
    `);
    
    return ((result as any).rows || []).map((row: any) => ({
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      monthlyRent: row.monthly_rent,
      propertyType: row.property_type,
      sourceUrl: row.source_url,
      sourcePlatform: row.source_platform,
      imageUrl: row.image_url,
      projectedAnnualRevenue: row.projected_annual_revenue,
      projectedMonthlyRevenue: row.projected_monthly_revenue,
      projectedAdr: row.projected_adr,
      projectedOccupancy: row.projected_occupancy,
      monthlyProfit: row.monthly_profit,
      annualProfit: row.annual_profit,
      profitMargin: row.profit_margin,
      breakEvenOccupancy: row.break_even_occupancy,
      dealScore: row.deal_score,
      dealGrade: row.deal_grade,
      topComps: [],
      analyzedAt: new Date(row.analyzed_at)
    }));
  } catch (error) {
    console.error('[Newsletter] Error fetching cached deals:', error);
    return [];
  }
}

/**
 * Log job result to database
 */
async function logJobResult(result: NewsletterJobResult): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    
    await db.execute(sql`
      INSERT INTO newsletter_jobs (
        job_type, started_at, completed_at,
        cities_processed, contacts_processed,
        emails_sent, emails_failed, errors
      ) VALUES (
        ${result.jobType},
        ${result.startedAt},
        ${result.completedAt},
        ${result.citiesProcessed},
        ${result.contactsProcessed},
        ${result.emailsSent},
        ${result.emailsFailed},
        ${JSON.stringify(result.errors)}
      )
    `);
  } catch (error) {
    console.error('[Newsletter] Error logging job result:', error);
  }
}

/**
 * Get recent job history
 */
export async function getJobHistory(limit: number = 20): Promise<NewsletterJobResult[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    
    const result = await db.execute(sql`
      SELECT * FROM newsletter_jobs
      ORDER BY started_at DESC
      LIMIT ${limit}
    `);
    
    return ((result as any).rows || []).map((row: any) => ({
      jobType: row.job_type,
      startedAt: new Date(row.started_at),
      completedAt: new Date(row.completed_at),
      citiesProcessed: row.cities_processed,
      contactsProcessed: row.contacts_processed,
      emailsSent: row.emails_sent,
      emailsFailed: row.emails_failed,
      errors: JSON.parse(row.errors || '[]')
    }));
  } catch (error) {
    console.error('[Newsletter] Error fetching job history:', error);
    return [];
  }
}

/**
 * Manual trigger for testing - send a single test email
 */
export async function sendTestNewsletter(params: {
  email: string;
  firstName: string;
  city: string;
  state: string;
  type: 'weekly_market' | 'deal_alert';
}): Promise<{ success: boolean; content?: NewsletterContent; error?: string }> {
  try {
    const marketSnapshot = await getMarketSnapshotForCity(params.city, params.state);
    
    if (!marketSnapshot) {
      return { success: false, error: `No market data found for ${params.city}, ${params.state}` };
    }
    
    let content: NewsletterContent;
    
    if (params.type === 'weekly_market') {
      content = await generateWeeklyMarketNewsletter({
        contact: {
          firstName: params.firstName,
          lastName: '',
          email: params.email,
          city: params.city,
          state: params.state
        },
        marketSnapshot,
        toolUrl: `${TOOL_URL}?city=${encodeURIComponent(params.city)}&state=${encodeURIComponent(params.state)}`
      });
    } else {
      // For deal alerts, we need deals
      const deals = await getCachedDealsForCity(params.city, params.state);
      
      if (deals.length === 0) {
        return { success: false, error: 'No deals found for this city' };
      }
      
      content = await generateDealAlertNewsletter({
        contact: {
          firstName: params.firstName,
          lastName: '',
          email: params.email,
          city: params.city,
          state: params.state
        },
        deals: deals.slice(0, 3),
        marketSnapshot,
        toolUrl: `${TOOL_URL}?city=${encodeURIComponent(params.city)}&state=${encodeURIComponent(params.state)}`
      });
    }
    
    console.log(`[Newsletter] Test email generated for ${params.email}:`, content.subject);
    
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
