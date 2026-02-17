/**
 * Newsletter Content Generator
 * 
 * Uses Claude Sonnet 4.6 to generate personalized, engaging newsletter content
 * for market intelligence and deal alerts.
 */

import { callLLM } from './llm-provider';
import type { MarketSnapshot } from './newsletter-market-data';
import type { RentalDeal } from './newsletter-deal-finder';

export interface NewsletterContent {
  subject: string;
  preheader: string;
  greeting: string;
  mainContent: string;
  callToAction: string;
  footer: string;
}

interface ContactInfo {
  firstName: string;
  lastName: string;
  email: string;
  city: string;
  state: string;
}

/**
 * Call Claude Sonnet 4.6 with structured JSON output
 */
async function callClaudeForJson<T>(
  systemPrompt: string,
  userPrompt: string,
): Promise<T> {
  const prompt = `${userPrompt}\n\nRespond with valid JSON only, no markdown fences.`;
  const text = await callLLM(prompt, {
    systemPrompt,
    model: 'flash',
    thinkingLevel: 'low',
    maxTokens: 2048,
  });

  // Strip markdown fences if present
  const cleaned = text.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
  if (!cleaned) {
    throw new Error('Empty response from Claude');
  }

  return JSON.parse(cleaned) as T;
}

/**
 * Generate weekly market intelligence newsletter content
 */
export async function generateWeeklyMarketNewsletter(params: {
  contact: ContactInfo;
  marketSnapshot: MarketSnapshot;
  toolUrl: string;
}): Promise<NewsletterContent> {
  const { contact, marketSnapshot, toolUrl } = params;

  const systemPrompt = `You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist and founder of StayMetrics, managing $100M+ across 400+ properties in 35 U.S. markets. You are writing personalized weekly market intelligence emails on behalf of Coach Inayah for people interested in Airbnb arbitrage. Your communication style: data-first (every claim references specific numbers), "story before the stats" (lead with narrative, then data), analogy over jargon, warm but direct — like a trusted advisor sharing insights over coffee. You never sugarcoat risks but always empower.`;

  const userPrompt = `Write a weekly market intelligence email for this recipient:

RECIPIENT INFO:
- Name: ${contact.firstName} ${contact.lastName}
- Target Market: ${contact.city}, ${marketSnapshot.state}

MARKET DATA FOR ${contact.city.toUpperCase()}, ${marketSnapshot.state}:
- Average Annual Revenue: $${marketSnapshot.metrics.averageRevenue.toLocaleString()}
- Average Daily Rate: $${marketSnapshot.metrics.averageDailyRate.toLocaleString()}
- Occupancy Rate: ${Math.round(marketSnapshot.metrics.occupancyRate * 100)}%
- RevPAR: $${marketSnapshot.metrics.revpar.toLocaleString()}
- Active Listings: ${marketSnapshot.metrics.activeListings.toLocaleString()}
- Market Score: ${marketSnapshot.metrics.marketScore}/100
- Market Health: ${marketSnapshot.insights.marketHealth.toUpperCase()}

MARKET INSIGHT:
${marketSnapshot.insights.recommendation}

TOOL URL: ${toolUrl}

Write an engaging, conversational email that:
1. Greets them by first name
2. Shares exciting insights about their target market (${contact.city})
3. Highlights the key metrics in a digestible way
4. Creates excitement about the opportunity without being pushy
5. Includes a soft CTA to explore the free tool for more details
6. Signs off as "Coach Inayah's Team"

LENGTH: Keep it concise - 150-200 words max for the main content.

Output as JSON with these fields:
{
  "subject": "Email subject line (compelling, personalized)",
  "preheader": "Preview text (50 chars max)",
  "greeting": "Personalized greeting",
  "mainContent": "The main email body (use \\n for line breaks)",
  "callToAction": "CTA text and link",
  "footer": "Sign-off"
}`;

  try {
    return await callClaudeForJson<NewsletterContent>(systemPrompt, userPrompt);
  } catch (error) {
    console.error('[Newsletter] Error generating weekly content:', error);

    // Fallback content
    return {
      subject: `${contact.city} Market Update - Your Weekly Airbnb Intel`,
      preheader: `See what's happening in ${contact.city}...`,
      greeting: `Hey ${contact.firstName}!`,
      mainContent: `Here's your weekly market snapshot for ${contact.city}, ${marketSnapshot.state}:\n\n` +
        `Average Revenue: $${marketSnapshot.metrics.averageRevenue.toLocaleString()}/year\n` +
        `Occupancy: ${Math.round(marketSnapshot.metrics.occupancyRate * 100)}%\n` +
        `Active Listings: ${marketSnapshot.metrics.activeListings.toLocaleString()}\n\n` +
        `${marketSnapshot.insights.recommendation}`,
      callToAction: `Explore ${contact.city} in detail: ${toolUrl}`,
      footer: `To your success,\nCoach Inayah's Team`
    };
  }
}

/**
 * Generate deal alert newsletter content
 */
export async function generateDealAlertNewsletter(params: {
  contact: ContactInfo;
  deals: RentalDeal[];
  marketSnapshot?: MarketSnapshot;
  toolUrl: string;
}): Promise<NewsletterContent> {
  const { contact, deals, marketSnapshot, toolUrl } = params;

  // Format deals for the prompt
  const dealsText = deals.slice(0, 3).map((deal, i) => `
DEAL ${i + 1}:
- Address: ${deal.address}
- Bedrooms/Baths: ${deal.bedrooms}BR/${deal.bathrooms}BA
- Monthly Rent: $${deal.monthlyRent.toLocaleString()}
- Projected Revenue: $${deal.projectedMonthlyRevenue.toLocaleString()}/mo
- Projected Profit: $${deal.monthlyProfit.toLocaleString()}/mo
- Profit Margin: ${Math.round(deal.profitMargin * 100)}%
- Deal Score: ${deal.dealScore}/100 (Grade ${deal.dealGrade})
`).join('\n');

  const topDeal = deals[0];

  const systemPrompt = `You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist and founder of StayMetrics, managing $100M+ across 400+ properties in 35 U.S. markets. You are writing personalized deal alert emails on behalf of Coach Inayah's team for people interested in Airbnb rental arbitrage. Coach Inayah helps people start Airbnb businesses through rental arbitrage (renting a property and listing it on Airbnb for profit). The Turnkey Program is a done-for-you service that handles everything: finding properties, negotiating with landlords, setting up and designing the property, furnishing it, creating the Airbnb listing, and automating operations. Your communication style: data-first (every claim references specific numbers), "story before the stats" (lead with narrative, then data), analogy over jargon, warm but direct. Be confident but not arrogant, helpful and educational, not salesy.`;

  const userPrompt = `Write a deal alert email for this recipient:

RECIPIENT:
- First Name: ${contact.firstName}
- Target Market: ${contact.city}, ${contact.state}

THE OPPORTUNITY:
${dealsText}

${marketSnapshot ? `MARKET DATA:
- Market Health: ${marketSnapshot.insights.marketHealth}
- Average Occupancy: ${Math.round(marketSnapshot.metrics.occupancyRate * 100)}%
- Average Daily Rate: $${marketSnapshot.metrics.averageDailyRate}
` : ''}

WRITING GUIDELINES:
1. Start with a warm, personal greeting using their first name
2. Share the excitement naturally - you just found something good and want to share it
3. Focus on the PROFIT potential, not just revenue (rent vs. projected income = profit)
4. Mention specific numbers that matter: monthly profit, rent amount, occupancy rate
5. Explain briefly why this property caught your attention (location, numbers, market conditions)
6. Create gentle urgency - good deals get taken quickly, but don't be pushy or salesy
7. Mention that the Turnkey Program handles everything: finding deals, landlord negotiation, property setup, design, furnishing, listing creation, and automation
8. End with a clear next step (view the full analysis or book a call)

LENGTH: 120-180 words for main content. Quality over brevity.

Output as JSON:
{
  "subject": "Email subject line - include the profit potential or key number, make it specific to their city",
  "preheader": "Preview text that creates curiosity (50 chars max)",
  "greeting": "Warm personalized greeting with their name",
  "mainContent": "The main email body. Use \\n\\n for paragraph breaks. Be conversational and specific about the numbers.",
  "callToAction": "Clear next step with the tool URL: ${toolUrl}",
  "footer": "Warm sign-off from Coach Inayah's Team"
}`;

  try {
    return await callClaudeForJson<NewsletterContent>(systemPrompt, userPrompt);
  } catch (error) {
    console.error('[Newsletter] Error generating deal alert content:', error);

    // Fallback content
    return {
      subject: `Hot Deal Alert: $${topDeal.monthlyProfit.toLocaleString()}/mo profit potential in ${contact.city}!`,
      preheader: `New arbitrage opportunity found...`,
      greeting: `${contact.firstName}, check this out!`,
      mainContent: `We just found a promising deal in ${contact.city}:\n\n` +
        `${topDeal.address}\n` +
        `${topDeal.bedrooms}BR/${topDeal.bathrooms}BA\n` +
        `Monthly Rent: $${topDeal.monthlyRent.toLocaleString()}\n` +
        `Projected Revenue: $${topDeal.projectedMonthlyRevenue.toLocaleString()}/mo\n` +
        `Potential Profit: $${topDeal.monthlyProfit.toLocaleString()}/mo\n\n` +
        `Deal Score: ${topDeal.dealScore}/100 (Grade ${topDeal.dealGrade})\n\n` +
        `Deals like this don't last long - analyze it now!`,
      callToAction: `Analyze this deal: ${toolUrl}`,
      footer: `To your success,\nCoach Inayah's Team`
    };
  }
}

/**
 * Generate monthly market report newsletter content
 */
export async function generateMonthlyReportNewsletter(params: {
  contact: ContactInfo;
  marketSnapshot: MarketSnapshot;
  dealsFoundThisMonth: number;
  topDeals: RentalDeal[];
  toolUrl: string;
}): Promise<NewsletterContent> {
  const { contact, marketSnapshot, dealsFoundThisMonth, topDeals, toolUrl } = params;

  const topDealsText = topDeals.slice(0, 3).map((deal, i) =>
    `${i + 1}. ${deal.address} - $${deal.monthlyProfit.toLocaleString()}/mo profit (Grade ${deal.dealGrade})`
  ).join('\n');

  const systemPrompt = `You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist and founder of StayMetrics, managing $100M+ across 400+ properties in 35 U.S. markets. You are writing monthly market report emails on behalf of Coach Inayah for people interested in Airbnb arbitrage. Your communication style: data-first (every claim references specific numbers), "story before the stats" (lead with narrative, then data), warm but direct — like a monthly check-in from a trusted advisor.`;

  const userPrompt = `Write a monthly market report email for this recipient:

RECIPIENT INFO:
- Name: ${contact.firstName} ${contact.lastName}
- Target Market: ${contact.city}, ${contact.state}

MONTHLY MARKET SUMMARY FOR ${contact.city.toUpperCase()}:
- Market Score: ${marketSnapshot.metrics.marketScore}/100
- Market Health: ${marketSnapshot.insights.marketHealth.toUpperCase()}
- Average Revenue: $${marketSnapshot.metrics.averageRevenue.toLocaleString()}/year
- Average Daily Rate: $${marketSnapshot.metrics.averageDailyRate.toLocaleString()}
- Occupancy Rate: ${Math.round(marketSnapshot.metrics.occupancyRate * 100)}%
- Active Listings: ${marketSnapshot.metrics.activeListings.toLocaleString()}

THIS MONTH'S ACTIVITY:
- Deals Found: ${dealsFoundThisMonth}
- Top Deals:
${topDealsText || 'No deals found this month'}

MARKET INSIGHT:
${marketSnapshot.insights.recommendation}

TOOL URL: ${toolUrl}

Write a comprehensive but engaging monthly report email that:
1. Summarizes the month's market performance
2. Highlights any trends or changes
3. Showcases the best deals found (if any)
4. Provides encouragement and next steps
5. CTAs to explore the market further
6. Signs off as "Coach Inayah's Team"

LENGTH: 200-250 words for main content.

Output as JSON with these fields:
{
  "subject": "Email subject line (informative, personalized)",
  "preheader": "Preview text (50 chars max)",
  "greeting": "Personalized greeting",
  "mainContent": "The main email body (use \\n for line breaks)",
  "callToAction": "CTA text and link",
  "footer": "Sign-off"
}`;

  try {
    return await callClaudeForJson<NewsletterContent>(systemPrompt, userPrompt);
  } catch (error) {
    console.error('[Newsletter] Error generating monthly report content:', error);

    // Fallback content
    return {
      subject: `Your ${contact.city} Monthly Market Report`,
      preheader: `See how your market performed...`,
      greeting: `Hi ${contact.firstName},`,
      mainContent: `Here's your monthly market report for ${contact.city}, ${marketSnapshot.state}:\n\n` +
        `MARKET SNAPSHOT\n` +
        `• Market Score: ${marketSnapshot.metrics.marketScore}/100\n` +
        `• Average Revenue: $${marketSnapshot.metrics.averageRevenue.toLocaleString()}/year\n` +
        `• Occupancy: ${Math.round(marketSnapshot.metrics.occupancyRate * 100)}%\n\n` +
        `THIS MONTH\n` +
        `• Deals Found: ${dealsFoundThisMonth}\n\n` +
        `${marketSnapshot.insights.recommendation}`,
      callToAction: `Explore ${contact.city} market: ${toolUrl}`,
      footer: `To your success,\nCoach Inayah's Team`
    };
  }
}

/**
 * Generate email HTML from newsletter content
 */
export function generateEmailHtml(content: NewsletterContent, options?: {
  brandColor?: string;
  logoUrl?: string;
  unsubscribeUrl?: string;
}): string {
  const brandColor = options?.brandColor || '#C9A962';
  const logoUrl = options?.logoUrl || 'https://coachinayah.com/logo.png';
  const unsubscribeUrl = options?.unsubscribeUrl || '#';

  // Convert newlines to <br> tags
  const mainContentHtml = content.mainContent.replace(/\n/g, '<br>');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0F172A; padding: 24px; text-align: center;">
              <img src="${logoUrl}" alt="Coach Inayah" style="max-width: 180px; height: auto;" />
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <p style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 16px 0;">
                ${content.greeting}
              </p>
              <div style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 24px 0;">
                ${mainContentHtml}
              </div>
              <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: ${brandColor}; border-radius: 8px; padding: 14px 28px;">
                    <a href="#" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">
                      ${content.callToAction}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 14px; color: #6B7280; margin: 24px 0 0 0; line-height: 1.5;">
                ${content.footer.replace(/\n/g, '<br>')}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
                You're receiving this because you used Coach Inayah's Rental Revenue Calculator.
                <br>
                <a href="${unsubscribeUrl}" style="color: #9CA3AF; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
